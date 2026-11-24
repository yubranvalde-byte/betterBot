import asyncio
import copy
import hmac
import io
import json
import logging
import os
import re
import threading
import time
import uuid
import zipfile
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field

import main
import storage
from main import (
    FactoryState,
    has_blueprint_xml,
    node_adjudicator,
    node_construct,
    node_gate_1_5_linter,
    node_helper,
    node_upgrader,
    route_from_start,
)
from prompts import BETTY_PROMPT_ADVISOR_PROMPT, BETTY_TECH_SUPPORT_PROMPT

logger = logging.getLogger("betterbot.server")

app = FastAPI(
    title="BetterBot — The Intelligence Factory API",
    description="Web Backend & Real-time Multi-Agent Orchestrator for BetterBot 2.0",
    version="2.0.0",
)

_DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
_raw_origins = (os.environ.get("ALLOWED_ORIGINS") or "").strip()
ALLOWED_ORIGINS = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else _DEFAULT_ALLOWED_ORIGINS
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Workspace-ID", "X-Master-Key"],
    expose_headers=["Content-Disposition"],
)

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


# ==========================================
# Workspace Auth & Session Store (Multi-Tenant + SQLite Persistent Storage)
# ==========================================
MASTER_OWNER_ID = "master"
UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
MAX_CACHED_SESSIONS = int(os.environ.get("MAX_CACHED_SESSIONS", "256") or 256)
MAX_BETTY_WORKSPACES = int(os.environ.get("MAX_BETTY_WORKSPACES", "256") or 256)
MAX_BETTY_MESSAGES = 80
MAX_IMPORT_BYTES = 10 * 1024 * 1024
MAX_IMPORT_SESSIONS = 200

SESSIONS: "OrderedDict[Tuple[str, str], Dict[str, Any]]" = OrderedDict()
_CACHE_LOCK = threading.Lock()
_SESSION_LOCKS: Dict[Tuple[str, str], asyncio.Lock] = {}
_ACTIVE_STREAM_KEYS: Set[Tuple[str, str]] = set()


class _RateLimiter:
    """Thread-safe bounded sliding-window rate limiter using stdlib only."""

    def __init__(self, max_keys: int = 2048) -> None:
        self._max_keys = max_keys
        self._buckets: "OrderedDict[Tuple[str, str], List[float]]" = OrderedDict()
        self._lock = threading.Lock()

    def check(
        self, bucket: str, key: str, limit: int, window_seconds: float
    ) -> Tuple[bool, int]:
        now = time.monotonic()
        cutoff = now - window_seconds
        full_key = (bucket, key)
        with self._lock:
            timestamps = self._buckets.get(full_key)
            if timestamps is None:
                timestamps = []
                self._buckets[full_key] = timestamps
            else:
                self._buckets.move_to_end(full_key)
                timestamps[:] = [t for t in timestamps if t > cutoff]

            if len(timestamps) >= limit:
                retry_after = max(1, int(window_seconds - (now - timestamps[0])) + 1)
                return False, retry_after

            timestamps.append(now)
            while len(self._buckets) > self._max_keys:
                self._buckets.popitem(last=False)
            return True, 0


_RATE_LIMITER = _RateLimiter()


def _get_client_ip(request: Request) -> str:
    forwarded = (request.headers.get("X-Forwarded-For") or "").strip()
    if forwarded:
        first_ip = forwarded.split(",")[0].strip()
        if first_ip:
            return first_ip
    return request.client.host if request.client and request.client.host else "unknown"


def _enforce_rate_limit(
    request: Request,
    bucket: str,
    limit: int,
    window_seconds: float,
    identity: Optional[str] = None,
) -> None:
    ip = _get_client_ip(request)
    rate_key = f"{ip}:{identity}" if identity else ip
    allowed, retry_after = _RATE_LIMITER.check(bucket, rate_key, limit, window_seconds)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded; retry in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )


def _cache_put_session(cache_key: Tuple[str, str], session: Dict[str, Any]) -> None:
    with _CACHE_LOCK:
        SESSIONS[cache_key] = session
        SESSIONS.move_to_end(cache_key)
        while len(SESSIONS) > MAX_CACHED_SESSIONS:
            evict_key = next((k for k in SESSIONS if k not in _ACTIVE_STREAM_KEYS), None)
            if evict_key is None:
                break
            SESSIONS.pop(evict_key, None)


def _get_session_lock(cache_key: Tuple[str, str]) -> asyncio.Lock:
    with _CACHE_LOCK:
        lock = _SESSION_LOCKS.get(cache_key)
        if lock is None:
            if len(_SESSION_LOCKS) > MAX_CACHED_SESSIONS * 2:
                stale = [
                    k
                    for k, lk in _SESSION_LOCKS.items()
                    if not lk.locked() and k not in _ACTIVE_STREAM_KEYS and k not in SESSIONS
                ]
                for k in stale[:MAX_CACHED_SESSIONS]:
                    _SESSION_LOCKS.pop(k, None)
            lock = asyncio.Lock()
            _SESSION_LOCKS[cache_key] = lock
        return lock


def _get_master_workspace_key() -> str:
    return (os.environ.get("MASTER_WORKSPACE_KEY") or "").strip()


def _verify_master_key_value(candidate: str) -> Tuple[bool, bool]:
    configured_key = _get_master_workspace_key()
    if not configured_key:
        return False, False
    cleaned = (candidate or "").strip()
    if not cleaned:
        return False, True
    return hmac.compare_digest(cleaned, configured_key), True


def resolve_owner_id(request: Request) -> str:
    master_candidate = (request.headers.get("X-Master-Key") or "").strip()
    if master_candidate:
        authorized, configured = _verify_master_key_value(master_candidate)
        if authorized:
            return MASTER_OWNER_ID
        detail = (
            "Master workspace key is not configured on the server"
            if not configured
            else "Invalid Master Workspace Key"
        )
        raise HTTPException(status_code=401, detail=detail)

    raw_workspace_id = (
        request.headers.get("X-Workspace-ID")
        or request.query_params.get("workspace_id")
        or ""
    ).strip()

    if not raw_workspace_id:
        raise HTTPException(status_code=400, detail="Missing X-Workspace-ID")

    if raw_workspace_id.lower() == MASTER_OWNER_ID:
        raise HTTPException(
            status_code=403,
            detail="Master workspace requires valid X-Master-Key",
        )

    if not UUID_RE.match(raw_workspace_id):
        raise HTTPException(status_code=400, detail="Invalid X-Workspace-ID format")

    return str(uuid.UUID(raw_workspace_id))


def init_storage_and_hydrate() -> None:
    storage.init_db()


init_storage_and_hydrate()


def save_session_record(owner_id: str, session_id: Optional[str] = None) -> None:
    snapshots: List[Tuple[str, Dict[str, Any]]] = []
    with _CACHE_LOCK:
        if session_id:
            cached = SESSIONS.get((owner_id, session_id))
            if cached is not None:
                snapshots.append((session_id, copy.deepcopy(cached)))
        else:
            for (oid, sid), sess in list(SESSIONS.items()):
                if oid == owner_id:
                    snapshots.append((sid, copy.deepcopy(sess)))

    for sid, snapshot in snapshots:
        storage.save_session(sid, snapshot, owner_id)
        with _CACHE_LOCK:
            live = SESSIONS.get((owner_id, sid))
            if live is not None:
                if snapshot.get("created_at_iso"):
                    live["created_at_iso"] = snapshot["created_at_iso"]
                if snapshot.get("updated_at_iso"):
                    live["updated_at_iso"] = snapshot["updated_at_iso"]


def get_or_load_session(session_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    cache_key = (owner_id, session_id)
    with _CACHE_LOCK:
        if cache_key in SESSIONS:
            SESSIONS.move_to_end(cache_key)
            return SESSIONS[cache_key]
    loaded = storage.load_session(session_id, owner_id)
    if loaded:
        _cache_put_session(cache_key, loaded)
        return loaded
    return None


class UserMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=20000)
    mode: Optional[str] = "auto"  # "auto", "interview", "override"
    model_overrides: Optional[Dict[str, str]] = None


class RenameSessionRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)


class MasterKeyVerifyRequest(BaseModel):
    key: str = Field(default="", max_length=256)


def extract_helper_parts(raw_text: str) -> Dict[str, str]:
    """
    Separates hidden <thought_process> and <ARTIFACT_BLUEPRINT>/<GEM_BLUEPRINT> XML
    from the user-facing Hebrew message.
    """
    thought = ""
    thought_match = re.search(
        r"<thought_process>(.*?)</thought_process>", raw_text, flags=re.DOTALL | re.IGNORECASE
    )
    if thought_match:
        thought = thought_match.group(1).strip()

    cleaned = re.sub(
        r"<thought_process>.*?</thought_process>", "", raw_text, flags=re.DOTALL | re.IGNORECASE
    ).strip()

    blueprint_xml = ""
    bp_match = re.search(
        r"(<(?:ARTIFACT_BLUEPRINT|GEM_BLUEPRINT)\b.*?</(?:ARTIFACT_BLUEPRINT|GEM_BLUEPRINT)>)",
        cleaned,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if bp_match:
        blueprint_xml = bp_match.group(1).strip()

    chat_text = re.sub(
        r"```xml\s*<(?:ARTIFACT_BLUEPRINT|GEM_BLUEPRINT)\b.*?</(?:ARTIFACT_BLUEPRINT|GEM_BLUEPRINT)>\s*```",
        "",
        cleaned,
        flags=re.DOTALL | re.IGNORECASE,
    ).strip()
    if not chat_text and blueprint_xml:
        chat_text = re.sub(
            r"<(?:ARTIFACT_BLUEPRINT|GEM_BLUEPRINT)\b.*?</(?:ARTIFACT_BLUEPRINT|GEM_BLUEPRINT)>",
            "",
            cleaned,
            flags=re.DOTALL | re.IGNORECASE,
        ).strip()

    return {
        "thought": thought,
        "chat_text": chat_text or cleaned,
        "blueprint_xml": blueprint_xml,
    }


def extract_construct_parts(raw_text: str) -> Dict[str, str]:
    """
    Separates <compilation_check> from the compiled System Prompt / Skill artifact.
    """
    comp_check = ""
    match = re.search(
        r"<compilation_check>(.*?)</compilation_check>", raw_text, flags=re.DOTALL | re.IGNORECASE
    )
    if match:
        comp_check = match.group(1).strip()

    cleaned = re.sub(
        r"<compilation_check>.*?</compilation_check>", "", raw_text, flags=re.DOTALL | re.IGNORECASE
    ).strip()

    code_match = re.search(r"^`{3,4}(?:markdown|md)?\s*\n(.*?)\n`{3,4}\s*$", cleaned, flags=re.DOTALL)
    if code_match:
        cleaned = code_match.group(1).strip()

    return {
        "compilation_check": comp_check,
        "clean_prompt": cleaned,
    }


def parse_blueprint_tags(xml_str: str) -> Dict[str, str]:
    """
    Extracts key XML tags from <ARTIFACT_BLUEPRINT> (and legacy <GEM_BLUEPRINT>)
    for visual cards in the UI while maintaining full backward compatibility.
    """
    if not xml_str:
        return {}
    tags = [
        # BetterBot 2.0 schema
        "TARGET_TYPE",
        "SLUG_NAME",
        "ROLE_TITLE",
        "EPISTEMIC_STANCE",
        "TONE_AND_LANGUAGE",
        "DESCRIPTION_AND_TRIGGERS",
        "NEGATIVE_TRIGGERS",
        "SUITE_TOPOLOGY",
        "CLARIFICATION_GATE",
        "CORE_WORKFLOW",
        "PROGRESSIVE_DISCLOSURE_REFS",
        "VERIFICATION_RUBRIC",
        "FORMAT_SPEC",
        "GUARDRAILS",
        # Shared / legacy schema
        "TITLE",
        "TONE",
        "DOMAIN_EXPERTISE",
        "COGNITIVE_MODULES",
        "WORKFLOW",
        "NEGATIVE_CONSTRAINTS",
        "OUTPUT_FORMAT",
        "VERSION",
    ]
    parsed: Dict[str, str] = {}
    for tag in tags:
        m = re.search(rf"<{tag}>(.*?)</{tag}>", xml_str, flags=re.DOTALL | re.IGNORECASE)
        if m:
            parsed[tag.lower()] = m.group(1).strip()

    # Map 2.0 tags onto legacy keys so existing UI cards render cleanly
    if "title" not in parsed and "role_title" in parsed:
        parsed["title"] = parsed["role_title"]
    if "tone" not in parsed and "tone_and_language" in parsed:
        parsed["tone"] = parsed["tone_and_language"]
    if "domain_expertise" not in parsed and "epistemic_stance" in parsed:
        parsed["domain_expertise"] = parsed["epistemic_stance"]
    if "cognitive_modules" not in parsed and "verification_rubric" in parsed:
        parsed["cognitive_modules"] = parsed["verification_rubric"]
    if "workflow" not in parsed and "core_workflow" in parsed:
        parsed["workflow"] = parsed["core_workflow"]
    if "negative_constraints" not in parsed and "guardrails" in parsed:
        parsed["negative_constraints"] = parsed["guardrails"]
    if "output_format" not in parsed and "format_spec" in parsed:
        parsed["output_format"] = parsed["format_spec"]

    return parsed


def create_new_session(
    owner_id: str,
    title: str = "סשן חדש",
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    session_id = session_id or uuid.uuid4().hex[:12]
    now = datetime.now().strftime("%H:%M:%S")
    state: FactoryState = main.make_initial_state()
    session = {
        "session_id": session_id,
        "title": title,
        "title_manually_set": False,
        "created_at": now,
        "updated_at": now,
        "status": "idle",  # idle | interviewing | compiling | passed | escalated
        "active_node": None,
        "target_type": "SYSTEM_PROMPT",
        "slug_name": "",
        "needs_scripts": False,
        "is_repo_context": False,
        "reference_files": {},
        "rubric_scores": {},
        "readiness_scores": {},
        "model_telemetry": {},
        "state": state,
        "parsed_blueprint": {},
        "clean_champion_prompt": "",
        "clean_challenger_prompt": "",
        "diff_champion": "",
        "diff_challenger": "",
        "compilation_check": "",
        "chat_history": [
            {
                "id": str(uuid.uuid4())[:8],
                "role": "assistant",
                "agent": "The Helper (Requirements Architect)",
                "text": "שלום! אני ארכיטקט הדרישות של **מפעל הבינה (BetterBot 2.0)**.\nתאר לי בשפה חופשית את סוכן ה-AI או ה-Skill שאתה רוצה לבנות — מה מטרתו, מתי הוא אמור לפעול, ומה התוצר המצופה?",
                "thought": "",
                "timestamp": now,
            }
        ],
        "timeline": [
            {
                "id": str(uuid.uuid4())[:8],
                "timestamp": now,
                "node": "system",
                "title": "אתחול מפעל הבינה 2.0",
                "detail": "הסשן נוצר ונשמר במסד הנתונים המתמיד. ממתין לתיאור הסוכן או ה-Skill.",
                "status": "info",
            }
        ],
    }
    _cache_put_session((owner_id, session_id), session)
    save_session_record(owner_id, session_id)
    return session


def enrich_session(session: Dict[str, Any]) -> Dict[str, Any]:
    state = session["state"]
    bp_source = state.get("champion_xml") or state.get("challenger_xml") or ""
    if has_blueprint_xml(bp_source):
        bp_match = re.search(
            r"(<(?:ARTIFACT_BLUEPRINT|GEM_BLUEPRINT)\b.*?</(?:ARTIFACT_BLUEPRINT|GEM_BLUEPRINT)>)",
            bp_source,
            flags=re.DOTALL | re.IGNORECASE,
        )
        raw_bp = bp_match.group(1).strip() if bp_match else bp_source
        parsed_bp = parse_blueprint_tags(raw_bp)
        session["parsed_blueprint"] = parsed_bp
        session["raw_blueprint"] = raw_bp
    else:
        parsed_bp = {}
        session["parsed_blueprint"] = {}
        session["raw_blueprint"] = ""

    # Expose BetterBot 2.0 state fields at top level for REST & SSE consumers
    session["target_type"] = (
        state.get("target_type")
        or parsed_bp.get("target_type")
        or session.get("target_type")
        or "SYSTEM_PROMPT"
    )
    session["slug_name"] = (
        state.get("slug_name")
        or parsed_bp.get("slug_name")
        or session.get("slug_name")
        or ""
    )
    raw_state_refs = state.get("reference_files")
    sanitized_refs: Dict[str, str] = {}
    if isinstance(raw_state_refs, dict):
        for rel_path, content in raw_state_refs.items():
            norm = main.normalize_artifact_path(rel_path)
            if norm:
                sanitized_refs[norm] = content if isinstance(content, str) else str(content or "")
    elif isinstance(session.get("reference_files"), dict):
        for rel_path, content in session["reference_files"].items():
            norm = main.normalize_artifact_path(rel_path)
            if norm:
                sanitized_refs[norm] = content if isinstance(content, str) else str(content or "")

    state["reference_files"] = sanitized_refs
    session["reference_files"] = sanitized_refs
    raw_needs_scripts = (
        state.get("needs_scripts")
        if "needs_scripts" in state
        else session.get("needs_scripts", False)
    )
    needs_scripts = (
        False
        if str(session["target_type"]).strip().upper() == "SYSTEM_PROMPT"
        else bool(raw_needs_scripts)
    )
    state["needs_scripts"] = needs_scripts
    session["needs_scripts"] = needs_scripts
    readiness_obj = state.get("readiness_scores") or session.get("readiness_scores") or {}
    raw_bp_text = session.get("raw_blueprint") or ""
    is_repo_context = (
        bool(state.get("is_repo_context"))
        or bool(session.get("is_repo_context"))
        or ("AGENTS.md" in sanitized_refs)
        or main.is_repo_context_mode(
            readiness_obj,
            fallback_xml=raw_bp_text,
            ref_files=sanitized_refs,
        )
    )
    state["is_repo_context"] = is_repo_context
    session["is_repo_context"] = is_repo_context
    session["rubric_scores"] = state.get("rubric_scores") or session.get("rubric_scores") or {}
    session["readiness_scores"] = state.get("readiness_scores") or session.get("readiness_scores") or {}
    session["model_telemetry"] = state.get("model_telemetry") or session.get("model_telemetry") or {}

    # Auto-derive session title from <ROLE_TITLE>, <TITLE>, or slug_name if not manually renamed
    if not session.get("title_manually_set"):
        derived_title = (
            parsed_bp.get("role_title")
            or parsed_bp.get("title")
            or session.get("slug_name")
        )
        if derived_title:
            session["title"] = derived_title[:60]

    champ_p = state.get("champion_prompt", "")
    chall_p = state.get("challenger_prompt", "")
    if champ_p:
        if "### FILE:" in champ_p:
            _, parsed_refs = main.parse_compiled_artifacts(champ_p)
            if parsed_refs:
                state["reference_files"] = {**parsed_refs, **(state.get("reference_files") or {})}
                session["reference_files"] = state["reference_files"]
        parts = extract_construct_parts(champ_p)
        session["clean_champion_prompt"] = parts["clean_prompt"]
        if parts["compilation_check"]:
            session["compilation_check"] = parts["compilation_check"]
    else:
        parts = None
        session["clean_champion_prompt"] = ""

    if chall_p:
        if chall_p == champ_p and parts is not None:
            chall_parts = parts
        else:
            if "### FILE:" in chall_p:
                _, parsed_refs = main.parse_compiled_artifacts(chall_p)
                if parsed_refs:
                    state["reference_files"] = {**parsed_refs, **(state.get("reference_files") or {})}
                    session["reference_files"] = state["reference_files"]
            chall_parts = extract_construct_parts(chall_p)
        session["clean_challenger_prompt"] = chall_parts["clean_prompt"]
        if chall_parts["compilation_check"]:
            session["compilation_check"] = chall_parts["compilation_check"]
    else:
        session["clean_challenger_prompt"] = ""

    current_refs = session["reference_files"]
    prev_snapshot = state.get("previous_artifact_snapshot", "")
    clean_prev = (
        extract_construct_parts(prev_snapshot)["clean_prompt"]
        if prev_snapshot
        else ""
    )
    full_champ = main.format_artifact_with_references(
        session["clean_champion_prompt"], current_refs
    ).strip()
    full_chall = main.format_artifact_with_references(
        session["clean_challenger_prompt"], current_refs
    ).strip()
    if clean_prev:
        session["diff_champion"] = clean_prev
        session["diff_challenger"] = full_chall or full_champ
    else:
        session["diff_champion"] = full_champ
        session["diff_challenger"] = full_chall

    return session


# ==========================================
# Endpoints
# ==========================================
@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>BetterBot UI is loading...</h1>")
    html_content = await asyncio.to_thread(index_file.read_text, encoding="utf-8")
    return HTMLResponse(html_content)


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    with _CACHE_LOCK:
        active_count = len(SESSIONS)
    return {
        "status": "ok",
        "model": main.FAST_MODEL,
        "fast_model": main.FAST_MODEL,
        "compiler_model": main.COMPILER_MODEL,
        "fallback_model": main.FALLBACK_MODEL,
        "decision_model": main.DECISION_MODEL,
        "routing": main.get_model_routing_summary(),
        "active_sessions": active_count,
    }


@app.post("/api/workspace/verify-master")
async def verify_master_key(request: Request, req: MasterKeyVerifyRequest):
    _enforce_rate_limit(request, "verify-master", 10, 60.0)
    candidate = (req.key or request.headers.get("X-Master-Key") or "").strip()
    authorized, configured = _verify_master_key_value(candidate)
    return {"authorized": authorized, "configured": configured}


@app.get("/api/workspace/export")
async def export_workspace_history(owner_id: str = Depends(resolve_owner_id)):
    sessions_list = await asyncio.to_thread(storage.export_workspace_sessions, owner_id)
    payload = {
        "schema_version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "workspace_mode": "master" if owner_id == MASTER_OWNER_ID else "anonymous",
        "session_count": len(sessions_list),
        "sessions": sessions_list,
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    slug = "master" if owner_id == MASTER_OWNER_ID else "workspace"
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="betterbot-history-{slug}-{stamp}.json"'
        },
    )


@app.post("/api/workspace/import")
async def import_workspace_history(
    request: Request, owner_id: str = Depends(resolve_owner_id)
):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_IMPORT_BYTES:
                raise HTTPException(status_code=413, detail="Import payload too large")
        except ValueError:
            pass

    raw_body = await request.body()
    if len(raw_body) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="Import payload too large")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    raw_list = payload.get("sessions") if isinstance(payload, dict) else payload
    if isinstance(raw_list, list) and len(raw_list) > MAX_IMPORT_SESSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Import exceeds maximum of {MAX_IMPORT_SESSIONS} sessions",
        )

    try:
        summary = await asyncio.to_thread(storage.import_workspace_sessions, owner_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    with _CACHE_LOCK:
        for key in [k for k in SESSIONS if k[0] == owner_id]:
            SESSIONS.pop(key, None)

    return summary


@app.get("/api/sessions")
async def list_sessions(owner_id: str = Depends(resolve_owner_id)):
    sessions = await asyncio.to_thread(storage.list_sessions, owner_id)
    return {"sessions": sessions}


@app.post("/api/sessions")
async def create_session_endpoint(owner_id: str = Depends(resolve_owner_id)):
    session = await asyncio.to_thread(create_new_session, owner_id=owner_id)
    return enrich_session(session)


@app.get("/api/sessions/{session_id}")
async def get_session_endpoint(
    session_id: str, owner_id: str = Depends(resolve_owner_id)
):
    session = await asyncio.to_thread(get_or_load_session, session_id, owner_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return enrich_session(session)


@app.patch("/api/sessions/{session_id}")
async def rename_session_endpoint(
    session_id: str,
    req: RenameSessionRequest,
    owner_id: str = Depends(resolve_owner_id),
):
    clean_title = req.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    session = await asyncio.to_thread(get_or_load_session, session_id, owner_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    updated = await asyncio.to_thread(storage.rename_session, session_id, clean_title, owner_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    session["title"] = clean_title
    session["title_manually_set"] = True
    session["updated_at_iso"] = updated.get(
        "updated_at_iso", session.get("updated_at_iso")
    )
    return enrich_session(session)


@app.delete("/api/sessions/{session_id}")
async def delete_session_endpoint(
    session_id: str, owner_id: str = Depends(resolve_owner_id)
):
    with _CACHE_LOCK:
        SESSIONS.pop((owner_id, session_id), None)
    deleted = await asyncio.to_thread(storage.delete_session, session_id, owner_id)
    return {"deleted": bool(deleted)}


def build_install_guide_md(
    target_type: str,
    slug_name: str,
    file_paths: List[str],
    is_repo_context: bool = False,
) -> str:
    """
    Deterministically builds BETTERBOT_INSTALL.md (0 LLM calls) in concise,
    declarative English with strict Do-No-Harm installation rules.
    """
    safe_target = (target_type or "SYSTEM_PROMPT").strip().upper()
    safe_slug = (
        re.sub(r"[^a-zA-Z0-9_-]+", "-", (slug_name or "").strip()).strip("-")
        or "artifact"
    )

    manifest_items: List[str] = []
    seen = set()
    for raw_path in file_paths or []:
        norm = main.normalize_artifact_path(raw_path)
        if norm and norm not in seen:
            seen.add(norm)
            manifest_items.append(norm)

    manifest_lines = (
        "\n".join(f"- `{safe_slug}/{p}`" for p in manifest_items)
        or f"- `{safe_slug}/` (empty)"
    )
    has_system_prompt = "SYSTEM_PROMPT.md" in seen
    has_agents_md = is_repo_context or ("AGENTS.md" in seen)
    script_items = [
        p
        for p in manifest_items
        if p.endswith(".py") and (p.startswith("scripts/") or "/scripts/" in p)
    ]
    policy_rules = [
        "**Inspect Workspace First:** Before copying any files, inspect the target repository to detect the active skills directory "
        "(such as `.agent/skills/`, `.claude/skills/`, `.gemini/skills/`, or the user's configured skills root). "
        "If no skills directory is detected or the target location is unclear, ask the user before writing files.",
        "**Check Slug Collisions & Confirm Overwrites:** Check whether the target slug folder or any destination file already exists. "
        "If a collision is detected, halt and request explicit user confirmation before overwriting.",
        "**Copy Skill Folders Intact:** Preserve relative `references/` and `scripts/` paths and nested directory structures intact when installing "
        "`<slug>/` or nested `skills/<sub_slug>/` folders.",
    ]
    if script_items:
        scripts_formatted = ", ".join(f"`{p}`" for p in script_items)
        policy_rules.append(
            f"**Bundled Executable Scripts (`scripts/` — Python 3 Stdlib Only):** This package bundles deterministic helper script(s) ({scripts_formatted}) "
            "built exclusively with the **Python 3 standard library** (zero `pip install` third-party dependencies). "
            "Keep `scripts/*.py` in their exact relative path alongside `SKILL.md` so CLI invocations resolve without modification."
        )
    if has_agents_md:
        policy_rules.append(
            "**Repository Operational Contract (`AGENTS.md` — Do No Harm Integration):** This package includes a repository-level coding-agent "
            "operational contract (`AGENTS.md`). Before placing `AGENTS.md` at the target repository root (or syncing it with `CLAUDE.md`, `GEMINI.md`, "
            "or `.cursorrules`), inspect whether any root instruction file already exists. Never blindly overwrite an existing `AGENTS.md`, `CLAUDE.md`, "
            "or `GEMINI.md` — diff and merge sections or request explicit user confirmation first."
        )
    if has_system_prompt:
        policy_rules.append(
            "**Root Instruction File Protection (`SYSTEM_PROMPT.md`):** `SYSTEM_PROMPT.md` is present in this package. "
            "Do NOT automatically overwrite or append to root workspace instruction files "
            "(`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `AGENTS.md`). Present `SYSTEM_PROMPT.md` to the user or ask how they prefer to integrate it."
        )
    policy_rules.append(
        "**Archive & Installer Metadata Exclusion (`blueprint.xml`, `BETTERBOT_INSTALL.md`):** "
        "Both `blueprint.xml` and `BETTERBOT_INSTALL.md` are compiler/installer metadata only and must NOT be copied into "
        "runtime skill or instruction directories or loaded into active agent context."
    )
    policy_text = "\n".join(f"{idx}. {rule}" for idx, rule in enumerate(policy_rules, start=1))

    return (
        f"# BetterBot Package Installation Specification: `{safe_slug}`\n\n"
        "This file is a declarative installation manifest for human operators and workspace agents.\n\n"
        "## Package Metadata\n"
        f"- **Target Type:** `{safe_target}`\n"
        f"- **Root Slug:** `{safe_slug}/`\n\n"
        "## Included File Manifest\n"
        f"{manifest_lines}\n\n"
        "## Do No Harm Installation Policy\n"
        f"{policy_text}\n"
    )


@app.get("/api/sessions/{session_id}/download")
async def download_session_bundle(
    session_id: str, owner_id: str = Depends(resolve_owner_id)
):
    session = await asyncio.to_thread(get_or_load_session, session_id, owner_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    sess = enrich_session(session)
    target_type = sess.get("target_type") or "SYSTEM_PROMPT"
    raw_slug = sess.get("slug_name") or session_id
    safe_slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", raw_slug).strip("-") or session_id

    primary_content = sess.get("clean_champion_prompt") or sess.get("clean_challenger_prompt") or ""
    raw_blueprint = sess.get("raw_blueprint") or ""

    sanitized_refs: Dict[str, str] = {}
    for rel_path, content in (sess.get("reference_files") or {}).items():
        norm_path = main.normalize_artifact_path(rel_path)
        if not norm_path or norm_path == "BETTERBOT_INSTALL.md":
            continue
        sanitized_refs[norm_path] = content or ""

    is_repo_context = bool(
        sess.get("is_repo_context")
        or (sess.get("state") or {}).get("is_repo_context")
        or ("AGENTS.md" in sanitized_refs)
    )
    root_prompt_file = "AGENTS.md" if is_repo_context else "SYSTEM_PROMPT.md"
    if is_repo_context and "SYSTEM_PROMPT.md" in sanitized_refs:
        if "AGENTS.md" not in sanitized_refs:
            sanitized_refs["AGENTS.md"] = sanitized_refs.pop("SYSTEM_PROMPT.md")
        else:
            sanitized_refs.pop("SYSTEM_PROMPT.md", None)

    entries: List[Tuple[str, str]] = []
    written_paths = set()

    if target_type == "SKILL_PACKAGE":
        if "SKILL.md" not in sanitized_refs and primary_content:
            entries.append(("SKILL.md", primary_content))
            written_paths.add("SKILL.md")
    elif target_type == "HYBRID_BUNDLE":
        if (
            root_prompt_file not in sanitized_refs
            and "SKILL.md" not in sanitized_refs
            and primary_content
        ):
            entries.append((root_prompt_file, primary_content))
            written_paths.add(root_prompt_file)
    else:
        if root_prompt_file not in sanitized_refs and primary_content:
            entries.append((root_prompt_file, primary_content))
            written_paths.add(root_prompt_file)

    for norm_path, content in sanitized_refs.items():
        if norm_path in written_paths or (norm_path == "blueprint.xml" and raw_blueprint):
            continue
        entries.append((norm_path, content))
        written_paths.add(norm_path)

    if raw_blueprint and "blueprint.xml" not in written_paths:
        entries.append(("blueprint.xml", raw_blueprint))
        written_paths.add("blueprint.xml")

    manifest_paths = [rel for rel, _ in entries] + ["BETTERBOT_INSTALL.md"]
    install_guide = build_install_guide_md(
        target_type, safe_slug, manifest_paths, is_repo_context=is_repo_context
    )
    entries.append(("BETTERBOT_INSTALL.md", install_guide))

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rel_path, content in entries:
            clean_rel = main.normalize_artifact_path(rel_path)
            if not clean_rel:
                continue
            zf.writestr(f"{safe_slug}/{clean_rel}", content)

    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_slug}.zip"'},
    )


def _apply_node_update(state: Dict[str, Any], update: Dict[str, Any]) -> None:
    """Applies node state deltas while preserving additive error_log and merged model_telemetry."""
    if not update:
        return
    if "error_log" in update:
        state["error_log"] = list(state.get("error_log", [])) + list(
            update["error_log"] or []
        )
    if "model_telemetry" in update:
        merged_tel = dict(state.get("model_telemetry") or {})
        merged_tel.update(update["model_telemetry"] or {})
        state["model_telemetry"] = merged_tel
    for k, v in update.items():
        if k not in ("error_log", "model_telemetry"):
            state[k] = v


def _attach_timeline_telemetry(
    entry: Dict[str, Any], node_tel: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """Attaches optional model/thinking/fallback metadata to a timeline item."""
    if not node_tel:
        return entry
    if node_tel.get("model"):
        entry["model"] = node_tel["model"]
    if node_tel.get("thinking_level"):
        entry["thinking_level"] = node_tel["thinking_level"]
    if node_tel.get("fallback_used"):
        entry["fallback_used"] = True
        fallback_from = node_tel.get("fallback_from") or "primary"
        entry["detail"] = (
            f"{entry.get('detail', '')} [Fallback: {fallback_from} -> {node_tel.get('model')}]"
        ).strip()
    if node_tel.get("latency_ms") is not None:
        entry["latency_ms"] = node_tel["latency_ms"]
    return entry


def _resolve_non_compiling_status(
    session: Dict[str, Any], state: Dict[str, Any]
) -> str:
    last_log = state["error_log"][-1] if state.get("error_log") else ""
    if "[PASS]" in last_log:
        return "passed"
    if "[ESCALATE]" in last_log:
        return "escalated"
    if state.get("user_input") or state.get("challenger_xml"):
        return "interviewing"
    return "idle"


@app.post("/api/sessions/{session_id}/stream")
async def stream_factory_execution(
    session_id: str,
    req: UserMessageRequest,
    request: Request,
    owner_id: str = Depends(resolve_owner_id),
):
    """
    Executes the LangGraph workflow step-by-step and streams real-time SSE updates
    so the UI can animate each node (Helper -> Construct -> Adjudicator <-> Upgrader).
    """
    _enforce_rate_limit(request, "stream", 20, 60.0, identity=owner_id)
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Empty message")

    cache_key = (owner_id, session_id)
    session_lock = _get_session_lock(cache_key)
    if session_lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Session already has an active execution stream",
        )

    await session_lock.acquire()
    _ACTIVE_STREAM_KEYS.add(cache_key)
    streaming_started = False

    try:
        session = await asyncio.to_thread(get_or_load_session, session_id, owner_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        now = datetime.now().strftime("%H:%M:%S")
        session["updated_at"] = now

        # Update session title from first user input
        if session["title"] == "סשן חדש":
            session["title"] = user_msg[:36] + ("..." if len(user_msg) > 36 else "")

        state: FactoryState = session["state"]
        if req.model_overrides is not None:
            sanitized_overrides = main.sanitize_model_overrides(req.model_overrides)
            if sanitized_overrides:
                state["model_overrides"] = sanitized_overrides
            elif req.model_overrides == {}:
                state.pop("model_overrides", None)

        # Determine whether this is an interview turn or a manual override directive
        is_override = (
            req.mode == "override"
            or session["status"] in ["escalated", "passed"]
            or (state.get("iteration_count", 0) > 0)
        )

        if is_override:
            session["chat_history"].append(
                {
                    "id": str(uuid.uuid4())[:8],
                    "role": "user",
                    "is_override": True,
                    "text": user_msg,
                    "timestamp": now,
                }
            )
            state["error_log"] = list(state.get("error_log", [])) + [
                f"[MANUAL OVERRIDE] {user_msg}"
            ]
            state["iteration_count"] = 1
            state["linter_retries"] = 0
            session["timeline"].append(
                {
                    "id": str(uuid.uuid4())[:8],
                    "timestamp": now,
                    "node": "override",
                    "title": "פקודת עריכה ידנית (Manual Override)",
                    "detail": user_msg,
                    "status": "warning",
                }
            )
        else:
            session["chat_history"].append(
                {
                    "id": str(uuid.uuid4())[:8],
                    "role": "user",
                    "is_override": False,
                    "text": user_msg,
                    "timestamp": now,
                }
            )
            if not state.get("user_input"):
                state["user_input"] = user_msg
            else:
                last_helper = state.get("challenger_xml", "")
                clean_helper = extract_helper_parts(last_helper)["chat_text"]
                state["user_input"] += f"\nAssistant: {clean_helper}\nUser: {user_msg}"

        await asyncio.to_thread(save_session_record, owner_id, session_id)

        async def event_generator():
            def sse(event_type: str, payload: Dict[str, Any]) -> str:
                return f"event: {event_type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

            try:
                # Determine starting node using route_from_start
                current_node = route_from_start(state)
                yield sse("session_update", enrich_session(session))
                await asyncio.sleep(0)

                while current_node != main.END:
                    step_time = datetime.now().strftime("%H:%M:%S")
                    session["active_node"] = current_node

                    node_labels = {
                        "node_1_helper": ("Node 1: The Helper", "מנתח דרישות ומנסח שאלות / Blueprint..."),
                        "node_2_construct": ("Node 2: The Construct", "מהדר את ה-Blueprint לתוצר סופי..."),
                        "gate_1_5_linter": ("Gate 1.5: Structural Linter", "מאמת מבנה YAML, הפניות וקובצי חבילה (0 טוקנים)..."),
                        "node_3_upgrader": ("Node 3: The Upgrader", "מבצע ניתוח השפעה ומשדרג את ה-Blueprint והתוצר..."),
                        "node_4_adjudicator": ("Node 4: The Adjudicator", "מבצע ביקורת איכות (QA) ובדיקת רגרסיה..."),
                    }
                    label_title, label_desc = node_labels.get(current_node, (current_node, "מבצע פעולה..."))
                    routing_plan = main.get_node_routing_plan(current_node, state)

                    yield sse(
                        "node_start",
                        {
                            "node": current_node,
                            "title": label_title,
                            "description": label_desc,
                            "iteration": state.get("iteration_count", 0),
                            "model": routing_plan["model"],
                            "thinking_level": routing_plan["thinking_level"],
                        },
                    )
                    await asyncio.sleep(0)

                    node_tel: Dict[str, Any] = {}

                    # Execute the node in a worker thread on an isolated state snapshot
                    if current_node == "node_1_helper":
                        session["status"] = "interviewing"
                        update = await asyncio.to_thread(node_helper, copy.deepcopy(state))
                        _apply_node_update(state, update)
                        node_tel = (update.get("model_telemetry") or {}).get("node_1_helper") or {}

                        parts = extract_helper_parts(state.get("challenger_xml", ""))
                        has_blueprint = has_blueprint_xml(state.get("challenger_xml", ""))

                        if has_blueprint:
                            session["chat_history"].append(
                                {
                                    "id": str(uuid.uuid4())[:8],
                                    "role": "assistant",
                                    "agent": "The Helper (Requirements Architect)",
                                    "text": parts["chat_text"]
                                    or "תוכנית האב (`<ARTIFACT_BLUEPRINT>`) מוכנה! מעביר כעת למהדר (The Construct)...",
                                    "thought": parts["thought"],
                                    "has_blueprint": True,
                                    "timestamp": step_time,
                                }
                            )
                            session["timeline"].append(
                                _attach_timeline_telemetry(
                                    {
                                        "id": str(uuid.uuid4())[:8],
                                        "timestamp": step_time,
                                        "node": "node_1_helper",
                                        "title": "הופק XML Blueprint",
                                        "detail": "הראיון הושלם ותורגם לארכיטקטורה קוגניטיבית.",
                                        "status": "success",
                                    },
                                    node_tel,
                                )
                            )
                        else:
                            session["chat_history"].append(
                                {
                                    "id": str(uuid.uuid4())[:8],
                                    "role": "assistant",
                                    "agent": "The Helper (Requirements Architect)",
                                    "text": parts["chat_text"],
                                    "thought": parts["thought"],
                                    "has_blueprint": False,
                                    "timestamp": step_time,
                                }
                            )
                            session["timeline"].append(
                                _attach_timeline_telemetry(
                                    {
                                        "id": str(uuid.uuid4())[:8],
                                        "timestamp": step_time,
                                        "node": "node_1_helper",
                                        "title": "שאלת מיקוד בראיון",
                                        "detail": parts["chat_text"][:120] + ("..." if len(parts["chat_text"]) > 120 else ""),
                                        "status": "info",
                                    },
                                    node_tel,
                                )
                            )

                    elif current_node == "node_2_construct":
                        session["status"] = "compiling"
                        update = await asyncio.to_thread(node_construct, copy.deepcopy(state))
                        _apply_node_update(state, update)
                        node_tel = (update.get("model_telemetry") or {}).get("node_2_construct") or {}

                        session["timeline"].append(
                            _attach_timeline_telemetry(
                                {
                                    "id": str(uuid.uuid4())[:8],
                                    "timestamp": step_time,
                                    "node": "node_2_construct",
                                    "title": "הידור הפרומפט הושלם (The Construct)",
                                    "detail": f"נוצר Challenger Prompt באורך {len(state.get('challenger_prompt', ''))} תווים.",
                                    "status": "success",
                                },
                                node_tel,
                            )
                        )

                    elif current_node == "node_3_upgrader":
                        session["status"] = "compiling"
                        update = await asyncio.to_thread(node_upgrader, copy.deepcopy(state))
                        _apply_node_update(state, update)
                        node_tel = (update.get("model_telemetry") or {}).get("node_3_upgrader") or {}

                        session["timeline"].append(
                            _attach_timeline_telemetry(
                                {
                                    "id": str(uuid.uuid4())[:8],
                                    "timestamp": step_time,
                                    "node": "node_3_upgrader",
                                    "title": f"שדרוג גרסה הושלם (איטרציה {state.get('iteration_count', 1)})",
                                    "detail": "עודכנו ה-XML וה-System Prompt בהתאם להנחיות התיקון.",
                                    "status": "info",
                                },
                                node_tel,
                            )
                        )

                    elif current_node == "gate_1_5_linter":
                        session["status"] = "compiling"
                        update = await asyncio.to_thread(node_gate_1_5_linter, copy.deepcopy(state))
                        _apply_node_update(state, update)
                        node_tel = (update.get("model_telemetry") or {}).get("gate_1_5_linter") or {}
                        lint_res = state.get("linter_result") or {}

                        if lint_res.get("passed"):
                            lint_title = "Gate 1.5 Linter: PASS"
                            lint_detail = "בדיקת מבנה דטרמיניסטית עברה בהצלחה (0 טוקנים). ממשיך ל-Gate 2."
                            lint_status = "success"
                        elif lint_res.get("will_retry"):
                            lint_title = "Gate 1.5 Linter: FAIL -> Upgrader"
                            lint_detail = lint_res.get("correction_directive") or "אותרו כשלים מבניים; מעביר לתיקון אטומי."
                            lint_status = "warning"
                        else:
                            lint_title = "Gate 1.5 Linter: Cap Reached -> Gate 2"
                            lint_detail = "תקרת ניסיונות הלינטר מוצתה; ממשיך ל-Adjudicator."
                            lint_status = "warning"

                        session["timeline"].append(
                            _attach_timeline_telemetry(
                                {
                                    "id": str(uuid.uuid4())[:8],
                                    "timestamp": step_time,
                                    "node": "gate_1_5_linter",
                                    "title": lint_title,
                                    "detail": lint_detail,
                                    "status": lint_status,
                                },
                                node_tel,
                            )
                        )

                    elif current_node == "node_4_adjudicator":
                        session["status"] = "compiling"
                        prev_iter = state.get("iteration_count", 0)
                        update = await asyncio.to_thread(node_adjudicator, copy.deepcopy(state))
                        _apply_node_update(state, update)
                        node_tel = (update.get("model_telemetry") or {}).get("node_4_adjudicator") or {}

                        new_logs = update.get("error_log") or []
                        last_log = state["error_log"][-1] if state.get("error_log") else ""
                        qa_mode = "Baseline QA" if prev_iter == 0 else f"Regression QA (#{prev_iter})"

                        if "[PASS]" in last_log:
                            session["timeline"].append(
                                _attach_timeline_telemetry(
                                    {
                                        "id": str(uuid.uuid4())[:8],
                                        "timestamp": step_time,
                                        "node": "node_4_adjudicator",
                                        "title": f"{qa_mode}: PASS ✅",
                                        "detail": "הפרומפט עמד בכל בדיקות האיכות ואושר לשימוש!",
                                        "status": "success",
                                    },
                                    node_tel,
                                )
                            )
                        elif "[FAIL]" in last_log and "[ESCALATE]" not in last_log:
                            session["timeline"].append(
                                _attach_timeline_telemetry(
                                    {
                                        "id": str(uuid.uuid4())[:8],
                                        "timestamp": step_time,
                                        "node": "node_4_adjudicator",
                                        "title": f"{qa_mode}: FAIL 🔄",
                                        "detail": last_log,
                                        "status": "warning",
                                    },
                                    node_tel,
                                )
                            )
                        else:
                            fail_detail = new_logs[0] if len(new_logs) >= 2 and "[FAIL]" in new_logs[0] else ""
                            if fail_detail:
                                session["timeline"].append(
                                    _attach_timeline_telemetry(
                                        {
                                            "id": str(uuid.uuid4())[:8],
                                            "timestamp": step_time,
                                            "node": "node_4_adjudicator",
                                            "title": f"{qa_mode}: FAIL 🔄",
                                            "detail": fail_detail,
                                            "status": "warning",
                                        },
                                        node_tel,
                                    )
                                )
                                session["timeline"].append(
                                    {
                                        "id": str(uuid.uuid4())[:8],
                                        "timestamp": step_time,
                                        "node": "circuit_breaker",
                                        "title": "Circuit Breaker הופעל (מקסימום איטרציות)",
                                        "detail": "נדרשת הכוונה ידנית של המשתמש עבור הסוכן המשדרג.",
                                        "status": "danger",
                                    }
                                )
                            else:
                                session["timeline"].append(
                                    _attach_timeline_telemetry(
                                        {
                                            "id": str(uuid.uuid4())[:8],
                                            "timestamp": step_time,
                                            "node": "node_4_adjudicator",
                                            "title": f"{qa_mode}: ESCALATE ⚠️",
                                            "detail": last_log,
                                            "status": "danger",
                                        },
                                        node_tel,
                                    )
                                )
                    else:
                        break

                    next_node = main.resolve_next_node(current_node, state)

                    enrich_session(session)
                    await asyncio.to_thread(save_session_record, owner_id, session_id)
                    yield sse(
                        "node_complete",
                        {
                            "node": current_node,
                            "next_node": None if next_node == main.END else next_node,
                            "telemetry": node_tel,
                            "session": session,
                        },
                    )
                    await asyncio.sleep(0)
                    current_node = next_node

                # Finalize status after graph reaches END
                session["active_node"] = None
                last_log = state["error_log"][-1] if state.get("error_log") else ""
                if "[PASS]" in last_log:
                    session["status"] = "passed"
                    session["chat_history"].append(
                        {
                            "id": str(uuid.uuid4())[:8],
                            "role": "assistant",
                            "agent": "The Adjudicator (QA Architect)",
                            "text": "🌟 **הפרומפט אושר בהצלחה (PASS)!**\nהפרומפט הסופי ותוכנית ה-XML מוכנים בחלונית התוצרים משמאל. תוכל להעתיק או להוריד אותם, או לשלוח הנחיית שדרוג נוספת בכל עת.",
                            "thought": "",
                            "is_system_verdict": True,
                            "verdict": "PASS",
                            "timestamp": datetime.now().strftime("%H:%M:%S"),
                        }
                    )
                elif "[ESCALATE]" in last_log:
                    session["status"] = "escalated"
                    session["chat_history"].append(
                        {
                            "id": str(uuid.uuid4())[:8],
                            "role": "assistant",
                            "agent": "Circuit Breaker (Escalation)",
                            "text": f"⚠️ **מערכת בקרת האיכות עצרה להתערבות ידנית (ESCALATE).**\n\nפרטי הביקורת האחרונה:\n`{last_log}`\n\nכתוב לי כאן בתיבת ההודעות הוראת תיקון מדויקת ואעביר אותה ישירות ל-**Upgrader**.",
                            "thought": "",
                            "is_system_verdict": True,
                            "verdict": "ESCALATE",
                            "timestamp": datetime.now().strftime("%H:%M:%S"),
                        }
                    )
                else:
                    session["status"] = "interviewing"

                enrich_session(session)
                await asyncio.to_thread(save_session_record, owner_id, session_id)
                yield sse("done", session)

            except asyncio.CancelledError:
                session["active_node"] = None
                session["status"] = _resolve_non_compiling_status(session, state)
                enrich_session(session)
                try:
                    await asyncio.shield(
                        asyncio.to_thread(save_session_record, owner_id, session_id)
                    )
                except Exception as save_exc:
                    logger.warning(
                        "Failed to save cancelled session %s: %s", session_id, save_exc
                    )
                raise

            except Exception as exc:
                session["active_node"] = None
                session["status"] = _resolve_non_compiling_status(session, state)
                err_msg = main._sanitize_error_text(exc)
                session["timeline"].append(
                    {
                        "id": str(uuid.uuid4())[:8],
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                        "node": "error",
                        "title": "שגיאת ריצה",
                        "detail": err_msg,
                        "status": "danger",
                    }
                )
                enrich_session(session)
                await asyncio.to_thread(save_session_record, owner_id, session_id)
                yield sse("error", {"error": err_msg, "session": session})

            finally:
                session["active_node"] = None
                if session.get("status") == "compiling":
                    session["status"] = _resolve_non_compiling_status(session, state)
                _ACTIVE_STREAM_KEYS.discard(cache_key)
                if session_lock.locked():
                    session_lock.release()

        streaming_started = True
        return StreamingResponse(event_generator(), media_type="text/event-stream")
    finally:
        if not streaming_started:
            _ACTIVE_STREAM_KEYS.discard(cache_key)
            if session_lock.locked():
                session_lock.release()


# ==========================================
# Betty (בטי) — Floating Assistant Endpoints
# ==========================================
BETTY_WELCOME = {
    "tech_support": (
        "היי! אני **בטי (Betty)** במצב **תמיכה טכנית והדרכת מערכת** 🛠️.\n"
        "אני מכירה כל בורג ב-BetterBot: איך 4 הסוכנים עובדים, מה קורה בכל שלב בגרף, "
        "איך להשתמש בלשוניות ובמצב העריכה הישירה, ומה קורה בסשן שלך כרגע.\n\n"
        "איך אפשר לעזור לך?"
    ),
    "prompt_advisor": (
        "שלום. אני **בטי (Betty)** במצב **יועצת הנדסת פרומפטים (Master Prompt Architect & Mentor V5)** 🧠.\n"
        "במצב זה אסייע לך בניתוח ארכיטקטורות פרומפטים, בחירת מודולים קוגניטיביים (Cognitive Modules), "
        "ביקורת על ה-XML Blueprint או הפרומפט הנוכחי שלך, וניסוח הנחיות שדרוג מדויקות.\n\n"
        "מהו האתגר הארכיטקטוני או הבוט שעליו אנו עובדים?"
    ),
}

BETTY_HISTORIES: "OrderedDict[str, Dict[str, List[Dict[str, Any]]]]" = OrderedDict()


def _trim_betty_history(history: List[Dict[str, Any]]) -> None:
    if len(history) > MAX_BETTY_MESSAGES:
        history[:] = [history[0]] + history[-(MAX_BETTY_MESSAGES - 1) :]


def _welcome_betty_entry(mode: str) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4())[:8],
        "role": "assistant",
        "mode": mode,
        "text": BETTY_WELCOME.get(mode, BETTY_WELCOME["tech_support"]),
        "thought": "",
        "timestamp": datetime.now().strftime("%H:%M:%S"),
    }


def _ensure_betty_histories_locked(owner_id: str) -> Dict[str, List[Dict[str, Any]]]:
    owner_histories = BETTY_HISTORIES.get(owner_id)
    if owner_histories is None:
        owner_histories = {}
        BETTY_HISTORIES[owner_id] = owner_histories
    BETTY_HISTORIES.move_to_end(owner_id)
    while len(BETTY_HISTORIES) > MAX_BETTY_WORKSPACES:
        BETTY_HISTORIES.popitem(last=False)
    for m in ("tech_support", "prompt_advisor"):
        if m not in owner_histories:
            owner_histories[m] = [_welcome_betty_entry(m)]
    return owner_histories


def init_betty_mode(owner_id: str, mode: str) -> List[Dict[str, Any]]:
    with _CACHE_LOCK:
        owner_histories = _ensure_betty_histories_locked(owner_id)
        owner_histories[mode] = [_welcome_betty_entry(mode)]
        return list(owner_histories[mode])


def get_betty_histories(owner_id: str) -> Dict[str, List[Dict[str, Any]]]:
    with _CACHE_LOCK:
        owner_histories = _ensure_betty_histories_locked(owner_id)
        return {
            "tech_support": list(owner_histories["tech_support"]),
            "prompt_advisor": list(owner_histories["prompt_advisor"]),
        }


class BettyChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=12000)
    mode: str = "tech_support"  # "tech_support" | "prompt_advisor"
    session_id: Optional[str] = Field(default=None, max_length=128)


class BettyClearRequest(BaseModel):
    mode: str = "tech_support"


def build_session_context_for_betty(session_id: Optional[str], owner_id: str) -> str:
    if not session_id:
        return "<current_session_context>\nNo active session selected.\n</current_session_context>"

    loaded = get_or_load_session(session_id, owner_id)
    if not loaded:
        return "<current_session_context>\nNo active session selected.\n</current_session_context>"

    sess = enrich_session(loaded)
    st = sess.get("state", {})
    lines = [
        "<current_session_context>",
        f"Session ID: {sess.get('session_id')}",
        f"Session Title: {sess.get('title')}",
        f"Target Type: {sess.get('target_type', 'SYSTEM_PROMPT')}",
        f"Slug Name: {sess.get('slug_name') or 'N/A'}",
        f"Current Status: {sess.get('status')} (Active Node: {sess.get('active_node')})",
        f"QA Iteration Count: {st.get('iteration_count', 0)} / {getattr(main, 'MAX_QA_ITERATIONS', 2)}",
        f"Model Routing: Helper/Betty={main.HELPER_MODEL}(low), Construct/Upgrader={main.CONSTRUCT_MODEL}(med/low), Adjudicator={main.ADJUDICATOR_MODEL}(low), Fallback={main.FALLBACK_MODEL}, Decision={main.DECISION_MODEL}",
    ]
    rubric_scores = sess.get("rubric_scores") or {}
    if rubric_scores:
        lines.append(
            f"gemini-decision-1 Rubric Scores:\n{json.dumps(rubric_scores, ensure_ascii=False)}"
        )
        if rubric_scores.get("trigger_deconfliction") is not None:
            lines.append(
                f"Trigger De-confliction Score (SKILL_SUITE 7th Dimension): {rubric_scores['trigger_deconfliction']}/5"
            )
    if sess.get("raw_blueprint"):
        lines.append(f"Current Blueprint XML:\n{sess['raw_blueprint']}")
    if sess.get("clean_champion_prompt"):
        lines.append(f"Current Champion Artifact:\n{sess['clean_champion_prompt'][:2500]}")
    ref_files = sess.get("reference_files") or {}
    if ref_files:
        ref_paths = list(ref_files.keys())
        has_nested_suite = any(p.startswith("skills/") for p in ref_paths)
        target_type_upper = str(sess.get("target_type") or "SYSTEM_PROMPT").strip().upper()
        if target_type_upper == "SKILL_SUITE" or has_nested_suite:
            tree_lines = "\n".join(f"  - {p}" for p in ref_paths)
            lines.append(f"SKILL_SUITE File Tree ({len(ref_paths)} files):\n{tree_lines}")
            skill_excerpts = []
            for path in ref_paths:
                if path.startswith("skills/") and path.endswith("/SKILL.md"):
                    excerpt = (ref_files.get(path) or "").strip()[:600]
                    if excerpt:
                        skill_excerpts.append(f"--- {path} ---\n{excerpt}")
            if skill_excerpts:
                lines.append(
                    "Sibling Skill Frontmatter & Trigger Excerpts:\n"
                    + "\n\n".join(skill_excerpts)
                )
            lines.append(
                "Export Package Note: Downloading this session as .ZIP bundles all nested skills under "
                "`<slug_name>/skills/<sub_slug>/` together with `blueprint.xml` and a Do-No-Harm "
                "`BETTERBOT_INSTALL.md` guide."
            )
        else:
            ref_summary = ", ".join(ref_paths)
            lines.append(f"Auxiliary Reference Files (Progressive Disclosure): {ref_summary}")
    if st.get("error_log"):
        lines.append("QA Error Log:\n" + "\n".join(st["error_log"][-4:]))
    lines.append("</current_session_context>")
    return "\n".join(lines)


def parse_betty_response(raw_text: str) -> Dict[str, str]:
    """
    Extracts <thought_process> (even if wrapped in ```markdown ... ```) and <output> tags.
    """
    thought = ""
    cleaned = raw_text

    # 1. Check for ```markdown <thought_process>...</thought_process> ``` or similar fenced block
    fenced_thought = re.search(
        r"```(?:markdown|xml|text)?\s*(<thought_process>.*?</thought_process>)\s*```",
        cleaned,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if fenced_thought:
        inner = re.search(
            r"<thought_process>(.*?)</thought_process>",
            fenced_thought.group(1),
            flags=re.DOTALL | re.IGNORECASE,
        )
        thought = inner.group(1).strip() if inner else fenced_thought.group(1).strip()
        cleaned = (
            cleaned[: fenced_thought.start()] + cleaned[fenced_thought.end() :]
        ).strip()
    else:
        raw_thought = re.search(
            r"<thought_process>(.*?)</thought_process>",
            cleaned,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if raw_thought:
            thought = raw_thought.group(1).strip()
            cleaned = re.sub(
                r"<thought_process>.*?</thought_process>",
                "",
                cleaned,
                flags=re.DOTALL | re.IGNORECASE,
            ).strip()

    # 2. Extract <output>...</output> if present
    out_match = re.search(
        r"<output>(.*?)</output>", cleaned, flags=re.DOTALL | re.IGNORECASE
    )
    if out_match:
        cleaned = out_match.group(1).strip()
    else:
        cleaned = re.sub(r"</?output>", "", cleaned, flags=re.IGNORECASE).strip()

    return {
        "thought": thought,
        "text": cleaned or raw_text.strip(),
    }


@app.get("/api/betty/history")
async def get_betty_history(owner_id: str = Depends(resolve_owner_id)):
    histories = get_betty_histories(owner_id)
    return {
        "tech_support": histories["tech_support"],
        "prompt_advisor": histories["prompt_advisor"],
    }


@app.post("/api/betty/clear")
async def clear_betty_history(
    req: BettyClearRequest, owner_id: str = Depends(resolve_owner_id)
):
    mode = req.mode if req.mode in ("tech_support", "prompt_advisor") else "tech_support"
    history = init_betty_mode(owner_id, mode)
    return {
        "mode": mode,
        "history": history,
    }


@app.post("/api/betty/chat")
async def betty_chat_endpoint(
    req: BettyChatRequest,
    request: Request,
    owner_id: str = Depends(resolve_owner_id),
):
    _enforce_rate_limit(request, "betty", 30, 60.0, identity=owner_id)
    mode = req.mode if req.mode in ["tech_support", "prompt_advisor"] else "tech_support"
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Empty message")

    now = datetime.now().strftime("%H:%M:%S")
    with _CACHE_LOCK:
        histories = _ensure_betty_histories_locked(owner_id)
        history = histories[mode]
        history.append(
            {
                "id": str(uuid.uuid4())[:8],
                "role": "user",
                "mode": mode,
                "text": user_msg,
                "timestamp": now,
            }
        )
        _trim_betty_history(history)
        recent_turns = list(history[1:-1][-10:])

    sys_prompt = (
        BETTY_TECH_SUPPORT_PROMPT
        if mode == "tech_support"
        else BETTY_PROMPT_ADVISOR_PROMPT
    )
    session_ctx = await asyncio.to_thread(
        build_session_context_for_betty, req.session_id, owner_id
    )

    lc_messages = [
        SystemMessage(content=f"{sys_prompt}\n\n{session_ctx}"),
    ]

    # Include recent conversation turns (excluding the initial static greeting)
    for item in recent_turns:
        if item["role"] == "user":
            lc_messages.append(HumanMessage(content=item["text"]))
        else:
            lc_messages.append(AIMessage(content=item.get("raw_text") or item["text"]))

    lc_messages.append(HumanMessage(content=user_msg))

    try:
        response, betty_tel = await asyncio.to_thread(main.invoke_betty, lc_messages)
        content_str = main._normalize_content(response.content)

        parsed = parse_betty_response(content_str)
        reply_item = {
            "id": str(uuid.uuid4())[:8],
            "role": "assistant",
            "mode": mode,
            "text": parsed["text"],
            "thought": parsed["thought"],
            "raw_text": content_str,
            "model": betty_tel.get("model"),
            "thinking_level": betty_tel.get("thinking_level"),
            "fallback_used": betty_tel.get("fallback_used", False),
            "timestamp": datetime.now().strftime("%H:%M:%S"),
        }
        with _CACHE_LOCK:
            histories = _ensure_betty_histories_locked(owner_id)
            history = histories[mode]
            history.append(reply_item)
            _trim_betty_history(history)
            history_snapshot = list(history)
            should_save_session = bool(
                req.session_id and (owner_id, req.session_id) in SESSIONS
            )

        if should_save_session and req.session_id:
            await asyncio.to_thread(save_session_record, owner_id, req.session_id)
        return {
            "mode": mode,
            "reply": reply_item,
            "history": history_snapshot,
        }
    except Exception as exc:
        safe_err = main._sanitize_error_text(exc)
        err_item = {
            "id": str(uuid.uuid4())[:8],
            "role": "assistant",
            "mode": mode,
            "text": f"⚠️ אירעה שגיאה בעת פנייה למודל: `{safe_err}`",
            "thought": "",
            "timestamp": datetime.now().strftime("%H:%M:%S"),
        }
        with _CACHE_LOCK:
            histories = _ensure_betty_histories_locked(owner_id)
            history = histories[mode]
            history.append(err_item)
            _trim_betty_history(history)
            history_snapshot = list(history)
        return {
            "mode": mode,
            "reply": err_item,
            "history": history_snapshot,
        }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

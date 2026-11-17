import asyncio
import io
import json
import os
import re
import tempfile
import time
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel

import main
import storage
from main import (
    FactoryState,
    has_blueprint_xml,
    node_adjudicator,
    node_construct,
    node_helper,
    node_upgrader,
    route_from_adjudicator,
    route_from_helper,
    route_from_start,
)
from prompts import BETTY_PROMPT_ADVISOR_PROMPT, BETTY_TECH_SUPPORT_PROMPT

app = FastAPI(
    title="BetterBot — The Intelligence Factory API",
    description="Web Backend & Real-time Multi-Agent Orchestrator for BetterBot 2.0",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
# Session Store (In-Memory + SQLite Persistent Storage)
# ==========================================
SESSIONS: Dict[str, Dict[str, Any]] = {}


def init_storage_and_hydrate() -> None:
    storage.init_db()
    for item in storage.list_sessions():
        sid = item.get("session_id")
        if sid and sid not in SESSIONS:
            loaded = storage.load_session(sid)
            if loaded:
                SESSIONS[sid] = loaded


init_storage_and_hydrate()


def save_session_record(session_id: Optional[str] = None) -> None:
    if session_id and session_id in SESSIONS:
        storage.save_session(session_id, SESSIONS[session_id])
    elif session_id is None:
        for sid, sess in SESSIONS.items():
            storage.save_session(sid, sess)


def get_or_load_session(session_id: str) -> Optional[Dict[str, Any]]:
    if session_id in SESSIONS:
        return SESSIONS[session_id]
    loaded = storage.load_session(session_id)
    if loaded:
        SESSIONS[session_id] = loaded
        return loaded
    return None


class UserMessageRequest(BaseModel):
    message: str
    mode: Optional[str] = "auto"  # "auto", "interview", "override"


class RenameSessionRequest(BaseModel):
    title: str


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
    title: str = "סשן חדש", session_id: Optional[str] = None
) -> Dict[str, Any]:
    session_id = session_id or str(uuid.uuid4())[:8]
    now = datetime.now().strftime("%H:%M:%S")
    state: FactoryState = {
        "user_input": "",
        "champion_xml": "",
        "champion_prompt": "",
        "challenger_xml": "",
        "challenger_prompt": "",
        "error_log": [],
        "iteration_count": 0,
        "target_type": "SYSTEM_PROMPT",
        "slug_name": "",
        "reference_files": {},
        "rubric_scores": {},
        "readiness_scores": {},
    }
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
        "reference_files": {},
        "rubric_scores": {},
        "readiness_scores": {},
        "state": state,
        "parsed_blueprint": {},
        "clean_champion_prompt": "",
        "clean_challenger_prompt": "",
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
    SESSIONS[session_id] = session
    save_session_record(session_id)
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
    session["reference_files"] = state.get("reference_files") or session.get("reference_files") or {}
    session["rubric_scores"] = state.get("rubric_scores") or session.get("rubric_scores") or {}
    session["readiness_scores"] = state.get("readiness_scores") or session.get("readiness_scores") or {}

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
        _, parsed_refs = main.parse_compiled_artifacts(champ_p)
        if parsed_refs:
            state["reference_files"] = {**(state.get("reference_files") or {}), **parsed_refs}
            session["reference_files"] = state["reference_files"]
        parts = extract_construct_parts(champ_p)
        session["clean_champion_prompt"] = parts["clean_prompt"]
        if parts["compilation_check"]:
            session["compilation_check"] = parts["compilation_check"]
    else:
        session["clean_champion_prompt"] = ""

    if chall_p:
        _, parsed_refs = main.parse_compiled_artifacts(chall_p)
        if parsed_refs:
            state["reference_files"] = {**(state.get("reference_files") or {}), **parsed_refs}
            session["reference_files"] = state["reference_files"]
        parts = extract_construct_parts(chall_p)
        session["clean_challenger_prompt"] = parts["clean_prompt"]
        if parts["compilation_check"]:
            session["compilation_check"] = parts["compilation_check"]
    else:
        session["clean_challenger_prompt"] = ""

    return session


# ==========================================
# Endpoints
# ==========================================
@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>BetterBot UI is loading...</h1>")
    return HTMLResponse(index_file.read_text(encoding="utf-8"))


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    return {
        "status": "ok",
        "model": getattr(main.llm, "model", main.FAST_MODEL),
        "compiler_model": getattr(main.compiler_llm, "model", main.COMPILER_MODEL),
        "decision_model": main.DECISION_MODEL,
        "active_sessions": len(SESSIONS),
    }


@app.get("/api/sessions")
async def list_sessions():
    return {"sessions": storage.list_sessions()}


@app.post("/api/sessions")
async def create_session_endpoint():
    session = create_new_session()
    return enrich_session(session)


@app.get("/api/sessions/{session_id}")
async def get_session_endpoint(session_id: str):
    session = get_or_load_session(session_id)
    if not session:
        session = create_new_session(session_id=session_id)
    return enrich_session(session)


@app.patch("/api/sessions/{session_id}")
async def rename_session_endpoint(session_id: str, req: RenameSessionRequest):
    clean_title = req.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    session = get_or_load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session["title"] = clean_title
    session["title_manually_set"] = True
    storage.rename_session(session_id, clean_title)
    return enrich_session(session)


@app.delete("/api/sessions/{session_id}")
async def delete_session_endpoint(session_id: str):
    SESSIONS.pop(session_id, None)
    deleted = storage.delete_session(session_id)
    return {"deleted": bool(deleted)}


@app.get("/api/sessions/{session_id}/download")
async def download_session_bundle(session_id: str):
    session = get_or_load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    sess = enrich_session(session)
    target_type = sess.get("target_type") or "SYSTEM_PROMPT"
    raw_slug = sess.get("slug_name") or session_id
    safe_slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", raw_slug).strip("-") or session_id

    primary_content = sess.get("clean_champion_prompt") or sess.get("clean_challenger_prompt") or ""
    ref_files = dict(sess.get("reference_files") or {})
    raw_blueprint = sess.get("raw_blueprint") or ""

    buf = io.BytesIO()
    written_paths = set()

    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        if target_type == "SKILL_PACKAGE":
            if "SKILL.md" not in ref_files and primary_content:
                zf.writestr("SKILL.md", primary_content)
                written_paths.add("SKILL.md")
        elif target_type == "HYBRID_BUNDLE":
            if "SYSTEM_PROMPT.md" not in ref_files and "SKILL.md" not in ref_files and primary_content:
                zf.writestr("SYSTEM_PROMPT.md", primary_content)
                written_paths.add("SYSTEM_PROMPT.md")
        else:
            if "SYSTEM_PROMPT.md" not in ref_files and primary_content:
                zf.writestr("SYSTEM_PROMPT.md", primary_content)
                written_paths.add("SYSTEM_PROMPT.md")

        for rel_path, content in ref_files.items():
            norm_path = rel_path.lstrip("/\\").replace("\\", "/")
            if not norm_path or ".." in norm_path or norm_path in written_paths:
                continue
            zf.writestr(norm_path, content or "")
            written_paths.add(norm_path)

        if raw_blueprint:
            zf.writestr("blueprint.xml", raw_blueprint)

    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_slug}.zip"'},
    )


@app.post("/api/sessions/{session_id}/stream")
async def stream_factory_execution(session_id: str, req: UserMessageRequest):
    """
    Executes the LangGraph workflow step-by-step and streams real-time SSE updates
    so the UI can animate each node (Helper -> Construct -> Adjudicator <-> Upgrader).
    """
    session = get_or_load_session(session_id)
    if not session:
        session = create_new_session(session_id=session_id)
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Empty message")

    now = datetime.now().strftime("%H:%M:%S")
    session["updated_at"] = now

    # Update session title from first user input
    if session["title"] == "סשן חדש":
        session["title"] = user_msg[:36] + ("..." if len(user_msg) > 36 else "")

    state: FactoryState = session["state"]

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
            state["user_input"] += f"\nAssistant: {last_helper}\nUser: {user_msg}"

    save_session_record(session_id)

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
                    "node_3_upgrader": ("Node 3: The Upgrader", "מבצע ניתוח השפעה ומשדרג את ה-Blueprint והתוצר..."),
                    "node_4_adjudicator": ("Node 4: The Adjudicator", "מבצע ביקורת איכות (QA) ובדיקת רגרסיה..."),
                }
                label_title, label_desc = node_labels.get(current_node, (current_node, "מבצע פעולה..."))

                yield sse(
                    "node_start",
                    {
                        "node": current_node,
                        "title": label_title,
                        "description": label_desc,
                        "iteration": state.get("iteration_count", 0),
                    },
                )
                await asyncio.sleep(0)

                # Execute the node in a worker thread so event loop stays responsive
                if current_node == "node_1_helper":
                    session["status"] = "interviewing"
                    update = await asyncio.to_thread(node_helper, state)
                    state.update(update)

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
                            {
                                "id": str(uuid.uuid4())[:8],
                                "timestamp": step_time,
                                "node": "node_1_helper",
                                "title": "הופק XML Blueprint",
                                "detail": "הראיון הושלם ותורגם לארכיטקטורה קוגניטיבית.",
                                "status": "success",
                            }
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
                            {
                                "id": str(uuid.uuid4())[:8],
                                "timestamp": step_time,
                                "node": "node_1_helper",
                                "title": "שאלת מיקוד בראיון",
                                "detail": parts["chat_text"][:120] + ("..." if len(parts["chat_text"]) > 120 else ""),
                                "status": "info",
                            }
                        )

                    next_node = route_from_helper(state)

                elif current_node == "node_2_construct":
                    session["status"] = "compiling"
                    update = await asyncio.to_thread(node_construct, state)
                    state.update(update)

                    session["timeline"].append(
                        {
                            "id": str(uuid.uuid4())[:8],
                            "timestamp": step_time,
                            "node": "node_2_construct",
                            "title": "הידור הפרומפט הושלם (The Construct)",
                            "detail": f"נוצר Challenger Prompt באורך {len(state.get('challenger_prompt', ''))} תווים.",
                            "status": "success",
                        }
                    )
                    next_node = "node_4_adjudicator"

                elif current_node == "node_3_upgrader":
                    session["status"] = "compiling"
                    update = await asyncio.to_thread(node_upgrader, state)
                    state.update(update)

                    session["timeline"].append(
                        {
                            "id": str(uuid.uuid4())[:8],
                            "timestamp": step_time,
                            "node": "node_3_upgrader",
                            "title": f"שדרוג גרסה הושלם (איטרציה {state.get('iteration_count', 1)})",
                            "detail": "עודכנו ה-XML וה-System Prompt בהתאם להנחיות התיקון.",
                            "status": "info",
                        }
                    )
                    next_node = "node_4_adjudicator"

                elif current_node == "node_4_adjudicator":
                    session["status"] = "compiling"
                    prev_iter = state.get("iteration_count", 0)
                    update = await asyncio.to_thread(node_adjudicator, state)
                    # Note: error_log uses operator.add in LangGraph!
                    if "error_log" in update:
                        state["error_log"] = list(state.get("error_log", [])) + list(
                            update["error_log"]
                        )
                    for k, v in update.items():
                        if k != "error_log":
                            state[k] = v

                    last_log = state["error_log"][-1] if state.get("error_log") else ""
                    qa_mode = "Baseline QA" if prev_iter == 0 else f"Regression QA (#{prev_iter})"

                    if "[PASS]" in last_log:
                        session["timeline"].append(
                            {
                                "id": str(uuid.uuid4())[:8],
                                "timestamp": step_time,
                                "node": "node_4_adjudicator",
                                "title": f"{qa_mode}: PASS ✅",
                                "detail": "הפרומפט עמד בכל בדיקות האיכות ואושר לשימוש!",
                                "status": "success",
                            }
                        )
                    elif "[FAIL]" in last_log:
                        session["timeline"].append(
                            {
                                "id": str(uuid.uuid4())[:8],
                                "timestamp": step_time,
                                "node": "node_4_adjudicator",
                                "title": f"{qa_mode}: FAIL 🔄",
                                "detail": last_log,
                                "status": "warning",
                            }
                        )
                    else:
                        session["timeline"].append(
                            {
                                "id": str(uuid.uuid4())[:8],
                                "timestamp": step_time,
                                "node": "node_4_adjudicator",
                                "title": f"{qa_mode}: ESCALATE ⚠️",
                                "detail": last_log,
                                "status": "danger",
                            }
                        )

                    next_node = route_from_adjudicator(state)
                    max_iters = getattr(main, "MAX_QA_ITERATIONS", 2)
                    # Check if circuit breaker triggered (iteration >= MAX_QA_ITERATIONS on FAIL)
                    if (
                        next_node == main.END
                        and "[FAIL]" in last_log
                        and state.get("iteration_count", 0) >= max_iters
                    ):
                        state["error_log"].append(
                            f"[ESCALATE] Circuit Breaker triggered after {state['iteration_count']} attempts. {last_log}"
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
                    break

                enrich_session(session)
                save_session_record(session_id)
                yield sse(
                    "node_complete",
                    {
                        "node": current_node,
                        "next_node": None if next_node == main.END else next_node,
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
            save_session_record(session_id)
            yield sse("done", session)

        except Exception as exc:
            session["active_node"] = None
            err_msg = str(exc)
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
            save_session_record(session_id)
            yield sse("error", {"error": err_msg, "session": session})

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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

BETTY_HISTORIES: Dict[str, List[Dict[str, Any]]] = {
    "tech_support": [],
    "prompt_advisor": [],
}


def init_betty_mode(mode: str) -> List[Dict[str, Any]]:
    now = datetime.now().strftime("%H:%M:%S")
    BETTY_HISTORIES[mode] = [
        {
            "id": str(uuid.uuid4())[:8],
            "role": "assistant",
            "mode": mode,
            "text": BETTY_WELCOME.get(mode, BETTY_WELCOME["tech_support"]),
            "thought": "",
            "timestamp": now,
        }
    ]
    return BETTY_HISTORIES[mode]


init_betty_mode("tech_support")
init_betty_mode("prompt_advisor")


class BettyChatRequest(BaseModel):
    message: str
    mode: str = "tech_support"  # "tech_support" | "prompt_advisor"
    session_id: Optional[str] = None


class BettyClearRequest(BaseModel):
    mode: str = "tech_support"


def build_session_context_for_betty(session_id: Optional[str]) -> str:
    if not session_id:
        return "<current_session_context>\nNo active session selected.\n</current_session_context>"

    loaded = get_or_load_session(session_id)
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
    ]
    if sess.get("rubric_scores"):
        lines.append(
            f"gemini-decision-1 Rubric Scores:\n{json.dumps(sess['rubric_scores'], ensure_ascii=False)}"
        )
    if sess.get("raw_blueprint"):
        lines.append(f"Current Blueprint XML:\n{sess['raw_blueprint']}")
    if sess.get("clean_champion_prompt"):
        lines.append(f"Current Champion Artifact:\n{sess['clean_champion_prompt'][:2500]}")
    if sess.get("reference_files"):
        ref_summary = ", ".join(sess["reference_files"].keys())
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
async def get_betty_history():
    return {
        "tech_support": BETTY_HISTORIES["tech_support"],
        "prompt_advisor": BETTY_HISTORIES["prompt_advisor"],
    }


@app.post("/api/betty/clear")
async def clear_betty_history(req: BettyClearRequest):
    mode = req.mode if req.mode in BETTY_HISTORIES else "tech_support"
    init_betty_mode(mode)
    return {
        "mode": mode,
        "history": BETTY_HISTORIES[mode],
    }


@app.post("/api/betty/chat")
async def betty_chat_endpoint(req: BettyChatRequest):
    mode = req.mode if req.mode in ["tech_support", "prompt_advisor"] else "tech_support"
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Empty message")

    now = datetime.now().strftime("%H:%M:%S")
    history = BETTY_HISTORIES[mode]

    history.append(
        {
            "id": str(uuid.uuid4())[:8],
            "role": "user",
            "mode": mode,
            "text": user_msg,
            "timestamp": now,
        }
    )

    sys_prompt = (
        BETTY_TECH_SUPPORT_PROMPT
        if mode == "tech_support"
        else BETTY_PROMPT_ADVISOR_PROMPT
    )
    session_ctx = build_session_context_for_betty(req.session_id)

    lc_messages = [
        SystemMessage(content=f"{sys_prompt}\n\n{session_ctx}"),
    ]

    # Include recent conversation turns (excluding the initial static greeting)
    for item in history[1:-1][-10:]:
        if item["role"] == "user":
            lc_messages.append(HumanMessage(content=item["text"]))
        else:
            lc_messages.append(AIMessage(content=item.get("raw_text") or item["text"]))

    lc_messages.append(HumanMessage(content=user_msg))

    try:
        response = await asyncio.to_thread(main.llm.invoke, lc_messages)
        raw_content = response.content
        if isinstance(raw_content, list):
            content_str = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in raw_content
            )
        else:
            content_str = str(raw_content)

        parsed = parse_betty_response(content_str)
        reply_item = {
            "id": str(uuid.uuid4())[:8],
            "role": "assistant",
            "mode": mode,
            "text": parsed["text"],
            "thought": parsed["thought"],
            "raw_text": content_str,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
        }
        history.append(reply_item)
        if req.session_id and req.session_id in SESSIONS:
            save_session_record(req.session_id)
        return {
            "mode": mode,
            "reply": reply_item,
            "history": history,
        }
    except Exception as exc:
        err_item = {
            "id": str(uuid.uuid4())[:8],
            "role": "assistant",
            "mode": mode,
            "text": f"⚠️ אירעה שגיאה בעת פנייה למודל: `{str(exc)}`",
            "thought": "",
            "timestamp": datetime.now().strftime("%H:%M:%S"),
        }
        history.append(err_item)
        return {
            "mode": mode,
            "reply": err_item,
            "history": history,
        }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

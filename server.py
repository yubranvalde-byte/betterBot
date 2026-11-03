import os
import re
import json
import uuid
import time
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import main
from main import (
    FactoryState,
    node_helper,
    node_construct,
    node_upgrader,
    node_adjudicator,
    route_from_start,
    route_from_helper,
    route_from_adjudicator,
)
from prompts import BETTY_TECH_SUPPORT_PROMPT, BETTY_PROMPT_ADVISOR_PROMPT
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

app = FastAPI(
    title="BetterBot — The Intelligence Factory API",
    description="Web Backend & Real-time Multi-Agent Orchestrator for BetterBot",
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

# ==========================================
# In-Memory Session Store (RAM Only per Spec)
# ==========================================
SESSIONS: Dict[str, Dict[str, Any]] = {}


class UserMessageRequest(BaseModel):
    message: str
    mode: Optional[str] = "auto"  # "auto", "interview", "override"


def extract_helper_parts(raw_text: str) -> Dict[str, str]:
    """
    Separates hidden <thought_process> and <GEM_BLUEPRINT> XML from the user-facing Hebrew message.
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
        r"(<GEM_BLUEPRINT>.*?</GEM_BLUEPRINT>)", cleaned, flags=re.DOTALL | re.IGNORECASE
    )
    if bp_match:
        blueprint_xml = bp_match.group(1).strip()

    # Remove ```xml ... ``` wrapper around GEM_BLUEPRINT for the chat bubble text if needed
    chat_text = re.sub(
        r"```xml\s*<GEM_BLUEPRINT>.*?</GEM_BLUEPRINT>\s*```",
        "",
        cleaned,
        flags=re.DOTALL | re.IGNORECASE,
    ).strip()
    if not chat_text and blueprint_xml:
        chat_text = re.sub(
            r"<GEM_BLUEPRINT>.*?</GEM_BLUEPRINT>", "", cleaned, flags=re.DOTALL | re.IGNORECASE
        ).strip()

    return {
        "thought": thought,
        "chat_text": chat_text or cleaned,
        "blueprint_xml": blueprint_xml,
    }


def extract_construct_parts(raw_text: str) -> Dict[str, str]:
    """
    Separates <compilation_check> from the compiled System Prompt.
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

    # Strip outer 4-backtick or 3-backtick wrapper if present
    code_match = re.search(r"^`{3,4}(?:markdown|md)?\s*\n(.*?)\n`{3,4}\s*$", cleaned, flags=re.DOTALL)
    if code_match:
        cleaned = code_match.group(1).strip()

    return {
        "compilation_check": comp_check,
        "clean_prompt": cleaned,
    }


def parse_blueprint_tags(xml_str: str) -> Dict[str, str]:
    """
    Extracts key XML tags from <GEM_BLUEPRINT> for visual cards in the UI.
    """
    if not xml_str:
        return {}
    tags = [
        "TITLE",
        "TONE",
        "DOMAIN_EXPERTISE",
        "COGNITIVE_MODULES",
        "WORKFLOW",
        "NEGATIVE_CONSTRAINTS",
        "OUTPUT_FORMAT",
        "VERSION",
    ]
    parsed = {}
    for tag in tags:
        m = re.search(rf"<{tag}>(.*?)</{tag}>", xml_str, flags=re.DOTALL | re.IGNORECASE)
        if m:
            parsed[tag.lower()] = m.group(1).strip()
    return parsed


def create_new_session(title: str = "סשן חדש") -> Dict[str, Any]:
    session_id = str(uuid.uuid4())[:8]
    now = datetime.now().strftime("%H:%M:%S")
    state: FactoryState = {
        "user_input": "",
        "champion_xml": "",
        "champion_prompt": "",
        "challenger_xml": "",
        "challenger_prompt": "",
        "error_log": [],
        "iteration_count": 0,
    }
    session = {
        "session_id": session_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "status": "idle",  # idle | interviewing | compiling | passed | escalated
        "active_node": None,
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
                "text": "שלום! אני ארכיטקט הדרישות של **מפעל הבינה (BetterBot)**.\nתאר לי בשפה חופשית את סוכן ה-AI שאתה חולם לבנות — מה תפקידו, למי הוא מיועד, ואיך היית רוצה שיתנהג?",
                "thought": "",
                "timestamp": now,
            }
        ],
        "timeline": [
            {
                "id": str(uuid.uuid4())[:8],
                "timestamp": now,
                "node": "system",
                "title": "אתחול מפעל הבינה",
                "detail": "הסשן נוצר בזיכרון (In-Memory State). ממתין לתיאור הסוכן מהמשתמש.",
                "status": "info",
            }
        ],
    }
    SESSIONS[session_id] = session
    return session


def enrich_session(session: Dict[str, Any]) -> Dict[str, Any]:
    state = session["state"]
    bp_source = state.get("champion_xml") or state.get("challenger_xml") or ""
    if "<GEM_BLUEPRINT>" in bp_source:
        bp_match = re.search(
            r"(<GEM_BLUEPRINT>.*?</GEM_BLUEPRINT>)", bp_source, flags=re.DOTALL | re.IGNORECASE
        )
        raw_bp = bp_match.group(1).strip() if bp_match else bp_source
        session["parsed_blueprint"] = parse_blueprint_tags(raw_bp)
        session["raw_blueprint"] = raw_bp
    else:
        session["parsed_blueprint"] = {}
        session["raw_blueprint"] = ""

    champ_p = state.get("champion_prompt", "")
    chall_p = state.get("challenger_prompt", "")
    if champ_p:
        parts = extract_construct_parts(champ_p)
        session["clean_champion_prompt"] = parts["clean_prompt"]
        if parts["compilation_check"]:
            session["compilation_check"] = parts["compilation_check"]
    else:
        session["clean_champion_prompt"] = ""

    if chall_p:
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
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>BetterBot UI is loading...</h1>")
    return HTMLResponse(index_file.read_text(encoding="utf-8"))


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "model": getattr(main.llm, "model", "gemini-3.5-flash-lite"),
        "active_sessions": len(SESSIONS),
    }


@app.get("/api/sessions")
async def list_sessions():
    items = []
    for sid, sess in reversed(list(SESSIONS.items())):
        items.append(
            {
                "session_id": sid,
                "title": sess["title"],
                "status": sess["status"],
                "created_at": sess["created_at"],
                "updated_at": sess["updated_at"],
                "iteration_count": sess["state"].get("iteration_count", 0),
            }
        )
    return {"sessions": items}


@app.post("/api/sessions")
async def create_session_endpoint():
    session = create_new_session()
    return enrich_session(session)


@app.get("/api/sessions/{session_id}")
async def get_session_endpoint(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    return enrich_session(SESSIONS[session_id])


@app.delete("/api/sessions/{session_id}")
async def delete_session_endpoint(session_id: str):
    if session_id in SESSIONS:
        del SESSIONS[session_id]
    return {"deleted": True}


@app.post("/api/sessions/{session_id}/stream")
async def stream_factory_execution(session_id: str, req: UserMessageRequest):
    """
    Executes the LangGraph workflow step-by-step and streams real-time SSE updates
    so the UI can animate each node (Helper -> Construct -> Adjudicator <-> Upgrader).
    """
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    session = SESSIONS[session_id]
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

    async def event_generator():
        def sse(event_type: str, payload: Dict[str, Any]) -> str:
            return f"event: {event_type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

        try:
            # Determine starting node using route_from_start
            current_node = route_from_start(state)
            yield sse("session_update", enrich_session(session))

            while current_node != main.END:
                step_time = datetime.now().strftime("%H:%M:%S")
                session["active_node"] = current_node

                node_labels = {
                    "node_1_helper": ("Node 1: The Helper", "מנתח דרישות ומנסח שאלות / XML Blueprint..."),
                    "node_2_construct": ("Node 2: The Construct", "מהדר את ה-XML Blueprint לפרומפט מערכת שלם..."),
                    "node_3_upgrader": ("Node 3: The Upgrader", "מבצע ניתוח השפעה ומשדרג את ה-XML והפרומפט..."),
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

                # Execute the node in a worker thread so event loop stays responsive
                if current_node == "node_1_helper":
                    session["status"] = "interviewing"
                    update = await asyncio.to_thread(node_helper, state)
                    state.update(update)

                    parts = extract_helper_parts(state.get("challenger_xml", ""))
                    has_blueprint = "<GEM_BLUEPRINT>" in state.get("challenger_xml", "")

                    if has_blueprint:
                        session["chat_history"].append(
                            {
                                "id": str(uuid.uuid4())[:8],
                                "role": "assistant",
                                "agent": "The Helper (Requirements Architect)",
                                "text": parts["chat_text"]
                                or "תוכנית האב (`<GEM_BLUEPRINT>`) מוכנה! מעביר כעת למהדר הפרומפטים (The Construct)...",
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
                    # Check if circuit breaker triggered (iteration >= 3 on FAIL)
                    if (
                        next_node == main.END
                        and "[FAIL]" in last_log
                        and state.get("iteration_count", 0) >= 3
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

                yield sse(
                    "node_complete",
                    {
                        "node": current_node,
                        "next_node": None if next_node == main.END else next_node,
                        "session": enrich_session(session),
                    },
                )
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

            yield sse("done", enrich_session(session))

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
            yield sse("error", {"error": err_msg, "session": enrich_session(session)})

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
    if not session_id or session_id not in SESSIONS:
        return "<current_session_context>\nNo active session selected.\n</current_session_context>"

    sess = enrich_session(SESSIONS[session_id])
    st = sess.get("state", {})
    lines = [
        "<current_session_context>",
        f"Session ID: {sess.get('session_id')}",
        f"Session Title: {sess.get('title')}",
        f"Current Status: {sess.get('status')} (Active Node: {sess.get('active_node')})",
        f"QA Iteration Count: {st.get('iteration_count', 0)} / 3",
    ]
    if sess.get("raw_blueprint"):
        lines.append(f"Current <GEM_BLUEPRINT>:\n{sess['raw_blueprint']}")
    if sess.get("clean_champion_prompt"):
        lines.append(f"Current Champion Prompt:\n{sess['clean_champion_prompt'][:2500]}")
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

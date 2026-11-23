import json
import os
import re
import sqlite3
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

DEFAULT_DB_PATH = Path(__file__).parent / "betterbot_history.db"
FALLBACK_DB_PATH = Path(tempfile.gettempdir()) / "betterbot_history.db"


def _resolve_db_path() -> Path:
    env_path = os.environ.get("DB_PATH")
    if env_path:
        target = Path(env_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        return target

    try:
        DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DEFAULT_DB_PATH))
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.close()
        return DEFAULT_DB_PATH
    except Exception:
        FALLBACK_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        return FALLBACK_DB_PATH


DB_PATH: Path = _resolve_db_path()


@contextmanager
def _get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _require_owner_id(owner_id: str) -> str:
    clean = (owner_id or "").strip()
    if not clean:
        raise ValueError("owner_id is required")
    return clean


def _normalize_rel_path(raw_path: Any) -> str:
    if not isinstance(raw_path, str):
        return ""
    cleaned = raw_path.strip().strip("`\"'").strip()
    if not cleaned or "\x00" in cleaned:
        return ""
    if (
        re.match(r"^[a-zA-Z]:", cleaned)
        or cleaned.startswith("\\\\")
        or cleaned.startswith("//")
    ):
        return ""
    cleaned = cleaned.replace("\\", "/").strip("/")
    if not cleaned:
        return ""
    segments = cleaned.split("/")
    for seg in segments:
        if not seg or seg in (".", "..") or ":" in seg:
            return ""
    return "/".join(segments)


def _sanitize_reference_files(raw_refs: Any) -> Dict[str, str]:
    if not isinstance(raw_refs, dict):
        return {}
    cleaned: Dict[str, str] = {}
    for raw_key, raw_val in raw_refs.items():
        norm_key = _normalize_rel_path(raw_key)
        if not norm_key:
            continue
        cleaned[norm_key] = raw_val if isinstance(raw_val, str) else str(raw_val or "")
    return cleaned


def _hydrate_session_reference_files(session_data: Dict[str, Any]) -> None:
    """Normalizes and synchronizes nested `reference_files` across top-level and `state`."""
    if not isinstance(session_data, dict):
        return
    state = session_data.get("state")
    top_refs = _sanitize_reference_files(session_data.get("reference_files"))
    state_refs = (
        _sanitize_reference_files(state.get("reference_files"))
        if isinstance(state, dict)
        else {}
    )
    if isinstance(state, dict) and "reference_files" in state:
        merged_refs = {**top_refs, **state_refs}
    else:
        merged_refs = {**state_refs, **top_refs}
    session_data["reference_files"] = dict(merged_refs)
    if isinstance(state, dict):
        state["reference_files"] = dict(merged_refs)


def _extract_metadata(session_data: Dict[str, Any]) -> Dict[str, Any]:
    state = session_data.get("state") or {}
    parsed_bp = session_data.get("parsed_blueprint") or {}

    target_type = (
        session_data.get("target_type")
        or state.get("target_type")
        or parsed_bp.get("target_type")
        or "SYSTEM_PROMPT"
    )
    slug_name = (
        session_data.get("slug_name")
        or state.get("slug_name")
        or parsed_bp.get("slug_name")
        or ""
    )
    title = session_data.get("title") or "סשן חדש"
    status = str(session_data.get("status") or "idle")

    return {
        "title": title,
        "target_type": target_type,
        "slug_name": slug_name,
        "status": status,
        "iteration_count": int(state.get("iteration_count", 0) or 0),
        "rubric_scores": session_data.get("rubric_scores") or state.get("rubric_scores") or {},
    }


def _migrate_snapshot_if_present(conn: sqlite3.Connection) -> None:
    snapshot_candidates = [
        Path(tempfile.gettempdir()) / "betterbot_sessions_snapshot.json",
        Path(__file__).parent / "betterbot_sessions_snapshot.json",
    ]
    for snap_path in snapshot_candidates:
        if not snap_path.exists():
            continue
        try:
            raw = json.loads(snap_path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                continue
            for sid, sess in raw.items():
                if not isinstance(sess, dict):
                    continue
                exists = conn.execute(
                    "SELECT 1 FROM sessions WHERE session_id = ?", (sid,)
                ).fetchone()
                if exists:
                    continue
                now_iso = _utc_now_iso()
                meta = _extract_metadata(sess)
                sess.setdefault("created_at_iso", now_iso)
                sess.setdefault("updated_at_iso", now_iso)
                conn.execute(
                    """
                    INSERT INTO sessions (
                        session_id, owner_id, title, target_type, status,
                        created_at, updated_at, state_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        sid,
                        "master",
                        meta["title"],
                        meta["target_type"],
                        meta["status"],
                        sess["created_at_iso"],
                        sess["updated_at_iso"],
                        json.dumps(sess, ensure_ascii=False),
                    ),
                )
            conn.commit()
        except Exception:
            pass


def init_db() -> None:
    """Initializes the SQLite sessions table, runs idempotent migrations, and imports legacy JSON snapshots."""
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL DEFAULT 'master',
                title TEXT NOT NULL,
                target_type TEXT NOT NULL DEFAULT 'SYSTEM_PROMPT',
                status TEXT NOT NULL DEFAULT 'idle',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                state_json TEXT NOT NULL
            )
            """
        )
        existing_cols = {
            row["name"] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()
        }
        if "owner_id" not in existing_cols:
            conn.execute(
                "ALTER TABLE sessions ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'master'"
            )
        conn.execute(
            "UPDATE sessions SET owner_id = 'master' WHERE owner_id IS NULL OR TRIM(owner_id) = ''"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_owner_updated ON sessions(owner_id, updated_at DESC)"
        )
        conn.commit()
        _migrate_snapshot_if_present(conn)


def save_session(session_id: str, session_data: Dict[str, Any], owner_id: str) -> None:
    """Persists or updates a complete BetterBot session in SQLite, scoped to owner_id."""
    owner = _require_owner_id(owner_id)
    if not (session_id or "").strip():
        raise ValueError("session_id is required")

    now_iso = _utc_now_iso()
    created_iso = session_data.get("created_at_iso") or now_iso
    session_data["created_at_iso"] = created_iso
    session_data["updated_at_iso"] = now_iso
    _hydrate_session_reference_files(session_data)

    payload_to_store = {k: v for k, v in session_data.items() if k != "owner_id"}
    meta = _extract_metadata(payload_to_store)
    serialized = json.dumps(payload_to_store, ensure_ascii=False)

    with _get_conn() as conn:
        existing = conn.execute(
            "SELECT owner_id FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        if existing and existing["owner_id"] != owner:
            raise PermissionError("Session belongs to another workspace")

        cur = conn.execute(
            """
            INSERT INTO sessions (
                session_id, owner_id, title, target_type, status,
                created_at, updated_at, state_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                title = excluded.title,
                target_type = excluded.target_type,
                status = excluded.status,
                updated_at = excluded.updated_at,
                state_json = excluded.state_json
            WHERE sessions.owner_id = excluded.owner_id
            """,
            (
                session_id,
                owner,
                meta["title"],
                meta["target_type"],
                meta["status"],
                created_iso,
                now_iso,
                serialized,
            ),
        )
        if cur.rowcount == 0:
            raise PermissionError("Session belongs to another workspace")
        conn.commit()


def load_session(session_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
    """Loads and deserializes a single session scoped to owner_id."""
    owner = _require_owner_id(owner_id)
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE session_id = ? AND owner_id = ?",
            (session_id, owner),
        ).fetchone()
    if not row:
        return None
    try:
        data = json.loads(row["state_json"])
        if isinstance(data, dict):
            data.pop("owner_id", None)
            data.setdefault("session_id", row["session_id"])
            data.setdefault(
                "model_telemetry",
                (data.get("state") or {}).get("model_telemetry") or {},
            )
            data["title"] = row["title"]
            data["created_at_iso"] = row["created_at"]
            data["updated_at_iso"] = row["updated_at"]
            _hydrate_session_reference_files(data)
            return data
    except Exception:
        return None
    return None


def list_sessions(owner_id: str) -> List[Dict[str, Any]]:
    """Returns metadata for saved creations owned by owner_id ordered by updated_at DESC."""
    owner = _require_owner_id(owner_id)
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT session_id, title, target_type, status, created_at, updated_at, state_json
            FROM sessions
            WHERE owner_id = ?
            ORDER BY updated_at DESC
            """,
            (owner,),
        ).fetchall()

    results: List[Dict[str, Any]] = []
    for row in rows:
        try:
            sess = json.loads(row["state_json"])
        except Exception:
            sess = {}
        meta = _extract_metadata(sess)
        results.append(
            {
                "session_id": row["session_id"],
                "title": row["title"],
                "target_type": row["target_type"] or meta["target_type"],
                "slug_name": meta["slug_name"],
                "status": row["status"] or meta["status"],
                "created_at": sess.get("created_at") or row["created_at"],
                "updated_at": sess.get("updated_at") or row["updated_at"],
                "created_at_iso": row["created_at"],
                "updated_at_iso": row["updated_at"],
                "iteration_count": meta["iteration_count"],
                "rubric_scores": meta["rubric_scores"],
            }
        )
    return results


def rename_session(
    session_id: str, new_title: str, owner_id: str
) -> Optional[Dict[str, Any]]:
    """Updates a session's title and marks it as manually named within owner_id."""
    owner = _require_owner_id(owner_id)
    clean_title = (new_title or "").strip()
    if not clean_title:
        return None

    sess = load_session(session_id, owner)
    if not sess:
        return None

    sess["title"] = clean_title
    sess["title_manually_set"] = True
    save_session(session_id, sess, owner)
    return sess


def delete_session(session_id: str, owner_id: str) -> bool:
    """Deletes a session from persistent SQLite storage scoped to owner_id."""
    owner = _require_owner_id(owner_id)
    with _get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM sessions WHERE session_id = ? AND owner_id = ?",
            (session_id, owner),
        )
        conn.commit()
        return cur.rowcount > 0


def export_workspace_sessions(owner_id: str) -> List[Dict[str, Any]]:
    """Exports all full session objects owned by owner_id for portable JSON backup."""
    owner = _require_owner_id(owner_id)
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT session_id, title, target_type, status, created_at, updated_at, state_json
            FROM sessions
            WHERE owner_id = ?
            ORDER BY updated_at DESC
            """,
            (owner,),
        ).fetchall()

    exported: List[Dict[str, Any]] = []
    for row in rows:
        try:
            data = json.loads(row["state_json"])
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        data.pop("owner_id", None)
        data["session_id"] = row["session_id"]
        data["title"] = row["title"]
        data["target_type"] = row["target_type"] or data.get("target_type") or "SYSTEM_PROMPT"
        data["status"] = row["status"] or data.get("status") or "idle"
        data["created_at_iso"] = row["created_at"]
        data["updated_at_iso"] = row["updated_at"]
        _hydrate_session_reference_files(data)
        exported.append(data)
    return exported


def import_workspace_sessions(owner_id: str, sessions_payload: Any) -> Dict[str, int]:
    """Imports a JSON bundle or list of sessions into owner_id with conflict handling."""
    owner = _require_owner_id(owner_id)

    if isinstance(sessions_payload, dict):
        raw_sessions = sessions_payload.get("sessions")
    elif isinstance(sessions_payload, list):
        raw_sessions = sessions_payload
    else:
        raw_sessions = None

    if not isinstance(raw_sessions, list):
        raise ValueError(
            "Invalid sessions payload: expected a list or an object containing a 'sessions' list"
        )

    created = 0
    updated = 0
    remapped = 0
    skipped = 0

    with _get_conn() as conn:
        for item in raw_sessions:
            if not isinstance(item, dict):
                skipped += 1
                continue

            sess = dict(item)
            sess.pop("owner_id", None)

            raw_sid = sess.get("session_id")
            sid = raw_sid.strip() if isinstance(raw_sid, str) else ""
            if not sid or len(sid) > 128 or "/" in sid or "\\" in sid or ".." in sid:
                sid = uuid.uuid4().hex[:12]

            existing = conn.execute(
                "SELECT owner_id FROM sessions WHERE session_id = ?", (sid,)
            ).fetchone()

            if existing and existing["owner_id"] != owner:
                while True:
                    candidate = uuid.uuid4().hex[:12]
                    clash = conn.execute(
                        "SELECT 1 FROM sessions WHERE session_id = ?", (candidate,)
                    ).fetchone()
                    if not clash:
                        sid = candidate
                        break
                remapped += 1
                existing = None

            sess["session_id"] = sid
            if not isinstance(sess.get("state"), dict):
                sess["state"] = {}
            if not isinstance(sess.get("chat_history"), list):
                sess["chat_history"] = []
            if not isinstance(sess.get("timeline"), list):
                sess["timeline"] = []
            if not isinstance(sess.get("model_telemetry"), dict):
                sess["model_telemetry"] = {}

            now_iso = _utc_now_iso()
            created_iso = str(sess.get("created_at_iso") or now_iso)
            updated_iso = str(sess.get("updated_at_iso") or now_iso)
            sess["created_at_iso"] = created_iso
            sess["updated_at_iso"] = updated_iso
            _hydrate_session_reference_files(sess)

            meta = _extract_metadata(sess)
            serialized = json.dumps(sess, ensure_ascii=False)

            cur = conn.execute(
                """
                INSERT INTO sessions (
                    session_id, owner_id, title, target_type, status,
                    created_at, updated_at, state_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    title = excluded.title,
                    target_type = excluded.target_type,
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    state_json = excluded.state_json
                WHERE sessions.owner_id = excluded.owner_id
                """,
                (
                    sid,
                    owner,
                    meta["title"],
                    meta["target_type"],
                    meta["status"],
                    created_iso,
                    updated_iso,
                    serialized,
                ),
            )
            if cur.rowcount == 0:
                raise PermissionError("Session belongs to another workspace")

            if existing:
                updated += 1
            else:
                created += 1

        conn.commit()

    return {
        "imported": created + updated,
        "created": created,
        "updated": updated,
        "remapped": remapped,
        "skipped": skipped,
    }

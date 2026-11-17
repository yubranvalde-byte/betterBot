import json
import os
import sqlite3
import tempfile
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
                        session_id, title, target_type, status,
                        created_at, updated_at, state_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        sid,
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
    """Initializes the SQLite sessions table and migrates legacy JSON snapshots if found."""
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                target_type TEXT NOT NULL DEFAULT 'SYSTEM_PROMPT',
                status TEXT NOT NULL DEFAULT 'idle',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                state_json TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC)"
        )
        conn.commit()
        _migrate_snapshot_if_present(conn)


def save_session(session_id: str, session_data: Dict[str, Any]) -> None:
    """Persists or updates a complete BetterBot session in SQLite."""
    now_iso = _utc_now_iso()
    created_iso = session_data.get("created_at_iso") or now_iso
    session_data["created_at_iso"] = created_iso
    session_data["updated_at_iso"] = now_iso

    meta = _extract_metadata(session_data)
    serialized = json.dumps(session_data, ensure_ascii=False)

    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO sessions (
                session_id, title, target_type, status,
                created_at, updated_at, state_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                title = excluded.title,
                target_type = excluded.target_type,
                status = excluded.status,
                updated_at = excluded.updated_at,
                state_json = excluded.state_json
            """,
            (
                session_id,
                meta["title"],
                meta["target_type"],
                meta["status"],
                created_iso,
                now_iso,
                serialized,
            ),
        )
        conn.commit()


def load_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Loads and deserializes a single session by session_id."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
    if not row:
        return None
    try:
        data = json.loads(row["state_json"])
        if isinstance(data, dict):
            data.setdefault("session_id", row["session_id"])
            data["title"] = row["title"]
            data["created_at_iso"] = row["created_at"]
            data["updated_at_iso"] = row["updated_at"]
            return data
    except Exception:
        return None
    return None


def list_sessions() -> List[Dict[str, Any]]:
    """Returns metadata for all saved creations ordered by updated_at DESC."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT session_id, title, target_type, status, created_at, updated_at, state_json
            FROM sessions
            ORDER BY updated_at DESC
            """
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


def rename_session(session_id: str, new_title: str) -> Optional[Dict[str, Any]]:
    """Updates a session's title and marks it as manually named."""
    clean_title = (new_title or "").strip()
    if not clean_title:
        return None

    sess = load_session(session_id)
    if not sess:
        return None

    sess["title"] = clean_title
    sess["title_manually_set"] = True
    save_session(session_id, sess)
    return sess


def delete_session(session_id: str) -> bool:
    """Deletes a session from persistent SQLite storage."""
    with _get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM sessions WHERE session_id = ?", (session_id,)
        )
        conn.commit()
        return cur.rowcount > 0

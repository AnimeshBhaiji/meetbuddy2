# planner_sessions.py
import time
import uuid
from typing import Dict, Any, Optional

_SESSIONS: Dict[str, Dict[str, Any]] = {}
_SESSION_TTL_SECONDS = 60 * 60  # 1 hour

def _now():
    return int(time.time())

def create_session(user_id: int, payload: Dict[str, Any], initial_state: Optional[Dict[str, Any]] = None) -> str:
    sid = str(uuid.uuid4())
    state = {
        "session_id": sid,
        "user_id": int(user_id),
        "created_at": _now(),
        "updated_at": _now(),
        "payload": payload,
        "anchor": initial_state or {},
        "steps": [],
        "last_options": {},
        "selected_tokens": initial_state.get("selected_tokens", []) if initial_state else [],
    }
    _SESSIONS[sid] = state
    return sid

def get_session(sid: str) -> Optional[Dict[str, Any]]:
    s = _SESSIONS.get(sid)
    if not s:
        return None
    if _now() - s.get("updated_at", s.get("created_at", 0)) > _SESSION_TTL_SECONDS:
        _SESSIONS.pop(sid, None)
        return None
    return s

def update_session(sid: str, key: str, value):
    s = get_session(sid)
    if not s:
        return None
    s[key] = value
    s["updated_at"] = _now()
    return s

def push_selection(sid: str, step: str, place: Dict[str, Any]):
    s = get_session(sid)
    if not s:
        return None
    entry = {"step": step, "place": place, "ts": _now()}
    s["steps"].append(entry)
    s["updated_at"] = _now()
    return s

def set_last_options(sid: str, step: str, options):
    s = get_session(sid)
    if not s:
        return None
    s["last_options"][step] = options
    s["updated_at"] = _now()
    return s

def clear_session(sid: str):
    return _SESSIONS.pop(sid, None)

def list_sessions():
    return list(_SESSIONS.keys())

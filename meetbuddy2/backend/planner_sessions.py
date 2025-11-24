# planner_sessions.py
import time
import uuid
import json
import os
from typing import Dict, Any, Optional
from pathlib import Path

_SESSIONS: Dict[str, Dict[str, Any]] = {}
_SESSION_TTL_SECONDS = 60 * 60  # 1 hour
_SESSIONS_DIR = "planner_sessions_data"

# Create sessions directory if it doesn't exist
Path(_SESSIONS_DIR).mkdir(exist_ok=True)

def _now():
    return int(time.time())

def _get_session_file(sid: str) -> str:
    """Get the file path for a session"""
    return os.path.join(_SESSIONS_DIR, f"{sid}.json")

def _save_session_to_disk(sid: str, state: Dict[str, Any]):
    """Save session to disk"""
    try:
        with open(_get_session_file(sid), 'w') as f:
            # Make JSON serializable by converting non-serializable types
            json.dump(state, f, default=str)
    except Exception as e:
        print(f"Warning: Failed to save session {sid} to disk: {e}")

def _load_session_from_disk(sid: str) -> Optional[Dict[str, Any]]:
    """Load session from disk"""
    try:
        fpath = _get_session_file(sid)
        if os.path.exists(fpath):
            with open(fpath, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Warning: Failed to load session {sid} from disk: {e}")
    return None

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
    # Also save to disk for persistence
    _save_session_to_disk(sid, state)
    return sid

def get_session(sid: str) -> Optional[Dict[str, Any]]:
    # First try in-memory cache
    s = _SESSIONS.get(sid)
    
    # If not in memory, try to load from disk
    if not s:
        s = _load_session_from_disk(sid)
        if s:
            _SESSIONS[sid] = s  # Re-cache it
    
    if not s:
        return None
    
    # Check TTL
    if _now() - s.get("updated_at", s.get("created_at", 0)) > _SESSION_TTL_SECONDS:
        _SESSIONS.pop(sid, None)
        # Try to clean up disk file
        try:
            os.remove(_get_session_file(sid))
        except:
            pass
        return None
    return s

def update_session(sid: str, key: str, value):
    s = get_session(sid)
    if not s:
        return None
    s[key] = value
    s["updated_at"] = _now()
    _save_session_to_disk(sid, s)
    return s

def push_selection(sid: str, step: str, place: Dict[str, Any]):
    s = get_session(sid)
    if not s:
        return None
    entry = {"step": step, "place": place, "ts": _now()}
    s["steps"].append(entry)
    s["updated_at"] = _now()
    _save_session_to_disk(sid, s)
    return s

def set_last_options(sid: str, step: str, options):
    s = get_session(sid)
    if not s:
        return None
    s["last_options"][step] = options
    s["updated_at"] = _now()
    _save_session_to_disk(sid, s)
    return s

def clear_session(sid: str):
    _SESSIONS.pop(sid, None)
    try:
        os.remove(_get_session_file(sid))
    except:
        pass

def list_sessions():
    return list(_SESSIONS.keys())

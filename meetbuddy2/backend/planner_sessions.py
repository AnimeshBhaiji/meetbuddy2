# planner_sessions.py — planning sessions, stored in Postgres.
#
# These used to live in a module-level dict with per-session JSON files written
# alongside. A restart dropped anyone mid-plan (the files were only consulted on
# a cache miss, and their directory was relative to the working directory), and
# the files were never swept, so 199 of them accumulated.
#
# Every function takes the request's db session so a session write shares the
# transaction of the route that made it.
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from models import PlannerSession

SESSION_TTL = timedelta(hours=24)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _expiry_cutoff() -> datetime:
    return _now() - SESSION_TTL


def _to_dict(row: PlannerSession) -> Dict[str, Any]:
    """The shape planner.py and the routes expect. Kept identical to the old
    in-memory dict so callers did not have to change."""
    return {
        "session_id": row.session_id,
        "user_id": row.user_id,
        "created_at": int(row.created_at.timestamp()) if row.created_at else None,
        "updated_at": int(row.updated_at.timestamp()) if row.updated_at else None,
        "payload": row.payload or {},
        "anchor": row.anchor or {},
        "steps": row.steps or [],
        "last_options": row.last_options or {},
        "selected_tokens": row.selected_tokens or [],
    }


def _live(sid: str, db: Session) -> Optional[PlannerSession]:
    """The row, if it exists and has not aged out."""
    row = db.query(PlannerSession).filter(PlannerSession.session_id == sid).first()
    if not row:
        return None
    if row.updated_at and row.updated_at < _expiry_cutoff():
        db.delete(row)
        db.commit()
        return None
    return row


def purge_expired(db: Session) -> int:
    """Drop aged-out sessions. Called on create so the table stays small without
    needing a scheduled job."""
    removed = (db.query(PlannerSession)
               .filter(PlannerSession.updated_at < _expiry_cutoff())
               .delete(synchronize_session=False))
    db.commit()
    return removed


def create_session(user_id: int, payload: Dict[str, Any], db: Session,
                   initial_state: Optional[Dict[str, Any]] = None) -> str:
    purge_expired(db)
    sid = str(uuid.uuid4())
    row = PlannerSession(
        session_id=sid,
        user_id=int(user_id),
        payload=payload or {},
        anchor=initial_state or {},
        steps=[],
        last_options={},
        selected_tokens=(initial_state or {}).get("selected_tokens", []),
    )
    db.add(row)
    db.commit()
    return sid


def get_session(sid: str, db: Session) -> Optional[Dict[str, Any]]:
    row = _live(sid, db)
    return _to_dict(row) if row else None


def update_session(sid: str, key: str, value, db: Session) -> Optional[Dict[str, Any]]:
    """Set one top-level field. Routes previously mutated the dict returned by
    get_session and relied on it being the live object — that silently does
    nothing now, so those writes go through here."""
    row = _live(sid, db)
    if not row:
        return None
    if not hasattr(row, key):
        raise ValueError(f"unknown session field: {key}")
    setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _to_dict(row)


def push_selection(sid: str, step: str, place: Dict[str, Any], db: Session):
    row = _live(sid, db)
    if not row:
        return None
    # Reassign rather than append: SQLAlchemy does not track in-place mutation
    # of a JSONB list, so an append alone would never reach the database.
    row.steps = [*(row.steps or []),
                 {"step": step, "place": place, "ts": int(_now().timestamp())}]
    db.commit()
    db.refresh(row)
    return _to_dict(row)


def set_last_options(sid: str, step: str, options, db: Session):
    row = _live(sid, db)
    if not row:
        return None
    row.last_options = {**(row.last_options or {}), step: options}
    db.commit()
    db.refresh(row)
    return _to_dict(row)


def clear_session(sid: str, db: Session) -> None:
    db.query(PlannerSession).filter(PlannerSession.session_id == sid).delete()
    db.commit()


def delete_sessions_for_user(user_id: int, db: Session) -> int:
    """Used when an account is deleted; the caller owns the commit."""
    return (db.query(PlannerSession)
            .filter(PlannerSession.user_id == user_id)
            .delete(synchronize_session=False))

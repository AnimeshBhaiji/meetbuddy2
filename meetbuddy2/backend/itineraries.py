# itineraries.py — saved-itinerary CRUD.
# Every route is scoped to the authenticated user from the bearer token.
# Payloads carry no user_id: a client-supplied id could name anyone.
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Itinerary, User

router = APIRouter(prefix="/itineraries", tags=["itineraries"])


class _Scheduled(BaseModel):
    """Shared start/end validation: an end that precedes its start is rejected
    rather than silently stored, since the calendar cannot render it."""

    @model_validator(mode="after")
    def _check_order(self):
        if self.start_at and self.end_at and self.end_at < self.start_at:
            raise ValueError("end_at must not be before start_at")
        return self


class ItineraryIn(_Scheduled):
    title: str
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    all_day: bool = False
    stops: List[Dict[str, Any]] = []


class ItineraryUpdate(_Scheduled):
    title: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    all_day: Optional[bool] = None
    stops: Optional[List[Dict[str, Any]]] = None


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def _to_dict(it: Itinerary) -> Dict[str, Any]:
    return {
        "id": it.id,
        "user_id": it.user_id,
        "title": it.title,
        "start_at": _iso(it.start_at),
        "end_at": _iso(it.end_at),
        "all_day": bool(it.all_day),
        "stops": it.stops or [],
        "created_at": _iso(it.created_at),
        "updated_at": _iso(it.updated_at),
    }


def _get_owned(itinerary_id: int, user_id: int, db: Session) -> Itinerary:
    it = (db.query(Itinerary)
          .filter(Itinerary.id == itinerary_id, Itinerary.user_id == user_id)
          .first())
    if not it:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return it


@router.post("")
def create_itinerary(payload: ItineraryIn, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    it = Itinerary(user_id=user.id, title=payload.title,
                   start_at=payload.start_at, end_at=payload.end_at,
                   all_day=payload.all_day, stops=payload.stops)
    db.add(it)
    db.commit()
    db.refresh(it)
    return _to_dict(it)


@router.get("")
def list_itineraries(db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    rows = (db.query(Itinerary).filter(Itinerary.user_id == user.id)
            .order_by(Itinerary.updated_at.desc()).all())
    return [{
        "id": r.id,
        "title": r.title,
        "start_at": _iso(r.start_at),
        "end_at": _iso(r.end_at),
        "all_day": bool(r.all_day),
        "stop_count": len(r.stops or []),
        "updated_at": _iso(r.updated_at),
    } for r in rows]


@router.get("/{itinerary_id}")
def get_itinerary(itinerary_id: int, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    return _to_dict(_get_owned(itinerary_id, user.id, db))


@router.put("/{itinerary_id}")
def update_itinerary(itinerary_id: int, payload: ItineraryUpdate, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    it = _get_owned(itinerary_id, user.id, db)
    data = payload.model_dump(exclude_unset=True)
    for field in ("title", "start_at", "end_at", "all_day", "stops"):
        if field in data:
            setattr(it, field, data[field])
    db.commit()
    db.refresh(it)
    return _to_dict(it)


@router.delete("/{itinerary_id}")
def delete_itinerary(itinerary_id: int, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    it = _get_owned(itinerary_id, user.id, db)
    db.delete(it)
    db.commit()
    return {"message": "deleted"}

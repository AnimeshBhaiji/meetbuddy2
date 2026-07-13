# itineraries.py — saved-itinerary CRUD.
# JWT validation is a tracked project TODO: like the rest of the API,
# endpoints trust the user_id the client sends.
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Itinerary

router = APIRouter(prefix="/itineraries", tags=["itineraries"])


class ItineraryIn(BaseModel):
    user_id: int
    title: str
    planned_date: Optional[date] = None
    stops: List[Dict[str, Any]] = []


class ItineraryUpdate(BaseModel):
    user_id: int
    title: Optional[str] = None
    planned_date: Optional[date] = None
    stops: Optional[List[Dict[str, Any]]] = None


def _to_dict(it: Itinerary) -> Dict[str, Any]:
    return {
        "id": it.id,
        "user_id": it.user_id,
        "title": it.title,
        "planned_date": it.planned_date.isoformat() if it.planned_date else None,
        "stops": it.stops or [],
        "created_at": it.created_at.isoformat() if it.created_at else None,
        "updated_at": it.updated_at.isoformat() if it.updated_at else None,
    }


def _get_owned(itinerary_id: int, user_id: int, db: Session) -> Itinerary:
    it = (db.query(Itinerary)
          .filter(Itinerary.id == itinerary_id, Itinerary.user_id == user_id)
          .first())
    if not it:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return it


@router.post("")
def create_itinerary(payload: ItineraryIn, db: Session = Depends(get_db)):
    it = Itinerary(user_id=payload.user_id, title=payload.title,
                   planned_date=payload.planned_date, stops=payload.stops)
    db.add(it)
    db.commit()
    db.refresh(it)
    return _to_dict(it)


@router.get("")
def list_itineraries(user_id: int, db: Session = Depends(get_db)):
    rows = (db.query(Itinerary).filter(Itinerary.user_id == user_id)
            .order_by(Itinerary.updated_at.desc()).all())
    return [{
        "id": r.id,
        "title": r.title,
        "planned_date": r.planned_date.isoformat() if r.planned_date else None,
        "stop_count": len(r.stops or []),
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    } for r in rows]


@router.get("/{itinerary_id}")
def get_itinerary(itinerary_id: int, user_id: int, db: Session = Depends(get_db)):
    return _to_dict(_get_owned(itinerary_id, user_id, db))


@router.put("/{itinerary_id}")
def update_itinerary(itinerary_id: int, payload: ItineraryUpdate, db: Session = Depends(get_db)):
    it = _get_owned(itinerary_id, payload.user_id, db)
    data = payload.model_dump(exclude_unset=True)
    for field in ("title", "planned_date", "stops"):
        if field in data:
            setattr(it, field, data[field])
    db.commit()
    db.refresh(it)
    return _to_dict(it)


@router.delete("/{itinerary_id}")
def delete_itinerary(itinerary_id: int, user_id: int, db: Session = Depends(get_db)):
    it = _get_owned(itinerary_id, user_id, db)
    db.delete(it)
    db.commit()
    return {"message": "deleted"}

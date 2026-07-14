import uuid

import pytest
from fastapi import HTTPException

from database import SessionLocal
from models import Itinerary, User
import itineraries as api


def _ensure_user(db):
    user = db.query(User).first()
    if user:
        return user.id
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="Test", last_name="User", email=f"it-{tag}@test.local",
                phone=f"9{tag}", username=f"it_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.id


def test_itinerary_model_roundtrip():
    db = SessionLocal()
    try:
        uid = _ensure_user(db)
        it = Itinerary(user_id=uid, title="Test plan",
                       stops=[{"step": "restaurant", "place": {"title": "X"}, "note": ""}])
        db.add(it)
        db.commit()
        db.refresh(it)
        assert it.id is not None
        assert it.created_at is not None
        assert it.stops[0]["place"]["title"] == "X"
        db.delete(it)
        db.commit()
    finally:
        db.close()


def test_itinerary_crud_roundtrip():
    db = SessionLocal()
    created_id = None
    try:
        uid = _ensure_user(db)
        created = api.create_itinerary(
            api.ItineraryIn(user_id=uid, title="Date night",
                            stops=[{"step": "restaurant", "place": {"title": "A"}, "note": ""}]),
            db)
        created_id = created["id"]
        assert created["title"] == "Date night"

        listing = api.list_itineraries(uid, db)
        assert any(row["id"] == created_id and row["stop_count"] == 1 for row in listing)

        updated = api.update_itinerary(
            created_id,
            api.ItineraryUpdate(user_id=uid, title="Anniversary",
                                stops=[{"step": "restaurant", "place": {"title": "A"}, "note": "window table"},
                                       {"step": "activity", "place": {"title": "B"}, "note": ""}]),
            db)
        assert updated["title"] == "Anniversary"
        assert len(updated["stops"]) == 2

        fetched = api.get_itinerary(created_id, uid, db)
        assert fetched["stops"][0]["note"] == "window table"

        assert api.delete_itinerary(created_id, uid, db)["message"] == "deleted"
        created_id = None
        with pytest.raises(HTTPException):
            api.get_itinerary(created["id"], uid, db)
    finally:
        if created_id:
            db.query(Itinerary).filter(Itinerary.id == created_id).delete()
            db.commit()
        db.close()


def test_itinerary_user_isolation():
    db = SessionLocal()
    try:
        uid = _ensure_user(db)
        created = api.create_itinerary(api.ItineraryIn(user_id=uid, title="Mine", stops=[]), db)
        with pytest.raises(HTTPException):
            api.get_itinerary(created["id"], uid + 999999, db)
        api.delete_itinerary(created["id"], uid, db)
    finally:
        db.close()

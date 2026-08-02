import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

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


def test_itinerary_schedule_roundtrip():
    """start_at/end_at/all_day survive create -> list -> update -> fetch."""
    db = SessionLocal()
    created_id = None
    try:
        uid = _ensure_user(db)
        start = datetime(2026, 8, 5, 15, 0, tzinfo=timezone.utc)
        end = start + timedelta(hours=2)

        created = api.create_itinerary(
            api.ItineraryIn(user_id=uid, title="Timed plan",
                            start_at=start, end_at=end, stops=[]), db)
        created_id = created["id"]
        assert created["start_at"] is not None
        assert created["all_day"] is False

        row = next(r for r in api.list_itineraries(uid, db) if r["id"] == created_id)
        assert row["start_at"] is not None and row["end_at"] is not None

        # rescheduling (what a calendar drag sends) moves both ends
        moved_start = start + timedelta(days=1)
        moved = api.update_itinerary(
            created_id,
            api.ItineraryUpdate(user_id=uid, start_at=moved_start,
                                end_at=moved_start + timedelta(hours=2)), db)
        assert moved["start_at"].startswith("2026-08-06")
        assert moved["title"] == "Timed plan"  # untouched fields survive

        # clearing the schedule unschedules the plan
        cleared = api.update_itinerary(
            created_id, api.ItineraryUpdate(user_id=uid, start_at=None, end_at=None), db)
        assert cleared["start_at"] is None and cleared["end_at"] is None

        api.delete_itinerary(created_id, uid, db)
        created_id = None
    finally:
        if created_id:
            db.query(Itinerary).filter(Itinerary.id == created_id).delete()
            db.commit()
        db.close()


def test_all_day_flag_persists():
    db = SessionLocal()
    created_id = None
    try:
        uid = _ensure_user(db)
        day = datetime(2026, 8, 7, 0, 0, tzinfo=timezone.utc)
        created = api.create_itinerary(
            api.ItineraryIn(user_id=uid, title="All day", start_at=day,
                            end_at=day + timedelta(days=1), all_day=True), db)
        created_id = created["id"]
        assert created["all_day"] is True
        assert api.get_itinerary(created_id, uid, db)["all_day"] is True
        api.delete_itinerary(created_id, uid, db)
        created_id = None
    finally:
        if created_id:
            db.query(Itinerary).filter(Itinerary.id == created_id).delete()
            db.commit()
        db.close()


def test_end_before_start_rejected():
    start = datetime(2026, 8, 5, 15, 0, tzinfo=timezone.utc)
    with pytest.raises(ValidationError):
        api.ItineraryIn(user_id=1, title="Backwards", start_at=start,
                        end_at=start - timedelta(hours=1))
    with pytest.raises(ValidationError):
        api.ItineraryUpdate(user_id=1, start_at=start,
                            end_at=start - timedelta(minutes=1))


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

"""Itinerary CRUD over HTTP. Routes are scoped to the token holder, so each
test gets its own account and passes a real bearer token.

Cross-account isolation lives in test_route_auth.py."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import main
import itineraries as api
from auth import create_access_token
from database import SessionLocal
from models import Itinerary, User

client = TestClient(main.app)


def _new_user(db):
    """A dedicated account per test: routes are scoped to the token holder, so
    sharing one user would let tests see each other's rows."""
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="Test", last_name="User", email=f"it-{tag}@test.local",
                phone=f"9{tag}", username=f"it_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def _cleanup(db, user):
    if user:
        db.query(Itinerary).filter(Itinerary.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.commit()


def test_itinerary_model_roundtrip():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        it = Itinerary(user_id=user.id, title="Test plan",
                       stops=[{"step": "restaurant", "place": {"title": "X"}, "note": ""}])
        db.add(it)
        db.commit()
        db.refresh(it)
        assert it.id is not None
        assert it.created_at is not None
        assert it.stops[0]["place"]["title"] == "X"
    finally:
        _cleanup(db, user)
        db.close()


def test_itinerary_crud_roundtrip():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        h = _auth(user)

        created = client.post("/itineraries", headers=h, json={
            "title": "Date night",
            "stops": [{"step": "restaurant", "place": {"title": "A"}, "note": ""}],
        }).json()
        assert created["title"] == "Date night"
        assert created["user_id"] == user.id
        plan_id = created["id"]

        listing = client.get("/itineraries", headers=h).json()
        assert any(r["id"] == plan_id and r["stop_count"] == 1 for r in listing)

        updated = client.put(f"/itineraries/{plan_id}", headers=h, json={
            "title": "Anniversary",
            "stops": [{"step": "restaurant", "place": {"title": "A"}, "note": "window table"},
                      {"step": "activity", "place": {"title": "B"}, "note": ""}],
        }).json()
        assert updated["title"] == "Anniversary"
        assert len(updated["stops"]) == 2

        fetched = client.get(f"/itineraries/{plan_id}", headers=h).json()
        assert fetched["stops"][0]["note"] == "window table"

        assert client.delete(f"/itineraries/{plan_id}", headers=h).json()["message"] == "deleted"
        assert client.get(f"/itineraries/{plan_id}", headers=h).status_code == 404
    finally:
        _cleanup(db, user)
        db.close()


def test_itinerary_schedule_roundtrip():
    """start_at/end_at/all_day survive create -> list -> update -> fetch."""
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        h = _auth(user)
        start = datetime(2026, 8, 5, 15, 0, tzinfo=timezone.utc)
        end = start + timedelta(hours=2)

        created = client.post("/itineraries", headers=h, json={
            "title": "Timed plan", "start_at": start.isoformat(),
            "end_at": end.isoformat(), "stops": [],
        }).json()
        plan_id = created["id"]
        assert created["start_at"] is not None
        assert created["all_day"] is False

        row = next(r for r in client.get("/itineraries", headers=h).json() if r["id"] == plan_id)
        assert row["start_at"] and row["end_at"]

        # rescheduling (what a calendar drag sends) moves both ends
        moved_start = start + timedelta(days=1)
        moved = client.put(f"/itineraries/{plan_id}", headers=h, json={
            "start_at": moved_start.isoformat(),
            "end_at": (moved_start + timedelta(hours=2)).isoformat(),
        }).json()
        assert moved["start_at"].startswith("2026-08-06")
        assert moved["title"] == "Timed plan"  # untouched fields survive

        cleared = client.put(f"/itineraries/{plan_id}", headers=h,
                             json={"start_at": None, "end_at": None}).json()
        assert cleared["start_at"] is None and cleared["end_at"] is None
    finally:
        _cleanup(db, user)
        db.close()


def test_all_day_flag_persists():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        h = _auth(user)
        day = datetime(2026, 8, 7, 0, 0, tzinfo=timezone.utc)
        created = client.post("/itineraries", headers=h, json={
            "title": "All day", "start_at": day.isoformat(),
            "end_at": (day + timedelta(days=1)).isoformat(), "all_day": True,
        }).json()
        assert created["all_day"] is True
        assert client.get(f"/itineraries/{created['id']}", headers=h).json()["all_day"] is True
    finally:
        _cleanup(db, user)
        db.close()


def test_end_before_start_rejected():
    start = datetime(2026, 8, 5, 15, 0, tzinfo=timezone.utc)
    with pytest.raises(ValidationError):
        api.ItineraryIn(title="Backwards", start_at=start, end_at=start - timedelta(hours=1))
    with pytest.raises(ValidationError):
        api.ItineraryUpdate(start_at=start, end_at=start - timedelta(minutes=1))


def test_end_before_start_rejected_over_http():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        start = datetime(2026, 8, 5, 15, 0, tzinfo=timezone.utc)
        resp = client.post("/itineraries", headers=_auth(user), json={
            "title": "Backwards", "start_at": start.isoformat(),
            "end_at": (start - timedelta(hours=1)).isoformat(),
        })
        assert resp.status_code == 422
    finally:
        _cleanup(db, user)
        db.close()

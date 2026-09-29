"""The next step's search centres on the pick the user just made.

The select route read the session before saving the new pick and searched from
that stale copy, so each follow-up centred on the previous pick. For the first
follow-up there was no previous pick, and with a typed (not GPS) location there
were no coordinates either, so "things to do" was searched worldwide and came
back with places in Portugal and Spain.
"""
import uuid

from fastapi.testclient import TestClient

import main
import planner_sessions as ps
from auth import create_access_token
from database import SessionLocal
from models import PlannerSession, User

client = TestClient(main.app)

CHIANTI = {"title": "Chianti", "place_id": "chianti", "lat": 12.9719, "lng": 77.6412}
MUSEUM = {"title": "HAL Museum", "place_id": "hal", "lat": 12.9500, "lng": 77.6800}


def _user(db):
    tag = uuid.uuid4().hex[:8]
    u = User(first_name="F", last_name="A", email=f"fa-{tag}@test.local", phone=f"5{tag}",
             username=f"fa_{tag}", password="x", preferences={"mood": "Romantic"})
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _cleanup(db, u):
    db.query(PlannerSession).filter(PlannerSession.user_id == u.id).delete()
    db.query(User).filter(User.id == u.id).delete()
    db.commit()


def _record_followups(monkeypatch):
    seen = []

    def fake(session, next_step, num_results=15):
        seen.append({"next_step": next_step, "last": (session.get("steps") or [{}])[-1].get("place"),
                     "coords": session.get("payload", {}).get("coords")})
        return {"options": [{"title": "Somewhere"}], "anchor_text": "x"}

    monkeypatch.setattr(main, "generate_followup_suggestions", fake)
    return seen


def test_followup_centres_on_the_pick_just_made(monkeypatch):
    db = SessionLocal()
    u = _user(db)
    try:
        seen = _record_followups(monkeypatch)
        sid = ps.create_session(u.id, {"preferences": {}, "coords": None, "location": "Indiranagar"}, db)
        h = {"Authorization": f"Bearer {create_access_token(u)}"}

        r = client.post(f"/planner/session/{sid}/select", headers=h,
                        json={"step": "restaurant", "place": CHIANTI, "next_step": "activity", "selected_tokens": []})
        assert r.status_code == 200, r.text
        r = client.post(f"/planner/session/{sid}/select", headers=h,
                        json={"step": "activity", "place": MUSEUM, "next_step": "stay", "selected_tokens": []})
        assert r.status_code == 200, r.text

        assert [s["last"]["title"] for s in seen] == ["Chianti", "HAL Museum"], seen
    finally:
        _cleanup(db, u)
        db.close()


def test_last_pick_runs_no_search(monkeypatch):
    db = SessionLocal()
    u = _user(db)
    try:
        seen = _record_followups(monkeypatch)
        sid = ps.create_session(u.id, {"preferences": {}, "coords": None, "location": "Indiranagar"}, db)
        h = {"Authorization": f"Bearer {create_access_token(u)}"}
        r = client.post(f"/planner/session/{sid}/select", headers=h,
                        json={"step": "stay", "place": CHIANTI, "next_step": "done", "selected_tokens": []})
        assert r.status_code == 200, r.text
        assert r.json()["next_step"] == "done" and r.json()["options"] == []
        assert seen == [], "a search ran after the final pick"
        assert len(ps.get_session(sid, db)["steps"]) == 1  # the pick is still saved
    finally:
        _cleanup(db, u)
        db.close()


def test_typed_location_keeps_its_geocoded_coordinates_for_later_searches(monkeypatch):
    """Skip before any pick anchors on the session origin; for a typed place that
    is the point the initial search geocoded."""
    db = SessionLocal()
    u = _user(db)
    try:
        monkeypatch.setattr(main, "generate_initial_suggestions", lambda payload, num_results=15: {
            "options": [], "origin": {"lat": 12.9733, "lng": 77.6405, "exact": False, "label": "Indiranagar"}})
        h = {"Authorization": f"Bearer {create_access_token(u)}"}
        r = client.post("/planner/session", headers=h, json={"location": "Indiranagar", "coords": None})
        assert r.status_code == 200, r.text
        stored = ps.get_session(r.json()["session_id"], db)["payload"]
        assert stored["coords"] == {"lat": 12.9733, "lng": 77.6405}
    finally:
        _cleanup(db, u)
        db.close()

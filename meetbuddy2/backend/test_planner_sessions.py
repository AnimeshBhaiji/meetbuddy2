"""Planner sessions are stored in Postgres, so they outlive the process that
created them and are removed with their account."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import main
import planner_sessions as ps
from auth import create_access_token
from database import SessionLocal
from models import PlannerSession, User

client = TestClient(main.app)


def _new_user(db):
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="PS", last_name="Test", email=f"ps-{tag}@test.local",
                phone=f"4{tag}", username=f"ps_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def _cleanup(db, *users):
    for u in users:
        if u:
            db.query(PlannerSession).filter(PlannerSession.user_id == u.id).delete()
            db.query(User).filter(User.id == u.id).delete()
    db.commit()


def test_session_round_trips_through_the_database():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        sid = ps.create_session(user.id, {"preferences": {"mood": "Romantic"},
                                          "location": "Indiranagar"}, db)
        loaded = ps.get_session(sid, db)
        assert loaded["session_id"] == sid
        assert loaded["user_id"] == user.id
        assert loaded["payload"]["location"] == "Indiranagar"
        assert loaded["steps"] == [] and loaded["last_options"] == {}
    finally:
        _cleanup(db, user)
        db.close()


def test_session_survives_a_new_process():
    """The point of the change: a fresh connection — as a restarted backend has
    — still sees the session."""
    db = SessionLocal()
    try:
        user = _new_user(db)
        user_id = user.id          # plain int: the ORM object detaches on close
        sid = ps.create_session(user_id, {"location": "Koramangala"}, db)
        ps.push_selection(sid, "restaurant", {"title": "Somewhere"}, db)
    finally:
        db.close()

    # everything above is gone from memory; only Postgres holds the session
    db2 = SessionLocal()
    try:
        revived = ps.get_session(sid, db2)
        assert revived is not None, "session did not survive a new connection"
        assert revived["payload"]["location"] == "Koramangala"
        assert [s["step"] for s in revived["steps"]] == ["restaurant"]
    finally:
        db2.query(PlannerSession).filter(PlannerSession.user_id == user_id).delete()
        db2.query(User).filter(User.id == user_id).delete()
        db2.commit()
        db2.close()


def test_selections_and_options_accumulate():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        sid = ps.create_session(user.id, {}, db)
        ps.push_selection(sid, "restaurant", {"title": "A"}, db)
        ps.push_selection(sid, "activity", {"title": "B"}, db)
        ps.set_last_options(sid, "initial", [{"title": "X"}], db)
        ps.set_last_options(sid, "activity", [{"title": "Y"}], db)

        s = ps.get_session(sid, db)
        assert [x["step"] for x in s["steps"]] == ["restaurant", "activity"]
        assert set(s["last_options"]) == {"initial", "activity"}
    finally:
        _cleanup(db, user)
        db.close()


def test_update_session_persists():
    """Routes used to mutate the dict get_session returned; that no longer
    reaches the store, so the explicit setter must."""
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        sid = ps.create_session(user.id, {}, db)
        ps.update_session(sid, "selected_tokens", [{"label": "Romantic"}], db)
        assert ps.get_session(sid, db)["selected_tokens"] == [{"label": "Romantic"}]

        with pytest.raises(ValueError):
            ps.update_session(sid, "not_a_field", 1, db)
    finally:
        _cleanup(db, user)
        db.close()


def test_expired_session_is_gone():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        sid = ps.create_session(user.id, {}, db)
        row = db.query(PlannerSession).filter(PlannerSession.session_id == sid).first()
        row.updated_at = datetime.now(timezone.utc) - ps.SESSION_TTL - timedelta(minutes=1)
        db.commit()

        assert ps.get_session(sid, db) is None
        assert db.query(PlannerSession).filter(PlannerSession.session_id == sid).first() is None
    finally:
        _cleanup(db, user)
        db.close()


def test_session_just_inside_the_ttl_survives():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        sid = ps.create_session(user.id, {}, db)
        row = db.query(PlannerSession).filter(PlannerSession.session_id == sid).first()
        row.updated_at = datetime.now(timezone.utc) - ps.SESSION_TTL + timedelta(minutes=5)
        db.commit()
        assert ps.get_session(sid, db) is not None
    finally:
        _cleanup(db, user)
        db.close()


def test_creating_a_session_purges_expired_ones():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        stale = ps.create_session(user.id, {}, db)
        row = db.query(PlannerSession).filter(PlannerSession.session_id == stale).first()
        row.updated_at = datetime.now(timezone.utc) - ps.SESSION_TTL - timedelta(hours=1)
        db.commit()

        ps.create_session(user.id, {}, db)   # sweeps on the way in
        assert db.query(PlannerSession).filter(PlannerSession.session_id == stale).first() is None
    finally:
        _cleanup(db, user)
        db.close()


def test_deleting_an_account_removes_its_sessions():
    db = SessionLocal()
    keeper = None
    try:
        victim, keeper = _new_user(db), _new_user(db)
        victim_id = victim.id
        ps.create_session(victim_id, {}, db)
        ps.create_session(victim_id, {}, db)
        keeper_sid = ps.create_session(keeper.id, {}, db)

        resp = client.delete("/user/me", headers=_auth(victim))
        assert resp.status_code == 200
        assert resp.json()["sessions_deleted"] == 2

        assert db.query(PlannerSession).filter(PlannerSession.user_id == victim_id).count() == 0
        assert ps.get_session(keeper_sid, db) is not None, "another account's session was removed"
    finally:
        _cleanup(db, keeper)
        db.close()

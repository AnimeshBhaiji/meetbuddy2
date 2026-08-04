"""Account deletion via DELETE /user/me — cascade and scoping.

Identity comes from the token, so there is no id to pass and no 'delete someone
else' case to test here; a token that names no live account is covered by
test_auth.test_token_for_deleted_account_rejected."""
import uuid

from fastapi.testclient import TestClient

import main
from auth import create_access_token
from database import SessionLocal
from models import Itinerary, User

client = TestClient(main.app)


def _make_user(db):
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="Del", last_name="Test", email=f"del-{tag}@test.local",
                phone=f"6{tag}", username=f"del_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def test_delete_me_cascades_to_the_callers_itineraries():
    db = SessionLocal()
    try:
        user = _make_user(db)
        user_id = user.id
        db.add(Itinerary(user_id=user_id, title="One", stops=[]))
        db.add(Itinerary(user_id=user_id, title="Two", stops=[]))
        db.commit()

        resp = client.delete("/user/me", headers=_auth(user))
        assert resp.status_code == 200
        assert resp.json() == {"message": "deleted", "itineraries_deleted": 2}

        assert db.query(User).filter(User.id == user_id).first() is None
        assert db.query(Itinerary).filter(Itinerary.user_id == user_id).count() == 0
    finally:
        db.close()


def test_delete_me_with_no_itineraries():
    db = SessionLocal()
    try:
        user = _make_user(db)
        user_id = user.id
        resp = client.delete("/user/me", headers=_auth(user))
        assert resp.status_code == 200
        assert resp.json()["itineraries_deleted"] == 0
        assert db.query(User).filter(User.id == user_id).first() is None
    finally:
        db.close()


def test_the_token_stops_working_once_the_account_is_gone():
    """Deleting an account must end its live session, not just its data."""
    db = SessionLocal()
    try:
        user = _make_user(db)
        headers = _auth(user)
        assert client.delete("/user/me", headers=headers).status_code == 200
        # same token, now orphaned
        assert client.get("/user/me", headers=headers).status_code == 401
        assert client.get("/itineraries", headers=headers).status_code == 401
    finally:
        db.close()

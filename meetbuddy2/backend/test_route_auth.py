"""Every protected route rejects anonymous callers, and a token for one account
cannot reach another account's data. These are the checks that make the
user_id-from-the-client hole stay closed."""
import uuid

import pytest
from fastapi.testclient import TestClient

import main
from auth import create_access_token
from database import SessionLocal
from models import Itinerary, PlannerSession, User

client = TestClient(main.app)


def _new_account(db):
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="R", last_name="A", email=f"ra-{tag}@test.local",
                phone=f"2{tag}", username=f"ra_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(user)}"}


# Every route that must never answer an unauthenticated caller.
PROTECTED = [
    ("get", "/user/me", None),
    ("delete", "/user/me", None),
    ("get", "/itineraries", None),
    ("post", "/itineraries", {"title": "x"}),
    ("get", "/itineraries/1", None),
    ("put", "/itineraries/1", {"title": "x"}),
    ("delete", "/itineraries/1", None),
    ("post", "/save_preferences", {"mood": "Romantic"}),
    ("get", "/user_prefs/me", None),
    ("get", "/geocode?q=paris", None),
    ("post", "/planner/session", {"preferences": {}}),
    ("post", "/planner/options", {"category": "restaurant", "anchor": {"lat": 1, "lng": 1}}),
    ("get", "/planner/session/abc", None),
    ("post", "/planner/session/abc/select", {"step": "restaurant", "place": {}}),
    ("post", "/planner/session/abc/skip", {"next_step": "activity"}),
]


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_route_requires_a_token(method, path, body):
    resp = getattr(client, method)(path, **({"json": body} if body is not None else {}))
    assert resp.status_code == 401, f"{method.upper()} {path} answered {resp.status_code} unauthenticated"


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_route_rejects_a_garbage_token(method, path, body):
    kwargs = {"headers": {"Authorization": "Bearer mock-token"}}
    if body is not None:
        kwargs["json"] = body
    resp = getattr(client, method)(path, **kwargs)
    assert resp.status_code == 401, f"{method.upper()} {path} accepted a fake token"


def test_public_routes_stay_open():
    # wrong credentials, but reached the handler rather than being blocked by auth
    resp = client.post("/login", json={"identifier": "nobody-here", "password": "x"})
    assert resp.status_code == 400


def test_one_account_cannot_read_or_delete_anothers_itinerary():
    db = SessionLocal()
    alice = bob = None
    try:
        alice, bob = _new_account(db), _new_account(db)
        plan = Itinerary(user_id=alice.id, title="Alice's plan", stops=[])
        db.add(plan)
        db.commit()
        db.refresh(plan)

        # Bob holds a valid token — for his own account only.
        assert client.get(f"/itineraries/{plan.id}", headers=_auth(bob)).status_code == 404
        assert client.put(f"/itineraries/{plan.id}", json={"title": "hijacked"},
                          headers=_auth(bob)).status_code == 404
        assert client.delete(f"/itineraries/{plan.id}", headers=_auth(bob)).status_code == 404

        # Alice's plan is untouched, and Bob's own list never shows it.
        db.refresh(plan)
        assert plan.title == "Alice's plan"
        assert client.get("/itineraries", headers=_auth(bob)).json() == []
        assert [r["id"] for r in client.get("/itineraries", headers=_auth(alice)).json()] == [plan.id]
    finally:
        for u in (alice, bob):
            if u:
                db.query(Itinerary).filter(Itinerary.user_id == u.id).delete()
                db.query(User).filter(User.id == u.id).delete()
        db.commit()
        db.close()


def test_created_itinerary_belongs_to_the_token_holder():
    """A user_id smuggled into the body must not change ownership."""
    db = SessionLocal()
    alice = bob = None
    try:
        alice, bob = _new_account(db), _new_account(db)
        created = client.post("/itineraries",
                              json={"title": "mine", "user_id": alice.id},
                              headers=_auth(bob)).json()
        assert created["user_id"] == bob.id, "body user_id overrode the token"
    finally:
        for u in (alice, bob):
            if u:
                db.query(Itinerary).filter(Itinerary.user_id == u.id).delete()
                db.query(User).filter(User.id == u.id).delete()
        db.commit()
        db.close()


def test_delete_me_only_removes_the_caller():
    db = SessionLocal()
    keeper = None
    try:
        victim, keeper = _new_account(db), _new_account(db)
        victim_id = victim.id
        db.add(Itinerary(user_id=victim_id, title="going", stops=[]))
        db.add(Itinerary(user_id=keeper.id, title="staying", stops=[]))
        db.commit()

        resp = client.delete("/user/me", headers=_auth(victim))
        assert resp.status_code == 200
        assert resp.json()["itineraries_deleted"] == 1

        assert db.query(User).filter(User.id == victim_id).first() is None
        assert db.query(User).filter(User.id == keeper.id).first() is not None
        assert db.query(Itinerary).filter(Itinerary.user_id == keeper.id).count() == 1
    finally:
        if keeper:
            db.query(Itinerary).filter(Itinerary.user_id == keeper.id).delete()
            db.query(User).filter(User.id == keeper.id).delete()
            db.commit()
        db.close()


def test_planner_session_of_another_user_is_not_reachable():
    db = SessionLocal()
    alice = bob = None
    try:
        alice, bob = _new_account(db), _new_account(db)
        from planner_sessions import create_session
        sid = create_session(alice.id, {"preferences": {}, "coords": None, "location": None}, db)

        assert client.get(f"/planner/session/{sid}", headers=_auth(bob)).status_code == 404
        assert client.post(f"/planner/session/{sid}/skip", json={"next_step": "activity"},
                           headers=_auth(bob)).status_code == 404
        # the owner still reaches it
        assert client.get(f"/planner/session/{sid}", headers=_auth(alice)).status_code == 200
    finally:
        # sessions first: planner_sessions.user_id has no ON DELETE CASCADE
        for u in (alice, bob):
            if u:
                db.query(PlannerSession).filter(PlannerSession.user_id == u.id).delete()
                db.query(User).filter(User.id == u.id).delete()
        db.commit()
        db.close()

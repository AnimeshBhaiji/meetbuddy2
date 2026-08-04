"""Questionnaire answers live on the user row.

They used to be a single-slot JSON file: every save rewrote the whole file as
{current_user_id: prefs}, so one account saving destroyed everyone else's."""
import uuid

from fastapi.testclient import TestClient

import main
from auth import create_access_token
from database import SessionLocal
from models import User

client = TestClient(main.app)


def _new_user(db):
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="Pref", last_name="Test", email=f"pref-{tag}@test.local",
                phone=f"7{tag}", username=f"pref_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def _cleanup(db, *users):
    for u in users:
        if u:
            db.query(User).filter(User.id == u.id).delete()
    db.commit()


def test_preferences_round_trip():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        h = _auth(user)
        # sub-answers are objects keyed by sub-question id, as the
        # questionnaire sends them
        saved = client.post("/save_preferences", headers=h, json={
            "mood": "Romantic", "planningStyle": "Surprise me",
            "mood_sub": {"ro_setting": "Candlelit / intimate"},
        }).json()
        assert saved["prefs"]["mood"] == ["Romantic"]

        read = client.get("/user_prefs/me", headers=h).json()
        assert read["user_id"] == user.id
        assert read["prefs"]["mood"] == ["Romantic"]
        assert read["prefs"]["mood_sub"] == {"ro_setting": "Candlelit / intimate"}
    finally:
        _cleanup(db, user)
        db.close()


def test_one_account_saving_does_not_wipe_another():
    """The bug the JSON file had: B saving erased A's answers."""
    db = SessionLocal()
    alice = bob = None
    try:
        alice, bob = _new_user(db), _new_user(db)
        client.post("/save_preferences", headers=_auth(alice), json={"mood": "Romantic"})
        client.post("/save_preferences", headers=_auth(bob), json={"mood": "Business-y"})

        a = client.get("/user_prefs/me", headers=_auth(alice))
        assert a.status_code == 200, "the other account's save destroyed these preferences"
        assert a.json()["prefs"]["mood"] == ["Romantic"]
        assert client.get("/user_prefs/me", headers=_auth(bob)).json()["prefs"]["mood"] == ["Business-y"]
    finally:
        _cleanup(db, alice, bob)
        db.close()


def test_saving_again_replaces_the_previous_answers():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        h = _auth(user)
        client.post("/save_preferences", headers=h, json={"mood": "Romantic", "addOnMagic": "Live music spots"})
        client.post("/save_preferences", headers=h, json={"mood": "Chill & Relaxed"})

        prefs = client.get("/user_prefs/me", headers=h).json()["prefs"]
        assert prefs["mood"] == ["Chill & Relaxed"]
        assert "addOnMagic" not in prefs, "old answers should not linger"
    finally:
        _cleanup(db, user)
        db.close()


def test_no_preferences_yet_is_404():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        assert client.get("/user_prefs/me", headers=_auth(user)).status_code == 404
    finally:
        _cleanup(db, user)
        db.close()


def test_body_user_id_cannot_target_another_account():
    db = SessionLocal()
    alice = bob = None
    try:
        alice, bob = _new_user(db), _new_user(db)
        client.post("/save_preferences", headers=_auth(bob),
                    json={"mood": "Romantic", "user_id": alice.id})

        db.refresh(alice)
        db.refresh(bob)
        assert alice.preferences == {}, "a body user_id wrote to someone else's account"
        assert bob.preferences["mood"] == ["Romantic"]
    finally:
        _cleanup(db, alice, bob)
        db.close()


def test_preferences_go_with_a_deleted_account():
    """No extra cleanup code: the column is part of the row."""
    db = SessionLocal()
    try:
        user = _new_user(db)
        user_id = user.id
        h = _auth(user)
        client.post("/save_preferences", headers=h, json={"mood": "Romantic"})

        assert client.delete("/user/me", headers=h).status_code == 200
        assert db.query(User).filter(User.id == user_id).first() is None
        # the token now names nobody, so nothing can read those preferences
        assert client.get("/user_prefs/me", headers=h).status_code == 401
    finally:
        db.close()


def test_planner_uses_the_saved_preferences_not_the_request():
    """A stale or forged client copy must not steer the plan."""
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        h = _auth(user)
        client.post("/save_preferences", headers=h,
                    json={"mood": "Business-y", "planningStyle": "Surprise me"})

        # send contradicting preferences in the body
        resp = client.post("/planner/session", headers=h, json={
            "preferences": {"mood": "Romantic", "planningStyle": "Full control"},
            "location": "Indiranagar Bangalore",
        })
        assert resp.status_code == 200, resp.text

        # the session records what the account had saved, not what was sent
        sid = resp.json()["session_id"]
        stored = client.get(f"/planner/session/{sid}", headers=h).json()
        assert stored["payload"]["preferences"]["mood"] == ["Business-y"]
        assert stored["payload"]["preferences"]["planningStyle"] == ["Surprise me"]
    finally:
        if user:
            from models import PlannerSession
            db.query(PlannerSession).filter(PlannerSession.user_id == user.id).delete()
            db.commit()
        _cleanup(db, user)
        db.close()


def test_planning_without_saved_preferences_is_rejected():
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        resp = client.post("/planner/session", headers=_auth(user),
                           json={"location": "Indiranagar Bangalore"})
        assert resp.status_code == 400
        assert "questionnaire" in resp.json()["detail"].lower()
    finally:
        _cleanup(db, user)
        db.close()


def test_sub_answers_keep_their_question_ids():
    """Sub-answers are {sub_question_id: answer}. Flattening them to a list
    loses the ids: directives silently sees no sub-answers, and place_analyzer
    raises AttributeError mid-plan."""
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        h = _auth(user)
        client.post("/save_preferences", headers=h, json={
            "mood": "Romantic",
            "mood_sub": {"ro_setting": "Scenic / rooftop", "ro_surprise": "No"},
            "adventureLevel_sub": {"sc_area": "Central"},
        })

        prefs = client.get("/user_prefs/me", headers=h).json()["prefs"]
        assert isinstance(prefs["mood_sub"], dict), f"shape lost: {prefs['mood_sub']!r}"
        assert prefs["mood_sub"]["ro_setting"] == "Scenic / rooftop"
        assert prefs["adventureLevel_sub"]["sc_area"] == "Central"

        # and the consumers can actually read them back
        from directives import _sub_answers, _sub_text
        assert _sub_text(_sub_answers(prefs, "mood"), "ro_setting") == "Scenic / rooftop"
    finally:
        _cleanup(db, user)
        db.close()


def test_planning_with_sub_answers_does_not_crash():
    """Regression: stored sub-answers reached place_analyzer as a list and
    raised 'list object has no attribute get', failing the request with a 500."""
    db = SessionLocal()
    user = None
    try:
        user = _new_user(db)
        h = _auth(user)
        client.post("/save_preferences", headers=h, json={
            "mood": "Romantic", "planningStyle": "Surprise me",
            "adventureLevel": "Stick to the city", "memorableFactor": "Amazing food",
            "mood_sub": {"ro_setting": "Scenic / rooftop", "ro_surprise": "No"},
            "planningStyle_sub": {"sm_prior": ["Food quality"]},
            "adventureLevel_sub": {"sc_area": "Central"},
        })

        resp = client.post("/planner/session", headers=h,
                           json={"location": "Indiranagar Bangalore"})
        assert resp.status_code == 200, f"planning failed: {resp.status_code} {resp.text[:300]}"
    finally:
        if user:
            from models import PlannerSession
            db.query(PlannerSession).filter(PlannerSession.user_id == user.id).delete()
            db.commit()
        _cleanup(db, user)
        db.close()


def test_place_analyzer_survives_a_bad_sub_shape():
    """Defence in depth: a scoring helper must not take down a plan request."""
    from place_analyzer import analyze_stage2_preferences
    place = {"title": "Rooftop Cafe", "description": "great view", "snippet": "", "reviews": []}
    for bad in (["Scenic"], "Scenic", 5):
        out = analyze_stage2_preferences(place, {"mood_sub": bad})
        assert "compatibility_score" in out

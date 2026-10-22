"""The planner home shows the flow the plan will actually follow.

It used to show a hard-coded "Restaurant → Activity → Stay" until a plan was
generated, while the real flow could be shorter. And the stay step was dropped
whenever any adventure follow-up answer contained "no", so answering "No" to
Transport support removed it, though only "Accommodation needed? No" should.
"""
import uuid

from fastapi.testclient import TestClient

import main
from auth import create_access_token
from database import SessionLocal
from directives import planned_flow
from models import User

client = TestClient(main.app)

ROMANTIC_CITY = {"mood": "Romantic", "planningStyle": "Semi-custom", "adventureLevel": "Stick to the city"}


def test_transport_answer_no_does_not_drop_the_stay():
    prefs = {**ROMANTIC_CITY, "adventureLevel_sub": {"sc_area": "Central", "sc_transport": "No"}}
    assert planned_flow(prefs) == ["restaurant", "activity", "stay"]


def test_no_accommodation_drops_the_stay():
    prefs = {"mood": "Romantic", "adventureLevel": "Weekend escape", "adventureLevel_sub": {"we_accom": "No"}}
    assert "stay" not in planned_flow(prefs)
    prefs["adventureLevel_sub"]["we_accom"] = "Maybe"
    assert "stay" in planned_flow(prefs)


def test_business_meeting_is_a_restaurant_only_plan():
    assert planned_flow({"mood": "Business-y", "adventureLevel": "Stick to the city"}) == ["restaurant"]


def test_flow_route_matches_what_the_planner_will_run(monkeypatch):
    db = SessionLocal()
    tag = uuid.uuid4().hex[:8]
    prefs = {**ROMANTIC_CITY, "adventureLevel_sub": {"sc_transport": "No"}}
    user = User(first_name="P", last_name="F", email=f"pf-{tag}@test.local", phone=f"6{tag}",
                username=f"pf_{tag}", password="x", preferences=prefs)
    db.add(user); db.commit(); db.refresh(user)
    try:
        h = {"Authorization": f"Bearer {create_access_token(user)}"}
        shown = client.get("/planner/flow", headers=h)
        assert shown.status_code == 200, shown.text
        monkeypatch.setattr(main, "generate_initial_suggestions",
                            lambda payload, num_results=15: {"options": [], "recommended_flow": planned_flow(payload["preferences"])})
        run = client.post("/planner/session", headers=h, json={"location": "Indiranagar"})
        assert shown.json()["flow"] == run.json()["initial"]["recommended_flow"] == ["restaurant", "activity", "stay"]
    finally:
        from models import PlannerSession
        db.query(PlannerSession).filter(PlannerSession.user_id == user.id).delete()
        db.query(User).filter(User.id == user.id).delete(); db.commit(); db.close()

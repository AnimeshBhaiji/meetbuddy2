"""
Test suite for stateless options endpoint via generate_followup_suggestions.
Verifies the synthetic-session reuse and the new cafe category.
"""
import asyncio

import pytest
from fastapi import HTTPException

import main
import planner


FAKE_PLACES = [
    {"title": "Blue Tokai", "address": "MG Road", "lat": 12.9750, "lng": 77.6040,
     "rating": "4.6", "place_id": "p1"},
    {"title": "Far Cafe", "address": "Airport Rd", "lat": 13.3000, "lng": 77.9000,
     "rating": "4.8", "place_id": "p2"},
]


def _fake_search(query, coords, radius_m):
    _fake_search.calls.append(query)
    return [dict(p) for p in FAKE_PLACES]


def test_options_without_session_anchor_to_coords(monkeypatch):
    _fake_search.calls = []
    monkeypatch.setattr(planner, "search_places", _fake_search)
    state = {"payload": {"preferences": {"mood": "Romantic"},
                         "coords": {"lat": 12.9716, "lng": 77.5946}}, "steps": []}
    result = planner.generate_followup_suggestions(state, "cafe", num_results=10)
    titles = [o["title"] for o in result["options"]]
    assert "Blue Tokai" in titles          # within followup radius
    assert "Far Cafe" not in titles        # ~40 km away -> radius-filtered
    assert any("cafe" in q.lower() for q in _fake_search.calls)


def test_options_unknown_category_falls_back_to_restaurants(monkeypatch):
    _fake_search.calls = []
    monkeypatch.setattr(planner, "search_places", _fake_search)
    state = {"payload": {"preferences": {}, "coords": {"lat": 12.9716, "lng": 77.5946}},
             "steps": []}
    result = planner.generate_followup_suggestions(state, "shisha_lounge", num_results=10)
    assert result["options"], "expected ranked options"
    assert any("restaurant" in q.lower() for q in _fake_search.calls)


class FakeRequest:
    def __init__(self, data):
        self._data = data

    async def json(self):
        return self._data


def test_options_endpoint_400_on_missing_anchor():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(main.planner_options(FakeRequest({"category": "cafe"})))
    assert exc.value.status_code == 400


def test_options_endpoint_maps_response_shape(monkeypatch):
    def fake_followup(state, category, num_results=15):
        # endpoint must pass anchor coords + default category through
        assert state["payload"]["coords"] == {"lat": 12.9716, "lng": 77.5946}
        assert category == "restaurant"  # default when not sent
        return {"anchor_text": "MG Road", "next_step": category,
                "options": [{"title": "X"}], "desired_types": []}

    monkeypatch.setattr(main, "generate_followup_suggestions", fake_followup)
    result = asyncio.run(main.planner_options(
        FakeRequest({"anchor": {"lat": 12.9716, "lng": 77.5946}})))
    assert result == {"options": [{"title": "X"}], "anchor_text": "MG Road",
                      "search_error": None}

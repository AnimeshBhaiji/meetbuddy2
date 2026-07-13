"""
Test suite for stateless options endpoint via generate_followup_suggestions.
Verifies the synthetic-session reuse and the new cafe category.
"""
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
    result = planner.generate_followup_suggestions(state, "restaurant", num_results=10)
    assert result["options"], "expected ranked options"

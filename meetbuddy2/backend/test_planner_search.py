"""What counts as a usable result list, before and after ranking.

The fallback search exists for thin results, so "thin" has to be judged on
what the user will actually see: after the avoid list and already-picked
places are removed, not on the raw SerpAPI count.
"""
import planner

ORIGIN = {"lat": 12.9716, "lng": 77.5946}


def _near(pid, title):
    return {"place_id": pid, "title": title, "address": "MG Road", "type": "Restaurant",
            "rating": 4.4, "lat": ORIGIN["lat"], "lng": ORIGIN["lng"]}


def test_fallback_runs_when_avoid_list_empties_the_primary_search(monkeypatch):
    calls = []

    def fake_search(query, coords, radius_m):
        calls.append(query)
        if " in " in query:  # the broad fallback: "restaurants in <area>"
            return [_near(f"ok{i}", f"Garden Bistro {i}") for i in range(5)]
        # primary: six raw results, but five are on the avoid list
        return [_near(f"club{i}", f"Neon Club {i}") for i in range(5)] + [_near("keep", "Quiet Diner")]

    monkeypatch.setattr(planner, "search_places", fake_search)
    prefs = {"planningStyle": "Surprise me", "planningStyle_sub": {"sm_block": "club"}}
    result = planner.generate_initial_suggestions(
        {"preferences": prefs, "coords": ORIGIN, "location": "Indiranagar"})

    titles = [o["title"] for o in result["options"]]
    assert len(calls) == 2, f"fallback never ran: {calls}"
    assert not any("Club" in t for t in titles)
    assert len(titles) == 6


def test_followup_never_suggests_a_place_already_picked(monkeypatch):
    monkeypatch.setattr(planner, "search_places",
                        lambda q, c, r: [_near(f"p{i}", f"Cafe {i}") for i in range(8)])
    state = {"payload": {"preferences": {}, "coords": ORIGIN},
             "steps": [{"step": "restaurant", "place": _near("p1", "Cafe 1")}]}

    result = planner.generate_followup_suggestions(state, "cafe")

    ids = [o["place_id"] for o in result["options"]]
    assert "p1" not in ids
    assert len(ids) == 7

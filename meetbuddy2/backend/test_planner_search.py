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

    def fake_search(query, coords, radius_m, start=0):
        calls.append(query)
        if " in " in query:  # the broad fallback: "restaurants in <area>"
            return [_near(f"ok{i}", f"Garden Bistro {i}") for i in range(5)]
        # primary: six raw results, but five are on the avoid list
        return [_near(f"club{i}", f"Neon Club {i}") for i in range(5)] + [_near("keep", "Quiet Diner")]

    monkeypatch.setattr(planner, "search_places", fake_search)
    # a mood keeps the primary search distinct from the broad fallback
    prefs = {"mood": "Romantic", "planningStyle": "Surprise me", "planningStyle_sub": {"sm_block": "club"}}
    result = planner.generate_initial_suggestions(
        {"preferences": prefs, "coords": ORIGIN, "location": "Indiranagar"})

    titles = [o["title"] for o in result["options"]]
    assert len(calls) == 2, f"fallback never ran: {calls}"
    assert not any("Club" in t for t in titles)
    assert len(titles) == 6


def test_followup_never_suggests_a_place_already_picked(monkeypatch):
    monkeypatch.setattr(planner, "search_places",
                        lambda q, c, r, start=0: [_near(f"p{i}", f"Cafe {i}") for i in range(8)])
    state = {"payload": {"preferences": {}, "coords": ORIGIN},
             "steps": [{"step": "restaurant", "place": _near("p1", "Cafe 1")}]}

    result = planner.generate_followup_suggestions(state, "cafe")

    ids = [o["place_id"] for o in result["options"]]
    assert "p1" not in ids
    assert len(ids) == 7


def _club(i):
    return _near(f"club{i}", f"Neon Club {i}")


def test_second_page_of_the_broad_search_when_both_first_pages_stay_thin(monkeypatch):
    calls = []

    def fake_search(query, coords, radius_m, start=0):
        calls.append((query, start))
        if " in " in query and start == 20:  # page 2 of the broad fallback
            return [_near(f"ok{i}", f"Garden Bistro {i}") for i in range(6)]
        if start:
            return []
        return [_club(i) for i in range(20)]  # full first pages, every place avoided

    monkeypatch.setattr(planner, "search_places", fake_search)
    prefs = {"planningStyle": "Surprise me", "planningStyle_sub": {"sm_block": "club"}}
    result = planner.generate_initial_suggestions(
        {"preferences": prefs, "coords": ORIGIN, "location": "Indiranagar"})

    paged = [c for c in calls if c[1]]
    assert paged == [("restaurants in Indiranagar", 20)], calls
    assert len(result["options"]) == 6


def test_no_second_page_when_the_first_page_was_short(monkeypatch):
    calls = []

    def fake_search(query, coords, radius_m, start=0):
        calls.append((query, start))
        return [_club(i) for i in range(3)]  # a short page: there is nothing more to fetch

    monkeypatch.setattr(planner, "search_places", fake_search)
    prefs = {"planningStyle": "Surprise me", "planningStyle_sub": {"sm_block": "club"}}
    planner.generate_initial_suggestions(
        {"preferences": prefs, "coords": ORIGIN, "location": "Indiranagar"})

    assert all(start == 0 for _, start in calls), f"billed a second page that cannot exist: {calls}"


def _record_queries(monkeypatch, results=20):
    calls = []

    def fake_search(query, coords, radius_m, start=0):
        calls.append(query)
        return [_near(f"q{len(calls)}-{i}", f"Place {i}") for i in range(results)]

    monkeypatch.setattr(planner, "search_places", fake_search)
    return calls


def _first_query(monkeypatch, prefs):
    calls = _record_queries(monkeypatch)
    planner.generate_initial_suggestions({"preferences": prefs, "coords": ORIGIN, "location": "Indiranagar"})
    return calls[0].lower()


def test_planning_style_and_adventure_level_stay_out_of_the_search(monkeypatch):
    """"Full control" says how the user plans, not what the venue is; the
    adventure level is already the search radius."""
    q = _first_query(monkeypatch, {"mood": "Romantic", "planningStyle": "Full control",
                                   "adventureLevel": "Stick to the city"})
    assert q == "romantic restaurants near indiranagar", q


def test_same_mood_shares_one_search_across_planning_styles(monkeypatch):
    queries = {_first_query(monkeypatch, {"mood": "Business-y", "planningStyle": style})
               for style in ("Full control", "Semi-custom", "Surprise me")}
    assert len(queries) == 1, queries


def test_no_descriptive_words_means_a_single_broad_search(monkeypatch):
    # a thin page, so a second query would fire if the primary differed from the fallback
    calls = _record_queries(monkeypatch, results=2)
    planner.generate_initial_suggestions(
        {"preferences": {"planningStyle": "Surprise me"}, "coords": ORIGIN, "location": "Indiranagar"})
    assert calls == ["restaurants in Indiranagar"], calls

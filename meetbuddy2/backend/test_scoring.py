# Minimal checks for the ranking pipeline. Run: python -m pytest test_scoring.py -q
import scoring


def _place(title, **kw):
    p = {"place_id": title, "title": title, "address": "", "type": "", "rating": 4.0,
         "price": "", "description": "", "snippet": "", "reviews": [], "lat": None, "lng": None}
    p.update(kw)
    return p


NO_PREFS = {"labels_used": {"mood": []}, "prefs_data": {}, "directives": {"avoid_terms": [], "priorities": []}}


def rank(places, **kw):
    args = dict(NO_PREFS)
    args.update(kw)
    return scoring.rank_places(places, args["labels_used"], args["prefs_data"], args["directives"],
                               anchor_coords=kw.get("anchor_coords"), step=kw.get("step"))


def test_activity_filter_keeps_food_museum():
    places = [_place("Street Food Museum"), _place("Pasta Bistro Restaurant"), _place("City Bowling Arena")]
    titles = [p["title"] for p in rank(places, step="activity")]
    assert "Street Food Museum" in titles          # food word + activity signal -> kept
    assert "Pasta Bistro Restaurant" not in titles  # pure food -> dropped
    assert "City Bowling Arena" in titles


def test_avoid_list_drops_matches():
    places = [_place("Neon Night Club"), _place("Quiet Cafe")]
    d = {"avoid_terms": ["club"], "priorities": []}
    titles = [p["title"] for p in rank(places, directives=d)]
    assert titles == ["Quiet Cafe"]


def test_analyzer_boosts_matching_mood():
    romantic = _place("Skyline Terrace", description="romantic candlelight dinner with intimate ambiance for couples")
    plain = _place("Lunch Canteen", description="fast self service meals")
    ranked = rank([plain, romantic], labels_used={"mood": ["Romantic"]},
                  prefs_data={"mood": ["Romantic"]})
    assert ranked[0]["title"] == "Skyline Terrace"
    assert ranked[0]["score"] > ranked[1]["score"]


def test_distance_and_dedupe():
    near = _place("Near Spot", lat=12.9720, lng=77.5950)
    far = _place("Far Spot", lat=13.20, lng=77.90)
    dup = _place("Near Spot", lat=12.9720, lng=77.5950)
    ranked = rank([far, near, dup], anchor_coords=(12.9716, 77.5946))
    assert [p["title"] for p in ranked] == ["Near Spot", "Far Spot"]
    assert ranked[0]["distance_meters"] < 200


def test_budget_priority_uses_price():
    cheap = _place("Thrifty Thali", price="$")
    pricey = _place("Gold Leaf Dining", price="$$$$")
    d = {"avoid_terms": [], "priorities": ["budget"]}
    ranked = rank([pricey, cheap], directives=d)
    assert ranked[0]["title"] == "Thrifty Thali"

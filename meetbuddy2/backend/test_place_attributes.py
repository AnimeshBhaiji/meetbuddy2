"""Google already describes each place (SerpAPI `extensions`): atmosphere
"Romantic"/"Cozy"/"Quiet", offerings "Private dining room", highlights
"Rooftop seating", plus a review count. Ranking should use them."""
import scoring
import scraper


def _raw(**kw):
    """A local_results item shaped like SerpAPI's (fields from a live response)."""
    item = {"title": "Cafe Noir Indiranagar", "place_id": "noir", "rating": 4, "reviews": 1701,
            "type": "Cafe", "types": ["Cafe", "French restaurant"],
            "gps_coordinates": {"latitude": 12.97, "longitude": 77.64},
            "extensions": [{"atmosphere": ["Casual", "Cozy", "Romantic"]}, {"payments": ["Credit cards"]},
                           {"offerings": ["Vegan options", "Private dining room"]},
                           {"highlights": ["Rooftop seating"]}]}
    item.update(kw)
    return item


def test_parse_keeps_googles_attributes_types_and_review_count():
    p = scraper._parse_place(_raw())
    assert p["reviews_count"] == 1701
    assert p["types"] == ["Cafe", "French restaurant"]
    assert p["attributes"] == {"atmosphere": ["Casual", "Cozy", "Romantic"],
                               "offerings": ["Vegan options", "Private dining room"],
                               "highlights": ["Rooftop seating"]}  # payments etc. are not kept
    assert p["reviews"] == []  # still review texts, which local results don't include


def _place(title, rating=4.4, reviews=800, **attributes):
    return {"place_id": title, "title": title, "type": "Restaurant", "address": "", "rating": rating,
            "reviews_count": reviews, "description": "", "snippet": "", "reviews": [],
            "lat": None, "lng": None, "attributes": attributes}


def _rank(places, prefs):
    labels = {"mood": [prefs["mood"]]} if prefs.get("mood") else {}
    directives = {"avoid_terms": [], "priorities": [], "restaurant_terms": [], "activity_terms": []}
    return [p["title"] for p in scoring.rank_places(places, labels, prefs, directives)]


def test_googles_romantic_atmosphere_beats_a_slightly_better_rating():
    casual = _place("Plain Bistro", rating=4.5, atmosphere=["Casual"])
    romantic = _place("Noir", rating=4.3, atmosphere=["Romantic", "Cozy"])
    assert _rank([casual, romantic], {"mood": "Romantic"})[0] == "Noir"


def test_chill_and_relaxed_prefers_cozy_and_quiet_over_trendy():
    trendy = _place("Buzz", rating=4.5, atmosphere=["Trendy"])
    calm = _place("Nook", rating=4.4, atmosphere=["Cozy", "Quiet"])
    assert _rank([trendy, calm], {"mood": "Chill & Relaxed"})[0] == "Nook"


def test_rooftop_follow_up_prefers_rooftop_seating():
    indoor = _place("Cellar", atmosphere=["Romantic"])
    rooftop = _place("Skyline", atmosphere=["Romantic"], highlights=["Rooftop seating"])
    prefs = {"mood": "Romantic", "mood_sub": {"ro_setting": "Rooftop / alfresco"}}
    assert _rank([indoor, rooftop], prefs)[0] == "Skyline"


def test_a_few_perfect_reviews_do_not_beat_thousands_of_good_ones():
    hyped = _place("New Spot", rating=5.0, reviews=3)
    proven = _place("Institution", rating=4.6, reviews=3000)
    assert _rank([hyped, proven], {})[0] == "Institution"


def test_dietary_answer_prefers_places_that_serve_it():
    steakhouse = _place("Steak Co", rating=4.5, offerings=["Alcohol"])
    vegetarian = _place("Green Leaf", rating=4.3, offerings=["Vegetarian options", "Vegan options"])
    prefs = {"memorableFactor_sub": {"af_diet": "Vegetarian"}}
    assert _rank([steakhouse, vegetarian], prefs)[0] == "Green Leaf"


def test_dietary_options_chip_counts_a_vegetarian_restaurant_type():
    steakhouse = _place("Steak Co", rating=4.5, offerings=["Alcohol"])
    bhavan = _place("Pure Veg Bhavan", rating=4.3, offerings=["Quick bite"])
    bhavan["types"] = ["Vegetarian restaurant"]
    prefs = {"planningStyle_sub": {"fc_filters": ["Dietary options"]}}
    assert _rank([steakhouse, bhavan], prefs)[0] == "Pure Veg Bhavan"

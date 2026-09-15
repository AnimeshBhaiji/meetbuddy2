"""The activity and stay steps decide what a place is from Google's own type
("Cafe", "Museum", "Hotel"), not from words in its title or address. Measured on
the cache: 16 cafes and restaurants passed as activities because their address
said "park", "church" or "garden", or their name said "Lake" or "Beach"."""
import scoring


def _place(title, type_, address="", types=None):
    return {"place_id": title, "title": title, "type": type_, "types": types or [type_],
            "address": address, "rating": 4.4, "lat": None, "lng": None}


def _kept(places, step):
    return [p["title"] for p in scoring.filter_step_type(places, step)]


def test_food_places_are_not_activities_whatever_their_address_or_name_says():
    places = [
        _place("Trippy Goat Cafe", "Cafe", address="Park Rd, near St. Mark's Church"),
        _place("KAARA By The Lake", "Restaurant"),
        _place("Olive Beach", "Mediterranean restaurant"),
        _place("Toit", "Brewpub"),
    ]
    assert _kept(places, "activity") == []


def test_real_activities_stay_on_the_activity_step():
    places = [
        _place("Street Food Museum", "Museum"),
        _place("The Escape Hunt", "Tourist attraction", types=["Tourist attraction", "Escape room center"]),
        _place("Mystery Rooms", "Amusement center"),
        _place("Loft 38", "Night club"),
        _place("Cafe inside the zoo", "Cafe", types=["Cafe", "Zoo"]),  # food and an activity: kept
    ]
    assert _kept(places, "activity") == [p["title"] for p in places]


def test_a_restaurant_called_hotel_is_not_a_place_to_stay():
    places = [
        _place("Sri Krishna Hotel", "South Indian restaurant"),
        _place("Taj MG Road", "Hotel"),
        _place("Hill View Homestay", "Home Stay"),
    ]
    assert _kept(places, "stay") == ["Taj MG Road", "Hill View Homestay"]


def test_park_in_the_address_earns_no_activity_bonus():
    """Neither place is food, so both stay on the activity step; only one has
    "park" in its address, and that is no reason to rank it higher."""
    on_park_road = _place("City Walks", "Tour operator", address="12 Park Road")
    elsewhere = _place("Town Walks", "Tour operator", address="12 Main Road")
    ranked = scoring.rank_places([on_park_road, elsewhere], {"mood": []}, {},
                                 {"avoid_terms": [], "priorities": []}, step="activity")
    scores = {p["title"]: p["score"] for p in ranked}
    assert scores["City Walks"] == scores["Town Walks"], scores

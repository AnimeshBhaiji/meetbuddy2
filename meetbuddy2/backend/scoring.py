# scoring.py — the full local ranking pipeline. Everything here runs on data
# already inside a SerpAPI result (title, description, snippet, reviews),
# so personalization costs zero API credits.
import re
from math import atan2
from typing import Any, Dict, List, Optional, Tuple

from geo import haversine_meters
from place_analyzer import analyze_mood_fit, analyze_stage2_preferences, detect_atmosphere

AMBIENCE_KEYWORDS = ("rooftop", "garden", "lounge", "aesthetic", "cozy", "scenic", "terrace", "courtyard")

FOOD_KEYWORDS = ("restaurant", "cafe", "bar", "diner", "bistro", "eatery", "food")
STAY_KEYWORDS = ("hotel", "resort", "lodge", "homestay", "guest house")
ACTIVITY_KEYWORDS = (
    "park", "playground", "attraction", "museum", "zoo", "aquarium", "garden",
    "scenic", "viewpoint", "monument", "temple", "church", "beach", "lake",
    "escape room", "escape", "bowling", "go kart", "gokart", "karting",
    "arcade", "laser tag", "paintball", "trampoline", "adventure",
    "activity", "activities", "entertainment", "recreation",
    "sports", "game", "games", "cinema", "theater", "theatre", "stadium", "arena", "club",
    "billiards", "snooker", "mini golf", "golf", "ice skating", "roller skating",
    "skating", "rock climbing", "bungee", "zipline", "theme park",
)

# What Google says a place is (its `type` and `types`, e.g. "Cafe", "Museum",
# "Hotel"), matched as whole words. Titles and addresses are no evidence: a cafe
# on Park Road is not a park, and "Sri Krishna Hotel" is usually a restaurant.
# The *_KEYWORDS text checks above remain only for places Google gave no type.
FOOD_TYPES = (
    "restaurant", "cafe", "café", "coffee", "bar", "pub", "brewpub", "brewery", "bakery",
    "patisserie", "bistro", "diner", "deli", "dhaba", "eatery", "food court", "tea house",
    "snack", "dessert", "juice", "sandwich", "pizza", "ice cream", "bubble tea", "takeaway", "canteen",
)
ACTIVITY_TYPES = (
    "attraction", "park", "museum", "gallery", "zoo", "aquarium", "amusement", "recreation",
    "escape room", "bowling", "arcade", "cinema", "movie theater", "theatre", "theater", "stadium",
    "sports", "adventure", "hiking", "camping", "garden", "lake", "beach", "monument", "landmark",
    "temple", "church", "club", "live music venue", "event venue", "trampoline", "karting",
    "paintball", "laser tag", "golf", "skating", "playground", "planetarium", "observation deck",
)
STAY_TYPES = (
    "hotel", "resort", "lodge", "homestay", "home stay", "guest house", "bed & breakfast",
    "holiday home", "hostel", "serviced apartment", "inn",
)

# Google's own attributes for a place (scraper ATTRIBUTE_GROUPS), per mood:
# (strong — the atmosphere Google says the place has, supporting — fits the mood).
MOOD_ATTRIBUTES = {
    "Romantic": ({"romantic"},
                 {"cozy", "upmarket", "quiet", "private dining room", "rooftop seating", "great wine list"}),
    "Chill & Relaxed": ({"cozy", "quiet"},
                        {"casual", "outdoor seating", "great coffee", "good for working on laptop"}),
    "Business-y": ({"quiet", "upmarket"}, {"good for working on laptop", "private dining room"}),
    "Fun & Energetic": ({"trendy"}, {"groups", "cocktails", "happy-hour drinks", "late-night food", "live music"}),
}
# Follow-up answers (lowercase fragment of the answer) -> attributes that satisfy them.
FOLLOW_UP_ATTRIBUTES = {
    "candlelit": {"romantic", "cozy", "quiet"},
    "rooftop": {"rooftop seating", "outdoor seating"},
    "alfresco": {"outdoor seating", "rooftop seating"},
    "cozy caf": {"cozy"},
    "private area": {"private dining room"},
    "private seating": {"private dining room"},
    "formal (": {"upmarket", "quiet"},
    "quiet & intimate": {"quiet", "cozy", "romantic"},
    "live music": {"live music"},
}
MOOD_ATTRIBUTE_STRONG = 1.5      # about one star of rating
MOOD_ATTRIBUTE_SUPPORTING = 0.5  # per supporting attribute, at most two
FOLLOW_UP_ATTRIBUTE = 1.0        # per follow-up answer the place satisfies

RATING_PRIOR = 4.0          # what a place with few reviews is assumed to be rated
RATING_PRIOR_REVIEWS = 50   # reviews before a place's own rating dominates


def _text(place: Dict[str, Any]) -> str:
    return " ".join(
        str(place.get(k) or "") for k in ("title", "type", "address")
    ).lower()


def place_key(p: Dict[str, Any]) -> str:
    return p.get("place_id") or (p.get("title") or "") + "::" + (p.get("address") or "")


def dedupe_places(places: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for p in places:
        key = place_key(p)
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


def tag_place_minimal(place: Dict[str, Any], txt: Optional[str] = None) -> List[str]:
    txt = _text(place) if txt is None else txt
    tags = []
    if "park" in txt or "garden" in txt:
        tags.append("outdoor")
    if any(k in txt for k in STAY_KEYWORDS):
        tags.append("stay")
    if any(k in txt for k in ("cafe", "restaurant", "diner")):
        tags.append("food")
    return tags


def filter_avoided(places: List[Dict[str, Any]], avoid_terms: List[str]) -> List[Dict[str, Any]]:
    """Drop venues whose title/type matches any avoid-list token."""
    if not avoid_terms:
        return places
    return [
        p for p in places
        if not any(term in f"{p.get('title', '')} {p.get('type', '')}".lower() for term in avoid_terms)
    ]


def _type_words(place: Dict[str, Any]) -> Optional[str]:
    """Google's type labels for a place, lowercased; None when it has none."""
    labels = [place.get("type") or ""] + [str(t) for t in place.get("types") or []]
    return " | ".join(label for label in labels if label).lower() or None


def _matches(labels: str, words) -> bool:
    return any(re.search(rf"\b{re.escape(w)}s?\b", labels) for w in words)


def _is_activity(place: Dict[str, Any], txt: str) -> bool:
    labels = _type_words(place)
    if labels is None:  # no type from Google (e.g. organic results): read the text
        return any(k in txt for k in ACTIVITY_KEYWORDS)
    return _matches(labels, ACTIVITY_TYPES)


def filter_step_type(places: List[Dict[str, Any]], step: Optional[str]) -> List[Dict[str, Any]]:
    """Keep venues appropriate for the step. A venue is excluded from the
    activity (or stay) step only when it is food AND not also an activity (or
    stay), judged from Google's type labels — so a "Museum" whose name mentions
    food survives and a "Cafe" on Park Road doesn't."""
    if step not in ("activity", "stay"):
        return places
    step_types, step_keywords = (ACTIVITY_TYPES, ACTIVITY_KEYWORDS) if step == "activity" else (STAY_TYPES, STAY_KEYWORDS)
    kept = []
    for p in places:
        labels = _type_words(p)
        if labels is not None:
            is_food, fits_step = _matches(labels, FOOD_TYPES), _matches(labels, step_types)
        else:  # no type from Google: fall back to the text
            txt = _text(p)
            is_food, fits_step = any(k in txt for k in FOOD_KEYWORDS), any(k in txt for k in step_keywords)
        if is_food and not fits_step:
            continue
        kept.append(p)
    return kept


def usable_places(places: List[Dict[str, Any]], step: Optional[str] = None,
                  avoid_terms: Optional[List[str]] = None,
                  exclude_keys=()) -> List[Dict[str, Any]]:
    """The venues a user could actually be shown: deduped, minus places already
    picked this plan, wrong for the step, or on the avoid list."""
    places = dedupe_places(places)
    if exclude_keys:
        places = [p for p in places if place_key(p) not in exclude_keys]
    places = filter_step_type(places, step)
    return filter_avoided(places, avoid_terms or [])


def _effective_rating(place: Dict[str, Any]) -> float:
    """Rating pulled toward RATING_PRIOR until a place has enough reviews, so
    5.0 from 3 reviews doesn't outrank 4.6 from 3,000. Results cached before
    review counts were kept use their rating as is."""
    try:
        rating = float(place.get("rating") or 0)
    except (TypeError, ValueError):
        return 0.0
    count = place.get("reviews_count")
    if not rating or type(count) is not int:
        return rating
    return (rating * count + RATING_PRIOR * RATING_PRIOR_REVIEWS) / (count + RATING_PRIOR_REVIEWS)


def _follow_up_answers(prefs_data: Dict[str, Any]) -> List[str]:
    answers = []
    for category in ("mood", "planningStyle", "memorableFactor"):
        sub = prefs_data.get(f"{category}_sub")
        if isinstance(sub, dict):
            for value in sub.values():
                answers.extend(value if isinstance(value, list) else [value])
    return [str(a).lower() for a in answers if a]


def _attribute_score(place: Dict[str, Any], labels_used: Dict[str, List[str]],
                     prefs_data: Dict[str, Any]) -> float:
    """How well Google's own attributes for the place fit the user's answers."""
    have = {str(v).lower() for values in place["attributes"].values() for v in values}
    score = 0.0
    for mood in labels_used.get("mood", []):
        strong, supporting = MOOD_ATTRIBUTES.get(mood, (set(), set()))
        if have & strong:
            score += MOOD_ATTRIBUTE_STRONG
        score += MOOD_ATTRIBUTE_SUPPORTING * min(len(have & supporting), 2)
    for answer in _follow_up_answers(prefs_data):
        wanted = set().union(*(attrs for fragment, attrs in FOLLOW_UP_ATTRIBUTES.items() if fragment in answer))
        if have & wanted:
            score += FOLLOW_UP_ATTRIBUTE
    return score


def _base_score(place: Dict[str, Any], txt: str, wants_music: bool, wants_escape: bool) -> float:
    score = max(0.0, _effective_rating(place) - 3.0) * 1.5
    if wants_music and ("music" in txt or "live" in txt):
        score += 1.0
    if wants_escape and ("resort" in txt or "getaway" in txt):
        score += 1.2
    return score


def _distance_boost(base_score: float, distance_m: float, is_weekend_escape: bool = False) -> float:
    if is_weekend_escape:
        if distance_m <= 1000:
            base_score -= 0.3
        elif 2000 <= distance_m <= 8000:
            base_score += 0.8
        elif distance_m > 12000:
            base_score -= 0.4
    else:
        if distance_m <= 500:
            base_score += 2.0
        elif distance_m <= 1000:
            base_score += 1.0
        elif distance_m <= 2000:
            base_score += 0.5
    return base_score


def _apply_priority_weights(place: Dict[str, Any], base_score: float, priorities: List[str]) -> float:
    """Re-weight by the user's surprise-mode priorities."""
    if not priorities:
        return base_score
    joined = " ".join(priorities)
    if "food quality" in joined:
        rating = _effective_rating(place)
        if rating:
            base_score += (rating - 4.0) * 1.5
    if "distance" in joined:
        dist = place.get("distance_meters")
        if dist is not None:
            base_score += 1.0 if dist <= 1000 else 0.5 if dist <= 2500 else -0.3
    if "budget" in joined:
        price = str(place.get("price") or "")
        if price:
            base_score += 0.4 if len(price) <= 2 else -0.8
    if "ambience" in joined:
        if any(k in str(place.get("title") or "").lower() for k in AMBIENCE_KEYWORDS):
            base_score += 0.5
    return base_score


def _analyzer_score(place: Dict[str, Any], prefs_data: Dict[str, Any],
                    labels_used: Dict[str, List[str]], directives: Dict[str, Any]) -> float:
    """place_analyzer signals: mood fit, atmosphere-directive matching,
    stage-2 compatibility. All free — the data is already in the result."""
    score = 0.0

    raw_sub = prefs_data.get("mood_sub") or prefs_data.get("moodSub")
    mood_sub = raw_sub if isinstance(raw_sub, dict) else {}
    for mood in labels_used.get("mood", []):
        fit = analyze_mood_fit(place, mood, mood_sub)
        score += min(fit["mood_match_score"], 4) * 0.5

    atm = detect_atmosphere(place)
    flavor = " ".join(directives.get("restaurant_terms", []) + directives.get("activity_terms", [])).lower()
    if atm["is_rooftop"] and "rooftop" in flavor:
        score += 0.6
    if atm["has_view"] and ("view" in flavor or "scenic" in flavor):
        score += 0.6
    if atm["has_live_music"] and ("music" in flavor or "dj" in flavor):
        score += 0.6
    if atm["is_quiet"] and "quiet" in flavor:
        score += 0.6

    stage2 = analyze_stage2_preferences(place, prefs_data)
    score += stage2["compatibility_score"] * 0.7
    return score


def _sector_diversify(places: List[Dict[str, Any]], center: Tuple[float, float],
                      target_len: int) -> List[Dict[str, Any]]:
    """Weekend escapes: round-robin across 8 compass sectors so options
    aren't clustered on one side of the city."""
    buckets = {i: [] for i in range(8)}
    for pl in places:
        try:
            angle = atan2(float(pl["lat"]) - center[0], float(pl["lng"]) - center[1])
            idx = int(((angle + 3.14159265) / (2 * 3.14159265)) * 8) % 8
        except Exception:
            idx = 0
        buckets[idx].append(pl)
    balanced = []
    while len(balanced) < target_len:
        added = False
        for i in range(8):
            if buckets[i]:
                balanced.append(buckets[i].pop(0))
                added = True
                if len(balanced) >= target_len:
                    break
        if not added:
            break
    return balanced or places


def rank_places(
    places: List[Dict[str, Any]],
    labels_used: Dict[str, List[str]],
    prefs_data: Dict[str, Any],
    directives: Dict[str, Any],
    anchor_coords: Optional[Tuple[float, float]] = None,
    step: Optional[str] = None,
    is_weekend_escape: bool = False,
    diversify_target: int = 0,
    exclude_keys=(),
) -> List[Dict[str, Any]]:
    """The full pipeline: usable_places (dedupe, already-picked, step, avoid
    filters) -> score -> sort (-> optional weekend sector diversification).
    Mutates places in-place (tags / distance_meters / score) and returns the
    ranked list."""
    places = usable_places(places, step, directives.get("avoid_terms"), exclude_keys)

    # The user's labels don't change between places: read them once per ranking.
    all_labels = [s.lower() for lst in labels_used.values() for s in lst]
    wants_music = any("music" in s for s in all_labels)
    wants_escape = any("weekend" in s or "escape" in s for s in all_labels)

    for p in places:
        txt = _text(p)  # once per place; tagging, base score and the activity bonus share it
        p["tags"] = tag_place_minimal(p, txt)
        score = _base_score(p, txt, wants_music, wants_escape)

        if step == "activity" and _is_activity(p, txt):
            score += 1.5

        if anchor_coords and p.get("lat") is not None and p.get("lng") is not None:
            try:
                d = haversine_meters(anchor_coords[0], anchor_coords[1], float(p["lat"]), float(p["lng"]))
                p["distance_meters"] = d
                score = _distance_boost(score, d, is_weekend_escape=is_weekend_escape)
            except Exception:
                pass

        score = _apply_priority_weights(p, score, directives.get("priorities", []))
        # Google's own description of the place when the search returned one;
        # keyword guessing only for results cached before attributes were kept.
        if p.get("attributes"):
            score += _attribute_score(p, labels_used, prefs_data)
        else:
            score += _analyzer_score(p, prefs_data, labels_used, directives)
        p["score"] = round(score, 3)

    ranked = sorted(places, key=lambda x: (
        -x.get("score", 0),
        x.get("distance_meters") if x.get("distance_meters") is not None else float("inf"),
    ))

    if is_weekend_escape and anchor_coords and diversify_target and ranked:
        ranked = _sector_diversify(ranked, anchor_coords, diversify_target)
    return ranked

# scoring.py — the full local ranking pipeline. Everything here runs on data
# already inside a SerpAPI result (title, description, snippet, reviews),
# so personalization costs zero API credits.
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


def _text(place: Dict[str, Any]) -> str:
    return " ".join(
        str(place.get(k) or "") for k in ("title", "type", "address")
    ).lower()


def dedupe_places(places: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for p in places:
        key = p.get("place_id") or (p.get("title") or "") + "::" + (p.get("address") or "")
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


def tag_place_minimal(place: Dict[str, Any]) -> List[str]:
    txt = _text(place)
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


def filter_step_type(places: List[Dict[str, Any]], step: Optional[str]) -> List[Dict[str, Any]]:
    """Keep venues appropriate for the step. A venue is excluded from the
    activity step only when food signals are present AND no activity signal is
    (so "Street Food Museum" survives, "Pasta Bistro" doesn't)."""
    if step == "activity":
        return [
            p for p in places
            if not (any(k in _text(p) for k in FOOD_KEYWORDS)
                    and not any(k in _text(p) for k in ACTIVITY_KEYWORDS))
        ]
    if step == "stay":
        return [
            p for p in places
            if not (any(k in _text(p) for k in FOOD_KEYWORDS)
                    and not any(k in _text(p) for k in STAY_KEYWORDS))
        ]
    return places


def _base_score(place: Dict[str, Any], labels_used: Dict[str, List[str]]) -> float:
    score = 0.0
    try:
        score += max(0.0, (float(place.get("rating", 0)) - 3.0)) * 1.5
    except Exception:
        pass
    txt = _text(place)
    all_labels = [s.lower() for lst in labels_used.values() for s in lst]
    if any("music" in s for s in all_labels) and ("music" in txt or "live" in txt):
        score += 1.0
    if any("weekend" in s or "escape" in s for s in all_labels) and ("resort" in txt or "getaway" in txt):
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
        try:
            rating = float(place.get("rating") or 0)
            if rating:
                base_score += (rating - 4.0) * 1.5
        except Exception:
            pass
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
) -> List[Dict[str, Any]]:
    """The full pipeline: dedupe -> step filter -> avoid filter -> score -> sort
    (-> optional weekend sector diversification). Mutates places in-place
    (tags / distance_meters / score) and returns the ranked list."""
    places = dedupe_places(places)
    places = filter_step_type(places, step)
    places = filter_avoided(places, directives.get("avoid_terms", []))

    for p in places:
        p["tags"] = tag_place_minimal(p)
        score = _base_score(p, labels_used)

        if step == "activity" and any(k in _text(p) for k in ACTIVITY_KEYWORDS):
            score += 1.5

        if anchor_coords and p.get("lat") is not None and p.get("lng") is not None:
            try:
                d = haversine_meters(anchor_coords[0], anchor_coords[1], float(p["lat"]), float(p["lng"]))
                p["distance_meters"] = d
                score = _distance_boost(score, d, is_weekend_escape=is_weekend_escape)
            except Exception:
                pass

        score = _apply_priority_weights(p, score, directives.get("priorities", []))
        score += _analyzer_score(p, prefs_data, labels_used, directives)
        p["score"] = round(score, 3)

    ranked = sorted(places, key=lambda x: (
        -x.get("score", 0),
        x.get("distance_meters") if x.get("distance_meters") is not None else float("inf"),
    ))

    if is_weekend_escape and anchor_coords and diversify_target and ranked:
        ranked = _sector_diversify(ranked, anchor_coords, diversify_target)
    return ranked

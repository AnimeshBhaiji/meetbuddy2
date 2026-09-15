# planner.py — orchestration only. Questionnaire logic lives in directives.py,
# ranking in scoring.py, fetching+caching in scraper.py, geo helpers in geo.py.
#
# Credit budget: ONE cached SerpAPI search per step, plus ONE broad fallback
# only when the primary search comes back thin (<5 usable results), plus ONE
# second page only when both are still thin and a second page can exist.
import logging
from typing import Any, Dict, List, Optional, Tuple

from directives import (
    _build_search_directives,
    _prioritize_types,
    determine_flow_from_preferences,
    normalize_to_labels,
    select_place_types,
    short_query_from_selected,
)
from geo import geocode_address, haversine_meters, normalize_coords, reverse_geocode_to_text
from scoring import place_key, rank_places, usable_places
from scraper import search_places

logger = logging.getLogger(__name__)

MIN_USABLE_RESULTS = 5  # below this, fire the single broad fallback
PAGE_SIZE = 20  # SerpAPI google_maps results per page; also the offset of page 2

# Food searches never say "restaurant". Google Maps drops its place attributes
# (atmosphere, crowd, offerings, highlights) from results whenever the search
# contains the word — measured near Indiranagar: 0/20 results tagged for
# "candlelight dinner restaurants", 19/20 for "candlelight dinner", and 0/20 for
# "restaurants" against 19/20 for "places to eat". Ranking relies on those tags.
FOOD_SEARCH_NOUN = "places to eat"
FOOD_WORDS = ("dinner", "dining", "food", "cafe", "café", "brunch", "lunch", "breakfast", FOOD_SEARCH_NOUN)

PLACE_TYPE_NAMES = {
    "restaurant": FOOD_SEARCH_NOUN,
    "cafe": "cafes",
    "park": "parks",
    "tourist_attraction": "attractions",
    "hotel": "hotels",
    "activity": "things to do",
}


def _food_query(words: str) -> str:
    """A food search without "restaurant": the words alone when they already name
    food ("candlelight dinner"), otherwise followed by "places to eat"."""
    if not words:
        return FOOD_SEARCH_NOUN
    return words if any(w in words.lower() for w in FOOD_WORDS) else f"{words} {FOOD_SEARCH_NOUN}"

STEP_TYPES = {
    "restaurant": ["restaurant", "cafe", "bar"],
    "cafe": ["cafe", "bakery"],
    "activity": [
        "tourist_attraction", "park", "amusement_park", "play_area", "scenic",
        "escape_room", "bowling", "go_karting", "arcade", "laser_tag",
        "paintball", "trampoline", "adventure_sports", "indoor_activities",
    ],
    "stay": ["hotel", "resort"],
}


def _is_coord_string(s: Optional[str]) -> bool:
    """Detect a string like 'Lat 12.95' to avoid using it verbatim in queries."""
    if not s or not isinstance(s, str):
        return False
    return s.strip().lower().startswith("lat ") or ("lat " in s.lower() and "lng" in s.lower())


def _labels_used(prefs: Dict[str, Any]) -> Dict[str, List[str]]:
    return {
        cat: normalize_to_labels(cat, prefs.get(cat))
        for cat in ("mood", "planningStyle", "adventureLevel", "addOnMagic", "memorableFactor")
    }


def _step_flavor(directives: Dict[str, Any], place_type: Optional[str]) -> str:
    """Pick the flavor terms matching a step's place type."""
    if place_type in ("hotel", "resort", "lodging"):
        terms = directives.get("stay_terms") or []
    elif place_type in ("restaurant", "cafe", "bar", "club") or place_type is None:
        terms = directives.get("restaurant_terms") or []
    else:
        terms = directives.get("activity_terms") or []
    return " ".join(terms[:2])


def _filter_radius(places: List[Dict[str, Any]], anchor: Optional[Tuple[float, float]],
                   radius_m: Optional[float]) -> List[Dict[str, Any]]:
    """Drop places with coords beyond the radius; keep coordless ones (marked)."""
    if not anchor or not radius_m:
        return places
    kept = []
    for p in places:
        if p.get("lat") is not None and p.get("lng") is not None:
            try:
                d = haversine_meters(anchor[0], anchor[1], float(p["lat"]), float(p["lng"]))
                if d > radius_m:
                    continue
                p["distance_meters"] = d
            except Exception:
                p["distance_meters"] = None
        else:
            p["distance_meters"] = None
        kept.append(p)
    return kept


def _search_step(primary_q: str, fallback_q: Optional[str],
                 coords: Optional[Tuple[float, float]], radius_m: Optional[float],
                 search_errors: List[str], usable=None) -> List[Dict[str, Any]]:
    """One cached search; one broad fallback only if results are thin; then one
    second page only if still thin.

    `usable` narrows the results to what the user would actually be shown.
    Thin is judged on that — six raw results with five on the avoid list is
    one usable result, and it must still trigger the fallback."""
    options: List[Dict[str, Any]] = []

    def enough():
        return len(usable(options) if usable else options) >= MIN_USABLE_RESULTS

    def fetch(q, start=0):
        """Returns how many raw results the page held (0 on failure)."""
        try:
            fetched = [dict(p) for p in search_places(q, coords, radius_m, start=start)]
        except Exception as e:
            logger.warning("place search failed for %r (start=%d): %s", q, start, e)
            search_errors.append(str(e))
            return 0
        options.extend(_filter_radius(fetched, coords, radius_m))
        return len(fetched)

    queries = [primary_q]
    if fallback_q and fallback_q != primary_q:
        queries.append(fallback_q)
    full_first_pages = []
    for q in queries:
        if fetch(q) >= PAGE_SIZE:
            full_first_pages.append(q)
        if enough():
            return options

    # Still thin (typically a strict avoid list). Page 2 of the broadest query
    # that filled its first page; a short first page means there is no page 2,
    # so no credit is spent asking for one.
    if full_first_pages:
        fetch(full_first_pages[-1], start=PAGE_SIZE)
    return options


def generate_initial_suggestions(payload: Dict[str, Any], num_results: int = 15):
    prefs_data = payload.get("preferences", {}) or {}
    location_hint = payload.get("location")
    coords_tuple = normalize_coords(payload.get("coords"))
    coords_are_exact = coords_tuple is not None  # sent by the client (GPS), not geocoded

    # Textual location but no coords -> geocode it (cached)
    if location_hint and not coords_tuple and not _is_coord_string(location_hint):
        coords_tuple = geocode_address(location_hint)

    loc_text_for_display = location_hint
    if coords_tuple and not location_hint:
        loc_text_for_display = reverse_geocode_to_text({"lat": coords_tuple[0], "lng": coords_tuple[1]})
    loc_text_for_query = location_hint if (location_hint and not _is_coord_string(location_hint)) else ""

    labels_used = _labels_used(prefs_data)
    directives = _build_search_directives(prefs_data)

    # Stage-2 "No stay" opt-out + weekend-escape detection
    adv_sub_labels = normalize_to_labels(
        "adventureLevel", prefs_data.get("adventureLevel_sub") or prefs_data.get("adventureLevelSub")
    )
    explicit_no_stay = any("no" in s.lower() for s in adv_sub_labels if isinstance(s, str))
    is_weekend_escape = any(
        "weekend escape" in s.lower()
        for s in (labels_used["adventureLevel"] or []) + (adv_sub_labels or [])
        if isinstance(s, str)
    )

    # Display tokens (max 3)
    tokens = []
    for cat in ("mood", "planningStyle", "adventureLevel", "addOnMagic", "memorableFactor"):
        for v in labels_used.get(cat) or []:
            if len(tokens) >= 3:
                break
            tokens.append({"category": cat, "label": v, "phrase": v})
        if len(tokens) >= 3:
            break
    # Only the mood describes a venue. Planning style ("Full control", "Surprise
    # me") is about how the user plans and adventure level is already the radius;
    # sent to SerpAPI they added noise and split the cache per planning style.
    mood_tokens = [t for t in tokens if t["category"] == "mood"]
    short_q = short_query_from_selected(mood_tokens) if mood_tokens else ""

    place_types = _prioritize_types(select_place_types(labels_used))
    top_type = place_types[0] if place_types else "restaurant"
    top_name = PLACE_TYPE_NAMES.get(top_type, top_type)

    # ONE preference-flavored query (+ conditional broad fallback)
    flavor = _step_flavor(directives, top_type)
    if top_type == "restaurant":
        lead_q = _food_query(flavor or short_q)
    elif flavor:
        # don't produce "cozy cafes cafes"
        lead_q = flavor if top_name.lower() in flavor.lower() else f"{flavor} {top_name}"
    else:
        lead_q = f"{short_q} {top_name}".strip()
    if loc_text_for_query:
        fallback_q = f"{top_name} in {loc_text_for_query}"
        # With no descriptive words the lead query is the broad one: send it once,
        # not as "places to eat near X" and then again as "places to eat in X".
        primary_q = f"{lead_q} near {loc_text_for_query}" if lead_q != top_name else fallback_q
    else:
        primary_q = lead_q
        fallback_q = top_name

    radius_m = directives["radius_m"]
    search_errors: List[str] = []
    avoid_terms = directives.get("avoid_terms")
    options = _search_step(primary_q, fallback_q, coords_tuple, radius_m, search_errors,
                           usable=lambda opts: usable_places(opts, avoid_terms=avoid_terms))

    ranked = rank_places(
        options, labels_used, prefs_data, directives,
        anchor_coords=coords_tuple,
        is_weekend_escape=is_weekend_escape,
        diversify_target=max(num_results, 20),
    )

    display_q = ", ".join(t["label"] for t in tokens) or short_q
    display_location = loc_text_for_display or loc_text_for_query or None
    if display_location:
        display_q = f"{display_q} near {display_location}"

    recommended_flow = determine_flow_from_preferences(labels_used)
    if explicit_no_stay and "stay" in recommended_flow:
        recommended_flow = [s for s in recommended_flow if s != "stay"]

    result = {
        "display_query": display_q,
        "short_query": short_q,
        "labels_used": labels_used,
        "selected_tokens": tokens,
        "place_types": place_types,
        "options": ranked[: max(num_results, 20)],
        "location_hint": loc_text_for_display or "",
        # Where the search started, for the map: exact when the client sent
        # coordinates, approximate when they came from geocoding the typed place.
        "origin": ({"lat": coords_tuple[0], "lng": coords_tuple[1], "exact": coords_are_exact,
                    "label": loc_text_for_display or ""} if coords_tuple else None),
        "recommended_flow": recommended_flow,
        "plan_mode": directives["plan_mode"],
        "directives": directives,
    }
    if not result["options"] and search_errors:
        result["search_error"] = search_errors[-1]
    return result


def generate_followup_suggestions(session_state: Dict[str, Any], next_step: str, num_results: int = 15):
    if not session_state:
        raise ValueError("missing session state")

    payload = session_state.get("payload", {})
    prefs = payload.get("preferences", {}) or {}
    steps = session_state.get("steps", []) or []
    last = steps[-1] if steps else None

    # Anchor on the last selected place, else the session origin
    anchor_text = None
    anchor_coords = None
    if last and last.get("place"):
        pl = last["place"]
        anchor_text = pl.get("address") or pl.get("title") or pl.get("name")
        anchor_coords = normalize_coords({"lat": pl.get("lat"), "lng": pl.get("lng")})
    if not anchor_text:
        anchor_text = payload.get("location") or (
            reverse_geocode_to_text(payload.get("coords")) if payload.get("coords") else None
        )
    if not anchor_coords:
        anchor_coords = normalize_coords(payload.get("coords"))

    labels_used = _labels_used(prefs)
    directives = _build_search_directives(prefs)

    # Follow-up steps stay near the anchor regardless of adventure level
    followup_radius = None
    if anchor_coords:
        followup_radius = max(min(directives["radius_m"], 10000), 2500)

    desired_types = STEP_TYPES.get(next_step) or select_place_types(labels_used)
    if next_step not in STEP_TYPES:
        desired_types = _prioritize_types(desired_types)

    # ONE step-flavored query (+ conditional broad fallback)
    if next_step == "activity":
        flavor = " ".join((directives.get("activity_terms") or [])[:2])
        primary_q, fallback_q = flavor or "things to do", "things to do"
    elif next_step == "stay":
        flavor = " ".join((directives.get("stay_terms") or [])[:2])
        primary_q, fallback_q = (f"{flavor} hotels".strip() if flavor else "hotels"), "hotels and resorts"
    elif next_step == "cafe":
        flavor = " ".join((directives.get("restaurant_terms") or [])[:2])
        primary_q = f"{flavor} cafes".strip() if flavor else "cafes"
        fallback_q = "cafes and bakeries"
    else:
        flavor = " ".join((directives.get("restaurant_terms") or [])[:2])
        primary_q = _food_query(flavor)
        fallback_q = FOOD_SEARCH_NOUN

    search_errors: List[str] = []
    # Never offer a place already in this plan (the cafe step used to list the
    # restaurant just picked).
    picked = {place_key(s["place"]) for s in steps if s.get("place")}
    avoid_terms = directives.get("avoid_terms")
    fetched = _search_step(
        primary_q, fallback_q, anchor_coords, followup_radius, search_errors,
        usable=lambda opts: usable_places(opts, next_step, avoid_terms, picked))

    ranked = rank_places(
        fetched, labels_used, prefs, directives,
        anchor_coords=anchor_coords, step=next_step, exclude_keys=picked,
    )

    result = {
        "anchor_text": anchor_text,
        "next_step": next_step,
        "options": ranked[:num_results],
        "desired_types": desired_types,
    }
    if not result["options"] and search_errors:
        result["search_error"] = search_errors[-1]
    return result

# planner.py
import json
import os
import re
import traceback
import urllib.parse
import requests
from fastapi import HTTPException
from math import radians, sin, cos, sqrt, atan2
from typing import Any, Dict, List, Optional, Tuple

from scraper import get_places
from planner_sessions import create_session, get_session, push_selection, set_last_options

_ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PREFERENCES_FILE = os.path.join(_ROOT_DIR, "preferences.json")
USER_PREFS_FILE = os.path.join(_ROOT_DIR, "user_last_prefs.json")

# Load preferences mapping (id -> label) if present
if os.path.exists(PREFERENCES_FILE):
    try:
        with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
            PREFERENCES = json.load(f)
    except Exception:
        PREFERENCES = {}
else:
    PREFERENCES = {}

CATEGORY_PRIORITY = ["mood", "planningStyle", "adventureLevel", "memorableFactor", "addOnMagic"]

LABEL_TO_PLACE_TYPES = {
    "Weekend escape": ["hotel", "resort", "tourist_attraction"],
    "Stick to the city": ["restaurant", "cafe", "park", "bar"],
    "Short drive to hidden gem": ["tourist_attraction", "park", "restaurant"],
    "Fun & Energetic": ["bar", "club", "restaurant"],
    "Chill & Relaxed": ["cafe", "park", "co_working"],
    "Romantic": ["restaurant", "hotel", "rooftop", "scenic"],
    "Family": ["play_area", "park", "museum"],
}


# ----------------- Normalization helpers -----------------
def normalize_to_labels(category: str, items) -> List[str]:
    if items is None:
        return []
    if isinstance(items, dict):
        out = []
        for k, v in items.items():
            if v is True or v == "true" or v == 1:
                out.append(str(k).strip())
            elif isinstance(v, str) and v.strip():
                out.append(v.strip())
        items = out
    if isinstance(items, (str, int, float)):
        s = str(items).strip()
        if s == "":
            return []
        if "," in s:
            parts = [p.strip() for p in s.split(",") if p.strip()]
            items = parts
        else:
            items = [s]
    normalized = []
    section_map = PREFERENCES.get(category, {}) or {}
    id_to_label = {str(k): v for k, v in section_map.items()}
    label_values = set(id_to_label.values())
    for item in items:
        if item is None:
            continue
        item_str = str(item).strip()
        if not item_str:
            continue
        if item_str in id_to_label:
            normalized.append(id_to_label[item_str])
            continue
        if item_str in label_values:
            normalized.append(item_str)
            continue
        matched = next((lbl for lbl in label_values if lbl.lower() == item_str.lower()), None)
        if matched:
            normalized.append(matched)
            continue
        digits = "".join(ch for ch in item_str if ch.isdigit())
        if digits and digits in id_to_label:
            normalized.append(id_to_label[digits])
            continue
        normalized.append(item_str)
    seen = set()
    out = []
    for x in normalized:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


# ----------------- Geocoding helper -----------------
def reverse_geocode_to_text(coords: Dict[str, float]) -> Optional[str]:
    try:
        if isinstance(coords, dict):
            lat = float(coords.get("lat"))
            lon = float(coords.get("lng") or coords.get("lon") or coords.get("longitude"))
        elif isinstance(coords, (list, tuple)):
            lat, lon = float(coords[0]), float(coords[1])
        else:
            return None
    except Exception:
        return None
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {"format": "jsonv2", "lat": lat, "lon": lon, "addressdetails": 1}
        headers = {"User-Agent": "MeetBuddyPlanner/1.0 (meetbuddy@example.com)"}
        resp = requests.get(url, params=params, headers=headers, timeout=8)
        if resp.status_code != 200:
            return None
        data = resp.json()
        addr = data.get("address", {}) or {}
        parts = []
        for k in ("suburb", "neighbourhood", "neighborhood", "quarter", "village", "hamlet", "locality"):
            v = addr.get(k)
            if v:
                parts.append(v)
                break
        for k in ("city", "town", "village", "county", "state"):
            v = addr.get(k)
            if v and (not parts or v not in parts):
                parts.append(v)
                break
        if parts:
            return ", ".join(parts)
        display = data.get("display_name")
        if display:
            return display.split(",")[0].strip()
    except Exception:
        return None
    return None


# ----------------- Place-type selection & short query -----------------
def select_place_types(labels_used: Dict[str, List[str]]) -> List[str]:
    types = []
    for cat, vals in labels_used.items():
        for v in vals:
            mapped = LABEL_TO_PLACE_TYPES.get(v)
            if mapped:
                for m in mapped:
                    if m not in types:
                        types.append(m)
    for default in ("restaurant", "cafe"):
        if default not in types:
            types.append(default)
    return types


def determine_flow_from_preferences(labels_used: Dict[str, List[str]]) -> List[str]:
    """
    Determine the flow (steps) based on user preferences.
    Returns a list of steps like ["restaurant", "activity", "stay"]
    Intelligently determines which steps are needed based on preferences.
    """
    flow_steps = set()

    # Always include restaurant as the first step (default)
    flow_steps.add("restaurant")

    # Analyze adventure level - strongest indicator for stay
    adventure_labels = labels_used.get("adventureLevel", [])
    needs_stay = False
    needs_activity = False
    force_no_activity = False  # Flag to explicitly exclude activities

    for label in adventure_labels:
        if label == "Weekend escape":
            needs_stay = True  # Weekend escapes almost always need accommodation
            needs_activity = True  # And activities
        elif label == "Short drive to hidden gem":
            needs_activity = True  # Activities are important for hidden gems
            # Stay is optional - don't force it
        elif label == "Stick to the city":
            needs_activity = True  # City activities are common
            # Usually no stay needed for city trips

    # Analyze mood - can override or reinforce decisions
    mood_labels = labels_used.get("mood", [])
    for label in mood_labels:
        if label == "Romantic":
            needs_stay = True  # Romantic often includes overnight stays
            needs_activity = True  # And romantic activities
        elif label == "Fun & Energetic":
            needs_activity = True  # Activities are essential
        elif label == "Chill & Relaxed":
            needs_activity = True  # Can include parks, cafes as activities
        elif label == "Business-y":
            # Business meetings usually just need restaurant
            # Override activity requirement unless adventure level strongly suggests it
            if "Weekend escape" not in adventure_labels and "Short drive to hidden gem" not in adventure_labels:
                force_no_activity = True  # Business-y overrides city activities

    # Analyze memorable factor - can add activities
    memorable_labels = labels_used.get("memorableFactor", [])
    for label in memorable_labels:
        if label == "A unique place":
            needs_activity = True  # Activities help find unique places
        elif label == "Amazing food":
            # Focus on food, activities optional but can enhance
            # Don't force activities if not already needed
            pass
        elif label == "Deep conversations / Capture moments":
            needs_activity = True  # Activities create memorable moments

    # Add steps based on analysis (respect force_no_activity flag)
    if needs_activity and not force_no_activity:
        flow_steps.add("activity")
    if needs_stay:
        flow_steps.add("stay")

    # Build ordered flow (restaurant first, then activity, then stay)
    ordered_flow = []
    if "restaurant" in flow_steps:
        ordered_flow.append("restaurant")
    if "activity" in flow_steps:
        ordered_flow.append("activity")
    if "stay" in flow_steps:
        ordered_flow.append("stay")

    # Ensure at least restaurant is included
    if not ordered_flow:
        ordered_flow = ["restaurant"]

    return ordered_flow


def short_query_from_selected(selected_tokens: List[Dict[str, str]]) -> str:
    if not selected_tokens:
        return "restaurant"
    parts = []
    for t in selected_tokens[:2]:
        lab = t.get("label", "")
        parts.extend([w for w in lab.split() if len(w) > 2])
    short = " ".join(parts[:3]) or selected_tokens[0].get("label", "restaurant")
    return short.strip()


def _prioritize_types(types: List[str]) -> List[str]:
    if not types:
        return ["restaurant", "cafe"]
    preferred = []
    others = []
    for t in types:
        if t in ("restaurant", "cafe"):
            preferred.append(t)
        else:
            others.append(t)
    ordered = []
    if "restaurant" in preferred:
        ordered.append("restaurant")
    if "cafe" in preferred and "cafe" not in ordered:
        ordered.append("cafe")
    for o in others:
        if o not in ordered:
            ordered.append(o)
    for d in ("restaurant", "cafe"):
        if d not in ordered:
            ordered.append(d)
    return ordered


# ----------------- Minimal tagging & scoring -----------------
def tag_place_minimal(place: Dict[str, Any]) -> List[str]:
    txt = " ".join(filter(None, [place.get("title", ""), place.get("address", "")])).lower()
    tags = []
    if "park" in txt or "garden" in txt:
        tags.append("outdoor")
    if "hotel" in txt or "resort" in txt:
        tags.append("stay")
    if "cafe" in txt or "restaurant" in txt or "diner" in txt:
        tags.append("food")
    return tags


def score_place_minimal(place: Dict[str, Any], labels_used: Dict[str, List[str]]) -> float:
    score = 0.0
    try:
        score += max(0.0, (float(place.get("rating", 0)) - 3.0)) * 1.5
    except Exception:
        pass
    txt = (place.get("title", "") + " " + place.get("address", "")).lower()
    if any("music" in s.lower() for lst in labels_used.values() for s in lst):
        if "music" in txt or "live" in txt:
            score += 1.0
    if any("weekend" in s.lower() or "escape" in s.lower() for lst in labels_used.values() for s in lst):
        if "resort" in txt or "getaway" in txt:
            score += 1.2
    return float(round(score, 3))


def dedupe_places(list_of_places: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for p in list_of_places:
        key = p.get("place_id") or (p.get("title") or "") + "::" + (p.get("address") or "")
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


# ----------------- Core session flow functions -----------------
def _is_coord_string(s: Optional[str]) -> bool:
    """Detect a string like 'Lat 12.95' to avoid using it verbatim in queries."""
    if not s or not isinstance(s, str):
        return False
    return s.strip().lower().startswith("lat ") or ("lat " in s.lower() and "lng" in s.lower())


def _prepare_coords_tuple(coords) -> Optional[Tuple[float, float]]:
    if not coords:
        return None
    try:
        if isinstance(coords, dict):
            lat = coords.get("lat") or coords.get("latitude")
            lng = coords.get("lng") or coords.get("lon") or coords.get("longitude")
            if lat is None or lng is None:
                return None
            return float(lat), float(lng)
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            return float(coords[0]), float(coords[1])
    except Exception:
        return None
    return None


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


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


def _sub_answers(prefs_data: Dict[str, Any], cat: str) -> Dict[str, Any]:
    raw = prefs_data.get(f"{cat}_sub") or prefs_data.get(f"{cat}Sub") or {}
    return raw if isinstance(raw, dict) else {}


def _sub_text(subs: Dict[str, Any], key: str) -> str:
    v = subs.get(key)
    if isinstance(v, list):
        return ", ".join(str(x) for x in v)
    return str(v).strip() if v not in (None, "") else ""


def _sub_list(subs: Dict[str, Any], key: str) -> List[str]:
    v = subs.get(key)
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if v in (None, ""):
        return []
    return [str(v).strip()]


def _build_search_directives(prefs_data: Dict[str, Any]) -> Dict[str, Any]:
    """Translate every questionnaire answer (main + stage-2 subs) into concrete
    search behavior: plan mode, radius, per-step query flavor terms, scoring
    priorities and exclusions. This is what makes the questionnaire functional
    rather than decorative."""
    d: Dict[str, Any] = {
        "plan_mode": "semi",        # surprise | semi | full
        "shortlist": None,           # int → cap options shown per step (semi mode)
        "priorities": [],            # food quality / ambience / budget / distance
        "avoid_terms": [],           # tokens from the surprise-mode avoid list
        "filters": [],               # full-control filter chips
        "radius_m": 2500,
        "restaurant_terms": [],      # query flavor for the restaurant step
        "activity_terms": [],        # query flavor for the activity step
        "stay_terms": [],
    }

    planning = " ".join(normalize_to_labels("planningStyle", prefs_data.get("planningStyle")) or []).lower()
    adventure = " ".join(normalize_to_labels("adventureLevel", prefs_data.get("adventureLevel")) or []).lower()
    addon = " ".join(normalize_to_labels("addOnMagic", prefs_data.get("addOnMagic")) or []).lower()

    mood_sub = _sub_answers(prefs_data, "mood")
    plan_sub = _sub_answers(prefs_data, "planningStyle")
    adv_sub = _sub_answers(prefs_data, "adventureLevel")
    addon_sub = _sub_answers(prefs_data, "addOnMagic")
    mem_sub = _sub_answers(prefs_data, "memorableFactor")

    # ---- planning mode ----
    if "surprise" in planning:
        d["plan_mode"] = "surprise"
        d["priorities"] = [p.lower() for p in _sub_list(plan_sub, "sm_prior")]
        block = _sub_text(plan_sub, "sm_block")
        if block:
            d["avoid_terms"] = [t.strip().lower() for t in re.split(r"[,;/]+", block) if t.strip()]
    elif "full control" in planning:
        wants_help = _sub_text(plan_sub, "fc_itinerary").lower().startswith("no")
        d["plan_mode"] = "semi" if wants_help else "full"
        d["filters"] = [f.lower() for f in _sub_list(plan_sub, "fc_filters")]
    else:  # Semi-custom (also the default when unanswered)
        d["plan_mode"] = "semi"
        if _sub_text(plan_sub, "sc_shortlist").lower().startswith("yes"):
            d["shortlist"] = 5

    # ---- search radius from adventure level ----
    if "weekend escape" in adventure:
        d["radius_m"] = 25000
    elif "short drive" in adventure:
        dur = _sub_text(adv_sub, "sd_duration")
        d["radius_m"] = 10000 if "<30" in dur else 50000 if ">60" in dur else 25000
    else:  # stick to the city
        area = _sub_text(adv_sub, "sc_area").lower()
        d["radius_m"] = 6000 if "suburb" in area else 2500

    # getaway type flavors (short drive)
    sd_type = _sub_text(adv_sub, "sd_type").lower()
    if "nature" in sd_type:
        d["activity_terms"] += ["nature spots", "scenic parks"]
    elif "heritage" in sd_type:
        d["activity_terms"] += ["heritage sites", "landmarks"]
    elif "food" in sd_type:
        d["restaurant_terms"].append("famous local food")
        d["activity_terms"].append("food streets")

    # ---- mood flavors ----
    fe_activity = _sub_text(mood_sub, "fe_activity").lower()
    if "dance" in fe_activity or "club" in fe_activity:
        d["activity_terms"] += ["night clubs", "dance clubs"]
    elif "games" in fe_activity:
        d["activity_terms"] += ["arcades", "gaming lounges"]
    elif "live" in fe_activity:
        d["activity_terms"].append("live event venues")
    fe_outdoor = _sub_text(mood_sub, "fe_outdoor").lower()
    if fe_outdoor == "outdoor":
        d["activity_terms"].insert(0, "outdoor activities")
    elif fe_outdoor == "indoor":
        d["activity_terms"].insert(0, "indoor activities")

    cr_setting = _sub_text(mood_sub, "cr_setting").lower()
    if "caf" in cr_setting:  # matches café / cafe
        d["restaurant_terms"].append("cozy cafes")
    elif "nature" in cr_setting or "park" in cr_setting:
        d["activity_terms"] += ["parks", "gardens"]
    for a in _sub_list(mood_sub, "cr_addons"):
        al = a.lower()
        if "board games" in al:
            d["activity_terms"].append("board game cafes")
        elif "quiet" in al:
            d["activity_terms"].append("art galleries")

    if "private" in _sub_text(mood_sub, "by_seating").lower():
        d["restaurant_terms"].append("private dining")
    if _sub_text(mood_sub, "by_formality").lower().startswith("formal"):
        d["restaurant_terms"].append("business friendly")

    ro_setting = _sub_text(mood_sub, "ro_setting").lower()
    if "candlelit" in ro_setting or "intimate" in ro_setting:
        d["restaurant_terms"].append("candlelight dinner")
    elif "scenic" in ro_setting or "view" in ro_setting:
        d["restaurant_terms"].append("restaurants with a view")
    elif "rooftop" in ro_setting or "alfresco" in ro_setting:
        d["restaurant_terms"].append("rooftop restaurants")

    # ---- add-on magic ----
    if "live music" in addon:
        style = _sub_text(addon_sub, "lm_style").lower()
        term = {"acoustic": "live acoustic music", "band": "live band", "dj": "DJ nights"}.get(style, "live music")
        d["restaurant_terms"].append(term)

    # ---- memorable factor ----
    cuisine = _sub_text(mem_sub, "af_cuisine")
    diet = _sub_text(mem_sub, "af_diet")
    if cuisine:
        d["restaurant_terms"].insert(0, cuisine)
    if diet:
        d["restaurant_terms"].append(f"{diet} friendly")
    for u in _sub_list(mem_sub, "up_type"):
        ul = u.lower()
        if "themed" in ul:
            d["restaurant_terms"].append("themed")
        elif "hidden" in ul:
            d["restaurant_terms"].append("hidden gem")
        elif "artistic" in ul:
            d["restaurant_terms"].append("aesthetic")
    dc_setting = _sub_text(mem_sub, "dc_setting").lower()
    if "quiet" in dc_setting:
        d["restaurant_terms"].append("quiet intimate")
    elif "scenic" in dc_setting or "photogenic" in dc_setting:
        d["restaurant_terms"].append("instagrammable")

    # Compact flavor lists — too many words dilute a maps search
    d["restaurant_terms"] = d["restaurant_terms"][:3]
    d["activity_terms"] = d["activity_terms"][:3]
    return d


AMBIENCE_KEYWORDS = ("rooftop", "garden", "lounge", "aesthetic", "cozy", "scenic", "terrace", "courtyard")


def _apply_priority_weights(place: Dict[str, Any], base_score: float, priorities: List[str]) -> float:
    """Re-weight a place's score by the user's surprise-mode priorities."""
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
        title = str(place.get("title") or "").lower()
        if any(k in title for k in AMBIENCE_KEYWORDS):
            base_score += 0.5
    return base_score


def _filter_avoided(options: List[Dict[str, Any]], avoid_terms: List[str]) -> List[Dict[str, Any]]:
    """Drop venues whose title/type matches any avoid-list token."""
    if not avoid_terms:
        return options
    kept = []
    for p in options:
        haystack = f"{p.get('title', '')} {p.get('type', '')}".lower()
        if any(term in haystack for term in avoid_terms):
            continue
        kept.append(p)
    return kept


def _step_flavor(directives: Dict[str, Any], place_type: Optional[str]) -> str:
    """Pick the flavor terms matching a step's place type."""
    food_types = ("restaurant", "cafe", "bar", "club")
    stay_types = ("hotel", "resort", "lodging")
    if place_type in stay_types:
        terms = directives.get("stay_terms") or []
    elif place_type in food_types or place_type is None:
        terms = directives.get("restaurant_terms") or []
    else:
        terms = directives.get("activity_terms") or []
    return " ".join(terms[:2])


def generate_initial_suggestions(payload: Dict[str, Any], num_results: int = 15):
    prefs_data = payload.get("preferences", {}) or {}
    coords = payload.get("coords")
    location_hint = payload.get("location")

    coords_tuple = _prepare_coords_tuple(coords)

    # If we have a textual location but no coords, try to geocode it
    if location_hint and not coords_tuple and not _is_coord_string(location_hint):
        from scraper import _geocode_address_nominatim
        try:
            geocoded_coords = _geocode_address_nominatim(location_hint)
            if geocoded_coords:
                coords_tuple = geocoded_coords
        except Exception:
            pass

    # If coords exist but location_hint is a raw lat/lng string, avoid using it in textual queries.
    loc_text_for_display = location_hint
    loc_text_for_query = ""
    if coords_tuple:
        # prefer reverse-geocode for display if possible
        try:
            if not location_hint:
                rc = reverse_geocode_to_text({"lat": coords_tuple[0], "lng": coords_tuple[1]})
                if rc:
                    loc_text_for_display = rc
        except Exception:
            pass
        # ALWAYS include the location_hint in query if it's explicitly provided (typed location)
        # This ensures user-typed locations take precedence
        if location_hint and not _is_coord_string(location_hint):
            loc_text_for_query = location_hint
        else:
            loc_text_for_query = ""
    else:
        # no coords: use textual location hint (if not a raw 'Lat ... Lng ...' pattern)
        if location_hint and not _is_coord_string(location_hint):
            loc_text_for_query = location_hint
        else:
            loc_text_for_query = ""

    mood_labels = normalize_to_labels("mood", prefs_data.get("mood"))
    planning_labels = normalize_to_labels("planningStyle", prefs_data.get("planningStyle"))
    adventure_labels = normalize_to_labels("adventureLevel", prefs_data.get("adventureLevel"))
    addon_labels = normalize_to_labels("addOnMagic", prefs_data.get("addOnMagic"))
    memorable_labels = normalize_to_labels("memorableFactor", prefs_data.get("memorableFactor"))

    # Stage2: normalize any adventureLevel_sub values (e.g. "No", "No stay") so we can
    # allow users to explicitly opt out of a stay step even if stage1 suggests a stay.
    adv_sub_raw = prefs_data.get("adventureLevel_sub") or prefs_data.get("adventureLevelSub")
    adv_sub_labels = normalize_to_labels("adventureLevel", adv_sub_raw)
    explicit_no_stay = any(
        isinstance(s, str) and "no" in s.lower()
        for s in adv_sub_labels
    )

    # Weekend escape: detect so we can bias search radius and scoring toward
    # places farther away from the starting point / city.
    is_weekend_escape = any(
        isinstance(s, str) and "weekend escape" in s.lower()
        for s in (adventure_labels or []) + (adv_sub_labels or [])
    )

    labels_used = {
        "mood": mood_labels,
        "planningStyle": planning_labels,
        "adventureLevel": adventure_labels,
        "addOnMagic": addon_labels,
        "memorableFactor": memorable_labels,
    }

    # Translate every questionnaire answer into concrete search behavior
    directives = _build_search_directives(prefs_data)

    # Build top tokens (max 3)
    tokens = []
    for cat in ("mood", "planningStyle", "adventureLevel", "addOnMagic", "memorableFactor"):
        for v in (labels_used.get(cat) or []):
            if len(tokens) >= 3:
                break
            if v:
                tokens.append({"category": cat, "label": v, "phrase": v})
        if len(tokens) >= 3:
            break

    short_q = short_query_from_selected(tokens)

    # select place types based on labels and prioritize
    place_types = select_place_types(labels_used)
    place_types = _prioritize_types(place_types)

    # Primary types we'll attempt (keep to common ones first)
    primary_types = [t for t in place_types if t in ("restaurant", "cafe", "park", "tourist_attraction", "hotel")]
    if not primary_types:
        primary_types = ["restaurant", "cafe"]

    options: List[Dict[str, Any]] = []

    # Map place types to user-friendly names for search
    place_type_names = {
        "restaurant": "restaurants",
        "cafe": "cafes",
        "park": "parks",
        "tourist_attraction": "attractions",
        "hotel": "hotels",
        "activity": "things to do",
    }

    # Build attempts list of (q, place_type, coords) — max 4 attempts
    attempts = []
    top_type = primary_types[0] if primary_types else "restaurant"
    top_name = place_type_names.get(top_type, top_type)

    # Attempt 1: preference-driven query with location.
    # Directive flavor terms (cuisine, rooftop, live music, ...) take
    # precedence over the generic token query when present.
    flavor = _step_flavor(directives, top_type)
    lead_q = f"{flavor} {top_name}".strip() if flavor else f"{short_q} {top_name}".strip()
    if loc_text_for_query:
        attempts.append((f"{lead_q} near {loc_text_for_query}".strip(), top_type, coords_tuple))
    else:
        attempts.append((lead_q, top_type, coords_tuple))

    # Attempt 2: plain place type + location (broader, better coverage)
    if loc_text_for_query:
        attempts.append((f"{top_name} in {loc_text_for_query}".strip(), top_type, coords_tuple))

    # Attempt 3: second place type if available
    if len(primary_types) > 1:
        pt2 = primary_types[1]
        pt2_name = place_type_names.get(pt2, pt2)
        q3 = f"{pt2_name} in {loc_text_for_query}".strip() if loc_text_for_query else f"{pt2_name}".strip()
        attempts.append((q3, pt2, coords_tuple))

    # Max search distance comes from adventure-level answers (city 2.5km,
    # suburbs 6km, short drive 10-50km by accepted drive time, weekend 25km)
    max_base_dist = directives["radius_m"]

    # Track search failures so a config error (e.g. invalid SerpAPI key)
    # can be reported instead of silently producing an empty result.
    search_errors: List[str] = []

    # Run attempts, stop early when we have enough results
    for idx, (q, pt, ctuple) in enumerate(attempts):
        # Early exit if we already have enough results (increased threshold for better selection)
        if len(options) >= max(num_results * 3, 40):
            break

        try:
            # Fetch more results (40-50) to have better selection, then filter by distance.
            # For weekend escapes, allow a moderately larger radius (not too far from the city).
            fetch_count = max(num_results * 3, 40)
            max_dist = max_base_dist if ctuple else None
            fetched = get_places(q, num_results=fetch_count, coords=ctuple, place_type=pt, max_distance_meters=max_dist)
            if fetched:
                options.extend(fetched)
                # Stop early if we have enough results (reduced threshold)
                if len(options) >= max(num_results, 15):
                    break
        except Exception as e:
            print(f"WARNING: place search failed for {q!r}: {e}")
            search_errors.append(str(e))

    # Only try generic fallback if we still don't have enough results
    if len(options) < num_results:
        try:
            fetch_count = max(num_results * 2, 25)
            max_dist = max_base_dist if coords_tuple else None
            fetched = get_places(short_q, num_results=fetch_count, coords=coords_tuple, place_type=None, max_distance_meters=max_dist)
            if fetched:
                options.extend(fetched)
        except Exception as e:
            print(f"WARNING: fallback place search failed for {short_q!r}: {e}")
            search_errors.append(str(e))

    # Last resort: if still no results, try just location-based search (no preferences)
    if len(options) < num_results and loc_text_for_query:
        try:
            fetch_count = max(num_results * 2, 25)
            max_dist = 2500 if coords_tuple else None
            fetched = get_places(loc_text_for_query, num_results=fetch_count, coords=coords_tuple, place_type=None, max_distance_meters=max_dist)
            if fetched:
                options.extend(fetched)
        except Exception as e:
            print(f"WARNING: location-only place search failed for {loc_text_for_query!r}: {e}")
            search_errors.append(str(e))

    # Deduplicate, drop avoided venues, & score
    options = dedupe_places(options)
    options = _filter_avoided(options, directives["avoid_terms"])

    # Add distance-based scoring boost (closer places get higher score)
    coords_tuple = _prepare_coords_tuple(coords)
    for p in options:
        p["tags"] = tag_place_minimal(p)
        base_score = score_place_minimal(p, labels_used)

        # Boost score based on distance if we have coords
        if coords_tuple and p.get("lat") and p.get("lng"):
            try:
                distance_m = _haversine_meters(coords_tuple[0], coords_tuple[1], float(p["lat"]), float(p["lng"]))
                p["distance_meters"] = distance_m
                base_score = _distance_boost(base_score, distance_m, is_weekend_escape=is_weekend_escape)
            except Exception:
                pass

        # Surprise-mode priorities (food quality / distance / budget / ambience)
        base_score = _apply_priority_weights(p, base_score, directives["priorities"])

        p["score"] = base_score

    # Sort by score (which includes distance boost), then by distance if available
    options_sorted = sorted(options, key=lambda x: (
        -x.get("score", 0),  # Higher score first
        x.get("distance_meters") if x.get("distance_meters") is not None else float('inf')  # Closer first
    ))

    # For weekend escapes, diversify directions around the origin so options
    # are not overly clustered in one area of the outskirts.
    if is_weekend_escape and coords_tuple and options_sorted:
        try:
            def _sector(place, center):
                try:
                    plat = float(place.get("lat"))
                    plng = float(place.get("lng"))
                    dlat = plat - center[0]
                    dlng = plng - center[1]
                    angle = atan2(dlat, dlng)  # -pi..pi
                    # 8 sectors (45° each)
                    idx = int(((angle + 3.14159265) / (2 * 3.14159265)) * 8) % 8
                    return idx
                except Exception:
                    return 0

            sector_buckets = {i: [] for i in range(8)}
            for pl in options_sorted:
                s_idx = _sector(pl, coords_tuple)
                sector_buckets[s_idx].append(pl)

            # Round-robin pick from sectors to build a balanced list
            balanced = []
            target_len = max(num_results, 20)
            while len(balanced) < target_len:
                added_any = False
                for i in range(8):
                    if sector_buckets[i]:
                        balanced.append(sector_buckets[i].pop(0))
                        added_any = True
                        if len(balanced) >= target_len:
                            break
                if not added_any:
                    break

            if balanced:
                options_sorted = balanced
        except Exception:
            pass

    display_q = ", ".join([t.get("label") for t in tokens]) or short_q
    # for display prefer reverse geocoded or textual hint; never show raw 'Lat .. Lng ..' if coords present
    if coords_tuple and loc_text_for_display:
        display_location = loc_text_for_display
    elif loc_text_for_query:
        display_location = loc_text_for_query
    else:
        display_location = None

    if display_location:
        display_q = f"{display_q} near {display_location}"

    # Determine flow based on preferences
    recommended_flow = determine_flow_from_preferences(labels_used)

    # If stage2 explicitly says "No" / "no stay" for adventureLevel, strip the stay step
    # even if stage1 would normally include it (e.g. "Weekend escape").
    if explicit_no_stay and "stay" in recommended_flow:
        recommended_flow = [step for step in recommended_flow if step != "stay"]

    result = {
        "display_query": display_q,
        "short_query": short_q,
        "labels_used": labels_used,
        "selected_tokens": tokens,
        "place_types": place_types,
        "options": options_sorted[:max(num_results, 20)],  # Return up to 20 results for better selection
        "location_hint": loc_text_for_display or "",
        "recommended_flow": recommended_flow,  # Add recommended flow steps
        "plan_mode": directives["plan_mode"],
        "directives": directives,
    }
    # Every search attempt failed and produced nothing — report why so the
    # frontend can show an actionable message instead of a generic empty state.
    if not result["options"] and search_errors:
        result["search_error"] = search_errors[-1]
    return result


def generate_followup_suggestions(session_state: Dict[str, Any], next_step: str, num_results: int = 15):
    if not session_state:
        raise ValueError("missing session state")

    steps = session_state.get("steps", []) or []
    last = steps[-1] if steps else None

    anchor_text = None
    anchor_coords = None
    if last and last.get("place"):
        pl = last["place"]
        anchor_text = pl.get("address") or pl.get("title") or pl.get("name")
        if pl.get("lat") and pl.get("lng"):
            try:
                anchor_coords = (float(pl.get("lat")), float(pl.get("lng")))
            except Exception:
                anchor_coords = None

    if not anchor_text:
        payload = session_state.get("payload", {})
        anchor_text = payload.get("location")
        if not anchor_text and payload.get("coords"):
            anchor_text = reverse_geocode_to_text(payload.get("coords")) or anchor_text

    if not anchor_coords:
        payload = session_state.get("payload", {})
        pc = payload.get("coords")
        if isinstance(pc, dict) and pc.get("lat") and pc.get("lng"):
            try:
                anchor_coords = (float(pc.get("lat")), float(pc.get("lng")))
            except Exception:
                anchor_coords = None

    prefs = session_state.get("payload", {}).get("preferences", {}) or {}
    labels_used = {
        "mood": normalize_to_labels("mood", prefs.get("mood")),
        "planningStyle": normalize_to_labels("planningStyle", prefs.get("planningStyle")),
        "adventureLevel": normalize_to_labels("adventureLevel", prefs.get("adventureLevel")),
        "addOnMagic": normalize_to_labels("addOnMagic", prefs.get("addOnMagic")),
        "memorableFactor": normalize_to_labels("memorableFactor", prefs.get("memorableFactor")),
    }

    # Followup steps inherit the same questionnaire-driven search behavior
    directives = _build_search_directives(prefs)
    # Steps after the anchor stay close to it regardless of adventure level,
    # but never tighter than 2.5km
    followup_radius = min(directives["radius_m"], 10000) if anchor_coords else None
    followup_radius = max(followup_radius, 2500) if followup_radius else None

    mapping = {
        "restaurant": ["restaurant", "cafe", "bar"],
        "activity": [
            "tourist_attraction", "park", "amusement_park", "play_area", "scenic",
            "escape_room", "bowling", "go_karting", "arcade", "laser_tag",
            "paintball", "trampoline", "adventure_sports", "indoor_activities"
        ],
        "stay": ["hotel", "resort"],
        "default": select_place_types(labels_used),
    }
    desired_types = mapping.get(next_step, mapping["default"])

    # Only prioritize types for restaurant step or default - don't add restaurant defaults to activity/stay
    if next_step == "restaurant" or next_step not in mapping:
        desired_types = _prioritize_types(desired_types)
    # For activity and stay steps, keep the types as-is without adding restaurant defaults

    tokens = session_state.get("selected_tokens") or []
    short_q = short_query_from_selected(tokens) if tokens else "things to do"

    fetched = []
    search_errors: List[str] = []

    # For activity step, lead with the questionnaire-flavored query
    # (e.g. "night clubs", "board game cafes"), falling back to a broad search
    if next_step == "activity":
        activity_flavor = " ".join((directives.get("activity_terms") or [])[:2])
        lead_query = activity_flavor if activity_flavor else "things to do"
        try:
            fetch_count = max(num_results * 2, 20)
            max_dist = followup_radius
            res = get_places(lead_query, num_results=fetch_count, coords=anchor_coords, place_type=None, max_distance_meters=max_dist)
            if res:
                fetched.extend(res)
        except Exception as e:
            print(f"WARNING: activity search failed: {e}")
            search_errors.append(str(e))
        # Flavored query came back thin — broaden
        if activity_flavor and len(fetched) < max(num_results, 8):
            try:
                res = get_places("things to do", num_results=max(num_results * 2, 20), coords=anchor_coords, place_type=None, max_distance_meters=followup_radius)
                if res:
                    fetched.extend(res)
            except Exception as e:
                print(f"WARNING: broad activity search failed: {e}")
                search_errors.append(str(e))

    # Try a short clean query per desired type, prefer using anchor_coords if available.
    # Limit to top 2 types to reduce API calls
    limited_types = desired_types[:2]

    for pt in limited_types:
        # Early exit if we have enough results
        if len(fetched) >= num_results * 2:
            break

        # For activity step, use activity-specific queries (no restaurant-related terms)
        if next_step == "activity":
            # Map place types to better search queries for activities
            activity_query_map = {
                "tourist_attraction": "tourist attractions",
                "park": "parks",
                "amusement_park": "amusement parks",
                "play_area": "playgrounds",
                "scenic": "scenic spots",
                "escape_room": "escape rooms",
                "bowling": "bowling alleys",
                "go_karting": "go karting",
                "arcade": "arcades",
                "laser_tag": "laser tag",
                "paintball": "paintball",
                "trampoline": "trampoline parks",
                "adventure_sports": "adventure sports",
                "indoor_activities": "indoor activities",
            }
            q = activity_query_map.get(pt, pt.replace("_", " ") if pt and len(pt) > 2 else "things to do")
        elif next_step == "stay":
            # For stay, use hotel/resort specific queries
            q = pt if pt and len(pt) > 2 else "hotels"
        else:
            q = short_q if short_q else pt

        # If we have an anchor_text (address) but also anchor_coords, do not append long address to q; prefer coords
        try:
            # Fetch more results and filter by distance from the anchor
            fetch_count = max(num_results * 2, 20)
            max_dist = followup_radius
            res = get_places(q, num_results=fetch_count, coords=anchor_coords, place_type=pt, max_distance_meters=max_dist)
            fetched.extend(res)
        except Exception as e:
            print(f"WARNING: place search failed for {q!r}: {e}")
            search_errors.append(str(e))

    fetched = dedupe_places(fetched)

    # Filter out inappropriate place types based on next_step
    if next_step == "activity":
        # Remove restaurants, cafes, bars from activity results
        activity_keywords = ["restaurant", "cafe", "bar", "diner", "bistro", "eatery", "food"]
        fetched = [p for p in fetched if not any(
            kw in (p.get("title", "") + " " + p.get("address", "")).lower()
            for kw in activity_keywords
        )]
    elif next_step == "stay":
        # Remove restaurants, cafes from stay results (keep hotels/resorts)
        stay_keywords = ["restaurant", "cafe", "bar"]
        fetched = [p for p in fetched if not any(
            kw in (p.get("title", "") + " " + p.get("address", "")).lower()
            for kw in stay_keywords
        )]

    # Drop venues matching the user's avoid list
    fetched = _filter_avoided(fetched, directives["avoid_terms"])

    # Add distance-based scoring boost for followup suggestions
    for p in fetched:
        p["tags"] = tag_place_minimal(p)
        base_score = score_place_minimal(p, labels_used)

        # Boost score for activity-relevant places when in activity step
        if next_step == "activity":
            title_addr = (p.get("title", "") + " " + p.get("address", "")).lower()
            activity_keywords = [
                # Outdoor activities
                "park", "playground", "attraction", "museum", "zoo", "aquarium", "garden",
                "scenic", "viewpoint", "monument", "temple", "church", "beach", "lake",
                # Indoor/Entertainment activities
                "escape room", "escape", "bowling", "go kart", "gokart", "karting",
                "arcade", "laser tag", "paintball", "trampoline", "adventure",
                "activity", "activities", "fun", "entertainment", "recreation",
                "sports", "game", "games", "play", "indoor", "outdoor",
                "cinema", "theater", "theatre", "stadium", "arena", "club",
                "pool", "billiards", "snooker", "darts", "mini golf", "golf",
                "ice skating", "roller skating", "skating", "rock climbing",
                "bungee", "zipline", "adventure park", "theme park"
            ]
            if any(kw in title_addr for kw in activity_keywords):
                base_score += 1.5

        # Boost score for closer places if we have anchor coords
        if anchor_coords and p.get("lat") and p.get("lng"):
            try:
                distance_m = _haversine_meters(anchor_coords[0], anchor_coords[1], float(p["lat"]), float(p["lng"]))
                p["distance_meters"] = distance_m
                base_score = _distance_boost(base_score, distance_m)
            except Exception:
                pass

        # Surprise-mode priorities apply to followup steps too
        base_score = _apply_priority_weights(p, base_score, directives["priorities"])

        p["score"] = base_score

    # Sort by score (which includes distance boost), then by distance
    fetched_sorted = sorted(fetched, key=lambda x: (
        -x.get("score", 0),  # Higher score first
        x.get("distance_meters") if x.get("distance_meters") is not None else float('inf')  # Closer first
    ))
    result = {
        "anchor_text": anchor_text,
        "next_step": next_step,
        "options": fetched_sorted[:num_results],
        "desired_types": desired_types,
    }
    if not result["options"] and search_errors:
        result["search_error"] = search_errors[-1]
    return result

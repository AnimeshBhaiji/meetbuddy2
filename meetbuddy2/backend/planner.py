# planner.py
import json
import os
import urllib.parse
import requests
from fastapi import HTTPException
from typing import Any, Dict, List, Optional, Tuple

from scraper import get_places
from planner_sessions import create_session, get_session, push_selection, set_last_options

PREFERENCES_FILE = "preferences.json"
USER_PREFS_FILE = "user_last_prefs.json"

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

# Map preferences to recommended flow steps
PREFERENCE_TO_FLOW = {
    # Adventure level strongly influences flow
    "Weekend escape": ["restaurant", "activity", "stay"],  # Always include stay for weekend escapes
    "Short drive to hidden gem": ["restaurant", "activity"],  # Activities likely, stay optional
    "Stick to the city": ["restaurant", "activity"],  # Usually no stay needed for city trips
    
    # Mood influences activity inclusion
    "Fun & Energetic": ["restaurant", "activity"],  # Activities are important
    "Chill & Relaxed": ["restaurant", "activity"],  # Activities can be parks/cafes
    "Business-y": ["restaurant"],  # Usually just restaurant, maybe activity
    "Romantic": ["restaurant", "activity", "stay"],  # Often includes stay for romantic getaways
    
    # Memorable factor influences what's included
    "A unique place": ["restaurant", "activity"],  # Activities help find unique places
    "Amazing food": ["restaurant"],  # Focus on food, activities optional
    "Deep conversations / Capture moments": ["restaurant", "activity"],  # Activities for memorable moments
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


def generate_initial_suggestions(payload: Dict[str, Any], num_results: int = 15):
    prefs_data = payload.get("preferences", {}) or {}
    coords = payload.get("coords")
    location_hint = payload.get("location")

    coords_tuple = _prepare_coords_tuple(coords)

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
        # do NOT include the raw Lat/Lng string in q when coords are present
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

    labels_used = {
        "mood": mood_labels,
        "planningStyle": planning_labels,
        "adventureLevel": adventure_labels,
        "addOnMagic": addon_labels,
        "memorableFactor": memorable_labels,
    }

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

    # Try queries: first attempt is short query + place type with coords (if present)
    attempts = []

    # Build attempts list of (q, place_type, coords)
    for pt in primary_types[:3]:
        # when coords present: do not include loc text in the q; else include loc text (short)
        if coords_tuple:
            q = f"{short_q}"
        else:
            q = f"{short_q} {loc_text_for_query}".strip() if loc_text_for_query else short_q
        attempts.append((q.strip(), pt, coords_tuple))

    # Additional fallback attempts (broader) - reduced to save API calls
    # 1) generic short_q + coords (no type) - only if we don't have enough results yet
    # 2) short 'things to do' around coords for activity heavy prefs - removed to save calls

    # Run attempts, stop early when we have enough results
    for idx, (q, pt, ctuple) in enumerate(attempts):
        # Early exit if we already have enough results
        if len(options) >= max(num_results * 2, 20):
            break
        
        try:
            # Fetch more results (25-30) to have better selection, then filter by distance
            fetch_count = max(num_results * 2, 25)
            max_dist = 2500 if ctuple else None  # 2.5km max distance from anchor
            fetched = get_places(q, num_results=fetch_count, coords=ctuple, place_type=pt, max_distance_meters=max_dist)
            if fetched:
                print(f"🔎 initial fetch succeeded on attempt {idx+1} q='{q}' pt={pt} coords={'yes' if ctuple else 'no'} -> {len(fetched)} results")
                options.extend(fetched)
                # Stop early if we have enough results (reduced threshold)
                if len(options) >= max(num_results, 15):
                    break
            else:
                print(f"🔎 initial fetch returned 0 on attempt {idx+1} q='{q}' pt={pt} coords={'yes' if ctuple else 'no'}")
        except Exception as e:
            print(f"⚠️ initial get_places failed on attempt {idx+1} q='{q}' pt={pt} coords={'yes' if ctuple else 'no'}:", e)
    
    # Only try generic fallback if we still don't have enough results
    if len(options) < num_results:
        try:
            fetch_count = max(num_results * 2, 25)
            max_dist = 2500 if coords_tuple else None
            fetched = get_places(short_q, num_results=fetch_count, coords=coords_tuple, place_type=None, max_distance_meters=max_dist)
            if fetched:
                print(f"🔎 fallback generic query succeeded -> {len(fetched)} results")
                options.extend(fetched)
        except Exception as e:
            print(f"⚠️ fallback query failed:", e)

    # Deduplicate & score
    options = dedupe_places(options)

    # Add distance-based scoring boost (closer places get higher score)
    coords_tuple = _prepare_coords_tuple(coords)
    for p in options:
        p["tags"] = tag_place_minimal(p)
        base_score = score_place_minimal(p, labels_used)
        
        # Boost score for closer places if we have coords
        if coords_tuple and p.get("lat") and p.get("lng"):
            try:
                from math import radians, sin, cos, sqrt, atan2
                R = 6371000  # Earth radius in meters
                lat1, lng1 = radians(coords_tuple[0]), radians(coords_tuple[1])
                lat2, lng2 = radians(float(p["lat"])), radians(float(p["lng"]))
                delta_lat = lat2 - lat1
                delta_lng = lng2 - lng1
                a = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lng / 2) ** 2
                c = 2 * atan2(sqrt(a), sqrt(1 - a))
                distance_m = R * c
                p["distance_meters"] = distance_m
                # Boost: places within 500m get +2, within 1km get +1, within 2km get +0.5
                if distance_m <= 500:
                    base_score += 2.0
                elif distance_m <= 1000:
                    base_score += 1.0
                elif distance_m <= 2000:
                    base_score += 0.5
            except Exception:
                pass
        
        p["score"] = base_score

    # Sort by score (which includes distance boost), then by distance if available
    options_sorted = sorted(options, key=lambda x: (
        -x.get("score", 0),  # Higher score first
        x.get("distance_meters") if x.get("distance_meters") is not None else float('inf')  # Closer first
    ))

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

    return {
        "display_query": display_q,
        "short_query": short_q,
        "labels_used": labels_used,
        "selected_tokens": tokens,
        "place_types": place_types,
        "options": options_sorted[:num_results],
        "location_hint": loc_text_for_display or "",
        "recommended_flow": recommended_flow,  # Add recommended flow steps
    }


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

    # For activity step, also add direct activity searches beyond place types
    # Reduced to 2-3 most common activity types to save API calls
    if next_step == "activity":
        # Only search for top 2-3 most popular activity types
        activity_queries = [
            "escape rooms",
            "bowling alleys",
            "go karting",
        ]
        for activity_q in activity_queries[:2]:  # Reduced from 5 to 2
            # Early exit if we have enough results
            if len(fetched) >= num_results * 2:
                break
            try:
                fetch_count = max(num_results * 2, 20)
                max_dist = 2500 if anchor_coords else None
                res = get_places(activity_q, num_results=fetch_count, coords=anchor_coords, place_type=None, max_distance_meters=max_dist)
                if res:
                    print(f"🔎 activity query succeeded q='{activity_q}' coords={'yes' if anchor_coords else 'no'} -> {len(res)}")
                    fetched.extend(res)
            except Exception as e:
                print(f"⚠️ activity query failed for '{activity_q}':", e)

    # Try a short clean query per desired type, prefer using anchor_coords if available.
    # Limit to top 3-4 types to reduce API calls
    limited_types = desired_types[:4] if len(desired_types) > 4 else desired_types
    
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
            # Fetch more results and filter by distance (2.5km max from anchor)
            fetch_count = max(num_results * 2, 20)
            max_dist = 2500 if anchor_coords else None  # 2.5km max distance from anchor
            res = get_places(q, num_results=fetch_count, coords=anchor_coords, place_type=pt, max_distance_meters=max_dist)
            if res:
                print(f"🔎 followup succeeded q='{q}' pt={pt} coords={'yes' if anchor_coords else 'no'} -> {len(res)}")
            else:
                print(f"🔎 followup returned 0 q='{q}' pt={pt} coords={'yes' if anchor_coords else 'no'}")
            fetched.extend(res)
        except Exception as e:
            print(f"⚠️ followup get_places failed for {pt} q='{q}' coords={'yes' if anchor_coords else 'no'}:", e)

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
                from math import radians, sin, cos, sqrt, atan2
                R = 6371000  # Earth radius in meters
                lat1, lng1 = radians(anchor_coords[0]), radians(anchor_coords[1])
                lat2, lng2 = radians(float(p["lat"])), radians(float(p["lng"]))
                delta_lat = lat2 - lat1
                delta_lng = lng2 - lng1
                a = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lng / 2) ** 2
                c = 2 * atan2(sqrt(a), sqrt(1 - a))
                distance_m = R * c
                p["distance_meters"] = distance_m
                # Boost: places within 500m get +2, within 1km get +1, within 2km get +0.5
                if distance_m <= 500:
                    base_score += 2.0
                elif distance_m <= 1000:
                    base_score += 1.0
                elif distance_m <= 2000:
                    base_score += 0.5
            except Exception:
                pass
        
        p["score"] = base_score

    # Sort by score (which includes distance boost), then by distance
    fetched_sorted = sorted(fetched, key=lambda x: (
        -x.get("score", 0),  # Higher score first
        x.get("distance_meters") if x.get("distance_meters") is not None else float('inf')  # Closer first
    ))
    return {
        "anchor_text": anchor_text,
        "next_step": next_step,
        "options": fetched_sorted[:num_results],
        "desired_types": desired_types,
    }


# ----------------- Backwards-compatible single-call generate_plan -----------------
def _map_place_to_frontend(item: Dict[str, Any]) -> Dict[str, Any]:
    title = item.get("title") or item.get("name") or item.get("Name") or "Unnamed Place"
    address = item.get("address") or item.get("Address") or item.get("vicinity") or ""
    rating = item.get("rating") or item.get("Rating") or 0
    link = item.get("link") or item.get("Google Maps Link") or item.get("website") or ""
    thumbnail = item.get("thumbnail") or item.get("serpapi_thumbnail") or None
    try:
        rating = float(rating) if rating not in (None, "") else 0.0
    except Exception:
        rating = 0.0
    return {
        "title": title,
        "address": address,
        "rating": rating,
        "link": link,
        "thumbnail": thumbnail,
        "raw": item,
    }


def generate_plan(payload: Dict[str, Any]):
    """
    Backwards-compatible single-shot generate_plan.
    This wraps the new initial suggestion logic and returns a response shape similar to older generate_plan.
    """
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be a JSON object")

    print("📥 planner.generate_plan received payload:", json.dumps(payload, ensure_ascii=False))
    user_id = payload.get("user_id")
    prefs_data = payload.get("preferences", {}) or {}
    max_terms = int(payload.get("max_terms", payload.get("maxTerms", 3)) or 3)
    num_results = int(payload.get("num_results", 10) or 10)

    coords = payload.get("coords") or payload.get("coordinate") or payload.get("latlng")
    location_hint = payload.get("location") or payload.get("place") or None

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id.")
    if not isinstance(prefs_data, dict):
        raise HTTPException(status_code=400, detail="preferences must be an object")

    # If coords provided attempt reverse geocode for friendly display; otherwise keep textual hint
    if coords and not location_hint:
        try:
            location_hint = reverse_geocode_to_text(coords)
            if location_hint:
                print("🔍 Reverse-geocoded coords to:", location_hint)
        except Exception:
            pass

    mood_labels = normalize_to_labels("mood", prefs_data.get("mood"))
    planning_labels = normalize_to_labels("planningStyle", prefs_data.get("planningStyle"))
    adventure_labels = normalize_to_labels("adventureLevel", prefs_data.get("adventureLevel"))
    addon_labels = normalize_to_labels("addOnMagic", prefs_data.get("addOnMagic"))
    memorable_labels = normalize_to_labels("memorableFactor", prefs_data.get("memorableFactor"))

    labels_used = {
        "mood": mood_labels,
        "planningStyle": planning_labels,
        "adventureLevel": adventure_labels,
        "addOnMagic": addon_labels,
        "memorableFactor": memorable_labels,
    }

    print("📚 labels_used after normalization:", json.dumps(labels_used, ensure_ascii=False))

    # build selected tokens (simple top-k from priority)
    selected_tokens = []
    for cat in CATEGORY_PRIORITY:
        if len(selected_tokens) >= max_terms:
            break
        vals = labels_used.get(cat, []) or []
        for v in vals:
            if len(selected_tokens) >= max_terms:
                break
            selected_tokens.append({"category": cat, "label": v, "phrase": v})

    # Build display query and short query
    short_q = short_query_from_selected(selected_tokens)

    # For display, avoid showing raw "Lat ..." if coords were provided.
    if coords and isinstance(location_hint, str) and _is_coord_string(location_hint):
        # try reverse geocode
        try:
            rc = reverse_geocode_to_text(coords)
            if rc:
                display_loc = rc
            else:
                display_loc = None
        except Exception:
            display_loc = None
    else:
        display_loc = location_hint

    display_q = short_q
    if display_loc:
        display_q = f"{display_q} near {display_loc}"
    search_url = "https://www.google.com/search?q=" + urllib.parse.quote_plus(display_q)

    # call initial suggestions to fetch options (reuse logic)
    initial_payload = {
        "user_id": user_id,
        "preferences": prefs_data,
        "coords": coords,
        "location": location_hint,
        "max_terms": max_terms,
    }
    initial = generate_initial_suggestions(initial_payload, num_results=num_results)
    recommendations_raw = initial.get("options", []) or []

    recommendations_mapped = [_map_place_to_frontend(r) for r in recommendations_raw]

    return {
        "user_id": user_id,
        "query": display_q,
        "search_url": search_url,
        "labels_used": labels_used,
        "selected_for_query": selected_tokens,
        "recommendations": recommendations_mapped,
        "note": "Generated query and fetched recommendations via SerpAPI (google_maps).",
    }

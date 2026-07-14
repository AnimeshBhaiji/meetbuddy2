# directives.py — questionnaire answers -> search behavior.
# Label normalization, plan flow, and the directive builder that turns every
# stage-1/stage-2 answer into query flavors, radius, priorities and exclusions.
import json
import os
import re
from typing import Any, Dict, List

_ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PREFERENCES_FILE = os.path.join(_ROOT_DIR, "preferences.json")

if os.path.exists(PREFERENCES_FILE):
    try:
        with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
            PREFERENCES = json.load(f)
    except Exception:
        PREFERENCES = {}
else:
    PREFERENCES = {}

LABEL_TO_PLACE_TYPES = {
    "Weekend escape": ["hotel", "resort", "tourist_attraction"],
    "Stick to the city": ["restaurant", "cafe", "park", "bar"],
    "Short drive to hidden gem": ["tourist_attraction", "park", "restaurant"],
    "Fun & Energetic": ["bar", "club", "restaurant"],
    "Chill & Relaxed": ["cafe", "park", "co_working"],
    "Romantic": ["restaurant", "hotel", "rooftop", "scenic"],
    "Family": ["play_area", "park", "museum"],
}

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


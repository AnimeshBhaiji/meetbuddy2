# planner.py
import json
import os
import urllib.parse
import requests
from fastapi import HTTPException
from typing import Any, Dict, List, Optional, Tuple

from scraper import get_restaurants  # updated scraper.py expected

PREFERENCES_FILE = "preferences.json"
USER_PREFS_FILE = "user_last_prefs.json"

# Load preferences mapping (id -> label)
if os.path.exists(PREFERENCES_FILE):
    try:
        with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
            PREFERENCES = json.load(f)
    except Exception:
        PREFERENCES = {}
else:
    PREFERENCES = {}

CATEGORY_PRIORITY = ["mood", "planningStyle", "adventureLevel", "memorableFactor", "addOnMagic"]

LABEL_TO_SEARCH_PHRASE = {
    "Fun & Energetic": "lively cafes and bars",
    "Chill & Relaxed": "cozy cafes and chill restaurants",
    "Business-y": "business-friendly restaurants with meeting seating",
    "Romantic": "romantic restaurants and date-night spots",
    "Surprise me": "unique experience restaurants and activities",
    "Semi-custom": "flexible venues and curated options",
    "Full control": "restaurants with reservations and private dining",
    "Stick to the city": "city-center cafes and restaurants",
    "Short drive to hidden gem": "hidden gem restaurants a short drive away",
    "Weekend escape": "weekend getaway restaurants and cafes",
    "Easy rides arranged": "venues with transport/valet or rideshare-friendly access",
    "Live music spots": "cafes and restaurants with live music",
    "Surprise gift delivery / Insta-corners": "instagrammable cafes with gift/delivery options",
    "A unique place": "unique and themed restaurants",
    "Amazing food": "top-rated restaurants for amazing food",
    "Deep conversations / Capture moments": "quiet photogenic cafes and intimate restaurants",
}


def fallback_phrase(label: str, category_hint: str = "cafes and restaurants") -> str:
    s = str(label or "").strip()
    if not s:
        return ""
    return f"{s} {category_hint}"


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

    normalized: List[str] = []
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


def select_top_tokens(labels_used: Dict[str, List[str]], k: int = 3) -> List[Dict[str, str]]:
    selected: List[Dict[str, str]] = []
    for cat in CATEGORY_PRIORITY:
        if len(selected) >= k:
            break
        vals = labels_used.get(cat, []) or []
        for v in vals:
            if len(selected) >= k:
                break
            if not v:
                continue
            v_clean = str(v).strip()
            phrase = LABEL_TO_SEARCH_PHRASE.get(v_clean)
            if not phrase:
                found_key = next((key for key in LABEL_TO_SEARCH_PHRASE.keys() if key.lower() == v_clean.lower()), None)
                if found_key:
                    phrase = LABEL_TO_SEARCH_PHRASE[found_key]
            if not phrase:
                if cat == "addOnMagic":
                    phrase = f"with {v_clean}"
                elif cat == "memorableFactor":
                    phrase = f"{v_clean}"
                else:
                    phrase = fallback_phrase(v_clean)
            selected.append({"category": cat, "label": v_clean, "phrase": phrase})

    if len(selected) < k:
        for cat, vals in labels_used.items():
            if len(selected) >= k:
                break
            for v in vals:
                if len(selected) >= k:
                    break
                v_clean = str(v).strip()
                if any(s["label"].lower() == v_clean.lower() for s in selected):
                    continue
                phrase = LABEL_TO_SEARCH_PHRASE.get(v_clean) or fallback_phrase(v_clean)
                selected.append({"category": cat, "label": v_clean, "phrase": phrase})

    if len(selected) == 0:
        for cat, vals in labels_used.items():
            for v in vals:
                v_clean = str(v).strip()
                phrase = LABEL_TO_SEARCH_PHRASE.get(v_clean) or fallback_phrase(v_clean)
                selected.append({"category": cat, "label": v_clean, "phrase": phrase})
                if len(selected) >= k:
                    break
            if len(selected) >= k:
                break

    return selected[:k]


def build_search_queries(selected_tokens: List[Dict[str, str]], location_hint: Optional[str] = None, category_hint: str = "cafes and restaurants") -> Tuple[str, str]:
    """
    Return (display_query, scraper_query)
    - display_query: for UI and Google open (longer, human readable, includes 'near ...')
    - scraper_query: short query to pass to SerpAPI when coords provided (no 'near')
    """
    if not selected_tokens:
        base = category_hint
    else:
        phrases = [t["phrase"].strip() for t in selected_tokens if t.get("phrase")]
        seen = set()
        uniq = []
        for p in phrases:
            if p and p not in seen:
                seen.add(p)
                uniq.append(p)
        base = ", ".join(uniq)

    if location_hint:
        display_q = f"{base} near {location_hint}"
    else:
        display_q = f"{base} near me"

    # scraper_query: drop 'near ...' (we will bias with ll)
    scraper_q = base
    return display_q, scraper_q


def reverse_geocode(coords: Dict[str, float]) -> Optional[str]:
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


def map_scraper_item_to_frontend(item: Dict[str, Any]) -> Dict[str, Any]:
    title = item.get("Name") or item.get("title") or item.get("name") or None
    address = item.get("Address") or item.get("address") or item.get("vicinity") or ""
    rating = item.get("Rating") or item.get("rating") or 0
    link = item.get("Google Maps Link") or item.get("Google Maps") or item.get("Website") or item.get("Website Link") or item.get("website") or ""
    thumbnail = item.get("Thumbnail") or item.get("photo_url") or item.get("serpapi_thumbnail") or None

    try:
        rating = float(rating) if rating not in (None, "") else 0
    except Exception:
        rating = 0

    mapped = {
        "title": title or "Unnamed Place",
        "address": address or "",
        "rating": rating,
        "link": link or "",
        "thumbnail": thumbnail,
        "raw": item,
    }
    return mapped


def generate_plan(payload: Dict[str, Any]):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be a JSON object")

    print("📥 planner.generate_plan received payload:", json.dumps(payload, ensure_ascii=False))

    user_id = payload.get("user_id")
    prefs_data = payload.get("preferences", {})
    max_terms = int(payload.get("max_terms", 3)) if payload.get("max_terms") is not None else 3
    num_results = int(payload.get("num_results", 10)) if payload.get("num_results") is not None else 10

    coords = payload.get("coords") or payload.get("coordinate") or payload.get("latlng")
    location_hint = payload.get("location") or payload.get("place") or None

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id.")
    if not isinstance(prefs_data, dict):
        raise HTTPException(status_code=400, detail="preferences must be an object")

    if coords and not location_hint:
        try:
            location_hint = reverse_geocode(coords)
            if location_hint:
                print("🔍 Reverse-geocoded coords to:", location_hint)
        except Exception as e:
            print("⚠️ Reverse geocode failed:", e)

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

    selected_tokens = select_top_tokens(labels_used, k=max_terms)
    print("🔎 selected_tokens:", json.dumps(selected_tokens, ensure_ascii=False))

    display_query, scraper_query = build_search_queries(selected_tokens, location_hint=location_hint)
    search_url = "https://www.google.com/search?q=" + urllib.parse.quote_plus(display_query)

    print(f"🔍 Display search query for user {user_id}: {display_query}")
    print(f"🔍 Scraper query (short): {scraper_query}")

    recommendations_raw = []
    # If coords present prefer short query + ll; else use display query
    try:
        if coords:
            try:
                lat = float(coords.get("lat")) if isinstance(coords, dict) else float(coords[0])
                lng = float(coords.get("lng")) if isinstance(coords, dict) else float(coords[1])
            except Exception:
                lat = None
                lng = None

            if lat is not None and lng is not None:
                print(f"🔧 Calling scraper with coords ll: {lat} {lng}")
                # Pass the short scraper_query and coords
                recommendations_raw = get_restaurants(scraper_query, num_results=num_results, coords=(lat, lng))
            else:
                # fallback if coords invalid
                print("⚠️ coords invalid; calling scraper without coords using display_query")
                recommendations_raw = get_restaurants(display_query, num_results=num_results, coords=None)
        else:
            # no coords: provide textual location in the q
            print("🔧 Calling scraper without coords (textual location if present).")
            recommendations_raw = get_restaurants(display_query, num_results=num_results, coords=None)

        print(f"✅ Scraper returned {len(recommendations_raw)} results")
    except Exception as e:
        # Defensive retry: if coords were used and we failed with coords, retry using textual display_query without coords
        print("❌ Error calling scraper.get_restaurants:", e)
        if coords:
            try:
                print("🔁 Retrying scraper without coords using textual location (fallback).")
                recommendations_raw = get_restaurants(display_query, num_results=num_results, coords=None)
                print(f"✅ Scraper retry returned {len(recommendations_raw)} results")
            except Exception as e2:
                print("❌ Scraper retry also failed:", e2)
                return {
                    "user_id": user_id,
                    "query": display_query,
                    "search_url": search_url,
                    "labels_used": labels_used,
                    "selected_for_query": selected_tokens,
                    "recommendations": [],
                    "note": f"Scraper failed: {str(e2)}",
                }
        else:
            return {
                "user_id": user_id,
                "query": display_query,
                "search_url": search_url,
                "labels_used": labels_used,
                "selected_for_query": selected_tokens,
                "recommendations": [],
                "note": f"Scraper failed: {str(e)}",
            }

    recommendations_mapped = [map_scraper_item_to_frontend(r) for r in recommendations_raw]

    return {
        "user_id": user_id,
        "query": display_query,
        "search_url": search_url,
        "labels_used": labels_used,
        "selected_for_query": selected_tokens,
        "recommendations": recommendations_mapped,
        "note": "Generated query and fetched recommendations via SerpAPI (google_maps).",
    }

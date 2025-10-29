# planner.py
import json
import os
import urllib.parse
from fastapi import FastAPI, HTTPException
from typing import Any, Dict, List
from pathlib import Path

app = FastAPI()

# local scraper (do NOT modify scraper.py as requested)
from scraper import get_restaurants

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

# Priority order for selecting tokens for the search query
CATEGORY_PRIORITY = ["mood", "planningStyle", "adventureLevel", "memorableFactor", "addOnMagic"]

# LABEL -> search phrase mapping tuned to your preferences.json
LABEL_TO_SEARCH_PHRASE = {
    # mood
    "Fun & Energetic": "lively cafes and bars",
    "Chill & Relaxed": "cozy cafes and chill restaurants",
    "Business-y": "business-friendly restaurants with meeting seating",
    "Romantic": "romantic restaurants and date-night spots",

    # planningStyle
    "Surprise me": "unique experience restaurants and activities",
    "Semi-custom": "flexible venues and curated options",
    "Full control": "restaurants with reservations and private dining",

    # adventureLevel
    "Stick to the city": "city-center cafes and restaurants",
    "Short drive to hidden gem": "hidden gem restaurants a short drive away",
    "Weekend escape": "weekend getaway restaurants and cafes",

    # addOnMagic
    "Easy rides arranged": "venues with transport/valet or rideshare-friendly access",
    "Live music spots": "cafes and restaurants with live music",
    "Surprise gift delivery / Insta-corners": "instagrammable cafes with gift/delivery options",

    # memorableFactor
    "A unique place": "unique and themed restaurants",
    "Amazing food": "top-rated restaurants for amazing food",
    "Deep conversations / Capture moments": "quiet photogenic cafes and intimate restaurants",
}


def fallback_phrase(label: str, category_hint: str = "cafes and restaurants") -> str:
    s = str(label or "").strip()
    if not s:
        return ""
    return f"{s} {category_hint}"


# -------------------------------
# Normalization helper — very defensive
# -------------------------------
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

    # dedupe while preserving order
    seen = set()
    out = []
    for x in normalized:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


# -------------------------------
# Select top tokens with more robust fallback
# -------------------------------
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

    # fill from remaining categories if needed
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


# -------------------------------
# Build query
# -------------------------------
def build_search_query_from_selected(selected_tokens: List[Dict[str, str]], category_hint="cafes and restaurants"):
    if not selected_tokens:
        return f"{category_hint} near me"
    phrases = [t["phrase"].strip() for t in selected_tokens if t.get("phrase")]
    seen = set()
    uniq = []
    for p in phrases:
        if p and p not in seen:
            seen.add(p)
            uniq.append(p)
    query = ", ".join(uniq)
    if not query.lower().endswith("near me"):
        query = f"{query} near me"
    return query


# -------------------------------
# Helper: map raw scraper item -> frontend-friendly item
# -------------------------------
def map_scraper_item_to_frontend(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map a single result from scraper.get_restaurants to the shape Planner.jsx expects:
      { title, address, rating, link, thumbnail, raw }
    Keep raw for debugging.
    """
    # common keys returned by your scraper
    title = (
        item.get("Name")
        or item.get("title")
        or item.get("Name")
        or item.get("Name")  # defensive repetition
        or None
    )
    address = item.get("Address") or item.get("address") or item.get("vicinity") or ""
    rating = item.get("Rating") or item.get("rating") or 0
    link = item.get("Google Maps Link") or item.get("Google Maps") or item.get("Website") or item.get("Website Link") or item.get("website") or ""
    thumbnail = item.get("Thumbnail") or item.get("photo_url") or item.get("serpapi_thumbnail") or None

    # Some fields might be nested or have different casing -- cast to proper types
    try:
        # rating could be a str sometimes
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


# -------------------------------
# planner endpoint (normalize -> select -> call scraper -> return)
# -------------------------------
@app.post("/planner")
def generate_plan(payload: Dict[str, Any]):
    # Defensive: ensure payload is a dict
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be a JSON object")

    # Debug log incoming payload
    print("📥 planner.generate_plan received payload:", json.dumps(payload, ensure_ascii=False))

    user_id = payload.get("user_id")
    prefs_data = payload.get("preferences", {})
    max_terms = int(payload.get("max_terms", 3)) if payload.get("max_terms") is not None else 3
    num_results = int(payload.get("num_results", 10)) if payload.get("num_results") is not None else 10

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id.")
    if not isinstance(prefs_data, dict):
        raise HTTPException(status_code=400, detail="preferences must be an object")

    # Normalize each category defensively
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

    # Debug log normalized labels
    print("📚 labels_used after normalization:", json.dumps(labels_used, ensure_ascii=False))

    # Select tokens (with fallback)
    selected_tokens = select_top_tokens(labels_used, k=max_terms)

    # Debug selected tokens
    print("🔎 selected_tokens:", json.dumps(selected_tokens, ensure_ascii=False))

    # Build search query
    query = build_search_query_from_selected(selected_tokens, category_hint="cafes and restaurants")
    search_url = "https://www.google.com/search?q=" + urllib.parse.quote_plus(query)

    print(f"🔍 Generated search query for user {user_id}: {query}")

    # --- Use scraper to fetch places from SerpAPI (Google Maps) ---
    recommendations_raw = []
    try:
        recommendations_raw = get_restaurants(query, num_results=num_results)
        print(f"✅ Scraper returned {len(recommendations_raw)} results")
    except ValueError as ve:
        print("⚠️ Scraper error (likely missing API key):", ve)
        return {
            "user_id": user_id,
            "query": query,
            "search_url": search_url,
            "labels_used": labels_used,
            "selected_for_query": selected_tokens,
            "recommendations": [],
            "note": f"Scraper error: {str(ve)} — please set SERPAPI_KEY in your environment to fetch live results.",
        }
    except Exception as e:
        print("❌ Error calling scraper.get_restaurants:", e)
        return {
            "user_id": user_id,
            "query": query,
            "search_url": search_url,
            "labels_used": labels_used,
            "selected_for_query": selected_tokens,
            "recommendations": [],
            "note": f"Scraper failed: {str(e)}",
        }

    # Map raw scraper results into frontend-friendly shape
    recommendations_mapped = [map_scraper_item_to_frontend(r) for r in recommendations_raw]

    # Return the combined response (query + scraped recommendations)
    return {
        "user_id": user_id,
        "query": query,
        "search_url": search_url,
        "labels_used": labels_used,
        "selected_for_query": selected_tokens,
        "recommendations": recommendations_mapped,
        "note": "Generated query and fetched recommendations via SerpAPI (google_maps).",
    }

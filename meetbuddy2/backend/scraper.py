# scraper.py — SerpAPI google_maps fetch + parsing, with a persistent
# cache in front (cache.py / Postgres). One SerpAPI page per search.
import logging
import os
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

import cache
from geo import geocode_address, haversine_meters, normalize_coords

load_dotenv()
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

logger = logging.getLogger(__name__)

SEARCH_TTL = 7 * 24 * 3600  # venues don't change hourly
RADIUS_BUCKETS = (2500, 6000, 10000, 25000, 50000)  # matches directive radii

# Billed-credit counter for this process; logged so savings are measurable.
serpapi_calls = 0


def _ensure_key():
    if not SERPAPI_KEY:
        raise ValueError("SerpAPI key not found. Please set SERPAPI_KEY in your .env file.")


def _radius_bucket(radius_m: Optional[float]) -> int:
    r = int(radius_m or 5000)
    return next((b for b in RADIUS_BUCKETS if r <= b), RADIUS_BUCKETS[-1])


def _cache_key(query: str, coords: Optional[Tuple[float, float]], radius_m: Optional[float]) -> str:
    q = " ".join((query or "").lower().split())
    cell = f"{coords[0]:.2f}:{coords[1]:.2f}" if coords else "none"
    return f"search:{q}:{cell}:{_radius_bucket(radius_m)}"


def _parse_place(item: Dict) -> Dict:
    place_id = item.get("place_id") or item.get("id") or item.get("cid") or ""

    lat = None
    lng = None
    gps = item.get("gps") or item.get("gps_coordinates")
    if isinstance(gps, str) and "," in gps:
        try:
            p0, p1 = gps.split(",")[:2]
            lat, lng = float(p0), float(p1)
        except Exception:
            lat = lng = None
    elif isinstance(gps, dict):
        try:
            lat = float(gps.get("latitude") or gps.get("lat"))
            lng = float(gps.get("longitude") or gps.get("lng"))
        except Exception:
            lat = lng = None
    if lat is None and "lat" in item and "lng" in item:
        try:
            lat, lng = float(item["lat"]), float(item["lng"])
        except Exception:
            lat = lng = None

    reviews = []
    raw_reviews = item.get("reviews") if isinstance(item.get("reviews"), list) else []
    for review in raw_reviews[:5]:
        if isinstance(review, dict):
            text = review.get("snippet") or review.get("text") or review.get("review") or ""
            if text:
                reviews.append(text)
        elif isinstance(review, str):
            reviews.append(review)

    thumbnail = item.get("serpapi_thumbnail")
    photos = item.get("photos") or []
    if photos and isinstance(photos, list) and isinstance(photos[0], dict) and photos[0].get("photo_url"):
        thumbnail = photos[0]["photo_url"]

    return {
        "place_id": place_id,
        "title": item.get("title") or item.get("name") or "",
        "address": item.get("address") or item.get("vicinity") or "",
        "rating": item.get("rating") or 0,
        "price": item.get("price") or "",          # e.g. currency signs — used by budget priority
        "type": item.get("type") or "",            # used by the avoid-list filter
        "link": item.get("link")
        or (f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else ""),
        "thumbnail": thumbnail,
        "lat": lat,
        "lng": lng,
        "description": item.get("description") or item.get("snippet") or "",
        "snippet": item.get("snippet") or "",
        "reviews": reviews,
    }


def fetch_places_page(query: str, coords: Optional[Tuple[float, float]] = None,
                      radius_m: Optional[float] = None) -> List[Dict]:
    """One billed SerpAPI google_maps search (~20 results). No caching here."""
    global serpapi_calls
    _ensure_key()

    params = {
        "engine": "google_maps",
        "q": (query or "").strip(),
        "type": "search",
        "google_domain": "google.co.in",
        "gl": "in",
        "hl": "en",
        "api_key": SERPAPI_KEY,
    }
    if coords:
        lat, lng = coords
        params["ll"] = f"@{lat:.7f},{lng:.7f},15z"
        params["center"] = f"{lat:.7f},{lng:.7f}"
        params["radius"] = str(min(int(radius_m or 5000), 50000))

    serpapi_calls += 1
    logger.info("SerpAPI call #%d: %r", serpapi_calls, params["q"])
    resp = requests.get("https://serpapi.com/search", params=params, timeout=15)
    if resp.status_code != 200:
        try:
            err = resp.json().get("error") or resp.text
        except Exception:
            err = resp.text
        raise RuntimeError(f"SerpAPI request failed: {resp.status_code} {err}")
    j = resp.json()

    local = j.get("local_results") or j.get("places_results") or []
    places = []
    for item in local:
        try:
            places.append(_parse_place(item))
        except Exception:
            continue

    # fallback shape: organic_results (no coords/rating)
    if not places:
        for item in j.get("organic_results") or []:
            places.append({
                "place_id": "", "title": item.get("title") or "", "address": item.get("snippet") or "",
                "rating": 0, "price": "", "type": "", "link": item.get("link") or "",
                "thumbnail": None, "lat": None, "lng": None,
                "description": "", "snippet": item.get("snippet") or "", "reviews": [],
            })

    # Best-effort geocode for missing coords, capped; stop on first failure
    # (a Nominatim block would otherwise stall the whole page).
    missing = [p for p in places if p["lat"] is None and p.get("address")]
    for p in missing[:5]:
        geoc = geocode_address(p["address"])
        if not geoc:
            break
        p["lat"], p["lng"] = geoc

    return places


def search_places(query: str, coords: Optional[Tuple[float, float]] = None,
                  radius_m: Optional[float] = None) -> List[Dict]:
    """Cached search: shared across users in the same ~1km cell for 7 days."""
    coords = normalize_coords(coords)
    key = _cache_key(query, coords, radius_m)
    hit = cache.get(key)
    if hit is not None:
        logger.info("search cache hit: %s", key)
        return hit
    places = fetch_places_page(query, coords, radius_m)
    if places:
        cache.set(key, places, SEARCH_TTL)
    return places


def get_places(query: str, num_results: int = 20, coords=None, place_type: Optional[str] = None,
               location_hint: Optional[str] = None, max_distance_meters: Optional[float] = 3000) -> List[Dict]:
    """Compatibility shim for the pre-restructure planner: cached search +
    distance annotation/filter/sort. planner.py moves to search_places directly."""
    q = (query or "").strip()
    if place_type:
        q = f"{q} {place_type}".strip()
    if location_hint:
        q = f"{q} near {location_hint}".strip()

    coords_tuple = normalize_coords(coords)
    places = [dict(p) for p in search_places(q, coords_tuple, max_distance_meters)]

    if coords_tuple and max_distance_meters:
        anchor_lat, anchor_lng = coords_tuple
        kept = []
        for p in places:
            if p.get("lat") is not None and p.get("lng") is not None:
                d = haversine_meters(anchor_lat, anchor_lng, float(p["lat"]), float(p["lng"]))
                if d > max_distance_meters:
                    continue
                p["distance_meters"] = d
            else:
                p["distance_meters"] = None
            kept.append(p)
        kept.sort(key=lambda x: (
            x["distance_meters"] if x["distance_meters"] is not None else float("inf"),
            -float(x.get("rating") or 0),
        ))
        places = kept

    return places[:num_results]

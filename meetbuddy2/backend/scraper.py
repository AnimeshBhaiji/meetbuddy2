# scraper.py
import os
import requests
from dotenv import load_dotenv
from typing import List, Dict, Optional, Tuple
import time
import hashlib

load_dotenv()
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

NOMINATIM_USER_AGENT = "MeetBuddyPlanner/1.0 (meetbuddy@example.com)"

# Simple in-memory cache for API responses (TTL: 1 hour)
_API_CACHE: Dict[str, Tuple[List[Dict], float]] = {}
_CACHE_TTL = 3600  # 1 hour in seconds
_MAX_CACHE_SIZE = 100  # Limit cache size to prevent memory issues


def _ensure_key():
    if not SERPAPI_KEY:
        raise ValueError("SerpAPI key not found. Please set SERPAPI_KEY in your .env file.")


def _normalize_coords(coords) -> Optional[Tuple[float, float]]:
    """Normalize various coord shapes into (lat, lng) tuple or None."""
    if not coords:
        return None
    try:
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            return float(coords[0]), float(coords[1])
        if isinstance(coords, dict):
            lat = coords.get("lat") or coords.get("latitude")
            lng = coords.get("lng") or coords.get("lon") or coords.get("longitude")
            if lat is not None and lng is not None:
                return float(lat), float(lng)
    except Exception:
        return None
    return None


def _geocode_address_nominatim(address: str) -> Optional[Tuple[float, float]]:
    """
    Best-effort geocode using Nominatim if SerpAPI didn't return coordinates.
    Respect rate limits (light use).
    """
    if not address or not address.strip():
        return None
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": address, "format": "jsonv2", "limit": 1}
        headers = {"User-Agent": NOMINATIM_USER_AGENT}
        resp = requests.get(url, params=params, headers=headers, timeout=8)
        if resp.status_code != 200:
            return None
        j = resp.json()
        if not j:
            return None
        first = j[0]
        return float(first.get("lat")), float(first.get("lon"))
    except Exception:
        return None


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth (in meters).
    Uses the Haversine formula.
    """
    from math import radians, sin, cos, sqrt, atan2
    R = 6371000  # Earth radius in meters
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def _make_cache_key(query: str, coords: Optional[Tuple[float, float]], place_type: Optional[str], location_hint: Optional[str]) -> str:
    """Create a cache key from query parameters."""
    # Round coords to 3 decimal places (~100m precision) for cache hits
    coords_str = ""
    if coords:
        coords_str = f"{round(coords[0], 3)},{round(coords[1], 3)}"
    key_data = f"{query}|{coords_str}|{place_type}|{location_hint}"
    return hashlib.md5(key_data.encode()).hexdigest()


def _get_cached_result(cache_key: str) -> Optional[List[Dict]]:
    """Get cached result if available and not expired."""
    if cache_key in _API_CACHE:
        result, timestamp = _API_CACHE[cache_key]
        if time.time() - timestamp < _CACHE_TTL:
            print(f"💾 Cache hit for query")
            return result
        else:
            # Expired, remove from cache
            _API_CACHE.pop(cache_key, None)
    return None


def _set_cached_result(cache_key: str, result: List[Dict]):
    """Store result in cache, with size limit."""
    # Clean up old entries if cache is too large
    if len(_API_CACHE) >= _MAX_CACHE_SIZE:
        # Remove oldest 20% of entries
        sorted_items = sorted(_API_CACHE.items(), key=lambda x: x[1][1])
        for key, _ in sorted_items[:max(1, _MAX_CACHE_SIZE // 5)]:
            _API_CACHE.pop(key, None)
    
    _API_CACHE[cache_key] = (result, time.time())


def get_places(
    query: str,
    num_results: int = 20,
    coords: Optional[Tuple[float, float]] = None,
    place_type: Optional[str] = None,
    location_hint: Optional[str] = None,
    max_distance_meters: Optional[float] = 3000
) -> List[Dict]:
    """
    Uses SerpAPI google_maps engine to fetch places.
    - query: base textual query (e.g., "romantic restaurants")
    - coords: (lat, lng) tuple for spatial bias
    - place_type: optional (e.g., "restaurant", "hotel")
    - location_hint: optional textual location (e.g., "Koramangala, Bangalore")
    Returns list of place dicts with at least: title, address, rating, link, lat, lng.
    """
    # Check cache first
    cache_key = _make_cache_key(query, coords, place_type, location_hint)
    cached = _get_cached_result(cache_key)
    if cached is not None:
        # Return cached results, but still filter by distance if needed
        if max_distance_meters and coords:
            coords_tuple = _normalize_coords(coords)
            if coords_tuple:
                anchor_lat, anchor_lng = coords_tuple
                valid_places = []
                for p in cached:
                    p_lat = p.get("lat")
                    p_lng = p.get("lng")
                    if p_lat is not None and p_lng is not None:
                        try:
                            distance = _haversine_distance(anchor_lat, anchor_lng, float(p_lat), float(p_lng))
                            if distance <= max_distance_meters:
                                p["distance_meters"] = distance
                                valid_places.append(p)
                        except Exception:
                            pass
                return valid_places[:num_results]
        return cached[:num_results]
    
    _ensure_key()
    base_url = "https://serpapi.com/search"

    # Build user-visible q without coordinates embedded inside
    q = (query or "").strip()
    if place_type:
        q = f"{q} {place_type}".strip()
    if location_hint:
        q = f"{q} near {location_hint}".strip()

    params = {
        "engine": "google_maps",
        "q": q,
        "type": "search",
        "google_domain": "google.co.in",
        "gl": "in",
        "hl": "en",
        "api_key": SERPAPI_KEY,
    }

    # Add spatial bias params (center/ll & radius)
    coords_tuple = _normalize_coords(coords)
    if coords_tuple:
        lat, lng = coords_tuple
        # SerpAPI expects ll like "@lat,lng,zoomz" (zoom optional) and center "lat,lng"
        # Use requested max_distance_meters for SerpAPI radius, cap at 50km for safety
        radius_val = int(max_distance_meters) if max_distance_meters else 5000
        params["ll"] = f"@{lat:.7f},{lng:.7f},15z"
        params["center"] = f"{lat:.7f},{lng:.7f}"
        params["radius"] = str(min(radius_val, 50000))

    # Send request
    resp = requests.get(base_url, params=params, timeout=15)
    if resp.status_code != 200:
        # SerpAPI returns json error body
        try:
            j = resp.json()
            err = j.get("error") or resp.text
        except Exception:
            err = resp.text
        raise RuntimeError(f"SerpAPI request failed: {resp.status_code} {err}")

    j = resp.json()

    # SerpAPI may return results in 'local_results', 'places_results' or 'local_results'
    local = j.get("local_results") or j.get("places_results") or j.get("local_results") or []
    places = []

    # sometimes serpapi wraps results deeper; best-effort loop
    for item in local:
        try:
            place_id = item.get("place_id") or item.get("id") or item.get("cid") or ""
            address = item.get("address") or item.get("vicinity") or item.get("Address") or ""
            title = item.get("title") or item.get("name") or item.get("Name") or ""
            rating = item.get("rating") or item.get("Rating") or 0

            # coordinates extraction attempts (various SerpAPI shapes)
            lat = None
            lng = None
            # common: item may include 'gps' as "lat,lng"
            gps = item.get("gps") or item.get("gps_coordinates")
            if isinstance(gps, str) and "," in gps:
                try:
                    p0, p1 = gps.split(",")[:2]
                    lat = float(p0); lng = float(p1)
                except Exception:
                    lat = None; lng = None
            # other shape: nested dict
            if lat is None and isinstance(gps, dict):
                lat = gps.get("latitude") or gps.get("lat")
                lng = gps.get("longitude") or gps.get("lng")
                try:
                    if lat is not None: lat = float(lat)
                    if lng is not None: lng = float(lng)
                except Exception:
                    lat = None; lng = None

            # some responses include lat/lng keys directly
            if (lat is None or lng is None) and ("lat" in item and "lng" in item):
                try:
                    lat = float(item.get("lat"))
                    lng = float(item.get("lng"))
                except Exception:
                    lat = None; lng = None

            # Extract description/snippet and reviews for analysis
            description = item.get("description") or item.get("snippet") or ""
            snippet = item.get("snippet") or ""
            
            # Extract reviews if available
            reviews = []
            reviews_data = item.get("reviews") or item.get("user_reviews") or []
            if isinstance(reviews_data, list):
                for review in reviews_data[:5]:  # Top 5 reviews
                    if isinstance(review, dict):
                        review_text = review.get("snippet") or review.get("text") or review.get("review") or ""
                        if review_text:
                            reviews.append(review_text)
                    elif isinstance(review, str):
                        reviews.append(review)

            # link & thumbnail
            maps_link = item.get("link") or item.get("Google Maps Link") or (f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else "")
            thumbnail = None
            try:
                photos = item.get("photos") or []
                if photos and isinstance(photos, list) and photos[0].get("photo_url"):
                    thumbnail = photos[0].get("photo_url")
                else:
                    thumbnail = item.get("serpapi_thumbnail")
            except Exception:
                thumbnail = item.get("serpapi_thumbnail")

            places.append({
                "place_id": place_id,
                "title": title,
                "address": address,
                "rating": rating,
                "link": maps_link,
                "thumbnail": thumbnail,
                "lat": lat,
                "lng": lng,
                "description": description,
                "snippet": snippet,
                "reviews": reviews,
                "raw": item,
            })
        except Exception:
            continue

    # fallback: sometimes serpapi returns no local results, look into organic_results
    if not places:
        organic = j.get("organic_results") or []
        for item in organic:
            title = item.get("title") or item.get("name") or ""
            snippet = item.get("snippet") or ""
            places.append({
                "place_id": "",
                "title": title,
                "address": snippet,
                "rating": 0,
                "link": item.get("link") or "",
                "thumbnail": None,
                "lat": None,
                "lng": None,
                "raw": item,
            })

    # If some places missing lat/lng, try geocoding addresses (best-effort, low rate)
    need_geocode = [p for p in places if (p.get("lat") is None or p.get("lng") is None) and p.get("address")]
    if need_geocode:
        # Nominatim has usage policy; do rapid but limited geocoding with sleep
        for p in need_geocode:
            try:
                geoc = _geocode_address_nominatim(p.get("address"))
                time.sleep(1.0)  # polite pause
                if geoc:
                    p["lat"], p["lng"] = geoc[0], geoc[1]
            except Exception:
                continue

    # Filter by distance if coords provided and max_distance specified
    coords_tuple = _normalize_coords(coords)
    if coords_tuple and max_distance_meters:
        anchor_lat, anchor_lng = coords_tuple
        valid_places = []
        for p in places:
            p_lat = p.get("lat")
            p_lng = p.get("lng")
            if p_lat is not None and p_lng is not None:
                try:
                    distance = _haversine_distance(anchor_lat, anchor_lng, float(p_lat), float(p_lng))
                    if distance <= max_distance_meters:
                        p["distance_meters"] = distance
                        valid_places.append(p)
                except Exception:
                    # If distance calc fails, include the place but mark distance as None
                    p["distance_meters"] = None
                    valid_places.append(p)
            else:
                # Places without coords are included but marked
                p["distance_meters"] = None
                valid_places.append(p)
        places = valid_places
        
        # Sort by distance (closest first), then by rating
        places.sort(key=lambda x: (
            x.get("distance_meters") if x.get("distance_meters") is not None else float('inf'),
            -float(x.get("rating", 0))
        ))

    # Cache the full result (before distance filtering and trimming)
    _set_cached_result(cache_key, places)
    
    # Trim to requested count (but we fetched more to have better selection)
    return places[:num_results]

# scraper.py
import os
import requests
from dotenv import load_dotenv
from typing import Optional, Tuple, List, Dict, Any

load_dotenv()
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
SERPAPI_URL = "https://serpapi.com/search"

def _make_params(query: str, num_results: int = 10, coords: Optional[Tuple[float,float]] = None):
    params = {
        "engine": "google_maps",
        "q": query,
        "type": "search",
        "api_key": SERPAPI_KEY,
        "google_domain": "google.co.in",
        "gl": "in",
        "hl": "en",
    }
    if coords and isinstance(coords, (tuple, list)) and len(coords) >= 2:
        lat, lng = float(coords[0]), float(coords[1])
        params["ll"] = f"{lat},{lng}"
    return params

def get_restaurants(query: str, num_results: int = 10, coords: Optional[Tuple[float,float]] = None) -> List[Dict[str, Any]]:
    if not SERPAPI_KEY:
        raise ValueError("SerpAPI key not found. Please set SERPAPI_KEY in your environment (.env)")

    params = _make_params(query, num_results=num_results, coords=coords)
    try:
        print("🔧 SerpAPI params:", params)
        resp = requests.get(SERPAPI_URL, params=params, timeout=12)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        raise Exception(f"SerpAPI request failed: {e}")

    local_results = data.get("local_results") or data.get("places_results") or data.get("results") or []
    if not local_results:
        local_results = data.get("places") or data.get("organic_results") or []

    places = []
    for res in local_results:
        place_id = res.get("place_id") or res.get("id") or res.get("serpapi_place_id", "")
        maps_link = f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else res.get("link") or res.get("url") or ""
        photos = res.get("photos") or []
        photo_url = None
        if photos and isinstance(photos, list):
            first = photos[0]
            if isinstance(first, dict):
                photo_url = first.get("photo_url") or first.get("thumbnail") or None
            elif isinstance(first, str):
                photo_url = first
        elif res.get("serpapi_thumbnail"):
            photo_url = res.get("serpapi_thumbnail")

        rating = res.get("rating") or res.get("stars") or 0
        reviews = res.get("reviews") or res.get("user_ratings_total") or res.get("reviews_count") or 0

        places.append({
            "Name": res.get("title") or res.get("name") or res.get("position") or "Unnamed Place",
            "Address": res.get("address") or res.get("vicinity") or res.get("snippet") or "",
            "Phone": res.get("phone") or res.get("phone_number") or "",
            "Website": res.get("website") or res.get("link") or "",
            "Rating": rating,
            "Reviews Count": reviews,
            "Timings": res.get("hours") or res.get("opening_hours") or "",
            "Price": res.get("price") or "",
            "Type": res.get("type") or "",
            "Google Maps Link": maps_link,
            "Thumbnail": photo_url,
            "raw": res,
        })

    if not places:
        organic = data.get("organic_results") or []
        for r in organic:
            places.append({
                "Name": r.get("title") or r.get("name") or "Unnamed",
                "Address": r.get("snippet") or "",
                "Rating": r.get("rating") or 0,
                "Google Maps Link": r.get("link") or "",
                "Thumbnail": None,
                "raw": r,
            })

    try:
        places.sort(key=lambda x: (x.get("Reviews Count") or 0), reverse=True)
    except Exception:
        pass

    return places[:num_results]

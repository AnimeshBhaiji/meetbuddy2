# scraper.py
import os
import serpapi
from dotenv import load_dotenv

load_dotenv()

SERPAPI_KEY = os.getenv("SERPAPI_KEY")

def get_restaurants(query: str, num_results: int = 10):
    if not SERPAPI_KEY:
        raise ValueError("SerpAPI key not found. Please set SERPAPI_KEY in your .env file.")

    params = {
        "engine": "google_maps",
        "q": query,
        "type": "search",
        "api_key": SERPAPI_KEY
    }

    search = serpapi.search(params)
    results = search.as_dict()
    local_results = results.get("local_results") or results.get("places_results") or []

    restaurants = []
    for res in local_results:
        place_id = res.get("place_id", "")
        maps_link = f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else "N/A"

        photos = res.get("photos", [])
        photo_url = photos[0].get("photo_url") if photos else res.get("serpapi_thumbnail")

        restaurants.append({
            "Name": res.get("title"),
            "Address": res.get("address"),
            "Phone": res.get("phone", "N/A"),
            "Website": res.get("website", "N/A"),
            "Rating": res.get("rating", 0),
            "Reviews Count": res.get("reviews", 0),
            "Timings": res.get("hours", "N/A"),
            "Price": res.get("price", "N/A"),
            "Type": res.get("type", "N/A"),
            "Google Maps Link": maps_link,
            "Thumbnail": photo_url # res.get("serpapi_thumbnail", None)
        })

    restaurants.sort(key=lambda x: x["Reviews Count"], reverse=True)
    return restaurants[:num_results]

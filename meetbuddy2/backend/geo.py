# geo.py — single home for distance math, coord normalization, and
# cached Nominatim geocoding (forward + reverse).
import logging
import os
import time
from math import atan2, cos, radians, sin, sqrt
from typing import Optional, Tuple

import requests

import cache

logger = logging.getLogger(__name__)

# Nominatim policy requires a real contact; set NOMINATIM_CONTACT in .env
NOMINATIM_CONTACT = os.getenv("NOMINATIM_CONTACT", "meetbuddy@example.com")
NOMINATIM_USER_AGENT = f"MeetBuddyPlanner/1.0 ({NOMINATIM_CONTACT})"
GEOCODE_TTL = 90 * 24 * 3600  # coordinates of an address don't move


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points, in meters."""
    R = 6371000
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def normalize_coords(coords) -> Optional[Tuple[float, float]]:
    """Normalize list/tuple/dict coord shapes into a (lat, lng) tuple or None."""
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


def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """Address -> (lat, lng) via Nominatim, cached 90 days (misses cached too,
    so repeated bad addresses don't re-pay the polite 1s sleep)."""
    if not address or not address.strip():
        return None
    key = f"geocode:{address.strip().lower()}"
    hit = cache.get(key)
    if hit is not None:
        return (hit[0], hit[1]) if hit else None
    coords = None
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "jsonv2", "limit": 1},
            headers={"User-Agent": NOMINATIM_USER_AGENT},
            timeout=8,
        )
        time.sleep(1.0)  # Nominatim usage policy — live calls only
        if resp.status_code != 200:
            logger.warning("geocode HTTP %s for %r", resp.status_code, address)
            return None  # transient/blocked: don't cache
        if resp.json():
            first = resp.json()[0]
            coords = (float(first.get("lat")), float(first.get("lon")))
    except Exception as e:
        logger.warning("geocode failed for %r: %s", address, e)
        return None
    cache.set(key, list(coords) if coords else [], GEOCODE_TTL)
    return coords


def reverse_geocode_to_text(coords) -> Optional[str]:
    """Coords -> short human area name ("Koramangala, Bengaluru"), cached 90 days."""
    ct = normalize_coords(coords)
    if not ct:
        return None
    lat, lon = ct
    key = f"revgeo:{lat:.3f}:{lon:.3f}"
    hit = cache.get(key)
    if hit is not None:
        return hit or None
    name = None
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"format": "jsonv2", "lat": lat, "lon": lon, "addressdetails": 1},
            headers={"User-Agent": NOMINATIM_USER_AGENT},
            timeout=8,
        )
        time.sleep(1.0)
        if resp.status_code != 200:
            logger.warning("reverse geocode HTTP %s for %s,%s", resp.status_code, lat, lon)
            return None  # transient/blocked: don't cache
        data = resp.json()
        addr = data.get("address", {}) or {}
        parts = []
        for k in ("suburb", "neighbourhood", "neighborhood", "quarter", "village", "hamlet", "locality"):
            if addr.get(k):
                parts.append(addr[k])
                break
        for k in ("city", "town", "village", "county", "state"):
            v = addr.get(k)
            if v and v not in parts:
                parts.append(v)
                break
        if parts:
            name = ", ".join(parts)
        elif data.get("display_name"):
            name = data["display_name"].split(",")[0].strip()
    except Exception as e:
        logger.warning("reverse geocode failed for %s,%s: %s", lat, lon, e)
        return None
    cache.set(key, name or "", GEOCODE_TTL)
    return name

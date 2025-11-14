# classifier.py
"""
Simple heuristics to score and tag scraped places according to user preferences.

This is intentionally small & interpretable:
 - score based on rating and presence of keywords in title/reviews/types
 - return tags like ['food','outdoor','stay','kids','nightlife','music']
"""

from typing import Dict, Any, List
import re

KEYWORD_TAG_MAP = {
    "live": ["music", "nightlife"],
    "music": ["music", "nightlife"],
    "bar": ["nightlife", "drinks"],
    "pub": ["nightlife", "drinks"],
    "rooftop": ["nightlife", "romantic"],
    "romantic": ["romantic"],
    "park": ["outdoor", "family", "kids"],
    "play": ["kids", "play"],
    "hotel": ["stay"],
    "resort": ["stay"],
    "spa": ["wellness", "relax"],
    "cafe": ["food", "coffee"],
    "restaurant": ["food"],
    "fine dining": ["food", "romantic"],
    "buffet": ["food"],
    "museum": ["culture"],
    "mall": ["shopping"],
    "amusement": ["kids", "play"],
    "beach": ["outdoor", "scenic"],
}

def extract_texts(place: Dict[str, Any]) -> str:
    texts = []
    if place.get("title"):
        texts.append(str(place["title"]))
    if place.get("address"):
        texts.append(str(place["address"]))
    # reviews may be list of dicts or strings
    revs = place.get("reviews") or []
    if isinstance(revs, list):
        for r in revs[:3]:
            if isinstance(r, dict):
                texts.append(r.get("snippet") or r.get("text") or "")
            else:
                texts.append(str(r))
    types = place.get("types") or []
    if isinstance(types, list):
        texts.extend(types)
    return " ".join([t for t in texts if t]).lower()

def tag_place(place: Dict[str, Any]) -> List[str]:
    txt = extract_texts(place)
    tags = set()
    for kw, tlist in KEYWORD_TAG_MAP.items():
        if kw in txt:
            for t in tlist:
                tags.add(t)
    # heuristics: rating > 4 -> 'popular'
    try:
        if float(place.get("rating", 0)) >= 4.2:
            tags.add("popular")
    except Exception:
        pass
    # if 'restaurant' or 'cafe' in types -> food
    types = [t.lower() for t in (place.get("types") or [])]
    for t in types:
        if "rest" in t or "cafe" in t or "food" in t:
            tags.add("food")
        if "hotel" in t or "lodg" in t:
            tags.add("stay")
        if "park" in t or "garden" in t:
            tags.add("outdoor")
    return list(tags)

def score_place(place: Dict[str, Any], prefs: Dict[str, List[str]]) -> float:
    """
    Return a numeric score for ranking. prefs is normalized labels map.
    Example prefs: { "addOnMagic": ["Live music spots"], "memorableFactor": ["Amazing food"] }
    """
    base = 0.0
    # rating influence
    try:
        rating = float(place.get("rating", 0) or 0)
        base += max(0.0, (rating - 3.0)) * 2.0  # small boost above 3.0
    except Exception:
        pass

    txt = extract_texts(place)

    # Preference keywords mapping (simple)
    pref_kw_map = {
        "Live music spots": ["live music", "live band", "acoustic", "open mic"],
        "Amazing food": ["best food", "amazing food", "delicious", "tasty", "chef"],
        "A unique place": ["unique", "themed", "concept"],
        "Deep conversations / Capture moments": ["quiet", "cozy", "intimate", "photogenic", "photo"],
        "Easy rides arranged": ["valet", "parking", "rideshare"],
        "Weekend escape": ["resort", "getaway", "retreat", "outstation"],
        # add mappings as needed
    }

    for cat, labels in prefs.items():
        for lab in (labels or []):
            kws = pref_kw_map.get(lab, [])
            for kw in kws:
                if kw in txt:
                    base += 1.5

    # tag boosts
    tags = tag_place(place)
    if "popular" in tags:
        base += 0.8
    if "food" in tags and any("Amazing food" in v for v in (prefs.get("memorableFactor") or [])):
        base += 1.0
    if "music" in tags and any("Live music" in v for v in (prefs.get("addOnMagic") or [])):
        base += 1.0

    return base

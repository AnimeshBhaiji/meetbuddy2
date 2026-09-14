# place_analyzer.py
"""
Intelligent place analysis module for MeetBuddy planner.
Analyzes restaurants and places based on descriptions, reviews, and metadata
to match user preferences for mood, atmosphere and seating.
"""

from typing import Any, Dict


def analyze_mood_fit(place: Dict[str, Any], user_mood: str, mood_subs: Dict = None) -> Dict:
    """
    Analyze if place matches user's mood preference.
    
    Args:
        place: Place dict with title, description, reviews
        user_mood: Main mood (e.g., "Romantic", "Business-y", "Casual")
        mood_subs: Stage 2 sub-preferences for mood
    
    Returns:
        Dict with mood_match_score and is_good_fit
    """
    description = place.get('description', '') + ' ' + place.get('snippet', '')
    reviews_text = ' '.join(place.get('reviews', []))
    combined_text = (description + ' ' + reviews_text).lower()
    
    # Base mood keywords
    mood_keywords = {
        'Romantic': ['romantic', 'intimate', 'candlelight', 'cozy', 'date', 'couples', 'ambiance', 'dim lighting'],
        'Business-y': ['business', 'professional', 'quiet', 'formal', 'meeting', 'corporate', 'conference'],
        'Casual': ['casual', 'relaxed', 'friendly', 'laid-back', 'informal', 'comfortable'],
        'Fun & Energetic': ['lively', 'energetic', 'vibrant', 'music', 'party', 'upbeat', 'exciting'],
        'Chill & Relaxed': ['chill', 'calm', 'peaceful', 'serene', 'tranquil', 'quiet', 'relaxing']
    }
    
    # Stage 2 specific keywords for Romantic mood
    if user_mood == 'Romantic' and mood_subs:
        setting = mood_subs.get('ro_setting') or ''
        if 'Scenic' in setting or 'view' in setting.lower():
            mood_keywords['Romantic'].extend(['view', 'scenic', 'panoramic', 'overlook', 'vista'])
        if 'Rooftop' in setting:
            mood_keywords['Romantic'].extend(['rooftop', 'terrace', 'sky', 'open air'])
        if 'Indoor' in setting:
            mood_keywords['Romantic'].extend(['indoor', 'cozy interior', 'enclosed'])
    
    base_keywords = mood_keywords.get(user_mood, [])
    matches = sum(1 for keyword in base_keywords if keyword in combined_text)
    
    # Boost score if multiple strong indicators
    score = matches
    if matches >= 3:
        score += 1  # Bonus for strong match
    
    return {
        'mood_match_score': score,
        'is_good_fit': matches >= 2,
        'matched_keywords': [kw for kw in base_keywords if kw in combined_text][:5]
    }


def detect_atmosphere(place: Dict[str, Any]) -> Dict:
    """
    Detect atmosphere characteristics (rooftop, indoor, outdoor, etc.)
    
    Returns:
        Dict with boolean flags for different atmosphere types
    """
    title = place.get('title', '').lower()
    description = place.get('description', '').lower()
    snippet = place.get('snippet', '').lower()
    combined = title + ' ' + description + ' ' + snippet
    
    return {
        'is_rooftop': any(kw in combined for kw in ['rooftop', 'terrace', 'sky', 'top floor']),
        'is_indoor': 'indoor' in combined or 'air-conditioned' in combined or 'ac' in combined,
        'is_outdoor': any(kw in combined for kw in ['outdoor', 'garden', 'patio', 'alfresco', 'open air']),
        'has_view': any(kw in combined for kw in ['view', 'scenic', 'overlook', 'panoramic']),
        'has_live_music': any(kw in combined for kw in ['live music', 'live band', 'dj', 'performance']),
        'is_quiet': any(kw in combined for kw in ['quiet', 'peaceful', 'serene', 'calm']),
        'is_lively': any(kw in combined for kw in ['lively', 'vibrant', 'energetic', 'bustling'])
    }


def detect_private_seating(place: Dict[str, Any]) -> bool:
    """Detect if place offers private seating/dining areas."""
    text = (place.get('title', '') + ' ' + place.get('description', '') + ' ' + 
            place.get('snippet', '')).lower()
    
    keywords = ['private dining', 'private room', 'private seating', 'cabins', 
                'separate area', 'exclusive seating', 'vip room']
    return any(kw in text for kw in keywords)


def analyze_stage2_preferences(place: Dict[str, Any], stage2_prefs: Dict[str, Any]) -> Dict:
    """
    Comprehensive analysis based on Stage 2 sub-preferences.
    
    Args:
        place: Place dict
        stage2_prefs: Dict containing all *_sub preferences
    
    Returns:
        Dict with analysis results and compatibility score
    """
    results = {
        'compatibility_score': 0,
        'matches': [],
        'mismatches': []
    }

    def _sub(key):
        """Sub-answers are {sub_question_id: answer}. Anything else means the
        stored shape is wrong; degrade to no signal rather than raising, since
        a scoring helper should never take down a plan request."""
        val = stage2_prefs.get(key)
        return val if isinstance(val, dict) else {}

    # Mood sub-preferences
    mood_sub = _sub('mood_sub')
    if mood_sub:
        atm = detect_atmosphere(place)
        
        # Romantic setting preferences
        ro_setting = mood_sub.get('ro_setting') or ''
        if 'Scenic' in ro_setting and atm['has_view']:
            results['compatibility_score'] += 2
            results['matches'].append('Scenic view available')
        if 'Rooftop' in ro_setting and atm['is_rooftop']:
            results['compatibility_score'] += 2
            results['matches'].append('Rooftop seating')
        if 'Indoor' in ro_setting and atm['is_indoor']:
            results['compatibility_score'] += 1
            results['matches'].append('Indoor seating')
    
    # Planning style sub-preferences
    planning_sub = _sub('planningStyle_sub')
    if planning_sub:
        fc_filters = planning_sub.get('fc_filters') or []
        if isinstance(fc_filters, list):
            if 'Private seating' in fc_filters and detect_private_seating(place):
                results['compatibility_score'] += 2
                results['matches'].append('Private seating available')
            if 'Live music' in fc_filters:
                atm = detect_atmosphere(place)
                if atm['has_live_music']:
                    results['compatibility_score'] += 2
                    results['matches'].append('Live music')

    return results

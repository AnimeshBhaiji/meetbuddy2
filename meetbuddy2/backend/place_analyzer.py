# place_analyzer.py
"""
Intelligent place analysis module for MeetBuddy planner.
Analyzes restaurants and places based on descriptions, reviews, and metadata
to match user preferences for mood, atmosphere, parking, and other amenities.
"""

from typing import Dict, List, Any, Optional


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


def detect_parking(place: Dict[str, Any], parking_required: bool = False) -> Dict:
    """
    Detect parking availability from reviews and description.
    
    Args:
        place: Place dict
        parking_required: If True from user preferences, prioritize parking detection
    
    Returns:
        Dict with status ('available', 'unavailable', 'unknown') and has_valet flag
    """
    reviews_text = ' '.join(place.get('reviews', [])).lower()
    description = place.get('description', '').lower()
    snippet = place.get('snippet', '').lower()
    combined = reviews_text + ' ' + description + ' ' + snippet
    
    # Positive parking indicators
    positive_keywords = [
        'parking available', 'ample parking', 'parking lot', 
        'free parking', 'parking space', 'easy parking',
        'plenty of parking', 'good parking', 'parking facility'
    ]
    has_parking = any(kw in combined for kw in positive_keywords)
    
    # Valet parking
    valet_keywords = ['valet', 'valet parking', 'car service', 'valet service']
    has_valet = any(kw in combined for kw in valet_keywords)
    
    # Negative parking indicators
    negative_keywords = [
        'no parking', 'difficult to park', 'parking issue',
        'hard to find parking', 'limited parking', 'parking problem',
        'street parking only', 'parking nightmare'
    ]
    no_parking = any(kw in combined for kw in negative_keywords)
    
    if no_parking and not has_valet:
        return {'status': 'unavailable', 'has_valet': False, 'confidence': 'high'}
    elif has_valet:
        return {'status': 'available', 'has_valet': True, 'confidence': 'high'}
    elif has_parking:
        return {'status': 'available', 'has_valet': False, 'confidence': 'medium'}
    else:
        return {'status': 'unknown', 'has_valet': False, 'confidence': 'low'}


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
    
    # Mood sub-preferences
    mood_sub = stage2_prefs.get('mood_sub') or {}
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
    planning_sub = stage2_prefs.get('planningStyle_sub') or {}
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
    
    # Adventure level sub-preferences
    adventure_sub = stage2_prefs.get('adventureLevel_sub') or {}
    if adventure_sub:
        sc_transport = adventure_sub.get('sc_transport') or ''
        if 'Parking' in sc_transport:
            parking = detect_parking(place, parking_required=True)
            if parking['status'] == 'available':
                results['compatibility_score'] += 1
                if parking['has_valet']:
                    results['compatibility_score'] += 1
                    results['matches'].append('Valet parking available')
                else:
                    results['matches'].append('Parking available')
            elif parking['status'] == 'unavailable':
                results['compatibility_score'] -= 1
                results['mismatches'].append('Limited parking')
    
    return results


def calculate_distance_category(distance_meters: float) -> str:
    """
    Categorize distance from user location.
    
    Returns:
        'very_close' (<2km), 'close' (2-5km), 'moderate' (5-15km), 
        'far' (15-30km), 'very_far' (>30km)
    """
    if distance_meters < 2000:
        return 'very_close'
    elif distance_meters < 5000:
        return 'close'
    elif distance_meters < 15000:
        return 'moderate'
    elif distance_meters < 30000:
        return 'far'
    else:
        return 'very_far'


def filter_by_distance_preference(
    places: List[Dict[str, Any]], 
    adventure_level: str,
    area_preference: str = None,
    distance_preference: str = None
) -> List[Dict[str, Any]]:
    """
    Filter places based on adventure level and distance preferences.
    
    Args:
        places: List of places with distance_meters
        adventure_level: Main adventure preference
        area_preference: Stage 2 area preference (Central, Suburbs, etc.)
        distance_preference: Stage 2 distance preference (20-30km, etc.)
    """
    filtered = []
    
    for place in places:
        dist = place.get('distance_meters', 0)
        category = calculate_distance_category(dist)
        
        include = False
        
        # Weekend escape - prefer far places
        if adventure_level == 'Weekend escape':
            if distance_preference:
                if '20-30km' in distance_preference and 15000 <= dist <= 30000:
                    include = True
                elif '30-50km' in distance_preference and 30000 <= dist <= 50000:
                    include = True
                elif '50km+' in distance_preference and dist >= 50000:
                    include = True
            else:
                # Default: Relaxed to 5-60km range (was 20-50km which killed results)
                include = 5000 <= dist <= 60000
        
        # Short drive to hidden gem - moderate distance
        elif adventure_level == 'Short drive to hidden gem':
            # Relaxed to 3-40km (was 10-30km)
            include = 3000 <= dist <= 40000
        
        # Stick to the city - respect area preference
        elif adventure_level == 'Stick to the city':
            if area_preference:
                if 'Central' in area_preference or 'Downtown' in area_preference:
                    include = dist <= 10000  # Within 10km
                elif 'Suburbs' in area_preference:
                    include = 10000 <= dist <= 20000
                elif 'Either' in area_preference:
                    include = dist <= 20000
            else:
                # Default: within city limits (20km)
                include = dist <= 20000
        
        else:
            # No specific adventure level, include all
            include = True
        
        if include:
            place['distance_category'] = category
            filtered.append(place)
    
    return filtered

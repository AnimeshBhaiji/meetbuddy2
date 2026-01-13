# itinerary_manager.py
"""
Itinerary management module for MeetBuddy planner.
Handles adding, removing, and reordering places in user itineraries.
"""

from typing import Dict, List, Any, Optional
from planner_sessions import get_session, update_session
import time


def get_itinerary(session_id: str) -> List[Dict[str, Any]]:
    """
    Get the current itinerary for a session.
    
    Returns:
        List of places in order
    """
    session = get_session(session_id)
    if not session:
        return []
    
    return session.get('itinerary', [])


def add_place_to_itinerary(session_id: str, place: Dict[str, Any], position: Optional[int] = None) -> Dict:
    """
    Add a place to the itinerary at a specific position.
    
    Args:
        session_id: Session ID
        place: Place dict to add
        position: Position to insert (None = append to end)
    
    Returns:
        Updated session dict
    """
    session = get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    itinerary = session.get('itinerary', [])
    
    # Add timestamp and order info
    place_with_meta = {
        **place,
        'added_at': int(time.time()),
        'itinerary_id': f"{session_id}_{len(itinerary)}_{int(time.time())}"
    }
    
    if position is None or position >= len(itinerary):
        itinerary.append(place_with_meta)
    else:
        itinerary.insert(max(0, position), place_with_meta)
    
    # Update session
    session['itinerary'] = itinerary
    session['updated_at'] = int(time.time())
    
    # Persist to disk
    update_session(session_id, 'itinerary', itinerary)
    
    return session


def remove_place_from_itinerary(session_id: str, place_id: str) -> Dict:
    """
    Remove a place from the itinerary.
    
    Args:
        session_id: Session ID
        place_id: Place ID or itinerary_id to remove
    
    Returns:
        Updated session dict
    """
    session = get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    itinerary = session.get('itinerary', [])
    
    # Find and remove the place
    updated_itinerary = [
        p for p in itinerary 
        if p.get('place_id') != place_id and p.get('itinerary_id') != place_id
    ]
    
    if len(updated_itinerary) == len(itinerary):
        # Nothing was removed
        raise ValueError(f"Place {place_id} not found in itinerary")
    
    session['itinerary'] = updated_itinerary
    session['updated_at'] = int(time.time())
    
    # Persist to disk
    update_session(session_id, 'itinerary', updated_itinerary)
    
    return session


def reorder_itinerary(session_id: str, new_order: List[str]) -> Dict:
    """
    Reorder the itinerary based on a list of place IDs.
    
    Args:
        session_id: Session ID
        new_order: List of place_id or itinerary_id in desired order
    
    Returns:
        Updated session dict
    """
    session = get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    itinerary = session.get('itinerary', [])
    
    # Create a map of ID to place
    place_map = {}
    for place in itinerary:
        pid = place.get('place_id') or place.get('itinerary_id')
        if pid:
            place_map[pid] = place
    
    # Reorder based on new_order
    reordered = []
    for pid in new_order:
        if pid in place_map:
            reordered.append(place_map[pid])
    
    # Add any places not in new_order at the end
    for place in itinerary:
        pid = place.get('place_id') or place.get('itinerary_id')
        if pid not in new_order:
            reordered.append(place)
    
    session['itinerary'] = reordered
    session['updated_at'] = int(time.time())
    
    # Persist to disk
    update_session(session_id, 'itinerary', reordered)
    
    return session


def insert_place_after(session_id: str, after_place_id: str, new_place: Dict[str, Any]) -> Dict:
    """
    Insert a new place after a specific place in the itinerary.
    
    Args:
        session_id: Session ID
        after_place_id: ID of place to insert after
        new_place: Place dict to insert
    
    Returns:
        Updated session dict
    """
    session = get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    itinerary = session.get('itinerary', [])
    
    # Find the position of the place to insert after
    position = None
    for i, place in enumerate(itinerary):
        pid = place.get('place_id') or place.get('itinerary_id')
        if pid == after_place_id:
            position = i + 1
            break
    
    if position is None:
        raise ValueError(f"Place {after_place_id} not found in itinerary")
    
    # Use add_place_to_itinerary with the calculated position
    return add_place_to_itinerary(session_id, new_place, position)


def clear_itinerary(session_id: str) -> Dict:
    """
    Clear all places from the itinerary.
    
    Returns:
        Updated session dict
    """
    session = get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    session['itinerary'] = []
    session['updated_at'] = int(time.time())
    
    update_session(session_id, 'itinerary', [])
    
    return session

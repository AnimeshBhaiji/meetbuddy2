# cab_service.py
"""
Mock cab service integration for MeetBuddy planner.
This is a placeholder/WIP implementation ready for future Uber/Ola API integration.

TODO: Replace with actual cab service APIs when keys are available.
API Documentation:
- Uber: https://developer.uber.com/docs/riders/ride-requests/tutorials
- Ola: https://developers.olacabs.com/docs
Required environment variables:
- UBER_CLIENT_ID
- UBER_CLIENT_SECRET
- OLA_API_KEY
"""

from typing import Dict, Any, Optional
import random


def estimate_ride(origin: Dict[str, float], destination: Dict[str, float], ride_type: str = "economy") -> Dict[str, Any]:
    """
    Get a mock ride estimate between two locations.
    
    Args:
        origin: {"lat": float, "lng": float}
        destination: {"lat": float, "lng": float}
        ride_type: "economy", "premium", or "xl"
    
    Returns:
        Dict with fare estimate and ride details
    """
    # Calculate mock distance (simplified)
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371  # Earth radius in km
    lat1, lon1 = radians(origin['lat']), radians(origin['lng'])
    lat2, lon2 = radians(destination['lat']), radians(destination['lng'])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance_km = R * c
    
    # Mock pricing based on distance and ride type
    base_fare = {"economy": 50, "premium": 100, "xl": 120}
    per_km = {"economy": 12, "premium": 18, "xl": 15}
    
    base = base_fare.get(ride_type, 50)
    rate = per_km.get(ride_type, 12)
    
    # Add some randomness for realism
    fare = base + (distance_km * rate) + random.randint(-20, 20)
    fare = max(fare, base)  # Never below base fare
    
    # Mock ETA (minutes)
    eta = max(5, int(distance_km * 2.5) + random.randint(-2, 5))
    
    return {
        "status": "success",
        "is_mock": True,
        "message": "⚠️ Mock estimate - Cab integration pending API keys",
        "ride_type": ride_type,
        "distance_km": round(distance_km, 2),
        "estimated_fare": round(fare, 2),
        "currency": "INR",
        "eta_minutes": eta,
        "surge_multiplier": 1.0,
        "available_ride_types": ["economy", "premium", "xl"],
        "provider": "Mock Service (Uber/Ola integration pending)"
    }


def book_ride(origin: Dict[str, float], destination: Dict[str, float], ride_type: str = "economy") -> Dict[str, Any]:
    """
    Mock ride booking.
    
    Returns:
        Mock booking confirmation
    """
    estimate = estimate_ride(origin, destination, ride_type)
    
    # Generate mock booking ID
    import time
    booking_id = f"MOCK_{int(time.time())}_{random.randint(1000, 9999)}"
    
    return {
        "status": "pending",
        "is_mock": True,
        "message": "⚠️ Mock booking - Cab integration pending API keys",
        "booking_id": booking_id,
        "ride_type": ride_type,
        "origin": origin,
        "destination": destination,
        "estimated_fare": estimate["estimated_fare"],
        "eta_minutes": estimate["eta_minutes"],
        "driver": {
            "name": "Mock Driver",
            "rating": 4.8,
            "vehicle": "Mock Vehicle",
            "plate": "MOCK-123"
        },
        "instructions": "This is a mock booking. To enable real bookings, add Uber/Ola API keys to .env file.",
        "next_steps": [
            "1. Sign up for Uber Developer account: https://developer.uber.com",
            "2. Get API credentials (Client ID & Secret)",
            "3. Add to .env: UBER_CLIENT_ID=your_id, UBER_CLIENT_SECRET=your_secret",
            "4. Update cab_service.py to use real API calls"
        ]
    }


def get_available_ride_types(location: Dict[str, float]) -> Dict[str, Any]:
    """
    Get available ride types at a location.
    
    Returns:
        Mock list of available ride types
    """
    return {
        "status": "success",
        "is_mock": True,
        "location": location,
        "available_rides": [
            {
                "type": "economy",
                "name": "Economy",
                "description": "Affordable rides",
                "capacity": 4,
                "base_fare": 50,
                "per_km": 12
            },
            {
                "type": "premium",
                "name": "Premium",
                "description": "Comfortable sedans",
                "capacity": 4,
                "base_fare": 100,
                "per_km": 18
            },
            {
                "type": "xl",
                "name": "XL",
                "description": "SUVs for groups",
                "capacity": 6,
                "base_fare": 120,
                "per_km": 15
            }
        ]
    }


# Future implementation notes:
"""
UBER API INTEGRATION EXAMPLE:
------------------------------
from uber_rides.session import Session
from uber_rides.client import UberRidesClient

session = Session(server_token=UBER_SERVER_TOKEN)
client = UberRidesClient(session)

def estimate_ride_uber(origin, destination):
    response = client.get_price_estimates(
        start_latitude=origin['lat'],
        start_longitude=origin['lng'],
        end_latitude=destination['lat'],
        end_longitude=destination['lng']
    )
    return response.json

OLA API INTEGRATION EXAMPLE:
-----------------------------
import requests

def estimate_ride_ola(origin, destination):
    headers = {'Authorization': f'Bearer {OLA_API_KEY}'}
    params = {
        'pickup_lat': origin['lat'],
        'pickup_lng': origin['lng'],
        'drop_lat': destination['lat'],
        'drop_lng': destination['lng']
    }
    response = requests.get(
        'https://devapi.olacabs.com/v1/products',
        headers=headers,
        params=params
    )
    return response.json()
"""

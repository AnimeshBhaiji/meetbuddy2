import uuid

from database import SessionLocal
from models import Itinerary, User


def _ensure_user(db):
    user = db.query(User).first()
    if user:
        return user.id
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="Test", last_name="User", email=f"it-{tag}@test.local",
                phone=f"9{tag}", username=f"it_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.id


def test_itinerary_model_roundtrip():
    db = SessionLocal()
    try:
        uid = _ensure_user(db)
        it = Itinerary(user_id=uid, title="Test plan",
                       stops=[{"step": "restaurant", "place": {"title": "X"}, "note": ""}])
        db.add(it)
        db.commit()
        db.refresh(it)
        assert it.id is not None
        assert it.created_at is not None
        assert it.stops[0]["place"]["title"] == "X"
        db.delete(it)
        db.commit()
    finally:
        db.close()

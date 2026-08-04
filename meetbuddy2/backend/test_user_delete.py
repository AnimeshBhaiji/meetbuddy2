import uuid

import pytest
from fastapi import HTTPException

import main
from database import SessionLocal
from models import Itinerary, User


def _make_user(db):
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="Del", last_name="Test", email=f"del-{tag}@test.local",
                phone=f"6{tag}", username=f"del_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_plan(db, user_id, title="Plan"):
    it = Itinerary(user_id=user_id, title=title, stops=[])
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def test_delete_user_cascades_to_their_itineraries():
    db = SessionLocal()
    try:
        user = _make_user(db)
        _make_plan(db, user.id, "One")
        _make_plan(db, user.id, "Two")

        result = main.delete_user(user.id, db)
        assert result["message"] == "deleted"
        assert result["itineraries_deleted"] == 2

        assert db.query(User).filter(User.id == user.id).first() is None
        assert db.query(Itinerary).filter(Itinerary.user_id == user.id).count() == 0
    finally:
        db.close()


def test_delete_user_with_no_itineraries():
    db = SessionLocal()
    try:
        user = _make_user(db)
        result = main.delete_user(user.id, db)
        assert result["itineraries_deleted"] == 0
        assert db.query(User).filter(User.id == user.id).first() is None
    finally:
        db.close()


def test_delete_user_leaves_other_users_data_alone():
    """The cascade must be scoped to the deleted account."""
    db = SessionLocal()
    keeper = None
    try:
        victim = _make_user(db)
        keeper = _make_user(db)
        _make_plan(db, victim.id, "Victim plan")
        keeper_plan = _make_plan(db, keeper.id, "Keeper plan")

        main.delete_user(victim.id, db)

        assert db.query(User).filter(User.id == keeper.id).first() is not None
        assert db.query(Itinerary).filter(Itinerary.id == keeper_plan.id).first() is not None
    finally:
        if keeper:
            db.query(Itinerary).filter(Itinerary.user_id == keeper.id).delete()
            db.query(User).filter(User.id == keeper.id).delete()
            db.commit()
        db.close()


def test_delete_unknown_user_is_404():
    db = SessionLocal()
    try:
        with pytest.raises(HTTPException) as exc:
            main.delete_user(999999999, db)
        assert exc.value.status_code == 404
    finally:
        db.close()

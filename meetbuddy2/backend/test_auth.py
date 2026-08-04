import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import auth
from database import SessionLocal
from models import User


def _make_user(db):
    tag = uuid.uuid4().hex[:8]
    user = User(first_name="Auth", last_name="Test", email=f"auth-{tag}@test.local",
                phone=f"3{tag}", username=f"auth_{tag}", password="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _creds(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_token_round_trips_to_the_same_user():
    db = SessionLocal()
    user = None
    try:
        user = _make_user(db)
        token = auth.create_access_token(user)
        resolved = auth.get_current_user(_creds(token), db)
        assert resolved.id == user.id
        assert resolved.username == user.username
    finally:
        if user:
            db.query(User).filter(User.id == user.id).delete()
            db.commit()
        db.close()


def test_token_carries_a_seven_day_expiry():
    db = SessionLocal()
    user = None
    try:
        user = _make_user(db)
        payload = jwt.decode(auth.create_access_token(user), auth.JWT_SECRET,
                             algorithms=[auth.JWT_ALGORITHM])
        life = datetime.fromtimestamp(payload["exp"], timezone.utc) - datetime.now(timezone.utc)
        assert timedelta(days=6, hours=23) < life <= timedelta(days=7)
        assert payload["sub"] == str(user.id)
    finally:
        if user:
            db.query(User).filter(User.id == user.id).delete()
            db.commit()
        db.close()


def test_missing_credentials_rejected():
    db = SessionLocal()
    try:
        with pytest.raises(HTTPException) as exc:
            auth.get_current_user(None, db)
        assert exc.value.status_code == 401
    finally:
        db.close()


def test_expired_token_rejected():
    db = SessionLocal()
    user = None
    try:
        user = _make_user(db)
        past = datetime.now(timezone.utc) - timedelta(days=1)
        stale = jwt.encode({"sub": str(user.id), "exp": past}, auth.JWT_SECRET,
                           algorithm=auth.JWT_ALGORITHM)
        with pytest.raises(HTTPException) as exc:
            auth.get_current_user(_creds(stale), db)
        assert exc.value.status_code == 401
        assert "expired" in exc.value.detail.lower()
    finally:
        if user:
            db.query(User).filter(User.id == user.id).delete()
            db.commit()
        db.close()


def test_token_signed_with_another_secret_rejected():
    """The signature is the whole point — a forged token must not open anything."""
    db = SessionLocal()
    user = None
    try:
        user = _make_user(db)
        forged = jwt.encode(
            {"sub": str(user.id),
             "exp": datetime.now(timezone.utc) + timedelta(days=1)},
            "not-the-real-secret-but-long-enough-for-hs256", algorithm=auth.JWT_ALGORITHM)
        with pytest.raises(HTTPException) as exc:
            auth.get_current_user(_creds(forged), db)
        assert exc.value.status_code == 401
    finally:
        if user:
            db.query(User).filter(User.id == user.id).delete()
            db.commit()
        db.close()


def test_tampered_payload_rejected():
    """Editing the subject invalidates the signature."""
    db = SessionLocal()
    user = None
    try:
        user = _make_user(db)
        token = auth.create_access_token(user)
        head, payload, sig = token.split(".")
        other = jwt.encode({"sub": "999999"}, "a" * 32, algorithm="HS256").split(".")[1]
        with pytest.raises(HTTPException) as exc:
            auth.get_current_user(_creds(f"{head}.{other}.{sig}"), db)
        assert exc.value.status_code == 401
    finally:
        if user:
            db.query(User).filter(User.id == user.id).delete()
            db.commit()
        db.close()


def test_garbage_token_rejected():
    db = SessionLocal()
    try:
        for junk in ["", "not-a-token", "mock-token", "a.b.c"]:
            with pytest.raises(HTTPException) as exc:
                auth.get_current_user(_creds(junk), db)
            assert exc.value.status_code == 401
    finally:
        db.close()


def test_token_for_deleted_account_rejected():
    """Deleting an account must end its live sessions."""
    db = SessionLocal()
    try:
        user = _make_user(db)
        token = auth.create_access_token(user)
        db.query(User).filter(User.id == user.id).delete()
        db.commit()
        with pytest.raises(HTTPException) as exc:
            auth.get_current_user(_creds(token), db)
        assert exc.value.status_code == 401
        assert "no longer exists" in exc.value.detail.lower()
    finally:
        db.close()

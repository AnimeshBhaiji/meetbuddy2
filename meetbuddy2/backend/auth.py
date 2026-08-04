# auth.py — token issuance and verification.
#
# Identity comes from the signed token and nothing else. Routes must never take
# a user_id from the request body or query string: a caller can set that to any
# number, which is exactly the hole this replaces.
import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    # Deliberately fatal. A default secret would mean anyone could mint tokens
    # for any account, so refusing to start is the safe failure.
    raise RuntimeError(
        "JWT_SECRET is not set. Add it to meetbuddy2/backend/.env — generate one with:\n"
        '  python -c "import secrets; print(secrets.token_urlsafe(48))"'
    )

JWT_ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=7)

# auto_error=False so a missing header raises our own 401 rather than a 403.
_bearer = HTTPBearer(auto_error=False)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user.id), "username": user.username, "iat": now, "exp": now + TOKEN_TTL},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail,
                         headers={"WWW-Authenticate": "Bearer"})


def get_current_user(creds=Depends(_bearer), db: Session = Depends(get_db)) -> User:
    """FastAPI dependency: the authenticated user, or 401."""
    if creds is None or not creds.credentials:
        raise _unauthorized("Not authenticated")

    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token")

    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        raise _unauthorized("Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # A token outliving its account — deleting an account must end its session.
        raise _unauthorized("Account no longer exists")
    return user

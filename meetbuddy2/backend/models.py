from sqlalchemy import (Boolean, Column, DateTime, ForeignKey, Integer, String,
                        Text, func, text)
from sqlalchemy.dialects.postgresql import JSONB
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50))
    last_name = Column(String(50))
    email = Column(String(100), unique=True, index=True)
    phone = Column(String(20), unique=True)
    username = Column(String(50), unique=True, index=True)
    password = Column(String(200))
    # Questionnaire answers. Previously a single-slot JSON file on disk, where
    # each save overwrote whichever user had saved last.
    preferences = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"),
                         default=dict)


class ApiCache(Base):
    __tablename__ = "api_cache"

    key = Column(Text, primary_key=True)
    value = Column(JSONB, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)


class PlannerSession(Base):
    """An in-progress planning run.

    Previously a module-level dict with best-effort JSON files beside it, which
    meant a backend restart dropped whoever was mid-plan.
    """
    __tablename__ = "planner_sessions"

    session_id = Column(Text, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    payload = Column(JSONB, nullable=False, default=dict)          # prefs, coords, location
    anchor = Column(JSONB, nullable=False, default=dict)
    steps = Column(JSONB, nullable=False, default=list)            # [{step, place, ts}]
    last_options = Column(JSONB, nullable=False, default=dict)     # step -> options[]
    selected_tokens = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now(), nullable=False, index=True)


class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(Text, nullable=False)
    # When the plan happens. Both null = unscheduled (never shown on the calendar).
    # all_day = true means only the date matters; the times are the day's bounds.
    start_at = Column(DateTime(timezone=True), nullable=True, index=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    all_day = Column(Boolean, nullable=False, server_default=text("false"), default=False)
    stops = Column(JSONB, nullable=False, default=list)  # [{step, place, note}]
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now(), nullable=False)

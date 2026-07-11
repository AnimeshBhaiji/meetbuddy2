from sqlalchemy import Column, DateTime, Integer, String, Text
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


class ApiCache(Base):
    __tablename__ = "api_cache"

    key = Column(Text, primary_key=True)
    value = Column(JSONB, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)

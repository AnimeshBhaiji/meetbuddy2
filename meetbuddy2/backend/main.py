from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from models import User
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import List, Optional, Union
import json, os
from pathlib import Path
from planner import generate_plan

# -------- DATABASE SETUP --------
Base.metadata.create_all(bind=engine)
app = FastAPI()

# -------- CORS --------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ✅ allows React/Vite requests
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREF_FILE = Path("user_last_pref.json")

# -------- PASSWORD HASHING --------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# -------- FILE PATHS --------
ROOT_DIR = os.path.dirname(__file__)
PREFERENCES_FILE = os.path.join(ROOT_DIR, "preferences.json")
USER_PREFS_FILE = os.path.join(ROOT_DIR, "user_last_prefs.json")

# -------- LOAD PREFERENCES --------
try:
    with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
        PREFERENCES = json.load(f)
        if not isinstance(PREFERENCES, dict):
            print("⚠️ preferences.json invalid, resetting.")
            PREFERENCES = {}
except Exception as e:
    print(f"⚠️ Error loading preferences.json: {e}")
    PREFERENCES = {}

# -------- SCHEMAS --------
class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    username: str
    password: str

class UserLogin(BaseModel):
    identifier: str
    password: str

class UserPreferences(BaseModel):
    user_id: int
    mood: Optional[List[str]] = []
    planningStyle: Optional[List[str]] = []
    adventureLevel: Optional[List[str]] = []
    addOnMagic: Optional[List[str]] = []
    memorableFactor: Optional[List[str]] = []
    class Config:
        extra = "allow"

# -------- USER AUTH --------
@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone,
        username=user.username,
        password=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully", "user_id": new_user.id}

@app.post("/login")
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == credentials.identifier) | (User.email == credentials.identifier)
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    if not verify_password(credentials.password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    return {"message": "Login successful", "user_id": user.id, "username": user.username}

# -------- SAVE USER PREFS (in readable text) --------
@app.post("/save_preferences")
async def save_preferences(request: Request):
    data = await request.json()
    user_id = str(data.get("user_id"))

    # Read existing prefs
    if PREF_FILE.exists():
        with open(PREF_FILE, "r") as f:
            user_prefs = json.load(f)
    else:
        user_prefs = {}

    # Save the readable preferences
    user_prefs[user_id] = data

    # Write back
    with open(PREF_FILE, "w") as f:
        json.dump(user_prefs, f, indent=2)

    return {"message": "Preferences saved successfully", "data": data}

# -------- PLANNER --------
@app.post("/planner")
def planner_endpoint(prefs: UserPreferences):
    print(f"📥 Planner request: {prefs.dict()}")
    try:
        result = generate_plan(prefs.user_id, prefs.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result

# -------- READ SAVED PREFS --------
@app.get("/user_prefs/{user_id}")
def read_user_prefs(user_id: int):
    if not os.path.exists(USER_PREFS_FILE):
        raise HTTPException(status_code=404, detail="No saved preferences")
    with open(USER_PREFS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    prefs = data.get(str(user_id))
    if not prefs:
        raise HTTPException(status_code=404, detail="No prefs for this user")
    return {"user_id": user_id, "prefs": prefs}

# main.py
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from models import User
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import List, Optional
import json, os
from pathlib import Path
from planner import generate_initial_suggestions, generate_followup_suggestions
from planner_sessions import create_session, get_session, push_selection, set_last_options


# -------- DATABASE SETUP --------
Base.metadata.create_all(bind=engine)
app = FastAPI()

# -------- CORS --------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- FILE PATHS (UNIFIED) --------
ROOT_DIR = os.path.dirname(__file__)
PREFERENCES_FILE = os.path.join(ROOT_DIR, "preferences.json")
USER_PREFS_FILE = os.path.join(ROOT_DIR, "user_last_prefs.json")
PREF_FILE = Path(USER_PREFS_FILE)

# -------- PASSWORD HASHING --------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# -------- LOAD PREFERENCES (optional) --------
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

@app.get("/user/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.id,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "email": user.email,
        "contact": user.phone,
        "username": user.username,
    }

# -------------------------------
# Helper: normalize incoming value -> list of strings
# -------------------------------
def _to_list_of_strings(v):
    """
    Convert incoming value v to a list of non-empty trimmed strings.
    Handles: None, list, string, number, dict-of-boolean flags (returns keys where true).
    """
    if v is None:
        return []
    if isinstance(v, list):
        out = []
        for x in v:
            if x is None:
                continue
            s = str(x).strip()
            if s:
                out.append(s)
        return out
    if isinstance(v, (int, float)):
        s = str(v).strip()
        return [s] if s else []
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return []
        # allow comma-separated input (defensive)
        if "," in s:
            parts = [p.strip() for p in s.split(",") if p.strip()]
            return parts
        return [s]
    if isinstance(v, dict):
        # object-of-boolean flags -> keys where truthy
        out = []
        for k, val in v.items():
            if val is True or val == "true" or val == 1:
                kstr = str(k).strip()
                if kstr:
                    out.append(kstr)
            elif isinstance(val, str) and val.strip():
                out.append(val.strip())
        return out
    # fallback
    try:
        s = str(v).strip()
        return [s] if s else []
    except Exception:
        return []

# -------------------------------
# SAVE USER PREFS (support main & _sub keys)
# (unchanged from your previous implementation)
# -------------------------------
@app.post("/save_preferences")
async def save_preferences(request: Request):
    data = await request.json()
    user_id = data.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=400, detail="Missing user_id in payload")

    user_id_str = str(user_id)
    print("🔔 Received save_preferences payload:", data)

    # Overwrite behavior: do not preserve other users' saved preferences.
    # We'll build merged_for_user and write a file that contains only this user's prefs.

    MAIN_KEYS = ["mood", "planningStyle", "adventureLevel", "addOnMagic", "memorableFactor"]

    merged_for_user = {}

    for k in MAIN_KEYS:
        incoming = data.get(k, None)
        incoming_list = _to_list_of_strings(incoming)

        if incoming_list:
            merged_for_user[k] = incoming_list
        else:
            merged_for_user.pop(k, None)

    for raw_key, raw_val in data.items():
        if not isinstance(raw_key, str):
            continue
        if raw_key.endswith("_sub") or raw_key.endswith("Sub"):
            if raw_key.endswith("_sub"):
                base = raw_key[:-4]
            else:
                base = raw_key[:-3]
            base = base.strip()
            if not base:
                continue

            incoming_sub_list = _to_list_of_strings(raw_val)
            stored_sub_key = f"{base}_sub"

            # For each save, fully overwrite the stored *_sub list with the
            # incoming values so previous instances are discarded.
            if incoming_sub_list:
                merged_for_user[stored_sub_key] = incoming_sub_list
            else:
                merged_for_user.pop(stored_sub_key, None)

    prefs_nested = data.get("preferences") if isinstance(data.get("preferences"), dict) else None
    if prefs_nested:
        for k in MAIN_KEYS:
            for sub_key_variant in (f"{k}_sub", f"{k}Sub", k + "_sub", k + "Sub"):
                if sub_key_variant in prefs_nested:
                    incoming_sub_list = _to_list_of_strings(prefs_nested.get(sub_key_variant))
                    stored_sub_key = f"{k}_sub"

                    # Nested preferences also fully overwrite the *_sub list
                    # for this category on each save.
                    if incoming_sub_list:
                        merged_for_user[stored_sub_key] = incoming_sub_list
                    else:
                        merged_for_user.pop(stored_sub_key, None)

    merged_for_user["user_id"] = int(user_id)

    # Write a file containing only the current user's preferences (overwrite)
    to_write = {user_id_str: merged_for_user}
    try:
        with open(USER_PREFS_FILE, "w", encoding="utf-8") as f:
            json.dump(to_write, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("❌ Error writing prefs file:", e)
        raise HTTPException(status_code=500, detail="Failed to save preferences")

    print(f"✅ Saved preferences for user {user_id}: {merged_for_user}")
    return {"message": "Preferences saved successfully", "prefs": merged_for_user}

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


# Start a planner session (create initial suggestions)
@app.post("/planner/session")
async def planner_session_start(request: Request):
    try:
        raw = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    user_id = raw.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")

    # Build a payload object similar to planner.generate_plan
    payload = {
        "user_id": user_id,
        "preferences": raw.get("preferences", {}),
        "max_terms": raw.get("max_terms", raw.get("maxTerms", 3)),
        "coords": raw.get("coords") or raw.get("coordinate") or raw.get("latlng") or None,
        "location": raw.get("location") or raw.get("place") or None,
    }

    initial = generate_initial_suggestions(payload, num_results=15)

    # If no options returned from new session flow, fall back to legacy generate_plan
    if not initial.get("options"):
        print("⚠️ No options from generate_initial_suggestions, falling back to legacy generate_plan")
        legacy_result = generate_plan(payload)
        initial = {
            "display_query": legacy_result.get("query"),
            "short_query": legacy_result.get("query"),
            "options": legacy_result.get("recommendations", []),
            "place_types": [],
            "location_hint": legacy_result.get("query"),
            "selected_tokens": legacy_result.get("selected_for_query", []),
        }

    # include selected_tokens into session state for downstream
    session_id = create_session(user_id, payload, initial_state={"selected_tokens": initial.get("selected_tokens", [])})

    # save selected_tokens and last_options in session
    set_last_options(session_id, "initial", initial.get("options", []))

    return {
        "session_id": session_id,
        "initial": {
            "display_query": initial.get("display_query"),
            "options": initial.get("options"),
            "short_query": initial.get("short_query"),
            "place_types": initial.get("place_types"),
            "location_hint": initial.get("location_hint"),
            # include backend-computed flow so frontend does not guess steps
            "recommended_flow": initial.get("recommended_flow"),
        }
    }

# Select an option in a session and get next-step options
@app.post("/planner/session/{sid}/select")
async def planner_session_select(sid: str, request: Request):
    try:
        raw = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    session = get_session(sid)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    step = raw.get("step") or "default"
    selected_place = raw.get("place")
    if not selected_place:
        raise HTTPException(status_code=400, detail="Missing selected place")

    # store selection
    push_selection(sid, step, selected_place)

    # decide next_step - client can specify next_step or we infer a simple flow
    next_step = raw.get("next_step")
    if not next_step:
        # example inference: if step was 'restaurant' next is 'activity', if 'activity' next is 'stay'
        infer = {"restaurant":"activity", "activity":"stay", "stay":"done"}
        next_step = infer.get(step, "activity")

    # update session selected_tokens if provided in client payload
    if raw.get("selected_tokens"):
        session["selected_tokens"] = raw.get("selected_tokens")

    # Generate followup suggestions based on last selected place
    follow = generate_followup_suggestions(session, next_step, num_results=15)
    set_last_options(sid, next_step, follow.get("options", []))

    return {
        "session_id": sid,
        "selected": selected_place,
        "next_step": next_step,
        "options": follow.get("options", []),
        "anchor_text": follow.get("anchor_text"),
    }

# Read session state
@app.get("/planner/session/{sid}")
def read_planner_session(sid: str):
    s = get_session(sid)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return s

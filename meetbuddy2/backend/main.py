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
from planner import generate_plan  # planner.generate_plan expects a single dict payload

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
# -------------------------------
@app.post("/save_preferences")
async def save_preferences(request: Request):
    """
    Saves preferences for a user.

    - Main keys (single-select): mood, planningStyle, adventureLevel, addOnMagic, memorableFactor
      These are stored as single-element arrays (the latest provided main wins).
    - Stage2/sub keys: detected from incoming keys that end with '_sub' (or 'Sub') and saved
      under '<category>_sub' (unioned with existing sub arrays).
    - Both main and sub are persisted in user_last_prefs.json.
    """
    data = await request.json()
    user_id = data.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=400, detail="Missing user_id in payload")

    user_id_str = str(user_id)
    print("🔔 Received save_preferences payload:", data)

    # Read existing prefs
    if os.path.exists(USER_PREFS_FILE):
        try:
            with open(USER_PREFS_FILE, "r", encoding="utf-8") as f:
                existing_prefs = json.load(f)
        except Exception as e:
            print("⚠️ Error reading existing prefs file — starting fresh:", e)
            existing_prefs = {}
    else:
        existing_prefs = {}

    user_existing = existing_prefs.get(user_id_str, {})

    # Define main categories (stage1 single-select). Keep as single-select (overwrite when provided).
    MAIN_KEYS = ["mood", "planningStyle", "adventureLevel", "addOnMagic", "memorableFactor"]

    merged_for_user = dict(user_existing)  # start with what's already stored

    # 1) Handle main keys: overwrite if incoming main provided (choose last element if array)
    for k in MAIN_KEYS:
        incoming = data.get(k, None)
        incoming_list = _to_list_of_strings(incoming)
        existing_list = [str(x).strip() for x in (user_existing.get(k) or []) if str(x).strip()]

        if incoming_list:
            # treat the most recent selection as the active main choice -> single element
            merged_for_user[k] = [incoming_list[-1]]
        else:
            # keep existing if present
            if existing_list:
                merged_for_user[k] = [existing_list[-1]]
            else:
                merged_for_user.pop(k, None)

    # 2) Handle sub-keys (stage2). Detect keys ending with _sub or Sub in incoming payload.
    #    Normalize and union them with any existing stored sub arrays.
    for raw_key, raw_val in data.items():
        if not isinstance(raw_key, str):
            continue
        if raw_key.endswith("_sub") or raw_key.endswith("Sub"):
            # map "mood_sub" or "moodSub" -> base "mood"
            if raw_key.endswith("_sub"):
                base = raw_key[:-4]
            else:
                base = raw_key[:-3]
            base = base.strip()
            if not base:
                continue
            incoming_sub_list = _to_list_of_strings(raw_val)

            stored_sub_key = f"{base}_sub"
            existing_sub_list = [str(x).strip() for x in (user_existing.get(stored_sub_key) or []) if str(x).strip()]

            # union existing_sub_list + incoming_sub_list (preserve existing order, append new)
            union = list(existing_sub_list)
            for v in incoming_sub_list:
                if v and v not in union:
                    union.append(v)

            if union:
                merged_for_user[stored_sub_key] = union
            else:
                merged_for_user.pop(stored_sub_key, None)

    # 3) Also handle a case where frontend sends stage2 under preferences.<key> as arrays
    #    For example payload: { "mood": ["Romantic"], "mood_sub": ["Candlelight"], ... }
    #    Additionally check nested preferences object (compatibility)
    prefs_nested = data.get("preferences") if isinstance(data.get("preferences"), dict) else None
    if prefs_nested:
        for k in MAIN_KEYS:
            # nested sub key like preferences.get(f"{k}_sub")
            for sub_key_variant in (f"{k}_sub", f"{k}Sub", k + "_sub", k + "Sub"):
                if sub_key_variant in prefs_nested:
                    incoming_sub_list = _to_list_of_strings(prefs_nested.get(sub_key_variant))
                    stored_sub_key = f"{k}_sub"
                    existing_sub_list = [str(x).strip() for x in (user_existing.get(stored_sub_key) or []) if str(x).strip()]
                    union = list(existing_sub_list)
                    for v in incoming_sub_list:
                        if v and v not in union:
                            union.append(v)
                    if union:
                        merged_for_user[stored_sub_key] = union
                    else:
                        merged_for_user.pop(stored_sub_key, None)

        # Also allow nested preferences.<k + '_sub'> alongside top-level
        # (we already handled nested when building payload for planner previously)

    # OPTIONAL: If frontend sends subs as separate top-level arrays under keys like "mood_sub",
    # we already processed them above. Also preserve any existing sub arrays not mentioned.

    # Ensure we keep user_id in stored object
    merged_for_user["user_id"] = int(user_id)

    # Persist
    existing_prefs[user_id_str] = merged_for_user
    try:
        with open(USER_PREFS_FILE, "w", encoding="utf-8") as f:
            json.dump(existing_prefs, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("❌ Error writing prefs file:", e)
        raise HTTPException(status_code=500, detail="Failed to save preferences")

    print(f"✅ Saved preferences for user {user_id}: {merged_for_user}")
    return {"message": "Preferences saved successfully", "prefs": merged_for_user}

# -------- PLANNER (forwarding payloads) --------
@app.post("/planner")
async def planner_endpoint(request: Request):
    try:
        raw = await request.json()
    except Exception as e:
        print("❌ Error reading planner request body:", e)
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    print("📥 Planner request (raw):", raw)

    if isinstance(raw, dict) and "preferences" in raw and "user_id" in raw:
        payload = {
            "user_id": raw.get("user_id"),
            "preferences": raw.get("preferences", {}),
            "max_terms": raw.get("max_terms", raw.get("maxTerms", 3)),
        }
    else:
        payload = {
            "user_id": raw.get("user_id"),
            "preferences": {
                "mood": raw.get("mood", raw.get("preferences", {}).get("mood", [])),
                "planningStyle": raw.get("planningStyle", raw.get("preferences", {}).get("planningStyle", [])),
                "adventureLevel": raw.get("adventureLevel", raw.get("preferences", {}).get("adventureLevel", [])),
                "addOnMagic": raw.get("addOnMagic", raw.get("preferences", {}).get("addOnMagic", [])),
                "memorableFactor": raw.get("memorableFactor", raw.get("preferences", {}).get("memorableFactor", [])),
            },
            "max_terms": raw.get("max_terms", raw.get("maxTerms", 3)),
        }

    if not isinstance(payload.get("preferences"), dict):
        payload["preferences"] = {}

    print("📤 Planner payload forwarded to planner.generate_plan:", payload)

    try:
        result = generate_plan(payload)
    except HTTPException:
        raise
    except Exception as e:
        print("❌ Error while generating plan:", e)
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

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from models import User
from pydantic import BaseModel
from scraper import get_restaurants
from passlib.context import CryptContext

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow frontend (Vite at localhost:5173) to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing utility
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# -------- SCHEMAS --------
class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    username: str
    password: str

class UserLogin(BaseModel):
    identifier: str   # username or email
    password: str

# -------- ROUTES --------
@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # Check email exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check username exists
    db_username = db.query(User).filter(User.username == user.username).first()
    if db_username:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Create new user with hashed password
    hashed_pw = hash_password(user.password)

    new_user = User(
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone,
        username=user.username,
        password=hashed_pw,  # ✅ hashed password stored
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully", "user_id": new_user.id}

@app.post("/login")
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    # Try to find user by username or email
    user = db.query(User).filter(
        (User.username == credentials.identifier) | (User.email == credentials.identifier)
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    # ✅ verify hashed password
    if not verify_password(credentials.password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    return {"message": "Login successful", "user_id": user.id, "username": user.username}

@app.get("/scrape")
def scrape(query: str, limit: int = 10):
    try:
        results = get_restaurants(query, limit)
        return {"results": results}
    except Exception as e:
        return {"error": str(e)}

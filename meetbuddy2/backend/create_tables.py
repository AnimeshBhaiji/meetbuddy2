from database import Base, engine
import models  # noqa: F401 — registers all tables (users, api_cache) on Base

print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully!")

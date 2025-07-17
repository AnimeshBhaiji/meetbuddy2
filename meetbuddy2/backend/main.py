from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from scraper import get_restaurants

app = FastAPI()

# Allow frontend (localhost:5173 for Vite) to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/scrape")
def scrape(query: str = Query(...), limit: int = Query(10)):
    try:
        results = get_restaurants(query, limit)
        return {"results": results}
    except Exception as e:
        return {"error": str(e)}


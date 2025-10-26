import json
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

PREFERENCES_FILE = "preferences.json"
USER_PREFS_FILE = "user_last_prefs.json"

# Load preferences from JSON
with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
    PREFERENCES = json.load(f)


# -------------------------------
# 🧠 Pydantic Model
# -------------------------------
class UserPreferences(BaseModel):
    user_id: int
    mood: list[str] | None = None
    planningStyle: list[str] | None = None
    adventureLevel: list[str] | None = None
    addOnMagic: list[str] | None = None
    memorableFactor: list[str] | None = None


# -------------------------------
# 🧩 Helper: Normalize IDs → Labels
# -------------------------------
def normalize_to_labels(category, items):
    """Return labels whether user provided IDs or label strings."""
    if not items:
        return []

    section_map = PREFERENCES.get(category, {})
    id_to_label = {str(k): v for k, v in section_map.items()}
    label_values = set(id_to_label.values())
    normalized = []

    for item in items:
        if item is None:
            continue
        item_str = str(item).strip()

        # Case 1: numeric ID like "1"
        if item_str in id_to_label:
            normalized.append(id_to_label[item_str])

        # Case 2: already a label like "Fun & Energetic"
        elif item_str in label_values:
            normalized.append(item_str)

        # Case 3: case-insensitive label match
        else:
            for lbl in label_values:
                if lbl.lower() == item_str.lower():
                    normalized.append(lbl)
                    break

    return normalized


# -------------------------------
# 🗂️ Endpoint: Save Preferences
# -------------------------------
@app.post("/save_preferences")
def save_preferences(prefs: UserPreferences):
    """
    ✅ Validates and saves both stage 1 and stage 2 preferences.
    ✅ Accepts either label strings or IDs.
    ✅ Stores labels under user_id in user_last_prefs.json.
    """
    print(f"🧩 Received preferences from user {prefs.user_id}: {prefs.dict()}")

    valid_sections = [
        "mood",
        "planningStyle",
        "adventureLevel",
        "addOnMagic",
        "memorableFactor",
    ]
    validated_prefs = {}

    for section in valid_sections:
        selected = getattr(prefs, section) or []
        validated = normalize_to_labels(section, selected)
        if validated:
            validated_prefs[section] = validated

    # Load existing user preferences
    existing_prefs = {}
    if os.path.exists(USER_PREFS_FILE):
        with open(USER_PREFS_FILE, "r", encoding="utf-8") as f:
            existing_prefs = json.load(f)

    # Merge with existing ones (so stage 1 + stage 2 both persist)
    user_id_str = str(prefs.user_id)
    if user_id_str in existing_prefs:
        existing_prefs[user_id_str].update(validated_prefs)
    else:
        existing_prefs[user_id_str] = validated_prefs

    # Save back
    with open(USER_PREFS_FILE, "w", encoding="utf-8") as f:
        json.dump(existing_prefs, f, indent=2)

    print(f"✅ Saved merged preferences for user {prefs.user_id}: {validated_prefs}")
    return {"message": "Preferences saved successfully", "prefs": validated_prefs}


# -------------------------------
# 💡 Endpoint: Generate Plan
# -------------------------------
@app.post("/planner")
def generate_plan(payload: dict):
    """
    Generates a descriptive search query based on user preferences.
    """
    user_id = payload.get("user_id")
    prefs_data = payload.get("preferences", {})

    if not user_id or not prefs_data:
        raise HTTPException(status_code=400, detail="Missing user_id or preferences.")

    # Normalize all sections
    mood_labels = normalize_to_labels("mood", prefs_data.get("mood"))
    planning_labels = normalize_to_labels("planningStyle", prefs_data.get("planningStyle"))
    adventure_labels = normalize_to_labels("adventureLevel", prefs_data.get("adventureLevel"))
    addon_labels = normalize_to_labels("addOnMagic", prefs_data.get("addOnMagic"))
    memorable_labels = normalize_to_labels("memorableFactor", prefs_data.get("memorableFactor"))

    # Build descriptive query
    combined_labels = (
        mood_labels
        + planning_labels
        + adventure_labels
        + addon_labels
        + memorable_labels
    )
    query = ", ".join(combined_labels) + " cafes and restaurants near me"

    print(f"🔍 Generated search query for user {user_id}: {query}")

    return {
        "user_id": user_id,
        "query": query,
        "labels_used": {
            "mood": mood_labels,
            "planningStyle": planning_labels,
            "adventureLevel": adventure_labels,
            "addOnMagic": addon_labels,
            "memorableFactor": memorable_labels,
        },
        "note": "Generated query only — scraper call skipped for testing.",
    }

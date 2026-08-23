# One-off repair: rebuild *_sub answers that were stored as flat lists.
#
# Before the sub-answer-shape fix, save_preferences ran *_sub values through
# _to_list_of_strings, so {"ro_setting": "Candlelit"} was stored as
# ["Candlelit"] and the question id was dropped. Consumers look answers up by
# id, so those preferences were silently ignored.
#
# The ids are recoverable: within a category branch every option value belongs
# to exactly one sub-question, so the account's main answer plus the stored
# value identifies the question. Verified against src/data/subQuestionMap.js —
# 55 option values, zero collisions inside a branch.
#
# Run once by hand:  python migrate_sub_answer_shape.py
# Safe to re-run: dict-shaped answers are left alone, and a row is only written
# when at least one value was mapped, so nothing is destroyed on a miss.
#
# OPTION_INDEX below is generated from src/data/subQuestionMap.js:
#   node --input-type=module -e "import m from './src/data/subQuestionMap.js';
#     const t={}; for (const [c,b] of Object.entries(m))
#       for (const [k,subs] of Object.entries(b)) for (const s of subs)
#         for (const o of (s.options||[])) ((t[c]??={})[k]??={})[o]=[s.id,s.type];
#     console.log(JSON.stringify(t))"
import json

from sqlalchemy import text

from database import engine

# category -> main answer -> option value -> [sub_question_id, question type]
OPTION_INDEX = {
    "mood": {
        "Fun & Energetic": {
            "Games / Events": [
                "fe_activity",
                "single"
            ],
            "Dance / Club-like": [
                "fe_activity",
                "single"
            ],
            "Live events": [
                "fe_activity",
                "single"
            ],
            "Indoor": [
                "fe_outdoor",
                "single"
            ],
            "Outdoor": [
                "fe_outdoor",
                "single"
            ],
            "Either": [
                "fe_outdoor",
                "single"
            ]
        },
        "Chill & Relaxed": {
            "Cozy café": [
                "cr_setting",
                "single"
            ],
            "Nature / park": [
                "cr_setting",
                "single"
            ],
            "Either": [
                "cr_setting",
                "single"
            ],
            "Light food & drinks": [
                "cr_addons",
                "multi"
            ],
            "Quiet activity (reading/art)": [
                "cr_addons",
                "multi"
            ],
            "Board games": [
                "cr_addons",
                "multi"
            ]
        },
        "Business-y": {
            "Formal (meeting-style)": [
                "by_formality",
                "single"
            ],
            "Casual": [
                "by_formality",
                "single"
            ],
            "Meeting-friendly seating (table)": [
                "by_seating",
                "single"
            ],
            "Private area / room": [
                "by_seating",
                "single"
            ],
            "No preference": [
                "by_seating",
                "single"
            ]
        },
        "Romantic": {
            "Candlelit / intimate": [
                "ro_setting",
                "single"
            ],
            "Scenic / view": [
                "ro_setting",
                "single"
            ],
            "Rooftop / alfresco": [
                "ro_setting",
                "single"
            ]
        }
    },
    "planningStyle": {
        "Surprise me": {
            "Food quality": [
                "sm_prior",
                "multi"
            ],
            "Ambience": [
                "sm_prior",
                "multi"
            ],
            "Budget": [
                "sm_prior",
                "multi"
            ],
            "Distance": [
                "sm_prior",
                "multi"
            ]
        },
        "Semi-custom": {
            "Yes — shortlist 3–5": [
                "sc_shortlist",
                "single"
            ],
            "No — show more options": [
                "sc_shortlist",
                "single"
            ]
        },
        "Full control": {
            "Price": [
                "fc_filters",
                "multi"
            ],
            "Private seating": [
                "fc_filters",
                "multi"
            ],
            "Dietary options": [
                "fc_filters",
                "multi"
            ],
            "Live music": [
                "fc_filters",
                "multi"
            ]
        }
    },
    "adventureLevel": {
        "Stick to the city": {
            "Central": [
                "sc_area",
                "single"
            ],
            "Suburbs": [
                "sc_area",
                "single"
            ],
            "Either": [
                "sc_area",
                "single"
            ],
            "No": [
                "sc_transport",
                "single"
            ],
            "Parking assistance": [
                "sc_transport",
                "single"
            ],
            "Rides arranged": [
                "sc_transport",
                "single"
            ]
        },
        "Short drive to hidden gem": {
            "Nature": [
                "sd_type",
                "single"
            ],
            "Heritage/landmark": [
                "sd_type",
                "single"
            ],
            "Food-centric": [
                "sd_type",
                "single"
            ],
            "<30 min": [
                "sd_duration",
                "single"
            ],
            "30–60 min": [
                "sd_duration",
                "single"
            ],
            ">60 min": [
                "sd_duration",
                "single"
            ]
        },
        "Weekend escape": {
            "Yes": [
                "we_accom",
                "single"
            ],
            "No": [
                "we_accom",
                "single"
            ],
            "Maybe": [
                "we_accom",
                "single"
            ]
        }
    },
    "addOnMagic": {
        "Live music spots": {
            "Acoustic": [
                "lm_style",
                "single"
            ],
            "Band": [
                "lm_style",
                "single"
            ],
            "DJ": [
                "lm_style",
                "single"
            ],
            "No preference": [
                "lm_style",
                "single"
            ]
        }
    },
    "memorableFactor": {
        "A unique place": {
            "Themed venue": [
                "up_type",
                "multi"
            ],
            "Hidden gem": [
                "up_type",
                "multi"
            ],
            "Artistic interior": [
                "up_type",
                "multi"
            ]
        },
        "Deep conversations / Capture moments": {
            "Quiet & intimate": [
                "dc_setting",
                "single"
            ],
            "Scenic & photogenic": [
                "dc_setting",
                "single"
            ],
            "Balanced": [
                "dc_setting",
                "single"
            ]
        }
    }
}


def _rebuild(category, main_answers, stored_values):
    """Flat list -> {sub_question_id: answer}. Returns (rebuilt, unmapped)."""
    branches = OPTION_INDEX.get(category, {})
    lookup = {}
    for label in main_answers:
        lookup.update(branches.get(label, {}))

    rebuilt, unmapped = {}, []
    for value in stored_values:
        hit = lookup.get(value)
        if not hit:
            unmapped.append(value)          # free-text answers, or a changed option
            continue
        sub_id, qtype = hit
        if qtype == "multi":
            rebuilt.setdefault(sub_id, []).append(value)
        else:
            rebuilt[sub_id] = value
    return rebuilt, unmapped


def migrate():
    repaired = skipped = 0
    with engine.begin() as conn:
        rows = conn.execute(text(
            "select id, username, preferences from users "
            "where preferences <> '{}'::jsonb")).fetchall()

        for uid, username, prefs in rows:
            prefs = prefs or {}
            changed, notes = {}, []

            for key, value in prefs.items():
                if not key.endswith("_sub") or not isinstance(value, list):
                    continue                 # already an object, or not a sub key
                category = key[:-4]
                main = prefs.get(category) or []
                if isinstance(main, str):
                    main = [main]

                rebuilt, unmapped = _rebuild(category, main, value)
                if rebuilt:
                    changed[key] = rebuilt
                if unmapped:
                    notes.append(f"{key}: could not place {unmapped}")

            if not changed:
                if any(isinstance(v, list) and k.endswith("_sub") for k, v in prefs.items()):
                    skipped += 1
                    print(f"user {uid} ({username}): nothing could be mapped, left untouched")
                continue

            conn.execute(
                text("update users set preferences = cast(:p as jsonb) where id = :i"),
                {"p": json.dumps({**prefs, **changed}), "i": uid})
            repaired += 1
            print(f"user {uid} ({username}): repaired {', '.join(sorted(changed))}")
            for key, val in sorted(changed.items()):
                print(f"    {key} -> {json.dumps(val, ensure_ascii=False)}")
            for n in notes:
                print(f"    WARNING {n}")

    print(f"Done. {repaired} account(s) repaired, {skipped} left untouched.")


if __name__ == "__main__":
    migrate()

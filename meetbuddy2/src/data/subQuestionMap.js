// src/data/subQuestionMap.js
// Every question here changes the backend search (queries, radius, ranking,
// filters). Decorative questions with no effect on results were removed.
const subQuestionMap = {
    mood: {
      "Fun & Energetic": [
        {
          id: "fe_activity",
          question: "Which activity do you prefer?",
          type: "single",
          options: ["Games / Events", "Dance / Club-like", "Live events"]
        },
        {
          id: "fe_outdoor",
          question: "Indoor or outdoor vibe?",
          type: "single",
          options: ["Indoor", "Outdoor", "Either"]
        }
      ],
      "Chill & Relaxed": [
        {
          id: "cr_setting",
          question: "Which setting do you prefer?",
          type: "single",
          options: ["Cozy café", "Nature / park", "Either"]
        },
        {
          id: "cr_addons",
          question: "Add-ons you'd like?",
          type: "multi",
          options: ["Light food & drinks", "Quiet activity (reading/art)", "Board games"]
        }
      ],
      "Business-y": [
        {
          id: "by_formality",
          question: "Formality level?",
          type: "single",
          options: ["Formal (meeting-style)", "Casual"]
        },
        {
          id: "by_seating",
          question: "Seating preference",
          type: "single",
          options: ["Meeting-friendly seating (table)", "Private area / room", "No preference"]
        }
      ],
      "Romantic": [
        {
          id: "ro_setting",
          question: "Preferred romantic setting",
          type: "single",
          options: ["Candlelit / intimate", "Scenic / view", "Rooftop / alfresco"]
        }
      ]
    },

    planningStyle: {
      "Surprise me": [
        {
          id: "sm_prior",
          question: "Any preferences to prioritize?",
          type: "multi",
          options: ["Food quality", "Ambience", "Budget", "Distance"]
        },
        {
          id: "sm_block",
          question: "Activities/types to avoid (optional)",
          type: "text",
          options: []
        }
      ],
      "Semi-custom": [
        {
          id: "sc_shortlist",
          question: "Do you want MeetBuddy to shortlist options?",
          type: "single",
          options: ["Yes — shortlist 3–5", "No — show more options"]
        }
      ],
      "Full control": [
        {
          id: "fc_itinerary",
          question: "Prefer building your own itinerary?",
          type: "single",
          options: ["Yes — full control", "No — I want help"]
        },
        {
          id: "fc_filters",
          question: "Important filters for you",
          type: "multi",
          options: ["Price", "Private seating", "Dietary options", "Live music"]
        }
      ]
    },

    adventureLevel: {
      "Stick to the city": [
        {
          id: "sc_area",
          question: "Preferred area",
          type: "single",
          options: ["Central", "Suburbs", "Either"]
        },
        {
          id: "sc_transport",
          question: "Transport support",
          type: "single",
          options: ["No", "Parking assistance", "Rides arranged"]
        }
      ],
      "Short drive to hidden gem": [
        {
          id: "sd_type",
          question: "Type of getaway",
          type: "single",
          options: ["Nature", "Heritage/landmark", "Food-centric"]
        },
        {
          id: "sd_duration",
          question: "Max driving time you'd accept",
          type: "single",
          options: ["<30 min", "30–60 min", ">60 min"]
        }
      ],
      "Weekend escape": [
        {
          id: "we_accom",
          question: "Accommodation needed?",
          type: "single",
          options: ["Yes", "No", "Maybe"]
        }
      ]
    },

    addOnMagic: {
      "Live music spots": [
        {
          id: "lm_style",
          question: "Music preference",
          type: "single",
          options: ["Acoustic", "Band", "DJ", "No preference"]
        }
      ]
    },

    memorableFactor: {
      "A unique place": [
        {
          id: "up_type",
          question: "What 'unique' means to you",
          type: "multi",
          options: ["Themed venue", "Hidden gem", "Artistic interior"]
        }
      ],
      "Amazing food": [
        {
          id: "af_cuisine",
          question: "Cuisine preference (optional)",
          type: "text",
          options: []
        },
        {
          id: "af_diet",
          question: "Dietary restrictions (optional)",
          type: "text",
          options: []
        }
      ],
      "Deep conversations / Capture moments": [
        {
          id: "dc_setting",
          question: "Preferred setting",
          type: "single",
          options: ["Quiet & intimate", "Scenic & photogenic", "Balanced"]
        }
      ]
    }
  };

  export default subQuestionMap;

// src/pages/Planner.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import MapPlanner from "../components/MapPlanner";

export default function Planner() {
  // Legacy single-shot planner state (unchanged)
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [userPrefs, setUserPrefs] = useState(null);
  const [user, setUser] = useState(null);
  const [maxTerms, setMaxTerms] = useState(3);
  const [selectedForQuery, setSelectedForQuery] = useState([]);

  // Location UI
  const [placeText, setPlaceText] = useState("");
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [locLoading, setLocLoading] = useState(false);

  // Stepper/session state (new)
  const [page, setPage] = useState("home"); // "home" | "step" | "summary"
  const [sessionId, setSessionId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null); // e.g. restaurant/activity/stay
  const [stepOptions, setStepOptions] = useState([]); // all options for the current step (array)
  const [anchorText, setAnchorText] = useState("");
  const [selectedChain, setSelectedChain] = useState([]); // [{step, place}]
  const [sessionLoading, setSessionLoading] = useState(false); // for start/select operations
  const [flowText, setFlowText] = useState(""); // display flow (Restaurant → Activity → Stay)
  const [initialFlow, setInitialFlow] = useState([]); // array of steps in order

  // full-screen intermediary overlay
  const [showOverlay, setShowOverlay] = useState(false);
  
  // Track highlighted place for map popup
  const [highlightedPlace, setHighlightedPlace] = useState(null);

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "null");
      const storedPrefs =
        JSON.parse(localStorage.getItem("userPreferences") || "null") ||
        JSON.parse(localStorage.getItem("questionnaireAnswers") || "null") ||
        null;
      setUser(storedUser);
      setUserPrefs(storedPrefs);
      if (storedPrefs) {
        if (storedPrefs.location) setPlaceText(storedPrefs.location);
        if (storedPrefs.coords) setCoords(storedPrefs.coords);
      }
    } catch (e) {
      console.warn("Failed parsing stored user/prefs:", e);
    }
  }, []);

  // Determine flow from preferences when userPrefs are available (for display on home page)
  useEffect(() => {
    if (!userPrefs || page !== "home") return;
    
    // Helper to normalize preference values to arrays
    const normalizePref = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      if (typeof val === "string") return [val];
      if (typeof val === "object") {
        // Handle object format { "1": "Business-y" } or { "Business-y": true }
        const arr = [];
        for (const [k, v] of Object.entries(val)) {
          if (v === true || v === "true" || v === 1) {
            arr.push(k);
          } else if (typeof v === "string" && v.trim()) {
            arr.push(v);
          }
        }
        return arr;
      }
      return [String(val)];
    };
    
    // Determine flow from preferences locally (same logic as backend)
    const determineFlowFromPrefs = (prefs) => {
      let needsStay = false;
      let needsActivity = false;
      let forceNoActivity = false;

      // Normalize preferences to arrays of labels
      const adventureLevel = normalizePref(prefs.adventureLevel);
      const mood = normalizePref(prefs.mood);
      const memorableFactor = normalizePref(prefs.memorableFactor);

      console.log("🔍 Analyzing preferences for flow:", { adventureLevel, mood, memorableFactor });

      // Analyze adventure level
      for (const label of adventureLevel) {
        const labelStr = String(label).trim();
        if (labelStr === "Weekend escape" || labelStr.includes("Weekend escape")) {
          needsStay = true;
          needsActivity = true;
        } else if (labelStr === "Short drive to hidden gem" || labelStr.includes("Short drive")) {
          needsActivity = true;
        } else if (labelStr === "Stick to the city" || labelStr.includes("Stick to the city")) {
          needsActivity = true;
        }
      }

      // Analyze mood
      for (const label of mood) {
        const labelStr = String(label).trim();
        if (labelStr === "Romantic" || labelStr.includes("Romantic")) {
          needsStay = true;
          needsActivity = true;
        } else if (labelStr === "Fun & Energetic" || labelStr.includes("Fun") || labelStr.includes("Energetic")) {
          needsActivity = true;
        } else if (labelStr === "Chill & Relaxed" || labelStr.includes("Chill") || labelStr.includes("Relaxed")) {
          needsActivity = true;
        } else if (labelStr === "Business-y" || labelStr.includes("Business")) {
          // Business-y overrides activities unless adventure level strongly suggests them
          const hasWeekendEscape = adventureLevel.some(l => String(l).includes("Weekend escape"));
          const hasShortDrive = adventureLevel.some(l => String(l).includes("Short drive"));
          if (!hasWeekendEscape && !hasShortDrive) {
            forceNoActivity = true;
          }
        }
      }

      // Analyze memorable factor
      for (const label of memorableFactor) {
        const labelStr = String(label).trim();
        if (labelStr === "A unique place" || labelStr.includes("unique")) {
          needsActivity = true;
        } else if (labelStr === "Deep conversations / Capture moments" || labelStr.includes("Deep") || labelStr.includes("Capture")) {
          needsActivity = true;
        }
      }

      // Build flow
      const flow = ["restaurant"];
      if (needsActivity && !forceNoActivity) {
        flow.push("activity");
      }
      if (needsStay) {
        flow.push("stay");
      }

      console.log("📋 Determined flow from frontend prefs:", flow, { needsActivity, needsStay, forceNoActivity });
      return flow;
    };

    const flow = determineFlowFromPrefs(userPrefs);
    setInitialFlow(flow);
    setFlowText(flow.map((f) => humanStepName(f)).join(" → "));
  }, [userPrefs, page]);

  const persistPrefs = (newPrefs) => {
    const merged = { ...(userPrefs || {}), ...(newPrefs || {}) };
    setUserPrefs(merged);
    try {
      localStorage.setItem("userPreferences", JSON.stringify(merged));
    } catch (e) {}
  };

  // GPS helper
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported in your browser.");
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        persistPrefs({ coords: { lat, lng }, location: `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}` });
        setPlaceText(`Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`);
        setLocLoading(false);
      },
      (err) => {
        setLocLoading(false);
        alert("Unable to read location: " + (err && err.message ? err.message : "permission denied"));
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10000 }
    );
  };

  const handlePlaceTextBlur = () => {
    if (placeText && placeText.trim()) {
      persistPrefs({ location: placeText.trim() });
      // clear coords because textual place may not have numeric coords
      setCoords(null);
      persistPrefs({ coords: null });
    }
  };

  const normalizePrefForSend = (val) => {
    if (val == null) return [];
    if (Array.isArray(val)) return val.map((x) => (x == null ? "" : String(x))).filter(Boolean);
    if (typeof val === "string" || typeof val === "number") {
      const s = String(val).trim();
      return s === "" ? [] : [s];
    }
    if (typeof val === "object") {
      const keys = Object.keys(val || {});
      const booleanFlags = keys.filter((k) => val[k] === true || val[k] === "true" || val[k] === 1);
      if (booleanFlags.length > 0) return booleanFlags.map((k) => String(k));
      const stringValues = keys
        .map((k) => (typeof val[k] === "string" && val[k].trim() ? val[k].trim() : null))
        .filter(Boolean);
      if (stringValues.length > 0) return stringValues;
      return keys.map((k) => String(k));
    }
    return [];
  };

  // ---------------- Legacy single-call planner (unchanged) ----------------
  const getRecommendations = async () => {
    if (!user) {
      alert("User not logged in!");
      return;
    }
    if (!userPrefs) {
      alert("No preferences found. Please save them first!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        user_id: user.user_id,
        preferences: {
          mood: normalizePrefForSend(userPrefs?.mood),
          planningStyle: normalizePrefForSend(userPrefs?.planningStyle),
          adventureLevel: normalizePrefForSend(userPrefs?.adventureLevel),
          addOnMagic: normalizePrefForSend(userPrefs?.addOnMagic),
          memorableFactor: normalizePrefForSend(userPrefs?.memorableFactor),
        },
        max_terms: maxTerms,
      };

      const finalCoords = coords || (userPrefs && userPrefs.coords) || null;
      if (finalCoords && typeof finalCoords === "object" && finalCoords.lat && finalCoords.lng) {
        payload.coords = { lat: Number(finalCoords.lat), lng: Number(finalCoords.lng) };
      } else {
        const place = placeText && placeText.trim() ? placeText.trim() : (userPrefs && userPrefs.location);
        if (place) payload.location = place;
      }

      console.log("📤 Planner payload (normalized arrays):", payload);

      const res = await axios.post("http://localhost:8000/planner", payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 60000,
      });

      console.log("📥 Backend response:", res.data);

      setRecommendations(res.data.recommendations || []);
      setQuery(res.data.query || "");
      setSearchUrl(res.data.search_url || "");
      setSelectedForQuery(res.data.selected_for_query || []);
    } catch (err) {
      console.error("❌ Error fetching recommendations:", err);
      setError(err?.response?.data?.detail || err?.message || "Something went wrong.");
      setRecommendations([]);
      setQuery("");
      setSearchUrl("");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- New stepper/session flow (all options visible per step) ----------------

  // derive flow from backend provided place types (basic) - fallback only
  const deriveFlowFromPlaceTypes = (place_types = []) => {
    const flow = [];
    // Don't default to all steps - just restaurant if no place types
    if (!place_types || place_types.length === 0) {
      return ["restaurant"]; // Minimal default - just restaurant
    }
    if (place_types.includes("restaurant") || place_types.includes("cafe")) flow.push("restaurant");
    if (place_types.some((p) => ["tourist_attraction", "park", "amusement_park", "play_area", "scenic"].includes(p))) flow.push("activity");
    if (place_types.some((p) => ["hotel", "resort", "lodging"].includes(p))) flow.push("stay");
    if (flow.length === 0) flow.push("restaurant");
    return flow;
  };

  const humanStepName = (step) => {
    const map = { restaurant: "Restaurant", activity: "Activity / Things to do", stay: "Stay / Hotel" };
    return map[step] || step;
  };

  // map legacy /planner recommendations to our session-option style
  const mapLegacyToOptions = (legacyArray = []) => {
    return legacyArray.map((r) => ({
      title: r.title || r.Name || r.name || "Unnamed Place",
      address: r.address || r.Address || r.vicinity || r.raw?.address || "",
      rating: r.rating || r.Rating || (r.raw && r.raw.rating) || 0,
      link: r.link || r.GoogleMaps || r.website || r.raw?.link || "",
      lat: r.lat || r.latitude || r.raw?.lat || null,
      lng: r.lng || r.longitude || r.raw?.lng || null,
      thumbnail: r.thumbnail || r.raw?.photo_url || r.raw?.serpapi_thumbnail || null,
      raw: r.raw || r,
    }));
  };

  // Start session and show the step page (all options visible)
  const startSession = async () => {
    if (!user || !userPrefs) {
      alert("Please log in and save preferences first.");
      return;
    }
    setSessionLoading(true);
    try {
      const payload = {
        user_id: user.user_id,
        preferences: {
          mood: userPrefs.mood,
          planningStyle: userPrefs.planningStyle,
          adventureLevel: userPrefs.adventureLevel,
          addOnMagic: userPrefs.addOnMagic,
          memorableFactor: userPrefs.memorableFactor,
        },
        coords: userPrefs.coords || (coords || null),
        location: userPrefs.location || (placeText && placeText.trim() ? placeText.trim() : null),
        max_terms: maxTerms,
      };

      // primary request to the session endpoint
      const res = await axios.post("http://localhost:8000/planner/session", payload, { timeout: 60000 });

      const sid = res.data.session_id;
      setSessionId(sid);

      // Use backend-provided recommended flow, or fallback to deriving from place_types
      const recommendedFlow = res.data.initial?.recommended_flow || res.data.initial?.recommendedFlow;
      const place_types = res.data.initial?.place_types || res.data.initial?.placeTypes || [];
      
      let flow = recommendedFlow;
      if (!flow || !Array.isArray(flow) || flow.length === 0) {
        // Fallback to deriving from place types if backend didn't provide flow
        flow = deriveFlowFromPlaceTypes(place_types);
      }
      
      console.log("📋 Determined flow from preferences:", flow);
      setInitialFlow(flow);
      setFlowText(flow.map((f) => humanStepName(f)).join(" → "));
      setCurrentStep(flow[0] || "restaurant");

      // Prefer server-sent options
      const initialOptions = res.data.initial?.options || [];

      if (initialOptions && initialOptions.length > 0) {
        setStepOptions(initialOptions);
        setAnchorText(res.data.initial?.location_hint || payload.location || "");
        setSelectedChain([]);
        setPage("step");
      } else {
        // fallback: call legacy /planner to try and get recommendations (convert shape)
        console.warn("No initial.options returned from /planner/session — trying legacy /planner fallback", res.data);
        try {
          const legacyPayload = {
            user_id: payload.user_id,
            preferences: payload.preferences,
            max_terms: payload.max_terms,
            coords: payload.coords,
            location: payload.location,
          };
          const legacyRes = await axios.post("http://localhost:8000/planner", legacyPayload, { timeout: 60000 });
          console.log("Fallback /planner response:", legacyRes.data);
          const mapped = mapLegacyToOptions(legacyRes.data.recommendations || []);
          if (mapped && mapped.length > 0) {
            setStepOptions(mapped);
            setAnchorText(legacyRes.data.query || payload.location || "");
            setSelectedChain([]);
            setPage("step");
            // keep session id (server still created it); user can continue step flow
          } else {
            // final fallback - show user helpful message and let them retry
            alert("Couldn't fetch step suggestions. Please try again or try 'Get My Recommendations' (legacy).");
            setStepOptions([]);
            setPage("step"); // still go to step page so user sees message
            setAnchorText(payload.location || "");
          }
        } catch (lfErr) {
          console.error("Legacy fallback failed:", lfErr);
          alert("Failed to fetch suggestions. Check server logs or try again in a moment.");
          setStepOptions([]);
          setPage("step");
          setAnchorText(payload.location || "");
        }
      }
    } catch (err) {
      console.error("Failed to start session", err);
      alert("Failed to start itinerary session. See console for details.");
    } finally {
      setSessionLoading(false);
    }
  };

  // Select an option from the grid of options for the current step
  // show full-page intermediary overlay while server processes selection and next options load
  const selectOption = async (opt) => {
    if (!sessionId) {
      alert("Session missing. Start again.");
      return;
    }
    setShowOverlay(true);
    setSessionLoading(true);

    try {
      const payload = {
        step: currentStep || "restaurant",
        place: opt,
        // let server infer next_step if it wants; we pass expected next
        next_step: undefined,
        selected_tokens: [],
      };
      // Determine next step based on the flow order
      const currentStepIndex = initialFlow.indexOf(currentStep || "restaurant");
      const nextStepIndex = currentStepIndex + 1;
      if (nextStepIndex < initialFlow.length) {
        payload.next_step = initialFlow[nextStepIndex];
      } else {
        payload.next_step = "done";
      }

      const res = await axios.post(`http://localhost:8000/planner/session/${sessionId}/select`, payload, { timeout: 60000 });

      // push selection locally
      setSelectedChain((s) => [...s, { step: payload.step, place: opt }]);

      // if server returned next options, switch to them
      const nextStep = res.data.next_step;
      if (!nextStep || nextStep === "done") {
        // done -> show summary page
        setCurrentStep(null);
        setStepOptions([]);
        // small delay so overlay animation is visible
        await new Promise((r) => setTimeout(r, 600));
        setShowOverlay(false);
        setPage("summary");
      } else {
        // short delay for UX
        await new Promise((r) => setTimeout(r, 600));
        setCurrentStep(nextStep);
        // if server provided next options use them, otherwise fallback to empty array and message
        const nextOpts = res.data.options || [];
        if (nextOpts.length > 0) {
          setStepOptions(nextOpts);
        } else {
          // graceful fallback: inform user and keep session open (they can retry)
          console.warn("No options returned for next step from server:", res.data);
          setStepOptions([]);
          alert("No nearby options found for the next step. You can try again or go back.");
        }
        setAnchorText(res.data.anchor_text || "");
        setShowOverlay(false);
      }
    } catch (err) {
      console.error("Selection failed", err);
      setShowOverlay(false);
      alert("Selection failed. See console.");
    } finally {
      setSessionLoading(false);
    }
  };

  // Back button: go back one step locally and attempt to restore server options for that step
  const goBackOneStep = async () => {
    if (!sessionId) {
      // just go to home
      setPage("home");
      return;
    }
    if (selectedChain.length === 0) {
      // no selection yet: go home
      setPage("home");
      setSessionId(null);
      setStepOptions([]);
      setCurrentStep(null);
      return;
    }

    // remove last local selection
    const newChain = selectedChain.slice(0, -1);
    setSelectedChain(newChain);

    // determine step to restore
    const stepToRestore = newChain.length ? newChain[newChain.length - 1].step : (initialFlow[0] || "restaurant");
    setCurrentStep(stepToRestore);

    // try to get session state from server and restore last_options (server stores last options via set_last_options)
    try {
      setSessionLoading(true);
      const res = await axios.get(`http://localhost:8000/planner/session/${sessionId}`, { timeout: 30000 });
      const s = res.data || {};
      // server-side state shape may vary; we try common keys
      const last_opts = (s.last_options && s.last_options[stepToRestore]) || (s.last_options && s.last_options.initial) || s.options || [];
      if (last_opts && last_opts.length) {
        setStepOptions(last_opts);
      } else {
        // fallback: re-generate followup suggestions by calling session select with the previously selected place (if exists)
        // or by re-starting session (safer fallback)
        const payload = {
          user_id: user.user_id,
          preferences: {
            mood: userPrefs.mood,
            planningStyle: userPrefs.planningStyle,
            adventureLevel: userPrefs.adventureLevel,
            addOnMagic: userPrefs.addOnMagic,
            memorableFactor: userPrefs.memorableFactor,
          },
          coords: userPrefs.coords || coords || null,
          location: userPrefs.location || placeText || null,
        };
        const initRes = await axios.post("http://localhost:8000/planner/session", payload, { timeout: 30000 });
        setStepOptions(initRes.data.initial.options || []);
      }
    } catch (e) {
      console.warn("Back: failed to restore server options, using local fallback", e);
    } finally {
      setSessionLoading(false);
    }
  };

  const openSearch = () => {
    const url =
      searchUrl ||
      "https://www.google.com/search?q=" + encodeURIComponent((query && query.trim()) || "");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const displayPref = (val) => {
    if (!val) return "—";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  // UI: grid of cards for the step
  const StepGrid = ({ options = [], onSelect, loading, onHighlight }) => {
    if (!options || options.length === 0) {
      return (
        <div className="p-6 text-center text-gray-500">
          <div className="mb-3">No options available for this step.</div>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                // allow quick retry by re-starting the session
                startSession();
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded"
            >
              Retry suggestions
            </button>
            <button
              onClick={() => {
                // try the legacy planner path as quick rescue
                (async () => {
                  setSessionLoading(true);
                  try {
                    const legacyPayload = {
                      user_id: user.user_id,
                      preferences: {
                        mood: userPrefs.mood,
                        planningStyle: userPrefs.planningStyle,
                        adventureLevel: userPrefs.adventureLevel,
                        addOnMagic: userPrefs.addOnMagic,
                        memorableFactor: userPrefs.memorableFactor,
                      },
                      max_terms: maxTerms,
                      coords: userPrefs.coords || coords || null,
                      location: userPrefs.location || placeText || null,
                    };
                    const legacyRes = await axios.post("http://localhost:8000/planner", legacyPayload, { timeout: 60000 });
                    const mapped = legacyRes.data.recommendations || [];
                    setStepOptions(mapped.length ? mapped : []);
                    if (!mapped.length) alert("Legacy planner returned no options either.");
                  } catch (e) {
                    console.error("Legacy rescue failed", e);
                    alert("Rescue failed. Check server logs.");
                  } finally {
                    setSessionLoading(false);
                  }
                })();
              }}
              className="px-3 py-2 bg-gray-200 rounded"
            >
              Try Legacy Planner
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {options.map((o, idx) => (
          <div 
            key={idx} 
            className="bg-white rounded-xl p-4 shadow hover:shadow-lg transition cursor-pointer border-2 border-transparent hover:border-blue-400"
            onMouseEnter={() => {
              if (onHighlight) onHighlight(o);
            }}
            onMouseLeave={() => {
              if (onHighlight) onHighlight(null);
            }}
            onClick={() => {
              if (onHighlight) onHighlight(o);
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-lg">{o.title || o.name || "Unnamed Place"}</h4>
                <div className="text-sm text-gray-600 mt-1">{o.address}</div>
                {o.rating && <div className="mt-2 text-yellow-500">⭐ {o.rating}</div>}
              </div>
              <div className="text-right">
                <a href={o.link || "#"} target="_blank" rel="noreferrer" className="text-xs text-blue-600" onClick={(e) => e.stopPropagation()}>Open</a>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(o);
                }}
                className="px-3 py-1 bg-green-600 text-white rounded"
                disabled={loading}
              >
                Select
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // quick preview action (open maps) - keep simple
                  if (o.link) window.open(o.link, "_blank", "noopener,noreferrer");
                }}
                className="px-3 py-1 bg-gray-200 rounded"
              >
                Preview
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Full-screen overlay with spinner & message
  const FullOverlay = ({ show, text = "Loading next step..." }) => {
    if (!show) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-4 shadow">
          <svg className="animate-spin h-12 w-12" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <div className="text-gray-700 font-medium">{text}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Navbar />

      <div className="p-6 flex flex-col items-center min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold mb-4">Your Personalized Planner ✨</h1>

        {/* HOME / preferences panel */}
        {page === "home" && (
          <div className="bg-white shadow-md rounded-xl p-4 mb-6 max-w-xl w-full text-gray-700">
            <h2 className="text-lg font-semibold mb-2">💡 Your Preferences</h2>
            <ul className="space-y-1 text-sm mb-4">
              <li><strong>Mood:</strong> {displayPref(userPrefs?.mood)}</li>
              <li><strong>Planning Style:</strong> {displayPref(userPrefs?.planningStyle)}</li>
              <li><strong>Adventure Level:</strong> {displayPref(userPrefs?.adventureLevel)}</li>
              <li><strong>Add-On Magic:</strong> {displayPref(userPrefs?.addOnMagic)}</li>
              <li><strong>Memorable Factor:</strong> {displayPref(userPrefs?.memorableFactor)}</li>
            </ul>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Enter desired location (city / area) or use GPS</label>
              <div className="flex gap-2">
                <input
                  value={placeText}
                  onChange={(e) => setPlaceText(e.target.value)}
                  onBlur={handlePlaceTextBlur}
                  placeholder="e.g. Indiranagar, Bangalore"
                  className="flex-1 border rounded px-3 py-2"
                />
                <button onClick={useMyLocation} className="px-3 py-2 bg-blue-600 text-white rounded" disabled={locLoading}>
                  {locLoading ? "Detecting..." : "Use my location"}
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {coords ? `Using coords: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : placeText ? `Using place: ${placeText}` : "No location set"}
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <button
                onClick={startSession}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                disabled={sessionLoading}
              >
                {sessionLoading ? "Starting..." : "Generate Itinerary (Step-by-step)"}
              </button>

              <button
                onClick={() => { setPage("home"); getRecommendations(); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
              >
                Get My Recommendations (Legacy)
              </button>

              <div className="ml-4">
                <label className="text-sm mr-2">Query tokens:</label>
                <select value={maxTerms} onChange={(e) => setMaxTerms(Number(e.target.value))} className="border px-2 py-1 rounded">
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              <div><strong>Planned flow (derived from your prefs):</strong></div>
              <div className="mt-1">{flowText || (initialFlow.length > 0 ? initialFlow.map((f) => humanStepName(f)).join(" → ") : "Restaurant")}</div>
            </div>
          </div>
        )}

        {/* STEP PAGE: show all options for current step */}
        {page === "step" && (
          <div className="w-full max-w-5xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Session: <strong>{sessionId}</strong></div>
                <div className="text-lg font-semibold">{currentStep ? humanStepName(currentStep) : "Done"}</div>
                <div className="text-sm text-gray-500">Anchor: {anchorText}</div>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={goBackOneStep} className="px-3 py-2 bg-gray-200 rounded">Back</button>
                <button onClick={() => { setPage("home"); setSessionId(null); setSelectedChain([]); }} className="px-3 py-2 bg-red-100 rounded">Cancel</button>
              </div>
            </div>

            {/* Map display */}
            <div className="mb-6">
              <MapPlanner 
                options={stepOptions} 
                selectedChain={selectedChain}
                onSelect={selectOption}
                onPreview={(place) => {
                  if (place.link) window.open(place.link, "_blank", "noopener,noreferrer");
                }}
                highlightedPlace={highlightedPlace}
              />
            </div>

            <div className="mb-3">
              <StepGrid 
                options={stepOptions} 
                onSelect={selectOption} 
                loading={sessionLoading}
                onHighlight={setHighlightedPlace}
              />
            </div>
          </div>
        )}

        {/* SUMMARY PAGE */}
        {page === "summary" && (
          <div className="w-full max-w-5xl">
            <div className="bg-white p-6 rounded-xl shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-3">Your Itinerary</h3>
              <ol className="list-decimal list-inside space-y-2">
                {selectedChain.map((s, i) => (
                  <li key={i}>
                    <strong>{humanStepName(s.step)}:</strong> {s.place.title || s.place.name || s.place.address}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setPage("home"); setSessionId(null); setSelectedChain([]); }} className="px-3 py-2 bg-blue-600 text-white rounded">Start Over</button>
                <button onClick={() => window.print()} className="px-3 py-2 bg-gray-200 rounded">Print / Save</button>
              </div>
            </div>
            
            {/* Map display for summary */}
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h3 className="text-lg font-semibold mb-3">Your Itinerary Map</h3>
              <MapPlanner 
                options={[]} 
                selectedChain={selectedChain}
                onSelect={() => {}}
                onPreview={(place) => {
                  if (place.link) window.open(place.link, "_blank", "noopener,noreferrer");
                }}
                highlightedPlace={highlightedPlace}
              />
            </div>
          </div>
        )}

        {/* Legacy recommendations grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl mt-6">
          {recommendations.length > 0 ? recommendations.map((item, idx) => (
            <div key={idx} className="bg-white shadow-md rounded-2xl p-4 border border-gray-100">
              <h2 className="font-semibold text-lg text-gray-800">{item.title || item.Name || "Unnamed Place"}</h2>
              {item.address && <p className="text-gray-600 text-sm mt-1">{item.address}</p>}
              {item.rating && <p className="text-yellow-500 mt-1">⭐ {item.rating}</p>}
              {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-2 inline-block">View on Google</a>}
            </div>
          )) : (page === "home" && !loading && !error && <p className="text-gray-500 mt-4">No legacy recommendations yet. Click “Get My Recommendations” or start an itinerary.</p>)}
        </div>
      </div>

      {/* Full-page overlay shown while switching steps */}
      <FullOverlay show={showOverlay} text="Preparing next options..." />
    </>
  );
}

// src/pages/Planner.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import MapPlanner from "../components/MapPlanner";

// UI: grid of cards for the step
function StepGrid({ options = [], onSelect, loading, onHighlight, onRetry, onBack }) {
  if (!options || options.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-md rounded-3xl p-12 text-center shadow-xl border-0">
        <div className="mb-6">
          <p className="text-lg text-gray-600 mb-2">😅 No options available for this step.</p>
          <p className="text-gray-500">Try adjusting your location or preferences.</p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition shadow-lg font-medium"
            >
              🔄 Retry
            </button>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-800 rounded-xl hover:bg-gray-50 transition font-medium"
            >
              ← Go Back
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {options.map((o, idx) => (
        <div
          key={o.place_id || `${o.title ?? ""}::${o.address ?? ""}::${idx}`}
          className="bg-white/70 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition cursor-pointer border border-white/20 hover:border-blue-400 group"
          onMouseEnter={() => {
            if (onHighlight) onHighlight(o);
          }}
          onMouseLeave={() => {
            if (onHighlight) onHighlight(null);
          }}
        >
          {/* Thumbnail */}
          {o.thumbnail && (
            <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden">
              <img src={o.thumbnail} alt={o.title} className="w-full h-full object-cover group-hover:scale-110 transition" />
            </div>
          )}

          {/* Content */}
          <div className="p-5">
            <div className="flex justify-between items-start gap-2 mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-lg text-gray-800 line-clamp-2">{o.title || o.name || "Unnamed Place"}</h4>
                <p className="text-sm text-gray-600 mt-1 line-clamp-1">{o.address}</p>
                {o.distance_meters != null && (
                  <p className="text-xs text-blue-500 mt-1">
                    📏 {o.distance_meters < 1000
                      ? `${Math.round(o.distance_meters)} m away`
                      : `${(o.distance_meters / 1000).toFixed(1)} km away`}
                  </p>
                )}
              </div>
              {o.rating && <div className="text-lg font-semibold text-yellow-500 flex-shrink-0">⭐ {o.rating}</div>}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(o);
                }}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-medium text-sm disabled:opacity-50"
                disabled={loading}
              >
                ✓ Select
              </button>
              {o.link && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(o.link, "_blank", "noopener,noreferrer");
                  }}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
                >
                  🔗 Open
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Full-screen overlay with spinner & message
function FullOverlay({ show, text = "Loading next step..." }) {
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
}

export default function Planner() {
  const [userPrefs, setUserPrefs] = useState(null);
  const [user, setUser] = useState(null);

  // Location UI
  const [placeText, setPlaceText] = useState("");
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [locLoading, setLocLoading] = useState(false);

  // Stepper/session state
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

  // Inline error state
  const [plannerError, setPlannerError] = useState(null);

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
      setPlannerError("Geolocation not supported in your browser.");
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
        setPlannerError("Unable to read location: " + (err && err.message ? err.message : "permission denied"));
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10000 }
    );
  };

  const handlePlaceTextBlur = () => {
    if (placeText && placeText.trim()) {
      setCoords(null);
      persistPrefs({ location: placeText.trim(), coords: null });
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

  // Start session and show the step page (all options visible)
  const startSession = async () => {
    setPlannerError(null);
    if (!user || !userPrefs) {
      setPlannerError("Please log in and save preferences first.");
      return;
    }

    // Check if location is set
    const hasCoords = coords && typeof coords === "object" && coords.lat && coords.lng;
    const hasPlace = placeText && placeText.trim();
    const hasSavedLocation = userPrefs && userPrefs.location && userPrefs.location.trim();

    if (!hasCoords && !hasPlace && !hasSavedLocation) {
      setPlannerError("Please enter your current location or allow GPS access before starting your itinerary.");
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
          // include stage2 sub-preferences so backend can respect them (e.g. "No" stay)
          mood_sub: userPrefs.mood_sub,
          planningStyle_sub: userPrefs.planningStyle_sub,
          adventureLevel_sub: userPrefs.adventureLevel_sub,
          addOnMagic_sub: userPrefs.addOnMagic_sub,
          memorableFactor_sub: userPrefs.memorableFactor_sub,
        },
        // Prioritize current coords/location input over saved preferences
        coords: coords || userPrefs.coords || null,
        location: (placeText && placeText.trim() ? placeText.trim() : null) || userPrefs.location || null,
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

      // Frontend safety guard: if stage2 explicitly says "No" / "no stay",
      // ensure the stay step is removed even if backend included it.
      const advSubs = userPrefs && userPrefs.adventureLevel_sub;
      const hasNoStay = Array.isArray(advSubs)
        && advSubs.some((val) => {
          const s = String(val).toLowerCase().trim();
          return s === "no" || s.includes("no stay");
        });
      if (hasNoStay && Array.isArray(flow)) {
        flow = flow.filter((step) => step !== "stay");
      }

      console.log("📋 Determined flow from preferences:", flow, { hasNoStay, advSubs });
      setInitialFlow(flow);
      setFlowText(flow.map((f) => humanStepName(f)).join(" → "));
      setCurrentStep(flow[0] || "restaurant");

      // Use server-sent options (empty array if none returned — StepGrid handles empty state)
      const initialOptions = res.data.initial?.options || [];
      setStepOptions(initialOptions);
      setAnchorText(res.data.initial?.location_hint || payload.location || "");
      setSelectedChain([]);
      setPage("step");
    } catch (err) {
      console.error("Failed to start session", err);
      setPlannerError("Failed to start itinerary session. See console for details.");
    } finally {
      setSessionLoading(false);
    }
  };

  // Select an option from the grid of options for the current step
  // show full-page intermediary overlay while server processes selection and next options load
  const selectOption = async (opt) => {
    setPlannerError(null);
    if (!sessionId) {
      setPlannerError("Session missing. Start again.");
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
        setShowOverlay(false);
        setPage("summary");
      } else {
        setCurrentStep(nextStep);
        // if server provided next options use them, otherwise fallback to empty array and message
        const nextOpts = res.data.options || [];
        if (nextOpts.length > 0) {
          setStepOptions(nextOpts);
        } else {
          // graceful fallback: inform user and keep session open (they can retry)
          console.warn("No options returned for next step from server:", res.data);
          setStepOptions([]);
          setPlannerError("No nearby options found for the next step. You can try again or go back.");
        }
        setAnchorText(res.data.anchor_text || "");
        setShowOverlay(false);
      }
    } catch (err) {
      console.error("Selection failed", err);
      setShowOverlay(false);
      setPlannerError("Selection failed. See console.");
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
        // If server can't restore options, show error and let user restart
        setPlannerError("Couldn't restore previous step options. Please start over.");
        setPage("home");
        setSessionId(null);
        setStepOptions([]);
      }
    } catch (e) {
      console.warn("Back: failed to restore server options, using local fallback", e);
    } finally {
      setSessionLoading(false);
    }
  };

  const displayPref = (val) => {
    if (!val) return "—";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-purple-50 to-pink-50 pb-16">
        {/* HOME / preferences panel */}
        {page === "home" && (
          <div className="max-w-4xl mx-auto px-6 py-10">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Plan Your Perfect Meetup ✨
              </h1>
              <p className="text-gray-600 text-lg">Personalized recommendations based on your preferences</p>
            </div>

            <div className="bg-white/70 backdrop-blur-md shadow-xl rounded-3xl p-8 mb-8 border-0">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Preferences display */}
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Preferences</h2>
                  <div className="space-y-3">
                    <div className="bg-gradient-to-r from-blue-100 to-blue-50 p-3 rounded-xl">
                      <p className="text-sm text-gray-600">Mood</p>
                      <p className="font-medium text-gray-800">{displayPref(userPrefs?.mood)}</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-100 to-purple-50 p-3 rounded-xl">
                      <p className="text-sm text-gray-600">Planning Style</p>
                      <p className="font-medium text-gray-800">{displayPref(userPrefs?.planningStyle)}</p>
                    </div>
                    <div className="bg-gradient-to-r from-pink-100 to-pink-50 p-3 rounded-xl">
                      <p className="text-sm text-gray-600">Adventure Level</p>
                      <p className="font-medium text-gray-800">{displayPref(userPrefs?.adventureLevel)}</p>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-100 to-yellow-50 p-3 rounded-xl">
                      <p className="text-sm text-gray-600">Add-On Magic</p>
                      <p className="font-medium text-gray-800">{displayPref(userPrefs?.addOnMagic)}</p>
                    </div>
                    <div className="bg-gradient-to-r from-green-100 to-green-50 p-3 rounded-xl">
                      <p className="text-sm text-gray-600">Memorable Factor</p>
                      <p className="font-medium text-gray-800">{displayPref(userPrefs?.memorableFactor)}</p>
                    </div>
                  </div>
                </div>

                {/* Location & flow */}
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="block text-lg font-semibold text-gray-800 mb-3">Select Location</label>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={placeText}
                        onChange={(e) => setPlaceText(e.target.value)}
                        onBlur={handlePlaceTextBlur}
                        placeholder="Enter city or area..."
                        className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition"
                      />
                      <button
                        onClick={useMyLocation}
                        className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition shadow-lg"
                        disabled={locLoading}
                      >
                        📍 {locLoading ? "..." : "GPS"}
                      </button>
                    </div>
                    <div className="text-sm text-gray-500">
                      {coords ? `📌 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : placeText ? `📍 ${placeText}` : "No location set"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-lg font-semibold text-gray-800 mb-3">Your Planned Flow</label>
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-xl font-medium text-center">
                      {flowText || "Restaurant → Activity → Stay"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error banner */}
              {plannerError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {plannerError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={startSession}
                  disabled={sessionLoading || (!coords && !placeText && !(userPrefs && userPrefs.location))}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-purple-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sessionLoading ? "Starting..." : "🚀 Generate Itinerary"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP PAGE: show all options for current step */}
        {page === "step" && (
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {currentStep ? humanStepName(currentStep) : "Done"}
                </h1>
                <p className="text-gray-600 mt-2">{anchorText}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={goBackOneStep}
                  className="px-5 py-3 bg-white/70 backdrop-blur-md text-gray-800 rounded-xl hover:bg-white/90 transition shadow-lg font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={() => { setPage("home"); setSessionId(null); setSelectedChain([]); }}
                  className="px-5 py-3 bg-red-500/10 text-red-600 rounded-xl hover:bg-red-500/20 transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Error banner */}
            {plannerError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {plannerError}
              </div>
            )}

            {/* Map display */}
            <div className="mb-8 bg-white/70 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl border-0">
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

            <StepGrid
              options={stepOptions}
              onSelect={selectOption}
              loading={sessionLoading}
              onHighlight={setHighlightedPlace}
              onRetry={startSession}
              onBack={() => { setPage("home"); setSessionId(null); }}
            />
          </div>
        )}

        {/* SUMMARY PAGE */}
        {page === "summary" && (
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
                Your Perfect Itinerary 🎉
              </h1>
              <p className="text-gray-600 text-lg">Ready to explore!</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Itinerary list */}
              <div className="bg-white/70 backdrop-blur-md shadow-xl rounded-3xl p-8 border-0">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">Your Plan</h2>
                <ol className="space-y-4">
                  {selectedChain.map((s, i) => (
                    <li key={`${s.step}::${s.place?.title ?? i}`} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{humanStepName(s.step)}</p>
                        <p className="text-gray-600">{s.place.title || s.place.name || s.place.address}</p>
                        {s.place.address && <p className="text-sm text-gray-500 mt-1">📍 {s.place.address}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-col gap-3 mt-8">
                  <button
                    onClick={() => { setPage("home"); setSessionId(null); setSelectedChain([]); }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition shadow-lg font-semibold"
                  >
                    🚀 Plan Another Meetup
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 text-gray-800 rounded-xl hover:bg-gray-50 transition font-semibold"
                  >
                    🖨️ Print / Save
                  </button>
                </div>
              </div>

              {/* Map display */}
              <div className="bg-white/70 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden border-0">
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
          </div>
        )}
      </div>

      {/* Full-page overlay shown while switching steps */}
      <FullOverlay show={showOverlay} text="Preparing next options..." />
    </>
  );
}

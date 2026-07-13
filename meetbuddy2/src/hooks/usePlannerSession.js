// src/hooks/usePlannerSession.js
// All planner session state + API calls, extracted from Planner.jsx so the
// view components (PlannerHome / StepExplorer / ItineraryCanvas) stay thin.
import { useState, useEffect } from "react";
import axios from "axios";

export const PREF_META = [
  { key: "mood", label: "Mood", emoji: "🎭" },
  { key: "planningStyle", label: "Planning Style", emoji: "🗺️" },
  { key: "adventureLevel", label: "Adventure Level", emoji: "🧭" },
  { key: "addOnMagic", label: "Add-On Magic", emoji: "✨" },
  { key: "memorableFactor", label: "Memorable Factor", emoji: "💫" },
];

export const STEP_EMOJI = { restaurant: "🍽️", activity: "🎯", stay: "🏨", cafe: "☕", custom: "📍" };

// Full-control filter chips: best-effort matchers over the venue data we have
export const FILTER_MATCHERS = {
  "price": (o) => !o.price || String(o.price).length <= 2,
  "private seating": (o) => /private|lounge|rooftop|fine din/i.test(`${o.title || ""} ${o.type || ""}`),
  "dietary options": (o) => /veg|vegan|salad|health/i.test(`${o.title || ""} ${o.type || ""}`),
  "live music": (o) => /live|music|bar|club|lounge|brew/i.test(`${o.title || ""} ${o.type || ""}`),
};

// Service-flavored questionnaire answers become visible reminders on the
// itinerary — honest notes instead of pretending unavailable services exist.
export const deriveServiceNotes = (prefs) => {
  if (!prefs) return [];
  const notes = [];
  const sub = (cat) => (typeof prefs[`${cat}_sub`] === "object" && prefs[`${cat}_sub`]) || {};
  const val = (cat, key) => {
    const v = sub(cat)[key];
    return Array.isArray(v) ? v.join(", ") : v ? String(v) : "";
  };
  const addon = String(prefs.addOnMagic || "");

  if (addon.includes("Easy rides")) {
    const scope = val("addOnMagic", "ea_scope");
    notes.push(`🚕 Arrange rides${scope ? ` — ${scope.toLowerCase()}` : ""}`);
  }
  const transport = val("adventureLevel", "sc_transport");
  if (/rides/i.test(transport)) notes.push("🚕 Arrange rides for the group");
  else if (/parking/i.test(transport)) notes.push("🅿️ Check parking availability at each stop");

  if (addon.includes("Surprise gift") || addon.includes("Insta")) {
    const picks = val("addOnMagic", "sg_type");
    notes.push(`🎁 Prepare: ${picks || "surprise gift / photo setup"}`);
  }
  if (/table reservation/i.test(val("addOnMagic", "lm_seating"))) {
    notes.push("📅 Reserve a table in advance for the live music spot");
  }
  if (/yes/i.test(val("mood", "ro_surprise"))) {
    notes.push("🌹 Plan the surprise element — gifts or music");
  }
  const memAddons = val("memorableFactor", "dc_addons");
  if (/photo session/i.test(memAddons)) notes.push("📸 Book or plan a photo session");
  if (/guestbook|keepsake/i.test(memAddons)) notes.push("📖 Bring a guestbook / keepsake");

  const confirm = val("planningStyle", "sc_confirm");
  if (/auto-book/i.test(confirm)) {
    notes.push("⚠️ Auto-booking isn't available yet — please confirm bookings yourself");
  } else if (/^yes/i.test(confirm)) {
    notes.push("📞 Confirm your bookings before heading out");
  }
  return notes;
};

export const applyFiltersAndSort = (options, filters, sortBy) => {
  let out = options;
  for (const f of filters) {
    const matcher = FILTER_MATCHERS[f];
    if (matcher) out = out.filter(matcher);
  }
  if (sortBy === "rating") {
    out = [...out].sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
  } else if (sortBy === "distance") {
    out = [...out].sort(
      (a, b) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity)
    );
  }
  return out;
};

export const humanStepName = (step) =>
  ({ restaurant: "Restaurant", activity: "Activity / Things to do", stay: "Stay / Hotel",
     cafe: "Cafe", custom: "Custom stop" }[step] || step);

export default function usePlannerSession() {
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

  // Questionnaire-driven planning behavior
  const [planMode, setPlanMode] = useState("semi"); // "surprise" | "semi" | "full"
  const [directives, setDirectives] = useState(null); // shortlist size, filters, ...
  const [optionsByStep, setOptionsByStep] = useState({}); // step -> options[] (powers swaps)
  const [overlayText, setOverlayText] = useState("Loading next step...");
  const [swapIndex, setSwapIndex] = useState(null); // itinerary stop being swapped
  const [showAllOptions, setShowAllOptions] = useState(false); // shortlist escape hatch

  // Full-control mode: option filters, sorting, and step management
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState("match"); // "match" | "rating" | "distance"
  const [showStepEditor, setShowStepEditor] = useState(false);

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
    } catch { /* localStorage unavailable */ }
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

  // ---------------- Stepper/session flow (all options visible per step) ----------------

  // derive flow from backend provided place types (basic) - fallback only
  const deriveFlowFromPlaceTypes = (place_types = []) => {
    const flow = [];
    if (!place_types || place_types.length === 0) {
      return ["restaurant"]; // Minimal default - just restaurant
    }
    if (place_types.includes("restaurant") || place_types.includes("cafe")) flow.push("restaurant");
    if (place_types.some((p) => ["tourist_attraction", "park", "amusement_park", "play_area", "scenic"].includes(p))) flow.push("activity");
    if (place_types.some((p) => ["hotel", "resort", "lodging"].includes(p))) flow.push("stay");
    if (flow.length === 0) flow.push("restaurant");
    return flow;
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

      setInitialFlow(flow);
      setFlowText(flow.map((f) => humanStepName(f)).join(" → "));
      setCurrentStep(flow[0] || "restaurant");

      // Use server-sent options (empty array if none returned — StepGrid handles empty state)
      const initialOptions = res.data.initial?.options || [];
      const searchError = res.data.initial?.search_error;
      if (initialOptions.length === 0 && searchError) {
        // Every search attempt failed server-side (e.g. invalid SerpAPI key) —
        // stay on the home page and show the real reason instead of an empty grid
        setPlannerError(`Venue search failed: ${searchError}`);
        return;
      }

      // Planning mode comes from the questionnaire (Surprise me / Semi-custom / Full control)
      const mode = res.data.initial?.plan_mode || "semi";
      setPlanMode(mode);
      setDirectives(res.data.initial?.directives || null);
      setShowAllOptions(false);
      setAnchorText(res.data.initial?.location_hint || payload.location || "");
      setSelectedChain([]);

      if (mode === "surprise" && initialOptions.length > 0) {
        // Surprise me: auto-build the whole itinerary, no step pages
        await autoPlan(sid, flow, initialOptions);
        return;
      }

      setOptionsByStep({ [flow[0] || "restaurant"]: initialOptions });
      setStepOptions(initialOptions);
      setPage("step");
    } catch (err) {
      console.error("Failed to start session", err);
      setPlannerError("Failed to start itinerary session. See console for details.");
    } finally {
      setSessionLoading(false);
    }
  };

  // Surprise mode: chain server selections automatically, picking the
  // top-scored option for every step, then land straight on the itinerary.
  const autoPlan = async (sid, flow, firstOptions) => {
    setOverlayText(`Picking your ${humanStepName(flow[0] || "restaurant").toLowerCase()}...`);
    setShowOverlay(true);
    const chain = [];
    const optsMap = {};
    let options = firstOptions;
    try {
      for (let i = 0; i < flow.length; i++) {
        const step = flow[i];
        optsMap[step] = options;
        if (!options || options.length === 0) {
          setPlannerError(`No options found for the ${humanStepName(step).toLowerCase()} step.`);
          break;
        }
        const pick = options[0];
        chain.push({ step, place: pick });
        const nextStep = i + 1 < flow.length ? flow[i + 1] : "done";
        if (nextStep !== "done") {
          setOverlayText(`Finding your ${humanStepName(nextStep).toLowerCase()}...`);
        }
        const res = await axios.post(
          `http://localhost:8000/planner/session/${sid}/select`,
          { step, place: pick, next_step: nextStep, selected_tokens: [] },
          { timeout: 120000 }
        );
        if (nextStep === "done") break;
        options = res.data.options || [];
        if (options.length === 0 && res.data.search_error) {
          setPlannerError(`Venue search failed: ${res.data.search_error}`);
          break;
        }
      }
      setOptionsByStep(optsMap);
      setSelectedChain(chain);
      setCurrentStep(null);
      setStepOptions([]);
      setPage("summary");
    } catch (err) {
      console.error("Auto-plan failed", err);
      setPlannerError("Auto-planning failed partway. Please try again.");
      if (chain.length > 0) {
        setOptionsByStep(optsMap);
        setSelectedChain(chain);
        setPage("summary");
      }
    } finally {
      setShowOverlay(false);
    }
  };

  // Swap one itinerary stop for an alternative. Earlier stops are kept;
  // stops after the swapped one are re-picked because they anchor to it.
  const swapStop = async (index, newPlace) => {
    setSwapIndex(null);
    if (!sessionId || !selectedChain[index]) return;
    setOverlayText(`Swapping your ${humanStepName(selectedChain[index].step).toLowerCase()}...`);
    setShowOverlay(true);
    const flowSteps = selectedChain.map((s) => s.step);
    const newChain = selectedChain.slice(0, index);
    let place = newPlace;
    try {
      for (let i = index; i < flowSteps.length; i++) {
        const step = flowSteps[i];
        newChain.push({ step, place });
        const nextStep = i + 1 < flowSteps.length ? flowSteps[i + 1] : "done";
        const res = await axios.post(
          `http://localhost:8000/planner/session/${sessionId}/select`,
          { step, place, next_step: nextStep, selected_tokens: [] },
          { timeout: 120000 }
        );
        if (nextStep === "done") break;
        const opts = res.data.options || [];
        if (opts.length > 0) {
          setOptionsByStep((m) => ({ ...m, [nextStep]: opts }));
          setOverlayText(`Refreshing your ${humanStepName(nextStep).toLowerCase()}...`);
          place = opts[0];
        } else {
          // Search came back empty — keep the previous pick for this stop
          const old = selectedChain[i + 1];
          if (!old) break;
          place = old.place;
        }
      }
      // If the re-chain broke early, keep the old picks for remaining stops
      while (newChain.length < selectedChain.length) {
        newChain.push(selectedChain[newChain.length]);
      }
      setSelectedChain(newChain);
    } catch (err) {
      console.error("Swap failed", err);
      setPlannerError("Swap failed. Please try again.");
    } finally {
      setShowOverlay(false);
    }
  };

  // Full control: skip the current step without picking a venue.
  // Followups keep anchoring to the last real selection (or the origin).
  const skipStep = async () => {
    if (!sessionId || !currentStep) return;
    const idx = initialFlow.indexOf(currentStep);
    const nextStep = idx + 1 < initialFlow.length ? initialFlow[idx + 1] : "done";
    const newFlow = initialFlow.filter((s) => s !== currentStep);
    setPlannerError(null);

    if (nextStep === "done") {
      setInitialFlow(newFlow);
      setCurrentStep(null);
      setStepOptions([]);
      setPage(selectedChain.length > 0 ? "summary" : "home");
      return;
    }

    setOverlayText(`Skipping to ${humanStepName(nextStep).toLowerCase()}...`);
    setShowOverlay(true);
    try {
      const res = await axios.post(
        `http://localhost:8000/planner/session/${sessionId}/skip`,
        { next_step: nextStep },
        { timeout: 120000 }
      );
      const opts = res.data.options || [];
      setInitialFlow(newFlow);
      setCurrentStep(nextStep);
      setStepOptions(opts);
      setShowAllOptions(false);
      setActiveFilters([]);
      if (opts.length > 0) {
        setOptionsByStep((m) => ({ ...m, [nextStep]: opts }));
      } else if (res.data.search_error) {
        setPlannerError(`Venue search failed: ${res.data.search_error}`);
      }
      setAnchorText(res.data.anchor_text || anchorText);
    } catch (err) {
      console.error("Skip failed", err);
      setPlannerError("Couldn't skip this step. Please try again.");
    } finally {
      setShowOverlay(false);
    }
  };

  // Full control: edit upcoming steps (the current step stays as the anchor)
  const upcomingSteps = currentStep
    ? initialFlow.slice(initialFlow.indexOf(currentStep) + 1)
    : [];

  const setUpcoming = (newUpcoming) => {
    const currentIdx = initialFlow.indexOf(currentStep);
    setInitialFlow([...initialFlow.slice(0, currentIdx + 1), ...newUpcoming]);
  };

  const removeUpcomingStep = (step) => setUpcoming(upcomingSteps.filter((s) => s !== step));

  const addUpcomingStep = (step) => {
    if (initialFlow.includes(step)) return;
    setUpcoming([...upcomingSteps, step]);
  };

  const moveUpcomingStep = (step, dir) => {
    const idx = upcomingSteps.indexOf(step);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= upcomingSteps.length) return;
    const next = [...upcomingSteps];
    [next[idx], next[target]] = [next[target], next[idx]];
    setUpcoming(next);
  };

  // Select an option from the grid of options for the current step
  const selectOption = async (opt) => {
    setPlannerError(null);
    if (!sessionId) {
      setPlannerError("Session missing. Start again.");
      return;
    }
    setOverlayText("Preparing next options...");
    setShowOverlay(true);
    setSessionLoading(true);

    try {
      const payload = {
        step: currentStep || "restaurant",
        place: opt,
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
        setCurrentStep(null);
        setStepOptions([]);
        setShowOverlay(false);
        setPage("summary");
      } else {
        setCurrentStep(nextStep);
        const nextOpts = res.data.options || [];
        setShowAllOptions(false);
        setActiveFilters([]);
        setSortBy("match");
        if (nextOpts.length > 0) {
          setStepOptions(nextOpts);
          setOptionsByStep((m) => ({ ...m, [nextStep]: nextOpts }));
        } else {
          console.warn("No options returned for next step from server:", res.data);
          setStepOptions([]);
          setPlannerError(
            res.data.search_error
              ? `Venue search failed: ${res.data.search_error}`
              : "No nearby options found for the next step. You can try again or go back."
          );
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
      setPage("home");
      return;
    }
    if (selectedChain.length === 0) {
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

    // try to get session state from server and restore last_options
    try {
      setSessionLoading(true);
      const res = await axios.get(`http://localhost:8000/planner/session/${sessionId}`, { timeout: 30000 });
      const s = res.data || {};
      const last_opts = (s.last_options && s.last_options[stepToRestore]) || (s.last_options && s.last_options.initial) || s.options || [];
      if (last_opts && last_opts.length) {
        setStepOptions(last_opts);
      } else {
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

  return {
    userPrefs, user, placeText, setPlaceText, coords, locLoading,
    page, setPage, sessionId, setSessionId, currentStep, stepOptions,
    anchorText, selectedChain, setSelectedChain, sessionLoading,
    flowText, initialFlow, showOverlay, overlayText,
    highlightedPlace, setHighlightedPlace, plannerError, setPlannerError,
    planMode, directives, optionsByStep, setOptionsByStep,
    swapIndex, setSwapIndex, showAllOptions, setShowAllOptions,
    activeFilters, setActiveFilters, sortBy, setSortBy,
    showStepEditor, setShowStepEditor, upcomingSteps,
    useMyLocation, handlePlaceTextBlur, startSession, autoPlan,
    swapStop, skipStep, removeUpcomingStep, addUpcomingStep,
    moveUpcomingStep, selectOption, goBackOneStep,
  };
}

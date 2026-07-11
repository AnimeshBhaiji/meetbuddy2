// src/pages/Planner.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  LocateFixed,
  Rocket,
  ArrowLeft,
  ArrowRight,
  X,
  Star,
  ExternalLink,
  Check,
  RotateCcw,
  Printer,
  PartyPopper,
  AlertTriangle,
} from "lucide-react";
import Navbar from "../components/Navbar";
import MapPlanner from "../components/MapPlanner";
import AmbientBackground from "@/components/AmbientBackground";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";

const PREF_META = [
  { key: "mood", label: "Mood", emoji: "🎭" },
  { key: "planningStyle", label: "Planning Style", emoji: "🗺️" },
  { key: "adventureLevel", label: "Adventure Level", emoji: "🧭" },
  { key: "addOnMagic", label: "Add-On Magic", emoji: "✨" },
  { key: "memorableFactor", label: "Memorable Factor", emoji: "💫" },
];

const STEP_EMOJI = { restaurant: "🍽️", activity: "🎯", stay: "🏨" };

// Full-control filter chips: best-effort matchers over the venue data we have
const FILTER_MATCHERS = {
  "price": (o) => !o.price || String(o.price).length <= 2,
  "private seating": (o) => /private|lounge|rooftop|fine din/i.test(`${o.title || ""} ${o.type || ""}`),
  "dietary options": (o) => /veg|vegan|salad|health/i.test(`${o.title || ""} ${o.type || ""}`),
  "live music": (o) => /live|music|bar|club|lounge|brew/i.test(`${o.title || ""} ${o.type || ""}`),
};

// Service-flavored questionnaire answers become visible reminders on the
// itinerary — honest notes instead of pretending unavailable services exist.
const deriveServiceNotes = (prefs) => {
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

const applyFiltersAndSort = (options, filters, sortBy) => {
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

// Inline error banner (dark destructive style)
function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 bg-destructive/10 border border-destructive/30 text-red-300 rounded-xl text-sm flex items-center gap-3"
    >
      <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-400" />
      {message}
    </motion.div>
  );
}

// UI: grid of cards for the step
function StepGrid({ options = [], onSelect, loading, onHighlight, onRetry, onBack, pickBadge = false }) {
  if (!options || options.length === 0) {
    return (
      <GlassCard variant="strong" className="p-12 text-center">
        <div className="mb-6">
          <p className="text-lg text-foreground/85 mb-2">😅 No options available for this step.</p>
          <p className="text-muted-foreground">Try adjusting your location or preferences.</p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          {onRetry && (
            <GlowButton onClick={onRetry}>
              <RotateCcw className="w-4.5 h-4.5" /> Retry
            </GlowButton>
          )}
          {onBack && (
            <GlowButton variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4.5 h-4.5" /> Go back
            </GlowButton>
          )}
        </div>
      </GlassCard>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {options.map((o, idx) => (
        <motion.div
          key={o.place_id || `${o.title ?? ""}::${o.address ?? ""}::${idx}`}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(idx * 0.06, 0.5), duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -6 }}
          className="relative glass-strong rounded-2xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand/50 hover:glow-sm transition-all duration-300 group"
          onMouseEnter={() => {
            if (onHighlight) onHighlight(o);
          }}
          onMouseLeave={() => {
            if (onHighlight) onHighlight(null);
          }}
        >
          {pickBadge && idx === 0 && (
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-brand to-brand-2 glow-sm">
              ⭐ MeetBuddy's pick
            </span>
          )}
          {/* Thumbnail */}
          {o.thumbnail && (
            <div className="w-full h-40 bg-gradient-to-br from-brand/15 to-brand-2/15 overflow-hidden relative">
              <img
                src={o.thumbnail}
                alt={o.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              {o.rating && (
                <span className="absolute top-3 right-3 glass-strong px-2.5 py-1 rounded-lg text-sm font-semibold text-yellow-400 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400" /> {o.rating}
                </span>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-5">
            <div className="flex justify-between items-start gap-2 mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-lg text-white line-clamp-2">
                  {o.title || o.name || "Unnamed Place"}
                </h4>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{o.address}</p>
                {o.distance_meters != null && (
                  <p className="text-xs text-brand-3 mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {o.distance_meters < 1000
                      ? `${Math.round(o.distance_meters)} m away`
                      : `${(o.distance_meters / 1000).toFixed(1)} km away`}
                  </p>
                )}
              </div>
              {!o.thumbnail && o.rating && (
                <div className="text-base font-semibold text-yellow-400 flex-shrink-0 flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400" /> {o.rating}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-3 border-t border-white/10">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(o);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-brand to-brand-2 text-white rounded-lg font-medium text-sm glow-sm hover:glow-md transition-shadow duration-300 cursor-pointer disabled:opacity-50"
                disabled={loading}
              >
                <Check className="w-4 h-4" /> Select
              </motion.button>
              {o.link && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(o.link, "_blank", "noopener,noreferrer");
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 glass text-foreground/85 rounded-lg hover:bg-white/10 hover:text-white transition font-medium text-sm cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" /> Open
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Full-screen overlay with spinner & message
function FullOverlay({ show, text = "Loading next step..." }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-strong rounded-2xl p-8 flex flex-col items-center gap-5 glow-sm"
          >
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand border-r-brand-2 animate-spin" />
            </div>
            <div className="text-foreground font-medium">{text}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Flow stepper pills shown on the step page
function FlowStepper({ flow, currentStep, humanStepName }) {
  if (!flow || flow.length === 0) return null;
  const currentIdx = flow.indexOf(currentStep);
  return (
    <div className="flex flex-wrap items-center gap-2 mb-8">
      {flow.map((step, i) => {
        const isDone = currentIdx > i;
        const isCurrent = currentIdx === i;
        return (
          <React.Fragment key={step}>
            {i > 0 && <span className="text-muted-foreground/50 text-sm">→</span>}
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isCurrent
                  ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50 glow-sm"
                  : isDone
                  ? "glass text-brand-3 border border-brand/25"
                  : "glass text-muted-foreground"
              }`}
            >
              {isDone ? <Check className="w-3.5 h-3.5" /> : <span>{STEP_EMOJI[step] ?? "📍"}</span>}
              {humanStepName(step)}
            </span>
          </React.Fragment>
        );
      })}
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

  const displayPref = (val) => {
    if (!val) return "—";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AmbientBackground intensity="app" />
      <Navbar />

      <div className="min-h-screen pt-28 pb-16">
        {/* HOME / preferences panel */}
        {page === "home" && (
          <div className="max-w-4xl mx-auto px-6 py-6">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                Plan your perfect <span className="text-gradient">meetup</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                Personalized recommendations based on your preferences
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <GlassCard variant="gradient" className="p-8 mb-8">
                <div className="grid md:grid-cols-2 gap-10 mb-8">
                  {/* Preferences display */}
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-5">Your preferences</h2>
                    <div className="space-y-3">
                      {PREF_META.map(({ key, label, emoji }) => (
                        <div
                          key={key}
                          className="flex items-center gap-3.5 glass rounded-xl p-3.5"
                        >
                          <span className="text-xl">{emoji}</span>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                            <p className="font-medium text-white truncate">{displayPref(userPrefs?.[key])}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Location & flow */}
                  <div className="flex flex-col gap-7">
                    <div>
                      <label className="block text-xl font-semibold text-white mb-4">Select location</label>
                      <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
                          <input
                            value={placeText}
                            onChange={(e) => setPlaceText(e.target.value)}
                            onBlur={handlePlaceTextBlur}
                            placeholder="Enter city or area..."
                            className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-brand/60 focus:ring-2 focus:ring-brand/30 focus:bg-white/[0.07]"
                          />
                        </div>
                        <GlowButton onClick={useMyLocation} disabled={locLoading} aria-label="Use GPS location">
                          <LocateFixed className={`w-4.5 h-4.5 ${locLoading ? "animate-spin" : ""}`} />
                          GPS
                        </GlowButton>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-3" />
                        {coords
                          ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                          : placeText
                          ? placeText
                          : "No location set"}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xl font-semibold text-white mb-4">Your planned flow</label>
                      <div className="glass rounded-xl p-4 font-medium text-center border border-brand/25">
                        <span className="text-gradient">{flowText || "Restaurant → Activity → Stay"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <ErrorBanner message={plannerError} />

                {/* Action buttons */}
                <GlowButton
                  onClick={startSession}
                  disabled={sessionLoading || (!coords && !placeText && !(userPrefs && userPrefs.location))}
                  size="lg"
                  className="w-full"
                >
                  {sessionLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" /> Generate itinerary
                    </>
                  )}
                </GlowButton>
              </GlassCard>
            </motion.div>
          </div>
        )}

        {/* STEP PAGE: show all options for current step */}
        {page === "step" && (() => {
          // Semi-custom "shortlist 3–5": trim to the top picks unless expanded
          const shortlist = planMode === "semi" ? directives?.shortlist : null;
          let displayedOptions =
            shortlist && !showAllOptions ? stepOptions.slice(0, shortlist) : stepOptions;
          // Full control: apply filter chips + sort
          if (planMode === "full") {
            displayedOptions = applyFiltersAndSort(displayedOptions, activeFilters, sortBy);
          }
          const filterChips = planMode === "full" ? directives?.filters || [] : [];
          return (
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
              <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-4xl md:text-5xl font-bold text-gradient">
                    {currentStep ? humanStepName(currentStep) : "Done"}
                  </h1>
                  <span className="glass px-3 py-1 rounded-full text-xs font-medium text-brand-3 border border-brand/25">
                    {planMode === "full" ? "🎛️ Full control" : "🎨 Guided"} mode
                  </span>
                </div>
                {anchorText && (
                  <p className="text-muted-foreground mt-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-brand-3" /> {anchorText}
                  </p>
                )}
              </motion.div>
              <div className="flex gap-3 shrink-0 flex-wrap">
                <GlowButton variant="ghost" onClick={goBackOneStep}>
                  <ArrowLeft className="w-4.5 h-4.5" /> Back
                </GlowButton>
                {planMode === "full" && (
                  <GlowButton variant="ghost" onClick={skipStep}>
                    Skip step <ArrowRight className="w-4.5 h-4.5" />
                  </GlowButton>
                )}
                <GlowButton
                  variant="danger"
                  onClick={() => {
                    setPage("home");
                    setSessionId(null);
                    setSelectedChain([]);
                  }}
                >
                  <X className="w-4.5 h-4.5" /> Cancel
                </GlowButton>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <FlowStepper flow={initialFlow} currentStep={currentStep} humanStepName={humanStepName} />
              {planMode === "full" && upcomingSteps.length >= 0 && (
                <button
                  onClick={() => setShowStepEditor((s) => !s)}
                  className="mb-8 inline-flex items-center gap-1.5 px-3 py-1.5 glass rounded-full text-xs font-medium text-brand-3 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  ⚙️ Edit steps
                </button>
              )}
            </div>

            {/* Full-control step editor: manage upcoming steps */}
            {planMode === "full" && showStepEditor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-8 glass rounded-2xl p-5 border border-brand/20"
              >
                <p className="text-sm font-semibold text-white mb-3">
                  Upcoming steps <span className="text-muted-foreground font-normal">(current step anchors your plan)</span>
                </p>
                {upcomingSteps.length === 0 && (
                  <p className="text-sm text-muted-foreground mb-3">No steps after this one.</p>
                )}
                <div className="space-y-2 mb-4">
                  {upcomingSteps.map((s, i) => (
                    <div key={s} className="flex items-center gap-3 glass rounded-xl px-4 py-2.5">
                      <span className="flex-1 text-sm text-white">
                        {STEP_EMOJI[s]} {humanStepName(s)}
                      </span>
                      <button
                        onClick={() => moveUpcomingStep(s, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveUpcomingStep(s, 1)}
                        disabled={i === upcomingSteps.length - 1}
                        aria-label="Move down"
                        className="p-1 text-muted-foreground hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeUpcomingStep(s)}
                        aria-label={`Remove ${s}`}
                        className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {["restaurant", "activity", "stay"]
                    .filter((s) => !initialFlow.includes(s))
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => addUpcomingStep(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-xs font-medium text-brand-3 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      >
                        + {STEP_EMOJI[s]} {humanStepName(s)}
                      </button>
                    ))}
                </div>
              </motion.div>
            )}

            {/* Full-control filter chips + sort */}
            {planMode === "full" && stepOptions.length > 0 && (
              <div className="mb-6 flex items-center gap-2 flex-wrap">
                {filterChips.map((f) => {
                  const active = activeFilters.includes(f);
                  return (
                    <button
                      key={f}
                      onClick={() =>
                        setActiveFilters((cur) =>
                          cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 ${
                        active
                          ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50 glow-sm"
                          : "glass text-foreground/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-brand-3" />}
                      {f}
                    </button>
                  );
                })}
                <span className="mx-1 h-5 w-px bg-white/15" />
                {[
                  ["match", "Best match"],
                  ["rating", "Top rated"],
                  ["distance", "Nearest"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className={`px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 ${
                      sortBy === key
                        ? "glass text-white border border-white/25"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <ErrorBanner message={plannerError} />

            {/* Map display */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="mb-8 glass-strong rounded-3xl overflow-hidden border border-white/10"
            >
              <MapPlanner
                options={displayedOptions}
                selectedChain={selectedChain}
                onSelect={selectOption}
                onPreview={(place) => {
                  if (place.link) window.open(place.link, "_blank", "noopener,noreferrer");
                }}
                highlightedPlace={highlightedPlace}
              />
            </motion.div>

            {/* Shortlist banner + escape hatch */}
            {shortlist && stepOptions.length > shortlist && (
              <div className="mb-6 flex items-center justify-between gap-4 glass rounded-2xl px-5 py-3.5 border border-brand/20">
                <p className="text-sm text-muted-foreground">
                  {showAllOptions
                    ? `Showing all ${stepOptions.length} options`
                    : `✨ Shortlisted the top ${Math.min(shortlist, stepOptions.length)} picks for you`}
                </p>
                <button
                  onClick={() => setShowAllOptions((s) => !s)}
                  className="shrink-0 text-sm font-medium text-brand-3 hover:text-white transition-colors cursor-pointer"
                >
                  {showAllOptions ? "Back to shortlist" : `Show all ${stepOptions.length}`}
                </button>
              </div>
            )}

            {planMode === "full" && displayedOptions.length === 0 && stepOptions.length > 0 ? (
              <GlassCard variant="strong" className="p-10 text-center">
                <p className="text-foreground/85 mb-5">No venues match your active filters.</p>
                <GlowButton variant="ghost" onClick={() => setActiveFilters([])}>
                  Clear filters
                </GlowButton>
              </GlassCard>
            ) : (
              <StepGrid
                options={displayedOptions}
                pickBadge={planMode === "semi" && !showAllOptions}
                onSelect={selectOption}
                loading={sessionLoading}
                onHighlight={setHighlightedPlace}
                onRetry={startSession}
                onBack={() => {
                  setPage("home");
                  setSessionId(null);
                }}
              />
            )}
          </div>
          );
        })()}

        {/* SUMMARY PAGE */}
        {page === "summary" && (
          <div className="max-w-6xl mx-auto px-6 py-6">
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center mb-12"
            >
              <motion.div
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.15 }}
                className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center glow-md"
              >
                <PartyPopper className="w-8 h-8 text-white" />
              </motion.div>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-3">
                Your perfect <span className="text-gradient">itinerary</span>
              </h1>
              <p className="text-muted-foreground text-lg">Ready to explore!</p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Itinerary timeline */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <GlassCard variant="gradient" className="p-8 h-full">
                  <h2 className="text-2xl font-semibold text-white mb-8">Your plan</h2>
                  <ol className="relative space-y-8 pl-2">
                    {selectedChain.map((s, i) => (
                      <motion.li
                        key={`${s.step}::${s.place?.title ?? i}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + i * 0.15 }}
                        className="flex gap-5 relative"
                      >
                        {/* connector line */}
                        {i < selectedChain.length - 1 && (
                          <span className="absolute left-[19px] top-11 bottom-[-32px] w-px bg-gradient-to-b from-brand/60 to-brand-2/30" />
                        )}
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-brand to-brand-2 text-white rounded-full flex items-center justify-center font-bold glow-sm z-10">
                          {i + 1}
                        </div>
                        <div className="pt-0.5 flex-1">
                          <p className="font-semibold text-brand-3 text-sm uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                            {STEP_EMOJI[s.step] ?? "📍"} {humanStepName(s.step)}
                          </p>
                          <p className="text-white font-medium text-lg">
                            {s.place.title || s.place.name || s.place.address}
                          </p>
                          {s.place.address && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" /> {s.place.address}
                            </p>
                          )}
                          {sessionId && (optionsByStep[s.step] || []).length > 1 && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSwapIndex(i)}
                              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-xs font-medium text-brand-3 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Swap
                            </motion.button>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                  {/* Service reminders from the questionnaire */}
                  {deriveServiceNotes(userPrefs).length > 0 && (
                    <div className="mt-8 glass rounded-2xl p-5 border border-brand/20">
                      <p className="text-sm font-semibold text-white mb-3">Don't forget</p>
                      <ul className="space-y-2">
                        {deriveServiceNotes(userPrefs).map((note) => (
                          <li key={note} className="text-sm text-foreground/85">
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-10">
                    <GlowButton
                      onClick={() => {
                        setPage("home");
                        setSessionId(null);
                        setSelectedChain([]);
                      }}
                      size="lg"
                      className="w-full"
                    >
                      <Rocket className="w-5 h-5" /> Plan another meetup
                    </GlowButton>
                    <GlowButton variant="ghost" onClick={() => window.print()} size="lg" className="w-full">
                      <Printer className="w-5 h-5" /> Print / Save
                    </GlowButton>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Map display */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="glass-strong rounded-3xl overflow-hidden border border-white/10"
              >
                <MapPlanner
                  options={[]}
                  selectedChain={selectedChain}
                  onSelect={() => {}}
                  onPreview={(place) => {
                    if (place.link) window.open(place.link, "_blank", "noopener,noreferrer");
                  }}
                  highlightedPlace={highlightedPlace}
                />
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* Swap-a-stop modal: pick an alternative for one itinerary stop */}
      <AnimatePresence>
        {swapIndex != null && selectedChain[swapIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
            onClick={() => setSwapIndex(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-white/10"
            >
              <div className="p-6 pb-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Swap {humanStepName(selectedChain[swapIndex].step).toLowerCase()}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Currently: {selectedChain[swapIndex].place.title}
                    {swapIndex < selectedChain.length - 1 && " · later stops will refresh"}
                  </p>
                </div>
                <button
                  onClick={() => setSwapIndex(null)}
                  aria-label="Close"
                  className="p-2 rounded-full text-muted-foreground hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-2">
                {(optionsByStep[selectedChain[swapIndex].step] || [])
                  .filter(
                    (o) =>
                      (o.place_id || o.title) !==
                      (selectedChain[swapIndex].place.place_id || selectedChain[swapIndex].place.title)
                  )
                  .slice(0, 8)
                  .map((o, i) => (
                    <motion.button
                      key={o.place_id || `${o.title}-${i}`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => swapStop(swapIndex, o)}
                      className="w-full text-left glass rounded-xl p-4 hover:bg-white/10 hover:border-brand/40 border border-transparent transition-all cursor-pointer flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{o.title || o.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{o.address}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-sm">
                        {o.rating && (
                          <span className="text-yellow-400 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-yellow-400" /> {o.rating}
                          </span>
                        )}
                        {o.distance_meters != null && (
                          <span className="text-brand-3 text-xs">
                            {o.distance_meters < 1000
                              ? `${Math.round(o.distance_meters)} m`
                              : `${(o.distance_meters / 1000).toFixed(1)} km`}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-page overlay shown while switching steps / auto-planning */}
      <FullOverlay show={showOverlay} text={overlayText} />
    </div>
  );
}

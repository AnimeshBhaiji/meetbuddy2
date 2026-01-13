// src/pages/Planner.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { getApiUrl, DEFAULT_HEADERS } from "@/config";
import { format, addHours } from 'date-fns';
import { Calendar as CalendarIcon, Plus, X, Mail, Phone, Clock, ArrowLeft, ArrowRight, Check, MapPin, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Navbar from "@/components/Navbar";
import MapPlanner from "@/components/MapPlanner";
import DarkVeil from "@/components/DarkVeil/DarkVeil"; // Use DarkVeil for consistency with Landing/Home
import MagicCard from "@/components/MagicBento/MagicCard";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { toast } from "sonner";
import { ItineraryPanel, CabEstimateModal, DistanceBadge, ParkingIndicator, AtmosphereTags } from "@/components/PlaceEnhancements";

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

// UI: grid of cards for the step


const TiltCard = ({ children, onClick, onMouseEnter, onMouseLeave, className }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useTransform(x, [-0.5, 0.5], [-15, 15]);
  const mouseY = useTransform(y, [-0.5, 0.5], [15, -15]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXFromCenter = e.clientX - rect.left - width / 2;
    const mouseYFromCenter = e.clientY - rect.top - height / 2;

    x.set(mouseXFromCenter / width);
    y.set(mouseYFromCenter / height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    if (onMouseLeave) onMouseLeave();
  };

  return (
    <motion.div
      style={{
        rotateY: mouseX,
        rotateX: mouseY,
        transformStyle: "preserve-3d",
      }}
      initial={{ transform: "perspective(1000px)" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={onMouseEnter} // Pass through for highlighting
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={cn("transition-all ease-out duration-200", className)}
    >
      {children}
    </motion.div>
  );
};

// UI: grid of cards for the step
const StepGrid = ({ options = [], onSelect, loading, onHighlight, onRetry, onBack, onAddToItinerary }) => {
  if (!options || options.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-12 text-center shadow-xl border border-white/10">
        <div className="mb-6">
          <p className="text-xl text-white mb-2">😅 No options available for this step.</p>
          <p className="text-gray-400">Try adjusting your location or preferences.</p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition shadow-lg font-medium"
          >
            🔄 Retry
          </button>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white/10 border border-white/20 text-white rounded-xl hover:bg-white/20 transition font-medium"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 perspective-1000"
    >
      {options.map((o, idx) => (
        <motion.div key={idx} variants={fadeIn} className="h-full">
          <TiltCard
            className="group relative bg-white/5 backdrop-blur-md rounded-3xl overflow-hidden border border-white/10 hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-500/10 cursor-pointer h-full flex flex-col"
            onMouseEnter={() => {
              if (onHighlight) onHighlight(o);
            }}
            onMouseLeave={() => {
              if (onHighlight) onHighlight(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAddToItinerary && onAddToItinerary(o);
            }}
          >
            {/* Mood Match Badge */}
            {o.mood_analysis?.is_good_fit && (
              <div className="absolute top-3 left-3 z-20">
                <div className="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                  ✨ MATCH
                </div>
              </div>
            )}

            {/* Thumbnail */}
            <div className="relative h-48 overflow-hidden bg-white/5 flex-shrink-0">
              {o.thumbnail ? (
                <img src={o.thumbnail} alt={o.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <MapPin className="w-12 h-12 opacity-50" />
                </div>
              )}
              {o.rating && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-sm font-semibold text-yellow-400 flex items-center gap-1 border border-white/10 z-10">
                  <span>⭐</span> {o.rating}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col">
              <h4 className="font-bold text-xl text-white mb-1 line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors transform translate-z-10">
                {o.title || o.name || "Unnamed Place"}
              </h4>
              <p className="text-xs text-gray-400 line-clamp-1 mb-2">
                {o.address}
              </p>

              {/* Enhanced Info */}
              <div className="mb-3">
                {o.distance_meters && <DistanceBadge distanceMeters={o.distance_meters} />}
                <ParkingIndicator parking={o.parking} />
                <AtmosphereTags atmosphere={o.atmosphere} />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToItinerary(o);
                  }}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Plus className="w-4 h-4" /> Add to Itinerary
                </button>
                {o.link && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(o.link, "_blank", "noopener,noreferrer");
                    }}
                    className="px-3 py-2 bg-transparent hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/10 flex items-center justify-center"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </TiltCard>
        </motion.div>
      ))}
    </motion.div>
  );
};

// Full-screen overlay with spinner & message
const FullOverlay = ({ show, text = "Loading..." }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <div className="text-white font-medium text-lg animate-pulse">{text}</div>
      </div>
    </div>
  );
};

export default function Planner() {
  const navigate = useNavigate();
  const params = useParams(); // URL patterns: home, review, summary, step/:index
  const location = useLocation();

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
  const [coords, setCoords] = useState(null); // {lat, lng}
  const [locLoading, setLocLoading] = useState(false);

  // Stepper/session state (sync with localStorage for persistence)
  const [page, setPage] = useState(() => localStorage.getItem("mb_planner_page") || "home");
  const [sessionId, setSessionId] = useState(() => localStorage.getItem("mb_session_id"));
  const [currentStep, setCurrentStep] = useState(() => localStorage.getItem("mb_current_step"));
  const [stepOptions, setStepOptions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mb_step_options")) || [];
    } catch { return []; }
  });
  const [anchorText, setAnchorText] = useState(() => localStorage.getItem("mb_anchor_text") || "");
  const [selectedChain, setSelectedChain] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mb_selected_chain")) || [];
    } catch { return []; }
  });
  const [sessionLoading, setSessionLoading] = useState(false);
  const [flowText, setFlowText] = useState(() => localStorage.getItem("mb_flow_text") || "");
  const [initialFlow, setInitialFlow] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mb_initial_flow")) || [];
    } catch { return []; }
  });

  // full-screen intermediary overlay
  const [showOverlay, setShowOverlay] = useState(false);

  // Track highlighted place for map popup
  const [highlightedPlace, setHighlightedPlace] = useState(null);

  // Date and time state
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [participants, setParticipants] = useState([{ email: '', phone: '' }]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Inline search on the step page (for adding extra restaurants)
  const [inlineSearchText, setInlineSearchText] = useState("");
  const [inlineSearchLoading, setInlineSearchLoading] = useState(false);
  const [inlineSearchError, setInlineSearchError] = useState("");

  // Itinerary management state
  const [itinerary, setItinerary] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mb_itinerary")) || [];
    } catch { return []; }
  });
  const [showItineraryPanel, setShowItineraryPanel] = useState(false);

  // Cab service state
  const [showCabModal, setShowCabModal] = useState(false);
  const [cabEstimate, setCabEstimate] = useState(null);
  const [cabLoading, setCabLoading] = useState(false);

  // Core persistence effect
  useEffect(() => {
    if (sessionId) localStorage.setItem("mb_session_id", sessionId);
    else localStorage.removeItem("mb_session_id");

    if (page) localStorage.setItem("mb_planner_page", page);
    if (currentStep) localStorage.setItem("mb_current_step", currentStep);
    localStorage.setItem("mb_initial_flow", JSON.stringify(initialFlow));
    localStorage.setItem("mb_step_options", JSON.stringify(stepOptions));
    localStorage.setItem("mb_selected_chain", JSON.stringify(selectedChain));
    localStorage.setItem("mb_itinerary", JSON.stringify(itinerary));
    localStorage.setItem("mb_flow_text", flowText);
    localStorage.setItem("mb_anchor_text", anchorText);
  }, [sessionId, page, currentStep, initialFlow, stepOptions, selectedChain, itinerary, flowText, anchorText]);

  // URL Sync Effect
  useEffect(() => {
    const path = location.pathname;

    if (path.endsWith("/planner") || path.endsWith("/planner/") || path.endsWith("/home")) {
      setPage("home");
    } else if (path.includes("/review")) {
      setPage("review_flow");
    } else if (path.includes("/summary")) {
      setPage("summary");
    } else if (path.includes("/flowsession")) {
      const match = path.match(/flowsession(\d+)/);
      if (match) {
        const idx = parseInt(match[1]) - 1;
        setPage("step");
        if (initialFlow && initialFlow[idx]) {
          setCurrentStep(initialFlow[idx]);
        }
      }
    }
  }, [location.pathname, initialFlow]);

  // Navigation helper that updates both state and URL
  const changePage = (newPage, pathSuffix = "") => {
    setPage(newPage);
    navigate(`/planner/${pathSuffix || newPage}`);
  };

  const resetSession = () => {
    localStorage.clear();
    setSessionId(null);
    setInitialFlow([]);
    setItinerary([]);
    setSelectedChain([]);
    setCurrentStep(null);
    setPage("home");
    navigate("/planner/home");
  };


  const hasNoStayFlag = (subVal) => {
    const checkStr = (s) => {
      if (s == null) return false;
      const t = String(s).toLowerCase().trim();
      return t === "no" || t.includes("no stay");
    };

    if (!subVal) return false;
    if (Array.isArray(subVal)) return subVal.some(checkStr);
    if (typeof subVal === "string" || typeof subVal === "number") return checkStr(subVal);
    if (typeof subVal === "object") {
      return Object.values(subVal).some((v) => {
        if (!v) return false;
        if (Array.isArray(v)) return v.some(checkStr);
        if (typeof v === "string" || typeof v === "number") return checkStr(v);
        return false;
      });
    }
    return false;
  };

  const handleInlineRestaurantSearch = async () => {
    const q = inlineSearchText && inlineSearchText.trim();
    if (!q) return;

    // Only meaningful on the restaurant step
    if (currentStep !== "restaurant") {
      return;
    }

    setInlineSearchLoading(true);
    setInlineSearchError("");
    try {
      const body = {
        query: q,
        coords: coords || userPrefs?.coords || null,
        max_results: 5,
      };

      const res = await axios.post(getApiUrl('/search_place'), body, {
        headers: DEFAULT_HEADERS,
        timeout: 20000,
      });

      const found = res.data?.results || [];
      if (!found.length) {
        setInlineSearchError("No restaurants found for that search.");
        return;
      }

      // Append new results to current options, avoiding duplicates by place_id or (title+address)
      setStepOptions((prev) => {
        const existing = prev || [];
        const seen = new Set(
          existing.map((p) => {
            const raw = p.raw || p;
            const pid = raw.place_id || raw.id || "";
            const title = (raw.title || raw.name || "").toLowerCase();
            const addr = (raw.address || "").toLowerCase();
            return pid || `${title}::${addr}`;
          })
        );

        const merged = [...existing];
        for (const r of found) {
          const pid = r.place_id || r.id || "";
          const title = (r.title || r.name || "").toLowerCase();
          const addr = (r.address || "").toLowerCase();
          const key = pid || `${title}::${addr}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(r);
        }
        return merged;
      });

      setInlineSearchError("");
    } catch (e) {
      console.error("❌ Inline restaurant search failed:", e);
      setInlineSearchError("Unable to search right now. Please try again.");
    }
  };

  // Itinerary Management Functions
  const addToItinerary = async (place) => {
    if (!sessionId) {
      toast.error("Please start a session first");
      return;
    }

    try {
      const res = await axios.post(
        getApiUrl(`/planner/session/${sessionId}/itinerary/add`),
        { place, step: currentStep },
        { headers: DEFAULT_HEADERS }
      );
      const updatedItinerary = res.data.itinerary || [];
      setItinerary(updatedItinerary);
      setSelectedChain(updatedItinerary.map(item => ({
        step: item.step_type || 'activity',
        place: item
      })));
      setShowItineraryPanel(true);
      toast.success(`Added ${place.title} to itinerary!`);
    } catch (e) {
      console.error('Failed to add to itinerary:', e);
      toast.error('Failed to add place');
    }
  };

  const removeFromItinerary = async (placeId) => {
    if (!sessionId) return;

    try {
      const res = await axios.delete(
        getApiUrl(`/planner/session/${sessionId}/itinerary/${placeId}`),
        { headers: DEFAULT_HEADERS }
      );
      const updatedItinerary = res.data.itinerary || [];
      setItinerary(updatedItinerary);
      setSelectedChain(updatedItinerary.map(item => ({
        step: item.step_type || 'activity',
        place: item
      })));
      toast.success('Removed from itinerary');
    } catch (e) {
      console.error('Failed to remove from itinerary:', e);
      toast.error('Failed to remove place');
    }
  };

  const getCabEstimate = async (origin, destination) => {
    setCabLoading(true);
    try {
      const res = await axios.post(
        getApiUrl('/cab/estimate'),
        { origin, destination, ride_type: 'economy' },
        { headers: DEFAULT_HEADERS }
      );
      setCabEstimate(res.data);
      setShowCabModal(true);
    } catch (e) {
      console.error('Failed to get cab estimate:', e);
      toast.error('Failed to get cab estimate');
    } finally {
      setCabLoading(false);
    }
  };


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
        // Handle object format {"1": "Business-y" } or {"Business-y": true }
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

    // Determine flow from preferences locally (mirror backend determine_flow_from_preferences)
    const determineFlowFromPrefs = (prefs) => {
      let needsStay = false;
      let needsActivity = false;
      let forceNoActivity = false;

      // Normalize preferences to arrays
      const adventureLevel = normalizePref(prefs.adventureLevel);
      const mood = normalizePref(prefs.mood);
      const memorableFactor = normalizePref(prefs.memorableFactor);

      console.log("🔍 Analyzing preferences for flow:", { adventureLevel, mood, memorableFactor });

      // Check stage2 adventureLevel_sub for explicit "no stay" / "No" preference
      const adventureSubs = prefs.adventureLevel_sub;
      const hasNoStay = hasNoStayFlag(adventureSubs);

      // --- Adventure level (strongest indicator for stay + activity) ---
      for (const label of adventureLevel) {
        const labelStr = String(label);
        if (labelStr === "Weekend escape" || labelStr.includes("Weekend escape")) {
          needsStay = true;      // weekend escapes usually include a stay
          needsActivity = true;  // and activities
        } else if (labelStr === "Short drive to hidden gem" || labelStr.includes("Short drive")) {
          // hidden gems: activities are important, stay optional
          needsActivity = true;
        } else if (labelStr === "Stick to the city" || labelStr.includes("Stick to the city")) {
          // city trips: usually restaurant + activity, no stay
          needsActivity = true;
        }
      }

      // --- Mood (can override or reinforce decisions) ---
      const hasWeekendEscape = adventureLevel.some((l) => String(l).includes("Weekend escape"));
      const hasShortDrive = adventureLevel.some((l) => String(l).includes("Short drive"));

      for (const label of mood) {
        const labelStr = String(label);
        if (labelStr === "Romantic" || labelStr.includes("Romantic")) {
          needsStay = true;
          needsActivity = true;
        } else if (labelStr === "Fun & Energetic" || labelStr.includes("Fun & Energetic")) {
          needsActivity = true;
        } else if (labelStr === "Chill & Relaxed" || labelStr.includes("Chill & Relaxed")) {
          needsActivity = true;
        } else if (labelStr === "Business-y" || labelStr.includes("Business")) {
          // Business meetings usually just need restaurant unless adventure strongly suggests otherwise
          if (!hasWeekendEscape && !hasShortDrive) {
            forceNoActivity = true;
          }
        }
      }

      // --- Memorable factor (can add activities) ---
      for (const label of memorableFactor) {
        const labelStr = String(label);
        if (labelStr === "A unique place" || labelStr.includes("unique")) {
          needsActivity = true;
        } else if (labelStr === "Deep conversations / Capture moments" || labelStr.includes("Deep conversations")) {
          needsActivity = true;
        }
      }

      // Stage2 explicit no-stay overrides any inferred stay
      if (hasNoStay) {
        needsStay = false;
      }

      // Apply Business-y override for activities if no strong adventure signal
      if (forceNoActivity && !hasWeekendEscape && !hasShortDrive) {
        needsActivity = false;
      }

      // Build ordered flow: restaurant always first, then activity, then stay
      const flow = ["restaurant"];
      if (needsActivity && !forceNoActivity) {
        flow.push("activity");
      }
      if (needsStay) {
        flow.push("stay");
      }

      console.log("📋 Determined flow from frontend prefs:", flow, {
        needsActivity,
        needsStay,
        forceNoActivity,
        adventureSubs,
        hasNoStay,
      });
      return flow;
    };

    const flow = determineFlowFromPrefs(userPrefs);
    setInitialFlow(flow);
    setFlowText(flow.map((f) => humanStepName(f)).join(" → "));
  }, [userPrefs, page]);

  const persistPrefs = async (newPrefs) => {
    const merged = { ...(userPrefs || {}), ...(newPrefs || {}) };
    setUserPrefs(merged);

    try {
      // Save to localStorage first for immediate UI updates
      localStorage.setItem("userPreferences", JSON.stringify(merged));

      // Then save to backend if user is logged in
      const userId = user.user_id || user.id;
      if (user && userId) {
        try {
          await axios.post(
            getApiUrl('/update-preferences'),
            {
              user_id: userId,
              preferences: merged
            },
            {
              headers: DEFAULT_HEADERS
            }
          );
        } catch (error) {
          console.error("Error saving preferences to backend:", error);
          // Continue without throwing to not break the UI
        }
      }
    } catch (e) {
      console.error("Error saving preferences:", e);
    }
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
    const trimmed = placeText && placeText.trim();
    if (!trimmed) return;

    // If the value looks like our GPS auto-filled label ("Lat .., Lng .."),
    // keep the existing coords and just persist the location text.
    const lower = trimmed.toLowerCase();
    const looksLikeCoords = lower.includes("lat") && lower.includes("lng");

    persistPrefs({ location: trimmed });

    // Only clear coords when the user has typed a proper textual area/city.
    if (!looksLikeCoords) {
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
    const map = { restaurant: "Restaurant", activity: "Activity", stay: "Stay", cafe: "Cafe", shopping: "Shopping", movie: "Movie" };
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

  const moveFlowStep = (index, direction) => {
    const newFlow = [...initialFlow];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newFlow.length) return;
    [newFlow[index], newFlow[newIndex]] = [newFlow[newIndex], newFlow[index]];
    setInitialFlow(newFlow);
    setFlowText(newFlow.map((f) => humanStepName(f)).join(" → "));
    setCurrentStep(newFlow[0]);
  };

  const removeFlowStep = (index) => {
    if (initialFlow.length <= 1) {
      toast.error("Itinerary must have at least one step!");
      return;
    }
    const newFlow = [...initialFlow];
    newFlow.splice(index, 1);
    setInitialFlow(newFlow);
    setFlowText(newFlow.map((f) => humanStepName(f)).join(" → "));
    setCurrentStep(newFlow[0]);
  };

  const addFlowStep = (type) => {
    const newFlow = [...initialFlow, type];
    setInitialFlow(newFlow);
    setFlowText(newFlow.map((f) => humanStepName(f)).join(" → "));
    setCurrentStep(newFlow[0]);
    toast.success(`Added ${humanStepName(type)} to flow`);
  };

  const moveChainItem = (index, direction) => {
    const newChain = [...selectedChain];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newChain.length) return;
    [newChain[index], newChain[newIndex]] = [newChain[newIndex], newChain[index]];
    setSelectedChain(newChain);
  };

  // Start session and show the step page (all options visible)
  const startSession = async () => {
    if (!user || !userPrefs) {
      alert("Please log in and save preferences first.");
      return;
    }

    // Check if location is set
    const hasCoords = coords && typeof coords === "object" && coords.lat && coords.lng;
    const hasPlace = placeText && placeText.trim();
    const hasSavedLocation = userPrefs && userPrefs.location && userPrefs.location.trim();

    const userId = user?.user_id || user?.id;

    if (!userId && !hasCoords && !hasPlace && !hasSavedLocation) {
      alert("Please enter your current location or allow GPS access before starting your itinerary.");
      return;
    }

    setSessionLoading(true);
    try {
      const payload = {
        user_id: userId,
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
        max_terms: maxTerms,
      };

      console.log("🚀 Starting session with payload:", payload);

      // primary request to the session endpoint
      const res = await axios.post(getApiUrl('/planner/session'), payload, {
        headers: DEFAULT_HEADERS,
        timeout: 60000
      });

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
      const hasNoStay = hasNoStayFlag(advSubs);
      if (hasNoStay && Array.isArray(flow)) {
        flow = flow.filter((step) => step !== "stay");
      }

      console.log("📋 Determined flow from preferences:", flow, { hasNoStay, advSubs });
      setInitialFlow(flow);
      setFlowText(flow.map((f) => humanStepName(f)).join(" → "));
      setCurrentStep(flow[0] || "restaurant");

      // Prefer server-sent options
      const initialOptions = res.data.initial?.options || [];

      if (initialOptions && initialOptions.length > 0) {
        setStepOptions(initialOptions);
        setAnchorText(res.data.initial?.location_hint || payload.location || "");
        setSelectedChain([]);
        navigate("/planner/review");
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
          const legacyRes = await axios.post(getApiUrl('/planner'), legacyPayload, {
            headers: DEFAULT_HEADERS,
            timeout: 60000
          });
          console.log("Fallback /planner response:", legacyRes.data);
          const mapped = mapLegacyToOptions(legacyRes.data.recommendations || []);
          if (mapped && mapped.length > 0) {
            setStepOptions(mapped);
            setAnchorText(legacyRes.data.query || payload.location || "");
            setSelectedChain([]);
            navigate("/planner/review");
            // keep session id (server still created it); user can continue step flow
          } else {
            // final fallback - show user helpful message and let them retry
            alert("Couldn't fetch step suggestions. Please try again or try 'Get My Recommendations' (legacy).");
            setStepOptions([]);
            navigate("/planner/review"); // still go to review page
            setAnchorText(payload.location || "");
          }
        } catch (lfErr) {
          console.error("Legacy fallback failed:", lfErr);
          alert("Failed to fetch suggestions. Check server logs or try again in a moment.");
          setStepOptions([]);
          navigate("/planner/review");
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

      const res = await axios.post(
        getApiUrl(`/planner/session/${sessionId}/select`),
        payload,
        {
          headers: DEFAULT_HEADERS,
          timeout: 60000
        }
      );

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
        navigate("/planner/summary");
      } else {
        // short delay for UX
        await new Promise((r) => setTimeout(r, 600));
        const nIndex = initialFlow.indexOf(nextStep);
        setCurrentStep(nextStep);
        navigate(`/planner/flowsession${nIndex + 1}`);
        // if server provided next options use them, otherwise fallback to empty array and message
        const nextOpts = res.data.options || [];
        if (nextOpts.length > 0) {
          setStepOptions(nextOpts);
        } else {
          // graceful fallback: inform user and keep session open (they can retry)
          console.warn("No options returned for next step from server:", res.data);
          setStepOptions([]);
          toast.info("No nearby options found for the next step. You can try again or go back.");
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

  // Finalize the current step without selecting a specific place from the grid
  const finalizeStep = async () => {
    if (!sessionId) {
      toast.error("Session missing. Start again.");
      return;
    }
    if (!currentStep) {
      toast.error("No current step to finalize.");
      return;
    }

    setShowOverlay(true);
    setSessionLoading(true);

    try {
      const currentStepIndex = initialFlow.indexOf(currentStep);
      const nextStepIndex = currentStepIndex + 1;
      const nextStepType = nextStepIndex < initialFlow.length ? initialFlow[nextStepIndex] : "done";

      const payload = {
        step: currentStep,
        next_step: nextStepType,
      };

      const res = await axios.post(
        getApiUrl(`/planner/session/${sessionId}/finalize_step`),
        payload,
        {
          headers: DEFAULT_HEADERS,
          timeout: 60000
        }
      );

      // CRITICAL FIX: Sync both itinerary and selectedChain from the backend's source of truth.
      // This prevents the "14 places instead of 5" duplicate bug caused by recursive appending.
      const updatedItinerary = res.data.itinerary || [];
      setItinerary(updatedItinerary);

      const updatedChain = updatedItinerary.map(item => ({
        step: item.step_type || 'activity',
        place: item
      }));
      setSelectedChain(updatedChain);

      if (!res.data.next_step || res.data.next_step === "done") {
        // done -> show summary page
        setCurrentStep(null);
        setStepOptions([]);
        await new Promise((r) => setTimeout(r, 600));
        setShowOverlay(false);
        navigate("/planner/summary");
      } else {
        // short delay for UX
        await new Promise((r) => setTimeout(r, 600));
        const nIndex = initialFlow.indexOf(res.data.next_step);
        setCurrentStep(res.data.next_step);
        const nextOpts = res.data.options || [];
        if (nextOpts.length > 0) {
          setStepOptions(nextOpts);
        } else {
          console.warn("No options returned for next step from server after finalizing:", res.data);
          setStepOptions([]);
          toast.info("No nearby options found for the next step. You can try again or go back.");
        }
        setAnchorText(res.data.anchor_text || "");
        setShowOverlay(false);
        setShowItineraryPanel(false); // Close panel after finalizing
        navigate(`/planner/flowsession${nIndex + 1}`);
      }
      toast.success(`Step "${humanStepName(currentStep)}" finalized!`);
    } catch (err) {
      console.error("Finalize step failed", err);
      setShowOverlay(false);
      toast.error("Failed to finalize step. See console for details.");
    } finally {
      setSessionLoading(false);
    }
  };


  // Back button: go back one step locally and attempt to restore server options for that step
  const goBackOneStep = async () => {
    if (!sessionId) {
      // just go to home
      resetSession();
      return;
    }
    if (selectedChain.length === 0) {
      // no selection yet: go home
      resetSession();
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
        const initRes = await axios.post(getApiUrl('/planner/session'), payload, {
          headers: DEFAULT_HEADERS,
          timeout: 30000
        });
        setStepOptions(initRes.data.initial.options || []);
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
    <div className="relative min-h-screen bg-black overflow-hidden font-sans selection:bg-blue-500/30">
      <div className="fixed inset-0 z-0">
        <DarkVeil
          hueShift={0}
          noiseIntensity={0.02}
          scanlineIntensity={0.4}
          speed={2.0}
          scanlineFrequency={1.5}
          warpAmount={0.1}
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col pt-28">
        <Navbar />

        <div className="flex-1">
          {/* HOME / preferences panel */}
          {page === "home" && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8"
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
                  Plan Your <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Perfect Meetup</span>
                </h1>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                  Let AI curate a personalized itinerary based on your style and preferences.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-6 md:p-10 mb-8">
                <div className="grid md:grid-cols-2 gap-10 mb-8">
                  {/* Preferences display */}
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                      Your Preferences
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Mood */}
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition">
                        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Mood</p>
                        <p className="text-white font-medium">{displayPref(userPrefs?.mood) || 'Not specified'}</p>
                      </div>

                      {/* Planning Style */}
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition">
                        <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Style</p>
                        <p className="text-white font-medium">{displayPref(userPrefs?.planningStyle) || 'Not specified'}</p>
                      </div>

                      {/* Adventure */}
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition">
                        <p className="text-xs font-semibold text-pink-400 uppercase tracking-wider mb-1">Adventure</p>
                        <p className="text-white font-medium">{displayPref(userPrefs?.adventureLevel) || 'Not specified'}</p>
                      </div>

                      {/* Magic */}
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition">
                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Magic</p>
                        <p className="text-white font-medium">{displayPref(userPrefs?.addOnMagic) || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Location & flow */}
                  <div className="flex flex-col gap-8 justify-center">
                    <div>
                      <label className="block text-lg font-bold text-white mb-3">Where are you meeting?</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            value={placeText}
                            onChange={(e) => setPlaceText(e.target.value)}
                            onBlur={handlePlaceTextBlur}
                            placeholder="Enter city or area..."
                            className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition placeholder:text-gray-500 text-lg"
                          />
                        </div>
                        <button
                          onClick={useMyLocation}
                          className="px-6 bg-white/10 hover:bg-blue-500/20 text-blue-400 rounded-xl border border-white/10 hover:border-blue-500/50 transition-all font-semibold"
                          disabled={locLoading}
                        >
                          {locLoading ? <span className="animate-spin">⌛</span> : "📍 GPS"}
                        </button>
                      </div>
                      {(coords || placeText) && (
                        <p className="text-sm text-green-400 mt-2 flex items-center gap-1">
                          <Check className="w-4 h-4" /> Location set
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-lg font-bold text-white mb-3">Planned Flow</label>
                      <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white p-5 rounded-xl font-medium text-center border border-white/10 flex items-center justify-center gap-2">
                        {flowText || (initialFlow.length > 0 ? initialFlow.map((f) => humanStepName(f)).join(" → ") : "Restaurant")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => navigate("/questionnaire-stage1")}
                    className="flex-1 bg-white/5 border border-white/10 text-white font-bold text-lg py-5 px-6 rounded-2xl hover:bg-white/10 transition-all transform hover:-translate-y-1"
                  >
                    Modify my preferences
                  </button>
                  <button
                    onClick={startSession}
                    disabled={sessionLoading || (!coords && !placeText && !(userPrefs && userPrefs.location))}
                    className="flex-[2] bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl py-5 px-6 rounded-2xl hover:from-blue-500 hover:to-purple-500 transition-all transform hover:-translate-y-1 shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 relative overflow-hidden group"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {sessionLoading ? "Generating..." : "✨ Generate My Itinerary"}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* FLOW REVIEW PAGE */}
          {page === "review_flow" && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8"
            >
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-white mb-4">Review Your Itinerary Flow</h1>
                <p className="text-gray-400 text-lg">Reorder the steps of your meetup to your liking.</p>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                <div className="space-y-4 mb-8">
                  {initialFlow.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/10 transition group relative"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-500/30">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-white font-bold text-xl">{humanStepName(step)}</p>
                          <p className="text-gray-400 text-sm">Step {idx + 1} of your meetup</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveFlowStep(idx, -1)}
                          disabled={idx === 0}
                          className="p-3 bg-white/5 rounded-xl hover:bg-white/10 text-white disabled:opacity-20 transition"
                          title="Move Up"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveFlowStep(idx, 1)}
                          disabled={idx === initialFlow.length - 1}
                          className="p-3 bg-white/5 rounded-xl hover:bg-white/10 text-white disabled:opacity-20 transition"
                          title="Move Down"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeFlowStep(idx)}
                          className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/10 transition ml-2"
                          title="Remove Step"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-10">
                  <p className="text-gray-400 text-sm mb-4 font-medium uppercase tracking-wider">Add more steps:</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { type: "restaurant", icon: "🍴" },
                      { type: "cafe", icon: "☕" },
                      { type: "activity", icon: "🎮" },
                      { type: "stay", icon: "🏨" },
                      { type: "shopping", icon: "🛍️" },
                      { type: "movie", icon: "🎬" },
                    ].map((btn) => (
                      <button
                        key={btn.type}
                        onClick={() => addFlowStep(btn.type)}
                        className="px-4 py-2 bg-white/5 hover:bg-blue-500/20 text-white border border-white/10 hover:border-blue-500/30 rounded-full text-sm font-medium transition-all flex items-center gap-2 hover:scale-105"
                      >
                        <span className="text-lg">{btn.icon}</span>
                        {humanStepName(btn.type)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setPage("home")}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition border border-white/10"
                  >
                    ← Back to Preferences
                  </button>
                  <button
                    onClick={() => setPage("step")}
                    className="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl rounded-2xl hover:from-blue-500 hover:to-purple-500 transition-all transform hover:-translate-y-1 shadow-lg shadow-blue-900/40"
                  >
                    Confirm & See Options ✨
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP PAGE: show all options for current step */}
          {page === "step" && (
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                <div>
                  <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-4xl font-bold text-white flex items-center gap-3"
                  >
                    <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg text-2xl">
                      {initialFlow.indexOf(currentStep) + 1}/{initialFlow.length}
                    </span>
                    {currentStep ? humanStepName(currentStep) : "Done"}
                  </motion.h1>
                  <p className="text-gray-400 mt-2 text-lg">Select a place to continue</p>
                </div>

                {/* Floating Itinerary Toggle Button */}
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowItineraryPanel(!showItineraryPanel)}
                  className="fixed bottom-8 right-8 z-40 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white p-4 rounded-full shadow-2xl shadow-blue-500/50 flex items-center gap-2 font-semibold"
                  title="View Itinerary"
                >
                  <span className="text-2xl">📋</span>
                  {itinerary.length > 0 && (
                    <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-sm font-bold">
                      {itinerary.length}
                    </span>
                  )}
                </motion.button>

                <div className="flex gap-3">
                  <button
                    onClick={goBackOneStep}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all font-medium flex items-center gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" /> Back
                  </button>
                  <button
                    onClick={resetSession}
                    className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Map Column */}
                <div className="lg:col-span-1 h-fit bg-white/5 backdrop-blur-md rounded-3xl overflow-hidden border border-white/10 shadow-xl relative order-2 lg:order-1 sticky top-24">
                  {/* Inline Search */}
                  {currentStep === "restaurant" && (
                    <div className="p-4 border-b border-white/10 bg-black/20">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          value={inlineSearchText}
                          onChange={(e) => setInlineSearchText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleInlineRestaurantSearch()}
                          placeholder="Search specifically..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-20 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                        <button
                          onClick={handleInlineRestaurantSearch}
                          disabled={!inlineSearchText.trim() || inlineSearchLoading}
                          className="absolute right-1 top-1 bottom-1 px-3 bg-blue-600 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                        >
                          ADD
                        </button>
                      </div>
                      {inlineSearchError && <p className="text-xs text-red-400 mt-2">{inlineSearchError}</p>}
                    </div>
                  )}
                  <MapPlanner
                    className="h-[600px] md:h-[700px] w-full"
                    options={stepOptions}
                    selectedChain={selectedChain}
                    onSelect={selectOption}
                    onPreview={(place) => place.link && window.open(place.link, "_blank")}
                    onAddToItinerary={addToItinerary}
                    highlightedPlace={highlightedPlace}
                    userCoords={coords || userPrefs?.coords || null}
                    locationText={(placeText && placeText.trim()) || userPrefs?.location || ""}
                  />
                </div>

                {/* Grid Column */}
                <div className="lg:col-span-2 order-1 lg:order-2">
                  <StepGrid
                    options={stepOptions}
                    onSelect={selectOption}
                    loading={sessionLoading}
                    onHighlight={setHighlightedPlace}
                    onRetry={() => startSession()}
                    onBack={resetSession}
                    onAddToItinerary={addToItinerary}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SUMMARY PAGE */}
          {page === "summary" && (
            <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeIn}
                className="text-center mb-16"
              >
                <h1 className="text-5xl md:text-6xl font-bold mb-4">
                  <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Itinerary Ready!</span> 🎉
                </h1>
                <p className="text-xl text-gray-400">Your perfect plan is awaiting.</p>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-10">
                {/* Itinerary list */}
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-8"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-white">Your Trip Plan</h2>
                    <div className="text-sm text-gray-500">{format(new Date(), 'MMMM d, yyyy')}</div>
                  </div>

                  <div className="relative border-l-2 border-white/10 pl-8 ml-4 space-y-10">
                    {selectedChain.map((s, i) => (
                      <div key={i} className="relative group">
                        <div className="absolute -left-[41px] top-0 w-8 h-8 rounded-full bg-blue-600 border-4 border-black text-white flex items-center justify-center font-bold text-sm z-10">
                          {i + 1}
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors flex justify-between items-start">
                          <div className="flex-1">
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1 block">{humanStepName(s.step)}</span>
                            <h3 className="text-xl font-bold text-white mb-1">{(s.place && (s.place.title || s.place.name)) || "Unnamed Place"}</h3>
                            <p className="text-gray-400 text-sm mb-3">{(s.place && s.place.address) || ""}</p>
                            {s.place && s.place.link && (
                              <a href={s.place.link} target="_blank" className="text-blue-400 text-sm hover:underline flex items-center gap-1">
                                View details <ArrowRight className="w-3 h-3" />
                              </a>
                            )}

                            {/* Enhancements in Summary */}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {s.place?.distance_meters && <DistanceBadge distanceMeters={s.place.distance_meters} />}
                              {s.place?.parking && <ParkingIndicator parking={s.place.parking} compact={true} />}
                              {s.place?.atmosphere && <AtmosphereTags atmosphere={s.place.atmosphere} compact={true} />}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 ml-4 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); moveChainItem(i, -1); }}
                              disabled={i === 0}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-20"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveChainItem(i, 1); }}
                              disabled={i === selectedChain.length - 1}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-20"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newChain = selectedChain.filter((_, idx) => idx !== i);
                                setSelectedChain(newChain);
                              }}
                              className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="absolute -left-[35px] bottom-0 w-4 h-4 bg-green-500/50 rounded-full border-2 border-black"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-10">
                    <button
                      onClick={() => setIsScheduling(true)}
                      className="col-span-2 w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <CalendarIcon className="w-5 h-5" /> Schedule Meetup
                    </button>
                    <button
                      onClick={() => {
                        navigate("/planner/review");
                      }}
                      className="py-3 bg-white/10 border border-blue-500/30 text-blue-400 rounded-xl font-medium hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      ➕ Add / Edit Steps
                    </button>
                    <button
                      onClick={resetSession}
                      className="py-3 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
                    >
                      🚀 Start New Plan
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="py-3 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
                    >
                      🖨️ Save PDF
                    </button>
                  </div>
                </motion.div>

                {/* Map display */}
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden h-fit"
                >
                  <div className="p-4 border-b border-white/10 bg-white/5">
                    <h3 className="text-white font-bold">Route View</h3>
                  </div>
                  <div className="h-[500px]">
                    <MapPlanner
                      options={[]}
                      selectedChain={selectedChain}
                      onSelect={() => { }}
                      onPreview={(place) => place.link && window.open(place.link, "_blank")}
                      highlightedPlace={highlightedPlace}
                      userCoords={coords || userPrefs?.coords || null}
                      locationText={(placeText && placeText.trim()) || userPrefs?.location || ""}
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Full-page overlay shown while switching steps */}
      <FullOverlay show={showOverlay} text="Curating next options..." />

      {/* Schedule Meetup Modal */}
      {/* Schedule Meetup Modal */}
      <AnimatePresence>
        {isScheduling && (
          <Dialog open={isScheduling} onOpenChange={setIsScheduling}>
            <DialogContent className="bg-black/80 backdrop-blur-xl border border-white/10 text-white max-w-lg rounded-3xl p-0 overflow-hidden shadow-2xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6"
              >
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Let's Make it Happen!
                  </DialogTitle>
                  <DialogDescription className="text-gray-400 text-lg">
                    Finalize the details for your perfect meetup.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-8">
                  {/* Date & Time Selection */}
                  <div className="space-y-4">
                    <h4 className="text-sm uppercase tracking-wider text-gray-500 font-bold ml-1">When</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Date Picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-medium bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-blue-400 h-14 rounded-xl transition-all"
                          >
                            <CalendarIcon className="mr-3 h-5 w-5 text-blue-500" />
                            {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-gray-900 border-white/10 rounded-xl shadow-xl">
                          <Calendar
                            mode="single"
                            selected={scheduleDate}
                            onSelect={(date) => date && setScheduleDate((prev) => {
                              const newDate = new Date(date);
                              // preserve time if exists
                              if (prev) {
                                newDate.setHours(prev.getHours(), prev.getMinutes());
                              }
                              return newDate;
                            })}
                            initialFocus
                            className="text-white p-4"
                          />
                        </PopoverContent>
                      </Popover>

                      {/* Time Picker (Simple Native Input styled) */}
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-500 w-5 h-5 pointer-events-none" />
                        <Input
                          type="time"
                          value={scheduleDate ? format(scheduleDate, "HH:mm") : "18:00"}
                          onChange={(e) => {
                            const [hours, mins] = e.target.value.split(':');
                            setScheduleDate((prev) => {
                              const newDate = new Date(prev || new Date());
                              newDate.setHours(parseInt(hours), parseInt(mins));
                              return newDate;
                            });
                          }}
                          className="pl-12 h-14 bg-white/5 border-white/10 text-white rounded-xl focus:ring-2 focus:ring-purple-500/50 hover:bg-white/10 transition-colors text-base"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm uppercase tracking-wider text-gray-500 font-bold ml-1">Who</h4>
                      <button
                        onClick={() => setParticipants([...participants, { email: '', phone: '' }])}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all hover:bg-blue-500/20"
                      >
                        <Plus className="w-3 h-3" /> ADD FRIEND
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                      {participants.map((p, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 group"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold text-gray-300 border border-white/10">
                            {i + 1}
                          </div>
                          <Input
                            type="email"
                            placeholder="friend@example.com"
                            value={p.email}
                            onChange={(e) => {
                              const newParticipants = [...participants];
                              newParticipants[i].email = e.target.value;
                              setParticipants(newParticipants);
                            }}
                            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 rounded-xl focus:ring-blue-500/50 h-11"
                          />
                          {participants.length > 1 && (
                            <button
                              onClick={() => {
                                const newParticipants = [...participants];
                                newParticipants.splice(i, 1);
                                setParticipants(newParticipants);
                              }}
                              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-end mt-10">
                  <button
                    onClick={() => setIsScheduling(false)}
                    className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Scheduling logic as before
                      alert('Invitation sent! 📨\nGet ready for an awesome meetup!');
                      setIsScheduling(false);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 transition-all transform flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" /> Send Invites
                  </button>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Itinerary Panel - Shows when user adds places */}
      <ItineraryPanel
        sessionId={sessionId}
        itinerary={itinerary}
        onRemove={removeFromItinerary}
        onFinalize={finalizeStep}
        isOpen={showItineraryPanel}
        currentStep={currentStep}
        isLastStep={initialFlow.indexOf(currentStep) === initialFlow.length - 1}
        onClose={() => setShowItineraryPanel(false)}
      />

      {/* Cab Estimate Modal */}
      <CabEstimateModal
        estimate={cabEstimate}
        isOpen={showCabModal}
        onClose={() => setShowCabModal(false)}
      />
    </div>
  );
}

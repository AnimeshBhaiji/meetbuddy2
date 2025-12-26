// src/pages/Planner.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Plus, X, Mail, Phone, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Navbar from "@/components/Navbar";
import MapPlanner from "@/components/MapPlanner";
import Aurora from "@/components/Aurora";
import { cn } from "@/lib/utils";

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

  // Date and time state
  const [date, setDate] = useState({
    startDate: new Date(),
    endDate: new Date(new Date().setHours(new Date().getHours() + 1)),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Participants state
  const [participants, setParticipants] = useState([{ email: '', phone: '' }]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Inline search on the step page (for adding extra restaurants)
  const [inlineSearchText, setInlineSearchText] = useState("");
  const [inlineSearchLoading, setInlineSearchLoading] = useState(false);
  const [inlineSearchError, setInlineSearchError] = useState("");

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

      const res = await axios.post("http://localhost:8000/search_place", body, {
        headers: { "Content-Type": "application/json" },
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
    } finally {
      setInlineSearchLoading(false);
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
          // pass stage2 subs to legacy /planner as well
          mood_sub: normalizePrefForSend(userPrefs?.mood_sub),
          planningStyle_sub: normalizePrefForSend(userPrefs?.planningStyle_sub),
          adventureLevel_sub: normalizePrefForSend(userPrefs?.adventureLevel_sub),
          addOnMagic_sub: normalizePrefForSend(userPrefs?.addOnMagic_sub),
          memorableFactor_sub: normalizePrefForSend(userPrefs?.memorableFactor_sub),
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

    // Check if location is set
    const hasCoords = coords && typeof coords === "object" && coords.lat && coords.lng;
    const hasPlace = placeText && placeText.trim();
    const hasSavedLocation = userPrefs && userPrefs.location && userPrefs.location.trim();

    if (!hasCoords && !hasPlace && !hasSavedLocation) {
      alert("Please enter your current location or allow GPS access before starting your itinerary.");
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
        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-12 text-center shadow-xl border-0">
          <div className="mb-6">
            <p className="text-lg text-gray-600 mb-2">😅 No options available for this step.</p>
            <p className="text-gray-500">Try adjusting your location or preferences.</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => startSession()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition shadow-lg font-medium"
            >
              🔄 Retry
            </button>
            <button
              onClick={() => { setPage("home"); setSessionId(null); }}
              className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-800 rounded-xl hover:bg-gray-50 transition font-medium"
            >
              ← Go Back
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {options.map((o, idx) => (
          <div 
            key={idx} 
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
    <div className="relative min-h-screen bg-black overflow-hidden">
      <Aurora colorStops={['#5227FF', '#bf4bfd', '#5227FF']} />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />

        <div className="flex-1">
        {/* HOME / preferences panel */}
        {page === "home" && (
          <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-3">
                Plan Your Perfect Meetup ✨
              </h1>
              <p className="text-gray-400 text-lg">Personalized recommendations based on your preferences</p>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl p-8 mb-8">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Preferences display */}
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-4">Your Preferences</h2>
                  <div className="space-y-3">
                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                      <p className="text-sm text-gray-400">Mood</p>
                      <p className="font-medium text-white">{displayPref(userPrefs?.mood) || 'Not specified'}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                      <p className="text-sm text-gray-400">Planning Style</p>
                      <p className="font-medium text-white">{displayPref(userPrefs?.planningStyle) || 'Not specified'}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                      <p className="text-sm text-gray-400">Adventure Level</p>
                      <p className="font-medium text-white">{displayPref(userPrefs?.adventureLevel) || 'Not specified'}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                      <p className="text-sm text-gray-400">Add-On Magic</p>
                      <p className="font-medium text-white">{displayPref(userPrefs?.addOnMagic) || 'Not specified'}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                      <p className="text-sm text-gray-400">Memorable Factor</p>
                      <p className="font-medium text-white">{displayPref(userPrefs?.memorableFactor) || 'Not specified'}</p>
                    </div>
                  </div>
                </div>

                {/* Location & flow */}
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="block text-lg font-semibold text-white mb-3">Select Location</label>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={placeText}
                        onChange={(e) => setPlaceText(e.target.value)}
                        onBlur={handlePlaceTextBlur}
                        placeholder="Enter city or area..."
                        className="flex-1 bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition placeholder:text-gray-500"
                      />
                      <button
                        onClick={useMyLocation}
                        className="px-5 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:-translate-y-0.5 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={locLoading}
                      >
                        📍 {locLoading ? "..." : "GPS"}
                      </button>
                    </div>
                    <div className="text-sm text-gray-400">
                      {coords ? `📌 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : placeText ? `📍 ${placeText}` : "No location set"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-lg font-semibold text-white mb-3">Your Planned Flow</label>
                    <div className="bg-gradient-to-r from-blue-500/80 to-purple-600/80 text-white p-4 rounded-xl font-medium text-center border border-white/10 backdrop-blur-sm">
                      {flowText || (initialFlow.length > 0 ? initialFlow.map((f) => humanStepName(f)).join(" → ") : "Restaurant")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <button
                  onClick={startSession}
                  disabled={sessionLoading || (!coords && !placeText && !(userPrefs && userPrefs.location))}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:-translate-y-0.5 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {sessionLoading ? "Starting..." : "🚀 Generate Itinerary"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP PAGE: show all options for current step */}
        {page === "step" && (
          <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {currentStep ? humanStepName(currentStep) : "Done"}
                </h1>
                <p className="text-gray-400 mt-2">{anchorText}</p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                <button
                  onClick={goBackOneStep}
                  className="flex-1 sm:flex-none px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all shadow-lg font-medium flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => { setPage("home"); setSessionId(null); setSelectedChain([]); }}
                  className="flex-1 sm:flex-none px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Map display with optional restaurant search bar */}
            <div className="mb-8 bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              {currentStep === "restaurant" && (
                <div className="px-6 pt-6 pb-2 border-b border-white/10 flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-black/30">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Add a restaurant you already have in mind
                    </label>
                    <input
                      type="text"
                      value={inlineSearchText}
                      onChange={(e) => setInlineSearchText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleInlineRestaurantSearch();
                        }
                      }}
                      placeholder="Search by name or area (e.g., Truffles Koramangala)"
                      className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent placeholder:text-gray-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleInlineRestaurantSearch}
                    disabled={inlineSearchLoading || !inlineSearchText.trim()}
                    className="md:self-end px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-semibold shadow-lg disabled:opacity-60 disabled:cursor-not-allowed hover:from-blue-600 hover:to-purple-700 transition-all transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
                  >
                    {inlineSearchLoading ? "Searching..." : "Search & Add"}
                  </button>
                </div>
              )}

              {inlineSearchError && currentStep === "restaurant" && (
                <div className="px-6 pt-2 text-sm text-red-600">{inlineSearchError}</div>
              )}

              <div className="pt-4">
                <MapPlanner 
                  options={stepOptions} 
                  selectedChain={selectedChain}
                  onSelect={selectOption}
                  onPreview={(place) => {
                    if (place.link) window.open(place.link, "_blank", "noopener,noreferrer");
                  }}
                  highlightedPlace={highlightedPlace}
                  userCoords={coords || userPrefs?.coords || null}
                  locationText={(placeText && placeText.trim()) || userPrefs?.location || ""}
                />
              </div>
            </div>

            <StepGrid 
              options={stepOptions} 
              onSelect={selectOption} 
              loading={sessionLoading}
              onHighlight={setHighlightedPlace}
            />
          </div>
        )}

        {/* SUMMARY PAGE */}
        {page === "summary" && (
          <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent mb-3">
                Your Perfect Itinerary 🎉
              </h1>
              <p className="text-gray-400 text-lg">Ready to explore!</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Itinerary list */}
              <div className="bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl p-8">
                <h2 className="text-2xl font-semibold text-white mb-6">Your Plan</h2>
                <ol className="space-y-4">
                  {selectedChain.map((s, i) => (
                    <li key={i} className="flex gap-4 group">
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">{humanStepName(s.step)}</p>
                        <p className="text-gray-300 truncate">{s.place.title || s.place.name || s.place.address}</p>
                        {s.place.address && <p className="text-sm text-gray-500 mt-1 truncate">📍 {s.place.address}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-col gap-3 mt-8">
                  <button
                    onClick={() => { setPage("home"); setSessionId(null); setSelectedChain([]); }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:-translate-y-0.5 shadow-lg font-semibold"
                  >
                    🚀 Plan Another Meetup
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition-all font-semibold"
                  >
                    🖨️ Print / Save
                  </button>
                </div>
              </div>

              {/* Map display */}
              <div className="bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
                <MapPlanner 
                  options={[]} 
                  selectedChain={selectedChain}
                  onSelect={() => {}}
                  onPreview={(place) => {
                    if (place.link) window.open(place.link, "_blank", "noopener,noreferrer");
                  }}
                  highlightedPlace={highlightedPlace}
                  userCoords={coords || userPrefs?.coords || null}
                  locationText={(placeText && placeText.trim()) || userPrefs?.location || ""}
                />
              </div>
            </div>
          </div>
        )}

        {/* Legacy recommendations grid - only show on home page */}
        {page === "home" && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.length > 0 ? (
                recommendations.map((item, idx) => (
                  <div key={idx} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                    <h2 className="font-semibold text-lg text-white truncate">{item.title || item.Name || "Unnamed Place"}</h2>
                    {item.address && <p className="text-gray-300 text-sm mt-1">{item.address}</p>}
                    {item.rating && <p className="text-yellow-400 mt-1">⭐ {item.rating}</p>}
                    {item.link && (
                      <a 
                        href={item.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-400 hover:text-blue-300 hover:underline mt-2 inline-block"
                      >
                        View on Google
                      </a>
                    )}
                  </div>
                ))
              ) : (
                !loading && !error && (
                  <div className="col-span-full text-center py-8">
                    <p className="text-gray-400">No legacy recommendations yet. Generate an itinerary to see suggestions.</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Full-page overlay shown while switching steps */}
      <FullOverlay show={showOverlay} text="Preparing next options..." />
    </div>
  );
}

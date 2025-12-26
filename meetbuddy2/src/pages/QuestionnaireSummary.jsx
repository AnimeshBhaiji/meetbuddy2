// src/pages/QuestionnaireSummary.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import prefsData from "../../backend/preferences.json";
import subQuestionMap from "@/data/subQuestionMap";
import Aurora from "@/components/Aurora";

const humanizeKey = (k) =>
  ({
    mood: "Mood",
    planningStyle: "Planning Style",
    adventureLevel: "Adventure Level",
    addOnMagic: "Add-On Magic",
    memorableFactor: "Memorable Factor",
  }[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()));

const normalizeMainValue = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string" || typeof val === "number") return String(val).trim();
  if (Array.isArray(val)) {
    const first = val.find((x) => x !== null && x !== undefined && String(x).trim() !== "");
    return first !== undefined ? String(first).trim() : "";
  }
  if (typeof val === "object") {
    if ("value" in val && (typeof val.value === "string" || typeof val.value === "number"))
      return String(val.value).trim();
    for (const [k, v] of Object.entries(val)) {
      if (v === true || v === "true" || v === 1) return String(k).trim();
    }
  }
  return "";
};

// ID -> label lookup for main categories using preferences.json
const idMapToLabel = (category, idOrLabel) => {
  if (!idOrLabel && idOrLabel !== 0) return "";
  const catMap = prefsData?.[category];
  if (!catMap) return String(idOrLabel);
  const raw = String(idOrLabel).trim();
  if (/^\d+$/.test(raw)) return catMap[raw] || raw;
  const values = Object.values(catMap);
  const found = values.find((lbl) => lbl.toLowerCase() === raw.toLowerCase());
  return found || raw;
};

// Find the original question text for a sub-question id within a category.
const getSubQuestionText = (category, subId) => {
  const mapForCat = subQuestionMap?.[category];
  if (!mapForCat) return subId;
  for (const mainLabel of Object.keys(mapForCat)) {
    const arr = mapForCat[mainLabel] || [];
    for (const entry of arr) {
      if (typeof entry === "string") {
        const slug = String(entry).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        if (slug === String(subId).toLowerCase()) return entry;
      } else if (entry && typeof entry === "object") {
        const id = String(entry.id || "").toLowerCase();
        if (id && id === String(subId).toLowerCase()) return entry.question || entry.id;
        const q = String(entry.question || "");
        const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        if (slug === String(subId).toLowerCase()) return q;
      }
    }
  }
  return String(subId).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

// normalize a stored sub-value into array of readable strings (handles arrays/objects/booleans/primitives)
const normalizeSubValue = (category, v) => {
  if (v === null || v === undefined || v === "") return [];
  // array -> map as-is
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (x === null || x === undefined) return null;
        return idMapToLabel(category, x) || String(x);
      })
      .filter(Boolean);
  }
  // boolean true -> ambiguous; return ["Yes"] or the sub-question text is shown in summary UI
  if (typeof v === "boolean") {
    return [v ? "Yes" : "No"];
  }
  // object -> try to extract useful string values or { value: '...' }
  if (typeof v === "object") {
    if ("value" in v && (typeof v.value === "string" || typeof v.value === "number")) {
      return [String(v.value).trim()];
    }
    // object-of-boolean flags -> return keys that are truthy
    const truthy = Object.entries(v)
      .filter(([k, val]) => val === true || val === "true" || val === 1)
      .map(([k]) => idMapToLabel(category, k) || String(k));
    if (truthy.length) return truthy;
    // string fields inside object
    const strings = Object.values(v).filter((x) => typeof x === "string" && x.trim());
    if (strings.length) return strings.map((s) => String(s));
    return [];
  }
  // primitive string/number
  return [String(v)];
};

const renderSubValue = (category, subId, val) => {
  let arr = normalizeSubValue(category, val);
  if (!arr || arr.length === 0) {
    // fallback: if boolean true -> show "Yes"
    if (val === true) return "Yes";
    return "Not set";
  }
  return arr.join(", ");
};

const QuestionnaireSummary = () => {
  const { answers, resetAnswers } = useQuestionnaire() || {};
  const navigate = useNavigate();

  // Build groupedAnswers (main + subs)
  const grouped = {};
  for (const [key, val] of Object.entries(answers || {})) {
    if (key.endsWith("_sub")) continue;
    const subKey = `${key}_sub`;
    grouped[key] = {
      main: normalizeMainValue(val),
      subs: [],
    };
    const rawSubs = answers?.[subKey];
    if (rawSubs && typeof rawSubs === "object") {
      for (const [subId, subVal] of Object.entries(rawSubs)) {
        grouped[key].subs.push({ id: subId, value: subVal });
      }
    }
  }

  // Filter out non-preference keys
  const visibleKeys = Object.keys(grouped).filter((k) => !["user_id", "user", "id"].includes(k));

  // Build payload that includes stage1 main + stage2 normalized subs
  const buildReadablePayload = () => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!storedUser || !storedUser.user_id) return null;
    const userId = storedUser.user_id;

    const keys = ["mood", "planningStyle", "adventureLevel", "addOnMagic", "memorableFactor"];
    const preferences = {};

    // also build explicit _sub arrays so backend can merge stage2 responses
    // (backend checks for keys like 'mood_sub' either at top-level or inside preferences)
    const subsPayload = {};

    for (const key of keys) {
      const ga = grouped[key] || { main: "", subs: [] };
      const final = [];

      // main choice -> map through prefsData if possible (stage1 only)
      if (ga.main) {
        final.push(idMapToLabel(key, ga.main) || ga.main);
      }

      // collect normalized subvalues into a dedicated sub-list only
      const subList = [];
      for (const s of (ga.subs || [])) {
        const normalized = normalizeSubValue(key, s.value);
        if (Array.isArray(normalized) && normalized.length > 0) {
          normalized.forEach((n) => {
            if (n && !subList.includes(n)) subList.push(n);
          });
        }
      }

      if (subList.length) {
        // e.g. mood_sub: ["Candlelit / intimate", ...]
        subsPayload[`${key}_sub`] = subList;
      }

      // preferences[key] now contains only the main stage1 label
      preferences[key] = final;
    }

    // Build final payload. Include nested preferences plus top-level main keys
    // and also top-level *_sub arrays so backend will merge stage2 answers.
    const topLevel = { user_id: userId, preferences, ...preferences, ...subsPayload };
    // Also place the sub-arrays inside the nested `preferences` for compatibility
    for (const k of Object.keys(subsPayload)) {
      if (!topLevel.preferences) topLevel.preferences = {};
      topLevel.preferences[k] = subsPayload[k];
    }

    return topLevel;
  };

  const handleSave = async () => {
    try {
      const payload = buildReadablePayload();
      if (!payload) {
        alert("User not logged in — please log in first.");
        return;
      }
      console.log("🧭 Built payload (from current UI):", payload);
      const res = await fetch("http://localhost:8000/save_preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("❌ Backend error:", text);
        alert("Failed to save preferences.");
        return;
      }
      const data = await res.json();
      console.log("✅ Preferences saved:", data);
      alert("Preferences saved successfully (backend). Summary view unchanged.");
    } catch (err) {
      console.error("❌ Error saving preferences:", err);
      alert("Error saving preferences — check console.");
    }
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <Aurora colorStops={['#5227FF', '#bf4bfd', '#5227FF']} />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />
        
        <div className="flex-1 flex flex-col items-center py-12 px-4">
          <motion.div 
            className="w-full max-w-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-8 text-center">
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Your MeetBuddy Preferences ✨
                </h1>
                <p className="text-gray-400 mt-3 text-base md:text-lg">
                  Here's a summary of your selected preferences. You can save, modify, or move on to plan your meetup!
                </p>
              </div>

              <div className="px-6 pb-8 space-y-8">
                <AnimatePresence mode="wait">
                  {visibleKeys.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No preferences selected yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {visibleKeys.map((key, index) => {
                        const data = grouped[key];
                        const mainLabel = idMapToLabel(key, data.main) || "";
                        return (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
                          >
                            <h3 className="text-xl font-semibold text-white mb-3">
                              {humanizeKey(key)}
                            </h3>
                            {mainLabel ? (
                              <p className="text-base text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300 font-medium mb-4">
                                {mainLabel}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400 italic mb-4">
                                No main selection — refined answers shown below
                              </p>
                            )}

                            {data.subs && data.subs.length > 0 ? (
                              <div className="space-y-3">
                                {data.subs.map((s) => {
                                  const qText = getSubQuestionText(key, s.id);
                                  const displayVal = renderSubValue(key, s.id, s.value);
                                  return (
                                    <div
                                      key={s.id}
                                      className="bg-black/30 rounded-lg border border-white/5 p-3"
                                    >
                                      <div className="text-sm text-gray-300 font-medium">
                                        {qText}
                                      </div>
                                      <div className="text-sm text-gray-400 mt-1">
                                        {displayVal}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No sub-questions answered for this category.
                              </p>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8 border-t border-white/10 mt-8">
                  <Button
                    onClick={handleSave}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
                  >
                    Save Preferences
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        if (typeof resetAnswers === "function") resetAnswers();
                      } catch {}
                      try {
                        localStorage.removeItem("questionnaireAnswers");
                      } catch {}
                      navigate("/questionnaire-stage1");
                    }}
                    className="border border-blue-400/30 text-blue-400 hover:bg-blue-500/10 px-6 py-3 rounded-xl transition-all"
                  >
                    Modify Preferences
                  </Button>
                  <Button
                    onClick={() => navigate("/planner")}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
                  >
                    Plan My Meetup
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireSummary;

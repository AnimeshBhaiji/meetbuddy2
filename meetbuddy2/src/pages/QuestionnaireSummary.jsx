// src/pages/QuestionnaireSummary.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import prefsData from "../../backend/preferences.json";
import subQuestionMap from "../data/subQuestionMap"; // <-- ensure this exists and matches Stage2

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
  const { answers } = useQuestionnaire() || {};
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

    for (const key of keys) {
      const ga = grouped[key] || { main: "", subs: [] };
      const final = [];

      // main choice -> map through prefsData if possible
      if (ga.main) {
        final.push(idMapToLabel(key, ga.main) || ga.main);
      }

      // collect normalized subvalues
      for (const s of (ga.subs || [])) {
        const normalized = normalizeSubValue(key, s.value);
        if (Array.isArray(normalized) && normalized.length > 0) {
          normalized.forEach((n) => {
            if (n && !final.includes(n)) final.push(n);
          });
        }
      }

      preferences[key] = final;
    }

    return { user_id: userId, preferences };
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-purple-50 to-pink-50">
      <Navbar />
      <div className="max-w-4xl mx-auto mt-10 px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Card className="shadow-xl rounded-3xl border-0 bg-white/70 backdrop-blur-md">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Your MeetBuddy Preferences ✨
              </CardTitle>
              <p className="text-gray-600 mt-2">
                Here’s a summary of your selected preferences. You can save, modify, or move on to plan your meetup!
              </p>
            </CardHeader>

            <CardContent className="space-y-6 mt-4">
              {visibleKeys.length === 0 ? (
                <p className="text-center text-gray-500">No preferences selected yet.</p>
              ) : (
                <div className="space-y-6">
                  {visibleKeys.map((key, index) => {
                    const data = grouped[key];
                    const mainLabel = idMapToLabel(key, data.main) || "";
                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className="bg-gradient-to-r from-blue-100 to-purple-100 p-5 rounded-2xl shadow-md hover:shadow-lg transition-shadow"
                      >
                        <h3 className="text-2xl md:text-2xl font-semibold text-gray-800 mb-2">{humanizeKey(key)}</h3>

                        {mainLabel ? (
                          <p className="text-lg md:text-lg text-gray-700 font-medium mb-3">{mainLabel}</p>
                        ) : (
                          <p className="text-gray-600 italic mb-3">No main selection — refined answers shown below</p>
                        )}

                        {data.subs && data.subs.length > 0 ? (
                          <div className="space-y-3">
                            {data.subs.map((s) => {
                              const qText = getSubQuestionText(key, s.id);
                              const displayVal = renderSubValue(key, s.id, s.value);
                              return (
                                <div key={s.id} className="flex items-start justify-between bg-white/80 p-3 rounded-lg border border-gray-100">
                                  <div className="text-sm md:text-base text-gray-700">
                                    <div className="font-medium">{qText}</div>
                                    <div className="text-sm text-gray-500 mt-1">{displayVal}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500">No sub-questions answered for this category.</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10 flex-wrap">
                <Button
                  onClick={handleSave}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 px-6 py-3 rounded-xl shadow-lg transition-all"
                >
                  💾 Save Preferences
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => navigate("/questionnaire-stage1")}
                  className="bg-yellow-400 text-white hover:bg-yellow-500 px-6 py-3 rounded-xl shadow-lg transition-all"
                >
                  ✏️ Modify Preferences
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate("/planner")}
                  className="border-2 border-blue-400 text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-xl transition-all"
                >
                  🚀 Plan My Meetup
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default QuestionnaireSummary;

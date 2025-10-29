// src/pages/QuestionnaireSummary.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import prefsData from "../../backend/preferences.json";

const QuestionnaireSummary = () => {
  const { answers } = useQuestionnaire();
  const navigate = useNavigate();

  // ---------------------------
  // Helpers: normalization
  // ---------------------------
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

  // Group answers
  const groupedAnswers = Object.entries(answers || {}).reduce((acc, [key, value]) => {
    if (key.endsWith("_sub")) return acc;
    const subKey = `${key}_sub`;
    acc[key] = {
      main: normalizeMainValue(value),
      subs: answers[subKey]
        ? Object.entries(answers[subKey])
            .filter(([_, selected]) => selected)
            .map(([label]) => label)
        : [],
    };
    return acc;
  }, {});

  // ID → Label mapping
  const idMapToLabel = (category, idOrLabel) => {
    if (!idOrLabel) return "";
    const catMap = prefsData?.[category];
    if (!catMap) return String(idOrLabel);
    const raw = String(idOrLabel).trim();
    if (/^\d+$/.test(raw)) return catMap[raw] || raw;
    const values = Object.values(catMap);
    const found = values.find((lbl) => lbl.toLowerCase() === raw.toLowerCase());
    return found || raw;
  };

  const mapSubsToLabels = (category, subsArray) => {
    if (!Array.isArray(subsArray)) return [];
    const out = subsArray
      .map((s) => idMapToLabel(category, s))
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return out;
  };

  const buildReadablePayload = () => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!storedUser || !storedUser.user_id) return null;
    const userId = storedUser.user_id;
    const makeArr = (key) => {
      const ga = groupedAnswers[key] || { main: "", subs: [] };
      if (ga.main) return [idMapToLabel(key, ga.main)];
      if (ga.subs?.length) return mapSubsToLabels(key, ga.subs);
      return [];
    };
    return {
      user_id: userId,
      mood: makeArr("mood"),
      planningStyle: makeArr("planningStyle"),
      adventureLevel: makeArr("adventureLevel"),
      addOnMagic: makeArr("addOnMagic"),
      memorableFactor: makeArr("memorableFactor"),
    };
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

  // ---------------------------
  // Render (filtered to hide user_id)
  // ---------------------------
  const filteredEntries = Object.entries(groupedAnswers).filter(
    ([key]) => key !== "user_id" && key !== "user" && key !== "id"
  );

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
              {filteredEntries.length === 0 ? (
                <p className="text-center text-gray-500">No preferences selected yet.</p>
              ) : (
                <div className="space-y-6">
                  {filteredEntries.map(([key, data], index) => {
                    const readableMain = idMapToLabel(key, data.main);
                    const subs = Array.isArray(data.subs) ? data.subs : [];
                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-gradient-to-r from-blue-100 to-purple-100 p-5 rounded-2xl shadow-md hover:shadow-lg transition-shadow"
                      >
                        <h3 className="text-xl font-semibold text-gray-800 mb-2 capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </h3>

                        {readableMain && (
                          <p className="text-gray-700 font-medium mb-3">{readableMain}</p>
                        )}

                        {subs.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {subs.map((sub) => (
                              <span
                                key={sub}
                                className="bg-white text-gray-700 px-3 py-1 rounded-full border border-gray-200 shadow-sm text-sm font-medium hover:bg-blue-50 transition-colors"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
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

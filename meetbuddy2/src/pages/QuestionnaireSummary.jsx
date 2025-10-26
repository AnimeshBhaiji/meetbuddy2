// src/pages/QuestionnaireSummary.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import prefsData from "../../backend/preferences.json"; // object mapping: { mood: { "1": "Fun & Energetic", ... }, ... }

const QuestionnaireSummary = () => {
  const { answers } = useQuestionnaire();
  const navigate = useNavigate();

  // Normalize grouped answers: each key => { main: <value>, subs: [labels] }
  const groupedAnswers = Object.entries(answers).reduce((acc, [key, value]) => {
    if (key.endsWith("_sub")) return acc;
    const subKey = `${key}_sub`;
    acc[key] = {
      main: value ?? "",
      subs: answers[subKey]
        ? Object.entries(answers[subKey])
            .filter(([_, selected]) => selected)
            .map(([label]) => label)
        : [],
    };
    return acc;
  }, {});

  // Convert an incoming main value (could be numeric id or already a label) -> readable label string
  const idMapToLabel = (category, idOrLabel) => {
    if (!idOrLabel && idOrLabel !== 0) return ""; // handle undefined/null/empty
    const catMap = prefsData?.[category];
    if (!catMap || typeof catMap !== "object") {
      // fallback: if no mapping available, if it's string return it, else empty
      return typeof idOrLabel === "string" ? idOrLabel : String(idOrLabel);
    }

    // If it's a number or numeric string — map id -> label
    if (typeof idOrLabel === "number" || (typeof idOrLabel === "string" && /^\d+$/.test(idOrLabel.trim()))) {
      const key = String(idOrLabel).trim();
      if (key in catMap) return catMap[key];
      return ""; // unknown id
    }

    // It's a string that might already be the label. Try exact match or case-insensitive match.
    if (typeof idOrLabel === "string") {
      const trimmed = idOrLabel.trim();
      // direct exact value check (maybe userAnswers already saved label)
      if (Object.values(catMap).includes(trimmed)) return trimmed;
      // case-insensitive / loose match
      const found = Object.values(catMap).find((lbl) => lbl.toLowerCase() === trimmed.toLowerCase());
      if (found) return found;
      // fallback: return the raw string (useful if user provided custom label)
      return trimmed;
    }

    // fallback to string form
    return String(idOrLabel);
  };

  // Build payload in readable (human) text — backend expects arrays for each key
  const buildReadablePayload = () => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    if (!storedUser || !storedUser.user_id) {
      return null;
    }
    const userId = storedUser.user_id;

    return {
      user_id: userId,
      mood: groupedAnswers.mood ? [idMapToLabel("mood", groupedAnswers.mood.main)] : [],
      planningStyle: groupedAnswers.planningStyle ? [idMapToLabel("planningStyle", groupedAnswers.planningStyle.main)] : [],
      adventureLevel: groupedAnswers.adventureLevel ? [idMapToLabel("adventureLevel", groupedAnswers.adventureLevel.main)] : [],
      addOnMagic: groupedAnswers.addOnMagic ? [idMapToLabel("addOnMagic", groupedAnswers.addOnMagic.main)] : [],
      memorableFactor: groupedAnswers.memorableFactor ? [idMapToLabel("memorableFactor", groupedAnswers.memorableFactor.main)] : [],
    };
  };

  const handleSave = async () => {
    try {
      const payload = buildReadablePayload();
      if (!payload) {
        alert("User not logged in — please log in first.");
        return;
      }

      console.log("🧭 Saving readable preferences:", groupedAnswers);
      console.log("📤 Final payload being sent to backend:", payload);

      const res = await fetch("http://localhost:8000/save_preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("❌ Backend error response:", text);
        alert("Failed to save preferences. Check console for details.");
        return;
      }

      const data = await res.json();
      console.log("✅ Preferences saved:", data);
      // Save readable prefs locally for Planner to display (keeps format stable)
      localStorage.setItem("userPreferences", JSON.stringify({
        mood: (payload.mood?.[0]) || "",
        planningStyle: (payload.planningStyle?.[0]) || "",
        adventureLevel: (payload.adventureLevel?.[0]) || "",
        addOnMagic: (payload.addOnMagic?.[0]) || "",
        memorableFactor: (payload.memorableFactor?.[0]) || "",
      }));
      alert("Preferences saved successfully!");
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
              {Object.keys(groupedAnswers).length === 0 ? (
                <p className="text-center text-gray-500">No preferences selected yet.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedAnswers).map(([key, data], index) => {
                    // Display the readable main value (not the object)
                    const readableMain = idMapToLabel(key, data.main) || "No main choice selected";
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

                        <p className="text-gray-700 font-medium mb-3">{readableMain}</p>

                        {Array.isArray(data.subs) && data.subs.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {data.subs.map((sub) => (
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

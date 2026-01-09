// src/pages/QuestionnaireSummary.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import prefsData from "../../backend/preferences.json";
import subQuestionMap from "@/data/subQuestionMap";
import DarkVeil from "@/components/DarkVeil/DarkVeil";

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

const normalizeSubValue = (category, v) => {
  if (v === null || v === undefined || v === "") return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (x === null || x === undefined) return null;
        return idMapToLabel(category, x) || String(x);
      })
      .filter(Boolean);
  }
  if (typeof v === "boolean") {
    return [v ? "Yes" : "No"];
  }
  if (typeof v === "object") {
    if ("value" in v && (typeof v.value === "string" || typeof v.value === "number")) {
      return [String(v.value).trim()];
    }
    const truthy = Object.entries(v)
      .filter(([k, val]) => val === true || val === "true" || val === 1)
      .map(([k]) => idMapToLabel(category, k) || String(k));
    if (truthy.length) return truthy;
    const strings = Object.values(v).filter((x) => typeof x === "string" && x.trim());
    if (strings.length) return strings.map((s) => String(s));
    return [];
  }
  return [String(v)];
};

const renderSubValue = (category, subId, val) => {
  let arr = normalizeSubValue(category, val);
  if (!arr || arr.length === 0) {
    if (val === true) return "Yes";
    return "Not set";
  }
  return arr.join(", ");
};

const QuestionnaireSummary = () => {
  const { answers, resetAnswers } = useQuestionnaire() || {};
  const navigate = useNavigate();

  const grouped = {};
  if (answers) {
    for (const [key, val] of Object.entries(answers)) {
      if (key.endsWith("_sub")) continue;
      const subKey = `${key}_sub`;
      grouped[key] = {
        main: normalizeMainValue(val),
        subs: [],
      };
      const rawSubs = answers[subKey];
      if (rawSubs && typeof rawSubs === "object") {
        for (const [subId, subVal] of Object.entries(rawSubs)) {
          grouped[key].subs.push({ id: subId, value: subVal });
        }
      }
    }
  }

  const visibleKeys = Object.keys(grouped).filter((k) => !["user_id", "user", "id"].includes(k));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Background */}
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

        <div className="flex-1 flex flex-col items-center py-12 px-4 max-w-6xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter text-white mb-6">
              Your <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 bg-clip-text text-transparent italic">MeetBuddy</span> Profile
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
              We've analyzed your style. Here's your personalized adventure blueprint.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence>
              {visibleKeys.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-20 text-center"
                >
                  <p className="text-2xl text-gray-500 font-medium italic">No preferences selected yet.</p>
                </motion.div>
              ) : (
                visibleKeys.map((key) => {
                  const data = grouped[key];
                  const mainLabel = idMapToLabel(key, data.main) || "";

                  const gradients = {
                    mood: "from-blue-500/20 via-blue-600/5 to-transparent",
                    planningStyle: "from-purple-500/20 via-purple-600/5 to-transparent",
                    adventureLevel: "from-pink-500/20 via-pink-600/5 to-transparent",
                    addOnMagic: "from-amber-500/20 via-amber-600/5 to-transparent",
                    memorableFactor: "from-emerald-500/20 via-emerald-600/5 to-transparent"
                  };
                  const gradient = gradients[key] || "from-gray-500/20 via-gray-600/5 to-transparent";

                  return (
                    <motion.div
                      key={key}
                      variants={itemVariants}
                      whileHover={{ y: -8, transition: { duration: 0.3 } }}
                      className="relative group h-full"
                    >
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-white/10 to-transparent rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-500" />
                      <div className="relative h-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] overflow-hidden p-8 flex flex-col">
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex items-center justify-between mb-8">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 group-hover:text-white/70 transition-colors">
                              {humanizeKey(key)}
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                          </div>

                          {mainLabel ? (
                            <div className="mb-8">
                              <h4 className="text-2xl font-bold text-white tracking-tight leading-tight group-hover:scale-105 transition-transform origin-left duration-300">
                                {mainLabel}
                              </h4>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic mb-8">
                              Refined selection below
                            </p>
                          )}

                          <div className="mt-auto space-y-4">
                            {data.subs && data.subs.length > 0 ? (
                              data.subs.map((s) => {
                                const qText = getSubQuestionText(key, s.id);
                                const displayVal = renderSubValue(key, s.id, s.value);
                                return (
                                  <div key={s.id} className="bg-white/5 rounded-2xl p-5 border border-white/5 group-hover:border-white/10 transition-colors">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5">{qText}</p>
                                    <p className="text-sm text-gray-200 font-semibold leading-relaxed">{displayVal}</p>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="h-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-20 w-full flex flex-col sm:flex-row justify-center gap-6"
          >
            <button
              onClick={() => {
                try {
                  if (typeof resetAnswers === "function") resetAnswers();
                } catch { }
                try {
                  localStorage.removeItem("questionnaireAnswers");
                } catch { }
                navigate("/questionnaire-stage1");
              }}
              className="px-12 py-6 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl text-lg font-bold transition-all transform hover:scale-[1.02] active:scale-95"
            >
              Modify My Preferences
            </button>
            <button
              onClick={() => navigate("/planner")}
              className="px-12 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-2xl text-lg font-bold shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all transform hover:scale-[1.02] hover:-translate-y-1 active:scale-95"
            >
              Start Planning Now ✨
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireSummary;

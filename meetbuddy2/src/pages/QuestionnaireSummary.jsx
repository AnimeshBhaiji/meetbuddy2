// src/pages/QuestionnaireSummary.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import { motion } from "framer-motion";
import { Sparkles, PencilLine, ArrowRight, CheckCircle2 } from "lucide-react";
import prefsData from "../../backend/preferences.json";
import subQuestionMap from "@/data/subQuestionMap";
import GlassCard from "@/components/ui/GlassCard";

const humanizeKey = (k) =>
({
  mood: "Mood",
  planningStyle: "Planning Style",
  adventureLevel: "Adventure Level",
  addOnMagic: "Add-On Magic",
  memorableFactor: "Memorable Factor",
}[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()));

const CATEGORY_EMOJI = {
  mood: "🎭",
  planningStyle: "🗺️",
  adventureLevel: "🧭",
  addOnMagic: "✨",
  memorableFactor: "💫",
};

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
      .filter(([, val]) => val === true || val === "true" || val === 1)
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

  return (
    <div className="relative min-h-screen overflow-x-clip">

      <div className="min-h-screen flex flex-col pt-28 pb-16 px-4 max-w-6xl mx-auto w-full">
        {/* Celebration header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
            className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand to-brand-2 flex items-center justify-center glow-md"
          >
            <CheckCircle2 className="w-8 h-8 text-white" />
          </motion.div>
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Stage 3 · <span className="text-brand-3">All set</span>
          </p>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-5">
            Your <span className="text-gradient">MeetBuddy</span> profile
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We've analyzed your style. Here's the blueprint every plan will be built on.
          </p>
        </motion.div>

        {/* Preference cards */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleKeys.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-20 text-center"
              >
                <p className="text-xl text-muted-foreground">No preferences selected yet.</p>
              </motion.div>
            ) : (
              visibleKeys.map((key, cardIndex) => {
                const data = grouped[key];
                const mainLabel = idMapToLabel(key, data.main) || "";

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 26, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.55,
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.25 + cardIndex * 0.12,
                    }}
                    className="h-full"
                  >
                    <GlassCard hover variant="strong" className="h-full p-7 flex flex-col group">
                      <div className="flex items-center justify-between mb-6">
                        <span className="flex items-center gap-2.5">
                          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand/30 to-brand-2/30 border border-white/10 text-lg">
                            {CATEGORY_EMOJI[key] ?? "✨"}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground group-hover:text-white/80 transition-colors">
                            {humanizeKey(key)}
                          </span>
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-brand glow-sm animate-pulse-glow" />
                      </div>

                      {mainLabel ? (
                        <h4 className="text-2xl font-bold text-gradient leading-tight mb-6">
                          {mainLabel}
                        </h4>
                      ) : (
                        <p className="text-sm text-muted-foreground italic mb-6">
                          Refined selection below
                        </p>
                      )}

                      <div className="mt-auto space-y-3">
                        {data.subs &&
                          data.subs.length > 0 &&
                          data.subs.map((s) => {
                            const qText = getSubQuestionText(key, s.id);
                            const displayVal = renderSubValue(key, s.id, s.value);
                            return (
                              <div
                                key={s.id}
                                className="bg-white/[0.04] rounded-xl p-4 border border-white/5 group-hover:border-white/15 transition-colors"
                              >
                                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1">
                                  {qText}
                                </p>
                                <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                                  {displayVal}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })
            )}
        </div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-16 w-full flex flex-col sm:flex-row justify-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              try {
                if (typeof resetAnswers === "function") resetAnswers();
              } catch { /* ignore */ }
              try {
                localStorage.removeItem("questionnaireAnswers");
              } catch { /* ignore */ }
              navigate("/questionnaire-stage1");
            }}
            className="inline-flex items-center justify-center gap-2 px-9 py-4 glass text-white rounded-2xl text-lg font-semibold hover:bg-white/10 transition-colors cursor-pointer"
          >
            <PencilLine className="w-5 h-5" />
            Modify preferences
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/planner")}
            className="inline-flex items-center justify-center gap-2 px-9 py-4 bg-gradient-to-r from-brand to-brand-2 text-white rounded-2xl text-lg font-semibold glow-md cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            Start planning now
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default QuestionnaireSummary;

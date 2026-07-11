// src/pages/QuestionnaireStage2.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, SlidersHorizontal } from "lucide-react";
import { useQuestionnaire } from "@/context/QuestionnaireContext";
import subQuestionMap from "@/data/subQuestionMap";
import Navbar from "@/components/Navbar";
import AmbientBackground from "@/components/AmbientBackground";
import GlassCard from "@/components/ui/GlassCard";
import GlowButton from "@/components/ui/GlowButton";

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const humanizeKey = (k = "") =>
  String(k)
    .replace(/([A-Z])/g, " $1")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();

const CATEGORY_EMOJI = {
  mood: "🎭",
  planningStyle: "🗺️",
  adventureLevel: "🧭",
  addOnMagic: "✨",
  memorableFactor: "💫",
};

/* Selectable chip shared by Radio/Checkbox groups */
const Chip = ({ selected, onClick, children, ...aria }) => (
  <motion.button
    type="button"
    whileHover={{ scale: 1.04, y: -1 }}
    whileTap={{ scale: 0.96 }}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm md:text-base font-medium cursor-pointer transition-all duration-200 focus:outline-none ${
      selected
        ? "bg-gradient-to-r from-brand/35 to-brand-2/30 text-white border border-brand/50 glow-sm"
        : "glass text-foreground/75 hover:bg-white/10 hover:text-white"
    }`}
    {...aria}
  >
    {selected && <Check className="w-3.5 h-3.5 text-brand-3" />}
    {children}
  </motion.button>
);

/* RadioGroup (styled) */
function RadioGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((opt) => (
        <Chip
          key={opt}
          role="radio"
          aria-checked={value === opt}
          selected={value === opt}
          onClick={() => onChange(opt)}
        >
          {opt}
        </Chip>
      ))}
    </div>
  );
}

/* CheckboxGroup (styled) */
function CheckboxGroup({ options, value = [], onChange }) {
  const checkedSet = new Set(value || []);
  const toggle = (opt) => {
    const next = checkedSet.has(opt)
      ? Array.from(checkedSet).filter((x) => x !== opt)
      : [...Array.from(checkedSet), opt];
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((opt) => (
        <Chip
          key={opt}
          aria-pressed={checkedSet.has(opt)}
          selected={checkedSet.has(opt)}
          onClick={() => toggle(opt)}
        >
          {opt}
        </Chip>
      ))}
    </div>
  );
}

export default function QuestionnaireStage2() {
  const navigate = useNavigate();
  const ctx = useQuestionnaire() || {};
  const ctxAnswers = ctx.answers ?? ctx.state ?? ctx.questionnaire ?? ctx.data ?? {};

  const setAnswersFromCtx =
    typeof ctx.setAnswers === "function"
      ? ctx.setAnswers
      : typeof ctx.updateAnswers === "function"
      ? ctx.updateAnswers
      : typeof ctx.saveAnswers === "function"
      ? ctx.saveAnswers
      : typeof ctx.setQuestionnaire === "function"
      ? ctx.setQuestionnaire
      : typeof ctx.setState === "function"
      ? ctx.setState
      : null;

  const [localAnswers, setLocalAnswers] = useState(() => {
    try {
      const persisted = JSON.parse(localStorage.getItem("questionnaireAnswers") || "null");
      return Object.keys(ctxAnswers || {}).length ? ctxAnswers : persisted || {};
    } catch {
      return ctxAnswers || {};
    }
  });

  const answers = ctxAnswers && Object.keys(ctxAnswers).length ? ctxAnswers : localAnswers;
  const setAnswers = setAnswersFromCtx
    ? (newAnswers) => {
        try {
          if (setAnswersFromCtx.length === 1) setAnswersFromCtx(newAnswers);
          else setAnswersFromCtx((prev) => ({ ...(prev || {}), ...(newAnswers || {}) }));
          localStorage.setItem(
            "questionnaireAnswers",
            JSON.stringify({ ...(answers || {}), ...(newAnswers || {}) })
          );
        } catch (err) {
          console.warn("Context updater failed, fallback to local", err);
          setLocalAnswers((prev) => ({ ...(prev || {}), ...(newAnswers || {}) }));
          try {
            localStorage.setItem(
              "questionnaireAnswers",
              JSON.stringify({ ...(answers || {}), ...(newAnswers || {}) })
            );
          } catch { /* localStorage unavailable */ }
        }
      }
    : (newAnswers) => {
        setLocalAnswers((prev) => ({ ...(prev || {}), ...(newAnswers || {}) }));
        try {
          localStorage.setItem(
            "questionnaireAnswers",
            JSON.stringify({ ...(answers || {}), ...(newAnswers || {}) })
          );
        } catch { /* localStorage unavailable */ }
      };

  if (!setAnswersFromCtx && typeof window !== "undefined" && !window.__Q2_warned) {
    console.warn(
      "QuestionnaireStage2: useQuestionnaire() didn't provide a setter named setAnswers/updateAnswers/saveAnswers/setQuestionnaire/setState. Component will use local state fallback."
    );
    window.__Q2_warned = true;
  }

  // Normalize stage1 main selections:
  const stage1Main = useMemo(() => {
    const keys = ["mood", "planningStyle", "adventureLevel", "addOnMagic", "memorableFactor"];
    const out = {};
    for (const k of keys) {
      const val = answers?.[k];
      if (!val) continue;
      if (Array.isArray(val)) out[k] = val[0];
      else if (typeof val === "object" && val !== null) {
        if ("value" in val) out[k] = String(val.value);
        else {
          const firstTrue = Object.entries(val).find(([__, v]) => v === true || v === "true");
          out[k] = firstTrue ? firstTrue[0] : "";
        }
      } else out[k] = String(val);
    }
    return out;
  }, [answers]);

  const subBlocks = useMemo(() => {
    const blocks = [];
    for (const [category, mainLabel] of Object.entries(stage1Main)) {
      if (!mainLabel) continue;
      const mapForCategory = subQuestionMap?.[category];
      if (!mapForCategory) continue;
      const raw = mapForCategory[mainLabel] || [];
      const questions = raw.map((entry, i) => {
        if (entry && typeof entry === "object" && (entry.question || entry.id)) {
          return {
            id: entry.id ? String(entry.id) : slugify(entry.question || `q-${i}`),
            question: entry.question || String(entry.id || `Question ${i + 1}`),
            type: entry.type || "single",
            options: Array.isArray(entry.options) ? entry.options : [],
          };
        }
        if (typeof entry === "string") {
          return {
            id: slugify(entry || `q-${i}`),
            question: entry,
            type: "text",
            options: [],
          };
        }
        return { id: `q-${i}`, question: String(entry || `Question ${i + 1}`), type: "text", options: [] };
      });
      if (questions.length > 0) blocks.push({ category, mainLabel, questions });
    }
    return blocks;
  }, [stage1Main]);

  // progress counters
  const { totalSubs, answeredSubs } = useMemo(() => {
    let total = 0;
    let answered = 0;
    for (const block of subBlocks) {
      const subKey = `${block.category}_sub`;
      const storedObj = answers?.[subKey] || {};
      for (const q of block.questions) {
        total += 1;
        const val = storedObj[q.id];
        if (q.type === "multi") {
          if (Array.isArray(val) && val.length > 0) answered += 1;
        } else {
          if (val !== undefined && val !== "" && val !== null) answered += 1;
        }
      }
    }
    return { totalSubs: total, answeredSubs: answered };
  }, [subBlocks, answers]);

  const pct = totalSubs === 0 ? 0 : Math.round((answeredSubs / totalSubs) * 100);

  const handleChange = (category, subId, type, value) => {
    const subKey = `${category}_sub`;
    const current =
      answers?.[subKey] && typeof answers[subKey] === "object" ? { ...answers[subKey] } : {};
    if (type === "multi") {
      current[subId] = Array.isArray(value) ? value : [];
    } else {
      current[subId] = value === null || value === undefined ? "" : String(value);
    }
    const newAnswers = { ...(answers || {}), [subKey]: current };
    setAnswers(newAnswers);
  };

  const handleBack = () => navigate("/questionnaire-stage1");
  const handleNext = () => navigate("/questionnaire-summary");

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AmbientBackground intensity="app" />
      <Navbar />

      <div className="min-h-screen flex flex-col pt-28 pb-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Stage 2 · <span className="text-brand-3">Fine-tune</span>
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">
              Fine-tune your <span className="text-gradient">choices</span>
            </h1>
            <p className="text-muted-foreground">
              Optional details that make recommendations sharper
            </p>
          </div>

          {/* Progress */}
          <div className="mb-10 max-w-2xl mx-auto">
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-2">
              <motion.div
                className="h-full bg-gradient-to-r from-brand to-brand-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                aria-valuenow={pct}
              />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {answeredSubs} of {totalSubs} answered
              </span>
              <span className={pct === 100 ? "text-brand-3 font-medium" : ""}>{pct}% complete</span>
            </div>
          </div>

          {subBlocks.length === 0 && (
            <GlassCard variant="strong" className="p-10 text-center max-w-2xl mx-auto">
              <SlidersHorizontal className="w-10 h-10 text-brand-3 mx-auto mb-4" />
              <p className="text-foreground/85 mb-6">
                No stage 1 selections found. Please complete Stage 1 first.
              </p>
              <GlowButton onClick={handleBack}>
                <ArrowLeft className="w-4.5 h-4.5" /> Go to Stage 1
              </GlowButton>
            </GlassCard>
          )}

          <motion.div
            className="grid gap-6 w-full"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {subBlocks.map((block) => {
              const blockTitle = humanizeKey(block.category);
              return (
                <motion.div key={block.category} variants={itemVariants} className="w-full">
                  <GlassCard variant="strong" className="overflow-hidden">
                    <div className="p-7 md:p-8">
                      <div className="flex items-center gap-4 mb-7">
                        <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand/30 to-brand-2/30 border border-white/10 text-2xl">
                          {CATEGORY_EMOJI[block.category] ?? "✨"}
                        </span>
                        <div>
                          <h2 className="text-xl md:text-2xl font-bold text-white">{blockTitle}</h2>
                          <p className="text-sm text-muted-foreground">
                            Your pick:{" "}
                            <span className="font-semibold text-gradient">{block.mainLabel}</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        {block.questions.map((q) => {
                          const subKey = `${block.category}_sub`;
                          const stored = answers?.[subKey] && answers[subKey][q.id];
                          const isSet =
                            q.type === "multi"
                              ? Array.isArray(stored) && stored.length > 0
                              : Boolean(stored);
                          return (
                            <div
                              key={q.id}
                              className={`rounded-2xl p-6 border transition-colors duration-300 ${
                                isSet ? "bg-white/[0.06] border-brand/25" : "bg-white/[0.03] border-white/10"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-1">
                                <label className="block text-base md:text-lg font-semibold text-white">
                                  {q.question}
                                </label>
                                <span
                                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full border ${
                                    isSet
                                      ? "text-brand-3 border-brand/40 bg-brand/10"
                                      : "text-muted-foreground/70 border-white/10"
                                  }`}
                                >
                                  {q.type === "multi"
                                    ? isSet
                                      ? `${stored.length} selected`
                                      : "Optional"
                                    : isSet
                                    ? "Set"
                                    : "Optional"}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-4">
                                {q.type === "single" && "Choose one"}
                                {q.type === "multi" && "Choose any that apply"}
                                {q.type === "text" && "Short answer"}
                              </p>

                              {q.type === "single" && q.options?.length > 0 && (
                                <RadioGroup
                                  options={q.options}
                                  value={stored || ""}
                                  onChange={(val) => handleChange(block.category, q.id, "single", val)}
                                />
                              )}

                              {q.type === "multi" && q.options?.length > 0 && (
                                <CheckboxGroup
                                  options={q.options}
                                  value={Array.isArray(stored) ? stored : []}
                                  onChange={(arr) => handleChange(block.category, q.id, "multi", arr)}
                                />
                              )}

                              {q.type === "text" && (
                                <input
                                  type="text"
                                  className="mt-1 w-full rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-brand/60 focus:ring-2 focus:ring-brand/30 focus:bg-white/[0.07]"
                                  placeholder="Type your preference (e.g. 'Sushi, Italian')"
                                  value={stored || ""}
                                  onChange={(e) => handleChange(block.category, q.id, "text", e.target.value)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Nav */}
          <div className="flex justify-between items-center gap-4 mt-12 w-full">
            <GlowButton variant="ghost" onClick={handleBack}>
              <ArrowLeft className="w-4.5 h-4.5" /> Back
            </GlowButton>
            <GlowButton onClick={handleNext} size="lg">
              Continue <ArrowRight className="w-4.5 h-4.5" />
            </GlowButton>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

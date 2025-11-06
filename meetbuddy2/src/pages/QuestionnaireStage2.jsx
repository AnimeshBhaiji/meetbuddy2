// src/pages/QuestionnaireStage2.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import subQuestionMap from "../data/subQuestionMap";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

/* RadioGroup (styled) */
function RadioGroup({ name, options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(opt)}
            className={`px-4 py-2 rounded-full text-sm md:text-base font-medium transition-shadow focus:outline-none transform-gpu
              ${selected ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md" : "bg-white text-gray-800 hover:bg-blue-50"}
              border border-gray-200`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* CheckboxGroup (styled) */
function CheckboxGroup({ name, options, value = [], onChange }) {
  const checkedSet = new Set(value || []);
  const toggle = (opt) => {
    const next = checkedSet.has(opt)
      ? Array.from(checkedSet).filter((x) => x !== opt)
      : [...Array.from(checkedSet), opt];
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((opt) => {
        const checked = checkedSet.has(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={checked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle(opt)}
            className={`px-4 py-2 rounded-full text-sm md:text-base font-medium transition transform focus:outline-none
              ${checked ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md" : "bg-white text-gray-800 hover:bg-blue-50"}
              border border-gray-200`}
          >
            {opt}
          </button>
        );
      })}
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
          localStorage.setItem("questionnaireAnswers", JSON.stringify({ ...(answers || {}), ...(newAnswers || {}) }));
        } catch (err) {
          console.warn("Context updater failed, fallback to local", err);
          setLocalAnswers((prev) => ({ ...(prev || {}), ...(newAnswers || {}) }));
          try {
            localStorage.setItem("questionnaireAnswers", JSON.stringify({ ...(answers || {}), ...(newAnswers || {}) }));
          } catch {}
        }
      }
    : (newAnswers) => {
        setLocalAnswers((prev) => ({ ...(prev || {}), ...(newAnswers || {}) }));
        try {
          localStorage.setItem("questionnaireAnswers", JSON.stringify({ ...(answers || {}), ...(newAnswers || {}) }));
        } catch {}
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

  // core handler uses discovered setter
  const handleChange = (category, subId, type, value) => {
    const subKey = `${category}_sub`;
    const current = answers?.[subKey] && typeof answers[subKey] === "object" ? { ...answers[subKey] } : {};
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

  // Framer Motion variants for staggered fade-in
  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-100 text-gray-900">
      <Navbar />

      <div
        className="max-w-5xl mx-auto px-4 pt-28 pb-20"
        style={{ position: "relative", zIndex: 200, pointerEvents: "auto" }}
      >
        <div className="mb-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800">Stage 2 — Fine tune your choices</h1>
          <p className="text-base md:text-lg text-gray-600 mt-2">Optional details that make recommendations more accurate.</p>

          <div className="mt-4">
            <div className="w-full bg-white/70 rounded-full h-3 md:h-3.5 overflow-hidden">
              <div
                className="h-3 md:h-3.5 rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: "linear-gradient(90deg,#3b82f6,#8b5cf6)" }}
                aria-valuenow={pct}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
              <div>{answeredSubs} of {totalSubs} answered</div>
              <div>{pct}% complete</div>
            </div>
          </div>
        </div>

        {subBlocks.length === 0 && (
          <Card className="rounded-2xl shadow-md border-0 bg-white/80 backdrop-blur-sm p-6 text-center">
            <p className="text-gray-700 mb-4">No stage 1 selections found. Please complete Stage 1 first.</p>
            <Button onClick={handleBack} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              Go to Stage 1
            </Button>
          </Card>
        )}

        <motion.div
          className="grid gap-6 mt-8"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {subBlocks.map((block, idx) => {
            const blockTitle = humanizeKey(block.category);
            return (
              <motion.div key={block.category} variants={itemVariants}>
                <Card className="rounded-2xl shadow-lg border-0 bg-white/70 backdrop-blur-md">
                  <CardHeader className="px-6 pt-6 pb-0 text-center">
                    <CardTitle className="text-3xl md:text-3xl font-bold text-gray-900">{blockTitle}</CardTitle>
                    <div className="text-lg md:text-lg text-gray-700 mt-2">
                      Main choice:{" "}
                      <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                        {block.mainLabel}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6">
                    <div className="grid gap-4">
                      {block.questions.map((q) => {
                        const subKey = `${block.category}_sub`;
                        const stored = answers?.[subKey] && answers[subKey][q.id];
                        return (
                          <div key={q.id} className="bg-white p-4 rounded-lg border border-gray-100">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <label className="block text-base md:text-lg font-semibold mb-2 text-gray-800">
                                  {q.question}
                                </label>
                                <div className="text-sm text-gray-500 mb-3">
                                  {q.type === "single" && "Choose one"}
                                  {q.type === "multi" && "Choose any that apply"}
                                  {q.type === "text" && "Optional — short answer"}
                                </div>

                                {q.type === "single" && q.options?.length > 0 && (
                                  <RadioGroup
                                    name={`${block.category}_${q.id}`}
                                    options={q.options}
                                    value={stored || ""}
                                    onChange={(val) => handleChange(block.category, q.id, "single", val)}
                                  />
                                )}

                                {q.type === "multi" && q.options?.length > 0 && (
                                  <CheckboxGroup
                                    name={`${block.category}_${q.id}`}
                                    options={q.options}
                                    value={Array.isArray(stored) ? stored : []}
                                    onChange={(arr) => handleChange(block.category, q.id, "multi", arr)}
                                  />
                                )}

                                {q.type === "text" && (
                                  <input
                                    type="text"
                                    className="mt-2 w-full rounded-lg px-3 py-2 bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none"
                                    placeholder="Type your preference (e.g. 'Sushi, Italian')"
                                    value={stored || ""}
                                    onChange={(e) => handleChange(block.category, q.id, "text", e.target.value)}
                                  />
                                )}
                              </div>

                              <div className="ml-4 text-xs md:text-sm text-gray-500 whitespace-nowrap">
                                {q.type === "multi"
                                  ? (Array.isArray(stored) && stored.length > 0 ? `${stored.length} selected` : "Not set")
                                  : (stored ? "Set" : "Not set")}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="flex gap-3 justify-end mt-10">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="px-5 py-2 rounded-full text-blue-700 hover:bg-blue-50"
          >
            ← Back
          </Button>
          <Button
            onClick={handleNext}
            className="px-6 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md hover:from-blue-600 hover:to-purple-600"
          >
            Continue →
          </Button>
        </div>
      </div>
    </div>
  );
}

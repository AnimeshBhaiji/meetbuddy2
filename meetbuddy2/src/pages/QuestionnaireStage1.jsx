// src/pages/QuestionnaireStage1.jsx
// The whole questionnaire as ONE flow: each main question's follow-ups appear
// right after it (based on the chosen answer). Single-choice questions
// auto-advance; multi/text use Continue; every follow-up is skippable.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useQuestionnaire } from "@/context/QuestionnaireContext";
import subQuestionMap from "@/data/subQuestionMap";
import GlowButton from "@/components/ui/GlowButton";

const MAIN_QUESTIONS = [
  {
    key: "mood",
    question: "What's the vibe you're going for this time?",
    options: ["Fun & Energetic", "Chill & Relaxed", "Business-y", "Romantic"],
  },
  {
    key: "planningStyle",
    question: "How much effort do you want to put into planning?",
    options: ["Surprise me", "Semi-custom", "Full control"],
  },
  {
    key: "adventureLevel",
    question: "How far are you willing to go for this meetup?",
    options: ["Stick to the city", "Short drive to hidden gem", "Weekend escape"],
  },
  {
    key: "addOnMagic",
    question: "Want us to add some extra sparkle?",
    options: [
      "Easy rides arranged",
      "Live music spots",
      "Surprise gift delivery / Insta-corners",
    ],
  },
  {
    key: "memorableFactor",
    question: "What makes a meetup unforgettable for you?",
    options: ["A unique place", "Amazing food", "Deep conversations / Capture moments"],
  },
];

const OPTION_EMOJI = {
  "Fun & Energetic": "🎉",
  "Chill & Relaxed": "😌",
  "Business-y": "💼",
  "Romantic": "🌹",
  "Surprise me": "🎲",
  "Semi-custom": "🎨",
  "Full control": "🎛️",
  "Stick to the city": "🏙️",
  "Short drive to hidden gem": "🚗",
  "Weekend escape": "🏕️",
  "Easy rides arranged": "🚕",
  "Live music spots": "🎶",
  "Surprise gift delivery / Insta-corners": "🎁",
  "A unique place": "✨",
  "Amazing food": "🍜",
  "Deep conversations / Capture moments": "📸",
};

const MAIN_LABELS = {
  mood: "Mood",
  planningStyle: "Planning style",
  adventureLevel: "Distance",
  addOnMagic: "Extras",
  memorableFactor: "Memorable",
};

const AUTO_ADVANCE_MS = 400;

const mainAnswerOf = (answers, key) => {
  const val = answers?.[key];
  if (!val) return "";
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val);
};

const QuestionnaireFlow = () => {
  const { answers, updateAnswers } = useQuestionnaire();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [textDraft, setTextDraft] = useState("");
  const navigate = useNavigate();
  const advanceTimer = useRef(null);

  // Flow = each main question followed by the follow-ups its answer unlocks
  const steps = useMemo(() => {
    const out = [];
    for (const main of MAIN_QUESTIONS) {
      out.push({ kind: "main", ...main });
      const chosen = mainAnswerOf(answers, main.key);
      const subs = (subQuestionMap[main.key] || {})[chosen] || [];
      for (const sub of subs) {
        out.push({ kind: "sub", category: main.key, parentLabel: chosen, ...sub });
      }
    }
    return out;
  }, [answers]);

  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const step = steps[Math.min(currentIndex, steps.length - 1)];

  const subValue = (s) => (answers?.[`${s.category}_sub`] || {})[s.id];

  // reset the text draft when arriving on a text step
  useEffect(() => {
    if (step?.type === "text") setTextDraft(String(subValue(step) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const goNext = () => {
    setDirection(1);
    if (indexRef.current < stepsRef.current.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      navigate("/questionnaire-summary");
    }
  };

  const scheduleAdvance = () => {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(goNext, AUTO_ADVANCE_MS);
  };

  const handleBack = () => {
    clearTimeout(advanceTimer.current);
    setDirection(-1);
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleMainSelect = (key, label) => {
    updateAnswers({ [key]: label });
    scheduleAdvance();
  };

  const writeSub = (s, value) => {
    const subKey = `${s.category}_sub`;
    const current = { ...(answers?.[subKey] || {}) };
    current[s.id] = value;
    updateAnswers({ [subKey]: current });
  };

  const handleSubSingle = (s, opt) => {
    writeSub(s, opt);
    scheduleAdvance();
  };

  const handleSubMultiToggle = (s, opt) => {
    const cur = Array.isArray(subValue(s)) ? subValue(s) : [];
    writeSub(s, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  };

  const handleTextContinue = (s) => {
    if (textDraft.trim()) writeSub(s, textDraft.trim());
    goNext();
  };

  const isLast = currentIndex >= steps.length - 1;
  const mainSelected = step?.kind === "main" ? mainAnswerOf(answers, step.key) : "";

  const slideVariants = {
    enter: (dir) => ({ opacity: 0, x: dir * 60, filter: "blur(4px)" }),
    center: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    },
    exit: (dir) => ({
      opacity: 0,
      x: dir * -60,
      filter: "blur(4px)",
      transition: { duration: 0.25, ease: "easeIn" },
    }),
  };

  const OptionButton = ({ selected, onClick, emoji, children, delay = 0 }) => (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative flex items-center gap-4 w-full text-left p-5 rounded-2xl text-lg font-medium cursor-pointer transition-all duration-200 ${
        selected
          ? "glass-strong border-gradient text-white glow-sm"
          : "glass text-foreground/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {emoji && <span className="text-2xl">{emoji}</span>}
      <span className="flex-1">{children}</span>
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-200 ${
          selected
            ? "bg-gradient-to-br from-brand to-brand-2 border-transparent"
            : "border-white/25"
        }`}
      >
        {selected && <Check className="w-3.5 h-3.5 text-white" />}
      </span>
    </motion.button>
  );

  if (!step) return null;

  return (
    <div className="relative min-h-screen overflow-x-clip">

      <div className="min-h-screen flex flex-col pt-28 pb-12 px-4">
        {/* Header: label + progress */}
        <div className="w-full max-w-2xl mx-auto mb-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">
              Plan your meetup ·{" "}
              <span className="text-brand-3">
                {MAIN_LABELS[step.kind === "main" ? step.key : step.category]}
              </span>
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {currentIndex + 1} / {steps.length}
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
              initial={false}
              animate={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="flex-1 flex items-start justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${step.kind}-${step.kind === "main" ? step.key : step.id}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-2xl"
            >
              {step.kind === "sub" && (
                <p className="text-center text-sm font-medium text-brand-3 mb-3">
                  Follow-up · {step.parentLabel}
                </p>
              )}
              <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-10 leading-tight">
                {step.question}
              </h2>

              {/* MAIN + SUB single-choice: big option buttons, auto-advance */}
              {(step.kind === "main" || step.type === "single") && (
                <div
                  className={`grid gap-4 ${
                    step.options.length === 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {step.options.map((opt, i) => {
                    const selected =
                      step.kind === "main" ? mainSelected === opt : subValue(step) === opt;
                    return (
                      <OptionButton
                        key={opt}
                        delay={0.08 * i}
                        selected={selected}
                        emoji={step.kind === "main" ? OPTION_EMOJI[opt] ?? "✨" : null}
                        onClick={() =>
                          step.kind === "main"
                            ? handleMainSelect(step.key, opt)
                            : handleSubSingle(step, opt)
                        }
                      >
                        {opt}
                      </OptionButton>
                    );
                  })}
                </div>
              )}

              {/* SUB multi-choice: toggle buttons + Continue */}
              {step.kind === "sub" && step.type === "multi" && (
                <div className="grid gap-4 grid-cols-1">
                  {step.options.map((opt, i) => {
                    const cur = Array.isArray(subValue(step)) ? subValue(step) : [];
                    return (
                      <OptionButton
                        key={opt}
                        delay={0.08 * i}
                        selected={cur.includes(opt)}
                        onClick={() => handleSubMultiToggle(step, opt)}
                      >
                        {opt}
                      </OptionButton>
                    );
                  })}
                </div>
              )}

              {/* SUB text input */}
              {step.kind === "sub" && step.type === "text" && (
                <motion.input
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  type="text"
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTextContinue(step)}
                  placeholder="Type here… (or skip)"
                  autoFocus
                  className="w-full glass rounded-2xl p-5 text-lg text-white placeholder:text-foreground/40 outline-none focus:border-brand/50 border border-transparent"
                />
              )}

              {/* Nav row */}
              <div className="flex justify-between items-center gap-4 mt-10">
                <GlowButton
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentIndex === 0}
                  className={currentIndex === 0 ? "invisible" : ""}
                >
                  <ArrowLeft className="w-4.5 h-4.5" /> Back
                </GlowButton>

                <div className="flex items-center gap-3">
                  {step.kind === "sub" && (
                    <GlowButton variant="ghost" onClick={goNext}>
                      Skip
                    </GlowButton>
                  )}
                  {step.kind === "sub" && (step.type === "multi" || step.type === "text") && (
                    <GlowButton
                      size="lg"
                      onClick={() =>
                        step.type === "text" ? handleTextContinue(step) : goNext()
                      }
                    >
                      {isLast ? "See summary" : "Continue"}
                      <ArrowRight className="w-4.5 h-4.5" />
                    </GlowButton>
                  )}
                  {step.kind === "main" && mainSelected && (
                    <GlowButton size="lg" onClick={goNext}>
                      {isLast ? "See summary" : "Continue"}
                      <ArrowRight className="w-4.5 h-4.5" />
                    </GlowButton>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireFlow;

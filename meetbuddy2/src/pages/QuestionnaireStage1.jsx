// src/pages/QuestionnaireStage1.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useQuestionnaire } from "@/context/QuestionnaireContext";
import Navbar from "@/components/Navbar";
import AmbientBackground from "@/components/AmbientBackground";
import GlowButton from "@/components/ui/GlowButton";

const questionnaireData = [
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

const QuestionnaireStage1 = () => {
  const { answers, updateAnswers } = useQuestionnaire();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 forward, -1 back
  const navigate = useNavigate();
  const currentQuestion = questionnaireData[currentIndex];

  const handleMainSelect = (key, label) => {
    updateAnswers({ [key]: label });
  };

  const handleNext = () => {
    setDirection(1);
    if (currentIndex < questionnaireData.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      navigate("/questionnaire-stage2");
    }
  };

  const handleBack = () => {
    setDirection(-1);
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const selectedOption = answers[currentQuestion.key];
  const canContinue = Boolean(selectedOption);

  const slideVariants = {
    enter: (dir) => ({ opacity: 0, x: dir * 60, filter: "blur(4px)" }),
    center: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
    },
    exit: (dir) => ({
      opacity: 0,
      x: dir * -60,
      filter: "blur(4px)",
      transition: { duration: 0.25, ease: "easeIn" },
    }),
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AmbientBackground intensity="app" />
      <Navbar />

      <div className="min-h-screen flex flex-col pt-28 pb-12 px-4">
        {/* Header: step label + segmented progress */}
        <div className="w-full max-w-2xl mx-auto mb-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">
              Stage 1 · <span className="text-brand-3">Set the vibe</span>
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {currentIndex + 1} / {questionnaireData.length}
            </p>
          </div>
          <div className="flex gap-2">
            {questionnaireData.map((q, i) => (
              <div key={q.key} className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
                  initial={false}
                  animate={{ width: i <= currentIndex ? "100%" : "0%" }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex items-start justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentQuestion.key}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-2xl"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-10 leading-tight">
                {currentQuestion.question}
              </h2>

              <div
                className={`grid gap-4 ${
                  currentQuestion.options.length === 4
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {currentQuestion.options.map((opt, i) => {
                  const selected = selectedOption === opt;
                  return (
                    <motion.button
                      key={opt}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * i, duration: 0.4 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleMainSelect(currentQuestion.key, opt)}
                      className={`relative flex items-center gap-4 w-full text-left p-5 rounded-2xl text-lg font-medium cursor-pointer transition-all duration-200 ${
                        selected
                          ? "glass-strong border-gradient text-white glow-sm"
                          : "glass text-foreground/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-2xl">{OPTION_EMOJI[opt] ?? "✨"}</span>
                      <span className="flex-1">{opt}</span>
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
                })}
              </div>

              {/* Nav buttons */}
              <div className="flex justify-between items-center gap-4 mt-10">
                <GlowButton
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentIndex === 0}
                  className={currentIndex === 0 ? "invisible" : ""}
                >
                  <ArrowLeft className="w-4.5 h-4.5" /> Back
                </GlowButton>

                <GlowButton onClick={handleNext} disabled={!canContinue} size="lg">
                  {currentIndex === questionnaireData.length - 1 ? "Next stage" : "Continue"}
                  <ArrowRight className="w-4.5 h-4.5" />
                </GlowButton>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireStage1;

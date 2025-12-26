// src/pages/QuestionnaireStage1.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuestionnaire } from "@/context/QuestionnaireContext";
import Navbar from "@/components/Navbar";
import Aurora from "@/components/Aurora";
import { Button } from "@/components/ui/button";

const questionnaireData = [
  {
    key: "mood",
    question: "What’s the vibe you’re going for this time?",
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

const QuestionnaireStage1 = () => {
  const { answers, updateAnswers } = useQuestionnaire();
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const currentQuestion = questionnaireData[currentIndex];

  // Calculate progress percentage
  const progress = ((currentIndex + 1) / questionnaireData.length) * 100;

  const handleMainSelect = (key, label) => {
    updateAnswers({ [key]: label });
  };

  const handleNext = () => {
    if (currentIndex < questionnaireData.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Move to stage 2 instead of summary
      navigate("/questionnaire-stage2");
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  // Validation: require main option selection
  const selectedOption = answers[currentQuestion.key];
  const canContinue = Boolean(selectedOption);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <Aurora colorStops={['#5227FF', '#bf4bfd', '#5227FF']} />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />

        {/* Question Number Label + Progress bar */}
        <div className="w-full flex flex-col items-center px-4 pt-12">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-medium text-gray-400 mb-4 text-center mt-4"
          >
            Question {currentIndex + 1} of {questionnaireData.length}
          </motion.div>

          <div className="w-full max-w-2xl h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, type: 'spring' }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="flex-1 flex items-center justify-center py-8 px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl"
            >
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-4">
                <div className="p-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-8">
                    {currentQuestion.question}
                  </h2>

                  <div className="space-y-4">
                    {currentQuestion.options.map((opt) => (
                      <motion.button
                        key={opt}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full text-left p-5 rounded-xl text-lg font-medium transition-all duration-200 ${
                          answers[currentQuestion.key] === opt
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-400/30 text-white'
                            : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                        }`}
                        onClick={() => handleMainSelect(currentQuestion.key, opt)}
                      >
                        {opt}
                      </motion.button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-10 pt-6 border-t border-white/10">
                    <Button
                      variant="outline"
                      disabled={currentIndex === 0}
                      onClick={handleBack}
                      className="w-full sm:w-auto flex items-center gap-2 text-blue-400 border-blue-400/30 hover:bg-white/5 px-6 py-3"
                    >
                      ← Back
                    </Button>

                    <Button
                      onClick={handleNext}
                      disabled={!canContinue}
                      className={`w-full sm:w-auto py-6 text-base ${
                        canContinue
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                          : 'bg-gray-700 cursor-not-allowed opacity-70'
                      } text-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg`}
                    >
                      {currentIndex === questionnaireData.length - 1
                        ? 'Proceed to Next Stage →'
                        : 'Continue →'}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireStage1;

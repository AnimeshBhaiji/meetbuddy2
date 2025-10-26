// src/pages/QuestionnaireStage1.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-100">
      <Navbar />

      {/* Question Number Label + Progress bar */}
      <div className="w-full flex flex-col items-center mt-6">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="text-lg font-medium text-gray-700 mb-2 text-center"
        >
          Question {currentIndex + 1} of {questionnaireData.length}
        </motion.div>

        <div className="w-11/12 md:w-2/3 h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-2 bg-gradient-to-r from-blue-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="flex justify-center items-center mt-12 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.key}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-2xl"
          >
            <Card className="rounded-2xl shadow-xl border-0 bg-white/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-center text-gray-800">
                  {currentQuestion.question}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                {currentQuestion.options.map((opt) => (
                  <Button
                    key={opt}
                    variant={answers[currentQuestion.key] === opt ? "default" : "outline"}
                    className="w-full text-lg py-6 font-medium transition-all duration-200 hover:scale-[1.02]"
                    onClick={() => handleMainSelect(currentQuestion.key, opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </CardContent>

              <div className="flex justify-between items-center p-6 pt-0">
                <Button
                  variant="ghost"
                  disabled={currentIndex === 0}
                  onClick={handleBack}
                  className="text-gray-600 hover:text-gray-800"
                >
                  ← Back
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={!canContinue}
                  className={`px-6 text-white ${
                    canContinue
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                      : "bg-gray-300 cursor-not-allowed opacity-60"
                  }`}
                >
                  {currentIndex === questionnaireData.length - 1
                    ? "Proceed to Next Stage →"
                    : "Continue →"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuestionnaireStage1;

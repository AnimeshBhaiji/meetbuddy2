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
    options: [
      {
        label: "Fun & Energetic",
        subOptions: [
          "Games / Events / Dance",
          "Indoor or outdoor vibe?",
          "Want music included?",
        ],
      },
      {
        label: "Chill & Relaxed",
        subOptions: [
          "Prefer nature or cozy café setup?",
          "Want a calm activity like art/reading?",
          "Add light food & drinks?",
        ],
      },
      {
        label: "Business-y",
        subOptions: [
          "Formal or casual meet?",
          "Meeting-friendly seating or private area?",
          "Light snacks or full meal?",
        ],
      },
      {
        label: "Romantic",
        subOptions: [
          "Candlelight or scenic spot?",
          "Want a surprise element (gift/music)?",
          "Indoor privacy or open view?",
        ],
      },
    ],
  },
  {
    key: "planningStyle",
    question: "How much effort do you want to put into planning?",
    options: [
      {
        label: "Surprise me",
        subOptions: [
          "Match previous favorites?",
          "Activity types to avoid?",
          "Share plan before the day?",
        ],
      },
      {
        label: "Semi-custom",
        subOptions: [
          "Pick location/activity?",
          "MeetBuddy shortlist 3–5 options?",
          "Confirm bookings yourself?",
        ],
      },
      {
        label: "Full control",
        subOptions: [
          "Access full venue list?",
          "Build own itinerary?",
          "Provide logistics help?",
        ],
      },
    ],
  },
  {
    key: "adventureLevel",
    question: "How far are you willing to go for this meetup?",
    options: [
      {
        label: "Stick to the city",
        subOptions: [
          "Central or outskirts?",
          "Walkable or drivable?",
          "Want parking assistance?",
        ],
      },
      {
        label: "Short drive to hidden gem",
        subOptions: [
          "Nature, heritage, or food-based?",
          "Duration limit?",
          "Need transport arranged?",
        ],
      },
      {
        label: "Weekend escape",
        subOptions: [
          "Solo, couple, or group trip?",
          "Want accommodation suggestions?",
          "Plan itinerary?",
        ],
      },
    ],
  },
  {
    key: "addOnMagic",
    question: "Want us to add some extra sparkle?",
    options: [
      {
        label: "Easy rides arranged",
        subOptions: [
          "Pickup-drop or full-day cab?",
          "Specific time schedule?",
          "Include return trip?",
        ],
      },
      {
        label: "Live music spots",
        subOptions: [
          "Acoustic, DJ, or band?",
          "Indoor or rooftop venue?",
          "Reserve a table?",
        ],
      },
      {
        label: "Surprise gift delivery / Insta-corners",
        subOptions: [
          "Personalized or generic gifts?",
          "Want photo props?",
          "Add on-spot photographer?",
        ],
      },
    ],
  },
  {
    key: "memorableFactor",
    question: "What makes a meetup unforgettable for you?",
    options: [
      {
        label: "A unique place",
        subOptions: [
          "Theme-based or hidden gem?",
          "Cozy or adventurous vibe?",
          "Want MeetBuddy suggestions?",
        ],
      },
      {
        label: "Amazing food",
        subOptions: [
          "Cuisine preference?",
          "Dietary restrictions?",
          "Chef-special experiences?",
        ],
      },
      {
        label: "Deep conversations / Capture moments",
        subOptions: [
          "Quiet or scenic setup?",
          "Memory add-on (photo/book)?",
          "Include post-meet follow-up?",
        ],
      },
    ],
  },
];

const QuestionnaireStage1 = () => {
  const { answers, updateAnswers } = useQuestionnaire();
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const currentQuestion = questionnaireData[currentIndex];

  // Calculate progress percentage
  const progress = ((currentIndex + 1) / questionnaireData.length) * 100;

  const handleMainSelect = (key, label, subOptions) => {
    updateAnswers({ [key]: label });

    // Reset previous sub-options
    const subKey = key + "_sub";
    const newSubState = {};
    subOptions.forEach((sub) => (newSubState[sub] = false));
    updateAnswers({ [subKey]: newSubState });
  };

  const handleSubSelect = (mainKey, subOption) => {
    const subKey = mainKey + "_sub";
    const subState = { ...(answers[subKey] || {}) };
    subState[subOption] = !subState[subOption];
    updateAnswers({ [subKey]: subState });
  };

  const handleNext = () => {
    if (currentIndex < questionnaireData.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      navigate("/questionnaire-summary");
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  // Validation: require main + sub selection
  const selectedOption = answers[currentQuestion.key];
  const selectedSubs = answers[currentQuestion.key + "_sub"];
  const hasValidSubs =
    selectedSubs && Object.values(selectedSubs).some((val) => val === true);
  const canContinue = selectedOption && hasValidSubs;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-100">
      <Navbar />

      {/* Question Number Label */}
      <div className="w-full flex flex-col items-center mt-6">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="text-lg font-medium text-gray-700 mb-2"
        >
          Question {currentIndex + 1} of {questionnaireData.length}
        </motion.div>

        {/* Progress bar */}
        <div className="w-11/12 md:w-2/3 h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-2 bg-gradient-to-r from-blue-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

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
                  <div key={opt.label}>
                    <Button
                      variant={
                        answers[currentQuestion.key] === opt.label
                          ? "default"
                          : "outline"
                      }
                      className="w-full text-lg py-6 font-medium transition-all duration-200 hover:scale-[1.02]"
                      onClick={() =>
                        handleMainSelect(
                          currentQuestion.key,
                          opt.label,
                          opt.subOptions
                        )
                      }
                    >
                      {opt.label}
                    </Button>

                    {/* Expand sub-options smoothly */}
                    <AnimatePresence>
                      {answers[currentQuestion.key] === opt.label && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-3 pl-4 border-l-2 border-blue-300"
                        >
                          <h4 className="text-sm text-gray-600 mb-2 italic">
                            Select all that apply:
                          </h4>
                          {opt.subOptions.map((sub) => (
                            <label
                              key={sub}
                              className="flex items-center space-x-2 mb-2"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  answers[currentQuestion.key + "_sub"]?.[sub] ||
                                  false
                                }
                                onChange={() =>
                                  handleSubSelect(currentQuestion.key, sub)
                                }
                                className="accent-blue-500 w-4 h-4"
                              />
                              <span className="text-gray-700">{sub}</span>
                            </label>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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
                    ? "Finish"
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

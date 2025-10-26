import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

// Sub-question mapping
const subQuestionMap = {
  mood: {
    "Fun & Energetic": ["Games / Events / Dance", "Indoor or outdoor vibe?", "Want music included?"],
    "Chill & Relaxed": ["Prefer nature or cozy café setup?", "Want a calm activity like art/reading?", "Add light food & drinks?"],
    "Business-y": ["Formal or casual meet?", "Meeting-friendly seating or private area?", "Light snacks or full meal?"],
    "Romantic": ["Candlelight or scenic spot?", "Want a surprise element (gift/music)?", "Indoor privacy or open view?"],
  },
  planningStyle: {
    "Surprise me": ["Match previous favorites?", "Activity types to avoid?", "Share plan before the day?"],
    "Semi-custom": ["Pick location/activity?", "MeetBuddy shortlist 3–5 options?", "Confirm bookings yourself?"],
    "Full control": ["Access full venue list?", "Build own itinerary?", "Provide logistics help?"],
  },
  adventureLevel: {
    "Stick to the city": ["Central or outskirts?", "Walkable or drivable?", "Want parking assistance?"],
    "Short drive to hidden gem": ["Nature, heritage, or food-based?", "Duration limit?", "Need transport arranged?"],
    "Weekend escape": ["Solo, couple, or group trip?", "Want accommodation suggestions?", "Plan itinerary?"],
  },
  addOnMagic: {
    "Easy rides arranged": ["Pickup-drop or full-day cab?", "Specific time schedule?", "Include return trip?"],
    "Live music spots": ["Acoustic, DJ, or band?", "Indoor or rooftop venue?", "Reserve a table?"],
    "Surprise gift delivery / Insta-corners": ["Personalized or generic gifts?", "Want photo props?", "Add on-spot photographer?"],
  },
  memorableFactor: {
    "A unique place": ["Theme-based or hidden gem?", "Cozy or adventurous vibe?", "Want MeetBuddy suggestions?"],
    "Amazing food": ["Cuisine preference?", "Dietary restrictions?", "Chef-special experiences?"],
    "Deep conversations / Capture moments": ["Quiet or scenic setup?", "Memory add-on (photo/book)?", "Include post-meet follow-up?"],
  },
};

const QuestionnaireStage2 = () => {
  const { answers, updateAnswers } = useQuestionnaire();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSubSelect = (mainKey, subOption) => {
    const subKey = mainKey + "_sub";
    const currentSubs = answers[subKey] || {};
    updateAnswers({
      [subKey]: { ...currentSubs, [subOption]: !currentSubs[subOption] },
    });
  };

  const selectedSubQuestions = Object.entries(answers)
    .filter(([key]) => Object.keys(subQuestionMap).includes(key))
    .map(([key, mainAnswer]) => ({
      key,
      mainAnswer,
      questionSet: subQuestionMap[key]?.[mainAnswer] || [],
    }));

  const totalSteps = selectedSubQuestions.length;
  const currentStep = currentIndex + 1;
  const currentCard = selectedSubQuestions[currentIndex];

  const handleNext = () => {
    if (currentIndex < selectedSubQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      navigate("/questionnaire-summary");
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  if (!currentCard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-600">
        <Navbar />
        <p className="mt-10 text-lg">No preferences found. Please complete Stage 1 first.</p>
      </div>
    );
  }

  // Disable Next until one checkbox is selected
  const subKey = currentCard.key + "_sub";
  const currentSubs = answers[subKey] || {};
  const canProceed = Object.values(currentSubs).some((val) => val === true);

  // Animation variants for smooth staggered checkboxes
  const checkboxContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.12 },
    },
  };

  const checkboxItem = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-blue-100">
      <Navbar />
      <div className="max-w-3xl mx-auto mt-10 p-6 space-y-6">
        {/* Progress bar */}
        <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3"
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="text-center text-sm text-gray-700 font-medium">
          Question {currentStep} of {totalSteps}
        </div>

        {/* Animated Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <Card className="shadow-xl rounded-2xl bg-white/80 backdrop-blur-md border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 text-center">
                  {currentCard.key.charAt(0).toUpperCase() + currentCard.key.slice(1)} – {currentCard.mainAnswer}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentCard.questionSet.length > 0 ? (
                  <motion.div
                    variants={checkboxContainer}
                    initial="hidden"
                    animate="show"
                    className="mt-4"
                  >
                    {currentCard.questionSet.map((sub) => (
                      <motion.label
                        key={sub}
                        variants={checkboxItem}
                        className="flex items-center space-x-2 mb-3 text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={answers[currentCard.key + "_sub"]?.[sub] || false}
                          onChange={() => handleSubSelect(currentCard.key, sub)}
                          className="accent-purple-600 w-4 h-4"
                        />
                        <span>{sub}</span>
                      </motion.label>
                    ))}
                  </motion.div>
                ) : (
                  <p className="text-sm italic text-gray-500">
                    No additional preferences for this selection.
                  </p>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    disabled={currentIndex === 0}
                    onClick={handleBack}
                    className="px-6 py-2 rounded-lg"
                  >
                    ← Back
                  </Button>
                  <Button
                    className={`px-6 py-2 rounded-lg text-white ${
                      canProceed
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                        : "bg-gray-300 cursor-not-allowed"
                    }`}
                    onClick={handleNext}
                    disabled={!canProceed}
                  >
                    {currentStep < totalSteps ? "Next →" : "Finish & See Summary →"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuestionnaireStage2;

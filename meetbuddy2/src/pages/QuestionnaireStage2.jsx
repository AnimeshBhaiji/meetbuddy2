// src/pages/QuestionnaireStage2.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const QuestionnaireStage2 = () => {
  const { answers, updateAnswers } = useQuestionnaire();
  const navigate = useNavigate();

  // ✅ Use updateAnswers from context, not setAnswers
  const handleSelect = (key, value) => {
    updateAnswers({ [key]: value });
  };

  const handleNext = () => {
    navigate("/questionnaire-summary");
  };

  return (
    <div>
      <Navbar />
      <div className="max-w-2xl mx-auto mt-10 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">MeetBuddy – Stage 2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Squad Size */}
            <div>
              <h3 className="font-semibold mb-2">Who’s coming along?</h3>
              {["Just us two", "Small group (3–6)", "Big crew (7+)"].map((opt) => (
                <Button
                  key={opt}
                  variant={answers.squadSize === opt ? "default" : "outline"}
                  className="block w-full mb-2"
                  onClick={() => handleSelect("squadSize", opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>

            {/* Timing Flex */}
            <div>
              <h3 className="font-semibold mb-2">When do you want this to happen?</h3>
              {[
                "Morning (Breakfast/Brunch)",
                "Afternoon (Lunch)",
                "Evening (Snacks/Tea/Coffee)",
                "Night (Dinner)",
                "Late Night Fun",
              ].map((opt) => (
                <Button
                  key={opt}
                  variant={answers.timingFlex === opt ? "default" : "outline"}
                  className="block w-full mb-2"
                  onClick={() => handleSelect("timingFlex", opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>

            {/* Experience Type */}
            <div>
              <h3 className="font-semibold mb-2">What kind of experience?</h3>
              {[
                "Rooftop / Scenic View",
                "Garden / Nature Café",
                "Lively with Music",
                "Quirky & Insta-worthy",
                "Cozy & Quiet",
              ].map((opt) => (
                <Button
                  key={opt}
                  variant={answers.experienceType === opt ? "default" : "outline"}
                  className="block w-full mb-2"
                  onClick={() => handleSelect("experienceType", opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>

            {/* Budget */}
            <div>
              <h3 className="font-semibold mb-2">What’s your sweet spot per person?</h3>
              {[
                "Budget (< ₹500)",
                "Moderate (₹500 – ₹1,500)",
                "Premium (₹1,500 – ₹3,000)",
                "Luxury (₹3,000+)",
              ].map((opt) => (
                <Button
                  key={opt}
                  variant={answers.budget === opt ? "default" : "outline"}
                  className="block w-full mb-2"
                  onClick={() => handleSelect("budget", opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>

            {/* Personal Touch */}
            <div>
              <h3 className="font-semibold mb-2">Want us to personalize your meetup?</h3>
              {[
                "Add a birthday/celebration surprise",
                "Romantic setup (flowers, candles)",
                "Fun add-on (games, karaoke, movie)",
                "Keep it simple",
              ].map((opt) => (
                <Button
                  key={opt}
                  variant={answers.personalTouch === opt ? "default" : "outline"}
                  className="block w-full mb-2"
                  onClick={() => handleSelect("personalTouch", opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>

            <Button className="w-full mt-4" onClick={handleNext}>
              Finish & See Summary
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuestionnaireStage2;

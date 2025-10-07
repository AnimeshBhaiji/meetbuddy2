// src/pages/QuestionnaireSummary.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const QuestionnaireSummary = () => {
  const { answers } = useQuestionnaire();
  const navigate = useNavigate();

  const handleSave = async () => {
    try {
      console.log("Saving preferences:", answers);
      alert("Preferences saved successfully! (Backend integration next)");
    } catch (error) {
      console.error("Error saving preferences:", error);
    }
  };

  // Group main answers and sub-options together
  const groupedAnswers = Object.entries(answers).reduce((acc, [key, value]) => {
    if (key.endsWith("_sub")) return acc; // skip sub-keys here
    const subKey = `${key}_sub`;
    acc[key] = {
      main: value,
      subs: answers[subKey]
        ? Object.entries(answers[subKey])
            .filter(([_, selected]) => selected)
            .map(([label]) => label)
        : [],
    };
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-purple-50 to-pink-50">
      <Navbar />
      <div className="max-w-4xl mx-auto mt-10 px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="shadow-xl rounded-3xl border-0 bg-white/70 backdrop-blur-md">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Your MeetBuddy Preferences ✨
              </CardTitle>
              <p className="text-gray-600 mt-2">
                Here’s a summary of your selected preferences. You can save, modify, or move on to plan your meetup!
              </p>
            </CardHeader>

            <CardContent className="space-y-6 mt-4">
              {Object.keys(groupedAnswers).length === 0 ? (
                <p className="text-center text-gray-500">No preferences selected yet.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedAnswers).map(([key, data], index) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-gradient-to-r from-blue-100 to-purple-100 p-5 rounded-2xl shadow-md hover:shadow-lg transition-shadow"
                    >
                      <h3 className="text-xl font-semibold text-gray-800 mb-2 capitalize">
                        {key.replace(/([A-Z])/g, " $1")}
                      </h3>
                      <p className="text-gray-700 font-medium mb-3">
                        {data.main || "No main choice selected"}
                      </p>

                      {data.subs && data.subs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {data.subs.map((sub) => (
                            <span
                              key={sub}
                              className="bg-white text-gray-700 px-3 py-1 rounded-full border border-gray-200 shadow-sm text-sm font-medium hover:bg-blue-50 transition-colors"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10 flex-wrap">
                <Button
                  onClick={handleSave}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 px-6 py-3 rounded-xl shadow-lg transition-all"
                >
                  💾 Save Preferences
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => navigate("/questionnaire-stage1")}
                  className="bg-yellow-400 text-white hover:bg-yellow-500 px-6 py-3 rounded-xl shadow-lg transition-all"
                >
                  ✏️ Modify Preferences
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="border-2 border-blue-400 text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-xl transition-all"
                >
                  🚀 Plan My Meetup
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default QuestionnaireSummary;

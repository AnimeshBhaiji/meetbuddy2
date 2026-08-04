// src/context/QuestionnaireContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import { api } from "@/lib/api";

// Create the context
const QuestionnaireContext = createContext();

// Provider component
export const QuestionnaireProvider = ({ children }) => {
  const [answers, setAnswers] = useState({});

  // ✅ Load saved preferences from localStorage on mount
  useEffect(() => {
    const storedAnswers = localStorage.getItem("userPreferences");
    if (storedAnswers) {
      try {
        setAnswers(JSON.parse(storedAnswers));
      } catch (err) {
        console.error("Failed to parse stored preferences:", err);
      }
    }
  }, []);

  // ✅ Save to localStorage whenever answers change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem("userPreferences", JSON.stringify(answers));
    }
  }, [answers]);

  // Update answers when user selects new options
  const updateAnswers = async (newAnswers) => {
    const updatedAnswers = { ...answers, ...newAnswers };
    setAnswers(updatedAnswers);

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.user_id || user.id;

      if (user && userId) {
        // Flat payload: { mood, ..., mood_sub, ... } — the account comes
        // from the bearer token, not from anything we send.
        await api.post("/save_preferences", updatedAnswers);
        console.log("Preferences saved to backend successfully");
      }
    } catch (error) {
      console.error("Failed to save preferences to backend:", error);
      // Still keep the local changes even if backend save fails
    }
  };

  // Reset answers (and clear localStorage)
  const resetAnswers = () => {
    setAnswers({});
    localStorage.removeItem("userPreferences");
  };

  return (
    <QuestionnaireContext.Provider value={{ answers, updateAnswers, resetAnswers }}>
      {children}
    </QuestionnaireContext.Provider>
  );
};

// Hook to use context
export const useQuestionnaire = () => {
  const context = useContext(QuestionnaireContext);
  if (!context) {
    throw new Error("useQuestionnaire must be used within a QuestionnaireProvider");
  }
  return context;
};

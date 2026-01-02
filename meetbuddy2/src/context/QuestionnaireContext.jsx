// src/context/QuestionnaireContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";
import { getApiUrl, DEFAULT_HEADERS } from "@/config";

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
      if (user && user.id) {
        await axios.post(
          getApiUrl('/update-preferences'),
          { 
            user_id: user.id,
            preferences: updatedAnswers 
          },
          { 
            headers: {
              ...DEFAULT_HEADERS,
              'Content-Type': 'application/json'
            } 
          }
        );
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

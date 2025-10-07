// src/context/QuestionnaireContext.jsx
import React, { createContext, useState, useContext } from "react";

// Create the context
const QuestionnaireContext = createContext();

// Provider component
export const QuestionnaireProvider = ({ children }) => {
  const [answers, setAnswers] = useState({});

  const updateAnswers = (newAnswers) => {
    setAnswers((prev) => ({ ...prev, ...newAnswers }));
  };

  const resetAnswers = () => {
    setAnswers({});
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

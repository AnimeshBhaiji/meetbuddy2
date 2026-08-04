// src/context/QuestionnaireContext.jsx
//
// The account's saved answers are the source of truth. localStorage is a cache
// of them, so the planner and the questionnaire can read synchronously — it is
// refilled from the server on sign-in rather than being the only copy. Before
// this, signing in cleared the cache and nothing ever read the server's copy,
// so a returning user was asked to retake the questionnaire.
import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { AuthContext } from "@/context/AuthContext";

// Cached locally but never sent to /save_preferences, which stores only the
// questionnaire answers.
const LOCAL_ONLY_KEYS = ["location", "coords"];

const questionnaireOnly = (answers) => {
  const out = { ...answers };
  for (const k of LOCAL_ONLY_KEYS) delete out[k];
  return out;
};

const QuestionnaireContext = createContext();

export const QuestionnaireProvider = ({ children }) => {
  const [answers, setAnswers] = useState({});
  const auth = useContext(AuthContext);
  const hydratedFor = useRef(null);

  // Load the cache on mount so the first render has something to show
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

  // Pull the saved answers for whoever is signed in. Runs on sign-in and on a
  // fresh load, so preferences follow the account to another browser.
  const userId = auth?.user?.user_id ?? auth?.user?.id ?? null;
  useEffect(() => {
    if (!userId || !localStorage.getItem("token")) return;
    if (hydratedFor.current === userId) return;   // once per account per session
    hydratedFor.current = userId;

    // No cancel-on-cleanup flag here: under StrictMode the cleanup runs between
    // the two development mounts without the component actually unmounting, so
    // discarding the response would throw away the only fetch the guard allows.
    (async () => {
      try {
        const { prefs } = await api.get("/user_prefs/me");
        if (!prefs) return;
        // Keep location/coords, which live only in the cache.
        setAnswers((cur) => {
          const local = {};
          for (const k of LOCAL_ONLY_KEYS) if (cur[k] !== undefined) local[k] = cur[k];
          return { ...questionnaireOnly(prefs), ...local };
        });
      } catch (err) {
        hydratedFor.current = null;   // let a later render retry
        // 404 just means this account has not answered yet — keep whatever is
        // in progress locally. Anything else is already surfaced by api.js.
        if (!(err instanceof ApiError) || err.status !== 404) {
          console.error("Could not load saved preferences:", err);
        }
      }
    })();
  }, [userId]);

  // Mirror to localStorage so synchronous readers stay in step
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem("userPreferences", JSON.stringify(answers));
    }
  }, [answers]);

  const updateAnswers = async (newAnswers) => {
    const updatedAnswers = { ...answers, ...newAnswers };
    setAnswers(updatedAnswers);

    if (!localStorage.getItem("token")) return;   // not signed in yet
    try {
      // The account comes from the bearer token, not from anything we send.
      await api.post("/save_preferences", questionnaireOnly(updatedAnswers));
    } catch (error) {
      console.error("Failed to save preferences to backend:", error);
      // Keep the local change; the next successful save reconciles it.
    }
  };

  const resetAnswers = () => {
    setAnswers({});
    hydratedFor.current = null;   // allow the next sign-in to hydrate again
    localStorage.removeItem("userPreferences");
  };

  return (
    <QuestionnaireContext.Provider value={{ answers, updateAnswers, resetAnswers }}>
      {children}
    </QuestionnaireContext.Provider>
  );
};

export const useQuestionnaire = () => {
  const context = useContext(QuestionnaireContext);
  if (!context) {
    throw new Error("useQuestionnaire must be used within a QuestionnaireProvider");
  }
  return context;
};

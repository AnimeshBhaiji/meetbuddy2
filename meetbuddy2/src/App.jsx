// src/App.jsx
import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";
import LandingPage from "./pages/LandingPage";
import AboutUs from "./pages/AboutUs";
import Planner from "./pages/Planner";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import QuestionnaireStage1 from "./pages/QuestionnaireStage1";
import QuestionnaireStage2 from "./pages/QuestionnaireStage2";
import QuestionnaireSummary from "./pages/QuestionnaireSummary";
import CalendarPage from "./pages/CalendarPage";
import HomePage from "./pages/HomePage";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";

const wrap = (el) => <PageTransition>{el}</PageTransition>;

function App() {
  const location = useLocation();
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen">
        <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={wrap(<LandingPage />)} />
          <Route path="/about" element={wrap(<AboutUs />)} />
          <Route
            path="/planner/*"
            element={wrap(
              <ProtectedRoute>
                <Planner />
              </ProtectedRoute>
            )}
          />
          <Route path="/login" element={wrap(<Login />)} />
          <Route path="/signup" element={wrap(<Signup />)} />
          <Route path="/profile" element={wrap(<Profile />)} />
          <Route path="/questionnaire-stage1" element={wrap(<QuestionnaireStage1 />)} />
          <Route path="/questionnaire-stage2" element={wrap(<QuestionnaireStage2 />)} />
          <Route path="/questionnaire-summary" element={wrap(<QuestionnaireSummary />)} />
          <Route
            path="/calendar"
            element={wrap(
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/home"
            element={wrap(
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            )}
          />
          </Routes>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

export default App;

// src/App.jsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";
import Navbar from "./components/Navbar";
import AmbientBackground from "./components/AmbientBackground";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Planner = lazy(() => import("./pages/Planner"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Profile = lazy(() => import("./pages/Profile"));
const QuestionnaireStage1 = lazy(() => import("./pages/QuestionnaireStage1"));
const QuestionnaireStage2 = lazy(() => import("./pages/QuestionnaireStage2"));
const QuestionnaireSummary = lazy(() => import("./pages/QuestionnaireSummary"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MyItineraries = lazy(() => import("./pages/MyItineraries"));

const wrap = (el) => <PageTransition>{el}</PageTransition>;

// Brighter backdrop on marketing/auth pages, dimmer on functional ones
const HERO_ROUTES = new Set(["/", "/about", "/login", "/signup", "/questionnaire-summary"]);

function App() {
  const location = useLocation();
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen">
        {/* Persistent chrome — mounted once, survives route changes */}
        <AmbientBackground intensity={HERO_ROUTES.has(location.pathname) ? "hero" : "app"} />
        <Navbar />
        <Suspense fallback={null}>
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
            <Route
              path="/itineraries"
              element={wrap(
                <ProtectedRoute>
                  <MyItineraries />
                </ProtectedRoute>
              )}
            />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
    </MotionConfig>
  );
}

export default App;

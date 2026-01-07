// src/App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import RestaurantList from "./pages/RestaurantList";
import LandingPage from './pages/LandingPage';
import AboutUs from "./pages/AboutUs";
import Planner from "./pages/Planner";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import { AuthProvider } from "./context/AuthContext";
import QuestionnaireStage1 from "./pages/QuestionnaireStage1";
import QuestionnaireStage2 from "./pages/QuestionnaireStage2";
import QuestionnaireSummary from "./pages/QuestionnaireSummary";
import CalendarPage from "./pages/CalendarPage";
import HomePage from "./pages/HomePage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/restaurant" element={<RestaurantList />} />
        <Route path="/about" element={<AboutUs />} />
        <Route
          path="/planner"
          element={
            <ProtectedRoute>
              <Planner />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/questionnaire-stage1" element={<QuestionnaireStage1 />} />
        <Route path="/questionnaire-stage2" element={<QuestionnaireStage2 />} />
        <Route path="/questionnaire-summary" element={<QuestionnaireSummary />} />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
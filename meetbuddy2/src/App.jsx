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


function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/restaurant" element={<RestaurantList />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </div>
  );
}

export default App;
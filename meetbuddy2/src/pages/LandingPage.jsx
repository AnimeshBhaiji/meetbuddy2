import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/Navbar";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <Navbar />
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center text-center mt-32 px-4">
        <h1 className="text-5xl font-bold text-gray-800 mb-6">
          Welcome to <span className="text-blue-600">MeetBuddy</span>
        </h1>
        <p className="text-gray-600 text-lg max-w-xl">
          Your ultimate planner for seamless meetups, curated restaurant discovery,
          personalized planning, and smooth bookings — all in one place.
        </p>
      </div>
    </div>
  );
};

export default LandingPage;

import React from "react";
import Navbar from "../components/Navbar"; // adjust path if needed

const AboutUs = () => {
  return (
    <div>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-6 text-gray-800">
          About MeetBuddy
        </h1>

        <p className="text-lg text-gray-600 text-center max-w-3xl mx-auto mb-10">
          MeetBuddy is your ultimate meeting planner — simplifying the way you discover venues,
          customize meetups, and coordinate with friends, teams, or clients effortlessly.
          Whether you're planning a brunch, a remote work meetup, or a team hangout,
          MeetBuddy curates the best spots tailored to your needs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2 text-blue-600">What We Do</h2>
            <p className="text-gray-600">
              We streamline the chaos of planning by providing personalized venue recommendations,
              availability tracking, and integration with booking services — all in one platform.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2 text-green-600">Our Mission</h2>
            <p className="text-gray-600">
              To make planning get-togethers and professional meetings as seamless and fun
              as the events themselves — one curated suggestion at a time.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2 text-purple-600">Why MeetBuddy</h2>
            <p className="text-gray-600">
              We go beyond generic maps or listings — by factoring in preferences, reviews,
              price, and vibe, we bring you smarter choices that actually work for your context.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Built With ❤️</h2>
          <p className="text-gray-600 max-w-xl mx-auto">
            MeetBuddy is created by a passionate team of developers and designers who understand
            how painful planning can be. We’re building tech to solve real-world coordination
            chaos — so you can just show up and enjoy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;

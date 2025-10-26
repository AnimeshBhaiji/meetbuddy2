// src/pages/Planner.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar"; // ✅ Add this import (adjust the path if needed)

export default function Planner() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [userPrefs, setUserPrefs] = useState(null);
  const [user, setUser] = useState(null);

  // ✅ Load user & preferences from localStorage
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    const storedPrefs = JSON.parse(localStorage.getItem("userPreferences"));
    setUser(storedUser);
    setUserPrefs(storedPrefs);
  }, []);

  // ✅ Fetch recommendations based on user preferences
  const getRecommendations = async () => {
    if (!user) {
      alert("User not logged in!");
      return;
    }

    if (!userPrefs) {
      alert("No preferences found. Please save them first!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // --- Build descriptive query based on preferences ---
      const queryParts = [
        userPrefs.mood,
        userPrefs.planningStyle,
        userPrefs.adventureLevel,
        userPrefs.addOnMagic,
        userPrefs.memorableFactor,
      ].filter(Boolean);

      const searchQuery =
        queryParts.join(", ") + " cafes and restaurants near me";

      const payload = {
        user_id: user.user_id,
        preferences: userPrefs,
        query: searchQuery,
      };

      console.log("📤 Sending planner payload:", payload);

      // --- Call backend planner endpoint ---
      const res = await axios.post("http://localhost:8000/planner", payload, {
        headers: { "Content-Type": "application/json" },
      });

      console.log("📥 Backend response:", res.data);
      setRecommendations(res.data.recommendations || []);
      setQuery(res.data.query || searchQuery);
    } catch (err) {
      console.error("❌ Error fetching recommendations:", err);
      setError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ✅ Add Navbar at the top */}
      <Navbar />

      <div className="p-6 flex flex-col items-center min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold mb-4">Your Personalized Planner ✨</h1>

        {/* ✅ Show saved preferences */}
        {userPrefs ? (
          <div className="bg-white shadow-md rounded-xl p-4 mb-6 max-w-xl w-full text-gray-700">
            <h2 className="text-lg font-semibold mb-2">💡 Your Preferences</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <strong>Mood:</strong> {userPrefs.mood || "—"}
              </li>
              <li>
                <strong>Planning Style:</strong> {userPrefs.planningStyle || "—"}
              </li>
              <li>
                <strong>Adventure Level:</strong> {userPrefs.adventureLevel || "—"}
              </li>
              <li>
                <strong>Add-On Magic:</strong> {userPrefs.addOnMagic || "—"}
              </li>
              <li>
                <strong>Memorable Factor:</strong> {userPrefs.memorableFactor || "—"}
              </li>
            </ul>
          </div>
        ) : (
          <p className="text-gray-500 mb-4">
            No preferences found. Please save them from the questionnaire first.
          </p>
        )}

        <button
          onClick={getRecommendations}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg mb-6"
        >
          Get My Recommendations
        </button>

        {loading && <p className="text-gray-500">Fetching recommendations...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && query && (
          <p className="text-gray-700 mb-4 text-center">
            🔍 <strong>Search query used:</strong> {query}
          </p>
        )}

        {/* ✅ Recommendations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
          {recommendations.length > 0 ? (
            recommendations.map((item, index) => (
              <div
                key={index}
                className="bg-white shadow-md rounded-2xl p-4 border border-gray-100"
              >
                <h2 className="font-semibold text-lg text-gray-800">
                  {item.title || "Unnamed Place"}
                </h2>
                {item.address && (
                  <p className="text-gray-600 text-sm mt-1">{item.address}</p>
                )}
                {item.rating && (
                  <p className="text-yellow-500 mt-1">⭐ {item.rating}</p>
                )}
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline mt-2 inline-block"
                  >
                    View on Google
                  </a>
                )}
              </div>
            ))
          ) : (
            !loading &&
            !error && (
              <p className="text-gray-500 mt-4">
                No recommendations yet. Click “Get My Recommendations” above.
              </p>
            )
          )}
        </div>
      </div>
    </>
  );
}

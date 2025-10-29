// src/pages/Planner.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";

export default function Planner() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [userPrefs, setUserPrefs] = useState(null);
  const [user, setUser] = useState(null);
  const [maxTerms, setMaxTerms] = useState(3); // number of tokens to use in the query
  const [selectedForQuery, setSelectedForQuery] = useState([]);

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "null");
      const storedPrefs = JSON.parse(localStorage.getItem("userPreferences") || "null");
      setUser(storedUser);
      setUserPrefs(storedPrefs);
    } catch (e) {
      console.warn("Failed parsing stored user/prefs:", e);
    }
  }, []);

  // Normalize a stored pref into an array of labels (defensive)
  const normalizePrefForSend = (val) => {
    if (val === null || val === undefined) return [];
    // Already an array -> keep as-is but stringify items
    if (Array.isArray(val)) return val.map((x) => (x === null || x === undefined ? "" : String(x))).filter(Boolean);
    // If it's a primitive (string/number) -> single-element array
    if (typeof val === "string" || typeof val === "number") {
      const s = String(val).trim();
      return s === "" ? [] : [s];
    }
    // If it's an object, try to detect common shapes:
    if (typeof val === "object") {
      const keys = Object.keys(val);
      if (keys.length === 0) return [];
      // Case: object-of-boolean flags -> return selected keys
      const booleanFlags = keys.filter((k) => val[k] === true || val[k] === "true" || val[k] === 1);
      if (booleanFlags.length > 0) return booleanFlags.map((k) => String(k));
      // Case: object with string values -> prefer those values
      const stringValues = keys
        .map((k) => (typeof val[k] === "string" && val[k].trim() ? val[k].trim() : null))
        .filter(Boolean);
      if (stringValues.length > 0) return stringValues;
      // Fallback: return keys
      return keys.map((k) => String(k));
    }
    // fallback
    return [];
  };

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
      // Build preferences payload expected by backend
      const payload = {
        user_id: user.user_id,
        preferences: {
          mood: normalizePrefForSend(userPrefs?.mood),
          planningStyle: normalizePrefForSend(userPrefs?.planningStyle),
          adventureLevel: normalizePrefForSend(userPrefs?.adventureLevel),
          addOnMagic: normalizePrefForSend(userPrefs?.addOnMagic),
          memorableFactor: normalizePrefForSend(userPrefs?.memorableFactor),
        },
        max_terms: maxTerms,
      };

      // Debug: show exactly what will be sent
      console.log("📤 Planner payload (normalized arrays):", payload);

      const res = await axios.post("http://localhost:8000/planner", payload, {
        headers: { "Content-Type": "application/json" },
      });

      console.log("📥 Backend response:", res.data);

      // update UI
      setRecommendations(res.data.recommendations || []);
      setQuery(res.data.query || "");
      setSearchUrl(res.data.search_url || "");
      setSelectedForQuery(res.data.selected_for_query || []);
    } catch (err) {
      console.error("❌ Error fetching recommendations:", err);
      setError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const openSearch = () => {
    const url =
      searchUrl ||
      "https://www.google.com/search?q=" +
        encodeURIComponent((query && query.trim()) || "");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Helper to render preferences nicely for display (handles arrays or strings)
  const displayPref = (val) => {
    if (!val) return "—";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  return (
    <>
      <Navbar />

      <div className="p-6 flex flex-col items-center min-h-screen bg-gray-50">
        <h1 className="text-2xl font-bold mb-4">Your Personalized Planner ✨</h1>

        {userPrefs ? (
          <div className="bg-white shadow-md rounded-xl p-4 mb-6 max-w-xl w-full text-gray-700">
            <h2 className="text-lg font-semibold mb-2">💡 Your Preferences</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <strong>Mood:</strong> {displayPref(userPrefs.mood)}
              </li>
              <li>
                <strong>Planning Style:</strong> {displayPref(userPrefs.planningStyle)}
              </li>
              <li>
                <strong>Adventure Level:</strong> {displayPref(userPrefs.adventureLevel)}
              </li>
              <li>
                <strong>Add-On Magic:</strong> {displayPref(userPrefs.addOnMagic)}
              </li>
              <li>
                <strong>Memorable Factor:</strong> {displayPref(userPrefs.memorableFactor)}
              </li>
            </ul>
          </div>
        ) : (
          <p className="text-gray-500 mb-4">
            No preferences found. Please save them from the questionnaire first.
          </p>
        )}

        <div className="flex gap-3 mb-6 items-center">
          <button
            onClick={getRecommendations}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            disabled={loading}
          >
            {loading ? "Generating..." : "Get My Recommendations"}
          </button>

          <button
            onClick={openSearch}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            disabled={!query && !searchUrl}
          >
            🔎 Open Google Search
          </button>

          <div className="ml-4">
            <label className="text-sm mr-2">Query tokens:</label>
            <select
              value={maxTerms}
              onChange={(e) => setMaxTerms(Number(e.target.value))}
              className="border px-2 py-1 rounded"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
        </div>

        {selectedForQuery && selectedForQuery.length > 0 && (
          <div className="mb-4 max-w-xl w-full text-left bg-white p-3 rounded shadow-sm">
            <strong className="block mb-2">Selected tokens for search:</strong>
            <ul className="text-sm space-y-1">
              {selectedForQuery.map((t, i) => (
                <li key={i}>
                  <strong>{t.category}:</strong> {t.label} → <em>{t.phrase}</em>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading && <p className="text-gray-500">Fetching recommendations...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && query && (
          <p className="text-gray-700 mb-4 text-center">
            🔍 <strong>Search query used:</strong> {query}
            {searchUrl && <span className="ml-2 text-sm text-blue-600"> (Openable)</span>}
          </p>
        )}

        {/* Recommendations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
          {recommendations.length > 0 ? (
            recommendations.map((item, index) => (
              <div key={index} className="bg-white shadow-md rounded-2xl p-4 border border-gray-100">
                <h2 className="font-semibold text-lg text-gray-800">{item.title || "Unnamed Place"}</h2>
                {item.address && <p className="text-gray-600 text-sm mt-1">{item.address}</p>}
                {item.rating && <p className="text-yellow-500 mt-1">⭐ {item.rating}</p>}
                {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-2 inline-block">View on Google</a>}
              </div>
            ))
          ) : (
            !loading && !error && <p className="text-gray-500 mt-4">No recommendations yet. Click “Get My Recommendations” above.</p>
          )}
        </div>
      </div>
    </>
  );
}

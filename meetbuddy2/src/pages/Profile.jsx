// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useQuestionnaire } from "../context/QuestionnaireContext";
import { FaEnvelope, FaPhone, FaUser } from "react-icons/fa";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      navigate("/login");
    } else {
      const parsedUser = JSON.parse(storedUser);
      fetch(`http://localhost:8000/user/${parsedUser.user_id}`)
        .then((res) => res.json())
        .then((data) => {
          setUser(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching user:", err);
          setLoading(false);
        });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    resetAnswers();
    navigate("/login");
  };

  const handlePreferences = () => {
    navigate("/questionnaire-summary");
  };

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <Navbar />
      <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow-xl rounded-3xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center text-4xl font-bold text-blue-600 mb-4">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800">
            {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-gray-500 mt-1">@{user?.username}</p>
        </div>

        {/* Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="flex items-center p-4 bg-blue-50 rounded-xl shadow-sm">
            <FaEnvelope className="text-blue-500 text-2xl mr-4" />
            <div>
              <p className="text-gray-500 text-sm">Email</p>
              <p className="text-gray-800 font-medium">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-green-50 rounded-xl shadow-sm">
            <FaPhone className="text-green-500 text-2xl mr-4" />
            <div>
              <p className="text-gray-500 text-sm">Contact</p>
              <p className="text-gray-800 font-medium">{user?.contact || "Not Provided"}</p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-yellow-50 rounded-xl shadow-sm">
            <FaUser className="text-yellow-500 text-2xl mr-4" />
            <div>
              <p className="text-gray-500 text-sm">Username</p>
              <p className="text-gray-800 font-medium">{user?.username}</p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-purple-50 rounded-xl shadow-sm">
            <p className="text-gray-500 text-sm">Full Name</p>
            <p className="text-gray-800 font-medium ml-4">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-6">
          <button
            onClick={handlePreferences}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-md transition-all duration-200"
          >
            Personal Preferences
          </button>

          <button
            onClick={handleLogout}
            className="w-full sm:w-auto px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow-md transition-all duration-200"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;

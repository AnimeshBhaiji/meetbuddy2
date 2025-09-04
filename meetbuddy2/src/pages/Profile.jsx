// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // prevents flicker
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      navigate("/login"); // redirect if not logged in
    } else {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");1
  };

  if (loading) {
    return null; // or add a spinner if you want
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-lg mx-auto mt-10 p-6 bg-white shadow rounded-2xl">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        
        <p className="mb-2">
          <strong>Full Name:</strong> {user?.firstName} {user?.lastName}
        </p>
        <p className="mb-2">
          <strong>Email:</strong> {user?.email}
        </p>
        <p className="mb-2">
          <strong>Contact:</strong> {user?.contact}
        </p>

        <button
          onClick={handleLogout}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;

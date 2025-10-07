// src/pages/Login.jsx
import React, { useState } from "react";
import Navbar from "../components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useQuestionnaire } from "../context/QuestionnaireContext"; // ✅ import context

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire(); // ✅ destructure resetAnswers

  const handleLogin = async () => {
    setError("");
    try {
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Login failed");
        return;
      }

      // ✅ Reset previous questionnaire answers on login
      resetAnswers();

      // ✅ Save the complete backend response in localStorage
      localStorage.setItem("user", JSON.stringify(data));

      console.log("✅ Logged in user data:", data);

      // ✅ Redirect user to Stage 1 questionnaire
      navigate("/questionnaire-stage1");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-col justify-center items-center mt-16 px-4">
        <Card className="w-full max-w-md shadow-lg border rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Login to MeetBuddy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username or Email</label>
              <Input
                type="text"
                placeholder="Enter your email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button className="w-full mt-2" onClick={handleLogin}>
              Login
            </Button>

            <div className="relative text-center my-4">
              <span className="text-sm text-muted-foreground">or</span>
            </div>

            <Button variant="outline" className="w-full">
              Login with Google
            </Button>
            <Button variant="outline" className="w-full">
              Login with Phone Number
            </Button>
          </CardContent>
        </Card>

        <p className="mt-4 text-sm text-gray-600 text-center">
          Don’t have an account?{" "}
          <Link to="/signup" className="text-blue-600 hover:underline font-medium">
            Click here to signup
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

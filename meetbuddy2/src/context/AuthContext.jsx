import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Lazily initialize user from localStorage to prevent flicker/redirect
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    // Optional: Validate token validity with backend here if needed
  }, []);

  const login = (userData, token) => {
    // Clear any old preferences from previous sessions
    localStorage.removeItem("userPreferences");
    localStorage.removeItem("questionnaireAnswers");
    localStorage.removeItem("planner_session_id"); // Clear old planner sessions too

    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("userPreferences");
    localStorage.removeItem("questionnaireAnswers");
    localStorage.removeItem("planner_session_id");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react"; // profile icon

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // check login status from localStorage
  useEffect(() => {
    const token = localStorage.getItem("token"); // or "user"
    if (token) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, [location]); // re-check on route change

  const isActive = (path) => currentPath === path;

  const navItemStyle = (path) =>
    `text-sm px-4 py-2 rounded-md ${
      isActive(path)
        ? "bg-blue-100 text-blue-700 font-semibold"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  const handleProfileClick = () => {
    navigate("/profile");
  };

  return (
    <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-md">
      {/* Left side menu */}
      <div className="flex gap-4">
        <Link to="/">
          <Button variant="ghost" className={navItemStyle("/")}>
            Home
          </Button>
        </Link>
        <Link to="/restaurant">
          <Button variant="ghost" className={navItemStyle("/restaurant")}>
            Restaurant
          </Button>
        </Link>
        <Link to="/planner">
          <Button variant="ghost" className={navItemStyle("/planner")}>
            Planner
          </Button>
        </Link>
        <Link to="/about">
          <Button variant="ghost" className={navItemStyle("/about")}>
            About Us
          </Button>
        </Link>
      </div>

      {/* Right side login/signup or profile */}
      <div>
        {isLoggedIn ? (
          <button
            onClick={handleProfileClick}
            className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100"
          >
            <User className="w-6 h-6 text-gray-700" />
          </button>
        ) : (
          <Link to="/login">
            <Button variant="outline" className="rounded-xl px-4">
              Login / Signup
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

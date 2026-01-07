import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Calendar as CalendarIcon } from "lucide-react"; // profile icon

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // check login status from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, [location]); // re-check on route change

  const isActive = (path) => currentPath === path;

  const navItemStyle = (path) =>
    `text-sm px-4 py-2 rounded-xl transition-all duration-200 ${isActive(path)
      ? "bg-blue-100/80 text-blue-700 font-semibold shadow-sm"
      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
    }`;

  const handleProfileClick = () => {
    navigate("/profile");
  };

  return (
    <nav className="flex justify-between items-center px-6 py-4 bg-white/60 backdrop-blur-md border border-white/40 shadow-sm shadow-black/5 transition-all duration-300 mx-4 md:mx-8 lg:mx-16 rounded-2xl mt-4">
      {/* Left side menu */}
      <div className="flex gap-4">
        <Link to={isLoggedIn ? "/home" : "/"}>
          <Button variant="ghost" className={navItemStyle(isLoggedIn ? "/home" : "/")}>
            {isLoggedIn ? "Dashboard" : "Home"}
          </Button>
        </Link>
        <Link to="/planner">
          <Button variant="ghost" className={navItemStyle("/planner")}>
            Planner
          </Button>
        </Link>
        <Link to="/calendar">
          <Button variant="ghost" className={navItemStyle("/calendar")}>
            <CalendarIcon className="w-4 h-4 mr-2" />
            Calendar
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
            className="flex items-center gap-2 p-2 rounded-full bg-white/70 hover:bg-white/90 border border-white/70 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md"
          >
            <User className="w-6 h-6 text-gray-700" />
          </button>
        ) : (
          <Link to="/login">
            <Button
              variant="outline"
              className="rounded-xl px-4 bg-white/70 border-white/70 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-[1px]"
            >
              Login / Signup
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default React.memo(Navbar);

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path) => currentPath === path;

  const navItemStyle = (path) =>
    `text-sm px-4 py-2 rounded-md ${
      isActive(path)
        ? "bg-blue-100 text-blue-700 font-semibold"
        : "text-gray-700 hover:bg-gray-100"
    }`;

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

      {/* Right side login/signup */}
      <div>
        <Link to="/login">
          <Button variant="outline" className="rounded-xl px-4">
            Login / Signup
          </Button>
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;

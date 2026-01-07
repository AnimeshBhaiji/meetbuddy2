import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Calendar as CalendarIcon, Menu, X, LogOut, Home, Map, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Check login status and handle scroll
  useEffect(() => {
    const checkUser = () => {
      const storedUser = localStorage.getItem("user");
      setIsLoggedIn(!!storedUser);
    };

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    checkUser();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("storage", checkUser); // Listen for auth changes

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("storage", checkUser);
    };
  }, [location]);

  const isActive = (path) => currentPath === path;

  const navLinks = [
    { path: isLoggedIn ? "/home" : "/", label: isLoggedIn ? "Dashboard" : "Home", icon: Home },
    ...(isLoggedIn ? [
      { path: "/planner", label: "Planner", icon: Map },
      { path: "/calendar", label: "Calendar", icon: CalendarIcon }
    ] : []),
    { path: "/about", label: "About Us", icon: Info },
  ];

  const handleProfileClick = () => {
    navigate("/profile");
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 transition-all duration-300 pointer-events-none",
          scrolled ? "pt-4" : "pt-6"
        )}
      >
        <div className={cn(
          "flex items-center justify-between pointer-events-auto",
          "bg-white/5 backdrop-blur-xl border border-white/10",
          "rounded-full px-6 py-3 shadow-2xl transition-all duration-300",
          scrolled ? "w-[90%] md:w-[80%] lg:w-[70%] bg-black/40" : "w-[95%] md:w-[85%]"
        )}>
          {/* Logo Area */}
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
              MeetBuddy
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link key={link.path} to={link.path}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 relative overflow-hidden",
                    isActive(link.path)
                      ? "text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {isActive(link.path) && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white/10 rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleProfileClick}
                className="p-2 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/10 text-white hover:border-white/30 transition-all"
              >
                <User className="w-5 h-5" />
              </motion.button>
            ) : (
              <Link to="/login">
                <Button
                  variant="outline"
                  className="rounded-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white px-6"
                >
                  Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Top Sheet */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-24 left-4 right-4 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl md:hidden flex flex-col gap-4"
          >
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl transition-all",
                  isActive(link.path)
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <link.icon className="w-5 h-5" />
                <span className="font-medium text-lg">{link.label}</span>
              </Link>
            ))}
            <div className="h-px bg-white/10 my-2" />
            {isLoggedIn ? (
              <button
                onClick={() => { handleProfileClick(); setIsMobileMenuOpen(false); }}
                className="flex items-center gap-4 p-4 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all w-full text-left"
              >
                <User className="w-5 h-5" />
                <span className="font-medium text-lg">Profile</span>
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl py-6 text-lg">
                  Sign In
                </Button>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;

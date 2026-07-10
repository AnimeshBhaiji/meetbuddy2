import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { User, Calendar as CalendarIcon, Menu, X, Home, Map, Info, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import AccessDeniedModal from "@/components/AccessDeniedModal";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [showAccessModal, setShowAccessModal] = useState(false);

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentPath]);

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
    ...(isLoggedIn
      ? [
          { path: "/planner", label: "Planner", icon: Map },
          { path: "/calendar", label: "Calendar", icon: CalendarIcon },
        ]
      : []),
    { path: "/about", label: "About Us", icon: Info },
  ];

  const handleProfileClick = () => {
    navigate("/profile");
  };

  return (
    <>
      <AccessDeniedModal isOpen={showAccessModal} onClose={() => setShowAccessModal(false)} />

      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 flex justify-center px-4 transition-all duration-300 pointer-events-none",
          scrolled ? "pt-3" : "pt-6"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between pointer-events-auto",
            "glass-strong rounded-full px-6 py-3 transition-all duration-500",
            scrolled
              ? "w-[92%] md:w-[78%] lg:w-[64%] shadow-[0_8px_40px_oklch(0.62_0.22_285/20%)]"
              : "w-[95%] md:w-[86%] shadow-2xl"
          )}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-2 glow-sm group-hover:glow-md transition-shadow duration-300">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            <span className="text-xl font-bold font-display text-gradient">
              MeetBuddy
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const requiresPrefs = link.path === "/planner";

              const handleClick = (e) => {
                if (requiresPrefs) {
                  const hasPrefs =
                    localStorage.getItem("userPreferences") ||
                    localStorage.getItem("questionnaireAnswers");
                  if (!hasPrefs) {
                    e.preventDefault();
                    setShowAccessModal(true);
                    return;
                  }
                }
              };

              return (
                <Link key={link.path} to={link.path} onClick={handleClick}>
                  <div
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 flex items-center gap-2 relative",
                      isActive(link.path)
                        ? "text-white"
                        : "text-foreground/70 hover:text-white hover:bg-white/5",
                      requiresPrefs &&
                        !localStorage.getItem("userPreferences") &&
                        !localStorage.getItem("questionnaireAnswers") &&
                        "opacity-50 hover:opacity-75"
                    )}
                  >
                    {isActive(link.path) && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-brand/30 to-brand-2/25 border border-white/10"
                        transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <link.icon className="w-4 h-4" />
                      {link.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleProfileClick}
                aria-label="Profile"
                className="p-2 rounded-full bg-gradient-to-br from-brand/25 to-brand-2/25 border border-white/15 text-white hover:border-brand/50 hover:glow-sm transition-all duration-300 cursor-pointer"
              >
                <User className="w-5 h-5" />
              </motion.button>
            ) : (
              <Link to="/login">
                <motion.span
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand to-brand-2 glow-sm hover:glow-md transition-shadow duration-300"
                >
                  Sign In
                </motion.span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
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
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/55 md:hidden"
          />
        )}
        {isMobileMenuOpen && (
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-24 left-4 right-4 z-40 glass-strong rounded-3xl p-6 shadow-2xl md:hidden flex flex-col gap-2"
          >
            {navLinks.map((link, i) => (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl transition-all",
                    isActive(link.path)
                      ? "bg-gradient-to-r from-brand/25 to-brand-2/20 text-white border border-white/10"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  )}
                >
                  <link.icon className="w-5 h-5" />
                  <span className="font-medium text-lg">{link.label}</span>
                </Link>
              </motion.div>
            ))}
            <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent my-2" />
            {isLoggedIn ? (
              <button
                onClick={() => {
                  handleProfileClick();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-4 p-4 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-white transition-all w-full text-left"
              >
                <User className="w-5 h-5" />
                <span className="font-medium text-lg">Profile</span>
              </button>
            ) : (
              <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                <span className="flex items-center justify-center w-full rounded-xl py-4 text-lg font-semibold text-white bg-gradient-to-r from-brand to-brand-2 glow-sm">
                  Sign In
                </span>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;

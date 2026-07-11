import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Star,
  TrendingUp,
  Zap,
  Clock,
  ArrowRight,
  Users,
  Wand2,
  SlidersHorizontal,
} from "lucide-react";
import AmbientBackground from "@/components/AmbientBackground";
import GlassCard from "@/components/ui/GlassCard";
import AccessDeniedModal from "@/components/AccessDeniedModal";

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.15 } },
};

const child = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 12, stiffness: 200 } },
};

const sectionFadeIn = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const RECENT_ACTIVITY = [
  { title: "Coffee at The Grind", date: "2 days ago", location: "Downtown", icon: Clock },
  { title: "Team Lunch", date: "Last Friday", location: "Bistro 42", icon: Users },
  { title: "Project Kickoff", date: "Oct 24", location: "Office HQ", icon: Zap },
];

const TRENDING_SPOTS = [
  {
    name: "Skyline Rooftop",
    type: "Lounge",
    rating: 4.8,
    image:
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1000&auto=format&fit=crop",
  },
  {
    name: "The Urban Garden",
    type: "Cafe",
    rating: 4.6,
    image:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop",
  },
  {
    name: "Neon Arcade",
    type: "Entertainment",
    rating: 4.9,
    image:
      "https://images.unsplash.com/photo-1511882150382-421056ac8d89?q=80&w=1000&auto=format&fit=crop",
  },
];

const HomePage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showAccessModal, setShowAccessModal] = useState(false);

  const welcomeText = "Welcome back,";
  const nameText = (user?.first_name || "User") + "!";

  const openPlanner = () => {
    const hasPrefs =
      localStorage.getItem("userPreferences") || localStorage.getItem("questionnaireAnswers");
    if (!hasPrefs) {
      setShowAccessModal(true);
      return;
    }
    navigate("/planner");
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-clip">
      <AmbientBackground intensity="app" />
      <AccessDeniedModal isOpen={showAccessModal} onClose={() => setShowAccessModal(false)} />
      <Navbar />

      <div className="flex-1 flex flex-col items-center px-6 md:px-12 pt-32 pb-20">
        <div className="w-full max-w-6xl">
          {/* ---------- Greeting ---------- */}
          <motion.div variants={container} initial="hidden" animate="visible" className="mb-14">
            <div className="flex flex-wrap overflow-hidden">
              {welcomeText.split("").map((letter, index) => (
                <motion.span
                  variants={child}
                  key={index}
                  className="text-5xl md:text-7xl font-bold font-display text-white mr-[2px]"
                >
                  {letter === " " ? " " : letter}
                </motion.span>
              ))}
            </div>
            <div className="flex flex-wrap overflow-hidden mt-2">
              {nameText.split("").map((letter, index) => (
                <motion.span
                  variants={child}
                  key={index}
                  className="text-5xl md:text-7xl font-bold font-display text-gradient mr-[2px]"
                >
                  {letter === " " ? " " : letter}
                </motion.span>
              ))}
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              className="text-muted-foreground text-xl mt-5 max-w-xl"
            >
              Your next great adventure is one click away. Ready to explore?
            </motion.p>
          </motion.div>

          {/* ---------- Bento quick actions ---------- */}
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24"
          >
            {/* Plan card — hero action, spans 2 cols */}
            <GlassCard
              hover
              variant="gradient"
              onClick={openPlanner}
              className="md:col-span-2 group relative cursor-pointer p-9 overflow-hidden"
            >
              <div className="absolute -right-12 -top-12 w-56 h-56 bg-brand/15 rounded-full blur-3xl group-hover:bg-brand/25 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-brand to-brand-2 rounded-2xl flex items-center justify-center mb-6 glow-sm group-hover:glow-md group-hover:scale-110 transition-all duration-500">
                  <Wand2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Start planning</h2>
                <p className="text-muted-foreground text-base mb-6 leading-relaxed max-w-md flex-grow">
                  Spin up a new meetup in minutes — dinner, activity and stay, all matched to
                  your group's vibe.
                </p>
                <span className="inline-flex items-center gap-2 text-brand-3 font-bold tracking-wide group-hover:gap-4 transition-all duration-300">
                  PLAN NOW <ArrowRight className="w-5 h-5" />
                </span>
              </div>
            </GlassCard>

            {/* Calendar card */}
            <GlassCard
              hover
              variant="strong"
              onClick={() => navigate("/calendar")}
              className="group relative cursor-pointer p-8 overflow-hidden"
            >
              <div className="absolute -right-10 -top-10 w-44 h-44 bg-brand-2/12 rounded-full blur-3xl group-hover:bg-brand-2/20 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-2/30 to-brand/20 border border-white/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Calendar className="w-7 h-7 text-brand-3" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Calendar</h2>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed flex-grow">
                  Upcoming meetups, conflicts, and your whole social schedule in one view.
                </p>
                <span className="inline-flex items-center gap-2 text-brand-3 font-bold text-sm tracking-wide group-hover:gap-4 transition-all duration-300">
                  OPEN <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </GlassCard>

            {/* Preferences card — full width bottom row on md */}
            <GlassCard
              hover
              variant="strong"
              onClick={() => navigate("/questionnaire-stage1")}
              className="md:col-span-3 group relative cursor-pointer p-8 overflow-hidden"
            >
              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-14 h-14 shrink-0 bg-gradient-to-br from-brand-3/25 to-brand/20 border border-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <SlidersHorizontal className="w-7 h-7 text-brand-3" />
                </div>
                <div className="flex-grow">
                  <h2 className="text-2xl font-bold text-white mb-1.5">Tune your preferences</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
                    Vibe shifted? Retake the two-minute questionnaire and every recommendation
                    updates with you.
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 text-brand-3 font-bold text-sm tracking-wide group-hover:gap-4 transition-all duration-300">
                  CUSTOMIZE <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </GlassCard>
          </motion.div>

          {/* ---------- Recent Activity ---------- */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={sectionFadeIn}
            className="mb-20"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2.5">
                <Clock className="w-6 h-6 text-brand-3" /> Your recent activity
              </h3>
              <button className="text-sm text-muted-foreground hover:text-white transition-colors cursor-pointer">
                View all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {RECENT_ACTIVITY.map((activity) => (
                <GlassCard
                  hover
                  key={activity.title}
                  className="p-6 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-brand/25 to-brand-2/20 border border-white/10 rounded-xl text-brand-3 group-hover:scale-110 transition-transform">
                      <activity.icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground glass px-2.5 py-1 rounded-lg">
                      {activity.date}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">{activity.title}</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {activity.location}
                  </p>
                </GlassCard>
              ))}
            </div>
          </motion.div>

          {/* ---------- Trending Spots ---------- */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={sectionFadeIn}
            className="mb-20"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2.5">
                <TrendingUp className="w-6 h-6 text-brand-2" /> Trending spots
              </h3>
              <button className="text-sm text-muted-foreground hover:text-white transition-colors cursor-pointer">
                Discover more
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TRENDING_SPOTS.map((spot) => (
                <motion.div
                  key={spot.name}
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="group relative h-64 rounded-2xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand/40 transition-colors duration-300"
                >
                  <img
                    src={spot.image}
                    alt={spot.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 w-full">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-xs font-bold text-brand-3 uppercase tracking-wider mb-1 block">
                          {spot.type}
                        </span>
                        <h4 className="text-xl font-bold text-white mb-1">{spot.name}</h4>
                        <div className="flex items-center gap-1 text-yellow-400 text-sm">
                          <Star className="w-4 h-4 fill-yellow-400" /> {spot.rating}
                        </div>
                      </div>
                      <div className="w-10 h-10 glass rounded-full flex items-center justify-center text-white group-hover:bg-gradient-to-br group-hover:from-brand group-hover:to-brand-2 group-hover:border-transparent transition-all">
                        <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ---------- Pro Tip ---------- */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={sectionFadeIn}
          >
            <GlassCard variant="gradient" className="p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-2/12 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="w-16 h-16 bg-gradient-to-br from-brand to-brand-2 rounded-2xl flex items-center justify-center flex-shrink-0 glow-md">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div className="text-center md:text-left">
                  <h4 className="text-2xl font-bold text-white mb-2">Pro tip: collaborate live!</h4>
                  <p className="text-muted-foreground max-w-2xl">
                    Invite friends to vote on locations in real time. Start a plan and hit
                    "Invite" to get the whole squad involved instantly.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={openPlanner}
                  className="px-6 py-3 glass hover:bg-white/10 text-white rounded-xl font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  Try it now
                </motion.button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default HomePage;

import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Calendar, MonitorPlay, MapPin, Star, TrendingUp, Zap, Clock, ArrowRight, Users } from "lucide-react";
import DarkVeil from "@/components/DarkVeil/DarkVeil";

import AccessDeniedModal from "@/components/AccessDeniedModal";

const HomePage = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // Access Modal State
    const [showAccessModal, setShowAccessModal] = useState(false);

    // Staggered container for text
    const container = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.2 }
        }
    };

    // Letter animation
    const child = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { type: "spring", damping: 12, stiffness: 200 }
        }
    };

    const fadeInUp = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
    };

    const sectionFadeIn = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    // Split text helper
    const welcomeText = "Welcome back,";
    const nameText = (user?.first_name || "User") + "!";

    // Mock Data
    const recentActivity = [
        { title: "Coffee at The Grind", date: "2 days ago", location: "Downtown", icon: Clock },
        { title: "Team Lunch", date: "Last Friday", location: "Bistro 42", icon: Users },
        { title: "Project Kickoff", date: "Oct 24", location: "Office HQ", icon: Zap },
    ];

    const trendingSpots = [
        { name: "Skyline Rooftop", type: "Lounge", rating: 4.8, image: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1000&auto=format&fit=crop" },
        { name: "The Urban Garden", type: "Cafe", rating: 4.6, image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop" },
        { name: "Neon Arcade", type: "Entertainment", rating: 4.9, image: "https://images.unsplash.com/photo-1511882150382-421056ac8d89?q=80&w=1000&auto=format&fit=crop" },
    ];

    return (
        <div className="relative min-h-screen flex flex-col bg-black overflow-x-hidden">
            {/* DarkVeil as a fixed background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <DarkVeil
                    hueShift={0}
                    noiseIntensity={0.02}
                    scanlineIntensity={0.4}
                    speed={2.0}
                    scanlineFrequency={1.5}
                    warpAmount={0.1}
                    debug={false}
                />
            </div>

            <AccessDeniedModal isOpen={showAccessModal} onClose={() => setShowAccessModal(false)} />

            <div className="relative z-10 flex flex-col min-h-screen pt-24">
                <Navbar />

                <div className="flex-1 flex flex-col items-center p-6 md:p-12 space-y-20">
                    <div className="w-full max-w-6xl mt-10">
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
                            <motion.div
                                variants={container}
                                initial="hidden"
                                animate="visible"
                            >
                                <div className="flex flex-wrap overflow-hidden">
                                    {welcomeText.split("").map((letter, index) => (
                                        <motion.span variants={child} key={index} className="text-5xl md:text-7xl font-bold text-white mr-[2px]">
                                            {letter === " " ? "\u00A0" : letter}
                                        </motion.span>
                                    ))}
                                </div>
                                <div className="flex flex-wrap overflow-hidden mt-2">
                                    {nameText.split("").map((letter, index) => (
                                        <motion.span
                                            variants={child}
                                            key={index}
                                            className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mr-[2px]"
                                        >
                                            {letter === " " ? "\u00A0" : letter}
                                        </motion.span>
                                    ))}
                                </div>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1, duration: 1 }}
                                    className="text-gray-400 text-xl mt-4 max-w-xl"
                                >
                                    Your next great adventure is just a click away. Ready to explore?
                                </motion.p>
                            </motion.div>


                        </div>

                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={fadeInUp}
                            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24"
                        >
                            {/* Plan Card */}
                            <motion.div
                                whileHover={{ scale: 1.03, translateY: -10 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    const hasPrefs = localStorage.getItem("userPreferences") || localStorage.getItem("questionnaireAnswers");
                                    if (!hasPrefs) {
                                        setShowAccessModal(true);
                                        return;
                                    }
                                    navigate('/planner');
                                }}
                                className="group relative cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-8 overflow-hidden hover:border-blue-500/50 transition-all duration-500 shadow-2xl"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute -right-10 -top-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500" />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                                        <MonitorPlay className="w-8 h-8 text-blue-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-200 transition-colors">Start Planning</h2>
                                    <p className="text-gray-400 text-base mb-6 leading-relaxed flex-grow">
                                        Create a new meetup, invite friends, and coordinate the perfect time with our AI planner.
                                    </p>
                                    <span className="inline-flex items-center gap-2 text-blue-400 font-bold tracking-wide group-hover:gap-4 transition-all duration-300">
                                        PLAN NOW <span className="text-xl">→</span>
                                    </span>
                                </div>
                            </motion.div>

                            {/* Calendar Card */}
                            <motion.div
                                whileHover={{ scale: 1.03, translateY: -10 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/calendar')}
                                className="group relative cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-8 overflow-hidden hover:border-purple-500/50 transition-all duration-500 shadow-2xl"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500" />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform duration-500">
                                        <Calendar className="w-8 h-8 text-purple-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-200 transition-colors">View Calendar</h2>
                                    <p className="text-gray-400 text-base mb-6 leading-relaxed flex-grow">
                                        Check your upcoming meetups, manage schedule conflicts, and sync with your friends.
                                    </p>
                                    <span className="inline-flex items-center gap-2 text-purple-400 font-bold tracking-wide group-hover:gap-4 transition-all duration-300">
                                        VIEW CALENDAR <span className="text-xl">→</span>
                                    </span>
                                </div>
                            </motion.div>

                            {/* Preferences Card */}
                            <motion.div
                                whileHover={{ scale: 1.03, translateY: -10 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/questionnaire-stage1')}
                                className="group relative cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-8 overflow-hidden hover:border-pink-500/50 transition-all duration-500 shadow-2xl"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-pink-600/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute -right-10 -top-10 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl group-hover:bg-pink-500/20 transition-all duration-500" />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="w-16 h-16 bg-gradient-to-br from-pink-500/20 to-pink-600/10 rounded-2xl flex items-center justify-center mb-6 border border-pink-500/20 group-hover:scale-110 transition-transform duration-500">
                                        <Star className="w-8 h-8 text-pink-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-pink-200 transition-colors">Preferences</h2>
                                    <p className="text-gray-400 text-base mb-6 leading-relaxed flex-grow">
                                        Customize your travel style, interests, and dietary needs for better recommendations.
                                    </p>
                                    <span className="inline-flex items-center gap-2 text-pink-400 font-bold tracking-wide group-hover:gap-4 transition-all duration-300">
                                        CUSTOMIZE <span className="text-xl">→</span>
                                    </span>
                                </div>
                            </motion.div>
                        </motion.div>

                        {/* Recent Activity Section */}
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-100px" }}
                            variants={sectionFadeIn}
                            className="mb-20"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Clock className="w-6 h-6 text-blue-400" /> Your Recent Activity
                                </h3>
                                <button className="text-sm text-gray-400 hover:text-white transition-colors">View All</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {recentActivity.map((activity, index) => (
                                    <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all cursor-pointer group">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                                                <activity.icon className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-medium text-gray-500 bg-white/5 px-2 py-1 rounded-md">{activity.date}</span>
                                        </div>
                                        <h4 className="text-lg font-bold text-white mb-1">{activity.title}</h4>
                                        <p className="text-sm text-gray-400 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> {activity.location}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Trending Spots Section */}
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-100px" }}
                            variants={sectionFadeIn}
                            className="mb-20"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-6 h-6 text-pink-500" /> Trending Spots
                                </h3>
                                <button className="text-sm text-gray-400 hover:text-white transition-colors">Discover More</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {trendingSpots.map((spot, index) => (
                                    <div key={index} className="group relative h-64 rounded-2xl overflow-hidden cursor-pointer border border-white/10">
                                        <img src={spot.image} alt={spot.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                                        <div className="absolute bottom-0 left-0 p-6 w-full">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <span className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-1 block">{spot.type}</span>
                                                    <h4 className="text-xl font-bold text-white mb-1 group-hover:text-pink-300 transition-colors">{spot.name}</h4>
                                                    <div className="flex items-center gap-1 text-yellow-400 text-sm">
                                                        <Star className="w-4 h-4 fill-yellow-400" /> {spot.rating}
                                                    </div>
                                                </div>
                                                <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 group-hover:bg-pink-500 group-hover:border-pink-500 transition-all">
                                                    <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Pro Tip Section */}
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-100px" }}
                            variants={sectionFadeIn}
                            className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-white/10 rounded-3xl p-8 md:p-12 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
                                    <Zap className="w-8 h-8 text-white" />
                                </div>
                                <div className="text-center md:text-left">
                                    <h4 className="text-2xl font-bold text-white mb-2">Pro Tip: Collaborate Live!</h4>
                                    <p className="text-gray-300 max-w-2xl">
                                        Did you know you can invite friends to vote on locations in real-time? Start a plan and hit the "Invite" button to get the whole squad involved instantly.
                                    </p>
                                </div>
                                <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium border border-white/10 transition-all whitespace-nowrap">
                                    Try it now
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>

                <Footer />
            </div>
        </div>
    );
};

export default HomePage;

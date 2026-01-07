import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { motion } from "framer-motion";
import { Calendar, MonitorPlay } from "lucide-react";
import DarkVeil from "@/components/DarkVeil/DarkVeil";

const HomePage = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const fadeInUp = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div className="relative min-h-screen">
            {/* DarkVeil as a fixed background */}
            <div className="fixed inset-0 z-0">
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

            <div className="relative z-10 min-h-screen flex flex-col">
                <Navbar />

                <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="w-full max-w-5xl"
                    >
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                                    Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">{user?.first_name || "User"}</span>!
                                </h1>
                                <p className="text-gray-400 text-lg">Ready to plan your next adventure?</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all duration-300 backdrop-blur-md"
                            >
                                Logout
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Plan Card */}
                            <motion.div
                                whileHover={{ scale: 1.02, translateY: -5 }}
                                onClick={() => navigate('/planner')}
                                className="group relative cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 hover:border-blue-500/50 transition-all duration-300"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 text-blue-400 group-hover:text-blue-300 transition-colors">
                                        <MonitorPlay className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-white mb-3">Start Planning</h2>
                                    <p className="text-gray-400 text-lg mb-6">Create a new meetup, invite friends, and coordinate the perfect time.</p>
                                    <span className="inline-flex items-center text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                                        Plan now →
                                    </span>
                                </div>
                            </motion.div>

                            {/* Calendar Card */}
                            <motion.div
                                whileHover={{ scale: 1.02, translateY: -5 }}
                                onClick={() => navigate('/calendar')}
                                className="group relative cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 hover:border-purple-500/50 transition-all duration-300"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6 text-purple-400 group-hover:text-purple-300 transition-colors">
                                        <Calendar className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-white mb-3">View Calendar</h2>
                                    <p className="text-gray-400 text-lg mb-6">Check your upcoming meetups and manage your schedule effortlessly.</p>
                                    <span className="inline-flex items-center text-purple-400 font-medium group-hover:translate-x-1 transition-transform">
                                        Go to Calendar →
                                    </span>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;

// src/pages/Profile.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, User, LogOut, Settings, Calendar, MapPin, Users, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Aurora from '@/components/Aurora';
import { useQuestionnaire } from '@/context/QuestionnaireContext';
import { Button } from '@/components/ui/button';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      navigate("/login");
    } else {
      const parsedUser = JSON.parse(storedUser);
      fetch(`http://localhost:8000/user/${parsedUser.user_id}`)
        .then((res) => res.json())
        .then((data) => {
          setUser(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching user:", err);
          setLoading(false);
        });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    resetAnswers();
    navigate("/login");
  };

  const handlePreferences = () => {
    navigate("/questionnaire-summary");
  };

  if (loading) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-white">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <Aurora colorStops={['#5227FF', '#bf4bfd', '#5227FF']} />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />
        
        <main className="flex-1 py-12 px-4">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Profile Header */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden mb-8">
              <div className="p-8 text-center">
                <motion.div 
                  className="w-32 h-32 mx-auto rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center text-5xl font-bold text-white/90 mb-6"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </motion.div>
                
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-3">
                  {user?.firstName} {user?.lastName}
                </h1>
                <p className="text-lg text-gray-400">@{user?.username}</p>
                
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                  <Button 
                    variant="outline" 
                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white text-base"
                    onClick={handlePreferences}
                  >
                    <Settings className="w-5 h-5 mr-2" />
                    Preferences
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 text-base"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            </div>

            {/* User Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <motion.div 
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
                whileHover={{ y: -2 }}
              >
                <h3 className="text-xl font-semibold text-white/90 mb-5 flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-400" />
                  Personal Information
                </h3>
                <div className="space-y-5">
                  <div>
                    <p className="text-base text-gray-400">Full Name</p>
                    <p className="text-lg text-white/90">{user?.firstName} {user?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-base text-gray-400">Username</p>
                    <p className="text-lg text-white/90">@{user?.username}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
                whileHover={{ y: -2 }}
              >
                <h3 className="text-xl font-semibold text-white/90 mb-5 flex items-center">
                  <Mail className="w-5 h-5 mr-2 text-purple-400" />
                  Contact Information
                </h3>
                <div className="space-y-5">
                  <div>
                    <p className="text-base text-gray-400">Email</p>
                    <p className="text-lg text-white/90">{user?.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-base text-gray-400">Phone</p>
                    <p className="text-lg text-white/90">{user?.contact || 'Not provided'}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
                whileHover={{ y: -2 }}
              >
                <h3 className="text-xl font-semibold text-white/90 mb-5 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-green-400" />
                  Activity
                </h3>
                <div className="space-y-5">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-3 text-gray-400" />
                    <span className="text-base text-gray-400">Meetups planned: <span className="text-lg text-white/90">12</span></span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                    <span className="text-base text-gray-400">Favorite spot: <span className="text-lg text-white/90">Downtown Cafe</span></span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 mr-3 text-gray-400" />
                    <span className="text-base text-gray-400">Member since: <span className="text-lg text-white/90">Jan 2023</span></span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
                whileHover={{ y: -2 }}
              >
                <h3 className="text-xl font-semibold text-white/90 mb-5">Preferences</h3>
                <p className="text-base text-gray-400 mb-6">Your selected preferences will appear here after completing the questionnaire.</p>
                <Button 
                  variant="outline" 
                  className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-white text-base py-2"
                  onClick={handlePreferences}
                >
                  View Preferences
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Profile;

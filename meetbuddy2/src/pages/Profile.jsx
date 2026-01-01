// src/pages/Profile.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, User, LogOut, Settings, Calendar, MapPin, Users, Clock, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Aurora from '@/components/Aurora';
import { useQuestionnaire } from '@/context/QuestionnaireContext';
import { API_BASE_URL } from '@/config';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      navigate("/login");
    } else {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('Stored user data:', parsedUser);
        
        // Always fetch fresh user data from the server using the user_id
        const userId = parsedUser.id || parsedUser.user_id;
        if (userId) {
          console.log('Fetching complete user data for user ID:', userId);
          
          fetch(`${API_BASE_URL}/user/${userId}`)
            .then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
              }
              return res.json();
            })
            .then((userData) => {
              console.log('Complete user data from server:', userData);
              // Update localStorage with the complete user data
              localStorage.setItem('user', JSON.stringify(userData));
              setUser(userData);
            })
            .catch((err) => {
              console.error('Error fetching user data:', err);
              // If fetch fails, use whatever data we have
              setUser(parsedUser);
            })
            .finally(() => {
              setLoading(false);
            });
        } else {
          console.error('No user ID found in stored user data');
          setUser(parsedUser);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error parsing user data:", err);
        setLoading(false);
      }
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    resetAnswers();
    navigate("/login");
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      console.error('No user data available');
      setDeleteError('User data not found. Please try logging out and back in.');
      return;
    }
    
    // Log the user object to debug
    console.log('User object:', user);
    
    // Try different possible ID properties
    const userId = user.id || user.user_id || (user.user && (user.user.id || user.user.user_id));
    
    if (!userId) {
      console.error('Could not determine user ID from:', user);
      setDeleteError('Could not determine your user ID. Please try logging out and back in.');
      return;
    }
    
    setIsDeleting(true);
    setDeleteError('');
    
    try {
      console.log(`Attempting to delete user with ID: ${userId}`);
      const response = await fetch(`http://localhost:8000/user/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        console.error('Delete account failed:', response.status, responseData);
        throw new Error(responseData.detail || `Failed to delete account: ${response.status} ${response.statusText}`);
      }
      
      console.log('Account deleted successfully');
      
      // Logout the user after successful deletion
      localStorage.removeItem("user");
      resetAnswers();
      navigate("/signup");
      
    } catch (error) {
      console.error('Error deleting account:', error);
      setDeleteError(error.message || 'An error occurred while deleting your account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
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
                  {user?.first_name} {user?.last_name}
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
                    variant="outline" 
                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white text-base"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    Logout
                  </Button>
                  
                  <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 text-base"
                      >
                        <AlertTriangle className="w-5 h-5 mr-2" />
                        Delete Account
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-gray-900 border-red-500/30 max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-2xl text-red-400 flex items-center">
                          <AlertTriangle className="w-6 h-6 mr-2" />
                          Delete Your Account?
                        </DialogTitle>
                        <DialogDescription className="text-red-300/80 mt-2">
                          This action cannot be undone. All your data, including preferences and meetup history, will be permanently deleted.
                        </DialogDescription>
                        {deleteError && (
                          <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-md text-red-300">
                            {deleteError}
                          </div>
                        )}
                      </DialogHeader>
                      <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowDeleteDialog(false)}
                          className="w-full sm:w-auto"
                          disabled={isDeleting}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteAccount}
                          className="w-full sm:w-auto"
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                    <p className="text-lg text-white/90">
                      {user?.first_name} {user?.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-base text-gray-400">Username</p>
                    <p className="text-lg text-white/90">{user?.username ? `@${user.username}` : 'Not set'}</p>
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
                    <p className="text-lg text-white/90 break-all">{user?.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-base text-gray-400">Phone</p>
                    <p className="text-lg text-white/90">{user?.phone || user?.contact || 'Not provided'}</p>
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

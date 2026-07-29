// src/pages/Profile.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  User,
  LogOut,
  Settings,
  Calendar,
  MapPin,
  Users,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import { useQuestionnaire } from '@/context/QuestionnaireContext';
import { API_BASE_URL } from '@/config';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';

const PREF_META = [
  { key: 'mood', emoji: '🎭' },
  { key: 'planningStyle', emoji: '🗺️' },
  { key: 'adventureLevel', emoji: '🧭' },
  { key: 'addOnMagic', emoji: '✨' },
  { key: 'memorableFactor', emoji: '💫' },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
};

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [prefs, setPrefs] = useState(null);
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('userPreferences') || 'null');
      setPrefs(stored);
    } catch { /* ignore */ }

    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
      navigate('/login');
    } else {
      try {
        const parsedUser = JSON.parse(storedUser);

        // Always fetch fresh user data from the server using the user_id
        const userId = parsedUser.id || parsedUser.user_id;
        if (userId) {
          fetch(`${API_BASE_URL}/user/${userId}`)
            .then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
              }
              return res.json();
            })
            .then((userData) => {
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
        console.error('Error parsing user data:', err);
        setLoading(false);
      }
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    resetAnswers();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      setDeleteError('User data not found. Please try logging out and back in.');
      return;
    }

    const userId = user.user_id || user.id;

    if (!userId) {
      setDeleteError('Could not determine your user ID. Please try logging out and back in.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          responseData.detail || `Failed to delete account: ${response.status} ${response.statusText}`
        );
      }

      // Logout the user after successful deletion
      localStorage.removeItem('user');
      resetAnswers();
      navigate('/signup');
    } catch (error) {
      console.error('Error deleting account:', error);
      setDeleteError(
        error.message || 'An error occurred while deleting your account. Please try again.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePreferences = () => {
    navigate('/questionnaire-summary');
  };

  const initials =
    `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    '?';

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-x-clip">
        <div className="min-h-screen flex items-center justify-center">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand border-r-brand-2 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">

      <main className="min-h-screen pt-32 pb-16 px-4">
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Profile Header */}
          <GlassCard variant="gradient" className="overflow-hidden mb-8">
            <div className="p-8 md:p-10 text-center relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-brand/12 rounded-full blur-3xl pointer-events-none" />

              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="relative w-28 h-28 mx-auto rounded-full p-[3px] bg-gradient-to-br from-brand via-brand-2 to-brand-3 glow-md mb-6"
              >
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-4xl font-bold font-display text-white"
                  style={{ background: "oklch(0.16 0.025 275)" }}
                >
                  {initials}
                </div>
              </motion.div>

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                {user?.first_name} <span className="text-gradient">{user?.last_name}</span>
              </h1>
              <p className="text-lg text-muted-foreground">@{user?.username}</p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <GlowButton variant="ghost" onClick={handlePreferences}>
                  <Settings className="w-4.5 h-4.5" />
                  Preferences
                </GlowButton>

                <GlowButton variant="ghost" onClick={handleLogout}>
                  <LogOut className="w-4.5 h-4.5" />
                  Logout
                </GlowButton>

                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <GlowButton variant="danger">
                      <AlertTriangle className="w-4.5 h-4.5" />
                      Delete account
                    </GlowButton>
                  </DialogTrigger>
                  <DialogContent className="glass-strong border-destructive/30 max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-2xl text-red-400 flex items-center">
                        <AlertTriangle className="w-6 h-6 mr-2" />
                        Delete your account?
                      </DialogTitle>
                      <DialogDescription className="text-red-300/80 mt-2">
                        This action cannot be undone. All your data, including preferences and
                        meetup history, will be permanently deleted.
                      </DialogDescription>
                      {deleteError && (
                        <div className="mt-4 p-3 bg-destructive/15 border border-destructive/30 rounded-xl text-red-300 text-sm">
                          {deleteError}
                        </div>
                      )}
                    </DialogHeader>
                    <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-3">
                      <GlowButton
                        variant="ghost"
                        onClick={() => setShowDeleteDialog(false)}
                        className="w-full sm:w-auto"
                        disabled={isDeleting}
                      >
                        Cancel
                      </GlowButton>
                      <GlowButton
                        variant="danger"
                        onClick={handleDeleteAccount}
                        className="w-full sm:w-auto"
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
                      </GlowButton>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </GlassCard>

          {/* User Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
              <GlassCard hover variant="strong" className="p-7 h-full">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand/30 to-brand-2/25 border border-white/10">
                    <User className="w-4.5 h-4.5 text-brand-3" />
                  </span>
                  Personal information
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Full name</p>
                    <p className="text-lg text-white">
                      {user?.first_name} {user?.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Username</p>
                    <p className="text-lg text-white">
                      {user?.username ? `@${user.username}` : 'Not set'}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
              <GlassCard hover variant="strong" className="p-7 h-full">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-2/30 to-brand/25 border border-white/10">
                    <Mail className="w-4.5 h-4.5 text-brand-3" />
                  </span>
                  Contact information
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-lg text-white break-all">{user?.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="text-lg text-white">
                      {user?.phone || user?.contact || 'Not provided'}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
              <GlassCard hover variant="strong" className="p-7 h-full">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-3/25 to-brand/25 border border-white/10">
                    <Calendar className="w-4.5 h-4.5 text-brand-3" />
                  </span>
                  Activity
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-4.5 h-4.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Meetups planned: <span className="text-base text-white font-medium">12</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4.5 h-4.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Favorite spot:{' '}
                      <span className="text-base text-white font-medium">Downtown Cafe</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4.5 h-4.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Member since: <span className="text-base text-white font-medium">Jan 2023</span>
                    </span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible">
              <GlassCard hover variant="strong" className="p-7 h-full flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand/25 to-brand-3/25 border border-white/10">
                    <Settings className="w-4.5 h-4.5 text-brand-3" />
                  </span>
                  Preferences
                </h3>
                {prefs ? (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {PREF_META.filter(({ key }) => prefs[key]).map(({ key, emoji }) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 glass rounded-full text-sm text-foreground/90"
                      >
                        <span>{emoji}</span>
                        {Array.isArray(prefs[key]) ? prefs[key].join(', ') : String(prefs[key])}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-6">
                    Your selected preferences will appear here after completing the questionnaire.
                  </p>
                )}
                <GlowButton variant="ghost" className="w-full mt-auto" onClick={handlePreferences}>
                  View preferences
                </GlowButton>
              </GlassCard>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Profile;

import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  MapPin,
  CalendarCheck,
  Wand2,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import Field from '@/components/ui/Field';
import GlowButton from '@/components/ui/GlowButton';
import GlassCard from '@/components/ui/GlassCard';
import { useQuestionnaire } from '@/context/QuestionnaireContext';
import { AuthContext } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config';

const containerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.09 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.45 } },
};

const PERKS = [
  { icon: Wand2, text: 'Personalized plans from a 2-minute questionnaire' },
  { icon: MapPin, text: 'Curated venues, mapped around your group' },
  { icon: CalendarCheck, text: 'One itinerary — dinner, activity, stay' },
];

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();
  const { login } = useContext(AuthContext);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        // no credentials: auth uses a token in localStorage, and 'include'
        // is rejected by browsers when the server allows origin '*'
        body: JSON.stringify({
          identifier: identifier,
          password: password,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Login failed. Please check your credentials.');
      }

      const data = await response.json();

      login(data, data.token || 'mock-token');
      resetAnswers();
      navigate('/home');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AmbientBackground intensity="hero" />
      <Navbar />

      <div className="min-h-screen flex items-center justify-center px-4 pt-28 pb-16">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* ---------- Brand panel (desktop only) ---------- */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.08] mb-6">
              Welcome back to
              <br />
              <span className="text-gradient">the good plans.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-md">
              Your group is waiting. Pick up where you left off and turn tonight
              into something worth remembering.
            </p>

            <ul className="space-y-4">
              {PERKS.map(({ icon: Icon, text }, i) => (
                <motion.li
                  key={text}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.12 }}
                  className="flex items-center gap-3 text-foreground/90"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-brand/30 to-brand-2/30 border border-white/10">
                    <Icon className="w-4.5 h-4.5 text-brand-3" />
                  </span>
                  {text}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* ---------- Form card ---------- */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <GlassCard variant="gradient" className="p-8 md:p-10 relative overflow-hidden">
              {/* Decorative glows */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-brand/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-brand-2/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              <div className="relative z-10">
                <div className="text-center mb-9">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 220, delay: 0.15 }}
                    className="w-14 h-14 bg-gradient-to-br from-brand to-brand-2 rounded-2xl mx-auto flex items-center justify-center mb-5 glow-sm"
                  >
                    <Sparkles className="w-7 h-7 text-white" />
                  </motion.div>
                  <motion.h2
                    variants={itemVariants}
                    className="text-3xl font-bold text-white mb-1.5"
                  >
                    Welcome back
                  </motion.h2>
                  <motion.p variants={itemVariants} className="text-muted-foreground">
                    Ready to plan your next adventure?
                  </motion.p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <motion.div variants={itemVariants}>
                    <Field
                      label="Email or Username"
                      type="text"
                      placeholder="name@example.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      icon={<Mail className="w-4.5 h-4.5" />}
                      autoComplete="username"
                      required
                    />
                  </motion.div>

                  <motion.div variants={itemVariants} className="relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-muted-foreground">
                        Password
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-sm text-brand-3 hover:opacity-80 transition-opacity"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-12 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-brand/60 focus:ring-2 focus:ring-brand/30 focus:bg-white/[0.07]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                  </motion.div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-red-400 text-sm text-center p-3 bg-destructive/10 border border-destructive/25 rounded-xl"
                    >
                      {error}
                    </motion.div>
                  )}

                  <motion.div variants={itemVariants} className="pt-1.5">
                    <GlowButton
                      type="submit"
                      disabled={isLoading}
                      size="lg"
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </GlowButton>
                  </motion.div>
                </form>

                <motion.div
                  variants={itemVariants}
                  className="mt-8 pt-6 border-t border-white/10 text-center"
                >
                  <p className="text-muted-foreground">
                    Don't have an account?{' '}
                    <Link
                      to="/signup"
                      className="text-gradient font-bold hover:opacity-80 transition-opacity"
                    >
                      Create one now
                    </Link>
                  </p>
                </motion.div>
              </div>
            </GlassCard>

            <motion.p
              variants={itemVariants}
              className="text-center text-muted-foreground/60 text-sm mt-6"
            >
              Protected by MeetBuddy Secure Auth
            </motion.p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;

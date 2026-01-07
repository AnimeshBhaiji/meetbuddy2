import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import DarkVeil from '@/components/DarkVeil/DarkVeil';
import { useQuestionnaire } from '@/context/QuestionnaireContext';
import { AuthContext } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
          'ngrok-skip-browser-warning': 'true'
        },
        credentials: 'include',
        body: JSON.stringify({
          identifier: identifier,
          password: password
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Login failed. Please check your credentials.');
      }

      const data = await response.json();

      // Handle successful login using Context
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

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-black overflow-hidden">
      {/* Background */}
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

      <div className="relative z-10 min-h-screen flex flex-col pt-24">
        <Navbar />

        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-lg"
          >
            {/* Main Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative">

              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

              <div className="p-8 md:p-12 relative z-10">
                <div className="text-center mb-10">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20"
                  >
                    <Sparkles className="w-8 h-8 text-white" />
                  </motion.div>
                  <motion.h2 variants={itemVariants} className="text-3xl font-bold text-white mb-2">
                    Welcome Back
                  </motion.h2>
                  <motion.p variants={itemVariants} className="text-gray-400">
                    Ready to plan your next adventure?
                  </motion.p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <motion.div variants={itemVariants} className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">Email or Username</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                      <Input
                        type="text"
                        placeholder="name@example.com"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="pl-12 py-6 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-blue-400/50 focus:ring-blue-400/20 transition-all"
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants} className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-sm font-medium text-gray-300">Password</label>
                      <Link to="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-12 py-6 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-purple-400/50 focus:ring-purple-400/20 transition-all"
                      />
                    </div>
                  </motion.div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-red-400 text-sm text-center p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                    >
                      {error}
                    </motion.div>
                  )}

                  <motion.div variants={itemVariants} className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Signing in...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Sign In</span>
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      )}
                    </Button>
                  </motion.div>
                </form>

                <motion.div variants={itemVariants} className="mt-8 pt-6 border-t border-white/10 text-center">
                  <p className="text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-bold hover:opacity-80 transition-opacity">
                      Create one now
                    </Link>
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Bottom Note */}
            <motion.p
              variants={itemVariants}
              className="text-center text-gray-500 text-sm mt-8"
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

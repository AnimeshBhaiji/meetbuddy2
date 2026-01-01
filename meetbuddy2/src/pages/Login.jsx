// src/pages/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Aurora from '@/components/Aurora';
import { useQuestionnaire } from '@/context/QuestionnaireContext';
import { API_BASE_URL } from '@/config';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Attempting login with:', { identifier, password });
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

      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Login error response:', errorText);
        throw new Error(errorText || 'Login failed. Please check your credentials and try again.');
      }

      const data = await response.json();
      console.log('Login successful, user data:', data);
      
      // Handle successful login
      localStorage.setItem('user', JSON.stringify(data));
      resetAnswers();
      navigate('/questionnaire-stage1');
      
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin(e);
    }
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <Aurora colorStops={['#5227FF', '#bf4bfd', '#5227FF']} />
      <div className="relative z-10 min-h-screen flex flex-col pt-6 md:pt-8">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  Welcome back
                </h2>
                <p className="text-gray-400">
                  Enter your credentials to access your account
                </p>
                <p className='text-gray-600 text-lg'>Plan your perfect meetup with MeetBuddy</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-gray-300"
                    htmlFor="email"
                  >
                    Email or Username
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      placeholder="name@example.com"
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-sm font-medium text-gray-300"
                      htmlFor="password"
                    >
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyPress}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30"
                    />
                  </div>
                </div>
                {error && (
                  <div className="text-red-400 text-sm text-center p-3 bg-red-500/10 rounded-lg">
                    {error}
                  </div>
                )}
                <Button
                  className="w-full py-6 text-base bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                  onClick={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>

                <div className="mt-6 pt-6 border-t border-white/10 text-center text-sm">
                  <p className="text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Create one now
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;

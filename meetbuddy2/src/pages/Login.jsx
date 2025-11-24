// src/pages/Login.jsx
import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useQuestionnaire } from '../context/QuestionnaireContext';
import { Mail, Lock } from 'lucide-react';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();

  const handleLogin = async () => {
    setError('');
    if (!identifier || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || 'Login failed');
        setIsLoading(false);
        return;
      }

      resetAnswers();
      localStorage.setItem('user', JSON.stringify(data));
      console.log(' Logged in user data:', data);
      navigate('/questionnaire-stage1');
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Try again.');
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col'>
      <Navbar />
      <div className='flex-1 flex flex-col justify-center items-center px-4 py-8'>
        <div className='w-full max-w-md'>
          {/* Header Section */}
          <div className='text-center mb-10'>
            <h1 className='text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3'>
              Welcome Back
            </h1>
            <p className='text-gray-600 text-lg'>Plan your perfect meetup with MeetBuddy</p>
          </div>

          {/* Login Card */}
          <Card className='shadow-2xl border-0 bg-white overflow-hidden rounded-3xl'>
            <CardHeader className='bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-gray-200 px-8 py-6'>
              <CardTitle className='text-center text-2xl font-bold text-gray-800'>Login</CardTitle>
            </CardHeader>
            <CardContent className='px-8 py-8 space-y-6'>
              {/* Email/Username Input */}
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-3'>
                  Email or Username
                </label>
                <div className='relative'>
                  <Mail className='absolute left-4 top-3.5 w-5 h-5 text-blue-400' />
                  <Input
                    type='text'
                    placeholder='you@example.com'
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className='pl-12 h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-3'>
                  Password
                </label>
                <div className='relative'>
                  <Lock className='absolute left-4 top-3.5 w-5 h-5 text-blue-400' />
                  <Input
                    type='password'
                    placeholder='••••••••'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className='pl-12 h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className='bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm font-medium'>
                  {error}
                </div>
              )}

              {/* Login Button */}
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                className='w-full h-12 mt-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50'
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>

              {/* Signup Link */}
              <p className='text-center text-sm text-gray-600 pt-2'>
                Don't have an account?{' '}
                <Link to='/signup' className='text-blue-600 hover:text-blue-700 font-bold transition-colors'>
                  Sign up here
                </Link>
              </p>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className='text-center text-xs text-gray-500 mt-8'>
            By logging in, you agree to our Terms & Conditions
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

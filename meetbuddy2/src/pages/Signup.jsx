// src/pages/Signup.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Phone, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Aurora from '@/components/Aurora';
import { useQuestionnaire } from '@/context/QuestionnaireContext';

const Signup = () => {
  const [stage, setStage] = useState(1);
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    repeatPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateStage = () => {
    if (stage === 1) {
      if (!formData.first_name || !formData.last_name || !formData.username || !formData.email || !formData.phone) {
        setError('Please fill in all fields');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Please enter a valid email');
        return false;
      }
    } else if (stage === 2) {
      if (!formData.password || !formData.repeatPassword) {
        setError('Please fill in both password fields');
        return false;
      }
      if (formData.password !== formData.repeatPassword) {
        setError('Passwords do not match');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
    }
    return true;
  };

  const nextStage = () => {
    if (validateStage()) {
      setStage((prev) => prev + 1);
    }
  };

  const prevStage = () => setStage((prev) => prev - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStage()) return;

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Signup failed');
        setIsLoading(false);
      } else {
        // Automatically log in the user with signup credentials
        resetAnswers();
        localStorage.setItem('user', JSON.stringify(data));
        console.log('Signed up user data:', data);
        navigate('/questionnaire-stage1');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('Something went wrong');
      setIsLoading(false);
    }
  };

  const stageConfig = [
    { title: 'Account Information', icon: User, description: 'Tell us about yourself' },
    { title: 'Set Your Password', icon: Lock, description: 'Secure your account' },
  ];

  const currentStageConfig = stageConfig[stage - 1];

  return (
    <div className='relative min-h-screen bg-black overflow-hidden'>
      <Aurora colorStops={['#5227FF', '#bf4bfd', '#5227FF']} />
      <div className='relative z-10 min-h-screen flex flex-col'>
        <Navbar />
        <div className='flex-1 flex items-center justify-center py-12 px-4'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className='w-full max-w-md bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8'
          >
            <div className='p-8'>
              <div className='text-center mb-8'>
                <h2 className='text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4'>
                  Create an account
                </h2>
                {error && (
                  <div className='text-red-400 text-sm text-center p-3 bg-red-500/10 rounded-lg mt-4'>
                    {error}
                  </div>
                )}
                <p className='text-gray-400'>
                  Join MeetBuddy to plan your perfect meetup
                </p>
              </div>

              <div className='space-y-1 mb-6 text-center'>
                <div className='flex justify-center mb-2'>
                  {currentStageConfig && React.createElement(currentStageConfig.icon, {
                    className: 'w-6 h-6 text-blue-400'
                  })}
                </div>
                <h3 className='text-xl font-semibold text-white'>{currentStageConfig?.title}</h3>
                <p className='text-sm text-gray-400'>{currentStageConfig?.description}</p>
              </div>

              <div className='space-y-6'>
                {/* Stage 1: User Info */}
                {stage === 1 && (
                  <div className='space-y-6'>
                    <div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium text-gray-300'>
                          First Name
                        </label>
                        <div className='relative'>
                          <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                          <Input
                            type='text'
                            name='first_name'
                            placeholder='John'
                            value={formData.first_name}
                            onChange={handleChange}
                            className='pl-10 w-full h-11 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 rounded-xl'
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium text-gray-300'>
                          Last Name
                        </label>
                        <div className='relative'>
                          <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                          <Input
                            type='text'
                            name='last_name'
                            placeholder='Doe'
                            value={formData.last_name}
                            onChange={handleChange}
                            className='pl-10 w-full h-11 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 rounded-xl'
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium text-gray-300'>
                          Username
                        </label>
                        <div className='relative'>
                          <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                          <Input
                            type='text'
                            name='username'
                            placeholder='johndoe'
                            value={formData.username}
                            onChange={handleChange}
                            className='pl-10 w-full h-11 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 rounded-xl'
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium text-gray-300'>
                          Email
                        </label>
                        <div className='relative'>
                          <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                          <Input
                            type='email'
                            name='email'
                            placeholder='you@example.com'
                            value={formData.email}
                            onChange={handleChange}
                            className='pl-10 w-full h-11 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 rounded-xl'
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium text-gray-300'>
                          Phone Number
                        </label>
                        <div className='relative'>
                          <Phone className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                          <Input
                            type='tel'
                            name='phone'
                            placeholder='+1 (123) 456-7890'
                            value={formData.phone}
                            onChange={handleChange}
                            className='pl-10 w-full h-11 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 rounded-xl'
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 2: Password */}
                {stage === 2 && (
                  <div className='space-y-6'>
                    <div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium text-gray-300'>
                          Password
                        </label>
                        <div className='relative'>
                          <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                          <Input
                            type='password'
                            name='password'
                            placeholder='••••••••'
                            value={formData.password}
                            onChange={handleChange}
                            className='pl-10 w-full h-11 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 rounded-xl'
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className='space-y-2'>
                        <label className='block text-sm font-medium text-gray-300'>
                          Repeat Password
                        </label>
                        <div className='relative'>
                          <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                          <Input
                            type='password'
                            name='repeatPassword'
                            placeholder='••••••••'
                            value={formData.repeatPassword}
                            onChange={handleChange}
                            className='pl-10 w-full h-11 bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30 rounded-xl'
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className='bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm font-medium mt-6'>
                    {error}
                  </div>
                )}

                {/* Buttons */}
                <div className='mt-8 flex flex-col sm:flex-row justify-center sm:justify-between gap-4'>
                  {stage > 1 && (
                    <Button
                      type='button'
                      onClick={prevStage}
                      variant='outline'
                      className='w-full sm:w-auto flex items-center justify-center gap-2 text-blue-400 border-blue-400/30 hover:bg-white/5 px-6 py-3 rounded-xl transition-all'
                    >
                      <ArrowLeft className='w-4 h-4' />
                      Back
                    </Button>
                  )}
                  {stage < 2 ? (
                    <Button
                      type='button'
                      onClick={nextStage}
                      className='w-full sm:mx-auto py-6 text-base bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2'
                    >
                      Next
                      <ArrowRight className='w-4 h-4' />
                    </Button>
                  ) : (
                    <Button
                      type='button'
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className='w-full py-6 text-base bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2'
                    >
                      {isLoading ? 'Creating Account...' : 'Create Account'}
                      {!isLoading && <CheckCircle className='w-4 h-4' />}
                    </Button>
                  )}
                </div>

                {/* Login Link */}
                <div className='mt-6 pt-6 border-t border-white/10 text-center text-sm'>
                  <p className='text-gray-400'>
                    Already have an account?{' '}
                    <Link to='/login' className='text-blue-400 hover:text-blue-300 font-medium transition-colors'>
                      Sign in
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

export default Signup;

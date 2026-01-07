import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, Phone, ArrowLeft, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import DarkVeil from '@/components/DarkVeil/DarkVeil';
import { useQuestionnaire } from '@/context/QuestionnaireContext';
import { API_BASE_URL } from '@/config';

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
      const res = await fetch(`${API_BASE_URL}/signup`, {
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
        resetAnswers();
        localStorage.setItem('user', JSON.stringify(data));
        navigate('/questionnaire-stage1');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('Something went wrong');
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className='relative min-h-screen flex flex-col bg-black overflow-hidden'>
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

      <div className='relative z-10 min-h-screen flex flex-col pt-24'>
        <Navbar />

        <div className='flex-1 flex items-center justify-center p-6 md:p-12'>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className='w-full max-w-lg'
          >
            <div className='bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative'>

              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

              <div className='p-8 md:p-10 relative z-10'>
                <div className='text-center mb-8'>
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20"
                  >
                    <Sparkles className="w-7 h-7 text-white" />
                  </motion.div>
                  <h2 className='text-3xl font-bold text-white mb-2'>Create Account</h2>
                  <p className='text-gray-400'>Join MeetBuddy to plan your perfect meetup</p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-8">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${stage >= 1 ? 'w-8 bg-blue-500' : 'w-2 bg-white/20'}`} />
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${stage >= 2 ? 'w-8 bg-purple-500' : 'w-2 bg-white/20'}`} />
                </div>

                <AnimatePresence mode='wait'>
                  {stage === 1 && (
                    <motion.div
                      key="stage1"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      className='space-y-4'
                    >
                      <div className='grid grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <label className='text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1'>First Name</label>
                          <div className='relative group'>
                            <User className='absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors' />
                            <Input
                              name='first_name'
                              placeholder='John'
                              value={formData.first_name}
                              onChange={handleChange}
                              className='pl-10 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-blue-400/50 focus:ring-blue-400/20'
                            />
                          </div>
                        </div>
                        <div className='space-y-2'>
                          <label className='text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1'>Last Name</label>
                          <div className='relative group'>
                            <User className='absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors' />
                            <Input
                              name='last_name'
                              placeholder='Doe'
                              value={formData.last_name}
                              onChange={handleChange}
                              className='pl-10 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-blue-400/50 focus:ring-blue-400/20'
                            />
                          </div>
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <label className='text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1'>Username</label>
                        <div className='relative group'>
                          <User className='absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-purple-400 transition-colors' />
                          <Input
                            name='username'
                            placeholder='johndoe'
                            value={formData.username}
                            onChange={handleChange}
                            className='pl-10 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-purple-400/50 focus:ring-purple-400/20'
                          />
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <label className='text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1'>Email</label>
                        <div className='relative group'>
                          <Mail className='absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors' />
                          <Input
                            type='email'
                            name='email'
                            placeholder='you@example.com'
                            value={formData.email}
                            onChange={handleChange}
                            className='pl-10 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-blue-400/50 focus:ring-blue-400/20'
                          />
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <label className='text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1'>Phone</label>
                        <div className='relative group'>
                          <Phone className='absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-purple-400 transition-colors' />
                          <Input
                            type='tel'
                            name='phone'
                            placeholder='+1 (555) 000-0000'
                            value={formData.phone}
                            onChange={handleChange}
                            className='pl-10 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-purple-400/50 focus:ring-purple-400/20'
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {stage === 2 && (
                    <motion.div
                      key="stage2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className='space-y-4'
                    >
                      <div className='space-y-2'>
                        <label className='text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1'>Password</label>
                        <div className='relative group'>
                          <Lock className='absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors' />
                          <Input
                            type='password'
                            name='password'
                            placeholder='••••••••'
                            value={formData.password}
                            onChange={handleChange}
                            className='pl-10 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-blue-400/50 focus:ring-blue-400/20'
                          />
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <label className='text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1'>Confirm Password</label>
                        <div className='relative group'>
                          <Lock className='absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-purple-400 transition-colors' />
                          <Input
                            type='password'
                            name='repeatPassword'
                            placeholder='••••••••'
                            value={formData.repeatPassword}
                            onChange={handleChange}
                            className='pl-10 bg-white/5 border-white/10 text-white placeholder-gray-500 rounded-xl focus:border-purple-400/50 focus:ring-purple-400/20'
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className='text-red-400 text-sm text-center p-3 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl'
                  >
                    {error}
                  </motion.div>
                )}

                <div className='mt-8 space-y-3'>
                  {stage === 1 ? (
                    <Button
                      onClick={nextStage}
                      className='w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 transform hover:-translate-y-0.5'
                    >
                      <span className="flex items-center gap-2">Next Step <ArrowRight className='w-5 h-5' /></span>
                    </Button>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        onClick={prevStage}
                        variant='outline'
                        className='flex-1 py-6 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl transition-all'
                      >
                        <ArrowLeft className='w-5 h-5' />
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className='flex-[3] py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 transform hover:-translate-y-0.5'
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Creating...</span>
                          </div>
                        ) : (
                          <span className="flex items-center justify-center gap-2">Create Account <CheckCircle className='w-5 h-5' /></span>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <div className='mt-6 pt-6 border-t border-white/10 text-center text-sm'>
                  <p className='text-gray-400'>
                    Already have an account?{' '}
                    <Link to='/login' className='text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-bold hover:opacity-80 transition-opacity'>
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

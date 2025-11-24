// src/pages/Signup.jsx
import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useQuestionnaire } from '../context/QuestionnaireContext';
import { User, Mail, Lock, Phone, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';

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
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col'>
      <Navbar />
      <div className='flex-1 flex flex-col justify-center items-center px-4 py-8'>
        <div className='w-full max-w-md'>
          {/* Header */}
          <div className='text-center mb-10'>
            <h1 className='text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3'>
              Join MeetBuddy
            </h1>
            <p className='text-gray-600 text-lg'>Create an account to get started</p>
          </div>

          {/* Card */}
          <Card className='shadow-2xl border-0 bg-white overflow-hidden rounded-3xl'>
            <CardHeader className='bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-gray-200 px-8 py-6'>
              <div className='flex items-center justify-center gap-3 mb-4'>
                {currentStageConfig && React.createElement(currentStageConfig.icon, { className: 'w-7 h-7 text-blue-600' })}
              </div>
              <div className='text-center'>
                <CardTitle className='text-2xl font-bold text-gray-800'>{currentStageConfig?.title}</CardTitle>
                <p className='text-sm text-gray-600 mt-2'>{currentStageConfig?.description}</p>
              </div>
            </CardHeader>
            <CardContent className='px-8 py-8'>
              {/* Stage 1: User Info */}
              {stage === 1 && (
                <div className='space-y-6'>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-3'>
                      First Name
                    </label>
                    <Input
                      type='text'
                      name='first_name'
                      placeholder='John'
                      value={formData.first_name}
                      onChange={handleChange}
                      className='w-full h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-3'>
                      Last Name
                    </label>
                    <Input
                      type='text'
                      name='last_name'
                      placeholder='Doe'
                      value={formData.last_name}
                      onChange={handleChange}
                      className='w-full h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-3'>
                      Username
                    </label>
                    <div className='relative'>
                      <User className='absolute left-4 top-3.5 w-5 h-5 text-blue-400' />
                      <Input
                        type='text'
                        name='username'
                        placeholder='johndoe'
                        value={formData.username}
                        onChange={handleChange}
                        className='w-full pl-12 h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                      />
                    </div>
                  </div>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-3'>
                      Email
                    </label>
                    <div className='relative'>
                      <Mail className='absolute left-4 top-3.5 w-5 h-5 text-blue-400' />
                      <Input
                        type='email'
                        name='email'
                        placeholder='you@example.com'
                        value={formData.email}
                        onChange={handleChange}
                        className='w-full pl-12 h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                      />
                    </div>
                  </div>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-3'>
                      Phone Number
                    </label>
                    <div className='relative'>
                      <Phone className='absolute left-4 top-3.5 w-5 h-5 text-blue-400' />
                      <Input
                        type='tel'
                        name='phone'
                        placeholder='(555) 000-0000'
                        value={formData.phone}
                        onChange={handleChange}
                        className='w-full pl-12 h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 2: Password */}
              {stage === 2 && (
                <div className='space-y-6'>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-3'>
                      Password
                    </label>
                    <div className='relative'>
                      <Lock className='absolute left-4 top-3.5 w-5 h-5 text-blue-400' />
                      <Input
                        type='password'
                        name='password'
                        placeholder='••••••••'
                        value={formData.password}
                        onChange={handleChange}
                        className='w-full pl-12 h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                      />
                    </div>
                  </div>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-3'>
                      Confirm Password
                    </label>
                    <div className='relative'>
                      <Lock className='absolute left-4 top-3.5 w-5 h-5 text-blue-400' />
                      <Input
                        type='password'
                        name='repeatPassword'
                        placeholder='••••••••'
                        value={formData.repeatPassword}
                        onChange={handleChange}
                        className='w-full pl-12 h-12 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all'
                      />
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
              <div className='flex gap-3 mt-8'>
                {stage > 1 && (
                  <Button
                    type='button'
                    onClick={prevStage}
                    variant='outline'
                    className='flex-1 h-12 rounded-xl flex items-center justify-center gap-2 border-2 border-gray-300 hover:border-gray-400 font-semibold transition-all'
                  >
                    <ArrowLeft className='w-5 h-5' />
                    Back
                  </Button>
                )}
                {stage < 2 ? (
                  <Button
                    type='button'
                    onClick={nextStage}
                    className={`${stage === 1 ? 'flex-1' : 'flex-1'} h-12 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2`}
                  >
                    Next
                    <ArrowRight className='w-5 h-5' />
                  </Button>
                ) : (
                  <Button
                    type='submit'
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className='flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50'
                  >
                    {isLoading ? 'Creating account...' : 'Sign Up'}
                  </Button>
                )}
              </div>

              {/* Login Link */}
              <p className='text-center text-sm text-gray-600 mt-6'>
                Already have an account?{' '}
                <Link to='/login' className='text-blue-600 hover:text-blue-700 font-bold transition-colors'>
                  Login here
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Signup;

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Phone,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Eye,
  EyeOff,
  PartyPopper,
  Compass,
  HeartHandshake,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Field from '@/components/ui/Field';
import GlowButton from '@/components/ui/GlowButton';
import GlassCard from '@/components/ui/GlassCard';
import { useQuestionnaire } from '@/context/QuestionnaireContext';
import { AuthContext } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config';

const PERKS = [
  { icon: PartyPopper, text: 'Free forever for planning with friends' },
  { icon: Compass, text: 'Discover venues tuned to your group' },
  { icon: HeartHandshake, text: 'One plan everyone actually agrees on' },
];

const strengthOf = (pw) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Too short', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-orange-500' },
    { label: 'Okay', color: 'bg-yellow-500' },
    { label: 'Good', color: 'bg-emerald-500' },
    { label: 'Strong', color: 'bg-emerald-400' },
  ];
  return { score, ...levels[score] };
};

const PasswordInput = ({ label, name, value, onChange, placeholder = '••••••••', autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-12 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:border-brand/60 focus:ring-2 focus:ring-brand/30 focus:bg-white/[0.07]"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors cursor-pointer"
        >
          {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
        </button>
      </div>
    </div>
  );
};

const Signup = () => {
  const [stage, setStage] = useState(1);
  const navigate = useNavigate();
  const { resetAnswers } = useQuestionnaire();
  const { login } = React.useContext(AuthContext);
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

  const strength = strengthOf(formData.password);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateStage = () => {
    if (stage === 1) {
      if (
        !formData.first_name ||
        !formData.last_name ||
        !formData.username ||
        !formData.email ||
        !formData.phone
      ) {
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
        // Register with AuthContext so protected routes see the new user
        // immediately (writing localStorage alone leaves context state null)
        login(data, data.token || 'mock-token');
        navigate('/questionnaire-stage1');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">

      <div className="min-h-screen flex items-center justify-center px-4 pt-28 pb-16">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* ---------- Brand panel (desktop only) ---------- */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block"
          >
            <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.08] mb-6">
              Your best plans
              <br />
              <span className="text-gradient">start here.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-md">
              One account, endless great nights. Tell us your vibe once and
              MeetBuddy handles the "where should we go?" forever.
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
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard variant="gradient" className="p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-brand/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-brand-2/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              <div className="relative z-10">
                <div className="text-center mb-7">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 220, delay: 0.15 }}
                    className="w-14 h-14 bg-gradient-to-br from-brand to-brand-2 rounded-2xl mx-auto flex items-center justify-center mb-4 glow-sm"
                  >
                    <Sparkles className="w-7 h-7 text-white" />
                  </motion.div>
                  <h2 className="text-3xl font-bold text-white mb-1.5">Create account</h2>
                  <p className="text-muted-foreground">
                    {stage === 1 ? 'Tell us who you are' : 'Now secure your account'}
                  </p>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 mb-8">
                  {[1, 2].map((s) => (
                    <div key={s} className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
                          initial={false}
                          animate={{ width: stage >= s ? '100%' : '0%' }}
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                      <p
                        className={`text-[11px] mt-1.5 font-medium tracking-wide uppercase ${
                          stage >= s ? 'text-brand-3' : 'text-muted-foreground/50'
                        }`}
                      >
                        {s === 1 ? 'About you' : 'Security'}
                      </p>
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {stage === 1 && (
                    <motion.div
                      key="stage1"
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <Field
                          label="First Name"
                          name="first_name"
                          placeholder="John"
                          value={formData.first_name}
                          onChange={handleChange}
                          icon={<User className="w-4 h-4" />}
                        />
                        <Field
                          label="Last Name"
                          name="last_name"
                          placeholder="Doe"
                          value={formData.last_name}
                          onChange={handleChange}
                          icon={<User className="w-4 h-4" />}
                        />
                      </div>
                      <Field
                        label="Username"
                        name="username"
                        placeholder="johndoe"
                        value={formData.username}
                        onChange={handleChange}
                        icon={<User className="w-4 h-4" />}
                        autoComplete="username"
                      />
                      <Field
                        label="Email"
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        icon={<Mail className="w-4 h-4" />}
                        autoComplete="email"
                      />
                      <Field
                        label="Phone"
                        type="tel"
                        name="phone"
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={handleChange}
                        icon={<Phone className="w-4 h-4" />}
                        autoComplete="tel"
                      />
                    </motion.div>
                  )}

                  {stage === 2 && (
                    <motion.div
                      key="stage2"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <PasswordInput
                        label="Password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                      />

                      {/* Strength meter */}
                      {formData.password && (
                        <div>
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4].map((seg) => (
                              <motion.div
                                key={seg}
                                className={`h-1 flex-1 rounded-full ${
                                  strength.score >= seg ? strength.color : 'bg-white/10'
                                }`}
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ delay: seg * 0.05 }}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Password strength:{' '}
                            <span className="text-white font-medium">{strength.label}</span>
                          </p>
                        </div>
                      )}

                      <PasswordInput
                        label="Confirm Password"
                        name="repeatPassword"
                        value={formData.repeatPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
                      />
                      {formData.repeatPassword &&
                        formData.password === formData.repeatPassword && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-emerald-400 flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Passwords match
                          </motion.p>
                        )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm text-center p-3 mt-4 bg-destructive/10 border border-destructive/25 rounded-xl"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="mt-8">
                  {stage === 1 ? (
                    <GlowButton onClick={nextStage} size="lg" className="w-full">
                      Next step <ArrowRight className="w-5 h-5" />
                    </GlowButton>
                  ) : (
                    <div className="flex gap-3">
                      <GlowButton
                        onClick={prevStage}
                        variant="ghost"
                        size="lg"
                        aria-label="Back"
                        className="flex-1"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </GlowButton>
                      <GlowButton
                        onClick={handleSubmit}
                        disabled={isLoading}
                        size="lg"
                        className="flex-[3]"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            Create account <CheckCircle className="w-5 h-5" />
                          </>
                        )}
                      </GlowButton>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 text-center text-sm">
                  <p className="text-muted-foreground">
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="text-brand-3 font-bold hover:opacity-80 transition-opacity"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Signup;

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Store,
  Phone,
  ShieldCheck,
  KeyRound,
  Sparkles,
  LogIn,
  UserPlus,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';

export default function AuthModal({ onAuthenticated }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'

  // Supabase cloud connection state
  const [testingBackend, setTestingBackend] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);

  const handleSaveAndTestBackend = async () => {
    setTestingBackend(true);
    setBackendStatus(null);
    try {
      const res = await api.testBackendConnection();
      if (res.ok) {
        setBackendStatus({ ok: true, message: 'Connected to Supabase PostgreSQL cloud database successfully!' });
        setError('');
      } else {
        setBackendStatus({ ok: false, message: `Could not connect to Supabase: ${res.error}` });
      }
    } catch (e) {
      setBackendStatus({ ok: false, message: e.message });
    } finally {
      setTestingBackend(false);
    }
  };

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup form state
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    name: '',
    shop_name: 'MS Store',
    phone: '',
  });
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      const userSession = await api.login(email, password);
      onAuthenticated(userSession);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup submission
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const email = signupData.email.trim().toLowerCase();
    const password = signupData.password.trim();
    const confirmPassword = signupData.confirm_password.trim();
    const name = signupData.name.trim();
    const shopName = signupData.shop_name.trim();
    const phone = signupData.phone.trim();

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address (e.g. name@gmail.com).');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    if (!name) {
      setError('Please enter your full name.');
      return;
    }

    try {
      setLoading(true);
      const userSession = await api.signup({
        email,
        password,
        name,
        shop_name: shopName || 'MS Store',
        phone,
      });
      onAuthenticated(userSession);
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/60 preserve-3d">
        {/* Decorative Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* Top Header Logo */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 text-white shadow-xl shadow-indigo-600/30 mb-2 preserve-3d">
            <Sparkles className="w-7 h-7 animate-pulse" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight m-0">
            {activeTab === 'login' ? 'Welcome Back to MS Store' : 'Create Store Owner Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm m-0">
            {activeTab === 'login'
              ? 'Log in with your Email ID and Password to load your store data.'
              : 'Sign up once to create your store ID. Access your store from any device.'}
          </p>
        </div>

        {/* Tabs: Log In vs Sign Up */}
        <div className="flex items-center gap-1 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700 mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'login'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Log In to My ID</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'signup'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Sign Up (New Store)</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Log In Form */}
        {activeTab === 'login' && (
          <form noValidate onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Your Email ID / Gmail *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-indigo-400" />
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@gmail.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-indigo-400" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition transform active:scale-[0.98] disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Logging in...' : 'Log In & Open Store'}</span>
            </button>

            <div className="pt-2 text-center text-xs text-slate-400">
              Don't have an ID yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setError('');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold underline ml-1"
              >
                Sign up here
              </button>
            </div>
          </form>
        )}

        {/* 2. Sign Up Form */}
        {activeTab === 'signup' && (
          <form noValidate onSubmit={handleSignupSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Your Email / Gmail Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-indigo-400" />
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@gmail.com"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Password & Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Create Password *
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 4 characters"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-3 w-4 h-4 text-emerald-400" />
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={signupData.confirm_password}
                    onChange={(e) => setSignupData({ ...signupData, confirm_password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Name & Shop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Owner Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mugesh"
                    value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Shop / Business Name *
                </label>
                <div className="relative">
                  <Store className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="MS Store"
                    value={signupData.shop_name}
                    onChange={(e) => setSignupData({ ...signupData, shop_name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Contact Phone / WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={signupData.phone}
                  onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 pt-1 m-0">
              🔒 Your inventory items, bills, and profit reports are saved safely under your registered Email ID.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition transform active:scale-[0.98] disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>{loading ? 'Creating Account...' : 'Sign Up & Open Terminal'}</span>
            </button>

            <div className="pt-2 text-center text-xs text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setError('');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold underline ml-1"
              >
                Log in here
              </button>
            </div>
          </form>
        )}

        {/* Supabase Cloud Database Status */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cloud Database:</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Supabase PostgreSQL
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 truncate flex items-center justify-between gap-2 mt-1">
            <span className="truncate">{api.getEffectiveBase()}</span>
            <button
              type="button"
              disabled={testingBackend}
              onClick={handleSaveAndTestBackend}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline flex-shrink-0 flex items-center gap-1 disabled:opacity-50"
            >
              {testingBackend ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              <span>{testingBackend ? 'Checking...' : 'Test Connection'}</span>
            </button>
          </div>

          {backendStatus && (
            <div
              className={`mt-2 text-[11px] p-2 rounded-xl flex items-center gap-1.5 ${
                backendStatus.ok
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}
            >
              {backendStatus.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />}
              <span>{backendStatus.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  UserCheck,
  UserPlus,
  Phone,
  Mail,
  User,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAuth, isAdminIdentifier } from '../context/AuthContext.tsx';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
  initialMode?: 'login' | 'signup';
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  isMandatory = false,
  initialMode = 'login',
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginUser, signupUser, user, admin } = useAuth();

  // If admin is authenticated, route immediately to admin portal
  useEffect(() => {
    if (admin) {
      if (isOpen) {
        onClose();
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/admin') {
        navigate('/admin');
      }
    } else if (user) {
      if (isOpen) {
        onClose();
      }
    }
  }, [user, admin, isOpen, onClose, navigate]);

  // Allow closing on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();
        const trimmedEmail = email.trim();
        const trimmedPass = password.trim();

        if (!trimmedName || !trimmedPhone) {
          throw new Error('Full Name and Phone Number are required.');
        }

        const res = await signupUser(
          trimmedName,
          trimmedPhone,
          trimmedEmail || undefined,
          trimmedPass || undefined
        );

        if (res?.admin || res?.isAdmin) {
          onClose();
          navigate('/admin');
          return;
        }

        setSuccessMsg('Account created successfully!');
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 300);
      } else {
        const trimmedId = identifier.trim();
        const trimmedPass = password.trim();

        if (!trimmedId) {
          throw new Error('Email or Phone Number is required.');
        }

        const res = await loginUser(trimmedId, trimmedPass || undefined);

        if (res?.admin || res?.isAdmin) {
          onClose();
          navigate('/admin');
          return;
        }

        setSuccessMsg('Signed in successfully!');
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 300);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 ${
        isMandatory ? 'bg-slate-950/80 backdrop-blur-md' : 'bg-slate-900/60 backdrop-blur-sm'
      } animate-fade-in`}
    >
      <div
        id="user-auth-modal"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden text-slate-900 ring-1 ring-slate-900/10"
      >
        {/* Mandatory Lock Notice Badge */}
        {isMandatory && (
          <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between gap-3 text-amber-950">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
              </span>
              <span className="text-xs font-bold tracking-tight">Login Required</span>
            </div>
            <span className="text-[11px] text-amber-900 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-full">
              Required for Purchases
            </span>
          </div>
        )}

        {/* Header - Fixed at Top */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl ${isMandatory ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-800 border border-slate-200'}`}>
              {isMandatory ? (
                <ShieldAlert className="w-5 h-5 text-amber-700" />
              ) : mode === 'login' ? (
                <UserCheck className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                {mode === 'login' ? 'User & Admin Sign In' : 'Create New Account'}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {isMandatory
                  ? 'Please sign in or register to browse and purchase items'
                  : mode === 'login'
                  ? 'Sign in with your Email / Phone & Password'
                  : 'Quick registration to download & unlock'}
              </p>
            </div>
          </div>
          {/* Close button is always visible so user can exit full screen modal anytime */}
          <button
            type="button"
            id="close-auth-modal-btn"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-6 py-4 space-y-4">
          {/* Tab switch */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              id="auth-tab-login"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="auth-tab-signup"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pb-2" autoComplete="off">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {mode === 'login' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address or Mobile Number <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    id="auth-identifier-input"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="Enter email or 03XXXXXXXXX"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              {isAdminIdentifier(identifier) && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Authorized Admin Account:</span>
                    <span className="ml-1 text-amber-800">You will be logged in and routed directly to the Admin Portal.</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password <span className="text-slate-400 font-normal">(Optional for regular users, required for Admin)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="auth-password-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password (optional)"
                    autoComplete="current-password"
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-9 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    id="auth-name-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    autoComplete="name"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    id="auth-phone-input"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    autoComplete="tel"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    id="auth-email-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="auth-password-signup-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Set password (optional)"
                    autoComplete="new-password"
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-9 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {(isAdminIdentifier(email) || isAdminIdentifier(phone) || isAdminIdentifier(name)) && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Authorized Admin Account:</span>
                    <span className="ml-1 text-amber-800">You will be logged in and routed directly to the Admin Portal.</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              id="auth-submit-btn"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Please wait...</span>
              ) : mode === 'login' ? (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              id="dismiss-auth-modal-btn"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium hover:underline transition-all cursor-pointer"
            >
              Browse items first without signing in
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};


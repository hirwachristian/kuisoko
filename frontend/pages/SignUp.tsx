

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch } from '../api';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const SignUp: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  const { signup, t } = useAppContext();
  const navigate = useNavigate();

  // Live, debounced "is this username taken" check - mirrors the Instagram/X pattern of showing
  // availability (and alternatives) as the person types, instead of only failing at submit time.
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3) {
      setUsernameStatus('idle');
      setUsernameSuggestions([]);
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameSuggestions([]);
      return;
    }

    setUsernameStatus('checking');
    const handle = window.setTimeout(async () => {
      try {
        const result = await apiFetch<{ available: boolean; suggestions?: string[] }>(
          `/auth/check-username?username=${encodeURIComponent(trimmed)}`
        );
        if (result.available) {
          setUsernameStatus('available');
          setUsernameSuggestions([]);
        } else {
          setUsernameStatus('taken');
          setUsernameSuggestions(result.suggestions ?? []);
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);

    return () => window.clearTimeout(handle);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      alert(t('auth_agree_terms_alert'));
      return;
    }
    // Already known to be taken/invalid client-side - don't round-trip to the server just to
    // get the same "already exists" answer back.
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      return;
    }

    const success = await signup(fullName, username, email, phoneNumber, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
        <div>
          <h2 className="text-center text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">
            {t('auth_join_title')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {t('auth_join_subtitle')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="full-name" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_full_name')}
              </label>
              <input
                id="full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm transition-all bg-white"
                placeholder={t('dashboard_enter_full_name')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_username')}
              </label>
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                  title={t('auth_username_hint')}
                  className={`appearance-none rounded-xl relative block w-full px-5 py-3 pr-10 border placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all bg-white ${
                    usernameStatus === 'taken' || usernameStatus === 'invalid'
                      ? 'border-rose-300 focus:ring-rose-600'
                      : usernameStatus === 'available'
                      ? 'border-emerald-300 focus:ring-emerald-800'
                      : 'border-slate-200 focus:ring-emerald-800'
                  }`}
                  placeholder={t('auth_username_placeholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <span className="absolute inset-y-0 right-3 flex items-center">
                  {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-slate-400" />}
                  {usernameStatus === 'available' && <Check size={16} className="text-emerald-600" />}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <X size={16} className="text-rose-500" />}
                </span>
              </div>
              {usernameStatus === 'taken' ? (
                <div className="mt-1.5">
                  <p className="text-xs font-semibold text-rose-600">{t('auth_username_taken')}</p>
                  {usernameSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {usernameSuggestions.map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion}
                          onClick={() => setUsername(suggestion)}
                          className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : usernameStatus === 'available' ? (
                <p className="mt-1.5 text-xs font-semibold text-emerald-600">{t('auth_username_available')}</p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">{t('auth_username_hint')}</p>
              )}
            </div>
            <div>
              <label htmlFor="email-address" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_email')}
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm transition-all bg-white"
                placeholder={t('dashboard_enter_email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="phone-number" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_phone_number')}
              </label>
              <input
                id="phone-number"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm transition-all bg-white"
                placeholder={t('auth_enter_phone')}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm pr-12 transition-all bg-white"
                  placeholder={t('auth_create_password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? t('auth_hide_password') : t('auth_show_password')}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center mt-6">
            <input
              id="agree-to-terms"
              name="agree-to-terms"
              type="checkbox"
              required
              className="h-4 w-4 text-emerald-800 focus:ring-emerald-700 border-slate-300 rounded accent-emerald-800"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
            />
            <label htmlFor="agree-to-terms" className="ml-3 block text-sm text-slate-600">
              {t('auth_agree_terms_prefix')}{' '}
              <Link to="#" className="font-bold text-emerald-800 hover:text-emerald-900 transition-colors">
                {t('auth_terms_of_service')}
              </Link>{' '}
              {t('auth_and')}{' '}
              <Link to="#" className="font-bold text-emerald-800 hover:text-emerald-900 transition-colors">
                {t('auth_privacy_policy')}
              </Link>
              .
            </label>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={usernameStatus === 'taken' || usernameStatus === 'invalid'}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 transition-all shadow-lg shadow-emerald-800/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {t('auth_create_account')}
            </button>
          </div>
        </form>

        <div className="text-center text-sm mt-6">
          <p className="text-slate-600">
            {t('auth_already_have_account')}{' '}
            <Link to="/signin" className="font-bold text-emerald-800 hover:text-emerald-900 transition-colors">
              {t('auth_sign_in')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;

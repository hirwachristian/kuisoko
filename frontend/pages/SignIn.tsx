

import React, { useState } from 'react';
// Fix: Ensure correct `react-router-dom` named imports for v6+.
// The existing import statement is correct for `react-router-dom` v6+.
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG'; // Import the new SVG logo component
import { useAppContext } from '../context/AppContext'; // Import AppContext

const SignIn: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, user, t, twoFactorPending, verifyTwoFactorCode, resendTwoFactorCode, cancelTwoFactorLogin } = useAppContext();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(identifier, password);
    if (!success) {
      setError(t('auth_invalid_credentials'));
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    setIsVerifying(true);
    const success = await verifyTwoFactorCode(code.trim());
    setIsVerifying(false);
    if (!success) {
      setCodeError('Invalid or expired code. Please try again.');
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    await resendTwoFactorCode();
    setIsResending(false);
  };

  // Redirect after user state updates from successful login
  React.useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'rider') {
        navigate('/rider');
      } else {
        navigate('/'); // Redirect regular users to the homepage
      }
    }
  }, [user, navigate]);

  if (twoFactorPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <div>
            <Link to="/" className="flex items-center gap-3 group justify-center">
              <KuISOKOLogoSVG className="h-14 w-auto" />
            </Link>
            <h2 className="mt-8 text-center text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">
              Enter your verification code
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              We sent a 6-digit code to <span className="font-semibold">{twoFactorPending.email}</span>
            </p>
          </div>
          <form className="space-y-5" onSubmit={handleVerifyCode}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full text-center tracking-[0.5em] text-2xl font-bold px-5 py-4 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent transition-all bg-white"
            />
            {codeError && (
              <div className="text-sm text-red-600 text-center" role="alert">{codeError}</div>
            )}
            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full flex justify-center py-3.5 px-4 text-lg font-bold rounded-2xl text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 transition-all shadow-lg shadow-emerald-800/20 active:scale-95 disabled:opacity-60"
            >
              {isVerifying ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </form>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-semibold text-emerald-800 hover:text-emerald-900 transition-colors disabled:opacity-60"
            >
              {isResending ? 'Sending...' : 'Resend code'}
            </button>
            <button
              type="button"
              onClick={cancelTwoFactorLogin}
              className="font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
        <div>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group justify-center">
            <KuISOKOLogoSVG className="h-14 w-auto" /> {/* Integrated SVG Logo */}
          </Link>
          <h2 className="mt-10 text-center text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">
            {t('auth_welcome_back')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {t('auth_sign_in_subtitle')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-or-username" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_email_or_username')}
              </label>
              <input
                id="email-or-username"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm transition-all bg-white"
                placeholder={t('auth_email_or_username_placeholder')}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  {t('auth_password')}
                </label>
                <Link to="/forgot-password" className="text-sm font-semibold text-emerald-800 hover:text-emerald-900 transition-colors">
                  {t('auth_forgot_password')}
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm pr-12 transition-all bg-white"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 text-center mt-4" role="alert">
              {error}
            </div>
          )}

          <div className="mt-6">
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 transition-all shadow-lg shadow-emerald-800/20 active:scale-95"
            >
              {t('auth_sign_in')}
            </button>
          </div>
        </form>

        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-slate-200" />
          <span className="flex-shrink mx-4 text-sm text-slate-400 font-semibold">{t('auth_or')}</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        <div className="text-center text-sm">
          <p className="text-slate-600">
            {t('auth_no_account')}{' '}
            <Link to="/signup" className="font-bold text-emerald-800 hover:text-emerald-900 transition-colors">
              {t('auth_sign_up_free')}
            </Link>
          </p>
        </div>

        <div className="flex justify-center space-x-6 mt-12 text-xs text-slate-500 font-medium">
          <Link to="#" className="hover:text-slate-700 transition-colors">{t('auth_privacy_policy')}</Link>
          <Link to="#" className="hover:text-slate-700 transition-colors">{t('auth_terms_of_service')}</Link>
          <Link to="#" className="hover:text-slate-700 transition-colors">{t('auth_help_center')}</Link>
        </div>
      </div>
    </div>
  );
};

export default SignIn;

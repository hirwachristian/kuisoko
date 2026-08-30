import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';
import { apiFetch, ApiError } from '../api';
import { useAppContext } from '../context/AppContext';

const ResetPassword: React.FC = () => {
  const { t } = useAppContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(t('auth_password_min_length'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth_passwords_dont_match'));
      return;
    }

    setStatus('loading');
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : t('auth_something_wrong_retry'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100">
        <div>
          <Link to="/" className="flex items-center gap-3 group justify-center">
            <KuISOKOLogoSVG className="h-14 w-auto" />
          </Link>
          <h2 className="mt-10 text-center text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">
            {t('auth_reset_password_title')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {t('auth_reset_password_subtitle')}
          </p>
        </div>

        {!token ? (
          <div className="text-center space-y-6">
            <p className="text-sm text-red-600">{t('auth_reset_missing_token')}</p>
            <Link to="/forgot-password" className="inline-block font-bold text-emerald-800 hover:text-emerald-900 transition-colors">
              {t('auth_request_new_link')}
            </Link>
          </div>
        ) : status === 'done' ? (
          <div className="text-center space-y-6">
            <p className="text-sm text-slate-600">{t('auth_reset_success')}</p>
            <button
              onClick={() => navigate('/signin')}
              className="w-full py-3.5 rounded-2xl text-lg font-bold text-white bg-emerald-800 hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-800/20 active:scale-95"
            >
              {t('auth_sign_in')}
            </button>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_new_password')}
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm pr-12 transition-all bg-white"
                  placeholder={t('auth_at_least_8_chars')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_confirm_new_password')}
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm transition-all bg-white"
                placeholder={t('auth_reenter_password')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 transition-all shadow-lg shadow-emerald-800/20 active:scale-95 disabled:opacity-60"
            >
              {status === 'loading' ? t('auth_resetting') : t('auth_reset_password_button')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;

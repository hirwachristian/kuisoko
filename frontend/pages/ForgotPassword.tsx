import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';
import { apiFetch, ApiError } from '../api';
import { useAppContext } from '../context/AppContext';

const ForgotPassword: React.FC = () => {
  const { t } = useAppContext();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatus('sent');
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
            {t('auth_forgot_password_title')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {t('auth_forgot_password_subtitle')}
          </p>
        </div>

        {status === 'sent' ? (
          <div className="text-center space-y-6">
            <p className="text-sm text-slate-600">
              {t('auth_reset_link_sent', { email })}
            </p>
            <Link to="/signin" className="inline-block font-bold text-emerald-800 hover:text-emerald-900 transition-colors">
              {t('auth_back_to_sign_in')}
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
                placeholder={t('auth_enter_email_placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {status === 'error' && (
              <div className="text-sm text-red-600 text-center" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 transition-all shadow-lg shadow-emerald-800/20 active:scale-95 disabled:opacity-60"
            >
              {status === 'loading' ? t('auth_sending') : t('auth_send_reset_link')}
            </button>

            <div className="text-center text-sm">
              <Link to="/signin" className="font-bold text-emerald-800 hover:text-emerald-900 transition-colors">
                {t('auth_back_to_sign_in')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;

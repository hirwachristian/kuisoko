import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';
import { apiFetch, ApiError } from '../api';
import { useAppContext } from '../context/AppContext';

type Step = 'enter-username' | 'confirm' | 'sent';

const ForgotPassword: React.FC = () => {
  const { t } = useAppContext();
  const [username, setUsername] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [step, setStep] = useState<Step>('enter-username');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const result = await apiFetch<{ maskedEmail: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      setMaskedEmail(result.maskedEmail);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth_something_wrong_retry'));
    } finally {
      setStatus('idle');
    }
  };

  const handleConfirmSend = async () => {
    setStatus('loading');
    setError('');
    try {
      await apiFetch('/auth/forgot-password/confirm', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      setStep('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth_something_wrong_retry'));
    } finally {
      setStatus('idle');
    }
  };

  const handleUseDifferentUsername = () => {
    setStep('enter-username');
    setMaskedEmail('');
    setError('');
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
            {step === 'enter-username' && t('auth_forgot_password_subtitle')}
            {step === 'confirm' && t('auth_forgot_password_confirm_subtitle')}
            {step === 'sent' && t('auth_reset_link_sent')}
          </p>
        </div>

        {step === 'sent' ? (
          <div className="text-center space-y-6">
            <Link to="/signin" className="inline-block font-bold text-emerald-800 hover:text-emerald-900 transition-colors">
              {t('auth_back_to_sign_in')}
            </Link>
          </div>
        ) : step === 'confirm' ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-4 text-center">
              <p className="text-sm text-slate-600">{t('auth_forgot_password_send_to')}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{maskedEmail}</p>
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center" role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmSend}
              disabled={status === 'loading'}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-lg font-bold rounded-2xl text-white bg-emerald-800 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 transition-all shadow-lg shadow-emerald-800/20 active:scale-95 disabled:opacity-60"
            >
              {status === 'loading' ? t('auth_sending') : t('auth_send_reset_link')}
            </button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={handleUseDifferentUsername}
                className="font-bold text-emerald-800 hover:text-emerald-900 transition-colors"
              >
                {t('auth_use_different_username')}
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleLookup}>
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2">
                {t('auth_username')}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={20}
                className="appearance-none rounded-xl relative block w-full px-5 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800 focus:border-transparent text-sm transition-all bg-white"
                placeholder={t('auth_username_placeholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
              {status === 'loading' ? t('auth_sending') : t('auth_continue')}
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

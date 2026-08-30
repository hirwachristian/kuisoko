import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';
import { apiFetch, ApiError } from '../api';
import { useAppContext } from '../context/AppContext';

const ConfirmEmailChange: React.FC = () => {
  const { t } = useAppContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setStatus('loading');
    setError('');
    try {
      await apiFetch('/users/email-change/confirm', {
        method: 'POST',
        body: JSON.stringify({ token }),
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
            {t('email_change_confirm_title')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {t('email_change_confirm_subtitle')}
          </p>
        </div>

        {!token ? (
          <p className="text-sm text-red-600 text-center">{t('email_change_missing_token')}</p>
        ) : status === 'done' ? (
          <div className="text-center space-y-6">
            <p className="text-sm text-slate-600">{t('email_change_success')}</p>
            <button
              onClick={() => navigate('/signin')}
              className="w-full py-3.5 rounded-2xl text-lg font-bold text-white bg-emerald-800 hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-800/20 active:scale-95"
            >
              {t('auth_sign_in')}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-6">
            {error && (
              <div className="text-sm text-red-600" role="alert">
                {error}
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={status === 'loading'}
              className="w-full py-3.5 rounded-2xl text-lg font-bold text-white bg-emerald-800 hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-800/20 active:scale-95 disabled:opacity-60"
            >
              {status === 'loading' ? t('email_change_confirming') : t('email_change_confirm_button')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfirmEmailChange;

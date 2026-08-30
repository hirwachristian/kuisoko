import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api';

const Unsubscribe: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleUnsubscribe = async () => {
    setStatus('loading');
    try {
      await apiFetch('/newsletter/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      {status === 'done' ? (
        <>
          <h1 className="text-2xl font-black text-slate-900 dark:text-emerald-50 mb-4">You're unsubscribed</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">{email} will no longer receive KuISOKO announcement emails.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black text-slate-900 dark:text-emerald-50 mb-4">Unsubscribe from KuISOKO emails?</h1>
          {email ? (
            <>
              <p className="text-slate-500 dark:text-slate-400 mb-8">{email}</p>
              {status === 'error' && <p className="text-rose-600 dark:text-rose-400 mb-4">{error}</p>}
              <button
                onClick={handleUnsubscribe}
                disabled={status === 'loading'}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg transition-all disabled:opacity-60"
              >
                {status === 'loading' ? 'Unsubscribing...' : 'Confirm Unsubscribe'}
              </button>
            </>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 mb-8">No email address was provided in this link.</p>
          )}
        </>
      )}
      <div className="mt-8">
        <Link to="/" className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline">Back to home</Link>
      </div>
    </div>
  );
};

export default Unsubscribe;

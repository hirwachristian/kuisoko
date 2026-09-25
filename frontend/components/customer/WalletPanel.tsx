import React, { useEffect, useRef, useState } from 'react';
import { Wallet, Download, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Smartphone } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { apiFetch, ApiError, API_BASE_URL } from '../../api';
import { getPageNumbers } from '../../utils';
import DashboardPagination from '../DashboardPagination';
import MtnBadge from '../MtnBadge';

interface WalletSummary {
  balance: number;
  pendingDeposits: number;
  lifetimeTopups: number;
}

interface WalletTransaction {
  id: string;
  type: 'topup' | 'purchase' | 'refund';
  amount: number;
  balanceAfter: number;
  reference: string | null;
  description: string;
  createdAt: string;
}

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000];
const TRANSACTIONS_PER_PAGE = 8;

const TYPE_META: Record<WalletTransaction['type'], { icon: React.ElementType; color: string; sign: string }> = {
  topup: { icon: ArrowDownToLine, color: 'text-emerald-600 dark:text-emerald-400', sign: '+' },
  refund: { icon: RotateCcw, color: 'text-emerald-600 dark:text-emerald-400', sign: '+' },
  purchase: { icon: ArrowUpFromLine, color: 'text-slate-700 dark:text-slate-300', sign: '-' },
};

// Ports frontend/pages/CartCheckout.tsx's mobile-money approval-prompt flow (request -> poll ->
// settle) for a wallet top-up instead of an order payment - same state machine, same modal shape,
// pointed at /api/wallet/topup/* instead of /api/momo|paypack/*.
const WalletPanel: React.FC = () => {
  const { user, token, getFormattedPrice, t } = useAppContext();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | WalletTransaction['type']>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [provider, setProvider] = useState<'momo' | 'paypack'>('momo');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [amount, setAmount] = useState<string>('10000');
  const [topupFlow, setTopupFlow] = useState<'idle' | 'requesting' | 'awaiting-approval' | 'failed' | 'error'>('idle');
  const [topupError, setTopupError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  const load = async () => {
    if (!token) return;
    try {
      const [summaryRes, txRes] = await Promise.all([
        apiFetch<WalletSummary>('/wallet', {}, token),
        apiFetch<{ transactions: WalletTransaction[] }>('/wallet/transactions', {}, token),
      ]);
      setSummary(summaryRes);
      setTransactions(txRes.transactions);
    } catch {
      // Silently retried by the next render/action - a failed load here isn't a hard error the
      // customer needs to acknowledge, and the page below just shows nothing until it succeeds.
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const pollTopupStatus = async (reference: string) => {
    const maxAttempts = 40; // ~2 minutes at 3s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (cancelledRef.current) return;
      try {
        const { status } = await apiFetch<{ status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' }>(`/wallet/topup/status/${reference}`, {}, token);
        if (cancelledRef.current) return;
        if (status === 'SUCCESSFUL') {
          setTopupFlow('idle');
          load();
          return;
        }
        if (status === 'FAILED') {
          setTopupFlow('failed');
          return;
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setTopupFlow('error');
        setTopupError(e instanceof ApiError ? e.message : t('wallet_something_wrong'));
        return;
      }
    }
    setTopupFlow('failed');
    setTopupError(t('wallet_topup_timeout'));
  };

  const startTopup = async () => {
    const amountNum = parseFloat(amount);
    if (!phone.trim() || isNaN(amountNum) || amountNum <= 0) return;
    setTopupFlow('requesting');
    setTopupError(null);
    try {
      const { referenceId } = await apiFetch<{ referenceId: string }>(
        provider === 'momo' ? '/wallet/topup/momo' : '/wallet/topup/paypack',
        { method: 'POST', body: JSON.stringify({ phoneNumber: phone, amount: amountNum }) },
        token
      );
      setTopupFlow('awaiting-approval');
      await pollTopupStatus(referenceId);
    } catch (e) {
      setTopupFlow('error');
      setTopupError(e instanceof ApiError ? e.message : t('wallet_something_wrong'));
    }
  };

  const handleExportStatement = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/wallet/transactions/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kuisoko-wallet-statement.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Nothing actionable beyond letting the customer try again - the click is the only signal.
    }
  };

  const filteredTransactions = typeFilter === 'all' ? transactions : transactions.filter((tx) => tx.type === typeFilter);
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * TRANSACTIONS_PER_PAGE,
    currentPage * TRANSACTIONS_PER_PAGE
  );

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-center py-14">
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-8 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('wallet_available_balance')}</span>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-emerald-50 mt-2 tracking-tight">
                {getFormattedPrice(summary?.balance ?? 0)}
              </div>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet size={20} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t('wallet_pending_deposits')}</span>
              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-100 mt-0.5">{getFormattedPrice(summary?.pendingDeposits ?? 0)}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t('wallet_lifetime_topups')}</span>
              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-100 mt-0.5">{getFormattedPrice(summary?.lifetimeTopups ?? 0)}</div>
            </div>
          </div>
        </div>
        <button
          onClick={handleExportStatement}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-8 shadow-sm flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300 hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          <Download size={22} />
          <span className="text-sm font-bold text-center">{t('wallet_download_statement')}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-8 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-50">{t('wallet_topup_title')}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5 sm:mb-6">{t('wallet_topup_subtitle')}</p>

        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-2">{t('wallet_select_operator')}</label>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {(['momo', 'paypack'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 text-left transition ${provider === p ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-slate-600'}`}
            >
              {p === 'momo' ? <MtnBadge /> : (
                <span className="inline-flex items-center justify-center bg-rose-600 text-white font-black text-[10px] tracking-tight rounded-md px-2 py-1 leading-none shadow-sm">AIR</span>
              )}
              <div>
                <span className="block text-sm font-bold text-slate-900 dark:text-emerald-100">{p === 'momo' ? t('wallet_mtn_momo') : t('wallet_airtel_money')}</span>
                <span className="block text-xs text-slate-400 dark:text-slate-500">{t('wallet_instant_processing')}</span>
              </div>
            </button>
          ))}
        </div>

        <label htmlFor="walletPhone" className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-2">{t('wallet_phone_number')}</label>
        <input
          id="walletPhone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XXXXXXXX"
          className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100 mb-5"
        />

        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-2">{t('wallet_select_amount')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              className={`py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition ${amount === String(preset) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-200'}`}
            >
              {preset.toLocaleString()}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t('wallet_custom_amount_placeholder')}
          className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100 mb-6"
        />

        <button
          onClick={startTopup}
          disabled={topupFlow !== 'idle' || !phone.trim() || !amount}
          className="w-full sm:w-auto px-8 py-3 sm:py-3.5 rounded-xl bg-orange-500 text-white text-sm sm:text-base font-bold hover:bg-orange-600 transition-all shadow-lg active:scale-95 disabled:opacity-60"
        >
          {t('wallet_authorize_deposit')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-50">{t('wallet_transaction_history')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('wallet_transaction_history_subtitle')}</p>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as typeof typeFilter); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">{t('wallet_type_all')}</option>
            <option value="topup">{t('wallet_type_topup')}</option>
            <option value="purchase">{t('wallet_type_purchase')}</option>
            <option value="refund">{t('wallet_type_refund')}</option>
          </select>
        </div>

        {paginatedTransactions.length === 0 ? (
          <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-10">{t('wallet_no_transactions')}</p>
        ) : (
          <div className="space-y-2">
            {paginatedTransactions.map((tx) => {
              const meta = TYPE_META[tx.type];
              const Icon = meta.icon;
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className={`w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-950 flex items-center justify-center shrink-0 ${meta.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-emerald-100 truncate">{tx.description}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(tx.createdAt).toLocaleString('en-RW', { timeZone: 'Africa/Kigali', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${meta.color}`}>{meta.sign} {getFormattedPrice(tx.amount)}</span>
                </div>
              );
            })}
          </div>
        )}

        <DashboardPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredTransactions.length}
          itemsPerPage={TRANSACTIONS_PER_PAGE}
          itemLabel={t('wallet_transactions_count_label')}
          showingLabel={(start, end, total, label) => t('dashboard_showing_range', { start, end, total, label })}
        />
      </div>

      {topupFlow !== 'idle' && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-8 max-w-sm w-full text-center shadow-2xl">
            {(topupFlow === 'requesting' || topupFlow === 'awaiting-approval') && (
              <>
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                  <Smartphone size={24} className="sm:w-7 sm:h-7 text-emerald-700 dark:text-emerald-400" />
                </div>
                {provider === 'momo' && <MtnBadge className="mb-3" />}
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-50 mb-2">{t('wallet_check_phone')}</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {topupFlow === 'requesting' ? t('wallet_sending_prompt') : t('wallet_awaiting_approval', { amount: getFormattedPrice(parseFloat(amount) || 0), phone })}
                </p>
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              </>
            )}
            {topupFlow === 'failed' && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-rose-600 mb-2">{t('wallet_not_approved')}</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">{topupError || t('wallet_declined')}</p>
                <div className="flex gap-3">
                  <button onClick={() => setTopupFlow('idle')} className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300">{t('cart_close')}</button>
                  <button onClick={startTopup} className="flex-1 py-2.5 sm:py-3 rounded-xl bg-orange-500 text-white text-sm sm:text-base font-bold hover:bg-orange-600 transition-all">{t('cart_try_again')}</button>
                </div>
              </>
            )}
            {topupFlow === 'error' && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-rose-600 mb-2">{t('wallet_something_wrong')}</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">{topupError}</p>
                <button onClick={() => setTopupFlow('idle')} className="w-full py-2.5 sm:py-3 rounded-xl bg-slate-900 text-white text-sm sm:text-base font-bold">{t('cart_close')}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPanel;

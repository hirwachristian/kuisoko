import React, { useState, useEffect } from 'react';
import { Ticket, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import { Coupon } from '../types';
import { formatDate } from '../utils';

const AdminManageCoupons: React.FC = () => {
  const { token, showToast, getFormattedPrice } = useAppContext();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCoupons = async () => {
    try {
      const { coupons: fetched } = await apiFetch<{ coupons: Coupon[] }>('/coupons', {}, token);
      setCoupons(fetched);
    } catch (e) {
      console.error('Error fetching coupons:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setCode('');
    setDiscountType('percentage');
    setDiscountValue('');
    setMinOrderAmount('');
    setUsageLimit('');
    setExpiresAt('');
    setFormError(null);
  };

  const handleCreate = async () => {
    setFormError(null);
    const value = parseFloat(discountValue);
    if (!code.trim()) return setFormError('Code is required.');
    if (isNaN(value) || value <= 0) return setFormError('Discount value must be greater than 0.');
    if (discountType === 'percentage' && value > 100) return setFormError('A percentage discount cannot exceed 100.');

    setIsCreating(true);
    try {
      const { coupon } = await apiFetch<{ coupon: Coupon }>('/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim(),
          discountType,
          discountValue: value,
          minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
          usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      }, token);
      setCoupons(prev => [coupon, ...prev]);
      showToast(`Coupon "${coupon.code}" created.`, 'success');
      resetForm();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Could not create coupon.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const { coupon: updated } = await apiFetch<{ coupon: Coupon }>(`/coupons/${coupon.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !coupon.isActive }),
      }, token);
      setCoupons(prev => prev.map(c => (c.id === coupon.id ? updated : c)));
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update coupon.', 'error');
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/coupons/${coupon.id}`, { method: 'DELETE' }, token);
      setCoupons(prev => prev.filter(c => c.id !== coupon.id));
      showToast(`Coupon "${coupon.code}" deleted.`, 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete coupon.', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 mb-2">Coupons</h2>
        <p className="text-slate-600 dark:text-emerald-300 text-xs sm:text-sm max-w-xl">Create and manage promo codes customers can apply at checkout.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
        <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-emerald-50 mb-4 sm:mb-6 flex items-center gap-2">
          <Ticket size={18} className="sm:w-5 sm:h-5 text-orange-500" /> New Coupon
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SAVE20"
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Discount type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount (RWF)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">
              Discount value {discountType === 'percentage' ? '(%)' : '(RWF)'}
            </label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? '20' : '5000'}
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Min. order (RWF, optional)</label>
            <input
              type="number"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              placeholder="0"
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Usage limit (optional)</label>
            <input
              type="number"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Unlimited"
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Expires (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
            />
          </div>
        </div>
        {formError && <p className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm mb-4">{formError}</p>}
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-bold bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-all disabled:opacity-60"
        >
          {isCreating ? 'Creating...' : 'Create Coupon'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Code</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Discount</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Min. Order</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Usage</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Expires</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Active</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-500 dark:text-emerald-300">Loading...</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-500 dark:text-emerald-300">No coupons yet.</td></tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold text-slate-900 dark:text-emerald-50 whitespace-nowrap">{coupon.code}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-emerald-200 whitespace-nowrap">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : getFormattedPrice(coupon.discountValue)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-emerald-200 whitespace-nowrap">
                      {Number(coupon.minOrderAmount) > 0 ? getFormattedPrice(coupon.minOrderAmount) : '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-emerald-200 whitespace-nowrap">
                      {coupon.usageCount}{coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-600 dark:text-emerald-200">
                      {coupon.expiresAt ? formatDate(coupon.expiresAt) : 'No expiry'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <input type="checkbox" checked={coupon.isActive} onChange={() => handleToggleActive(coupon)} />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                      <button
                        onClick={() => handleDelete(coupon)}
                        className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        aria-label={`Delete ${coupon.code}`}
                      >
                        <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminManageCoupons;

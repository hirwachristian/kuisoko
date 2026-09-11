import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Users, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import AddressForm, { AddressFormHandle } from '../components/AddressForm';
import WhatsAppIcon from '../components/WhatsAppIcon';

interface GroupOrderInfo {
  code: string;
  status: 'open' | 'full' | 'expired';
  expiresAt: string;
  maxParticipants: number;
  tiers: { minParticipants: number; discountPercent: number }[];
  participantCount: number;
  currentDiscountPercent: number;
  product: { id: string; name: string; image: string; price: number; discount: number };
}

const GroupOrderPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const { getFormattedPrice, showToast, token, t } = useAppContext();
  const [group, setGroup] = useState<GroupOrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const joinFormDataRef = useRef<any>(null);
  const joinFormRef = useRef<AddressFormHandle>(null);

  const fetchGroup = useCallback(async () => {
    if (!code) return;
    try {
      const data = await apiFetch<GroupOrderInfo>(`/group-orders/${code}`);
      setGroup(data);
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchGroup();
    // Polls while the tab is open so the progress bar/tier badges reflect others joining live,
    // without needing a websocket layer for something this low-frequency.
    const interval = setInterval(fetchGroup, 8000);
    return () => clearInterval(interval);
  }, [fetchGroup]);

  const handleJoin = async (addressData: any) => {
    if (!addressData || !group) return;
    setIsJoining(true);
    try {
      await apiFetch(`/group-orders/${group.code}/join`, {
        method: 'POST',
        body: JSON.stringify({ customerName: addressData.fullName, deliveryAddress: addressData }),
      }, token);
      setJoined(true);
      fetchGroup();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not join this group order.', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" aria-label="Loading" />
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 sm:py-24 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-emerald-50 mb-3">{t('group_buy_not_found')}</h2>
        <Link to="/shop" className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline">{t('cart_start_shopping')}</Link>
      </div>
    );
  }

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(t('group_buy_share_message', { product: group.product.name, url: window.location.href }))}`;
  const hoursLeft = Math.max(0, Math.ceil((new Date(group.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));
  const discountedPrice = group.product.price * (1 - group.product.discount / 100) * (1 - group.currentDiscountPercent / 100);

  return (
    <div className="max-w-lg mx-auto px-4 py-10 sm:py-16">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-8 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-4 mb-6">
          <img src={group.product.image} alt={group.product.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain bg-white border border-slate-100 dark:border-slate-800 p-1.5 shrink-0" />
          <div className="min-w-0">
            <h2 className="font-bold text-base sm:text-lg text-emerald-900 dark:text-emerald-50 truncate">{group.product.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {getFormattedPrice(discountedPrice)}
              {group.currentDiscountPercent > 0 && (
                <span className="line-through ml-2 text-slate-400 dark:text-slate-500">{getFormattedPrice(group.product.price * (1 - group.product.discount / 100))}</span>
              )}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-emerald-200 mb-2">
            <span className="flex items-center gap-1.5"><Users size={16} /> {t('group_buy_participants', { count: group.participantCount, max: group.maxParticipants })}</span>
            {group.status === 'open' && (
              <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-semibold text-xs"><Clock size={14} /> {t('group_buy_time_left', { hours: hoursLeft })}</span>
            )}
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.min(100, (group.participantCount / group.maxParticipants) * 100)}%` }} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {group.tiers.map((tier) => (
              <span
                key={tier.minParticipants}
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${group.participantCount >= tier.minParticipants ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                {t('group_buy_tier_label', { count: tier.minParticipants, percent: tier.discountPercent })}
              </span>
            ))}
          </div>
        </div>

        {group.status === 'full' && <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-4">{t('group_buy_full')}</p>}
        {group.status === 'expired' && <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">{t('group_buy_expired')}</p>}

        {joined ? (
          <div className="text-center py-4">
            <CheckCircle size={40} className="text-emerald-600 mx-auto mb-3" />
            <p className="font-bold text-emerald-900 dark:text-emerald-50">{t('group_buy_joined')}</p>
          </div>
        ) : group.status === 'open' ? (
          showJoinForm ? (
            <>
              <AddressForm ref={joinFormRef} setAddressData={(d) => { joinFormDataRef.current = d; }} onProceed={() => handleJoin(joinFormDataRef.current)} />
              <button
                onClick={() => joinFormRef.current?.submit()}
                disabled={isJoining}
                className="w-full mt-4 py-3 sm:py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all active:scale-95 disabled:opacity-60"
              >
                {isJoining ? t('cart_placing_order') : t('group_buy_join_button')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowJoinForm(true)}
              className="w-full py-3 sm:py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all active:scale-95"
            >
              {t('group_buy_join_button')}
            </button>
          )
        ) : (
          <Link to={`/product/${group.product.id}`} className="block w-full text-center py-3 sm:py-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all">
            {t('group_buy_start_own')}
          </Link>
        )}

        {group.status === 'open' && !joined && (
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all"
          >
            <WhatsAppIcon size={16} /> {t('group_buy_share_whatsapp')}
          </a>
        )}
      </div>
    </div>
  );
};

export default GroupOrderPage;

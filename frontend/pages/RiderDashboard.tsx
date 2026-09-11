import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bike, LogOut, MapPin, Phone, Package, LocateFixed, Navigation, KeyRound, CheckCircle2, History } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { usePolling } from '../hooks/usePolling';
import { apiFetch, ApiError } from '../api';
import DeliveryMap, { MapPoint } from '../components/DeliveryMap';

interface ReassignedNotice {
  id: string;
  orderNumber: string;
  reassignedAt: string;
  newRiderName: string | null;
}

interface RiderOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryPhoneNumber: string;
  deliveryStreetAddress: string;
  deliveryCityTown: string;
  deliveryDistrict: string;
  deliveryAdditionalInfo: string | null;
  destination: MapPoint | null;
  acceptedAt: string | null;
}

interface RiderHistoryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryStreetAddress: string;
  deliveryCityTown: string;
  deliveryDistrict: string;
  deliveredAt: string | null;
}

// Throttles how often a moving rider's phone actually POSTs a new position - watchPosition can
// fire far more often than that (every meter of movement), and there's no benefit to sending it
// faster than the customer's map polls for it.
const LOCATION_POST_THROTTLE_MS = 5000;

const RiderDashboard: React.FC = () => {
  const { user, token, logout, t, showToast } = useAppContext();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [riderPosition, setRiderPosition] = useState<MapPoint | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [history, setHistory] = useState<RiderHistoryOrder[] | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const shownReassignmentIdsRef = useRef<Set<string>>(new Set());

  const fetchOrders = () => {
    return apiFetch<{ orders: RiderOrder[] }>('/riders/me/orders', {}, token)
      .then(({ orders: fetched }) => setOrders(fetched))
      .catch((e) => console.error('Could not load assigned deliveries:', e))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!user || user.role !== 'rider') return;
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  // Keeps the assigned-deliveries list fresh on its own, so an order the admin reassigns away
  // from this rider disappears (and the toast below fires) without needing a manual reload.
  usePolling(() => {
    if (!user || user.role !== 'rider') return;
    fetchOrders();
  }, 15000);

  // A short-lived, server-side "this was just taken from you" feed - deduped locally (per tab
  // session) so the same transfer doesn't toast again on every poll within its 10-minute window.
  usePolling(() => {
    if (!user || user.role !== 'rider') return;
    apiFetch<{ notices: ReassignedNotice[] }>('/riders/me/reassigned-notices', {}, token)
      .then(({ notices }) => {
        for (const notice of notices) {
          if (shownReassignmentIdsRef.current.has(notice.id)) continue;
          shownReassignmentIdsRef.current.add(notice.id);
          showToast(
            t('rider_order_reassigned_away', { orderNumber: notice.orderNumber, name: notice.newRiderName || t('rider_another_rider') }),
            'info'
          );
        }
      })
      .catch((e) => console.error('Could not check reassignment notices:', e));
  }, 15000);

  // History is only ever fetched once, the first time the rider actually opens that tab - no
  // point loading a rider's past deliveries for the common case where they never check it.
  useEffect(() => {
    if (activeTab !== 'history' || history !== null || !user || user.role !== 'rider') return;
    setIsHistoryLoading(true);
    apiFetch<{ orders: RiderHistoryOrder[] }>('/riders/me/history', {}, token)
      .then(({ orders: fetched }) => setHistory(fetched))
      .catch((e) => console.error('Could not load delivery history:', e))
      .finally(() => setIsHistoryLoading(false));
  }, [activeTab, history, user, token]);

  const postLocation = (lat: number, lng: number) => {
    apiFetch('/riders/me/location', {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    }, token).catch((e) => console.error('Could not send location:', e));
  };

  // Tells the backend sharing has paused - keeps the rider's last known position on file but
  // flags it as not live, and alerts the admin on any of this rider's still-in-progress
  // deliveries. `keepalive` lets this survive a `pagehide` fetch fired as the tab is actually
  // closing (unlike a plain fetch, which the browser can cut off mid-flight during unload).
  const notifyStoppedSharing = () => {
    apiFetch('/riders/me/stop-sharing', { method: 'POST', keepalive: true }, token)
      .catch((e) => console.error('Could not notify stop-sharing:', e));
  };

  const stopSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      notifyStoppedSharing();
    }
    setIsSharing(false);
  };

  const startSharing = () => {
    if (!navigator.geolocation) {
      setGeoError(t('rider_location_unsupported'));
      return;
    }
    setGeoError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        // Updating the on-screen map isn't throttled (it's purely local) - only the POST to the
        // backend is, since that's what the customer/admin actually poll for.
        setRiderPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
        const now = Date.now();
        if (now - lastSentAtRef.current < LOCATION_POST_THROTTLE_MS) return;
        lastSentAtRef.current = now;
        postLocation(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError(t('rider_location_permission_denied'));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGeoError(t('rider_location_unavailable'));
        } else {
          setGeoError(t('rider_location_error'));
        }
        stopSharing();
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    setIsSharing(true);
  };

  const toggleSharing = () => {
    if (isSharing) stopSharing();
    else startSharing();
  };

  // Stop the browser's GPS watch if the rider navigates away within the app while sharing.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // A component-unmount cleanup isn't reliably run when the tab/app is actually closed (the JS
  // context can be torn down before React gets to it) - `pagehide` fires in that case too, so
  // this is the backstop that makes sure the admin/customer aren't left thinking a rider who just
  // closed their browser mid-delivery is still live.
  useEffect(() => {
    const handlePageHide = () => {
      if (watchIdRef.current !== null) notifyStoppedSharing();
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = async (orderId: string) => {
    setAcceptingId(orderId);
    try {
      await apiFetch(`/riders/me/orders/${orderId}/accept`, { method: 'POST' }, token);
      await fetchOrders();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not accept this delivery.', 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleVerifyDelivery = async (orderId: string) => {
    if (!verifyCode.trim()) return;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      await apiFetch(`/riders/me/orders/${orderId}/verify-delivery`, {
        method: 'POST',
        body: JSON.stringify({ code: verifyCode.trim() }),
      }, token);
      showToast(t('rider_delivery_confirmed'), 'success');
      setVerifyCode('');
      setHistory(null); // invalidate - the just-completed delivery should show up next time History is opened
      await fetchOrders();
    } catch (e) {
      setVerifyError(e instanceof ApiError ? e.message : 'Could not verify this code.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!user || user.role !== 'rider') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-900 px-4 text-center">
        {t('rider_unauthorized')}{' '}
        <Link to="/signin" className="text-emerald-600 underline ml-1">{t('nav_sign_in')}</Link>.
      </div>
    );
  }

  const currentOrder = orders.find((o) => o.acceptedAt) ?? null;
  const queuedOrders = orders.filter((o) => o.id !== currentOrder?.id);

  return (
    <div className="min-h-screen bg-[#FBF8F2] dark:bg-slate-950 text-slate-900 dark:text-emerald-50">
      <header className="flex items-center justify-between px-4 sm:px-6 h-16 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <span className="flex items-center gap-2 font-black">
          <Bike size={20} className="text-emerald-700 dark:text-emerald-400" /> {t('rider_dashboard_title')}
        </span>
        <button
          onClick={() => { stopSharing(); logout(); navigate('/'); }}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
        >
          <LogOut size={16} /> {t('dashboard_logout')}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 flex gap-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            activeTab === 'active' ? 'bg-emerald-700 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Bike size={15} /> {t('rider_tab_active')}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            activeTab === 'history' ? 'bg-emerald-700 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <History size={15} /> {t('rider_tab_history')}
        </button>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'history' ? (
          <>
            <h2 className="font-bold text-slate-900 dark:text-emerald-50 mb-3">{t('rider_tab_history')}</h2>
            {isHistoryLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('rider_loading')}</p>
            ) : !history || history.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 text-center">
                <History size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('rider_history_empty')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((order) => (
                  <div key={order.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-900 dark:text-emerald-50 text-sm">#{order.orderNumber} — {order.customerName}</p>
                      {order.deliveredAt && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                          {new Date(order.deliveredAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {order.deliveryStreetAddress}, {order.deliveryCityTown}, {order.deliveryDistrict}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : currentOrder ? (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-6 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900 dark:text-emerald-50">{t('rider_share_location_title')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('rider_share_location_subtitle')}</p>
                </div>
                <button
                  onClick={toggleSharing}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    isSharing
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  <LocateFixed size={16} className={isSharing ? 'animate-pulse' : ''} />
                  {isSharing ? t('rider_stop_sharing') : t('rider_start_sharing')}
                </button>
              </div>
              {geoError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">{geoError}</p>}
            </div>

            <h2 className="font-bold text-slate-900 dark:text-emerald-50 mb-3">{t('rider_current_delivery')}</h2>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-5 mb-6">
              <p className="font-bold text-slate-900 dark:text-emerald-50">#{currentOrder.orderNumber} — {currentOrder.customerName}</p>
              <p className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300 mt-2">
                <MapPin size={15} className="shrink-0 mt-0.5" />
                <span>
                  {currentOrder.deliveryStreetAddress}, {currentOrder.deliveryCityTown}, {currentOrder.deliveryDistrict}
                  {currentOrder.deliveryAdditionalInfo ? ` — ${currentOrder.deliveryAdditionalInfo}` : ''}
                </span>
              </p>
              <a href={`tel:${currentOrder.deliveryPhoneNumber}`} className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 font-semibold mt-2">
                <Phone size={15} /> {currentOrder.deliveryPhoneNumber}
              </a>

              {riderPosition ? (
                <div className="mt-3">
                  <DeliveryMap
                    livePosition={riderPosition}
                    isLive={isSharing}
                    destination={currentOrder.destination}
                    className="w-full h-48 rounded-xl overflow-hidden"
                  />
                  {currentOrder.destination && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${currentOrder.destination.lat},${currentOrder.destination.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 mt-2 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors"
                    >
                      <Navigation size={16} /> {t('rider_open_in_maps')}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">{t('rider_start_sharing_to_navigate')}</p>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-emerald-300 mb-1.5">
                  <KeyRound size={13} /> {t('rider_verify_code_label')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={verifyCode}
                    onChange={(e) => { setVerifyCode(e.target.value); setVerifyError(null); }}
                    placeholder={t('rider_verify_code_placeholder')}
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600"
                  />
                  <button
                    onClick={() => handleVerifyDelivery(currentOrder.id)}
                    disabled={isVerifying || !verifyCode.trim()}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> {t('rider_verify_code_button')}
                  </button>
                </div>
                {verifyError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{verifyError}</p>}
              </div>
            </div>

            {queuedOrders.length > 0 && (
              <>
                <h2 className="font-bold text-slate-900 dark:text-emerald-50 mb-3">{t('rider_up_next')}</h2>
                <div className="space-y-2">
                  {queuedOrders.map((order) => (
                    <div key={order.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      #{order.orderNumber} — {order.customerName}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="font-bold text-slate-900 dark:text-emerald-50 mb-3">{t('rider_active_deliveries')}</h2>
            {isLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('rider_loading')}</p>
            ) : orders.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 text-center">
                <Package size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('rider_no_deliveries')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-5">
                    <p className="font-bold text-slate-900 dark:text-emerald-50">#{order.orderNumber} — {order.customerName}</p>
                    <p className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300 mt-2">
                      <MapPin size={15} className="shrink-0 mt-0.5" />
                      <span>
                        {order.deliveryStreetAddress}, {order.deliveryCityTown}, {order.deliveryDistrict}
                        {order.deliveryAdditionalInfo ? ` — ${order.deliveryAdditionalInfo}` : ''}
                      </span>
                    </p>
                    <a href={`tel:${order.deliveryPhoneNumber}`} className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 font-semibold mt-2">
                      <Phone size={15} /> {order.deliveryPhoneNumber}
                    </a>
                    <button
                      onClick={() => handleAccept(order.id)}
                      disabled={acceptingId === order.id}
                      className="w-full mt-3 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
                    >
                      {t('rider_accept_delivery')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default RiderDashboard;

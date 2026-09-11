import React, { useEffect, useState } from 'react';
import { Bike, MapPinOff, Truck, ArrowLeftRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { usePolling } from '../hooks/usePolling';
import { apiFetch } from '../api';
import DeliveryMap, { MapPoint } from './DeliveryMap';

interface RiderLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

interface RiderLocationResponse {
  riderId: string | null;
  riderName: string | null;
  location: RiderLocation | null;
  isSharing: boolean;
  destination: MapPoint | null;
  arrivalNotifiedAt: string | null;
  riderReassignedAt: string | null;
}

const POLL_MS = 6000;
// A ping is expected roughly every 5s while the rider is actively sharing (throttled client-side)
// - anything older than this, even if the server still thinks sharing is "on", almost certainly
// means their connection dropped or the tab/app closed without an explicit stop. Treating that the
// same as an explicit stop (last known position + a "not live" notice) covers both cases with one
// rule instead of only reacting to the button tap.
const STALE_AFTER_MS = 30000;

interface RiderLocationMapProps {
  orderId: string;
  riderName?: string | null;
}

const RiderLocationMap: React.FC<RiderLocationMapProps> = ({ orderId, riderName }) => {
  const { token, t, footerSettings } = useAppContext();
  const [location, setLocation] = useState<RiderLocation | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [arrivalNotifiedAt, setArrivalNotifiedAt] = useState<string | null>(null);
  const [riderReassignedAt, setRiderReassignedAt] = useState<string | null>(null);
  const [resolvedRiderName, setResolvedRiderName] = useState<string | null | undefined>(riderName);

  const fetchLocation = () => {
    apiFetch<RiderLocationResponse>(`/orders/${orderId}/rider-location`, {}, token)
      .then((data) => {
        setLocation(data.location);
        setIsSharing(data.isSharing);
        setDestination(data.destination);
        setArrivalNotifiedAt(data.arrivalNotifiedAt);
        setRiderReassignedAt(data.riderReassignedAt);
        setResolvedRiderName(data.riderName);
      })
      .catch((e) => console.error('Could not fetch rider location:', e));
  };

  const isStale = location ? Date.now() - new Date(location.updatedAt).getTime() > STALE_AFTER_MS : false;
  const isLive = isSharing && !isStale;
  const store: MapPoint | null = footerSettings.storeLat != null && footerSettings.storeLng != null
    ? { lat: footerSettings.storeLat, lng: footerSettings.storeLng }
    : null;

  // usePolling doesn't fire on mount - this covers the initial fetch, matching every other
  // call site of the hook in this app.
  useEffect(() => {
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  usePolling(fetchLocation, POLL_MS);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-emerald-50 mb-4">
        <Bike size={18} className="text-emerald-700 dark:text-emerald-400" />
        {resolvedRiderName
          ? t('order_rider_tracking_title', { name: resolvedRiderName })
          : t('order_rider_tracking_title_generic')}
      </h3>
      {riderReassignedAt && resolvedRiderName && (
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <ArrowLeftRight size={16} />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-emerald-50">
            {t('order_reassigned_message', { name: resolvedRiderName })}
          </p>
        </div>
      )}
      {arrivalNotifiedAt && (
        <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900 rounded-xl px-4 py-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 animate-pulse">
            <Truck size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-emerald-50">{t('order_arrival_title')}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{t('order_arrival_message')}</p>
          </div>
        </div>
      )}
      {location ? (
        <>
          {!isLive && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold rounded-xl px-3.5 py-2.5 mb-3">
              <MapPinOff size={15} className="shrink-0 mt-0.5" />
              <span>
                {t('order_rider_tracking_paused')}{' '}
                <span className="font-normal opacity-80">
                  {t('order_rider_tracking_last_seen', {
                    time: new Date(location.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  })}
                </span>
              </span>
            </div>
          )}
          <DeliveryMap livePosition={location} isLive={isLive} store={store} destination={destination} />
        </>
      ) : (
        <div className="w-full h-64 sm:h-80 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-center px-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('order_rider_tracking_waiting')}</p>
        </div>
      )}
    </div>
  );
};

export default RiderLocationMap;

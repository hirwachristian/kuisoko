
import React, { useState, useEffect } from 'react';
import { Send, Users } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import AdminPaymentMethods from '../components/AdminPaymentMethods';
import { apiFetch, ApiError } from '../api';
import { formatDate } from '../utils';

const AdminBusinessAndNotifications: React.FC = () => {
  const { showToast, token, subscriberNotifications, siteAnnouncements: contextBanners } = useAppContext();
  const [banners, setBanners] = useState(contextBanners);
  useEffect(() => { setBanners(contextBanners); }, [contextBanners]);

  // Notifications State
  const [emailOrderUpdates, setEmailOrderUpdates] = useState(true);
  const [marketingEmailsEnabled, setMarketingEmailsEnabled] = useState(true);
  const [isSavingToggle, setIsSavingToggle] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await apiFetch<{ marketingEmailsEnabled: boolean }>('/settings/app');
        if (!cancelled) setMarketingEmailsEnabled(settings.marketingEmailsEnabled);
      } catch (e) {
        console.error('Error fetching app settings:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleTogglePushAlerts = async (checked: boolean) => {
    setMarketingEmailsEnabled(checked); // optimistic
    setIsSavingToggle(true);
    try {
      await apiFetch('/settings/app', {
        method: 'PATCH',
        body: JSON.stringify({ marketingEmailsEnabled: checked }),
      }, token);
      showToast(checked ? 'Push Alerts enabled.' : 'Push Alerts disabled.', 'success');
    } catch (e) {
      setMarketingEmailsEnabled(!checked); // revert
      showToast(e instanceof ApiError ? e.message : 'Could not update Push Alerts.', 'error');
    } finally {
      setIsSavingToggle(false);
    }
  };

  const handleSave = () => {
    showToast('Business & Notification settings saved!', 'success');
  };

  // Announcement composer state
  const [announcementSubject, setAnnouncementSubject] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [showAsBanner, setShowAsBanner] = useState(false);
  const [bannerDurationHours, setBannerDurationHours] = useState<string>(''); // '' = no expiry
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

  const handleSendAnnouncement = async () => {
    if (!announcementSubject.trim() || !announcementMessage.trim()) {
      showToast('Please fill in both the subject and message.', 'error');
      return;
    }
    setIsSendingAnnouncement(true);
    const durationHours = bannerDurationHours ? Number(bannerDurationHours) : null;
    try {
      const result = await apiFetch<{ sent: number; total: number; banner: { id: string; message: string; expiresAt: string | null; createdAt: string } | null }>('/announcements/send', {
        method: 'POST',
        body: JSON.stringify({
          subject: announcementSubject,
          message: announcementMessage,
          showAsBanner,
          bannerDurationHours: durationHours,
        }),
      }, token);
      showToast(
        showAsBanner
          ? `Sent to ${result.sent} of ${result.total} subscribers and posted as a site banner.`
          : `Announcement sent to ${result.sent} of ${result.total} subscribers.`,
        'success'
      );
      if (result.banner) {
        setBanners(prev => [result.banner!, ...prev]);
      }
      setAnnouncementSubject('');
      setAnnouncementMessage('');
      setShowAsBanner(false);
      setBannerDurationHours('');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not send the announcement.', 'error');
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  const [togglingBannerId, setTogglingBannerId] = useState<string | null>(null);

  const handleTurnOffBanner = async (id: string) => {
    setTogglingBannerId(id);
    try {
      await apiFetch(`/announcements/banners/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }, token);
      setBanners(prev => prev.filter(b => b.id !== id));
      showToast('Site banner turned off.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not turn off the banner.', 'error');
    } finally {
      setTogglingBannerId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-emerald-50 mb-2">Business & Notifications</h2>
        <p className="text-slate-600 dark:text-emerald-300 text-sm max-w-xl">Configure payment gateways and notification preferences.</p>
      </div>

      <AdminPaymentMethods />

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-6">Notification Preferences</h3>
        <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-emerald-100">
          <span>Order Updates via Email</span>
          <input type="checkbox" checked={emailOrderUpdates} onChange={(e) => setEmailOrderUpdates(e.target.checked)} />
        </div>
        <div className="flex items-center justify-between py-4 text-slate-700 dark:text-emerald-100">
          <div>
            <span>Push Alerts</span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Lets you email discounts & specials to everyone in the "inner circle" newsletter below.</p>
          </div>
          <input
            type="checkbox"
            checked={marketingEmailsEnabled}
            disabled={isSavingToggle}
            onChange={(e) => handleTogglePushAlerts(e.target.checked)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-2 flex items-center gap-2">
          <Users size={20} className="text-orange-500" /> Subscribers
          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">({subscriberNotifications.length})</span>
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Everyone who's joined the "inner circle" newsletter and can receive announcement emails.
        </p>
        {subscriberNotifications.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">No subscribers yet.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {subscriberNotifications.map((subscriber) => (
              <div key={subscriber.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-semibold text-slate-800 dark:text-emerald-100">{subscriber.email}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(subscriber.subscribedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-2 flex items-center gap-2">
          <Send size={20} className="text-orange-500" /> Send Announcement
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Email a discount or special offer to every active newsletter subscriber. Requires Push Alerts to be enabled above.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-emerald-300 mb-2">Subject</label>
            <input
              type="text"
              value={announcementSubject}
              onChange={(e) => setAnnouncementSubject(e.target.value)}
              placeholder="20% off this weekend only!"
              className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-emerald-300 mb-2">Message</label>
            <textarea
              value={announcementMessage}
              onChange={(e) => setAnnouncementMessage(e.target.value)}
              rows={5}
              placeholder="Tell your subscribers what's new..."
              className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm resize-y text-slate-900 dark:text-emerald-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-emerald-100 cursor-pointer">
            <input type="checkbox" checked={showAsBanner} onChange={(e) => setShowAsBanner(e.target.checked)} />
            Also add to the site banners ("Subject: Message", shown above the navbar to every visitor - multiple can be live at once)
          </label>
          {showAsBanner && (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-emerald-300 mb-2">Banner duration</label>
              <select
                value={bannerDurationHours}
                onChange={(e) => setBannerDurationHours(e.target.value)}
                className="w-full sm:w-64 px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
              >
                <option value="">No expiry (until manually turned off)</option>
                <option value="1">1 hour</option>
                <option value="6">6 hours</option>
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
              </select>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Only you can remove the banner early - visitors can't dismiss it themselves.
              </p>
            </div>
          )}
          <button
            onClick={handleSendAnnouncement}
            disabled={isSendingAnnouncement}
            className="px-6 py-3 rounded-xl font-bold bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-all disabled:opacity-60"
          >
            {isSendingAnnouncement ? 'Sending...' : 'Send'}
          </button>

          {banners.length > 0 && (
            <div className="space-y-3 mt-4">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Live site banners ({banners.length})
              </p>
              {banners.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                      {b.expiresAt ? `Expires ${formatDate(b.expiresAt)}` : 'No expiry'}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-emerald-100">{b.message}</p>
                  </div>
                  <button
                    onClick={() => handleTurnOffBanner(b.id)}
                    disabled={togglingBannerId === b.id}
                    className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
                  >
                    {togglingBannerId === b.id ? 'Turning off...' : 'Turn off'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button onClick={handleSave} className="px-6 py-3 rounded-xl font-bold bg-orange-500 text-white shadow-lg">Save Changes</button>
    </div>
  );
};

export default AdminBusinessAndNotifications;

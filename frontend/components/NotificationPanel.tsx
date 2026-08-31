

import React, { useState } from 'react';
import { X, ShoppingCart, User, Bell, Star, Mail, Trash2, CheckCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface NotificationPanelProps {
  onClose: () => void;
}

// Per-type color, mirroring the pattern already used for the dashboard's stat cards - the icon
// badge color is the primary visual cue for what kind of notification this is, at a glance.
const NOTIFICATION_STYLES = {
  order: { icon: ShoppingCart, bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400' },
  user: { icon: User, bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-400' },
  review: { icon: Star, bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400' },
  subscriber: { icon: Mail, bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400' },
} as const;

const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const {
    orders, allUsers, reviewNotifications, subscriberNotifications, getFormattedPrice,
    markAllNotificationsAsRead, hiddenNotificationIds, hideNotification, bulkHideNotifications,
    markUserAsRead, markOrderAsRead, markReviewAsRead, markSubscriberAsRead,
  } = useAppContext();
  const navigate = useNavigate();
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  // This panel is `position: fixed`, but it renders as a descendant of AdminLayout's <main>,
  // which is itself a scrolling container (overflow-y-auto). iOS Safari has a long-standing bug
  // where a fixed element nested inside a scrolling ancestor doesn't reliably stay pinned to the
  // viewport - if the admin had scrolled the dashboard down before opening this, the panel (close
  // button included) can render shifted or partly off-screen. Locking scroll while it's open is
  // the same fix already used for the navbar menu and the shop's mobile filters drawer.
  useBodyScrollLock(true);

  const formatTime = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";

    const hhmm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    let ago = "";
    if (diffMins < 1) ago = "Just now";
    else if (diffMins < 60) ago = `${diffMins}m ago`;
    else if (diffHours < 24) ago = `${diffHours}h ago`;
    else ago = `${Math.floor(diffHours / 24)}d ago`;

    return `${hhmm} • ${ago}`;
  };

  const toggleSelectNotification = (id: string) => {
    setSelectedNotifications(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const notifications = [
    ...orders.map(order => ({
      id: `order-${order.id}`,
      type: 'order' as const,
      title: 'New Order Received',
      body: `#${order.orderNumber || order.id} from ${order.customerName}. Total: ${getFormattedPrice(order.total)}`,
      timestamp: formatTime(order.date),
      actionLabel: 'View Order',
      actionLink: '/admin/orders',
      unread: order.unread ?? true,
      onClick: () => markOrderAsRead(order.id)
    })),
    ...allUsers.map(user => ({
      id: `user-${user.id}`,
      type: 'user' as const,
      title: 'New Registration',
      body: `${user.name} just joined Kuisoko.`,
      timestamp: formatTime(user.registrationDate || new Date().toISOString()),
      actionLabel: 'View Profile',
      actionLink: '/admin/users',
      unread: user.unread ?? true,
      onClick: () => markUserAsRead(user.id)
    })),
    ...reviewNotifications.map(review => ({
      id: `review-${review.id}`,
      type: 'review' as const,
      title: 'New Product Review',
      body: `${review.userName} rated "${review.productName}" ${review.rating}★${review.comment ? `: "${review.comment}"` : ''}`,
      timestamp: formatTime(review.date),
      actionLabel: 'View Review',
      actionLink: `/product/${review.productId}`,
      unread: review.unread ?? true,
      onClick: () => markReviewAsRead(review.id)
    })),
    ...subscriberNotifications.map(subscriber => ({
      id: `subscriber-${subscriber.id}`,
      type: 'subscriber' as const,
      title: 'New Newsletter Subscriber',
      body: `${subscriber.email} joined the inner circle.`,
      timestamp: formatTime(subscriber.subscribedAt),
      actionLabel: 'Send Announcement',
      actionLink: '/admin/settings/business-notifications',
      unread: subscriber.unread ?? true,
      onClick: () => markSubscriberAsRead(subscriber.id)
    }))
  ].filter(n => !hiddenNotificationIds.includes(n.id))
   .sort((a, b) => (a.unread === b.unread ? 0 : a.unread ? -1 : 1));

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleDeleteSelected = () => {
    bulkHideNotifications(selectedNotifications);
    setSelectedNotifications([]);
  };

  return (
    <>
      {/* Backdrop - click anywhere outside the panel to dismiss it */}
      <motion.div
        className="fixed inset-0 bg-slate-900/40 z-40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Sliding sidebar - enters from the right edge, exits back off-screen to the right */}
      <motion.div
        className="fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
      >
        {/* Title row: just the heading + close button, on their own row so the close button is
            never squeezed out by the action links below (which can wrap freely on narrow screens
            without ever risking the one control every user needs to be able to reach). */}
        <div className="flex justify-between items-center gap-3 px-4 sm:px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-50">Notifications</h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-90 transition-all shrink-0"
            aria-label="Close notifications"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action row - separate from the title row above, wraps independently on narrow screens */}
        <div className="flex items-center justify-end gap-1 px-4 sm:px-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex-wrap">
          {selectedNotifications.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 px-2 py-1 rounded-lg transition-colors"
            >
              <Trash2 size={13} /> Delete ({selectedNotifications.length})
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={markAllNotificationsAsRead}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 px-2 py-1 rounded-lg transition-colors"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-4">
              <Bell size={26} />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">You're all caught up</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">New orders, reviews, and sign-ups will show up here.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2.5 sm:space-y-3">
            {notifications.map(notif => {
              const style = NOTIFICATION_STYLES[notif.type];
              const Icon = style.icon;
              return (
                <div
                  key={notif.id}
                  className={`flex gap-2.5 sm:gap-3 p-2.5 sm:p-3 border rounded-xl sm:rounded-2xl transition-colors ${
                    notif.unread
                      ? 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                      : 'border-slate-100 dark:border-slate-800 opacity-70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedNotifications.includes(notif.id)}
                    onChange={() => toggleSelectNotification(notif.id)}
                    className="mt-1.5 shrink-0 accent-emerald-700"
                    aria-label={`Select notification: ${notif.title}`}
                  />
                  <div className={`p-2 rounded-full h-fit shrink-0 ${style.bg} ${style.text}`}>
                    <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-emerald-50 flex items-center gap-1.5">
                        {notif.title}
                        {notif.unread && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">{notif.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 mb-2 line-clamp-2">{notif.body}</p>
                    <div className="flex gap-2">
                      <button
                        className="text-[11px] sm:text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors"
                        onClick={() => {
                          notif.onClick();
                          navigate(notif.actionLink);
                          onClose();
                        }}
                      >
                        {notif.actionLabel}
                      </button>
                      <button
                        onClick={() => hideNotification(notif.id)}
                        className="text-[11px] sm:text-xs font-semibold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* A large, labeled close bar pinned to the bottom - the small corner X icon has been
            reported as hard to find on some phones, so this gives every viewer an unmissable,
            full-width, text-labeled way to dismiss the panel regardless of what's going on with
            that icon on their specific device. */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all"
          >
            <X size={18} /> Close
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default NotificationPanel;

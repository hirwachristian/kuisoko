

import React, { useState } from 'react';
import { X, Check, ShoppingCart, User, Bell, Star, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

interface NotificationPanelProps {
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const {
    orders, allUsers, reviewNotifications, subscriberNotifications, getFormattedPrice,
    markAllNotificationsAsRead, hiddenNotificationIds, hideNotification, bulkHideNotifications,
    markUserAsRead, markOrderAsRead, markReviewAsRead, markSubscriberAsRead,
  } = useAppContext();
  const navigate = useNavigate();
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

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
        <div className="flex justify-between items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-emerald-50">Notifications</h2>
          <div className="flex items-center gap-3">
            {selectedNotifications.length > 0 && (
              <button onClick={handleDeleteSelected} className="text-xs font-semibold text-red-600 hover:underline whitespace-nowrap">Delete Selected</button>
            )}
            <button onClick={markAllNotificationsAsRead} className="text-xs font-semibold text-emerald-600 hover:underline whitespace-nowrap">Mark all as read</button>
            <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" aria-label="Close notifications">
              <X size={20} />
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 px-4 pt-4 shrink-0">You have {notifications.filter(n => n.unread).length} unread messages.</p>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {notifications.map(notif => (
            <div key={notif.id} className={`flex gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-lg border-l-4 ${notif.unread ? 'border-l-yellow-400' : 'border-l-slate-300'} ${notif.unread ? 'opacity-100' : 'opacity-60'}`}>
              <input
                  type="checkbox"
                  checked={selectedNotifications.includes(notif.id)}
                  onChange={() => toggleSelectNotification(notif.id)}
                  className="mt-1"
              />
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full h-fit">
                {notif.type === 'order' ? <ShoppingCart size={20} /> : notif.type === 'review' ? <Star size={20} /> : notif.type === 'subscriber' ? <Mail size={20} /> : <User size={20} />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-sm">{notif.title}</p>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{notif.timestamp}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{notif.body}</p>
                <div className="flex gap-2">
                  <button
                      className="text-xs bg-emerald-700 text-white px-3 py-1 rounded"
                      onClick={() => {
                          notif.onClick();
                          navigate(notif.actionLink);
                          onClose();
                      }}
                  >
                      {notif.actionLabel}
                  </button>
                  <button onClick={() => hideNotification(notif.id)} className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100 px-3 py-1 rounded">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
};

export default NotificationPanel;

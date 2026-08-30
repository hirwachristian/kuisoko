
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

interface ToastNotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number; // Duration in milliseconds before auto-closing
}

const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  type,
  onClose,
  duration = 4000,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show animation
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
      // Allow fade-out animation to complete before unmounting
      setTimeout(onClose, 300); 
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [duration, onClose]);

  const baseClasses = 'fixed right-6 z-[100] p-4 rounded-xl shadow-lg flex items-center gap-3 transition-all transform';
  const animationClasses = isVisible 
    ? 'top-6 opacity-100 translate-y-0' 
    : 'top-0 opacity-0 translate-y-full'; // Start from slightly off-screen top, fade out downwards

  let typeClasses = '';
  let IconComponent: React.ElementType = Info;

  switch (type) {
    case 'success':
      typeClasses = 'bg-emerald-500 text-white';
      IconComponent = CheckCircle;
      break;
    case 'error':
      typeClasses = 'bg-rose-500 text-white';
      IconComponent = XCircle;
      break;
    case 'info':
      typeClasses = 'bg-emerald-500 text-white';
      IconComponent = Info;
      break;
  }

  return (
    <div
      className={`${baseClasses} ${typeClasses} ${animationClasses}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <IconComponent size={20} className="flex-shrink-0" />
      <span className="font-semibold text-sm">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300); // Allow fade-out animation
        }}
        className="ml-auto p-1 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ToastNotification;

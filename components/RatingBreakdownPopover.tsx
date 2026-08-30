import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface RatingBreakdownPopoverProps {
  anchorEl: HTMLElement;
  productId: string;
  rating: number;
  reviewCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  onClose: () => void;
  /** Keeps the popover open while the cursor moves from the trigger onto the popover itself
   * (they aren't DOM siblings once portaled, so the trigger's own onMouseLeave can't do this). */
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

const RatingBreakdownPopover: React.FC<RatingBreakdownPopoverProps> = ({
  anchorEl, productId, rating, reviewCount, breakdown, onClose, onMouseEnter, onMouseLeave,
}) => {
  const { t } = useAppContext();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const POPOVER_WIDTH = 288;
    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      const maxLeft = window.innerWidth - POPOVER_WIDTH - 12;
      setPosition({
        top: rect.bottom + 8,
        left: Math.min(Math.max(rect.left, 12), Math.max(maxLeft, 12)),
      });
    };
    updatePosition();
    // A hover popover shouldn't linger in the wrong spot if the page scrolls under it.
    window.addEventListener('scroll', onClose, { passive: true });
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onClose);
      window.removeEventListener('resize', onClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorEl]);

  if (!position) return null;

  const total = Object.values(breakdown).reduce((sum, n) => sum + n, 0) || reviewCount;

  return createPortal(
    <div
      className="fixed z-[100] w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-5"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        aria-label={t('product_close_rating_breakdown')}
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-2 mb-1 pr-6">
        <div className="flex items-center text-orange-500">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={16} fill={n <= Math.round(rating) ? 'currentColor' : 'none'} />
          ))}
        </div>
        <span className="font-black text-slate-900 dark:text-emerald-50">
          {t('product_rating_out_of_5', { rating: rating.toFixed(1) })}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        {t('product_global_ratings', { n: reviewCount })}
      </p>
      <div className="space-y-1.5">
        {STAR_LEVELS.map((level) => {
          const count = breakdown[level] ?? 0;
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={level} className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0 text-slate-600 dark:text-slate-300 font-semibold">{level} {t('product_star_label')}</span>
              <div className="flex-1 h-4 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-slate-500 dark:text-slate-400 font-semibold">{percent}%</span>
            </div>
          );
        })}
      </div>
      <Link
        to={`/product/${productId}?tab=reviews`}
        onClick={onClose}
        className="mt-4 block text-center text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-orange-500 transition-colors"
      >
        {t('product_see_customer_reviews')}
      </Link>
    </div>,
    document.body
  );
};

export default RatingBreakdownPopover;

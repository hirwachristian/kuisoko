
import React, { useRef, useState } from 'react';
// Fix: Ensure correct `react-router-dom` named imports for v6+.
// The existing import statement is correct for `react-router-dom` v6+.
import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Heart } from 'lucide-react';
import { Product } from '../types';
import { useAppContext } from '../context/AppContext';
import { getStockLevel } from '../utils';
import RatingBreakdownPopover from './RatingBreakdownPopover';

interface ProductCardProps {
  // Temporarily define product with a single 'image' string for this component's needs.
  // The parent component is responsible for providing the primary image.
  product: Product & { image: string };
  isWishlist?: boolean;
  /** 'grid' (default) is the usual vertical card; 'list' lays the same content out horizontally
   * (thumbnail on the left, details filling the rest of the row) for list-view results. */
  variant?: 'grid' | 'list';
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isWishlist = false, variant = 'grid' }) => {
  const { addToCart, getFormattedPrice, wishlist, toggleWishlist, popularProductIds, t } = useAppContext();
  const hasDiscount = (product.discount || 0) > 0;
  const isOutOfStock = product.stock <= 0;
  const stockLevel = getStockLevel(product.stock);
  const isList = variant === 'list';

  const ratingRef = useRef<HTMLDivElement>(null);
  const [showRatingBreakdown, setShowRatingBreakdown] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const cancelRatingClose = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };
  const openRatingBreakdown = () => {
    cancelRatingClose();
    setShowRatingBreakdown(true);
  };
  const scheduleRatingClose = () => {
    cancelRatingClose();
    closeTimeoutRef.current = window.setTimeout(() => setShowRatingBreakdown(false), 150);
  };

  return (
    <div className={`group bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 hover:shadow-2xl hover:shadow-emerald-900/10 transition-all duration-500 ${isList ? 'flex flex-row items-stretch' : 'transform hover:-translate-y-1'}`}>
      <Link to={`/product/${product.id}`} className={`block relative overflow-hidden bg-white ${isList ? 'w-36 sm:w-48 shrink-0 aspect-square' : 'aspect-square'}`}>
        <img
          src={product.image}
          alt={product.name}
          className={`w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-700 ease-in-out ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}
          loading="lazy"
        />
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
          {isOutOfStock && (
            <span className="bg-slate-800 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.15em] shadow-lg">
              {t('product_out_of_stock')}
            </span>
          )}
          {popularProductIds.has(product.id) && (
            <span className="bg-orange-400 text-emerald-900 text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.15em] shadow-lg">
              {t('product_popular')}
            </span>
          )}
          {hasDiscount && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.15em] shadow-lg">
              -{product.discount}%
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
          className={`absolute top-4 right-4 p-2.5 bg-white/90 backdrop-blur-sm rounded-2xl transition-all ${isWishlist ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transform translate-y-2 group-hover:translate-y-0 duration-500 hover:scale-110 ${wishlist.includes(product.id) ? 'text-rose-500' : 'text-slate-400 hover:text-orange-500'}`}
          aria-label={isWishlist ? t('product_remove_from_wishlist') : t('product_add_to_wishlist')}
        >
          <Heart size={18} fill={wishlist.includes(product.id) ? 'currentColor' : 'none'} />
        </button>
      </Link>
      <div className={`p-6 ${isList ? 'flex-1 min-w-0 flex flex-col' : ''}`}>
        <div className="flex justify-between items-start gap-2 mb-4">
          <Link to={`/product/${product.id}`} className="flex-1 min-w-0 text-base font-bold text-slate-900 dark:text-emerald-50 hover:text-emerald-800 transition-colors tracking-tight line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </Link>
          <div
            ref={ratingRef}
            className="flex items-center shrink-0 text-orange-500 bg-orange-50 px-2 py-0.5 rounded-lg cursor-default"
            onMouseEnter={product.reviews > 0 ? openRatingBreakdown : undefined}
            onMouseLeave={product.reviews > 0 ? scheduleRatingClose : undefined}
          >
            <Star size={10} fill="currentColor" />
            <span className="text-[10px] text-orange-800 ml-1 font-bold">{product.rating}</span>
          </div>
        </div>
        {showRatingBreakdown && product.reviews > 0 && product.ratingBreakdown && ratingRef.current && (
          <RatingBreakdownPopover
            anchorEl={ratingRef.current}
            productId={product.id}
            rating={product.rating}
            reviewCount={product.reviews}
            breakdown={product.ratingBreakdown}
            onClose={() => setShowRatingBreakdown(false)}
            onMouseEnter={cancelRatingClose}
            onMouseLeave={scheduleRatingClose}
          />
        )}
        <div className={`text-[11px] font-bold mb-2 ${
          stockLevel === 'out' || stockLevel === 'low' ? 'text-rose-500' : stockLevel === 'medium' ? 'text-orange-500' : 'text-emerald-600 dark:text-emerald-400'
        }`}>
          {isOutOfStock ? t('product_out_of_stock') : stockLevel === 'low' ? t('product_only_left', { n: product.stock }) : t('product_in_stock', { n: product.stock })}
        </div>
        <div className="flex items-end justify-between gap-2 mt-auto pt-2 border-t border-slate-50 dark:border-slate-800">
          <div className="min-w-0 flex flex-col">
            <span className="text-lg font-black text-slate-900 dark:text-emerald-100 tracking-tight">
              {getFormattedPrice(product.price * (1 - (product.discount || 0) / 100))}
            </span>
            {hasDiscount && (
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 line-through">
                {getFormattedPrice(product.price)}
              </span>
            )}
          </div>
          <button
            onClick={() => addToCart(product)}
            disabled={isOutOfStock}
            className="shrink-0 flex items-center justify-center gap-2 bg-orange-500 text-white hover:bg-orange-600 hover:text-white px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={14} />
            {isOutOfStock ? t('product_sold_out') : t('product_buy')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

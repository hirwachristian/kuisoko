import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Star, ShoppingCart, ArrowLeft, Plus, Minus, ChevronLeft, ChevronRight, EyeOff, Eye, Trash2, Play } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import ReviewForm from '../components/ReviewForm';
import ProductCarousel from '../components/ProductCarousel';
import ProductCard from '../components/ProductCard';
import VariantSelector from '../components/VariantSelector';
import { motion } from 'motion/react';
import { ProductVariant, Review } from '../types';
import { apiFetch, ApiError } from '../api';
import { formatDate, getInitials, getStockLevel } from '../utils';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToCart, products, getFormattedPrice, user, token, showToast, refreshProduct, t } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>(
    searchParams.get('tab') === 'reviews' ? 'reviews' : 'description'
  );
  const [qty, setQty] = useState(1);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [reviewsList, setReviewsList] = useState<Review[]>([]);
  const isAdmin = user?.role === 'admin';

  const product = products.find(p => p.id === id);

  const fetchReviews = useCallback(async () => {
    if (!id) return;
    try {
      const { product: detail } = await apiFetch<{ product: { reviewsList: Review[] } }>(`/products/${id}`, {}, token);
      setReviewsList(detail.reviewsList || []);
    } catch (e) {
      console.error('Error fetching reviews:', e);
    }
  }, [id, token]);

  const handleToggleHideReview = async (review: Review) => {
    try {
      await apiFetch(`/reviews/${review.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: !review.isHidden }),
      }, token);
      showToast(review.isHidden ? t('detail_review_unhidden') : t('detail_review_hidden'), 'success');
      fetchReviews();
      if (product) refreshProduct(product.id);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update review.', 'error');
    }
  };

  const handleDeleteReview = async (review: Review) => {
    if (!window.confirm(t('detail_confirm_delete_review'))) return;
    try {
      await apiFetch(`/reviews/${review.id}`, { method: 'DELETE' }, token);
      showToast(t('detail_review_deleted'), 'success');
      fetchReviews();
      if (product) refreshProduct(product.id);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete review.', 'error');
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setQty(1);
    setActiveImgIndex(0);
    fetchReviews();
  }, [id, fetchReviews]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-2 py-20 text-center bg-white rounded-3xl shadow-sm border">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">{t('detail_product_not_found')}</h2>
        <Link to="/shop" className="text-emerald-600 font-bold hover:underline">{t('detail_back_to_shop')}</Link>
      </div>
    );
  }

  const variantPrices = product.variants ? product.variants.map(v => v.price).filter(p => p > 0) : [];
  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : product.price;
  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : product.price;

  const displayPrice = variantPrices.length > 0 && minPrice !== maxPrice
    ? `${getFormattedPrice(minPrice)} - ${getFormattedPrice(maxPrice)}`
    : getFormattedPrice(minPrice);

  const handleBuyNow = () => {
    // If variants exist, require selection
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      alert(t('detail_select_color_size'));
      return;
    }
    const itemToBuy = selectedVariant ? { 
      ...product, 
      price: selectedVariant.price || product.price, 
      selectedColor: selectedVariant.color,
      selectedSize: selectedVariant.size
    } : product;
    navigate('/cart?step=2', { state: { directBuyProduct: itemToBuy, quantity: qty } });
  };

  const handleAddToCart = () => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      alert(t('detail_select_color_size'));
      return;
    }
    const itemToAdd = selectedVariant ? { 
      ...product, 
      price: selectedVariant.price || product.price, 
      selectedColor: selectedVariant.color,
      selectedSize: selectedVariant.size
    } : product;
    addToCart(itemToAdd, qty);
  };

  const isOutOfStock = product.stock <= 0;
  const stockLevel = getStockLevel(product.stock);

  const displayImages = product.images || [];
  const displayVideos = product.videoUrls || [];
  const similarProducts = products.filter(p => p.subCategory === product.subCategory && p.id !== product.id);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-10">
      <Link to="/shop" className="inline-flex items-center gap-2 text-sm sm:text-base text-slate-500 hover:text-emerald-600 mb-4 sm:mb-8 font-medium">
        <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" /> {t('detail_back_to_results')}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12 mb-10 sm:mb-20">
        <div className="space-y-3 sm:space-y-4">
          <div className="relative aspect-square rounded-2xl sm:rounded-[2rem] overflow-hidden bg-white border border-slate-100 shadow-xl shadow-slate-200/50">
            {activeVideoIndex !== null && displayVideos[activeVideoIndex] ? (
              <video
                key={displayVideos[activeVideoIndex]}
                src={displayVideos[activeVideoIndex]}
                controls
                autoPlay
                className="w-full h-full object-contain bg-black animate-fade-in"
              />
            ) : displayImages.length > 0 && (
              <img
                src={displayImages[activeImgIndex]}
                alt={product.name}
                className="w-full h-full object-contain p-4 sm:p-8 animate-fade-in"
              />
            )}
          </div>
          <div className="flex gap-2 sm:gap-4 flex-wrap">
            {displayImages.map((img, i) => (
              <button
                key={`img-${i}`}
                onClick={() => { setActiveImgIndex(i); setActiveVideoIndex(null); }}
                className={`w-14 h-14 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden bg-white border-2 transition-all ${activeVideoIndex === null && activeImgIndex === i ? 'border-emerald-600 shadow-lg' : 'border-slate-100 opacity-60'}`}
                aria-label={t('detail_view_image', { n: i + 1 })}
              >
                <img src={img} alt={`${product.name} thumbnail ${i + 1}`} className="w-full h-full object-contain p-1 sm:p-1.5" />
              </button>
            ))}
            {displayVideos.map((videoUrl, i) => (
              <button
                key={`video-${i}`}
                onClick={() => setActiveVideoIndex(i)}
                className={`relative w-14 h-14 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden bg-slate-900 border-2 transition-all flex items-center justify-center ${activeVideoIndex === i ? 'border-emerald-600 shadow-lg' : 'border-slate-100 opacity-60'}`}
                aria-label={t('detail_view_video', { n: i + 1 })}
              >
                <video src={videoUrl} className="w-full h-full object-cover opacity-70" muted />
                <Play size={18} className="absolute text-white fill-white drop-shadow sm:w-7 sm:h-7" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <h1 className="text-xl sm:text-4xl font-bold text-slate-900 mb-2 sm:mb-4">{product.name}</h1>
          <div className="flex items-baseline gap-2 sm:gap-3 mb-4 sm:mb-6 flex-wrap">
            <p className="text-lg sm:text-3xl font-bold text-slate-900 dark:text-white">
              {displayPrice}
            </p>
            {isOutOfStock ? (
              <span className="text-xs sm:text-sm font-bold text-rose-600">{t('product_out_of_stock')}</span>
            ) : stockLevel === 'low' ? (
              <span className="text-xs sm:text-sm font-bold text-rose-500">{t('product_only_left', { n: product.stock })}</span>
            ) : stockLevel === 'medium' ? (
              <span className="text-xs sm:text-sm font-bold text-orange-500">{t('product_in_stock', { n: product.stock })}</span>
            ) : (
              <span className="text-xs sm:text-sm font-bold text-emerald-600">{t('product_in_stock', { n: product.stock })}</span>
            )}
          </div>

          {product.variants && product.variants.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <VariantSelector variants={product.variants} onVariantSelect={setSelectedVariant} />
            </div>
          )}

          <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <div className="flex items-center self-start border-2 border-slate-100 rounded-xl sm:rounded-2xl p-1">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg sm:rounded-xl transition-all"
                >
                  <Minus size={18} className="sm:w-5 sm:h-5" />
                </button>
                <span className="w-10 sm:w-12 text-center font-bold text-sm sm:text-lg text-slate-900 dark:text-emerald-100">{qty}</span>
                <button
                   onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                   disabled={isOutOfStock || qty >= product.stock}
                   className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg sm:rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <Plus size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:flex sm:flex-1 gap-2.5 sm:gap-4">
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="flex-1 bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-700 text-white h-11 sm:h-14 rounded-xl sm:rounded-2xl text-xs sm:text-base font-bold flex items-center justify-center gap-1.5 sm:gap-3 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:hover:bg-emerald-600 disabled:cursor-not-allowed px-2"
                >
                  <ShoppingCart size={16} className="shrink-0 sm:w-5 sm:h-5" /> <span className="truncate">{t('product_add_to_cart')}</span>
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={isOutOfStock}
                  className="flex-1 bg-orange-500 dark:bg-orange-500 hover:bg-orange-600 dark:hover:bg-orange-600 text-white h-11 sm:h-14 rounded-xl sm:rounded-2xl text-xs sm:text-base font-bold flex items-center justify-center gap-1.5 sm:gap-3 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:hover:bg-orange-500 disabled:cursor-not-allowed px-2"
                >
                  <span className="truncate">{isOutOfStock ? t('product_sold_out') : t('product_buy_now')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded-xl sm:rounded-2xl flex gap-1 mb-4 sm:mb-8">
        <button
          onClick={() => setActiveTab('description')}
          className={`flex-1 py-2.5 px-2 sm:py-3 sm:px-6 rounded-lg sm:rounded-xl text-xs sm:text-base font-bold transition-all ${
            activeTab === 'description'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-emerald-50 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('detail_description')}
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`flex-1 py-2.5 px-2 sm:py-3 sm:px-6 rounded-lg sm:rounded-xl text-xs sm:text-base font-bold transition-all ${
            activeTab === 'reviews'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-emerald-50 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('detail_reviews')} ({reviewsList.length})
        </button>
      </div>

      {activeTab === 'description' ? (
        <div className="prose prose-slate">
          <p className="text-slate-600 leading-relaxed text-sm sm:text-lg">
            {product.description}
          </p>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-8">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{t('detail_customer_reviews')}</h2>

          {reviewsList.length > 0 ? (
            <div className="space-y-4 sm:space-y-6">
              {reviewsList.map(review => (
                <div key={review.id} className={`bg-white dark:bg-slate-800 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border shadow-sm ${review.isHidden ? 'border-rose-200 dark:border-rose-900 opacity-70' : 'border-slate-100 dark:border-slate-700'}`}>
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-700 dark:bg-emerald-800 flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0">
                      {getInitials(review.userName)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{review.userName}</p>
                          {review.isHidden && (
                            <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-900/40 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-rose-700 dark:text-rose-300">{t('detail_hidden')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">{formatDate(review.date)}</span>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleToggleHideReview(review)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                title={review.isHidden ? t('detail_unhide_review') : t('detail_hide_review')}
                              >
                                {review.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                              </button>
                              <button
                                onClick={() => handleDeleteReview(review)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                title={t('detail_delete_review')}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 my-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} size={14} className={`sm:w-4 sm:h-4 ${star <= review.rating ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} fill={star <= review.rating ? 'currentColor' : 'none'} />
                        ))}
                      </div>
                      <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{review.comment}</p>
                      {review.image && (
                        <img src={review.image} alt="Review attachment" className="mt-3 w-16 h-16 sm:w-24 sm:h-24 rounded-xl object-cover border border-slate-100 dark:border-slate-700" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">{t('detail_no_reviews_yet')}</p>
          )}

          <ReviewForm productId={product.id} onSubmitted={fetchReviews} />
        </div>
      )}

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <div className="mt-10 sm:mt-20">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-8">{t('detail_similar_items')}</h2>
          {similarProducts.length >= 4 ? (
            <ProductCarousel products={similarProducts} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {similarProducts.map(p => (
                <ProductCard key={p.id} product={{ ...p, image: p.images[0] }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductDetail;

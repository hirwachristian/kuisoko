import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Star, ShoppingCart, ArrowLeft, Plus, Minus, ChevronLeft, ChevronRight, EyeOff, Eye, Trash2, Play, Users } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useCartFly } from '../context/CartFlyContext';
import ReviewForm from '../components/ReviewForm';
import ProductCarousel from '../components/ProductCarousel';
import ProductCard from '../components/ProductCard';
import VariantSelector from '../components/VariantSelector';
import AddressForm, { AddressFormHandle } from '../components/AddressForm';
import { motion } from 'motion/react';
import { Product, ProductVariant, Review } from '../types';
import { apiFetch, ApiError } from '../api';
import { formatDate, getInitials, getStockLevel, getProductThumbnail } from '../utils';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToCart, products, getFormattedPrice, user, token, showToast, refreshProduct, t } = useAppContext();
  const { flyToCart } = useCartFly();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>(
    searchParams.get('tab') === 'reviews' ? 'reviews' : 'description'
  );
  const [qty, setQty] = useState(1);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [reviewsList, setReviewsList] = useState<Review[]>([]);
  const [alsoBought, setAlsoBought] = useState<Product[]>([]);
  const [restockEmail, setRestockEmail] = useState(user?.email ?? '');
  const [restockRequested, setRestockRequested] = useState(false);
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const isAdmin = user?.role === 'admin';
  const [showGroupBuyModal, setShowGroupBuyModal] = useState(false);
  const [isStartingGroup, setIsStartingGroup] = useState(false);
  const groupBuyFormRef = useRef<AddressFormHandle>(null);
  const groupBuyFormDataRef = useRef<any>(null);
  // Gallery swipe tracking - declared up here with the other refs (not down by the gallery JSX)
  // because this component has an early return below for the "product not found" case, and every
  // hook must run unconditionally on every render.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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

  // Whichever photo is starred as this product's thumbnail is also where the gallery opens, so
  // what a shopper saw on the card matches what they see right after opening the product, instead
  // of always defaulting to the first uploaded image regardless of what's starred. Keyed on
  // product?.id (not on the wider `products` array) so an unrelated catalog refresh mid-browse
  // never resets whichever photo the shopper is actually looking at back to the thumbnail.
  useEffect(() => {
    if (!product) return;
    const thumb = getProductThumbnail(product);
    const idx = thumb ? product.images.indexOf(thumb) : -1;
    setActiveImgIndex(idx >= 0 ? idx : 0);
  }, [product?.id]);

  // A signup is scoped to whichever product/variant was out of stock at the time - switching color
  // or size (or navigating to a different product) means it no longer applies, so the confirmation
  // shouldn't linger and imply a signup that was never made for the newly-selected combination.
  useEffect(() => {
    setRestockRequested(false);
  }, [id, selectedVariant?.color, selectedVariant?.size]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const { products: also } = await apiFetch<{ products: Product[] }>(`/products/${id}/also-bought`);
        if (!cancelled) setAlsoBought(also);
      } catch (e) {
        console.error('Error fetching also-bought products:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Switching to a different color/size (or, for a per-image-stock product, a different photo)
  // resets the quantity back to 1 rather than carrying over whatever was dialed in for the
  // previous variant - carrying it over reads as if that quantity was already confirmed for the
  // newly-selected variant, which it never was. The image part of this only kicks in when the
  // product actually has image-stock rows, so browsing photos on an ordinary multi-photo product
  // never resets it unexpectedly - written inline (not via a named variable) since `product` may
  // still be undefined here, before this component's early return below.
  useEffect(() => {
    setQty(1);
  }, [
    selectedVariant?.color,
    selectedVariant?.size,
    product?.variants?.some((v) => v.imageUrl) ? product.images[activeImgIndex] : null,
  ]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-2 py-20 text-center bg-white rounded-3xl shadow-sm border">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">{t('detail_product_not_found')}</h2>
        <Link to="/shop" className="text-emerald-600 font-bold hover:underline">{t('detail_back_to_shop')}</Link>
      </div>
    );
  }

  // Whichever photo is on screen right now - reflects a color-variant jump (handleColorChange
  // moves activeImgIndex to match) AND a product with no variants at all where the shopper just
  // clicked a different thumbnail (e.g. picking "the second cap" among several plain photos with
  // nothing else to hang that choice on), so it covers both cases with one read.
  const currentImage = product.images[activeImgIndex] ?? product.images[0];

  // An alternative to color/size variants for a product that isn't meant to vary by either, but
  // still has per-photo stock (AdminImageStockManager) - the gallery itself is the picker, so
  // whichever photo is currently on screen (`currentImage`) IS the selection.
  const hasColorSizeVariants = (product.variants || []).some((v) => !v.imageUrl);
  // Per-image stock is "instead of" color/size (AdminImageStockManager's own framing) - a product
  // is meant to use exactly one of the two systems. If real color/size variants exist, any
  // stray/leftover image-stock rows (e.g. an admin who touched both sections) must never affect
  // display or purchase, so this only ever turns on when there are none.
  const hasImageStockVariants = !hasColorSizeVariants && (product.variants || []).some((v) => v.imageUrl);
  const imageStockVariant = hasImageStockVariants
    ? (product.variants || []).find((v) => v.imageUrl === currentImage)
    : undefined;

  // A variant (color/size OR per-image) left at price 0 means "no override - use the common/base
  // price", not "free", so every variant's *effective* price folds that in before computing
  // anything - otherwise a product where only one variant has its own price (everything else
  // shares the common one) would show a range/price built only from that one outlier, ignoring
  // the common price entirely.
  const effectivePrices = product.variants && product.variants.length > 0
    ? product.variants.map(v => (v.price > 0 ? v.price : product.price))
    : [product.price];
  // Matches ProductCard.tsx's own discount math - the card already discounts whatever price it
  // shows, so opening the product from that card must land on the same discounted number, not the
  // full price the discount badge just promised was reduced.
  const hasDiscount = !!product.discount && product.discount > 0;
  const discounted = (price: number) => (hasDiscount ? price * (1 - product.discount! / 100) : price);
  const minPrice = discounted(Math.min(...effectivePrices));
  const maxPrice = discounted(Math.max(...effectivePrices));

  // Once a specific variant - or, for a per-image-stock product, whichever photo is on screen - is
  // picked, show exactly what it costs - its own price if the admin set one, otherwise the common
  // price it falls back to - rather than continuing to show the whole range once the customer has
  // actually narrowed down to one option. A per-image-stock product has no "nothing selected yet"
  // state the way color/size does (some photo is always on screen), so as long as the product uses
  // that system at all, this always resolves to a specific price - including for a photo the admin
  // never gave its own row (imageStockVariant undefined), which just means "use the base price",
  // not "show the range".
  const selectedOriginalPrice = selectedVariant
    ? (selectedVariant.price > 0 ? selectedVariant.price : product.price)
    : hasImageStockVariants
    ? (imageStockVariant && imageStockVariant.price > 0 ? imageStockVariant.price : product.price)
    : null;
  const displayPrice = selectedOriginalPrice !== null
    ? getFormattedPrice(discounted(selectedOriginalPrice))
    : minPrice !== maxPrice
    ? `${getFormattedPrice(minPrice)} - ${getFormattedPrice(maxPrice)}`
    : getFormattedPrice(minPrice);
  // Only shown once a specific price (not a range) is on screen - a struck-through range reads as
  // cluttered, and the range above is already the discounted one.
  const originalDisplayPrice = hasDiscount && selectedOriginalPrice !== null
    ? getFormattedPrice(selectedOriginalPrice)
    : null;

  // Selecting a color jumps the gallery straight to its photo (if the admin assigned one) - the
  // moment a size is also picked and add-to-cart/buy-now fires, this same photo (not necessarily
  // images[0]) needs to be what's actually attached to the cart/order line, since that's what
  // ends up on the cart page, checkout, invoice, and admin order view. Since none of those read
  // anything but images[0], the simplest way to make all of them show the right photo without
  // touching each one is to just move it to the front here.
  const imagesForColor = (color: string | undefined) => {
    const chosen = color ? product.colorImages?.[color] : undefined;
    if (!chosen || !product.images.includes(chosen)) return product.images;
    return [chosen, ...product.images.filter((img) => img !== chosen)];
  };

  const handleColorChange = (color: string | null) => {
    const image = color ? product.colorImages?.[color] : undefined;
    if (!image) return;
    const index = displayImages.indexOf(image);
    if (index === -1) return;
    setActiveImgIndex(index);
    setActiveVideoIndex(null);
  };

  const handleBuyNow = () => {
    if (hasColorSizeVariants && !selectedVariant) {
      alert(t('detail_select_color_size'));
      return;
    }
    if (hasImageStockVariants && (!imageStockVariant || imageStockVariant.stock <= 0)) {
      alert(t('detail_photo_out_of_stock'));
      return;
    }
    const itemToBuy = selectedVariant ? {
      ...product,
      images: imagesForColor(selectedVariant.color),
      price: selectedVariant.price || product.price,
      selectedColor: selectedVariant.color,
      selectedSize: selectedVariant.size,
      selectedImage: currentImage,
    } : imageStockVariant ? {
      ...product,
      price: imageStockVariant.price || product.price,
      selectedImage: currentImage,
    } : { ...product, selectedImage: currentImage };
    navigate('/cart?step=2', { state: { directBuyProduct: itemToBuy, quantity: qty } });
  };

  const handleStartGroupOrder = async (addressData: any) => {
    if (!addressData || !product) return;
    setIsStartingGroup(true);
    try {
      const { code } = await apiFetch<{ code: string }>('/group-orders', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          quantity: qty,
          customerName: addressData.fullName,
          deliveryAddress: addressData,
        }),
      }, token);
      navigate(`/group/${code}`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not start the group order.', 'error');
    } finally {
      setIsStartingGroup(false);
    }
  };

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (hasColorSizeVariants && !selectedVariant) {
      alert(t('detail_select_color_size'));
      return;
    }
    if (hasImageStockVariants && (!imageStockVariant || imageStockVariant.stock <= 0)) {
      alert(t('detail_photo_out_of_stock'));
      return;
    }
    const itemToAdd = selectedVariant ? {
      ...product,
      images: imagesForColor(selectedVariant.color),
      price: selectedVariant.price || product.price,
      selectedColor: selectedVariant.color,
      selectedSize: selectedVariant.size,
      selectedImage: currentImage,
    } : imageStockVariant ? {
      ...product,
      price: imageStockVariant.price || product.price,
      selectedImage: currentImage,
    } : { ...product, selectedImage: currentImage };
    flyToCart(itemToAdd.images[0], e.currentTarget);
    addToCart(itemToAdd, qty);
  };

  const handleNotifyRestock = async () => {
    if (!restockEmail.trim()) return;
    setRestockSubmitting(true);
    try {
      await apiFetch(`/products/${product.id}/notify-restock`, {
        method: 'POST',
        body: JSON.stringify({
          email: restockEmail.trim(),
          color: selectedVariant?.color,
          size: selectedVariant?.size,
        }),
      });
      setRestockRequested(true);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not save your request.', 'error');
    } finally {
      setRestockSubmitting(false);
    }
  };

  // Once a color+size is actually picked, stock is about that specific combination, not the
  // product's overall total across every variant - the quantity stepper, the "in stock"/"only X
  // left" messaging, and the out-of-stock state all need to agree on the same number, or a
  // shopper could see "45 in stock" while the stepper silently refuses to go past 3. A per-image-
  // stock product (no color/size) works the same way, just keyed by whichever photo is on screen.
  const effectiveStock = selectedVariant ? selectedVariant.stock : imageStockVariant ? imageStockVariant.stock : product.stock;
  const isOutOfStock = effectiveStock <= 0;
  const stockLevel = getStockLevel(effectiveStock);

  const displayImages = product.images || [];
  const displayVideos = product.videoUrls || [];
  // Admin-set name/description override for whichever photo is currently on screen, if any -
  // absent unless that specific image was deliberately customized (AdminImageDetailsManager).
  const activeImageDetail = product.imageDetails?.[displayImages[activeImgIndex]];
  const similarProducts = products.filter(p => p.subCategory === product.subCategory && p.id !== product.id);

  // Images and videos stay in their own arrays for the existing thumbnail click behavior, but
  // swiping needs one ordered sequence (images first, then videos) to know what "next"/"previous"
  // means across both.
  const mediaCount = displayImages.length + displayVideos.length;
  const activeMediaIndex = activeVideoIndex !== null ? displayImages.length + activeVideoIndex : activeImgIndex;

  const goToMediaIndex = (index: number) => {
    if (mediaCount === 0) return;
    const wrapped = ((index % mediaCount) + mediaCount) % mediaCount;
    if (wrapped < displayImages.length) {
      setActiveImgIndex(wrapped);
      setActiveVideoIndex(null);
    } else {
      setActiveVideoIndex(wrapped - displayImages.length);
    }
  };

  // Swipe-to-navigate: touch-only (this is a gesture, not a drag-to-reorder UI), and only fires
  // for a clearly horizontal, deliberate swipe - a small/vertical movement is left alone so it
  // doesn't fight the page's own vertical scroll or a tap on the video's native controls.
  const SWIPE_THRESHOLD_PX = 50;

  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = e.changedTouches[0].clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;
    goToMediaIndex(activeMediaIndex + (deltaX < 0 ? 1 : -1));
  };

  // ProductCard (and the rating-breakdown popover) stamp the page they were clicked from onto
  // the link as router state - reading that back and navigating straight to it is deterministic
  // regardless of which page this product was actually opened from (Home's featured carousel,
  // Shop with its filters, wishlist, similar products on another product's own page...), unlike
  // navigate(-1), which just pops whatever happens to be the previous entry in the raw browser
  // history stack and can land somewhere else entirely if anything else navigated in between.
  // Only actually reached via history for a product opened some other way (a shared link, a
  // bookmark) where no such state exists.
  const returnTo = (location.state as { from?: string } | null)?.from;
  const handleBackToResults = () => {
    if (returnTo) {
      navigate(returnTo);
    } else if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/shop');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-10">
      <button onClick={handleBackToResults} className="inline-flex items-center gap-2 text-sm sm:text-base text-slate-500 hover:text-emerald-600 mb-4 sm:mb-8 font-medium">
        <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" /> {t('detail_back_to_results')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12 mb-10 sm:mb-20">
        <div className="space-y-3 sm:space-y-4">
          <div
            className="relative aspect-square rounded-2xl sm:rounded-[2rem] overflow-hidden bg-white border border-slate-100 shadow-xl shadow-slate-200/50"
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
          >
            {activeVideoIndex !== null && displayVideos[activeVideoIndex] ? (
              <video
                key={displayVideos[activeVideoIndex]}
                src={displayVideos[activeVideoIndex]}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain bg-black animate-fade-in"
              />
            ) : displayImages.length > 0 && (
              <img
                src={displayImages[activeImgIndex]}
                alt={activeImageDetail?.name || product.name}
                className="w-full h-full object-contain p-4 sm:p-8 animate-fade-in"
              />
            )}
            {hasDiscount && activeVideoIndex === null && (
              <span className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-rose-500 text-white text-[9px] sm:text-[11px] font-black px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full uppercase tracking-[0.1em] sm:tracking-[0.15em] shadow-lg z-10">
                -{product.discount}%
              </span>
            )}
            {mediaCount > 1 && (
              <>
                <button
                  onClick={() => goToMediaIndex(activeMediaIndex - 1)}
                  aria-label={t('detail_previous_image')}
                  className="absolute top-1/2 -translate-y-1/2 left-2 sm:left-4 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/90 shadow-lg border border-slate-100 text-slate-700 hover:text-emerald-700 hover:scale-105 transition-all z-10"
                >
                  <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={() => goToMediaIndex(activeMediaIndex + 1)}
                  aria-label={t('detail_next_image')}
                  className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/90 shadow-lg border border-slate-100 text-slate-700 hover:text-emerald-700 hover:scale-105 transition-all z-10"
                >
                  <ChevronRight size={18} className="sm:w-5 sm:h-5" />
                </button>
              </>
            )}
          </div>
          {/* Per-image name/description caption - an admin opt-in (AdminImageDetailsManager) that
              only appears for a photo actually customized with one; everything else stays exactly
              as it was, with no caption at all. */}
          {activeVideoIndex === null && (activeImageDetail?.name || activeImageDetail?.description) && (
            <div className="px-1">
              {activeImageDetail?.name && <p className="text-sm font-bold text-slate-900 dark:text-white">{activeImageDetail.name}</p>}
              {activeImageDetail?.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeImageDetail.description}</p>}
            </div>
          )}
          <div className="flex gap-2 sm:gap-4 flex-wrap">
            {displayImages.map((img, i) => (
              <div key={`img-${i}`} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => { setActiveImgIndex(i); setActiveVideoIndex(null); }}
                  className={`w-14 h-14 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden bg-white border-2 transition-all ${activeVideoIndex === null && activeImgIndex === i ? 'border-emerald-600 shadow-lg' : 'border-slate-100 opacity-60'}`}
                  aria-label={t('detail_view_image', { n: i + 1 })}
                >
                  <img src={img} alt={product.imageDetails?.[img]?.name || `${product.name} thumbnail ${i + 1}`} className="w-full h-full object-contain p-1 sm:p-1.5" />
                </button>
              </div>
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
            {originalDisplayPrice && (
              <p className="text-sm sm:text-lg font-bold text-slate-400 dark:text-slate-500 line-through">
                {originalDisplayPrice}
              </p>
            )}
            {isOutOfStock ? (
              <span className="text-xs sm:text-sm font-bold text-rose-600">{t('product_out_of_stock')}</span>
            ) : stockLevel === 'low' ? (
              <span className="text-xs sm:text-sm font-bold text-rose-500">{t('product_only_left', { n: effectiveStock })}</span>
            ) : stockLevel === 'medium' ? (
              <span className="text-xs sm:text-sm font-bold text-orange-500">{t('product_in_stock', { n: effectiveStock })}</span>
            ) : (
              <span className="text-xs sm:text-sm font-bold text-emerald-600">{t('product_in_stock', { n: effectiveStock })}</span>
            )}
          </div>

          {hasColorSizeVariants && (
            <div className="mb-4 sm:mb-6">
              <VariantSelector variants={product.variants.filter((v) => !v.imageUrl)} onVariantSelect={setSelectedVariant} onColorChange={handleColorChange} />
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
                   onClick={() => setQty(q => Math.min(effectiveStock, q + 1))}
                   disabled={isOutOfStock || qty >= effectiveStock}
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

            {product.groupBuyEnabled && !isOutOfStock && (
              <div className="rounded-xl sm:rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 sm:p-6">
                <h3 className="flex items-center gap-2 font-bold text-sm sm:text-lg text-emerald-900 dark:text-emerald-100 mb-2">
                  <Users size={18} /> {t('group_buy_title')}
                </h3>
                <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 mb-3">{t('group_buy_tiers_description')}</p>
                <button
                  onClick={() => setShowGroupBuyModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold transition-all active:scale-95"
                >
                  {t('group_buy_start_button')}
                </button>
              </div>
            )}

            {isOutOfStock && (
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl p-4 sm:p-5">
                {restockRequested ? (
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t('product_notify_restock_confirmed')}</p>
                ) : (
                  <>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2.5">{t('product_notify_restock_prompt')}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={restockEmail}
                        onChange={(e) => setRestockEmail(e.target.value)}
                        placeholder={t('product_notify_restock_email_placeholder')}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                      />
                      <button
                        onClick={handleNotifyRestock}
                        disabled={restockSubmitting || !restockEmail.trim()}
                        className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-700 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
                      >
                        {t('product_notify_restock_button')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
                          <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{review.userUsername ? `@${review.userUsername}` : review.userName}</p>
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

      {/* Customers Also Bought - real co-purchase data from order history, not just shared category */}
      {alsoBought.length > 0 && (
        <div className="mt-10 sm:mt-20">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-8">{t('detail_customers_also_bought')}</h2>
          {alsoBought.length >= 4 ? (
            <ProductCarousel products={alsoBought} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {alsoBought.map(p => (
                <ProductCard key={p.id} product={{ ...p, image: getProductThumbnail(p) ?? p.images[0] }} />
              ))}
            </div>
          )}
        </div>
      )}

      {similarProducts.length > 0 && (
        <div className="mt-10 sm:mt-20">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-8">{t('detail_similar_items')}</h2>
          {similarProducts.length >= 4 ? (
            <ProductCarousel products={similarProducts} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {similarProducts.map(p => (
                <ProductCard key={p.id} product={{ ...p, image: getProductThumbnail(p) ?? p.images[0] }} />
              ))}
            </div>
          )}
        </div>
      )}

      {showGroupBuyModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-8 max-w-lg w-full shadow-2xl my-8">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-50 mb-4">{t('group_buy_start_button')}</h3>
            <AddressForm
              ref={groupBuyFormRef}
              setAddressData={(d) => { groupBuyFormDataRef.current = d; }}
              onProceed={() => handleStartGroupOrder(groupBuyFormDataRef.current)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowGroupBuyModal(false)}
                className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300"
              >
                {t('cart_confirm_order_cancel')}
              </button>
              <button
                onClick={() => groupBuyFormRef.current?.submit()}
                disabled={isStartingGroup}
                className="flex-1 py-2.5 sm:py-3 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-all disabled:opacity-60"
              >
                {isStartingGroup ? '...' : t('group_buy_start_button')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;

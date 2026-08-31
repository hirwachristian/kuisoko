import React, { useState } from 'react';
import { Star, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';

interface ReviewFormProps {
  productId: string;
  onSubmitted: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ productId, onSubmitted }) => {
  const { user, token, showToast, refreshProduct } = useAppContext();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="bg-white dark:bg-slate-800 p-5 sm:p-8 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm text-center">
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-4">Sign in to leave a review.</p>
        <Link to="/signin" className="inline-block bg-emerald-600 text-white text-sm sm:text-base font-bold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors">
          Sign In
        </Link>
      </div>
    );
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { url } = await apiFetch<{ url: string }>('/uploads', { method: 'POST', body: formData }, token);
      setImageUrl(url);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not upload image.', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    if (imageUrl) {
      apiFetch('/uploads', { method: 'DELETE', body: JSON.stringify({ url: imageUrl }) }, token).catch(() => {});
    }
    setImageUrl(null);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast('Please select a star rating.', 'error');
      return;
    }
    if (!comment.trim()) {
      showToast('Please write a review before submitting.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comment.trim(), image: imageUrl ?? undefined }),
      }, token);
      showToast('Review submitted. Thank you!', 'success');
      setRating(0);
      setComment('');
      setImageUrl(null);
      onSubmitted();
      refreshProduct(productId); // keep product cards' star rating in sync everywhere
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not submit review.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">Write a Review</h3>

      <div className="mb-4 sm:mb-6">
        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Your Rating</label>
        <div className="flex gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`${star <= rating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
            >
              <Star size={24} className="sm:w-8 sm:h-8" fill={star <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 sm:mb-6">
        <label htmlFor="review-text" className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Your Review</label>
        <textarea
          id="review-text"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what you think..."
          className="w-full p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm sm:text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
        ></textarea>
      </div>

      <div className="mb-6 sm:mb-8">
        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Review Image (Optional)</label>
        {imageUrl ? (
          <div className="relative w-16 h-16 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <img src={imageUrl} alt="Review" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5 text-slate-600 hover:text-rose-600"
              title="Remove image"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="block border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-5 sm:p-8 text-center hover:border-emerald-500 bg-slate-50 dark:bg-slate-900 transition-colors cursor-pointer">
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={isUploadingImage} className="hidden" />
            <Upload className="mx-auto text-slate-400 dark:text-slate-500 mb-2" size={22} />
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
              {isUploadingImage ? 'Uploading...' : 'Click to upload an image'}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">Max 5MB, JPG, PNG, GIF</p>
          </label>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || isUploadingImage}
        className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white text-sm sm:text-base font-bold py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl transition-colors disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </div>
  );
};

export default ReviewForm;

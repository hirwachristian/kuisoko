import React from 'react';
import { useAppContext } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import { Heart } from 'lucide-react';

const Wishlist: React.FC = () => {
  const { products, wishlist, t } = useAppContext();
  const wishlistProducts = products.filter(p => wishlist.includes(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h2 className="text-2xl font-black text-slate-900 dark:text-emerald-50 mb-6">{t('wishlist_title')}</h2>
        {wishlistProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {wishlistProducts.map(product => (
              <ProductCard key={product.id} product={{ ...product, image: product.images[0] }} isWishlist={true} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Heart size={64} className="text-slate-200 dark:text-slate-700 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-2">{t('wishlist_empty_title')}</h3>
            <p className="text-slate-500 dark:text-slate-400">{t('wishlist_empty_subtitle')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;

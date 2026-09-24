import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProductCard from './ProductCard';
import { Product } from '../types';
import { getProductThumbnail } from '../utils';

interface ProductCarouselProps {
  products: Product[];
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ products }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 4;
  const chunkedProducts = [];
  for (let i = 0; i < products.length; i += itemsPerPage) {
    chunkedProducts.push(products.slice(i, i + itemsPerPage));
  }
  const maxIndex = chunkedProducts.length - 1;

  const next = () => setCurrentIndex(prev => (prev + 1) % (maxIndex + 1));
  const prev = () => setCurrentIndex(prev => (prev - 1 + (maxIndex + 1)) % (maxIndex + 1));

  useEffect(() => {
    if (maxIndex > 0) {
      const interval = setInterval(next, 5000);
      return () => clearInterval(interval);
    }
  }, [maxIndex]);

  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="flex"
        animate={{ x: `-${currentIndex * 100}%` }}
        transition={{ type: 'tween', duration: 0.5, ease: 'easeInOut' }}
      >
        {chunkedProducts.map((chunk, index) => (
          <div key={index} className="min-w-full flex gap-6">
            {chunk.map(p => (
              <div key={p.id} className="w-1/4">
                <ProductCard product={{ ...p, image: getProductThumbnail(p) ?? p.images[0] }} />
              </div>
            ))}
          </div>
        ))}
      </motion.div>

      {currentIndex > 0 && (
        <button
          onClick={prev}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700"
        >
          <ChevronLeft className="text-slate-600 dark:text-slate-300" />
        </button>
      )}
      
      {currentIndex < maxIndex && (
        <button
          onClick={next}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700"
        >
          <ChevronRight className="text-slate-600 dark:text-slate-300" />
        </button>
      )}
    </div>
  );
};

export default ProductCarousel;

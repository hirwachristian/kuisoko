import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';
import AboutSection from '../components/AboutSection';
import ContactSection from '../components/ContactSection';
import { useAppContext } from '../context/AppContext';
import { apiFetch } from '../api';
import type { Product } from '../types';

// Used whenever the admin hasn't configured any hero images yet (GET /site-images/public comes
// back empty) - the homepage should never render a blank hero just because nothing's been set up.
const DEFAULT_HERO_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80', // Modern electronics/shopping
  },
  {
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80', // Shopping/marketplace
  },
  {
    image: '/home/hero-3.jpg', // Clothing rack close-up
  },
  {
    image: '/home/hero-4.jpg', // Shopping cart on a laptop keyboard
  },
  {
    image: '/home/hero-5.jpg', // Mobile checkout success
  }
];

// Shared scroll-reveal: each section fades upward as it enters the viewport. `once: true` so it
// plays the first time a section is scrolled to and never re-triggers on scrolling back past it -
// a repeating reveal reads as distracting rather than polished on a page this long. `amount: 0.15`
// starts the animation once a section is only barely on screen, so it's finishing (not starting)
// by the time it's actually centered in view.
const REVEAL_PROPS = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
} as const;

const Home: React.FC = () => {
  const { categories, products, t, tCategory } = useAppContext();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroImages, setHeroImages] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<{ heroImages: string[] }>('/site-images/public')
      .then(({ heroImages: fetched }) => setHeroImages(fetched))
      .catch(() => {});
  }, []);

  const heroSlides = heroImages.length > 0 ? heroImages.map((image) => ({ image })) : DEFAULT_HERO_SLIDES;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // Only products explicitly marked as featured by the admin
  const featuredProducts = useMemo(() => {
    return products.filter(p => p.featured);
  }, [products]);

  // 5 per page on web (a single row), 4 per page on mobile (2x2) - matches.matches is read
  // eagerly on init so the very first render already has the right grouping, not a flash of the
  // wrong one before the effect below runs.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handleChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const featuredItemsPerPage = isMobile ? 4 : 5;
  const featuredPages = useMemo(() => {
    const pages: Product[][] = [];
    for (let i = 0; i < featuredProducts.length; i += featuredItemsPerPage) {
      pages.push(featuredProducts.slice(i, i + featuredItemsPerPage));
    }
    return pages;
  }, [featuredProducts, featuredItemsPerPage]);

  const [featuredPage, setFeaturedPage] = useState(0);
  // Resizing across the mobile/web breakpoint changes the page size, so the previous page index
  // may no longer point at a real page - simplest to just snap back to the first one.
  useEffect(() => {
    setFeaturedPage(0);
  }, [featuredItemsPerPage]);

  // Represent each category by its highest-priced product's image
  const categoryShowcase = useMemo(() => {
    return categories.map(cat => {
      const productsInCategory = products.filter(p => p.category === cat);
      if (productsInCategory.length === 0) return null;
      const topProduct = productsInCategory.reduce((prev, current) => (prev.price > current.price) ? prev : current);
      return { name: cat, image: topProduct.images[0] };
    }).filter((c): c is { name: string; image: string } => c !== null);
  }, [categories, products]);

  return (
    <div className="space-y-20 pb-24">
      <section className="relative h-[650px] overflow-hidden bg-emerald-950">
        {/* One-time entrance on page load, separate from the ongoing slide-rotation cross-fade
            nested inside it - this only ever plays once, when the hero first mounts. */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
        {heroSlides.map((slide, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/95 via-emerald-900/40 to-transparent z-10" />
            <img 
              src={slide.image}
              alt="hero background"
              className="w-full h-full object-cover" 
            />
          </div>
        ))}
        </motion.div>
        {/* Fixed hero content - fades/slides in slightly after the image above (delay), so the
            two read as one deliberate sequence rather than everything landing at once. */}
        <motion.div
          className="absolute inset-0 z-20 flex items-center"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 w-full">
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight tracking-tighter">
                <span className="text-emerald-900">{t('home_hero_title_1')}</span>
                <span className="text-orange-500">{t('home_hero_title_2')}</span>
                <span className="text-white">: </span>
                <span className="text-emerald-700">{t('home_hero_title_3')}</span>
                <span className="text-white">, </span>
                <span className="text-orange-400">{t('home_hero_title_4')}</span>
              </h1>
              <p className="text-lg mb-10 max-w-lg font-medium leading-relaxed text-orange-200 drop-shadow">
                {t('home_hero_subtitle')}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-3 bg-emerald-700 hover:bg-emerald-800 text-white px-8 py-4 rounded-xl font-black transition-all shadow-2xl shadow-emerald-900/40 hover:-translate-y-1 active:scale-95 text-base"
                >
                  {t('home_explore_more')}
                  <ArrowRight size={20} />
                </Link>
                {products.some(p => p.discount && p.discount > 0) && (
                  <Link
                    to="/shop?deals=true"
                    className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-md px-8 py-4 rounded-xl font-black transition-all hover:-translate-y-1 active:scale-95 text-base"
                  >
                    <Sparkles size={20} className="text-orange-400" />
                    {t('home_my_deals')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </motion.div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {heroSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 transition-all duration-500 rounded-full ${idx === currentSlide ? 'bg-orange-400 w-12' : 'bg-white/20 w-3 hover:bg-white/40'}`}
            />
          ))}
        </div>
      </section>

      <motion.section {...REVEAL_PROPS} className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-10">
          <div>
            <span className="text-emerald-800 font-black text-[10px] uppercase tracking-widest mb-1.5 block">{t('home_curated_collections')}</span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{t('home_shop_by_category')}</h2>
          </div>
          <Link to="/shop" className="text-emerald-700 text-xs font-bold flex items-center gap-1.5 px-4 py-2 bg-emerald-50 rounded-xl hover:bg-orange-100 hover:text-orange-700 transition-colors">
            {t('nav_view_all')} <ChevronRight size={14} />
          </Link>
        </div>
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          <div className="flex w-max gap-10 category-marquee-track">
            {[...categoryShowcase, ...categoryShowcase].map((item, idx) => (
              <Link
                key={`${item.name}-${idx}`}
                to={`/shop?category=${encodeURIComponent(item.name)}`}
                className="group flex flex-col items-center gap-3 shrink-0 w-28"
              >
                <div className="relative w-28 h-28 rounded-full overflow-hidden shadow-xl shadow-slate-200/50 border-4 border-white bg-slate-100 group-hover:-translate-y-1 group-hover:shadow-2xl transition-all duration-300">
                  <img
                    src={item.image}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                    alt={item.name}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 rounded-full bg-emerald-950/0 group-hover:bg-emerald-950/20 transition-colors duration-300" />
                </div>
                <h3 className="text-slate-900 font-bold text-sm text-center truncate w-full">{tCategory(item.name)}</h3>
              </Link>
            ))}
          </div>
        </div>
      </motion.section>

      {featuredProducts.length > 0 && (
        <motion.section {...REVEAL_PROPS} className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex flex-col mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{t('home_featured_products')}</h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">{t('home_featured_products_subtitle')}</p>
          </div>
          <div className="relative">
            <div className="overflow-hidden">
              <div
                // items-start: flex rows stretch children to match the tallest sibling by
                // default, and each "page" here is a flex item - without this, a shorter last
                // page (e.g. 2 products instead of a full 4) would inherit a fuller page's height
                // and its own single grid row (and the h-full product cards in it) would stretch
                // to fill that borrowed extra space instead of sizing to its own content.
                className="flex items-start transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${featuredPage * 100}%)` }}
              >
                {featuredPages.map((pageProducts, pageIndex) => (
                  <div key={pageIndex} className="w-full shrink-0 grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6">
                    {pageProducts.map((product) => (
                      <div key={product.id} className="fade-in">
                        <ProductCard product={{...product, image: product.images[0]}} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {featuredPages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setFeaturedPage((p) => Math.max(0, p - 1))}
                  disabled={featuredPage === 0}
                  aria-label={t('home_featured_prev')}
                  className="absolute top-1/2 -translate-y-1/2 -left-2 sm:-left-5 w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-white shadow-lg border border-slate-100 text-slate-700 hover:text-emerald-700 hover:scale-105 transition-all disabled:opacity-0 disabled:pointer-events-none z-10"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setFeaturedPage((p) => Math.min(featuredPages.length - 1, p + 1))}
                  disabled={featuredPage === featuredPages.length - 1}
                  aria-label={t('home_featured_next')}
                  className="absolute top-1/2 -translate-y-1/2 -right-2 sm:-right-5 w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-white shadow-lg border border-slate-100 text-slate-700 hover:text-emerald-700 hover:scale-105 transition-all disabled:opacity-0 disabled:pointer-events-none z-10"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
        </motion.section>
      )}

      <motion.div {...REVEAL_PROPS}>
        <AboutSection />
      </motion.div>

      <motion.div {...REVEAL_PROPS}>
        <ContactSection />
      </motion.div>
    </div>
  );
};

export default Home;
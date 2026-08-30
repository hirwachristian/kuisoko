import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';
import AboutSection from '../components/AboutSection';
import ContactSection from '../components/ContactSection';
import { useAppContext } from '../context/AppContext';

// ✅ Removed local image imports - using placeholder images instead
const HERO_SLIDES = [
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

const Home: React.FC = () => {
  const { categories, products, t, tCategory } = useAppContext();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Only products explicitly marked as featured by the admin
  const featuredProducts = useMemo(() => {
    return products.filter(p => p.featured);
  }, [products]);

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
      {/* Hero Slider */}
      <section className="relative h-[650px] overflow-hidden bg-emerald-950">
        {/* Background slider continues moving */}
        {HERO_SLIDES.map((slide, idx) => (
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
        {/* Fixed hero content */}
        <div className="absolute inset-0 z-20 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
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
        </div>
        {/* Indicators */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 transition-all duration-500 rounded-full ${idx === currentSlide ? 'bg-orange-400 w-12' : 'bg-white/20 w-3 hover:bg-white/40'}`}
            />
          ))}
        </div>
      </section>

      {/* Featured Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
      </section>

      {/* Featured Products Section */}
      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{t('home_featured_products')}</h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">{t('home_featured_products_subtitle')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {featuredProducts.map((product) => (
              <div key={product.id} className="fade-in">
                <ProductCard product={{...product, image: product.images[0]}} />
              </div>
            ))}
          </div>
        </section>
      )}

      <AboutSection />

      <ContactSection />
    </div>
  );
};

export default Home;
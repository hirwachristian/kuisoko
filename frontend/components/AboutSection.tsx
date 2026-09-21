import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useInView } from 'motion/react';
import { ShieldCheck, Truck, Lock, Headphones, ArrowRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useCountUp } from '../hooks/useCountUp';

const ABOUT_IMAGES = ['/about/about-1.jpg', '/about/about-2.jpg', '/about/about-3.jpg'];

/** One stat in the About page's counter row - a plain string (e.g. "24/7") renders as-is, while a
 * number counts up from 0 the first time the row scrolls into view, matching the same effect used
 * on the admin dashboard's overview cards. */
const StatValue: React.FC<{ value: number | string; isInView: boolean; suffix?: string }> = ({ value, isInView, suffix }) => {
  const counted = useCountUp(typeof value === 'number' ? value : 0, isInView && typeof value === 'number');
  if (typeof value !== 'number') return <>{value}</>;
  return <>{counted}{suffix}</>;
};

const AboutSection: React.FC = () => {
  const { t, products, categories } = useAppContext();
  const [currentSlide, setCurrentSlide] = useState(0);
  const statsRef = useRef<HTMLDivElement>(null);
  // Not `once: true` - deliberately re-counts from 0 every time this row scrolls into view again
  // (leaving the section and scrolling back, or navigating away and back), not just the first time
  // it's ever seen in a page load.
  const statsInView = useInView(statsRef, { once: false, amount: 0.5 });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % ABOUT_IMAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const values = [
    { icon: ShieldCheck, titleKey: 'about_value_1_title', bodyKey: 'about_value_1_body' },
    { icon: Truck, titleKey: 'about_value_2_title', bodyKey: 'about_value_2_body' },
    { icon: Lock, titleKey: 'about_value_3_title', bodyKey: 'about_value_3_body' },
    { icon: Headphones, titleKey: 'about_value_4_title', bodyKey: 'about_value_4_body' },
  ];

  const stats: { value: number | string; suffix?: string; labelKey: string }[] = [
    { value: products.length, suffix: '+', labelKey: 'about_stat_products' },
    { value: categories.length, labelKey: 'about_stat_categories' },
    { value: '24/7', labelKey: 'about_stat_support' },
  ];

  return (
    <section id="about" className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8" style={{ scrollMarginTop: 'var(--header-offset, 112px)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-16">
        <div className="aspect-[4/3] rounded-[2.5rem] bg-emerald-950 relative overflow-hidden shadow-2xl shadow-emerald-900/30">
          {ABOUT_IMAGES.map((src, idx) => (
            <div
              key={src}
              className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" loading={idx === 0 ? 'eager' : 'lazy'} />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-emerald-950/10 to-transparent" />
          <div className="absolute -top-10 -right-10 w-56 h-56 bg-orange-400/10 rounded-full blur-[60px]" />
          <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-emerald-500/10 rounded-full blur-[60px]" />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {ABOUT_IMAGES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Show image ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentSlide ? 'bg-orange-400 w-8' : 'bg-white/30 w-2 hover:bg-white/50'}`}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="text-orange-500 font-black text-[11px] uppercase tracking-widest mb-3 block">{t('about_hero_title')}</span>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-emerald-50 tracking-tighter mb-6 leading-tight">
            {t('about_hero_subtitle')}
          </h2>
          <p className="text-slate-500 dark:text-emerald-300 text-base leading-relaxed mb-8">
            {t('about_mission_body')}
          </p>
          <div ref={statsRef} className="grid grid-cols-3 gap-3 sm:gap-10">
            {stats.map((s, i) => (
              <div key={i} className="text-center sm:text-left">
                <div className="text-xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-300 tracking-tight tabular-nums">
                  <StatValue value={s.value} suffix={s.suffix} isInView={statsInView} />
                </div>
                <div className="text-[11px] sm:text-sm text-slate-500 dark:text-emerald-400 font-medium">{t(s.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-10 text-center">
        <span className="text-emerald-800 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-1.5 block">{t('about_mission_title')}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
        {values.map((v, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-800 dark:text-emerald-300 mb-5">
              <v.icon size={26} />
            </div>
            <h3 className="font-black text-slate-900 dark:text-emerald-50 text-lg mb-2 tracking-tight">{t(v.titleKey)}</h3>
            <p className="text-slate-500 dark:text-emerald-300 text-sm leading-relaxed">{t(v.bodyKey)}</p>
          </div>
        ))}
      </div>

      <div className="bg-emerald-800 dark:bg-slate-900 rounded-[2.5rem] p-10 md:p-14 text-center relative overflow-hidden shadow-2xl shadow-emerald-900/30 dark:shadow-none">
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-orange-400/10 rounded-full blur-[60px]" />
        <h3 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tighter relative z-10">{t('about_cta_title')}</h3>
        <p className="text-emerald-100/70 mb-8 relative z-10">{t('about_cta_subtitle')}</p>
        <Link
          to="/shop"
          className="relative z-10 inline-flex items-center gap-3 bg-orange-400 hover:bg-orange-300 text-emerald-900 px-8 py-4 rounded-xl font-black transition-all shadow-lg hover:-translate-y-1 active:scale-95"
        >
          {t('about_cta_button')}
          <ArrowRight size={20} />
        </Link>
      </div>
    </section>
  );
};

export default AboutSection;

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Language } from '../translations';

const LANGUAGES: { code: Language; flag: string; labelKey: string }[] = [
  { code: 'en', flag: '🇺🇸', labelKey: 'lang_english' },
  { code: 'kin', flag: '🇷🇼', labelKey: 'lang_kinyarwanda' },
];

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        aria-label="Change language"
        aria-expanded={isOpen}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span>{t(current.labelKey)}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-32 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden z-50">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setIsOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left transition-colors ${
                language === lang.code
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              {t(lang.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;

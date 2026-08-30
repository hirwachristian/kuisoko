


import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
// Fix: Ensure correct `react-router-dom` named imports for v6+.
// The existing import statement is correct for `react-router-dom` v6+.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, Menu, X, LayoutDashboard, LogIn, Heart, MoreVertical, HelpCircle, Truck, Lock, FileText, Camera, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import KuISOKOLogoSVG from './KuISOKOLogoSVG'; // Import the new SVG logo component
import LanguageSwitcher from './LanguageSwitcher';
import { getInitials } from '../utils';
import { apiFetch, ApiError } from '../api';
import { Product } from '../types';

const Navbar = () => {
  const { cart, user, products, wishlist, t, showToast, toggleFAQ, toggleShippingPolicy, togglePrivacyPolicy, toggleTermsOfService } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [navbarSearchQuery, setNavbarSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingByImage, setIsSearchingByImage] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Without this, swiping inside the mobile menu's own scrollable list "chains" past its end -
  // once you hit the bottom of the menu's content, the rest of the touch gesture's momentum
  // scrolls the page underneath, dragging the whole site down to the footer while the menu (an
  // absolutely-positioned overlay, not the page) appears to just vanish. Locking body scroll
  // while the menu is open means there's nothing underneath left to scroll into.
  useLayoutEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isMenuOpen]);

  // Lets a shopper snap/pick a photo of a product and finds visually similar items in the
  // catalog via the backend's perceptual-hash comparison, then hands the results to the Shop
  // page the same way the cross-page About/Contact scroll does - via router state.
  const handleImageSearch = async (file: File) => {
    setIsSearchingByImage(true);
    setIsMenuOpen(false);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { products: results } = await apiFetch<{ products: Product[] }>('/products/search-by-image', {
        method: 'POST',
        body: formData,
      });
      if (results.length === 0) {
        showToast(t('nav_image_search_no_matches'), 'error');
        return;
      }
      navigate('/shop', { state: { imageSearchProducts: results } });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('nav_image_search_error'), 'error');
    } finally {
      setIsSearchingByImage(false);
    }
  };

  const handleCameraInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (file) handleImageSearch(file);
  };

  // Top-level nav links: categories now live only in the Shop page's sidebar (with their own
  // dropdowns there), so the navbar itself just links out to the main sections of the site.
  // About Us / Contact Us also live as sections on the Home page itself (id="about"/"contact") -
  // when we're already on Home, clicking them smooth-scrolls down instead of reloading the page.
  const navLinks: { to: string; labelKey: string; exact: boolean; sectionId?: string }[] = [
    { to: '/', labelKey: 'nav_home', exact: true },
    { to: '/shop', labelKey: 'nav_products', exact: false },
    { to: '/about', labelKey: 'nav_about_us', exact: false, sectionId: 'about' },
    { to: '/contact', labelKey: 'nav_contact_us', exact: false, sectionId: 'contact' },
  ];

  // On the Home page, About/Contact are in-page sections rather than separate routes, so the
  // pathname alone can't tell us which nav link should be highlighted - it stays "/" the whole
  // time. Track which section is actually scrolled into view instead, so the active indicator
  // doesn't stay stuck on "Home" once the user has scrolled past it.
  const [activeHomeSection, setActiveHomeSection] = useState<'home' | 'about' | 'contact'>('home');
  // While a nav click is driving a smooth scroll, ignore intermediate scroll-position updates -
  // otherwise the sections the animation passes through on its way to the target fight with the
  // clicked target before it settles. Cleared once scrolling has genuinely gone quiet (no scroll
  // events for a beat), rather than a guessed fixed delay - a long scroll can easily run past a
  // fixed timeout, letting an in-flight position overwrite the correct, just-clicked target.
  const suppressScrollSyncRef = useRef(false);
  const scrollSettleTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (location.pathname !== '/') return;
    // Checking each section's top edge against the sticky navbar's height is more reliable than
    // an IntersectionObserver band here - a band narrow enough to distinguish "which section" can
    // simply never overlap a section shorter than the viewport, leaving it permanently undetected.
    // Both sections use scroll-mt-28 (112px), so scrollIntoView settles with their top there, not
    // at 0 - the threshold has to clear that or the just-scrolled-to section never registers as
    // reached, silently falling through to whatever the previous section's (now off-screen,
    // negative-top) check happens to match instead.
    const NAVBAR_OFFSET = 140;
    const computeFromScrollPosition = () => {
      // Contact is the last section before the footer - if there isn't enough page below it to
      // ever push its top up past NAVBAR_OFFSET, scrolling to it maxes out the page's scrollable
      // range short of that, and it would never register as active. Once we're at (or within a
      // few px of) the bottom of the page, there's nowhere further to scroll, so treat that as
      // Contact regardless of its exact offset.
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (nearBottom && document.getElementById('contact')) {
        setActiveHomeSection('contact');
        return;
      }
      const aboutTop = document.getElementById('about')?.getBoundingClientRect().top;
      const contactTop = document.getElementById('contact')?.getBoundingClientRect().top;
      if (contactTop !== undefined && contactTop <= NAVBAR_OFFSET) {
        setActiveHomeSection('contact');
      } else if (aboutTop !== undefined && aboutTop <= NAVBAR_OFFSET) {
        setActiveHomeSection('about');
      } else {
        setActiveHomeSection('home');
      }
    };
    const handleScroll = () => {
      if (scrollSettleTimerRef.current) window.clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = window.setTimeout(() => {
        suppressScrollSyncRef.current = false;
        computeFromScrollPosition();
      }, 150);
      if (suppressScrollSyncRef.current) return;
      computeFromScrollPosition();
    };
    computeFromScrollPosition();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollSettleTimerRef.current) window.clearTimeout(scrollSettleTimerRef.current);
    };
  }, [location.pathname]);

  // Sets the highlight immediately on click; suppression above clears itself once the scroll
  // animation this triggers has actually finished.
  const activateHomeSection = (section: 'home' | 'about' | 'contact') => {
    suppressScrollSyncRef.current = true;
    setActiveHomeSection(section);
  };

  const isLinkActive = (to: string, exact: boolean) => {
    if (location.pathname === '/' && (to === '/about' || to === '/contact')) {
      return activeHomeSection === to.slice(1);
    }
    if (to === '/' && location.pathname === '/') {
      return activeHomeSection === 'home';
    }
    return exact ? location.pathname === to : location.pathname.startsWith(to);
  };

  // When About/Contact is clicked from some other page (Shop, Cart, etc.), we navigate to Home
  // first and smooth-scroll to the section once it has actually mounted there - this element
  // won't exist yet the instant we navigate, so we poll for it a few frames rather than guessing
  // a fixed delay.
  const [pendingSection, setPendingSection] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingSection || location.pathname !== '/') return;
    let rafId: number;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(pendingSection);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        activateHomeSection(pendingSection as 'about' | 'contact');
        setPendingSection(null);
        return;
      }
      attempts += 1;
      if (attempts < 60) {
        rafId = requestAnimationFrame(tryScroll);
      } else {
        setPendingSection(null);
      }
    };
    rafId = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(rafId);
  }, [location.pathname, pendingSection]);

  const handleNavLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, link: (typeof navLinks)[number]) => {
    if (link.sectionId) {
      e.preventDefault();
      setIsMenuOpen(false);
      if (location.pathname === '/') {
        document.getElementById(link.sectionId)?.scrollIntoView({ behavior: 'smooth' });
        activateHomeSection(link.sectionId as 'about' | 'contact');
      } else {
        setPendingSection(link.sectionId);
        // Tell MainLayout's route-change scroll reset to sit this one out - we're about to
        // smooth-scroll to the section ourselves once it mounts, below.
        navigate('/', { state: { skipScrollReset: true } });
      }
      return;
    }
    if (link.to === '/' && location.pathname === '/') {
      // Already on Home - clicking it again should scroll back up to the top smoothly,
      // same as About/Contact scroll down, instead of doing nothing.
      e.preventDefault();
      setIsMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      activateHomeSection('home');
      return;
    }
    setIsMenuOpen(false);
  };

  // Close the "more" dropdown on an outside click, so it behaves like a normal menu rather than
  // needing every item to individually close it.
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const getSuggestions = (query: string) => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    const uniqueSuggestions = new Set<string>();
    // Only recommend in-stock products whose name actually starts with what's typed so far
    // (case-insensitive) - not any substring match anywhere in the name/description.
    products.forEach(product => {
      if (product.stock > 0 && product.name.toLowerCase().startsWith(lowerQuery)) {
        uniqueSuggestions.add(product.name);
      }
    });
    return Array.from(uniqueSuggestions).slice(0, 5); // Limit to 5 suggestions
  };

  const suggestions = getSuggestions(navbarSearchQuery);

  // Shared by the Enter key, the search icon/button, and clicking a suggestion - so all three
  // ways of submitting a search behave identically.
  const submitSearch = (query: string) => {
    if (!query.trim()) return;
    navigate(`/shop?query=${encodeURIComponent(query.trim())}`);
    setIsMenuOpen(false); // Close mobile menu after search
    setShowSuggestions(false);
    searchInputRef.current?.blur();
    mobileSearchInputRef.current?.blur();
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submitSearch(navbarSearchQuery);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setNavbarSearchQuery(suggestion);
    submitSearch(suggestion);
  };

  const handleFocus = () => setShowSuggestions(true);
  // Delay long enough that a click on a suggestion (or the search button) registers before the
  // dropdown unmounts - mousedown/blur fires first, then the click event shortly after.
  const handleBlur = () => setTimeout(() => setShowSuggestions(false), 150);

  useEffect(() => {
    // Close suggestions if the query is empty or component unmounts
    if (!navbarSearchQuery.trim()) {
      setShowSuggestions(false);
    }
  }, [navbarSearchQuery]);

  const moreMenuItemClass = "flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";
  const mobileMenuItemClass = "flex items-center gap-3 text-base font-bold text-slate-900 w-full text-left";
  const mobileMenuIconClass = "w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-500 shrink-0";

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-1 sm:px-1.5 lg:px-1.5">
        <div className="flex justify-between items-center h-20 gap-1">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <KuISOKOLogoSVG className="h-7 lg:h-8 w-auto" /> {/* Integrated SVG Logo, isDarkMode prop removed */}
          </Link>

          {/* Desktop Search Input - only at lg+, where there's room; phones and tablets use the mobile menu's search instead */}
          <div className="hidden lg:flex w-56 xl:w-80 shrink-0 relative">
            <button
              type="button"
              onClick={() => submitSearch(navbarSearchQuery)}
              className="absolute left-0 top-0 h-full px-4 flex items-center text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              aria-label={t('nav_search_placeholder')}
            >
              <Search size={18} />
            </button>
            <input
              ref={searchInputRef}
              type="search"
              placeholder={t('nav_search_placeholder')}
              value={navbarSearchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setNavbarSearchQuery(value);
                // Re-open (or keep open) the dropdown the instant there's something to match again -
                // otherwise, once it's closed by clearing the field, it stays closed even after
                // typing a brand new word, since focus never left the input to re-trigger it.
                setShowSuggestions(!!value.trim());
              }}
              onKeyDown={handleSearch}
              onFocus={handleFocus}
              onBlur={handleBlur}
              aria-label={t('nav_search_placeholder')}
              className="w-full pl-12 pr-11 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 outline-none text-sm text-slate-900 dark:text-emerald-100 transition-all"
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isSearchingByImage}
              className="absolute right-0 top-0 h-full px-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors disabled:opacity-60"
              aria-label={t('nav_search_by_photo')}
            >
              {isSearchingByImage ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            </button>
            {showSuggestions && suggestions.length > 0 && navbarSearchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg mt-2 overflow-hidden z-50">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hidden camera/photo input, shared by both the desktop and mobile search boxes -
              `capture="environment"` opens the device's camera directly on mobile, and falls
              back to a normal file picker (with an option to use a webcam) on desktop. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraInputChange}
            className="hidden"
          />

          {/* Desktop Nav Links - Home / Products / About Us / Contact Us, then the language switcher.
              Categories now live only in the Shop page's sidebar (with their own expandable dropdowns there). */}
          <div className="hidden lg:flex items-center h-full flex-1 min-w-0 justify-center gap-1">
            {navLinks.map((link) => {
              const isActive = isLinkActive(link.to, link.exact);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={(e) => handleNavLinkClick(e, link)}
                  className={`group px-4 xl:px-5 text-sm font-bold transition-all py-7 h-full flex items-center relative whitespace-nowrap ${
                    isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400'
                  }`}
                >
                  {t(link.labelKey)}
                  <span
                    className={`absolute bottom-0 left-3 right-3 h-1 bg-emerald-700 dark:bg-emerald-500 rounded-t-full transition-transform duration-300 ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  ></span>
                </Link>
              );
            })}
            <div className="pl-2 ml-1 border-l border-slate-200 dark:border-slate-800">
              <LanguageSwitcher />
            </div>
          </div>

          {/* Actions - kept to exactly three: Wishlist, Cart, and a "more" menu (account access +
              FAQ/Shipping/Privacy/Terms), plus the hamburger toggle for the mobile nav panel. */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link to="/wishlist" className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl relative transition-all"
              aria-label={t('nav_wishlist')}
            >
              <Heart size={20} />
              {wishlist.length > 0 && (
                <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] font-black min-w-[18px] h-4.5 px-1 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950">
                  {wishlist.length}
                </span>
              )}
            </Link>
            <Link to="/cart" className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl relative transition-all"
              aria-label={t('nav_cart')}
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 bg-orange-500 text-white text-[10px] font-black min-w-[18px] h-4.5 px-1 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950">
                  {cartCount}
                </span>
              )}
            </Link>

            <div className="relative hidden lg:block ml-2" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                className={
                  user && user.role === 'user'
                    ? 'w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 hover:opacity-90 transition-opacity overflow-hidden'
                    : 'w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl transition-all'
                }
                aria-label={user && user.role === 'user' ? t('nav_my_dashboard') : t('nav_more')}
                aria-expanded={isMoreMenuOpen}
              >
                {user && user.role === 'user' ? (
                  user.profileImage ? (
                    <span className="w-full h-full bg-cover bg-center block" style={{ backgroundImage: `url('${user.profileImage}')` }} />
                  ) : (
                    getInitials(user.name || '')
                  )
                ) : (
                  <MoreVertical size={20} />
                )}
              </button>
              {isMoreMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 py-2">
                  {!user ? (
                    <Link to="/signin" onClick={() => setIsMoreMenuOpen(false)} className={moreMenuItemClass}>
                      <LogIn size={16} /> {t('nav_sign_in')}
                    </Link>
                  ) : user.role === 'user' ? (
                    <Link to="/dashboard" onClick={() => setIsMoreMenuOpen(false)} className={moreMenuItemClass}>
                      <LayoutDashboard size={16} /> {t('nav_my_dashboard')}
                    </Link>
                  ) : (
                    <>
                      <Link to="/admin/settings/account-security" onClick={() => setIsMoreMenuOpen(false)} className={moreMenuItemClass}>
                        <User size={16} /> {t('dashboard_profile_settings')}
                      </Link>
                      <Link to="/admin" onClick={() => setIsMoreMenuOpen(false)} className={moreMenuItemClass}>
                        <LayoutDashboard size={16} /> {t('nav_admin_dashboard')}
                      </Link>
                    </>
                  )}
                  <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
                  <button type="button" onClick={() => { toggleFAQ(); setIsMoreMenuOpen(false); }} className={moreMenuItemClass}>
                    <HelpCircle size={16} /> {t('nav_faq')}
                  </button>
                  <button type="button" onClick={() => { toggleShippingPolicy(); setIsMoreMenuOpen(false); }} className={moreMenuItemClass}>
                    <Truck size={16} /> {t('shipping_policy_title')}
                  </button>
                  <button type="button" onClick={() => { togglePrivacyPolicy(); setIsMoreMenuOpen(false); }} className={moreMenuItemClass}>
                    <Lock size={16} /> {t('privacy_title')}
                  </button>
                  <button type="button" onClick={() => { toggleTermsOfService(); setIsMoreMenuOpen(false); }} className={moreMenuItemClass}>
                    <FileText size={16} /> {t('terms_title')}
                  </button>
                </div>
              )}
            </div>

            <button
              className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? t('nav_close_menu') : t('nav_open_menu')}
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>


      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 fade-in absolute top-20 left-0 w-full h-[calc(100vh_-_80px)] overflow-y-auto overscroll-contain z-40">
           {/* Mobile Search Input */}
          <div className="p-6 pb-0 relative">
            <button
              type="button"
              onClick={() => submitSearch(navbarSearchQuery)}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-emerald-700 transition-colors"
              aria-label={t('nav_search_placeholder')}
            >
              <Search size={18} />
            </button>
            <input
              ref={mobileSearchInputRef}
              type="search"
              placeholder={t('nav_search_placeholder')}
              value={navbarSearchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setNavbarSearchQuery(value);
                // Re-open (or keep open) the dropdown the instant there's something to match again -
                // otherwise, once it's closed by clearing the field, it stays closed even after
                // typing a brand new word, since focus never left the input to re-trigger it.
                setShowSuggestions(!!value.trim());
              }}
              onKeyDown={handleSearch}
              onFocus={handleFocus}
              onBlur={handleBlur}
              aria-label={t('nav_search_placeholder')}
              className="w-full pl-12 pr-11 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-800 outline-none text-sm transition-all"
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isSearchingByImage}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-emerald-700 transition-colors disabled:opacity-60"
              aria-label={t('nav_search_by_photo')}
            >
              {isSearchingByImage ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            </button>
            {showSuggestions && suggestions.length > 0 && navbarSearchQuery.trim() && (
              <div className="absolute top-full left-6 right-6 bg-white border border-slate-100 rounded-xl shadow-lg mt-2 overflow-hidden z-50">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-6 space-y-6">
            {navLinks.map((link) => {
              const isActive = isLinkActive(link.to, link.exact);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block text-xl font-black ${isActive ? 'text-emerald-700' : 'text-slate-900'}`}
                  onClick={(e) => handleNavLinkClick(e, link)}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}

            <div className="pt-2 border-t border-slate-100 space-y-6">
              {!user ? (
                <Link to="/signin" onClick={() => setIsMenuOpen(false)} className={mobileMenuItemClass}>
                  <div className={mobileMenuIconClass}><LogIn size={16} /></div>
                  {t('nav_sign_in')}
                </Link>
              ) : user.role === 'user' ? (
                <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className={mobileMenuItemClass}>
                  <div className={mobileMenuIconClass}><LayoutDashboard size={16} /></div>
                  {t('nav_my_dashboard')}
                </Link>
              ) : (
                <>
                  <Link to="/admin/settings/account-security" onClick={() => setIsMenuOpen(false)} className={mobileMenuItemClass}>
                    <div className={mobileMenuIconClass}><User size={16} /></div>
                    {t('dashboard_profile_settings')}
                  </Link>
                  <Link to="/admin" onClick={() => setIsMenuOpen(false)} className={mobileMenuItemClass}>
                    <div className={mobileMenuIconClass}><LayoutDashboard size={16} /></div>
                    {t('nav_admin_dashboard')}
                  </Link>
                </>
              )}
              <button type="button" onClick={() => { toggleFAQ(); setIsMenuOpen(false); }} className={mobileMenuItemClass}>
                <div className={mobileMenuIconClass}><HelpCircle size={16} /></div>
                {t('nav_faq')}
              </button>
              <button type="button" onClick={() => { toggleShippingPolicy(); setIsMenuOpen(false); }} className={mobileMenuItemClass}>
                <div className={mobileMenuIconClass}><Truck size={16} /></div>
                {t('shipping_policy_title')}
              </button>
              <button type="button" onClick={() => { togglePrivacyPolicy(); setIsMenuOpen(false); }} className={mobileMenuItemClass}>
                <div className={mobileMenuIconClass}><Lock size={16} /></div>
                {t('privacy_title')}
              </button>
              <button type="button" onClick={() => { toggleTermsOfService(); setIsMenuOpen(false); }} className={mobileMenuItemClass}>
                <div className={mobileMenuIconClass}><FileText size={16} /></div>
                {t('terms_title')}
              </button>
            </div>

            <div className="pt-2">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

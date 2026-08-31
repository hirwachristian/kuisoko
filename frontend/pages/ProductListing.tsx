

import React, { useState, useMemo, useEffect, useRef } from 'react';
// Fix: Ensure correct `react-router-dom` named imports for v6+.
// The existing import statement is correct for `react-router-dom` v6+.
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Filter, Search, Grid3X3, List, ChevronLeft, ChevronRight, ChevronDown, Camera, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useAppContext } from '../context/AppContext'; // Import AppContext
import { Product } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { getPageNumbers } from '../utils';

const ITEMS_PER_PAGE = 6; // 2 rows of 3 products (grid view, desktop width)
const MAX_PRICE_RWF = 1000000; // Upper bound for the price filter, in RWF

const ProductListing: React.FC = () => {
  const { categories, categoryHierarchy, products, getFormattedPrice, t, tCategory } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by the navbar's "search by photo" feature - when present, the grid below shows exactly
  // these (already similarity-ranked) products instead of the usual category/query filtering.
  const imageSearchProducts = (location.state as { imageSearchProducts?: Product[] } | null)?.imageSearchProducts;
  const categoryParam = searchParams.get('category');
  const subCategoryParam = searchParams.get('subCategory');
  const queryParam = searchParams.get('query');
  const dealsParam = searchParams.get('deals');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(subCategoryParam);
  // Which sidebar categories currently have their sub-category dropdown open - starts with
  // whichever category is already selected (if any) expanded, so its sub-categories are visible.
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(categoryParam ? [categoryParam] : [])
  );
  const toggleCategoryExpanded = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };
  // Price range filter, in RWF
  const [priceRange, setPriceRange] = useState<[number, number]>([0, MAX_PRICE_RWF]);
  const [searchQuery, setSearchQuery] = useState(queryParam || '');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // The category tree + price range filters below only ever showed on desktop (the sidebar was
  // `hidden md:block`) - phones had no way to browse by category at all. This drives a slide-in
  // drawer, on top of the same sidebar, that surfaces the identical content on mobile.
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  useBodyScrollLock(isMobileFiltersOpen);

  useEffect(() => {
    setSelectedCategory(categoryParam);
    setSelectedSubCategory(subCategoryParam);
    setSearchQuery(queryParam || '');
    setCurrentPage(1);
    // Hide suggestions when category or query changes from external sources (like navbar)
    setShowSuggestions(false);
    // Auto-expand the sidebar dropdown for whichever category the URL now points to, so arriving
    // here from a category/sub-category link elsewhere shows its dropdown already open.
    if (categoryParam) {
      setExpandedCategories(prev => (prev.has(categoryParam) ? prev : new Set(prev).add(categoryParam)));
    }
  }, [categoryParam, subCategoryParam, queryParam, dealsParam]);

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

  const suggestions = getSuggestions(searchQuery);

  const handleFocus = () => setShowSuggestions(true);
  const handleBlur = () => setTimeout(() => setShowSuggestions(false), 100); // Delay to allow click on suggestion

  const filteredProducts = useMemo(() => {
    // Photo search results are already ranked by visual similarity - show exactly those,
    // bypassing the usual category/price/text filters entirely.
    if (imageSearchProducts) return imageSearchProducts;
    return products.filter(p => { // Use products from context
      const matchCat = selectedCategory ? p.category === selectedCategory : true;
      const matchSubCat = selectedSubCategory ? p.subCategory === selectedSubCategory : true;
      // Price range filter operates on the base USD price
      const matchPrice = p.price >= priceRange[0] && p.price <= priceRange[1];
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDeals = dealsParam === 'true' ? (p.discount && p.discount > 0) : true;
      return matchCat && matchSubCat && matchPrice && matchSearch && matchDeals;
    }).sort((a, b) => {
      // Sorting should also be based on the base USD price for consistency
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      return 0;
    });
  }, [selectedCategory, selectedSubCategory, priceRange, searchQuery, sortBy, products, dealsParam, imageSearchProducts]); // Add products to dependency array

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // No scroll-to-top - changing pages should just swap the grid's contents in place, the same
  // way the admin list pages' pagination already works, not jump the viewport back to the top.
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setCurrentPage(1);
    setShowSuggestions(false);
    searchInputRef.current?.blur();
    // Update URL to reflect the new search query, this might trigger the useEffect to update again
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('query', suggestion);
    setSearchParams(newSearchParams);
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setPriceRange([0, MAX_PRICE_RWF]);
    setSearchQuery('');
    setSortBy('newest');
    setCurrentPage(1);
    setSearchParams({}); // Clear all search params
  };

  const hasActiveFilters = !!(selectedCategory || selectedSubCategory || searchQuery || priceRange[1] < MAX_PRICE_RWF);

  const maxPriceDisplay = getFormattedPrice(priceRange[1]);

  // Shared between the desktop sidebar and the mobile drawer below, so both stay pixel-for-pixel
  // identical (and both filter the exact same live state) instead of drifting into two versions.
  const filterFieldsContent = (
    <div className="space-y-8">
      <div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-4">{t('shop_category')}</h4>
        <div className="space-y-2">
          <button
            onClick={() => { setSelectedCategory(null); setSearchParams({}); }}
            className={`flex items-center w-full min-h-[40px] px-3 py-2 rounded-xl text-sm font-semibold text-left truncate whitespace-nowrap transition-all ${!selectedCategory ? 'bg-emerald-800 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-emerald-800 dark:hover:text-emerald-400'}`}
          >
            {t('shop_all_items')}
          </button>
          {categories.map(cat => { // Use dynamic categories
            const sections = categoryHierarchy[cat] || [];
            const hasSubcategories = sections.length > 0;
            const isExpanded = expandedCategories.has(cat);
            const isCategoryActive = selectedCategory === cat && !selectedSubCategory;
            return (
              <div key={cat}>
                <div
                  className={`flex items-center w-full min-h-[40px] rounded-xl text-sm font-semibold transition-all ${isCategoryActive ? 'bg-emerald-800 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-emerald-800 dark:hover:text-emerald-400'}`}
                >
                  <button
                    onClick={() => setSearchParams({ category: cat })}
                    className="flex-1 min-w-0 text-left pl-3 pr-1 py-2 truncate whitespace-nowrap"
                  >
                    {tCategory(cat)}
                  </button>
                  {hasSubcategories && (
                    <button
                      onClick={() => toggleCategoryExpanded(cat)}
                      className="shrink-0 pl-1 pr-3 py-2"
                      aria-label={isExpanded ? t('shop_collapse_category') : t('shop_expand_category')}
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {hasSubcategories && isExpanded && (
                  <div className="mt-1 mb-2 ml-3 pl-3 border-l-2 border-slate-100 dark:border-slate-800 space-y-3">
                    {sections.map(section => (
                      <div key={section.title}>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 mb-1">
                          {tCategory(section.title)}
                        </p>
                        <div className="space-y-0.5">
                          {section.items.map(item => (
                            <button
                              key={item}
                              onClick={() => setSearchParams({ category: cat, subCategory: item })}
                              className={`block w-full text-left px-2 py-1.5 rounded-lg text-xs truncate whitespace-nowrap transition-all ${selectedSubCategory === item && selectedCategory === cat ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-700 dark:hover:text-emerald-400'}`}
                            >
                              {tCategory(item)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-4">{t('shop_price_range')}</h4>
        <div className="space-y-4">
          <input
            type="range"
            min="0"
            max={MAX_PRICE_RWF}
            step="5000"
            value={priceRange[1]}
            onChange={(e) => { setPriceRange([0, parseInt(e.target.value)]); setCurrentPage(1); }}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-800"
          />
          <div className="flex justify-between text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <span>{getFormattedPrice(0)}</span>
            <span className="text-emerald-800 dark:text-emerald-400 px-2 py-1 bg-emerald-50 dark:bg-emerald-950 rounded-lg">{maxPriceDisplay}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-10">
      {/* Same structure as the admin sidebar: the sidebar lives outside the scrolling area, only
          the content next to it scrolls internally within its own bounded height - so nothing
          about the sidebar's position or size can ever depend on how much content (or how little)
          is in the results pane. The row itself sticks below the navbar while in view; only the
          product grid inside it scrolls, and pagination/footer are reached by scrolling past it. */}
      <div className="flex flex-col md:flex-row md:sticky md:top-24 md:h-[calc(100vh_-_6rem)] gap-8">
        {/* md:h-full + overflow-y-auto: only kicks in if expanding several categories' dropdowns
            at once makes the sidebar taller than the available space - otherwise inert. */}
        <aside className="w-full md:w-64 md:h-full md:overflow-y-auto flex-shrink-0 space-y-8">
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Filter size={18} /> {t('shop_filters')}
              </h3>
              {/* Always rendered (never mounted/unmounted) so this row's height and the sidebar
                  below it never shifts based on whether any filter happens to be active - just
                  hidden visually and non-interactive when there's nothing to reset. */}
              <button
                onClick={clearFilters}
                className={`text-xs font-bold text-emerald-700 hover:text-orange-500 transition-opacity ${hasActiveFilters ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden={!hasActiveFilters}
                tabIndex={hasActiveFilters ? 0 : -1}
              >
                {t('shop_reset')}
              </button>
            </div>

            {filterFieldsContent}
          </div>
        </aside>

        {/* Mobile Filters Drawer - the sidebar above is desktop-only (hidden md:block); this
            surfaces the exact same category tree + price range on phones via a slide-in panel,
            since there was previously no way to browse by category on mobile at all. */}
        <div className={`fixed inset-0 z-50 md:hidden ${isMobileFiltersOpen ? '' : 'pointer-events-none'}`}>
          <div
            className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-300 ${isMobileFiltersOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`absolute inset-y-0 left-0 w-[85%] max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-transform duration-300 ${isMobileFiltersOpen ? 'translate-x-0' : '-translate-x-full'}`}
            role="dialog"
            aria-modal="true"
            aria-label={t('shop_filters')}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-emerald-50 flex items-center gap-2">
                <Filter size={18} /> {t('shop_filters')}
              </h3>
              <button
                onClick={() => setIsMobileFiltersOpen(false)}
                className="p-2 -mr-2 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label={t('nav_close_menu')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
              {filterFieldsContent}
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={clearFilters}
                className={`flex-1 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${hasActiveFilters ? '' : 'opacity-50 pointer-events-none'}`}
              >
                {t('shop_reset')}
              </button>
              <button
                onClick={() => setIsMobileFiltersOpen(false)}
                className="flex-1 py-3 rounded-xl bg-emerald-800 text-white text-sm font-bold hover:bg-emerald-900 transition-colors shadow-lg shadow-emerald-900/20"
              >
                {t('shop_show_results')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 md:h-full md:overflow-y-auto md:pr-1">
          {/* Always rendered (not just when a category is selected) so the search bar/grid below it
              always starts at the same vertical position, whether browsing "All Items" or any
              category - with or without products - instead of the page shifting depending on state. */}
          {imageSearchProducts ? (
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 dark:text-emerald-50 flex items-center gap-2">
                <Camera size={22} className="text-emerald-700 dark:text-emerald-400" />
                {t('shop_image_search_title')}
              </h1>
              <button
                onClick={() => navigate('/shop', { replace: true })}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                <X size={14} /> {t('shop_clear_image_search')}
              </button>
            </div>
          ) : (
            <h1 className="text-2xl font-black text-slate-900 dark:text-emerald-50 mb-6">
              {selectedCategory ? tCategory(selectedCategory) : t('shop_all_items')}
              {selectedSubCategory && (
                <span className="text-slate-400 dark:text-slate-500 font-bold"> / {tCategory(selectedSubCategory)}</span>
              )}
            </h1>
          )}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mb-8 space-y-4 sm:space-y-0 sm:flex items-center justify-between gap-4 transition-colors duration-300">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('nav_search_placeholder')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  setShowSuggestions(true); // Show suggestions on change
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                aria-label={t('nav_search_placeholder')}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 outline-none text-sm text-slate-900 dark:text-emerald-100 transition-all"
              />
              {showSuggestions && suggestions.length > 0 && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg mt-2 overflow-hidden z-20">
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
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => setIsMobileFiltersOpen(true)}
                className="relative md:hidden shrink-0 flex items-center gap-1.5 sm:gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-100 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors max-w-[45%] sm:max-w-none"
              >
                <Filter size={16} className="sm:w-[18px] sm:h-[18px] shrink-0" />
                <span className="truncate">{t('shop_filters')}</span>
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
                )}
              </button>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                className="min-w-0 flex-1 sm:flex-none max-w-[55%] sm:max-w-none bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-slate-700 dark:text-emerald-100 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors"
              >
                <option value="newest">{t('shop_sort_newest')}</option>
                <option value="price-low">{t('shop_sort_price_low')}</option>
                <option value="price-high">{t('shop_sort_price_high')}</option>
              </select>
              <div className="hidden sm:flex border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-3 transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 hover:text-emerald-800 dark:hover:text-emerald-500'}`}
                  aria-label={t('shop_grid_view')}
                  aria-pressed={viewMode === 'grid'}
                >
                  <Grid3X3 size={20} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-3 transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 hover:text-emerald-800 dark:hover:text-emerald-500'}`}
                  aria-label={t('shop_list_view')}
                  aria-pressed={viewMode === 'list'}
                >
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>

          {paginatedProducts.length > 0 ? (
            <div className="space-y-12">
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-8' : 'flex flex-col gap-4'}>
                {paginatedProducts.map(product => (
                  <div key={product.id} className="fade-in">
                    {/* Pass the first image from the array to ProductCard */}
                    <ProductCard product={{...product, image: product.images[0]}} variant={viewMode} />
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 pt-8 sm:pt-12 flex-wrap">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
                  </button>
                  {getPageNumbers(currentPage, totalPages).map((page, i) =>
                    page === 'ellipsis' ? (
                      <span key={`ellipsis-${i}`} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-sm text-slate-400 dark:text-slate-600">
                        &hellip;
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        aria-current={currentPage === page ? 'page' : undefined}
                        className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-2xl text-xs sm:text-sm font-semibold ${
                          currentPage === page
                            ? 'bg-emerald-800 text-white shadow-lg shadow-emerald-900/20'
                            : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight size={18} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-500">
                <Search size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-emerald-50">{t('shop_no_products_found')}</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto">{t('shop_no_products_hint')}</p>
              <button
                onClick={clearFilters}
                className="mt-8 bg-orange-50 dark:bg-slate-800 text-orange-600 dark:text-emerald-500 font-bold px-8 py-3 rounded-2xl hover:bg-orange-100 dark:hover:bg-slate-700 transition-colors"
              >
                {t('shop_clear_filters')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductListing;

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  itemLabel: string; // e.g. "orders", "users", "products"
}

/** Collapses a long page range down to first, last, current ±1, and "…" for the gaps - e.g.
 * 1 … 4 5 6 … 12 instead of listing every page from 1 to 12, which reads as cluttered/amateurish
 * once there are more than a handful of pages (and wraps awkwardly on mobile). */
const getPageNumbers = (current: number, total: number): (number | 'ellipsis')[] => {
  const delta = 1;
  const pages: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      pages.push(i);
    }
  }
  const result: (number | 'ellipsis')[] = [];
  let last: number | undefined;
  for (const p of pages) {
    if (last !== undefined) {
      if (p - last === 2) result.push(last + 1);
      else if (p - last > 2) result.push('ellipsis');
    }
    result.push(p);
    last = p;
  }
  return result;
};

/** Shared pagination bar for admin list pages (Orders/Users/Products) - a "Showing X-Y of Z"
 * label plus Previous/Next and a truncated page-number row, all in one consistent, mobile-sized
 * component instead of each page re-implementing (and subtly re-diverging on) its own version. */
const AdminPagination: React.FC<AdminPaginationProps> = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage, itemLabel }) => {
  if (totalItems === 0) return null;
  const startItem = Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1);
  const endItem = Math.min(totalItems, currentPage * itemsPerPage);
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <span className="text-xs sm:text-sm text-slate-600 dark:text-emerald-300 order-2 sm:order-1">
        {`Showing ${startItem}-${endItem} of ${totalItems} ${itemLabel}`}
      </span>
      <div className="flex items-center gap-1 sm:gap-1.5 order-1 sm:order-2 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
        </button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs sm:text-sm text-slate-400 dark:text-slate-600">
              &hellip;
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={currentPage === p ? 'page' : undefined}
              className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                currentPage === p
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
        </button>
      </div>
    </div>
  );
};

export default AdminPagination;

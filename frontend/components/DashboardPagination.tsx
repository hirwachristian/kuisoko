import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPageNumbers } from '../utils';

interface DashboardPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  /** Already-translated noun for the count line, e.g. t('dashboard_orders_count_label'). */
  itemLabel: string;
  /** Already-translated "Showing {start}-{end} of {total} {label}" template. */
  showingLabel: (start: number, end: number, total: number, label: string) => string;
}

/** Customer-facing counterpart to AdminPagination.tsx - same page-number/prev/next mechanics
 * (shared getPageNumbers helper) but with a translated count line instead of that component's
 * hardcoded English, since this renders on bilingual customer pages, not admin-only ones. */
const DashboardPagination: React.FC<DashboardPaginationProps> = ({
  currentPage, totalPages, onPageChange, totalItems, itemsPerPage, itemLabel, showingLabel,
}) => {
  if (totalItems === 0) return null;
  const startItem = Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1);
  const endItem = Math.min(totalItems, currentPage * itemsPerPage);
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        {showingLabel(startItem, endItem, totalItems, itemLabel)}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-slate-400 dark:text-slate-600">
                &hellip;
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                aria-current={currentPage === p ? 'page' : undefined}
                className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                  currentPage === p
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardPagination;

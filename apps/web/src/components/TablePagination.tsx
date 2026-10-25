import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const from = totalRecords === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const to = Math.min(safeCurrentPage * pageSize, totalRecords);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (safeCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`px-4 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${className}`}
    >
      {/* Left: Records per page selector & record count summary */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2 text-slate-500">
          <span>Show</span>
          <select
            id="page-size-select"
            aria-label="Records per page"
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
              onPageChange(1);
            }}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span>records per page</span>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        <div className="text-slate-500">
          Showing <span className="font-semibold text-slate-800">{from}</span> to{' '}
          <span className="font-semibold text-slate-800">{to}</span> of{' '}
          <span className="font-semibold text-slate-800">{totalRecords}</span> records
        </div>
      </div>

      {/* Right: Page navigation buttons */}
      <div className="flex items-center space-x-1">
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage <= 1}
          aria-label="First page"
          title="First page"
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          aria-label="Previous page"
          title="Previous page"
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1 px-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 select-none">
                  …
                </span>
              );
            }
            const pageNum = p as number;
            const isActive = pageNum === safeCurrentPage;
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={isActive ? 'page' : undefined}
                className={`min-w-[28px] h-7 px-2 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          aria-label="Next page"
          title="Next page"
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage >= totalPages}
          aria-label="Last page"
          title="Last page"
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

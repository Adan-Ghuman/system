import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button.js';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}

export function PaginationControls({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100]
}: PaginationControlsProps) {
  if (total <= 0) {
    return null;
  }

  const startEntry = Math.min((page - 1) * limit + 1, total);
  const endEntry = Math.min(page * limit, total);

  function getPageNumbers(): (number | string)[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (page <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }

    if (page >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  }

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 border-t border-line bg-surface/60 text-xs text-soft rounded-b-lg">
      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
        <span>
          Showing <span className="font-semibold text-strong">{startEntry}</span> to{' '}
          <span className="font-semibold text-strong">{endEntry}</span> of{' '}
          <span className="font-semibold text-brand">{total}</span> entries
        </span>

        {onLimitChange && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-line">
            <span className="text-soft text-xs">Rows:</span>
            <select
              aria-label="Rows per page"
              value={limit}
              onChange={(e) => {
                onLimitChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-canvas border border-line rounded px-2 py-0.5 text-xs text-strong focus:outline-none focus:border-emerald-500"
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-1 sm:w-auto sm:flex-nowrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="h-9 w-9 p-0 border-line bg-canvas text-ink disabled:opacity-30"
          title="First Page" aria-label="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-9 w-9 p-0 border-line bg-canvas text-ink disabled:opacity-30"
          title="Previous Page" aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        <div className="order-2 flex basis-full flex-wrap items-center justify-center gap-1 sm:order-none sm:mx-1 sm:basis-auto">
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1 text-soft font-bold select-none">
                  •••
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === page;

            return (
              <button
                key={pageNum}
                aria-label={"Page " + pageNum}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onPageChange(pageNum)}
                className={`h-9 min-w-9 px-2 text-xs font-semibold rounded transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-canvas border border-line text-ink hover:bg-subtle hover:text-strong'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-9 w-9 p-0 border-line bg-canvas text-ink disabled:opacity-30"
          title="Next Page" aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="h-9 w-9 p-0 border-line bg-canvas text-ink disabled:opacity-30"
          title="Last Page" aria-label="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

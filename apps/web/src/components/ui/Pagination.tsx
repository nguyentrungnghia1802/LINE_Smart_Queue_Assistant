import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
  pageLabel: (page: number, totalPages: number) => string;
}

export function Pagination({
  page,
  totalItems,
  pageSize = 15,
  onPageChange,
  previousLabel,
  nextLabel,
  pageLabel,
}: Readonly<PaginationProps>) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm"
      aria-label="Pagination"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-gray-200 px-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {previousLabel}
      </button>
      <span className="text-gray-500">{pageLabel(page, totalPages)}</span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-gray-200 px-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextLabel}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

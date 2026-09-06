import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-surface-1 text-xs select-none">
      <p className="text-muted font-sans text-xs">
        Page <span className="font-mono font-medium text-text">{page}</span> of{' '}
        <span className="font-mono font-medium text-text">{totalPages}</span>{' '}
        <span className="text-muted/70 font-mono text-[11px]">({total.toLocaleString()} total events)</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-7 px-2.5 rounded bg-surface-2 border border-border text-text text-xs font-mono hover:bg-surface-3 hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-7 px-2.5 rounded bg-surface-2 border border-border text-text text-xs font-mono hover:bg-surface-3 hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

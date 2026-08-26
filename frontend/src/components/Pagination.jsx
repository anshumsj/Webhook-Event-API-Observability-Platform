import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-border px-6 py-3 bg-surface">
      <p className="text-sm text-muted">
        Showing page <span className="font-medium text-text">{page}</span> of <span className="font-medium text-text">{totalPages}</span> (Total: {total})
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded-md bg-background border border-border text-text hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded-md bg-background border border-border text-text hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

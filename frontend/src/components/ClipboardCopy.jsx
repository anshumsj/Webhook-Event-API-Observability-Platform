import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function ClipboardCopy({ text, label = 'Copy', copiedLabel = 'Copied', className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e?.stopPropagation?.();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(err => {
      console.error('Failed to copy text:', err);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-2 border border-border text-xs font-mono text-muted hover:text-text hover:bg-surface-3 hover:border-border-strong transition-colors cursor-pointer select-none ${className}`}
      title={label}
      aria-label={label}
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

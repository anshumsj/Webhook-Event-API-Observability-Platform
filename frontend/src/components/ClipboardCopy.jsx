import React, { useState } from 'react';
import { Copy, Check, ShieldOff } from 'lucide-react';
import { useGhostMode } from '../context/GhostModeContext';

/**
 * ClipboardCopy — Copy-to-clipboard button with Ghost Mode safety.
 *
 * Props:
 *   text        — The real value to copy (when Ghost Mode is OFF)
 *   displayText — The redacted/display value (when Ghost Mode is ON, copies this instead)
 *   sensitive   — If true, the copy action is treated as sensitive in Ghost Mode
 *   label       — Button label text
 *   copiedLabel — Button label text after successful copy
 *   className   — Additional CSS classes
 *
 * Ghost Mode behavior:
 *   - If `sensitive` is true (default) and Ghost Mode is active:
 *     - If `displayText` is provided, copies `displayText` (the redacted value)
 *     - Otherwise, copies a generic "Redacted" placeholder
 *   - If `sensitive` is false, copies `text` regardless of Ghost Mode
 */
export default function ClipboardCopy({
  text,
  displayText,
  sensitive = true,
  label = 'Copy',
  copiedLabel = 'Copied',
  className = '',
}) {
  const [copied, setCopied] = useState(false);
  const { isGhostMode } = useGhostMode();

  const handleCopy = (e) => {
    e?.stopPropagation?.();
    if (!text && !displayText) return;

    // Determine what value actually gets placed on clipboard
    let valueToCopy = text;
    if (isGhostMode && sensitive) {
      valueToCopy = displayText || '••••••••';
    }

    navigator.clipboard.writeText(valueToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(err => {
      console.error('Failed to copy text:', err);
    });
  };

  const isBlocked = isGhostMode && sensitive;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-2 border border-border text-xs font-mono text-muted hover:text-text hover:bg-surface-3 hover:border-border-strong transition-colors cursor-pointer select-none ${
        isBlocked ? 'opacity-60' : ''
      } ${className}`}
      title={isBlocked ? 'Redacted — Ghost Mode active' : label}
      aria-label={isBlocked ? 'Copy redacted value (Ghost Mode active)' : label}
    >
      {copied ? (
        <Check className="w-3 h-3 text-success" />
      ) : isBlocked ? (
        <ShieldOff className="w-3 h-3 text-muted" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

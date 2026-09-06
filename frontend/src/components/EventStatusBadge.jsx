import React from 'react';
import StatusBadge from './ui/StatusBadge';

/**
 * Unified StatusBadge alias to ensure design system consistency
 * across any existing or future components.
 */
export default function EventStatusBadge({ status, size = 'sm', label, className = '' }) {
  return <StatusBadge status={status} size={size} label={label} className={className} />;
}

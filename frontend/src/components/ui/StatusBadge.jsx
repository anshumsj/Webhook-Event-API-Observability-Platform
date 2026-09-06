import React from 'react';

const STATUS_CONFIGS = {
  // Success
  success: {
    label: 'Success',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
  },
  processed: {
    label: 'Processed',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
  },
  healthy: {
    label: 'Healthy',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
  },
  delivered: {
    label: 'Delivered',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
  },

  // Warning
  warning: {
    label: 'Warning',
    dotClass: 'bg-warning',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
  },
  degraded: {
    label: 'Degraded',
    dotClass: 'bg-warning',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
  },
  retrying: {
    label: 'Retrying',
    dotClass: 'bg-warning animate-pulse',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
  },

  // Failure
  failure: {
    label: 'Failed',
    dotClass: 'bg-failure',
    badgeClass: 'bg-failure/10 text-failure border-failure/20',
  },
  failed: {
    label: 'Failed',
    dotClass: 'bg-failure',
    badgeClass: 'bg-failure/10 text-failure border-failure/20',
  },
  unhealthy: {
    label: 'Unhealthy',
    dotClass: 'bg-failure',
    badgeClass: 'bg-failure/10 text-failure border-failure/20',
  },
  retry_exhausted: {
    label: 'Dead Lettered',
    dotClass: 'bg-failure',
    badgeClass: 'bg-failure/10 text-failure border-failure/20',
  },

  // Queued / Pending
  queued: {
    label: 'Queued',
    dotClass: 'bg-info',
    badgeClass: 'bg-info/10 text-info border-info/20',
  },
  pending: {
    label: 'Pending',
    dotClass: 'bg-info',
    badgeClass: 'bg-info/10 text-info border-info/20',
  },
  received: {
    label: 'Received',
    dotClass: 'bg-info animate-pulse',
    badgeClass: 'bg-info/10 text-info border-info/20',
  },

  // In-flight / Processing
  processing: {
    label: 'Processing',
    dotClass: 'bg-inflight animate-pulse',
    badgeClass: 'bg-inflight/10 text-inflight border-inflight/20',
  },
  in_flight: {
    label: 'In Flight',
    dotClass: 'bg-inflight animate-pulse',
    badgeClass: 'bg-inflight/10 text-inflight border-inflight/20',
  },

  // Neutral / Unknown
  neutral: {
    label: 'Neutral',
    dotClass: 'bg-muted',
    badgeClass: 'bg-surface-2 text-muted border-border',
  },
  no_data: {
    label: 'No Data',
    dotClass: 'bg-muted',
    badgeClass: 'bg-surface-2 text-muted border-border',
  },
};

export const StatusBadge = ({
  status = 'neutral',
  label,
  size = 'sm',
  className = '',
}) => {
  const normalizedKey = String(status).toLowerCase().replace(/\s+/g, '_');
  const config = STATUS_CONFIGS[normalizedKey] || STATUS_CONFIGS.neutral;
  const displayLabel = label || config.label;

  const sizeClass =
    size === 'md'
      ? 'text-xs px-2.5 py-1 gap-2'
      : 'text-[11px] px-2 py-0.5 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-sans font-medium rounded border tracking-wide whitespace-nowrap select-none ${sizeClass} ${config.badgeClass} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`}
        aria-hidden="true"
      />
      <span>{displayLabel}</span>
    </span>
  );
};

export default StatusBadge;

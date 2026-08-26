import React from 'react';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

export default function EventStatusBadge({ status, size = 'sm' }) {
  const isLarge = size === 'lg';
  const iconClass = isLarge ? 'w-5 h-5' : 'w-4 h-4';
  const containerClass = isLarge 
    ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border' 
    : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border';

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processed':
        return <CheckCircle2 className={`${iconClass} text-emerald-400`} />;
      case 'failed':
      case 'retry_exhausted':
        return <XCircle className={`${iconClass} text-rose-400`} />;
      case 'processing':
        return <Loader2 className={`${iconClass} text-violet-400 animate-spin`} />;
      case 'retrying':
        return <Loader2 className={`${iconClass} text-orange-400 animate-spin`} />;
      case 'queued':
        return <Clock className={`${iconClass} text-sky-400`} />;
      default: // received
        return <Loader2 className={`${iconClass} text-amber-400 animate-spin`} />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'processed':
        return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
      case 'failed':
      case 'retry_exhausted':
        return 'bg-rose-400/10 text-rose-400 border-rose-400/20';
      case 'processing':
        return 'bg-violet-400/10 text-violet-400 border-violet-400/20';
      case 'retrying':
        return 'bg-orange-400/10 text-orange-400 border-orange-400/20';
      case 'queued':
        return 'bg-sky-400/10 text-sky-400 border-sky-400/20';
      default: // received
        return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
    }
  };

  return (
    <div className={`${containerClass} ${getStatusBadge(status)}`}>
      {getStatusIcon(status)}
      <span className="capitalize">{status}</span>
    </div>
  );
}

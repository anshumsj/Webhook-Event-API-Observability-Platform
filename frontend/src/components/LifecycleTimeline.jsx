import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

export default function LifecycleTimeline({ event }) {
  const ORDER = ['received', 'queued', 'processing', 'processed'];
  const currentIdx = ORDER.indexOf(event.status);

  const steps = [
    { key: 'received',   label: 'Received',   time: event.receivedAt },
    { key: 'queued',     label: 'Queued',     time: null },
    { key: 'processing', label: 'Processing', time: null },
    { key: 'processed',  label: event.status === 'failed' ? 'Failed' : 'Processed', time: event.processedAt },
  ];

  return (
    <div className="relative pl-1">
      {/* Vertical connection spine */}
      <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border" />

      <div className="space-y-4 relative z-10">
        {steps.map((step, idx) => {
          const isCurrent = event.status === step.key;
          const isDone = currentIdx > idx || (event.status === 'processed' && step.key === 'processed');
          const isFailed = event.status === 'failed' && step.key === 'processed';

          let dotClass;
          let icon;

          if (isFailed) {
            dotClass = 'bg-failure/15 border border-failure/30 text-failure';
            icon = <XCircle className="w-3 h-3 text-failure" />;
          } else if (isDone) {
            dotClass = 'bg-success/15 border border-success/30 text-success';
            icon = <CheckCircle2 className="w-3 h-3 text-success" />;
          } else if (isCurrent && step.key === 'processing') {
            dotClass = 'bg-inflight/15 border border-inflight/30 text-inflight';
            icon = <Loader2 className="w-3 h-3 animate-spin text-inflight" />;
          } else if (isCurrent && step.key === 'queued') {
            dotClass = 'bg-info/15 border border-info/30 text-info';
            icon = <Clock className="w-3 h-3 text-info" />;
          } else if (isCurrent) {
            dotClass = 'bg-warning/15 border border-warning/30 text-warning';
            icon = <Loader2 className="w-3 h-3 animate-spin text-warning" />;
          } else {
            dotClass = 'bg-surface-2 border border-border text-muted/40';
            icon = <div className="w-1.5 h-1.5 rounded-full bg-muted/40" />;
          }

          return (
            <div key={step.key} className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${dotClass}`}
                aria-hidden="true"
              >
                {icon}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-xs font-medium leading-none ${
                      isFailed
                        ? 'text-failure'
                        : isDone || isCurrent
                        ? 'text-text'
                        : 'text-muted'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.time && (
                    <span className="font-mono text-[10px] text-muted leading-none">
                      {format(new Date(step.time), 'HH:mm:ss.SSS')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

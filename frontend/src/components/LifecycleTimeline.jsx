import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

export default function LifecycleTimeline({ event }) {
  const ORDER = ['received', 'queued', 'processing', 'processed'];
  const currentIdx = ORDER.indexOf(event.status);
  // 'failed' counts as after 'processing'
  const failedIdx = event.status === 'failed' ? 3 : -1;

  const steps = [
    { key: 'received',   label: 'Received',   time: event.receivedAt },
    { key: 'queued',     label: 'Queued',     time: null },
    { key: 'processing', label: 'Processing', time: null },
    { key: 'processed',  label: event.status === 'failed' ? 'Failed' : 'Processed', time: event.processedAt },
  ];

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border"></div>
      <div className="space-y-6 relative z-10">
        {steps.map((step, idx) => {
          const isCurrent = event.status === step.key;
          const isDone = currentIdx > idx || (event.status === 'processed' && step.key === 'processed');
          const isFailed = event.status === 'failed' && step.key === 'processed';
          const isPending = !isDone && !isCurrent && !isFailed;

          let dotClass, icon;
          if (isFailed) {
            dotClass = 'bg-rose-400/20 border border-rose-400/30';
            icon = <XCircle className="w-4 h-4 text-rose-400" />;
          } else if (isDone) {
            dotClass = 'bg-emerald-400/20 border border-emerald-400/30';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
          } else if (isCurrent && step.key === 'processing') {
            dotClass = 'bg-violet-400/20 border border-violet-400/30';
            icon = <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />;
          } else if (isCurrent && step.key === 'queued') {
            dotClass = 'bg-sky-400/20 border border-sky-400/30';
            icon = <Clock className="w-4 h-4 text-sky-400" />;
          } else if (isCurrent) {
            dotClass = 'bg-amber-400/20 border border-amber-400/30';
            icon = <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
          } else {
            dotClass = 'bg-surface border border-border';
            icon = <div className="w-2 h-2 rounded-full bg-muted"></div>;
          }

          return (
            <div key={step.key} className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${dotClass}`}>
                {icon}
              </div>
              <div>
                <p className={`text-sm font-medium ${
                  isFailed ? 'text-rose-400' :
                  isDone || isCurrent ? 'text-text' : 'text-muted'
                }`}>{step.label}</p>
                {step.time && (
                  <p className="text-xs text-muted">
                    {format(new Date(step.time), 'HH:mm:ss.SSS')}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

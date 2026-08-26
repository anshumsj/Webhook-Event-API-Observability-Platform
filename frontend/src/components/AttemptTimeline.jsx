import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function AttemptTimeline({ attempts, eventStatus }) {
  if (!attempts || attempts.length === 0) return null;

  return (
    <div className="relative">
      <div className="absolute left-[43px] top-8 bottom-8 w-px bg-border"></div>
      <div className="space-y-6 relative z-10">
        {attempts.map((attempt, index) => {
          const isSuccess = attempt.status === 'success';
          const isFailed = attempt.status === 'failed' || attempt.status === 'timeout';
          
          let dotClass, icon;
          if (isSuccess) {
            dotClass = 'bg-emerald-400/20 border border-emerald-400/30';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
          } else if (isFailed) {
            dotClass = 'bg-rose-400/20 border border-rose-400/30';
            icon = <XCircle className="w-4 h-4 text-rose-400" />;
          } else {
            dotClass = 'bg-amber-400/20 border border-amber-400/30';
            icon = <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
          }

          return (
            <React.Fragment key={attempt.attemptNumber}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${dotClass} mt-1 relative z-10`}>
                  {icon}
                </div>
                <div className="flex-1 bg-background border border-border rounded-lg p-4 shadow-sm hover:border-primary/30 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                    <h4 className={`font-semibold text-base flex items-center gap-2 ${isSuccess ? 'text-emerald-400' : isFailed ? 'text-rose-400' : 'text-amber-400'}`}>
                      Attempt #{attempt.attemptNumber}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 uppercase tracking-wider text-muted">
                        {attempt.status}
                      </span>
                    </h4>
                    <div className="text-left sm:text-right text-xs text-muted font-mono flex flex-row sm:flex-col gap-3 sm:gap-0">
                      <div>{format(new Date(attempt.startedAt), 'MMM d, HH:mm:ss.SSS')}</div>
                      {attempt.latencyMs != null && <div>{attempt.latencyMs} ms</div>}
                    </div>
                  </div>
                  
                  {attempt.destinationUrl && (
                    <div className="text-sm mb-2 text-muted truncate">
                      <span className="font-semibold mr-1">To:</span> 
                      {attempt.requestMethod === 'POST' && <span className="text-xs font-mono font-bold text-sky-400 bg-sky-400/10 px-1 rounded mr-1">POST</span>}
                      <span className="font-mono text-xs">{attempt.destinationUrl}</span>
                    </div>
                  )}

                  {attempt.responseStatusCode != null && (
                    <div className="text-sm mb-2">
                      <span className="text-muted font-semibold mr-2">HTTP Status:</span>
                      <span className={attempt.responseStatusCode >= 200 && attempt.responseStatusCode < 300 ? 'text-emerald-400 font-mono font-bold' : 'text-rose-400 font-mono font-bold'}>
                        {attempt.responseStatusCode}
                      </span>
                    </div>
                  )}
                  
                  {attempt.errorMessage && (
                    <div className="text-sm mb-3">
                      <span className="text-muted font-semibold block mb-1">Error Message:</span>
                      <span className="text-rose-400 font-mono text-xs block bg-rose-400/5 p-2 rounded border border-rose-400/10 break-all">{attempt.errorMessage}</span>
                    </div>
                  )}

                  {attempt.responseBody && (
                    <div className="mt-3">
                      <span className="text-muted text-xs font-semibold uppercase mb-1 block">Response Body</span>
                      <pre className="text-xs font-mono text-muted bg-surface p-3 rounded border border-border whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                        {attempt.responseBody}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Connector for Retry */}
              {index < attempts.length - 1 && (
                <div className="flex relative z-10 py-2" style={{ marginLeft: '12px' }}>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted bg-surface px-2 py-1 rounded border border-border z-20 shadow-sm flex items-center gap-1.5">
                    ↓ Retry
                  </span>
                </div>
              )}

              {/* Terminal Node for Success or DLQ */}
              {index === attempts.length - 1 && (eventStatus === 'processed' || eventStatus === 'retry_exhausted') && (
                <div className="flex relative z-10 pt-4 pb-2" style={{ marginLeft: '-15px' }}>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider bg-surface z-20 shadow-sm ${
                      eventStatus === 'processed' 
                      ? 'text-emerald-400 border-emerald-400/30' 
                      : 'text-rose-400 border-rose-400/30'
                    }`}>
                      {eventStatus === 'processed' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {eventStatus === 'processed' ? 'Delivered' : 'Retry Exhausted / Dead Lettered'}
                    </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

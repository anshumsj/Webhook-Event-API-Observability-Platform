import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  SearchCode,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import ClipboardCopy from './ClipboardCopy';
import StatusBadge from './ui/StatusBadge';
import { useGhostMode } from '../context/GhostModeContext';

export default function AttemptTimeline({ attempts, eventStatus, eventPayload }) {
  const [expandedAttemptId, setExpandedAttemptId] = useState(null);
  const [activeTab, setActiveTab] = useState('request'); // 'request' | 'response'
  const { redactDestinationUrl, redactHeaders: redactHdrs } = useGhostMode();

  if (!attempts || attempts.length === 0) return null;

  const toggleInspector = (attemptId) => {
    if (expandedAttemptId === attemptId) {
      setExpandedAttemptId(null);
    } else {
      setExpandedAttemptId(attemptId);
      setActiveTab('request');
    }
  };

  const renderHeaders = (headers) => {
    if (!headers || Object.keys(headers).length === 0) {
      return <div className="text-muted text-xs italic font-mono">No headers recorded.</div>;
    }
    return (
      <div className="divide-y divide-border/40 font-mono text-xs">
        {Object.entries(headers).map(([key, val]) => (
          <div
            key={key}
            className="py-1.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 first:pt-0 last:pb-0"
          >
            <span className="text-text font-medium min-w-[180px] shrink-0">{key}</span>
            <span className="text-muted break-all select-all">
              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderBody = (bodyContent, isRequest = false) => {
    const isMissing = isRequest
      ? bodyContent === undefined || bodyContent === ''
      : bodyContent == null || bodyContent === '';

    if (isMissing) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-canvas border border-border border-dashed rounded text-center">
          <SearchCode className="w-5 h-5 text-muted mb-1.5 opacity-60" />
          <p className="text-muted text-xs font-medium">
            Empty {isRequest ? 'Request' : 'Response'} Body
          </p>
          <p className="text-[11px] text-muted/70 mt-0.5">
            {isRequest ? 'No payload was transmitted.' : 'The destination returned an empty response body.'}
          </p>
        </div>
      );
    }

    let formattedBody = String(bodyContent);

    if (isRequest) {
      if (typeof bodyContent === 'object') {
        formattedBody = JSON.stringify(bodyContent, null, 2);
      } else {
        formattedBody = String(bodyContent);
      }
    } else {
      try {
        if (typeof bodyContent === 'object') {
          formattedBody = JSON.stringify(bodyContent, null, 2);
        } else if (
          typeof bodyContent === 'string' &&
          (bodyContent.trim().startsWith('{') || bodyContent.trim().startsWith('['))
        ) {
          const parsed = JSON.parse(bodyContent);
          formattedBody = JSON.stringify(parsed, null, 2);
        }
      } catch {
        // Keep original string if parsing fails
      }
    }

    return (
      <div className="relative group">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
          <ClipboardCopy text={formattedBody} label="Copy Body" />
        </div>
        <pre className="text-xs font-mono text-muted bg-canvas p-3 rounded border border-border whitespace-pre-wrap break-all max-h-72 overflow-y-auto leading-relaxed select-all">
          {formattedBody}
        </pre>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {attempts.map((attempt, index) => {
        const isSuccess = attempt.status === 'success';
        const isFailed = attempt.status === 'failed' || attempt.status === 'timeout';
        const isExpanded = expandedAttemptId === attempt._id;

        return (
          <React.Fragment key={attempt._id || attempt.attemptNumber}>
            {/* Attempt Container */}
            <div className="bg-surface-1 border border-border rounded overflow-hidden transition-colors">
              {/* Attempt Bar / Header */}
              <div className="p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Status Icon */}
                    <div className="flex items-center justify-center shrink-0">
                      {isSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : isFailed ? (
                        <XCircle className="w-4 h-4 text-failure" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-warning animate-spin" />
                      )}
                    </div>

                    {/* Attempt Number */}
                    <span className="font-mono text-xs font-semibold text-text">
                      Attempt #{attempt.attemptNumber}
                    </span>

                    {/* Origin / Type Badge */}
                    {attempt.attemptType === 'manual' ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 border border-primary/25 text-primary uppercase font-medium">
                        Manual Replay
                      </span>
                    ) : attempt.attemptNumber > 1 ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted uppercase font-medium">
                        Automatic Retry
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted uppercase font-medium">
                        Initial Delivery
                      </span>
                    )}

                    {/* Status Badge */}
                    <StatusBadge
                      status={
                        isSuccess
                          ? 'processed'
                          : attempt.status === 'timeout'
                          ? 'failed'
                          : attempt.status
                      }
                      label={
                        attempt.status === 'timeout'
                          ? 'Timeout'
                          : isSuccess
                          ? 'Delivered'
                          : 'Failed'
                      }
                      size="sm"
                    />
                  </div>

                  {/* Latency & Timestamp */}
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
                    {attempt.latencyMs != null && (
                      <span className="text-text">{attempt.latencyMs} ms</span>
                    )}
                    {attempt.startedAt && (
                      <span>{format(new Date(attempt.startedAt), 'MMM d, HH:mm:ss.SSS')}</span>
                    )}
                  </div>
                </div>

                {/* Destination & HTTP status line */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0 font-mono">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted uppercase shrink-0">
                      {attempt.requestMethod || 'POST'}
                    </span>
                    {attempt.responseStatusCode != null && (
                      <span
                        className={`text-[11px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                          attempt.responseStatusCode >= 200 && attempt.responseStatusCode < 300
                            ? 'bg-success/10 text-success border-success/25'
                            : 'bg-failure/10 text-failure border-failure/25'
                        }`}
                      >
                        HTTP {attempt.responseStatusCode}
                      </span>
                    )}
                    <span
                      className="text-muted truncate text-[11px]"
                      title={attempt.destinationUrl}
                    >
                      {redactDestinationUrl(attempt.destinationUrl) || 'Unknown destination'}
                    </span>
                  </div>

                  {/* Toggle Inspector Button */}
                  <button
                    type="button"
                    onClick={() => toggleInspector(attempt._id)}
                    className="inline-flex items-center gap-1.5 h-6 px-2 text-xs font-mono text-muted hover:text-text bg-surface-2 hover:bg-surface-3 border border-border rounded transition-colors shrink-0 cursor-pointer"
                  >
                    <SearchCode className="w-3 h-3 text-primary" />
                    <span>{isExpanded ? 'Hide Details' : 'Inspect'}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Inspector Panel */}
              {isExpanded && (
                <div className="border-t border-border bg-canvas/60">
                  {/* Tabs */}
                  <div className="flex items-center border-b border-border px-3 bg-surface-2/40 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('request')}
                      className={`px-3 py-2 font-mono font-medium border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'request'
                          ? 'border-primary text-text'
                          : 'border-transparent text-muted hover:text-text'
                      }`}
                    >
                      Request
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('response')}
                      className={`px-3 py-2 font-mono font-medium border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'response'
                          ? 'border-primary text-text'
                          : 'border-transparent text-muted hover:text-text'
                      }`}
                    >
                      Response
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-3 space-y-4">
                    {activeTab === 'request' && (
                      <>
                        {/* Destination */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-medium">
                              Target Destination
                            </span>
                            {attempt.destinationUrl && (
                              <ClipboardCopy
                                text={`${attempt.requestMethod || 'POST'} ${attempt.destinationUrl}`}
                                displayText={`${attempt.requestMethod || 'POST'} ${redactDestinationUrl(attempt.destinationUrl)}`}
                                label="Copy URL"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 bg-canvas border border-border p-2 rounded font-mono text-xs overflow-x-auto">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-2 border border-border text-primary uppercase">
                              {attempt.requestMethod || 'POST'}
                            </span>
                            <span className="text-text select-all whitespace-nowrap">
                              {attempt.destinationUrl ? redactDestinationUrl(attempt.destinationUrl) : <span className="italic text-muted">Unknown</span>}
                            </span>
                          </div>
                        </div>

                        {/* Request Headers */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-medium">
                              Request Headers
                            </span>
                            {attempt.requestHeaders &&
                              Object.keys(attempt.requestHeaders).length > 0 && (
                                <ClipboardCopy
                                  text={JSON.stringify(attempt.requestHeaders, null, 2)}
                                  label="Copy Headers"
                                />
                              )}
                          </div>
                          <div className="bg-canvas border border-border p-3 rounded max-h-48 overflow-y-auto">
                            {renderHeaders(redactHdrs(attempt.requestHeaders))}
                          </div>
                        </div>

                        {/* Request Body */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-medium">
                              Request Payload
                            </span>
                          </div>
                          {renderBody(eventPayload, true)}
                        </div>
                      </>
                    )}

                    {activeTab === 'response' && (
                      <>
                        {/* Response Status & Error Alert */}
                        <div>
                          <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-medium block mb-1">
                            Status & Diagnostics
                          </span>
                          {attempt.status === 'timeout' || attempt.status === 'failed' ? (
                            <div className="bg-failure/10 border border-failure/25 p-3 rounded flex items-start gap-2.5">
                              <AlertCircle className="w-4 h-4 text-failure shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-failure mb-0.5 font-mono">
                                  {attempt.status === 'timeout'
                                    ? 'Network Timeout'
                                    : 'Delivery Failed'}
                                  {attempt.responseStatusCode &&
                                    ` (HTTP ${attempt.responseStatusCode})`}
                                </p>
                                <p className="text-xs text-failure/80 font-mono break-all select-all">
                                  {attempt.errorMessage || 'No error message returned by destination.'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 bg-canvas border border-border p-2 rounded font-mono text-xs">
                              <span className="text-success font-medium">
                                HTTP {attempt.responseStatusCode || 200} OK
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Response Headers */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-medium">
                              Response Headers
                            </span>
                            {attempt.responseHeaders &&
                              Object.keys(attempt.responseHeaders).length > 0 && (
                                <ClipboardCopy
                                  text={JSON.stringify(attempt.responseHeaders, null, 2)}
                                  label="Copy Headers"
                                />
                              )}
                          </div>
                          <div className="bg-canvas border border-border p-3 rounded max-h-48 overflow-y-auto">
                            {renderHeaders(attempt.responseHeaders)}
                          </div>
                        </div>

                        {/* Response Body */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-medium">
                              Response Body
                            </span>
                          </div>
                          {renderBody(attempt.responseBody, false)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Visual Connector Between Attempts */}
            {index < attempts.length - 1 && (
              <div className="flex items-center gap-2 pl-4 py-0.5 font-mono text-[11px] text-muted select-none">
                <span className="text-border-strong">↳</span>
                <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-muted">
                  {attempts[index + 1]?.attemptType === 'manual'
                    ? 'Manual Replay Queued'
                    : 'Automatic Retry Dispatched'}
                </span>
              </div>
            )}

            {/* Terminal State Node */}
            {index === attempts.length - 1 &&
              (eventStatus === 'processed' || eventStatus === 'retry_exhausted') && (
                <div className="flex items-center gap-2 pl-4 pt-1 font-mono text-xs select-none">
                  <span className="text-border-strong">✓</span>
                  <StatusBadge
                    status={eventStatus === 'processed' ? 'processed' : 'retry_exhausted'}
                    label={
                      eventStatus === 'processed'
                        ? 'Delivered'
                        : 'Retry Exhausted / Dead Lettered'
                    }
                    size="sm"
                  />
                </div>
              )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

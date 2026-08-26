import React, { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Loader2, SearchCode, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import ClipboardCopy from './ClipboardCopy';

export default function AttemptTimeline({ attempts, eventStatus, eventPayload }) {
  const [expandedAttemptId, setExpandedAttemptId] = useState(null);
  const [activeTab, setActiveTab] = useState('request'); // 'request' | 'response'

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
      return <div className="text-muted text-xs italic">No headers provided.</div>;
    }
    return (
      <div className="space-y-1">
        {Object.entries(headers).map(([key, val]) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
            <span className="font-mono text-xs text-text min-w-[200px]">{key}</span>
            <span className="font-mono text-xs text-muted break-all">{val}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderBody = (bodyContent, isRequest = false) => {
    const isMissing = isRequest 
      ? (bodyContent === undefined || bodyContent === '')
      : (bodyContent == null || bodyContent === '');

    if (isMissing) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-background border border-border rounded-lg border-dashed">
          <SearchCode className="w-8 h-8 text-muted mb-2 opacity-50" />
          <p className="text-muted text-sm font-medium">Empty {isRequest ? 'Request' : 'Response'} Body</p>
          <p className="text-xs text-muted/70 mt-1">
            {isRequest ? 'No payload was sent.' : 'The destination server returned an empty body.'}
          </p>
        </div>
      );
    }
    
    let isJson = false;
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
          isJson = true;
        } else if (typeof bodyContent === 'string' && (bodyContent.trim().startsWith('{') || bodyContent.trim().startsWith('['))) {
          const parsed = JSON.parse(bodyContent);
          formattedBody = JSON.stringify(parsed, null, 2);
          isJson = true;
        }
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return (
      <div className="relative group">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ClipboardCopy text={formattedBody} label="Copy Body" />
        </div>
        <pre className="text-xs font-mono text-muted bg-background p-4 rounded-lg border border-border whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
          {formattedBody}
        </pre>
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="absolute left-[43px] top-8 bottom-8 w-px bg-border"></div>
      <div className="space-y-6 relative z-10">
        {attempts.map((attempt, index) => {
          const isSuccess = attempt.status === 'success';
          const isFailed = attempt.status === 'failed' || attempt.status === 'timeout';
          const isExpanded = expandedAttemptId === attempt._id;
          
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
                <div className="flex-1 bg-background border border-border rounded-lg shadow-sm hover:border-primary/30 transition-colors overflow-hidden">
                  
                  {/* Attempt Header (Always visible) */}
                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                      <h4 className={`font-semibold text-base flex items-center gap-2 ${isSuccess ? 'text-emerald-400' : isFailed ? 'text-rose-400' : 'text-amber-400'}`}>
                        Attempt #{attempt.attemptNumber}
                        {attempt.attemptType === 'manual' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 uppercase tracking-wider text-primary">
                            Manual Replay
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 uppercase tracking-wider text-muted">
                          {attempt.status}
                        </span>
                      </h4>
                      <div className="text-left sm:text-right text-xs text-muted font-mono flex flex-row sm:flex-col gap-3 sm:gap-0">
                        <div>{format(new Date(attempt.startedAt), 'MMM d, HH:mm:ss.SSS')}</div>
                        {attempt.latencyMs != null && <div>{attempt.latencyMs} ms</div>}
                      </div>
                    </div>
                    
                    {/* Simplified Metadata */}
                    <div className="flex items-center gap-2 text-sm text-muted truncate mb-4">
                      {attempt.requestMethod === 'POST' && <span className="text-xs font-mono font-bold text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded">POST</span>}
                      {attempt.responseStatusCode != null && (
                        <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${attempt.responseStatusCode >= 200 && attempt.responseStatusCode < 300 ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                          {attempt.responseStatusCode}
                        </span>
                      )}
                      <span className="font-mono text-xs truncate">{attempt.destinationUrl}</span>
                    </div>

                    <button 
                      onClick={() => toggleInspector(attempt._id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-text bg-surface border border-border px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors"
                    >
                      <SearchCode className="w-3.5 h-3.5 text-primary" />
                      {isExpanded ? 'Close Inspector' : 'Inspect Request / Response'}
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 ml-1" /> : <ChevronRight className="w-3.5 h-3.5 ml-1" />}
                    </button>
                  </div>

                  {/* Expanded Inspector Panel */}
                  {isExpanded && (
                    <div className="border-t border-border bg-surface/30">
                      
                      {/* Tabs */}
                      <div className="flex items-center border-b border-border px-4">
                        <button
                          onClick={() => setActiveTab('request')}
                          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'request' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
                        >
                          Request
                        </button>
                        <button
                          onClick={() => setActiveTab('response')}
                          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'response' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}
                        >
                          Response
                        </button>
                      </div>

                      {/* Tab Content */}
                      <div className="p-4 space-y-6">
                        {activeTab === 'request' && (
                          <>
                            {/* Request URL & Method */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Destination</h5>
                                {attempt.destinationUrl && <ClipboardCopy text={`${attempt.requestMethod || 'POST'} ${attempt.destinationUrl}`} label="Copy URL" />}
                              </div>
                              <div className="flex items-center gap-2 bg-background border border-border p-3 rounded-lg overflow-x-auto">
                                <span className="text-sm font-mono font-bold text-sky-400">{attempt.requestMethod || 'POST'}</span>
                                <span className="text-sm font-mono text-text whitespace-nowrap">{attempt.destinationUrl || <span className="italic text-muted">Unknown</span>}</span>
                              </div>
                            </div>

                            {/* Request Headers */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Headers</h5>
                                {attempt.requestHeaders && Object.keys(attempt.requestHeaders).length > 0 && (
                                  <ClipboardCopy text={JSON.stringify(attempt.requestHeaders, null, 2)} label="Copy Headers" />
                                )}
                              </div>
                              <div className="bg-background border border-border p-4 rounded-lg">
                                {renderHeaders(attempt.requestHeaders)}
                              </div>
                            </div>

                            {/* Request Body */}
                            <div>
                              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Body</h5>
                              {renderBody(eventPayload, true)}
                            </div>
                          </>
                        )}

                        {activeTab === 'response' && (
                          <>
                            {/* Response Status & Errors */}
                            <div>
                              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Status</h5>
                              {attempt.status === 'timeout' || attempt.status === 'failed' ? (
                                <div className="bg-rose-400/5 border border-rose-400/20 p-4 rounded-lg flex items-start gap-3">
                                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-rose-400 mb-1">
                                      {attempt.status === 'timeout' ? 'Network Timeout' : 'Delivery Failed'}
                                      {attempt.responseStatusCode && ` (HTTP ${attempt.responseStatusCode})`}
                                    </p>
                                    <p className="text-xs text-rose-400/80 font-mono break-all">{attempt.errorMessage || 'No error message available'}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 bg-background border border-border p-3 rounded-lg">
                                  <span className={`text-sm font-mono font-bold ${attempt.responseStatusCode >= 200 && attempt.responseStatusCode < 300 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {attempt.responseStatusCode || 'Unknown'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Response Headers */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Headers</h5>
                                {attempt.responseHeaders && Object.keys(attempt.responseHeaders).length > 0 && (
                                  <ClipboardCopy text={JSON.stringify(attempt.responseHeaders, null, 2)} label="Copy Headers" />
                                )}
                              </div>
                              <div className="bg-background border border-border p-4 rounded-lg">
                                {renderHeaders(attempt.responseHeaders)}
                              </div>
                            </div>

                            {/* Response Body */}
                            <div>
                              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Body</h5>
                              {renderBody(attempt.responseBody, false)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Connector for Retry */}
              {index < attempts.length - 1 && (
                <div className="flex relative z-10 py-2" style={{ marginLeft: '12px' }}>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted bg-surface px-2 py-1 rounded border border-border z-20 shadow-sm flex items-center gap-1.5">
                    ↓ {attempts[index + 1]?.attemptType === 'manual' ? 'Manual Replay' : 'Retry'}
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

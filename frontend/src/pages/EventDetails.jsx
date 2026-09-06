import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  ArrowLeft,
  Clock,
  XCircle,
  Loader2,
  Braces,
  AlignLeft,
  Activity,
  RotateCcw,
  Layers,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import AttemptTimeline from '../components/AttemptTimeline';
import LifecycleTimeline from '../components/LifecycleTimeline';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import ClipboardCopy from '../components/ClipboardCopy';
import { getErrorMessage } from '../utils/errorHandler';

export default function EventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useSocket();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState(null);
  const [replaySuccess, setReplaySuccess] = useState(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState('payload'); // 'payload' | 'headers'

  // Timeout refs for cleanup
  const replayTimeout1Ref = useRef(null);
  const replayTimeout2Ref = useRef(null);

  useEffect(() => {
    return () => {
      if (replayTimeout1Ref.current) clearTimeout(replayTimeout1Ref.current);
      if (replayTimeout2Ref.current) clearTimeout(replayTimeout2Ref.current);
    };
  }, []);

  const fetchEventDetails = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      setEvent(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load event details or you do not have permission.'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    const searchString = location.state?.search ? `?${location.state.search}` : '';
    navigate(`/events${searchString}`);
  };

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  const handleReplay = async () => {
    if (replaying) return;
    setReplaying(true);
    setReplayError(null);
    setReplaySuccess(null);
    try {
      await api.post(`/events/${eventId}/replay`);
      setReplaySuccess('Replay successfully queued');
      // Wait for worker to process, then refresh to show new attempt
      replayTimeout1Ref.current = setTimeout(() => fetchEventDetails(), 1000);
      replayTimeout2Ref.current = setTimeout(() => fetchEventDetails(), 3000);
    } catch (err) {
      setReplayError(getErrorMessage(err, 'Failed to queue replay'));
    } finally {
      setReplaying(false);
    }
  };

  // Real-time worker update reconciliation
  useEffect(() => {
    if (!socket || !event) return;

    const projectId = event.projectId;
    socket.emit('join_project', projectId);

    const handleEventUpdate = (updatedEvent) => {
      if (updatedEvent.eventId !== eventId) return;
      setEvent((prev) => ({
        ...prev,
        status: updatedEvent.status,
        processingTimeMs: updatedEvent.processingTimeMs,
        processedAt: updatedEvent.processedAt || prev.processedAt,
      }));
    };

    socket.on('webhook:event:updated', handleEventUpdate);
    return () => {
      socket.off('webhook:event:updated', handleEventUpdate);
      socket.emit('leave_project', projectId);
    };
  }, [socket, event?.projectId, eventId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-48 bg-surface-1 border border-border rounded animate-pulse" />
        <div className="h-20 bg-surface-1 border border-border rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-64 bg-surface-1 border border-border rounded animate-pulse" />
            <div className="h-64 bg-surface-1 border border-border rounded animate-pulse" />
          </div>
          <div className="h-80 bg-surface-1 border border-border rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <div className="bg-surface-1 border border-border p-8 rounded flex flex-col items-center">
          <div className="w-10 h-10 bg-failure/10 border border-failure/20 rounded-full flex items-center justify-center mb-3">
            <XCircle className="w-5 h-5 text-failure" />
          </div>
          <h2 className="text-base font-semibold text-text mb-1">Event Not Found</h2>
          <p className="text-xs text-muted max-w-md mb-5">
            {error ||
              "We couldn't locate this event. It may have been pruned, or you lack authorization for this project."}
          </p>
          <Button variant="secondary" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Events</span>
          </Button>
        </div>
      </div>
    );
  }

  // Derived Telemetry
  const totalAttempts = event.attempts?.length || 0;
  const retries = Math.max(0, totalAttempts - 1);

  let finalStatusDisplay = 'Pending';
  if (event.status === 'processed') finalStatusDisplay = 'Delivered';
  else if (event.status === 'failed') finalStatusDisplay = 'Failed';
  else if (event.status === 'retry_exhausted') finalStatusDisplay = 'Dead Lettered';

  let totalDurationDisplay = 'In Progress';
  if (
    event.status === 'processed' ||
    event.status === 'failed' ||
    event.status === 'retry_exhausted'
  ) {
    if (event.processingTimeMs != null && !isNaN(event.processingTimeMs)) {
      const ms = event.processingTimeMs;
      if (ms < 1000) totalDurationDisplay = `${ms} ms`;
      else totalDurationDisplay = `${(ms / 1000).toFixed(2)} s`;
    } else {
      totalDurationDisplay = 'Unknown';
    }
  }

  const payloadString =
    typeof event.payload === 'object' && event.payload !== null
      ? JSON.stringify(event.payload, null, 2)
      : String(event.payload || '');

  const headersString =
    event.headers && typeof event.headers === 'object'
      ? JSON.stringify(event.headers, null, 2)
      : '{}';

  return (
    <div className="space-y-4 max-w-6xl">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-1 border border-border p-3 rounded">
        {/* Left: Navigation & Core Identifiers */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBack}
            className="shrink-0"
            title="Back to Event Explorer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Events</span>
          </Button>

          <div className="h-4 w-px bg-border shrink-0" />

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-mono text-sm font-semibold text-text select-all tracking-tight truncate">
              {event.eventId}
            </span>
            <ClipboardCopy text={event.eventId} label="Copy ID" />

            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted uppercase shrink-0">
              POST
            </span>

            <span
              className="text-xs font-mono text-text bg-surface-2 border border-border px-2 py-0.5 rounded truncate max-w-[200px]"
              title={event.eventType}
            >
              {event.eventType}
            </span>

            <StatusBadge status={event.status} size="md" />
          </div>
        </div>

        {/* Right: Replay Action */}
        {['processed', 'failed', 'retry_exhausted'].includes(event.status) && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {replayError && (
              <span className="text-xs font-mono text-failure max-w-xs truncate" title={replayError}>
                {replayError}
              </span>
            )}
            {replaySuccess && (
              <span className="text-xs font-mono text-success">{replaySuccess}</span>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleReplay}
              disabled={replaying}
              title="Dispatch manual webhook replay"
            >
              {replaying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>{replaying ? 'Queuing...' : 'Replay Event'}</span>
            </Button>
          </div>
        )}
      </div>

      {/* 2. Telemetry Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Total Attempts */}
        <div className="bg-surface-1 border border-border rounded p-2.5">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-0.5">
            Attempts
          </span>
          <span className="text-sm font-mono font-semibold text-text">{totalAttempts}</span>
        </div>

        {/* Retries */}
        <div className="bg-surface-1 border border-border rounded p-2.5">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-0.5">
            Retries
          </span>
          <span className="text-sm font-mono font-semibold text-text">{retries}</span>
        </div>

        {/* Final Status */}
        <div className="bg-surface-1 border border-border rounded p-2.5">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-0.5">
            Final Outcome
          </span>
          <span
            className={`text-sm font-mono font-semibold ${
              finalStatusDisplay === 'Delivered'
                ? 'text-success'
                : finalStatusDisplay === 'Dead Lettered' || finalStatusDisplay === 'Failed'
                ? 'text-failure'
                : 'text-warning'
            }`}
          >
            {finalStatusDisplay}
          </span>
        </div>

        {/* Total Duration */}
        <div className="bg-surface-1 border border-border rounded p-2.5">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-0.5">
            Duration
          </span>
          <span className="text-sm font-mono font-semibold text-text">
            {totalDurationDisplay}
          </span>
        </div>

        {/* Request ID */}
        <div className="bg-surface-1 border border-border rounded p-2.5 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
              Request ID
            </span>
            {event.requestId && (
              <ClipboardCopy text={event.requestId} label="Copy" className="px-1 py-0 text-[10px]" />
            )}
          </div>
          <span
            className="text-xs font-mono text-text block truncate"
            title={event.requestId}
          >
            {event.requestId || '—'}
          </span>
        </div>

        {/* Project */}
        <div className="bg-surface-1 border border-border rounded p-2.5 min-w-0">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-0.5">
            Project
          </span>
          <span
            className="text-xs font-medium text-text block truncate"
            title={event.projectName || event.projectId}
          >
            {event.projectName || event.projectId || '—'}
          </span>
        </div>
      </div>

      {/* 3. Main Workbench Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Attempts Timeline & Inspector (lg:col-span-2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Delivery Attempts Section */}
          <div className="bg-surface-1 border border-border rounded overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-border bg-surface-2/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold text-text tracking-wide">
                  Delivery Attempts
                </h3>
                <span className="font-mono text-[11px] text-muted">
                  ({totalAttempts})
                </span>
              </div>
            </div>

            <div className="p-3.5">
              {event.attempts && event.attempts.length > 0 ? (
                <AttemptTimeline
                  attempts={event.attempts}
                  eventStatus={event.status}
                  eventPayload={event.payload}
                />
              ) : (
                <div className="bg-canvas border border-border border-dashed rounded p-6 text-center">
                  <Clock className="w-5 h-5 text-muted mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-medium text-text mb-0.5">
                    Awaiting Delivery Execution
                  </p>
                  <p className="text-[11px] text-muted max-w-sm mx-auto">
                    This webhook event is queued or currently being processed by the worker queue.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ingest Payload & Request Headers Workbench */}
          <div className="bg-surface-1 border border-border rounded overflow-hidden">
            {/* Workbench Tab Header */}
            <div className="px-3.5 py-2 border-b border-border bg-surface-2/40 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('payload')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                    activeInspectorTab === 'payload'
                      ? 'bg-surface-3 text-text border border-border'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  <Braces className="w-3.5 h-3.5 text-primary" />
                  <span>Payload</span>
                  <span className="text-[10px] text-muted">
                    ({new Blob([payloadString]).size} B)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('headers')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                    activeInspectorTab === 'headers'
                      ? 'bg-surface-3 text-text border border-border'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5 text-primary" />
                  <span>Headers</span>
                  <span className="text-[10px] text-muted">
                    ({event.headers ? Object.keys(event.headers).length : 0})
                  </span>
                </button>
              </div>

              {/* Copy Affordance */}
              <div>
                {activeInspectorTab === 'payload' ? (
                  <ClipboardCopy text={payloadString} label="Copy Payload" />
                ) : (
                  <ClipboardCopy text={headersString} label="Copy Headers" />
                )}
              </div>
            </div>

            {/* Workbench Body */}
            <div className="p-3.5">
              {activeInspectorTab === 'payload' ? (
                <div className="relative group">
                  <pre className="text-xs font-mono text-muted bg-canvas p-3 rounded border border-border whitespace-pre-wrap break-all max-h-[380px] overflow-y-auto leading-relaxed select-all">
                    {payloadString}
                  </pre>
                </div>
              ) : (
                <div className="bg-canvas border border-border rounded p-3 max-h-[380px] overflow-y-auto">
                  {event.headers && Object.keys(event.headers).length > 0 ? (
                    <div className="divide-y divide-border/40 font-mono text-xs">
                      {Object.entries(event.headers).map(([key, val]) => (
                        <div
                          key={key}
                          className="py-1.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 first:pt-0 last:pb-0"
                        >
                          <span className="text-text font-medium min-w-[200px] shrink-0">
                            {key}
                          </span>
                          <span className="text-muted break-all select-all">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-muted italic">
                      No request headers recorded during webhook ingest.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Lifecycle Progression & Diagnostic Metadata (lg:col-span-1) */}
        <div className="space-y-4">
          {/* Lifecycle Progression */}
          <div className="bg-surface-1 border border-border rounded overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-border bg-surface-2/40 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-semibold text-text tracking-wide">
                Ingest Lifecycle
              </h3>
            </div>
            <div className="p-3.5">
              <LifecycleTimeline event={event} />
            </div>
          </div>

          {/* Diagnostic Metadata */}
          <div className="bg-surface-1 border border-border rounded overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-border bg-surface-2/40 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-semibold text-text tracking-wide">
                Diagnostic Telemetry
              </h3>
            </div>
            <div className="p-3.5 space-y-3 font-mono text-xs">
              <div>
                <span className="text-[10px] uppercase text-muted tracking-wider block mb-0.5">
                  Received Timestamp
                </span>
                <span className="text-text">
                  {event.receivedAt
                    ? format(new Date(event.receivedAt), 'MMM d, yyyy HH:mm:ss.SSS')
                    : '—'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase text-muted tracking-wider block mb-0.5">
                  Processed Timestamp
                </span>
                <span className="text-text">
                  {event.processedAt
                    ? format(new Date(event.processedAt), 'MMM d, yyyy HH:mm:ss.SSS')
                    : '— (Pending)'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase text-muted tracking-wider block mb-0.5">
                  Worker Execution Latency
                </span>
                <span className="text-text">
                  {event.processingTimeMs != null ? `${event.processingTimeMs} ms` : '—'}
                </span>
              </div>

              {event.endpointId && (
                <div>
                  <span className="text-[10px] uppercase text-muted tracking-wider block mb-0.5">
                    Endpoint Binding
                  </span>
                  <span className="text-text truncate block select-all" title={String(event.endpointId)}>
                    {String(event.endpointId)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

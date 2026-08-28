import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Database, Braces, AlignLeft, Box, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import AttemptTimeline from '../components/AttemptTimeline';
import LifecycleTimeline from '../components/LifecycleTimeline';
import EventStatusBadge from '../components/EventStatusBadge';
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
      // Wait a moment for worker to process, then refresh to show new attempt
      setTimeout(() => fetchEventDetails(), 1000);
      setTimeout(() => fetchEventDetails(), 3000); // Poll again
    } catch (err) {
      setReplayError(err.response?.data?.message || 'Failed to queue replay');
    } finally {
      setReplaying(false);
    }
  };

  // Listen for the worker's 'processed' update — patch status/timing in-place.
  // Join the project room once the event is loaded so we receive targeted updates.
  useEffect(() => {
    if (!socket || !event) return;

    const projectId = event.projectId;
    socket.emit('join_project', projectId);

    const handleEventUpdate = (updatedEvent) => {
      if (updatedEvent.eventId !== eventId) return;
      setEvent(prev => ({
        ...prev,
        status:           updatedEvent.status,
        processingTimeMs: updatedEvent.processingTimeMs,
        processedAt:      updatedEvent.processedAt || prev.processedAt,
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
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-1/4 bg-surface/50 border border-border rounded-lg"></div>
        <div className="h-64 bg-surface/50 border border-border rounded-xl"></div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto mt-12 text-center">
        <div className="bg-surface border border-border p-8 rounded-xl shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Event Not Found</h2>
          <p className="text-muted mb-6">
            {error || "We couldn't find this event. It may have been deleted, or you don't have permission to view it."}
          </p>
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  // Render payload safely
  const renderPayload = () => {
    let payloadString = '';
    if (typeof event.payload === 'object' && event.payload !== null) {
      payloadString = JSON.stringify(event.payload, null, 2);
    } else {
      payloadString = String(event.payload);
    }

    return (
      <pre className="text-sm font-mono text-muted bg-background p-4 rounded-lg border border-border whitespace-pre-wrap break-all">
        {payloadString}
      </pre>
    );
  };

  // Derived Metrics
  const totalAttempts = event.attempts?.length || 0;
  const retries = Math.max(0, totalAttempts - 1);
  
  let finalStatusDisplay = 'Pending';
  if (event.status === 'processed') finalStatusDisplay = 'Delivered';
  else if (event.status === 'failed') finalStatusDisplay = 'Failed';
  else if (event.status === 'retry_exhausted') finalStatusDisplay = 'Dead Lettered';
  
  let totalDurationDisplay = 'In Progress';
  if (event.status === 'processed' || event.status === 'failed' || event.status === 'retry_exhausted') {
    if (event.processingTimeMs != null && !isNaN(event.processingTimeMs)) {
      const ms = event.processingTimeMs;
      if (ms < 1000) totalDurationDisplay = `${ms} ms`;
      else totalDurationDisplay = `${(ms / 1000).toFixed(2)} s`;
    } else {
      totalDurationDisplay = 'Unknown';
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={handleBack}
          className="p-2 bg-surface border border-border rounded-lg text-muted hover:text-text hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-3">
            Event Details
            <EventStatusBadge status={event.status} size="lg" />
          </h1>
          <p className="text-muted mt-1 font-mono text-sm">{event.eventId}</p>
        </div>
        
        {['processed', 'failed', 'retry_exhausted'].includes(event.status) && (
          <div className="ml-auto flex items-center gap-3">
            {replayError && <span className="text-sm text-rose-400">{replayError}</span>}
            {replaySuccess && <span className="text-sm text-emerald-400">{replaySuccess}</span>}
            <button
              onClick={handleReplay}
              disabled={replaying}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                replaying 
                  ? 'bg-primary/50 text-white/70 cursor-not-allowed' 
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              {replaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {replaying ? 'Queuing...' : 'Replay Event'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main Data) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Delivery Summary Block */}
          {event.attempts && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                 <p className="text-xs text-muted uppercase font-semibold mb-1">Total Attempts</p>
                 <p className="text-xl font-bold text-text">{totalAttempts}</p>
               </div>
               <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                 <p className="text-xs text-muted uppercase font-semibold mb-1">Retries</p>
                 <p className="text-xl font-bold text-text">{retries}</p>
               </div>
               <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                 <p className="text-xs text-muted uppercase font-semibold mb-1">Final Status</p>
                 <p className={`text-base font-bold ${
                    finalStatusDisplay === 'Delivered' ? 'text-emerald-400' :
                    finalStatusDisplay === 'Dead Lettered' ? 'text-rose-400' :
                    finalStatusDisplay === 'Failed' ? 'text-rose-400' :
                    'text-amber-400'
                 }`}>{finalStatusDisplay}</p>
               </div>
               <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                 <p className="text-xs text-muted uppercase font-semibold mb-1">Total Duration</p>
                 <p className="text-xl font-bold text-text">{totalDurationDisplay}</p>
               </div>
            </div>
          )}

          {/* Payload Section */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Braces className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-text">Payload</h3>
            </div>
            <div className="p-6 overflow-x-auto">
              {renderPayload()}
            </div>
          </div>

          {/* Headers Section */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <AlignLeft className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-text">Headers</h3>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {event.headers && Object.keys(event.headers).map((key) => {
                  const val = event.headers[key];
                  const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                  return (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <span className="font-mono text-xs text-text min-w-[200px]">{key}</span>
                      <span className="font-mono text-xs text-muted break-all">{displayVal}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Delivery Attempts Timeline */}
          {event.attempts && event.attempts.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-text">Delivery Attempts</h3>
              </div>
              <div className="p-6 relative">
                <AttemptTimeline attempts={event.attempts} eventStatus={event.status} eventPayload={event.payload} />
              </div>
            </div>
          )}
          
          {event.attempts && event.attempts.length === 0 && (
            <div className="bg-surface border border-border rounded-xl p-8 text-center shadow-sm">
               <Clock className="w-8 h-8 text-muted mx-auto mb-3" />
               <h3 className="text-text font-semibold mb-1">No Delivery Attempts Yet</h3>
               <p className="text-sm text-muted">This event is waiting to be processed or is currently in the queue.</p>
            </div>
          )}
        </div>

        {/* Right Column (Metadata & Timeline) */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="bg-surface border border-border rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-text">Metadata</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Event Type</p>
                <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-mono text-xs">
                  {event.eventType}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Timestamp</p>
                <p className="text-sm text-text font-medium">{format(new Date(event.receivedAt), 'MMM d, yyyy HH:mm:ss.SSS')}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Processing Time</p>
                <div className="flex items-center gap-1.5 text-text font-medium text-sm">
                  <Clock className="w-4 h-4 text-muted" />
                  <span>
                    {event.status === 'processed' || event.status === 'failed'
                      ? `${event.processingTimeMs} ms`
                      : 'Pending'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Request ID</p>
                <p className="font-mono text-xs text-muted">{event.requestId}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-1">Project</p>
                <p className="font-medium text-sm text-text">{event.projectName || event.projectId}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-surface border border-border rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-text">Lifecycle</h3>
            </div>
            <div className="p-6 relative">
              <LifecycleTimeline event={event} />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

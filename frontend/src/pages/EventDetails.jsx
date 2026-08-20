import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, Database, Braces, AlignLeft, Box } from 'lucide-react';
import { format } from 'date-fns';

export default function EventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const res = await api.get(`/events/${eventId}`);
        setEvent(res.data);
      } catch (err) {
        console.error('Error fetching event details:', err);
        setError('Failed to load event details or you do not have permission.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEventDetails();
  }, [eventId]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-rose-400" />;
      default:
        return <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'processed':
        return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
      case 'failed':
        return 'bg-rose-400/10 text-rose-400 border-rose-400/20';
      default:
        return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
    }
  };

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
            onClick={() => navigate('/events')}
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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/events')}
          className="p-2 bg-surface border border-border rounded-lg text-muted hover:text-text hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-3">
            Event Details
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusBadge(event.status)}`}>
              {getStatusIcon(event.status)}
              <span className="capitalize">{event.status}</span>
            </span>
          </h1>
          <p className="text-muted mt-1 font-mono text-sm">{event.eventId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main Data) */}
        <div className="lg:col-span-2 space-y-6">
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
                {event.headers && Object.keys(event.headers).map((key) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <span className="font-mono text-xs text-text min-w-[200px]">{key}</span>
                    <span className="font-mono text-xs text-muted break-all">{event.headers[key]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

          {/* Timeline Placeholder */}
          <div className="bg-surface border border-border rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-text">Timeline</h3>
            </div>
            <div className="p-6 relative">
              <div className="absolute left-[35px] top-8 bottom-8 w-px bg-border"></div>
              
              <div className="space-y-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-400/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">Event Received</p>
                    <p className="text-xs text-muted">{format(new Date(event.receivedAt), 'HH:mm:ss.SSS')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    event.status !== 'received' 
                      ? 'bg-emerald-400/20 border-emerald-400/30' 
                      : 'bg-surface border-border border'
                  }`}>
                    {event.status !== 'received' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-muted"></div>}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${event.status !== 'received' ? 'text-text' : 'text-muted'}`}>Queued for Processing</p>
                    {event.processedAt && (
                      <p className="text-xs text-muted">{format(new Date(event.processedAt), 'HH:mm:ss.SSS')}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    event.status === 'processed' ? 'bg-emerald-400/20 border-emerald-400/30' : 
                    event.status === 'failed' ? 'bg-rose-400/20 border-rose-400/30' :
                    'bg-surface border-border border'
                  }`}>
                    {event.status === 'processed' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : 
                     event.status === 'failed' ? <XCircle className="w-4 h-4 text-rose-400" /> :
                     <div className="w-2 h-2 rounded-full bg-muted"></div>}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      event.status === 'processed' ? 'text-text' : 
                      event.status === 'failed' ? 'text-rose-400' : 'text-muted'
                    }`}>
                      {event.status === 'processed' ? 'Processing Completed' : 
                       event.status === 'failed' ? 'Processing Failed' : 'Awaiting Worker'}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

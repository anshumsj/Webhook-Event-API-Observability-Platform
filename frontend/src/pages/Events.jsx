import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import {
  Activity,
  FolderKanban,
  ArrowUp,
  Filter,
  Copy,
  Check,
  RefreshCw,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import EventFilters from '../components/EventFilters';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import { getErrorMessage } from '../utils/errorHandler';

export default function Events() {
  const { activeWorkspace, loading: workspaceLoading, projects, projectsLoading: isProjectsLoading } = useWorkspace();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPage = parseInt(searchParams.get('page'), 10) || 1;
  const urlProject = searchParams.get('project') || '';
  const urlOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const urlStatus = searchParams.get('status') || '';
  const urlEndpoint = searchParams.get('endpoint') || '';
  const urlEventType = searchParams.get('eventType') || '';
  const urlTimeRange = searchParams.get('timeRange') || 'All';
  const urlSearch = searchParams.get('search') || '';
  const [selectedProjectId, setSelectedProjectId] = useState(urlProject);

  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: urlPage, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newEventsCount, setNewEventsCount] = useState(0);
  const [copiedId, setCopiedId] = useState(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [endpointFilter, setEndpointFilter] = useState(urlEndpoint);
  const [eventTypeFilter, setEventTypeFilter] = useState(urlEventType);
  const [timeRangeFilter, setTimeRangeFilter] = useState(urlTimeRange);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [sortOrder, setSortOrder] = useState(urlOrder);

  const hasActiveFilters = Boolean(
    statusFilter ||
    endpointFilter ||
    eventTypeFilter ||
    timeRangeFilter !== 'All' ||
    debouncedSearch ||
    sortOrder !== 'desc'
  );

  // Dropdown options
  const [endpoints, setEndpoints] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== debouncedSearch) {
        setDebouncedSearch(searchInput);
        setPagination(prev => ({ ...prev, page: 1 }));
        setSearchParams(prev => {
          const p = new URLSearchParams(prev);
          if (searchInput) p.set('search', searchInput);
          else p.delete('search');
          p.set('page', '1');
          return p;
        }, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, debouncedSearch, setSearchParams]);

  useEffect(() => {
    if (projects.length > 0) {
      setSelectedProjectId(current => {
        if (!current || !projects.find(p => p._id === current)) {
          const defaultId = projects[0]._id;
          setSearchParams(prev => {
            const p = new URLSearchParams(prev);
            p.set('project', defaultId);
            p.set('page', '1');
            return p;
          }, { replace: true });
          setPagination(prev => ({ ...prev, page: 1 }));
          return defaultId;
        }
        return current;
      });
    } else {
      setSelectedProjectId('');
    }
  }, [projects, setSearchParams]);

  // Fetch events when selected project or page/filters change
  useEffect(() => {
    if (selectedProjectId) {
      fetchFilterOptions(selectedProjectId);
      fetchEvents(pagination.page);
      setNewEventsCount(0);
    } else {
      setEvents([]);
      setEndpoints([]);
      setEventTypes([]);
    }
  }, [selectedProjectId, pagination.page, statusFilter, endpointFilter, eventTypeFilter, timeRangeFilter, debouncedSearch, sortOrder]);

  // Ref that always reflects the latest pagination state
  const paginationRef = useRef(pagination);
  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  // Join / leave the Socket.IO project room
  useEffect(() => {
    if (!socket || !selectedProjectId) return;
    socket.emit('join_project', selectedProjectId);
    return () => {
      socket.emit('leave_project', selectedProjectId);
    };
  }, [socket, selectedProjectId]);

  // Keep a fresh reference to fetchEvents for reconnect reconciliation
  const fetchEventsRef = useRef(null);
  useEffect(() => {
    fetchEventsRef.current = fetchEvents;
  });

  // Reconnect Reconciliation
  useEffect(() => {
    if (!socket || !selectedProjectId) return;

    const handleReconnect = () => {
      socket.emit('join_project', selectedProjectId);
      if (fetchEventsRef.current) fetchEventsRef.current();
    };

    socket.io.on('reconnect', handleReconnect);
    
    return () => {
      socket.io.off('reconnect', handleReconnect);
    };
  }, [socket, selectedProjectId]);

  // Single stable webhook:event:created listener
  useEffect(() => {
    if (!socket || !selectedProjectId) return;

    const handleNewEvent = (newEvent) => {
      if (newEvent.projectId !== selectedProjectId) return;

      const { page, limit } = paginationRef.current;

      if (page === 1) {
        setEvents(prev => {
          if (prev.some(e => e.eventId === newEvent.eventId)) return prev;
          const updated = [newEvent, ...prev];
          if (updated.length > limit) updated.pop();
          return updated;
        });
        setPagination(prev => ({
          ...prev,
          total: prev.total + 1,
          totalPages: Math.ceil((prev.total + 1) / prev.limit),
        }));
      } else {
        setNewEventsCount(count => count + 1);
        setPagination(prev => ({
          ...prev,
          total: prev.total + 1,
          totalPages: Math.ceil((prev.total + 1) / prev.limit),
        }));
      }
    };

    socket.on('webhook:event:created', handleNewEvent);
    return () => socket.off('webhook:event:created', handleNewEvent);
  }, [socket, selectedProjectId]);

  // webhook:event:updated — patch status and processingTimeMs in-place
  useEffect(() => {
    if (!socket || !selectedProjectId) return;

    const handleEventUpdate = (updatedEvent) => {
      if (updatedEvent.projectId !== selectedProjectId) return;
      setEvents(prev =>
        prev.map(e =>
          e.eventId === updatedEvent.eventId
            ? { ...e, status: updatedEvent.status, processingTimeMs: updatedEvent.processingTimeMs }
            : e
        )
      );
    };

    socket.on('webhook:event:updated', handleEventUpdate);
    return () => socket.off('webhook:event:updated', handleEventUpdate);
  }, [socket, selectedProjectId]);

  const fetchFilterOptions = async (projectId) => {
    try {
      const [epRes, typeRes] = await Promise.all([
        api.get(`/endpoints/project/${projectId}`),
        api.get(`/events/project/${projectId}/types`)
      ]);
      setEndpoints(epRes.data);
      setEventTypes(typeRes.data);
    } catch (err) {
      console.error('Failed to fetch filter options', err);
    }
  };

  const fetchEvents = async (pageToFetch = pagination.page) => {
    if (!selectedProjectId) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: pageToFetch, limit: pagination.limit });

      if (statusFilter) params.append('status', statusFilter);
      if (endpointFilter) params.append('endpointId', endpointFilter);
      if (eventTypeFilter) params.append('eventType', eventTypeFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (sortOrder) params.append('order', sortOrder);

      if (timeRangeFilter && timeRangeFilter !== 'All') {
        const now = new Date();
        const from = new Date();
        if (timeRangeFilter === '24h') from.setHours(from.getHours() - 24);
        else if (timeRangeFilter === '7d') from.setDate(from.getDate() - 7);
        else if (timeRangeFilter === '30d') from.setDate(from.getDate() - 30);
        params.append('from', from.toISOString());
        params.append('to', now.toISOString());
      }

      const res = await api.get(`/events/project/${selectedProjectId}?${params.toString()}`);
      setEvents(res.data.events);
      setPagination(res.data.pagination);

      if (pageToFetch === 1) {
        setNewEventsCount(0);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load events. Please try again later.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.set('project', selectedProjectId);
        p.set('page', newPage.toString());
        return p;
      }, { replace: true });
    }
  };

  const handleFilterChange = (type, value) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      
      if (type === 'status') {
        setStatusFilter(value);
        if (value) p.set('status', value); else p.delete('status');
      }
      if (type === 'endpoint') {
        setEndpointFilter(value);
        if (value) p.set('endpoint', value); else p.delete('endpoint');
      }
      if (type === 'eventType') {
        setEventTypeFilter(value);
        if (value) p.set('eventType', value); else p.delete('eventType');
      }
      if (type === 'timeRange') {
        setTimeRangeFilter(value);
        if (value && value !== 'All') p.set('timeRange', value); else p.delete('timeRange');
      }
      if (type === 'sortOrder') {
        setSortOrder(value);
        p.set('order', value);
      }
      
      p.set('page', '1');
      return p;
    }, { replace: true });

    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setEndpointFilter('');
    setEventTypeFilter('');
    setTimeRangeFilter('All');
    setSearchInput('');
    setDebouncedSearch('');
    setSortOrder('desc');
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.delete('status');
      p.delete('endpoint');
      p.delete('eventType');
      p.delete('timeRange');
      p.delete('search');
      p.set('order', 'desc');
      p.set('page', '1');
      return p;
    }, { replace: true });
  };

  const handleCopyEventId = (e, eventId) => {
    e.stopPropagation();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(eventId);
    }
    setCopiedId(eventId);
    setTimeout(() => {
      setCopiedId(current => (current === eventId ? null : current));
    }, 1500);
  };

  const getEndpointHostname = (event) => {
    let ep = null;
    if (event.endpointId) {
      ep = endpoints.find(e => e._id === event.endpointId || e.endpointId === event.endpointId);
    }
    if (!ep && endpointFilter) {
      ep = endpoints.find(e => e.endpointId === endpointFilter);
    }
    if (!ep && endpoints.length === 1) {
      ep = endpoints[0];
    }
    if (ep?.destinationUrl) {
      try {
        return new URL(ep.destinationUrl).host;
      } catch {
        return ep.destinationUrl;
      }
    }
    if (ep?.name) return ep.name;
    return ep?.endpointId || '—';
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy HH:mm:ss');
    } catch {
      return String(dateStr);
    }
  };

  if (workspaceLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-3" />
        <p className="text-xs font-mono">Loading workspace...</p>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted">
        <p className="text-xs font-mono">No active workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-text tracking-tight">Event Explorer</h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Live
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Real-time webhook delivery attempts and latency diagnostics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <div className="w-[180px]">
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  const newProject = e.target.value;
                  setSelectedProjectId(newProject);
                  setPagination(prev => ({ ...prev, page: 1 }));
                  setSearchParams(prev => {
                    const p = new URLSearchParams(prev);
                    p.set('project', newProject);
                    p.set('page', '1');
                    return p;
                  }, { replace: true });
                }}
                className="w-full h-8 px-2.5 bg-surface-1 border border-border rounded text-xs text-text font-sans focus:outline-none focus:border-primary cursor-pointer"
                disabled={projects.length === 0}
              >
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchEvents()}
            disabled={!selectedProjectId || loading}
            title="Refresh events list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      {selectedProjectId && (
        <EventFilters
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          statusFilter={statusFilter}
          endpointFilter={endpointFilter}
          eventTypeFilter={eventTypeFilter}
          timeRangeFilter={timeRangeFilter}
          sortOrder={sortOrder}
          endpoints={endpoints}
          eventTypes={eventTypes}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-failure/10 border border-failure/30 text-failure px-3.5 py-2.5 rounded text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchEvents()}
            className="text-xs underline hover:no-underline font-mono ml-4 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Subtle Live Update Indicator (for page > 1, does not shift scroll) */}
      {newEventsCount > 0 && pagination.page > 1 && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-surface-1 border border-primary/30 rounded text-xs font-mono">
          <div className="flex items-center gap-2 text-text">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>
              {newEventsCount} new event{newEventsCount > 1 ? 's' : ''} received
            </span>
          </div>
          <button
            onClick={() => handlePageChange(1)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors text-xs font-medium cursor-pointer"
          >
            <ArrowUp className="w-3 h-3" />
            <span>Jump to page 1</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isProjectsLoading || loading ? (
        <div className="bg-surface-1 border border-border rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 border-b border-border select-none">
                <tr>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium w-[210px]">
                    Event ID
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium min-w-[180px]">
                    Method / Type
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium w-[130px]">
                    Status
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium min-w-[150px]">
                    Destination
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium text-right w-[110px]">
                    Duration
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium text-right w-[170px]">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[...Array(8)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3.5 py-2.5">
                      <div className="h-3.5 w-32 bg-surface-2 rounded" />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="h-3.5 w-28 bg-surface-2 rounded" />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="h-3.5 w-20 bg-surface-2 rounded" />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="h-3.5 w-24 bg-surface-2 rounded" />
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="h-3.5 w-14 bg-surface-2 rounded ml-auto" />
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="h-3.5 w-28 bg-surface-2 rounded ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-surface-1 border border-border border-dashed rounded p-10 flex flex-col items-center justify-center text-center">
          <FolderKanban className="w-6 h-6 text-muted mb-2.5" />
          <h3 className="text-sm font-medium text-text mb-1">No Projects in Workspace</h3>
          <p className="text-xs text-muted max-w-sm">
            Create a project to configure webhook endpoints and stream telemetry events.
          </p>
        </div>
      ) : events.length === 0 ? (
        hasActiveFilters ? (
          <div className="bg-surface-1 border border-border border-dashed rounded p-10 flex flex-col items-center justify-center text-center">
            <Filter className="w-6 h-6 text-muted mb-2.5" />
            <h3 className="text-sm font-medium text-text mb-1">No Matching Deliveries</h3>
            <p className="text-xs text-muted max-w-sm mb-3">
              No events matched your current filter criteria. Adjust or reset filters to view deliveries.
            </p>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 h-7 px-3 rounded bg-surface-2 border border-border text-xs text-text hover:bg-surface-3 transition-colors font-mono cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : (
          <div className="bg-surface-1 border border-border border-dashed rounded p-10 flex flex-col items-center justify-center text-center">
            <Activity className="w-6 h-6 text-muted mb-2.5" />
            <h3 className="text-sm font-medium text-text mb-1">Awaiting Ingest Stream</h3>
            <p className="text-xs text-muted max-w-sm mb-3">
              No webhook deliveries recorded yet for this project. Send an event or verify your endpoint configuration.
            </p>
            <Link
              to="/endpoints"
              className="inline-flex items-center gap-1.5 h-7 px-3 bg-primary text-canvas font-medium rounded text-xs hover:bg-primary-hover transition-colors"
            >
              <span>Manage Endpoints</span>
            </Link>
          </div>
        )
      ) : (
        <div className="bg-surface-1 border border-border rounded overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 border-b border-border select-none">
                <tr>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium w-[210px]">
                    Event ID
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium min-w-[180px]">
                    Method / Type
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium w-[130px]">
                    Status
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium min-w-[150px]">
                    Destination
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium text-right w-[110px]">
                    Duration
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium text-right w-[170px]">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {events.map((event) => (
                  <tr
                    key={event._id || event.eventId}
                    onClick={() => navigate(`/events/${event.eventId}`, { state: { search: searchParams.toString() } })}
                    className="hover:bg-surface-2/60 transition-colors group cursor-pointer"
                  >
                    {/* Event ID with one-click copy affordance */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="font-mono text-xs text-text group-hover:text-primary transition-colors tracking-tight select-all truncate"
                          title={event.eventId}
                        >
                          {event.eventId.length > 18 ? `${event.eventId.slice(0, 16)}…` : event.eventId}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyEventId(e, event.eventId)}
                          className="p-1 text-muted hover:text-text rounded hover:bg-surface-2 transition-colors opacity-60 group-hover:opacity-100 shrink-0"
                          title="Copy full Event ID"
                          aria-label="Copy Event ID"
                        >
                          {copiedId === event.eventId ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Method & Event Type */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-surface-2 border border-border text-muted uppercase shrink-0">
                          POST
                        </span>
                        <span
                          className="font-mono text-xs text-text font-medium truncate max-w-[220px]"
                          title={event.eventType}
                        >
                          {event.eventType}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status={event.status} size="sm" />
                    </td>

                    {/* Destination Hostname */}
                    <td className="px-3.5 py-2.5">
                      <span
                        className="font-mono text-xs text-muted truncate max-w-[180px] block"
                        title={getEndpointHostname(event)}
                      >
                        {getEndpointHostname(event)}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="flex items-center justify-end font-mono text-xs text-muted">
                        {event.status === 'processed' || event.status === 'failed' || event.status === 'retry_exhausted' ? (
                          <span>{event.processingTimeMs ?? 0} ms</span>
                        ) : (
                          <span className="text-muted/50 font-sans text-xs">Pending</span>
                        )}
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="px-3.5 py-2.5 text-right">
                      <span className="font-mono text-[11px] text-muted whitespace-nowrap">
                        {formatTimestamp(event.receivedAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}

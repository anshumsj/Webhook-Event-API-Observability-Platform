import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { Activity, Clock, FolderKanban, ArrowUp, Filter } from 'lucide-react';
import { format } from 'date-fns';
import EventFilters from '../components/EventFilters';
import Pagination from '../components/Pagination';
import EventStatusBadge from '../components/EventStatusBadge';
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

  // Filters State
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [endpointFilter, setEndpointFilter] = useState(urlEndpoint);
  const [eventTypeFilter, setEventTypeFilter] = useState(urlEventType);
  const [timeRangeFilter, setTimeRangeFilter] = useState(urlTimeRange);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [sortOrder, setSortOrder] = useState(urlOrder);

  const hasActiveFilters = Boolean(statusFilter || endpointFilter || eventTypeFilter || timeRangeFilter !== 'All' || debouncedSearch || sortOrder !== 'desc');

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

  // 2. Fetch events when selected project or page changes
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

  // Ref that always reflects the latest pagination state — never stale inside a closure.
  const paginationRef = useRef(pagination);
  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  // 3. Join / leave the Socket.IO project room.
  //    Separated from the event handler so the listener is NOT re-registered on every page change.
  useEffect(() => {
    if (!socket || !selectedProjectId) return;
    socket.emit('join_project', selectedProjectId);
    return () => {
      socket.emit('leave_project', selectedProjectId);
    };
  }, [socket, selectedProjectId]);

  // Keep a fresh reference to fetchEvents to use inside the socket reconnect listener
  // without triggering continuous re-renders.
  const fetchEventsRef = useRef(null);
  useEffect(() => {
    fetchEventsRef.current = fetchEvents;
  });

  // Reconnect Reconciliation
  useEffect(() => {
    if (!socket || !selectedProjectId) return;

    const handleReconnect = () => {
      console.log('[Events] Socket reconnected. Re-joining room and reconciling events...');
      socket.emit('join_project', selectedProjectId);
      if (fetchEventsRef.current) fetchEventsRef.current();
    };

    socket.io.on('reconnect', handleReconnect);
    
    return () => {
      socket.io.off('reconnect', handleReconnect);
    };
  }, [socket, selectedProjectId]);

  // 4. Single stable webhook:event:created listener per project.
  //    Reads current page from paginationRef — always fresh, no stale closure.
  useEffect(() => {
    if (!socket || !selectedProjectId) return;

    const handleNewEvent = (newEvent) => {
      if (newEvent.projectId !== selectedProjectId) return;

      const { page, limit } = paginationRef.current;

      if (page === 1) {
        // On page 1 → prepend event, trim to limit, update total
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
        // On page 2+ → do NOT touch the visible list, just show the banner
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
  }, [socket, selectedProjectId]); // ← no pagination deps — ref handles freshness

  // 5. webhook:event:updated — worker finished processing.
  //    Patch the status and processingTimeMs of the matching row in-place.
  //    No re-fetch needed — just a targeted mutation of existing state.
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
        let from = new Date();
        if (timeRangeFilter === '24h') from.setHours(from.getHours() - 24);
        else if (timeRangeFilter === '7d') from.setDate(from.getDate() - 7);
        else if (timeRangeFilter === '30d') from.setDate(from.getDate() - 30);
        params.append('from', from.toISOString());
        params.append('to', now.toISOString());
      }

      const res = await api.get(`/events/project/${selectedProjectId}?${params.toString()}`);
      setEvents(res.data.events);
      setPagination(res.data.pagination);

      // Clear new events count when returning to page 1
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

  if (workspaceLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p>Loading workspace...</p>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted">
        <p>No active workspace selected. Please log in or create a workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Events</h1>
          <p className="text-muted mt-1">Real-time webhook events for your project</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            className="bg-background border border-border text-text text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 transition-colors"
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
            disabled={projects.length === 0}
          >
            {projects.length === 0 ? (
              <option value="">No projects available</option>
            ) : (
              projects.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))
            )}
          </select>

          <button
            onClick={() => fetchEvents()}
            disabled={!selectedProjectId}
            className="flex items-center gap-2 bg-surface border border-border text-text px-4 py-2 rounded-lg font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {newEventsCount > 0 && pagination.page > 1 && (
        <div className="flex justify-center">
          <button
            onClick={() => handlePageChange(1)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full font-medium shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all animate-in fade-in slide-in-from-top-4"
          >
            <ArrowUp className="w-4 h-4" />
            {newEventsCount} new event{newEventsCount > 1 ? 's' : ''} available
          </button>
        </div>
      )}

      {isProjectsLoading || loading ? (
        <div className="animate-pulse space-y-4 mt-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-surface/50 border border-border rounded-xl"></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
            <FolderKanban className="w-6 h-6 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text mb-1">No projects found in this workspace</h3>
          <p className="text-muted mb-4 max-w-sm">You need a project to receive and view webhook events.</p>
        </div>
      ) : events.length === 0 ? (
        hasActiveFilters ? (
          <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
            <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
              <Filter className="w-6 h-6 text-muted" />
            </div>
            <h3 className="text-lg font-medium text-text mb-1">No deliveries match your current filters.</h3>
            <p className="text-muted mb-4 max-w-sm">Try adjusting or clearing your filters to see more events.</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
            <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-muted" />
            </div>
            <h3 className="text-lg font-medium text-text mb-1">No events yet</h3>
            <p className="text-muted mb-4 max-w-sm">Create an endpoint and send your first webhook.</p>
            <Link to="/endpoints" className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Create an endpoint
            </Link>
          </div>
        )
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text">
              <thead className="text-xs text-muted uppercase bg-surface border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold">Event ID</th>
                  <th className="px-6 py-4 font-semibold">Event Type</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Timestamp</th>
                  <th className="px-6 py-4 font-semibold text-right">Processing Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr
                    key={event._id || event.eventId}
                    onClick={() => navigate(`/events/${event.eventId}`, { state: { search: searchParams.toString() } })}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-muted group-hover:text-primary transition-colors">
                      {event.eventId.substring(0, 12)}...
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-mono text-xs">
                        {event.eventType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <EventStatusBadge status={event.status} />
                    </td>
                    <td className="px-6 py-4 text-muted">
                      {format(new Date(event.receivedAt), 'MMM d, yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {event.status === 'processed' || event.status === 'failed'
                            ? `${event.processingTimeMs} ms`
                            : 'Pending'}
                        </span>
                      </div>
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

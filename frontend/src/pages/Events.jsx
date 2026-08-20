import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../services/api';
import { Activity, Clock, CheckCircle2, XCircle, Loader2, ChevronLeft, ChevronRight, FolderKanban } from 'lucide-react';
import { format } from 'date-fns';

export default function Events() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch projects when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      fetchProjects();
    } else {
      setProjects([]);
      setSelectedProjectId('');
      setEvents([]);
      setLoading(false);
    }
  }, [activeWorkspace]);

  // 2. Fetch events when selected project or page changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchEvents(1); // Reset to page 1 on project change
    } else {
      setEvents([]);
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    try {
      const res = await api.get(`/projects/${activeWorkspace._id}`);
      setProjects(res.data);
      if (res.data.length > 0) {
        // Only select first if nothing is selected or current selection is not in this workspace
        if (!selectedProjectId || !res.data.find(p => p._id === selectedProjectId)) {
          setSelectedProjectId(res.data[0]._id);
        }
      } else {
        setSelectedProjectId('');
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchEvents = async (pageToFetch = pagination.page) => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/events/project/${selectedProjectId}?page=${pageToFetch}&limit=${pagination.limit}`);
      setEvents(res.data.events);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      fetchEvents(newPage);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
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
            onChange={(e) => setSelectedProjectId(e.target.value)}
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
            <FolderKanban className="w-6 h-6 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text mb-1">No projects found in this workspace</h3>
          <p className="text-muted mb-4 max-w-sm">You need a project to receive and view webhook events.</p>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-surface/50 border border-border rounded-xl"></div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
            <Activity className="w-6 h-6 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text mb-1">No events found</h3>
          <p className="text-muted mb-4 max-w-sm">Events will appear here once webhooks are received by this project's endpoints.</p>
        </div>
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
                    key={event._id} 
                    onClick={() => navigate(`/events/${event.eventId}`)}
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
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(event.status)}`}>
                        {getStatusIcon(event.status)}
                        <span className="capitalize">{event.status}</span>
                      </div>
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
          
          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3 bg-surface">
              <p className="text-sm text-muted">
                Showing page <span className="font-medium text-text">{pagination.page}</span> of <span className="font-medium text-text">{pagination.totalPages}</span> (Total: {pagination.total})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1 rounded-md bg-background border border-border text-text hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-1 rounded-md bg-background border border-border text-text hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

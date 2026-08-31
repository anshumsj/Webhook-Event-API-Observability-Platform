import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../services/api';
import { Webhook, Copy, Check, Eye, EyeOff, ShieldCheck, Link2, Activity, Clock, AlertCircle, ArrowRight, Settings, Send, Plus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../utils/errorHandler';

const EndpointHealthBadge = ({ health }) => {
  let color = 'bg-surface/50 text-muted border-border';
  let label = 'No Data';

  if (health === 'healthy') {
    color = 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
    label = 'Healthy';
  } else if (health === 'degraded') {
    color = 'bg-amber-400/10 text-amber-400 border-amber-400/20';
    label = 'Degraded';
  } else if (health === 'unhealthy') {
    color = 'bg-rose-400/10 text-rose-400 border-rose-400/20';
    label = 'Unhealthy';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <span className="w-2 h-2 rounded-full bg-current"></span>
      {label}
    </div>
  );
};

export default function Endpoints() {
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [destinationUrlInput, setDestinationUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get base URL for webhooks
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

  useEffect(() => {
    if (activeWorkspace) {
      fetchProjects();
    } else {
      setProjects([]);
      setSelectedProjectId('');
      setEndpoints([]);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchEndpoints();
    } else {
      setEndpoints([]);
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    setIsProjectsLoading(true);
    try {
      const res = await api.get(`/projects/${activeWorkspace._id}`);
      setProjects(res.data);
      if (res.data.length > 0) {
        if (!selectedProjectId || !res.data.find(p => p._id === selectedProjectId)) {
          setSelectedProjectId(res.data[0]._id);
        }
      } else {
        setSelectedProjectId('');
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const fetchEndpoints = async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    setError(null);
    try {
      const [endpointsRes, analyticsRes] = await Promise.all([
        api.get(`/endpoints/project/${selectedProjectId}`),
        api.get(`/analytics/project/${selectedProjectId}/endpoints`).catch(() => ({ data: [] }))
      ]);
      
      const endpointsData = endpointsRes.data;
      const analyticsData = analyticsRes.data || [];
      
      const mergedEndpoints = endpointsData.map(ep => {
        const health = analyticsData.find(a => String(a._id) === String(ep._id)) || null;
        return { ...ep, healthData: health };
      });
      
      setEndpoints(mergedEndpoints);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load endpoints.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingEndpoint(null);
    setDestinationUrlInput('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (endpoint) => {
    setEditingEndpoint(endpoint);
    setDestinationUrlInput(endpoint.destinationUrl || '');
    setIsModalOpen(true);
  };

  const handleSaveEndpoint = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingEndpoint) {
        await api.patch(`/endpoints/${editingEndpoint.endpointId}`, {
          destinationUrl: destinationUrlInput || null
        });
      } else {
        await api.post(`/endpoints/project/${selectedProjectId}`, {
          destinationUrl: destinationUrlInput || null
        });
      }
      await fetchEndpoints();
      setIsModalOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save endpoint.'));
    } finally {
      setIsSubmitting(false);
    }
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
          <h1 className="text-2xl font-bold text-text">Webhook Endpoints</h1>
          <p className="text-muted mt-1">Manage and view your incoming webhook URLs</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            className="bg-background border border-border text-text text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 transition-colors min-w-[200px]"
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
          {projects.length > 0 && endpoints.length > 0 && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-surface font-semibold rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Endpoint
            </button>
          )}
        </div>
      </div>

      {isProjectsLoading || loading ? (
        <div className="animate-pulse space-y-4 mt-6">
          <div className="h-48 bg-surface/50 border border-border rounded-xl"></div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl mt-6">
          {error}
        </div>
      ) : projects.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
            <Webhook className="w-6 h-6 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text mb-1">No projects found in this workspace</h3>
          <p className="text-muted mb-4 max-w-sm">Create a project to automatically generate a webhook endpoint.</p>
        </div>
      ) : endpoints.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
            <Webhook className="w-6 h-6 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text mb-1">No endpoints found</h3>
          <p className="text-muted mb-6 max-w-sm">This project doesn't have an endpoint yet. Create one now to start receiving webhooks.</p>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-surface font-semibold rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5"
          >
            <Webhook className="w-5 h-5" />
            Create Endpoint
          </button>
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          {endpoints.map(endpoint => {
            const fullUrl = `${baseUrl}/webhooks/${endpoint.endpointId}`;
            
            return (
              <div key={endpoint._id} className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Webhook className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-text">Webhook Endpoint</h3>
                      <p className="text-sm text-muted">ID: {endpoint.endpointId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <EndpointHealthBadge health={endpoint.healthData?.health} />
                    <button
                      onClick={() => handleOpenEditModal(endpoint)}
                      className="p-2 text-muted hover:text-text hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-border"
                      title="Configure Endpoint"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted font-medium mb-1 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5"/> Success Rate</p>
                    <p className="text-lg font-semibold text-text">
                      {endpoint.healthData && endpoint.healthData.health !== 'no_data' 
                        ? `${endpoint.healthData.successRate}%` 
                        : '—'}
                    </p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted font-medium mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Avg Latency</p>
                    <p className="text-lg font-semibold text-text">
                      {endpoint.healthData && endpoint.healthData.health !== 'no_data' 
                        ? `${endpoint.healthData.averageLatencyMs} ms` 
                        : '—'}
                    </p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted font-medium mb-1 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5"/> Attempts (24h)</p>
                    <p className="text-lg font-semibold text-text">
                      {endpoint.healthData?.totalAttempts || 0}
                    </p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-xs text-muted font-medium mb-1 flex items-center gap-1.5"><Webhook className="w-3.5 h-3.5"/> Last Delivery</p>
                    <p className="text-lg font-semibold text-text">
                      {endpoint.healthData?.lastDeliveryAt 
                        ? formatDistanceToNow(new Date(endpoint.healthData.lastDeliveryAt), { addSuffix: true }) 
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {(endpoint.healthData?.health === 'degraded' || endpoint.healthData?.health === 'unhealthy') && (
                  endpoint.healthData.successRate === 100 ? (
                    <div className="mb-6 bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm rounded-lg p-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>High response latency detected ({endpoint.healthData.averageLatencyMs}ms avg). All deliveries are succeeding.</span>
                    </div>
                  ) : (
                    <div className="mb-6 bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>This endpoint is experiencing delivery failures.</span>
                      </div>
                      <Link to={`/events?project=${selectedProjectId}&endpoint=${endpoint.endpointId}&status=failed`} className="flex items-center gap-1 hover:underline font-medium">
                        Investigate failures <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )
                )}

                <div className="space-y-6">
                  {/* Webhook URL Section */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-text mb-2">
                      <Link2 className="w-4 h-4 text-muted" />
                      Incoming Webhook URL
                    </label>
                    <p className="text-sm text-muted mb-3">
                      Send your POST requests to this URL. We accept any valid JSON payload.
                    </p>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 block p-3 bg-background border border-border rounded-lg text-sm text-text font-mono overflow-x-auto">
                        {fullUrl}
                      </code>
                      <button
                        onClick={() => handleCopy(fullUrl, 'url')}
                        className="flex items-center gap-2 px-4 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors font-medium border border-primary/20"
                      >
                        {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedUrl ? 'Copied' : 'Copy URL'}
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-border w-full"></div>

                  {/* Destination URL Section */}
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium text-text mb-2">
                      <span className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-muted" />
                        Destination URL
                      </span>
                    </label>
                    <p className="text-sm text-muted mb-3">
                      Where we should forward incoming webhooks.
                    </p>
                    <div className="flex items-center gap-3">
                      <code className={`flex-1 block p-3 border rounded-lg text-sm font-mono overflow-x-auto ${endpoint.destinationUrl ? 'bg-background border-border text-text' : 'bg-surface border-dashed border-border/50 text-muted'}`}>
                        {endpoint.destinationUrl || 'Not configured'}
                      </code>
                    </div>
                  </div>

                  <div className="h-px bg-border w-full"></div>

                  {/* Secret Section */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-text mb-2">
                      <ShieldCheck className="w-4 h-4 text-muted" />
                      Signing Secret
                    </label>
                    <p className="text-sm text-muted mb-3">
                      Use this secret to verify that incoming webhooks are coming from a trusted source.
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <code className="block p-3 bg-background border border-border rounded-lg text-sm text-text font-mono pr-12">
                          {showSecret ? (endpoint.secret || 'Hidden for security') : '•'.repeat(48)}
                        </code>
                        <button
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-text hover:bg-white/5 rounded-md transition-colors"
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleCopy(endpoint.secret, 'secret')}
                        className="flex items-center justify-center p-3 bg-background hover:bg-white/5 border border-border text-text rounded-lg transition-colors"
                        title="Copy Secret"
                      >
                        {copiedSecret ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-xl font-semibold text-text">
                {editingEndpoint ? 'Configure Endpoint' : 'Create Endpoint'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEndpoint} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Destination URL <span className="text-muted font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={destinationUrlInput}
                  onChange={(e) => setDestinationUrlInput(e.target.value)}
                  placeholder="https://myapp.com/api/webhooks"
                  className="w-full bg-background border border-border text-text text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 transition-colors"
                />
                <p className="text-xs text-muted mt-2">
                  Incoming payloads will be forwarded to this URL. Must be a public HTTP(S) address.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-text bg-surface hover:bg-background border border-border rounded-lg transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-surface bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingEndpoint ? 'Save Changes' : 'Create Endpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

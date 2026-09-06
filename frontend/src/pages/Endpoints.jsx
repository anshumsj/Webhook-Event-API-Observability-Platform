import React, { useEffect, useState, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../services/api';
import {
  Webhook,
  Settings,
  Plus,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Terminal,
  Activity,
  Clock,
  Send,
  RefreshCw,
  Trash2,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import ClipboardCopy from '../components/ClipboardCopy';
import { getErrorMessage } from '../utils/errorHandler';

export default function Endpoints() {
  const { activeWorkspace, loading: workspaceLoading, projects, projectsLoading: isProjectsLoading } = useWorkspace();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Secret reveal state per endpoint
  const [revealedSecrets, setRevealedSecrets] = useState({});

  // Active sub-tab / inspector drawer state per endpoint
  const [expandedCurl, setExpandedCurl] = useState({});

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [destinationUrlInput, setDestinationUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingEndpoint, setDeletingEndpoint] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Base URL for webhooks
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

  useEffect(() => {
    if (projects.length > 0) {
      if (!selectedProjectId || !projects.find((p) => p._id === selectedProjectId)) {
        setSelectedProjectId(projects[0]._id);
      }
    } else {
      setSelectedProjectId('');
    }
  }, [projects, selectedProjectId]);

  const fetchEndpoints = useCallback(async () => {
    if (!selectedProjectId) return;

    setLoading(true);
    setError(null);
    try {
      const [endpointsRes, analyticsRes] = await Promise.all([
        api.get(`/endpoints/project/${selectedProjectId}`),
        api.get(`/analytics/project/${selectedProjectId}/endpoints`).catch(() => ({ data: [] })),
      ]);

      const endpointsData = endpointsRes.data;
      const analyticsData = analyticsRes.data || [];

      const mergedEndpoints = endpointsData.map((ep) => {
        const health = analyticsData.find((a) => String(a._id) === String(ep._id)) || null;
        return { ...ep, healthData: health };
      });

      setEndpoints(mergedEndpoints);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load endpoints.'));
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchEndpoints();
    } else {
      setEndpoints([]);
    }
  }, [selectedProjectId, fetchEndpoints]);

  const toggleSecretVisibility = (endpointId) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [endpointId]: !prev[endpointId],
    }));
  };

  const toggleCurlDrawer = (endpointId) => {
    setExpandedCurl((prev) => ({
      ...prev,
      [endpointId]: !prev[endpointId],
    }));
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
          destinationUrl: destinationUrlInput.trim() || null,
        });
      } else {
        await api.post(`/endpoints/project/${selectedProjectId}`, {
          destinationUrl: destinationUrlInput.trim() || null,
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

  // Delete Action Handlers
  const handleOpenDeleteModal = (endpoint) => {
    setDeletingEndpoint(endpoint);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
    setDeletingEndpoint(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEndpoint || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/endpoints/${deletingEndpoint.endpointId}`);
      setIsDeleteModalOpen(false);
      setDeletingEndpoint(null);
      await fetchEndpoints();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete endpoint.'));
    } finally {
      setIsDeleting(false);
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
    <div className="space-y-4 max-w-6xl">
      {/* 1. Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-1 border border-border p-3 rounded">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-text tracking-tight">Endpoints</h1>
            {endpoints.length > 0 && (
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted">
                {endpoints.length} active
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            Manage ingestion URLs, destination forwarding, and cryptographic signing keys
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {projects.length > 0 && (
            <div className="w-[180px]">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={projects.length === 0}
                className="w-full h-8 px-2.5 bg-canvas border border-border rounded text-xs text-text font-sans focus:outline-none focus:border-primary cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEndpoints}
            disabled={!selectedProjectId || loading}
            title="Refresh endpoints"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {projects.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              title="Create new endpoint"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Endpoint</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-failure/10 border border-failure/30 text-failure px-3.5 py-2.5 rounded text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchEndpoints}
            className="text-xs underline hover:no-underline font-mono ml-4 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isProjectsLoading || loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 bg-surface-1 border border-border rounded animate-pulse"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-surface-1 border border-border border-dashed rounded p-10 flex flex-col items-center justify-center text-center">
          <Webhook className="w-6 h-6 text-muted mb-2.5" />
          <h3 className="text-sm font-medium text-text mb-1">No Projects in Workspace</h3>
          <p className="text-xs text-muted max-w-sm">
            Create a project to configure webhook endpoints and receive deliveries.
          </p>
        </div>
      ) : endpoints.length === 0 ? (
        <div className="bg-surface-1 border border-border border-dashed rounded p-10 flex flex-col items-center justify-center text-center">
          <Webhook className="w-6 h-6 text-muted mb-2.5" />
          <h3 className="text-sm font-medium text-text mb-1">No Endpoints Configured</h3>
          <p className="text-xs text-muted max-w-sm mb-4">
            This project has no endpoints configured. Create your first endpoint to generate an
            ingest URL and verification secret.
          </p>
          <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
            <Plus className="w-3.5 h-3.5" />
            <span>Create Endpoint</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {endpoints.map((endpoint) => {
            const fullUrl = `${baseUrl}/webhooks/${endpoint.endpointId}`;
            const isSecretRevealed = Boolean(revealedSecrets[endpoint.endpointId]);
            const isCurlExpanded = Boolean(expandedCurl[endpoint.endpointId]);

            const curlSnippet = `curl -X POST "${fullUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"event": "ping", "timestamp": "${new Date().toISOString()}"}'`;

            return (
              <div
                key={endpoint._id}
                className="bg-surface-1 border border-border rounded overflow-hidden"
              >
                {/* Endpoint Header Strip */}
                <div className="p-3 bg-surface-2/40 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <StatusBadge
                      status={endpoint.healthData?.health || 'no_data'}
                      size="sm"
                    />

                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-surface-2 border border-border text-muted uppercase">
                        POST
                      </span>
                      <span className="font-semibold text-text tracking-tight select-all">
                        {endpoint.endpointId}
                      </span>
                      <ClipboardCopy text={endpoint.endpointId} label="Copy ID" />
                    </div>

                    <div className="h-3 w-px bg-border hidden sm:block" />

                    <div className="flex items-center gap-1.5 text-xs font-mono text-muted min-w-0">
                      <Send className="w-3 h-3 text-muted shrink-0" />
                      <span className="text-[11px] uppercase tracking-wider text-muted/70">
                        Dest:
                      </span>
                      {endpoint.destinationUrl ? (
                        <span
                          className="text-text truncate max-w-[260px] select-all"
                          title={endpoint.destinationUrl}
                        >
                          {endpoint.destinationUrl}
                        </span>
                      ) : (
                        <span className="text-muted/60 italic text-[11px]">
                          Not configured
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toggleCurlDrawer(endpoint.endpointId)}
                      title="Toggle cURL test snippet"
                    >
                      <Terminal className="w-3 h-3 text-primary" />
                      <span>cURL</span>
                    </Button>

                    <Link
                      to={`/events?project=${selectedProjectId}&endpoint=${endpoint.endpointId}`}
                      className="inline-flex items-center justify-center font-sans rounded transition-colors duration-150 select-none cursor-pointer bg-surface-2 text-text border border-border hover:bg-surface-3 hover:border-border-strong h-7 px-2.5 text-xs gap-1.5"
                      title="View all events for this endpoint"
                    >
                      <ExternalLink className="w-3 h-3 text-muted" />
                      <span>Events</span>
                    </Link>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEditModal(endpoint)}
                      title="Configure endpoint settings"
                    >
                      <Settings className="w-3 h-3 text-muted" />
                      <span>Configure</span>
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleOpenDeleteModal(endpoint)}
                      title="Delete endpoint"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>

                {/* Telemetry Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-surface-1 border-b border-border/70 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-muted uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <Activity className="w-3 h-3 text-primary" /> Success Rate
                    </span>
                    <span className="text-sm font-mono font-semibold text-text">
                      {endpoint.healthData && endpoint.healthData.health !== 'no_data'
                        ? `${endpoint.healthData.successRate}%`
                        : '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-muted uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <Clock className="w-3 h-3 text-primary" /> Avg Latency
                    </span>
                    <span className="text-sm font-mono font-semibold text-text">
                      {endpoint.healthData && endpoint.healthData.health !== 'no_data'
                        ? `${endpoint.healthData.averageLatencyMs} ms`
                        : '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-muted uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <Webhook className="w-3 h-3 text-primary" /> 24h Deliveries
                    </span>
                    <span className="text-sm font-mono font-semibold text-text">
                      {endpoint.healthData?.totalAttempts || 0}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-muted uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <Clock className="w-3 h-3 text-muted" /> Last Delivery
                    </span>
                    <span className="text-xs font-mono text-text">
                      {endpoint.healthData?.lastDeliveryAt
                        ? formatDistanceToNow(new Date(endpoint.healthData.lastDeliveryAt), {
                            addSuffix: true,
                          })
                        : 'Never'}
                    </span>
                  </div>
                </div>

                {/* Health Diagnostic Alerts (Degraded / Unhealthy) */}
                {(endpoint.healthData?.health === 'degraded' ||
                  endpoint.healthData?.health === 'unhealthy') && (
                  <div className="border-b border-border">
                    {endpoint.healthData.successRate === 100 ? (
                      <div className="bg-warning/10 border-warning/20 text-warning px-3.5 py-2 text-xs flex items-center gap-2 font-mono">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          High response latency detected ({endpoint.healthData.averageLatencyMs} ms
                          avg). All deliveries are succeeding.
                        </span>
                      </div>
                    ) : (
                      <div className="bg-failure/10 border-failure/20 text-failure px-3.5 py-2 text-xs flex items-center justify-between font-mono flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>This endpoint experienced delivery failures in the last 24h.</span>
                        </div>
                        <Link
                          to={`/events?project=${selectedProjectId}&endpoint=${endpoint.endpointId}&status=failed`}
                          className="inline-flex items-center gap-1 text-failure hover:underline font-semibold"
                        >
                          <span>Investigate failures</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Technical Configuration Strip */}
                <div className="p-3.5 space-y-3 bg-canvas/30 text-xs font-mono">
                  {/* Webhook Ingest URL */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted font-medium">
                        Incoming Ingest URL
                      </span>
                      <ClipboardCopy text={fullUrl} label="Copy URL" />
                    </div>
                    <div className="p-2 bg-canvas border border-border rounded text-text select-all overflow-x-auto text-xs whitespace-nowrap">
                      {fullUrl}
                    </div>
                  </div>

                  {/* Destination URL & Signing Secret Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Destination URL */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted font-medium">
                          Forwarding Destination
                        </span>
                        {endpoint.destinationUrl && (
                          <ClipboardCopy
                            text={endpoint.destinationUrl}
                            label="Copy Destination"
                          />
                        )}
                      </div>
                      <div className="p-2 bg-canvas border border-border rounded text-text select-all overflow-x-auto text-xs whitespace-nowrap">
                        {endpoint.destinationUrl || (
                          <span className="text-muted/60 italic">Not configured</span>
                        )}
                      </div>
                    </div>

                    {/* Signing Secret */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted font-medium">
                          Signing Secret (HMAC-SHA256)
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleSecretVisibility(endpoint.endpointId)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-border text-xs text-muted hover:text-text hover:bg-surface-3 transition-colors cursor-pointer select-none"
                            title={isSecretRevealed ? 'Hide secret' : 'Reveal secret'}
                          >
                            {isSecretRevealed ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                            <span>{isSecretRevealed ? 'Hide' : 'Reveal'}</span>
                          </button>
                          <ClipboardCopy text={endpoint.secret} label="Copy Secret" />
                        </div>
                      </div>
                      <div className="p-2 bg-canvas border border-border rounded text-text select-all overflow-x-auto text-xs whitespace-nowrap">
                        {isSecretRevealed
                          ? endpoint.secret || '—'
                          : '•'.repeat(40)}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible cURL Quick Test */}
                  {isCurlExpanded && (
                    <div className="pt-2 border-t border-border/70">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted font-medium flex items-center gap-1.5">
                          <Terminal className="w-3 h-3 text-primary" /> cURL Ingest Test
                        </span>
                        <ClipboardCopy text={curlSnippet} label="Copy cURL" />
                      </div>
                      <pre className="p-2.5 bg-canvas border border-border rounded text-xs text-muted leading-relaxed select-all overflow-x-auto">
                        {curlSnippet}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Create / Edit Endpoint Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/40">
              <h3 className="text-sm font-semibold text-text">
                {editingEndpoint ? 'Configure Endpoint' : 'Create Webhook Endpoint'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-text transition-colors p-1 rounded hover:bg-surface-3 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEndpoint} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Destination Forwarding URL{' '}
                  <span className="text-muted font-normal font-mono">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={destinationUrlInput}
                  onChange={(e) => setDestinationUrlInput(e.target.value)}
                  placeholder="https://api.yourdomain.com/webhooks"
                  className="w-full h-8 px-2.5 bg-canvas border border-border rounded text-xs text-text font-mono placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-colors"
                />
                <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                  Incoming webhook payloads dispatched to this endpoint will be verified, stored, and
                  forwarded to this destination address.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Saving...'
                    : editingEndpoint
                    ? 'Save Configuration'
                    : 'Create Endpoint'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingEndpoint && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/40">
              <div className="flex items-center gap-2 text-failure">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-sm font-semibold text-text">Delete Webhook Endpoint</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={isDeleting}
                className="text-muted hover:text-text transition-colors p-1 rounded hover:bg-surface-3 cursor-pointer disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-text leading-relaxed">
                Are you sure you want to delete this webhook endpoint? This action is{' '}
                <span className="font-semibold text-failure">destructive and irreversible</span>.
              </p>

              <div className="p-2.5 bg-canvas border border-border rounded font-mono text-xs space-y-1">
                <div className="flex items-center justify-between text-muted text-[11px]">
                  <span>ENDPOINT ID</span>
                  <span className="text-text font-semibold select-all">
                    {deletingEndpoint.endpointId}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted text-[11px] truncate">
                  <span>DESTINATION</span>
                  <span className="text-text truncate max-w-[200px] select-all">
                    {deletingEndpoint.destinationUrl || 'Not configured'}
                  </span>
                </div>
              </div>

              <div className="bg-failure/10 border border-failure/25 p-2.5 rounded text-[11px] font-mono text-failure leading-relaxed">
                Warning: Any incoming webhook events sent to this endpoint URL will fail, and
                verification secrets will be immediately invalidated.
              </div>

              {deleteError && (
                <div className="bg-failure/10 border border-failure/40 p-2.5 rounded text-xs text-failure font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-all">{deleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCloseDeleteModal}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Endpoint</span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

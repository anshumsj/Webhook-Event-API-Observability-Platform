import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../services/api';
import { Webhook, Copy, Check, Eye, EyeOff, ShieldCheck, Link2 } from 'lucide-react';

export default function Endpoints() {
  const { activeWorkspace } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

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
    }
  };

  const fetchEndpoints = async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/endpoints/project/${selectedProjectId}`);
      setEndpoints(res.data);
    } catch (err) {
      console.error('Error fetching endpoints:', err);
      setError('Failed to load endpoints.');
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

  const handleGenerateEndpoint = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      await api.post(`/endpoints/project/${selectedProjectId}`);
      await fetchEndpoints();
    } catch (err) {
      console.error('Error generating endpoint:', err);
      setError('Failed to generate endpoint.');
      setLoading(false);
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
            <Webhook className="w-6 h-6 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text mb-1">No projects found in this workspace</h3>
          <p className="text-muted mb-4 max-w-sm">Create a project to automatically generate a webhook endpoint.</p>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-4 mt-6">
          <div className="h-48 bg-surface/50 border border-border rounded-xl"></div>
        </div>
      ) : endpoints.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
            <Webhook className="w-6 h-6 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text mb-1">No endpoints found</h3>
          <p className="text-muted mb-6 max-w-sm">This project doesn't have an endpoint yet. Generate one now to start receiving webhooks.</p>
          <button
            onClick={handleGenerateEndpoint}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-surface font-semibold rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5"
          >
            <Webhook className="w-5 h-5" />
            Generate Endpoint
          </button>
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          {endpoints.map(endpoint => {
            const fullUrl = `${baseUrl}/webhooks/${endpoint.endpointId}`;
            
            return (
              <div key={endpoint._id} className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Webhook className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-text">Primary Endpoint</h3>
                    <p className="text-sm text-muted">ID: {endpoint.endpointId}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Webhook URL Section */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-text mb-2">
                      <Link2 className="w-4 h-4 text-muted" />
                      Webhook URL
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
                          {showSecret ? endpoint.secret : '•'.repeat(48)}
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
    </div>
  );
}

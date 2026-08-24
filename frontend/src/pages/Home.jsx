import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Activity, Webhook, FolderKanban, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Home = () => {
  const { activeWorkspace, createWorkspace } = useWorkspace();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [error, setError] = useState('');

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      await createWorkspace(newWorkspaceName);
    } catch (err) {
      setError('Failed to create workspace');
    }
  };

  const [analytics, setAnalytics] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!activeWorkspace) return;
      setLoading(true);
      setFetchError('');
      try {
        const response = await api.get(`/analytics/workspace/${activeWorkspace._id}?timeRange=${timeRange}`);
        setAnalytics(response.data);
      } catch (err) {
        setFetchError('Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [activeWorkspace, timeRange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-muted mt-1">
            {activeWorkspace ? `Overview for ${activeWorkspace.name}` : 'Welcome to HookSight'}
          </p>
        </div>
        
        {activeWorkspace && (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-muted">Time Range:</span>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm font-medium focus:outline-none focus:border-primary text-text"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        )}
      </div>

      {!activeWorkspace ? (
        <div className="bg-surface border border-border rounded-xl p-8 max-w-md mx-auto mt-12 shadow-lg">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <FolderKanban className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-center text-text">Get Started</h2>
          <p className="text-muted mb-8 text-center">Create your first workspace to start monitoring webhooks and managing projects.</p>
          
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Workspace Name</label>
              <input
                type="text"
                placeholder="e.g. My Company, Acme Corp..."
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!newWorkspaceName.trim()}
              className="w-full bg-primary text-surface font-semibold py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Create Workspace
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary mb-4">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-text">Projects</h3>
              <p className="text-muted text-sm mt-1 mb-4">Manage your webhook integrations</p>
              <Link to="/projects" className="text-primary hover:underline text-sm font-medium">View Projects &rarr;</Link>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="w-12 h-12 bg-emerald-400/20 rounded-full flex items-center justify-center text-emerald-400 mb-4">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-text">Events</h3>
              <p className="text-muted text-sm mt-1 mb-4">Monitor real-time incoming events</p>
              <Link to="/events" className="text-emerald-400 hover:underline text-sm font-medium">View Events &rarr;</Link>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="w-12 h-12 bg-rose-400/20 rounded-full flex items-center justify-center text-rose-400 mb-4">
                <Webhook className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-text">Endpoints</h3>
              <p className="text-muted text-sm mt-1 mb-4">Configure your webhook destinations</p>
              <Link to="/endpoints" className="text-rose-400 hover:underline text-sm font-medium">Configure Endpoints &rarr;</Link>
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-8">
            <h2 className="text-xl font-semibold text-text mb-6">Delivery Analytics</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                Loading analytics...
              </div>
            ) : fetchError ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center text-red-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
                <p>{fetchError}</p>
              </div>
            ) : analytics && analytics.totalDeliveries === 0 ? (
              <div className="bg-surface border border-border rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                  <Activity className="w-8 h-8 text-muted" />
                </div>
                <h3 className="text-lg font-medium text-text mb-2">No Delivery Data</h3>
                <p className="text-muted">No webhooks were received in the selected time range.</p>
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Deliveries */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted">Total Deliveries</span>
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-text">{analytics.totalDeliveries.toLocaleString()}</div>
                </div>

                {/* Successful */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted">Successful</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-emerald-400">{analytics.successfulDeliveries.toLocaleString()}</div>
                </div>

                {/* Failed */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted">Failed</span>
                    <XCircle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-3xl font-bold text-rose-400">{analytics.failedDeliveries.toLocaleString()}</div>
                </div>

                {/* Success Rate */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted">Success Rate</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-text">{analytics.successRate}%</div>
                </div>

                {/* Retry Rate */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted">Retry Rate</span>
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-bold text-text">{analytics.retryRate}%</div>
                </div>

                {/* Avg Latency */}
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted">Avg Latency</span>
                    <Clock className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-3xl font-bold text-text">{analytics.averageLatencyMs} <span className="text-lg text-muted">ms</span></div>
                </div>

                {/* Dead Lettered */}
                <div className="bg-surface border border-border rounded-xl p-5 md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted">Dead Lettered (DLQ)</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-3xl font-bold text-rose-500">{analytics.deadLettered.toLocaleString()}</div>
                  <p className="text-xs text-muted mt-2">Events permanently failed after all retry attempts exhausted.</p>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default Home;

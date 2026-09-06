import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Activity, Webhook, FolderKanban, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import TrendChart from '../components/TrendChart';
import { getErrorMessage } from '../utils/errorHandler';

const Home = () => {
  const { activeWorkspace, createWorkspace, loading: workspaceLoading } = useWorkspace();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [error, setError] = useState('');

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      await createWorkspace(newWorkspaceName);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create workspace'));
    }
  };

  const [analytics, setAnalytics] = useState(null);
  const [endpointHealth, setEndpointHealth] = useState(null);
  const [trends, setTrends] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!activeWorkspace) return;
      setLoading(true);
      setFetchError('');
      try {
        const [analyticsRes, healthRes, trendsRes] = await Promise.all([
          api.get(`/analytics/workspace/${activeWorkspace._id}?timeRange=${timeRange}`),
          api.get(`/analytics/workspace/${activeWorkspace._id}/endpoints?timeRange=${timeRange}`),
          api.get(`/analytics/workspace/${activeWorkspace._id}/trends?timeRange=${timeRange}`)
        ]);
        setAnalytics(analyticsRes.data);
        setEndpointHealth(healthRes.data);
        setTrends(trendsRes.data);
      } catch (err) {
        setFetchError(getErrorMessage(err, 'Failed to load analytics.'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

      {workspaceLoading ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-muted">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p>Loading workspace...</p>
        </div>
      ) : !activeWorkspace ? (
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/projects" className="group bg-surface/20 border border-border/40 hover:border-border/80 rounded-lg p-5 transition-all flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">Projects</h3>
                <p className="text-muted text-xs mt-1">Manage webhook integrations</p>
              </div>
            </Link>

            <Link to="/events" className="group bg-surface/20 border border-border/40 hover:border-border/80 rounded-lg p-5 transition-all flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-400/10 transition-colors">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text group-hover:text-emerald-400 transition-colors">Events</h3>
                <p className="text-muted text-xs mt-1">Monitor real-time incoming events</p>
              </div>
            </Link>

            <Link to="/endpoints" className="group bg-surface/20 border border-border/40 hover:border-border/80 rounded-lg p-5 transition-all flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-rose-400 group-hover:bg-rose-400/10 transition-colors">
                <Webhook className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text group-hover:text-rose-400 transition-colors">Endpoints</h3>
                <p className="text-muted text-xs mt-1">Configure webhook destinations</p>
              </div>
            </Link>
          </div>

          <div className="mt-10">
            <h2 className="text-sm font-medium text-text mb-4 uppercase tracking-wider">Delivery Analytics</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-3"></div>
                Loading analytics...
              </div>
            ) : fetchError ? (
              <div className="border border-red-500/20 rounded-lg p-6 text-center text-red-400 text-sm">
                <AlertTriangle className="w-5 h-5 mx-auto mb-2 opacity-80" />
                <p>{fetchError}</p>
              </div>
            ) : analytics && analytics.totalDeliveries === 0 ? (
              <div className="border border-border/40 rounded-lg p-8 text-center bg-surface/10">
                <Activity className="w-6 h-6 text-muted mx-auto mb-3 opacity-50" />
                <h3 className="text-sm font-medium text-text mb-1">No Delivery Data</h3>
                <p className="text-xs text-muted">No webhooks were received in the selected time range.</p>
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-2 md:grid-cols-5 border border-border/50 rounded-lg overflow-hidden bg-surface/10 divide-x divide-border/50">
                {/* Total Deliveries */}
                <div className="p-4 hover:bg-surface/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-3.5 h-3.5 text-primary opacity-80" />
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Total</span>
                  </div>
                  <div className="text-2xl font-semibold text-text tracking-tight">{analytics.totalDeliveries.toLocaleString()}</div>
                </div>

                {/* Successful */}
                <div className="p-4 hover:bg-surface/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 opacity-80" />
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Successful</span>
                  </div>
                  <div className="text-2xl font-semibold text-emerald-400 tracking-tight">{analytics.successfulDeliveries.toLocaleString()}</div>
                </div>

                {/* Failed */}
                <div className="p-4 hover:bg-surface/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-3.5 h-3.5 text-rose-400 opacity-80" />
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Failed</span>
                  </div>
                  <div className="text-2xl font-semibold text-rose-400 tracking-tight">{analytics.failedDeliveries.toLocaleString()}</div>
                </div>

                {/* Success Rate */}
                <div className="p-4 hover:bg-surface/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-3.5 h-3.5 text-text opacity-50" />
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Success Rate</span>
                  </div>
                  <div className="text-2xl font-semibold text-text tracking-tight">{analytics.successRate}%</div>
                </div>

                {/* Avg Latency */}
                <div className="p-4 hover:bg-surface/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3.5 h-3.5 text-blue-400 opacity-80" />
                    <span className="text-xs font-medium text-muted uppercase tracking-wide">Latency</span>
                  </div>
                  <div className="text-2xl font-semibold text-text tracking-tight">{analytics.averageLatencyMs} <span className="text-sm text-muted font-normal">ms</span></div>
                </div>
              </div>
            ) : null}
            
            {analytics && analytics.totalDeliveries > 0 && analytics.deadLettered > 0 && (
               <div className="mt-4 flex items-center gap-3 p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg text-sm text-text">
                 <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                 <p><span className="font-semibold text-rose-500">{analytics.deadLettered.toLocaleString()}</span> events were permanently dead-lettered after exhausting all retries.</p>
               </div>
            )}
          </div>
          
          <div className="pt-8">
             {loading ? (
               <div className="h-64 w-full flex items-center justify-center text-xs text-muted bg-surface/5 border border-border/20 rounded-lg animate-pulse">
                 Loading trends...
               </div>
             ) : fetchError ? (
                null
             ) : trends && trends.data && trends.data.length > 0 ? (
                <div className="border border-border/30 rounded-lg p-1 bg-surface/5">
                  <TrendChart data={trends.data} timeRange={timeRange} />
                </div>
             ) : (
                <div className="h-64 w-full flex flex-col items-center justify-center text-xs text-muted bg-surface/10 border border-border/40 rounded-lg">
                  <Activity className="w-5 h-5 mb-2 opacity-30" />
                  No delivery activity in this period.
                </div>
             )}
          </div>

          <div className="mt-10">
            <h2 className="text-sm font-medium text-text mb-4 uppercase tracking-wider">Endpoint Health</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-3"></div>
                Loading endpoint health...
              </div>
            ) : fetchError ? (
              <div className="border border-red-500/20 rounded-lg p-6 text-center text-red-400 text-sm">
                <AlertTriangle className="w-5 h-5 mx-auto mb-2 opacity-80" />
                <p>Failed to load endpoint health.</p>
              </div>
            ) : !endpointHealth || endpointHealth.endpoints.length === 0 ? (
               <div className="border border-border/40 rounded-lg p-8 text-center bg-surface/10">
                 <Webhook className="w-6 h-6 text-muted mx-auto mb-3 opacity-50" />
                 <h3 className="text-sm font-medium text-text mb-1">No Endpoints Found</h3>
                 <p className="text-xs text-muted">No endpoints exist in this workspace.</p>
               </div>
            ) : (
               <div className="border border-border/50 rounded-lg overflow-hidden bg-surface/10">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse whitespace-nowrap">
                     <thead>
                       <tr className="border-b border-border/50">
                         <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider w-full">Endpoint URL</th>
                         <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-center">Status</th>
                         <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right">Success</th>
                         <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right">Latency</th>
                         <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right">Failures</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-border/30">
                       {endpointHealth.endpoints.map(ep => (
                         <tr key={ep._id} className="hover:bg-surface/30 transition-colors group">
                           <td className="px-4 py-3">
                             <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full flex-shrink-0 bg-primary/40 group-hover:bg-primary transition-colors"></div>
                               <div>
                                 <div className="font-mono text-sm text-text truncate max-w-[250px] md:max-w-md">{ep.destinationUrl || ep.endpointId}</div>
                                 <div className="text-xs text-muted/60 font-mono mt-0.5">{ep.endpointId}</div>
                               </div>
                             </div>
                           </td>
                           <td className="px-4 py-3 text-center">
                             {ep.health === 'healthy' ? (
                               <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                                 Healthy
                               </span>
                             ) : ep.health === 'degraded' ? (
                               <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                                 Degraded
                               </span>
                             ) : ep.health === 'unhealthy' ? (
                               <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
                                 Unhealthy
                               </span>
                             ) : (
                               <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-white/5 text-muted border border-white/10 uppercase tracking-wide">
                                 No Data
                               </span>
                             )}
                           </td>
                           <td className="px-4 py-3 text-right">
                             {ep.health !== 'no_data' ? (
                               <span className="text-sm text-text font-medium">{ep.successRate}%</span>
                             ) : (
                               <span className="text-sm text-muted/30">-</span>
                             )}
                           </td>
                           <td className="px-4 py-3 text-right">
                             {ep.health !== 'no_data' ? (
                               <span className="text-sm text-text font-medium">{ep.averageLatencyMs}ms</span>
                             ) : (
                               <span className="text-sm text-muted/30">-</span>
                             )}
                           </td>
                           <td className="px-4 py-3 text-right">
                             {ep.health !== 'no_data' ? (
                               <span className={`text-sm font-medium ${ep.failedDeliveries > 0 ? 'text-rose-400' : 'text-text'}`}>
                                 {ep.failedDeliveries.toLocaleString()}
                               </span>
                             ) : (
                               <span className="text-sm text-muted/30">-</span>
                             )}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Home;

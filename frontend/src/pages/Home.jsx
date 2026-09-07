import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useGhostMode } from '../context/GhostModeContext';
import {
  Activity,
  Webhook,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Radio,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import TrendChart from '../components/TrendChart';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { getErrorMessage } from '../utils/errorHandler';

const Home = () => {
  const { activeWorkspace, createWorkspace, loading: workspaceLoading } = useWorkspace();
  const { redactWorkspaceName, redactEndpointId, redactDestinationUrl } = useGhostMode();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [error, setError] = useState('');

  const [analytics, setAnalytics] = useState(null);
  const [endpointHealth, setEndpointHealth] = useState(null);
  const [trends, setTrends] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      await createWorkspace(newWorkspaceName);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create workspace'));
    }
  };

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
        setFetchError(getErrorMessage(err, 'Failed to load telemetry analytics.'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeWorkspace, timeRange]);

  // Loading state while checking workspace
  if (workspaceLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted font-mono text-xs">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span>Initializing telemetry...</span>
      </div>
    );
  }

  // Onboarding if user has no workspace yet
  if (!activeWorkspace) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-surface-1 border border-border rounded p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-text font-sans">
              Initialize Workspace
            </h2>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-2 border border-border text-muted">
              ONBOARDING
            </span>
          </div>
        </div>
        <p className="text-xs text-muted mb-5 leading-relaxed font-sans">
          Create an initial workspace to configure endpoints, ingest webhooks, and start monitoring delivery telemetry.
        </p>

        <form onSubmit={handleCreateWorkspace} className="space-y-4">
          {error && (
            <div className="p-2.5 bg-failure/10 border border-failure/25 text-failure text-xs font-mono rounded flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-mono uppercase text-muted tracking-wider mb-1">
              Workspace Name
            </label>
            <Input
              type="text"
              placeholder="e.g. Acme Production"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              autoFocus
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full h-8 text-xs font-medium"
            disabled={!newWorkspaceName.trim()}
          >
            Create Workspace
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Bar: Workspace Context & Time Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-text tracking-tight font-sans">
              Dashboard
            </h1>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-2 border border-border text-muted">
              {redactWorkspaceName(activeWorkspace.name)}
            </span>
          </div>
          <p className="text-xs text-muted mt-1 font-sans">
            Real-time delivery observability and endpoint health telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono font-medium text-muted uppercase tracking-wider">
            Range:
          </span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-8 px-2.5 bg-canvas border border-border rounded text-xs font-sans text-text cursor-pointer focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-colors"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Global Fetch Error Banner */}
      {fetchError && (
        <div className="flex items-center gap-2 p-3 bg-failure/10 border border-failure/20 rounded text-xs text-failure font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* 2. Compact Primary Telemetry Strip */}
      {loading ? (
        <div className="h-20 bg-surface-1 border border-border rounded animate-pulse" />
      ) : analytics && analytics.totalDeliveries > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-border rounded bg-surface-1 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {/* Total Deliveries */}
            <div className="p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted font-semibold">
                Total Events
              </div>
              <div className="text-xl font-mono font-semibold text-text tracking-tight mt-1">
                {analytics.totalDeliveries.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted font-mono mt-0.5">
                in {timeRange}
              </div>
            </div>

            {/* Success Rate */}
            <div className="p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted font-semibold flex items-center justify-between">
                <span>Success Rate</span>
                <CheckCircle2 className="w-3 h-3 text-success" />
              </div>
              <div className="text-xl font-mono font-semibold text-success tracking-tight mt-1">
                {analytics.successRate}%
              </div>
              <div className="text-[10px] text-muted font-mono mt-0.5">
                {analytics.successfulDeliveries.toLocaleString()} delivered
              </div>
            </div>

            {/* Failed Deliveries */}
            <div className="p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted font-semibold flex items-center justify-between">
                <span>Failures</span>
                {analytics.failedDeliveries > 0 && <XCircle className="w-3 h-3 text-failure" />}
              </div>
              <div className={`text-xl font-mono font-semibold tracking-tight mt-1 ${
                analytics.failedDeliveries > 0 ? 'text-failure' : 'text-text'
              }`}>
                {analytics.failedDeliveries.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted font-mono mt-0.5">
                {analytics.failedDeliveries > 0 ? 'delivery errors' : '0 errors'}
              </div>
            </div>

            {/* Average Latency */}
            <div className="p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted font-semibold flex items-center justify-between">
                <span>Avg Latency</span>
                <Clock className="w-3 h-3 text-muted" />
              </div>
              <div className="text-xl font-mono font-semibold text-text tracking-tight mt-1">
                {analytics.averageLatencyMs}
                <span className="text-xs font-normal text-muted ml-1">ms</span>
              </div>
              <div className="text-[10px] text-muted font-mono mt-0.5">
                turnaround time
              </div>
            </div>

            {/* Retry Rate */}
            <div className="p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted font-semibold">
                Retry Rate
              </div>
              <div className="text-xl font-mono font-semibold text-text tracking-tight mt-1">
                {analytics.retryRate != null ? `${analytics.retryRate}%` : '0%'}
              </div>
              <div className="text-[10px] text-muted font-mono mt-0.5">
                transient retries
              </div>
            </div>

            {/* Dead Lettered */}
            <div className="p-3.5 flex flex-col justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted font-semibold">
                Dead Lettered
              </div>
              <div className={`text-xl font-mono font-semibold tracking-tight mt-1 ${
                analytics.deadLettered > 0 ? 'text-failure font-bold' : 'text-text'
              }`}>
                {analytics.deadLettered != null ? analytics.deadLettered.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-muted font-mono mt-0.5">
                {analytics.deadLettered > 0 ? 'exhausted retries' : 'healthy queue'}
              </div>
            </div>
          </div>

          {/* Actionable Dead Letter Notice */}
          {analytics.deadLettered > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-failure/10 border border-failure/20 rounded text-xs">
              <div className="flex items-center gap-2 text-failure">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>{analytics.deadLettered.toLocaleString()}</strong> event
                  {analytics.deadLettered > 1 ? 's' : ''} permanently failed after exhausting retry attempts.
                </span>
              </div>
              <Link
                to="/events?status=retry_exhausted"
                className="font-mono text-xs text-failure hover:underline flex items-center gap-1 shrink-0 ml-4"
              >
                Inspect Dead-Lettered <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-border rounded p-6 text-center bg-surface-1">
          <Activity className="w-5 h-5 text-muted mx-auto mb-2 opacity-60" />
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-text mb-1">
            No Telemetry Data In Selected Period
          </h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            No webhook delivery attempts were recorded in the last {timeRange}. Send requests to your endpoints to view throughput.
          </p>
        </div>
      )}

      {/* 3. Secondary: Delivery Activity Chart */}
      <div>
        {loading ? (
          <div className="h-64 bg-surface-1 border border-border rounded animate-pulse" />
        ) : trends && trends.data && trends.data.length > 0 ? (
          <TrendChart data={trends.data} timeRange={timeRange} />
        ) : null}
      </div>

      {/* 4. Tertiary: Endpoint Health Matrix */}
      <div className="border border-border rounded bg-surface-1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-text">
              Endpoint Telemetry & Health
            </h3>
          </div>
          {endpointHealth?.endpoints && (
            <span className="text-[11px] font-mono text-muted">
              {endpointHealth.endpoints.length} endpoint{endpointHealth.endpoints.length === 1 ? '' : 's'} configured
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-xs font-mono text-muted">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
            Loading endpoint matrix...
          </div>
        ) : !endpointHealth || endpointHealth.endpoints.length === 0 ? (
          <div className="p-8 text-center text-muted font-mono text-xs">
            <p>No endpoints configured in this workspace.</p>
            <Link
              to="/endpoints"
              className="mt-3 inline-flex items-center gap-1.5 text-primary hover:underline text-xs"
            >
              <span>Configure your first endpoint</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap font-sans text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-2/40 text-[11px] font-mono text-muted uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-semibold">Endpoint & Destination</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Health Status</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Success Rate</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Avg Latency</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Deliveries</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Failures</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {endpointHealth.endpoints.map((ep) => {
                  const isDegradedOrFailing =
                    ep.health === 'unhealthy' ||
                    ep.health === 'degraded' ||
                    ep.failedDeliveries > 0;

                  return (
                    <tr
                      key={ep._id}
                      className="hover:bg-surface-2/50 transition-colors group"
                    >
                      {/* Destination / Endpoint ID */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-text truncate max-w-xs md:max-w-md">
                              {ep.destinationUrl ? redactDestinationUrl(ep.destinationUrl) : redactEndpointId(ep.endpointId)}
                            </div>
                            <div className="font-mono text-[10px] text-muted truncate">
                              ID: {redactEndpointId(ep.endpointId)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Health Status Badge */}
                      <td className="px-4 py-2.5 text-center">
                        <StatusBadge status={ep.health} size="sm" />
                      </td>

                      {/* Success Rate */}
                      <td className="px-4 py-2.5 text-right font-mono">
                        {ep.health !== 'no_data' ? (
                          <span
                            className={
                              ep.successRate >= 98
                                ? 'text-success font-medium'
                                : ep.successRate >= 90
                                ? 'text-warning font-medium'
                                : 'text-failure font-medium'
                            }
                          >
                            {ep.successRate}%
                          </span>
                        ) : (
                          <span className="text-muted/40">—</span>
                        )}
                      </td>

                      {/* Latency */}
                      <td className="px-4 py-2.5 text-right font-mono text-muted">
                        {ep.health !== 'no_data' ? (
                          <span className="text-text font-medium">
                            {ep.averageLatencyMs}
                            <span className="text-[10px] text-muted ml-0.5">ms</span>
                          </span>
                        ) : (
                          <span className="text-muted/40">—</span>
                        )}
                      </td>

                      {/* Deliveries */}
                      <td className="px-4 py-2.5 text-right font-mono text-muted">
                        {ep.health !== 'no_data' ? (
                          <span>{(ep.totalDeliveries || 0).toLocaleString()}</span>
                        ) : (
                          <span className="text-muted/40">—</span>
                        )}
                      </td>

                      {/* Failures */}
                      <td className="px-4 py-2.5 text-right font-mono">
                        {ep.health !== 'no_data' ? (
                          <span
                            className={
                              ep.failedDeliveries > 0
                                ? 'text-failure font-semibold'
                                : 'text-muted'
                            }
                          >
                            {(ep.failedDeliveries || 0).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted/40">—</span>
                        )}
                      </td>

                      {/* Actionable Deep Link */}
                      <td className="px-4 py-2.5 text-right">
                        {isDegradedOrFailing ? (
                          <Link
                            to={`/events?endpoint=${ep.endpointId}&status=failed`}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-failure hover:underline"
                            title="Filter events by this endpoint's failures"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <Link
                            to={`/events?endpoint=${ep.endpointId}`}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted hover:text-text hover:underline"
                            title="View all events for this endpoint"
                          >
                            <span>Events</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;

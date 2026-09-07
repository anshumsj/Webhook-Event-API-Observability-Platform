import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useGhostMode } from '../context/GhostModeContext';
import api from '../services/api';
import {
  FolderKanban,
  Plus,
  X,
  Building2,
  Activity,
  Webhook,
  Loader2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import ClipboardCopy from '../components/ClipboardCopy';
import { getErrorMessage } from '../utils/errorHandler';

export default function Projects() {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    createWorkspace,
    loading: workspaceLoading,
    projects,
    projectsLoading,
    refreshProjects,
  } = useWorkspace();

  const { redactWorkspaceName, redactProjectName, redactId } = useGhostMode();

  const [error, setError] = useState(null);

  // Create Project Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Create Workspace Modal State
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !activeWorkspace) return;

    setCreatingProject(true);
    setError(null);
    try {
      await api.post('/projects', {
        name: newProjectName.trim(),
        workspaceId: activeWorkspace._id,
      });
      setNewProjectName('');
      setShowCreateModal(false);
      refreshProjects(activeWorkspace._id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create project'));
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setCreatingWorkspace(true);
    setError(null);
    try {
      await createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setShowWorkspaceModal(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create workspace'));
    } finally {
      setCreatingWorkspace(false);
    }
  };

  if (workspaceLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-3" />
        <p className="text-xs font-mono">Loading workspace context...</p>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-surface-1 border border-border rounded p-6 shadow-2xl text-center">
          <div className="w-10 h-10 bg-primary/10 border border-primary/25 rounded flex items-center justify-center mx-auto mb-3 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-text mb-1">Create Your Workspace</h2>
          <p className="text-xs text-muted mb-5 leading-relaxed">
            HookSight isolates projects, endpoints, and telemetry events within workspaces.
            Create a workspace to begin routing webhooks.
          </p>

          <form onSubmit={handleCreateWorkspace} className="space-y-3.5 text-left">
            {error && (
              <div className="p-2.5 rounded bg-failure/10 border border-failure/25 text-failure text-xs font-mono">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-text mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp Production"
                className="w-full h-8 px-2.5 bg-canvas border border-border rounded text-xs text-text font-sans placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-colors"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!newWorkspaceName.trim() || creatingWorkspace}
              className="w-full"
            >
              {creatingWorkspace ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Workspace...</span>
                </>
              ) : (
                <span>Create Workspace</span>
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-1 border border-border p-3 rounded">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-text tracking-tight">Projects</h1>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted">
              {projects.length} configured
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Manage project environments and workspace routing boundaries
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refreshProjects(activeWorkspace._id)}
            disabled={projectsLoading}
            title="Refresh projects list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${projectsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowWorkspaceModal(true)}
            title="Create new workspace"
          >
            <Building2 className="w-3.5 h-3.5 text-muted" />
            <span>New Workspace</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            title="Create new project"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-failure/10 border border-failure/30 text-failure px-3.5 py-2.5 rounded text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs font-mono ml-4 text-failure/70 hover:text-failure cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Workspace Diagnostic & Scoping Panel */}
      <div className="bg-surface-1 border border-border rounded p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Active Workspace Switcher */}
          <div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1">
              Active Workspace
            </span>
            {workspaces.length > 1 ? (
              <select
                value={activeWorkspace._id}
                onChange={(e) => {
                  const ws = workspaces.find((w) => w._id === e.target.value);
                  if (ws) setActiveWorkspace(ws);
                }}
                className="w-full h-8 px-2.5 bg-canvas border border-border rounded text-xs text-text font-medium focus:outline-none focus:border-primary cursor-pointer"
              >
                {workspaces.map((w) => (
                  <option key={w._id} value={w._id}>
                    {redactWorkspaceName(w.name)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 h-8 px-2.5 bg-canvas border border-border rounded">
                <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-medium text-text truncate">{redactWorkspaceName(activeWorkspace.name)}</span>
              </div>
            )}
          </div>

          {/* Workspace ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
                Workspace ID
              </span>
              <ClipboardCopy text={activeWorkspace._id} displayText={redactId(activeWorkspace._id)} label="Copy" className="px-1 py-0 text-[10px]" />
            </div>
            <div className="h-8 px-2.5 bg-canvas border border-border rounded flex items-center">
              <span className="font-mono text-xs text-text truncate select-all">
                {redactId(activeWorkspace._id)}
              </span>
            </div>
          </div>

          {/* Projects in Scope */}
          <div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1">
              Project Count
            </span>
            <div className="h-8 px-2.5 bg-canvas border border-border rounded flex items-center justify-between font-mono">
              <span className="text-text font-semibold">{projects.length}</span>
              <span className="text-muted text-[11px]">in scope</span>
            </div>
          </div>

          {/* Role / Access */}
          <div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1">
              Access Boundary
            </span>
            <div className="h-8 px-2.5 bg-canvas border border-border rounded flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-success shrink-0" />
              <span className="font-mono text-xs text-text">Workspace Isolated</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Dense Projects Explorer */}
      {projectsLoading ? (
        <div className="bg-surface-1 border border-border rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 border-b border-border select-none">
                <tr>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">
                    Project Name
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">
                    Project ID
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">
                    Status
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium">
                    Created
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3.5 py-3">
                      <div className="h-3.5 w-36 bg-surface-2 rounded" />
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="h-3.5 w-32 bg-surface-2 rounded" />
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="h-3.5 w-16 bg-surface-2 rounded" />
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="h-3.5 w-24 bg-surface-2 rounded" />
                    </td>
                    <td className="px-3.5 py-3 text-right">
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
          <p className="text-xs text-muted max-w-sm mb-4 leading-relaxed">
            This workspace currently has no projects. Create a project to route and monitor incoming
            webhooks.
          </p>
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>Create Project</span>
          </Button>
        </div>
      ) : (
        <div className="bg-surface-1 border border-border rounded overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 border-b border-border select-none">
                <tr>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium min-w-[200px]">
                    Project Name
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium w-[220px]">
                    Project ID
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium w-[120px]">
                    Status
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium w-[180px]">
                    Created
                  </th>
                  <th className="px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted font-medium text-right w-[220px]">
                    Quick Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {projects.map((project) => (
                  <tr
                    key={project._id}
                    className="hover:bg-surface-2/60 transition-colors group cursor-pointer"
                  >
                    {/* Project Name */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-medium text-text group-hover:text-primary transition-colors tracking-tight">
                          {redactProjectName(project.name)}
                        </span>
                      </div>
                    </td>

                    {/* Project ID */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-xs text-text select-all tracking-tight truncate max-w-[150px]"
                          title={redactId(project._id)}
                        >
                          {redactId(project._id)}
                        </span>
                        <ClipboardCopy text={project._id} displayText={redactId(project._id)} label="Copy ID" />
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status="healthy" label="Active" size="sm" />
                    </td>

                    {/* Created Date */}
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-muted whitespace-nowrap">
                      {project.createdAt
                        ? formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })
                        : '—'}
                    </td>

                    {/* Quick Actions */}
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/events?project=${project._id}`}
                          className="inline-flex items-center gap-1 h-6 px-2 text-xs font-mono text-muted hover:text-text bg-surface-2 hover:bg-surface-3 border border-border rounded transition-colors"
                          title="View project events"
                        >
                          <Activity className="w-3 h-3 text-primary" />
                          <span>Events</span>
                        </Link>

                        <Link
                          to={`/endpoints?project=${project._id}`}
                          className="inline-flex items-center gap-1 h-6 px-2 text-xs font-mono text-muted hover:text-text bg-surface-2 hover:bg-surface-3 border border-border rounded transition-colors"
                          title="View project endpoints"
                        >
                          <Webhook className="w-3 h-3 text-primary" />
                          <span>Endpoints</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/40">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text">Create New Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-text transition-colors p-1 rounded hover:bg-surface-3 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-4 space-y-3.5">
              <div className="p-2.5 bg-canvas border border-border rounded text-xs space-y-1">
                <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">
                  Target Workspace
                </span>
                <span className="font-medium text-text block">{redactWorkspaceName(activeWorkspace.name)}</span>
                <span className="font-mono text-[11px] text-muted block truncate">
                  ID: {redactId(activeWorkspace._id)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Webhooks, Billing API"
                  className="w-full h-8 px-2.5 bg-canvas border border-border rounded text-xs text-text font-sans placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-colors"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingProject}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!newProjectName.trim() || creatingProject}
                >
                  {creatingProject ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Project</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Create Workspace Modal */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/40">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text">Create New Workspace</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkspaceModal(false)}
                className="text-muted hover:text-text transition-colors p-1 rounded hover:bg-surface-3 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp, Staging Environment"
                  className="w-full h-8 px-2.5 bg-canvas border border-border rounded text-xs text-text font-sans placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-colors"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  autoFocus
                />
                <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                  Workspaces group projects, endpoints, and telemetry into an isolated boundary.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowWorkspaceModal(false)}
                  disabled={creatingWorkspace}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!newWorkspaceName.trim() || creatingWorkspace}
                >
                  {creatingWorkspace ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Workspace</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

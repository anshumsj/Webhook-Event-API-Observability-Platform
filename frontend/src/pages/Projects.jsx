import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../services/api';
import { FolderKanban, Plus, MoreVertical, X } from 'lucide-react';
import { getErrorMessage } from '../utils/errorHandler';

export default function Projects() {
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      fetchProjects();
    } else {
      setLoading(false);
    }
  }, [activeWorkspace]);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/projects/${activeWorkspace._id}`);
      setProjects(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load projects'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setCreatingProject(true);
    try {
      await api.post('/projects', { 
        name: newProjectName, 
        workspaceId: activeWorkspace._id 
      });
      setNewProjectName('');
      setShowCreateModal(false);
      fetchProjects(); // Refresh the list
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create project'));
    } finally {
      setCreatingProject(false);
    }
  };

  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const { createWorkspace } = useWorkspace();

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      await createWorkspace(newWorkspaceName);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create workspace'));
    }
  };

  if (workspaceLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p>Loading workspace...</p>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-text">
        <div className="bg-surface border border-border rounded-xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <FolderKanban className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to HookSight</h2>
          <p className="text-muted mb-8">Create your first workspace to start monitoring webhooks and managing projects.</p>
          
          <form onSubmit={handleCreateWorkspace} className="space-y-4 text-left">
            {error && <div className="text-red-400 text-sm">{error}</div>}
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
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Projects</h1>
          <p className="text-muted mt-1">Manage projects in {activeWorkspace.name}</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary text-surface px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-surface/50 border border-border rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      ) : projects.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-6">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4">
            <FolderKanban className="w-6 h-6 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text mb-1">No projects found</h3>
          <p className="text-muted mb-4 max-w-sm">Get started by creating a new project in this workspace.</p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-surface border border-border text-text px-4 py-2 rounded-lg font-medium hover:bg-white/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {projects.map(project => (
            <div key={project._id} className="bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <button className="text-muted hover:text-text opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg font-medium text-text mb-1">{project.name}</h3>
              <p className="text-sm text-muted">ID: {project._id.substring(0, 8)}...</p>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text">Create New Project</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-muted hover:text-text rounded-md hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production API Webhooks"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-text hover:bg-white/5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim() || creatingProject}
                  className="px-4 py-2 text-sm font-medium bg-primary text-surface rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

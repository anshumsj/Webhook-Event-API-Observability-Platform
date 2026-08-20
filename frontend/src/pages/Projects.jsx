import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../services/api';
import { FolderKanban, Plus, MoreVertical } from 'lucide-react';

export default function Projects() {
  const { activeWorkspace } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

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
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please try again later.');
    } finally {
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
          <h1 className="text-2xl font-bold text-text">Projects</h1>
          <p className="text-muted mt-1">Manage projects in {activeWorkspace.name}</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-surface px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
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
          <button className="flex items-center gap-2 bg-surface border border-border text-text px-4 py-2 rounded-lg font-medium hover:bg-white/5 transition-colors">
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
    </div>
  );
}

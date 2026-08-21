import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Activity, Webhook, FolderKanban } from 'lucide-react';
import { Link } from 'react-router-dom';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-muted mt-1">
            {activeWorkspace ? `Overview for ${activeWorkspace.name}` : 'Welcome to HookSight'}
          </p>
        </div>
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
      )}
    </div>
  );
};

export default Home;

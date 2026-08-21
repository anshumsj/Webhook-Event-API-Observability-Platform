import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Webhook, Activity, Settings, Briefcase } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'Endpoints', path: '/endpoints', icon: Webhook },
  { name: 'Events', path: '/events', icon: Activity },
];

export default function Sidebar() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const navigate = useNavigate();

  return (
    <div className="w-64 bg-surface border-r border-border flex flex-col h-screen">
      <div className="p-6 pb-2">
        <h1 className="text-2xl font-bold text-primary tracking-wider mb-6">HookSight</h1>
        
        {/* Workspace Switcher */}
        {workspaces.length > 0 && (
          <div className="relative group">
            <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-sm text-text cursor-pointer hover:border-primary/50 transition-colors">
              <Briefcase className="w-4 h-4 text-primary" />
              <select 
                className="bg-transparent outline-none w-full cursor-pointer appearance-none"
                value={activeWorkspace?._id || ''}
                onChange={(e) => {
                  if (e.target.value === 'new') {
                    setActiveWorkspace(null); // Triggers the create workspace UI in Projects.jsx
                    navigate('/projects'); // Ensure they are on the projects page to see the form
                  } else {
                    const selected = workspaces.find(w => w._id === e.target.value);
                    if (selected) setActiveWorkspace(selected);
                  }
                }}
              >
                {workspaces.map(w => (
                  <option key={w._id} value={w._id}>{w.name}</option>
                ))}
                <option value="new" className="text-primary font-medium">+ Create Workspace</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-muted hover:bg-white/5 hover:text-text'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:bg-white/5 hover:text-text transition-all duration-200"
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </NavLink>
      </div>
    </div>
  );
}

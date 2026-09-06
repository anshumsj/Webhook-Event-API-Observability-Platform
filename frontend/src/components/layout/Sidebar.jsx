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
    <div className="w-64 bg-background border-r border-border/40 flex flex-col h-screen">
      <div className="p-5 pb-2">
        <h1 className="text-xl font-bold text-text tracking-tight mb-6 flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <Webhook className="w-4 h-4 text-background" />
          </div>
          HookSight
        </h1>
        
        {/* Workspace Switcher */}
        {workspaces.length > 0 && (
          <div className="relative group">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface/30 border border-border/40 rounded-md text-sm text-text cursor-pointer hover:border-border/80 transition-colors">
              <Briefcase className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
              <select 
                className="bg-transparent outline-none w-full cursor-pointer appearance-none text-xs font-medium"
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
      
      <nav className="flex-1 px-3 space-y-0.5 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 group text-sm ${
                isActive 
                  ? 'bg-surface/50 text-text font-medium shadow-sm' 
                  : 'text-muted hover:bg-surface/30 hover:text-text'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border/40 mt-auto">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 group text-sm ${
              isActive 
                ? 'bg-surface/50 text-text font-medium shadow-sm' 
                : 'text-muted hover:bg-surface/30 hover:text-text'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </NavLink>
      </div>
    </div>
  );
}

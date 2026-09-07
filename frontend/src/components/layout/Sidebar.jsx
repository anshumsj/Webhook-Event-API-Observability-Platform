import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Webhook,
  Activity,
  Settings,
  ChevronDown,
  X,
  Radio,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useGhostMode } from '../../context/GhostModeContext';

const NAV_GROUPS = [
  {
    label: 'Telemetry',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'Events', path: '/events', icon: Activity },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { name: 'Endpoints', path: '/endpoints', icon: Webhook },
      { name: 'Projects', path: '/projects', icon: FolderKanban },
    ],
  },
];

export default function Sidebar({ isOpen = false, onClose }) {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const { redactWorkspaceName } = useGhostMode();
  const navigate = useNavigate();

  const handleWorkspaceChange = (e) => {
    const value = e.target.value;
    if (value === 'new') {
      setActiveWorkspace(null);
      navigate('/projects');
      if (onClose) onClose();
    } else {
      const selected = workspaces.find((w) => w._id === value);
      if (selected) {
        setActiveWorkspace(selected);
      }
    }
  };

  const renderSidebarContent = () => (
    <>
      {/* 1. Header & Technical Branding */}
      <div className="h-12 px-3.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Radio className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-sans font-semibold text-xs tracking-tight text-text">
              HookSight
            </span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-2 border border-border text-muted font-medium">
              CONSOLE
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-muted hover:text-text rounded hover:bg-surface-2 transition-colors"
            title="Close navigation"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Workspace Selector */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-1.5 px-0.5">
          Workspace
        </div>

        {workspaces.length > 0 ? (
          <div className="relative group">
            <div className="flex items-center gap-2 px-2.5 h-8 bg-surface-2 border border-border rounded text-xs text-text hover:border-border-strong transition-colors cursor-pointer">
              <div className="w-4 h-4 rounded-sm bg-primary/20 text-primary flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                {activeWorkspace?.name
                  ? redactWorkspaceName(activeWorkspace.name).charAt(0).toUpperCase()
                  : 'W'}
              </div>
              <select
                className="bg-transparent outline-none w-full cursor-pointer appearance-none text-xs font-medium text-text pr-4 truncate font-sans"
                value={activeWorkspace?._id || ''}
                onChange={handleWorkspaceChange}
              >
                {workspaces.map((w) => (
                  <option
                    key={w._id}
                    value={w._id}
                    className="bg-surface-1 text-text"
                  >
                    {redactWorkspaceName(w.name)}
                  </option>
                ))}
                <option
                  value="new"
                  className="bg-surface-1 text-primary font-medium"
                >
                  + Create Workspace
                </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted group-hover:text-text shrink-0 pointer-events-none absolute right-2.5" />
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              navigate('/projects');
              if (onClose) onClose();
            }}
            className="w-full flex items-center justify-center gap-1.5 h-8 bg-surface-2 border border-border/80 border-dashed rounded text-xs text-muted hover:text-text hover:border-border-strong transition-colors"
          >
            <span>+ Create Workspace</span>
          </button>
        )}
      </div>

      {/* 3. Navigation Hierarchy */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted/70 px-2 mb-1 select-none">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (onClose) onClose();
                  }}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-2.5 px-2.5 h-[30px] rounded text-xs transition-colors duration-150 select-none ${
                      isActive
                        ? 'bg-surface-2 text-text font-medium border border-border/80'
                        : 'text-text-secondary hover:text-text hover:bg-surface-2/60 border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r-sm" />
                      )}
                      <item.icon
                        className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                          isActive
                            ? 'text-primary'
                            : 'text-muted group-hover:text-text-secondary'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* 4. Footer System Navigation */}
      <div className="p-2.5 border-t border-border shrink-0 space-y-1">
        <NavLink
          to="/settings"
          onClick={() => {
            if (onClose) onClose();
          }}
          className={({ isActive }) =>
            `group relative flex items-center gap-2.5 px-2.5 h-[30px] rounded text-xs transition-colors duration-150 select-none ${
              isActive
                ? 'bg-surface-2 text-text font-medium border border-border/80'
                : 'text-text-secondary hover:text-text hover:bg-surface-2/60 border border-transparent'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r-sm" />
              )}
              <Settings
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted group-hover:text-text-secondary'
                }`}
              />
              <span className="truncate">Settings</span>
            </>
          )}
        </NavLink>

        <div className="pt-2 px-2 flex items-center justify-between text-[10px] font-mono text-muted/60 select-none">
          <span>INGESTION ACTIVE</span>
          <span>v1.0</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Fixed Technical Rail */}
      <aside className="hidden lg:flex flex-col w-56 bg-surface-1 border-r border-border h-screen shrink-0 select-none">
        {renderSidebarContent()}
      </aside>

      {/* Mobile / Tablet Slide-over Drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-200 ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className={`fixed inset-y-0 left-0 w-60 bg-surface-1 border-r border-border flex flex-col shadow-2xl transition-transform duration-200 ease-out z-10 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebarContent()}
        </aside>
      </div>
    </>
  );
}

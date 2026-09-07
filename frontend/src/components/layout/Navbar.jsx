import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useGhostMode } from '../../context/GhostModeContext';
import { Search, Bell, LogOut, WifiOff, Menu, EyeOff, Eye } from 'lucide-react';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const { isGhostMode, toggleGhostMode, redactUserName } = useGhostMode();

  const displayName = redactUserName(user?.name);
  const userInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U';

  return (
    <header className="h-12 bg-surface-1/90 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shrink-0">
      {/* Left Area: Mobile Menu Toggle + Command / Search Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 -ml-1 text-muted hover:text-text hover:bg-surface-2 rounded transition-colors"
          title="Open navigation menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center bg-canvas border border-border rounded px-2.5 h-8 w-48 sm:w-64 md:w-80 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/25 transition-all">
          <Search className="w-3.5 h-3.5 text-muted mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search events, requests... (Ctrl+K)"
            className="bg-transparent border-none outline-none text-xs text-text w-full placeholder:text-muted/60 font-sans"
          />
          <kbd className="hidden md:inline-block text-[10px] font-mono px-1 py-0.2 rounded bg-surface-2 border border-border text-muted shrink-0 ml-1">
            /
          </kbd>
        </div>
      </div>

      {/* Right Area: Ghost Mode Toggle, Telemetry Status, Notifications, Account & Logout */}
      <div className="flex items-center gap-3">
        {/* Ghost Mode Toggle */}
        <button
          onClick={toggleGhostMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-all duration-200 cursor-pointer select-none border ${
            isGhostMode
              ? 'bg-primary/15 border-primary/30 text-primary shadow-[0_0_8px_rgba(var(--color-primary-rgb,99,102,241),0.15)]'
              : 'bg-surface-2 border-border text-muted hover:text-text hover:bg-surface-3 hover:border-border-strong'
          }`}
          title={isGhostMode
            ? 'Ghost Mode Active — Click to disable presentation privacy'
            : 'Enable Ghost Mode — Hide sensitive data for demos & screen sharing'
          }
          aria-label={isGhostMode ? 'Disable Ghost Mode' : 'Enable Ghost Mode'}
          aria-pressed={isGhostMode}
          role="switch"
        >
          {isGhostMode ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {isGhostMode ? '🕶 Ghost' : 'Ghost'}
          </span>
        </button>

        {/* Real-time Socket Connection State */}
        {isConnected ? (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-success/10 border border-success/20 rounded text-[11px] font-mono text-success select-none"
            title="Real-time WebSocket connected"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>LIVE</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 bg-failure/10 border border-failure/20 rounded text-[11px] font-mono text-failure animate-pulse select-none"
            title="Real-time WebSocket disconnected — attempting reconnection"
          >
            <WifiOff className="w-3 h-3" />
            <span className="hidden md:inline">RECONNECTING</span>
            <span className="md:hidden">OFFLINE</span>
          </div>
        )}

        {/* Notifications */}
        <button
          className="relative p-1.5 text-muted hover:text-text hover:bg-surface-2 rounded transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full"></span>
        </button>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div
            className="w-6 h-6 rounded bg-surface-3 border border-border text-text font-mono text-xs font-semibold flex items-center justify-center select-none"
            title={isGhostMode ? 'Developer' : (user?.email || user?.name || 'User')}
          >
            {userInitial}
          </div>
          <span className="text-xs font-medium text-text hidden sm:inline-block truncate max-w-[120px]">
            {displayName || 'Developer'}
          </span>
          <button
            onClick={logout}
            className="p-1.5 text-muted hover:text-failure hover:bg-failure/10 rounded transition-colors ml-1"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

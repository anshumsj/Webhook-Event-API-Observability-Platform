import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useSocket } from '../context/SocketContext';
import {
  Settings as SettingsIcon,
  Building2,
  User,
  Wifi,
  WifiOff,
  Server,
  LogOut,
  FolderKanban,
} from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import ClipboardCopy from '../components/ClipboardCopy';

export default function Settings() {
  const { user, logout } = useAuth();
  const { activeWorkspace, projects } = useWorkspace();
  const { isConnected } = useSocket();

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-1 border border-border p-3.5 rounded">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-primary" />
            <h1 className="text-base font-semibold text-text tracking-tight">
              Settings & Diagnostics
            </h1>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 border border-border text-muted">
              v1.0-console
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5 font-sans">
            Inspect workspace tenancy, authenticated developer session, and real-time gateway telemetry
          </p>
        </div>

        {activeWorkspace && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
              Scoped:
            </span>
            <span className="font-mono text-xs text-text bg-surface-2 border border-border px-2 py-0.5 rounded">
              {activeWorkspace.name}
            </span>
          </div>
        )}
      </div>

      {/* 2. Workspace & Tenancy Isolation Diagnostic */}
      <div className="bg-surface-1 border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-2/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-text">
              Active Workspace Scoping
            </h2>
          </div>
          <StatusBadge status="healthy" label="Tenant Isolated" size="sm" />
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Workspace Name */}
          <div className="p-3 bg-canvas border border-border rounded">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1">
              Workspace Name
            </span>
            <span className="font-semibold text-text text-sm">
              {activeWorkspace?.name || '—'}
            </span>
          </div>

          {/* Workspace ID */}
          <div className="p-3 bg-canvas border border-border rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
                Workspace ID
              </span>
              {activeWorkspace?._id && (
                <ClipboardCopy text={activeWorkspace._id} label="Copy" className="px-1 py-0 text-[10px]" />
              )}
            </div>
            <span className="font-mono text-xs text-text truncate block select-all">
              {activeWorkspace?._id || '—'}
            </span>
          </div>

          {/* Projects in Scope */}
          <div className="p-3 bg-canvas border border-border rounded">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1">
              Projects In Scope
            </span>
            <div className="flex items-center gap-2">
              <FolderKanban className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-text font-semibold text-sm">
                {projects?.length || 0}
              </span>
              <span className="text-muted text-[11px] font-mono">
                active project{projects?.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Developer Session & Identity */}
      <div className="bg-surface-1 border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-2/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-text">
              Developer Session & Identity
            </h2>
          </div>
          <span className="text-[10px] font-mono text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded">
            Authenticated
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-canvas border border-border rounded">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1">
                Developer Name
              </span>
              <span className="font-medium text-text text-sm">
                {user?.name || 'Developer'}
              </span>
            </div>

            <div className="p-3 bg-canvas border border-border rounded">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1">
                Authenticated Email
              </span>
              <span className="font-mono text-xs text-text select-all">
                {user?.email || '—'}
              </span>
            </div>
          </div>

          {/* Session Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted">
              Terminate the active developer console session and invalidate local JWT tokens.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={logout}
              className="shrink-0"
              title="Sign out of HookSight"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Session</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Gateway Telemetry & Environment */}
      <div className="bg-surface-1 border border-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-2/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-text">
              Gateway Telemetry & Environment
            </h2>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* API Gateway URL */}
          <div className="p-3 bg-canvas border border-border rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
                API Gateway Base URL
              </span>
              <ClipboardCopy text={apiBaseUrl} label="Copy" className="px-1 py-0 text-[10px]" />
            </div>
            <div className="font-mono text-xs text-text select-all truncate">
              {apiBaseUrl}
            </div>
          </div>

          {/* WebSocket Ingestion State */}
          <div className="p-3 bg-canvas border border-border rounded space-y-1.5">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">
              Live Socket Pipeline
            </span>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-success" />
                  <span className="font-mono text-xs text-success font-medium">
                    Connected (Streaming Telemetry)
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-failure animate-pulse" />
                  <span className="font-mono text-xs text-failure font-medium">
                    Reconnecting to Ingest Worker...
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

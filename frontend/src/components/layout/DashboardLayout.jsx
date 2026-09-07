import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useGhostMode } from '../../context/GhostModeContext';
import { EyeOff } from 'lucide-react';

export default function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isGhostMode } = useGhostMode();

  return (
    <div className="flex h-screen bg-canvas overflow-hidden text-text selection:bg-primary/25">
      {/* Sidebar handles both desktop permanent rail and mobile off-canvas drawer */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main viewport area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />

        {/* Ghost Mode Active Banner */}
        {isGhostMode && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-mono text-primary select-none shrink-0">
            <EyeOff className="w-3.5 h-3.5" />
            <span className="font-medium">🕶 Ghost Mode Active</span>
            <span className="hidden sm:inline text-primary/70">— Sensitive workspace data is hidden for presentation</span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-canvas scroll-smooth">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

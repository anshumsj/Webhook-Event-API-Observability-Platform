import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, Bell, User, LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  
  return (
    <header className="h-16 bg-surface/50 backdrop-blur-md border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center bg-background border border-border rounded-lg px-3 py-1.5 w-64 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
        <Search className="w-4 h-4 text-muted mr-2" />
        <input 
          type="text" 
          placeholder="Search..." 
          className="bg-transparent border-none outline-none text-sm text-text w-full placeholder-muted"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-muted hover:text-text hover:bg-white/5 rounded-full transition-all">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-2 w-2 h-2 bg-primary rounded-full"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary/30 transition-all">
            <User className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-text">{user?.name || 'User'}</span>
          <button 
            onClick={logout}
            className="ml-2 p-2 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

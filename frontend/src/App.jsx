import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { GhostModeProvider } from './context/GhostModeContext';
import './App.css';

function App() {
  return (
    <div className="App">
      <GhostModeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <AppRoutes />
          </WorkspaceProvider>
        </AuthProvider>
      </GhostModeProvider>
    </div>
  );
}

export default App;

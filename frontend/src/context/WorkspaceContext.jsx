import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext();
const ACTIVE_WORKSPACE_KEY = 'hooksight_active_workspace_id';

export const useWorkspace = () => useContext(WorkspaceContext);

export const WorkspaceProvider = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState(null);
  const [loading, setLoading] = useState(!!user);

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const refreshProjects = async (workspaceId = activeWorkspace?._id) => {
    if (!workspaceId) return;
    setProjectsLoading(true);
    try {
      const res = await api.get(`/projects/${workspaceId}`);
      setProjects(res.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspace) {
      setProjects([]);
      refreshProjects(activeWorkspace._id);
    } else {
      setProjects([]);
      setProjectsLoading(false);
    }
  }, [activeWorkspace]);

  // Wrapper that also persists to localStorage
  const setActiveWorkspace = (workspace) => {
    setActiveWorkspaceState(workspace);
    if (workspace?._id) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace._id);
    } else {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      setLoading(false);
    }
  }, [user]);

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const res = await api.get('/workspaces');
      setWorkspaces(res.data);

      if (res.data.length > 0) {
        // Try to restore the previously selected workspace from localStorage
        const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
        const savedWorkspace = savedId && res.data.find(w => w._id === savedId);

        // Use saved workspace if it still exists, otherwise fall back to first
        setActiveWorkspaceState(savedWorkspace || res.data[0]);
        if (!savedWorkspace) {
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, res.data[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async (name) => {
    try {
      const res = await api.post('/workspaces', { name });
      const newWorkspace = res.data;
      setWorkspaces(prev => [...prev, newWorkspace]);
      setActiveWorkspace(newWorkspace);
      return newWorkspace;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  };

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, setActiveWorkspace, createWorkspace, loading, projects, projectsLoading, refreshProjects }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

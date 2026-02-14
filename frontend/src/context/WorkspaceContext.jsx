import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../api';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.workspace_id) {
      api.get(`/workspace/${user.workspace_id}`)
        .then(res => setWorkspace(res.data.workspace))
        .catch(() => setWorkspace(null))
        .finally(() => setLoading(false));
    } else if (user) {
      // Try to get any workspace user belongs to
      api.get('/workspace')
        .then(res => {
          if (res.data.workspaces?.length > 0) {
            setWorkspace(res.data.workspaces[0]);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const refreshWorkspace = async () => {
    if (workspace?.id) {
      const res = await api.get(`/workspace/${workspace.id}`);
      setWorkspace(res.data.workspace);
    }
  };

  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspace, loading, refreshWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

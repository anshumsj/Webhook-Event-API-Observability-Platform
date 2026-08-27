import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    // Remove /api from the end of the URL for socket connection
    const socketUrl = apiBaseUrl.replace(/\/api\/?$/, '');

    const newSocket = io(socketUrl, {
      auth: {
        token: localStorage.getItem('token') // Send token for future authentication
      },
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket.IO] Connected to server with ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected from server. Reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket.IO] Connection error:', err.message);
      setIsConnected(false);
    });

    // Cleanup on unmount or when user logs out
    return () => {
      newSocket.disconnect();
    };
  }, [user]); // Re-run if auth state changes

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

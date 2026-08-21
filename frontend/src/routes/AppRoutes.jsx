import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from '../pages/Home';
import Login from '../pages/Login';
import Projects from '../pages/Projects';
import Endpoints from '../pages/Endpoints';
import Events from '../pages/Events';
import EventDetails from '../pages/EventDetails';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';

// Simple protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return children;
};

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={
          <ProtectedRoute>
            <SocketProvider>
              <DashboardLayout />
            </SocketProvider>
          </ProtectedRoute>
        }>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/endpoints" element={<Endpoints />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:eventId" element={<EventDetails />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default AppRoutes;

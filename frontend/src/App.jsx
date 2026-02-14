import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Inbox from './pages/Inbox';
import Bookings from './pages/Bookings';
import Contacts from './pages/Contacts';
import Services from './pages/Services';
import Forms from './pages/Forms';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import PublicContactForm from './pages/PublicContactForm';
import PublicBooking from './pages/PublicBooking';
import PublicFormSubmission from './pages/PublicFormSubmission';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <WorkspaceProvider><Layout>{children}</Layout></WorkspaceProvider>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <Routes>
      {/* Public routes (no logins) */}
      <Route path="/public/contact/:workspaceId" element={<PublicContactForm />} />
      <Route path="/public/book/:serviceToken" element={<PublicBooking />} />
      <Route path="/public/form/:submissionToken" element={<PublicFormSubmission />} />

      {/* Auth routes */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
      <Route path="/inbox/:conversationId" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
      <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
      <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />

      {/* Default */}
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

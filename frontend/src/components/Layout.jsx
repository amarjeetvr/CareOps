import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/inbox', label: 'Inbox', icon: '💬' },
  { path: '/bookings', label: 'Bookings', icon: '📅' },
  { path: '/contacts', label: 'Contacts', icon: '👥' },
  { path: '/services', label: 'Services', icon: '⚙️' },
  { path: '/forms', label: 'Forms', icon: '📋' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/staff', label: 'Staff', icon: '👤' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <span className="brand">CareOps</span>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h2>CareOps</h2>
          {workspace && <span className={`ws-badge ${workspace.status}`}>{workspace.status}</span>}
        </div>
        {workspace && <div className="ws-name">{workspace.name}</div>}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <strong>{user?.name}</strong>
            <small>{user?.role}</small>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

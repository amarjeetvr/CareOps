import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

export default function Dashboard() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;
    if (workspace.status === 'inactive') {
      navigate('/onboarding');
      return;
    }
    api.get(`/dashboard?workspace_id=${workspace.id}`)
      .then(res => setData(res.data.dashboard))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspace, navigate]);

  if (loading) return <div className="page-loading">Loading dashboard...</div>;
  if (!data) return <div className="page-empty">No data available</div>;

  const { stats, todaysBookings, upcomingBookings, unansweredConversations, pendingForms, lowStockItems, automationErrors } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">What's happening in your business right now</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/bookings')}>
          <div className="stat-value">{todaysBookings.length}</div>
          <div className="stat-label">Today's Bookings</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/bookings')}>
          <div className="stat-value">{stats.completedThisWeek}</div>
          <div className="stat-label">Completed (7d)</div>
        </div>
        <div className="stat-card warn" onClick={() => navigate('/bookings')}>
          <div className="stat-value">{stats.noShowThisWeek}</div>
          <div className="stat-label">No-shows (7d)</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/contacts')}>
          <div className="stat-value">{stats.newLeadsThisWeek}</div>
          <div className="stat-label">New Leads (7d)</div>
        </div>
        <div className="stat-card warn" onClick={() => navigate('/inbox')}>
          <div className="stat-value">{unansweredConversations.length}</div>
          <div className="stat-label">Unanswered Msgs</div>
        </div>
        <div className="stat-card warn" onClick={() => navigate('/forms')}>
          <div className="stat-value">{stats.pendingForms}</div>
          <div className="stat-label">Pending Forms</div>
        </div>
        <div className="stat-card danger" onClick={() => navigate('/inventory')}>
          <div className="stat-value">{stats.lowStockCount}</div>
          <div className="stat-label">Low Stock Items</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{automationErrors.length}</div>
          <div className="stat-label">Failed Automations</div>
        </div>
      </div>

      {/* Today's Bookings */}
      <div className="dashboard-section">
        <h2>Today's Bookings</h2>
        {todaysBookings.length === 0 ? (
          <p className="empty-text">No bookings today</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Time</th><th>Service</th><th>Contact</th><th>Status</th></tr>
              </thead>
              <tbody>
                {todaysBookings.map(b => (
                  <tr key={b.id}>
                    <td>{new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{b.service_name || b.title}</td>
                    <td>{b.contact_name || '—'}</td>
                    <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Upcoming */}
        <div className="dashboard-section">
          <h2>Upcoming Bookings</h2>
          {upcomingBookings.length === 0 ? <p className="empty-text">None scheduled</p> : (
            <ul className="dashboard-list">
              {upcomingBookings.map(b => (
                <li key={b.id}>
                  <strong>{b.service_name || b.title}</strong>
                  <span>{new Date(b.start_time).toLocaleDateString()} - {b.contact_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Unanswered */}
        <div className="dashboard-section">
          <h2>Unanswered Conversations</h2>
          {unansweredConversations.length === 0 ? <p className="empty-text">All caught up!</p> : (
            <ul className="dashboard-list">
              {unansweredConversations.map(c => (
                <li key={c.id} className="clickable" onClick={() => navigate(`/inbox/${c.id}`)}>
                  <strong>{c.contact_name}</strong>
                  <span>{c.contact_email || c.contact_phone}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending Forms */}
        <div className="dashboard-section">
          <h2>Pending Forms</h2>
          {pendingForms.length === 0 ? <p className="empty-text">No pending forms</p> : (
            <ul className="dashboard-list">
              {pendingForms.map(f => (
                <li key={f.id}>
                  <strong>{f.form_name}</strong>
                  <span>{f.contact_name || 'Unknown'} - {new Date(f.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Low Stock */}
        <div className="dashboard-section">
          <h2>Low Stock Alerts</h2>
          {lowStockItems.length === 0 ? <p className="empty-text">Stock levels OK</p> : (
            <ul className="dashboard-list">
              {lowStockItems.map(i => (
                <li key={i.id} className="alert-item" onClick={() => navigate('/inventory')}>
                  <strong>{i.name}</strong>
                  <span className="text-danger">{i.quantity} remaining (threshold: {i.low_stock_threshold})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

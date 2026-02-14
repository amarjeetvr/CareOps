import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

export default function Bookings() {
  const { workspace } = useWorkspace();
  const [bookings, setBookings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '', contact_id: '', service_id: '', start_time: '', end_time: '', description: ''
  });

  useEffect(() => {
    if (!workspace?.id) return;
    Promise.all([
      api.get(`/bookings?workspace_id=${workspace.id}`),
      api.get(`/contacts?workspace_id=${workspace.id}`),
      api.get(`/services?workspace_id=${workspace.id}`)
    ]).then(([bRes, cRes, sRes]) => {
      setBookings(bRes.data.bookings);
      setContacts(cRes.data.contacts);
      setServices(sRes.data.services);
    }).finally(() => setLoading(false));
  }, [workspace]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bookings', { ...formData, workspace_id: workspace.id });
      setShowForm(false);
      setFormData({ title: '', contact_id: '', service_id: '', start_time: '', end_time: '', description: '' });
      const res = await api.get(`/bookings?workspace_id=${workspace.id}`);
      setBookings(res.data.bookings);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create booking');
    }
  };

  const updateStatus = async (id, status) => {
    await api.put(`/bookings/${id}`, { status });
    const res = await api.get(`/bookings?workspace_id=${workspace.id}`);
    setBookings(res.data.bookings);
  };

  const handleServiceChange = (serviceId) => {
    setFormData(prev => ({ ...prev, service_id: serviceId }));
    const svc = services.find(s => s.id === parseInt(serviceId));
    if (svc && formData.start_time) {
      const start = new Date(formData.start_time);
      const end = new Date(start.getTime() + svc.duration_minutes * 60000);
      setFormData(prev => ({ ...prev, service_id: serviceId, end_time: end.toISOString().slice(0, 16), title: svc.name }));
    }
  };

  if (loading) return <div className="page-loading">Loading bookings...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Bookings</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Booking'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label>Service</label>
              <select value={formData.service_id} onChange={e => handleServiceChange(e.target.value)}>
                <option value="">Select service</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min)</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Contact</label>
              <select value={formData.contact_id} onChange={e => setFormData({ ...formData, contact_id: e.target.value })}>
                <option value="">Select contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Title</label>
            <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Time</label>
              <input type="datetime-local" value={formData.start_time}
                onChange={e => setFormData({ ...formData, start_time: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input type="datetime-local" value={formData.end_time}
                onChange={e => setFormData({ ...formData, end_time: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Create Booking</button>
        </form>
      )}

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Time</th><th>Title</th><th>Contact</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id}>
                <td>{new Date(b.start_time).toLocaleDateString()}</td>
                <td>{new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{b.title}</td>
                <td>{b.contact_name || '—'}</td>
                <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                <td className="actions">
                  {b.status === 'confirmed' && (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => updateStatus(b.id, 'completed')}>Complete</button>
                      <button className="btn btn-sm btn-danger" onClick={() => updateStatus(b.id, 'no_show')}>No-show</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan="6" className="empty-text">No bookings yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

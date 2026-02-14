import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Services() {
  const { workspace } = useWorkspace();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [availSlots, setAvailSlots] = useState([]);
  const [formData, setFormData] = useState({ name: '', duration_minutes: 60, location: '', description: '' });
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: '09:00', end_time: '17:00' });

  useEffect(() => {
    if (!workspace?.id) return;
    loadServices();
  }, [workspace]);

  const loadServices = async () => {
    const res = await api.get(`/services?workspace_id=${workspace.id}`);
    setServices(res.data.services);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/services', { ...formData, workspace_id: workspace.id });
      setShowForm(false);
      setFormData({ name: '', duration_minutes: 60, location: '', description: '' });
      loadServices();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const viewService = async (service) => {
    setSelectedService(service);
    const res = await api.get(`/services/${service.id}/availability`);
    setAvailSlots(res.data.availability);
  };

  const addSlot = async () => {
    if (!selectedService) return;
    await api.post(`/services/${selectedService.id}/availability`, newSlot);
    const res = await api.get(`/services/${selectedService.id}/availability`);
    setAvailSlots(res.data.availability);
  };

  const removeSlot = async (slotId) => {
    await api.delete(`/services/availability/${slotId}`);
    setAvailSlots(availSlots.filter(s => s.id !== slotId));
  };

  if (loading) return <div className="page-loading">Loading services...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Services</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setSelectedService(null); }}>
          {showForm ? 'Cancel' : '+ New Service'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={handleCreate}>
          <div className="form-group">
            <label>Service Name *</label>
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input type="number" value={formData.duration_minutes} min={5}
                onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary">Create Service</button>
        </form>
      )}

      <div className="cards-grid">
        {services.map(s => (
          <div key={s.id} className={`card service-card ${selectedService?.id === s.id ? 'selected' : ''}`}
            onClick={() => viewService(s)}>
            <h3>{s.name}</h3>
            <p>{s.duration_minutes} min{s.location ? ` | ${s.location}` : ''}</p>
            <span className={`badge ${s.is_active ? 'badge-confirmed' : 'badge-inactive'}`}>
              {s.is_active ? 'Active' : 'Inactive'}
            </span>
            <div className="card-footer">
              <small>Booking link: /public/book/{s.public_token}</small>
            </div>
          </div>
        ))}
        {services.length === 0 && <p className="empty-text">No services created yet</p>}
      </div>

      {/* Availability Panel */}
      {selectedService && (
        <div className="card avail-panel">
          <h2>Availability: {selectedService.name}</h2>
          <div className="avail-list">
            {availSlots.map(slot => (
              <div key={slot.id} className="avail-item">
                <span>{DAY_NAMES[slot.day_of_week]}</span>
                <span>{slot.start_time} – {slot.end_time}</span>
                <button className="btn btn-sm btn-danger" onClick={() => removeSlot(slot.id)}>Remove</button>
              </div>
            ))}
            {availSlots.length === 0 && <p className="empty-text">No availability set</p>}
          </div>
          <div className="form-row avail-add">
            <select value={newSlot.day_of_week} onChange={e => setNewSlot({ ...newSlot, day_of_week: parseInt(e.target.value) })}>
              {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <input type="time" value={newSlot.start_time} onChange={e => setNewSlot({ ...newSlot, start_time: e.target.value })} />
            <input type="time" value={newSlot.end_time} onChange={e => setNewSlot({ ...newSlot, end_time: e.target.value })} />
            <button className="btn btn-primary btn-sm" onClick={addSlot}>Add Slot</button>
          </div>
        </div>
      )}
    </div>
  );
}

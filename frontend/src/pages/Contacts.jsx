import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

export default function Contacts() {
  const { workspace } = useWorkspace();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });

  useEffect(() => {
    if (!workspace?.id) return;
    api.get(`/contacts?workspace_id=${workspace.id}`)
      .then(res => setContacts(res.data.contacts))
      .finally(() => setLoading(false));
  }, [workspace]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/contacts', { ...formData, workspace_id: workspace.id });
      setShowForm(false);
      setFormData({ name: '', email: '', phone: '', notes: '' });
      const res = await api.get(`/contacts?workspace_id=${workspace.id}`);
      setContacts(res.data.contacts);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create contact');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    await api.delete(`/contacts/${id}`);
    setContacts(contacts.filter(c => c.id !== id));
  };

  if (loading) return <div className="page-loading">Loading contacts...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Contacts</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Contact'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={handleCreate}>
          <div className="form-group">
            <label>Name *</label>
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary">Add Contact</button>
        </form>
      )}

      <div className="table-responsive">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.email || '—'}</td>
                <td>{c.phone || '—'}</td>
                <td><span className="badge">{c.source || 'manual'}</span></td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan="6" className="empty-text">No contacts yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

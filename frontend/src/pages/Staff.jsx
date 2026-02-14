import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

export default function Staff() {
  const { workspace } = useWorkspace();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', perm_inbox: true, perm_bookings: true, perm_forms: true, perm_inventory: false
  });

  useEffect(() => {
    if (!workspace?.id) return;
    loadStaff();
  }, [workspace]);

  const loadStaff = async () => {
    const res = await api.get(`/staff?workspace_id=${workspace.id}`);
    setStaff(res.data.staff);
    setLoading(false);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await api.post('/staff/invite', { ...formData, workspace_id: workspace.id });
      setShowForm(false);
      setFormData({ name: '', email: '', perm_inbox: true, perm_bookings: true, perm_forms: true, perm_inventory: false });
      loadStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const updatePermission = async (userId, perm, value) => {
    await api.put(`/staff/${userId}/permissions`, { workspace_id: workspace.id, [perm]: value });
    loadStaff();
  };

  const removeStaff = async (userId) => {
    if (!window.confirm('Remove this staff member?')) return;
    await api.delete(`/staff/${userId}?workspace_id=${workspace.id}`);
    loadStaff();
  };

  if (loading) return <div className="page-loading">Loading staff...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Staff</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Invite Staff'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={handleInvite}>
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
            </div>
          </div>
          <div className="permissions-grid">
            <h4>Permissions</h4>
            <label className="checkbox-label">
              <input type="checkbox" checked={formData.perm_inbox}
                onChange={e => setFormData({ ...formData, perm_inbox: e.target.checked })} /> Inbox
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={formData.perm_bookings}
                onChange={e => setFormData({ ...formData, perm_bookings: e.target.checked })} /> Bookings
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={formData.perm_forms}
                onChange={e => setFormData({ ...formData, perm_forms: e.target.checked })} /> Forms
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={formData.perm_inventory}
                onChange={e => setFormData({ ...formData, perm_inventory: e.target.checked })} /> Inventory (read-only)
            </label>
          </div>
          <button type="submit" className="btn btn-primary">Send Invite</button>
        </form>
      )}

      <div className="table-responsive">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Inbox</th><th>Bookings</th><th>Forms</th><th>Inventory</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.email}</td>
                <td><span className="badge">{s.member_role}</span></td>
                <td>
                  <input type="checkbox" checked={s.perm_inbox} disabled={s.member_role === 'owner'}
                    onChange={e => updatePermission(s.id, 'perm_inbox', e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={s.perm_bookings} disabled={s.member_role === 'owner'}
                    onChange={e => updatePermission(s.id, 'perm_bookings', e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={s.perm_forms} disabled={s.member_role === 'owner'}
                    onChange={e => updatePermission(s.id, 'perm_forms', e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={s.perm_inventory} disabled={s.member_role === 'owner'}
                    onChange={e => updatePermission(s.id, 'perm_inventory', e.target.checked)} />
                </td>
                <td>
                  {s.member_role !== 'owner' && (
                    <button className="btn btn-sm btn-danger" onClick={() => removeStaff(s.id)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

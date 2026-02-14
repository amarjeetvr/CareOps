import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

export default function Forms() {
  const { workspace } = useWorkspace();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [formData, setFormData] = useState({ name: '', type: 'intake' });

  useEffect(() => {
    if (!workspace?.id) return;
    api.get(`/forms?workspace_id=${workspace.id}`)
      .then(res => setForms(res.data.forms))
      .finally(() => setLoading(false));
  }, [workspace]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/forms', {
        ...formData,
        workspace_id: workspace.id,
        fields: [
          { name: 'full_name', type: 'text', label: 'Full Name', required: true },
          { name: 'date_of_birth', type: 'date', label: 'Date of Birth', required: true },
          { name: 'notes', type: 'textarea', label: 'Additional Notes', required: false }
        ]
      });
      setShowForm(false);
      setFormData({ name: '', type: 'intake' });
      const res = await api.get(`/forms?workspace_id=${workspace.id}`);
      setForms(res.data.forms);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const viewSubmissions = async (form) => {
    setSelectedForm(form);
    const res = await api.get(`/forms/${form.id}/submissions`);
    setSubmissions(res.data.submissions);
  };

  if (loading) return <div className="page-loading">Loading forms...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Forms</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setSelectedForm(null); }}>
          {showForm ? 'Cancel' : '+ New Form'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={handleCreate}>
          <div className="form-group">
            <label>Form Name *</label>
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              <option value="intake">Intake Form</option>
              <option value="agreement">Agreement/Consent</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Create Form</button>
        </form>
      )}

      <div className="cards-grid">
        {forms.map(f => (
          <div key={f.id} className={`card ${selectedForm?.id === f.id ? 'selected' : ''}`}
            onClick={() => viewSubmissions(f)}>
            <h3>{f.name}</h3>
            <span className={`badge badge-${f.type}`}>{f.type}</span>
            <p>{Array.isArray(f.fields) ? f.fields.length : 0} fields</p>
          </div>
        ))}
        {forms.length === 0 && <p className="empty-text">No forms created yet</p>}
      </div>

      {/* Submissions */}
      {selectedForm && (
        <div className="card">
          <h2>Submissions: {selectedForm.name}</h2>
          {submissions.length === 0 ? <p className="empty-text">No submissions yet</p> : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr><th>Contact</th><th>Status</th><th>Submitted</th><th>Data</th></tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id}>
                      <td>{s.contact_name || '—'}</td>
                      <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                      <td>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : 'Pending'}</td>
                      <td><code>{JSON.stringify(s.data || {})}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

export default function PublicContactForm() {
  const { workspaceId } = useParams();
  const [wsInfo, setWsInfo] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/public/workspace/${workspaceId}/info`)
      .then(res => setWsInfo(res.data.workspace))
      .catch(() => setError('This workspace is not available'))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.email && !formData.phone) {
      setError('Please provide an email or phone number');
      return;
    }
    try {
      await api.post('/public/contact', { ...formData, workspace_id: parseInt(workspaceId) });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  if (loading) return <div className="public-page"><div className="public-loading">Loading...</div></div>;

  return (
    <div className="public-page">
      <div className="public-card">
        {wsInfo && <h1>{wsInfo.name}</h1>}
        {wsInfo?.address && <p className="public-address">{wsInfo.address}</p>}

        {submitted ? (
          <div className="public-success">
            <h2>Thank You!</h2>
            <p>We've received your information and will be in touch soon.</p>
          </div>
        ) : (
          <>
            <h2>Get in Touch</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Message (optional)</label>
                <textarea value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} rows={4} />
              </div>
              <button type="submit" className="btn btn-primary btn-block">Submit</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

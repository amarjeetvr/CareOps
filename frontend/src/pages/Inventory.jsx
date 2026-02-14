import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

export default function Inventory() {
  const { workspace } = useWorkspace();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', quantity: 0, low_stock_threshold: 5, usage_per_booking: 1 });
  const [editId, setEditId] = useState(null);
  const isUpdating = useRef(false);

  useEffect(() => {
    if (!workspace?.id) return;
    loadItems();
  }, [workspace]);

  const loadItems = async () => {
    const res = await api.get(`/inventory?workspace_id=${workspace.id}`);
    setItems(res.data.items);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory', { ...formData, workspace_id: workspace.id });
      setShowForm(false);
      setFormData({ name: '', quantity: 0, low_stock_threshold: 5, usage_per_booking: 1 });
      loadItems();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const handleUpdate = async (id, updates) => {
    if (isUpdating.current) return;
    isUpdating.current = true;
    try {
      await api.put(`/inventory/${id}`, updates);
      loadItems();
      setEditId(null);
    } finally {
      isUpdating.current = false;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    await api.delete(`/inventory/${id}`);
    loadItems();
  };

  if (loading) return <div className="page-loading">Loading inventory...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Inventory</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={handleCreate}>
          <div className="form-group">
            <label>Item Name *</label>
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" value={formData.quantity} min={0}
                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Low Stock Threshold</label>
              <input type="number" value={formData.low_stock_threshold} min={0}
                onChange={e => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Usage Per Booking</label>
              <input type="number" value={formData.usage_per_booking} min={0}
                onChange={e => setFormData({ ...formData, usage_per_booking: parseInt(e.target.value) })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Add Item</button>
        </form>
      )}

      <div className="table-responsive">
        <table>
          <thead>
            <tr><th>Item</th><th>Quantity</th><th>Threshold</th><th>Usage/Booking</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={item.quantity <= item.low_stock_threshold ? 'row-warning' : ''}>
                <td><strong>{item.name}</strong></td>
                <td>
                  {editId === item.id ? (
                    <input type="number" defaultValue={item.quantity} className="inline-input" min={0}
                      onBlur={e => handleUpdate(item.id, { quantity: parseInt(e.target.value) })}
                      onKeyDown={e => e.key === 'Enter' && handleUpdate(item.id, { quantity: parseInt(e.target.value) })}
                      autoFocus />
                  ) : (
                    <span onClick={() => setEditId(item.id)} className="editable">{item.quantity}</span>
                  )}
                </td>
                <td>{item.low_stock_threshold}</td>
                <td>{item.usage_per_booking}</td>
                <td>
                  {item.quantity <= item.low_stock_threshold ? (
                    <span className="badge badge-danger">Low Stock</span>
                  ) : (
                    <span className="badge badge-confirmed">OK</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="6" className="empty-text">No inventory items</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

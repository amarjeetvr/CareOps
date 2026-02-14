import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

export default function PublicBooking() {
  const { serviceToken } = useParams();
  const [serviceInfo, setServiceInfo] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', start_time: '', notes: '' });
  const [booked, setBooked] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState([]);

  useEffect(() => {
    api.get(`/public/book/${serviceToken}`)
      .then(res => {
        setServiceInfo(res.data);
        generateSlots(res.data);
      })
      .catch(() => setError('Service not found or unavailable'))
      .finally(() => setLoading(false));
  }, [serviceToken]);

  const generateSlots = (data) => {
    if (!data?.availability) return;
    const slots = [];
    const now = new Date();
    const bookedTimes = (data.existingBookings || []).map(b => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime()
    }));

    // Generate slots for next 14 days
    for (let d = 0; d < 14; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      const dayOfWeek = date.getDay();

      const dayAvail = data.availability.filter(a => a.day_of_week === dayOfWeek);
      for (const avail of dayAvail) {
        const [startH, startM] = avail.start_time.split(':').map(Number);
        const [endH, endM] = avail.end_time.split(':').map(Number);
        const duration = data.service.duration_minutes;

        let slotStart = new Date(date);
        slotStart.setHours(startH, startM, 0, 0);

        const dayEnd = new Date(date);
        dayEnd.setHours(endH, endM, 0, 0);

        while (slotStart.getTime() + duration * 60000 <= dayEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + duration * 60000);

          // Check if slot conflicts
          const isBooked = bookedTimes.some(b =>
            slotStart.getTime() < b.end && slotEnd.getTime() > b.start
          );

          if (!isBooked && slotStart.getTime() > now.getTime()) {
            slots.push({
              start: slotStart.toISOString(),
              label: `${slotStart.toLocaleDateString()} ${slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            });
          }

          slotStart = new Date(slotStart.getTime() + duration * 60000);
        }
      }
    }

    setAvailableSlots(slots);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/public/book', {
        service_token: serviceToken,
        ...formData
      });
      setBooked(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    }
  };

  if (loading) return <div className="public-page"><div className="public-loading">Loading...</div></div>;

  const svc = serviceInfo?.service;

  return (
    <div className="public-page">
      <div className="public-card public-card-wide">
        {error && !svc && <div className="alert alert-error">{error}</div>}

        {svc && !booked && (
          <>
            <h1>{svc.workspace_name}</h1>
            <h2>Book: {svc.name}</h2>
            <div className="service-details">
              <p><strong>Duration:</strong> {svc.duration_minutes} minutes</p>
              {svc.location && <p><strong>Location:</strong> {svc.location}</p>}
              {svc.description && <p>{svc.description}</p>}
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Your Name *</label>
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
                <label>Select a Time *</label>
                {availableSlots.length === 0 ? (
                  <p className="empty-text">No available slots in the next 14 days</p>
                ) : (
                  <div className="slots-grid">
                    {availableSlots.slice(0, 28).map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`slot-btn ${formData.start_time === slot.start ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, start_time: slot.start })}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3} />
              </div>

              <button type="submit" className="btn btn-primary btn-block"
                disabled={!formData.start_time || !formData.name}>
                Confirm Booking
              </button>
            </form>
          </>
        )}

        {booked && (
          <div className="public-success">
            <h2>Booking Confirmed!</h2>
            <p>Your appointment has been scheduled.</p>
            <div className="booking-summary">
              <p><strong>When:</strong> {new Date(booked.booking.start_time).toLocaleString()}</p>
              <p><strong>Confirmation ID:</strong> {booked.booking.token}</p>
            </div>
            {booked.formTokens?.length > 0 && (
              <div className="form-links">
                <h3>Please Complete These Forms</h3>
                {booked.formTokens.map((token, i) => (
                  <a key={i} href={`/public/form/${token}`} className="btn btn-secondary btn-block">
                    Complete Form {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

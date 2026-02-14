import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

const STEPS = [
  { num: 1, title: 'Create Workspace', desc: 'Business name, address, timezone' },
  { num: 2, title: 'Communication', desc: 'Connect email or SMS' },
  { num: 3, title: 'Contact Form', desc: 'Your public contact page is ready' },
  { num: 4, title: 'Booking Setup', desc: 'Services, duration, availability' },
  { num: 5, title: 'Forms', desc: 'Intake & agreement forms' },
  { num: 6, title: 'Inventory', desc: 'Resources & stock tracking' },
  { num: 7, title: 'Staff', desc: 'Invite team members' },
  { num: 8, title: 'Activate', desc: 'Launch your workspace' },
];

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const { workspace, setWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  // Step 1 state
  const [wsName, setWsName] = useState('');
  const [wsAddress, setWsAddress] = useState('');
  const [wsTimezone, setWsTimezone] = useState('America/New_York');
  const [wsEmail, setWsEmail] = useState('');

  // Step 2 state
  const [commType, setCommType] = useState('email');

  // Step 4 state
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState(60);
  const [serviceLocation, setServiceLocation] = useState('');
  const [availSlots, setAvailSlots] = useState([{ day: 1, start: '09:00', end: '17:00' }]);

  // Step 5 state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('intake');

  // Step 6 state
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState(10);
  const [itemThreshold, setItemThreshold] = useState(5);

  // Step 7 state
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');

  useEffect(() => {
    if (workspace) {
      setStep(workspace.onboarding_step || 1);
      setWsName(workspace.name || '');
      fetchOnboardingStatus();
    }
  }, [workspace]);

  const fetchOnboardingStatus = async () => {
    if (!workspace?.id) return;
    try {
      const res = await api.get(`/onboarding/status?workspace_id=${workspace.id}`);
      setOnboardingStatus(res.data.onboarding);
    } catch (err) { /* ignore */ }
  };

  const goToStep = async (s, wsId) => {
    setStep(s);
    setError('');
    const id = wsId || workspace?.id;
    if (id) {
      await api.post('/onboarding/step', { workspace_id: id, step: s }).catch(() => {});
    }
  };

  // Step 1: Create Workspace
  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/workspace', {
        name: wsName, address: wsAddress, timezone: wsTimezone, contact_email: wsEmail || user.email
      });
      setWorkspace(res.data.workspace);
      updateUser({ ...user, workspace_id: res.data.workspace.id });
      goToStep(2, res.data.workspace.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Communication Setup
  const handleSetupComm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/onboarding/communication', {
        workspace_id: workspace.id,
        type: commType,
        config: commType === 'email' ? { provider: 'mock' } : { provider: 'mock' }
      });
      goToStep(3);
      fetchOnboardingStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to setup communication');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Service + Availability
  const handleSetupService = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const sRes = await api.post('/services', {
        name: serviceName, duration_minutes: serviceDuration,
        location: serviceLocation, workspace_id: workspace.id
      });
      const serviceId = sRes.data.service.id;

      for (const slot of availSlots) {
        await api.post(`/services/${serviceId}/availability`, {
          day_of_week: slot.day, start_time: slot.start, end_time: slot.end
        });
      }
      goToStep(5);
      fetchOnboardingStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Forms
  const handleSetupForm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/forms', {
        name: formName, type: formType,
        fields: [
          { name: 'full_name', type: 'text', label: 'Full Name', required: true },
          { name: 'dob', type: 'date', label: 'Date of Birth', required: true },
          { name: 'notes', type: 'textarea', label: 'Additional Notes', required: false }
        ],
        workspace_id: workspace.id
      });
      goToStep(6);
      fetchOnboardingStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create form');
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Inventory
  const handleSetupInventory = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/inventory', {
        name: itemName, quantity: itemQty,
        low_stock_threshold: itemThreshold,
        usage_per_booking: 1,
        workspace_id: workspace.id
      });
      goToStep(7);
      fetchOnboardingStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  // Step 7: Staff
  const handleInviteStaff = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/staff/invite', {
        name: staffName, email: staffEmail, workspace_id: workspace.id
      });
      goToStep(8);
      fetchOnboardingStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to invite staff');
    } finally {
      setLoading(false);
    }
  };

  // Step 8: Activate
  const handleActivate = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/onboarding/activate', { workspace_id: workspace.id });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot activate workspace');
    } finally {
      setLoading(false);
    }
  };

  const addAvailSlot = () => setAvailSlots([...availSlots, { day: 1, start: '09:00', end: '17:00' }]);
  const updateSlot = (i, field, val) => {
    const slots = [...availSlots];
    slots[i][field] = field === 'day' ? parseInt(val) : val;
    setAvailSlots(slots);
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <h1>Setup Your Workspace</h1>

        {/* Step indicator */}
        <div className="step-indicator">
          {STEPS.map(s => (
            <div
              key={s.num}
              className={`step-dot ${step === s.num ? 'active' : ''} ${
                onboardingStatus?.steps?.[s.num]?.complete ? 'complete' : ''
              }`}
              onClick={() => (s.num === 1 || workspace) && goToStep(s.num)}
              title={s.title}
            >
              {onboardingStatus?.steps?.[s.num]?.complete ? '✓' : s.num}
            </div>
          ))}
        </div>

        <div className="step-title">
          <h2>Step {step}: {STEPS[step - 1]?.title}</h2>
          <p>{STEPS[step - 1]?.desc}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Step 1: Create Workspace */}
        {step === 1 && (
          <form onSubmit={handleCreateWorkspace} className="onboarding-form">
            <div className="form-group">
              <label>Business Name *</label>
              <input value={wsName} onChange={e => setWsName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input value={wsAddress} onChange={e => setWsAddress(e.target.value)} placeholder="123 Main St, City, State" />
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <select value={wsTimezone} onChange={e => setWsTimezone(e.target.value)}>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>
            <div className="form-group">
              <label>Contact Email</label>
              <input type="email" value={wsEmail} onChange={e => setWsEmail(e.target.value)} placeholder={user?.email} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </form>
        )}

        {/* Step 2: Communication */}
        {step === 2 && (
          <form onSubmit={handleSetupComm} className="onboarding-form">
            <p>Connect at least one communication channel. (Using mock providers for demo)</p>
            <div className="form-group">
              <label>Channel Type</label>
              <select value={commType} onChange={e => setCommType(e.target.value)}>
                <option value="email">Email (Mock)</option>
                <option value="sms">SMS (Mock)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Setting up...' : 'Connect Channel'}
            </button>
          </form>
        )}

        {/* Step 3: Contact Form Info */}
        {step === 3 && (
          <div className="onboarding-form">
            <div className="info-box">
              <h3>Your Public Contact Form is Ready!</h3>
              <p>Share this link with potential clients:</p>
              <div className="link-box">
                <code>{window.location.origin}/public/contact/{workspace?.id}</code>
              </div>
              <p>When someone submits this form:</p>
              <ul>
                <li>A new Contact is created</li>
                <li>A Conversation is started in your Inbox</li>
                <li>A Welcome Message is sent automatically</li>
              </ul>
            </div>
            <button className="btn btn-primary" onClick={() => goToStep(4)}>Continue</button>
          </div>
        )}

        {/* Step 4: Service + Availability */}
        {step === 4 && (
          <form onSubmit={handleSetupService} className="onboarding-form">
            <div className="form-group">
              <label>Service Name *</label>
              <input value={serviceName} onChange={e => setServiceName(e.target.value)} required placeholder="e.g., Initial Consultation" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input type="number" value={serviceDuration} onChange={e => setServiceDuration(parseInt(e.target.value))} min={5} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input value={serviceLocation} onChange={e => setServiceLocation(e.target.value)} placeholder="Office / Virtual" />
              </div>
            </div>
            <h3>Availability Slots</h3>
            {availSlots.map((slot, i) => (
              <div key={i} className="form-row avail-row">
                <select value={slot.day} onChange={e => updateSlot(i, 'day', e.target.value)}>
                  {dayNames.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                </select>
                <input type="time" value={slot.start} onChange={e => updateSlot(i, 'start', e.target.value)} />
                <input type="time" value={slot.end} onChange={e => updateSlot(i, 'end', e.target.value)} />
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addAvailSlot}>+ Add Slot</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Service'}
            </button>
          </form>
        )}

        {/* Step 5: Forms */}
        {step === 5 && (
          <form onSubmit={handleSetupForm} className="onboarding-form">
            <p>Create intake or agreement forms that clients complete after booking.</p>
            <div className="form-group">
              <label>Form Name *</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} required placeholder="e.g., Patient Intake Form" />
            </div>
            <div className="form-group">
              <label>Form Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)}>
                <option value="intake">Intake Form</option>
                <option value="agreement">Agreement/Consent</option>
              </select>
            </div>
            <div className="form-row">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Form'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => goToStep(6)}>Skip</button>
            </div>
          </form>
        )}

        {/* Step 6: Inventory */}
        {step === 6 && (
          <form onSubmit={handleSetupInventory} className="onboarding-form">
            <p>Track supplies and resources used per booking.</p>
            <div className="form-group">
              <label>Item Name *</label>
              <input value={itemName} onChange={e => setItemName(e.target.value)} required placeholder="e.g., Face Masks" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input type="number" value={itemQty} onChange={e => setItemQty(parseInt(e.target.value))} min={0} />
              </div>
              <div className="form-group">
                <label>Low Stock Threshold</label>
                <input type="number" value={itemThreshold} onChange={e => setItemThreshold(parseInt(e.target.value))} min={0} />
              </div>
            </div>
            <div className="form-row">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Adding...' : 'Add Item'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => goToStep(7)}>Skip</button>
            </div>
          </form>
        )}

        {/* Step 7: Staff */}
        {step === 7 && (
          <form onSubmit={handleInviteStaff} className="onboarding-form">
            <p>Invite team members with specific permissions.</p>
            <div className="form-group">
              <label>Staff Name *</label>
              <input value={staffName} onChange={e => setStaffName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Staff Email *</label>
              <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} required />
            </div>
            <div className="form-row">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Inviting...' : 'Invite Staff'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => goToStep(8)}>Skip</button>
            </div>
          </form>
        )}

        {/* Step 8: Activate */}
        {step === 8 && (
          <div className="onboarding-form">
            <div className="info-box">
              <h3>Ready to Launch?</h3>
              <p>Activation will:</p>
              <ul>
                <li>Enable all automation rules</li>
                <li>Make your booking pages public</li>
                <li>Start sending welcome & reminder messages</li>
              </ul>
              {onboardingStatus && !onboardingStatus.canActivate && (
                <div className="alert alert-error">
                  Missing requirements: You need at least one communication channel and one service with availability.
                </div>
              )}
            </div>
            <button className="btn btn-primary btn-lg" onClick={handleActivate}
              disabled={loading || (onboardingStatus && !onboardingStatus.canActivate)}>
              {loading ? 'Activating...' : 'Activate Workspace'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

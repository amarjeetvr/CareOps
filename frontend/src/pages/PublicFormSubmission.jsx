import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

export default function PublicFormSubmission() {
  const { submissionToken } = useParams();
  const [formInfo, setFormInfo] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/public/form/${submissionToken}`)
      .then(res => {
        if (res.data.completed) {
          setSubmitted(true);
        } else {
          setFormInfo(res.data.form);
          // Initialize form values
          const initial = {};
          (res.data.form.fields || []).forEach(f => { initial[f.name] = ''; });
          setFormValues(initial);
        }
      })
      .catch(() => setError('Form not found'))
      .finally(() => setLoading(false));
  }, [submissionToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/public/form/${submissionToken}`, { data: formValues });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
    }
  };

  if (loading) return <div className="public-page"><div className="public-loading">Loading...</div></div>;

  return (
    <div className="public-page">
      <div className="public-card">
        {submitted ? (
          <div className="public-success">
            <h2>Form Submitted!</h2>
            <p>Thank you for completing the form.</p>
          </div>
        ) : formInfo ? (
          <>
            <h2>{formInfo.name}</h2>
            <span className="badge">{formInfo.type}</span>
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              {(formInfo.fields || []).map(field => (
                <div key={field.name} className="form-group">
                  <label>{field.label} {field.required && '*'}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formValues[field.name] || ''}
                      onChange={e => setFormValues({ ...formValues, [field.name]: e.target.value })}
                      required={field.required}
                      rows={4}
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={formValues[field.name] || ''}
                      onChange={e => setFormValues({ ...formValues, [field.name]: e.target.value })}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
              <button type="submit" className="btn btn-primary btn-block">Submit Form</button>
            </form>
          </>
        ) : (
          <div className="alert alert-error">{error || 'Form not found'}</div>
        )}
      </div>
    </div>
  );
}

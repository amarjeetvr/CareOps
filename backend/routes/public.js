/**
 * Public Routes - No authentication required
 * These are customer-facing endpoints (customers never log in)
 *
 * - Public contact form
 * - Public booking page
 * - Public form submission
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { onContactCreated, onBookingCreated } = require('../services/automation');

// ─── PUBLIC CONTACT FORM ───

// GET /api/public/workspace/:workspaceId/info
router.get('/workspace/:workspaceId/info', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, address, timezone, contact_email FROM workspaces WHERE id = $1 AND status = $2',
      [req.params.workspaceId, 'active']
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Workspace not found' });
    res.json({ success: true, workspace: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/public/contact — Submit contact form (no auth)
router.post('/contact', [
  body('name').notEmpty().withMessage('Name is required'),
  body('workspace_id').isInt().withMessage('Workspace ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, phone, message, workspace_id } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Email or phone is required' });
    }

    // Check workspace is active
    const ws = await pool.query('SELECT status FROM workspaces WHERE id = $1', [workspace_id]);
    if (ws.rows.length === 0 || ws.rows[0].status !== 'active') {
      return res.status(400).json({ success: false, message: 'This workspace is not accepting contacts' });
    }

    // Create contact
    const contactResult = await pool.query(
      `INSERT INTO contacts (name, email, phone, notes, workspace_id, source)
       VALUES ($1, $2, $3, $4, $5, 'contact_form') RETURNING *`,
      [name, email || null, phone || null, message || null, workspace_id]
    );
    const contact = contactResult.rows[0];

    // Create conversation
    const convResult = await pool.query(
      'INSERT INTO conversations (workspace_id, contact_id) VALUES ($1, $2) RETURNING id',
      [workspace_id, contact.id]
    );

    // If there's a message, add it as inbound
    if (message) {
      await pool.query(
        `INSERT INTO messages (conversation_id, direction, channel, body, sender_type)
         VALUES ($1, 'inbound', 'system', $2, 'contact')`,
        [convResult.rows[0].id, message]
      );
    }

    // Trigger automation: welcome message
    onContactCreated(workspace_id, contact.id).catch(err => {
      console.error('[PUBLIC] Welcome message automation failed:', err.message);
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! We will be in touch soon.',
      contact: { id: contact.id, name: contact.name }
    });
  } catch (err) { next(err); }
});

// ─── PUBLIC BOOKING PAGE ───

// GET /api/public/book/:serviceToken — Get service info + availability
router.get('/book/:serviceToken', async (req, res, next) => {
  try {
    const serviceResult = await pool.query(
      `SELECT s.*, w.name as workspace_name, w.address as workspace_address, w.timezone
       FROM services s
       JOIN workspaces w ON s.workspace_id = w.id
       WHERE s.public_token = $1 AND s.is_active = true AND w.status = 'active'`,
      [req.params.serviceToken]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const service = serviceResult.rows[0];

    // Get availability
    const availResult = await pool.query(
      'SELECT * FROM availability WHERE service_id = $1 ORDER BY day_of_week, start_time',
      [service.id]
    );

    // Get existing bookings for next 30 days (to show unavailable slots)
    const existingBookings = await pool.query(
      `SELECT start_time, end_time FROM bookings
       WHERE service_id = $1 AND status = 'confirmed'
       AND start_time >= NOW() AND start_time <= NOW() + INTERVAL '30 days'`,
      [service.id]
    );

    // Get linked forms
    const formsResult = await pool.query(
      `SELECT f.id, f.name, f.type, f.fields FROM forms f
       JOIN form_service_links fsl ON f.id = fsl.form_id
       WHERE fsl.service_id = $1 AND f.is_active = true`,
      [service.id]
    );

    res.json({
      success: true,
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
        duration_minutes: service.duration_minutes,
        location: service.location,
        workspace_name: service.workspace_name,
        workspace_address: service.workspace_address,
        timezone: service.timezone
      },
      availability: availResult.rows,
      existingBookings: existingBookings.rows.map(b => ({
        start: b.start_time,
        end: b.end_time
      })),
      forms: formsResult.rows
    });
  } catch (err) { next(err); }
});

// POST /api/public/book — Create a booking (no auth)
router.post('/book', [
  body('service_token').notEmpty(),
  body('name').notEmpty(),
  body('start_time').isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { service_token, name, email, phone, start_time, notes } = req.body;

    // Get service
    const serviceResult = await pool.query(
      'SELECT * FROM services WHERE public_token = $1 AND is_active = true',
      [service_token]
    );
    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    const service = serviceResult.rows[0];

    // Calculate end time
    const startDate = new Date(start_time);
    const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);

    // Create or find contact
    let contactId;
    if (email) {
      const existing = await pool.query(
        'SELECT id FROM contacts WHERE email = $1 AND workspace_id = $2',
        [email, service.workspace_id]
      );
      if (existing.rows.length > 0) {
        contactId = existing.rows[0].id;
      }
    }

    if (!contactId) {
      const newContact = await pool.query(
        `INSERT INTO contacts (name, email, phone, notes, workspace_id, source)
         VALUES ($1, $2, $3, $4, $5, 'booking') RETURNING id`,
        [name, email || null, phone || null, notes || null, service.workspace_id]
      );
      contactId = newContact.rows[0].id;

      // Trigger welcome for new contact
      onContactCreated(service.workspace_id, contactId).catch(err => {
        console.error('[PUBLIC] Welcome automation failed:', err.message);
      });
    }

    // Create booking
    const bookingResult = await pool.query(
      `INSERT INTO bookings (workspace_id, service_id, contact_id, title, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed') RETURNING *`,
      [service.workspace_id, service.id, contactId, `${service.name} - ${name}`, startDate.toISOString(), endDate.toISOString()]
    );
    const booking = bookingResult.rows[0];

    // Create form submissions for linked forms
    const linkedForms = await pool.query(
      'SELECT form_id FROM form_service_links WHERE service_id = $1',
      [service.id]
    );
    const formTokens = [];
    for (const link of linkedForms.rows) {
      const fsResult = await pool.query(
        `INSERT INTO form_submissions (form_id, booking_id, contact_id, status)
         VALUES ($1, $2, $3, 'pending') RETURNING submission_token`,
        [link.form_id, booking.id, contactId]
      );
      formTokens.push(fsResult.rows[0].submission_token);
    }

    // Deduct inventory usage
    const inventoryItems = await pool.query(
      'SELECT * FROM inventory_items WHERE workspace_id = $1 AND usage_per_booking > 0',
      [service.workspace_id]
    );
    for (const item of inventoryItems.rows) {
      await pool.query(
        'UPDATE inventory_items SET quantity = GREATEST(0, quantity - $1), alert_sent = false, updated_at = NOW() WHERE id = $2',
        [item.usage_per_booking, item.id]
      );
    }

    // Trigger booking confirmation automation
    onBookingCreated(service.workspace_id, booking.id).catch(err => {
      console.error('[PUBLIC] Booking confirmation automation failed:', err.message);
    });

    res.status(201).json({
      success: true,
      message: 'Booking confirmed!',
      booking: {
        id: booking.id,
        token: booking.booking_token,
        start_time: booking.start_time,
        end_time: booking.end_time
      },
      formTokens
    });
  } catch (err) { next(err); }
});

// ─── PUBLIC FORM SUBMISSION ───

// GET /api/public/form/:submissionToken — Get form for filling
router.get('/form/:submissionToken', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT fs.*, f.name as form_name, f.fields, f.type as form_type
       FROM form_submissions fs
       JOIN forms f ON fs.form_id = f.id
       WHERE fs.submission_token = $1`,
      [req.params.submissionToken]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Form not found' });

    const submission = result.rows[0];
    if (submission.status === 'completed') {
      return res.json({ success: true, message: 'This form has already been submitted', completed: true });
    }

    res.json({
      success: true,
      form: {
        name: submission.form_name,
        type: submission.form_type,
        fields: submission.fields,
        submission_token: submission.submission_token
      }
    });
  } catch (err) { next(err); }
});

// POST /api/public/form/:submissionToken — Submit a form
router.post('/form/:submissionToken', async (req, res, next) => {
  try {
    const { data } = req.body;

    const result = await pool.query(
      `UPDATE form_submissions SET data = $1, status = 'completed', submitted_at = NOW()
       WHERE submission_token = $2 AND status = 'pending' RETURNING *`,
      [JSON.stringify(data || {}), req.params.submissionToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Form not found or already submitted' });
    }

    res.json({ success: true, message: 'Form submitted successfully!' });
  } catch (err) { next(err); }
});

module.exports = router;

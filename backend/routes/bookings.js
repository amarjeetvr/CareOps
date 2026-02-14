const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { onBookingCreated } = require('../services/automation');

// POST /api/bookings
router.post(
  '/',
  auth,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('workspace_id').isInt().withMessage('Workspace ID is required'),
    body('start_time').isISO8601().withMessage('Valid start_time is required'),
    body('end_time').isISO8601().withMessage('Valid end_time is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { title, description, contact_id, workspace_id, service_id, start_time, end_time, status } = req.body;

      const result = await pool.query(
        `INSERT INTO bookings (title, description, contact_id, workspace_id, service_id, booked_by, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [title, description || null, contact_id || null, workspace_id, service_id || null, req.user.id, start_time, end_time, status || 'confirmed']
      );

      const booking = result.rows[0];

      // Trigger automation: booking confirmation
      onBookingCreated(workspace_id, booking.id).catch(err => {
        console.error('[BOOKINGS] Confirmation automation failed:', err.message);
      });

      res.status(201).json({ success: true, booking });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/bookings?workspace_id=
router.get('/', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) {
      return res.status(400).json({ success: false, message: 'workspace_id query param required' });
    }

    const result = await pool.query(
      `SELECT b.*, c.name as contact_name, u.name as booked_by_name
       FROM bookings b
       LEFT JOIN contacts c ON b.contact_id = c.id
       LEFT JOIN users u ON b.booked_by = u.id
       WHERE b.workspace_id = $1
       ORDER BY b.start_time DESC`,
      [workspace_id]
    );
    res.json({ success: true, bookings: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT b.*, c.name as contact_name, u.name as booked_by_name
       FROM bookings b
       LEFT JOIN contacts c ON b.contact_id = c.id
       LEFT JOIN users u ON b.booked_by = u.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, booking: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/bookings/:id
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { title, description, contact_id, start_time, end_time, status } = req.body;
    const result = await pool.query(
      `UPDATE bookings SET 
        title = COALESCE($1, title), description = COALESCE($2, description),
        contact_id = COALESCE($3, contact_id), start_time = COALESCE($4, start_time),
        end_time = COALESCE($5, end_time), status = COALESCE($6, status), updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, description, contact_id, start_time, end_time, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, booking: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

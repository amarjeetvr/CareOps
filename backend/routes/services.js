const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/services?workspace_id=
router.get('/', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ success: false, message: 'workspace_id required' });

    const result = await pool.query(
      'SELECT * FROM services WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspace_id]
    );
    res.json({ success: true, services: result.rows });
  } catch (err) { next(err); }
});

// GET /api/services/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT s.*, json_agg(json_build_object('id', a.id, 'day_of_week', a.day_of_week, 'start_time', a.start_time, 'end_time', a.end_time))
        FILTER (WHERE a.id IS NOT NULL) as availability
       FROM services s
       LEFT JOIN availability a ON s.id = a.service_id
       WHERE s.id = $1
       GROUP BY s.id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, service: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/services
router.post('/', auth, [
  body('name').notEmpty().withMessage('Service name is required'),
  body('workspace_id').isInt().withMessage('Workspace ID is required'),
  body('duration_minutes').isInt({ min: 5 }).withMessage('Duration must be at least 5 minutes')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, description, duration_minutes, location, workspace_id } = req.body;

    const result = await pool.query(
      `INSERT INTO services (name, description, duration_minutes, location, workspace_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description || null, duration_minutes, location || null, workspace_id]
    );

    res.status(201).json({ success: true, service: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/services/:id
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { name, description, duration_minutes, location, is_active } = req.body;
    const result = await pool.query(
      `UPDATE services SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        duration_minutes = COALESCE($3, duration_minutes), location = COALESCE($4, location),
        is_active = COALESCE($5, is_active), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, description, duration_minutes, location, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, service: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/services/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM services WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, message: 'Service deleted' });
  } catch (err) { next(err); }
});

// ─── AVAILABILITY ───

// POST /api/services/:id/availability
router.post('/:id/availability', auth, [
  body('day_of_week').isInt({ min: 0, max: 6 }),
  body('start_time').notEmpty(),
  body('end_time').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { day_of_week, start_time, end_time } = req.body;
    const result = await pool.query(
      'INSERT INTO availability (service_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, day_of_week, start_time, end_time]
    );
    res.status(201).json({ success: true, availability: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/services/:id/availability
router.get('/:id/availability', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM availability WHERE service_id = $1 ORDER BY day_of_week, start_time',
      [req.params.id]
    );
    res.json({ success: true, availability: result.rows });
  } catch (err) { next(err); }
});

// DELETE /api/services/availability/:availId
router.delete('/availability/:availId', auth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM availability WHERE id = $1', [req.params.availId]);
    res.json({ success: true, message: 'Availability slot deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/forms?workspace_id=
router.get('/', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ success: false, message: 'workspace_id required' });

    const result = await pool.query(
      'SELECT * FROM forms WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspace_id]
    );
    res.json({ success: true, forms: result.rows });
  } catch (err) { next(err); }
});

// GET /api/forms/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM forms WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Form not found' });

    // Get linked services
    const links = await pool.query(
      `SELECT s.id, s.name FROM form_service_links fsl
       JOIN services s ON fsl.service_id = s.id WHERE fsl.form_id = $1`,
      [req.params.id]
    );

    res.json({ success: true, form: { ...result.rows[0], linked_services: links.rows } });
  } catch (err) { next(err); }
});

// POST /api/forms
router.post('/', auth, [
  body('name').notEmpty().withMessage('Form name is required'),
  body('workspace_id').isInt().withMessage('Workspace ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, type, fields, workspace_id, linked_service_ids } = req.body;

    const result = await pool.query(
      'INSERT INTO forms (name, type, fields, workspace_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, type || 'intake', JSON.stringify(fields || []), workspace_id]
    );

    const form = result.rows[0];

    // Link to services
    if (linked_service_ids && linked_service_ids.length > 0) {
      for (const sid of linked_service_ids) {
        await pool.query(
          'INSERT INTO form_service_links (form_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [form.id, sid]
        );
      }
    }

    res.status(201).json({ success: true, form });
  } catch (err) { next(err); }
});

// PUT /api/forms/:id
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { name, type, fields, is_active, linked_service_ids } = req.body;
    const result = await pool.query(
      `UPDATE forms SET
        name = COALESCE($1, name), type = COALESCE($2, type),
        fields = COALESCE($3, fields), is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, type, fields ? JSON.stringify(fields) : null, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Form not found' });

    // Update service links
    if (linked_service_ids) {
      await pool.query('DELETE FROM form_service_links WHERE form_id = $1', [req.params.id]);
      for (const sid of linked_service_ids) {
        await pool.query(
          'INSERT INTO form_service_links (form_id, service_id) VALUES ($1, $2)',
          [req.params.id, sid]
        );
      }
    }

    res.json({ success: true, form: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/forms/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM forms WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Form not found' });
    res.json({ success: true, message: 'Form deleted' });
  } catch (err) { next(err); }
});

// ─── FORM SUBMISSIONS ───

// GET /api/forms/:id/submissions
router.get('/:id/submissions', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT fs.*, c.name as contact_name FROM form_submissions fs
       LEFT JOIN contacts c ON fs.contact_id = c.id
       WHERE fs.form_id = $1 ORDER BY fs.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, submissions: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;

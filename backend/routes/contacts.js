const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { onContactCreated } = require('../services/automation');

// POST /api/contacts
router.post(
  '/',
  auth,
  [
    body('name').notEmpty().withMessage('Contact name is required'),
    body('workspace_id').isInt().withMessage('Workspace ID is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, email, phone, address, notes, workspace_id } = req.body;

      const result = await pool.query(
        'INSERT INTO contacts (name, email, phone, address, notes, workspace_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [name, email || null, phone || null, address || null, notes || null, workspace_id, req.user.id]
      );

      const contact = result.rows[0];

      // Trigger automation: welcome message
      onContactCreated(workspace_id, contact.id).catch(err => {
        console.error('[CONTACTS] Welcome automation failed:', err.message);
      });

      res.status(201).json({ success: true, contact });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/contacts?workspace_id=
router.get('/', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) {
      return res.status(400).json({ success: false, message: 'workspace_id query param required' });
    }

    const result = await pool.query(
      'SELECT * FROM contacts WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspace_id]
    );
    res.json({ success: true, contacts: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/contacts/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.json({ success: true, contact: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/contacts/:id
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { name, email, phone, address, notes } = req.body;
    const result = await pool.query(
      `UPDATE contacts SET 
        name = COALESCE($1, name), email = COALESCE($2, email), 
        phone = COALESCE($3, phone), address = COALESCE($4, address), 
        notes = COALESCE($5, notes), updated_at = NOW() 
       WHERE id = $6 RETURNING *`,
      [name, email, phone, address, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.json({ success: true, contact: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

// POST /api/workspace - Create workspace
router.post(
  '/',
  auth,
  [body('name').notEmpty().withMessage('Workspace name is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, address, timezone, contact_email } = req.body;

      const result = await pool.query(
        'INSERT INTO workspaces (name, address, timezone, contact_email, owner_id, status, onboarding_step) VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *',
        [name, address || null, timezone || 'America/New_York', contact_email || req.user.email, req.user.id, 'inactive']
      );

      // Update the user's workspace_id
      await pool.query('UPDATE users SET workspace_id = $1 WHERE id = $2', [result.rows[0].id, req.user.id]);

      // Add owner as a member
      await pool.query(
        'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
        [result.rows[0].id, req.user.id, 'owner']
      );

      res.status(201).json({ success: true, workspace: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/workspace - Get all workspaces for user
router.get('/', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT w.*, wm.role as member_role 
       FROM workspaces w 
       JOIN workspace_members wm ON w.id = wm.workspace_id 
       WHERE wm.user_id = $1 
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, workspaces: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/workspace/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT w.*, wm.role as member_role 
       FROM workspaces w 
       JOIN workspace_members wm ON w.id = wm.workspace_id 
       WHERE w.id = $1 AND wm.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    res.json({ success: true, workspace: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/workspace/:id
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { name, address, timezone, contact_email } = req.body;

    const result = await pool.query(
      `UPDATE workspaces SET
        name = COALESCE($1, name), address = COALESCE($2, address),
        timezone = COALESCE($3, timezone), contact_email = COALESCE($4, contact_email),
        updated_at = NOW()
       WHERE id = $5 AND owner_id = $6 RETURNING *`,
      [name, address, timezone, contact_email, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workspace not found or not authorized' });
    }

    res.json({ success: true, workspace: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/workspace/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM workspaces WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workspace not found or not authorized' });
    }

    res.json({ success: true, message: 'Workspace deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

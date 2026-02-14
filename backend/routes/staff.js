const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/staff?workspace_id=
router.get('/', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ success: false, message: 'workspace_id required' });

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, wm.perm_inbox, wm.perm_bookings,
              wm.perm_forms, wm.perm_inventory, wm.role as member_role, wm.joined_at
       FROM workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = $1
       ORDER BY wm.joined_at ASC`,
      [workspace_id]
    );
    res.json({ success: true, staff: result.rows });
  } catch (err) { next(err); }
});

// POST /api/staff/invite — Invite staff to workspace
router.post('/invite', auth, [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('workspace_id').isInt().withMessage('Workspace ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, workspace_id, perm_inbox, perm_bookings, perm_forms, perm_inventory } = req.body;

    // Check if user already exists
    let userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;

    if (userResult.rows.length === 0) {
      // Create user with temp password
      const tempPassword = Math.random().toString(36).slice(-8);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(tempPassword, salt);

      const newUser = await pool.query(
        'INSERT INTO users (name, email, password, role, workspace_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [name, email, hashedPassword, 'staff', workspace_id]
      );
      userId = newUser.rows[0].id;
      // In production, send temp password via email notification
      console.log(`[STAFF] Created user ${email} — temp password generated (not logged for security)`);
    } else {
      userId = userResult.rows[0].id;
    }

    // Add to workspace
    await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, perm_inbox, perm_bookings, perm_forms, perm_inventory)
       VALUES ($1, $2, 'staff', $3, $4, $5, $6)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET
         perm_inbox = $3, perm_bookings = $4, perm_forms = $5, perm_inventory = $6`,
      [workspace_id, userId, perm_inbox !== false, perm_bookings !== false, perm_forms !== false, perm_inventory === true]
    );

    res.status(201).json({ success: true, message: 'Staff invited', userId });
  } catch (err) { next(err); }
});

// PUT /api/staff/:userId/permissions
router.put('/:userId/permissions', auth, async (req, res, next) => {
  try {
    const { workspace_id, perm_inbox, perm_bookings, perm_forms, perm_inventory } = req.body;
    const result = await pool.query(
      `UPDATE workspace_members SET
        perm_inbox = COALESCE($1, perm_inbox),
        perm_bookings = COALESCE($2, perm_bookings),
        perm_forms = COALESCE($3, perm_forms),
        perm_inventory = COALESCE($4, perm_inventory)
       WHERE workspace_id = $5 AND user_id = $6 RETURNING *`,
      [perm_inbox, perm_bookings, perm_forms, perm_inventory, workspace_id, req.params.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, member: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/staff/:userId?workspace_id=
router.delete('/:userId', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    await pool.query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspace_id, req.params.userId]
    );
    res.json({ success: true, message: 'Staff removed from workspace' });
  } catch (err) { next(err); }
});

module.exports = router;

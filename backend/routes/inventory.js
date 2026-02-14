const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/inventory?workspace_id=
router.get('/', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ success: false, message: 'workspace_id required' });

    const result = await pool.query(
      'SELECT * FROM inventory_items WHERE workspace_id = $1 ORDER BY name ASC',
      [workspace_id]
    );
    res.json({ success: true, items: result.rows });
  } catch (err) { next(err); }
});

// POST /api/inventory
router.post('/', auth, [
  body('name').notEmpty().withMessage('Item name is required'),
  body('workspace_id').isInt().withMessage('Workspace ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, description, quantity, low_stock_threshold, usage_per_booking, workspace_id } = req.body;

    const result = await pool.query(
      `INSERT INTO inventory_items (name, description, quantity, low_stock_threshold, usage_per_booking, workspace_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || null, quantity || 0, low_stock_threshold || 5, usage_per_booking || 0, workspace_id]
    );

    res.status(201).json({ success: true, item: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/inventory/:id
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { name, description, quantity, low_stock_threshold, usage_per_booking } = req.body;

    // Reset alert_sent if quantity is being updated above threshold
    const result = await pool.query(
      `UPDATE inventory_items SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        quantity = COALESCE($3, quantity), low_stock_threshold = COALESCE($4, low_stock_threshold),
        usage_per_booking = COALESCE($5, usage_per_booking),
        alert_sent = CASE WHEN COALESCE($3, quantity) > COALESCE($4, low_stock_threshold) THEN false ELSE alert_sent END,
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, description, quantity, low_stock_threshold, usage_per_booking, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/inventory/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM inventory_items WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

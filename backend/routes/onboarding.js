const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/onboarding/status?workspace_id=
router.get('/status', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ success: false, message: 'workspace_id required' });

    const ws = await pool.query('SELECT * FROM workspaces WHERE id = $1', [workspace_id]);
    if (ws.rows.length === 0) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const workspace = ws.rows[0];

    // Check which steps are complete
    const [channels, services, availability, forms, inventory, staff] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM communication_channels WHERE workspace_id = $1 AND is_active = true', [workspace_id]),
      pool.query('SELECT COUNT(*) FROM services WHERE workspace_id = $1', [workspace_id]),
      pool.query(
        `SELECT COUNT(*) FROM availability a
         JOIN services s ON a.service_id = s.id WHERE s.workspace_id = $1`,
        [workspace_id]
      ),
      pool.query('SELECT COUNT(*) FROM forms WHERE workspace_id = $1', [workspace_id]),
      pool.query('SELECT COUNT(*) FROM inventory_items WHERE workspace_id = $1', [workspace_id]),
      pool.query('SELECT COUNT(*) FROM workspace_members WHERE workspace_id = $1', [workspace_id])
    ]);

    const steps = {
      1: { name: 'Create Workspace', complete: true }, // Already done if we're here
      2: { name: 'Communication Setup', complete: parseInt(channels.rows[0].count) > 0 },
      3: { name: 'Contact Form', complete: parseInt(channels.rows[0].count) > 0 }, // available once comms set up
      4: { name: 'Booking Setup', complete: parseInt(services.rows[0].count) > 0 && parseInt(availability.rows[0].count) > 0 },
      5: { name: 'Forms Setup', complete: parseInt(forms.rows[0].count) > 0 },
      6: { name: 'Inventory Setup', complete: parseInt(inventory.rows[0].count) > 0 },
      7: { name: 'Staff Setup', complete: parseInt(staff.rows[0].count) > 1 },
      8: { name: 'Activate Workspace', complete: workspace.status === 'active' }
    };

    // Can activate if: comms exist + at least one service + availability exists
    const canActivate = steps[2].complete && steps[4].complete;

    res.json({
      success: true,
      onboarding: {
        currentStep: workspace.onboarding_step,
        status: workspace.status,
        steps,
        canActivate
      }
    });
  } catch (err) { next(err); }
});

// POST /api/onboarding/step — Update onboarding step
router.post('/step', auth, async (req, res, next) => {
  try {
    const { workspace_id, step } = req.body;
    await pool.query(
      'UPDATE workspaces SET onboarding_step = $1, updated_at = NOW() WHERE id = $2',
      [step, workspace_id]
    );
    res.json({ success: true, step });
  } catch (err) { next(err); }
});

// POST /api/onboarding/activate — Activate workspace
router.post('/activate', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.body;

    // Validate minimum requirements
    const channels = await pool.query(
      'SELECT COUNT(*) FROM communication_channels WHERE workspace_id = $1 AND is_active = true',
      [workspace_id]
    );
    if (parseInt(channels.rows[0].count) === 0) {
      return res.status(400).json({ success: false, message: 'At least one communication channel is required' });
    }

    const services = await pool.query(
      'SELECT COUNT(*) FROM services WHERE workspace_id = $1',
      [workspace_id]
    );
    if (parseInt(services.rows[0].count) === 0) {
      return res.status(400).json({ success: false, message: 'At least one service/booking type is required' });
    }

    const availability = await pool.query(
      `SELECT COUNT(*) FROM availability a JOIN services s ON a.service_id = s.id WHERE s.workspace_id = $1`,
      [workspace_id]
    );
    if (parseInt(availability.rows[0].count) === 0) {
      return res.status(400).json({ success: false, message: 'Availability must be set for at least one service' });
    }

    // Activate
    await pool.query(
      "UPDATE workspaces SET status = 'active', onboarding_step = 8, updated_at = NOW() WHERE id = $1",
      [workspace_id]
    );

    res.json({ success: true, message: 'Workspace activated! Automation is now enabled.' });
  } catch (err) { next(err); }
});

// POST /api/onboarding/communication — Setup communication channel
router.post('/communication', auth, async (req, res, next) => {
  try {
    const { workspace_id, type, config } = req.body;

    if (!['email', 'sms'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be email or sms' });
    }

    const result = await pool.query(
      `INSERT INTO communication_channels (workspace_id, type, config, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (workspace_id, type) DO UPDATE SET config = $3, is_active = true RETURNING *`,
      [workspace_id, type, JSON.stringify(config || {})]
    );

    res.status(201).json({ success: true, channel: result.rows[0] || { workspace_id, type, is_active: true } });
  } catch (err) { next(err); }
});

// GET /api/onboarding/communication?workspace_id=
router.get('/communication', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    const result = await pool.query(
      'SELECT * FROM communication_channels WHERE workspace_id = $1',
      [workspace_id]
    );
    res.json({ success: true, channels: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;

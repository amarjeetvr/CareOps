const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/dashboard?workspace_id=
router.get('/', auth, async (req, res, next) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) {
      return res.status(400).json({ success: false, message: 'workspace_id required' });
    }

    const wid = parseInt(workspace_id);
    const now = new Date().toISOString();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    // Run all queries in parallel
    const [
      todaysBookings,
      upcomingBookings,
      completedCount,
      noShowCount,
      newLeads,
      unansweredConversations,
      pendingForms,
      overdueForms,
      lowStockItems,
      recentAutomationErrors
    ] = await Promise.all([
      // Today's bookings
      pool.query(
        `SELECT b.*, c.name as contact_name, s.name as service_name
         FROM bookings b
         LEFT JOIN contacts c ON b.contact_id = c.id
         LEFT JOIN services s ON b.service_id = s.id
         WHERE b.workspace_id = $1 AND b.start_time >= $2 AND b.start_time <= $3
         ORDER BY b.start_time ASC`,
        [wid, todayStart.toISOString(), todayEnd.toISOString()]
      ),
      // Upcoming bookings (next 7 days)
      pool.query(
        `SELECT b.*, c.name as contact_name, s.name as service_name
         FROM bookings b
         LEFT JOIN contacts c ON b.contact_id = c.id
         LEFT JOIN services s ON b.service_id = s.id
         WHERE b.workspace_id = $1 AND b.start_time > $2 AND b.start_time <= $2::timestamp + INTERVAL '7 days'
         AND b.status = 'confirmed'
         ORDER BY b.start_time ASC LIMIT 10`,
        [wid, now]
      ),
      // Completed bookings (this week)
      pool.query(
        `SELECT COUNT(*) FROM bookings WHERE workspace_id = $1 AND status = 'completed'
         AND updated_at >= NOW() - INTERVAL '7 days'`,
        [wid]
      ),
      // No-show bookings (this week)
      pool.query(
        `SELECT COUNT(*) FROM bookings WHERE workspace_id = $1 AND status = 'no_show'
         AND updated_at >= NOW() - INTERVAL '7 days'`,
        [wid]
      ),
      // New leads (contacts created in last 7 days)
      pool.query(
        `SELECT COUNT(*) FROM contacts WHERE workspace_id = $1
         AND created_at >= NOW() - INTERVAL '7 days'`,
        [wid]
      ),
      // Unanswered conversations
      pool.query(
        `SELECT conv.*, c.name as contact_name, c.email, c.phone
         FROM conversations conv
         JOIN contacts c ON conv.contact_id = c.id
         WHERE conv.workspace_id = $1 AND conv.status = 'open'
         AND NOT EXISTS (
           SELECT 1 FROM messages m WHERE m.conversation_id = conv.id
           AND m.sender_type = 'staff' AND m.created_at > conv.last_message_at - INTERVAL '1 second'
         )
         ORDER BY conv.last_message_at DESC LIMIT 10`,
        [wid]
      ),
      // Pending form submissions
      pool.query(
        `SELECT fs.*, f.name as form_name, c.name as contact_name
         FROM form_submissions fs
         JOIN forms f ON fs.form_id = f.id
         LEFT JOIN contacts c ON fs.contact_id = c.id
         WHERE f.workspace_id = $1 AND fs.status = 'pending'
         ORDER BY fs.created_at ASC`,
        [wid]
      ),
      // Overdue forms (pending > 48h)
      pool.query(
        `SELECT COUNT(*) FROM form_submissions fs
         JOIN forms f ON fs.form_id = f.id
         WHERE f.workspace_id = $1 AND fs.status = 'pending'
         AND fs.created_at < NOW() - INTERVAL '48 hours'`,
        [wid]
      ),
      // Low stock items
      pool.query(
        `SELECT * FROM inventory_items WHERE workspace_id = $1
         AND quantity <= low_stock_threshold ORDER BY quantity ASC`,
        [wid]
      ),
      // Recent automation failures
      pool.query(
        `SELECT * FROM automation_logs WHERE workspace_id = $1 AND status = 'failed'
         AND created_at >= NOW() - INTERVAL '24 hours'
         ORDER BY created_at DESC LIMIT 5`,
        [wid]
      )
    ]);

    res.json({
      success: true,
      dashboard: {
        todaysBookings: todaysBookings.rows,
        upcomingBookings: upcomingBookings.rows,
        stats: {
          completedThisWeek: parseInt(completedCount.rows[0].count),
          noShowThisWeek: parseInt(noShowCount.rows[0].count),
          newLeadsThisWeek: parseInt(newLeads.rows[0].count),
          pendingForms: pendingForms.rows.length,
          overdueFormsCount: parseInt(overdueForms.rows[0].count),
          lowStockCount: lowStockItems.rows.length
        },
        unansweredConversations: unansweredConversations.rows,
        pendingForms: pendingForms.rows,
        lowStockItems: lowStockItems.rows,
        automationErrors: recentAutomationErrors.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

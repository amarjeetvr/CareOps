/**
 * Automation Engine
 * Strict event-based automation with visible logging.
 * 
 * Supported events:
 *  - contact.created     → Send welcome message
 *  - booking.created     → Send confirmation message
 *  - booking.upcoming    → Send reminder (cron-triggered)
 *  - form.pending        → Send reminder (cron-triggered)
 *  - inventory.low_stock → Send alert (cron-triggered)
 *  - staff.reply         → Pause automation for conversation
 * 
 * NO hidden logic. NO AI rules. Every action is logged.
 */

const pool = require('../db');
const { sendToContact } = require('./notifications');

/**
 * Log an automation event
 */
async function logAutomation(workspaceId, eventType, targetType, targetId, action, status, errorMessage = null, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO automation_logs (workspace_id, event_type, target_type, target_id, action, status, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [workspaceId, eventType, targetType, targetId, action, status, errorMessage, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('[AUTOMATION] Failed to log:', err.message);
  }
}

/**
 * Event: New contact created → Send welcome message
 */
async function onContactCreated(workspaceId, contactId) {
  const action = 'send_welcome_message';
  try {
    // Check workspace is active
    const ws = await pool.query('SELECT status FROM workspaces WHERE id = $1', [workspaceId]);
    if (ws.rows.length === 0 || ws.rows[0].status !== 'active') {
      await logAutomation(workspaceId, 'contact.created', 'contact', contactId, action, 'skipped', 'Workspace not active');
      return;
    }

    const contact = await pool.query('SELECT name FROM contacts WHERE id = $1', [contactId]);
    const contactName = contact.rows[0]?.name || 'there';

    const message = `Hi ${contactName}! Thank you for reaching out. We've received your information and a team member will be in touch soon.`;

    const result = await sendToContact(workspaceId, contactId, message, 'Welcome to our practice!');
    await logAutomation(workspaceId, 'contact.created', 'contact', contactId, action, result.success ? 'success' : 'skipped', null, result);
  } catch (err) {
    await logAutomation(workspaceId, 'contact.created', 'contact', contactId, action, 'failed', err.message);
  }
}

/**
 * Event: Booking created → Send confirmation
 */
async function onBookingCreated(workspaceId, bookingId) {
  const action = 'send_booking_confirmation';
  try {
    const ws = await pool.query('SELECT status, name FROM workspaces WHERE id = $1', [workspaceId]);
    if (ws.rows.length === 0 || ws.rows[0].status !== 'active') {
      await logAutomation(workspaceId, 'booking.created', 'booking', bookingId, action, 'skipped', 'Workspace not active');
      return;
    }

    const booking = await pool.query(
      `SELECT b.*, c.name as contact_name, s.name as service_name
       FROM bookings b
       LEFT JOIN contacts c ON b.contact_id = c.id
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.id = $1`,
      [bookingId]
    );
    if (booking.rows.length === 0 || !booking.rows[0].contact_id) {
      await logAutomation(workspaceId, 'booking.created', 'booking', bookingId, action, 'skipped', 'No contact linked');
      return;
    }

    const b = booking.rows[0];
    const startTime = new Date(b.start_time).toLocaleString();
    const message = `Hi ${b.contact_name}! Your appointment${b.service_name ? ` for ${b.service_name}` : ''} has been confirmed for ${startTime}. We look forward to seeing you!`;

    const result = await sendToContact(workspaceId, b.contact_id, message, 'Booking Confirmation');
    await logAutomation(workspaceId, 'booking.created', 'booking', bookingId, action, result.success ? 'success' : 'skipped', null, result);
  } catch (err) {
    await logAutomation(workspaceId, 'booking.created', 'booking', bookingId, action, 'failed', err.message);
  }
}

/**
 * Cron: Send reminders for upcoming bookings (24h before)
 */
async function processUpcomingBookingReminders() {
  try {
    const result = await pool.query(
      `SELECT b.*, c.name as contact_name, s.name as service_name, w.name as workspace_name
       FROM bookings b
       JOIN workspaces w ON b.workspace_id = w.id
       LEFT JOIN contacts c ON b.contact_id = c.id
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.status = 'confirmed'
         AND b.reminder_sent = false
         AND b.contact_id IS NOT NULL
         AND b.start_time BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
         AND w.status = 'active'`
    );

    for (const b of result.rows) {
      try {
        const startTime = new Date(b.start_time).toLocaleString();
        const message = `Reminder: Your appointment${b.service_name ? ` for ${b.service_name}` : ''} is coming up on ${startTime}. See you soon!`;

        const sendResult = await sendToContact(b.workspace_id, b.contact_id, message, 'Appointment Reminder');
        await pool.query('UPDATE bookings SET reminder_sent = true WHERE id = $1', [b.id]);
        await logAutomation(b.workspace_id, 'booking.upcoming', 'booking', b.id, 'send_reminder', 'success', null, sendResult);
      } catch (err) {
        await logAutomation(b.workspace_id, 'booking.upcoming', 'booking', b.id, 'send_reminder', 'failed', err.message);
      }
    }

    console.log(`[AUTOMATION] Processed ${result.rows.length} booking reminders`);
  } catch (err) {
    console.error('[AUTOMATION] Booking reminder error:', err);
  }
}

/**
 * Cron: Send reminders for pending forms (created > 24h ago, not submitted)
 */
async function processPendingFormReminders() {
  try {
    const result = await pool.query(
      `SELECT fs.*, f.workspace_id, f.name as form_name, c.name as contact_name, w.name as workspace_name
       FROM form_submissions fs
       JOIN forms f ON fs.form_id = f.id
       JOIN workspaces w ON f.workspace_id = w.id
       LEFT JOIN contacts c ON fs.contact_id = c.id
       WHERE fs.status = 'pending'
         AND fs.reminder_sent = false
         AND fs.contact_id IS NOT NULL
         AND fs.created_at < NOW() - INTERVAL '24 hours'
         AND w.status = 'active'`
    );

    for (const fs of result.rows) {
      try {
        const message = `Hi ${fs.contact_name || 'there'}! We noticed you haven't completed the ${fs.form_name} form yet. Please complete it at your earliest convenience.`;

        const sendResult = await sendToContact(fs.workspace_id || 0, fs.contact_id, message, 'Form Reminder');
        await pool.query('UPDATE form_submissions SET reminder_sent = true WHERE id = $1', [fs.id]);
        await logAutomation(fs.workspace_id || 0, 'form.pending', 'form_submission', fs.id, 'send_reminder', 'success', null, sendResult);
      } catch (err) {
        await logAutomation(fs.workspace_id || 0, 'form.pending', 'form_submission', fs.id, 'send_reminder', 'failed', err.message);
      }
    }

    console.log(`[AUTOMATION] Processed ${result.rows.length} form reminders`);
  } catch (err) {
    console.error('[AUTOMATION] Form reminder error:', err);
  }
}

/**
 * Cron: Check inventory low stock alerts
 */
async function processLowStockAlerts() {
  try {
    const result = await pool.query(
      `SELECT i.*, w.name as workspace_name, w.contact_email
       FROM inventory_items i
       JOIN workspaces w ON i.workspace_id = w.id
       WHERE i.quantity <= i.low_stock_threshold
         AND i.alert_sent = false
         AND w.status = 'active'`
    );

    for (const item of result.rows) {
      try {
        await logAutomation(
          item.workspace_id,
          'inventory.low_stock',
          'inventory_item',
          item.id,
          'low_stock_alert',
          'success',
          null,
          { item_name: item.name, quantity: item.quantity, threshold: item.low_stock_threshold }
        );
        await pool.query('UPDATE inventory_items SET alert_sent = true WHERE id = $1', [item.id]);
        console.log(`[AUTOMATION] Low stock alert: ${item.name} (${item.quantity}/${item.low_stock_threshold})`);
      } catch (err) {
        await logAutomation(item.workspace_id, 'inventory.low_stock', 'inventory_item', item.id, 'low_stock_alert', 'failed', err.message);
      }
    }
  } catch (err) {
    console.error('[AUTOMATION] Low stock alert error:', err);
  }
}

/**
 * Event: Staff reply → Pause automation for conversation
 */
async function onStaffReply(conversationId) {
  try {
    const conv = await pool.query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
    if (conv.rows.length === 0) return;

    await pool.query('UPDATE conversations SET automation_paused = true WHERE id = $1', [conversationId]);
    await logAutomation(
      conv.rows[0].workspace_id,
      'staff.reply',
      'conversation',
      conversationId,
      'pause_automation',
      'success'
    );
  } catch (err) {
    console.error('[AUTOMATION] Staff reply handler error:', err);
  }
}

/**
 * Cron: Auto-complete past bookings
 */
async function autoCompletePastBookings() {
  try {
    const result = await pool.query(
      "UPDATE bookings SET status = 'completed', updated_at = NOW() WHERE end_time < NOW() AND status = 'confirmed' RETURNING id, workspace_id"
    );
    for (const row of result.rows) {
      await logAutomation(row.workspace_id, 'booking.completed', 'booking', row.id, 'auto_complete', 'success');
    }
    console.log(`[AUTOMATION] Auto-completed ${result.rowCount} past bookings`);
  } catch (err) {
    console.error('[AUTOMATION] Auto-complete error:', err);
  }
}

module.exports = {
  logAutomation,
  onContactCreated,
  onBookingCreated,
  processUpcomingBookingReminders,
  processPendingFormReminders,
  processLowStockAlerts,
  onStaffReply,
  autoCompletePastBookings
};

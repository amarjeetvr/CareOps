/**
 * Mock Notification Service
 * Simulates sending Email and SMS messages.
 * In production, replace with real providers (SendGrid, Twilio, etc.)
 */

const pool = require('../db');

/**
 * Send an email (mocked)
 */
async function sendEmail(to, subject, body) {
  console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
  console.log(`[EMAIL] Body: ${body}`);
  // Simulate random failure (5% chance)
  if (Math.random() < 0.05) {
    throw new Error(`Email delivery failed to ${to}`);
  }
  return { success: true, channel: 'email', to, subject };
}

/**
 * Send an SMS (mocked)
 */
async function sendSMS(to, body) {
  console.log(`[SMS] To: ${to}`);
  console.log(`[SMS] Body: ${body}`);
  if (Math.random() < 0.05) {
    throw new Error(`SMS delivery failed to ${to}`);
  }
  return { success: true, channel: 'sms', to };
}

/**
 * Send a message to a contact via best available channel
 * Creates a message record in the conversation
 */
async function sendToContact(workspaceId, contactId, messageBody, subject = 'CareOps Notification') {
  const client = await pool.connect();
  try {
    // Get contact info
    const contactRes = await client.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
    if (contactRes.rows.length === 0) throw new Error('Contact not found');
    const contact = contactRes.rows[0];

    // Get or create conversation
    let convRes = await client.query(
      'SELECT * FROM conversations WHERE workspace_id = $1 AND contact_id = $2',
      [workspaceId, contactId]
    );

    let conversationId;
    if (convRes.rows.length === 0) {
      const newConv = await client.query(
        'INSERT INTO conversations (workspace_id, contact_id) VALUES ($1, $2) RETURNING id',
        [workspaceId, contactId]
      );
      conversationId = newConv.rows[0].id;
    } else {
      conversationId = convRes.rows[0].id;
      // Check if automation is paused for this conversation
      if (convRes.rows[0].automation_paused) {
        console.log(`[NOTIFY] Automation paused for conversation ${conversationId}, skipping`);
        return { success: false, reason: 'automation_paused' };
      }
    }

    // Determine channel and send
    let channel = 'system';
    let sendResult;

    // Get available channels for workspace
    const channelsRes = await client.query(
      'SELECT * FROM communication_channels WHERE workspace_id = $1 AND is_active = true',
      [workspaceId]
    );
    const channels = channelsRes.rows;
    const hasEmail = channels.some(c => c.type === 'email');
    const hasSMS = channels.some(c => c.type === 'sms');

    try {
      if (contact.email && hasEmail) {
        sendResult = await sendEmail(contact.email, subject, messageBody);
        channel = 'email';
      } else if (contact.phone && hasSMS) {
        sendResult = await sendSMS(contact.phone, messageBody);
        channel = 'sms';
      } else {
        // Log as system message (no channel available)
        channel = 'system';
        sendResult = { success: true };
      }
    } catch (sendErr) {
      // Log the failure
      await client.query(
        `INSERT INTO messages (conversation_id, direction, channel, body, sender_type, status)
         VALUES ($1, 'outbound', $2, $3, 'system', 'failed')`,
        [conversationId, channel, messageBody]
      );
      await client.query(
        'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
        [conversationId]
      );
      throw sendErr;
    }

    // Record the message
    await client.query(
      `INSERT INTO messages (conversation_id, direction, channel, body, sender_type, status)
       VALUES ($1, 'outbound', $2, $3, 'system', 'sent')`,
      [conversationId, channel, messageBody]
    );
    await client.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [conversationId]
    );

    return { success: true, channel, conversationId };
  } finally {
    client.release();
  }
}

module.exports = { sendEmail, sendSMS, sendToContact };

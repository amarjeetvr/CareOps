const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const auth = require('../middleware/auth');
const { onStaffReply } = require('../services/automation');

// GET /api/inbox?workspace_id=
router.get('/', auth, async (req, res, next) => {
  try {
    const { workspace_id, status } = req.query;
    if (!workspace_id) return res.status(400).json({ success: false, message: 'workspace_id required' });

    let query = `
      SELECT conv.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone,
        (SELECT body FROM messages m WHERE m.conversation_id = conv.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT channel FROM messages m WHERE m.conversation_id = conv.id ORDER BY m.created_at DESC LIMIT 1) as last_channel
      FROM conversations conv
      JOIN contacts c ON conv.contact_id = c.id
      WHERE conv.workspace_id = $1
    `;
    const params = [workspace_id];

    if (status) {
      query += ' AND conv.status = $2';
      params.push(status);
    }

    query += ' ORDER BY conv.last_message_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, conversations: result.rows });
  } catch (err) { next(err); }
});

// GET /api/inbox/:conversationId/messages
router.get('/:conversationId/messages', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.*, u.name as sender_name
       FROM messages m
       LEFT JOIN users u ON m.sender_type = 'staff' AND m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.conversationId]
    );
    res.json({ success: true, messages: result.rows });
  } catch (err) { next(err); }
});

// POST /api/inbox/:conversationId/reply — Staff reply
router.post('/:conversationId/reply', auth, [
  body('body').notEmpty().withMessage('Message body is required'),
  body('channel').isIn(['email', 'sms']).withMessage('Channel must be email or sms')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { body: msgBody, channel } = req.body;
    const conversationId = req.params.conversationId;

    // Create message
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, direction, channel, body, sender_type, sender_id, status)
       VALUES ($1, 'outbound', $2, $3, 'staff', $4, 'sent') RETURNING *`,
      [conversationId, channel, msgBody, req.user.id]
    );

    // Update conversation
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [conversationId]
    );

    // Pause automation (staff reply stops automation)
    await onStaffReply(parseInt(conversationId));

    res.status(201).json({ success: true, message: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/inbox/:conversationId/status
router.put('/:conversationId/status', auth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE conversations SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.conversationId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
    res.json({ success: true, conversation: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;

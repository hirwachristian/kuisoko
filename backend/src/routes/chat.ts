import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const MESSAGE_COLUMNS = `
  id, user_id AS "userId", sender_role AS "senderRole", sender_id AS "senderId",
  body, attachment_url AS "attachmentUrl", attachment_type AS "attachmentType", attachment_name AS "attachmentName",
  created_at AS "createdAt", read_by_user AS "readByUser", read_by_admin AS "readByAdmin"
`;

// A message needs text, an attachment, or both - never neither.
const sendSchema = z.object({
  body: z.string().trim().max(2000, 'Message is too long').optional(),
  attachmentUrl: z.string().trim().min(1).optional(),
  attachmentType: z.string().trim().min(1).optional(),
  attachmentName: z.string().trim().min(1).optional(),
}).refine((data) => (data.body && data.body.length > 0) || data.attachmentUrl, {
  message: 'Message cannot be empty',
});

// GET /api/chat/admin-status - is any admin currently active? Backs the customer-facing
// "admin is online" indicator. Any authenticated user (not just admins) can check this.
router.get('/admin-status', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin' AND last_active_at > now() - interval '2 minutes') AS online`
    );
    return res.json({ online: result.rows[0].online });
  } catch (err) {
    return next(err);
  }
});

// GET /api/chat/messages - the logged-in customer's own conversation with admin.
// Marks any admin messages in it as read, since the customer is viewing them now.
router.get('/messages', async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const result = await pool.query(
      `SELECT ${MESSAGE_COLUMNS} FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    await pool.query(
      `UPDATE chat_messages SET read_by_user = true WHERE user_id = $1 AND sender_role = 'admin' AND read_by_user = false`,
      [userId]
    );
    return res.json({ messages: result.rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/chat/unread-count - how many admin replies the customer hasn't seen yet (widget badge).
router.get('/unread-count', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM chat_messages WHERE user_id = $1 AND sender_role = 'admin' AND read_by_user = false`,
      [req.authUser!.id]
    );
    return res.json({ count: result.rows[0].count });
  } catch (err) {
    return next(err);
  }
});

// POST /api/chat/messages - the logged-in customer sends a message into their own conversation.
router.post('/messages', async (req, res, next) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const userId = req.authUser!.id;
    const result = await pool.query(
      `INSERT INTO chat_messages (user_id, sender_role, sender_id, body, attachment_url, attachment_type, attachment_name, read_by_user, read_by_admin)
       VALUES ($1, 'user', $1, $2, $3, $4, $5, true, false) RETURNING ${MESSAGE_COLUMNS}`,
      [userId, parsed.data.body ?? null, parsed.data.attachmentUrl ?? null, parsed.data.attachmentType ?? null, parsed.data.attachmentName ?? null]
    );
    return res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// --- Admin-only: every customer shares one inbox any admin can view and reply to ---

// GET /api/chat/conversations - admin: every customer who has messaged, with a preview + unread count.
router.get('/conversations', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT u.id AS "userId", u.name, u.email, u.profile_image AS "profileImage",
             lm.body AS "lastMessageBody", lm.attachment_url AS "lastMessageAttachmentUrl",
             lm.attachment_type AS "lastMessageAttachmentType",
             lm.created_at AS "lastMessageAt", lm.sender_role AS "lastMessageSenderRole",
             COALESCE(uc.count, 0)::int AS "unreadCount"
      FROM (SELECT DISTINCT user_id FROM chat_messages) cu
      JOIN users u ON u.id = cu.user_id
      JOIN LATERAL (
        SELECT body, attachment_url, attachment_type, created_at, sender_role FROM chat_messages
        WHERE user_id = cu.user_id ORDER BY created_at DESC LIMIT 1
      ) lm ON true
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS count FROM chat_messages
        WHERE sender_role = 'user' AND read_by_admin = false GROUP BY user_id
      ) uc ON uc.user_id = cu.user_id
      ORDER BY lm.created_at DESC
    `);
    return res.json({ conversations: result.rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/chat/admin-unread-count - admin: total unseen customer messages across every conversation.
router.get('/admin-unread-count', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM chat_messages WHERE sender_role = 'user' AND read_by_admin = false`
    );
    return res.json({ count: result.rows[0].count });
  } catch (err) {
    return next(err);
  }
});

// GET /api/chat/messages/:userId - admin: a specific customer's full conversation.
// Marks that customer's messages as read by admin, since an admin is viewing them now.
router.get('/messages/:userId', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${MESSAGE_COLUMNS} FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.params.userId]
    );
    await pool.query(
      `UPDATE chat_messages SET read_by_admin = true WHERE user_id = $1 AND sender_role = 'user' AND read_by_admin = false`,
      [req.params.userId]
    );
    return res.json({ messages: result.rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/chat/messages/:userId - admin: reply into a specific customer's conversation.
router.post('/messages/:userId', requireAdmin, async (req, res, next) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages (user_id, sender_role, sender_id, body, attachment_url, attachment_type, attachment_name, read_by_user, read_by_admin)
       VALUES ($1, 'admin', $2, $3, $4, $5, $6, false, true) RETURNING ${MESSAGE_COLUMNS}`,
      [req.params.userId, req.authUser!.id, parsed.data.body ?? null, parsed.data.attachmentUrl ?? null, parsed.data.attachmentType ?? null, parsed.data.attachmentName ?? null]
    );
    return res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

export default router;

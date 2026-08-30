import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { enquiryLimiter } from '../middleware/rateLimit.js';
import { sendEnquiryReplyEmail } from '../lib/brevo.js';

const router = Router();

const ENQUIRY_COLUMNS = `
  id, name, email, subject, message, status, reply_body AS "replyBody",
  replied_at AS "repliedAt", is_unread AS "unread", created_at AS "createdAt"
`;

const createEnquirySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  subject: z.string().trim().min(1, 'Subject is required'),
  message: z.string().trim().min(1, 'Message is required'),
});

// POST /api/enquiries - public: submit the Contact Us form
router.post('/', enquiryLimiter, async (req, res, next) => {
  const parsed = createEnquirySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, subject, message } = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO enquiries (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING ${ENQUIRY_COLUMNS}`,
      [name, email, subject, message]
    );
    return res.status(201).json({ enquiry: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.use(authenticate, requireAdmin);

// GET /api/enquiries - admin: every enquiry, newest first
router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${ENQUIRY_COLUMNS} FROM enquiries ORDER BY created_at DESC`);
    return res.json({ enquiries: result.rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/enquiries/unread-count - admin: badge count for the sidebar
router.get('/unread-count', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM enquiries WHERE is_unread = true`);
    return res.json({ count: result.rows[0].count });
  } catch (err) {
    return next(err);
  }
});

// GET /api/enquiries/:id - admin: view one enquiry, marks it read since it's being viewed now
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${ENQUIRY_COLUMNS} FROM enquiries WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Enquiry not found.' });
    await pool.query(`UPDATE enquiries SET is_unread = false WHERE id = $1`, [req.params.id]);
    return res.json({ enquiry: { ...result.rows[0], unread: false } });
  } catch (err) {
    return next(err);
  }
});

const replySchema = z.object({
  replyBody: z.string().trim().min(1, 'Reply message is required'),
});

// POST /api/enquiries/:id/reply - admin: email a reply to the address the visitor provided.
// The reply only ever goes out by email - the visitor may not have (or be signed into) an
// account, so there's no reliable in-app place to show them a response.
router.post('/:id/reply', async (req, res, next) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const enquiryResult = await pool.query(`SELECT name, email, subject FROM enquiries WHERE id = $1`, [req.params.id]);
    const enquiry = enquiryResult.rows[0];
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });

    const sent = await sendEnquiryReplyEmail(enquiry.email, enquiry.name, enquiry.subject, parsed.data.replyBody);
    if (!sent) {
      return res.status(502).json({ error: 'Could not send the reply email. Please try again.' });
    }

    const result = await pool.query(
      `UPDATE enquiries SET status = 'replied', reply_body = $1, replied_at = now(), replied_by = $2, is_unread = false
       WHERE id = $3 RETURNING ${ENQUIRY_COLUMNS}`,
      [parsed.data.replyBody, req.authUser!.id, req.params.id]
    );
    return res.json({ enquiry: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/enquiries/:id - admin: remove an enquiry
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM enquiries WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Enquiry not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;

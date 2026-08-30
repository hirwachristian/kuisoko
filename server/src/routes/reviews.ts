import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireAdmin);

const REVIEW_COLUMNS = `
  r.id, r.product_id AS "productId", p.name AS "productName", r.user_name AS "userName",
  r.rating, r.comment, r.image, r.is_hidden AS "isHidden", r.is_unread AS "unread",
  r.created_at AS date
`;

// GET /api/reviews - admin: every review across all products, for the notification feed
router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${REVIEW_COLUMNS} FROM reviews r JOIN products p ON p.id = r.product_id ORDER BY r.created_at DESC`
    );
    return res.json({ reviews: result.rows });
  } catch (err) {
    return next(err);
  }
});

const hideSchema = z.object({ isHidden: z.boolean() });

// PATCH /api/reviews/:id - admin: hide or unhide a review
router.patch('/:id', async (req, res, next) => {
  const parsed = hideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `UPDATE reviews SET is_hidden = $1 WHERE id = $2 RETURNING product_id`,
      [parsed.data.isHidden, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Review not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/reviews/:id/read - admin: mark a review notification as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE reviews SET is_unread = false WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Review not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/reviews/:id - admin: permanently delete a review
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM reviews WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Review not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;

import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/wishlist - authenticated: product ids on the current user's wishlist
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT product_id AS "productId" FROM wishlists WHERE user_id = $1`, [req.authUser!.id]);
    return res.json({ productIds: result.rows.map((r) => r.productId) });
  } catch (err) {
    return next(err);
  }
});

// POST /api/wishlist/:productId - authenticated: add a product
router.post('/:productId', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.authUser!.id, req.params.productId]
    );
    return res.status(204).send();
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return res.status(404).json({ error: 'Product not found.' });
    }
    return next(err);
  }
});

// DELETE /api/wishlist/:productId - authenticated: remove a product
router.delete('/:productId', authenticate, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2`, [req.authUser!.id, req.params.productId]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;

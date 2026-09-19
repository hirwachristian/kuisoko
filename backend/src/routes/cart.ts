import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireCustomer } from '../middleware/auth.js';

const router = Router();

// GET /api/cart - authenticated: the current user's saved cart lines. Returns just product ids +
// line-specific fields (quantity/variant/price override) - the frontend already has the full
// product catalog loaded and joins these against it, the same way it does for /wishlist.
router.get('/', authenticate, requireCustomer, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT product_id AS "productId", quantity, selected_color AS "selectedColor",
              selected_size AS "selectedSize", selected_image AS "selectedImage", unit_price AS "unitPrice"
       FROM cart_items WHERE user_id = $1`,
      [req.authUser!.id]
    );
    return res.json({ items: result.rows });
  } catch (err) {
    return next(err);
  }
});

const upsertSchema = z.object({
  quantity: z.number().int().positive(),
  selectedColor: z.string().nullish(),
  selectedSize: z.string().nullish(),
  // The specific product photo shown when this line was added (e.g. the second of several cap
  // photos on a product with no color variants to hang the choice on) - lets the cart, checkout,
  // and the resulting order all show the exact photo the customer was looking at instead of
  // always falling back to the product's first image.
  selectedImage: z.string().nullish(),
  unitPrice: z.number().nonnegative().nullish(),
});

// PUT /api/cart/:productId - authenticated: set (add or update) one cart line
router.put('/:productId', authenticate, requireCustomer, async (req, res, next) => {
  try {
    const body = upsertSchema.parse(req.body);
    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity, selected_color, selected_size, selected_image, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, product_id) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         selected_color = EXCLUDED.selected_color,
         selected_size = EXCLUDED.selected_size,
         selected_image = EXCLUDED.selected_image,
         unit_price = EXCLUDED.unit_price,
         updated_at = now()`,
      [req.authUser!.id, req.params.productId, body.quantity, body.selectedColor ?? null, body.selectedSize ?? null, body.selectedImage ?? null, body.unitPrice ?? null]
    );
    return res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid cart line.' });
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return res.status(404).json({ error: 'Product not found.' });
    }
    return next(err);
  }
});

// DELETE /api/cart/:productId - authenticated: remove one cart line
router.delete('/:productId', authenticate, requireCustomer, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2`, [req.authUser!.id, req.params.productId]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/cart - authenticated: clear the whole cart (e.g. after checkout completes)
router.delete('/', authenticate, requireCustomer, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM cart_items WHERE user_id = $1`, [req.authUser!.id]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;

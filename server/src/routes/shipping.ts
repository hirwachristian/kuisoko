import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { calculateShippingFee } from '../lib/shipping.js';

const router = Router();

const ZONE_COLUMNS = `id, name, districts, fee, is_default AS "isDefault"`;

// GET /api/shipping/zones - public: list all zones (checkout needs this to show fee previews per zone if desired)
router.get('/zones', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${ZONE_COLUMNS} FROM shipping_zones ORDER BY is_default, name`);
    return res.json({ zones: result.rows });
  } catch (err) {
    return next(err);
  }
});

const zoneSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required'),
  districts: z.array(z.string().trim().min(1)).default([]),
  fee: z.number().nonnegative(),
  isDefault: z.boolean().default(false),
});

// POST /api/shipping/zones - admin: create a zone
router.post('/zones', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `INSERT INTO shipping_zones (name, districts, fee, is_default) VALUES ($1, $2, $3, $4) RETURNING ${ZONE_COLUMNS}`,
      [parsed.data.name, parsed.data.districts, parsed.data.fee, parsed.data.isDefault]
    );
    return res.status(201).json({ zone: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: 'Only one zone can be the default at a time.' });
    }
    return next(err);
  }
});

// Not zoneSchema.partial(): that would still apply .default([]) / .default(false) to any
// omitted field (zod resolves defaults before the optional-wrapping applies), silently
// wiping districts/isDefault on updates that don't mention them.
const zoneUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required').optional(),
  districts: z.array(z.string().trim().min(1)).optional(),
  fee: z.number().nonnegative().optional(),
  isDefault: z.boolean().optional(),
});

// PATCH /api/shipping/zones/:id - admin: update a zone
router.patch('/zones/:id', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = zoneUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  try {
    const zone = await withTransaction(async (client) => {
      // Making this the default zone must atomically unset any previous default,
      // otherwise the "only one default" unique index would reject the update.
      if (data.isDefault === true) {
        await client.query(`UPDATE shipping_zones SET is_default = false WHERE is_default = true AND id != $1`, [req.params.id]);
      }
      const result = await client.query(
        `UPDATE shipping_zones SET
           name = COALESCE($1, name),
           districts = COALESCE($2, districts),
           fee = COALESCE($3, fee),
           is_default = COALESCE($4, is_default)
         WHERE id = $5
         RETURNING ${ZONE_COLUMNS}`,
        [data.name ?? null, data.districts ?? null, data.fee ?? null, data.isDefault ?? null, req.params.id]
      );
      return result.rows[0];
    });
    if (!zone) return res.status(404).json({ error: 'Zone not found.' });
    return res.json({ zone });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: 'Only one zone can be the default at a time.' });
    }
    return next(err);
  }
});

// DELETE /api/shipping/zones/:id - admin
router.delete('/zones/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM shipping_zones WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Zone not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// GET /api/shipping/settings - public
router.get('/settings', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT free_shipping_threshold AS "freeShippingThreshold" FROM shipping_settings WHERE id = 1`);
    return res.json(result.rows[0] ?? { freeShippingThreshold: 0 });
  } catch (err) {
    return next(err);
  }
});

const settingsSchema = z.object({ freeShippingThreshold: z.number().nonnegative() });

// PATCH /api/shipping/settings - admin
router.patch('/settings', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await pool.query(`UPDATE shipping_settings SET free_shipping_threshold = $1 WHERE id = 1`, [parsed.data.freeShippingThreshold]);
    return res.json({ freeShippingThreshold: parsed.data.freeShippingThreshold });
  } catch (err) {
    return next(err);
  }
});

const calculateSchema = z.object({
  district: z.string().trim().min(1, 'District is required'),
  subtotal: z.number().nonnegative(),
});

// POST /api/shipping/calculate - public: preview the shipping fee for a district + subtotal
router.post('/calculate', async (req, res, next) => {
  const parsed = calculateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await calculateShippingFee(parsed.data.district, parsed.data.subtotal);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;

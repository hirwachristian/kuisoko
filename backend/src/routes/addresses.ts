import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { geocodeAddress } from '../lib/geocode.js';

const router = Router();

const ADDRESS_COLUMNS = `
  id, label, full_name AS "fullName", phone_number AS "phoneNumber", country, city_town AS "cityTown",
  district, street_address AS "streetAddress", house_building_no AS "houseBuildingNumber",
  additional_info AS "additionalInfo", is_default AS "isDefault", lat, lng
`;

const addressSchema = z.object({
  label: z.string().trim().min(1, 'Label is required'),
  fullName: z.string().trim().min(1, 'Full name is required'),
  phoneNumber: z.string().trim().min(1, 'Phone number is required'),
  country: z.string().trim().min(1, 'Country is required'),
  cityTown: z.string().trim().min(1, 'City/Town is required'),
  district: z.string().trim().min(1, 'District is required'),
  streetAddress: z.string().trim().min(1, 'Street address is required'),
  houseBuildingNumber: z.string().trim().optional(),
  additionalInfo: z.string().trim().optional(),
  isDefault: z.boolean().default(false),
});

// Same 3-tier fallback getOrGeocodeDeliveryLocation uses for an order's address in routes/orders.ts
// - a full street-level query often fails to match even when the broader area would, so each
// fallback trades precision for a better chance of landing a pin at all. Never throws (geocodeAddress
// itself always resolves), and a failed geocode just means no map preview, not a broken request.
async function geocode(address: { streetAddress: string; cityTown: string; district: string; country: string }) {
  const fullQuery = `${address.streetAddress}, ${address.cityTown}, ${address.district}, ${address.country}`;
  return (
    (await geocodeAddress(fullQuery)) ??
    (await geocodeAddress(`${address.district}, ${address.cityTown}, ${address.country}`)) ??
    (await geocodeAddress(`${address.cityTown}, ${address.country}`))
  );
}

// GET /api/addresses - authenticated: the current user's own saved addresses, default first
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${ADDRESS_COLUMNS} FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [req.authUser!.id]
    );
    return res.json({ addresses: result.rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/addresses - authenticated: save a new address, geocoding it best-effort
router.post('/', authenticate, async (req, res, next) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  try {
    const location = await geocode(data);
    const address = await withTransaction(async (client) => {
      if (data.isDefault) {
        await client.query(`UPDATE user_addresses SET is_default = false WHERE user_id = $1`, [req.authUser!.id]);
      }
      const result = await client.query(
        `INSERT INTO user_addresses (
           user_id, label, full_name, phone_number, country, city_town, district, street_address,
           house_building_no, additional_info, is_default, lat, lng, geocoded_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
         RETURNING ${ADDRESS_COLUMNS}`,
        [
          req.authUser!.id, data.label, data.fullName, data.phoneNumber, data.country, data.cityTown,
          data.district, data.streetAddress, data.houseBuildingNumber ?? null, data.additionalInfo ?? null,
          data.isDefault, location?.lat ?? null, location?.lng ?? null,
        ]
      );
      return result.rows[0];
    });
    return res.status(201).json({ address });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/addresses/:id - authenticated: update one of the current user's own addresses
router.patch('/:id', authenticate, async (req, res, next) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  try {
    const location = await geocode(data);
    const address = await withTransaction(async (client) => {
      if (data.isDefault) {
        await client.query(`UPDATE user_addresses SET is_default = false WHERE user_id = $1 AND id != $2`, [req.authUser!.id, req.params.id]);
      }
      const result = await client.query(
        `UPDATE user_addresses SET
           label = $1, full_name = $2, phone_number = $3, country = $4, city_town = $5, district = $6,
           street_address = $7, house_building_no = $8, additional_info = $9, is_default = $10,
           lat = $11, lng = $12, geocoded_at = now()
         WHERE id = $13 AND user_id = $14
         RETURNING ${ADDRESS_COLUMNS}`,
        [
          data.label, data.fullName, data.phoneNumber, data.country, data.cityTown, data.district,
          data.streetAddress, data.houseBuildingNumber ?? null, data.additionalInfo ?? null, data.isDefault,
          location?.lat ?? null, location?.lng ?? null, req.params.id, req.authUser!.id,
        ]
      );
      return result.rows[0];
    });
    if (!address) return res.status(404).json({ error: 'Address not found.' });
    return res.json({ address });
  } catch (err) {
    return next(err);
  }
});

// POST /api/addresses/:id/default - authenticated: make this the one default address
router.post('/:id/default', authenticate, async (req, res, next) => {
  try {
    const address = await withTransaction(async (client) => {
      await client.query(`UPDATE user_addresses SET is_default = false WHERE user_id = $1`, [req.authUser!.id]);
      const result = await client.query(
        `UPDATE user_addresses SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING ${ADDRESS_COLUMNS}`,
        [req.params.id, req.authUser!.id]
      );
      return result.rows[0];
    });
    if (!address) return res.status(404).json({ error: 'Address not found.' });
    return res.json({ address });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/addresses/:id - authenticated: remove one of the current user's own addresses
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM user_addresses WHERE id = $1 AND user_id = $2`, [req.params.id, req.authUser!.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Address not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;

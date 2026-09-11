import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, requireRider } from '../middleware/auth.js';
import { riderLocationLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../lib/httpError.js';
import { distanceMeters } from '../lib/geo.js';
import { sendDeliveryArrivingEmail } from '../lib/brevo.js';
import { getOrGeocodeDeliveryLocation, fetchOrderById } from './orders.js';

const MAX_VERIFY_ATTEMPTS = 5;
// Close enough to count as "at the address" - forgiving relative to typical urban GPS accuracy
// (5-20m) and to how precisely the free geocoding step above can pin an informal street address.
const ARRIVAL_THRESHOLD_METERS = 200;

const router = Router();

const locationSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

// POST /api/riders/me/location - rider: upsert their current position, called repeatedly while
// "sharing" is on. Only one row is kept per rider (see rider_locations) - this is a live position,
// not a trail. Also marks sharing as active again and clears any stop-sharing alert this rider
// left on their in-progress deliveries - resuming resolves the thing the admin was alerted about.
router.post('/me/location', authenticate, requireRider, riderLocationLimiter, async (req, res, next) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await pool.query(
      `INSERT INTO rider_locations (rider_id, lat, lng, updated_at, sharing_active) VALUES ($1, $2, $3, now(), true)
       ON CONFLICT (rider_id) DO UPDATE SET lat = $2, lng = $3, updated_at = now(), sharing_active = true`,
      [req.authUser!.id, parsed.data.lat, parsed.data.lng]
    );
    await pool.query(
      `UPDATE orders SET rider_stop_alert_at = NULL, rider_stop_alert_unread = false
       WHERE rider_id = $1 AND status = 'Shipped' AND rider_stop_alert_at IS NOT NULL`,
      [req.authUser!.id]
    );

    // Real proximity check against the rider's actual live position and the delivery address's
    // real (geocoded) coordinates - not a timer, not a guess. Scoped to the rider's currently
    // *accepted* delivery only, and only fires once per order (excluded once arrival_notified_at
    // is set), so this stays cheap even though it runs on every location ping.
    const activeOrder = await pool.query(
      `SELECT id, delivery_lat AS "deliveryLat", delivery_lng AS "deliveryLng",
              customer_email AS "customerEmail", customer_name AS "customerName", 'KS-' || order_number AS "orderNumber"
       FROM orders
       WHERE rider_id = $1 AND status = 'Shipped' AND rider_accepted_at IS NOT NULL
             AND arrival_notified_at IS NULL AND delivery_lat IS NOT NULL AND delivery_lng IS NOT NULL`,
      [req.authUser!.id]
    );
    if (activeOrder.rowCount! > 0) {
      const order = activeOrder.rows[0];
      const distance = distanceMeters(
        { lat: parsed.data.lat, lng: parsed.data.lng },
        { lat: order.deliveryLat, lng: order.deliveryLng }
      );
      if (distance <= ARRIVAL_THRESHOLD_METERS) {
        await pool.query(`UPDATE orders SET arrival_notified_at = now() WHERE id = $1`, [order.id]);
        if (order.customerEmail) {
          sendDeliveryArrivingEmail(order.customerEmail, order.customerName, order.orderNumber);
        }
      }
    }

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// POST /api/riders/me/stop-sharing - rider: explicitly pause sharing (button tap, or the browser's
// geolocation giving up) - keeps their last known position on file but flags it as no longer live,
// and alerts the admin on every one of this rider's still-in-progress (Shipped) deliveries, since a
// stop mid-delivery is exactly the kind of thing that shouldn't go unnoticed.
router.post('/me/stop-sharing', authenticate, requireRider, async (req, res, next) => {
  try {
    await pool.query(`UPDATE rider_locations SET sharing_active = false WHERE rider_id = $1`, [req.authUser!.id]);
    await pool.query(
      `UPDATE orders SET rider_stop_alert_at = now(), rider_stop_alert_unread = true
       WHERE rider_id = $1 AND status = 'Shipped'`,
      [req.authUser!.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// GET /api/riders/me/orders - rider: their active (Shipped) deliveries. Deliberately a narrow
// projection, not the full order record `GET /api/orders/:id` returns to the owner/admin - a
// rider doesn't need pricing/payment details, just enough to find and hand off the package. Never
// includes the delivery verification code - the rider must be told it by the customer.
router.get('/me/orders', authenticate, requireRider, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, 'KS-' || order_number AS "orderNumber", customer_name AS "customerName",
              delivery_phone_number AS "deliveryPhoneNumber", delivery_street_address AS "deliveryStreetAddress",
              delivery_city_town AS "deliveryCityTown", delivery_district AS "deliveryDistrict",
              delivery_country AS "deliveryCountry", delivery_additional_info AS "deliveryAdditionalInfo",
              delivery_lat AS "deliveryLat", delivery_lng AS "deliveryLng", delivery_geocoded_at AS "deliveryGeocodedAt",
              rider_accepted_at AS "acceptedAt"
       FROM orders WHERE rider_id = $1 AND status = 'Shipped' ORDER BY order_date`,
      [req.authUser!.id]
    );
    const orders = await Promise.all(result.rows.map(async (row) => {
      const { deliveryLat, deliveryLng, deliveryGeocodedAt, deliveryCountry, ...rest } = row;
      const destination = await getOrGeocodeDeliveryLocation({ ...row, id: row.id });
      return { ...rest, destination };
    }));
    return res.json({ orders });
  } catch (err) {
    return next(err);
  }
});

// POST /api/riders/me/orders/:id/accept - rider: start working this specific delivery. Only one
// Shipped order per rider may be accepted at a time - a rider juggling several assigned deliveries
// has to finish (or the admin has to reassign) the current one before taking the next.
router.post('/me/orders/:id/accept', authenticate, requireRider, async (req, res, next) => {
  try {
    const orderCheck = await pool.query(
      `SELECT rider_id AS "riderId", previous_rider_id AS "previousRiderId", status FROM orders WHERE id = $1`,
      [req.params.id]
    );
    if (orderCheck.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    const order = orderCheck.rows[0];
    if (order.riderId !== req.authUser!.id || order.status !== 'Shipped') {
      // A clearer message for the specific case of "you used to have this, it's someone else's
      // now" rather than a generic not-found, which otherwise looks identical to a typo'd id.
      if (order.previousRiderId === req.authUser!.id) {
        return res.status(409).json({ error: 'This delivery has been transferred to another rider.' });
      }
      return res.status(404).json({ error: 'Order not found.' });
    }
    const activeCheck = await pool.query(
      `SELECT id FROM orders WHERE rider_id = $1 AND status = 'Shipped' AND rider_accepted_at IS NOT NULL`,
      [req.authUser!.id]
    );
    if (activeCheck.rowCount! > 0 && activeCheck.rows[0].id !== req.params.id) {
      return res.status(409).json({ error: 'You already have an active delivery - complete it before accepting another.' });
    }
    await pool.query(`UPDATE orders SET rider_accepted_at = now() WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

const verifyDeliverySchema = z.object({ code: z.string().trim().min(1) });

// POST /api/riders/me/orders/:id/verify-delivery - rider: complete their currently-accepted
// delivery by entering the code the customer sees on their tracking page. This is deliberately
// the only way a delivery gets marked Delivered from the rider's side - no self-serve button, and
// it doesn't wait on the admin either.
router.post('/me/orders/:id/verify-delivery', authenticate, requireRider, async (req, res, next) => {
  const parsed = verifyDeliverySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const orderCheck = await pool.query(
      `SELECT rider_id AS "riderId", status, rider_accepted_at AS "acceptedAt",
              delivery_verification_code AS "code", delivery_verify_attempts AS "attempts"
       FROM orders WHERE id = $1`,
      [req.params.id]
    );
    if (orderCheck.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    const order = orderCheck.rows[0];
    if (order.riderId !== req.authUser!.id || order.status !== 'Shipped' || !order.acceptedAt) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.attempts >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts - ask the store to confirm this delivery.' });
    }
    if (parsed.data.code !== order.code) {
      await pool.query(`UPDATE orders SET delivery_verify_attempts = delivery_verify_attempts + 1 WHERE id = $1`, [req.params.id]);
      return res.status(400).json({ error: 'Incorrect code.' });
    }
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE orders SET status = 'Delivered', delivery_confirmed_at = now(), delivery_confirmed_unread = true WHERE id = $1`,
        [req.params.id]
      );
      await client.query(
        `INSERT INTO order_tracking_events (order_id, status, description) VALUES ($1, 'Delivered', 'Delivery confirmed by rider')`,
        [req.params.id]
      );
    });
    return res.json({ order: await fetchOrderById(req.params.id) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

// GET /api/riders/me/history - rider: their past completed deliveries, most recent first. Same
// narrow projection as /me/orders (no pricing/payment), capped at 50 - this is a personal log for
// the rider to look back on, not a full order archive.
router.get('/me/history', authenticate, requireRider, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, 'KS-' || order_number AS "orderNumber", customer_name AS "customerName",
              delivery_street_address AS "deliveryStreetAddress", delivery_city_town AS "deliveryCityTown",
              delivery_district AS "deliveryDistrict", delivery_confirmed_at AS "deliveredAt"
       FROM orders WHERE rider_id = $1 AND status = 'Delivered'
       ORDER BY COALESCE(delivery_confirmed_at, order_date) DESC LIMIT 50`,
      [req.authUser!.id]
    );
    return res.json({ orders: result.rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/riders/me/reassigned-notices - rider: deliveries recently transferred away from them
// (last 10 minutes), so the app can proactively tell them "this one isn't yours anymore" instead
// of them only finding out by trying to accept it. Short window on purpose - this is a "just
// happened" notice, not a permanent record.
router.get('/me/reassigned-notices', authenticate, requireRider, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT o.id, 'KS-' || o.order_number AS "orderNumber", o.rider_reassigned_at AS "reassignedAt",
              u.name AS "newRiderName"
       FROM orders o LEFT JOIN users u ON u.id = o.rider_id
       WHERE o.previous_rider_id = $1 AND o.rider_reassigned_at > now() - interval '10 minutes'
       ORDER BY o.rider_reassigned_at DESC`,
      [req.authUser!.id]
    );
    return res.json({ notices: result.rows });
  } catch (err) {
    return next(err);
  }
});

export default router;

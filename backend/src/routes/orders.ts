import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db.js';
import { authenticate, optionalAuthenticate, requireAdmin, requireCustomer } from '../middleware/auth.js';
import { checkoutVerificationCodeLimiter, checkoutVerificationVerifyLimiter, orderCreateLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../lib/httpError.js';
import { calculateShippingFee } from '../lib/shipping.js';
import { validateCoupon } from '../lib/coupons.js';
import { sendOrderProcessingEmail, sendInvoiceEmail, sendCheckoutVerificationEmail } from '../lib/brevo.js';
import { sendPushToUser } from '../lib/pushNotifications.js';
import { signCheckoutVerificationToken, verifyCheckoutVerificationToken } from '../lib/auth.js';
import { checkAndNotifyRestock } from './products.js';
import { geocodeAddress } from '../lib/geocode.js';

const router = Router();

/** Generates a 4-digit numeric code, stores its SHA-256 hash (never the raw code) with a
 * 10-minute expiry against the given email, and emails the raw code. Same shape as
 * issueTwoFactorCode in routes/auth.ts, but keyed on email rather than user_id since a guest
 * checkout has no account to hang it on. Every order requires one of these verified before it can
 * be placed (see POST / below) - proves the customer actually controls the email on the order,
 * since there's no live payment gateway yet to gate on instead. */
async function issueCheckoutVerificationCode(email: string, name: string): Promise<void> {
  const code = crypto.randomInt(1000, 10000).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  await pool.query(
    `INSERT INTO checkout_verification_codes (email, code_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`,
    [email.toLowerCase(), codeHash]
  );
  sendCheckoutVerificationEmail(email, name, code); // fire-and-forget, same pattern as the other auth emails
}

const checkoutVerificationRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  name: z.string().trim().min(1).optional(),
});

// POST /api/orders/verification/request - public, unauthenticated (guest checkout). Called the
// moment the customer clicks "Place Order", before their order is actually created.
router.post('/verification/request', checkoutVerificationCodeLimiter, async (req, res, next) => {
  const parsed = checkoutVerificationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await issueCheckoutVerificationCode(parsed.data.email, parsed.data.name || 'there');
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

const checkoutVerificationVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  code: z.string().trim().length(4, 'Enter the 4-digit code'),
});

// POST /api/orders/verification/verify - returns a short-lived token proving control of this
// email, required by POST / below to place any order at all.
router.post('/verification/verify', checkoutVerificationVerifyLimiter, async (req, res, next) => {
  const parsed = checkoutVerificationVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, code } = parsed.data;
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  try {
    await withTransaction(async (client) => {
      const codeResult = await client.query(
        `SELECT id FROM checkout_verification_codes
         WHERE lower(email) = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [email, codeHash]
      );
      if (codeResult.rowCount === 0) {
        throw new HttpError(400, 'Invalid or expired code.');
      }
      await client.query(`UPDATE checkout_verification_codes SET used_at = now() WHERE id = $1`, [codeResult.rows[0].id]);
    });
    return res.json({ token: signCheckoutVerificationToken(email) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

const ORDER_COLUMNS = `
  id, 'KS-' || order_number AS "orderNumber", user_id AS "userId", customer_name AS "customerName",
  delivery_full_name AS "deliveryFullName", delivery_phone_number AS "deliveryPhoneNumber", customer_email AS "customerEmail",
  delivery_country AS "deliveryCountry", delivery_city_town AS "deliveryCityTown",
  delivery_district AS "deliveryDistrict", delivery_street_address AS "deliveryStreetAddress",
  delivery_house_building_no AS "deliveryHouseBuildingNumber", delivery_additional_info AS "deliveryAdditionalInfo",
  order_date AS date, subtotal, shipping_fee AS "shippingFee", shipping_zone AS "shippingZone", tax,
  coupon_code AS "couponCode", discount_amount AS "discountAmount",
  total, currency, status, payment_status AS "paymentStatus", payment_method AS "paymentMethod", is_unread AS unread,
  rider_id AS "riderId", rider_stop_alert_at AS "riderStopAlertAt", rider_stop_alert_unread AS "riderStopAlertUnread",
  delivery_verification_code AS "deliveryVerificationCode",
  delivery_confirmed_at AS "deliveryConfirmedAt", delivery_confirmed_unread AS "deliveryConfirmedUnread",
  arrival_notified_at AS "arrivalNotifiedAt",
  previous_rider_id AS "previousRiderId", rider_reassigned_at AS "riderReassignedAt"
`;

function formatOrder(row: any, items: any[], trackingHistory?: any[]) {
  const {
    deliveryFullName, deliveryPhoneNumber, customerEmail, deliveryCountry, deliveryCityTown,
    deliveryDistrict, deliveryStreetAddress, deliveryHouseBuildingNumber, deliveryAdditionalInfo,
    ...rest
  } = row;
  return {
    ...rest,
    deliveryAddress: {
      fullName: deliveryFullName,
      phoneNumber: deliveryPhoneNumber,
      email: customerEmail,
      country: deliveryCountry,
      cityTown: deliveryCityTown,
      district: deliveryDistrict,
      streetAddress: deliveryStreetAddress,
      houseBuildingNumber: deliveryHouseBuildingNumber,
      additionalInfo: deliveryAdditionalInfo,
    },
    items,
    ...(trackingHistory ? { trackingHistory } : {}),
  };
}

async function fetchItemsForOrders(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, any[]>();
  const result = await pool.query(
    `SELECT id, order_id, product_id AS "productId", product_name AS name, image,
            unit_price AS price, quantity, selected_color AS "selectedColor", selected_size AS "selectedSize"
     FROM order_items WHERE order_id = ANY($1)`,
    [orderIds]
  );
  const byOrder = new Map<string, any[]>();
  for (const row of result.rows) {
    const { order_id, ...item } = row;
    const images = item.image ? [item.image] : [];
    const list = byOrder.get(order_id) ?? [];
    list.push({ ...item, images });
    byOrder.set(order_id, list);
  }
  return byOrder;
}

// Batches the rider-name lookup for a set of order rows (one query total, not one per order) and
// attaches `riderName` to each row that has a `riderId` - the admin order list/notifications need
// to show who's actually delivering, not just an opaque id.
async function attachRiderNames(rows: any[]): Promise<void> {
  const riderIds = [...new Set(rows.map((r) => r.riderId).filter(Boolean))];
  if (riderIds.length === 0) return;
  const riderResult = await pool.query(`SELECT id, name FROM users WHERE id = ANY($1)`, [riderIds]);
  const namesById = new Map<string, string>(riderResult.rows.map((r) => [String(r.id), r.name]));
  for (const row of rows) {
    if (row.riderId) row.riderName = namesById.get(String(row.riderId)) ?? null;
  }
}

// Batches the return-request lookup for a set of order rows (one query total) and attaches the
// most recent request (if any) as `returnRequest` - a customer needs to see its status/rejection
// reason on their own order, and the "Request Return" button needs to know whether one is already
// pending/approved without a second round trip per order.
async function attachReturnRequests(rows: any[]): Promise<void> {
  const orderIds = rows.map((r) => r.id);
  if (orderIds.length === 0) return;
  const result = await pool.query(
    `SELECT DISTINCT ON (order_id) order_id AS "orderId", status, reason,
            admin_note AS "adminNote", requested_at AS "requestedAt", resolved_at AS "resolvedAt",
            customer_unread AS "customerUnread"
     FROM return_requests WHERE order_id = ANY($1)
     ORDER BY order_id, requested_at DESC`,
    [orderIds]
  );
  const byOrderId = new Map(result.rows.map((r) => [r.orderId, r]));
  for (const row of rows) {
    const rr = byOrderId.get(row.id);
    row.returnRequest = rr
      ? { status: rr.status, reason: rr.reason, adminNote: rr.adminNote, requestedAt: rr.requestedAt, resolvedAt: rr.resolvedAt, customerUnread: rr.customerUnread }
      : null;
  }
}

// Restores the stock an order's items held - both the product's aggregate total and, for items
// that had a color/size, that specific variant's own stock - shared by every path that releases an
// order's inventory back (a Cancelled transition, a Returned transition, or an approved return
// request), so the same NULL-safe variant matching isn't triplicated.
//
// Guarded by orders.stock_restored_at so this only ever actually happens once per order, even
// though it can legitimately be *called* more than once for the same order - e.g. Cancelled ->
// Returned (each transition satisfies the PATCH handler's "did the status just change into a
// stock-releasing one" check), or a return approved via /returns/:id/approve on an order that was
// also separately marked Cancelled through the admin status dropdown. Locks the order row first so
// two concurrent callers can't both pass the check before either sets the flag.
export async function restoreOrderStock(client: PoolClient, orderId: string): Promise<void> {
  const locked = await client.query(`SELECT stock_restored_at FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
  if (locked.rowCount === 0 || locked.rows[0].stock_restored_at) return;

  await client.query(
    `UPDATE products p SET stock = stock + oi.quantity
     FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
    [orderId]
  );
  await client.query(
    `UPDATE product_variants pv SET stock = stock + oi.quantity
     FROM order_items oi
     WHERE oi.order_id = $1 AND oi.product_id = pv.product_id
       AND pv.color IS NOT DISTINCT FROM oi.selected_color
       AND pv.size IS NOT DISTINCT FROM oi.selected_size`,
    [orderId]
  );
  await client.query(`UPDATE orders SET stock_restored_at = now() WHERE id = $1`, [orderId]);
}

// Geocodes an order's delivery address exactly once (cached in `delivery_lat`/`delivery_lng`,
// with `delivery_geocoded_at` marking the attempt regardless of outcome) - repeat callers (every
// map poll) just read the cached result instead of hitting Nominatim again.
export async function getOrGeocodeDeliveryLocation(order: {
  id: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryGeocodedAt: string | null;
  deliveryStreetAddress: string;
  deliveryCityTown: string;
  deliveryDistrict: string;
  deliveryCountry: string;
}): Promise<{ lat: number; lng: number } | null> {
  if (order.deliveryGeocodedAt) {
    return order.deliveryLat != null && order.deliveryLng != null
      ? { lat: order.deliveryLat, lng: order.deliveryLng }
      : null;
  }
  // A full street-level address (real-world Kigali addresses, e.g. informal descriptions or a
  // road name Nominatim doesn't have mapped) often fails to match as one combined query even when
  // the city/district would resolve fine on their own - falling back to a broader query still
  // gets a useful district-level pin instead of nothing.
  const fullQuery = `${order.deliveryStreetAddress}, ${order.deliveryCityTown}, ${order.deliveryDistrict}, ${order.deliveryCountry}`;
  const location = await geocodeAddress(fullQuery)
    ?? await geocodeAddress(`${order.deliveryDistrict}, ${order.deliveryCityTown}, ${order.deliveryCountry}`)
    ?? await geocodeAddress(`${order.deliveryCityTown}, ${order.deliveryCountry}`);
  await pool.query(
    `UPDATE orders SET delivery_lat = $1, delivery_lng = $2, delivery_geocoded_at = now() WHERE id = $3`,
    [location?.lat ?? null, location?.lng ?? null, order.id]
  );
  return location;
}

export async function fetchOrderById(id: string) {
  const orderResult = await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`, [id]);
  if (orderResult.rowCount === 0) return null;

  const itemsByOrder = await fetchItemsForOrders([id]);
  const trackingResult = await pool.query(
    `SELECT id, status, event_date AS date, description FROM order_tracking_events WHERE order_id = $1 ORDER BY event_date`,
    [id]
  );
  const row = orderResult.rows[0];
  await attachRiderNames([row]);
  await attachReturnRequests([row]);
  return formatOrder(row, itemsByOrder.get(id) ?? [], trackingResult.rows);
}

// GET /api/orders - authenticated: admin sees all, user sees own
router.get('/', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.authUser!.role === 'admin';
    const result = isAdmin
      ? await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders ORDER BY order_date DESC`)
      : await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE user_id = $1 ORDER BY order_date DESC`, [req.authUser!.id]);

    const itemsByOrder = await fetchItemsForOrders(result.rows.map((r) => r.id));
    await attachRiderNames(result.rows);
    await attachReturnRequests(result.rows);
    const orders = result.rows.map((row) => formatOrder(row, itemsByOrder.get(row.id) ?? []));
    return res.json({ orders });
  } catch (err) {
    return next(err);
  }
});

// GET /api/orders/:id - authenticated: owner or admin
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const order = await fetchOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (req.authUser!.role !== 'admin' && order.userId !== req.authUser!.id) {
      return res.status(403).json({ error: 'You do not have access to this order.' });
    }
    return res.json({ order });
  } catch (err) {
    return next(err);
  }
});

export const deliveryAddressSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  phoneNumber: z.string().trim().min(1, 'Phone number is required'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  country: z.string().trim().min(1, 'Country is required'),
  cityTown: z.string().trim().min(1, 'City/Town is required'),
  district: z.string().trim().min(1, 'District is required'),
  streetAddress: z.string().trim().min(1, 'Street address is required'),
  houseBuildingNumber: z.string().trim().optional(),
  additionalInfo: z.string().trim().optional(),
});

const orderItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().trim().min(1),
  image: z.string().optional(),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  selectedColor: z.string().optional(),
  selectedSize: z.string().optional(),
});

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required'),
  deliveryAddress: deliveryAddressSchema,
  currency: z.string().trim().optional(),
  // Set directly for manual/pay-on-delivery methods; for MTN MoMo it's set once /momo/status confirms payment.
  paymentMethod: z.string().trim().optional(),
  couponCode: z.string().trim().optional(),
  items: z.array(orderItemSchema).min(1, 'Order must include at least one item'),
  // Required to place any order - proves control of deliveryAddress.email, see
  // POST /verification/verify above.
  verificationToken: z.string().optional(),
});

// Shared by POST / below and the group-buying endpoints (routes/groupOrders.ts) - both need the
// exact same stock-locking/pricing logic, just with a different discount source (a coupon code vs
// a group-buy tier percentage) and, for a group participant, a group_order_id to tag the row with.
export async function insertOrder(
  client: PoolClient,
  data: z.infer<typeof createOrderSchema>,
  userId: string | null,
  opts?: { groupOrderId?: string; groupDiscountPercent?: number }
): Promise<string> {
  const resolvedItems: (typeof data.items[number] & { name: string })[] = [];
  for (const item of data.items) {
    if (item.productId) {
      // Lock the row so concurrent checkouts can't both oversell the same last units, and so
      // the price this order is charged can't change out from under it either.
      const productResult = await client.query(
        `SELECT name, price, discount, stock FROM products WHERE id = $1 FOR UPDATE`,
        [item.productId]
      );
      if (productResult.rowCount === 0) {
        throw new HttpError(400, `"${item.name}" no longer exists.`);
      }
      const { name, price, discount, stock } = productResult.rows[0];

      // A selected color/size is limited by that specific variant's own stock, not just the
      // product's aggregate - the aggregate being non-zero doesn't mean this exact combination
      // has any left, so checking only the total risks overselling one popular variant while
      // the product as a whole still looks in stock.
      let variantId: string | null = null;
      if (item.selectedColor || item.selectedSize) {
        const variantResult = await client.query(
          `SELECT id, stock FROM product_variants
           WHERE product_id = $1 AND color IS NOT DISTINCT FROM $2 AND size IS NOT DISTINCT FROM $3
           FOR UPDATE`,
          [item.productId, item.selectedColor ?? null, item.selectedSize ?? null]
        );
        if (variantResult.rowCount! > 0) {
          const variant = variantResult.rows[0];
          const variantLabel = [item.selectedColor, item.selectedSize].filter(Boolean).join(' / ');
          if (variant.stock < item.quantity) {
            throw new HttpError(
              409,
              variant.stock > 0
                ? `Only ${variant.stock} left of "${name}" (${variantLabel}) (requested ${item.quantity}).`
                : `"${name}" (${variantLabel}) is out of stock.`
            );
          }
          variantId = variant.id;
        }
      }

      if (stock < item.quantity) {
        throw new HttpError(
          409,
          stock > 0 ? `Only ${stock} left of "${name}" (requested ${item.quantity}).` : `"${name}" is out of stock.`
        );
      }
      await client.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [item.quantity, item.productId]);
      if (variantId) {
        await client.query(`UPDATE product_variants SET stock = stock - $1 WHERE id = $2`, [item.quantity, variantId]);
      }
      const effectivePrice = Math.round(Number(price) * (1 - Number(discount ?? 0) / 100) * 100) / 100;
      resolvedItems.push({ ...item, price: effectivePrice, name });
    } else {
      resolvedItems.push({ ...item, name: item.name });
    }
  }

  const subtotal = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { fee: shippingFee, zoneName: shippingZone } = await calculateShippingFee(data.deliveryAddress.district, subtotal);

  let discountAmount = 0;
  let couponCode: string | null = null;
  if (opts?.groupOrderId) {
    // Group-buy orders never stack with a coupon (validated in the request schema) - the discount
    // comes solely from how many people have joined the group so far, recomputed as the group grows
    // (see finalizeGroupOrder in routes/groupOrders.ts).
    if (opts.groupDiscountPercent) {
      discountAmount = Math.round(subtotal * opts.groupDiscountPercent / 100 * 100) / 100;
    }
  } else if (data.couponCode) {
    const coupon = await validateCoupon(data.couponCode, subtotal, client);
    discountAmount = coupon.discountAmount;
    couponCode = coupon.code;
    await client.query(`UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1`, [coupon.id]);
  }
  const total = Math.max(0, subtotal + shippingFee - discountAmount); // no tax

  const orderResult = await client.query(
    `INSERT INTO orders (
       user_id, customer_name, delivery_full_name, delivery_phone_number, customer_email, delivery_country,
       delivery_city_town, delivery_district, delivery_street_address, delivery_house_building_no,
       delivery_additional_info, subtotal, shipping_fee, shipping_zone, coupon_code, discount_amount, total, currency, payment_method,
       group_order_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING id`,
    [
      userId, data.customerName, data.deliveryAddress.fullName,
      data.deliveryAddress.phoneNumber, data.deliveryAddress.email, data.deliveryAddress.country, data.deliveryAddress.cityTown,
      data.deliveryAddress.district, data.deliveryAddress.streetAddress,
      data.deliveryAddress.houseBuildingNumber ?? null, data.deliveryAddress.additionalInfo ?? null,
      subtotal, shippingFee, shippingZone, couponCode, discountAmount, total, data.currency ?? null, data.paymentMethod ?? null,
      opts?.groupOrderId ?? null,
    ]
  );
  const orderId = orderResult.rows[0].id;

  for (const item of resolvedItems) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, image, unit_price, quantity, selected_color, selected_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [orderId, item.productId ?? null, item.name, item.image ?? null, item.price, item.quantity, item.selectedColor ?? null, item.selectedSize ?? null]
    );
  }

  await client.query(
    `INSERT INTO order_tracking_events (order_id, status, description) VALUES ($1, 'Pending', 'Order placed')`,
    [orderId]
  );

  return orderId;
}

// POST /api/orders - guest checkout allowed; links to the account if logged in.
// subtotal/shipping/tax/discount/total are always computed server-side, never trusted from the
// client - including the per-item unit price. For any item with a productId, the price the
// client sent is ignored entirely and replaced with that product's current price/discount read
// straight from the database (locked, so a concurrent price change can't race it either);
// otherwise a tampered request body could buy a real, stocked product for whatever price it liked
// and have that price honored all the way through to the MTN MoMo charge.
router.post('/', orderCreateLimiter, optionalAuthenticate, requireCustomer, async (req, res, next) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  // Every order requires proof the customer controls the email on it, gathered right before this
  // call via POST /verification/request + /verify above - there's no live payment gateway yet to
  // gate placing an order on instead.
  let verifiedEmail: string;
  try {
    verifiedEmail = data.verificationToken ? verifyCheckoutVerificationToken(data.verificationToken) : '';
  } catch {
    verifiedEmail = '';
  }
  if (verifiedEmail !== data.deliveryAddress.email) {
    return res.status(403).json({ error: 'Please verify your email before placing this order.' });
  }

  try {
    const orderId = await withTransaction((client) => insertOrder(client, data, req.authUser?.id ?? null));
    return res.status(201).json({ order: await fetchOrderById(orderId) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return res.status(400).json({ error: 'One or more products in this order no longer exist.' });
    }
    return next(err);
  }
});

const statusSchema = z.object({
  status: z.enum(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned']),
});

// PATCH /api/orders/:id - admin: update order status (records a tracking event)
router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const previousStatus = await withTransaction(async (client) => {
      const before = await client.query(`SELECT status FROM orders WHERE id = $1`, [req.params.id]);
      if (before.rowCount === 0) throw new HttpError(404, 'Order not found.');

      await client.query(`UPDATE orders SET status = $1 WHERE id = $2`, [parsed.data.status, req.params.id]);
      await client.query(
        `INSERT INTO order_tracking_events (order_id, status, description) VALUES ($1, $2, $3)`,
        [req.params.id, parsed.data.status, `Status changed to ${parsed.data.status}`]
      );

      // Cancelling or (manually, outside the formal request flow) marking an order Returned both
      // release the stock it held back to inventory - the product's aggregate total and, for items
      // that had a color/size, that specific variant's own stock.
      if (
        (parsed.data.status === 'Cancelled' && before.rows[0].status !== 'Cancelled') ||
        (parsed.data.status === 'Returned' && before.rows[0].status !== 'Returned')
      ) {
        await restoreOrderStock(client, req.params.id);
      }

      // A delivery verification code is generated the moment an order goes out for delivery - the
      // customer sees it on their tracking page, and only entering it correctly (the rider asks
      // for it on arrival) actually completes the delivery, not a self-serve button or a wait on
      // the admin. Only on the transition, so re-saving "Shipped" doesn't hand out a new code.
      if (parsed.data.status === 'Shipped' && before.rows[0].status !== 'Shipped') {
        const code = crypto.randomInt(1000, 10000).toString();
        await client.query(`UPDATE orders SET delivery_verification_code = $1 WHERE id = $2`, [code, req.params.id]);
      }

      return before.rows[0].status;
    });

    const order = await fetchOrderById(req.params.id);
    // Only on the transition into Processing, not on every subsequent save of that status.
    if (parsed.data.status === 'Processing' && previousStatus !== 'Processing' && order?.deliveryAddress.email) {
      sendOrderProcessingEmail(order.deliveryAddress.email, order.customerName, order.orderNumber);
    }
    // Push, not just email - only for the statuses a customer would actually want to know about
    // right away, and only accounts with the mobile app installed (order.userId is null for guest
    // checkouts, and sendPushToUser itself no-ops for an account with no registered device).
    if (order?.userId && parsed.data.status !== previousStatus && ['Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(parsed.data.status)) {
      const orderLabel = `#${order.orderNumber}`;
      const pushCopy: Record<string, string> = {
        Processing: `Your order ${orderLabel} is being prepared.`,
        Shipped: `Your order ${orderLabel} is on its way!`,
        Delivered: `Your order ${orderLabel} has been delivered.`,
        Cancelled: `Your order ${orderLabel} was cancelled.`,
      };
      sendPushToUser(order.userId, 'Order update', pushCopy[parsed.data.status], { orderId: order.id, type: 'order-status' });
    }
    // Cancelling or returning just restored stock for these items above - anyone waiting on a
    // back-in-stock signup for one of them may now be satisfied.
    if (
      ((parsed.data.status === 'Cancelled' && previousStatus !== 'Cancelled') ||
        (parsed.data.status === 'Returned' && previousStatus !== 'Returned')) &&
      order
    ) {
      const productIds = new Set<string>(
        order.items.map((item: { productId?: string }) => item.productId).filter((id: string | undefined): id is string => !!id)
      );
      for (const productId of productIds) checkAndNotifyRestock(productId);
    }
    return res.json({ order });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

// PATCH /api/orders/:id/confirm-payment - admin: mark a manually-paid order (bank transfer, cash on
// delivery, etc.) as paid once payment has been verified. MTN MoMo orders are already marked 'paid'
// automatically when the payment succeeds (see momo.ts), so this only applies to manual methods.
// Stock for the order's items was already reserved/deducted when the order was placed (see POST /
// above) so no stock changes happen here - this just records that payment has been verified.
router.patch('/:id/confirm-payment', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const before = await client.query(`SELECT payment_status FROM orders WHERE id = $1`, [req.params.id]);
      if (before.rowCount === 0) throw new HttpError(404, 'Order not found.');
      if (before.rows[0].payment_status === 'paid') throw new HttpError(409, 'This order is already marked as paid.');

      await client.query(`UPDATE orders SET payment_status = 'paid' WHERE id = $1`, [req.params.id]);
      await client.query(
        `INSERT INTO order_tracking_events (order_id, status, description) VALUES ($1, 'Payment Confirmed', 'Payment confirmed by admin')`,
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

const assignRiderSchema = z.object({
  riderId: z.string().nullable(),
});

// PATCH /api/orders/:id/rider - admin: assign (or unassign, with riderId: null) a delivery rider
router.patch('/:id/rider', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = assignRiderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    if (parsed.data.riderId) {
      const riderCheck = await pool.query(`SELECT 1 FROM users WHERE id = $1 AND role = 'rider'`, [parsed.data.riderId]);
      if (riderCheck.rowCount === 0) return res.status(400).json({ error: 'That user is not a rider.' });
    }
    const before = await pool.query(`SELECT rider_id AS "riderId" FROM orders WHERE id = $1`, [req.params.id]);
    if (before.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    const previousRiderId = before.rows[0].riderId;
    // A genuine reassignment - handed from one rider straight to a different one, not a first
    // assignment (previous was null) and not a plain unassignment (new is null) - is the only
    // case that needs to notify anyone; those two are routine admin actions with no one left
    // holding a stale delivery to be surprised about.
    const isReassignment = previousRiderId && parsed.data.riderId && previousRiderId !== parsed.data.riderId;
    await pool.query(
      `UPDATE orders SET rider_id = $1, previous_rider_id = $2, rider_reassigned_at = $3 WHERE id = $4`,
      [parsed.data.riderId, isReassignment ? previousRiderId : null, isReassignment ? new Date() : null, req.params.id]
    );
    return res.json({ order: await fetchOrderById(req.params.id) });
  } catch (err) {
    return next(err);
  }
});

// GET /api/orders/:id/rider-location - authenticated: owner or admin. Only ever returns a
// location while the order is still Shipped - once Delivered/Cancelled, a customer shouldn't
// keep seeing a rider's live position, even if their last-known spot is still on file.
router.get('/:id/rider-location', authenticate, async (req, res, next) => {
  try {
    const orderResult = await pool.query(
      `SELECT user_id AS "userId", rider_id AS "riderId", status,
              delivery_lat AS "deliveryLat", delivery_lng AS "deliveryLng", delivery_geocoded_at AS "deliveryGeocodedAt",
              delivery_street_address AS "deliveryStreetAddress", delivery_city_town AS "deliveryCityTown",
              delivery_district AS "deliveryDistrict", delivery_country AS "deliveryCountry",
              arrival_notified_at AS "arrivalNotifiedAt", rider_reassigned_at AS "riderReassignedAt"
       FROM orders WHERE id = $1`,
      [req.params.id]
    );
    if (orderResult.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    const order = orderResult.rows[0];
    if (req.authUser!.role !== 'admin' && order.userId !== req.authUser!.id) {
      return res.status(403).json({ error: 'You do not have access to this order.' });
    }
    const destination = await getOrGeocodeDeliveryLocation({ ...order, id: req.params.id });
    if (!order.riderId || order.status !== 'Shipped') {
      return res.json({ riderId: order.riderId ?? null, riderName: null, location: null, isSharing: false, destination, arrivalNotifiedAt: null, riderReassignedAt: null });
    }
    const result = await pool.query(
      `SELECT u.name AS "riderName", rl.lat, rl.lng, rl.updated_at AS "updatedAt", rl.sharing_active AS "sharingActive"
       FROM users u LEFT JOIN rider_locations rl ON rl.rider_id = u.id
       WHERE u.id = $1`,
      [order.riderId]
    );
    const row = result.rows[0];
    return res.json({
      riderId: order.riderId,
      riderName: row?.riderName ?? null,
      location: row?.lat != null ? { lat: row.lat, lng: row.lng, updatedAt: row.updatedAt } : null,
      isSharing: row?.sharingActive ?? false,
      destination,
      arrivalNotifiedAt: order.arrivalNotifiedAt,
      riderReassignedAt: order.riderReassignedAt,
    });
  } catch (err) {
    return next(err);
  }
});

const sendInvoiceSchema = z.object({
  pdfBase64: z.string().min(1, 'A PDF is required'),
});

// POST /api/orders/:id/send-invoice - admin: email the given invoice PDF to the order's customer
router.post('/:id/send-invoice', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = sendInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const order = await fetchOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!order.deliveryAddress.email) {
      return res.status(400).json({ error: 'This order has no email address on file.' });
    }

    const sent = await sendInvoiceEmail(order.deliveryAddress.email, order.customerName, order.orderNumber, parsed.data.pdfBase64);
    if (!sent) {
      return res.status(502).json({ error: 'Could not send the invoice email. Check the Brevo configuration.' });
    }
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/orders/:id - admin
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM orders WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/orders/:id/read - admin: mark an order notification as read
router.patch('/:id/read', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE orders SET is_unread = false WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    return res.json({ order: await fetchOrderById(req.params.id) });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/orders/:id/acknowledge-rider-stop - admin: dismiss the "rider stopped sharing"
// notification for this order (the fact that it happened stays on record - only the unread flag
// clears, matching how the other notification types in the admin panel behave).
router.patch('/:id/acknowledge-rider-stop', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE orders SET rider_stop_alert_unread = false WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    return res.json({ order: await fetchOrderById(req.params.id) });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/orders/:id/acknowledge-delivery - admin: dismiss the "delivered successfully"
// notification for this order (the fact that it happened stays on record - only the unread flag
// clears, matching every other notification type in the admin panel).
router.patch('/:id/acknowledge-delivery', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE orders SET delivery_confirmed_unread = false WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    return res.json({ order: await fetchOrderById(req.params.id) });
  } catch (err) {
    return next(err);
  }
});

export default router;

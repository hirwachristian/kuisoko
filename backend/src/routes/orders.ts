import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { calculateShippingFee } from '../lib/shipping.js';
import { validateCoupon } from '../lib/coupons.js';
import { sendOrderProcessingEmail, sendInvoiceEmail } from '../lib/brevo.js';

const router = Router();

const ORDER_COLUMNS = `
  id, 'KS-' || order_number AS "orderNumber", user_id AS "userId", customer_name AS "customerName",
  delivery_full_name AS "deliveryFullName", delivery_phone_number AS "deliveryPhoneNumber", customer_email AS "customerEmail",
  delivery_country AS "deliveryCountry", delivery_city_town AS "deliveryCityTown",
  delivery_district AS "deliveryDistrict", delivery_street_address AS "deliveryStreetAddress",
  delivery_house_building_no AS "deliveryHouseBuildingNumber", delivery_additional_info AS "deliveryAdditionalInfo",
  order_date AS date, subtotal, shipping_fee AS "shippingFee", shipping_zone AS "shippingZone", tax,
  coupon_code AS "couponCode", discount_amount AS "discountAmount",
  total, currency, status, payment_status AS "paymentStatus", payment_method AS "paymentMethod", is_unread AS unread
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

async function fetchOrderById(id: string) {
  const orderResult = await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`, [id]);
  if (orderResult.rowCount === 0) return null;

  const itemsByOrder = await fetchItemsForOrders([id]);
  const trackingResult = await pool.query(
    `SELECT id, status, event_date AS date, description FROM order_tracking_events WHERE order_id = $1 ORDER BY event_date`,
    [id]
  );
  return formatOrder(orderResult.rows[0], itemsByOrder.get(id) ?? [], trackingResult.rows);
}

// GET /api/orders - authenticated: admin sees all, user sees own
router.get('/', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.authUser!.role === 'admin';
    const result = isAdmin
      ? await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders ORDER BY order_date DESC`)
      : await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE user_id = $1 ORDER BY order_date DESC`, [req.authUser!.id]);

    const itemsByOrder = await fetchItemsForOrders(result.rows.map((r) => r.id));
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

const deliveryAddressSchema = z.object({
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

const createOrderSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required'),
  deliveryAddress: deliveryAddressSchema,
  currency: z.string().trim().optional(),
  // Set directly for manual/pay-on-delivery methods; for MTN MoMo it's set once /momo/status confirms payment.
  paymentMethod: z.string().trim().optional(),
  couponCode: z.string().trim().optional(),
  items: z.array(orderItemSchema).min(1, 'Order must include at least one item'),
});

// POST /api/orders - guest checkout allowed; links to the account if logged in.
// subtotal/shipping/tax/discount/total are always computed server-side, never trusted from the client.
router.post('/', optionalAuthenticate, async (req, res, next) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  try {
    const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const { fee: shippingFee, zoneName: shippingZone } = await calculateShippingFee(data.deliveryAddress.district, subtotal);

    const orderId = await withTransaction(async (client) => {
      let discountAmount = 0;
      let couponCode: string | null = null;
      if (data.couponCode) {
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
           delivery_additional_info, subtotal, shipping_fee, shipping_zone, coupon_code, discount_amount, total, currency, payment_method
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING id`,
        [
          req.authUser?.id ?? null, data.customerName, data.deliveryAddress.fullName,
          data.deliveryAddress.phoneNumber, data.deliveryAddress.email, data.deliveryAddress.country, data.deliveryAddress.cityTown,
          data.deliveryAddress.district, data.deliveryAddress.streetAddress,
          data.deliveryAddress.houseBuildingNumber ?? null, data.deliveryAddress.additionalInfo ?? null,
          subtotal, shippingFee, shippingZone, couponCode, discountAmount, total, data.currency ?? null, data.paymentMethod ?? null,
        ]
      );
      const orderId = orderResult.rows[0].id;

      for (const item of data.items) {
        if (item.productId) {
          // Lock the row so concurrent checkouts can't both oversell the same last units.
          const stockResult = await client.query(
            `SELECT name, stock FROM products WHERE id = $1 FOR UPDATE`,
            [item.productId]
          );
          if (stockResult.rowCount === 0) {
            throw new HttpError(400, `"${item.name}" no longer exists.`);
          }
          const { name, stock } = stockResult.rows[0];
          if (stock < item.quantity) {
            throw new HttpError(
              409,
              stock > 0 ? `Only ${stock} left of "${name}" (requested ${item.quantity}).` : `"${name}" is out of stock.`
            );
          }
          await client.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [item.quantity, item.productId]);
        }

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
    });

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
  status: z.enum(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']),
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

      // Cancelling an order releases the stock it held back to inventory.
      if (parsed.data.status === 'Cancelled' && before.rows[0].status !== 'Cancelled') {
        await client.query(
          `UPDATE products p SET stock = stock + oi.quantity
           FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
          [req.params.id]
        );
      }

      return before.rows[0].status;
    });

    const order = await fetchOrderById(req.params.id);
    // Only on the transition into Processing, not on every subsequent save of that status.
    if (parsed.data.status === 'Processing' && previousStatus !== 'Processing' && order?.deliveryAddress.email) {
      sendOrderProcessingEmail(order.deliveryAddress.email, order.customerName, order.orderNumber);
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

export default router;

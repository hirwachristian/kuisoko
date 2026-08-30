import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import wishlistRouter from './routes/wishlist.js';
import newsletterRouter from './routes/newsletter.js';
import notificationsRouter from './routes/notifications.js';
import settingsRouter from './routes/settings.js';
import uploadsRouter from './routes/uploads.js';
import reviewsRouter from './routes/reviews.js';
import shippingRouter from './routes/shipping.js';
import momoRouter from './routes/momo.js';
import announcementsRouter from './routes/announcements.js';
import couponsRouter from './routes/coupons.js';
import chatRouter from './routes/chat.js';
import enquiriesRouter from './routes/enquiries.js';
import { UPLOADS_DIR } from './lib/uploads.js';

const app = express();

// crossOriginResourcePolicy relaxed to 'cross-origin' so the frontend (a different origin/port)
// can load images served from /uploads - helmet's default 'same-origin' would block them.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' })); // images now go through /api/uploads as real files, not base64 JSON; 10mb covers a base64-encoded invoice PDF for /orders/:id/send-invoice
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/momo', momoRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/enquiries', enquiriesRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That file is too large.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
};
app.use(errorHandler);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

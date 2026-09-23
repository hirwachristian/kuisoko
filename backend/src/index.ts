import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import wishlistRouter from './routes/wishlist.js';
import addressesRouter from './routes/addresses.js';
import cartRouter from './routes/cart.js';
import newsletterRouter from './routes/newsletter.js';
import notificationsRouter from './routes/notifications.js';
import settingsRouter from './routes/settings.js';
import uploadsRouter from './routes/uploads.js';
import reviewsRouter from './routes/reviews.js';
import shippingRouter from './routes/shipping.js';
import momoRouter from './routes/momo.js';
import paypackRouter from './routes/paypack.js';
import announcementsRouter from './routes/announcements.js';
import couponsRouter from './routes/coupons.js';
import chatRouter from './routes/chat.js';
import enquiriesRouter from './routes/enquiries.js';
import ridersRouter from './routes/riders.js';
import returnsRouter from './routes/returns.js';
import groupOrdersRouter from './routes/groupOrders.js';
import { UPLOADS_DIR } from './lib/uploads.js';
import { initMonitoring, captureError } from './lib/monitoring.js';
import { scheduleBackups } from './lib/backup.js';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

initMonitoring();

const app = express();

// Railway (and most hosts) sit the app behind a single reverse proxy, which sets X-Forwarded-For.
// Without this, express-rate-limit refuses to start (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) since it
// can't safely tell which IP to key on - crashing the whole process on the first rate-limited
// request. `1` trusts exactly one hop (the proxy immediately in front), which matches this setup;
// harmless locally too, since there's no proxy there to send that header in the first place.
app.set('trust proxy', 1);

// crossOriginResourcePolicy relaxed to 'cross-origin' so the frontend (a different origin/port)
// can load images served from /uploads - helmet's default 'same-origin' would block them.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Gzip every JSON response over Express's default (uncompressed) - a products/orders list can
// easily be 30-50kb of JSON, which compresses to a fraction of that.
app.use(compression());

// CORS_ORIGIN can be a single URL or a comma-separated list (e.g. a custom domain alongside the
// Railway one during a migration, or a staging URL) - an explicit allowlist either way, never a
// wildcard, since every authenticated request here carries a real Bearer token. `credentials` is
// deliberately left at its default `false`: this app has no cookies for the browser to send
// cross-origin in the first place, so there's nothing for that flag to protect. `methods` and
// `allowedHeaders` are spelled out explicitly rather than left to the library's defaults (which
// reflect back whatever the browser's preflight asks for) - functionally equivalent for this
// app's actual traffic, but an explicit allowlist is clearer to audit than an implicit one.
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Response headers are hidden from client-side JS on a cross-origin request unless explicitly
  // exposed here - without this, a rate-limited response's Retry-After is invisible to the
  // frontend, so a lockout screen has no way to say how long to wait.
  exposedHeaders: ['Retry-After'],
  maxAge: 86400, // lets the browser cache a preflight's result for a day instead of re-asking on every request
}));
// `verify` stashes the exact raw bytes of every request body onto req.rawBody - the Paypack
// webhook needs them to check its HMAC signature, since a re-serialized JSON.stringify(req.body)
// is not guaranteed to byte-for-byte match what Paypack actually signed.
app.use(express.json({
  limit: '10mb', // images now go through /api/uploads as real files, not base64 JSON; 10mb covers a base64-encoded invoice PDF for /orders/:id/send-invoice
  verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; }, // body-parser's own Request type predates this augmentation, hence the cast
}));
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
app.use('/api/addresses', addressesRouter);
app.use('/api/cart', cartRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/momo', momoRouter);
app.use('/api/paypack', paypackRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/enquiries', enquiriesRouter);
app.use('/api/riders', ridersRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/group-orders', groupOrdersRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That file is too large.' });
  }
  console.error(err);
  captureError(err);
  res.status(500).json({ error: 'Something went wrong.' });
};
app.use(errorHandler);

process.on('unhandledRejection', captureError);
process.on('uncaughtException', captureError);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

scheduleBackups();

import type { RequestHandler } from 'express';
import { verifyToken } from '../lib/auth.js';
import { pool } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: { id: string; role: 'user' | 'admin' | 'rider' };
    }
  }
}

function extractToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  return authorizationHeader.slice(7);
}

// Throttle window for the presence update below - avoids a write on every single authenticated
// admin request while still keeping "online" accurate to within a couple of minutes.
const PRESENCE_UPDATE_THROTTLE_INTERVAL = '60 seconds';

/** Fire-and-forget: marks an admin as recently active, skipping the write entirely if it was
 * already refreshed within the throttle window. Never awaited by callers - a slow/failed update
 * here must not add latency or errors to the request that triggered it. */
function markAdminActive(userId: string): void {
  pool.query(
    `UPDATE users SET last_active_at = now()
     WHERE id = $1 AND (last_active_at IS NULL OR last_active_at < now() - interval '${PRESENCE_UPDATE_THROTTLE_INTERVAL}')`,
    [userId]
  ).catch((err) => console.error('Could not update admin presence:', err));
}

/** Requires a valid token; rejects the request otherwise. */
export const authenticate: RequestHandler = (req, res, next) => {
  const token = extractToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = verifyToken(token);
    req.authUser = { id: payload.sub, role: payload.role };
    if (payload.role === 'admin') markAdminActive(payload.sub);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

/** Attaches the user if a valid token is present, but never rejects (for guest-allowed routes). */
export const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  const token = extractToken(req.headers.authorization);
  if (token) {
    try {
      const payload = verifyToken(token);
      req.authUser = { id: payload.sub, role: payload.role };
    } catch {
      // ignore invalid token, proceed as guest
    }
  }
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.authUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

export const requireRider: RequestHandler = (req, res, next) => {
  if (req.authUser?.role !== 'rider') {
    return res.status(403).json({ error: 'Rider access required.' });
  }
  next();
};

/** Blocks admin/rider accounts from customer-only actions (cart, wishlist, placing orders).
 * A guest - no req.authUser at all - passes through untouched, so this composes with
 * optionalAuthenticate on routes that allow guest checkout, not just authenticate. */
export const requireCustomer: RequestHandler = (req, res, next) => {
  if (req.authUser && req.authUser.role !== 'user') {
    return res.status(403).json({ error: 'This action is only available to customer accounts.' });
  }
  next();
};

import type { RequestHandler } from 'express';
import { verifyToken } from '../lib/auth.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: { id: string; role: 'user' | 'admin' };
    }
  }
}

function extractToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  return authorizationHeader.slice(7);
}

/** Requires a valid token; rejects the request otherwise. */
export const authenticate: RequestHandler = (req, res, next) => {
  const token = extractToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = verifyToken(token);
    req.authUser = { id: payload.sub, role: payload.role };
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

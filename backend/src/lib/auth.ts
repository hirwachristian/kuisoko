import jwt from 'jsonwebtoken';

export interface AuthTokenPayload {
  sub: string; // user id
  role: 'user' | 'admin';
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return secret;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

// A real session token never carries a `purpose` claim - reject anything that does, so a
// short-lived 2FA-pending token (signed with the same secret, see below) can never be replayed
// as a normal Bearer token against an authenticated route while its 2FA step is still outstanding.
export function verifyToken(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, getSecret()) as AuthTokenPayload & { purpose?: string };
  if (payload.purpose) {
    throw new Error('This token cannot be used for authentication.');
  }
  return payload;
}

// Issued after a correct email+password when the account has 2FA enabled - proves "you passed
// step one" without granting any actual access. Deliberately short-lived and narrow: it carries
// no role, can't be used with `authenticate` (verifyToken rejects any `purpose` claim above), and
// is only ever accepted by the /auth/2fa/* routes below, which re-derive the real session token
// only after the emailed code is also verified.
export function signTwoFactorPendingToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: '2fa-pending' }, getSecret(), { expiresIn: '10m' });
}

export function verifyTwoFactorPendingToken(token: string): string {
  const payload = jwt.verify(token, getSecret()) as { sub: string; purpose?: string };
  if (payload.purpose !== '2fa-pending') {
    throw new Error('Invalid token.');
  }
  return payload.sub;
}

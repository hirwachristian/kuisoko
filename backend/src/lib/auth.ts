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

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getSecret()) as AuthTokenPayload;
}

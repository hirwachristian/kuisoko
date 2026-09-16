import crypto from 'node:crypto';

const BASE_URL = process.env.PAYPACK_BASE_URL ?? 'https://payments.paypack.rw/api';
// Sent as X-Webhook-Mode on cashin so Paypack fires the matching (development vs production)
// webhook configured in the dashboard - see https://docs.paypack.rw/quickstart/webhooks.
const WEBHOOK_MODE = process.env.PAYPACK_ENVIRONMENT ?? 'development';

function isConfigured(): boolean {
  return Boolean(process.env.PAYPACK_CLIENT_ID && process.env.PAYPACK_CLIENT_SECRET);
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new Error('Paypack is not configured. Set PAYPACK_CLIENT_ID and PAYPACK_CLIENT_SECRET in server/.env.');
  }
}

/** Normalizes a Rwandan phone number to the local 10-digit format Paypack expects, e.g. "0788123456". */
export function normalizeRwandaLocalPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/[^\d]/g, '');
  if (digits.startsWith('250')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  return `0${digits}`;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(forceRefresh = false): Promise<string> {
  assertConfigured();
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.value;
  }
  const res = await fetch(`${BASE_URL}/auth/agents/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PAYPACK_CLIENT_ID,
      client_secret: process.env.PAYPACK_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(`Paypack auth failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access: string };
  // Access tokens are documented to last 15 minutes; cached a bit under that rather than trusting
  // the exact shape of the API's `expires` field, which isn't consistently documented.
  cachedToken = { value: data.access, expiresAt: Date.now() + 13 * 60 * 1000 };
  return cachedToken.value;
}

/** Calls a Paypack endpoint with a valid access token, retrying once (with a fresh token) on 401. */
async function paypackFetch(path: string, init: RequestInit, allowRetry = true): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      // Paypack's own SDK sends the raw access token here, with no "Bearer " prefix.
      Authorization: token,
    },
  });
  if (res.status === 401 && allowRetry) {
    cachedToken = null;
    return paypackFetch(path, init, false);
  }
  return res;
}

export type PaypackStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

/** Maps Paypack's lowercase transaction/event statuses onto the same PENDING/SUCCESSFUL/FAILED
 * enum the MTN MoMo integration uses, so both providers' routes and the frontend can share code. */
export function normalizePaypackStatus(status: string): PaypackStatus {
  const s = status.toLowerCase();
  if (s === 'successful' || s === 'success') return 'SUCCESSFUL';
  if (s === 'failed') return 'FAILED';
  return 'PENDING';
}

/** Triggers the cashin prompt on the payer's phone. Resolves once Paypack accepts the request - not once it's approved. */
export async function cashin(params: { amount: number; phoneNumber: string }): Promise<{ ref: string }> {
  assertConfigured();
  const res = await paypackFetch('/transactions/cashin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Webhook-Mode': WEBHOOK_MODE,
      'Idempotency-Key': crypto.randomUUID().replace(/-/g, ''), // Paypack requires exactly 32 characters; a UUID is 36 with its dashes
    },
    body: JSON.stringify({ amount: Math.round(params.amount), number: params.phoneNumber }),
  });
  if (!res.ok) {
    throw new Error(`Paypack cashin failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { ref: string };
  return { ref: data.ref };
}

/** Polls Paypack for the current status of a previously-submitted cashin.
 *
 * Two undocumented behaviors observed with a real cashin during integration testing, neither of
 * which matches Paypack's published API reference:
 *  - A just-created transaction can briefly 404 here before Paypack finishes indexing it -
 *    treated as still pending rather than surfacing an error mid-poll.
 *  - Once a transaction actually settles, its record drops the `status` field entirely (a still-
 *    pending one carries `status: "pending"`; a settled one just has `fee`/`merchant`/`timestamp`
 *    populated and no `status` key at all). Reaching this codepath - a fee was charged - only
 *    happens once money has actually moved, so it's treated as SUCCESSFUL. */
export async function findTransaction(ref: string): Promise<{ status: PaypackStatus }> {
  assertConfigured();
  const res = await paypackFetch(`/transactions/find/${ref}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) {
    return { status: 'PENDING' };
  }
  if (!res.ok) {
    throw new Error(`Paypack transaction lookup failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { status?: string };
  if (!data.status) {
    return { status: 'SUCCESSFUL' };
  }
  return { status: normalizePaypackStatus(data.status) };
}

/** Verifies the `x-paypack-signature` header on an incoming webhook request: an HMAC-SHA256 digest
 * of the raw request body, keyed with the webhook secret and base64-encoded. Requires the exact
 * raw bytes Paypack signed - a re-serialized `JSON.stringify(req.body)` will not reliably match. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !process.env.PAYPACK_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', process.env.PAYPACK_WEBHOOK_SECRET).update(rawBody).digest('base64');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export { isConfigured as isPaypackConfigured };

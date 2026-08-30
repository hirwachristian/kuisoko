import crypto from 'node:crypto';

const BASE_URL = process.env.MOMO_BASE_URL ?? 'https://sandbox.momodeveloper.mtn.com';
const TARGET_ENVIRONMENT = process.env.MOMO_TARGET_ENVIRONMENT ?? 'sandbox';
// MTN's sandbox only accepts EUR; a live Rwanda merchant account uses RWF.
const CURRENCY = process.env.MOMO_CURRENCY ?? (TARGET_ENVIRONMENT === 'sandbox' ? 'EUR' : 'RWF');

function isConfigured(): boolean {
  return Boolean(process.env.MOMO_SUBSCRIPTION_KEY && process.env.MOMO_API_USER && process.env.MOMO_API_KEY);
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new Error('MTN MoMo is not configured. Set MOMO_SUBSCRIPTION_KEY, MOMO_API_USER and MOMO_API_KEY in server/.env.');
  }
}

/** Normalizes a Rwandan phone number to the MSISDN format MTN expects, e.g. "250788123456". */
export function normalizeRwandaMsisdn(rawPhone: string): string {
  const digits = rawPhone.replace(/[^\d]/g, '');
  if (digits.startsWith('250')) return digits;
  if (digits.startsWith('0')) return `250${digits.slice(1)}`;
  return digits;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  assertConfigured();
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.value;
  }
  const basicAuth = Buffer.from(`${process.env.MOMO_API_USER}:${process.env.MOMO_API_KEY}`).toString('base64');
  const res = await fetch(`${BASE_URL}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Ocp-Apim-Subscription-Key': process.env.MOMO_SUBSCRIPTION_KEY!,
    },
  });
  if (!res.ok) {
    throw new Error(`MoMo auth failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

/** Triggers the "Request to Pay" prompt on the payer's phone. Resolves once MTN accepts the request (202) - not once it's approved. */
export async function requestToPay(params: {
  amount: number;
  phoneNumber: string;
  externalId: string;
  payerMessage?: string;
  payeeNote?: string;
}): Promise<{ referenceId: string }> {
  assertConfigured();
  const token = await getAccessToken();
  const referenceId = crypto.randomUUID();

  const res = await fetch(`${BASE_URL}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': TARGET_ENVIRONMENT,
      'Ocp-Apim-Subscription-Key': process.env.MOMO_SUBSCRIPTION_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amount.toFixed(0),
      currency: CURRENCY,
      externalId: params.externalId,
      payer: { partyIdType: 'MSISDN', partyId: params.phoneNumber },
      payerMessage: params.payerMessage ?? 'KuISOKO order payment',
      payeeNote: params.payeeNote ?? 'KuISOKO order payment',
    }),
  });

  if (res.status !== 202) {
    throw new Error(`MoMo request-to-pay failed: ${res.status} ${await res.text()}`);
  }
  return { referenceId };
}

export type MomoStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

/** Polls MTN for the current status of a previously-submitted request-to-pay. */
export async function getTransactionStatus(referenceId: string): Promise<{ status: MomoStatus; reason?: string }> {
  assertConfigured();
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Target-Environment': TARGET_ENVIRONMENT,
      'Ocp-Apim-Subscription-Key': process.env.MOMO_SUBSCRIPTION_KEY!,
    },
  });

  if (!res.ok) {
    throw new Error(`MoMo status check failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { status: MomoStatus; reason?: { message?: string } | string };
  const reason = typeof data.reason === 'string' ? data.reason : data.reason?.message;
  return { status: data.status, reason };
}

export { isConfigured as isMomoConfigured };

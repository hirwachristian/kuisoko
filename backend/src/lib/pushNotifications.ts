import { pool } from '../db.js';

// Expo's push API needs no API key for basic sends (Expo brokers delivery to APNs/FCM using the
// project credentials baked into the app itself) - just POST the token(s) + payload here. Mirrors
// brevo.ts's pattern: best-effort, never throws, so a failed/unconfigured push never breaks the
// request that triggered it (an order status update, a chat reply, etc. must still succeed even
// if notifying the customer's phone fails).
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/** Sends a push notification to every device a user has registered (there can be more than one -
 * see push_tokens' own comment). Tokens Expo reports as no longer valid are deleted so they stop
 * being tried on every future send. */
export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  try {
    const { rows } = await pool.query<{ token: string }>(`SELECT token FROM push_tokens WHERE user_id = $1`, [userId]);
    if (rows.length === 0) return;

    const messages = rows.map((r) => ({ to: r.token, title, body, data: data ?? {}, sound: 'default' as const }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.error(`Expo push send failed: ${res.status} ${await res.text()}`);
      return;
    }
    const { data: tickets } = (await res.json()) as { data: ExpoPushTicket[] };
    const staleTokens = tickets
      .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? rows[i].token : null))
      .filter((t): t is string => t !== null);
    if (staleTokens.length > 0) {
      await pool.query(`DELETE FROM push_tokens WHERE token = ANY($1)`, [staleTokens]);
    }
  } catch (err) {
    // Push delivery is best-effort, same as email - never let it break the caller.
    console.error('Error sending push notification:', err);
  }
}

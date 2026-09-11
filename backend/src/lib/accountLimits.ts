import { HttpError } from './httpError.js';

// One person may legitimately want a couple of accounts under the same email (e.g. separate
// household members without their own address, or testing) - three is generous for that while
// still bounding the abuse case of one inbox backing unlimited accounts.
export const MAX_ACCOUNTS_PER_EMAIL = 3;

type QueryableClient = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

/** Throws HttpError(409) if `email` already backs MAX_ACCOUNTS_PER_EMAIL accounts. Must be called
 * with a client from an open transaction (withTransaction) that also performs the insert/update -
 * the advisory lock is transaction-scoped, so it only blocks a concurrent signup/email-change on
 * the exact same address from also slipping past the count check before either commits. */
export async function assertEmailAccountCapacity(client: QueryableClient, email: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [email]);
  const result = await client.query(`SELECT count(*)::int AS count FROM users WHERE email = $1`, [email]);
  if (result.rows[0].count >= MAX_ACCOUNTS_PER_EMAIL) {
    throw new HttpError(
      409,
      `This email address already has the maximum of ${MAX_ACCOUNTS_PER_EMAIL} accounts. Try a different email, or sign in to an existing account.`
    );
  }
}

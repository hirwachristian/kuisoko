import pg, { Pool, type PoolClient } from 'pg';

// pg returns NUMERIC/DECIMAL columns as strings by default (to avoid silent precision loss
// for values too large for a JS number). Our numeric columns (prices, totals, ratings,
// exchange rates) are all well within safe float range, so parse them as real numbers -
// otherwise every price calculation in the frontend would be silently working with strings.
pg.types.setTypeParser(1700, (value: string) => parseFloat(value)); // 1700 = numeric/decimal OID

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

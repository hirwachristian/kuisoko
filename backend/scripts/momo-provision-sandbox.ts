// One-time setup: creates an MTN MoMo sandbox API user + API key from your subscription key.
//
// 1. Sign up at https://momodeveloper.mtn.com and subscribe to the "Collections" product.
// 2. Copy the "Primary Key" it gives you into MOMO_SUBSCRIPTION_KEY below (or in server/.env).
// 3. Run from the server/ directory:  npx tsx scripts/momo-provision-sandbox.ts
// 4. Paste the printed MOMO_API_USER and MOMO_API_KEY into server/.env.
//
// This only needs to be run once per subscription key.

import 'dotenv/config';
import crypto from 'node:crypto';

const BASE_URL = process.env.MOMO_BASE_URL ?? 'https://sandbox.momodeveloper.mtn.com';
const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;

async function main() {
  if (!SUBSCRIPTION_KEY) {
    console.error('Set MOMO_SUBSCRIPTION_KEY in server/.env first (from your MTN MoMo Developer "Collections" subscription).');
    process.exit(1);
  }

  const apiUser = crypto.randomUUID();

  const createUserRes = await fetch(`${BASE_URL}/v1_0/apiuser`, {
    method: 'POST',
    headers: {
      'X-Reference-Id': apiUser,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providerCallbackHost: 'kuisoko.local' }),
  });
  if (createUserRes.status !== 201) {
    console.error(`Failed to create API user: ${createUserRes.status} ${await createUserRes.text()}`);
    process.exit(1);
  }

  const createKeyRes = await fetch(`${BASE_URL}/v1_0/apiuser/${apiUser}/apikey`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY },
  });
  if (!createKeyRes.ok) {
    console.error(`Failed to create API key: ${createKeyRes.status} ${await createKeyRes.text()}`);
    process.exit(1);
  }
  const { apiKey } = (await createKeyRes.json()) as { apiKey: string };

  console.log('\nAdd these to server/.env:\n');
  console.log(`MOMO_API_USER=${apiUser}`);
  console.log(`MOMO_API_KEY=${apiKey}`);
}

main();

// One-time backfill: computes a CLIP image embedding for every existing product's primary photo
// and stores it in products.image_embedding, so "search by photo" has something to compare
// against for products that predate the pgvector-based rewrite (they only ever had the old
// perceptual-hash column, which migration 048 dropped).
//
// Run from the backend/ directory against whichever DATABASE_URL is set in the environment
// (falls back to .env via dotenv/config, same as every other script here):
//   npx tsx scripts/backfill-image-embeddings.ts

import 'dotenv/config';
import { pool } from '../src/db.js';
import { computeImageEmbedding, fetchImageBuffer, toVectorLiteral } from '../src/lib/imageEmbedding.js';

async function main() {
  const { rows } = await pool.query<{ id: string; name: string; images: string[] }>(
    `SELECT id, name, images FROM products WHERE image_embedding IS NULL ORDER BY created_at`
  );
  console.log(`${rows.length} product(s) need an embedding.`);

  let ok = 0;
  let failed = 0;
  for (const product of rows) {
    const imageUrl = product.images?.[0];
    if (!imageUrl) {
      console.log(`skip (no image): ${product.name}`);
      continue;
    }
    try {
      const buffer = await fetchImageBuffer(imageUrl);
      const embedding = await computeImageEmbedding(buffer);
      await pool.query(`UPDATE products SET image_embedding = $1::vector WHERE id = $2`, [toVectorLiteral(embedding), product.id]);
      ok++;
      console.log(`embedded: ${product.name}`);
    } catch (err) {
      failed++;
      console.error(`FAILED: ${product.name} (${imageUrl}):`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone. ${ok} embedded, ${failed} failed.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

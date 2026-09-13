-- Replaces the old perceptual-hash "search by photo" (image_hash, Hamming distance) with real
-- CLIP image embeddings compared via pgvector cosine distance - a hash only matches near-identical
-- image files, while an embedding recognizes the same product across genuinely different photos
-- (different lighting/background/angle). See backend/src/lib/imageEmbedding.ts.
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE products ADD COLUMN image_embedding vector(512);
ALTER TABLE products DROP COLUMN IF EXISTS image_hash;

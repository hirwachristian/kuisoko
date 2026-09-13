import { pipeline, RawImage, type ImageFeatureExtractionPipeline } from '@xenova/transformers';

/**
 * Visual "search by photo" needs to recognize the same physical product across genuinely
 * different photos (a customer's phone snapshot vs. a clean studio product photo) - different
 * background, lighting, angle, crop. A perceptual hash (the previous approach, see git history)
 * only fingerprints raw pixel-brightness patterns, so it can only ever match near-identical
 * image files, not different photos of the same thing.
 *
 * This uses a real vision model instead: CLIP's image encoder (via Transformers.js, running
 * fully inside this Node process - no external API, no per-call cost, no API key) turns a photo
 * into a 512-number vector that captures actual visual/semantic content. Two photos of similar
 * products end up close together in that 512-dimensional space even when their raw pixels look
 * nothing alike; unrelated products end up far apart. Cosine similarity between vectors (stored
 * as pgvector `vector(512)` columns, compared via `<=>`) replaces Hamming distance on hash bits.
 */

const MODEL_NAME = 'Xenova/clip-vit-base-patch32';
export const EMBEDDING_DIMENSIONS = 512;

let extractorPromise: Promise<ImageFeatureExtractionPipeline> | null = null;
function getExtractor(): Promise<ImageFeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('image-feature-extraction', MODEL_NAME) as Promise<ImageFeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/** Computes a normalized (unit-length) 512-dim embedding for an image buffer. */
export async function computeImageEmbedding(buffer: Buffer): Promise<number[]> {
  const extractor = await getExtractor();
  const image = await RawImage.fromBlob(new Blob([buffer]));
  // CLIP's vision tower doesn't expose the kind of 'pooler' layer this pipeline's `pool` option
  // expects (passing it throws), but the default call already returns one pooled [1, 512] vector
  // per image - verified empirically - so no options are needed here.
  const output = await extractor(image);
  const data = Array.from(output.data as Float32Array);
  // The pipeline's own `normalize` option doesn't reliably yield unit-length vectors for this
  // pooling mode (verified empirically) - L2-normalize explicitly so a plain dot product between
  // two embeddings equals their cosine similarity, matching pgvector's `<=>` cosine operator.
  const norm = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0)) || 1;
  return data.map((v) => v / norm);
}

/** Formats an embedding array as a pgvector literal, e.g. "[0.1,-0.2,...]", for use as a query
 * parameter cast with `$1::vector`. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Fetches an image (local /uploads URL or external) into a Buffer, with a timeout and size cap
 * so one slow or oversized remote image can't hang or blow up memory while embedding it. */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
      throw new Error('Image too large to embed.');
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Image too large to embed.');
    }
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

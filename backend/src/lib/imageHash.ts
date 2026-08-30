import sharp from 'sharp';

/**
 * Difference hash (dHash): resize to 9x8 grayscale, then compare each pixel to its right
 * neighbor. Produces a 64-bit fingerprint (as a 16-char hex string) that's stable across minor
 * resizing/re-compression differences but cheap to compute and compare - no ML model or paid
 * vision API needed for a catalog this size.
 */
export async function computeImageHash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      bits += left > right ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

const POPCOUNT_4BIT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Number of differing bits between two hashes - lower means more visually similar. */
export function hammingDistance(hexA: string, hexB: string): number {
  if (hexA.length !== hexB.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hexA.length; i++) {
    const xor = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    distance += POPCOUNT_4BIT[xor];
  }
  return distance;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Fetches an image (local /uploads URL or external) into a Buffer, with a timeout and size cap
 * so one slow or oversized remote image can't hang or blow up memory while hashing. */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
      throw new Error('Image too large to hash.');
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Image too large to hash.');
    }
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

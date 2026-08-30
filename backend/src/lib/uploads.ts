import path from 'node:path';
import fs from 'node:fs/promises';

export const UPLOADS_DIR = path.join(import.meta.dirname, '..', '..', 'uploads');

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/** Deletes a previously uploaded file given its public URL (e.g. http://host/uploads/xyz.jpg). Ignores URLs we didn't serve, and missing files. */
export async function deleteUploadedFile(url: string | null | undefined) {
  if (!url) return;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return; // not a URL we recognize
  }
  if (!pathname.startsWith('/uploads/')) return;

  const filename = path.basename(pathname);
  const filePath = path.join(UPLOADS_DIR, filename);
  // Guard against path traversal collapsing outside the uploads directory
  if (path.dirname(filePath) !== UPLOADS_DIR) return;

  try {
    await fs.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

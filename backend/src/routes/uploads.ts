import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { UPLOADS_DIR, ensureUploadsDir, deleteUploadedFile } from '../lib/uploads.js';
import { authenticate } from '../middleware/auth.js';

await ensureUploadsDir();

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ALLOWED_MIME_TYPES = new Set([...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES]);

const VIDEO_EXTENSIONS: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

// Buffered in memory so images can be compressed with sharp before ever touching disk. Videos
// are never processed in memory beyond this buffering - they're written straight through.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB raw file - covers a reasonable product demo video
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, WEBP, GIF images or MP4, WebM, MOV videos are allowed.'));
      return;
    }
    cb(null, true);
  },
});

/** Images are resized to a sane max dimension and re-encoded as WebP (typically 60-80% smaller
 * than the original JPEG/PNG at comparable quality); animated GIFs pass through untouched so
 * they don't get flattened to a single frame. Videos are never re-encoded (no video-processing
 * dependency in this stack) - they're saved as-is under their own extension. */
async function processUpload(buffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; extension: string }> {
  if (mimetype === 'image/gif') {
    return { buffer, extension: '.gif' };
  }
  if (ALLOWED_VIDEO_MIME_TYPES.has(mimetype)) {
    return { buffer, extension: VIDEO_EXTENSIONS[mimetype] };
  }
  const compressed = await sharp(buffer)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return { buffer: compressed, extension: '.webp' };
}

const router = Router();

// POST /api/uploads - authenticated: process (images) or store (videos) a file, get back its public URL
router.post('/', authenticate, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'That file is too large (max 50MB).' });
      }
      return res.status(400).json({ error: err.message || 'Could not process the uploaded file.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    try {
      const { buffer, extension } = await processUpload(req.file.buffer, req.file.mimetype);
      const filename = `${randomUUID()}${extension}`;
      await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
      const url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
      return res.status(201).json({ url });
    } catch (compressErr) {
      return next(compressErr);
    }
  });
});

const deleteSchema = z.object({ url: z.string().min(1) });

// DELETE /api/uploads - authenticated: remove a previously uploaded file
router.delete('/', authenticate, async (req, res, next) => {
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await deleteUploadedFile(parsed.data.url);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;

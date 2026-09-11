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
// Generic documents - for chat attachments and anywhere else a plain file (not a photo/video)
// needs sharing. Stored as-is, same as videos - never run through sharp.
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]);
const ALLOWED_MIME_TYPES = new Set([...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES, ...ALLOWED_DOCUMENT_MIME_TYPES]);

const VIDEO_EXTENSIONS: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const DOCUMENT_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'application/zip': '.zip',
};

// Buffered in memory so images can be compressed with sharp before ever touching disk. Videos
// are never processed in memory beyond this buffering - they're written straight through.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB raw file - covers a reasonable product demo video
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Only images, videos, PDFs, Word/Excel documents, text files, or ZIP archives are allowed.'));
      return;
    }
    cb(null, true);
  },
});

// Every processed image lands on this exact canvas, letting product cards (and anywhere else
// that shows an uploaded photo) rely on every image already being this same shape, instead of
// each seller's original portrait/landscape/square photos rendering inconsistently in a fixed
// card slot.
const IMAGE_CANVAS_SIZE = 1200;
const IMAGE_CANVAS_BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };

/** Images are resized to fit within a fixed square canvas and re-encoded as WebP (typically
 * 60-80% smaller than the original JPEG/PNG at comparable quality) - `fit: 'contain'` never
 * crops the photo itself, it pads whatever space is left on the canvas with white instead, so a
 * tall or wide product photo still shows the whole product rather than losing its edges. Animated
 * GIFs pass through untouched so they don't get flattened to a single frame. Videos are never
 * re-encoded (no video-processing dependency in this stack) - they're saved as-is under their own
 * extension. */
async function processUpload(buffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; extension: string }> {
  if (mimetype === 'image/gif') {
    return { buffer, extension: '.gif' };
  }
  if (ALLOWED_VIDEO_MIME_TYPES.has(mimetype)) {
    return { buffer, extension: VIDEO_EXTENSIONS[mimetype] };
  }
  if (ALLOWED_DOCUMENT_MIME_TYPES.has(mimetype)) {
    return { buffer, extension: DOCUMENT_EXTENSIONS[mimetype] };
  }
  const compressed = await sharp(buffer)
    .resize({
      width: IMAGE_CANVAS_SIZE,
      height: IMAGE_CANVAS_SIZE,
      fit: 'contain',
      background: IMAGE_CANVAS_BACKGROUND,
    })
    .flatten({ background: IMAGE_CANVAS_BACKGROUND }) // drop any source transparency onto white too, so it isn't left see-through against a dark card background in dark mode
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
      // Uploader's id is embedded in the filename (not secret - it's already visible to anyone
      // via /api/orders etc. - just used so DELETE below can tell who's allowed to remove it)
      // so a regular customer can only ever delete their own uploads (e.g. a review image they
      // staged then changed their mind on), never another user's or an admin's product images.
      const filename = `${req.authUser!.id}__${randomUUID()}${extension}`;
      await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
      const url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
      return res.status(201).json({ url, originalName: req.file.originalname });
    } catch (compressErr) {
      return next(compressErr);
    }
  });
});

const deleteSchema = z.object({ url: z.string().min(1) });

// DELETE /api/uploads - authenticated: remove a previously uploaded file, but only the uploader
// themself or an admin - not just anyone who happens to have seen the URL.
router.delete('/', authenticate, async (req, res, next) => {
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const filename = path.basename(new URL(parsed.data.url, 'http://placeholder').pathname);
    const ownerId = filename.split('__')[0];
    // Files uploaded before this ownership scheme existed have no recoverable owner - only an
    // admin can clean those up.
    const isOwner = ownerId && ownerId === req.authUser!.id;
    if (!isOwner && req.authUser!.role !== 'admin') {
      return res.status(403).json({ error: 'You can only remove files you uploaded yourself.' });
    }
    await deleteUploadedFile(parsed.data.url);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;

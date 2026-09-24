import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/site-images - admin: the whole pool plus which ones are currently assigned to each
// section (and in what order), in one call so the admin page can hydrate its full state at once.
router.get('/', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const imagesResult = await pool.query(
      `SELECT id, url, created_at AS "createdAt" FROM site_images ORDER BY created_at DESC`
    );
    const settingsResult = await pool.query(
      `SELECT hero_image_ids AS "heroImageIds", about_image_ids AS "aboutImageIds" FROM app_settings WHERE id = 1`
    );
    return res.json({
      images: imagesResult.rows,
      heroImageIds: settingsResult.rows[0]?.heroImageIds ?? [],
      aboutImageIds: settingsResult.rows[0]?.aboutImageIds ?? [],
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/site-images - admin: register an already-uploaded file (POST /uploads) as a pool
// image. Uploading and pooling are two separate steps, same as every other admin image flow in
// this app (product images, review images, etc.) - this route never touches the filesystem itself.
const createSchema = z.object({ url: z.string().trim().min(1, 'Image URL is required') });
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `INSERT INTO site_images (url) VALUES ($1) RETURNING id, url, created_at AS "createdAt"`,
      [parsed.data.url]
    );
    return res.status(201).json({ image: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/site-images/:id - admin: remove a pool image and strip it out of both sections'
// assignment lists in one transaction. Does not delete the underlying uploaded file - the admin
// frontend does that itself right after (POST /uploads' own DELETE), same two-step pattern already
// used for e.g. removing a profile photo, so this route stays a pure DB operation.
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const deleted = await withTransaction(async (client) => {
      const result = await client.query(`DELETE FROM site_images WHERE id = $1 RETURNING id`, [req.params.id]);
      if (result.rowCount === 0) return null;
      await client.query(
        `UPDATE app_settings SET
           hero_image_ids = array_remove(hero_image_ids, $1),
           about_image_ids = array_remove(about_image_ids, $1)
         WHERE id = 1`,
        [req.params.id]
      );
      return result.rows[0];
    });
    if (!deleted) return res.status(404).json({ error: 'Image not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/site-images/hero and /about - admin: full-replace the ordered id list for one
// section. The admin UI always holds the complete current list in state (it just toggled or
// reordered one entry), so "send the whole list" is simpler than fine-grained add/remove/move
// endpoints, at the cost of nothing since this is never called with a stale/partial list.
const listSchema = z.object({ imageIds: z.array(z.string()) });

router.patch('/hero', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = listSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await pool.query(`UPDATE app_settings SET hero_image_ids = $1 WHERE id = 1`, [parsed.data.imageIds]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

router.patch('/about', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = listSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await pool.query(`UPDATE app_settings SET about_image_ids = $1 WHERE id = 1`, [parsed.data.imageIds]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// GET /api/site-images/public - no auth: resolved URLs (not raw ids) for whichever images are
// currently assigned to each section, in order. Silently drops any id whose pool row was deleted
// out from under it (shouldn't happen given the transactional cleanup above, but a stale id here
// should never break the homepage). Home.tsx/AboutSection.tsx (and their mobile equivalents) fall
// back to their own hardcoded defaults when a list comes back empty - never claim more than "no
// admin-configured images for this section right now".
router.get('/public', async (_req, res, next) => {
  try {
    const settingsResult = await pool.query(
      `SELECT hero_image_ids AS "heroImageIds", about_image_ids AS "aboutImageIds" FROM app_settings WHERE id = 1`
    );
    const heroIds: string[] = settingsResult.rows[0]?.heroImageIds ?? [];
    const aboutIds: string[] = settingsResult.rows[0]?.aboutImageIds ?? [];
    const allIds = [...new Set([...heroIds, ...aboutIds])];
    let urlById = new Map<string, string>();
    if (allIds.length > 0) {
      const imagesResult = await pool.query(`SELECT id, url FROM site_images WHERE id = ANY($1::uuid[])`, [allIds]);
      urlById = new Map(imagesResult.rows.map((row) => [row.id, row.url]));
    }
    return res.json({
      heroImages: heroIds.map((id) => urlById.get(id)).filter((url): url is string => !!url),
      aboutImages: aboutIds.map((id) => urlById.get(id)).filter((url): url is string => !!url),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { translateManyToKinyarwanda } from '../lib/translate.js';
import { translateSuggestLimiter } from '../middleware/rateLimit.js';

const router = Router();

const translateSchema = z.object({
  texts: z.array(z.string()).min(1).max(50),
});

// POST /api/categories/translate - admin: suggests Kinyarwanda translations for a batch of
// strings (category name, section title, item labels), via the free MyMemory API. Suggestions
// only - the admin reviews/edits the result in the form before anything is actually saved, since
// that API is unreliable enough for Kinyarwanda that some results are outright nonsense and
// shouldn't ever be auto-published without a human looking at them first.
router.post('/translate', authenticate, requireAdmin, translateSuggestLimiter, async (req, res, next) => {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const translations = await translateManyToKinyarwanda(parsed.data.texts);
    return res.json({ translations });
  } catch (err) {
    return next(err);
  }
});

// GET /api/categories - public: categories with their nested mega-menu sections
router.get('/', async (_req, res, next) => {
  try {
    const categoriesResult = await pool.query(
      `SELECT id, name, name_kin AS "nameKin" FROM categories ORDER BY display_order, name`
    );
    const sectionsResult = await pool.query(
      `SELECT id, category_id, title, title_kin AS "titleKin", items, items_kin AS "itemsKin"
       FROM category_sections ORDER BY display_order, title`
    );
    const categories = categoriesResult.rows.map((category) => ({
      ...category,
      sections: sectionsResult.rows.filter((s) => s.category_id === category.id),
    }));
    return res.json({ categories });
  } catch (err) {
    return next(err);
  }
});

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required'),
  nameKin: z.string().trim().optional(),
});

// POST /api/categories - admin: create a category
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `INSERT INTO categories (name, name_kin) VALUES ($1, $2) RETURNING id, name, name_kin AS "nameKin"`,
      [parsed.data.name, parsed.data.nameKin || null]
    );
    return res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: `Category "${parsed.data.name}" already exists.` });
    }
    return next(err);
  }
});

// PATCH /api/categories/:id - admin: rename a category
router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `UPDATE categories SET name = $1, name_kin = $2 WHERE id = $3 RETURNING id, name, name_kin AS "nameKin"`,
      [parsed.data.name, parsed.data.nameKin || null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });
    return res.json({ category: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: `Category "${parsed.data.name}" already exists.` });
    }
    return next(err);
  }
});

// DELETE /api/categories/:id - admin: delete a category (cascades to its sections)
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM categories WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

const sectionSchema = z.object({
  title: z.string().trim().min(1, 'Section title is required'),
  titleKin: z.string().trim().optional(),
  items: z.array(z.string().trim().min(1)).default([]),
  // Parallel to `items` - itemsKin[i] is the translation for items[i]. Empty means "not
  // translated" (falls back to English), same as titleKin/nameKin being omitted.
  itemsKin: z.array(z.string()).default([]),
});

// POST /api/categories/:id/sections - admin: add a mega-menu section
router.post('/:id/sections', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `INSERT INTO category_sections (category_id, title, title_kin, items, items_kin)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, category_id, title, title_kin AS "titleKin", items, items_kin AS "itemsKin"`,
      [req.params.id, parsed.data.title, parsed.data.titleKin || null, parsed.data.items, parsed.data.itemsKin]
    );
    return res.status(201).json({ section: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: `Section "${parsed.data.title}" already exists in this category.` });
      }
      if (err.code === '23503') {
        return res.status(404).json({ error: 'Category not found.' });
      }
    }
    return next(err);
  }
});

// PATCH /api/categories/:categoryId/sections/:sectionId - admin: update a section
router.patch('/:categoryId/sections/:sectionId', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `UPDATE category_sections SET title = $1, title_kin = $2, items = $3, items_kin = $4
       WHERE id = $5 AND category_id = $6
       RETURNING id, category_id, title, title_kin AS "titleKin", items, items_kin AS "itemsKin"`,
      [parsed.data.title, parsed.data.titleKin || null, parsed.data.items, parsed.data.itemsKin, req.params.sectionId, req.params.categoryId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Section not found.' });
    return res.json({ section: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/categories/:categoryId/sections/:sectionId - admin: delete a section
router.delete('/:categoryId/sections/:sectionId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM category_sections WHERE id = $1 AND category_id = $2`,
      [req.params.sectionId, req.params.categoryId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Section not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;

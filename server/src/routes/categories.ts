import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/categories - public: categories with their nested mega-menu sections
router.get('/', async (_req, res, next) => {
  try {
    const categoriesResult = await pool.query(
      `SELECT id, name FROM categories ORDER BY display_order, name`
    );
    const sectionsResult = await pool.query(
      `SELECT id, category_id, title, items FROM category_sections ORDER BY display_order, title`
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
});

// POST /api/categories - admin: create a category
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id, name`,
      [parsed.data.name]
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
      `UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name`,
      [parsed.data.name, req.params.id]
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
  items: z.array(z.string().trim().min(1)).default([]),
});

// POST /api/categories/:id/sections - admin: add a mega-menu section
router.post('/:id/sections', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `INSERT INTO category_sections (category_id, title, items)
       VALUES ($1, $2, $3)
       RETURNING id, category_id, title, items`,
      [req.params.id, parsed.data.title, parsed.data.items]
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
      `UPDATE category_sections SET title = $1, items = $2
       WHERE id = $3 AND category_id = $4
       RETURNING id, category_id, title, items`,
      [parsed.data.title, parsed.data.items, req.params.sectionId, req.params.categoryId]
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

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db.js';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { computeImageHash, hammingDistance, fetchImageBuffer } from '../lib/imageHash.js';

const router = Router();

const imageSearchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB - a photo, not a product video
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

/** Recomputes and stores a product's image_hash from its primary image, best-effort - a failed
 * fetch/hash (unreachable URL, corrupt file) should never fail the product create/update itself,
 * it just means that product won't surface in "search by photo" results. */
function updateProductImageHash(productId: string, imageUrl: string | undefined) {
  if (!imageUrl) return;
  (async () => {
    try {
      const buffer = await fetchImageBuffer(imageUrl);
      const hash = await computeImageHash(buffer);
      await pool.query(`UPDATE products SET image_hash = $1 WHERE id = $2`, [hash, productId]);
    } catch (err) {
      console.error(`Could not compute image hash for product ${productId}:`, err);
    }
  })();
}

const PRODUCT_COLUMNS = `
  p.id, p.name, p.description, p.price, p.discount, c.name AS category,
  p.sub_category AS "subCategory", p.images, p.video_urls AS "videoUrls", p.rating, p.reviews_count AS reviews,
  p.stock, p.featured
`;

async function attachVariants<T extends { id: string }>(products: T[]) {
  if (products.length === 0) return products.map((p) => ({ ...p, variants: [] }));
  const ids = products.map((p) => p.id);
  const result = await pool.query(
    `SELECT id, product_id, sku, color, size, price, stock FROM product_variants WHERE product_id = ANY($1)`,
    [ids]
  );
  return products.map((p) => ({
    ...p,
    variants: result.rows.filter((v) => v.product_id === p.id),
  }));
}

/** How many reviews each product has at each star rating (1-5), for the rating-breakdown hover
 * popover on product cards - hidden reviews are excluded, same as products.rating/reviews_count. */
async function attachRatingBreakdown<T extends { id: string }>(products: T[]) {
  if (products.length === 0) return products.map((p) => ({ ...p, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }));
  const ids = products.map((p) => p.id);
  const result = await pool.query(
    `SELECT product_id, rating, COUNT(*)::int AS count
     FROM reviews WHERE product_id = ANY($1) AND is_hidden = false
     GROUP BY product_id, rating`,
    [ids]
  );
  return products.map((p) => {
    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of result.rows) {
      if (row.product_id === p.id) breakdown[row.rating as 1 | 2 | 3 | 4 | 5] = row.count;
    }
    return { ...p, ratingBreakdown: breakdown };
  });
}

// GET /api/products - public: full catalog with variants
router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.created_at DESC`
    );
    const withVariants = await attachVariants(result.rows);
    return res.json({ products: await attachRatingBreakdown(withVariants) });
  } catch (err) {
    return next(err);
  }
});

// GET /api/products/:id - public: single product with variants + reviews (admins also see hidden reviews)
router.get('/:id', optionalAuthenticate, async (req, res, next) => {
  try {
    const productResult = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (productResult.rowCount === 0) return res.status(404).json({ error: 'Product not found.' });

    const variantsResult = await pool.query(
      `SELECT id, sku, color, size, price, stock FROM product_variants WHERE product_id = $1`,
      [req.params.id]
    );
    const isAdmin = req.authUser?.role === 'admin';
    const reviewsResult = await pool.query(
      `SELECT id, user_name AS "userName", rating, comment, image, is_hidden AS "isHidden", created_at AS date
       FROM reviews WHERE product_id = $1 ${isAdmin ? '' : 'AND is_hidden = false'} ORDER BY created_at DESC`,
      [req.params.id]
    );

    const [{ ratingBreakdown }] = await attachRatingBreakdown([productResult.rows[0]]);
    return res.json({
      product: {
        ...productResult.rows[0],
        variants: variantsResult.rows,
        reviewsList: reviewsResult.rows,
        ratingBreakdown,
      },
    });
  } catch (err) {
    return next(err);
  }
});

const variantSchema = z.object({
  sku: z.string().trim().optional(),
  color: z.string().trim().optional(),
  size: z.string().trim().optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
});

const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  description: z.string().trim().optional(),
  price: z.number().nonnegative(),
  discount: z.number().min(0).max(100).optional(),
  category: z.string().trim().min(1, 'Category is required'),
  subCategory: z.string().trim().min(1, 'Sub-category is required'),
  images: z.array(z.string()).default([]),
  videoUrls: z.array(z.string()).default([]),
  stock: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  variants: z.array(variantSchema).default([]),
});

async function resolveCategoryId(client: PoolClient, name: string): Promise<string | null> {
  const result = await client.query(`SELECT id FROM categories WHERE name = $1`, [name]);
  return result.rows[0]?.id ?? null;
}

async function insertVariants(client: PoolClient, productId: string, variants: z.infer<typeof variantSchema>[]) {
  for (const v of variants) {
    const sku = v.sku && v.sku.length > 0 ? v.sku : `SKU-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO product_variants (product_id, sku, color, size, price, stock)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, sku, v.color ?? null, v.size ?? null, v.price, v.stock]
    );
  }
}

// POST /api/products - admin: create a product
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  try {
    const product = await withTransaction(async (client) => {
      const categoryId = await resolveCategoryId(client, data.category);
      if (!categoryId) throw new HttpError(400, 'Category not found.');

      const result = await client.query(
        `INSERT INTO products (name, description, price, discount, category_id, sub_category, images, video_urls, stock, featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [data.name, data.description ?? null, data.price, data.discount ?? null, categoryId, data.subCategory, data.images, data.videoUrls, data.stock, data.featured]
      );
      const productId = result.rows[0].id;
      await insertVariants(client, productId, data.variants);
      return productId;
    });

    updateProductImageHash(product, data.images[0]);

    const created = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [product]
    );
    const [withVariants] = await attachVariants(created.rows);
    return res.status(201).json({ product: withVariants });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

// Not productSchema.partial(): zod still applies .default([]) / .default(0) / .default(false)
// to any field omitted from the request (defaults resolve before the optional-wrapping
// applies), which would silently wipe images/stock/featured/variants on updates that don't
// mention them - variants especially, since `if (data.variants)` treats a resolved `[]` as
// truthy and would delete every existing variant.
const productUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').optional(),
  description: z.string().trim().optional(),
  price: z.number().nonnegative().optional(),
  discount: z.number().min(0).max(100).optional(),
  category: z.string().trim().min(1, 'Category is required').optional(),
  subCategory: z.string().trim().min(1, 'Sub-category is required').optional(),
  images: z.array(z.string()).optional(),
  videoUrls: z.array(z.string()).optional(),
  stock: z.number().int().nonnegative().optional(),
  featured: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
});

// PATCH /api/products/:id - admin: update a product
router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  try {
    await withTransaction(async (client) => {
      let categoryId: string | null = null;
      if (data.category) {
        categoryId = await resolveCategoryId(client, data.category);
        if (!categoryId) throw new HttpError(400, 'Category not found.');
      }

      const result = await client.query(
        `UPDATE products SET
           name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           discount = COALESCE($4, discount),
           category_id = COALESCE($5, category_id),
           sub_category = COALESCE($6, sub_category),
           images = COALESCE($7, images),
           video_urls = COALESCE($8, video_urls),
           stock = COALESCE($9, stock),
           featured = COALESCE($10, featured)
         WHERE id = $11`,
        [
          data.name ?? null, data.description ?? null, data.price ?? null, data.discount ?? null,
          categoryId, data.subCategory ?? null, data.images ?? null, data.videoUrls ?? null,
          data.stock ?? null, data.featured ?? null, req.params.id,
        ]
      );
      if (result.rowCount === 0) throw new HttpError(404, 'Product not found.');

      if (data.variants) {
        await client.query(`DELETE FROM product_variants WHERE product_id = $1`, [req.params.id]);
        await insertVariants(client, req.params.id, data.variants);
      }
    });

    if (data.images && data.images.length > 0) {
      updateProductImageHash(req.params.id, data.images[0]);
    }

    const updated = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [req.params.id]
    );
    const [withVariants] = await attachVariants(updated.rows);
    return res.json({ product: withVariants });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

const MAX_HAMMING_DISTANCE = 20; // out of 64 bits (~31%) - loose enough for photo/lighting/crop variance, tight enough to exclude unrelated products

// POST /api/products/search-by-image - public: find catalog products visually similar to an
// uploaded photo (e.g. taken with a phone camera), using a perceptual hash compared via Hamming
// distance - a lightweight, self-hosted approximation of visual search rather than a full ML
// vision model, sized for this catalog rather than needing a paid external API.
router.post('/search-by-image', imageSearchUpload.single('image'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'An image file is required.' });
  }
  try {
    const queryHash = await computeImageHash(req.file.buffer);
    const result = await pool.query(
      `SELECT ${PRODUCT_COLUMNS}, p.image_hash AS "imageHash"
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.image_hash IS NOT NULL`
    );
    const ranked = result.rows
      .map((row) => ({ ...row, distance: hammingDistance(queryHash, row.imageHash) }))
      .filter((row) => row.distance <= MAX_HAMMING_DISTANCE)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12)
      .map(({ imageHash, distance, ...product }) => product);

    const withVariants = await attachVariants(ranked);
    return res.json({ products: await attachRatingBreakdown(withVariants) });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/products/:id - admin: delete a product
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM products WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().optional(),
  image: z.string().optional(),
});

// POST /api/products/:id/reviews - authenticated: add a review
router.post('/:id/reviews', authenticate, async (req, res, next) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const userResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [req.authUser!.id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'User not found.' });

    const result = await pool.query(
      `INSERT INTO reviews (product_id, user_id, user_name, rating, comment, image)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_name AS "userName", rating, comment, image, created_at AS date`,
      [req.params.id, req.authUser!.id, userResult.rows[0].name, parsed.data.rating, parsed.data.comment ?? null, parsed.data.image ?? null]
    );
    return res.status(201).json({ review: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return res.status(404).json({ error: 'Product not found.' });
    }
    return next(err);
  }
});

export default router;

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { parse as parseCsv } from 'csv-parse/sync';
import { stringify as stringifyCsv } from 'csv-stringify/sync';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db.js';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { getAppUrl } from '../lib/appUrl.js';
import { computeImageEmbedding, toVectorLiteral, fetchImageBuffer } from '../lib/imageEmbedding.js';
import { imageSearchLimiter, restockNotifyLimiter } from '../middleware/rateLimit.js';
import { sendBackInStockEmail } from '../lib/brevo.js';

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

/** Recomputes and stores a product's image_embedding from its primary image, best-effort - a
 * failed fetch/embed (unreachable URL, corrupt file, model not ready yet) should never fail the
 * product create/update itself, it just means that product won't surface in "search by photo"
 * results until the next successful recompute. */
function updateProductImageEmbedding(productId: string, imageUrl: string | undefined) {
  if (!imageUrl) return;
  (async () => {
    try {
      const buffer = await fetchImageBuffer(imageUrl);
      const embedding = await computeImageEmbedding(buffer);
      await pool.query(`UPDATE products SET image_embedding = $1::vector WHERE id = $2`, [toVectorLiteral(embedding), productId]);
    } catch (err) {
      console.error(`Could not compute image embedding for product ${productId}:`, err);
    }
  })();
}

const PRODUCT_COLUMNS = `
  p.id, p.name, p.description, p.price, p.discount, c.name AS category,
  p.sub_category AS "subCategory", p.images, p.thumbnail_images AS "thumbnailImages", p.video_urls AS "videoUrls", p.rating, p.reviews_count AS reviews,
  p.stock, p.featured, p.color_images AS "colorImages", p.image_details AS "imageDetails", p.group_buy_enabled AS "groupBuyEnabled"
`;

async function attachVariants<T extends { id: string }>(products: T[]) {
  if (products.length === 0) return products.map((p) => ({ ...p, variants: [] }));
  const ids = products.map((p) => p.id);
  const result = await pool.query(
    `SELECT id, product_id, sku, color, size, price, stock, image_url AS "imageUrl" FROM product_variants WHERE product_id = ANY($1)`,
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
      `SELECT id, sku, color, size, price, stock, image_url AS "imageUrl" FROM product_variants WHERE product_id = $1`,
      [req.params.id]
    );
    const isAdmin = req.authUser?.role === 'admin';
    const reviewsResult = await pool.query(
      `SELECT id, user_name AS "userName", user_username AS "userUsername", rating, comment, image, is_hidden AS "isHidden", created_at AS date
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

// GET /api/products/:id/also-bought - public: other products that showed up in the same orders as
// this one, ranked by how many distinct orders paired them - a real co-purchase signal rather than
// the subcategory-based "similar products" section, which only compares product attributes.
router.get('/:id/also-bought', async (req, res, next) => {
  try {
    const coPurchaseResult = await pool.query(
      `SELECT oi2.product_id, COUNT(DISTINCT oi2.order_id)::int AS co_count
       FROM order_items oi1
       JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id IS DISTINCT FROM oi1.product_id
       JOIN products p ON p.id = oi2.product_id AND p.stock > 0
       WHERE oi1.product_id = $1 AND oi2.product_id IS NOT NULL
       GROUP BY oi2.product_id
       ORDER BY co_count DESC
       LIMIT 6`,
      [req.params.id]
    );
    if (coPurchaseResult.rowCount === 0) return res.json({ products: [] });

    const ids = coPurchaseResult.rows.map((r) => r.product_id);
    const productsResult = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ANY($1)`,
      [ids]
    );
    // Re-sort to match the co-purchase ranking above - the ANY($1) query doesn't preserve order.
    const byId = new Map(productsResult.rows.map((p) => [p.id, p]));
    const ordered = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

    const withVariants = await attachVariants(ordered);
    return res.json({ products: await attachRatingBreakdown(withVariants) });
  } catch (err) {
    return next(err);
  }
});

const notifyRestockSchema = z.object({
  email: z.string().trim().email('A valid email is required.'),
  color: z.string().trim().optional(),
  size: z.string().trim().optional(),
});

// POST /api/products/:id/notify-restock - public: sign up to be emailed once this product (or, if
// it has variants, this specific color/size) is back in stock. Rejected while it's already in
// stock, since there's nothing to wait for - the customer should just buy it.
router.post('/:id/notify-restock', restockNotifyLimiter, async (req, res, next) => {
  const parsed = notifyRestockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const color = parsed.data.color ?? '';
  const size = parsed.data.size ?? '';

  try {
    const productResult = await pool.query(`SELECT stock FROM products WHERE id = $1`, [req.params.id]);
    if (productResult.rowCount === 0) return res.status(404).json({ error: 'Product not found.' });

    let currentStock: number;
    if (color || size) {
      // product_variants.color/size are stored as NULL (not '') when a variant doesn't vary by
      // that attribute, so a plain `=` would never match those rows - IS NOT DISTINCT FROM is the
      // NULL-safe equality already used for this same lookup in orders.ts.
      const variantResult = await pool.query(
        `SELECT stock FROM product_variants WHERE product_id = $1 AND color IS NOT DISTINCT FROM $2 AND size IS NOT DISTINCT FROM $3`,
        [req.params.id, color || null, size || null]
      );
      if (variantResult.rowCount === 0) return res.status(404).json({ error: 'Variant not found.' });
      currentStock = variantResult.rows[0].stock;
    } else {
      currentStock = productResult.rows[0].stock;
    }
    if (currentStock > 0) return res.status(400).json({ error: 'This item is already in stock.' });

    await pool.query(
      `INSERT INTO back_in_stock_requests (product_id, color, size, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, color, size, lower(email)) WHERE notified_at IS NULL DO NOTHING`,
      [req.params.id, color, size, parsed.data.email]
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

const variantSchema = z.object({
  sku: z.string().trim().optional(),
  color: z.string().trim().optional(),
  size: z.string().trim().optional(),
  // Set instead of color/size for a per-image-stock row - one of this product's own `images`,
  // giving that specific photo its own stock rather than varying by color or size.
  imageUrl: z.string().optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
});

// A per-image name/description override, both optional - an image with neither set has no entry
// in `imageDetails` at all (see below) and falls back to the product's own name/description.
const imageDetailSchema = z.object({
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  description: z.string().trim().optional(),
  price: z.number().nonnegative(),
  discount: z.number().min(0).max(100).optional(),
  category: z.string().trim().min(1, 'Category is required'),
  subCategory: z.string().trim().min(1, 'Sub-category is required'),
  images: z.array(z.string()).default([]),
  // Subset of `images` the admin picked to represent this product on cards/listings - deliberately
  // independent of `variants`/per-image-stock, so a product with no color/size/image-stock variants
  // at all can still have one or more thumbnails set. Falls back to images[0] when empty.
  thumbnailImages: z.array(z.string()).default([]),
  videoUrls: z.array(z.string()).default([]),
  stock: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  variants: z.array(variantSchema).default([]),
  // Maps a variant color to one of `images`, so the product page can jump the gallery to that
  // color's photo the moment it's picked.
  colorImages: z.record(z.string(), z.string()).default({}),
  // Maps an image URL to an optional name/description override - unset images (the common case)
  // just aren't a key in here, and the frontend falls back to the product's own name/description.
  imageDetails: z.record(z.string(), imageDetailSchema).default({}),
  // Admin opt-in for "buy together" group orders (see routes/groupOrders.ts) on this product.
  groupBuyEnabled: z.boolean().default(false),
});

async function resolveCategoryId(client: PoolClient, name: string): Promise<string | null> {
  const result = await client.query(`SELECT id FROM categories WHERE name = $1`, [name]);
  return result.rows[0]?.id ?? null;
}

async function insertVariants(client: PoolClient, productId: string, variants: z.infer<typeof variantSchema>[]) {
  for (const v of variants) {
    const sku = v.sku && v.sku.length > 0 ? v.sku : `SKU-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO product_variants (product_id, sku, color, size, price, stock, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [productId, sku, v.color ?? null, v.size ?? null, v.price, v.stock, v.imageUrl ?? null]
    );
  }
}

/** Notifies and clears any pending back-in-stock signups that are now satisfied - called
 * (fire-and-forget) after any change that could raise a product's or variant's stock above zero:
 * an admin edit, a CSV import, or an order cancellation restoring stock. Safe to call
 * unconditionally after every such change rather than tracking "did this specific stock value just
 * cross zero" - a bucket with no pending signups (the common case) is a fast no-op, and one already
 * notified is excluded by `notified_at IS NULL`, so redundant calls never re-notify anyone. */
export async function checkAndNotifyRestock(productId: string) {
  try {
    const productResult = await pool.query(`SELECT name, stock FROM products WHERE id = $1`, [productId]);
    if (productResult.rowCount === 0) return;
    const { name: productName, stock: productStock } = productResult.rows[0];

    const variantsResult = await pool.query(`SELECT color, size, stock FROM product_variants WHERE product_id = $1`, [productId]);
    const inStockBuckets: { color: string; size: string }[] =
      variantsResult.rowCount! > 0
        ? variantsResult.rows.filter((v) => v.stock > 0).map((v) => ({ color: v.color ?? '', size: v.size ?? '' }))
        : productStock > 0
        ? [{ color: '', size: '' }]
        : [];
    if (inStockBuckets.length === 0) return;

    const productUrl = `${getAppUrl()}/product/${productId}`;

    for (const bucket of inStockBuckets) {
      const pending = await pool.query(
        `SELECT email FROM back_in_stock_requests WHERE product_id = $1 AND color = $2 AND size = $3 AND notified_at IS NULL`,
        [productId, bucket.color, bucket.size]
      );
      if (pending.rowCount === 0) continue;

      const variantLabel = [bucket.color, bucket.size].filter(Boolean).join(' / ') || undefined;
      for (const row of pending.rows) {
        sendBackInStockEmail(row.email, productName, productUrl, variantLabel);
      }
      await pool.query(
        `UPDATE back_in_stock_requests SET notified_at = now() WHERE product_id = $1 AND color = $2 AND size = $3 AND notified_at IS NULL`,
        [productId, bucket.color, bucket.size]
      );
    }
  } catch (err) {
    console.error(`Could not process back-in-stock notifications for product ${productId}:`, err);
  }
}

async function createProduct(data: z.infer<typeof productSchema>) {
  const productId = await withTransaction(async (client) => {
    const categoryId = await resolveCategoryId(client, data.category);
    if (!categoryId) throw new HttpError(400, `Category "${data.category}" not found.`);

    const result = await client.query(
      `INSERT INTO products (name, description, price, discount, category_id, sub_category, images, thumbnail_images, video_urls, stock, featured, color_images, image_details, group_buy_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [data.name, data.description ?? null, data.price, data.discount ?? null, categoryId, data.subCategory, data.images, data.thumbnailImages, data.videoUrls, data.stock, data.featured, JSON.stringify(data.colorImages), JSON.stringify(data.imageDetails), data.groupBuyEnabled]
    );
    const id = result.rows[0].id;
    await insertVariants(client, id, data.variants);
    return id;
  });

  updateProductImageEmbedding(productId, data.images[0]);
  return productId;
}

router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const productId = await createProduct(parsed.data);
    const created = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [productId]
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
  thumbnailImages: z.array(z.string()).optional(),
  videoUrls: z.array(z.string()).optional(),
  stock: z.number().int().nonnegative().optional(),
  featured: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
  colorImages: z.record(z.string(), z.string()).optional(),
  imageDetails: z.record(z.string(), imageDetailSchema).optional(),
  groupBuyEnabled: z.boolean().optional(),
});

async function updateProduct(id: string, data: z.infer<typeof productUpdateSchema>) {
  await withTransaction(async (client) => {
    let categoryId: string | null = null;
    if (data.category) {
      categoryId = await resolveCategoryId(client, data.category);
      if (!categoryId) throw new HttpError(400, `Category "${data.category}" not found.`);
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
         thumbnail_images = COALESCE($8, thumbnail_images),
         video_urls = COALESCE($9, video_urls),
         stock = COALESCE($10, stock),
         featured = COALESCE($11, featured),
         color_images = COALESCE($12, color_images),
         image_details = COALESCE($13, image_details),
         group_buy_enabled = COALESCE($14, group_buy_enabled)
       WHERE id = $15`,
      [
        data.name ?? null, data.description ?? null, data.price ?? null, data.discount ?? null,
        categoryId, data.subCategory ?? null, data.images ?? null, data.thumbnailImages ?? null, data.videoUrls ?? null,
        data.stock ?? null, data.featured ?? null, data.colorImages !== undefined ? JSON.stringify(data.colorImages) : null,
        data.imageDetails !== undefined ? JSON.stringify(data.imageDetails) : null,
        data.groupBuyEnabled ?? null, id,
      ]
    );
    if (result.rowCount === 0) throw new HttpError(404, 'Product not found.');

    if (data.variants) {
      await client.query(`DELETE FROM product_variants WHERE product_id = $1`, [id]);
      await insertVariants(client, id, data.variants);
    }
  });

  if (data.images && data.images.length > 0) {
    updateProductImageEmbedding(id, data.images[0]);
  }

  if (data.stock !== undefined || data.variants !== undefined) {
    checkAndNotifyRestock(id);
  }
}

router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    await updateProduct(req.params.id, parsed.data);
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

const CSV_COLUMNS = ['id', 'name', 'description', 'price', 'discount', 'category', 'subCategory', 'stock', 'featured', 'images', 'videoUrls', 'colorImages', 'variants'] as const;

// GET /api/products/export/csv - admin: full catalog as a spreadsheet-editable CSV. Multi-value
// fields (images, videoUrls) are pipe-separated and variants are packed as "color:size:price:stock"
// entries separated by ";" - compact enough to read and edit in Excel/Sheets without a nested format.
router.get('/export/csv', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.created_at DESC`
    );
    const withVariants = await attachVariants(result.rows);
    const rows = withVariants.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      price: p.price,
      discount: p.discount ?? '',
      category: p.category,
      subCategory: p.subCategory,
      stock: p.stock,
      featured: p.featured,
      images: (p.images || []).join('|'),
      videoUrls: (p.videoUrls || []).join('|'),
      colorImages: p.colorImages && Object.keys(p.colorImages).length > 0 ? JSON.stringify(p.colorImages) : '',
      variants: (p.variants || []).map((v: any) => `${v.color ?? ''}:${v.size ?? ''}:${v.price}:${v.stock}`).join(';'),
    }));
    const csv = stringifyCsv(rows, { header: true, columns: CSV_COLUMNS as unknown as string[] });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="kuisoko-products.csv"');
    return res.send(csv);
  } catch (err) {
    return next(err);
  }
});

const csvImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB - a products spreadsheet, not a media file
});

/** Turns one raw CSV row into a partial payload matching productSchema/productUpdateSchema's
 * shape - only fields the row actually has a non-blank value for are included, so re-exporting
 * and re-importing a row unchanged doesn't accidentally blank out fields on update, and so a
 * create-row can still rely on productSchema's own defaults for anything left blank. */
function parseCsvRow(row: Record<string, string>) {
  const val = (key: string) => (row[key] ?? '').trim();
  const data: Record<string, unknown> = {};

  if (val('name')) data.name = val('name');
  if (row.description !== undefined) data.description = val('description');
  if (val('price')) data.price = Number(val('price'));
  if (val('discount')) data.discount = Number(val('discount'));
  if (val('category')) data.category = val('category');
  if (val('subCategory')) data.subCategory = val('subCategory');
  if (row.images !== undefined) data.images = val('images') ? val('images').split('|').map(s => s.trim()).filter(Boolean) : [];
  if (row.videoUrls !== undefined) data.videoUrls = val('videoUrls') ? val('videoUrls').split('|').map(s => s.trim()).filter(Boolean) : [];
  if (val('stock')) data.stock = Number(val('stock'));
  if (val('featured')) data.featured = ['true', '1', 'yes'].includes(val('featured').toLowerCase());
  if (val('colorImages')) {
    try {
      data.colorImages = JSON.parse(val('colorImages'));
    } catch {
      throw new Error('colorImages is not valid JSON.');
    }
  }
  if (val('variants')) {
    data.variants = val('variants').split(';').filter(Boolean).map((entry) => {
      const [color, size, price, stock] = entry.split(':').map(s => s.trim());
      return { color: color || undefined, size: size || undefined, price: Number(price), stock: Number(stock) };
    });
  }

  return { id: val('id') || undefined, data };
}

// POST /api/products/import/csv - admin: bulk create/update products from a CSV file. A row with
// an `id` matching an existing product updates it (only the columns present are touched, same
// semantics as PATCH /:id); a row with no `id` (or one that matches nothing) creates a new product.
// Each row is applied independently so one bad row (typo'd category, malformed JSON) doesn't roll
// back an otherwise-good batch - the response reports exactly which rows failed and why.
router.post('/import/csv', authenticate, requireAdmin, csvImportUpload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded.' });

  let rows: Record<string, string>[];
  try {
    rows = parseCsv(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    return res.status(400).json({ error: 'Could not parse CSV file - check that it is valid, comma-separated, UTF-8 text.' });
  }

  let created = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row - matches the row a spreadsheet would show
    try {
      const { id, data } = parseCsvRow(rows[i]);
      if (id) {
        const parsed = productUpdateSchema.safeParse(data);
        if (!parsed.success) {
          errors.push({ row: rowNumber, message: parsed.error.issues[0].message });
          continue;
        }
        await updateProduct(id, parsed.data);
        updated++;
      } else {
        const parsed = productSchema.safeParse(data);
        if (!parsed.success) {
          errors.push({ row: rowNumber, message: parsed.error.issues[0].message });
          continue;
        }
        await createProduct(parsed.data);
        created++;
      }
    } catch (err) {
      errors.push({ row: rowNumber, message: err instanceof Error ? err.message : 'Unknown error.' });
    }
  }

  return res.json({ created, updated, errors });
});

// pgvector's `<=>` operator returns cosine DISTANCE (1 - cosine similarity), so lower = more
// visually/semantically similar. Threshold picked from empirically comparing real catalog photos:
// a genuinely different photo of the same/similar product (e.g. a customer's own phone photo of a
// sneaker vs. the catalog's two different sneaker listings) lands around 0.25-0.33 distance, with
// a wide, clean gap before the next real-but-different product (~0.45) and unrelated ones (~0.55+).
//
// There is deliberately NO looser fallback tier anymore: an earlier version re-ran the query with
// a much wider cutoff whenever nothing confident matched, so a photo with no real match in the
// catalog (e.g. a picture of a dog, with no pet food/toy that actually resembles it) still
// returned a page of tenuous "closest of what's here" guesses. That's not what "search by this
// photo" should do - a shopper scanning a physical item wants either a real match or a clear "no
// matching product," not a guess dressed up as a result. Returning zero rows here is a normal,
// expected outcome the client is expected to handle with its own "no match" messaging.
const MAX_COSINE_DISTANCE = 0.35;

// POST /api/products/search-by-image - public: find catalog products visually similar to an
// uploaded photo (e.g. taken with a phone camera). Embeds the photo with CLIP's image encoder
// (backend/src/lib/imageEmbedding.ts - a real vision model run locally via Transformers.js, no
// external API) and ranks the catalog by cosine distance in pgvector, so it recognizes the same
// product across genuinely different photos rather than only matching near-identical image files.
router.post('/search-by-image', imageSearchLimiter, imageSearchUpload.single('image'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'An image file is required.' });
  }
  try {
    const embedding = await computeImageEmbedding(req.file.buffer);
    const vectorLiteral = toVectorLiteral(embedding);

    const result = await pool.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.image_embedding IS NOT NULL AND (p.image_embedding <=> $1::vector) <= $2
       ORDER BY p.image_embedding <=> $1::vector
       LIMIT 12`,
      [vectorLiteral, MAX_COSINE_DISTANCE]
    );

    const withVariants = await attachVariants(result.rows);
    return res.json({ products: await attachRatingBreakdown(withVariants) });
  } catch (err) {
    return next(err);
  }
});

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

router.post('/:id/reviews', authenticate, async (req, res, next) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const userResult = await pool.query(`SELECT name, username FROM users WHERE id = $1`, [req.authUser!.id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'User not found.' });

    const result = await pool.query(
      `INSERT INTO reviews (product_id, user_id, user_name, user_username, rating, comment, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_name AS "userName", user_username AS "userUsername", rating, comment, image, created_at AS date`,
      [req.params.id, req.authUser!.id, userResult.rows[0].name, userResult.rows[0].username, parsed.data.rating, parsed.data.comment ?? null, parsed.data.image ?? null]
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

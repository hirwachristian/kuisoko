import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Footer settings
// ---------------------------------------------------------------------------

async function getFooterSettings() {
  const settingsResult = await pool.query(
    `SELECT location_lines AS "locationLines", phone_number AS "phoneNumber",
            email_address AS "emailAddress", copyright_text AS "copyrightText"
     FROM footer_settings WHERE id = 1`
  );
  const linksResult = await pool.query(
    `SELECT link_type AS "linkType", label, to_path AS "to" FROM footer_links ORDER BY display_order`
  );
  return {
    ...(settingsResult.rows[0] ?? { locationLines: [], phoneNumber: null, emailAddress: null, copyrightText: null }),
    quickLinks: linksResult.rows.filter((l) => l.linkType === 'quick').map(({ label, to }) => ({ label, to })),
    supportLinks: linksResult.rows.filter((l) => l.linkType === 'support').map(({ label, to }) => ({ label, to })),
  };
}

router.get('/footer', async (_req, res, next) => {
  try {
    return res.json(await getFooterSettings());
  } catch (err) {
    return next(err);
  }
});

const linkSchema = z.object({ label: z.string().trim().min(1), to: z.string().trim().min(1) });
const footerUpdateSchema = z.object({
  locationLines: z.array(z.string()).optional(),
  phoneNumber: z.string().trim().optional(),
  emailAddress: z.string().trim().optional(),
  copyrightText: z.string().trim().optional(),
  quickLinks: z.array(linkSchema).optional(),
  supportLinks: z.array(linkSchema).optional(),
});

router.patch('/footer', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = footerUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE footer_settings SET
           location_lines = COALESCE($1, location_lines),
           phone_number = COALESCE($2, phone_number),
           email_address = COALESCE($3, email_address),
           copyright_text = COALESCE($4, copyright_text)
         WHERE id = 1`,
        [data.locationLines ?? null, data.phoneNumber ?? null, data.emailAddress ?? null, data.copyrightText ?? null]
      );

      for (const [linkType, links] of [['quick', data.quickLinks], ['support', data.supportLinks]] as const) {
        if (!links) continue;
        await client.query(`DELETE FROM footer_links WHERE link_type = $1`, [linkType]);
        for (let i = 0; i < links.length; i++) {
          await client.query(
            `INSERT INTO footer_links (link_type, label, to_path, display_order) VALUES ($1, $2, $3, $4)`,
            [linkType, links[i].label, links[i].to, i + 1]
          );
        }
      }
    });
    return res.json(await getFooterSettings());
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

router.get('/payment-methods', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT id, name, enabled, detail FROM payment_methods ORDER BY name`);
    return res.json({ paymentMethods: result.rows });
  } catch (err) {
    return next(err);
  }
});

const paymentMethodsSchema = z.object({
  methods: z.array(z.object({
    name: z.string().trim().min(1),
    enabled: z.boolean(),
    detail: z.string().trim().min(1),
  })),
});

// PUT /api/settings/payment-methods - admin: replace the whole list
router.put('/payment-methods', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = paymentMethodsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM payment_methods`);
      for (const m of parsed.data.methods) {
        await client.query(
          `INSERT INTO payment_methods (name, enabled, detail) VALUES ($1, $2, $3)`,
          [m.name, m.enabled, m.detail]
        );
      }
    });
    const result = await pool.query(`SELECT id, name, enabled, detail FROM payment_methods ORDER BY name`);
    return res.json({ paymentMethods: result.rows });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// App settings (maintenance mode, currency, language)
// ---------------------------------------------------------------------------

router.get('/app', async (_req, res, next) => {
  try {
    const settingsResult = await pool.query(
      `SELECT maintenance_mode AS "maintenanceMode", default_currency AS "defaultCurrency", default_language AS "defaultLanguage",
              marketing_emails_enabled AS "marketingEmailsEnabled"
       FROM app_settings WHERE id = 1`
    );
    const currenciesResult = await pool.query(
      `SELECT code, symbol, label, exchange_rate AS "exchangeRate" FROM currencies ORDER BY code`
    );
    const languagesResult = await pool.query(`SELECT code, label FROM languages ORDER BY code`);
    return res.json({
      ...(settingsResult.rows[0] ?? {}),
      currencies: currenciesResult.rows,
      languages: languagesResult.rows,
    });
  } catch (err) {
    return next(err);
  }
});

const appSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  defaultCurrency: z.string().trim().optional(),
  defaultLanguage: z.string().trim().optional(),
  marketingEmailsEnabled: z.boolean().optional(),
});

router.patch('/app', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = appSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  try {
    await pool.query(
      `UPDATE app_settings SET
         maintenance_mode = COALESCE($1, maintenance_mode),
         default_currency = COALESCE($2, default_currency),
         default_language = COALESCE($3, default_language),
         marketing_emails_enabled = COALESCE($4, marketing_emails_enabled)
       WHERE id = 1`,
      [data.maintenanceMode ?? null, data.defaultCurrency ?? null, data.defaultLanguage ?? null, data.marketingEmailsEnabled ?? null]
    );
    const result = await pool.query(
      `SELECT maintenance_mode AS "maintenanceMode", default_currency AS "defaultCurrency", default_language AS "defaultLanguage",
              marketing_emails_enabled AS "marketingEmailsEnabled"
       FROM app_settings WHERE id = 1`
    );
    return res.json(result.rows[0]);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23503') {
      return res.status(400).json({ error: 'Unknown currency or language code.' });
    }
    return next(err);
  }
});

export default router;

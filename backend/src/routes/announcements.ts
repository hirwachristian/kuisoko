import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendAnnouncementEmail } from '../lib/brevo.js';

const router = Router();

const BANNER_COLUMNS = `id, message, expires_at AS "expiresAt", created_at AS "createdAt"`;

// GET /api/announcements/banners - public: every currently-live banner (active and not yet expired)
router.get('/banners', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${BANNER_COLUMNS} FROM site_announcements
       WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC`
    );
    return res.json({ banners: result.rows });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/announcements/banners/:id - admin: turn off one specific banner
router.patch('/banners/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE site_announcements SET is_active = false WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Banner not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

const announcementSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required'),
  message: z.string().trim().min(1, 'Message is required'),
  showAsBanner: z.boolean().optional().default(false),
  // Hours the banner should stay up before auto-expiring; omit/null for no expiry.
  bannerDurationHours: z.number().positive().nullable().optional(),
});

// POST /api/announcements/send - admin: email a discount/special announcement to every active
// newsletter subscriber (gated by app_settings.marketing_emails_enabled, "Push Alerts"), and/or
// add it to the site banner list - visible until the admin turns it off or it expires.
router.post('/send', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = announcementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { subject, message, showAsBanner, bannerDurationHours } = parsed.data;

  try {
    const subscribersResult = await pool.query<{ email: string }>(`SELECT email FROM newsletter_subscribers WHERE is_active = true`);
    const total = subscribersResult.rowCount ?? 0;
    let sent = 0;

    if (total > 0) {
      const settingsResult = await pool.query(`SELECT marketing_emails_enabled AS "enabled" FROM app_settings WHERE id = 1`);
      if (!settingsResult.rows[0]?.enabled) {
        return res.status(409).json({ error: 'Push Alerts are turned off. Enable them in Business & Notifications before sending.' });
      }
      for (const { email } of subscribersResult.rows) {
        const ok = await sendAnnouncementEmail(email, subject, message);
        if (ok) sent++;
      }
    } else if (!showAsBanner) {
      return res.status(400).json({ error: 'There are no active subscribers to send to.' });
    }

    let banner = null;
    if (showAsBanner) {
      const expiresAt = bannerDurationHours ? new Date(Date.now() + bannerDurationHours * 3600_000) : null;
      const bannerResult = await pool.query(
        `INSERT INTO site_announcements (message, expires_at) VALUES ($1, $2) RETURNING ${BANNER_COLUMNS}`,
        [`${subject}: ${message}`, expiresAt]
      );
      banner = bannerResult.rows[0];
    }

    return res.json({ sent, total, banner });
  } catch (err) {
    return next(err);
  }
});

export default router;

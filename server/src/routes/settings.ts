import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../db.js';
import { send } from '../lib/http.js';
import { config } from '../config.js';
import { rateLimit } from '../lib/rateLimit.js';

export const publicRouter = Router();

export function getSettings(db: DB, keys?: string[]): Record<string, unknown> {
  const rows = (keys && keys.length
    ? db.prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`).all(...keys)
    : db.prepare('SELECT key, value FROM settings').all()) as { key: string; value: string }[];
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
  }
  return out;
}

export function setSetting(db: DB, key: string, value: unknown) {
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, JSON.stringify(value));
}

export function isFeatureEnabled(db: DB, key: string, envDefault: boolean): boolean {
  const rows = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!rows) return envDefault;
  try { return Boolean(JSON.parse(rows.value)); } catch { return envDefault; }
}

const PUBLIC_SETTING_KEYS = [
  'site_name', 'site_tagline', 'site_description', 'contact_email', 'contact_phone', 'address',
  'footer_about', 'primary_color', 'accent_color', 'default_language', 'allow_registration',
  'guest_tests_enabled', 'result_visibility', 'maintenance_mode', 'hero_badge', 'disclaimer', 'logo_url',
];

publicRouter.get('/settings', (req, res) => {
  const settings = getSettings(req.db, PUBLIC_SETTING_KEYS);
  send(res, {
    ...settings,
    maintenance_mode: Boolean(settings.maintenance_mode) || config.maintenanceMode,
    site_url: config.siteUrl,
    demo_mode: settings.demo_mode !== false,
  });
});

publicRouter.get('/health', (req, res) => {
  const db = req.db;
  const row = db.prepare('SELECT COUNT(*) AS questions FROM questions').get() as { questions: number };
  res.status(200).json({ ok: true, status: 'healthy', database: 'connected', questions: row.questions, time: new Date().toISOString() });
});

const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, prefix: 'contact' });

publicRouter.post('/contact', contactLimiter, (req, res) => {
  const { name, email, subject, message } = req.body || {};
  const schema = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(160),
    subject: z.string().trim().min(3).max(160),
    message: z.string().trim().min(10).max(4000),
  });
  const parsed = schema.safeParse({ name, email, subject, message });
  if (!parsed.success) {
    return res.status(422).json({ ok: false, error: 'Please check the form fields.', details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  const info = req.db.prepare('INSERT INTO contact_messages (name, email, subject, message) VALUES (?,?,?,?)')
    .run(parsed.data.name, parsed.data.email, parsed.data.subject, parsed.data.message);
  send(res, { id: Number(info.lastInsertRowid), received: true }, 201);
});

publicRouter.get('/countdowns', (req, res) => {
  const rows = req.db.prepare('SELECT id, title, exam_date FROM exam_countdowns WHERE is_active = 1 AND exam_date >= date(?) ORDER BY exam_date LIMIT 3')
    .all(new Date().toISOString().slice(0, 10));
  send(res, rows);
});

publicRouter.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /my-results\nDisallow: /my-progress\nDisallow: /bookmarks\nDisallow: /revision\nDisallow: /test/*/attempt\nDisallow: /api/\nSitemap: ${config.siteUrl.replace(/\/$/, '')}/sitemap.xml\n`,
  );
});

publicRouter.get('/sitemap.xml', (req, res) => {
  const db = req.db;
  const base = config.siteUrl.replace(/\/$/, '');
  const staticPaths = ['', '/exams', '/books', '/tests', '/about', '/contact', '/privacy-policy', '/terms', '/cookie-policy', '/disclaimer', '/help', '/sitemap'];
  const categories = db.prepare('SELECT slug FROM categories WHERE is_active = 1').all() as { slug: string }[];
  const books = db.prepare('SELECT slug FROM books WHERE is_active = 1').all() as { slug: string }[];
  const subjects = db.prepare('SELECT slug FROM subjects WHERE is_active = 1').all() as { slug: string }[];
  const tests = db.prepare('SELECT slug FROM tests WHERE is_published = 1 AND is_listed = 1 AND is_active = 1').all() as { slug: string }[];
  const urls = [
    ...staticPaths.map((p) => `${base}${p}`),
    ...categories.map((c) => `${base}/exams/${c.slug}`),
    ...books.map((b) => `${base}/books/${b.slug}`),
    ...subjects.map((s) => `${base}/subjects/${s.slug}`),
    ...tests.map((t) => `${base}/tests/${t.slug}`),
  ];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
      .map((u) => `<url><loc>${u.replace(/&/g, '&amp;')}</loc><changefreq>weekly</changefreq></url>`)
      .join('')}</urlset>`,
  );
});

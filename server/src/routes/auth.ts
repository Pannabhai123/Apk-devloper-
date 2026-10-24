import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { isoAfter } from '../db.js';
import { claimGuestData, clearSession, createSession, hashPassword, passwordStrength, randomToken, sha256, verifyPassword } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { badRequest, conflict, send, tooMany, unauthorized } from '../lib/http.js';
import { rateLimit } from '../lib/rateLimit.js';
import { validateBody } from '../lib/validate.js';
import { getSettings, isFeatureEnabled } from './settings.js';

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 12, prefix: 'login', keyFn: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}` });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, prefix: 'reset' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, prefix: 'register' });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160).transform((s) => s.toLowerCase()),
  phone: z.string().trim().max(20).optional().default(''),
  password: z.string().min(8).max(128),
});

authRouter.post('/register', registerLimiter, validateBody(registerSchema), (req, res) => {
  const db = req.db;
  if (!isFeatureEnabled(db, 'allow_registration', config.allowRegistration)) throw tooMany('New registrations are currently disabled.');
  const { name, email, phone, password } = req.body;
  const strengthError = passwordStrength(password);
  if (strengthError) throw badRequest(strengthError);
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw conflict('An account with this email already exists.');
  const role = db.prepare("SELECT id FROM roles WHERE key = 'student'").get() as { id: number };
  const info = db.prepare('INSERT INTO users (name, email, phone, password_hash, role_id) VALUES (?,?,?,?,?)')
    .run(name, email, phone || null, hashPassword(password), role.id);
  const userId = Number(info.lastInsertRowid);
  claimGuestData(db, req.auth.session.id, userId);
  const session = createSession(db, res, req, 'user', userId);
  const user = db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.locale, u.daily_goal_questions, r.key AS role
    FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(userId);
  audit(db, req, 'auth.register', 'users', userId);
  send(res, { user, csrfToken: session.csrf_token }, 201);
});

authRouter.post('/login', loginLimiter, validateBody(z.object({
  email: z.string().trim().email().transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(128),
})), (req, res) => {
  const db = req.db;
  const { email, password } = req.body;
  const row = db.prepare('SELECT u.*, r.key AS role_key FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?').get(email) as
    | { id: number; password_hash: string; status: string; role_key: string; name: string; email: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) throw unauthorized('Invalid email or password.');
  if (row.status !== 'active') throw unauthorized('This account has been suspended. Contact support.');
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  claimGuestData(db, req.auth.session.id, row.id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.auth.session.id);
  const session = createSession(db, res, req, 'user', row.id);
  const user = db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.locale, u.daily_goal_questions, r.key AS role
    FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(row.id);
  audit(db, req, 'auth.login', 'users', row.id);
  send(res, { user, csrfToken: session.csrf_token });
});

authRouter.post('/logout', (req, res) => {
  audit(req.db, req, 'auth.logout', 'users', req.auth.user?.id);
  clearSession(req.db, req, res);
  send(res, { loggedOut: true });
});

authRouter.get('/me', (req, res) => {
  const db = req.db;
  const settings = getSettings(db, ['allow_registration', 'guest_tests_enabled', 'maintenance_mode', 'site_name']);
  const user = req.auth.user;
  send(res, {
    user: user ? {
      id: user.id, name: user.name, email: user.email, role: user.role_key,
      permissions: user.permissions, locale: user.locale, dailyGoal: user.daily_goal_questions,
    } : null,
    csrfToken: req.auth.session.csrf_token,
    sessionKind: req.auth.session.kind,
    settings,
  });
});

authRouter.patch('/profile', validateBody(z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  locale: z.enum(['en', 'hi']).optional(),
  dailyGoalQuestions: z.coerce.number().int().min(0).max(1000).optional(),
})), (req, res) => {
  if (!req.auth.user) throw unauthorized();
  const db = req.db;
  const { name, phone, locale, dailyGoalQuestions } = req.body;
  db.prepare(`UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone),
    locale = COALESCE(?, locale), daily_goal_questions = COALESCE(?, daily_goal_questions), updated_at = ? WHERE id = ?`)
    .run(name ?? null, phone ?? null, locale ?? null, dailyGoalQuestions ?? null, new Date().toISOString(), req.auth.user.id);
  audit(db, req, 'profile.update', 'users', req.auth.user.id);
  send(res, { updated: true });
});

authRouter.post('/password/forgot', resetLimiter, validateBody(z.object({ email: z.string().trim().email() })), (req, res) => {
  const db = req.db;
  const email = req.body.email.toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  let devToken: string | undefined;
  if (user) {
    const token = randomToken();
    db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)')
      .run(user.id, sha256(token), isoAfter(3600));
    // No mail transport is bundled. In development the token is returned so the
    // recovery flow is testable; production must configure an SMTP provider.
    if (!config.isProd) devToken = token;
  }
  send(res, {
    message: 'If an account exists for that email, a reset link has been issued.',
    ...(devToken ? { devResetToken: devToken, note: 'Development only: no email service is configured.' } : {}),
  });
});

authRouter.post('/password/reset', validateBody(z.object({ token: z.string().min(10), password: z.string().min(8).max(128) })), (req, res) => {
  const db = req.db;
  const strengthError = passwordStrength(req.body.password);
  if (strengthError) throw badRequest(strengthError);
  const row = db.prepare('SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .get(sha256(req.body.token), new Date().toISOString()) as { id: number; user_id: number } | undefined;
  if (!row) throw badRequest('This reset link is invalid or has expired.');
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(req.body.password), new Date().toISOString(), row.user_id);
    db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  })();
  audit(db, req, 'auth.password_reset', 'users', row.user_id);
  send(res, { reset: true });
});

authRouter.delete('/account', validateBody(z.object({ password: z.string().min(1) })), (req, res) => {
  const user = req.auth.user;
  if (!user) throw unauthorized();
  const db = req.db;
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
  if (!verifyPassword(req.body.password, row.password_hash)) throw badRequest('Password confirmation failed.');
  db.transaction(() => {
    db.prepare('UPDATE attempts SET user_id = NULL WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM bookmarks WHERE user_id = ?').run(user.id);
    db.prepare('UPDATE question_reports SET user_id = NULL WHERE user_id = ?').run(user.id);
    db.prepare('UPDATE audit_logs SET actor_id = NULL WHERE actor_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  })();
  clearSession(db, req, res);
  send(res, { deleted: true });
});

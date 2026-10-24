import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import type { DB } from '../db.js';
import { isoAfter, nowIso } from '../db.js';
import { forbidden, HttpError, unauthorized } from './http.js';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  status: string;
  role_id: number;
  role_key: string;
  role_name: string;
  permissions: string[];
  daily_goal_questions: number;
  locale: string;
}

export interface AuthSession {
  id: number;
  kind: 'user' | 'guest';
  user_id: number | null;
  csrf_token: string;
  expires_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: { session: AuthSession; user: AuthUser | null };
      db: DB;
    }
  }
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

const SCRYPT_N = 32768;
// N=32768 with r=8 needs ~32 MiB, slightly above Node's default scrypt maxmem.
const SCRYPT_OPTIONS = { N: SCRYPT_N, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { ...SCRYPT_OPTIONS, N: Number(n) });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function passwordStrength(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 128) return 'Password is too long.';
  return null;
}

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    try {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}

const SESSION_COOKIE = 'vp_session';
const CSRF_COOKIE = 'vp_csrf';

function setSessionCookies(res: Response, token: string, csrf: string, hours: number) {
  const maxAge = hours * 3600 * 1000;
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.cookieSecure,
    path: '/',
  };
  res.cookie(SESSION_COOKIE, token, { ...base, maxAge });
  res.cookie(CSRF_COOKIE, csrf, { httpOnly: false, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge });
}

export function createSession(
  db: DB,
  res: Response,
  req: Request,
  kind: 'user' | 'guest',
  userId: number | null = null,
): AuthSession {
  const token = randomToken();
  const csrf = randomToken(24);
  const hours = kind === 'user' ? config.sessionTtlHours : config.guestTtlHours;
  const expiresAt = isoAfter(hours * 3600);
  const info = db
    .prepare(
      'INSERT INTO sessions (token_hash, csrf_token, user_id, kind, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)',
    )
    .run(sha256(token), csrf, userId, kind, expiresAt, req.ip || null, String(req.get('user-agent') || '').slice(0, 250));
  setSessionCookies(res, token, csrf, hours);
  return { id: Number(info.lastInsertRowid), kind, user_id: userId, csrf_token: csrf, expires_at: expiresAt };
}

function loadUser(db: DB, id: number): AuthUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.status, u.role_id, u.daily_goal_questions, u.locale,
              r.key AS role_key, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    )
    .get(id) as Omit<AuthUser, 'permissions'> | undefined;
  if (!row || row.status !== 'active') return null;
  const permissions = (
    db
      .prepare(
        `SELECT p.key FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ?`,
      )
      .all(row.role_id) as { key: string }[]
  ).map((r) => r.key);
  return { ...row, permissions };
}

/** Ensures every API client has a server-side session (guest when anonymous). */
export function sessionMiddleware(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.db = db;
    const token = parseCookies(req.get('cookie'))[SESSION_COOKIE];
    if (token) {
      const row = db
        .prepare('SELECT id, kind, user_id, csrf_token, expires_at FROM sessions WHERE token_hash = ?')
        .get(sha256(token)) as Omit<AuthSession, 'kind'> & { kind: string } | undefined;
      if (row && Date.parse(row.expires_at) > Date.now()) {
        const user = row.kind === 'user' && row.user_id ? loadUser(db, row.user_id) : null;
        req.auth = {
          session: { ...row, kind: row.kind as 'user' | 'guest', user_id: row.user_id },
          user: user && row.kind === 'user' ? user : null,
        };
        // A suspended account is downgraded to a guest rather than left half-authenticated.
        if (row.kind === 'user' && !req.auth.user) {
          db.prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
          req.auth = { session: createSession(db, res, req, 'guest'), user: null };
        }
        return next();
      }
      if (row) db.prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
    }
    req.auth = { session: createSession(db, res, req, 'guest'), user: null };
    next();
  };
}

/** CSRF double-submit check for all state-changing cookie-authenticated requests. */
export function csrfMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const expected = req.auth?.session.csrf_token;
  // The header must be supplied explicitly: accepting the cookie alone would
  // allow a cross-site form to satisfy the check automatically.
  const provided = req.get('x-csrf-token');
  if (!expected || !provided || provided !== expected) {
    return next(new HttpError(403, 'Invalid or missing CSRF token. Refresh the page and try again.'));
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.user) return next(unauthorized('Please sign in to continue.'));
  next();
}

export function requirePermission(...keys: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.auth?.user;
    if (!user) return next(unauthorized());
    if (!keys.some((k) => user.permissions.includes(k))) return next(forbidden());
    next();
  };
}

export const requireAdmin = requirePermission(
  'catalog.manage',
  'questions.manage',
  'tests.manage',
  'users.manage',
  'analytics.view',
  'settings.manage',
  'attempts.view',
  'reports.manage',
  'roles.manage',
);

export function clearSession(db: DB, req: Request, res: Response) {
  if (req.auth?.session) db.prepare('DELETE FROM sessions WHERE id = ?').run(req.auth.session.id);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
  req.auth = { session: createSession(db, res, req, 'guest'), user: null };
}

/** Move guest-owned attempts/bookmarks to a real account at login/registration. */
export function claimGuestData(db: DB, guestSessionId: number, userId: number) {
  db.transaction(() => {
    db.prepare('UPDATE attempts SET user_id = ? WHERE guest_session_id = ? AND user_id IS NULL').run(userId, guestSessionId);
    db.prepare('UPDATE bookmarks SET user_id = ?, guest_session_id = NULL WHERE guest_session_id = ?').run(userId, guestSessionId);
    db.prepare('UPDATE question_reports SET user_id = ? WHERE guest_session_id = ?').run(userId, guestSessionId);
  })();
}

export function sessionExpiresAt(kind: 'user' | 'guest') {
  return isoAfter((kind === 'user' ? config.sessionTtlHours : config.guestTtlHours) * 3600);
}

export function currentTimestamp() {
  return nowIso();
}

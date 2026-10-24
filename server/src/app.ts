import express, { type Express } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import type { DB } from './db.js';
import { cleanupExpiredSessions, csrfMiddleware, sessionMiddleware } from './lib/auth.js';
import { errorHandler, HttpError, notFoundHandler } from './lib/http.js';
import { rateLimit } from './lib/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { testsRouter } from './routes/tests.js';
import { attemptsRouter, expireDueAttempts } from './routes/attempts.js';
import { analyticsRouter, practiceRouter, resultsRouter } from './routes/results.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter, isFeatureEnabled } from './routes/settings.js';
import { seedAdmin, seedRolesAndSettings } from './seed.js';

export interface AppOptions { serveStatic?: boolean }

export function createApp(db: DB, options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(compression());

  if (config.isProd) {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          // The SPA is served from this same origin, so 'self' is the correct
          // and safest connect-src. When the operator explicitly pinned a
          // cross-origin public origin (e.g. a separate API host) it is added too.
          connectSrc: config.publicOriginExplicit ? ["'self'", config.publicOrigin] : ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          // Clickjacking protection: the exam UI must not be embeddable by third parties.
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: config.cookieSecure
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));
  }
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(cookieParser());
  app.use((req, _res, next) => { req.db = db; next(); });
  app.use('/uploads', express.static(config.uploadDir, { immutable: true, maxAge: '7d', fallthrough: true }));

  // Public SEO endpoints at the site root. Only safe methods are exposed here:
  // the state-changing /contact route lives behind CSRF at /api/contact.
  app.use('/', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return publicRouter(req, res, next);
    return next();
  });

  // Session-scoped API data must never be stored by shared caches/proxies.
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', express.json({ limit: '2mb' }));
  app.use('/api', sessionMiddleware(db));
  app.use('/api', (req, _res, next) => {
    const maintenance = isFeatureEnabled(db, 'maintenance_mode', config.maintenanceMode);
    const exempt = req.path === '/health' || req.path === '/settings' || req.path.startsWith('/auth') ||
      req.path.startsWith('/admin') || req.method === 'GET';
    if (maintenance && !exempt) return next(new HttpError(503, 'Maintenance mode is enabled. Please try again shortly.'));
    next();
  });
  app.use('/api', csrfMiddleware);
  // A general safety net for state-changing API calls. Endpoint-specific
  // limiters (login, password reset, contact) remain stricter.
  const writeLimiter = rateLimit({ windowMs: 60_000, max: 180, prefix: 'api-write' });
  app.use('/api', (req, _res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    return writeLimiter(req, _res, next);
  });
  app.use('/api', publicRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/tests', testsRouter);
  app.use('/api/attempts', attemptsRouter);
  app.use('/api/results', resultsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api', practiceRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', catalogRouter);
  app.use('/api', notFoundHandler);
  app.use('/api', errorHandler);

  if (options.serveStatic !== false) {
    const dist = config.webDist;
    if (fs.existsSync(dist)) {
      app.use(express.static(dist, { index: false, maxAge: '1h', setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } }));
      app.get('*', (_req, res) => {
        const index = path.join(dist, 'index.html');
        if (fs.existsSync(index)) return res.sendFile(index);
        res.status(503).type('text/plain').send('Frontend build not found. Run `npm run build:web`.');
      });
    } else {
      app.get('*', (_req, res) => res.status(503).type('text/plain').send('Frontend build not found. Run `npm run build:web`.'));
    }
  }

  app.use(errorHandler);
  return app;
}

export function startExpirySweeper(db: DB, intervalMs = 20_000) {
  const timer = setInterval(() => {
    try {
      const count = expireDueAttempts(db);
      if (count) console.log(`[expiry] finalized ${count} expired attempt(s)`);
    } catch (err) {
      console.error('[expiry] sweeper failed:', err instanceof Error ? err.message : 'unknown error');
    }
    try {
      const removed = cleanupExpiredSessions(db);
      if (removed > 25) console.log(`[expiry] removed ${removed} expired session(s)`);
    } catch (err) {
      console.error('[expiry] session cleanup failed:', err instanceof Error ? err.message : 'unknown error');
    }
  }, intervalMs);
  timer.unref();
  return timer;
}

export function createAdminFromCli(db: DB, email: string, password: string) {
  seedRolesAndSettings(db);
  const result = seedAdmin(db, email, password);
  if (result.created) {
    db.prepare('INSERT INTO audit_logs (actor_email, actor_role, action, entity, entity_id) VALUES (?,?,?,?,?)')
      .run(email, 'super_admin', 'admin.create_cli', 'users', email);
  }
  return result;
}

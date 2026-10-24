import path from 'node:path';

const env = process.env;

export const config = {
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT || 4000),
  publicOrigin: env.PUBLIC_ORIGIN || 'http://localhost:5173',
  databasePath: env.DATABASE_PATH || './data/vidyapariksha.db',
  sessionSecret: env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  sessionTtlHours: Number(env.SESSION_TTL_HOURS || 168),
  guestTtlHours: Number(env.GUEST_TTL_HOURS || 720),
  cookieSecure: env.COOKIE_SECURE === 'true',
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  allowRegistration: env.ALLOW_REGISTRATION !== 'false',
  guestTestsEnabled: env.GUEST_TESTS_ENABLED !== 'false',
  maintenanceMode: env.MAINTENANCE_MODE === 'true',
  uploadDir: path.resolve(env.UPLOAD_DIR || './data/uploads'),
  webDist: path.resolve(env.WEB_DIST || './dist'),
  siteUrl: env.SITE_URL || env.PUBLIC_ORIGIN || 'http://localhost:5173',
};

export function assertProductionSecrets() {
  if (!config.isProd) return;
  if (config.sessionSecret.startsWith('dev-only')) {
    throw new Error('SESSION_SECRET must be set to a strong random value in production.');
  }
  if (!config.cookieSecure) {
    // Not fatal behind a TLS-terminating proxy, but make the misconfiguration visible.
    console.warn('[security] COOKIE_SECURE is false in production; set it to true when serving HTTPS.');
  }
}

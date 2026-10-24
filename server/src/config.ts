import path from 'node:path';

const env = process.env;

const DEV_SESSION_SECRET = 'dev-only-insecure-secret-change-me';
// Values that must never be accepted as a production secret.
const OBVIOUS_SECRETS = [
  DEV_SESSION_SECRET,
  'replace-with-a-long-random-development-value',
  'changeme', 'change-me', 'secret', 'password', 'your-secret', 'supersecret',
];

export const config = {
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT || 4000),
  publicOrigin: env.PUBLIC_ORIGIN || 'http://localhost:5173',
  // True when the operator explicitly set PUBLIC_ORIGIN/SITE_URL. When false the
  // public origin is derived from each incoming request, which is what you want
  // on a free `*.onrender.com` / `*.fly.dev` subdomain where the host is assigned
  // after deploy.
  publicOriginExplicit: Boolean(env.PUBLIC_ORIGIN || env.SITE_URL),
  databasePath: env.DATABASE_PATH || './data/vidyapariksha.db',
  sessionSecret: env.SESSION_SECRET || DEV_SESSION_SECRET,
  sessionTtlHours: Number(env.SESSION_TTL_HOURS || 168),
  guestTtlHours: Number(env.GUEST_TTL_HOURS || 720),
  cookieSecure: env.COOKIE_SECURE === 'true',
  // Explicit escape hatch for local HTTP smoke tests only. Never set in real deployments.
  allowInsecureCookies: env.ALLOW_INSECURE_COOKIES === '1',
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  allowRegistration: env.ALLOW_REGISTRATION !== 'false',
  // One-time first-administrator bootstrap (see README §14). Empty = disabled.
  adminBootstrapSecret: env.ADMIN_BOOTSTRAP_SECRET || '',
  // Populate the demo question bank the first time the database is empty.
  seedDemoOnEmpty: env.SEED_DEMO_ON_EMPTY === 'true',
  guestTestsEnabled: env.GUEST_TESTS_ENABLED !== 'false',
  maintenanceMode: env.MAINTENANCE_MODE === 'true',
  uploadDir: path.resolve(env.UPLOAD_DIR || './data/uploads'),
  webDist: path.resolve(env.WEB_DIST || './dist'),
  siteUrl: env.SITE_URL || env.PUBLIC_ORIGIN || 'http://localhost:5173',
  siteUrlExplicit: Boolean(env.SITE_URL || env.PUBLIC_ORIGIN),

  // Password recovery / mail integration boundary.
  exposeDevResetToken: env.EXPOSE_DEV_RESET_TOKEN === 'true',
  resetTokenTtlSeconds: Number(env.RESET_TOKEN_TTL_SECONDS || 3600),
  mailProvider: (env.MAIL_PROVIDER || 'none').toLowerCase(),
  mailFrom: env.MAIL_FROM || '',
  smtpHost: env.SMTP_HOST || '',
  smtpPort: Number(env.SMTP_PORT || 587),
  smtpUser: env.SMTP_USER || '',
  smtpPassword: env.SMTP_PASSWORD || '',
  smtpSecure: env.SMTP_SECURE === 'true',
  resendApiKey: env.RESEND_API_KEY || '',
};

/** True when a real (or explicitly-developmental console) mail transport is usable. */
export function mailDeliveryConfigured(): boolean {
  switch (config.mailProvider) {
    case 'console':
      return !config.isProd; // never silently "deliver" to a log in production
    case 'smtp':
      return Boolean(config.smtpHost && config.mailFrom);
    case 'resend':
      return Boolean(config.resendApiKey && config.mailFrom);
    default:
      return false;
  }
}

export interface ProductionSecurityInput {
  sessionSecret: string;
  cookieSecure: boolean;
  allowInsecureCookies: boolean;
  exposeDevResetToken: boolean;
  publicOrigin: string;
  publicOriginExplicit: boolean;
  mailConfigured: boolean;
  adminBootstrapSecret: string;
}

/** Pure, unit-testable production checks (no process.env access). */
export function checkProductionConfig(c: ProductionSecurityInput): void {
  const secret = c.sessionSecret.trim();
  if (secret.length < 32 || OBVIOUS_SECRETS.includes(secret.toLowerCase()) ||
      /^(replace|dev-only|change|example|test)/i.test(secret)) {
    throw new Error(
      'SESSION_SECRET must be set to a strong random value (32+ chars) in production. ' +
      'Generate one with: openssl rand -hex 32',
    );
  }
  if (!c.cookieSecure && !c.allowInsecureCookies) {
    throw new Error(
      'COOKIE_SECURE must be true in production. Set COOKIE_SECURE=true behind HTTPS. ' +
      'For local HTTP smoke tests only, set ALLOW_INSECURE_COOKIES=1.',
    );
  }
  if (!c.cookieSecure && c.allowInsecureCookies) {
    console.warn('[security] WARNING: cookies are NOT marked Secure in production (ALLOW_INSECURE_COOKIES=1).');
  }
  if (c.exposeDevResetToken) {
    throw new Error('EXPOSE_DEV_RESET_TOKEN must never be enabled in production.');
  }
  if (!c.publicOriginExplicit && /localhost|127\.0\.0\.1/i.test(c.publicOrigin)) {
    // Normal case for a freshly deployed free subdomain: the host is assigned by
    // the provider, so the origin is taken from each request instead.
    console.info('[security] PUBLIC_ORIGIN is not set; the public HTTPS origin will be derived from incoming requests.');
  } else if (c.publicOriginExplicit && /localhost|127\.0\.0\.1/i.test(c.publicOrigin)) {
    console.warn('[security] PUBLIC_ORIGIN still points to localhost in production; set the public HTTPS origin.');
  }
  if ((c.adminBootstrapSecret || '').length < 16) {
    console.warn('[security] ADMIN_BOOTSTRAP_SECRET is not set (or is shorter than 16 chars): the one-time first-administrator setup flow is disabled.');
  }
  if (!c.mailConfigured) {
    console.warn('[security] No mail provider configured: password recovery will return 503 until MAIL_PROVIDER is set.');
  }
}

export function assertProductionSecrets() {
  if (!config.isProd) return;
  checkProductionConfig({
    sessionSecret: config.sessionSecret,
    cookieSecure: config.cookieSecure,
    allowInsecureCookies: config.allowInsecureCookies,
    exposeDevResetToken: config.exposeDevResetToken,
    publicOrigin: config.publicOrigin,
    publicOriginExplicit: config.publicOriginExplicit,
    mailConfigured: mailDeliveryConfigured(),
    adminBootstrapSecret: config.adminBootstrapSecret,
  });
}

/**
 * The origin the browser actually used, derived from the request. Used for
 * password-reset links so that a provider-assigned subdomain works without the
 * operator hardcoding the host. Falls back to the configured site URL.
 */
export function requestSiteUrl(req: { headers: Record<string, string | string[] | undefined> }, fallback = config.siteUrl): string {
  if (config.siteUrlExplicit) return fallback;
  const header = req.headers['x-forwarded-proto'] ?? req.headers['x-forwarded-protocol'];
  const proto = String(Array.isArray(header) ? header[0] : header || (req.headers['x-forwarded-host'] ? 'https' : 'http')).split(',')[0].trim();
  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host;
  const host = String(Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || '').split(',')[0].trim();
  if (!host) return fallback;
  return `${proto || 'https'}://${host}`;
}

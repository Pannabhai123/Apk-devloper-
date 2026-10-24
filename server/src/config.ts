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
  databasePath: env.DATABASE_PATH || './data/vidyapariksha.db',
  sessionSecret: env.SESSION_SECRET || DEV_SESSION_SECRET,
  sessionTtlHours: Number(env.SESSION_TTL_HOURS || 168),
  guestTtlHours: Number(env.GUEST_TTL_HOURS || 720),
  cookieSecure: env.COOKIE_SECURE === 'true',
  // Explicit escape hatch for local HTTP smoke tests only. Never set in real deployments.
  allowInsecureCookies: env.ALLOW_INSECURE_COOKIES === '1',
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  allowRegistration: env.ALLOW_REGISTRATION !== 'false',
  guestTestsEnabled: env.GUEST_TESTS_ENABLED !== 'false',
  maintenanceMode: env.MAINTENANCE_MODE === 'true',
  uploadDir: path.resolve(env.UPLOAD_DIR || './data/uploads'),
  webDist: path.resolve(env.WEB_DIST || './dist'),
  siteUrl: env.SITE_URL || env.PUBLIC_ORIGIN || 'http://localhost:5173',

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
  mailConfigured: boolean;
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
  if (/localhost|127\.0\.0\.1/i.test(c.publicOrigin)) {
    console.warn('[security] PUBLIC_ORIGIN still points to localhost in production; set the public HTTPS origin.');
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
    mailConfigured: mailDeliveryConfigured(),
  });
}

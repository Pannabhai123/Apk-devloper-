import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, assertProductionSecrets } from './config.js';
import { migrate, openDatabase } from './db.js';
import { createApp, startExpirySweeper } from './app.js';
import { seedDemoContent, seedRolesAndSettings } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flagIndex = argv.findIndex((a) => a === '--setup-admin' || a === '--rotate-admin');
const flag = flagIndex >= 0 ? argv[flagIndex] : null;
const email = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
const password = flagIndex >= 0 ? argv[flagIndex + 2] : undefined;

assertProductionSecrets();
const db = openDatabase(config.databasePath);
const version = migrate(db);
seedRolesAndSettings(db);

if (flag) {
  if (!email || !password || password.length < 10) {
    console.error('Usage: npx tsx server/src/index.ts --setup-admin <email> <password-at-least-10-chars>');
    console.error('   or: npx tsx server/src/index.ts --rotate-admin <email> <new-password-at-least-10-chars>');
    process.exit(1);
  }
  if (flag === '--setup-admin') {
    const { seedAdmin } = await import('./seed.js');
    const result = seedAdmin(db, email, password);
    console.log(result.created ? `Administrator ready: ${result.email}` : result.reason);
    db.close();
    process.exit(result.created ? 0 : 2);
  }
  // --rotate-admin: force a new password for an existing administrator and
  // invalidate all of their sessions. Use this after any credential exposure.
  const { hashPassword } = await import('./lib/auth.js');
  const adminRole = db.prepare("SELECT id FROM roles WHERE key IN ('super_admin','admin') ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  const target = db.prepare('SELECT id, email FROM users WHERE email = ? AND role_id = ?').get(email.toLowerCase(), adminRole?.id ?? -1) as { id: number; email: string } | undefined;
  if (!target) {
    console.error(`No administrator account found for ${email}. Use --setup-admin to create the first one.`);
    db.close();
    process.exit(2);
  }
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(password), new Date().toISOString(), target.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(target.id);
    db.prepare('INSERT INTO audit_logs (actor_email, actor_role, action, entity, entity_id) VALUES (?,?,?,?,?)')
      .run(target.email, 'super_admin', 'admin.password_rotate_cli', 'users', target.id);
  })();
  console.log(`Administrator password rotated and sessions revoked: ${target.email}`);
  db.close();
  process.exit(0);
}

// A fresh installation is usable immediately with the clearly-labelled demo bank.
// In development this always happens; in production it happens only when
// SEED_DEMO_ON_EMPTY=true, and only on a database that is genuinely empty, so the
// seed can never duplicate or overwrite existing content.
const questionCount = (db.prepare('SELECT COUNT(*) AS c FROM questions').get() as { c: number }).c;
if (questionCount === 0 && (config.seedDemoOnEmpty || !config.isProd)) {
  const result = seedDemoContent(db);
  console.log(`[seed] ${result.skipped ? `question bank already present (${result.questions} rows)` : `inserted ${result.questions ?? 0} original demo practice questions`}`);
} else if (questionCount === 0 && config.isProd) {
  console.warn('[seed] Production database is empty. Set SEED_DEMO_ON_EMPTY=true to load the demo question bank once, or import your own questions.');
}

const app = createApp(db, { serveStatic: config.isProd || fs.existsSync(config.webDist) });
startExpirySweeper(db);
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[api] VidyaPariksha listening on http://0.0.0.0:${config.port} (schema v${version})`);
  console.log(`[api] environment: ${config.isProd ? 'production' : 'development'}`);
});

function shutdown() {
  console.log('\n[api] shutting down…');
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
void here;

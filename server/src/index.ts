import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, assertProductionSecrets } from './config.js';
import { migrate, openDatabase } from './db.js';
import { createApp, startExpirySweeper } from './app.js';
import { seedDemoContent, seedRolesAndSettings } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const isCli = process.argv.includes('--setup-admin');
const email = process.argv[process.argv.indexOf('--setup-admin') + 1];
const password = process.argv[process.argv.indexOf('--setup-admin') + 2];

assertProductionSecrets();
const db = openDatabase(config.databasePath);
const version = migrate(db);
seedRolesAndSettings(db);

if (isCli) {
  if (!email || !password || password.length < 10) {
    console.error('Usage: npx tsx server/src/index.ts --setup-admin <email> <password-at-least-10-chars>');
    process.exit(1);
  }
  const { seedAdmin } = await import('./seed.js');
  const result = seedAdmin(db, email, password);
  console.log(result.created ? `Administrator ready: ${result.email}` : result.reason);
  db.close();
  process.exit(result.created ? 0 : 2);
}

// A fresh installation is usable immediately with the clearly-labelled demo bank.
const questionCount = (db.prepare('SELECT COUNT(*) AS c FROM questions').get() as { c: number }).c;
if (questionCount === 0 && !config.isProd) {
  const result = seedDemoContent(db);
  console.log(`[seed] inserted ${result.questions ?? 0} original demo practice questions`);
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

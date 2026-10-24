/**
 * Runs a REAL Lighthouse audit against the built app using the same Chromium
 * headless shell as the browser workflow. Scores printed are measured values;
 * this script never fabricates a score. It exits 0 even with low scores — the
 * point is an honest report — but exits 1 if Lighthouse cannot run at all.
 *
 *   npm run build && npm start   # terminal 1 (serves :4000)
 *   npm run test:lighthouse      # terminal 2
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

process.env.AWS_EXECUTION_ENV ||= 'AWS_Lambda_nodejs22.x';
const { default: chromium } = await import('@sparticuz/chromium');

const BASE = process.env.LIGHTHOUSE_URL || 'http://127.0.0.1:4000/';
const OUT = path.resolve('artifacts');
fs.mkdirSync(OUT, { recursive: true });

const executablePath = await chromium.executablePath();
const require = createRequire(import.meta.url);
const lighthouseCli = require.resolve('lighthouse/cli/index.js');

const chromeFlags = [
  '--headless', '--no-sandbox', '--no-zygote', '--disable-dev-shm-usage',
  '--disable-gpu', '--disable-web-security=false', '--ignore-certificate-errors',
].join(' ');

console.log(`\nLighthouse → ${BASE}`);
console.log(`Chrome: ${executablePath}`);
console.log(`Lighthouse CLI: ${lighthouseCli}\n`);

const result = spawnSync(process.execPath, [
  lighthouseCli, BASE,
  '--output=json', `--output-path=${path.join(OUT, 'lighthouse.json')}`,
  `--chrome-flags=${chromeFlags}`,
  '--only-categories=performance,accessibility,best-practices,seo',
  '--screenEmulation.mobile=true',
  '--quiet',
], {
  encoding: 'utf8',
  timeout: 240_000,
  env: {
    ...process.env,
    CHROME_PATH: executablePath,
    HOME: process.env.HOME || os.tmpdir(),
    FONTCONFIG_PATH: process.env.FONTCONFIG_PATH || path.join(os.tmpdir(), 'fonts'),
  },
});

if (result.error) {
  console.error('[lighthouse] could not run:', result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('[lighthouse] exited with status', result.status);
  console.error((result.stderr || result.stdout || '').slice(-4000));
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(path.join(OUT, 'lighthouse.json'), 'utf8'));
const categories = report.categories || {};
for (const key of ['performance', 'accessibility', 'best-practices', 'seo']) {
  const c = categories[key];
  console.log(`  ${key.padEnd(16)} ${c ? Math.round(c.score * 100) : 'n/a'}`);
}
const audits = report.audits || {};
for (const key of ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index']) {
  const a = audits[key];
  if (a) console.log(`  ${key.padEnd(30)} ${a.displayValue || a.numericValue}`);
}
console.log('\nFull JSON report: artifacts/lighthouse.json\n');

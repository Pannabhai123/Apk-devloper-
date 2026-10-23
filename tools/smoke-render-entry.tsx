/**
 * Render-smoke: run the real App component through react-dom/server
 * at every route and assert no crash. Effects (data loading) don't run
 * in SSR, but the full render path of every page executes.
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';

const routes = [
  '/', '/tests', '/tests/1/instructions', '/tests/1/attempt',
  '/results/T01-123/solutions', '/progress', '/practice',
  '/practice?topic=percentage', '/formulas', '/bookmarks', '/revision',
  '/admin', '/privacy', '/definitely-not-a-page',
];

let failed = 0;
for (const r of routes) {
  try {
    const html = renderToString(
      createElement(MemoryRouter, { initialEntries: [r] }, createElement(App)),
    );
    const meaningful = html.length > 200;
    if (meaningful) console.log(`  ✓ ${r} → ${html.length} chars`);
    else { failed++; console.error(`  ✗ ${r} → only ${html.length} chars (likely empty render)`); }
  } catch (e) {
    failed++;
    console.error(`  ✗ ${r} CRASHED: ${(e as Error).message}`);
  }
}
console.log(failed === 0 ? '\n═══ RENDER SMOKE: all routes rendered ═══' : `\n═══ RENDER SMOKE: ${failed} problem routes ═══`);
if (failed > 0) (globalThis as any).process.exitCode = 1;

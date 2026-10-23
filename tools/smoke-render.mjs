/** Bundle tools/smoke-render-entry.tsx and run it with a localStorage shim (CJS so react-dom/server can use node builtins). */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

await build({
  entryPoints: ['tools/smoke-render-entry.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: '.smoke/render.cjs',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  logLevel: 'silent',
});

execFileSync(process.execPath, ['-e', `
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  require('./.smoke/render.cjs');
`], { stdio: 'inherit' });

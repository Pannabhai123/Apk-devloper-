/** Bundle tools/smoke-entry.ts with esbuild and run it with a localStorage shim. */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

mkdirSync('.smoke', { recursive: true });
await build({
  entryPoints: ['tools/smoke-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: '.smoke/out.mjs',
  logLevel: 'silent',
});

execFileSync(process.execPath, ['.smoke/run.mjs'], { stdio: 'inherit' });

/** Bundle tools/smoke-data-entry.ts and run with a localStorage shim. */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

await build({
  entryPoints: ['tools/smoke-data-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: '.smoke/data.mjs',
  logLevel: 'silent',
});

execFileSync(process.execPath, ['.smoke/run.mjs', './data.mjs'], { stdio: 'inherit' });

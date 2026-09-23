// Bundle src/main.js (+three) into a single self-contained HTML that opens by double-click.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs';
import { buildBrainGraph } from './graph-build.mjs';
await buildBrainGraph(); // V3.6: bake the vault's wiki-link graph into src/braingraph.js

const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
});
const js = res.outputFiles[0].text;
const shell = readFileSync('src/shell.html', 'utf8');
const html = shell.replace('<!--APP-->', () => `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
// write-then-rename, retried: on Windows the running office may be reading the page at that instant (EBUSY / UNKNOWN)
{ const out = 'dist/command-centre-v2.html', tmp = out + '.tmp'; writeFileSync(tmp, html);
  for (let i = 0; ; i++) { try { renameSync(tmp, out); break; } catch (e) { if (i >= 20) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150); } } }

// dev variant with external script for faster iteration
mkdirSync('dist', { recursive: true });
writeFileSync('dist/app.js', js);
writeFileSync('dist/dev.html', shell.replace('<!--APP-->', '<script src="app.js"></script>'));
console.log(`built dist/command-centre-v2.html (${(html.length / 1024).toFixed(0)} KB)`);

// Bundle src/main.js (+three) into a single self-contained HTML that opens by double-click.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, existsSync } from 'fs';
import { buildBrainGraph } from './graph-build.mjs';
import { cargarFabrica } from './presets/fabrica.mjs';
await buildBrainGraph(); // V3.6: bake the vault's wiki-link graph into src/braingraph.js

// Banco de presets (F1): la fábrica de imagen, para la demo file:// (busca y compila sin servidor), va JUNTO a la página, en
// dist/presets-fabrica.js, y no dentro: pesa ~250 KB y la página tiene su presupuesto (check.mjs). src/presets-fabrica.js la carga.
const FAB = (() => { const f = cargarFabrica(); return { version: f.version, grupos: f.grupos, tipos: f.tipos, canales: f.canales, familias: f.familias, iconos: f.iconos, sinonimos: f.sinonimos, presets: f.presets.filter(p => (p.medios || []).includes('image')) }; })();

const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
});
const js = res.outputFiles[0].text;
// V4.7: the views added after V4.6 keep their style in src/css/<name>.css instead of growing shell.html; they are joined, in name order,
// where shell.html says «/* <css-vistas> */» (the end of its <style>). Nothing else changes: it is still one file that opens by double click.
const vistasCss = existsSync('src/css') ? readdirSync('src/css').filter(f => f.endsWith('.css')).sort().map(f => `/* ---- src/css/${f} ---- */\n${readFileSync('src/css/' + f, 'utf8')}`).join('\n') : '';
const shell = readFileSync('src/shell.html', 'utf8').replace('/* <css-vistas> */', () => vistasCss);
const html = shell.replace('<!--APP-->', () => `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
// write-then-rename, retried: on Windows the running office may be reading the page at that instant (EBUSY / UNKNOWN)
{ const out = 'dist/command-centre-v2.html', tmp = out + '.tmp'; writeFileSync(tmp, html);
  for (let i = 0; ; i++) { try { renameSync(tmp, out); break; } catch (e) { if (i >= 20) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150); } } }

// dev variant with external script for faster iteration
mkdirSync('dist', { recursive: true });
writeFileSync('dist/presets-fabrica.js', `window.AO_PRESETS_FABRICA=${JSON.stringify(FAB)};\n`); // the demo's preset factory, beside the page
writeFileSync('dist/app.js', js);
writeFileSync('dist/dev.html', shell.replace('<!--APP-->', '<script src="app.js"></script>'));
console.log(`built dist/command-centre-v2.html (${(html.length / 1024).toFixed(0)} KB)`);

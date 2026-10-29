// Fase 0.0 (29 oct 2026) — la página servida no lleva los datos de la demo file:// (35 personajes, archivos de muestra, cifras inventadas: ~135 KB).
// Viajan aparte en dist/v1demo.js y la página los pide con un <script> solo si se abre como archivo. Si alguien vuelve a importar
// src/v1data.js desde la página, el presupuesto de check.mjs se come ese margen sin aviso: este test falla antes. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRASES_DEMO = ['outbound-batch-', 'REEL SCRIPT', 'OPPORTUNITY MEMO', 'WEEKLY CASH SUMMARY']; // textos de FILE_GEN

async function empaquetar(entrada) {
  const r = await build({ entryPoints: [path.join(ROOT, entrada)], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, logLevel: 'silent' });
  const meta = r.metafile.outputs[Object.keys(r.metafile.outputs)[0]];
  return { js: r.outputFiles[0].text, entradas: Object.keys(meta.inputs).map(f => f.replace(/\\/g, '/')) };
}

test('la página (src/main.js) no empaqueta src/v1data.js ni ningún texto de FILE_GEN', async () => {
  const { js, entradas } = await empaquetar('src/main.js');
  assert.ok(!entradas.includes('src/v1data.js'), 'la página volvió a importar src/v1data.js: lo compartido va en src/v1base.js');
  assert.ok(entradas.includes('src/v1base.js'), 'la página debe llevar src/v1base.js (P, rnd, ri…)');
  for (const f of FRASES_DEMO) assert.ok(!js.includes(f), `la página lleva un texto de la demo: «${f}»`);
});

test('ninguna fuente de la página importa v1data.js (solo el paquete de la demo)', () => {
  const dentro = [];
  const ver = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) ver(f); else if (/\.(js|mjs)$/.test(e.name) && /from\s+['"][^'"]*v1data\.js['"]/.test(fs.readFileSync(f, 'utf8'))) dentro.push(path.relative(ROOT, f).replace(/\\/g, '/')); } };
  ver(path.join(ROOT, 'src'));
  assert.deepEqual(dentro, [], 'solo build.mjs puede empaquetar src/v1data.js');
  assert.match(fs.readFileSync(path.join(ROOT, 'build.mjs'), 'utf8'), /src\/v1data\.js/);
});

test('el paquete de la demo expone window.AO_V1DEMO con los 35 personajes, sus archivos y las cifras', async () => {
  const { js } = await empaquetar('src/v1data.js');
  const window = {}; vm.runInNewContext(js, { window, Date, Math, console }); // como un <script> clásico
  const d = window.AO_V1DEMO;
  assert.ok(d && Array.isArray(d.V1) && d.V1.length >= 35, 'faltan personajes: ' + (d && d.V1 && d.V1.length));
  assert.ok(Object.keys(d.FILE_GEN).length > 10);
  assert.equal(typeof d.FILE_GEN.pros().content, 'string');
  assert.ok(d.STATS.emailsSent > 0 && d.KPIS.length === 6);
  for (const f of FRASES_DEMO) assert.ok(js.includes(f), `al paquete de la demo le falta «${f}»`);
});

test('build.mjs pide dist/v1demo.js solo con file: y lo escribe junto a la página', () => {
  const b = fs.readFileSync(path.join(ROOT, 'build.mjs'), 'utf8');
  assert.match(b, /location\.protocol==='file:'\)document\.write\('<script src="v1demo\.js">/);
  assert.match(b, /escribirEntero\('dist\/v1demo\.js'/);
});

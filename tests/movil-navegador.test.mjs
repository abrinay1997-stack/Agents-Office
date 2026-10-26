// Versión móvil (25 oct 2026): el recorrido de navegador (scripts/movil-recorrido.mjs) como prueba. Chromium de teléfono con toque, una oficina temporal.
// Se salta si no hay Chromium en la máquina. Tarda ~1 minuto: el recorrido entero es una sola prueba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

let hay = true; try { const b = await chromium.launch(); await b.close(); } catch { hay = false; }

test('la versión móvil: destinos, 44 px, sin desbordes, escritorio intacto y tareas comunes en 3 toques', { skip: !hay && 'no hay Chromium', timeout: 240000 }, async () => {
  const ROOT = new URL('..', import.meta.url).pathname;
  if (!/AO_MOVIL/.test(fs.readFileSync(ROOT + 'dist/command-centre-v2.html', 'utf8')) || !fs.existsSync(ROOT + 'dist/movil.js')) execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, stdio: 'ignore' }); // dist/ viaja de otra construcción: se reconstruye
  const { correr } = await import('../scripts/movil-recorrido.mjs');
  const { fallos, res } = await correr();
  assert.ok(res.length > 60, 'el recorrido hizo sus comprobaciones');
  assert.equal(fallos, 0, res.filter(r => !r.ok).map(r => r.que).join('\n'));
});

test('la huella del escritorio existe (se hizo desde la rama sin la versión móvil)', () => {
  const h = JSON.parse(fs.readFileSync(new URL('./fixtures/escritorio-1280.json', import.meta.url), 'utf8'));
  assert.ok(h.tieneCanvas && h.topbarVisible && !h.movil && h.cuerpo.includes('topbar') && h.dock.length > 8);
});

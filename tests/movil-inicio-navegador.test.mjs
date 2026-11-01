// Versión móvil, Inicio (1 nov 2026): el recorrido de navegador (scripts/movil-inicio-recorrido.mjs) como prueba. Chromium de teléfono con toque, una oficina temporal
// y los paquetes reales de la campanita y del chat del equipo. Se salta si no hay Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

let hay = true; try { const b = await chromium.launch(); await b.close(); } catch { hay = false; }

test('Inicio en el teléfono: acciones arriba, avisos y «lo que viene» sin repetir, campanita en la cabecera y nada tapado a 320/360/390/430 px', { skip: !hay && 'no hay Chromium', timeout: 400000 }, async () => {
  const ROOT = new URL('..', import.meta.url).pathname;
  if (!/ini-linea/.test(fs.existsSync(ROOT + 'dist/movil.js') ? fs.readFileSync(ROOT + 'dist/movil.js', 'utf8') : '')) execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, stdio: 'ignore' }); // dist/ viaja de otra construcción: se reconstruye
  const { correr } = await import('../scripts/movil-inicio-recorrido.mjs');
  const { fallos, res } = await correr();
  assert.ok(res.length > 100, 'el recorrido hizo sus comprobaciones');
  assert.equal(fallos, 0, res.filter(r => !r.ok).map(r => r.que).join('\n'));
});

// Versión móvil, equipo C (25 oct 2026): el recorrido de navegador (scripts/movil-c-recorrido.mjs) como prueba. Chromium de teléfono con toque, una oficina temporal.
// Ajustes (lista → sección → Guardar fijo), Conectores (añadir en la nube), Costos, Estado, Negocio, Mi perfil, Equipo y la ficha del agente: 44 px, 16 px, sin desbordes
// a 4 anchos, el valor guardado de verdad en el servidor y el feedback visible. Con AO_AXE=<axe.min.js> también pasa axe (claro y oscuro). Se salta sin Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

let hay = true; try { const b = await chromium.launch(); await b.close(); } catch { hay = false; }

test('versión móvil · Ajustes, Conectores, Costos, Estado, Negocio, Perfil, Equipo y la ficha del agente', { skip: !hay && 'no hay Chromium', timeout: 420000 }, async () => {
  const ROOT = new URL('..', import.meta.url).pathname;
  if (!fs.existsSync(ROOT + 'dist/movil.js') || !/Guardar fijo|mv-guardar/.test(fs.readFileSync(ROOT + 'dist/movil.js', 'utf8'))) execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, stdio: 'ignore' });
  const { correr } = await import('../scripts/movil-c-recorrido.mjs');
  const { fallos, res } = await correr();
  assert.ok(res.length > 150, 'el recorrido hizo sus comprobaciones');
  assert.equal(fallos, 0, res.filter(r => !r.ok).map(r => r.que).join('\n'));
});

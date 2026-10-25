// Versión móvil (25 oct 2026): el recorrido de navegador de Contenido, Bandeja, «Crear publicación», Analíticas y Anuncios (scripts/movil-d-recorrido.mjs) como
// prueba. Chromium de teléfono con toque, una oficina temporal y una Meta de mentira para la Bandeja; se salta si no hay Chromium. Tarda ~2 minutos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

let hay = true; try { const b = await chromium.launch(); await b.close(); } catch { hay = false; }

test('la versión móvil de Contenido, Bandeja, Crear, Analíticas y Anuncios: ≤ 8 toques, segundo toque para aprobar, enviar y gastar, 44 px y sin desbordes', { skip: !hay && 'no hay Chromium', timeout: 600000 }, async () => {
  const ROOT = new URL('..', import.meta.url).pathname;
  if (!/AO_MOVIL/.test(fs.readFileSync(ROOT + 'dist/command-centre-v2.html', 'utf8')) || !fs.existsSync(ROOT + 'dist/movil-d.js') || fs.statSync(ROOT + 'dist/movil-d.js').mtimeMs < fs.statSync(ROOT + 'src/movil/vistas/anuncios.js').mtimeMs) execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, stdio: 'ignore' }); // dist/ viaja de otra construcción: se rehace
  const { correr } = await import('../scripts/movil-d-recorrido.mjs');
  const { fallos, res } = await correr();
  assert.ok(res.length > 150, 'el recorrido hizo sus comprobaciones');
  assert.equal(fallos, 0, res.filter(r => !r.ok).map(r => r.que).join('\n'));
});

// Versión móvil, equipo E (25 oct 2026): Tareas, Calendario y Dimitri en el teléfono, de punta a punta.
// El recorrido (scripts/movil-e-recorrido.mjs) corre en Chromium de teléfono contra una oficina temporal. Se salta sin Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

let hay = true; try { const b = await chromium.launch(); await b.close(); } catch { hay = false; }
const ROOT = new URL('..', import.meta.url).pathname;

test('rutinas: «equipo» se guarda al crear y al editar (el jefe del departamento la lleva)', async () => {
  const { oficina } = await import('../scripts/movil-recorrido.mjs');
  const o = await oficina({ semilla: false });
  try {
    const post = (u, m, b) => fetch(o.base + u, { method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }));
    const c = await post('/api/routines', 'POST', { dept: 'marketing', text: 'Armar el boletín del mes', when: { kind: 'weekly', days: [1], at: '09:00' }, team: true });
    assert.equal(c.s, 200, JSON.stringify(c.j));
    const r = (c.j.routine || c.j);
    assert.equal(r.team, true, 'la rutina nace como de equipo');
    const lista = await (await fetch(o.base + '/api/routines')).json();
    const guardada = (lista.routines || lista).find(x => x.id === r.id);
    assert.equal(guardada.team, true);
    const u = await post('/api/routines/' + r.id, 'PATCH', { team: false });
    assert.equal(u.s, 200, JSON.stringify(u.j));
    const lista2 = await (await fetch(o.base + '/api/routines')).json();
    assert.ok(!(lista2.routines || lista2).find(x => x.id === r.id).team, 'se puede quitar');
  } finally { o.cerrar(); }
});

test('Tareas, Calendario y Dimitri en el móvil: 44 px, sin desbordes a 320/360/390/430, axe y tareas comunes en ≤ 3 toques', { skip: !hay && 'no hay Chromium', timeout: 600000 }, async () => {
  if (!/AO_MOVIL/.test(fs.readFileSync(ROOT + 'dist/command-centre-v2.html', 'utf8')) || !fs.existsSync(ROOT + 'dist/movil.js')) execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, stdio: 'ignore' });
  const { correr } = await import('../scripts/movil-e-recorrido.mjs');
  const { fallos, res } = await correr();
  assert.ok(res.length > 150, 'el recorrido hizo sus comprobaciones (' + res.length + ')');
  assert.equal(fallos, 0, res.filter(r => !r.ok).map(r => r.que).join('\n'));
});

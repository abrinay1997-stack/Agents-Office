import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS } from '../worker/modulos/index.js';
import { PORTADAS } from '../worker/lib/portadas.js';

test('cada módulo declara sus grupos y su manejador; los grupos no se repiten entre módulos', () => {
  const vistos = new Map();
  for (const m of MODULOS) {
    assert.ok(Array.isArray(m.grupos) && m.grupos.length, `${m.nombre || 'un módulo'} declara sus grupos /api`);
    assert.equal(typeof m.manejar, 'function');
    for (const g of m.grupos) { assert.ok(!vistos.has(g), `el grupo «${g}» lo declaran dos módulos`); vistos.set(g, m.nombre); assert.ok(PORTADAS.includes(g)); }
  }
});

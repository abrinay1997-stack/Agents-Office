import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS } from '../worker/modulos/index.js';
import { PORTADAS } from '../worker/lib/portadas.js';

test('cada módulo declara sus grupos y su manejador; los grupos no se repiten entre módulos', () => {
  const vistos = new Map();
  for (const m of MODULOS) {
    // `grupos`: los /api/<grupo> que el módulo posee. Un módulo que solo cuelga rutas de un grupo ajeno (p. ej. /api/contenido/bandeja)
    // declara `grupos: []` y `rutasExtra: ['/api/contenido/bandeja']`; los módulos se consultan en el orden de la lista.
    assert.ok(Array.isArray(m.grupos), `${m.nombre || 'un módulo'} declara sus grupos /api`);
    assert.ok(m.grupos.length || (Array.isArray(m.rutasExtra) && m.rutasExtra.length), `${m.nombre || 'un módulo'} declara grupos o rutasExtra`);
    assert.equal(typeof m.manejar, 'function');
    for (const g of m.grupos) { assert.ok(!vistos.has(g), `el grupo «${g}» lo declaran dos módulos`); vistos.set(g, m.nombre); assert.ok(PORTADAS.includes(g)); }
  }
});

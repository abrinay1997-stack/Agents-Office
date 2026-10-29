// UX-11: el ⓘ de Dimitri y sus alertas (puro) + que la línea fija ya no existe en ninguna de las dos versiones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filasIa, alertasIa, avisosParaHilo, popoverHTML } from '../src/dimitri-ia.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const base = { nombre: 'Claude Sonnet 5.5', consultas: true, herramientas: true, gasto: { usd: 12.5, tope: 50, nivel: 'ok' } };

test('filas: modelo, consultas, gasto y (solo en la nube) privacidad', () => {
  const f = filasIa(base, { nube: true });
  assert.deepEqual(f.map(x => x.titulo), ['Modelo', 'Consultas', 'Gasto de IA del mes', 'Privacidad']);
  assert.equal(f[2].valor, 'US$12,50 de US$50,00');
  assert.equal(filasIa(base).some(x => x.titulo === 'Privacidad'), false);
  assert.match(filasIa({ ...base, consultas: false, herramientas: false })[1].valor, /solo conversa/);
  assert.match(filasIa({ ...base, consultas: false, herramientas: true })[1].valor, /apagadas/);
  assert.deepEqual(filasIa(null), []);
});

test('sin alerta no hay punto: gasto normal o en aviso no es una alerta', () => {
  assert.deepEqual(alertasIa(base), []);
  assert.deepEqual(alertasIa({ ...base, gasto: { usd: 45, tope: 50, nivel: 'alert' } }), []);
  assert.equal(filasIa({ ...base, gasto: { usd: 45, tope: 50, nivel: 'alert' } })[2].alto, true, 'pero la fila se resalta en el popover');
});

test('las tres alertas reales: gasto pasado del tope, respaldo en uso, último turno falló', () => {
  const a = alertasIa({ ...base, gasto: { usd: 60, tope: 50, nivel: 'over' }, respaldo: { de: 'Muse Spark', a: 'Claude Sonnet 5.5', motivo: 'sin llave' } }, { at: 5, motivo: 'saturado' });
  assert.deepEqual(a.map(x => x.id.split(':')[0]), ['gasto', 'respaldo', 'fallo']);
  assert.match(a[0].texto, /pasó el tope de US\$50,00/);
  assert.match(a[1].texto, /respaldo.*Claude Sonnet 5\.5.*Muse Spark.*sin llave/);
  assert.match(a[2].texto, /falló por la IA.*saturado/);
  assert.equal(alertasIa({ ...base, fallo: { at: 9, motivo: 'x' } }).length, 1, 'el fallo también puede venir del servidor');
});

test('al hilo va una vez cada alerta nueva; el fallo ya sale como error en el hilo y no se repite', () => {
  const a = alertasIa({ ...base, gasto: { usd: 60, tope: 50, nivel: 'over' } }, { at: 1, motivo: 'x' });
  const dichas = new Set();
  const n1 = avisosParaHilo(a, dichas); assert.deepEqual(n1.map(x => x.id), ['gasto:50']);
  n1.forEach(x => dichas.add(x.id));
  assert.deepEqual(avisosParaHilo(a, dichas), [], 'no se repite');
  const b = alertasIa({ ...base, gasto: { usd: 90, tope: 80, nivel: 'over' } });
  assert.equal(avisosParaHilo(b, dichas).length, 1, 'un tope distinto es un caso nuevo');
});

test('el popover escapa lo que muestra y ofrece «Cambiar» solo si se puede', () => {
  const h = popoverHTML({ ...base, nombre: '<img onerror=x>' }, [], { esc, cambia: true });
  assert.ok(!h.includes('<img'), h); assert.match(h, /sb-ia-cambiar/);
  assert.ok(!popoverHTML(base, [], { esc, cambia: false }).includes('sb-ia-cambiar'));
  assert.match(popoverHTML(null, [], { esc }), /no informa/);
});

test('la línea fija de IA ya no existe (escritorio, móvil)', () => {
  const sub = fs.readFileSync(new URL('../src/sub.js', import.meta.url), 'utf8');
  assert.ok(!sub.includes('sb-ia-head'), 'sub.js sin la línea');
  assert.ok(sub.includes('sb-iab') && sub.includes("aria-expanded"), 'sub.js trae el ⓘ');
  const mv = fs.readFileSync(new URL('../src/movil/vistas/dimitri.js', import.meta.url), 'utf8');
  assert.ok(!mv.includes('class="mv-ia"'), 'el saludo móvil sin la línea');
  assert.ok(mv.includes("icono: 'info'"), 'la cabecera móvil trae el ⓘ');
});

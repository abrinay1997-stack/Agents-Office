// 26 oct 2026 — carpetas del Estudio en el teléfono: lo puro (nombres, de dónde viene lo que se mueve, el texto del aviso, la selección).
// El recorrido en un navegador con la oficina de verdad: scripts/movil-b-recorrido.mjs (sección «Carpetas»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { errorNombreCarpeta, limpiarNombreCarpeta, carpetaDeFicha, origenes, textoMovida, alternarSeleccion, seleccionVigente, MAX_CARPETAS } from '../src/movil/estudio-puro.js';

const F = [{ id: 'c1', name: 'Navidad', n: 2 }, { id: 'c2', name: 'Producto', n: 0 }];

test('el nombre de una carpeta: vacío, repetido (sin mayúsculas), renombrar a sí misma y el tope de 200', () => {
  assert.equal(errorNombreCarpeta('Verano', F), '');
  assert.match(errorNombreCarpeta('   ', F), /nombre/);
  assert.match(errorNombreCarpeta('navidad', F), /Ya hay una carpeta «navidad»/);
  assert.equal(errorNombreCarpeta('NAVIDAD', F, 'c1'), '', 'renombrar una carpeta con su mismo nombre (otras letras) no choca consigo misma');
  assert.match(errorNombreCarpeta('Otra', Array.from({ length: MAX_CARPETAS }, (_, i) => ({ id: 'c' + i, name: 'n' + i }))), /200/);
  assert.equal(limpiarNombreCarpeta('  a   b\u0000<i> '), 'a bi');
});

test('la carpeta de verdad de una ficha: una carpeta que ya no existe no cuenta', () => {
  assert.equal(carpetaDeFicha({ folder: 'c1' }, F), 'c1');
  assert.equal(carpetaDeFicha({ folder: 'borrada' }, F), null);
  assert.equal(carpetaDeFicha({}, F), null);
  assert.equal(carpetaDeFicha(null, F), null);
});

test('de dónde viene lo que se mueve (para poder deshacer)', () => {
  const items = [{ file: 'a', folder: 'c1' }, { file: 'b', folder: 'c1' }, { file: 'c' }, { file: 'd', folder: 'borrada' }, { file: 'e', folder: 'c2' }];
  const m = origenes(items, ['a', 'b', 'c', 'd'], F);
  assert.deepEqual([...m.entries()], [['c1', ['a', 'b']], [null, ['c', 'd']]]);
});

test('el aviso al mover, en singular y plural', () => {
  assert.equal(textoMovida(1, { name: 'Navidad' }), 'Un archivo movido a «Navidad».');
  assert.equal(textoMovida(3, { name: 'Navidad' }), '3 archivos movidos a «Navidad».');
  assert.equal(textoMovida(1, null), 'Un archivo sacado de su carpeta.');
  assert.equal(textoMovida(2, null), '2 archivos sacados de su carpeta.');
});

test('la selección: se alterna y solo vale lo que sigue en la vista', () => {
  const s = new Set(); alternarSeleccion(s, 'a'); alternarSeleccion(s, 'b'); alternarSeleccion(s, 'a');
  assert.deepEqual([...s], ['b']);
  assert.deepEqual([...seleccionVigente(new Set(['a', 'b', 'z']), [{ file: 'a' }, { file: 'b' }])].sort(), ['a', 'b']);
});

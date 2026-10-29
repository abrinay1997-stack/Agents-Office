// EST-08: el motivo del 409 y las piezas llegan a la pantalla (escritorio y móvil).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { textoFalloPapelera } from '../src/estudio-papelera.js';

const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('un solo archivo con 409: dice el motivo y a dónde ir', () => {
  const t = textoFalloPapelera([{ message: 'Este archivo está en una pieza de Contenido («Oferta»): quítalo de ahí primero', piezas: [{ id: 'p-1', titulo: 'Oferta' }] }], 1);
  assert.match(t, /No se pudo mover el archivo/); assert.match(t, /«Oferta»/); assert.match(t, /Contenido \(tecla K\)/);
});
test('varios: cuenta, y sin mensaje cae en las piezas', () => {
  assert.match(textoFalloPapelera([{ message: 'x' }, { message: 'x' }], 2), /ninguno de los 2/);
  assert.match(textoFalloPapelera([{ message: 'x' }], 3), /1 de 3/);
  assert.match(textoFalloPapelera([{ message: '', piezas: [{ id: 'a' }, { id: 'b', titulo: 'B' }] }], 1), /2 piezas de Contenido: «a», «B»/);
  assert.equal(textoFalloPapelera([]), '');
});
test('cableado: trashMany conserva e.piezas y usa el texto; el móvil muestra el error del servidor', () => {
  const s = rd('src/studio.js');
  assert.match(s, /e\.piezas = j\.piezas/); assert.match(s, /textoFalloPapelera\(fallos, files\.length\)/); assert.doesNotMatch(s, /catch \{ failed\+\+; \}/);
  assert.match(rd('src/movil/datos.js'), /e\.datos = j/);
  assert.match(rd('src/movil/vistas/estudio.js'), /conEstado\([^\n]*\/api\/media\/item\/[^\n]*DELETE/);
});

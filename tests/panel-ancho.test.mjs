// Fase 3 (29 oct 2026): el reparto de ancho entre N paneles y el ancho de Dimitri son puros y se prueban sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cerca, anchosN } from '../src/panel-ancho.js';
import { limitesAncho, SUB_MIN, SUB_MAX } from '../src/dimitri-ancho.js';

test('cerca acota y redondea; un valor que no es número cae al mínimo', () => {
  assert.equal(cerca(500.4, 400, 600), 500); assert.equal(cerca(10, 400, 600), 400); assert.equal(cerca(9999, 400, 600), 600); assert.equal(cerca('x', 400, 600), 400);
});

test('anchosN: cada panel parte de su valor acotado y, si no cabe, ceden en el orden dado hasta su mínimo', () => {
  const P = [{ id: 'a', min: 100, max: 300, val: 300 }, { id: 'b', min: 200, max: 500, val: 500 }];
  assert.deepEqual(anchosN(2000, P, 100), { a: 300, b: 500 });
  assert.deepEqual(anchosN(800, P, 100), { a: 200, b: 500 }, 'cede primero a');
  assert.deepEqual(anchosN(500, P, 100), { a: 100, b: 300 }, 'a llega a su mínimo y sigue b');
  assert.deepEqual(anchosN(100, P, 100), { a: 100, b: 200 }, 'si ni así cabe, cada uno en su mínimo');
  assert.deepEqual(anchosN(2000, [{ id: 'x', min: 10, max: 20, val: 999 }], 0), { x: 20 });
});

test('Dimitri: 340 – min(760, ventana − 480); el de siempre es el 34 % entre 340 y 440', () => {
  assert.deepEqual(limitesAncho(1512), { min: 340, max: 760, def: 440 });
  assert.deepEqual(limitesAncho(1024), { min: 340, max: 544, def: 348 });
  assert.equal(limitesAncho(800).max, SUB_MIN, 'una tableta estrecha no deja más que el mínimo');
  assert.equal(limitesAncho(5000).max, SUB_MAX);
});

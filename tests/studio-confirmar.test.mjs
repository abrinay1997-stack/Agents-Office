// IMG-11 (auditoría del Estudio de imagen, 6 oct 2026): confirmar un gasto con un segundo clic, no con confirm().
import test from 'node:test';
import assert from 'node:assert/strict';
import { pedirOk, UMBRAL } from '../src/studio-confirmar.js';

test('por debajo del umbral pasa a la primera', () => {
  assert.deepEqual(pedirOk(null, 'go', 0.13), { ok: true, armado: null });
  assert.equal(UMBRAL, 0.5);
});
test('desde US$0,50: el primer clic arma, el segundo (a tiempo y para lo mismo) pasa', () => {
  const a = pedirOk(null, 'go', 0.64, 1000);
  assert.equal(a.ok, false); assert.deepEqual(a.armado, { clave: 'go', at: 1000 });
  assert.equal(pedirOk(a.armado, 'go', 0.64, 5000).ok, true);
});
test('tarde, o para otra cosa, vuelve a armar', () => {
  const a = pedirOk(null, 'go', 1, 0).armado;
  assert.equal(pedirOk(a, 'go', 1, 7001).ok, false);
  assert.equal(pedirOk(a, 'vary:x.png', 1, 10).ok, false);
});

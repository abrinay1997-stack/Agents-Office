// IMG-26 (auditoría del Estudio de imagen, 6 oct 2026): los atajos de una tecla se pueden apagar (WCAG 2.1.4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { esDeUnaTecla, ignorar } from '../src/teclas1.js';

test('una letra, «/», «?» o «+» sueltos son atajos de una tecla; con Ctrl, Esc, flechas o Espacio no', () => {
  for (const key of ['e', 'B', '/', '?', '+', '0']) assert.equal(esDeUnaTecla({ key }), true, key);
  assert.equal(esDeUnaTecla({ key: 'k', ctrlKey: true }), false);
  assert.equal(esDeUnaTecla({ key: 'Escape' }), false);
  assert.equal(esDeUnaTecla({ key: 'ArrowLeft' }), false);
  assert.equal(esDeUnaTecla({ key: ' ' }), false);
});
test('apagados, se ignoran; encendidos (por defecto), no', () => {
  assert.equal(ignorar({ key: 'e' }, false), true);
  assert.equal(ignorar({ key: 'e' }, true), false);
  assert.equal(ignorar({ key: 'Enter', ctrlKey: true }, false), false);
});

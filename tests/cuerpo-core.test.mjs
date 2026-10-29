import test from 'node:test';
import assert from 'node:assert/strict';
import { validarCuerpo, leerCuerpoWeb } from '../cuerpo-core.mjs';

const ESQ = { id: { tipo: 'string', requerido: true, max: 40 }, valor: { tipo: 'number', max: 1000 }, ok: { tipo: 'boolean' }, ids: { tipo: 'array', max: 3 }, tipo: { tipo: 'string', valores: ['a', 'b'] } };

test('un cuerpo válido pasa y vacío es {}', () => {
  assert.deepEqual(validarCuerpo('{"id":"x","valor":3}', ESQ), { ok: true, valor: { id: 'x', valor: 3 } });
  assert.deepEqual(validarCuerpo('', {}), { ok: true, valor: {} });
});
test('cuerpos basura: 400 (o 413), nunca una excepción', () => {
  for (const basura of ['"hola"', '[1,2]', '12', 'null', '{no json', '\u0000\u0001', 'true']) {
    const r = validarCuerpo(basura, ESQ); assert.equal(r.ok, false, basura); assert.equal(r.status, 400); assert.match(r.error, /\S/);
  }
  const grande = validarCuerpo('{"id":"' + 'a'.repeat(5 * 1024 * 1024) + '"}', ESQ);
  assert.deepEqual([grande.ok, grande.ok === false && grande.status], [false, 413]);
  assert.equal(validarCuerpo(/** @type {any} */ (undefined), ESQ).ok, false);
});
test('el esquema exige tipo, requerido, rango y valores permitidos, en español', () => {
  assert.match(String(/** @type {any} */ (validarCuerpo('{}', ESQ)).error), /Falta «id»/);
  assert.match(String(/** @type {any} */ (validarCuerpo('{"id":5}', ESQ)).error), /debe ser un texto/);
  assert.match(String(/** @type {any} */ (validarCuerpo('{"id":"x","valor":"3"}', ESQ)).error), /un número/);
  assert.match(String(/** @type {any} */ (validarCuerpo('{"id":"x","ids":[1,2,3,4]}', ESQ)).error), /demasiado largo/);
  assert.match(String(/** @type {any} */ (validarCuerpo('{"id":"x","tipo":"z"}', ESQ)).error), /valor permitido/);
  assert.match(String(/** @type {any} */ (validarCuerpo('{"id":"x","valor":1e999}', ESQ)).error), /finito|número/);
});
test('leerCuerpoWeb corta por content-length y por tamaño real', async () => {
  const ok = await leerCuerpoWeb(new Request('http://x/', { method: 'POST', body: '{"id":"x"}' }), ESQ);
  assert.equal(ok.ok, true);
  const grande = await leerCuerpoWeb(new Request('http://x/', { method: 'POST', body: 'a'.repeat(3000) }), ESQ, { tope: 1000 });
  assert.deepEqual([grande.ok, grande.ok === false && grande.status], [false, 413]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { derivar, hashearContrasena, MAX_POR_LLAMADA, ITERACIONES } from '../worker/lib/sesion.js';

test('PBKDF2 nunca pide más de 100.000 iteraciones por llamada (tope de workerd, que Node no aplica)', async () => {
  const original = crypto.subtle.deriveBits.bind(crypto.subtle); const pedidas = [];
  crypto.subtle.deriveBits = (alg, ...r) => { pedidas.push(alg.iterations); return original(alg, ...r); };
  try { await derivar('clave', '00'.repeat(16)); } finally { crypto.subtle.deriveBits = original; }
  assert.ok(pedidas.every((n) => n <= MAX_POR_LLAMADA));
  assert.equal(pedidas.reduce((a, b) => a + b, 0), ITERACIONES);
});

test('el hash es determinista con la misma sal y distinto con otra', async () => {
  const { salt, password_hash } = await hashearContrasena('una-clave-larga-123');
  assert.equal(await derivar('una-clave-larga-123', salt), password_hash);
  assert.notEqual(await derivar('otra-clave-larga-123', salt), password_hash);
});

// V4.4 — the secrets check before a commit (scripts/secrets-scan.mjs). Run: npm test
// The fake values below are assembled at run time so this file itself never looks like a leak.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../scripts/secrets-scan.mjs';

const k = (...p) => p.join('');
test('keys, tokens, cards and ID cards are found', () => {
  const bad = [
    k('ANTHROPIC_API_KEY=sk-', 'ant-', 'api03-', 'a'.repeat(30)),
    k('const g = "AIza', 'Sy', 'B'.repeat(33), '"'),
    k('token: ghp_', 'x'.repeat(36)),
    k('-----BEGIN ', 'PRIVATE KEY-----'),
    k('TELEGRAM=123456789:AA', 'h'.repeat(33)),
    k('password = "', 'super-secreta-123', '"'),
    k('tarjeta 4111 1111 ', '1111 1111'),
    k('cédula 8-', '123-4567'),
  ];
  for (const t of bad) assert.ok(scanText(t).length, t);
});
test('ordinary text passes', () => {
  for (const t of ['Reunión el 12-09-2026', 'Versión 1-3-4', 'El pedido 4111 llegó', 'const key = process.env.GEMINI_API_KEY', 'password: process.env.X', 'Teléfono +507 6123-4567']) assert.equal(scanText(t).length, 0, t);
});
test('a line marked secrets-ok is skipped', () => {
  assert.equal(scanText(k('ejemplo sk-ant-', 'b'.repeat(30), ' // secrets-ok')).length, 0);
});

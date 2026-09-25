// V4.4 — settings from the office (settings.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../settings.mjs';

test('each change is validated and lands in the local file, nested where it belongs', () => {
  const r = S.apply({ name: 'X', safety: { writes: 'pedido' } }, { 'safety.writes': 'aprobar', 'costs.monthlyBudget': '50', 'telegram.quiet.from': '21:00', 'safety.browserBlock': 'banco.com, redes.com\nbanco.com', 'team.people': [{ name: 'María', telegram: '123456', depts: ['sales', 'zzz'] }] });
  assert.deepEqual(r.errors, []);
  assert.equal(r.local.safety.writes, 'aprobar'); assert.equal(r.local.costs.monthlyBudget, 50); assert.equal(r.local.telegram.quiet.from, '21:00');
  assert.deepEqual(r.local.safety.browserBlock, ['banco.com', 'redes.com']); assert.deepEqual(r.local.team.people[0].depts, ['sales']); assert.equal(r.local.name, 'X');
});
test('a wrong value is refused in plain words and the rest still applies', () => {
  const r = S.apply({}, { 'safety.writes': 'siempre', 'concurrency': 20, 'telegram.quiet.to': '25:99', 'team.people': [{ name: 'Juan', telegram: '@juan' }], 'port': 80, 'costs.hourlyRate': 12 });
  assert.equal(r.errors.length, 5); assert.equal(r.local.costs.hourlyRate, 12);
  assert.ok(r.errors.some(e => /opción desconocida/.test(e))); assert.ok(r.errors.some(e => /entre 1 y 8/.test(e))); assert.ok(r.errors.some(e => /no se puede cambiar/.test(e)));
});
test('settings that need a restart say so', () => {
  assert.equal(S.apply({}, { 'tools.web': false }).restart, true);
  assert.equal(S.apply({}, { 'costs.hourlyRate': 5 }).restart, false);
});

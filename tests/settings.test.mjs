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
  const m = S.apply({}, { 'mcp.deny': 'Gmail, Shopify', 'mcp.allow': '' }); // auditoría MCP-12: the connectors apply at once
  assert.equal(m.restart, false); assert.deepEqual(m.local.mcp, { deny: ['Gmail', 'Shopify'], allow: [] });
});

test('V4.5: the Estudio caps are settings — 0 is allowed (no cap), a bad value is refused', () => {
  const r = S.apply({}, { 'media.dailyLimit': 0, 'media.dailyBudget': '2.5', 'media.monthlyBudget': 40, 'media.maxPerRequest': 4 });
  assert.deepEqual(r.errors, []); assert.equal(r.restart, false);
  assert.deepEqual(r.local.media, { dailyLimit: 0, dailyBudget: 2.5, monthlyBudget: 40, maxPerRequest: 4 });
  const bad = S.apply({}, { 'media.maxPerRequest': 20, 'media.dailyBudget': -1, 'media.concurrency': 9 });
  assert.equal(bad.errors.length, 3);
  assert.ok(S.GROUPS.some(([k]) => k === 'estudio'));
});

test('Fase 0 de Anuncios: los ids de Meta son opcionales y con su formato; los topes y el piloto, con los valores del plan', () => {
  assert.ok(S.GROUPS.some(([k]) => k === 'anuncios'));
  const r = S.apply({}, { 'anuncios.cuenta': ' 1234567890 ', 'anuncios.pagina': '', 'anuncios.topeDiario': 25, 'anuncios.pilotoAutomatico': true });
  assert.deepEqual(r.errors, []); assert.equal(r.restart, false);
  assert.equal(r.local.anuncios.cuenta, 'act_1234567890', 'solo los números se completan con act_');
  assert.equal(r.local.anuncios.pagina, '', 'vacío vale: usa la de Contenido');
  const bad = S.apply({}, { 'anuncios.cuenta': 'mi cuenta', 'anuncios.pixel': 'px-12', 'anuncios.topeMensual': -5 });
  assert.equal(bad.errors.length, 3); assert.ok(bad.errors.some(e => /act_/.test(e)));
  const def = Object.fromEntries(S.FIELDS.filter(f => f.group === 'anuncios').map(f => [f.path, f.default]));
  assert.equal(def['anuncios.topeDiario'], 20); assert.equal(def['anuncios.topeMensual'], 300); assert.equal(def['anuncios.topeCampana'], 150);
  assert.equal(S.FIELDS.find(f => f.path === 'anuncios.pilotoAutomatico').default, undefined, 'el piloto nace apagado');
  assert.ok(!S.FIELDS.some(f => f.group === 'anuncios' && /token|secret/i.test(f.path)), 'ningún secreto en Ajustes');
});
test('un campo de texto obligatorio sigue sin poder quedar vacío', () => {
  assert.equal(S.apply({}, { name: '  ' }).errors.length, 1);
});

test('Anuncios (punto 10): el WhatsApp acepta +, espacios, guiones y paréntesis, guarda solo dígitos y exige código de país', () => {
  const f = S.FIELDS.find(x => x.path === 'anuncios.whatsapp');
  assert.deepEqual(S.clean(f, '+507 6531-0721'), { value: '50765310721' });
  assert.deepEqual(S.clean(f, '(507) 6531 0721'), { value: '50765310721' });
  assert.deepEqual(S.clean(f, '50765310721'), { value: '50765310721' });
  assert.deepEqual(S.clean(f, ''), { value: '' }, 'vacío = sin WhatsApp');
  const sin = S.clean(f, '62272025');
  assert.match(sin.error, /falta el código de país.*507/);
  assert.match(S.clean(f, '5076227202').error, /Panamá.*11/, 'empieza por 507 pero no tiene 11 dígitos');
  assert.match(S.clean(f, '1234567').error, /entre 8 y 15/);
  assert.match(S.clean(f, '1234567890123456').error, /entre 8 y 15/);
  assert.match(S.clean(f, 'abc').error, /Número de WhatsApp Business/);
  assert.deepEqual(S.clean(f, '+34 612 345 678'), { value: '34612345678' }, 'otro país con su código');
});

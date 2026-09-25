// V4.4 — costs and return (costs.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../costs.mjs';

test('the price of each model, Claude and other providers; the owner\'s own prices win', () => {
  assert.equal(C.priceFor('claude-sonnet-5').in, 2);
  assert.equal(C.priceFor('claude-opus-5-5').out, 20);
  assert.equal(C.priceFor('claude-opus-5').in, 5);
  assert.equal(C.priceFor('claude-fable-5-1').out, 50);
  assert.equal(C.priceFor('claude-haiku-4-5-20251001').in, 1);
  assert.equal(C.priceFor('muse-spark-1.3').provider, 'meta');
  assert.equal(C.priceFor('deepseek-chat').provider, 'deepseek');
  assert.equal(C.priceFor('kimi-k3[1m]').in, 3);
  assert.equal(C.priceFor('glm-5.3').out, 4.4);
  assert.equal(C.priceFor('claude-sonnet-5', { 'sonnet-5': { in: 1, out: 1 } }).in, 1);
  assert.equal(C.priceFor('mystery-model'), null);
});

test('dollars for one call: tokens × price, or what Claude Code reported (only for Anthropic)', () => {
  const u = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 0 };
  assert.equal(C.usdOf(u, C.priceFor('claude-sonnet-5')), 2 + 1 + 0.2);
  assert.equal(C.line({ modelId: 'claude-sonnet-5', usage: u, reported: 0.5 }).usd, 0.5);
  assert.equal(C.line({ modelId: 'claude-sonnet-5', usage: u, reported: 0.5 }).source, 'claude');
  assert.equal(C.line({ modelId: 'deepseek-chat', provider: 'deepseek', usage: u, reported: 99 }).source, 'tabla'); // Claude Code prices a DeepSeek run as if it were Claude: ignored
  assert.equal(C.line({ modelId: '??', usage: u }).source, 'sin-precio');
});

test('the budget: none, fine, alert at 80 %, over', () => {
  const now = Date.parse('2026-09-25T12:00:00'), l = usd => [{ t: now - 1000, usd }];
  assert.equal(C.budgetState(l(5), C.config({}), now).level, 'none');
  assert.equal(C.budgetState(l(5), C.config({ monthlyBudget: 50 }), now).level, 'ok');
  assert.equal(C.budgetState(l(41), C.config({ monthlyBudget: 50 }), now).level, 'alert');
  assert.equal(C.budgetState(l(50), C.config({ monthlyBudget: 50 }), now).level, 'over');
  assert.equal(C.budgetState([{ t: Date.parse('2026-08-30T12:00:00'), usd: 99 }], C.config({ monthlyBudget: 50 }), now).level, 'ok'); // last month does not count
});

test('the month\'s report: totals, hours saved, value, weeks, by department and desk', () => {
  const now = Date.parse('2026-09-25T12:00:00'), t0 = now - 3600e3;
  const lines = [{ t: t0, task: 'a', agent: 'invo', dept: 'fin', model: 'claude-sonnet-5', usd: 0.2 }, { t: t0, task: 'b', agent: 'sol', dept: 'sales', model: 'claude-opus-5', usd: 0.6 }, { t: t0, task: null, agent: null, dept: null, model: 'claude-sonnet-5', usd: 0.05 }];
  const tasks = [{ id: 'a', dept: 'fin', agent: 'invo', state: 'done', doneAt: t0 }, { id: 'b', dept: 'sales', agent: 'sol', state: 'done', doneAt: t0 }];
  const r = C.report(lines, tasks, [{ id: 'invo', name: 'INVO' }, { id: 'sol', name: 'SOL' }], { hourlyRate: 12 }, now);
  assert.equal(r.usd.toFixed(2), '0.85'); assert.equal(r.overhead, 0.05); assert.equal(r.tasksDone, 2);
  assert.equal(r.hours, (20 + 30) / 60); assert.equal(r.value, r.hours * 12);
  assert.equal(r.weeks.length, 8); assert.equal(r.byDept[0].key, 'sales'); assert.equal(r.byAgent.find(x => x.key === 'invo').name, 'INVO');
});

test('suggestions: a cheaper model, a stronger one, a routine nobody reads', () => {
  const now = Date.now(), done = (i, extra) => ({ id: 'x' + i, agent: 'sol', dept: 'sales', state: 'done', doneAt: now - i * 864e5, result: 'corto', ...extra });
  const cheap = C.suggestions([{ t: now, agent: 'sol', usd: 10 }], Array.from({ length: 6 }, (_, i) => done(i, { modelUsed: 'opus' })), [{ id: 'sol', name: 'SOL' }], C.config({}), now);
  assert.equal(cheap[0].kind, 'model-down'); assert.deepEqual(cheap[0].action, { agent: 'sol', model: 'sonnet' });
  const up = C.suggestions([], Array.from({ length: 6 }, (_, i) => done(i, { modelUsed: 'sonnet', revisions: 1 })), [{ id: 'sol', name: 'SOL' }], C.config({}), now);
  assert.equal(up[0].kind, 'model-up');
  const unread = C.suggestions([], Array.from({ length: 4 }, (_, i) => done(i, { routine: 'reporte', title: 'Reporte' })), [], C.config({}), now);
  assert.equal(unread[0].kind, 'routine-unread');
  const read = C.suggestions([], Array.from({ length: 4 }, (_, i) => done(i, { routine: 'reporte', seenAt: now })), [], C.config({}), now);
  assert.equal(read.length, 0);
});

test('the CSV for the accountant opens in Excel with accents and quotes', () => {
  const t = Date.parse('2026-09-10T10:00:00');
  const out = C.csv([{ t, task: 'a', agent: 'invo', dept: 'fin', kind: 'task', model: 'claude-sonnet-5', provider: 'anthropic', in: 1, out: 2, cacheRead: 0, cacheWrite: 0, usd: 0.5, source: 'claude' }], [{ id: 'a', title: 'Facturas, "vencidas"' }], [{ id: 'invo', name: 'INVO' }], '2026-09');
  assert.ok(out.startsWith('﻿fecha,hora,tarea,título'));
  assert.match(out, /"Facturas, ""vencidas"""/);
  assert.match(out, /0\.500000,Claude Code/);
});

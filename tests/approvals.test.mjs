// V4.4 — approvals (approvals.mjs) and quality (quality.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../approvals.mjs';
import * as Q from '../quality.mjs';

test('amounts in any common way of writing them', () => {
  assert.deepEqual(A.amountsIn('Total: US$1,250.50 y $30'), [1250.5, 30]);
  assert.deepEqual(A.amountsIn('Pagar 1.250,50 € hoy'), [1250.5]);
  assert.deepEqual(A.amountsIn('B/. 200 de adelanto, 45 dólares de envío'), [200, 45]);
  assert.deepEqual(A.amountsIn('Reunión a las 10:30, sala 4'), []);
  assert.deepEqual(A.overLimit('Pago de $250', 200), [250]);
  assert.deepEqual(A.overLimit('Pago de $250', 0), []);
});

test('the card of what goes out, and its risk', () => {
  const d = 'Para: sol@cliente.com\nAsunto: Propuesta de octubre\nAdjunto: propuesta-sol.pdf\nTotal: US$450';
  const p = A.preview(d);
  assert.deepEqual(p.to, ['sol@cliente.com']); assert.equal(p.subject, 'Propuesta de octubre'); assert.deepEqual(p.attachments, ['propuesta-sol.pdf']); assert.deepEqual(p.amounts, [450]); assert.equal(p.channel, 'Correo');
  assert.equal(A.risk(d), 'alto'); // over the $200 limit
  assert.equal(A.risk('Responde a sol@cliente.com con los horarios'), 'medio');
  assert.equal(A.risk('Resumen de la bandeja: 3 correos importantes'), 'bajo');
  assert.equal(A.risk('Transferir el pago al proveedor'), 'alto');
});

test('reminders and expiry of waiting drafts', () => {
  const now = Date.now(), h = 3600e3;
  const r = A.due([{ id: 'a', state: 'waiting', waitingAt: now - 25 * h }, { id: 'b', state: 'waiting', waitingAt: now - 8 * 24 * h }, { id: 'c', state: 'waiting', waitingAt: now - 2 * h }, { id: 'd', state: 'waiting', waitingAt: now - 30 * h, remindedAt: now - h }], A.DEFAULTS, now);
  assert.deepEqual(r, { remind: ['a'], expire: ['b'] });
});

test('a routine earns the right to stop asking only after N clean approvals', () => {
  const ok = i => ({ routine: 'r', approved: true, approvedAt: i, draft: 'Resumen' });
  assert.equal(A.earnedAutonomy(Array.from({ length: 20 }, (_, i) => ok(i)), 'r'), true);
  assert.equal(A.earnedAutonomy(Array.from({ length: 19 }, (_, i) => ok(i)), 'r'), false);
  assert.equal(A.earnedAutonomy([...Array.from({ length: 19 }, (_, i) => ok(i)), { ...ok(99), editedDraft: true }], 'r'), false);
  assert.equal(A.earnedAutonomy(Array.from({ length: 20 }, (_, i) => ({ ...ok(i), draft: 'Pagar $900' })), 'r'), false); // high risk never goes alone
});

test('quality per desk and a drop after a skill change', () => {
  const now = Date.now(), day = 864e5, agents = [{ id: 'sol', name: 'SOL', department: 'sales' }];
  const t = (d, extra) => ({ agent: 'sol', state: 'done', doneAt: now - d * day, ...extra });
  const tasks = [t(20), t(19), t(18), t(5, { revisions: 2 }), t(4, { vote: 'down' }), t(3, { revisions: 1 })];
  const q = Q.byAgent(tasks, agents, now)[0];
  assert.equal(q.tasks, 6); assert.equal(q.firstTry, 50); assert.equal(q.down, 1);
  const d = Q.drops(tasks, agents, { sol: now - 10 * day }, now);
  assert.equal(d.length, 1); assert.ok(d[0].before - d[0].after >= 20);
  assert.equal(Q.scoreOf({ error: true }), 0); assert.equal(Q.scoreOf({ vote: 'up' }), 100);
});

test('lessons without repeats; the router learns from corrections', () => {
  const r = Q.dedupe(['2026-09-01 · Nunca abras con el nombre de la empresa ← "x"', '2026-09-10 · Nunca abras el correo con el nombre de la empresa ← "y"', '2026-09-11 · Firma siempre como Abrinay']);
  assert.equal(r.keep.length, 2); assert.equal(r.dropped.length, 1);
  const c = [{ t: 1, dept: 'sales', text: 'propuesta para el cliente nuevo de Colón', from: 'lexi', to: 'piper' }, { t: 2, dept: 'fin', text: 'propuesta', from: 'a', to: 'b' }];
  assert.equal(Q.lessonsFor(c, 'sales', 'Haz una propuesta para el cliente de Colón')[0].to, 'piper');
  assert.equal(Q.lessonsFor(c, 'sales', 'revisa el inventario').length, 0);
  assert.match(Q.lessonsText(Q.lessonsFor(c, 'sales', 'propuesta cliente Colón'), id => id.toUpperCase()), /→ PIPER \(not LEXI\)/);
});

// V4.4 — how the business is doing (business.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../business.mjs';

test('a KPI definition is checked', () => {
  assert.deepEqual(B.validateDef({ id: 'ventas_semana', name: 'Ventas', unit: 'US$', goal: '5000' }).def, { id: 'ventas_semana', name: 'Ventas', unit: 'US$', goal: 5000, better: 'up' });
  assert.ok(B.validateDef({ id: 'Ventas Semana', name: 'x' }).error);
  assert.ok(B.validateDef({ id: 'v', name: 'x' }).error);
});
test('an agent reports a KPI in its deliverable', () => {
  const r = B.fromText('Resumen\nKPI ventas_semana = US$ 1.250,50\n- KPI leads_nuevos: 7\nKPI otra = 3', ['ventas_semana', 'leads_nuevos']);
  assert.deepEqual(r, [{ id: 'ventas_semana', value: 1250.5 }, { id: 'leads_nuevos', value: 7 }]);
});
test('the latest value, the change and the goal; «down is good» for overdue invoices', () => {
  const s = B.summary({ id: 'x', name: 'x', goal: 2000, better: 'up' }, [{ t: 1, v: 1000 }, { t: 2, v: 1500 }]);
  assert.equal(s.value, 1500); assert.equal(s.change, 0.5); assert.equal(s.good, true); assert.equal(s.goalPct, 0.75);
  assert.equal(B.summary({ id: 'y', better: 'down' }, [{ t: 1, v: 10 }, { t: 2, v: 12 }]).good, false);
});
test('the office\'s own figures', () => {
  const now = Date.now();
  const f = B.officeFigures([{ state: 'done', doneAt: now - 1000, dept: 'sales' }, { state: 'waiting', waitingAt: now - 7200e3, trigger: 'f', addedAt: now - 7260e3 }], { now, hourly: 12 });
  assert.equal(f.find(x => x.id === 'hechas').value, 1); assert.equal(f.find(x => x.id === 'respuesta').value, 1); assert.equal(f.find(x => x.id === 'esperan').value, 1);
});

test('num reads the ways people write a figure', () => {
  const { num } = B;
  assert.equal(num('1.200'), 1200); assert.equal(num('1,200'), 1200); assert.equal(num('1.250,50'), 1250.5); assert.equal(num('1,250.50'), 1250.5);
  assert.equal(num('US$ 3.400.000'), 3400000); assert.equal(num('0,5'), 0.5); assert.equal(num('12.5'), 12.5); assert.equal(num(42), 42); assert.equal(num('abc'), null); assert.equal(num(''), null);
});

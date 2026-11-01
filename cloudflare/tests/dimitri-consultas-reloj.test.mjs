// El tope de consultas a D1 por turno de Dimitri (plan gratuito: 50) no puede depender de la hora ni del día del mes (1 nov 2026: la lectura de Analíticas pedía un mes por consulta y
// el turno que pliega el hilo pasó de 50 a 51 en cuanto los últimos 30 días cruzaron de mes). Se mide con el reloj fijo en varios instantes, incluidos los bordes de mes y de semana.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina6, dimitriDice } from './fase6-ayudas.mjs';

function contar(d1) {
  const c = { n: 0 }; let dentro = false; const p0 = d1.prepare, b0 = d1.batch;
  const env = (st) => { const w = {}; for (const k of ['first', 'all', 'run']) w[k] = (...a) => { if (!dentro) c.n++; return st[k](...a); }; w.bind = (...a) => env(st.bind(...a)); return w; };
  d1.prepare = (s) => env(p0(s)); d1.batch = async (l) => { c.n++; dentro = true; try { return await b0(l); } finally { dentro = false; } };
  return c;
}
const INSTANTES = ['2026-10-31T20:00:00Z', '2026-11-01T05:00:00Z', '2026-11-02T12:00:00Z', '2026-11-15T12:00:00Z', '2026-11-30T23:00:00Z', '2026-12-01T00:30:00Z', '2027-03-01T10:00:00Z'];

for (const ins of INSTANTES) {
  test('un turno de Dimitri cabe en 50 consultas a D1 con el reloj en ' + ins, { skip: SALTAR, timeout: 120000 }, async () => {
    mock.timers.enable({ apis: ['Date'], now: Date.parse(ins) });
    try {
      const o = await oficina6(), q = contar(o.d1); let max = 0;
      for (let i = 0; i < 80; i++) { // pasa por el turno que pliega el hilo (cada 6 desde el ~65)
        o.m.guion.push(dimitriDice({ mode: 'charla', reply: 'ok ' + i })); const antes = q.n; const r = await o.admin('POST', '/api/sub/chat', { text: 'Pedido ' + i });
        assert.equal(r.status, 200); max = Math.max(max, q.n - antes);
      }
      assert.ok(max <= 50, `con el reloj en ${ins}: máx ${max} consultas por turno (plan gratuito: 50)`);
    } finally { mock.timers.reset(); }
  });
}

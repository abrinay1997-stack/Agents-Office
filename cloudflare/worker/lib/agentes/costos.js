// El libro de costos en D1 (data/costs.jsonl en la local): una fila por llamada a un modelo. Las cuentas son las de costs-core.mjs (puro, compartido con la local):
// los precios por modelo, el estado del presupuesto del mes y el informe «Costos y retorno».
import * as costs from '../../../../costs-core.mjs';

/** Apunta una llamada y devuelve los dólares. Si el presupuesto del mes se acaba de cruzar (alerta o tope), devuelve también el nivel nuevo. */
export async function anotar(db, { tarea = null, agente = null, dept = null, tipo = 'task', modelo, proveedor = 'anthropic', usage, cfgPrices, ms = 0, t = Date.now() }) {
  const l = costs.line({ task: tarea, agent: agente, dept, kind: tipo, modelId: modelo, provider: proveedor, usage, cfgPrices, t });
  await db.prepare('insert into costos (t, tarea, agente, dept, tipo, modelo, proveedor, tin, tout, cache_read, cache_write, usd, fuente, ms) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(l.t, l.task, l.agent, l.dept, l.kind, l.model, l.provider, l.in, l.out, l.cacheRead, l.cacheWrite, l.usd, l.source, ms > 0 ? Math.round(ms) : null).run();
  return l.usd;
}

/** Las filas desde `desde`, en la forma de costs.read de la local ({ t, task, agent, dept, kind, model, provider, in, out, cacheRead, cacheWrite, usd, source }). */
export async function leer(db, desde = 0) {
  const { results } = await db.prepare('select t, tarea, agente, dept, tipo, modelo, proveedor, tin, tout, cache_read, cache_write, usd, fuente, ms from costos where t >= ? order by t').bind(desde).all();
  return results.map(r => ({ t: r.t, task: r.tarea, agent: r.agente, dept: r.dept, kind: r.tipo, model: r.modelo, provider: r.proveedor, in: r.tin, out: r.tout, cacheRead: r.cache_read, cacheWrite: r.cache_write, usd: r.usd, source: r.fuente, ...(r.ms ? { ms: r.ms } : {}) }));
}

/** Dónde está el mes frente al presupuesto: { level: none|ok|alert|over, spent, budget, ratio, month }. */
export async function estadoDelMes(db, cfgCosts, ahora = Date.now()) {
  return costs.budgetState(await leer(db, ahora - 32 * 864e5), costs.config(cfgCosts), ahora);
}
/** ¿Con `stopAtBudget` y el tope cruzado no arranca nada nuevo? */
export async function sinPresupuesto(db, cfgCosts, ahora = Date.now()) {
  const c = costs.config(cfgCosts);
  return !!c.stopAtBudget && (await estadoDelMes(db, cfgCosts, ahora)).level === 'over';
}

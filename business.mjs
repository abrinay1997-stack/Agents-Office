// Agents Office — how the business is doing (V4.4, 25 Sep 2026; audit J1). The owner opens the office to see sales,
// overdue invoices, new leads, response time — not how busy the agents are. Proven in tests/business.test.mjs.
//   · The owner's KPIs (data/kpis.json): { id, name, unit, goal, better: 'up' | 'down' } with their values over time.
//     A value arrives by hand (the page), by webhook (POST /api/kpi/<id>, with AO_HOOK_TOKEN: Zapier, Stripe, n8n, a sheet),
//     or from an agent's deliverable: a line «KPI ventas_semana = 1.250» in any result is recorded — so a routine
//     («cada lunes, cuenta las ventas de la semana en Stripe») keeps the number fresh.
//   · The office's own figures, computed from the tasks: work finished, response time to events, drafts waiting, …

export const SUGGESTED = [
  { id: 'ventas_semana', name: 'Ventas de la semana', unit: 'US$', better: 'up' },
  { id: 'facturas_vencidas', name: 'Facturas vencidas', unit: 'US$', better: 'down' },
  { id: 'leads_nuevos', name: 'Clientes potenciales nuevos', unit: '', better: 'up' },
  { id: 'propuestas_abiertas', name: 'Propuestas sin respuesta', unit: '', better: 'down' },
];
const ID = /^[a-z][a-z0-9_]{1,40}$/;
export function validateDef(d) {
  const id = String(d?.id || '').toLowerCase().trim();
  if (!ID.test(id)) return { error: 'el id va en minúsculas y con guiones bajos, p. ej. ventas_semana' };
  const name = String(d?.name || '').trim().slice(0, 60); if (!name) return { error: 'falta el nombre' };
  const goal = d?.goal === '' || d?.goal === null || d?.goal === undefined ? null : Number(d.goal); if (goal !== null && !Number.isFinite(goal)) return { error: 'la meta tiene que ser un número' };
  return { def: { id, name, unit: String(d?.unit || '').trim().slice(0, 8), goal, better: d?.better === 'down' ? 'down' : 'up' } };
}
/** «1.250,50» · «1,250.50» · «1.200» · «1200» · «0,5» → a number (a dot or a comma followed by exactly three digits is a thousands mark). */
export const num = s => { if (typeof s === 'number') return Number.isFinite(s) ? s : null; let t = String(s ?? '').trim().replace(/[^\d.,-]/g, ''); if (!t) return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else if (/^-?\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, ''); else t = t.replace(/,/g, '');
  const n = parseFloat(t); return Number.isFinite(n) ? n : null; };
/** «KPI ventas_semana = 1.250,50» lines in a deliverable → [{ id, value }] (only ids the owner defined). */
export function fromText(text, ids) {
  const out = []; const set = new Set(ids);
  for (const m of String(text || '').matchAll(/^\s*[-*]?\s*KPI\s+([a-z][a-z0-9_]{1,40})\s*[=:]\s*(?:US\$|USD|B\/\.|\$|€)?\s*([-\d][\d.,\s]*)/gim)) { const id = m[1].toLowerCase(), v = num(m[2]); if (set.has(id) && v !== null) out.push({ id, value: v }); }
  return out;
}
/** One KPI as the page shows it: the latest value, the one before, the change, against the goal, the last 12 values. */
export function summary(def, values = []) {
  const v = [...values].sort((a, b) => a.t - b.t), last = v.at(-1), prev = v.at(-2);
  const change = last && prev && prev.v !== 0 ? (last.v - prev.v) / Math.abs(prev.v) : null;
  const good = change === null ? null : def.better === 'down' ? change <= 0 : change >= 0;
  const goalPct = last && def.goal ? last.v / def.goal : null;
  return { ...def, value: last?.v ?? null, at: last?.t ?? null, from: last?.from ?? null, prev: prev?.v ?? null, change, good, goalPct, series: v.slice(-12).map(x => x.v) };
}
/** The office's own figures for the week. */
export function officeFigures(tasks, { now = Date.now(), hourly = 0, minutes = () => 20 } = {}) {
  const wk = now - 7 * 864e5, done = tasks.filter(t => t.state === 'done' && !t.error && !t.piece && (t.doneAt || 0) >= wk);
  const trig = tasks.filter(t => t.trigger && (t.doneAt || t.waitingAt) && (t.addedAt || 0) >= wk).map(t => ((t.waitingAt || t.doneAt) - t.addedAt) / 60000).filter(x => x >= 0).sort((a, b) => a - b);
  const med = trig.length ? trig[Math.floor(trig.length / 2)] : null;
  const waiting = tasks.filter(t => t.state === 'waiting' && !t.archived);
  const hours = done.reduce((s, t) => s + minutes(t), 0) / 60;
  return [
    { id: 'hechas', name: 'Trabajos terminados (7 días)', value: done.length, unit: '' },
    { id: 'respuesta', name: 'Respuesta a un evento (mediana)', value: med === null ? null : Math.round(med), unit: 'min', hint: med === null ? 'sin disparadores esta semana' : '' },
    { id: 'esperan', name: 'Esperan tu visto bueno', value: waiting.length, unit: '', hint: waiting.length ? `el más viejo, hace ${Math.round((now - Math.min(...waiting.map(t => t.waitingAt || now))) / 3600e3)} h` : '' },
    { id: 'horas', name: 'Horas ahorradas (7 días)', value: Math.round(hours * 10) / 10, unit: 'h', hint: hourly ? `≈ US$${Math.round(hours * hourly)}` : '' },
  ];
}

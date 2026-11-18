// @ts-check
// Agents Office — costs and return (V4.4, 25 Sep 2026; audit C1–C7, C9, C10). What every run costs, in dollars, by task,
// desk, department, week and month; what it saved in hours; a monthly budget with a warning; which desk could use a cheaper
// model; which routines nobody reads; and a CSV for the accountant.
//
// Every model call the office makes is one line in <data>/costs.jsonl: { t, task, agent, dept, model, provider, in, out,
// cacheRead, cacheWrite, usd, source }. source: 'claude' (Claude Code reported it, total_cost_usd) or 'tabla' (tokens × the
// price table below). On a Claude subscription the office pays a flat plan, so the figure is «what it would cost on the API».
//
// office.config.json → "costs": { "monthlyBudget": 50, "alertAt": 0.8, "stopAtBudget": false, "hourlyRate": 12,
//   "minutesPerTask": { "emails": 10, … }, "prices": { "<model id>": { "in": 2, "out": 10, "cacheRead": 0.2, "cacheWrite": 2.5 } } }
// Prices are US$ per million tokens. `npm run check` warns when the table is older than 90 days: models change often.

export const PRICES_AS_OF = '2026-09-25';
export const PRICE_SOURCES = [
  'Anthropic (Claude): precios oficiales de la API, platform.claude.com/docs/pricing',
  'Meta Muse Spark: nivel estándar, eesel.ai / aiweekly.co (sep 2026)',
  'DeepSeek V4.1 Flash: hora pico, benchlm.ai/deepseek/api-pricing (sep 2026)',
  'Kimi (Moonshot): benchlm.ai/moonshot/api-pricing, morphllm.com/kimi-api (sep 2026)',
  'GLM (Z.ai): aipricing.guru/z-ai-pricing, developer.puter.com (sep 2026)',
  'Búsqueda por significado (Cloudflare bge-m3, OpenAI text-embedding-3-small, Voyage 3.5 lite, Gemini text-embedding-004): precio de lista de cada proveedor SIN verificar en su página (27 oct 2026: la sesión no llegó a esas páginas). Son centavos al mes; si el tuyo difiere, ponlo en Ajustes → Costos → precios propios.',
];
// US$ per million tokens. `match` finds the model in the id Claude Code (or the provider) reports.
export const PRICES = [
  { provider: 'anthropic', model: 'claude-fable-5-1', name: 'Claude Fable 5.1', match: /fable-5-1|fable-5\.1/, in: 10, out: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  { provider: 'anthropic', model: 'claude-fable-5', name: 'Claude Fable 5', match: /fable-5(?!-1|\.1)/, in: 10, out: 50, cacheRead: 1, cacheWrite: 12.5 },
  { provider: 'anthropic', model: 'claude-opus-5-5', name: 'Claude Opus 5.5', match: /opus-5-5|opus-5\.5/, in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  { provider: 'anthropic', model: 'claude-opus-5', name: 'Claude Opus 5', match: /opus-5(?!-5|\.5)|opus-4-[678]/, in: 5, out: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  { provider: 'anthropic', model: 'claude-sonnet-5', name: 'Claude Sonnet 5', match: /sonnet-5/, in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', match: /sonnet-4/, in: 3, out: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  { provider: 'anthropic', model: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', match: /haiku/, in: 1, out: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  { provider: 'meta', model: 'muse-spark', name: 'Meta Muse Spark', match: /muse|spark|meta/, in: 1.25, out: 4.25, cacheRead: 0.15, cacheWrite: 1.25 },
  { provider: 'deepseek', model: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', match: /deepseek/, in: 0.30, out: 1.20, cacheRead: 0.006, cacheWrite: 0.30 },
  { provider: 'moonshot', model: 'kimi-k3', name: 'Kimi K3', match: /kimi-k3/, in: 3, out: 15, cacheRead: 0.30, cacheWrite: 3 },
  { provider: 'moonshot', model: 'kimi-k2.6', name: 'Kimi K2.6', match: /kimi/, in: 0.95, out: 4, cacheRead: 0.095, cacheWrite: 0.95 },
  { provider: 'zai', model: 'glm-5.3', name: 'GLM 5.3', match: /glm/, in: 1.40, out: 4.40, cacheRead: 0.14, cacheWrite: 1.40 },
  // Embeddings (solo entrada; no tienen salida ni caché). Precios de lista SIN verificar: ver PRICE_SOURCES. Van al final: un id de modelo de lenguaje nunca los alcanza.
  { provider: 'cloudflare', model: 'cf-bge-m3', name: 'Cloudflare bge-m3 (Workers AI)', match: /bge-m3/, in: 0.012, out: 0, cacheRead: 0, cacheWrite: 0 },
  { provider: 'openai', model: 'text-embedding-3-small', name: 'OpenAI text-embedding-3-small', match: /text-embedding-3-small/, in: 0.02, out: 0, cacheRead: 0, cacheWrite: 0 },
  { provider: 'voyage', model: 'voyage-3.5-lite', name: 'Voyage 3.5 lite', match: /voyage/, in: 0.02, out: 0, cacheRead: 0, cacheWrite: 0 },
  { provider: 'google', model: 'text-embedding-004', name: 'Gemini text-embedding-004', match: /text-embedding-004/, in: 0, out: 0, cacheRead: 0, cacheWrite: 0 }, // gratis en la lista de Google (sin verificar)
];
export const DEFAULTS = { monthlyBudget: 0, alertAt: 0.8, stopAtBudget: false, hourlyRate: 0,
  // VAN-06: el presupuesto del mes es de toda la oficina; estos cuatro son POR AGENTE y POR RUTINA, y cortan de verdad. 0 = sin tope.
  perAgentDay: 0, perAgentMonth: 0, perRoutineDay: 0, perRoutineMonth: 0,
  minutesPerTask: { emails: 10, sales: 30, marketing: 40, ops: 25, fin: 20, delivery: 35 } };
export function config(c = {}) { return { ...DEFAULTS, ...c, minutesPerTask: { ...DEFAULTS.minutesPerTask, ...(c.minutesPerTask || {}) } }; }

/** The price for a model id (the owner's own prices in costs.prices win), or null. */
export function priceFor(modelId, cfgPrices = {}) {
  const id = String(modelId || '').toLowerCase(); if (!id) return null;
  for (const [k, v] of Object.entries(cfgPrices || {})) if (id.includes(k.toLowerCase())) return { model: k, name: k, provider: 'propio', ...v };
  return PRICES.find(p => p.match.test(id)) || null;
}
/** Dollars for one call's usage ({ input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens }). */
export function usdOf(usage, price) {
  if (!usage || !price) return 0;
  const M = 1e6;
  return ((usage.input_tokens || 0) * price.in + (usage.output_tokens || 0) * price.out + (usage.cache_read_input_tokens || 0) * (price.cacheRead ?? price.in * 0.1) + (usage.cache_creation_input_tokens || 0) * (price.cacheWrite ?? price.in * 1.25)) / M;
}
/** COS-01: cuánto trabaja la caché de prompt en un conjunto de líneas del libro. hitRatio = lo leído de caché sobre todo lo que entró (entrada + escritura + lectura); ahorroUsd = lo que habría costado leer esos tokens
 *  al precio normal de entrada menos lo que costó leerlos de caché, MENOS el sobrecosto de las escrituras (precio de escritura − precio normal). Negativo = la caché costó más de lo que ahorró. Es una estimación con la tabla de precios. */
export function cacheStats(lines, cfgPrices) {
  let read = 0, written = 0, input = 0, ahorroUsd = 0;
  for (const l of lines || []) {
    const r = l.cacheRead || 0, w = l.cacheWrite || 0; read += r; written += w; input += l.in || 0;
    const p = priceFor(l.model, cfgPrices); if (!p || (!r && !w)) continue;
    ahorroUsd += (r * (p.in - (p.cacheRead ?? p.in * 0.1)) - w * ((p.cacheWrite ?? p.in * 1.25) - p.in)) / 1e6;
  }
  const total = read + written + input;
  return { cacheRead: read, cacheWrite: written, input, hitRatio: total ? read / total : 0, ahorroUsd: Math.round(ahorroUsd * 1e6) / 1e6 };
}
/** One ledger line. reported: what Claude Code said the run cost (only trusted for Anthropic's own models). */
export function line({ task = null, agent = null, dept = null, routine = null, kind = 'task', modelId, provider = 'anthropic', usage, reported, cfgPrices, t = Date.now() }) {
  const price = priceFor(modelId, cfgPrices);
  const useReported = provider === 'anthropic' && typeof reported === 'number' && reported >= 0;
  const usd = useReported ? reported : usdOf(usage, price);
  return { t, task, agent, dept, ...(routine ? { routine } : {}), kind, model: modelId || '', provider, in: usage?.input_tokens || 0, out: usage?.output_tokens || 0, cacheRead: usage?.cache_read_input_tokens || 0, cacheWrite: usage?.cache_creation_input_tokens || 0, usd: Math.round(usd * 1e6) / 1e6, source: useReported ? 'claude' : price ? 'tabla' : 'sin-precio' };
}


const monthOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const weekStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }; // Monday
/** Where the month stands against the budget. */
export function budgetState(lines, c, now = Date.now()) {
  const m = monthOf(now), spent = lines.filter(l => monthOf(l.t) === m).reduce((s, l) => s + l.usd, 0);
  const b = +c.monthlyBudget || 0;
  return { month: m, spent, budget: b, ratio: b ? spent / b : 0, level: !b ? 'none' : spent >= b ? 'over' : spent >= b * (c.alertAt || 0.8) ? 'alert' : 'ok' };
}
// ---------------------------------------------------------------- VAN-06: presupuesto por agente y por rutina, con corte duro
// El de la oficina (`monthlyBudget` + `stopAtBudget`) frena TODO al pasarse; estos frenan solo a quien se pasó, para que un agente
// caro o una rutina descontrolada no se coma el mes de los demás. Un tope 0 = sin tope (lo de siempre).
// La línea del libro lleva `routine` (el id de la rutina de la que salió la tarea); las de antes no la traen y solo cuentan por agente.
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** Lo gastado HOY y este MES por cada agente y por cada rutina. Puro. → { agente: { id: { dia, mes } }, rutina: { … } } */
export function gastoPorDueno(lines, now = Date.now()) {
  const hoy = dayOf(now), mes = monthOf(now), agente = {}, rutina = {};
  for (const l of lines) {
    if (monthOf(l.t) !== mes) continue;
    const enDia = dayOf(l.t) === hoy, usd = +l.usd || 0;
    for (const [mapa, id] of [[agente, l.agent], [rutina, l.routine]]) {
      if (!id) continue;
      const g = mapa[id] || (mapa[id] = { dia: 0, mes: 0 });
      g.mes += usd; if (enDia) g.dia += usd;
    }
  }
  const limpiar = m => { for (const g of Object.values(m)) { g.dia = Math.round(g.dia * 1e6) / 1e6; g.mes = Math.round(g.mes * 1e6) / 1e6; } return m; };
  return { agente: limpiar(agente), rutina: limpiar(rutina) };
}

/**
 * Las líneas con la rutina de su tarea. La local la guarda en la propia línea; la NUBE no tiene esa columna (y las líneas
 * de antes de VAN-06 tampoco), así que se saca de la tarea. Puro; no copia la línea si ya la trae.
 */
export function conRutinaDeTarea(lines, tareas = []) {
  const de = new Map();
  for (const t of tareas) if (t?.routine && t?.id) de.set(t.id, t.routine);
  if (!de.size) return lines;
  return lines.map(l => (l.routine || !l.task || !de.has(l.task) ? l : { ...l, routine: de.get(l.task) }));
}

/** Los dos topes que le tocan a un agente o a una rutina: el PROPIO (su ficha) gana sobre el de la oficina. Puro. */
export function topesDe(cfgCosts, { propio = {}, rutina = false } = {}) {
  const c = config(cfgCosts);
  const dia = +propio.budgetDay > 0 ? +propio.budgetDay : +(rutina ? c.perRoutineDay : c.perAgentDay) || 0;
  const mes = +propio.budgetMonth > 0 ? +propio.budgetMonth : +(rutina ? c.perRoutineMonth : c.perAgentMonth) || 0;
  return { dia, mes };
}

/**
 * Quién está frenado por SU propio presupuesto, con el motivo en palabras. Puro: no lee reloj ni archivo.
 * `agentes` y `rutinas`: sus topes propios ({ id: { budgetDay, budgetMonth } }), que ganan sobre los de la oficina.
 * → { agentes: { id: motivo }, rutinas: { id: motivo } } (vacío = nada frenado).
 */
export function frenosDePresupuesto(lines, cfgCosts = {}, { now = Date.now(), agentes = {}, rutinas = {} } = {}) {
  const gastos = gastoPorDueno(lines, now), out = { agentes: {}, rutinas: {} };
  const usd = n => `US$${n.toFixed(2)}`;
  for (const [clave, propios, esRutina, destino] of [['agente', agentes, false, out.agentes], ['rutina', rutinas, true, out.rutinas]]) {
    const porId = gastos[clave];
    for (const id of new Set([...Object.keys(porId), ...Object.keys(propios || {})])) {
      const { dia, mes } = topesDe(cfgCosts, { propio: (propios || {})[id] || {}, rutina: esRutina });
      const g = porId[id] || { dia: 0, mes: 0 };
      if (mes > 0 && g.mes >= mes) destino[id] = `llegó a su presupuesto del mes (${usd(g.mes)} de ${usd(mes)})`;
      else if (dia > 0 && g.dia >= dia) destino[id] = `llegó a su presupuesto de hoy (${usd(g.dia)} de ${usd(dia)})`;
    }
  }
  return out;
}

/** El medidor de la esquina en la NUBE (no hay plan con ventana de 5 h: se paga por token): gasto de hoy y del mes, tokens y ejecuciones de hoy y, con tope, el porcentaje del mes.
 *  «Hoy» y «mes» son los de la zona de la oficina (la `Date` del Worker ya la lleva). Todo es una estimación: tokens × la tabla de precios. */
export function usage(lines, cfgCosts = {}, now = Date.now()) {
  const c = config(cfgCosts), key = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }, hoy = key(now), mes = monthOf(now);
  const delDia = lines.filter(l => key(l.t) === hoy), delMes = lines.filter(l => monthOf(l.t) === mes);
  const usd = ls => Math.round(ls.reduce((n, l) => n + (l.usd || 0), 0) * 1e6) / 1e6, b = +c.monthlyBudget || 0, gastoMes = usd(delMes);
  return { today: { usd: usd(delDia), tokens: delDia.reduce((n, l) => n + (l.in || 0) + (l.out || 0) + (l.cacheRead || 0) + (l.cacheWrite || 0), 0), runs: delDia.filter(l => l.task).length },
    month: { usd: gastoMes, budget: b || null, percent: b ? Math.round(gastoMes / b * 100) : null }, pricesAsOf: PRICES_AS_OF };
}
/** Minutes a finished task saved: the routine's own, else its department's. */
export const minutesSaved = (task, c) => +task.minutesSaved || +c.minutesPerTask[task.dept] || 20;

/**
 * The report for the costs window: this month, the last 8 weeks, by department and desk, the return, suggestions.
 * tasks: the task list (for titles, success and the return); agents: the roster.
 */
export function report(lines, tasks, agents, cfgCosts = {}, now = Date.now()) {
  const c = config(cfgCosts), byTask = new Map(tasks.map(t => [t.id, t])), name = id => agents.find(a => a.id === id)?.name || id || '—';
  const m = monthOf(now), month = lines.filter(l => monthOf(l.t) === m);
  const sum = ls => ls.reduce((s, l) => s + l.usd, 0);
  const done = tasks.filter(t => t.state === 'done' && !t.error && monthOf(t.doneAt || 0) === m && !t.piece);
  const hours = done.reduce((s, t) => s + minutesSaved(t, c), 0) / 60;
  const weeks = []; for (let i = 7; i >= 0; i--) { const ws = weekStart(now) - i * 7 * 864e5, we = ws + 7 * 864e5; const ls = lines.filter(l => l.t >= ws && l.t < we); const ts = tasks.filter(t => (t.doneAt || 0) >= ws && (t.doneAt || 0) < we && !t.piece); weeks.push({ start: ws, usd: sum(ls), tasks: ts.filter(t => !t.error).length, failed: ts.filter(t => t.error && !t.stopped).length }); }
  const group = key => { const g = {}; for (const l of month) { const k = l[key] || (key === 'dept' ? 'oficina' : '—'); (g[k] ||= { key: k, usd: 0, runs: 0, tasks: new Set() }); g[k].usd += l.usd; g[k].runs++; if (l.task) g[k].tasks.add(l.task); } return Object.values(g).map(x => ({ ...x, tasks: x.tasks.size })).sort((a, b) => b.usd - a.usd); };
  const byDept = group('dept'), byAgent = group('agent').map(x => ({ ...x, name: name(x.key) })), byModel = group('model');
  const perTask = done.length ? sum(month.filter(l => l.task)) / done.length : 0;
  return { month: m, usd: sum(month), budget: budgetState(lines, c, now), runs: month.length, tasksDone: done.length, perTask, hours, value: hours * (c.hourlyRate || 0), hourlyRate: c.hourlyRate || 0, weeks, byDept, byAgent, byModel, suggestions: suggestions(lines, tasks, agents, c, now), pricesAsOf: PRICES_AS_OF, overhead: sum(month.filter(l => !l.task)), sources: [...new Set(month.map(l => l.source))] };
}

/**
 * C4 + C7: a desk on an expensive model whose work is short and approved as it comes → try a cheaper one; a desk on
 * a cheap model that keeps being sent back → try a stronger one; a routine whose results nobody opens → pause it.
 */
export function suggestions(lines, tasks, agents, c, now = Date.now()) {
  const out = [], since = now - 30 * 864e5, recent = tasks.filter(t => (t.doneAt || t.addedAt || 0) >= since && !t.piece);
  const price = id => priceFor(id, c.prices);
  for (const a of agents) {
    const mine = recent.filter(t => t.agent === a.id && t.state === 'done' && !t.error);
    if (mine.length < 5) continue;
    const used = mine.map(t => t.modelUsed).filter(Boolean), top = used.sort((x, y) => used.filter(v => v === y).length - used.filter(v => v === x).length)[0];
    const revised = mine.filter(t => t.revised || t.revisions).length, short = mine.filter(t => String(t.result || '').length < 2500).length;
    const spent = lines.filter(l => l.agent === a.id && l.t >= since).reduce((s, l) => s + l.usd, 0);
    if ((top === 'opus' || top === 'fable') && revised === 0 && short >= mine.length * 0.7) {
      const cur = price(top === 'fable' ? 'claude-fable-5-1' : 'claude-opus-5'), cheap = price('claude-sonnet-5');
      const save = cur && cheap ? spent * (1 - (cheap.in + cheap.out) / (cur.in + cur.out)) : 0;
      out.push({ kind: 'model-down', agent: a.id, text: `${a.name} usa ${top === 'fable' ? 'Fable' : 'Opus'} y en 30 días ninguna de sus ${mine.length} entregas volvió con correcciones; casi todas son cortas. Con Sonnet costarían unos US$${save.toFixed(2)} menos al mes.`, action: { agent: a.id, model: 'sonnet' } });
    } else if ((top === 'sonnet' || !top) && revised >= Math.max(3, mine.length * 0.4)) {
      out.push({ kind: 'model-up', agent: a.id, text: `${a.name} usa Sonnet y ${revised} de sus ${mine.length} entregas volvieron con correcciones. Opus podría acertar a la primera; cuesta más por tarea, pero ahorra idas y vueltas.`, action: { agent: a.id, model: 'opus' } });
    }
  }
  // J10: seats that did nothing in 30 days — rename them to something the business needs
  const idle = agents.filter(a => !a.lead && !tasks.some(t => (t.agent === a.id || t.team?.pieces?.some(p => p.agent === a.id)) && (t.addedAt || 0) >= since));
  if (idle.length >= 3 && tasks.some(t => (t.addedAt || 0) >= since)) out.push({ kind: 'idle', text: `${idle.length} puestos no hicieron nada en 30 días: ${idle.slice(0, 8).map(a => a.name).join(', ')}${idle.length > 8 ? '…' : ''}. Un puesto quieto no cuesta, pero puedes renombrarlo a algo que tu negocio necesite (ficha del agente → Quién es).`, action: null, agents: idle.map(a => a.id) });
  const byRoutine = {};
  for (const t of tasks) if (t.routine && t.state === 'done' && !t.error && (t.doneAt || 0) >= since) (byRoutine[t.routine] ||= []).push(t);
  for (const [id, ts] of Object.entries(byRoutine)) {
    const last = ts.sort((a, b) => b.doneAt - a.doneAt).slice(0, 4);
    if (last.length >= 4 && last.every(t => !t.seenAt)) {
      const spent = lines.filter(l => ts.some(t => t.id === l.task)).reduce((s, l) => s + l.usd, 0);
      out.push({ kind: 'routine-unread', routine: id, text: `Nadie abrió las últimas ${last.length} entregas de la rutina «${last[0].title}» (US$${spent.toFixed(2)} en 30 días). ¿La pausamos?`, action: { routine: id, paused: true } });
    }
  }
  return out;
}

/** C10: the month as CSV for the accountant (one row per model call; the title of its task beside it). */
export function csv(lines, tasks, agents, month) {
  const byTask = new Map(tasks.map(t => [t.id, t])), name = id => agents.find(a => a.id === id)?.name || id || '';
  const q = v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['fecha', 'hora', 'tarea', 'título', 'agente', 'departamento', 'tipo', 'modelo', 'proveedor', 'tokens entrada', 'tokens salida', 'caché leída', 'caché escrita', 'US$', 'origen del costo'].join(',')];
  for (const l of lines.filter(x => monthOf(x.t) === month).sort((a, b) => a.t - b.t)) {
    const d = new Date(l.t), t = byTask.get(l.task);
    rows.push([d.toISOString().slice(0, 10), d.toTimeString().slice(0, 5), l.task || '', t?.title || (l.kind === 'task' ? '' : l.kind), name(l.agent), l.dept || '', l.kind, l.model, l.provider, l.in, l.out, l.cacheRead, l.cacheWrite, l.usd.toFixed(6), l.source === 'claude' ? 'Claude Code' : l.source === 'tabla' ? 'tabla de precios ' + PRICES_AS_OF : l.source === 'estimado' ? 'estimado del Estudio: compáralo con la factura del proveedor' : 'sin precio'].map(q).join(','));
  }
  return '﻿' + rows.join('\r\n') + '\r\n'; // BOM + CRLF: Excel opens the accents right
}

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
import fs from 'node:fs';
import path from 'node:path';

export const PRICES_AS_OF = '2026-09-25';
export const PRICE_SOURCES = [
  'Anthropic (Claude): precios oficiales de la API, platform.claude.com/docs/pricing',
  'Meta Muse Spark: nivel estándar, eesel.ai / aiweekly.co (sep 2026)',
  'DeepSeek V4.1 Flash: hora pico, benchlm.ai/deepseek/api-pricing (sep 2026)',
  'Kimi (Moonshot): benchlm.ai/moonshot/api-pricing, morphllm.com/kimi-api (sep 2026)',
  'GLM (Z.ai): aipricing.guru/z-ai-pricing, developer.puter.com (sep 2026)',
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
];
export const DEFAULTS = { monthlyBudget: 0, alertAt: 0.8, stopAtBudget: false, hourlyRate: 0, minutesPerTask: { emails: 10, sales: 30, marketing: 40, ops: 25, fin: 20, delivery: 35 } };
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
/** One ledger line. reported: what Claude Code said the run cost (only trusted for Anthropic's own models). */
export function line({ task = null, agent = null, dept = null, kind = 'task', modelId, provider = 'anthropic', usage, reported, cfgPrices, t = Date.now() }) {
  const price = priceFor(modelId, cfgPrices);
  const useReported = provider === 'anthropic' && typeof reported === 'number' && reported >= 0;
  const usd = useReported ? reported : usdOf(usage, price);
  return { t, task, agent, dept, kind, model: modelId || '', provider, in: usage?.input_tokens || 0, out: usage?.output_tokens || 0, cacheRead: usage?.cache_read_input_tokens || 0, cacheWrite: usage?.cache_creation_input_tokens || 0, usd: Math.round(usd * 1e6) / 1e6, source: useReported ? 'claude' : price ? 'tabla' : 'sin-precio' };
}

export const file = dataDir => path.join(dataDir, 'costs.jsonl');
export function append(dataDir, l) { try { fs.mkdirSync(dataDir, { recursive: true }); fs.appendFileSync(file(dataDir), JSON.stringify(l) + '\n'); } catch {} }
export function read(dataDir, since = 0) {
  let raw = ''; try { raw = fs.readFileSync(file(dataDir), 'utf8'); } catch { return []; }
  const out = []; for (const s of raw.split('\n')) { if (!s) continue; try { const j = JSON.parse(s); if (j.t >= since) out.push(j); } catch {} } return out;
}

const monthOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const weekStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }; // Monday
/** Where the month stands against the budget. */
export function budgetState(lines, c, now = Date.now()) {
  const m = monthOf(now), spent = lines.filter(l => monthOf(l.t) === m).reduce((s, l) => s + l.usd, 0);
  const b = +c.monthlyBudget || 0;
  return { month: m, spent, budget: b, ratio: b ? spent / b : 0, level: !b ? 'none' : spent >= b ? 'over' : spent >= b * (c.alertAt || 0.8) ? 'alert' : 'ok' };
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

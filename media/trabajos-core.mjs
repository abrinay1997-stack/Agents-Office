// Agents Office — el Estudio: lo PURO de los trabajos (25 oct 2026, fase 8a del puerto a Cloudflare; salió de media/trabajos.mjs).
// El presupuesto (cuántos al día, US$ al día y al mes), la validación de un pedido antes de gastar (modelo, key, prompt, medios,
// tope), el rastro que deja un trabajo, y editar una imagen. Sin disco ni estado: la oficina local (media/trabajos.mjs, con
// data/media-jobs.json) y el Worker de Cloudflare (cloudflare/worker/lib/estudio/, con D1) lo usan IGUAL.
// tests/media-budget.test.mjs, tests/media-edit.test.mjs y la foto de tests/media-fachada.test.mjs vigilan que lo local no cambió.
import { ENGINES, KINDS, engineOn, model, allModels, defaultModel, settingsFor, unitCost, hfRoute, editModels, engines } from './catalogo.mjs';

/* ---------- budget: a count per day and the money spent a day and a month (a video weighs 5 images) ---------- */
// V4.5: the owner's day, not UTC's (in Panamá the «day» used to turn at 7 in the evening)
export const localDay = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
export const weightOf = (kind, n) => (kind === 'video' ? 5 : kind === 'music' ? 3 : 1) * n; // V4.10: a piece of music weighs 3, a voice-over 1
/** What was spent today: the stored record `u` (or null) read for `day`. A file from before V4.5 has no month: today's spend starts it. */
export function usageOf(u, day) {
  const month = day.slice(0, 7);
  const monthCost = u && (u.month || String(u.day || '').slice(0, 7)) === month ? +(u.monthCost ?? u.cost ?? 0) : 0;
  return u && u.day === day ? { audios: 0, music: 0, ...u, month, monthCost } : { day, images: 0, videos: 0, audios: 0, music: 0, cost: 0, month, monthCost }; // V4.10: audios = every sound file (voice and music), music = the music among them
}
/** The record after spending `cost` on `n` files of `kind` (mutates and returns `u`, which usageOf gave). */
export function spendOn(u, kind, n, cost) { if (kind === 'music') { u.audios += n; u.music += n; } else u[kind] += n; u.cost = +(u.cost + cost).toFixed(3); u.monthCost = +(u.monthCost + cost).toFixed(3); return u; }
export const cap = v => (Number.isFinite(+v) && +v > 0 ? +v : 0); // 0, empty or nonsense = no cap
/** What is left today and this month. left / costLeftDay / costLeftMonth are null when that cap is off. `jobs`: all the jobs; `cfg`: the Estudio's limits. */
export function budgetOf(u, jobs, cfg) {
  const active = jobs.filter(j => (j.state === 'queued' || j.state === 'running') && j.engine !== 'prueba');
  const reserved = active.reduce((s, j) => s + Math.max(0, j.weight - weightOf(j.kind, j.items.length)), 0);
  const costReserved = +active.reduce((s, j) => s + (+j.unit || 0) * (+j.n || 1), 0).toFixed(3); // a running job is paid when it ends: until then its estimate is held
  const limit = cap(cfg.dailyLimit), used = u.images + u.videos * 5 + u.audios + u.music * 2, dailyBudget = cap(cfg.dailyBudget), monthlyBudget = cap(cfg.monthlyBudget);
  const left$ = (b, spent) => (b ? +Math.max(0, b - spent - costReserved).toFixed(3) : null);
  return { ...u, limit, used, reserved, left: limit ? Math.max(0, limit - used - reserved) : null, maxPerRequest: cfg.maxPerRequest,
    dailyBudget, monthlyBudget, costReserved, costLeftDay: left$(dailyBudget, u.cost), costLeftMonth: left$(monthlyBudget, u.monthCost) };
}
/** Throws, in words, when `est` (US$) does not fit what is left of the Estudio's day or month (Ajustes → Estudio). */
export function checkBudgetOf(est, b) {
  est = +(+est || 0).toFixed(3); const usd = v => 'US$' + (+v).toFixed(2);
  if (b.costLeftDay != null && est > b.costLeftDay + 1e-9) throw new Error(`presupuesto del día del Estudio: esto cuesta aprox. ${usd(est)} y quedan ${usd(b.costLeftDay)} de ${usd(b.dailyBudget)} (cámbialo en Ajustes → Estudio)`);
  if (b.costLeftMonth != null && est > b.costLeftMonth + 1e-9) throw new Error(`presupuesto del mes del Estudio: esto cuesta aprox. ${usd(est)} y quedan ${usd(b.costLeftMonth)} de ${usd(b.monthlyBudget)} (cámbialo en Ajustes → Estudio)`);
}

/* ---------- the trail a job leaves ---------- */
export const jid = () => 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const LOCAL = 'local'; // banco de presets (F1): un trabajo que se hace entero en esta máquina, sin IA y gratis
export const pubJob = j => { const { remote, cancel, ...rest } = j; return { ...rest, remote: remote ? remote.length : 0, modelName: j.engine === LOCAL ? 'En tu máquina (sin IA)' : model(j.model)?.name || j.model, engineName: j.engine === LOCAL ? 'En tu máquina' : ENGINES[j.engine]?.name || j.engine }; };
/* V4.9 (30 Sep 2026): who asked ('you' · 'agent' · 'dimitri'), the gallery file it is a new version of, Dimitri's message and creative, what it is for, the Brain's notes read to make it. */
const BY = ['you', 'agent', 'dimitri'];
export function trail(req, { resolve }) {
  const extra = {};
  if (req.versionOf != null) { const v = String(req.versionOf).replace(/\\/g, '/'); if (!resolve(v)) throw new Error(`no encuentro «${v}» en el Estudio para hacer una versión`); extra.versionOf = v; }
  if (req.sub && typeof req.sub === 'object' && typeof req.sub.msg === 'string' && /^[a-z0-9_-]{1,40}$/i.test(req.sub.msg) && Number.isInteger(+req.sub.i) && +req.sub.i >= 0) extra.sub = { msg: req.sub.msg, i: +req.sub.i };
  if (typeof req.purpose === 'string' && req.purpose.trim()) extra.purpose = req.purpose.replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 200);
  if (Array.isArray(req.read)) { const r = [...new Set(req.read.filter(x => typeof x === 'string').map(x => x.replace(/[\x00-\x1f\[\]]/g, '').trim().slice(0, 160)).filter(Boolean))].slice(0, 20); if (r.length) extra.read = r; }
  return { by: BY.includes(req.by) ? req.by : 'you', extra };
}
/* Banco de presets (F1, §5.9): lo que el compilador (presets.mjs) le pone al pedido — los presets con su versión, los pasos
   locales, la QA, qué se mide, el canal y la receta (para «Guardar como preset»). */
const OP_RE = /^[a-z0-9-]{2,30}$/;
export function presetTrail(req) {
  const x = {};
  if (Array.isArray(req.preset)) { const l = req.preset.filter(p => p && typeof p.id === 'string' && /^[a-z0-9-]{2,40}$/.test(p.id)).slice(0, 20).map(p => ({ id: p.id, v: +p.v || 1, params: p.params && typeof p.params === 'object' && !Array.isArray(p.params) ? p.params : {} })); if (l.length) x.preset = l; }
  const ops = l => (Array.isArray(l) ? l : []).filter(o => o && typeof o === 'object' && OP_RE.test(o.op)).slice(0, 30);
  const post = [...ops(req.pre), ...ops(req.post)]; if (post.length) x.post = post;
  if (Array.isArray(req.qa)) { const q = req.qa.filter(s => typeof s === 'string' && OP_RE.test(s)).slice(0, 15); if (q.length) x.qa = q; }
  if (req.medir && typeof req.medir === 'object' && !Array.isArray(req.medir)) x.medir = req.medir;
  if (typeof req.canal === 'string' && OP_RE.test(req.canal)) x.canal = req.canal;
  if (req.esEscena) x.esEscena = true;
  if (req.receta && typeof req.receta === 'object' && !Array.isArray(req.receta)) x.receta = req.receta;
  if (typeof req.sku === 'string' && req.sku.trim()) x.sku = req.sku.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  return x;
}

/** Validates a generation request up front (model, key, prompt, media, budget) so a bad request fails at once, and returns the job to queue.
 *  deps: { cfg (the Estudio's config), resolve(id) (is it in the Estudio?), folderOf(id), budget() (the day's, from the store), extra(req) (the lote's mark) } */
export function armarTrabajo(req, deps) {
  const { cfg, resolve, folderOf, budget, extra = () => ({}) } = deps;
  const kind = KINDS.includes(req.kind) ? req.kind : 'image'; // V4.10: 'audio' (a voice-over) and 'music' too
  let id = req.model;
  if (!id && req.provider) id = defaultModel(kind, req.provider);
  if (!id) id = defaultModel(kind);
  const m = model(id);
  if (!m) throw new Error(`no conozco el modelo «${id}»`);
  if (!engineOn(m.engine)) { const e = ENGINES[m.engine]; throw new Error(`${e.name} no tiene key: guárdala en Windows con  ${e.how || `setx ${e.env} "tu-key"`}  y reinicia la oficina`); }
  const prompt = String(req.prompt || '').trim(); if (!prompt && !(m.needs || []).includes('video')) throw new Error('falta el prompt');
  const maxPrompt = m.maxPrompt || 4000; // V4.10: a voice-over takes up to 9,999 characters, MiniMax's image 1,500
  if (prompt.length > maxPrompt) throw new Error(`${m.kind === 'audio' ? 'el texto' : 'el prompt'} es muy largo (máx. ${maxPrompt})`);
  const n = Math.max(1, Math.min(m.kind === 'video' ? 4 : cfg.maxPerRequest, +req.n || 1));
  const media = {};
  for (const [role, max] of Object.entries(m.roles || {})) { const ids = (req.media?.[role] || []).filter(x => typeof x === 'string').slice(0, max); for (const x of ids) { if (!resolve(x)) throw new Error(`no encuentro «${x}» en el Estudio`); if (/\.(mp3|wav|flac|m4a|ogg)$/i.test(x)) throw new Error('un audio no sirve de referencia ni de fotograma: los modelos del Estudio toman imágenes y videos'); if (m.engine !== 'prueba' && /\.svg$/i.test(x)) throw new Error('una tarjeta de prueba no sirve de referencia para un motor real: usa una imagen generada o subida'); if (role === 'video' ? !/\.(mp4|webm)$/i.test(x) : /\.(mp4|webm)$/i.test(x)) throw new Error(role === 'video' ? 'ahí va un video' : 'ahí va una imagen, no un video'); } if (ids.length) media[role] = ids; }
  for (const r of m.needs || []) if (!media[r]?.length) throw new Error(`${m.name} necesita ${{ start: 'una imagen inicial', video: 'un video de origen', reference: 'imágenes de referencia' }[r] || r}`);
  if (m.routes) hfRoute(m, Object.fromEntries(Object.entries(media).map(([r, l]) => [r, l.length]))); // a combination its routes do not take is said now, before anything is spent
  const s = settingsFor(m, req.settings || {}, { ratio: req.ratio, seconds: req.seconds });
  if (m.kind === 'music' && s.instrumental && prompt.length > 2000) throw new Error('la descripción de una pieza instrumental es muy larga (máx. 2000)'); // MiniMax: prompt 1–2000, lyrics 1–3500
  const per = m.hf && s.batchSize ? Number(s.batchSize) : 1, weight = weightOf(m.kind, n * per);
  const b = budget();
  if (m.engine !== 'prueba') { // the free test engine never counts
    if (b.left != null && weight > b.left) throw new Error(`tope diario alcanzado: quedan ${b.left} de ${b.limit} (cámbialo en Ajustes → Estudio)`);
    checkBudgetOf(unitCost(m, s, prompt) * per * n, b);
  }
  const tr = trail(req, { resolve }); // V4.9: who asked (Dimitri too), what for, what it read, which picture it is a version of
  const px = m.kind === 'image' ? presetTrail(req) : (Array.isArray(req.preset) ? { preset: presetTrail({ preset: req.preset }).preset } : {}); // banco de presets: los pasos locales solo sobre imágenes
  return { id: jid(), state: 'queued', kind: m.kind, model: m.id, engine: m.engine, prompt, n, s, media, weight, by: tr.by, agent: req.agent || null, task: req.task || null, at: Date.now(), items: [], cost: 0, unit: unitCost(m, s, prompt) * per, retryOf: req.retryOf || undefined, folder: req.folder && folderOf(req.folder) ? req.folder : undefined, ...tr.extra, ...px, ...extra(req) }; // V4.6: generated inside a folder, it lands there
}

/* ---------- V4.9 (30 Sep 2026): edit a picture — a new version beside it, the original never touched ---------- */
export const RATIOS = ['1:1', '4:5', '5:4', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'];
/** The ratio of a gallery file: the one it was generated at, or the closest to its size (within 3 %), or null. */
export function ratioOf(it) {
  if (it?.ratio && RATIOS.includes(it.ratio)) return it.ratio;
  if (!(it?.w > 0 && it?.h > 0)) return null;
  let best = null, d = Infinity;
  for (const x of RATIOS) { const [a, b] = x.split(':').map(Number), e = Math.abs(Math.log((it.w / it.h) / (a / b))); if (e < d) { d = e; best = x; } }
  return d < 0.03 ? best : null;
}
/** The request for submit() that edits `file` with `instruction`: the model asked for if it edits, else the best one on; the
 *  original's ratio when the model has it; its folder; the original as the reference; versionOf. No edit engine on → an Error
 *  with code 'no-edit-engine' and the engines that would edit, with how to turn each on. `it`: the original's record (or null if it is not there). */
export function editRequestOf({ file, instruction, model: want } = {}, it) {
  const id = String(file || '').replace(/\\/g, '/');
  if (!it) throw new Error('no encuentro esa imagen en el Estudio');
  if ((it.kind && it.kind !== 'image') || /\.(mp4|webm|mp3|wav|flac|m4a|ogg)$/i.test(id)) throw new Error('solo se puede editar una imagen');
  const text = String(instruction || '').trim(); if (!text) throw new Error('di qué quieres cambiar de la imagen');
  if (text.length > 4000) throw new Error('la instrucción es muy larga (máx. 4000)');
  const list = editModels();
  if (!list.length) {
    const e = new Error('ningún motor que edita imágenes tiene key todavía: activa uno y reinicia la oficina');
    e.code = 'no-edit-engine'; e.engines = engines().filter(x => x.id !== 'prueba' && allModels().some(m => m.engine === x.id && m.edit)).map(x => ({ id: x.id, name: x.name, how: x.how }));
    throw e;
  }
  const m = list.find(x => x.id === want) || list[0], r = ratioOf(it), f = m.settings.aspectRatio;
  return { kind: 'image', model: m.id, prompt: text, n: 1, settings: r && f?.values?.includes(r) ? { aspectRatio: r } : {}, media: { reference: [id] }, versionOf: id, by: 'you', ...(it.folder ? { folder: it.folder } : {}) };
}

// Agents Office — el Estudio: los TRABAJOS (F0 del banco de presets, 1 oct 2026: salió de media.mjs, que es la fachada).
// El presupuesto (cuántos al día, US$ al día y al mes), la cola de trabajos en data/media-jobs.json (submit → runJob →
// onDone), cancelar, reintentar, editar una imagen (editRequest: una versión nueva al lado) y el rastro en el Cerebro y en
// la memoria (writeStudioNote, learnArgs).
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as mmx from '../minimax.mjs';
import { S } from './estado.mjs';
import { ENGINES, KINDS, secret, engineOn, model, allModels, defaultModel, settingsFor, unitCost, hfRoute, editModels, engines } from './catalogo.mjs';
import { dir, slug, store, resolve, item, update, folderOf } from './galeria.mjs';
import { RUN, friendly } from './motores.mjs';
import { procesar, guardarCrudo } from './posproceso.mjs'; // banco de presets (F1): lo local y la QA, después del modelo

let usageFile = '', jobsFile = '', hooks = {};
/** configure(): where the day's count and the jobs are kept, and the hooks (onDone…), replaced. */
export function setFiles(dataDir, h = {}) { usageFile = path.join(dataDir, 'media-usage.json'); jobsFile = path.join(dataDir, 'media-jobs.json'); hooks = h; }
export function setHooks(h = {}) { hooks = { ...hooks, ...h }; }

/* ---------- budget: a count per day and the money spent a day and a month, kept in data/ (a video weighs 5 images) ---------- */
// V4.5: the owner's day, not UTC's (in Panamá the «day» used to turn at 7 in the evening)
const localDay = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const today = () => localDay();
const weightOf = (kind, n) => (kind === 'video' ? 5 : kind === 'music' ? 3 : 1) * n; // V4.10: a piece of music weighs 3, a voice-over 1
function usage() {
  let u = null; try { u = JSON.parse(fs.readFileSync(usageFile, 'utf8')); } catch {}
  const day = today(), month = day.slice(0, 7);
  const monthCost = u && (u.month || String(u.day || '').slice(0, 7)) === month ? +(u.monthCost ?? u.cost ?? 0) : 0; // a file from before V4.5 has no month: today's spend starts it
  return u && u.day === day ? { audios: 0, music: 0, ...u, month, monthCost } : { day, images: 0, videos: 0, audios: 0, music: 0, cost: 0, month, monthCost }; // V4.10: audios = every sound file (voice and music), music = the music among them
}
function spend(kind, n, cost) { const u = usage(); if (kind === 'music') { u.audios += n; u.music += n; } else u[kind] += n; u.cost = +(u.cost + cost).toFixed(3); u.monthCost = +(u.monthCost + cost).toFixed(3); fs.mkdirSync(path.dirname(usageFile), { recursive: true }); fs.writeFileSync(usageFile, JSON.stringify(u)); return u; }
const cap = v => (Number.isFinite(+v) && +v > 0 ? +v : 0); // 0, empty or nonsense = no cap
/** What is left today and this month. left / costLeftDay / costLeftMonth are null when that cap is off. */
export function budget() {
  const u = usage(), active = JOBS.filter(j => (j.state === 'queued' || j.state === 'running') && j.engine !== 'prueba');
  const reserved = active.reduce((s, j) => s + Math.max(0, j.weight - weightOf(j.kind, j.items.length)), 0);
  const costReserved = +active.reduce((s, j) => s + (+j.unit || 0) * (+j.n || 1), 0).toFixed(3); // a running job is paid when it ends: until then its estimate is held
  const limit = cap(S.cfg.dailyLimit), used = u.images + u.videos * 5 + u.audios + u.music * 2, dailyBudget = cap(S.cfg.dailyBudget), monthlyBudget = cap(S.cfg.monthlyBudget);
  const left$ = (b, spent) => (b ? +Math.max(0, b - spent - costReserved).toFixed(3) : null);
  return { ...u, limit, used, reserved, left: limit ? Math.max(0, limit - used - reserved) : null, maxPerRequest: S.cfg.maxPerRequest,
    dailyBudget, monthlyBudget, costReserved, costLeftDay: left$(dailyBudget, u.cost), costLeftMonth: left$(monthlyBudget, u.monthCost) };
}
/** Throws, in words, when `est` (US$) does not fit what is left of the Estudio's day or month (Ajustes → Estudio). */
export function checkBudget(est, b = budget()) {
  est = +(+est || 0).toFixed(3); const usd = v => 'US$' + (+v).toFixed(2);
  if (b.costLeftDay != null && est > b.costLeftDay + 1e-9) throw new Error(`presupuesto del día del Estudio: esto cuesta aprox. ${usd(est)} y quedan ${usd(b.costLeftDay)} de ${usd(b.dailyBudget)} (cámbialo en Ajustes → Estudio)`);
  if (b.costLeftMonth != null && est > b.costLeftMonth + 1e-9) throw new Error(`presupuesto del mes del Estudio: esto cuesta aprox. ${usd(est)} y quedan ${usd(b.costLeftMonth)} de ${usd(b.monthlyBudget)} (cámbialo en Ajustes → Estudio)`);
}
/** Money the Estudio spent outside a job (a MiniMax voice designed or cloned): it counts against the day and the month, no file counted. */
export function charge(usd) { const c = +(+usd || 0).toFixed(3); if (c > 0) spend('images', 0, c); return budget(); }
/** V4.5: the caps from Ajustes → Estudio, applied at once (the jobs and the catalog stay as they are). */
export function setLimits(m = {}) {
  for (const k of ['dailyLimit', 'dailyBudget', 'monthlyBudget', 'maxPerRequest', 'concurrency']) if (m[k] !== undefined) S.cfg[k] = m[k];
  setImmediate(pumpJobs); // more at once may start a queued job now
}
/* ---------- jobs: every generation runs in the background ---------- */
let JOBS = [], running = 0; const waiters = new Map();
export function loadJobs() {
  try { JOBS = JSON.parse(fs.readFileSync(jobsFile, 'utf8')); if (!Array.isArray(JOBS)) JOBS = []; } catch { JOBS = []; }
  let changed = false;
  for (const j of JOBS) if (j.state === 'running') { // the office restarted mid-run: a queue engine is asked again, the others are marked
    changed = true;
    if (j.remote?.length) { j.state = 'queued'; j.resumed = (j.resumed || 0) + 1; }
    else Object.assign(j, { state: 'failed', error: 'se interrumpió: la oficina se reinició mientras generaba. Reintenta.', doneAt: Date.now() });
  }
  if (changed) saveJobs();
  running = 0; setImmediate(pumpJobs);
}
/* Banco de presets F2 (lotes.mjs, §5.9.3 y §6): un trabajo de un lote VIVO no cuenta en la semana ni en los 400 últimos (un lote
   de 250 fotos echaría fuera a los demás, y el lote perdería el rastro de sus filas). lotes.mjs dice qué lote sigue vivo y
   recibe cada trabajo suyo al terminar. Va aparte de `hooks` porque configure() los reemplaza. */
let LOTES = {};
export function setLotes(h = {}) { LOTES = { ...LOTES, ...h }; }
const loteVivo = j => { if (!j.lote || typeof LOTES.vivo !== 'function') return false; try { return !!LOTES.vivo(j.lote.id); } catch { return false; } };
const LOTE_ALS = new AsyncLocalStorage();
/** Todo lo que se pida a submit() dentro de fn() queda marcado con su lote y su fila (y el SKU, para nombrar el archivo). */
export const enLote = (info, fn) => LOTE_ALS.run(info, fn);
/** El lote del pedido en curso ({ id, fila, sku }) o null: para quien construye el pedido por su cuenta. */
export const loteActual = () => LOTE_ALS.getStore() || null;
const LOTE_RE = /^L[a-z0-9]{4,30}$/;
function loteDe(req) {
  const l = req.lote && typeof req.lote === 'object' ? req.lote : LOTE_ALS.getStore();
  if (!l || !LOTE_RE.test(String(l.id)) || !Number.isInteger(+l.fila) || +l.fila < 0) return {};
  const sku = typeof l.sku === 'string' && l.sku.trim() && !req.sku ? { sku: l.sku.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) } : {};
  return { lote: { id: String(l.id), fila: +l.fila }, ...(sku.sku ? sku : {}) };
}
function saveJobs() {
  if (!jobsFile) return;
  const cut = Date.now() - 7 * 864e5; // finished jobs are kept a week (the files themselves live in the gallery)
  const vivos = new Set(JOBS.filter(loteVivo)), otros = new Set(JOBS.filter(j => !vivos.has(j) && (j.state === 'queued' || j.state === 'running' || (j.doneAt || j.at) > cut)).slice(-400));
  JOBS = JOBS.filter(j => vivos.has(j) || otros.has(j));
  fs.mkdirSync(path.dirname(jobsFile), { recursive: true });
  const tmp = jobsFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(JOBS, null, 1)); fs.renameSync(tmp, jobsFile);
}
const jid = () => 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const LOCAL = 'local'; // banco de presets (F1): un trabajo que se hace entero en esta máquina, sin IA y gratis
const pub = j => { const { remote, cancel, ...rest } = j; return { ...rest, remote: remote ? remote.length : 0, modelName: j.engine === LOCAL ? 'En tu máquina (sin IA)' : model(j.model)?.name || j.model, engineName: j.engine === LOCAL ? 'En tu máquina' : ENGINES[j.engine]?.name || j.engine }; };
export function jobs({ task, active } = {}) { return JOBS.filter(j => (!task || j.task === task) && (!active || j.state === 'queued' || j.state === 'running')).slice().reverse().map(pub); }
export const job = id => { const j = JOBS.find(x => x.id === id); return j ? pub(j) : null; };
/* V4.9 (30 Sep 2026): the trail a job leaves — who asked ('you' · 'agent' · 'dimitri'), the gallery file it is a new version of,
   Dimitri's message and creative, what it is for, the Brain's notes read to make it. Saved in the job and in each file's record. */
const BY = ['you', 'agent', 'dimitri'];
function trail(req) {
  const extra = {};
  if (req.versionOf != null) { const v = String(req.versionOf).replace(/\\/g, '/'); if (!resolve(v)) throw new Error(`no encuentro «${v}» en el Estudio para hacer una versión`); extra.versionOf = v; }
  if (req.sub && typeof req.sub === 'object' && typeof req.sub.msg === 'string' && /^[a-z0-9_-]{1,40}$/i.test(req.sub.msg) && Number.isInteger(+req.sub.i) && +req.sub.i >= 0) extra.sub = { msg: req.sub.msg, i: +req.sub.i };
  if (typeof req.purpose === 'string' && req.purpose.trim()) extra.purpose = req.purpose.replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 200);
  if (Array.isArray(req.read)) { const r = [...new Set(req.read.filter(x => typeof x === 'string').map(x => x.replace(/[\x00-\x1f\[\]]/g, '').trim().slice(0, 160)).filter(Boolean))].slice(0, 20); if (r.length) extra.read = r; }
  return { by: BY.includes(req.by) ? req.by : 'you', extra };
}
/* Banco de presets (F1, §5.9): lo que el compilador (presets.mjs) le pone al pedido — los presets con su versión, los pasos
   locales, la QA, qué se mide, el canal y la receta (para «Guardar como preset»). La página no lo puede mandar por
   /api/media/jobs: mediaReq no deja pasar estos campos. Lo de «antes» del modelo lo hace presets.mjs sobre la foto (la IA recibe
   esa copia preparada); si otro llamador manda `pre`, va al principio de `post`, en el orden en que llegó. */
const OP_RE = /^[a-z0-9-]{2,30}$/;
function presetTrail(req) {
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
/** Un trabajo que se hace entero en esta máquina (todo lo apilado es local): sin modelo, sin key, gratis, y el original nunca
 *  se toca (el resultado es una versión). No pasa por el presupuesto porque no cuesta. */
function submitLocal(req) {
  const src = String(req.source || req.versionOf || '').replace(/\\/g, '/');
  if (!src || !resolve(src)) throw new Error('no encuentro tu foto en el Estudio');
  if (/\.(mp4|webm|mp3|wav|flac|m4a|ogg)$/i.test(src)) throw new Error('lo local solo trabaja sobre una imagen');
  const px = presetTrail(req); if (!px.post?.length) throw new Error('no hay ningún paso local que hacer');
  const tr = trail({ ...req, versionOf: req.versionOf ?? src });
  const prompt = String(req.prompt || '').replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 300) || 'Edición en tu máquina';
  const j = { id: jid(), state: 'queued', kind: 'image', model: LOCAL, engine: LOCAL, prompt, n: 1, s: {}, media: { reference: [src] }, weight: 0, by: tr.by, agent: req.agent || null, task: req.task || null, at: Date.now(), items: [], cost: 0, unit: 0, source: src, retryOf: req.retryOf || undefined, folder: req.folder && folderOf(req.folder) ? req.folder : undefined, ...tr.extra, ...px, ...loteDe(req) };
  JOBS.push(j); saveJobs(); setImmediate(pumpJobs);
  return pub(j);
}
/** Queue a generation. Checks everything up front (model, key, prompt, media, budget) so a bad request fails at once. */
export function submit(req = {}) {
  if (req.local === true) return submitLocal(req); // banco de presets (F1): sin IA
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
  const n = Math.max(1, Math.min(m.kind === 'video' ? 4 : S.cfg.maxPerRequest, +req.n || 1));
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
    checkBudget(unitCost(m, s, prompt) * per * n, b);
  }
  const tr = trail(req); // V4.9: who asked (Dimitri too), what for, what it read, which picture it is a version of
  const px = m.kind === 'image' ? presetTrail(req) : (Array.isArray(req.preset) ? { preset: presetTrail({ preset: req.preset }).preset } : {}); // banco de presets: los pasos locales solo sobre imágenes
  const j = { id: jid(), state: 'queued', kind: m.kind, model: m.id, engine: m.engine, prompt, n, s, media, weight, by: tr.by, agent: req.agent || null, task: req.task || null, at: Date.now(), items: [], cost: 0, unit: unitCost(m, s, prompt) * per, retryOf: req.retryOf || undefined, folder: req.folder && folderOf(req.folder) ? req.folder : undefined, ...tr.extra, ...px, ...loteDe(req) }; // V4.6: generated inside a folder, it lands there
  JOBS.push(j); saveJobs(); setImmediate(pumpJobs);
  return pub(j);
}
function pumpJobs() {
  const max = Math.max(1, Math.min(6, +S.cfg.concurrency || 3));
  for (const j of JOBS) { if (running >= max) break; if (j.state === 'queued') runJob(j); }
}
async function runJob(j) {
  running++; j.state = 'running'; j.startedAt = j.startedAt || Date.now();
  if (j.remote?.length) j.pollFrom = Date.now(); else delete j.pollFrom; // the office was off for hours: the engine still holds the task (MiniMax: 7 days), so it is asked at least once
  j.note = j.remote?.length ? 'retomando tras el reinicio' : 'enviando'; saveJobs();
  const local = j.engine === LOCAL, m = local ? null : model(j.model);
  const guardar = (buf, ext, extra = {}) => {
    const it = store(buf, ext, { prompt: j.prompt, provider: j.engine, model: j.model, modelName: local ? 'En tu máquina (sin IA)' : m?.name || j.model, ratio: j.s.aspectRatio || null, settings: j.s, media: Object.keys(j.media).length ? j.media : undefined, cost: j.unit, by: j.by, agent: j.agent, task: j.task, job: j.id, ...(j.folder ? { folder: j.folder } : {}), ...(j.versionOf ? { versionOf: j.versionOf } : {}), ...(j.sub ? { sub: j.sub } : {}), ...(j.purpose ? { purpose: j.purpose } : {}), ...(j.read ? { read: j.read } : {}), ...(j.preset ? { preset: j.preset } : {}), ...(j.receta ? { receta: j.receta } : {}), ...(j.lote ? { lote: j.lote } : {}), ...extra });
    j.items.push(it.file); saveJobs(); return it;
  };
  // banco de presets (F1): con pasos locales o QA, cada imagen espera aquí y pasa por posproceso antes de ir a la galería
  const procesa = j.kind === 'image' && (j.post?.length || j.qa?.length), pend = [];
  const ctx = { save: saveJobs, add: (buf, ext, extra = {}) => { if (procesa) { pend.push({ buf, ext, extra }); return null; } return guardar(buf, ext, extra); } };
  try {
    if (local) { const p = resolve(j.source); if (!p) throw new Error('tu foto ya no está en el Estudio'); j.note = 'en tu máquina'; ctx.add(fs.readFileSync(p), path.extname(p).slice(1).toLowerCase()); }
    else { if (!m) throw new Error('el modelo ya no está en el catálogo'); await RUN[m.engine](m, j, ctx); }
    for (const [i, p] of pend.entries()) {
      if (!local) guardarCrudo(j, i + 1, p.buf, p.ext);
      j.note = 'retocando en tu máquina'; saveJobs();
      try {
        const r = await procesar(p.buf, j);
        guardar(r.buffer, r.ext, { ...p.extra, post: r.post, ...(r.qa ? { qa: r.qa } : {}), ...(r.nombre ? { nombre: r.nombre } : {}) });
        if (r.qa?.estado === 'revisar') j.revisar = [...(j.revisar || []), r.qa.motivo || 'la QA pide revisarla'];
        if (r.sinHacer?.length) j.warning = `no se hizo en tu máquina: ${[...new Set(r.sinHacer)].join(' · ')}`.slice(0, 300); // revisión F1: nunca «done» limpio si un paso falló
      } catch (e) {
        if (local || e.code !== 'no-disponible') throw e;
        guardar(p.buf, p.ext, { ...p.extra, post: { pasos: [], avisos: [e.message] } }); // sin sharp: el resultado del modelo tal cual, y se dice
        j.warning = 'lo local no está disponible en esta máquina: va la imagen del modelo sin retocar';
      }
    }
    if (!j.items.length) throw new Error(local ? 'no salió ninguna imagen' : 'el motor terminó sin devolver nada');
    j.state = 'done';
  } catch (e) {
    const why = j.cancel ? 'Cancelado por ti.' : friendly(e.message, e.status);
    if (j.items.length) { j.state = 'done'; j.warning = why; } else { j.state = 'failed'; j.error = why; }
    if (!j.cancel) console.warn(`estudio: ${j.id} ${j.model}: ${e.message}`);
  }
  j.doneAt = Date.now(); j.cost = +(j.unit * j.items.length).toFixed(3); delete j.note;
  if (j.versionOf && j.items.length) { try { const o = item(j.versionOf); if (o) update(j.versionOf, { versions: [...new Set([...(Array.isArray(o.versions) ? o.versions : []), ...j.items])] }); } catch (e) { console.warn('estudio versions:', e.message); } } // V4.9: the original's record lists its versions; its file is never touched
  if (j.engine !== 'prueba' && j.engine !== LOCAL && j.items.length) spend({ video: 'videos', audio: 'audios', music: 'music' }[j.kind] || 'images', j.items.length, j.cost); // V4.10: a sound file counts in «audios»
  if (j.remote && j.state === 'done') delete j.remote; else if (j.remote && j.cancel) delete j.remote;
  saveJobs(); running--;
  const out = pub(j); for (const w of waiters.get(j.id) || []) w(out); waiters.delete(j.id);
  try { hooks.onDone?.(out); } catch (e) { console.warn('estudio onDone:', e.message); }
  if (j.lote) { try { LOTES.alTerminar?.(out); } catch (e) { console.warn('estudio lote:', e.message); } }
  setImmediate(pumpJobs);
}
/** Resolves with the job once it finished, or as it is after `ms` (the agents wait a little, never a whole video). */
export function wait(id, ms = 15 * 60e3) {
  const j = JOBS.find(x => x.id === id); if (!j) return Promise.resolve(null);
  if (j.state === 'done' || j.state === 'failed') return Promise.resolve(pub(j));
  return new Promise(res => {
    const t = setTimeout(() => { const l = waiters.get(id) || []; waiters.set(id, l.filter(x => x !== done)); res(pub(j)); }, ms);
    const done = out => { clearTimeout(t); res(out); };
    waiters.set(id, [...(waiters.get(id) || []), done]);
  });
}
export function cancel(id) {
  const j = JOBS.find(x => x.id === id); if (!j) return null;
  if (j.state === 'queued') { Object.assign(j, { state: 'failed', error: 'Cancelado por ti.', doneAt: Date.now() }); saveJobs(); const out = pub(j); for (const w of waiters.get(j.id) || []) w(out); waiters.delete(j.id); return out; }
  if (j.state === 'running') {
    j.cancel = true; saveJobs();
    if (j.engine === 'minimax') { for (const rq of j.remote || []) if (!rq.done) mmx.cancelVideo(rq.id).catch(() => {}); return pub(j); } // V4.10
    const auth = j.engine === 'higgsfield' ? { authorization: `Key ${secret('higgsfield')}` } : { authorization: `Key ${secret('fal')}` };
    for (const rq of j.remote || []) if (!rq.done && rq.cancel) fetch(rq.cancel, { method: j.engine === 'fal' ? 'PUT' : 'POST', headers: auth, signal: AbortSignal.timeout(15000) }).catch(() => {});
  }
  return pub(j);
}
export function retry(id) { const j = JOBS.find(x => x.id === id); if (!j) return null; return submit({ ...(j.engine === LOCAL ? { local: true, source: j.source } : {}), preset: j.preset, post: j.post, qa: j.qa, medir: j.medir, canal: j.canal, esEscena: j.esEscena, receta: j.receta, sku: j.sku, model: j.model, kind: j.kind, prompt: j.prompt, n: j.n - j.items.length || j.n, settings: j.s, media: j.media, by: j.by, agent: j.agent, task: j.task, retryOf: j.id, folder: j.folder, versionOf: j.versionOf, sub: j.sub, purpose: j.purpose, read: j.read }); }
export function forget(id) { const i = JOBS.findIndex(x => x.id === id && (x.state === 'done' || x.state === 'failed')); if (i < 0) return false; JOBS.splice(i, 1); saveJobs(); return true; }
export function markAttached(id) { const j = JOBS.find(x => x.id === id); if (j) { j.attached = true; saveJobs(); } }

/** The V1 call, kept: generate and wait. { prompt, n, ratio, provider|model, kind, seconds, settings, media, by, agent, task } → { items, cost, budget, job } */
export async function generate(req) {
  const j = submit(req);
  const done = await wait(j.id);
  if (done.state === 'failed') throw new Error(done.error);
  const items = done.items.map(f => item(f)).filter(Boolean);
  return { items, cost: done.cost, budget: budget(), job: done };
}

/* ---------- V4.9 (30 Sep 2026): edit a picture — a new version beside it, the original never touched ---------- */
const RATIOS = ['1:1', '4:5', '5:4', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'];
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
 *  with code 'no-edit-engine' and the engines that would edit, with how to turn each on. */
export function editRequest({ file, instruction, model: want } = {}) {
  const id = String(file || '').replace(/\\/g, '/'), it = resolve(id) ? item(id) : null;
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

/* ---------- V4.9: the trail in the Brain and in the memory ----------
   A real job by Dimitri or an agent, or an edit, leaves a note: <brain>/Agents Office/estudio/YYYY-MM/<YYYY-MM-DD> <slug> <hhmmss>.md
   (inside «Agents Office/», so it never travels through GitHub, like the deliverables), and each file's record names it. */
export const needsNote = j => !!j && j.state === 'done' && Array.isArray(j.items) && j.items.length > 0 && j.engine !== 'prueba' && j.engine !== 'local' && (j.by === 'dimitri' || j.by === 'agent' || !!j.versionOf);
const yml = v => JSON.stringify(String(v)); // a quoted YAML scalar: a prompt or a name never breaks the front matter
/** Writes the note of a finished job (once) and returns its name, or null when the job leaves none. */
export function writeStudioNote(j, now = new Date()) {
  if (!needsNote(j) || !dir()) return null;
  const had = item(j.items[0])?.note; if (had) return had; // once per job
  const p2 = x => String(x).padStart(2, '0'), sub = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`, day = `${sub}-${p2(now.getDate())}`, hms = p2(now.getHours()) + p2(now.getMinutes()) + p2(now.getSeconds());
  const folder = path.join(path.dirname(dir()), 'estudio', sub); fs.mkdirSync(folder, { recursive: true });
  const base = `${day} ${slug(j.prompt)} ${hms}`; let name = base; for (let n = 2; fs.existsSync(path.join(folder, name + '.md')); n++) name = `${base}-${n}`;
  const fname = j.folder ? folderOf(j.folder)?.name || '' : '', src = f => '/media/' + f.split('/').map(encodeURIComponent).join('/');
  const fm = ['---', 'kind: creativo', `model: ${yml(j.model)}`, `by: ${j.by}`, ...(j.agent ? [`agent: ${yml(j.agent)}`] : []), ...(j.task ? [`task: ${yml(j.task)}`] : []),
    `folder: ${yml(fname)}`, `purpose: ${yml(j.purpose || '')}`, ...(j.versionOf ? [`versionOf: ${yml(j.versionOf)}`] : []), 'files:', ...j.items.map(f => `  - ${yml(f)}`), `date: ${day}`, '---'];
  const who = j.by === 'dimitri' ? 'Dimitri' : j.by === 'agent' ? `el agente ${j.agent || ''}`.trim() : 'el dueño';
  const body = [`# ${String(j.prompt).replace(/\s+/g, ' ').slice(0, 90)}`, '',
    `${j.versionOf ? 'Versión editada' : 'Creativo'} del Estudio, pedido por ${who}, con ${j.modelName || j.model}${fname ? ` · carpeta «${fname}»` : ''}${j.purpose ? ` · para: ${j.purpose}` : ''}.`, '',
    '## Prompt', String(j.prompt), '', ...(j.versionOf ? ['## Original', `![](${src(j.versionOf)})`, ''] : []),
    '## Archivos', ...j.items.map(f => /\.(mp4|webm)$/i.test(f) ? `[▶ ${f.split('/').pop()}](${src(f)})` : /\.(mp3|wav|flac|m4a|ogg)$/i.test(f) ? `[🔊 ${f.split('/').pop()}](${src(f)})` : `![](${src(f)})`), '',
    ...(j.read?.length ? [`Read: ${j.read.map(n => `[[${n}]]`).join(' · ')}`, ''] : [])];
  fs.writeFileSync(path.join(folder, name + '.md'), [...fm, '', ...body].join('\n'));
  for (const f of j.items) { try { update(f, { note: name }); } catch {} }
  return name;
}
/** The line an agent's task carries when the owner sent it gallery files to work from (task.refs, set by «Mandar a un
 *  departamento…»). task.media is what the task itself made: never handed back as an input, or a «revise» would copy it. */
export const refsLine = t => Array.isArray(t?.refs) && t.refs.length ? `\nImágenes de la galería para esta tarea: ${t.refs.slice(0, 12).join(', ')} (ids del Estudio: úsalas de referencia o para animar)` : '';
/** The memory learns once per job, not per file: 'm:' + the job (or the file when it has none). */
export const learnId = it => it ? 'm:' + (it.job || it.file) : null;
/** What the memory learns from one gallery file (r: 1 used or ⭐, 0 thrown away unused), or null when it read no note or there is
 *  no verdict yet. A job is one verdict (memory.reinforce counts its id once; a new verdict replaces the old one): any file used
 *  → 1; 0 only when the last of its files leaves unused (another one still in the gallery may be used yet). The notes were read,
 *  not cited together, so pairs: false — no learned link between every pair of them. */
export function learnArgs(file, r) {
  const it = item(file); if (!it || !Array.isArray(it.read) || !it.read.length) return null;
  const v = Math.max(0, Math.min(1, +r || 0));
  if (v < 1 && it.job) { const j = JOBS.find(x => x.id === it.job); if ((j?.items || []).some(f => f !== it.file && item(f))) return null; }
  return { id: learnId(it), r: v, cited: it.read, read: it.read, pairs: false };
}

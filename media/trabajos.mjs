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
import { RUN } from './motores.mjs';
import { explicar } from './errores.mjs';
import { procesar, guardarCrudo, juntarAvisos } from './posproceso.mjs'; // banco de presets (F1): lo local y la QA, después del modelo
import { renombrar } from '../fs-seguro.mjs';
import { localDay, weightOf, usageOf, spendOn, cap, budgetOf, checkBudgetOf, jid, LOCAL, pubJob, trail, presetTrail, armarTrabajo, ratioOf as ratioOfCore, editRequestOf } from './trabajos-core.mjs'; // 25 oct 2026: lo puro, compartido con la nube // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

let usageFile = '', jobsFile = '', hooks = {};
/** configure(): where the day's count and the jobs are kept, and the hooks (onDone…), replaced. */
export function setFiles(dataDir, h = {}) { usageFile = path.join(dataDir, 'media-usage.json'); jobsFile = path.join(dataDir, 'media-jobs.json'); hooks = h; }
export function setHooks(h = {}) { hooks = { ...hooks, ...h }; }

/* ---------- budget: a count per day and the money spent a day and a month, kept in data/ (a video weighs 5 images) ---------- */
const today = () => localDay();
function usage() {
  let u = null; try { u = JSON.parse(fs.readFileSync(usageFile, 'utf8')); } catch {}
  return usageOf(u, today());
}
function spend(kind, n, cost) { const u = spendOn(usage(), kind, n, cost); fs.mkdirSync(path.dirname(usageFile), { recursive: true }); fs.writeFileSync(usageFile, JSON.stringify(u)); return u; }
/** What is left today and this month. left / costLeftDay / costLeftMonth are null when that cap is off. */
export function budget() { return budgetOf(usage(), JOBS, S.cfg); }
/** Throws, in words, when `est` (US$) does not fit what is left of the Estudio's day or month (Ajustes → Estudio). */
export function checkBudget(est, b = budget()) { return checkBudgetOf(est, b); }
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
/* Fase 11.5 (carril K): un trabajo de una SERIE de imágenes lleva `serie:{id,n,intento}` (como `lote:{id,fila}`): así un reinicio lo reconoce sin duplicar. Solo lo pone series-generar.mjs
   al llamar a submit(): mediaReq (la API y los MCP) no copia ese campo, así que nadie de fuera puede marcar (ni falsificar) un trabajo de serie. */
let SERIES = {};
export function setSeries(h = {}) { SERIES = { ...SERIES, ...h }; }
const serieVivo = j => { if (!j.serie || typeof SERIES.vivo !== 'function') return false; try { return !!SERIES.vivo(j.serie.id); } catch { return false; } };
const SERIE_ID = /^[\w-]{1,60}$/;
function serieDe(req) {
  const x = req.serie; if (!x || typeof x !== 'object') return {};
  return SERIE_ID.test(String(x.id)) && Number.isInteger(x.n) && x.n >= 1 && Number.isInteger(x.intento) && x.intento >= 1 ? { serie: { id: String(x.id), n: x.n, intento: x.intento } } : {};
}
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
  const vivos = new Set(JOBS.filter(j => loteVivo(j) || serieVivo(j))), otros = new Set(JOBS.filter(j => !vivos.has(j) && (j.state === 'queued' || j.state === 'running' || (j.doneAt || j.at) > cut)).slice(-400));
  JOBS = JOBS.filter(j => vivos.has(j) || otros.has(j));
  fs.mkdirSync(path.dirname(jobsFile), { recursive: true });
  const tmp = jobsFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(JOBS, null, 1)); renombrar(tmp, jobsFile);
}
const pub = pubJob;
export function jobs({ task, active } = {}) { return JOBS.filter(j => (!task || j.task === task) && (!active || j.state === 'queued' || j.state === 'running')).slice().reverse().map(pub); }
export const job = id => { const j = JOBS.find(x => x.id === id); return j ? pub(j) : null; };
/** Un trabajo que se hace entero en esta máquina (todo lo apilado es local): sin modelo, sin key, gratis, y el original nunca
 *  se toca (el resultado es una versión). No pasa por el presupuesto porque no cuesta. */
function submitLocal(req) {
  const src = String(req.source || req.versionOf || '').replace(/\\/g, '/');
  if (!src || !resolve(src)) throw new Error('no encuentro tu foto en el Estudio');
  if (/\.(mp4|webm|mp3|wav|flac|m4a|ogg)$/i.test(src)) throw new Error('lo local solo trabaja sobre una imagen');
  const px = presetTrail(req); if (!px.post?.length) throw new Error('no hay ningún paso local que hacer');
  const tr = trail({ ...req, versionOf: req.versionOf ?? src }, { resolve });
  const prompt = String(req.prompt || '').replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 300) || 'Edición en tu máquina';
  const j = { id: jid(), state: 'queued', kind: 'image', model: LOCAL, engine: LOCAL, prompt, n: 1, s: {}, media: { reference: [src] }, weight: 0, by: tr.by, agent: req.agent || null, task: req.task || null, at: Date.now(), items: [], cost: 0, unit: 0, source: src, retryOf: req.retryOf || undefined, folder: req.folder && folderOf(req.folder) ? req.folder : undefined, ...tr.extra, ...px, ...loteDe(req) };
  JOBS.push(j); saveJobs(); setImmediate(pumpJobs);
  return pub(j);
}
/** Queue a generation. Checks everything up front (model, key, prompt, media, budget) so a bad request fails at once. */
export function submit(req = {}) {
  if (req.local === true) return submitLocal(req); // banco de presets (F1): sin IA
  const j = armarTrabajo(req, { cfg: S.cfg, resolve, folderOf, budget, extra: r => ({ ...loteDe(r), ...serieDe(r) }) });
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
    // revisión F1: con varias imágenes, los avisos se juntan (antes el de la última pisaba al de las anteriores y al del motor)
    const avisos = new Set(), sinHacer = new Set();
    for (const [i, p] of pend.entries()) {
      if (!local) guardarCrudo(j, i + 1, p.buf, p.ext);
      j.note = 'retocando en tu máquina'; saveJobs();
      try {
        const r = await procesar(p.buf, j);
        guardar(r.buffer, r.ext, { ...p.extra, post: r.post, ...(r.qa ? { qa: r.qa } : {}), ...(r.nombre ? { nombre: r.nombre } : {}) });
        if (r.qa?.estado === 'revisar') j.revisar = [...(j.revisar || []), r.qa.motivo || 'la QA pide revisarla'];
        for (const x of r.sinHacer || []) sinHacer.add(x); // revisión F1: nunca «done» limpio si un paso falló
      } catch (e) {
        if (local || e.code !== 'no-disponible') throw e;
        guardar(p.buf, p.ext, { ...p.extra, post: { pasos: [], avisos: [e.message] } }); // sin sharp: el resultado del modelo tal cual, y se dice
        avisos.add('lo local no está disponible en esta máquina: va la imagen del modelo sin retocar');
      }
    }
    const w = juntarAvisos(j.warning, avisos, sinHacer); if (w) j.warning = w;
    if (!j.items.length) throw new Error(local ? 'no salió ninguna imagen' : 'el motor terminó sin devolver nada');
    j.state = 'done';
  } catch (e) {
    const ex = j.cancel ? { texto: 'Cancelado por ti.', clase: 'cancelado', detalle: '' } : explicar(e.message, e.status); // IMG-04: the words, the class and the original apart
    const why = ex.texto;
    if (j.items.length) { j.state = 'done'; j.warning = why; } else { j.state = 'failed'; j.error = why; j.errorClass = ex.clase; if (ex.detalle) j.errorRaw = ex.detalle.slice(0, 400); }
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
export const ratioOf = ratioOfCore;
/** The request for submit() that edits `file` with `instruction` (media/trabajos-core.mjs): the model asked for if it edits, else the best one on… */
export function editRequest({ file, instruction, model: want } = {}) {
  const id = String(file || '').replace(/\\/g, '/');
  return editRequestOf({ file, instruction, model: want }, resolve(id) ? item(id) : null);
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

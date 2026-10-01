// Agents Office — the ESTUDIO: images and video the agents (and the owner) generate for real.
//
// ENGINES. One is ON when its key is in the Windows environment (set it once: `setx NAME "…"`, then restart the office);
// no key ever lives in a file of this repo:
//   higgsfield — Higgsfield Cloud: Soul, Kling 3, Seedance 2/2.5, Flux 2, Ideogram 4, Recraft, Wan, MiniMax, LTX…  HF_KEY="id:secret"
//                (or HF_API_KEY + HF_API_SECRET; HF_API_BASE_URL overrides https://api.higgsfield.ai)
//   gemini     — Google: Nano Banana 2 / 2 Lite / Pro (images), Veo 3.1 / Fast / Lite (video)  GEMINI_API_KEY
//   grok       — xAI Grok image                                                     XAI_API_KEY
//   openai     — OpenAI gpt-image-1                                                 OPENAI_API_KEY
//   meta       — Meta Muse Image (muse-image-1.0): generates, edits, searches real references itself   META_API_KEY (or MODEL_API_KEY)
//   fal        — fal.ai: Flux, Seedream, Nano Banana, Ideogram, Kling, Seedance, Hailuo, Veo   FAL_KEY
//   prueba     — a free local test card: the whole pipeline without spending anything
// MODELS. CATALOG below: each model says its engine, the media it takes (start/end frame, references, a video) and its
// settings. The Higgsfield entries and their request bodies follow open-higgsfield (wide-trace/open-higgsfield,
// src/generation/to-platform.ts and catalog/), the auth and the upload follow Higgsfield's own client (higgsfield-client).
// JOBS. Every generation is a job in data/media-jobs.json that runs in the background: nobody waits on a video. The queue
// engines (Higgsfield, fal video) keep their request ids in the job, so a restart of the office resumes the poll.
// FILES. <brain>/Agents Office/media/YYYY-MM/<name>.<ext> with <name>.json beside it (prompt, model, settings, the media
// it used, cost estimate, who asked, task). Budget: office.config.json → "media": { "dailyLimit": 40, "maxPerRequest": 8 }.
// V4.5 (27 Sep 2026): the owner sets it in Ajustes → Estudio (office.config.local.json, applied at once by setLimits): the
// count a day (0 = no cap) and, new, a spend limit in US$ a day and a month ("dailyBudget", "monthlyBudget"; 0 = none),
// checked BEFORE a request is sent with the model's estimated price, counting what is still being generated.
import fs from 'node:fs';
import path from 'node:path';

export const ENGINES = {
  higgsfield: { name: 'Higgsfield', env: 'HF_KEY', site: 'cloud.higgsfield.ai', how: 'setx HF_KEY "tu-id:tu-secreto"' },
  gemini: { name: 'Google (Gemini API)', env: 'GEMINI_API_KEY', site: 'aistudio.google.com' },
  grok: { name: 'Grok (xAI)', env: 'XAI_API_KEY', site: 'console.x.ai' },
  openai: { name: 'OpenAI', env: 'OPENAI_API_KEY', site: 'platform.openai.com' },
  meta: { name: 'Meta (Muse Image)', env: 'META_API_KEY', site: 'dev.meta.ai', how: 'setx META_API_KEY "tu-key-de-meta"' }, // V4.8: also MODEL_API_KEY, the key the office already uses for Muse Spark
  fal: { name: 'fal.ai', env: 'FAL_KEY', site: 'fal.ai' },
  prueba: { name: 'Prueba (gratis)', env: null },
};
export const NAMES = Object.fromEntries(Object.entries(ENGINES).map(([k, v]) => [k, v.name]));
export const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash-image', grok: 'grok-2-image', openai: 'gpt-image-1', meta: 'muse-image-1.0' };
const secret = e => {
  if (e === 'prueba') return 'local';
  if (e === 'higgsfield') return process.env.HF_KEY || (process.env.HF_API_KEY && process.env.HF_API_SECRET ? `${process.env.HF_API_KEY}:${process.env.HF_API_SECRET}` : '');
  if (e === 'meta') return process.env.META_API_KEY || process.env.MODEL_API_KEY || ''; // Meta's docs call it MODEL_API_KEY; the office names the engine
  return process.env[ENGINES[e]?.env] || '';
};
const engineOn = e => !!secret(e);
const HF_BASE = () => (process.env.HF_API_BASE_URL || 'https://api.higgsfield.ai').replace(/\/$/, '');
// the fal.ai and Google addresses can point at a local stand-in (npm run check tests the queues with no key and no spend)
const FAL_RUN = () => process.env.AO_FAL_RUN || 'https://fal.run', FAL_QUEUE = () => process.env.AO_FAL_QUEUE || 'https://queue.fal.run', GEMINI_BASE = () => process.env.AO_GEMINI_BASE || 'https://generativelanguage.googleapis.com';
const META_BASE = () => (process.env.AO_META_BASE || 'https://api.meta.ai/v1').replace(/\/$/, '');

/* ---------- the catalog ---------- */
const E = (values, def) => ({ type: 'enum', values, default: def ?? values[0] });
const R = (min, max, def, step) => ({ type: 'range', min, max, default: def, ...(step ? { step } : {}) });
const B = def => ({ type: 'boolean', default: def });
const IMG_ASPECT = ['1:1', '4:5', '3:4', '9:16', '16:9', '4:3', '3:2', '2:3'];
const HF_IMG_ASPECT = ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'];
const SOUL_ASPECT = ['9:16', '16:9', '4:3', '3:4', '1:1', '2:3', '3:2'];
const SEEDANCE_ASPECT = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];
const VID_ASPECT = ['16:9', '9:16', '1:1'];

// Higgsfield request bodies for the routes its documentation no longer lists (the «legacy» models) — a port of open-higgsfield's mappers. j = { prompt, s: settings, m: { start, end, reference, video, audio } } (URLs)
const HF = {
  seedance: prefix => j => {
    const [start] = j.m.start, [end] = j.m.end, refs = j.m.reference, videos = j.m.video, audios = j.m.audio;
    const shared = { prompt: j.prompt, resolution: j.s.resolution, generate_audio: j.s.generateAudio, duration: j.s.duration, ...(j.s.outputFormat ? { output_format: j.s.outputFormat } : {}) };
    if (start) return { path: `${prefix}/image-to-video`, body: { ...shared, image_url: start, ...(end ? { end_image_url: end } : {}) } };
    if (refs.length || videos.length || audios.length) return { path: `${prefix}/reference-to-video`, body: { ...shared, aspect_ratio: j.s.aspectRatio, ...(refs.length ? { image_urls: refs } : {}), ...(videos.length ? { video_urls: videos } : {}), ...(audios.length ? { audio_urls: audios } : {}) } };
    return { path: `${prefix}/text-to-video`, body: { ...shared, aspect_ratio: j.s.aspectRatio } };
  },
  paths: spec => j => { // open-higgsfield's mapByPaths: the shared shape of every other model
    const [start] = j.m.start, [end] = j.m.end, refs = j.m.reference, videos = j.m.video;
    const body = { prompt: j.prompt, ...(j.s.aspectRatio ? { aspect_ratio: j.s.aspectRatio } : {}), ...(j.s.resolution ? { resolution: j.s.resolution } : {}), ...(typeof j.s.duration === 'number' ? { duration: j.s.duration } : {}) };
    if (spec.firstLast && (start || end)) return { path: spec.firstLast, body: { ...body, ...(start ? { first_frame_url: start } : {}), ...(end ? { last_frame_url: end } : {}) } };
    if (spec.image && start) return { path: spec.image, body: { ...body, image_url: start, ...(end ? { last_image_url: end } : {}) } };
    if (spec.reference && (refs.length || videos.length)) return { path: spec.reference, body: { ...body, ...(refs.length ? { image_urls: refs } : {}), ...(videos.length ? { video_urls: videos } : {}) } };
    if (spec.text) return { path: spec.text, body: refs.length ? { ...body, image_urls: refs } : body };
    const any = spec.image || spec.reference || spec.firstLast; if (any) return { path: any, body };
    throw new Error('el modelo no tiene ruta');
  },
};
const t2v = p => /\/text-to-video$/.test(p) ? { text: p, image: p.replace(/\/text-to-video$/, '/image-to-video') } : { text: p }; // as open-higgsfield: an image route only where the path has one (LTX's «…/text-to-video/pro» has none — a start frame there went to the text route)
const hfImage = (id, name, text, cost, note) => ({ id, engine: 'higgsfield', kind: 'image', name, cost, note, roles: { reference: 8 }, settings: { aspectRatio: E(HF_IMG_ASPECT, '1:1'), resolution: E(['1k', '2k', '4k'], '1k') }, hf: HF.paths({ text }) });
const hfVideo = (id, name, roles, spec, perSec, note) => ({ id, engine: 'higgsfield', kind: 'video', name, cost: perSec, per: 's', note, roles, settings: { aspectRatio: E(VID_ASPECT, '16:9'), resolution: E(['720p', '1080p'], '720p'), duration: R(4, 10, 5) }, hf: HF.paths(spec) });
const seedanceSet = res => ({ aspectRatio: E(SEEDANCE_ASPECT, '16:9'), duration: R(4, 15, 5), generateAudio: B(true), resolution: E(res, '720p') });
// fal.ai: images answer at once (fal.run), video goes through the queue (queue.fal.run) and is polled
const FAL_SIZE = { '1:1': 'square_hd', '4:5': 'portrait_4_3', '3:4': 'portrait_4_3', '2:3': 'portrait_4_3', '9:16': 'portrait_16_9', '16:9': 'landscape_16_9', '4:3': 'landscape_4_3', '3:2': 'landscape_4_3' };
const falImg = (id, name, cost, text, edit, maxRefs, note, extra = s => ({})) => ({ id, engine: 'fal', kind: 'image', name, cost, note, roles: edit ? { reference: maxRefs } : {}, settings: { aspectRatio: E(IMG_ASPECT, '1:1') },
  fal: j => j.m.reference.length && edit ? { path: edit, body: { prompt: j.prompt, num_images: j.n, ...(maxRefs === 1 ? { image_url: j.m.reference[0] } : { image_urls: j.m.reference }), ...extra(j.s) } } : { path: text, body: { prompt: j.prompt, num_images: j.n, ...extra(j.s) } } });

/* ---------- Higgsfield, from its own documentation (V4.4, 25 Sep 2026) ----------
   higgsfield-schemas.json holds every route Higgsfield documents (docs.higgsfield.ai, «llms-full.txt»; rebuilt with
   scripts/higgsfield-schemas.mjs): its fields, allowed values, limits, defaults, which are required. Each model below is a
   list of those routes. From them the office works out, with nothing typed by hand: the settings the page shows (their
   values are the union of what the routes allow), the media a model takes (a first/last frame, references, a video), which
   route a request goes to (by the media it carries), and a body with only fields that route knows, each value one it
   accepts (anything else is left out, so the route's own default applies). tests/higgsfield.test.mjs sends every
   combination through the schema. Before this, bodies came from open-higgsfield's mappers: 37 kinds of request carried a
   field or a value Higgsfield refuses (Hailuo at 5 s, LTX at 1:1, Seedance 2.5 with output_format…). */
const HFS = (() => { try { return JSON.parse(fs.readFileSync(new URL('./higgsfield-schemas.json', import.meta.url), 'utf8')).endpoints || {}; } catch { return {}; } })();
export const hfSchemas = () => HFS;
const HF_SET = { aspect_ratio: 'aspectRatio', resolution: 'resolution', duration: 'duration', mode: 'mode', quality: 'quality', rendering_speed: 'renderingSpeed', batch_size: 'batchSize',
  generate_audio: 'generateAudio', sound: 'sound', enhance_prompt: 'enhancePrompt', prompt_optimizer: 'promptOptimizer', prompt_extend: 'promptExtend', cfg_scale: 'cfgScale', keep_original_sound: 'keepOriginalSound',
  character_orientation: 'characterOrientation', camera_movement: 'cameraMovement', fps: 'fps', genre: 'genre', era: 'era', light: 'light', pacing: 'pacing', camera_model: 'cameraModel', camera_lens: 'cameraLens',
  camera_aperture: 'cameraAperture', color_palette: 'colorPalette', bitrate_mode: 'bitrateMode', output_format: 'outputFormat' };
const YESNO = { sound: ['on', 'off'], keep_original_sound: ['yes', 'no'] }; // switches Higgsfield spells as words
const isSwitch = (name, f) => f.t === 'boolean' || !!(YESNO[name] && f.e && f.e.join() === YESNO[name].join());
const HF_ORDER = ['firstLast', 'image', 'edit', 'videoRef', 'reference', 'text']; // the order a request is matched to a route
const slotOf = (kind, role) => role === 'start' ? ['first_frame_url', 'image_url'] : role === 'end' ? ['last_frame_url', 'end_image_url', 'last_image_url'] : role === 'video' ? ['video_url', 'video_urls']
  : kind === 'image' ? ['image_urls', 'image_url', 'image_reference_url'] : ['image_urls'];
const takes = (kind, eid, role) => { const P = HFS[eid]?.p || {}; return slotOf(kind, role).some(n => P[n]); };
const MEDIA_FIELDS = ['first_frame_url', 'last_frame_url', 'end_image_url', 'last_image_url', 'image_url', 'image_urls', 'image_reference_url', 'video_url', 'video_urls'];
const roleOfField = (kind, f) => ['first_frame_url'].includes(f) || (f === 'image_url' && kind === 'video') ? 'start' : ['last_frame_url', 'end_image_url', 'last_image_url'].includes(f) ? 'end' : ['video_url', 'video_urls'].includes(f) ? 'video' : 'reference';
/** The route a request goes to, from the media it carries ({ start, end, reference, video } counts), or an error in words. */
export function hfRoute(m, counts = {}) {
  const has = Object.entries(counts).filter(([, n]) => n > 0).map(([r]) => r);
  const ok = eid => { const sc = HFS[eid]; if (!sc) return false; if (has.some(r => !takes(m.kind, eid, r))) return false;
    return sc.req.filter(f => MEDIA_FIELDS.includes(f)).every(f => has.includes(roleOfField(m.kind, f))); };
  const routes = HF_ORDER.filter(k => m.routes[k]).map(k => m.routes[k]);
  const pick = (!has.length && m.routes.text && ok(m.routes.text)) ? m.routes.text : routes.find(ok);
  if (pick) return pick;
  const need = [...new Set(routes.flatMap(eid => HFS[eid]?.req.filter(f => MEDIA_FIELDS.includes(f)).map(f => roleOfField(m.kind, f)) || []))];
  throw new Error(`${m.name} no acepta esa combinación${need.length ? `: necesita ${need.map(r => ({ start: 'una imagen inicial', end: 'una imagen final', reference: 'imágenes de referencia', video: 'un video' })[r]).join(' y ')}` : ''}`);
}
/** A request body for that route: only its fields, each value one it accepts. j = { prompt, s, m: { start, end, reference, video } } (URLs) */
export function hfBody(m, eid, j) {
  const P = HFS[eid].p, body = {};
  if (P.prompt) body.prompt = j.prompt;
  const put = (names, v) => { const n = names.find(x => P[x]); if (n) body[n] = /_urls$/.test(n) ? [].concat(v).slice(0, P[n].maxItems || 99) : [].concat(v)[0]; return !!n; };
  if (j.m.start[0]) put(['first_frame_url', 'image_url'], j.m.start[0]);
  if (j.m.end[0]) put(['last_frame_url', 'end_image_url', 'last_image_url'], j.m.end[0]);
  if (j.m.reference.length) put(slotOf(m.kind, 'reference'), j.m.reference);
  if (j.m.video.length) { const [v1, ...more] = j.m.video; if (P.video_url) { body.video_url = v1; if (more.length && P.video_urls) body.video_urls = more.slice(0, P.video_urls.maxItems || 99); } else if (P.video_urls) body.video_urls = j.m.video.slice(0, P.video_urls.maxItems || 99); }
  for (const [name, key] of Object.entries(HF_SET)) {
    const f = P[name], given = j.s[key]; if (!f || given === undefined) continue;
    if (isSwitch(name, f)) { body[name] = f.t === 'boolean' ? !!given : given ? YESNO[name][0] : YESNO[name][1]; continue; }
    if (given === '' || given === null) continue; // «el motor decide»
    let v = given;
    if (f.t === 'integer' || f.t === 'number') {
      v = Number(v); if (!Number.isFinite(v)) continue;
      if (f.e) v = f.e.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, f.e[0]); // 7 s on a 5|10 route → 5
      if (f.min !== undefined) v = Math.max(f.min, v); if (f.max !== undefined) v = Math.min(f.max, v); if (f.t === 'integer') v = Math.round(v);
    } else { v = String(v); if (f.e && !f.e.includes(v)) continue; } // a value this route does not have: its own default applies
    body[name] = v;
  }
  for (const r of HFS[eid].req) if (body[r] === undefined && (P[r].d !== undefined || P[r].e)) body[r] = P[r].d !== undefined ? P[r].d : P[r].e[0]; // a required field always goes (LTX's duration)
  return { path: eid, body };
}
function hfSettings(kind, routes) {
  const acc = {};
  for (const eid of routes) for (const [name, key] of Object.entries(HF_SET)) {
    const f = HFS[eid]?.p[name]; if (!f) continue;
    const a = acc[key] || (acc[key] = { name, sw: isSwitch(name, f), num: f.t === 'integer' || f.t === 'number', real: f.t === 'number', vals: [], min: Infinity, max: -Infinity, def: undefined });
    if (a.def === undefined && f.d !== undefined) a.def = f.d;
    if (f.e && !a.sw) for (const v of f.e) if (!a.vals.includes(v)) a.vals.push(v);
    if (f.min !== undefined && f.max !== undefined) { a.min = Math.min(a.min, f.min); a.max = Math.max(a.max, f.max); }
  }
  const out = {};
  for (const [key, a] of Object.entries(acc)) {
    if (a.sw) { out[key] = B(typeof a.def === 'boolean' ? a.def : YESNO[a.name] ? a.def === YESNO[a.name][0] : false); continue; }
    if (a.num && Number.isFinite(a.min)) { if (key === 'duration' && a.min < 1) a.min = 1; const d = a.def ?? a.min; out[key] = R(a.min, a.max, Math.min(a.max, Math.max(a.min, d)), a.real ? 0.01 : undefined); continue; }
    if (!a.vals.length) continue;
    const vals = a.vals.map(String), def = a.def !== undefined ? String(a.def) : key === 'aspectRatio' || key === 'resolution' || key === 'duration' ? vals[0] : '';
    out[key] = E(def === '' ? ['', ...vals] : vals, def);
  }
  return out;
}
function hfRoles(kind, routes) {
  const roles = {}, needSets = [];
  for (const eid of routes) { const P = HFS[eid]?.p || {}, req = new Set();
    for (const f of MEDIA_FIELDS) if (P[f]) { const r = roleOfField(kind, f); const n = /_urls$/.test(f) ? (P[f].maxItems || 8) : 1; roles[r] = Math.max(roles[r] || 0, r === 'video' && P.video_url && P.video_urls ? 1 + (P.video_urls.maxItems || 8) : n); }
    for (const f of HFS[eid]?.req || []) if (MEDIA_FIELDS.includes(f)) req.add(roleOfField(kind, f));
    needSets.push(req); }
  const needs = needSets.length ? [...needSets[0]].filter(r => needSets.every(s => s.has(r))) : [];
  return { roles, needs };
}
/** One Higgsfield model: its id, name, kind, routes ({ text, image, firstLast, reference, videoRef, edit }), price and a note. */
const hfm = (id, name, kind, routes, cost, note) => {
  const list = Object.values(routes).filter(eid => HFS[eid]);
  const { roles, needs } = hfRoles(kind, list);
  const m = { id, engine: 'higgsfield', kind, name, cost, ...(kind === 'video' ? { per: 's' } : {}), note, roles, needs, settings: hfSettings(kind, list), routes };
  m.hf = j => hfBody(m, hfRoute(m, { start: j.m.start.length, end: j.m.end.length, reference: j.m.reference.length, video: j.m.video.length }), j);
  return m;
};
const HFV = (prefix, extra = {}) => ({ text: `${prefix}/text-to-video`, image: `${prefix}/image-to-video`, reference: `${prefix}/reference-to-video`, ...extra });
const OLD = ' Ya no figura en la documentación de Higgsfield (25 sep 2026): puede no responder.';
const HF_IMAGES = [
  hfm('soul-2', 'Soul 2', 'image', { text: 'higgsfield-ai/soul/v2/standard' }, 0.03, 'Fotos con estética de moda y redes, la firma de Higgsfield.'),
  hfm('soul', 'Soul', 'image', { text: 'higgsfield-ai/soul/standard' }, 0.03, 'El Soul original; acepta una imagen de referencia. Precio aproximado.'),
  hfm('soul-cinema', 'Soul Cinema', 'image', { text: 'higgsfield-ai/soul/cinema' }, 0.05, 'Fotogramas de cine: luz y encuadre de película.'),
  hfm('marketing-studio', 'Marketing Studio', 'image', { text: 'marketing-studio/image' }, 0.05, 'Piezas de marketing con tu producto: hasta 16 referencias. Precio aproximado.'),
  hfm('marketing-studio-flare', 'Marketing Studio 2.5 Flare', 'image', { text: 'marketing-studio/image/flare' }, 0.06, 'Marketing Studio 2.5, estilo Flare. Precio aproximado.'),
  hfm('marketing-studio-sunburst', 'Marketing Studio 2.5 Sunburst', 'image', { text: 'marketing-studio/image/sunburst' }, 0.06, 'Marketing Studio 2.5, estilo Sunburst. Precio aproximado.'),
  hfm('ideogram-4', 'Ideogram 4', 'image', { text: 'ideogram/v4.0' }, 0.06, 'El mejor para TEXTO legible dentro de la imagen (carteles, posts con título); con una referencia, la rehace.'),
  hfm('recraft-4.1', 'Recraft 4.1', 'image', { text: 'recraft/v4.1/text-to-image' }, 0.04, 'Diseño gráfico, ilustración y vector.'),
  hfm('recraft-4.1-pro', 'Recraft 4.1 Pro', 'image', { text: 'recraft/v4.1/pro/text-to-image' }, 0.08, 'Recraft en 2K. Precio aproximado.'),
  hfm('recraft-4.1-utility', 'Recraft 4.1 Utility', 'image', { text: 'recraft/v4.1/utility/text-to-image' }, 0.04, 'Recraft para piezas de uso: iconos, fondos, recursos. Precio aproximado.'),
  hfm('recraft-4.1-utility-pro', 'Recraft 4.1 Utility Pro', 'image', { text: 'recraft/v4.1/utility/pro/text-to-image' }, 0.08, 'Utility en 2K. Precio aproximado.'),
  hfm('grok-imagine-2', 'Grok Imagine 2', 'image', { text: 'xai/grok-imagine-image-2.0' }, 0.04, 'Crea o edita con hasta 10 referencias.'),
  hfm('qwen-image-3', 'Qwen Image 3', 'image', { text: 'alibaba/qwen-image-3/text-to-image', reference: 'alibaba/qwen-image-3/edit' }, 0.03, 'Con referencias, edita tus imágenes (hasta 3).'),
  hfm('z-image-turbo', 'Z-Image Turbo', 'image', { text: 'z-image/turbo' }, 0.01, 'Rapidísimo y barato: para bocetos y lotes grandes.'),
  { ...hfImage('flux-2', 'Flux 2 Pro', 'flux-2-pro', 0.05, 'Realismo y detalle.' + OLD), legacy: true },
];
const HF_VIDEOS = [
  hfm('kling-3-std', 'Kling 3.0', 'video', { text: 'kling-video/v3.0/std/text-to-video', image: 'kling-video/v3.0/std/image-to-video' }, 0.08, 'El equilibrio: buena calidad, sonido, imagen inicial y final.'),
  hfm('kling-3-pro', 'Kling 3.0 Pro', 'video', { text: 'kling-video/v3.0/pro/text-to-video', image: 'kling-video/v3.0/pro/image-to-video' }, 0.11),
  hfm('kling-3-4k', 'Kling 3.0 4K', 'video', { text: 'kling-video/v3.0/4k/text-to-video', image: 'kling-video/v3.0/4k/image-to-video' }, 0.2),
  hfm('kling-3-turbo', 'Kling 3.0 Turbo', 'video', { text: 'kling-video/v3.0-turbo/text-to-video', image: 'kling-video/v3.0-turbo/image-to-video' }, 0.06, 'El más rápido de Kling 3.'),
  hfm('kling-3-motion', 'Kling 3 · Copiar movimiento', 'video', { image: 'kling-video/v3/motion-control/std' }, 0.1, 'Tu personaje (imagen) hace el movimiento de un video.'),
  hfm('kling-3-motion-pro', 'Kling 3 Pro · Copiar movimiento', 'video', { image: 'kling-video/v3/motion-control/pro' }, 0.15, 'Como Copiar movimiento, con más calidad. Precio aproximado.'),
  hfm('kling-2.6-motion', 'Kling 2.6 · Copiar movimiento', 'video', { image: 'kling-video/motion-control/std' }, 0.07, 'La versión 2.6 de Copiar movimiento. Precio aproximado.'),
  hfm('kling-2.6-motion-pro', 'Kling 2.6 Pro · Copiar movimiento', 'video', { image: 'kling-video/motion-control/pro' }, 0.1, 'Precio aproximado.'),
  hfm('kling-o3', 'Kling O3', 'video', { firstLast: 'kling-video/o3/first-last-frame', reference: 'kling-video/o3/image-reference', videoRef: 'kling-video/o3/video-reference' }, 0.1, 'Une un primer y un último fotograma, o sigue tus referencias o un video.'),
  hfm('kling-o3-edit', 'Kling O3 · Editar video', 'video', { edit: 'kling-video/o3/video-edit' }, 0.1, 'Cambia un video con una frase (y hasta 4 referencias). Precio aproximado.'),
  hfm('kling-o1', 'Kling O1 (Omni)', 'video', { firstLast: 'kling-video/omni/first-last-frame', reference: 'kling-video/omni/image-reference', videoRef: 'kling-video/omni/video-reference' }, 0.1, 'Kling Omni: fotogramas, referencias o un video de guía. Precio aproximado.'),
  hfm('kling-o1-edit', 'Kling O1 · Editar video', 'video', { edit: 'kling-video/omni/video-edit' }, 0.1, 'Precio aproximado.'),
  hfm('kling-2.6', 'Kling 2.6 Pro', 'video', { text: 'kling-video/v2.6/pro/text-to-video', image: 'kling-video/v2.6/pro/image-to-video' }, 0.07),
  hfm('kling-2.5', 'Kling 2.5 Turbo · Anima una foto', 'video', { image: 'kling-video/v2.5-turbo/standard/image-to-video' }, 0.05, 'Barato y rápido para animar una imagen. Precio aproximado.'),
  hfm('kling-2.5-pro', 'Kling 2.5 Turbo Pro', 'video', { text: 'kling-video/v2.5-turbo/pro/text-to-video', image: 'kling-video/v2.5-turbo/pro/image-to-video' }, 0.07, 'Precio aproximado.'),
  hfm('seedance-2', 'Seedance 2.0', 'video', HFV('bytedance/seedance-2.0'), 0.1, 'Hasta 9 referencias (personaje, producto, estilo) y audio.'),
  hfm('seedance-2.5', 'Seedance 2.5', 'video', HFV('bytedance/seedance-2.5'), 0.1, 'Hasta 30 s, audio, muchas referencias.'),
  hfm('seedance-2.5-edit', 'Seedance 2.5 · Editar video', 'video', { edit: 'bytedance/seedance-2.5/video-edit' }, 0.1, 'Cambia un video existente con una frase.'),
  hfm('seedance-2.5-extend', 'Seedance 2.5 · Alargar video', 'video', { edit: 'bytedance/seedance-2.5/video-extend' }, 0.1, 'Continúa un video existente.'),
  hfm('cinema-studio-4', 'Cinema Studio 4.0', 'video', { reference: 'higgsfield/cinema-studio/4.0' }, 0.12, 'Dirección de cine: género, época, luz, lente, cámara, movimiento y paleta. Precio aproximado.'),
  hfm('genjutsu-motion', 'Genjutsu · Transferir movimiento', 'video', { edit: 'higgsfield/genjutsu/motion-transfer/v1.0' }, 0.1, 'Pasa el movimiento de un video a tus personajes (imágenes). Precio aproximado.'),
  hfm('genjutsu-swap', 'Genjutsu · Cambiar un objeto', 'video', { edit: 'higgsfield/genjutsu/object-swap/v1.0' }, 0.1, 'Reemplaza un objeto del video por el de tus imágenes. Precio aproximado.'),
  hfm('minimax-hailuo-2.3', 'MiniMax Hailuo 2.3', 'video', { text: 'minimax/hailuo-2.3/standard/text-to-video', image: 'minimax/hailuo-2.3/standard/image-to-video' }, 0.045, 'Videos de 6 o 10 s.'),
  hfm('minimax-h3', 'MiniMax H3', 'video', HFV('minimax/h3'), 0.06, 'En 2K; texto, una imagen inicial o referencias. Precio aproximado.'),
  hfm('wan-2.6', 'Wan 2.6', 'video', HFV('wan/v2.6'), 0.04, 'Económico; con un video de referencia también. Precio aproximado.'),
  hfm('wan-2.7', 'Wan 2.7', 'video', HFV('wan/v2.7'), 0.045, 'Texto, imagen o referencias. Precio aproximado.'),
  hfm('wan-3', 'Wan 3.0', 'video', HFV('alibaba/wan-3.0'), 0.05, 'Hasta 30 s, audio, referencias.'),
  hfm('wan-3-prime', 'Wan 3.0 Prime', 'video', HFV('alibaba/wan-3.0-prime'), 0.07, 'La versión alta de Wan 3. Precio aproximado.'),
  hfm('ltx-2.5-pro', 'LTX 2.5 Pro', 'video', { text: 'lightricks/ltx-2.5/text-to-video/pro', image: 'lightricks/ltx-2.5/image-to-video/pro' }, 0.06, 'Con movimientos de cámara; 6, 8 o 10 s, vertical u horizontal.'),
  hfm('ltx-2.5-fast', 'LTX 2.5 Fast', 'video', { text: 'lightricks/ltx-2.5/text-to-video/fast', image: 'lightricks/ltx-2.5/image-to-video/fast' }, 0.03, 'Rápido y barato; hasta 4K. Precio aproximado.'),
  hfm('pixverse-6', 'PixVerse 6', 'video', { text: 'pixverse/v6/text-to-video', image: 'pixverse/v6/image-to-video' }, 0.05),
  hfm('happy-horse-1', 'Happy Horse 1.0', 'video', HFV('alibaba/happy-horse'), 0.04, 'De Alibaba; texto, imagen o referencias. Precio aproximado.'),
  hfm('happy-horse-1.1', 'Happy Horse 1.1', 'video', HFV('alibaba/happy-horse/v1.1'), 0.045, 'La versión nueva de Happy Horse. Precio aproximado.'),
  hfm('grok-imagine-video', 'Grok Imagine Video 1.5', 'video', { reference: 'xai/grok-imagine-video/v1.5/reference-to-video' }, 0.05),
  { id: 'seedance-2-fast', engine: 'higgsfield', kind: 'video', name: 'Seedance 2.0 Fast', cost: 0.06, per: 's', note: OLD.trim(), legacy: true, roles: { start: 1, end: 1, reference: 9, video: 3 }, settings: seedanceSet(['480p', '720p']), hf: HF.seedance('bytedance/seedance-2.0/fast') },
  { id: 'seedance-2-mini', engine: 'higgsfield', kind: 'video', name: 'Seedance 2.0 Mini', cost: 0.04, per: 's', note: OLD.trim(), legacy: true, roles: { start: 1, end: 1, reference: 9, video: 3 }, settings: seedanceSet(['480p', '720p']), hf: HF.seedance('bytedance/seedance-2.0/mini') },
  { ...hfVideo('flux-3', 'Flux 3 (video)', { start: 1 }, t2v('blackforestlabs/flux-3/text-to-video'), 0.06, 'El video de Black Forest Labs.' + OLD), legacy: true },
  { ...hfVideo('dop', 'DoP · Anima una foto', { start: 1 }, { image: 'higgsfield-ai/dop/lite' }, 0.05, 'Movimientos de cámara sobre una foto tuya.' + OLD), needs: ['start'], legacy: true },
];

const CATALOG = [
  // ---- images
  ...HF_IMAGES,
  { id: 'nano-banana', engine: 'gemini', kind: 'image', name: 'Nano Banana (2.5)', cost: 0.039, note: 'Edita y mezcla fotos: dale hasta 3 referencias (tu producto, tu logo, un estilo).', roles: { reference: 3 }, settings: { aspectRatio: E(['1:1', '4:5', '3:4', '9:16', '16:9', '4:3', '3:2', '2:3', '21:9'], '1:1') } },
  // V4.4 (27 Sep 2026): Google's current image models on the same GEMINI_API_KEY (ids from Google's own cookbook, google-gemini/cookbook,
  // Sep 2026). Imagen was shut down on 17 Aug 2026, so it is not here. Prices are estimates: the note says so.
  { id: 'nano-banana-2', engine: 'gemini', kind: 'image', gid: 'gemini-3.1-flash-image', name: 'Nano Banana 2', cost: 0.067, note: 'El todoterreno de Google: hasta 14 referencias, formatos muy anchos o altos, hasta 4K. Precio aproximado.', roles: { reference: 14 }, settings: { aspectRatio: E(['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '4:3', '3:2', '5:4', '21:9', '1:4', '4:1', '1:8', '8:1'], '1:1'), imageSize: E(['1K', '2K', '4K'], '1K') } },
  { id: 'nano-banana-2-lite', engine: 'gemini', kind: 'image', gid: 'gemini-3.1-flash-lite-image', name: 'Nano Banana 2 Lite', cost: 0.02, note: 'El más rápido y barato de Google (tiene capa gratuita): para probar ideas y lotes. Hasta 3 referencias. Precio aproximado.', roles: { reference: 3 }, settings: { aspectRatio: E(['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '4:3', '3:2', '5:4', '21:9'], '1:1') } },
  { id: 'nano-banana-pro', engine: 'gemini', kind: 'image', gid: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', cost: 0.134, note: 'El tope de Google: piensa la composición, texto legible, personajes coherentes con hasta 14 referencias, hasta 4K. Precio aproximado.', roles: { reference: 14 }, settings: { aspectRatio: E(['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '4:3', '3:2', '5:4', '21:9'], '1:1'), imageSize: E(['1K', '2K', '4K'], '1K') } },
  { id: 'gpt-image-1', engine: 'openai', kind: 'image', name: 'GPT Image', cost: 0.042, note: 'Sigue instrucciones largas y escribe texto; edita con referencias.', roles: { reference: 4 }, settings: { aspectRatio: E(['1:1', '3:2', '2:3'], '1:1'), quality: E(['low', 'medium', 'high'], 'medium') } },
  // V4.8 (30 Sep 2026): Meta Muse Image — OpenAI-compatible images API at api.meta.ai/v1; it searches the web for real references
  // (brands, places, today's data) on its own, included in the price. quality → reasoning_strength (high refines in several passes).
  { id: 'muse-image', engine: 'meta', kind: 'image', name: 'Muse Image', cost: 0.01, note: 'De Meta: genera y edita, y busca por su cuenta referencias reales (marcas, lugares, datos actuales) antes de dibujar. Texto legible e infografías. Muy barato.', roles: { reference: 10 }, settings: { aspectRatio: E(IMG_ASPECT, '1:1'), quality: E(['high', 'low'], 'high'), outputFormat: E(['webp', 'png', 'jpeg'], 'webp') } },
  { id: 'grok-image', engine: 'grok', kind: 'image', name: 'Grok Image', cost: 0.07, roles: {}, settings: {} },
  falImg('nano-banana-fal', 'Nano Banana (fal)', 0.039, 'fal-ai/nano-banana', 'fal-ai/nano-banana/edit', 3, 'Nano Banana a través de tu key de fal.ai.', s => ({ aspect_ratio: s.aspectRatio })),
  falImg('seedream-4', 'Seedream 4', 0.03, 'fal-ai/bytedance/seedream/v4/text-to-image', 'fal-ai/bytedance/seedream/v4/edit', 4, 'ByteDance: alta resolución, edita con referencias.', s => ({ image_size: FAL_SIZE[s.aspectRatio] || 'square_hd' })),
  falImg('flux-kontext', 'Flux Kontext', 0.04, 'fal-ai/flux-pro/kontext/text-to-image', 'fal-ai/flux-pro/kontext', 1, 'Cambia una imagen con una frase («ponle fondo de playa»).', s => ({ aspect_ratio: s.aspectRatio })),
  falImg('flux-schnell', 'Flux Schnell', 0.003, 'fal-ai/flux/schnell', null, 0, 'El más barato: para probar ideas en lote.', s => ({ image_size: FAL_SIZE[s.aspectRatio] || 'square_hd' })),
  falImg('ideogram-3-fal', 'Ideogram 3 (fal)', 0.06, 'fal-ai/ideogram/v3', null, 0, 'Texto legible dentro de la imagen.', s => ({ image_size: FAL_SIZE[s.aspectRatio] || 'square_hd' })),
  // V4.2: an image takes references only — no real image model has a first or last frame; the free test card used to ask for them and looked like a video form
  { id: 'prueba', engine: 'prueba', kind: 'image', name: 'Prueba (gratis)', cost: 0, note: 'Una tarjeta con tu prompt, no una imagen real: prueba el Estudio sin gastar.', roles: { reference: 8 }, settings: { aspectRatio: E(IMG_ASPECT, '1:1') } },
  // ---- video
  // V4.4 (27 Sep 2026): Google Veo 3.1 on GEMINI_API_KEY — needs a paid (billing) AI Studio project; sound comes with the video.
  { id: 'veo-3.1', engine: 'gemini', kind: 'video', gid: 'veo-3.1-generate-preview', name: 'Veo 3.1', cost: 0.4, per: 's', note: 'El video de Google, con sonido y diálogo: imagen inicial y final, o hasta 3 referencias (con referencias sale a 720p horizontal). Precio aproximado.', roles: { start: 1, end: 1, reference: 3 }, settings: { aspectRatio: E(['16:9', '9:16'], '16:9'), resolution: E(['720p', '1080p'], '720p'), duration: E(['4', '6', '8'], '8') } },
  { id: 'veo-3.1-fast', engine: 'gemini', kind: 'video', gid: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast', cost: 0.15, per: 's', note: 'Veo más rápido y barato, con sonido; imagen inicial y final. Precio aproximado.', roles: { start: 1, end: 1 }, settings: { aspectRatio: E(['16:9', '9:16'], '16:9'), resolution: E(['720p', '1080p'], '720p'), duration: E(['4', '6', '8'], '8') } },
  { id: 'veo-3.1-lite', engine: 'gemini', kind: 'video', gid: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite', cost: 0.05, per: 's', note: 'El Veo más económico: para anuncios en lote y pruebas. Precio aproximado.', roles: { start: 1 }, settings: { aspectRatio: E(['16:9', '9:16'], '16:9'), resolution: E(['720p', '1080p'], '720p'), duration: E(['4', '6', '8'], '8') } },
  ...HF_VIDEOS,
  { id: 'kling-2.5-fal', engine: 'fal', kind: 'video', name: 'Kling 2.5 Turbo (fal)', cost: 0.07, per: 's', roles: { start: 1, end: 1 }, settings: { aspectRatio: E(VID_ASPECT, '16:9'), duration: E(['5', '10'], '5') },
    fal: j => j.m.start[0] ? { path: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', body: { prompt: j.prompt, image_url: j.m.start[0], ...(j.m.end[0] ? { tail_image_url: j.m.end[0] } : {}), duration: j.s.duration } } : { path: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', body: { prompt: j.prompt, duration: j.s.duration, aspect_ratio: j.s.aspectRatio } } },
  { id: 'seedance-1-fal', engine: 'fal', kind: 'video', name: 'Seedance 1 Pro (fal)', cost: 0.12, per: 's', roles: { start: 1, end: 1 }, settings: { aspectRatio: E(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], '16:9'), resolution: E(['480p', '720p', '1080p'], '1080p'), duration: E(['5', '10'], '5') },
    fal: j => j.m.start[0] ? { path: 'fal-ai/bytedance/seedance/v1/pro/image-to-video', body: { prompt: j.prompt, image_url: j.m.start[0], ...(j.m.end[0] ? { end_image_url: j.m.end[0] } : {}), resolution: j.s.resolution, duration: j.s.duration } } : { path: 'fal-ai/bytedance/seedance/v1/pro/text-to-video', body: { prompt: j.prompt, aspect_ratio: j.s.aspectRatio, resolution: j.s.resolution, duration: j.s.duration } } },
  { id: 'hailuo-02-fal', engine: 'fal', kind: 'video', name: 'MiniMax Hailuo 02 (fal)', cost: 0.045, per: 's', roles: { start: 1, end: 1 }, settings: { duration: E(['6', '10'], '6') },
    fal: j => j.m.start[0] ? { path: 'fal-ai/minimax/hailuo-02/standard/image-to-video', body: { prompt: j.prompt, image_url: j.m.start[0], ...(j.m.end[0] ? { end_image_url: j.m.end[0] } : {}), duration: j.s.duration } } : { path: 'fal-ai/minimax/hailuo-02/standard/text-to-video', body: { prompt: j.prompt, duration: j.s.duration } } },
  { id: 'veo-3-fast-fal', engine: 'fal', kind: 'video', name: 'Veo 3 Fast (fal)', cost: 0.4, per: 's', seconds: 8, note: 'Google Veo con voz y sonido. Caro: 8 s ≈ US$3.', roles: { start: 1 }, settings: { aspectRatio: E(['16:9', '9:16'], '16:9'), generateAudio: B(true) },
    fal: j => j.m.start[0] ? { path: 'fal-ai/veo3/fast/image-to-video', body: { prompt: j.prompt, image_url: j.m.start[0], duration: '8s', generate_audio: j.s.generateAudio } } : { path: 'fal-ai/veo3/fast', body: { prompt: j.prompt, aspect_ratio: j.s.aspectRatio, duration: '8s', generate_audio: j.s.generateAudio } } },
  { id: 'prueba-video', engine: 'prueba', kind: 'video', name: 'Prueba de video (gratis)', cost: 0, note: 'Una tarjeta en lugar del video: prueba el flujo (Animar, fotogramas) sin gastar.', roles: { start: 1, end: 1, reference: 8, video: 1 }, settings: { aspectRatio: E(VID_ASPECT, '16:9'), duration: R(3, 15, 5) } },
];
const PREFER = { image: ['nano-banana-2', 'nano-banana', 'muse-image', 'soul-2', 'nano-banana-fal', 'gpt-image-1', 'seedream-4', 'z-image-turbo', 'flux-schnell', 'grok-image'], video: ['kling-3-std', 'veo-3.1-fast', 'kling-3-turbo', 'seedance-2', 'kling-2.5-fal', 'seedance-1-fal', 'hailuo-02-fal'] };

/* V4.4 (27 Sep 2026): what the model picker sorts and filters by — who makes it, its quality tier (1 básica · 2 buena ·
   3 alta · 4 la mejor), how fast it answers, and what it is good for. A model not listed here gets its engine as maker and
   tier 2. The tiers are the office's own reading of each model's place in its family, not a benchmark. */
const G = 'Google', HFM = 'Higgsfield', K = 'Kling (Kuaishou)', BD = 'ByteDance', AL = 'Alibaba', BFL = 'Black Forest Labs';
const INFO = {
  'nano-banana': [G, 3, 'rápido', ['editar fotos', 'mezclar referencias', 'producto']],
  'nano-banana-2': [G, 3, 'rápido', ['todo uso', 'editar fotos', 'hasta 14 referencias', 'formatos extremos', '4K']],
  'nano-banana-2-lite': [G, 2, 'muy rápido', ['bocetos', 'lotes', 'capa gratuita']],
  'nano-banana-pro': [G, 4, 'normal', ['texto legible', 'personajes coherentes', 'composición compleja', '4K']],
  'nano-banana-fal': [G, 3, 'rápido', ['editar fotos', 'mezclar referencias']],
  'veo-3.1': [G, 4, 'lento', ['con sonido y diálogo', 'cine', 'referencias', 'primer y último fotograma']],
  'veo-3.1-fast': [G, 3, 'normal', ['con sonido', 'anuncios', 'redes']],
  'veo-3.1-lite': [G, 2, 'rápido', ['lotes de anuncios', 'pruebas', 'barato']],
  'veo-3-fast-fal': [G, 3, 'normal', ['con sonido', 'anuncios']],
  'gpt-image-1': ['OpenAI', 3, 'lento', ['instrucciones largas', 'texto en imagen', 'editar fotos']],
  'muse-image': ['Meta', 3, 'normal', ['busca referencias reales', 'texto en imagen', 'infografías', 'editar y componer', 'barato']],
  'grok-image': ['xAI', 2, 'rápido', ['ideas rápidas']],
  'grok-imagine-2': ['xAI', 3, 'rápido', ['editar fotos', 'hasta 10 referencias']],
  'grok-imagine-video': ['xAI', 3, 'normal', ['referencias', 'redes']],
  'soul': [HFM, 3, 'normal', ['moda', 'redes', 'retrato']],
  'soul-2': [HFM, 3, 'normal', ['moda', 'redes', 'retrato']],
  'soul-cinema': [HFM, 3, 'normal', ['cine', 'fotogramas', 'retrato']],
  'marketing-studio': [HFM, 3, 'normal', ['producto', 'publicidad', 'hasta 16 referencias']],
  'marketing-studio-flare': [HFM, 4, 'normal', ['producto', 'publicidad']],
  'marketing-studio-sunburst': [HFM, 4, 'normal', ['producto', 'publicidad']],
  'cinema-studio-4': [HFM, 4, 'lento', ['cine', 'dirección de cámara', 'con sonido', 'hasta 30 s']],
  'genjutsu-motion': [HFM, 3, 'normal', ['copiar movimiento', 'personajes']],
  'genjutsu-swap': [HFM, 3, 'normal', ['cambiar un objeto', 'editar video']],
  'dop': [HFM, 2, 'normal', ['animar una foto']],
  'ideogram-4': ['Ideogram', 4, 'normal', ['texto legible', 'carteles', 'posts con título']],
  'ideogram-3-fal': ['Ideogram', 3, 'normal', ['texto legible', 'carteles']],
  'recraft-4.1': ['Recraft', 3, 'normal', ['diseño gráfico', 'ilustración', 'vector']],
  'recraft-4.1-pro': ['Recraft', 4, 'normal', ['diseño gráfico', '2K']],
  'recraft-4.1-utility': ['Recraft', 2, 'rápido', ['iconos', 'fondos', 'recursos']],
  'recraft-4.1-utility-pro': ['Recraft', 3, 'normal', ['iconos', 'recursos', '2K']],
  'qwen-image-3': [AL, 3, 'normal', ['texto en imagen', 'editar fotos']],
  'z-image-turbo': [AL, 2, 'muy rápido', ['bocetos', 'lotes', 'barato']],
  'wan-2.6': [AL, 2, 'normal', ['barato', 'video de referencia']],
  'wan-2.7': [AL, 3, 'normal', ['referencias', 'imagen inicial y final']],
  'wan-3': [AL, 3, 'normal', ['hasta 30 s', 'con audio', 'referencias']],
  'wan-3-prime': [AL, 4, 'lento', ['hasta 30 s', 'con audio', 'referencias']],
  'happy-horse-1': [AL, 2, 'normal', ['barato', 'referencias']],
  'happy-horse-1.1': [AL, 3, 'normal', ['referencias', '1080p']],
  'seedream-4': [BD, 3, 'normal', ['alta resolución', 'editar fotos']],
  'seedance-2': [BD, 3, 'normal', ['referencias', 'con audio', 'personajes']],
  'seedance-2.5': [BD, 4, 'lento', ['hasta 30 s', 'con audio', 'muchas referencias']],
  'seedance-2.5-edit': [BD, 4, 'lento', ['editar video']],
  'seedance-2.5-extend': [BD, 4, 'lento', ['alargar video']],
  'seedance-2-fast': [BD, 2, 'rápido', ['referencias']],
  'seedance-2-mini': [BD, 2, 'rápido', ['barato']],
  'seedance-1-fal': [BD, 2, 'normal', ['animar una foto']],
  'kling-3-std': [K, 3, 'normal', ['con sonido', 'imagen inicial y final', 'todo uso']],
  'kling-3-pro': [K, 4, 'lento', ['con sonido', 'calidad alta']],
  'kling-3-4k': [K, 4, 'lento', ['4K', 'con sonido']],
  'kling-3-turbo': [K, 2, 'rápido', ['rápido', 'redes']],
  'kling-3-motion': [K, 3, 'normal', ['copiar movimiento', 'bailes', 'personajes']],
  'kling-3-motion-pro': [K, 4, 'normal', ['copiar movimiento', 'calidad alta']],
  'kling-2.6-motion': [K, 2, 'normal', ['copiar movimiento']],
  'kling-2.6-motion-pro': [K, 3, 'normal', ['copiar movimiento']],
  'kling-o3': [K, 4, 'lento', ['primer y último fotograma', 'referencias', 'video de guía']],
  'kling-o3-edit': [K, 4, 'lento', ['editar video']],
  'kling-o1': [K, 3, 'normal', ['primer y último fotograma', 'referencias', 'video de guía']],
  'kling-o1-edit': [K, 3, 'normal', ['editar video']],
  'kling-2.6': [K, 3, 'normal', ['con sonido']],
  'kling-2.5': [K, 2, 'rápido', ['animar una foto', 'barato']],
  'kling-2.5-pro': [K, 3, 'normal', ['texto o foto']],
  'kling-2.5-fal': [K, 2, 'rápido', ['animar una foto']],
  'minimax-hailuo-2.3': ['MiniMax', 3, 'normal', ['movimiento natural', '6 o 10 s']],
  'minimax-h3': ['MiniMax', 4, 'lento', ['2K', 'referencias']],
  'hailuo-02-fal': ['MiniMax', 2, 'normal', ['animar una foto']],
  'ltx-2.5-pro': ['Lightricks', 3, 'normal', ['movimientos de cámara', 'con audio']],
  'ltx-2.5-fast': ['Lightricks', 2, 'rápido', ['hasta 4K', 'barato']],
  'pixverse-6': ['PixVerse', 3, 'rápido', ['redes', 'con audio']],
  'flux-2': [BFL, 3, 'normal', ['realismo', 'detalle']],
  'flux-3': [BFL, 3, 'normal', ['video']],
  'flux-kontext': [BFL, 3, 'normal', ['editar con una frase']],
  'flux-schnell': [BFL, 1, 'muy rápido', ['bocetos', 'lotes', 'el más barato']],
  'prueba': ['Prueba (gratis)', 1, 'muy rápido', ['probar el flujo sin gastar']],
  'prueba-video': ['Prueba (gratis)', 1, 'muy rápido', ['probar el flujo sin gastar']],
};
export const TIER_NAME = { 1: 'básica', 2: 'buena', 3: 'alta', 4: 'la mejor' };
const infoOf = x => { const i = INFO[x.id]; return i ? { maker: i[0], tier: i[1], speed: i[2], uses: i[3] } : { maker: x.engine === 'higgsfield' ? HFM : ENGINES[x.engine]?.name || x.engine, tier: 2, speed: 'normal', uses: [] }; };

let cfg = { dailyLimit: 40, maxPerRequest: 8, models: {} }, root = '', usageFile = '', jobsFile = '', MODELS = CATALOG, hooks = {};
export function configure(officeCfg, brainPath, dataDir, h = {}) {
  const m = officeCfg.media || {};
  cfg = { dailyLimit: 40, maxPerRequest: 8, concurrency: 3, ...m, models: { ...DEFAULT_MODELS, ...(m.models || {}) } };
  root = path.join(brainPath, 'Agents Office', 'media');
  usageFile = path.join(dataDir, 'media-usage.json');
  jobsFile = path.join(dataDir, 'media-jobs.json');
  hooks = h;
  // your own models: office.config.json → media.custom: [{ "id", "name", "engine": "fal"|"higgsfield", "kind": "image"|"video", "path", "cost" }]
  const custom = (Array.isArray(m.custom) ? m.custom : []).filter(c => c && /^[a-z0-9][a-z0-9._-]*$/i.test(c.id || '') && /^[a-z0-9][a-z0-9._/-]*$/i.test(c.path || '') && !c.path.includes('..') && ['fal', 'higgsfield'].includes(c.engine) && ['image', 'video'].includes(c.kind))
    .map(c => ({ id: c.id, engine: c.engine, kind: c.kind, name: String(c.name || c.id).slice(0, 60), cost: +c.cost || 0, per: c.kind === 'video' ? 's' : undefined, note: 'Modelo tuyo (office.config.json → media.custom).', roles: c.kind === 'image' ? { reference: 4 } : { start: 1 },
      settings: c.kind === 'image' ? { aspectRatio: E(IMG_ASPECT, '1:1') } : { aspectRatio: E(VID_ASPECT, '16:9'), duration: R(4, 10, 5) },
      ...(c.engine === 'higgsfield' ? { hf: HF.paths(c.kind === 'image' ? { text: c.path } : t2v(c.path)) } : { fal: j => ({ path: c.path, body: { prompt: j.prompt, ...(c.kind === 'image' ? { num_images: j.n, image_size: FAL_SIZE[j.s.aspectRatio] || 'square_hd', ...(j.m.reference.length ? { image_urls: j.m.reference } : {}) } : { aspect_ratio: j.s.aspectRatio, duration: String(j.s.duration), ...(j.m.start[0] ? { image_url: j.m.start[0] } : {}) }) } }) }) }));
  MODELS = [...CATALOG.filter(x => !custom.some(c => c.id === x.id)), ...custom];
  loadJobs();
}
export const dir = () => root;
export function setHooks(h = {}) { hooks = { ...hooks, ...h }; }
export const model = id => MODELS.find(x => x.id === id) || null;
/** The catalog as the page and the agents see it (no functions), each model marked on/off by its engine's key. */
export function models() {
  return MODELS.map(x => ({ id: x.id, engine: x.engine, engineName: ENGINES[x.engine].name, kind: x.kind, name: x.name, note: x.note || '', cost: x.cost, per: x.per || 'item', seconds: x.seconds || null, roles: x.roles || {}, needs: x.needs || [], settings: x.settings || {}, on: engineOn(x.engine), ...(x.legacy ? { legacy: true } : {}), ...infoOf(x) }));
}
export function engines() {
  return Object.entries(ENGINES).map(([id, e]) => ({ id, name: e.name, on: engineOn(id), env: e.env, site: e.site || null, how: e.how || (e.env ? `setx ${e.env} "tu-key"` : null), models: MODELS.filter(x => x.engine === id).length }));
}
/** Old shape (V1 of the Estudio): the engines as «providers». */
export function providers() { return engines().map(e => ({ ...e, model: e.id === 'prueba' ? 'local' : (MODELS.find(x => x.engine === e.id && x.kind === 'image') || {}).id || null, cost: (MODELS.find(x => x.engine === e.id) || {}).cost || 0 })); }
export function defaultModel(kind = 'image', engine) {
  const want = cfg.default && cfg.default[kind]; const m0 = want && model(want);
  if (m0 && m0.kind === kind && engineOn(m0.engine) && (!engine || m0.engine === engine)) return m0.id;
  const on = MODELS.filter(x => x.kind === kind && engineOn(x.engine) && x.engine !== 'prueba' && (!engine || x.engine === engine));
  const pick = PREFER[kind].map(model).find(x => x && on.includes(x)) || on[0];
  return pick ? pick.id : engine && engine !== 'prueba' ? (MODELS.find(x => x.kind === kind && x.engine === engine) || {}).id || null : kind === 'video' ? 'prueba-video' : 'prueba';
}
export const defaultProvider = () => { const m = model(defaultModel('image')); return m ? m.engine : 'prueba'; };
/** Settings as the model wants them: defaults filled in, enums checked, ranges clamped. */
function settingsFor(m, given = {}, legacy = {}) {
  const s = {};
  for (const [k, f] of Object.entries(m.settings || {})) {
    let v = given[k] ?? (k === 'aspectRatio' ? legacy.ratio : k === 'duration' ? legacy.seconds : undefined);
    if (f.type === 'enum') { v = v == null ? f.default : String(v); if (!f.values.includes(v)) v = f.default; }
    else if (f.type === 'range') { v = Number(v); if (!Number.isFinite(v)) v = f.default; v = Math.min(f.max, Math.max(f.min, v)); if (!f.step || f.step >= 1) v = Math.round(v); }
    else if (f.type === 'boolean') v = typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : f.default;
    s[k] = v;
  }
  return s;
}
function unitCost(m, s) { return m.per === 's' ? +(m.cost * (m.seconds || Number(s.duration) || 5)).toFixed(3) : m.cost; }
export function estimate({ model: id, n = 1, settings = {} } = {}) { const m = model(id); if (!m) return 0; return +(unitCost(m, settingsFor(m, settings)) * Math.max(1, +n || 1) * (m.hf && m.settings.batchSize ? Number(settingsFor(m, settings).batchSize) : 1)).toFixed(3); }

/* ---------- budget: a count per day and the money spent a day and a month, kept in data/ (a video weighs 5 images) ---------- */
// V4.5: the owner's day, not UTC's (in Panamá the «day» used to turn at 7 in the evening)
const localDay = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const today = () => localDay();
const weightOf = (kind, n) => (kind === 'video' ? 5 : 1) * n;
function usage() {
  let u = null; try { u = JSON.parse(fs.readFileSync(usageFile, 'utf8')); } catch {}
  const day = today(), month = day.slice(0, 7);
  const monthCost = u && (u.month || String(u.day || '').slice(0, 7)) === month ? +(u.monthCost ?? u.cost ?? 0) : 0; // a file from before V4.5 has no month: today's spend starts it
  return u && u.day === day ? { ...u, month, monthCost } : { day, images: 0, videos: 0, cost: 0, month, monthCost };
}
function spend(kind, n, cost) { const u = usage(); u[kind] += n; u.cost = +(u.cost + cost).toFixed(3); u.monthCost = +(u.monthCost + cost).toFixed(3); fs.mkdirSync(path.dirname(usageFile), { recursive: true }); fs.writeFileSync(usageFile, JSON.stringify(u)); return u; }
const cap = v => (Number.isFinite(+v) && +v > 0 ? +v : 0); // 0, empty or nonsense = no cap
/** What is left today and this month. left / costLeftDay / costLeftMonth are null when that cap is off. */
export function budget() {
  const u = usage(), active = JOBS.filter(j => (j.state === 'queued' || j.state === 'running') && j.engine !== 'prueba');
  const reserved = active.reduce((s, j) => s + Math.max(0, j.weight - weightOf(j.kind, j.items.length)), 0);
  const costReserved = +active.reduce((s, j) => s + (+j.unit || 0) * (+j.n || 1), 0).toFixed(3); // a running job is paid when it ends: until then its estimate is held
  const limit = cap(cfg.dailyLimit), used = u.images + u.videos * 5, dailyBudget = cap(cfg.dailyBudget), monthlyBudget = cap(cfg.monthlyBudget);
  const left$ = (b, spent) => (b ? +Math.max(0, b - spent - costReserved).toFixed(3) : null);
  return { ...u, limit, used, reserved, left: limit ? Math.max(0, limit - used - reserved) : null, maxPerRequest: cfg.maxPerRequest,
    dailyBudget, monthlyBudget, costReserved, costLeftDay: left$(dailyBudget, u.cost), costLeftMonth: left$(monthlyBudget, u.monthCost) };
}
/** V4.5: the caps from Ajustes → Estudio, applied at once (the jobs and the catalog stay as they are). */
export function setLimits(m = {}) {
  for (const k of ['dailyLimit', 'dailyBudget', 'monthlyBudget', 'maxPerRequest', 'concurrency']) if (m[k] !== undefined) cfg[k] = m[k];
  setImmediate(pumpJobs); // more at once may start a queued job now
}

/* ---------- storage ---------- */
const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'imagen';
function dims(b, ext) { // width × height from the file header (png, jpg, webp, our svg) — the gallery lays out at the true ratio
  try {
    if (ext === 'png' && b.readUInt32BE(12) === 0x49484452) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (ext === 'jpg') { let i = 2; while (i + 9 < b.length) { if (b[i] !== 0xFF) return null; const mk = b[i + 1]; if (mk >= 0xC0 && mk <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(mk)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } }
    if (ext === 'webp' && b.toString('ascii', 8, 12) === 'WEBP') { const t = b.toString('ascii', 12, 16); if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)]; if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; if (t === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; } }
    if (ext === 'svg') { const m = /width="(\d+)" height="(\d+)"/.exec(b.toString('utf8', 0, 400)); if (m) return [+m[1], +m[2]]; }
  } catch {}
  return null;
}
/** A name is taken while its file, its record, or its copy in the bin exists — a restore never collides with a new picture. */
function taken(folder, name, ext) {
  if (fs.existsSync(path.join(folder, name + '.' + ext)) || fs.existsSync(path.join(folder, name + '.json'))) return true;
  const bin = path.join(root, '.papelera'); if (!fs.existsSync(bin)) return false;
  const tail = '-' + name + '.'; return fs.readdirSync(bin).some(f => f.includes(tail));
}
function store(buf, ext, meta) {
  const d = new Date(), sub = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const folder = path.join(root, sub); fs.mkdirSync(folder, { recursive: true });
  // the name is never reused (V4.4, 25 Sep 2026): «date + prompt» alone came back free when a file went to the bin, and the
  // next picture with the same prompt took it — the browser (and a reference or a deliverable pointing at it) showed the old one
  const hms = [d.getHours(), d.getMinutes(), d.getSeconds()].map(x => String(x).padStart(2, '0')).join('');
  let base = `${sub}-${String(d.getDate()).padStart(2, '0')} ${slug(meta.prompt)} ${hms}`, name = base;
  for (let n = 2; taken(folder, name, ext); n++) name = `${base}-${n}`;
  fs.writeFileSync(path.join(folder, name + '.' + ext), buf);
  const rel = `${sub}/${name}.${ext}`, wh = dims(buf, ext);
  const item = { id: rel, file: rel, kind: ext === 'mp4' || ext === 'webm' ? 'video' : ext === 'mp3' || ext === 'wav' ? 'audio' : 'image', ext, at: Date.now(), ...(wh ? { w: wh[0], h: wh[1] } : {}), ...meta };
  fs.writeFileSync(path.join(folder, name + '.json'), JSON.stringify(item, null, 2));
  idxPut(sub, { ...item });
  return item;
}
/* ---------- V4.6 (27 Sep 2026, the owner): folders to organise the gallery ----------
   Folders are the owner's own labels, not directories: a file stays where it is (the links in the deliverables and the
   references keep working) and its record says which folder it is in. <media>/folders.json keeps their names. */
const foldersFile = () => path.join(root, 'folders.json');
function readFolders() { try { const j = JSON.parse(fs.readFileSync(foldersFile(), 'utf8')); return Array.isArray(j.folders) ? j.folders.filter(f => f && /^c[a-z0-9]{4,20}$/.test(f.id) && typeof f.name === 'string') : []; } catch { return []; } }
function writeFolders(l) { fs.mkdirSync(root, { recursive: true }); const f = foldersFile(); fs.writeFileSync(f + '.tmp', JSON.stringify({ folders: l }, null, 1)); fs.renameSync(f + '.tmp', f); }
const cleanName = n => String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
/** The folders, with how many files each holds (the ones in the bin do not count). */
export function folders(items = all()) {
  const count = new Map(); for (const it of items) if (it.folder) count.set(it.folder, (count.get(it.folder) || 0) + 1);
  return readFolders().map(f => ({ ...f, n: count.get(f.id) || 0 }));
}
export const folderOf = id => readFolders().find(f => f.id === id) || null;
export function addFolder(name) {
  const nm = cleanName(name); if (!nm) throw new Error('ponle un nombre a la carpeta');
  const l = readFolders(); if (l.some(f => f.name.toLowerCase() === nm.toLowerCase())) throw new Error(`ya hay una carpeta «${nm}»`);
  if (l.length >= 200) throw new Error('como mucho 200 carpetas');
  const f = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: nm, at: Date.now() };
  writeFolders([...l, f]); return f;
}
export function renameFolder(id, name) {
  const nm = cleanName(name); if (!nm) throw new Error('ponle un nombre a la carpeta');
  const l = readFolders(), f = l.find(x => x.id === id); if (!f) throw new Error('esa carpeta ya no existe');
  if (l.some(x => x.id !== id && x.name.toLowerCase() === nm.toLowerCase())) throw new Error(`ya hay una carpeta «${nm}»`);
  f.name = nm; writeFolders(l); return f;
}
/** The folder goes; its files stay, with no folder. → how many files it held */
export function removeFolder(id) {
  const l = readFolders(); if (!l.some(f => f.id === id)) throw new Error('esa carpeta ya no existe');
  let n = 0; for (const it of all()) if (it.folder === id) { update(it.file, { folder: null }); n++; } // the whole gallery, never just its first 600
  writeFolders(l.filter(f => f.id !== id)); return n;
}
/** Files into a folder (null: out of any folder). → how many moved */
export function moveTo(files, folder) {
  if (folder != null && !readFolders().some(f => f.id === folder)) throw new Error('esa carpeta ya no existe');
  let n = 0; for (const id of (Array.isArray(files) ? files : []).slice(0, 2000)) if (typeof id === 'string' && update(id, { folder: folder || null })) n++;
  return n;
}
/* Auditoría 1 oct 2026 (INF-02): the gallery lives in memory. Every GET /api/media read every .json sidecar TWICE
   (list() and folders()) with sync I/O on the server's one thread: 600 files froze the whole office for seconds. Now each
   month folder is read once and kept with its folder's mtime; a month is read again only when that mtime moves (a file
   added, removed or renamed from outside, e.g. in the Explorer), and the office's own writes patch the index in place.
   The API is the same: list() hands back copies, never the index's own objects. */
const MONTH_RE = /^\d{4}-\d{2}$/;
let IDX = { root: '', months: new Map(), sorted: null };
const mtimeOf = d => { try { return fs.statSync(d).mtimeMs; } catch { return -1; } };
function scanMonth(sub) {
  const dir = path.join(root, sub), items = new Map();
  let names = []; try { names = fs.readdirSync(dir); } catch { return items; }
  for (const f of names) {
    if (!f.endsWith('.json')) continue;
    try { const it = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (it && typeof it.file === 'string' && fs.existsSync(path.join(root, it.file))) items.set(it.file, it); } catch {}
  }
  return items;
}
function index() {
  if (IDX.root !== root) IDX = { root, months: new Map(), sorted: null };
  if (!root || !fs.existsSync(root)) { if (IDX.months.size || !IDX.sorted) { IDX.months.clear(); IDX.sorted = []; } return IDX; }
  const subs = fs.readdirSync(root).filter(x => MONTH_RE.test(x));
  for (const k of [...IDX.months.keys()]) if (!subs.includes(k)) { IDX.months.delete(k); IDX.sorted = null; }
  for (const sub of subs) {
    const mt = mtimeOf(path.join(root, sub)), cur = IDX.months.get(sub);
    if (!cur || cur.mtime !== mt) { IDX.months.set(sub, { mtime: mt, items: scanMonth(sub) }); IDX.sorted = null; }
  }
  if (!IDX.sorted) IDX.sorted = [...IDX.months.values()].flatMap(m => [...m.items.values()]).sort((a, b) => b.at - a.at);
  return IDX;
}
/** The office wrote into this month itself: patch the index and take the folder's new mtime, so it is not read again. */
function idxPut(sub, it) {
  if (IDX.root !== root) return; const m = IDX.months.get(sub); if (!m) return; // not indexed yet: the next read builds it
  if (it) m.items.set(it.file, it); m.mtime = mtimeOf(path.join(root, sub)); IDX.sorted = null;
}
function idxDrop(file) {
  const sub = String(file).slice(0, 7); if (IDX.root !== root) return; const m = IDX.months.get(sub); if (!m) return;
  m.items.delete(file); m.mtime = mtimeOf(path.join(root, sub)); IDX.sorted = null;
}
/** The whole gallery (copies), for counting and for changes that must reach every file, not one page. */
const all = () => index().sorted.map(it => ({ ...it }));
/** Everything in the studio, newest first (from the in-memory index of the .json sidecars). */
export function list({ limit = 600 } = {}) {
  return index().sorted.slice(0, limit).map(it => ({ ...it }));
}
const FILE_RE = /^\d{4}-\d{2}\/[^/\\]+\.(png|jpe?g|webp|svg|mp4|webm|mp3|wav)$/i; // V4.8: audio too, for Muse Spark to transcribe
/** A path inside the studio, or null (never outside it: the id comes from the request). */
export function resolve(id) {
  const rel = String(id || '').replace(/\\/g, '/');
  if (!FILE_RE.test(rel) || rel.includes('..')) return null;
  const p = path.join(root, rel); return fs.existsSync(p) ? p : null;
}
export function item(id) { const p = resolve(id); if (!p) return null; try { return JSON.parse(fs.readFileSync(p.replace(/\.[^.]+$/, '.json'), 'utf8')); } catch { return null; } }
export function update(id, patch) { const p = resolve(id); if (!p) return null; const j = p.replace(/\.[^.]+$/, '.json'); const it = JSON.parse(fs.readFileSync(j, 'utf8')); Object.assign(it, patch); fs.writeFileSync(j, JSON.stringify(it, null, 2)); if (typeof it.file === 'string') idxPut(it.file.slice(0, 7), { ...it }); return it; }
/** To <media>/.papelera (emptied after 30 days). Returns what `restore` needs to bring it back, or null. */
export function trash(id) {
  const p = resolve(id); if (!p) return null;
  const bin = path.join(root, '.papelera'); fs.mkdirSync(bin, { recursive: true });
  const stamp = Date.now(), names = [];
  for (const f of [p, p.replace(/\.[^.]+$/, '.json')]) if (fs.existsSync(f)) { const nm = `${stamp}-${path.basename(f)}`, to = path.join(bin, nm); fs.renameSync(f, to); try { fs.utimesSync(to, new Date(stamp), new Date(stamp)); } catch {} names.push(nm); } // dated the day it went in: the 30 days count from here
  idxDrop(String(id).replace(/\\/g, '/'));
  return { id: String(id).replace(/\\/g, '/'), bin: names };
}
export function restore({ id, bin } = {}) {
  const rel = String(id || '').replace(/\\/g, '/');
  if (!FILE_RE.test(rel) || rel.includes('..') || !Array.isArray(bin) || !bin.length || bin.length > 2) return false;
  const trashDir = path.join(root, '.papelera'), folder = path.join(root, path.dirname(rel)), stem = path.basename(rel).replace(/\.[^.]+$/, '');
  const moves = [];
  for (const nm of bin) {
    if (!/^\d+-[^/\\]+$/.test(String(nm)) || nm.includes('..')) return false;
    const orig = String(nm).replace(/^\d+-/, ''); if (orig.replace(/\.[^.]+$/, '') !== stem) return false; // only the file and its record, back to their own name
    const from = path.join(trashDir, nm), to = path.join(folder, orig);
    if (!fs.existsSync(from) || fs.existsSync(to)) return false;
    moves.push([from, to]);
  }
  fs.mkdirSync(folder, { recursive: true });
  for (const [from, to] of moves) fs.renameSync(from, to);
  let back = null; try { back = JSON.parse(fs.readFileSync(path.join(folder, stem + '.json'), 'utf8')); } catch {}
  idxPut(path.dirname(rel), back && back.file === rel ? back : null);
  return true;
}
/* V4.4 (25 Sep 2026): the bin, seen from the page — what is in it, its picture, how many days it has left, back or gone for good */
const BIN_RE = /^(\d{12,})-([^/\\]+)$/;
export const BIN_DAYS = 30;
const binDir = () => path.join(root, '.papelera');
/** Everything in the bin, newest first: one entry per thrown-away file (its record beside it). */
export function trashList() {
  const dir = binDir(); if (!root || !fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir), out = [];
  for (const nm of names) {
    const m = BIN_RE.exec(nm); if (!m || /\.json$/i.test(nm) || !/\.(png|jpe?g|webp|svg|mp4|webm|mp3|wav)$/i.test(nm)) continue;
    const stamp = +m[1], base = m[2], rec = `${m[1]}-${base.replace(/\.[^.]+$/, '')}.json`;
    let it = {}; try { it = JSON.parse(fs.readFileSync(path.join(dir, rec), 'utf8')); } catch {}
    const id = it.file || `${base.slice(0, 7)}/${base}`;
    out.push({ id, bin: names.includes(rec) ? [nm, rec] : [nm], name: nm, prompt: it.prompt || base, kind: /\.(mp4|webm)$/i.test(nm) ? 'video' : /\.(mp3|wav)$/i.test(nm) ? 'audio' : 'image', at: it.at || null, trashedAt: stamp,
      daysLeft: Math.max(0, Math.ceil((stamp + BIN_DAYS * 864e5 - Date.now()) / 864e5)), modelName: it.modelName || it.model || '', upload: !!it.upload });
  }
  return out.sort((a, b) => b.trashedAt - a.trashedAt);
}
/** The path of a file in the bin (only a file of the bin, never outside it), for its preview. */
export function trashFile(name) { const nm = String(name || ''); if (!BIN_RE.test(nm) || nm.includes('..') || /[\\/]/.test(nm)) return null; const p = path.join(binDir(), nm); return fs.existsSync(p) ? p : null; }
/** Gone for good: these bin entries (their file and record), or everything with { all: true }. Returns how many files went. */
export function purge({ bin, all } = {}) {
  const dir = binDir(); if (!root || !fs.existsSync(dir)) return 0;
  const names = all ? fs.readdirSync(dir) : (Array.isArray(bin) ? bin : []).map(String);
  let n = 0; for (const nm of names) { if (!BIN_RE.test(nm) || nm.includes('..') || /[\\/]/.test(nm)) continue; const p = path.join(dir, nm); if (fs.existsSync(p)) { fs.rmSync(p, { force: true }); n++; } }
  return n;
}
/* uploads: the owner's own photos and videos, to use as a reference or a first frame (never svg: it could carry script) */
const UPLOAD = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav' }; // V4.8: mp3/wav, for transcribing
const MAGIC = { png: b => b.length > 8 && b.readUInt32BE(0) === 0x89504E47, jpg: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF, webp: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP', mp4: b => b.toString('ascii', 4, 8) === 'ftyp', webm: b => b.length > 4 && b.readUInt32BE(0) === 0x1A45DFA3 , mp3: b => b.length > 3 && (b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)), wav: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE' };
export function upload({ name, data, folder } = {}) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(data || ''));
  if (!m) throw new Error('el archivo no llegó bien');
  const ext = UPLOAD[m[1].toLowerCase()]; if (!ext) throw new Error('solo PNG, JPG, WEBP, MP4, WEBM, MP3 o WAV');
  const buf = Buffer.from(m[2], 'base64');
  if (!MAGIC[ext](buf)) throw new Error('el archivo no es lo que dice ser');
  const audio = ext === 'mp3' || ext === 'wav', vid = ext === 'mp4' || ext === 'webm';
  if (buf.length > (vid || audio ? 25 : 12) * 1024 * 1024) throw new Error(vid ? 'el video pasa de 25 MB' : audio ? 'el audio pasa de 25 MB' : 'la imagen pasa de 12 MB');
  const title = String(name || 'subida').replace(/\.[^.]+$/, '').slice(0, 80) || 'subida';
  return store(buf, ext, { prompt: title, provider: 'subida', model: '', by: 'you', upload: true, agent: null, task: null, ...(folder && folderOf(folder) ? { folder } : {}) }); // V4.6: into the folder the owner is looking at
}
/** Several files in one .zip (stored, not compressed: images and video are already compressed). */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zip(ids) {
  const files = [], seen = new Set(); let total = 0;
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, 200)) {
    const p = resolve(id); if (!p) continue;
    const data = fs.readFileSync(p); if (total + data.length > 400 * 1024 * 1024) break; total += data.length;
    let name = path.basename(p); for (let n = 2; seen.has(name); n++) name = path.basename(p).replace(/(\.[^.]+)$/, `-${n}$1`); seen.add(name);
    files.push({ name, data });
  }
  const d = new Date(), dt = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dd = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const nm = Buffer.from(f.name, 'utf8'), crc = crc32(f.data), sz = f.data.length;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8); h.writeUInt16LE(dt, 10); h.writeUInt16LE(dd, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(sz, 18); h.writeUInt32LE(sz, 22); h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, nm, f.data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(dt, 12); c.writeUInt16LE(dd, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(sz, 20); c.writeUInt32LE(sz, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nm); off += 30 + nm.length + sz;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return { buf: Buffer.concat([...parts, cd, e]), count: files.length };
}

/* ---------- talking to the engines ---------- */
class EngineError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
async function http(url, opts, what) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 180000) });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = null; }
  if (!r.ok) {
    const d = j && (j.error?.message || (typeof j.error === 'string' && j.error) || (typeof j.detail === 'string' && j.detail) || (Array.isArray(j.detail) && j.detail.map(x => x.msg || x.message).filter(Boolean).join('; ')) || j.message);
    throw new EngineError(`${what}: ${r.status} ${d || text.slice(0, 200)}`, r.status);
  }
  return j;
}
const fromUrl = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(300000) }); if (!r.ok) throw new Error('no pude descargar el resultado: ' + r.status); return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') || '' }; };
const extOf = (mime, url, fallback = 'png') => { const s = (mime || '') + ' ' + (url || '').split('?')[0].slice(-6); return /jpe?g/.test(s) ? 'jpg' : /webp/.test(s) ? 'webp' : /webm/.test(s) ? 'webm' : /mp4|quicktime|\.mov/.test(s) ? 'mp4' : /png/.test(s) ? 'png' : fallback; };
function friendly(msg, status) { // what the owner reads on the red tile
  const m = String(msg || '');
  if (status === 403 && /Higgsfield/.test(m)) return 'sin créditos en Higgsfield: recarga en cloud.higgsfield.ai (' + m.slice(0, 100) + ')'; // Higgsfield answers 403 for «Not enough credits» (its own client), not for a bad key
  if (status === 401 || status === 403 || /unauthori[sz]ed|invalid (api )?key|forbidden/i.test(m)) return 'la key no es válida o no tiene permiso (' + m.slice(0, 120) + ')';
  if (status === 402 || /insufficient|credits?|balance|quota|billing/i.test(m)) return 'sin saldo o créditos en el servicio (' + m.slice(0, 120) + ')';
  if (status === 429 || /rate.?limit|too many/i.test(m)) return 'el servicio pide esperar un poco (demasiadas peticiones); reintenta en un minuto';
  if (/nsfw|safety|blocked|moderation|policy/i.test(m)) return 'el motor lo bloqueó por su filtro de contenido; cambia el prompt';
  if (/timeout|timed out|aborted/i.test(m)) return 'el servicio no respondió a tiempo; reintenta';
  return m.slice(0, 300);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZE = { '1:1': [1024, 1024], '4:5': [1024, 1280], '3:4': [1024, 1365], '9:16': [1024, 1792], '16:9': [1792, 1024], '4:3': [1365, 1024], '3:2': [1536, 1024], '2:3': [1024, 1536], '21:9': [1792, 768] };

// the media a job uses (gallery ids) → what each engine takes: a data URI (fal), inline base64 (Gemini), a Blob (OpenAI), a public URL (Higgsfield)
function inputFiles(job) {
  const out = { start: [], end: [], reference: [], video: [], audio: [] };
  for (const role of Object.keys(out)) for (const id of (job.media?.[role] || [])) { const p = resolve(id); if (!p) throw new Error(`no encuentro el archivo «${id}» en el Estudio`); const ext = p.split('.').pop().toLowerCase(); out[role].push({ id, p, ext, mime: { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm' }[ext] }); }
  return out;
}
const asDataUri = f => `data:${f.mime};base64,${fs.readFileSync(f.p).toString('base64')}`;
async function hfUpload(f) { // Higgsfield's own storage (files/generate-upload-url → PUT), cached 12 h in the file's record
  const it = item(f.id); if (it?.hf?.url && Date.now() - it.hf.at < 12 * 3600e3) return it.hf.url;
  const up = await http(`${HF_BASE()}/files/generate-upload-url`, { method: 'POST', headers: { authorization: `Key ${secret('higgsfield')}`, 'content-type': 'application/json' }, body: JSON.stringify({ content_type: f.mime }) }, 'Higgsfield (subir)');
  const r = await fetch(up.upload_url, { method: 'PUT', headers: up.upload_headers || { 'content-type': f.mime }, body: fs.readFileSync(f.p), signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error('Higgsfield no aceptó el archivo de referencia: ' + r.status);
  try { update(f.id, { hf: { url: up.public_url, at: Date.now() } }); } catch {}
  return up.public_url;
}

// poll a queue until the engine says it finished. Higgsfield: completed/failed/nsfw/canceled; fal: COMPLETED (then the result)
async function pollUntil(job, check, { every = 4000, deadline = 20 * 60e3 } = {}) {
  const until = (job.startedAt || Date.now()) + deadline; let misses = 0;
  for (;;) {
    if (job.cancel) throw new Error('Cancelado por ti.');
    if (Date.now() > until) throw new Error('tardó más de ' + Math.round(deadline / 60e3) + ' minutos; mira en el panel del servicio si terminó');
    await sleep(+process.env.AO_POLL_MS || every);
    try { const r = await check(); misses = 0; if (r) return r; }
    catch (e) { if (e.final || [401, 403, 404].includes(e.status) || ++misses >= 3) throw e; } // Higgsfield: 401/404 are not worth asking again
  }
}
const final = e => Object.assign(e, { final: true });

/* Google Veo on the Gemini API (V4.4, 27 Sep 2026), as Google's own SDK sends it (googleapis/js-genai, _models_converters.ts):
   POST v1beta/models/<id>:predictLongRunning { instances: [{ prompt, image?, lastFrame?, referenceImages? }], parameters:
   { aspectRatio, resolution, durationSeconds } } → an operation; GET v1beta/<operation> until done →
   response.generateVideoResponse.generatedSamples[].video.uri, downloaded with the same key. Images go as { bytesBase64Encoded, mimeType }. */
export function veoRequest(m, job, files) {
  const img = f => ({ bytesBase64Encoded: fs.readFileSync(f.p).toString('base64'), mimeType: f.mime });
  const inst = { prompt: job.prompt }, refs = (files.reference || []).slice(0, m.roles.reference || 0);
  if (files.start?.[0]) inst.image = img(files.start[0]);
  if (files.end?.[0] && files.start?.[0]) inst.lastFrame = img(files.end[0]); // a last frame only goes with a first one
  if (refs.length && !inst.image) inst.referenceImages = refs.map(f => ({ image: img(f), referenceType: 'asset' }));
  const p = { aspectRatio: job.s.aspectRatio || '16:9', resolution: job.s.resolution || '720p', durationSeconds: Number(job.s.duration) || 8 };
  if (inst.referenceImages) Object.assign(p, { aspectRatio: '16:9', resolution: '720p' }); // references: 720p landscape only
  if (p.resolution === '1080p') p.durationSeconds = 8; // 1080p comes in 8 s
  return { instances: [inst], parameters: p };
}
async function veo(m, job, ctx) {
  const key = secret('gemini'), base = GEMINI_BASE(), head = { 'content-type': 'application/json', 'x-goog-api-key': key };
  if (!job.remote?.length) {
    const body = veoRequest(m, job, inputFiles(job)); job.remote = [];
    for (let i = 0; i < job.n; i++) {
      job.note = 'enviando a Google';
      const op = await http(`${base}/v1beta/models/${encodeURIComponent(m.gid)}:predictLongRunning`, { method: 'POST', headers: head, body: JSON.stringify(body) }, m.name);
      if (!op?.name) throw new Error(`${m.name}: Google no devolvió el número de la operación`);
      job.remote.push({ id: op.name }); ctx.save();
    }
  }
  for (const rq of job.remote) {
    if (rq.done) continue;
    const op = await pollUntil(job, async () => {
      const o = await http(`${base}/v1beta/${rq.id.split('/').map(encodeURIComponent).join('/')}`, { headers: head }, m.name);
      job.note = o.done ? 'descargando' : 'generando';
      if (o.error) throw final(new Error(`${m.name}: ${o.error.message || JSON.stringify(o.error).slice(0, 200)}`));
      return o.done ? o : null;
    }, { every: 8000, deadline: 15 * 60e3 });
    const res = op.response?.generateVideoResponse || op.response || {};
    const vids = (res.generatedSamples || res.generatedVideos || []).map(x => x.video).filter(Boolean);
    if (!vids.length) throw final(new Error(`${m.name} no devolvió video${res.raiMediaFilteredReasons?.length ? ': ' + res.raiMediaFilteredReasons.join(' ') : res.raiMediaFilteredCount ? ' (lo bloqueó el filtro de contenido de Google; cambia el prompt)' : ''}`));
    rq.got = rq.got || [];
    for (const v of vids) {
      const u = v.uri; if (u && rq.got.includes(u)) continue;
      let buf;
      if (v.videoBytes || v.bytesBase64Encoded) buf = Buffer.from(v.videoBytes || v.bytesBase64Encoded, 'base64');
      else { const r = await fetch(u, { headers: { 'x-goog-api-key': key }, redirect: 'follow', signal: AbortSignal.timeout(300000) }); if (!r.ok) throw new Error(`no pude descargar el video de Google: ${r.status}`); buf = Buffer.from(await r.arrayBuffer()); }
      ctx.add(buf, 'mp4'); if (u) rq.got.push(u); ctx.save();
    }
    rq.done = true; ctx.save();
  }
}

const RUN = {
  async prueba(m, job, ctx) { // an SVG card: proves the pipeline for free (a video becomes a card too)
    const [w, h] = SIZE[job.s.aspectRatio] || SIZE['1:1'];
    const count = Object.entries(job.media || {}).filter(([, v]) => v?.length).map(([k, v]) => `${v.length} ${{ start: 'inicial', end: 'final', reference: 'ref.', video: 'video', audio: 'audio' }[k]}`).join(' · ');
    for (let i = 0; i < job.n; i++) {
      if (job.cancel) throw new Error('Cancelado por ti.');
      const text = (m.kind === 'video' ? '🎬 ' : '') + job.prompt + (job.n > 1 ? ` (${i + 1}/${job.n})` : '');
      const hue = [...text].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
      const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const lines = []; let cur = '';
      for (const wd of esc(text).split(/\s+/)) { if ((cur + ' ' + wd).length > 28) { lines.push(cur); cur = wd; } else cur = (cur ? cur + ' ' : '') + wd; } if (cur) lines.push(cur);
      const secs = Math.max(1, Number(job.s.duration) || 5), anim = m.kind === 'video' // V4.2 (audit A30): a test «video» is an animated card (a playhead, a moving light) — no encoder here to make an .mp4
        ? `<circle r="${w / 5}" cy="${h / 2}" fill="#fff" opacity=".12"><animate attributeName="cx" values="${-w / 5};${w * 1.2}" dur="${secs}s" repeatCount="indefinite"/></circle><rect x="0" y="${h - h / 40}" height="${h / 40}" fill="#fff" opacity=".85"><animate attributeName="width" values="0;${w}" dur="${secs}s" repeatCount="indefinite"/></rect><text x="96%" y="${h - h / 20}" fill="#fff" opacity=".8" font-family="Georgia,serif" font-size="${w / 34}" text-anchor="end">muestra animada · ${secs} s</text>` : '';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,22%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},80%,45%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="12%" fill="#fff" opacity=".6" font-family="Georgia,serif" font-size="${w / 22}" text-anchor="middle">PRUEBA · ${m.kind === 'video' ? 'VIDEO' : 'ESTUDIO'}</text>${lines.slice(0, 8).map((l, k) => `<text x="50%" y="${34 + k * 8}%" fill="#fff" font-family="Georgia,serif" font-size="${w / 17}" text-anchor="middle">${l}</text>`).join('')}${count ? `<text x="50%" y="92%" fill="#fff" opacity=".7" font-family="Georgia,serif" font-size="${w / 30}" text-anchor="middle">con ${esc(count)}</text>` : ''}${anim}</svg>`;
      ctx.add(Buffer.from(svg), 'svg', m.kind === 'video' ? { wanted: 'video' } : {});
    }
  },
  async gemini(m, job, ctx) { // Nano Banana: generateContent returns the image inline; the references go in as inline images
    if (m.kind === 'video') return veo(m, job, ctx);
    const refs = inputFiles(job).reference.map(f => ({ inlineData: { mimeType: f.mime, data: fs.readFileSync(f.p).toString('base64') } }));
    for (let i = 0; i < job.n; i++) {
      if (job.cancel) throw new Error('Cancelado por ti.');
      const j = await http(`${GEMINI_BASE()}/v1beta/models/${encodeURIComponent(m.gid || cfg.models.gemini)}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': secret('gemini') },
        body: JSON.stringify({ contents: [{ parts: [{ text: job.prompt }, ...refs] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: job.s.aspectRatio, ...(job.s.imageSize ? { imageSize: job.s.imageSize } : {}) } } }),
      }, m.name);
      const parts = (j.candidates || []).flatMap(c => c.content?.parts || []).filter(p => p.inlineData || p.inline_data);
      if (!parts.length) throw new Error('Nano Banana no devolvió imagen' + (j.promptFeedback?.blockReason ? ` (bloqueado: ${j.promptFeedback.blockReason})` : (j.candidates?.[0]?.finishReason ? ` (${j.candidates[0].finishReason})` : '')));
      for (const p of parts) { const d = p.inlineData || p.inline_data; ctx.add(Buffer.from(d.data, 'base64'), extOf(d.mimeType || d.mime_type)); }
    }
  },
  async grok(m, job, ctx) {
    const j = await http('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret('grok')}` }, body: JSON.stringify({ model: cfg.models.grok, prompt: job.prompt, n: job.n, response_format: 'b64_json' }) }, 'Grok');
    for (const d of j.data || []) ctx.add(Buffer.from(d.b64_json, 'base64'), 'jpg');
  },
  async openai(m, job, ctx) { // with references: /images/edits (multipart); without: /images/generations
    const size = { '1:1': '1024x1024', '3:2': '1536x1024', '2:3': '1024x1536' }[job.s.aspectRatio] || '1024x1024';
    const refs = inputFiles(job).reference, auth = { authorization: `Bearer ${secret('openai')}` };
    let j;
    if (refs.length) {
      const fd = new FormData(); fd.append('model', cfg.models.openai); fd.append('prompt', job.prompt); fd.append('n', String(job.n)); fd.append('size', size); fd.append('quality', job.s.quality);
      for (const f of refs) fd.append('image[]', new Blob([fs.readFileSync(f.p)], { type: f.mime }), path.basename(f.p));
      j = await http('https://api.openai.com/v1/images/edits', { method: 'POST', headers: auth, body: fd, timeout: 300000 }, 'OpenAI');
    } else j = await http('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ model: cfg.models.openai, prompt: job.prompt, n: job.n, size, quality: job.s.quality }), timeout: 300000 }, 'OpenAI');
    for (const d of j.data || []) { if (d.b64_json) ctx.add(Buffer.from(d.b64_json, 'base64'), 'png'); else { const r = await fromUrl(d.url); ctx.add(r.buf, extOf(r.mime, d.url)); } }
  },
  async meta(m, job, ctx) { // Muse Image (OpenAI-compatible): no references → /images/generations; with them → /images/edits with Meta's own JSON body (images: [{ image_url }]), no multipart
    const auth = { authorization: `Bearer ${secret('meta')}`, 'content-type': 'application/json' };
    const [w, h] = SIZE[job.s.aspectRatio] || SIZE['1:1'], fmt = job.s.outputFormat || 'webp'; // "WxH": Meta keeps the ratio, not the exact size
    const refs = inputFiles(job).reference;
    const base = { model: m.gid || cfg.models.meta, prompt: job.prompt, n: job.n, size: `${w}x${h}`, output_format: fmt, response_format: 'b64_json', ...(job.s.quality ? { reasoning_strength: job.s.quality } : {}) };
    const j = refs.length
      ? await http(`${META_BASE()}/images/edits`, { method: 'POST', headers: auth, body: JSON.stringify({ ...base, images: refs.map(f => ({ image_url: asDataUri(f) })) }), timeout: 300000 }, 'Meta')
      : await http(`${META_BASE()}/images/generations`, { method: 'POST', headers: auth, body: JSON.stringify(base), timeout: 300000 }, 'Meta');
    const out = j.output_format || fmt, ext = out === 'jpeg' ? 'jpg' : out;
    if (!(j.data || []).length) throw new Error('Muse Image no devolvió imagen');
    for (const d of j.data) { if (d.b64_json) ctx.add(Buffer.from(d.b64_json, 'base64'), ext); else if (d.url) { const r = await fromUrl(d.url); ctx.add(r.buf, extOf(r.mime, d.url, ext)); } }
  },
  async fal(m, job, ctx) {
    const f = inputFiles(job), auth = { authorization: `Key ${secret('fal')}`, 'content-type': 'application/json' };
    const urls = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.map(asDataUri)]));
    if (m.kind === 'image') {
      const { path: p, body } = m.fal({ prompt: job.prompt, n: job.n, s: job.s, m: urls });
      const j = await http(`${FAL_RUN()}/${p}`, { method: 'POST', headers: auth, body: JSON.stringify(body), timeout: 300000 }, 'fal.ai');
      for (const im of j.images || []) { const r = await fromUrl(im.url); ctx.add(r.buf, extOf(im.content_type || r.mime, im.url)); }
      return;
    }
    // video: one queued request per variant; the ids are kept in the job so a restart picks the poll up again
    if (!job.remote?.length) {
      job.remote = [];
      for (let i = 0; i < job.n; i++) {
        const { path: p, body } = m.fal({ prompt: job.prompt, n: 1, s: job.s, m: urls });
        const sub = await http(`${FAL_QUEUE()}/${p}`, { method: 'POST', headers: auth, body: JSON.stringify(body) }, 'fal.ai video');
        const base = `${FAL_QUEUE()}/${p.split('/').slice(0, 2).join('/')}/requests/${sub.request_id}`;
        job.remote.push({ id: sub.request_id, status: sub.status_url || base + '/status', result: sub.response_url || base, cancel: sub.cancel_url || base + '/cancel' }); ctx.save();
      }
    }
    for (const rq of job.remote) {
      if (rq.done) continue;
      await pollUntil(job, async () => { const st = await http(rq.status, { headers: auth }, 'fal.ai video'); job.note = st.status === 'IN_QUEUE' ? `en cola${st.queue_position != null ? ' (' + st.queue_position + ' delante)' : ''}` : 'generando'; if (st.status === 'COMPLETED') return true; if (st.status === 'FAILED' || st.status === 'ERROR') throw final(new Error('el video falló en fal.ai')); return false; }, { every: 5000 });
      let out; try { out = await http(rq.result, { headers: auth }, 'fal.ai video'); } catch (e) { throw final(e); }
      const url = out.video?.url || out.videos?.[0]?.url; if (!url) throw new Error('fal.ai no devolvió el video');
      job.note = 'descargando'; const r = await fromUrl(url); ctx.add(r.buf, extOf(r.mime, url, 'mp4')); rq.done = true; ctx.save();
    }
  },
  async higgsfield(m, job, ctx) { // submit → request_id → GET /requests/{id}/status until completed (images[].url · video.url)
    const auth = { authorization: `Key ${secret('higgsfield')}`, 'content-type': 'application/json' };
    if (!job.remote?.length) {
      const f = inputFiles(job), urls = {};
      for (const [role, list] of Object.entries(f)) { urls[role] = []; for (const x of list) { job.note = 'subiendo referencias'; urls[role].push(await hfUpload(x)); } }
      job.remote = [];
      for (let i = 0; i < job.n; i++) {
        const { path: p, body } = m.hf({ prompt: job.prompt, s: job.s, m: urls });
        if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(p) || p.includes('..')) throw new Error('ruta de modelo inválida');
        const sub = await http(`${HF_BASE()}/${p}`, { method: 'POST', headers: auth, body: JSON.stringify(body) }, 'Higgsfield');
        if (!sub?.request_id) throw new Error('Higgsfield no devolvió el número de pedido');
        job.remote.push({ id: sub.request_id, status: sub.status_url || `${HF_BASE()}/requests/${encodeURIComponent(sub.request_id)}/status`, cancel: sub.cancel_url || `${HF_BASE()}/requests/${encodeURIComponent(sub.request_id)}/cancel` }); ctx.save();
      }
    }
    for (const rq of job.remote) {
      if (rq.done) continue;
      const st = await pollUntil(job, async () => {
        const s = await http(rq.status, { headers: auth }, 'Higgsfield');
        job.note = s.status === 'queued' ? 'en cola' : s.status === 'in_progress' ? 'generando' : s.status;
        if (s.status === 'completed') return s;
        if (s.status === 'nsfw') throw final(new Error('Higgsfield lo bloqueó por contenido (NSFW); cambia el prompt'));
        if (s.status === 'failed' || s.status === 'canceled') throw final(new Error('Higgsfield: ' + (typeof s.error === 'string' ? s.error : s.error ? JSON.stringify(s.error).slice(0, 200) : s.status)));
        return null;
      });
      const outs = [...(st.images || []).map(x => x.url), ...(st.video?.url ? [st.video.url] : []), ...((st.videos || []).map(x => x.url))].filter(Boolean);
      if (!outs.length) throw new Error('Higgsfield terminó sin archivo');
      job.note = 'descargando';
      rq.got = rq.got || []; // files already saved from this request: a restart mid-download never saves one twice
      for (const u of outs) { if (rq.got.includes(u)) continue; const r = await fromUrl(u); ctx.add(r.buf, extOf(r.mime, u, m.kind === 'video' ? 'mp4' : 'png')); rq.got.push(u); ctx.save(); }
      rq.done = true; ctx.save();
    }
  },
};

/* ---------- jobs: every generation runs in the background ---------- */
let JOBS = [], running = 0; const waiters = new Map();
function loadJobs() {
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
function saveJobs() {
  if (!jobsFile) return;
  const cut = Date.now() - 7 * 864e5; // finished jobs are kept a week (the files themselves live in the gallery)
  JOBS = JOBS.filter(j => j.state === 'queued' || j.state === 'running' || (j.doneAt || j.at) > cut).slice(-400);
  fs.mkdirSync(path.dirname(jobsFile), { recursive: true });
  const tmp = jobsFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(JOBS, null, 1)); fs.renameSync(tmp, jobsFile);
}
const jid = () => 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const pub = j => { const { remote, cancel, ...rest } = j; return { ...rest, remote: remote ? remote.length : 0, modelName: model(j.model)?.name || j.model, engineName: ENGINES[j.engine]?.name || j.engine }; };
export function jobs({ task, active } = {}) { return JOBS.filter(j => (!task || j.task === task) && (!active || j.state === 'queued' || j.state === 'running')).slice().reverse().map(pub); }
export const job = id => { const j = JOBS.find(x => x.id === id); return j ? pub(j) : null; };
/** Queue a generation. Checks everything up front (model, key, prompt, media, budget) so a bad request fails at once. */
export function submit(req = {}) {
  const kind = req.kind === 'video' ? 'video' : 'image';
  let id = req.model;
  if (!id && req.provider) id = defaultModel(kind, req.provider);
  if (!id) id = defaultModel(kind);
  const m = model(id);
  if (!m) throw new Error(`no conozco el modelo «${id}»`);
  if (!engineOn(m.engine)) { const e = ENGINES[m.engine]; throw new Error(`${e.name} no tiene key: guárdala en Windows con  ${e.how || `setx ${e.env} "tu-key"`}  y reinicia la oficina`); }
  const prompt = String(req.prompt || '').trim(); if (!prompt && !(m.needs || []).includes('video')) throw new Error('falta el prompt');
  if (prompt.length > 4000) throw new Error('el prompt es muy largo (máx. 4000)');
  const n = Math.max(1, Math.min(m.kind === 'video' ? 4 : cfg.maxPerRequest, +req.n || 1));
  const media = {};
  for (const [role, max] of Object.entries(m.roles || {})) { const ids = (req.media?.[role] || []).filter(x => typeof x === 'string').slice(0, max); for (const x of ids) { if (!resolve(x)) throw new Error(`no encuentro «${x}» en el Estudio`); if (/\.(mp3|wav)$/i.test(x)) throw new Error('un audio no sirve de referencia ni de fotograma: los modelos del Estudio toman imágenes y videos'); if (m.engine !== 'prueba' && /\.svg$/i.test(x)) throw new Error('una tarjeta de prueba no sirve de referencia para un motor real: usa una imagen generada o subida'); if (role === 'video' ? !/\.(mp4|webm)$/i.test(x) : /\.(mp4|webm)$/i.test(x)) throw new Error(role === 'video' ? 'ahí va un video' : 'ahí va una imagen, no un video'); } if (ids.length) media[role] = ids; }
  for (const r of m.needs || []) if (!media[r]?.length) throw new Error(`${m.name} necesita ${{ start: 'una imagen inicial', video: 'un video de origen', reference: 'imágenes de referencia' }[r] || r}`);
  if (m.routes) hfRoute(m, Object.fromEntries(Object.entries(media).map(([r, l]) => [r, l.length]))); // a combination its routes do not take is said now, before anything is spent
  const s = settingsFor(m, req.settings || {}, { ratio: req.ratio, seconds: req.seconds });
  const per = m.hf && s.batchSize ? Number(s.batchSize) : 1, weight = weightOf(m.kind, n * per);
  const b = budget();
  if (m.engine !== 'prueba') { // the free test engine never counts
    if (b.left != null && weight > b.left) throw new Error(`tope diario alcanzado: quedan ${b.left} de ${b.limit} (cámbialo en Ajustes → Estudio)`);
    const est = +(unitCost(m, s) * per * n).toFixed(3), usd = v => 'US$' + (+v).toFixed(2);
    if (b.costLeftDay != null && est > b.costLeftDay + 1e-9) throw new Error(`presupuesto del día del Estudio: esto cuesta aprox. ${usd(est)} y quedan ${usd(b.costLeftDay)} de ${usd(b.dailyBudget)} (cámbialo en Ajustes → Estudio)`);
    if (b.costLeftMonth != null && est > b.costLeftMonth + 1e-9) throw new Error(`presupuesto del mes del Estudio: esto cuesta aprox. ${usd(est)} y quedan ${usd(b.costLeftMonth)} de ${usd(b.monthlyBudget)} (cámbialo en Ajustes → Estudio)`);
  }
  const j = { id: jid(), state: 'queued', kind: m.kind, model: m.id, engine: m.engine, prompt, n, s, media, weight, by: req.by === 'agent' ? 'agent' : 'you', agent: req.agent || null, task: req.task || null, at: Date.now(), items: [], cost: 0, unit: unitCost(m, s) * per, retryOf: req.retryOf || undefined, folder: req.folder && folderOf(req.folder) ? req.folder : undefined }; // V4.6: generated inside a folder, it lands there
  JOBS.push(j); saveJobs(); setImmediate(pumpJobs);
  return pub(j);
}
function pumpJobs() {
  const max = Math.max(1, Math.min(6, +cfg.concurrency || 3));
  for (const j of JOBS) { if (running >= max) break; if (j.state === 'queued') runJob(j); }
}
async function runJob(j) {
  running++; j.state = 'running'; j.startedAt = j.startedAt || Date.now(); j.note = j.remote?.length ? 'retomando tras el reinicio' : 'enviando'; saveJobs();
  const m = model(j.model);
  const ctx = { save: saveJobs, add: (buf, ext, extra = {}) => {
    const it = store(buf, ext, { prompt: j.prompt, provider: j.engine, model: j.model, modelName: m?.name || j.model, ratio: j.s.aspectRatio || null, settings: j.s, media: Object.keys(j.media).length ? j.media : undefined, cost: j.unit, by: j.by, agent: j.agent, task: j.task, job: j.id, ...(j.folder ? { folder: j.folder } : {}), ...extra });
    j.items.push(it.file); saveJobs(); return it;
  } };
  try {
    if (!m) throw new Error('el modelo ya no está en el catálogo');
    await RUN[m.engine](m, j, ctx);
    if (!j.items.length) throw new Error('el motor terminó sin devolver nada');
    j.state = 'done';
  } catch (e) {
    const why = j.cancel ? 'Cancelado por ti.' : friendly(e.message, e.status);
    if (j.items.length) { j.state = 'done'; j.warning = why; } else { j.state = 'failed'; j.error = why; }
    if (!j.cancel) console.warn(`estudio: ${j.id} ${j.model}: ${e.message}`);
  }
  j.doneAt = Date.now(); j.cost = +(j.unit * j.items.length).toFixed(3); delete j.note;
  if (j.engine !== 'prueba' && j.items.length) spend(j.kind === 'video' ? 'videos' : 'images', j.items.length, j.cost);
  if (j.remote && j.state === 'done') delete j.remote; else if (j.remote && j.cancel) delete j.remote;
  saveJobs(); running--;
  const out = pub(j); for (const w of waiters.get(j.id) || []) w(out); waiters.delete(j.id);
  try { hooks.onDone?.(out); } catch (e) { console.warn('estudio onDone:', e.message); }
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
    const auth = j.engine === 'higgsfield' ? { authorization: `Key ${secret('higgsfield')}` } : { authorization: `Key ${secret('fal')}` };
    for (const rq of j.remote || []) if (!rq.done && rq.cancel) fetch(rq.cancel, { method: j.engine === 'fal' ? 'PUT' : 'POST', headers: auth, signal: AbortSignal.timeout(15000) }).catch(() => {});
  }
  return pub(j);
}
export function retry(id) { const j = JOBS.find(x => x.id === id); if (!j) return null; return submit({ model: j.model, kind: j.kind, prompt: j.prompt, n: j.n - j.items.length || j.n, settings: j.s, media: j.media, by: j.by, agent: j.agent, task: j.task, retryOf: j.id }); }
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

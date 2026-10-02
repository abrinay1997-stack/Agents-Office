// Agents Office — el Estudio: el CATÁLOGO (F0 del banco de presets, 1 oct 2026: salió de media.mjs, que es la fachada).
// Los motores y sus keys (ENGINES, secret, engineOn), los modelos (CATALOG: Higgsfield desde su documentación, Google,
// OpenAI, Meta, fal, MiniMax, la prueba gratis), lo que edita (EDIT_MODELS), el orden de preferencia (PREFER), la ficha de
// cada modelo (INFO), los ajustes y el precio (settingsFor, unitCost, estimate) y capsOf: lo que un modelo puede hacer,
// derivado de todo lo anterior, para el compilador de presets. Sin red ni archivos, salvo higgsfield-schemas.json al cargar.
import fs from 'node:fs';
import * as mmx from '../minimax.mjs';
import { S } from './estado.mjs';

export const ENGINES = {
  higgsfield: { name: 'Higgsfield', env: 'HF_KEY', site: 'cloud.higgsfield.ai', how: 'setx HF_KEY "tu-id:tu-secreto"' },
  gemini: { name: 'Google (Gemini API)', env: 'GEMINI_API_KEY', site: 'aistudio.google.com' },
  grok: { name: 'Grok (xAI)', env: 'XAI_API_KEY', site: 'console.x.ai' },
  openai: { name: 'OpenAI', env: 'OPENAI_API_KEY', site: 'platform.openai.com' },
  meta: { name: 'Meta (Muse Image)', env: 'META_API_KEY', site: 'dev.meta.ai', how: 'setx META_API_KEY "tu-key-de-meta"' }, // V4.8: also MODEL_API_KEY, the key the office already uses for Muse Spark
  fal: { name: 'fal.ai', env: 'FAL_KEY', site: 'fal.ai' },
  minimax: { name: 'MiniMax', env: 'MINIMAX_API_KEY', site: 'platform.minimax.io', how: 'setx MINIMAX_API_KEY "tu-key"' }, // V4.10: image, video, voice and music on one key
  prueba: { name: 'Prueba (gratis)', env: null },
};
export const NAMES = Object.fromEntries(Object.entries(ENGINES).map(([k, v]) => [k, v.name]));
export const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash-image', grok: 'grok-2-image', openai: 'gpt-image-1', meta: 'muse-image-1.0' };
export const secret = e => {
  if (e === 'prueba') return 'local';
  if (e === 'higgsfield') return process.env.HF_KEY || (process.env.HF_API_KEY && process.env.HF_API_SECRET ? `${process.env.HF_API_KEY}:${process.env.HF_API_SECRET}` : '');
  if (e === 'meta') return process.env.META_API_KEY || process.env.MODEL_API_KEY || ''; // Meta's docs call it MODEL_API_KEY; the office names the engine
  return process.env[ENGINES[e]?.env] || '';
};
export const engineOn = e => !!secret(e);
/* ---------- the catalog ---------- */
const E = (values, def) => ({ type: 'enum', values, default: def ?? values[0] });
const R = (min, max, def, step) => ({ type: 'range', min, max, default: def, ...(step ? { step } : {}) });
const B = def => ({ type: 'boolean', default: def });
const T = (def, max, placeholder) => ({ type: 'text', default: def, ...(max ? { max } : {}), ...(placeholder ? { placeholder } : {}) }); // V4.10: free text (a voiceId); the page shows a field with suggestions
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
const HFS = (() => { try { return JSON.parse(fs.readFileSync(new URL('../higgsfield-schemas.json', import.meta.url), 'utf8')).endpoints || {}; } catch { return {}; } })();
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

/* ---------- MiniMax direct (V4.10, 30 Sep 2026): one key, MINIMAX_API_KEY — image, video, voice and music ----------
   Read in MiniMax's own documentation (docs/minimax/api-verificada.md, with each URL). The ids are «mmx-*» and the names say
   «directo»: MiniMax's video also reaches the Estudio through Higgsfield (minimax-hailuo-2.3, minimax-h3) and fal (hailuo-02-fal).
   Prices are MiniMax's pay-as-you-go list on that date; the ones it does not publish say «precio aproximado». A voice is charged by
   the character (perChar; cost is what 1,000 characters cost); a video by the second, its rate by resolution (costBy). */
const MMX_VOICE_SET = gid => ({
  voiceId: T('Spanish_Narrator', 256, 'Spanish_Narrator o una voz tuya'),
  emotion: E(['', ...mmx.emotionsFor(gid)], ''), // '' = the voice's own; fluent and whisper only on speech-2.6 (MiniMax T2A doc)
  speed: R(0.5, 2, 1, 0.05), vol: R(0.1, 10, 1, 0.1), pitch: R(-12, 12, 0),
  format: E(['mp3', 'wav', 'flac'], 'mp3'),
  languageBoost: E(['auto', 'Spanish', 'English', 'Portuguese', 'French', 'Italian', 'German'], 'auto'),
});
const mmxVoice = (id, gid, name, perMillion, note) => ({ id, engine: 'minimax', kind: 'audio', gid, name, cost: +(perMillion / 1000).toFixed(3), perChar: perMillion / 1e6, maxPrompt: 9999, note, roles: {}, settings: MMX_VOICE_SET(gid) });
const MMX_VIDEO_RATIO = ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const MMX_MUSIC_SET = () => ({ instrumental: B(false), style: T('', 2000, 'estilo: pop latino, alegre, voz femenina'), format: E(['mp3', 'wav'], 'mp3') });
const MMX = [
  { id: 'mmx-image-01', engine: 'minimax', kind: 'image', gid: 'image-01', name: 'MiniMax Image-01 (directo)', cost: 0.0035, maxPrompt: 1500, note: 'Imagen de MiniMax, baratísima. Con UNA foto de una cara (JPG o PNG) pone a esa persona en otra escena.', roles: { reference: 1 }, settings: { aspectRatio: E(mmx.IMAGE_RATIOS, '1:1'), promptOptimizer: B(false) } },
  { id: 'mmx-h3', engine: 'minimax', kind: 'video', gid: 'MiniMax-H3', name: 'MiniMax H3 (directo)', cost: 0.08, costBy: { resolution: { '768P': 0.08, '2K': 0.13 } }, per: 's', note: 'El video de MiniMax: primer y último fotograma, o hasta 9 imágenes y 3 videos de referencia (no las dos cosas a la vez). 768P o 2K, de 4 a 15 s.', roles: { start: 1, end: 1, reference: 9, video: 3 },
    settings: { aspectRatio: E(MMX_VIDEO_RATIO, '16:9'), resolution: E(['768P', '2K'], '768P'), duration: R(4, 15, 5), promptExpansion: E(['', 'disabled', 'balanced', 'quality'], '') } },
  { id: 'mmx-h3-max', engine: 'minimax', kind: 'video', gid: 'MiniMax-H3-Max', name: 'MiniMax H3-Max (directo)', cost: 0.05, costBy: { resolution: { '480P': 0.05, '768P': 0.08 } }, per: 's', note: 'La variante Max de H3: 480P o 768P, de 5 a 15 s. A 768P, precio aproximado.', roles: { start: 1, end: 1, reference: 9, video: 3 },
    settings: { aspectRatio: E(MMX_VIDEO_RATIO, '16:9'), resolution: E(['768P', '480P'], '768P'), duration: R(5, 15, 5), promptExpansion: E(['', 'disabled', 'balanced', 'quality'], '') } },
  mmxVoice('mmx-voz-2.8-hd', 'speech-2.8-hd', 'MiniMax Voz 2.8 HD (directo)', 100, 'Locución de estudio: la voz más natural de MiniMax. Pon el texto que se dirá. US$100 por millón de caracteres.'),
  mmxVoice('mmx-voz-2.8-turbo', 'speech-2.8-turbo', 'MiniMax Voz 2.8 Turbo (directo)', 60, 'Locución rápida y más barata. US$60 por millón de caracteres.'),
  mmxVoice('mmx-voz-2.6-hd', 'speech-2.6-hd', 'MiniMax Voz 2.6 HD (directo)', 100, 'La generación anterior, HD. Precio aproximado.'),
  mmxVoice('mmx-voz-2.6-turbo', 'speech-2.6-turbo', 'MiniMax Voz 2.6 Turbo (directo)', 60, 'La generación anterior, Turbo. Precio aproximado.'),
  { id: 'mmx-musica-3', engine: 'minimax', kind: 'music', gid: 'music-3.0', name: 'MiniMax Música 3.0 (directo)', cost: 0.15, maxPrompt: 3500, note: 'Canciones con tu letra ([Verse] [Chorus]…) o piezas instrumentales, hasta 5 min. Solo cuentas de pago anteriores al 20 ago 2026. Precio aproximado.', roles: {}, settings: MMX_MUSIC_SET() },
  { id: 'mmx-musica-3-gratis', engine: 'minimax', kind: 'music', gid: 'music-3.0-free', name: 'MiniMax Música 3.0 gratis (directo)', cost: 0, maxPrompt: 3500, note: 'La misma música, para cualquier cuenta y sin costo, pero lenta: 3 pedidos por minuto.', roles: {}, settings: MMX_MUSIC_SET() },
];

export const CATALOG = [
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
  // ---- V4.10: MiniMax direct — image, video, voice (kind 'audio') and music (kind 'music')
  ...MMX,
];
// V4.9 (30 Sep 2026): the models that EDIT an image (the image goes in as a reference, an instruction says what changes), best first —
// «Editar» in the Estudio and Dimitri's edits use them; the original is never touched, the result is a new version beside it
export const EDIT_MODELS = ['nano-banana-2', 'nano-banana-pro', 'nano-banana', 'muse-image', 'gpt-image-1', 'qwen-image-3', 'grok-imagine-2', 'flux-kontext', 'seedream-4', 'nano-banana-fal'];
for (const x of CATALOG) if (EDIT_MODELS.includes(x.id)) x.edit = true;
export const PREFER = { edit: EDIT_MODELS, image: ['nano-banana-2', 'nano-banana', 'muse-image', 'soul-2', 'nano-banana-fal', 'gpt-image-1', 'seedream-4', 'z-image-turbo', 'flux-schnell', 'grok-image', 'mmx-image-01'], video: ['kling-3-std', 'veo-3.1-fast', 'kling-3-turbo', 'seedance-2', 'kling-2.5-fal', 'seedance-1-fal', 'hailuo-02-fal', 'mmx-h3'],
  audio: ['mmx-voz-2.8-turbo', 'mmx-voz-2.8-hd', 'mmx-voz-2.6-turbo', 'mmx-voz-2.6-hd'], music: ['mmx-musica-3', 'mmx-musica-3-gratis'] }; // V4.10: voice and music
/** V4.10: what the Estudio makes — an image, a video, a voice-over (audio) or a piece of music. */
export const KINDS = ['image', 'video', 'audio', 'music'];

/* V4.4 (27 Sep 2026): what the model picker sorts and filters by — who makes it, its quality tier (1 básica · 2 buena ·
   3 alta · 4 la mejor), how fast it answers, and what it is good for. A model not listed here gets its engine as maker and
   tier 2. The tiers are the office's own reading of each model's place in its family, not a benchmark. */
const G = 'Google', HFM = 'Higgsfield', K = 'Kling (Kuaishou)', BD = 'ByteDance', AL = 'Alibaba', BFL = 'Black Forest Labs';
export const INFO = {
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
  'mmx-image-01': ['MiniMax', 2, 'rápido', ['barato', 'lotes', 'la misma cara en otra escena']],
  'mmx-h3': ['MiniMax', 4, 'lento', ['2K', 'referencias', 'primer y último fotograma', 'hasta 15 s']],
  'mmx-h3-max': ['MiniMax', 3, 'lento', ['referencias', 'primer y último fotograma', 'hasta 15 s']],
  'mmx-voz-2.8-hd': ['MiniMax', 4, 'rápido', ['locución', 'anuncios', 'voces clonadas', 'emociones']],
  'mmx-voz-2.8-turbo': ['MiniMax', 3, 'muy rápido', ['locución', 'lotes', 'barato']],
  'mmx-voz-2.6-hd': ['MiniMax', 3, 'rápido', ['locución']],
  'mmx-voz-2.6-turbo': ['MiniMax', 2, 'muy rápido', ['locución', 'barato']],
  'mmx-musica-3': ['MiniMax', 4, 'lento', ['canciones con letra', 'jingles', 'música de fondo']],
  'mmx-musica-3-gratis': ['MiniMax', 3, 'lento', ['canciones con letra', 'música de fondo', 'gratis']],
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
export const infoOf = x => { const i = INFO[x.id]; return i ? { maker: i[0], tier: i[1], speed: i[2], uses: i[3] } : { maker: x.engine === 'higgsfield' ? HFM : ENGINES[x.engine]?.name || x.engine, tier: 2, speed: 'normal', uses: [] }; };
/* The catalog in use: CATALOG plus the owner's own models (office.config.json → media.custom), set by configure(). */
let MODELS = CATALOG;
export const allModels = () => MODELS;
/** Your own models: office.config.json → media.custom: [{ "id", "name", "engine": "fal"|"higgsfield", "kind": "image"|"video", "path", "cost" }]. A bad entry is left out. */
export function setCustom(list) {
  const custom = (Array.isArray(list) ? list : []).filter(c => c && /^[a-z0-9][a-z0-9._-]*$/i.test(c.id || '') && /^[a-z0-9][a-z0-9._/-]*$/i.test(c.path || '') && !c.path.includes('..') && ['fal', 'higgsfield'].includes(c.engine) && ['image', 'video'].includes(c.kind))
    .map(c => ({ id: c.id, engine: c.engine, kind: c.kind, name: String(c.name || c.id).slice(0, 60), cost: +c.cost || 0, per: c.kind === 'video' ? 's' : undefined, note: 'Modelo tuyo (office.config.json → media.custom).', roles: c.kind === 'image' ? { reference: 4 } : { start: 1 },
      settings: c.kind === 'image' ? { aspectRatio: E(IMG_ASPECT, '1:1') } : { aspectRatio: E(VID_ASPECT, '16:9'), duration: R(4, 10, 5) },
      ...(c.engine === 'higgsfield' ? { hf: HF.paths(c.kind === 'image' ? { text: c.path } : t2v(c.path)) } : { fal: j => ({ path: c.path, body: { prompt: j.prompt, ...(c.kind === 'image' ? { num_images: j.n, image_size: FAL_SIZE[j.s.aspectRatio] || 'square_hd', ...(j.m.reference.length ? { image_urls: j.m.reference } : {}) } : { aspect_ratio: j.s.aspectRatio, duration: String(j.s.duration), ...(j.m.start[0] ? { image_url: j.m.start[0] } : {}) }) } }) }) }));
  MODELS = [...CATALOG.filter(x => !custom.some(c => c.id === x.id)), ...custom];
}
export const model = id => MODELS.find(x => x.id === id) || null;
/** The catalog as the page and the agents see it (no functions), each model marked on/off by its engine's key. */
export function models() {
  return MODELS.map(x => ({ id: x.id, engine: x.engine, engineName: ENGINES[x.engine].name, kind: x.kind, name: x.name, note: x.note || '', cost: x.cost, per: x.per || 'item', seconds: x.seconds || null, roles: x.roles || {}, needs: x.needs || [], settings: x.settings || {}, on: engineOn(x.engine), ...(x.legacy ? { legacy: true } : {}), ...(x.edit ? { edit: true } : {}), ...(x.perChar ? { perChar: x.perChar } : {}), ...(x.costBy ? { costBy: x.costBy } : {}), ...(x.maxPrompt ? { maxPrompt: x.maxPrompt } : {}), ...infoOf(x) }));
}
/** The models that can edit an image right now (their engine has its key), best first. */
export function editModels() {
  const rank = id => { const i = PREFER.edit.indexOf(id); return i < 0 ? 99 : i; };
  return models().filter(m => m.on && m.edit && m.kind === 'image' && (m.roles.reference || 0) >= 1).sort((a, b) => rank(a.id) - rank(b.id));
}
export function engines() {
  return Object.entries(ENGINES).map(([id, e]) => ({ id, name: e.name, on: engineOn(id), env: e.env, site: e.site || null, how: e.how || (e.env ? `setx ${e.env} "tu-key"` : null), models: MODELS.filter(x => x.engine === id).length }));
}
/** Old shape (V1 of the Estudio): the engines as «providers». */
export function providers() { return engines().map(e => ({ ...e, model: e.id === 'prueba' ? 'local' : (MODELS.find(x => x.engine === e.id && x.kind === 'image') || {}).id || null, cost: (MODELS.find(x => x.engine === e.id) || {}).cost || 0 })); }
export function defaultModel(kind = 'image', engine) {
  const want = S.cfg.default && S.cfg.default[kind]; const m0 = want && model(want);
  if (m0 && m0.kind === kind && engineOn(m0.engine) && (!engine || m0.engine === engine)) return m0.id;
  const on = MODELS.filter(x => x.kind === kind && engineOn(x.engine) && x.engine !== 'prueba' && (!engine || x.engine === engine));
  const pick = PREFER[kind].map(model).find(x => x && on.includes(x)) || on[0];
  if (pick) return pick.id;
  if (engine && engine !== 'prueba') return (MODELS.find(x => x.kind === kind && x.engine === engine) || {}).id || null;
  if (kind === 'audio' || kind === 'music') { const first = (PREFER[kind] || []).map(model).find(Boolean) || MODELS.find(x => x.kind === kind); return first ? first.id : null; } // V4.10: no free test card for sound
  return kind === 'video' ? 'prueba-video' : 'prueba';
}
export const defaultProvider = () => { const m = model(defaultModel('image')); return m ? m.engine : 'prueba'; };
/** Settings as the model wants them: defaults filled in, enums checked, ranges clamped. */
export function settingsFor(m, given = {}, legacy = {}) {
  const s = {};
  for (const [k, f] of Object.entries(m.settings || {})) {
    let v = given[k] ?? (k === 'aspectRatio' ? legacy.ratio : k === 'duration' ? legacy.seconds : undefined);
    if (f.type === 'enum') { v = v == null ? f.default : String(v); if (!f.values.includes(v)) v = f.default; }
    else if (f.type === 'range') { v = Number(v); if (!Number.isFinite(v)) v = f.default; v = Math.min(f.max, Math.max(f.min, v)); if (!f.step || f.step >= 1) v = Math.round(v); }
    else if (f.type === 'boolean') v = typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : f.default;
    else if (f.type === 'text') { v = v == null ? '' : String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, f.max || 2000); if (!v) v = f.default; } // V4.10: a voiceId, a music style
    s[k] = v;
  }
  return s;
}
// V4.10: a rate by setting (MiniMax H3: by resolution) and a voice by the character — `prompt` is the text spoken (1,000 characters when unknown)
export function unitCost(m, s, prompt) {
  if (m.perChar) return Math.max(0.001, +(m.perChar * (prompt == null ? 1000 : String(prompt).length)).toFixed(4));
  let rate = m.cost; for (const [k, map] of Object.entries(m.costBy || {})) if (map[s[k]] != null) rate = map[s[k]];
  return m.per === 's' ? +(rate * (m.seconds || Number(s.duration) || 5)).toFixed(3) : rate;
}
export function estimate({ model: id, n = 1, settings = {}, prompt } = {}) { const m = model(id); if (!m) return 0; return +(unitCost(m, settingsFor(m, settings), prompt) * Math.max(1, +n || 1) * (m.hf && m.settings.batchSize ? Number(settingsFor(m, settings).batchSize) : 1)).toFixed(4); }

/* ---------- F0 del banco de presets (1 oct 2026): lo que un modelo puede hacer ----------
   capsOf(m) se DERIVA del catálogo (roles, needs, settings, EDIT_MODELS, INFO, routes), nunca se escribe a mano: un modelo
   nuevo trae sus capacidades solo. El compilador de presets (modelosPara, pickModel) filtra y puntúa con esto. La familia de
   prompt (§5.8 de docs/propuesta-banco-presets.md) sale de los patrones de `familias` (los de presets/familias.json cuando
   se los pasan; si no, FAMILIAS, la misma tabla que docs/presets-catalogo.json). */
export const FAMILIAS = {
  conversacional: ['nano-banana*', 'muse-image', 'mmx-image-01'],
  instrucciones: ['gpt-image-1'],
  'edicion-corta': ['flux-kontext', 'qwen-image-3', 'seedream-4', 'grok-imagine-2', 'nano-banana-fal'],
  descriptiva: ['soul*', 'flux-2*', 'flux-schnell', 'z-image-turbo', 'recraft*', 'ideogram*', 'marketing-studio*', 'grok-image', 'qwen-image-3', 'prueba'],
  veo: ['veo-*'],
  kling: ['kling-*'],
  seedance: ['seedance-*'],
  'minimax-video': ['mmx-h3*', 'minimax-*', 'hailuo-*'],
  'video-generico': ['wan-*', 'ltx-*', 'pixverse-*', 'happy-horse-*', 'grok-imagine-video', 'cinema-studio-4', 'genjutsu-*', 'prueba-video'],
  'musica-minimax': ['mmx-musica-*'],
  'voz-minimax': ['mmx-voz-*'],
};
const globRe = p => new RegExp('^' + String(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
/** La familia de prompt de un modelo: primero un nombre exacto, después un patrón con «*» (en el orden de `familias`), o null.
 *  `familias`: { nombre: [patrones] } o { nombre: { modelos: [patrones] } } (la forma de presets/familias.json). */
export function familiaDe(id, familias = FAMILIAS) {
  const list = Object.entries(familias || {}).map(([k, v]) => [k, Array.isArray(v) ? v : Array.isArray(v?.modelos) ? v.modelos : []]);
  for (const [k, pats] of list) if (pats.includes(id)) return k;
  for (const [k, pats] of list) if (pats.some(p => String(p).includes('*') && globRe(p).test(id))) return k;
  return null;
}
const RATIO_RE = /^\d+:\d+$/;
/** ¿Puede llevar referencias Y fotogramas (inicial/final) en un mismo pedido? Higgsfield: si alguna de sus rutas lo toma.
 *  Veo, MiniMax H3 y el Seedance antiguo eligen uno de los dos (la referencia se pierde): no. La prueba gratis: sí. */
function refYFotogramas(x) {
  if (!(x.roles?.start && x.roles?.reference)) return false;
  if (x.routes) { try { hfRoute(x, { start: 1, reference: 1 }); return true; } catch { return false; } }
  return x.engine === 'prueba';
}
/** Lo que un modelo (su id, su fila de models() o el del catálogo) puede hacer, o null si no existe.
 *  `opts.familias`: los patrones de familia (presets/familias.json); sin ellos, FAMILIAS. */
export function capsOf(m, { familias } = {}) {
  const x = typeof m === 'string' ? model(m) : (m && model(m.id)) || (m && m.id ? m : null);
  if (!x) return null;
  const roles = x.roles || {}, st = x.settings || {}, info = infoOf(x);
  return {
    id: x.id, kind: x.kind, engine: x.engine,
    familia: familiaDe(x.id, familias || FAMILIAS),
    editar: !!x.edit || EDIT_MODELS.includes(x.id),
    maxRefs: roles.reference || 0,
    proporciones: (st.aspectRatio?.values || []).filter(v => RATIO_RE.test(v)),
    tamanos: [...(st.imageSize?.values || st.resolution?.values || [])].filter(Boolean),
    start: (roles.start || 0) > 0, end: (roles.end || 0) > 0,
    video: (roles.video || 0) > 0, maxVideos: roles.video || 0,
    refYFotogramas: refYFotogramas(x),
    transparencia: !!st.background?.values?.includes('transparent'),
    calidad: info.tier, velocidad: info.speed,
    costo: unitCost(x, settingsFor(x)), per: x.per || 'item', ...(x.perChar ? { perChar: x.perChar } : {}),
    necesita: [...(x.needs || [])],
    maxPrompt: x.maxPrompt || 4000,
    ...(x.legacy ? { legacy: true } : {}),
  };
}

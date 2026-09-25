// Agents Office — the ESTUDIO: images and video the agents (and the owner) generate for real.
//
// ENGINES. One is ON when its key is in the Windows environment (set it once: `setx NAME "…"`, then restart the office);
// no key ever lives in a file of this repo:
//   higgsfield — Higgsfield Cloud: Soul, Kling 3, Seedance 2/2.5, Flux 2, Ideogram 4, Recraft, Wan, MiniMax, LTX…  HF_KEY="id:secret"
//                (or HF_API_KEY + HF_API_SECRET; HF_API_BASE_URL overrides https://api.higgsfield.ai)
//   gemini     — Google «Nano Banana»                                               GEMINI_API_KEY
//   grok       — xAI Grok image                                                     XAI_API_KEY
//   openai     — OpenAI gpt-image-1                                                 OPENAI_API_KEY
//   fal        — fal.ai: Flux, Seedream, Nano Banana, Ideogram, Kling, Seedance, Hailuo, Veo   FAL_KEY
//   prueba     — a free local test card: the whole pipeline without spending anything
// MODELS. CATALOG below: each model says its engine, the media it takes (start/end frame, references, a video) and its
// settings. The Higgsfield entries and their request bodies follow open-higgsfield (wide-trace/open-higgsfield,
// src/generation/to-platform.ts and catalog/), the auth and the upload follow Higgsfield's own client (higgsfield-client).
// JOBS. Every generation is a job in data/media-jobs.json that runs in the background: nobody waits on a video. The queue
// engines (Higgsfield, fal video) keep their request ids in the job, so a restart of the office resumes the poll.
// FILES. <brain>/Agents Office/media/YYYY-MM/<name>.<ext> with <name>.json beside it (prompt, model, settings, the media
// it used, cost estimate, who asked, task). Budget: office.config.json → "media": { "dailyLimit": 40, "maxPerRequest": 8 }.
import fs from 'node:fs';
import path from 'node:path';

export const ENGINES = {
  higgsfield: { name: 'Higgsfield', env: 'HF_KEY', site: 'cloud.higgsfield.ai', how: 'setx HF_KEY "tu-id:tu-secreto"' },
  gemini: { name: 'Nano Banana (Google)', env: 'GEMINI_API_KEY', site: 'aistudio.google.com' },
  grok: { name: 'Grok (xAI)', env: 'XAI_API_KEY', site: 'console.x.ai' },
  openai: { name: 'OpenAI', env: 'OPENAI_API_KEY', site: 'platform.openai.com' },
  fal: { name: 'fal.ai', env: 'FAL_KEY', site: 'fal.ai' },
  prueba: { name: 'Prueba (gratis)', env: null },
};
export const NAMES = Object.fromEntries(Object.entries(ENGINES).map(([k, v]) => [k, v.name]));
export const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash-image', grok: 'grok-2-image', openai: 'gpt-image-1' };
const secret = e => {
  if (e === 'prueba') return 'local';
  if (e === 'higgsfield') return process.env.HF_KEY || (process.env.HF_API_KEY && process.env.HF_API_SECRET ? `${process.env.HF_API_KEY}:${process.env.HF_API_SECRET}` : '');
  return process.env[ENGINES[e]?.env] || '';
};
const engineOn = e => !!secret(e);
const HF_BASE = () => (process.env.HF_API_BASE_URL || 'https://api.higgsfield.ai').replace(/\/$/, '');
// the fal.ai and Google addresses can point at a local stand-in (npm run check tests the queues with no key and no spend)
const FAL_RUN = () => process.env.AO_FAL_RUN || 'https://fal.run', FAL_QUEUE = () => process.env.AO_FAL_QUEUE || 'https://queue.fal.run', GEMINI_BASE = () => process.env.AO_GEMINI_BASE || 'https://generativelanguage.googleapis.com';

/* ---------- the catalog ---------- */
const E = (values, def) => ({ type: 'enum', values, default: def ?? values[0] });
const R = (min, max, def, step) => ({ type: 'range', min, max, default: def, ...(step ? { step } : {}) });
const B = def => ({ type: 'boolean', default: def });
const IMG_ASPECT = ['1:1', '4:5', '3:4', '9:16', '16:9', '4:3', '3:2', '2:3'];
const HF_IMG_ASPECT = ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'];
const SOUL_ASPECT = ['9:16', '16:9', '4:3', '3:4', '1:1', '2:3', '3:2'];
const SEEDANCE_ASPECT = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];
const VID_ASPECT = ['16:9', '9:16', '1:1'];

// Higgsfield request bodies — a port of open-higgsfield's mappers. j = { prompt, s: settings, m: { start, end, reference, video, audio } } (URLs)
const HF = {
  soul: p => j => ({ path: p, body: { prompt: j.prompt, batch_size: Number(j.s.batchSize), resolution: j.s.resolution, aspect_ratio: j.s.aspectRatio, enhance_prompt: j.s.enhancePrompt } }),
  klingTurbo: () => j => { const [start] = j.m.start; return { path: start ? 'kling-video/v3.0-turbo/image-to-video' : 'kling-video/v3.0-turbo/text-to-video', body: { prompt: j.prompt, duration: j.s.duration, resolution: j.s.resolution, ...(start ? { image_url: start } : { aspect_ratio: j.s.aspectRatio }) } }; },
  kling3: prefix => j => {
    const [start] = j.m.start, [end] = j.m.end;
    const body = { prompt: j.prompt, sound: j.s.sound ? 'on' : 'off', duration: j.s.duration, cfg_scale: j.s.cfgScale, multi_shots: j.s.multiShots };
    if (start) return { path: `${prefix}/image-to-video`, body: { ...body, image_url: start, ...(end ? { last_image_url: end } : {}) } };
    return { path: `${prefix}/text-to-video`, body: { ...body, aspect_ratio: j.s.aspectRatio } };
  },
  motion: p => j => ({ path: p, body: { prompt: j.prompt, ...(j.m.start[0] ? { image_url: j.m.start[0] } : {}), ...(j.m.video[0] ? { video_url: j.m.video[0] } : {}), keep_original_sound: j.s.keepOriginalSound ? 'yes' : 'no', character_orientation: j.s.characterOrientation } }),
  seedance: prefix => j => {
    const [start] = j.m.start, [end] = j.m.end, refs = j.m.reference, videos = j.m.video, audios = j.m.audio;
    const shared = { prompt: j.prompt, resolution: j.s.resolution, generate_audio: j.s.generateAudio, duration: j.s.duration, ...(j.s.outputFormat ? { output_format: j.s.outputFormat } : {}) };
    if (start) return { path: `${prefix}/image-to-video`, body: { ...shared, image_url: start, ...(end ? { end_image_url: end } : {}) } };
    if (refs.length || videos.length || audios.length) return { path: `${prefix}/reference-to-video`, body: { ...shared, aspect_ratio: j.s.aspectRatio, ...(refs.length ? { image_urls: refs } : {}), ...(videos.length ? { video_urls: videos } : {}), ...(audios.length ? { audio_urls: audios } : {}) } };
    return { path: `${prefix}/text-to-video`, body: { ...shared, aspect_ratio: j.s.aspectRatio } };
  },
  seedanceSource: (p, withDuration) => j => {
    const [video, ...more] = j.m.video;
    return { path: p, body: { prompt: j.prompt, resolution: j.s.resolution, generate_audio: j.s.generateAudio, ...(withDuration ? { duration: j.s.duration } : {}), ...(j.s.outputFormat ? { output_format: j.s.outputFormat } : {}), ...(video ? { video_url: video } : {}), ...(j.m.reference.length ? { image_urls: j.m.reference } : {}), ...(more.length ? { video_urls: more } : {}) } };
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
const soulSet = { aspectRatio: E(SOUL_ASPECT, '1:1'), resolution: E(['720p', '1080p'], '720p'), batchSize: E(['1', '4'], '1'), enhancePrompt: B(false) };
const kling3Set = { aspectRatio: E(VID_ASPECT, '16:9'), duration: R(3, 15, 5), sound: B(true), cfgScale: R(0, 1, 0.5, 0.01), multiShots: B(false) };
const seedanceSet = res => ({ aspectRatio: E(SEEDANCE_ASPECT, '16:9'), duration: R(4, 15, 5), generateAudio: B(true), resolution: E(res, '720p') });
const seedance25Set = { resolution: E(['480p', '720p'], '720p'), generateAudio: B(true), outputFormat: E(['mp4', 'mov'], 'mp4') };
const motionSet = { keepOriginalSound: B(true), characterOrientation: E(['video', 'image'], 'video') };
// fal.ai: images answer at once (fal.run), video goes through the queue (queue.fal.run) and is polled
const FAL_SIZE = { '1:1': 'square_hd', '4:5': 'portrait_4_3', '3:4': 'portrait_4_3', '2:3': 'portrait_4_3', '9:16': 'portrait_16_9', '16:9': 'landscape_16_9', '4:3': 'landscape_4_3', '3:2': 'landscape_4_3' };
const falImg = (id, name, cost, text, edit, maxRefs, note, extra = s => ({})) => ({ id, engine: 'fal', kind: 'image', name, cost, note, roles: edit ? { reference: maxRefs } : {}, settings: { aspectRatio: E(IMG_ASPECT, '1:1') },
  fal: j => j.m.reference.length && edit ? { path: edit, body: { prompt: j.prompt, num_images: j.n, ...(maxRefs === 1 ? { image_url: j.m.reference[0] } : { image_urls: j.m.reference }), ...extra(j.s) } } : { path: text, body: { prompt: j.prompt, num_images: j.n, ...extra(j.s) } } });

const CATALOG = [
  // ---- images
  { id: 'nano-banana', engine: 'gemini', kind: 'image', name: 'Nano Banana', cost: 0.039, note: 'Edita y mezcla fotos: dale hasta 3 referencias (tu producto, tu logo, un estilo).', roles: { reference: 3 }, settings: { aspectRatio: E(['1:1', '4:5', '3:4', '9:16', '16:9', '4:3', '3:2', '2:3', '21:9'], '1:1') } },
  { id: 'soul-2', engine: 'higgsfield', kind: 'image', name: 'Soul 2', cost: 0.03, note: 'Fotos con estética de moda y redes, la firma de Higgsfield.', roles: {}, settings: soulSet, hf: HF.soul('higgsfield-ai/soul/v2/standard') },
  { id: 'soul-cinema', engine: 'higgsfield', kind: 'image', name: 'Soul Cinema', cost: 0.05, note: 'Fotogramas de cine: luz y encuadre de película.', roles: {}, settings: soulSet, hf: HF.soul('higgsfield-ai/soul/cinema') },
  hfImage('flux-2', 'Flux 2 Pro', 'flux-2-pro', 0.05, 'Realismo y detalle; acepta hasta 8 referencias.'),
  hfImage('ideogram-4', 'Ideogram 4', 'ideogram/v4.0', 0.06, 'El mejor para TEXTO legible dentro de la imagen (carteles, posts con título).'),
  hfImage('recraft-4.1', 'Recraft 4.1', 'recraft/v4.1/text-to-image', 0.04, 'Diseño gráfico, ilustración y vector.'),
  hfImage('grok-imagine-2', 'Grok Imagine 2', 'xai/grok-imagine-image-2.0', 0.04),
  hfImage('qwen-image-3', 'Qwen Image 3', 'alibaba/qwen-image-3/text-to-image', 0.03),
  hfImage('z-image-turbo', 'Z-Image Turbo', 'z-image/turbo', 0.01, 'Rapidísimo y barato: para bocetos y lotes grandes.'),
  { id: 'gpt-image-1', engine: 'openai', kind: 'image', name: 'GPT Image', cost: 0.042, note: 'Sigue instrucciones largas y escribe texto; edita con referencias.', roles: { reference: 4 }, settings: { aspectRatio: E(['1:1', '3:2', '2:3'], '1:1'), quality: E(['low', 'medium', 'high'], 'medium') } },
  { id: 'grok-image', engine: 'grok', kind: 'image', name: 'Grok Image', cost: 0.07, roles: {}, settings: {} },
  falImg('nano-banana-fal', 'Nano Banana (fal)', 0.039, 'fal-ai/nano-banana', 'fal-ai/nano-banana/edit', 3, 'Nano Banana a través de tu key de fal.ai.', s => ({ aspect_ratio: s.aspectRatio })),
  falImg('seedream-4', 'Seedream 4', 0.03, 'fal-ai/bytedance/seedream/v4/text-to-image', 'fal-ai/bytedance/seedream/v4/edit', 4, 'ByteDance: alta resolución, edita con referencias.', s => ({ image_size: FAL_SIZE[s.aspectRatio] || 'square_hd' })),
  falImg('flux-kontext', 'Flux Kontext', 0.04, 'fal-ai/flux-pro/kontext/text-to-image', 'fal-ai/flux-pro/kontext', 1, 'Cambia una imagen con una frase («ponle fondo de playa»).', s => ({ aspect_ratio: s.aspectRatio })),
  falImg('flux-schnell', 'Flux Schnell', 0.003, 'fal-ai/flux/schnell', null, 0, 'El más barato: para probar ideas en lote.', s => ({ image_size: FAL_SIZE[s.aspectRatio] || 'square_hd' })),
  falImg('ideogram-3-fal', 'Ideogram 3 (fal)', 0.06, 'fal-ai/ideogram/v3', null, 0, 'Texto legible dentro de la imagen.', s => ({ image_size: FAL_SIZE[s.aspectRatio] || 'square_hd' })),
  // V4.2: an image takes references only — no real image model has a first or last frame; the free test card used to ask for them and looked like a video form
  { id: 'prueba', engine: 'prueba', kind: 'image', name: 'Prueba (gratis)', cost: 0, note: 'Una tarjeta con tu prompt, no una imagen real: prueba el Estudio sin gastar.', roles: { reference: 8 }, settings: { aspectRatio: E(IMG_ASPECT, '1:1') } },
  // ---- video
  { id: 'kling-3-std', engine: 'higgsfield', kind: 'video', name: 'Kling 3.0', cost: 0.08, per: 's', note: 'El equilibrio: buena calidad, sonido, imagen inicial y final.', roles: { start: 1, end: 1 }, settings: kling3Set, hf: HF.kling3('kling-video/v3.0/std') },
  { id: 'kling-3-pro', engine: 'higgsfield', kind: 'video', name: 'Kling 3.0 Pro', cost: 0.11, per: 's', roles: { start: 1, end: 1 }, settings: kling3Set, hf: HF.kling3('kling-video/v3.0/pro') },
  { id: 'kling-3-4k', engine: 'higgsfield', kind: 'video', name: 'Kling 3.0 4K', cost: 0.2, per: 's', roles: { start: 1, end: 1 }, settings: kling3Set, hf: HF.kling3('kling-video/v3.0/4k') },
  { id: 'kling-3-turbo', engine: 'higgsfield', kind: 'video', name: 'Kling 3.0 Turbo', cost: 0.06, per: 's', note: 'El más rápido de Kling 3.', roles: { start: 1 }, settings: { aspectRatio: E(VID_ASPECT, '16:9'), resolution: E(['720p', '1080p'], '720p'), duration: R(3, 15, 5) }, hf: HF.klingTurbo() },
  { id: 'seedance-2', engine: 'higgsfield', kind: 'video', name: 'Seedance 2.0', cost: 0.1, per: 's', note: 'Hasta 9 referencias (personaje, producto, estilo) y audio.', roles: { start: 1, end: 1, reference: 9, video: 3 }, settings: seedanceSet(['480p', '720p', '1080p', '4k']), hf: HF.seedance('bytedance/seedance-2.0') },
  { id: 'seedance-2-fast', engine: 'higgsfield', kind: 'video', name: 'Seedance 2.0 Fast', cost: 0.06, per: 's', roles: { start: 1, end: 1, reference: 9, video: 3 }, settings: seedanceSet(['480p', '720p']), hf: HF.seedance('bytedance/seedance-2.0/fast') },
  { id: 'seedance-2-mini', engine: 'higgsfield', kind: 'video', name: 'Seedance 2.0 Mini', cost: 0.04, per: 's', roles: { start: 1, end: 1, reference: 9, video: 3 }, settings: seedanceSet(['480p', '720p']), hf: HF.seedance('bytedance/seedance-2.0/mini') },
  { id: 'seedance-2.5', engine: 'higgsfield', kind: 'video', name: 'Seedance 2.5', cost: 0.1, per: 's', note: 'Hasta 30 s, audio, muchas referencias.', roles: { start: 1, end: 1, reference: 30, video: 10 }, settings: { aspectRatio: E(SEEDANCE_ASPECT, '16:9'), duration: R(4, 30, 5), ...seedance25Set }, hf: HF.seedance('bytedance/seedance-2.5') },
  { id: 'seedance-2.5-edit', engine: 'higgsfield', kind: 'video', name: 'Seedance 2.5 · Editar video', cost: 0.1, per: 's', note: 'Cambia un video existente con una frase.', needs: ['video'], roles: { video: 1, reference: 30 }, settings: seedance25Set, hf: HF.seedanceSource('bytedance/seedance-2.5/video-edit', false) },
  { id: 'seedance-2.5-extend', engine: 'higgsfield', kind: 'video', name: 'Seedance 2.5 · Alargar video', cost: 0.1, per: 's', note: 'Continúa un video existente.', needs: ['video'], roles: { video: 1, reference: 30 }, settings: { duration: R(4, 30, 5), ...seedance25Set }, hf: HF.seedanceSource('bytedance/seedance-2.5/video-extend', true) },
  { id: 'kling-3-motion', engine: 'higgsfield', kind: 'video', name: 'Kling 3 · Copiar movimiento', cost: 0.1, per: 's', note: 'Tu personaje (imagen) hace el movimiento de un video.', needs: ['start', 'video'], roles: { start: 1, video: 1 }, settings: motionSet, hf: HF.motion('kling-video/v3/motion-control/std') },
  { ...hfVideo('kling-o3', 'Kling O3 · Primer y último fotograma', { start: 1, end: 1 }, { firstLast: 'kling-video/o3/first-last-frame' }, 0.1, 'Une dos imágenes con un movimiento.'), needs: ['start'] }, // its only route is first-last: without a frame it has nothing to take
  hfVideo('kling-2.6', 'Kling 2.6 Pro', { start: 1 }, t2v('kling-video/v2.6/pro/text-to-video'), 0.07),
  hfVideo('minimax-hailuo-2.3', 'MiniMax Hailuo 2.3', { start: 1 }, t2v('minimax/hailuo-2.3/standard/text-to-video'), 0.045),
  hfVideo('wan-3', 'Wan 3.0', { start: 1 }, t2v('alibaba/wan-3.0/text-to-video'), 0.05),
  hfVideo('ltx-2.5-pro', 'LTX 2.5 Pro', {}, t2v('lightricks/ltx-2.5/text-to-video/pro'), 0.06), // text only: its route takes no first frame (open-higgsfield offers one and drops it)
  hfVideo('pixverse-6', 'PixVerse 6', { start: 1 }, t2v('pixverse/v6/text-to-video'), 0.05),
  hfVideo('grok-imagine-video', 'Grok Imagine Video 1.5', { reference: 8, video: 3 }, { reference: 'xai/grok-imagine-video/v1.5/reference-to-video' }, 0.05),
  // V4.2 (25 Sep 2026): the twelve models open-higgsfield (b16a0ef) lists that we did not — same paths, same shared mapper. Their prices
  // are estimates until the owner sees Higgsfield's own: the note says so.
  { id: 'kling-3-motion-pro', engine: 'higgsfield', kind: 'video', name: 'Kling 3 Pro · Copiar movimiento', cost: 0.15, per: 's', note: 'Como Copiar movimiento, con más calidad. Precio aproximado.', needs: ['start', 'video'], roles: { start: 1, video: 1 }, settings: motionSet, hf: HF.motion('kling-video/v3/motion-control/pro') },
  { ...hfVideo('kling-o1', 'Kling O1 · Primer y último fotograma', { start: 1, end: 1 }, { firstLast: 'kling-video/omni/first-last-frame' }, 0.1, 'Kling Omni: une una imagen inicial (y una final) con un movimiento. Precio aproximado.'), needs: ['start'] },
  { ...hfVideo('kling-2.5', 'Kling 2.5 Turbo · Anima una foto', { start: 1 }, { image: 'kling-video/v2.5-turbo/standard/image-to-video' }, 0.05, 'Barato y rápido para animar una imagen. Precio aproximado.'), needs: ['start'] },
  hfVideo('wan-2.6', 'Wan 2.6', { start: 1 }, t2v('wan/v2.6/text-to-video'), 0.04, 'Económico; texto o una imagen inicial. Precio aproximado.'),
  hfVideo('wan-2.7', 'Wan 2.7', { start: 1 }, t2v('wan/v2.7/text-to-video'), 0.045, 'Texto o una imagen inicial. Precio aproximado.'),
  hfVideo('wan-3-prime', 'Wan 3.0 Prime', { start: 1 }, t2v('alibaba/wan-3.0-prime/text-to-video'), 0.07, 'La versión alta de Wan 3. Precio aproximado.'),
  hfVideo('minimax-h3', 'MiniMax H3', { start: 1 }, t2v('minimax/h3/text-to-video'), 0.06, 'Texto o una imagen inicial. Precio aproximado.'),
  hfVideo('ltx-2.5-fast', 'LTX 2.5 Fast', {}, t2v('lightricks/ltx-2.5/text-to-video/fast'), 0.03, 'Rápido y barato; solo texto. Precio aproximado.'), // text only, as LTX 2.5 Pro
  hfVideo('happy-horse-1', 'Happy Horse 1.0', { start: 1 }, t2v('alibaba/happy-horse/text-to-video'), 0.04, 'De Alibaba; texto o una imagen inicial. Precio aproximado.'),
  hfVideo('happy-horse-1.1', 'Happy Horse 1.1', { start: 1 }, t2v('alibaba/happy-horse/v1.1/text-to-video'), 0.045, 'La versión nueva de Happy Horse. Precio aproximado.'),
  hfVideo('flux-3', 'Flux 3 (video)', { start: 1 }, t2v('blackforestlabs/flux-3/text-to-video'), 0.06, 'El video de Black Forest Labs; texto o una imagen inicial. Precio aproximado.'),
  { ...hfVideo('dop', 'DoP · Anima una foto', { start: 1 }, { image: 'higgsfield-ai/dop/lite' }, 0.05, 'Movimientos de cámara sobre una foto tuya.'), needs: ['start'] },
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
const PREFER = { image: ['nano-banana', 'soul-2', 'nano-banana-fal', 'gpt-image-1', 'seedream-4', 'flux-2', 'flux-schnell', 'grok-image'], video: ['kling-3-std', 'seedance-2-fast', 'kling-2.5-fal', 'seedance-1-fal', 'hailuo-02-fal'] };

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
  return MODELS.map(x => ({ id: x.id, engine: x.engine, engineName: ENGINES[x.engine].name, kind: x.kind, name: x.name, note: x.note || '', cost: x.cost, per: x.per || 'item', seconds: x.seconds || null, roles: x.roles || {}, needs: x.needs || [], settings: x.settings || {}, on: engineOn(x.engine) }));
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

/* ---------- budget: a count per day, kept in data/ (a video weighs 5 images) ---------- */
const today = () => new Date().toISOString().slice(0, 10);
const weightOf = (kind, n) => (kind === 'video' ? 5 : 1) * n;
function usage() { try { const u = JSON.parse(fs.readFileSync(usageFile, 'utf8')); return u.day === today() ? u : { day: today(), images: 0, videos: 0, cost: 0 }; } catch { return { day: today(), images: 0, videos: 0, cost: 0 }; } }
function spend(kind, n, cost) { const u = usage(); u[kind] += n; u.cost = +(u.cost + cost).toFixed(3); fs.mkdirSync(path.dirname(usageFile), { recursive: true }); fs.writeFileSync(usageFile, JSON.stringify(u)); return u; }
export function budget() {
  const u = usage(), reserved = JOBS.filter(j => (j.state === 'queued' || j.state === 'running') && j.engine !== 'prueba').reduce((s, j) => s + Math.max(0, j.weight - weightOf(j.kind, j.items.length)), 0);
  return { ...u, limit: cfg.dailyLimit, reserved, left: Math.max(0, cfg.dailyLimit - u.images - u.videos * 5 - reserved), maxPerRequest: cfg.maxPerRequest };
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
function store(buf, ext, meta) {
  const d = new Date(), sub = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const folder = path.join(root, sub); fs.mkdirSync(folder, { recursive: true });
  let base = `${sub}-${String(d.getDate()).padStart(2, '0')} ${slug(meta.prompt)}`, name = base;
  for (let n = 2; fs.existsSync(path.join(folder, name + '.' + ext)) || fs.existsSync(path.join(folder, name + '.json')); n++) name = `${base}-${n}`;
  fs.writeFileSync(path.join(folder, name + '.' + ext), buf);
  const rel = `${sub}/${name}.${ext}`, wh = dims(buf, ext);
  const item = { id: rel, file: rel, kind: ext === 'mp4' || ext === 'webm' ? 'video' : 'image', ext, at: Date.now(), ...(wh ? { w: wh[0], h: wh[1] } : {}), ...meta };
  fs.writeFileSync(path.join(folder, name + '.json'), JSON.stringify(item, null, 2));
  return item;
}
/** Everything in the studio, newest first (reads the .json sidecars). */
export function list({ limit = 600 } = {}) {
  const out = [];
  if (!root || !fs.existsSync(root)) return out;
  for (const sub of fs.readdirSync(root).filter(x => /^\d{4}-\d{2}$/.test(x)).sort().reverse()) {
    for (const f of fs.readdirSync(path.join(root, sub)).filter(x => x.endsWith('.json'))) {
      try { const it = JSON.parse(fs.readFileSync(path.join(root, sub, f), 'utf8')); if (fs.existsSync(path.join(root, it.file))) out.push(it); } catch {}
    }
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}
const FILE_RE = /^\d{4}-\d{2}\/[^/\\]+\.(png|jpe?g|webp|svg|mp4|webm)$/i;
/** A path inside the studio, or null (never outside it: the id comes from the request). */
export function resolve(id) {
  const rel = String(id || '').replace(/\\/g, '/');
  if (!FILE_RE.test(rel) || rel.includes('..')) return null;
  const p = path.join(root, rel); return fs.existsSync(p) ? p : null;
}
export function item(id) { const p = resolve(id); if (!p) return null; try { return JSON.parse(fs.readFileSync(p.replace(/\.[^.]+$/, '.json'), 'utf8')); } catch { return null; } }
export function update(id, patch) { const p = resolve(id); if (!p) return null; const j = p.replace(/\.[^.]+$/, '.json'); const it = JSON.parse(fs.readFileSync(j, 'utf8')); Object.assign(it, patch); fs.writeFileSync(j, JSON.stringify(it, null, 2)); return it; }
/** To <media>/.papelera (emptied after 30 days). Returns what `restore` needs to bring it back, or null. */
export function trash(id) {
  const p = resolve(id); if (!p) return null;
  const bin = path.join(root, '.papelera'); fs.mkdirSync(bin, { recursive: true });
  const stamp = Date.now(), names = [];
  for (const f of [p, p.replace(/\.[^.]+$/, '.json')]) if (fs.existsSync(f)) { const nm = `${stamp}-${path.basename(f)}`; fs.renameSync(f, path.join(bin, nm)); names.push(nm); }
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
  return true;
}
/* uploads: the owner's own photos and videos, to use as a reference or a first frame (never svg: it could carry script) */
const UPLOAD = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' };
const MAGIC = { png: b => b.length > 8 && b.readUInt32BE(0) === 0x89504E47, jpg: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF, webp: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP', mp4: b => b.toString('ascii', 4, 8) === 'ftyp', webm: b => b.length > 4 && b.readUInt32BE(0) === 0x1A45DFA3 };
export function upload({ name, data } = {}) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(data || ''));
  if (!m) throw new Error('el archivo no llegó bien');
  const ext = UPLOAD[m[1].toLowerCase()]; if (!ext) throw new Error('solo PNG, JPG, WEBP, MP4 o WEBM');
  const buf = Buffer.from(m[2], 'base64');
  if (!MAGIC[ext](buf)) throw new Error('el archivo no es lo que dice ser');
  if (buf.length > (ext === 'mp4' || ext === 'webm' ? 25 : 12) * 1024 * 1024) throw new Error(ext === 'mp4' || ext === 'webm' ? 'el video pasa de 25 MB' : 'la imagen pasa de 12 MB');
  const title = String(name || 'subida').replace(/\.[^.]+$/, '').slice(0, 80) || 'subida';
  return store(buf, ext, { prompt: title, provider: 'subida', model: '', by: 'you', upload: true, agent: null, task: null });
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
    catch (e) { if (e.final || ++misses >= 3) throw e; }
  }
}
const final = e => Object.assign(e, { final: true });

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
    const refs = inputFiles(job).reference.map(f => ({ inlineData: { mimeType: f.mime, data: fs.readFileSync(f.p).toString('base64') } }));
    for (let i = 0; i < job.n; i++) {
      if (job.cancel) throw new Error('Cancelado por ti.');
      const j = await http(`${GEMINI_BASE()}/v1beta/models/${encodeURIComponent(cfg.models.gemini)}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': secret('gemini') },
        body: JSON.stringify({ contents: [{ parts: [{ text: job.prompt }, ...refs] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: job.s.aspectRatio } } }),
      }, 'Nano Banana');
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
      for (const u of outs) { const r = await fromUrl(u); ctx.add(r.buf, extOf(r.mime, u, m.kind === 'video' ? 'mp4' : 'png')); }
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
  for (const [role, max] of Object.entries(m.roles || {})) { const ids = (req.media?.[role] || []).filter(x => typeof x === 'string').slice(0, max); for (const x of ids) { if (!resolve(x)) throw new Error(`no encuentro «${x}» en el Estudio`); if (m.engine !== 'prueba' && /\.svg$/i.test(x)) throw new Error('una tarjeta de prueba no sirve de referencia para un motor real: usa una imagen generada o subida'); if (role === 'video' ? !/\.(mp4|webm)$/i.test(x) : /\.(mp4|webm)$/i.test(x)) throw new Error(role === 'video' ? 'ahí va un video' : 'ahí va una imagen, no un video'); } if (ids.length) media[role] = ids; }
  for (const r of m.needs || []) if (!media[r]?.length) throw new Error(`${m.name} necesita ${{ start: 'una imagen inicial', video: 'un video de origen' }[r] || r}`);
  const s = settingsFor(m, req.settings || {}, { ratio: req.ratio, seconds: req.seconds });
  const per = m.hf && s.batchSize ? Number(s.batchSize) : 1, weight = weightOf(m.kind, n * per);
  const b = budget(); if (m.engine !== 'prueba' && weight > b.left) throw new Error(`tope diario alcanzado: quedan ${b.left} de ${b.limit} (office.config.json → media.dailyLimit)`);
  const j = { id: jid(), state: 'queued', kind: m.kind, model: m.id, engine: m.engine, prompt, n, s, media, weight, by: req.by === 'agent' ? 'agent' : 'you', agent: req.agent || null, task: req.task || null, at: Date.now(), items: [], cost: 0, unit: unitCost(m, s) * per, retryOf: req.retryOf || undefined };
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
    const it = store(buf, ext, { prompt: j.prompt, provider: j.engine, model: j.model, modelName: m?.name || j.model, ratio: j.s.aspectRatio || null, settings: j.s, media: Object.keys(j.media).length ? j.media : undefined, cost: j.unit, by: j.by, agent: j.agent, task: j.task, job: j.id, ...extra });
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

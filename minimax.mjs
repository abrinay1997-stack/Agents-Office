// Agents Office — MiniMax: a client for the whole MiniMax platform the Estudio uses (V4.10, 30 Sep 2026).
//
// ONE engine, ONE key: platform.minimax.io → API Keys. In Windows, once:  setx MINIMAX_API_KEY "tu-key"  (then restart the office).
// Optional: MINIMAX_GROUP_ID (only if an old account still asks for ?GroupId=…), MINIMAX_API_BASE (another host — the tests point
// it at a local stand-in; default https://api.minimax.io). The key never lives in a file and never goes back in an answer.
//
// Every route below was read in MiniMax's own documentation on 30 Sep 2026 (docs/minimax/api-verificada.md, with the URL of each):
//   image  POST /v1/image_generation           image-01 · subject_reference (one face, JPG/PNG) · we ask for base64 (no URL to expire)
//   video  POST /v2/video_generation           MiniMax-H3 / H3-Max · content[] (text + first/last frame OR references, never both)
//          GET  /v2/query/video_generation/{id} queued · running · succeeded · failed · cancelled → task.content.url (expires)
//          DELETE /v2/video_generation/{id}    cancels a task still queued (nothing is charged)
//   voice  POST /v1/t2a_v2                     speech-2.8/2.6/02 hd|turbo → data.audio in HEX
//   music  POST /v1/music_generation           music-3.0 (paid; closed to new users since 20 Aug 2026) · music-3.0-free → data.audio in HEX
//   files  POST /v1/files/upload               multipart purpose + file → file.file_id (an int64: read from the raw text, never a JS number)
//   clone  POST /v1/voice_clone                file_id + voice_id (+ text/model → demo_audio URL) · 2038 = the account may not clone
//   design POST /v1/voice_design               prompt + preview_text → voice_id + trial_audio (HEX)
//          POST /v1/get_voice · POST /v1/delete_voice
// MiniMax may answer HTTP 200 with base_resp.status_code ≠ 0: both are checked, and every error reads in Spanish for the owner.
import fs from 'node:fs';

export const MINIMAX = { name: 'MiniMax', env: 'MINIMAX_API_KEY', site: 'platform.minimax.io', how: 'setx MINIMAX_API_KEY "tu-key"' };
const BASE = () => (process.env.MINIMAX_API_BASE || 'https://api.minimax.io').replace(/\/$/, '');
const KEY = () => process.env.MINIMAX_API_KEY || '';
const GROUP = () => process.env.MINIMAX_GROUP_ID || '';
export const minimaxOn = () => !!KEY();
const qs = () => (GROUP() ? `?GroupId=${encodeURIComponent(GROUP())}` : '');

export class MinimaxError extends Error {
  constructor(msg, { status = 0, code = 0, final = false } = {}) { super(msg); this.name = 'MinimaxError'; this.status = status; this.code = code; if (final) this.final = true; }
}
/** What the owner reads for a MiniMax error code (base_resp.status_code, docs/api-reference/errorcode). */
export function explain(code, msg = '') {
  const m = String(msg || '').slice(0, 160);
  switch (+code) {
    case 1004: case 2049: return 'la key de MiniMax no es válida: revisa MINIMAX_API_KEY y reinicia la oficina';
    case 1008: return 'tu cuenta de MiniMax no tiene saldo: recarga en platform.minimax.io';
    case 1002: case 1041: case 2045: return 'MiniMax pide esperar un poco (demasiadas peticiones); reintenta en un minuto';
    case 1039: case 2056: return 'llegaste al límite de uso de tu cuenta de MiniMax';
    case 1001: return 'MiniMax no respondió a tiempo; reintenta';
    case 1026: return 'MiniMax rechazó el texto por su filtro de contenido sensible; cambia el prompt';
    case 1027: return 'MiniMax bloqueó el resultado por su filtro de contenido sensible; cambia el prompt';
    case 1042: return 'el texto tiene demasiados caracteres invisibles; pégalo de nuevo como texto plano';
    case 2037: return 'el audio para clonar debe durar entre 10 segundos y 5 minutos';
    case 2038: return 'tu cuenta de MiniMax no tiene permiso para clonar voces: verifica la cuenta en platform.minimax.io';
    case 2039: return 'ese nombre de voz (voiceId) ya existe en MiniMax: elige otro';
    case 2042: return 'tu cuenta no tiene acceso a esa voz (voiceId)';
    case 20132: return 'esa voz (voiceId) no existe en MiniMax, o la muestra no sirve';
    case 2048: return 'el audio de muestra es demasiado largo';
    case 2013: return `MiniMax no aceptó los datos${m ? ': ' + m : ''}`;
    default: return '';
  }
}
const FINAL_CODES = new Set([1004, 2049, 1008, 1026, 1027, 1042, 2013, 2037, 2038, 2039, 2042, 20132, 2048, 1039, 2056]); // asking again will not help
function fail(what, httpStatus, code, msg) {
  const known = explain(code, msg);
  const words = known || (httpStatus === 401 ? 'la key de MiniMax no es válida: revisa MINIMAX_API_KEY y reinicia la oficina'
    : httpStatus === 429 ? 'MiniMax pide esperar un poco (demasiadas peticiones); reintenta en un minuto'
    : /closed|no longer available|new users/i.test(msg) ? 'esa API de MiniMax ya no acepta cuentas nuevas (desde el 20 ago 2026): usa el modelo «gratis»'
    : `${code || httpStatus} ${String(msg || '').slice(0, 200)}`.trim());
  // status stays 0 when the words are already ours: media.friendly() would wrap a 401 in its own sentence a second time
  return new MinimaxError(`${what}: ${words}`, { status: known || httpStatus === 401 || httpStatus === 429 ? 0 : httpStatus, code, final: FINAL_CODES.has(+code) || httpStatus === 401 || httpStatus === 400 || httpStatus === 404 });
}
async function call(method, path, { body, form, what, timeout = 180000, raw = false } = {}) {
  if (!KEY()) throw new MinimaxError(`${what}: MiniMax no tiene key; guárdala con  ${MINIMAX.how}  y reinicia la oficina`, { final: true });
  const headers = { authorization: `Bearer ${KEY()}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  let r;
  try { r = await fetch(`${BASE()}${path}${qs()}`, { method, headers, body: form || (body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)), signal: AbortSignal.timeout(timeout) }); }
  catch (e) { throw new MinimaxError(`${what}: no pude hablar con MiniMax (${/timeout|abort/i.test(e.message) ? 'no respondió a tiempo' : e.message})`); }
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
  const br = j && j.base_resp;
  if (!r.ok || (br && +br.status_code !== 0)) throw fail(what, r.status, br ? +br.status_code : 0, (br && br.status_msg) || j?.error?.message || j?.message || text.slice(0, 200));
  return raw ? { j, text } : j;
}
const hexBuf = h => Buffer.from(String(h || ''), 'hex');
/** Downloads a result URL (a video's expires: fetch it at once). */
export async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new MinimaxError('no pude descargar el resultado de MiniMax: ' + r.status, { status: r.status });
  return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') || '' };
}

/* ======================= IMAGE — image-01 ======================= */
export const IMAGE_RATIOS = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9'];
/** Text → image, or with subjectRef (a data URI or public URL of ONE face, JPG/PNG) the same person in a new scene. → [Buffer] */
export async function image({ prompt, model = 'image-01', aspectRatio = '1:1', n = 1, promptOptimizer = false, subjectRef = null, seed = null } = {}) {
  const body = { model, prompt: String(prompt || '').slice(0, 1500), aspect_ratio: IMAGE_RATIOS.includes(aspectRatio) ? aspectRatio : '1:1', response_format: 'base64', n: Math.max(1, Math.min(9, +n || 1)), prompt_optimizer: !!promptOptimizer };
  if (seed != null && Number.isInteger(+seed)) body.seed = +seed;
  if (subjectRef) body.subject_reference = [{ type: 'character', image_file: subjectRef }];
  const j = await call('POST', '/v1/image_generation', { body, what: 'MiniMax imagen' });
  const b64 = j.data?.image_base64 || [];
  if (b64.length) return b64.map(x => Buffer.from(x, 'base64'));
  const urls = j.data?.image_urls || [];
  if (!urls.length) throw new MinimaxError('MiniMax imagen: no devolvió imágenes' + (j.metadata?.failed_count ? ` (${j.metadata.failed_count} fallaron; puede ser su filtro de contenido)` : ''), { final: true });
  const out = []; for (const u of urls) out.push((await fetchBuf(u)).buf); return out;
}

/* ======================= VIDEO — MiniMax-H3 / H3-Max (v2, asynchronous) ======================= */
/** content[] for /v2/video_generation. First/last frame and references exclude each other (MiniMax's rule): with a frame, the references stay out. */
export function videoContent({ prompt, start = null, end = null, references = [], videos = [] } = {}) {
  const c = [{ type: 'text', text: String(prompt || '').slice(0, 7000) }];
  if (start || end) {
    if (start) c.push({ type: 'image_url', image_url: { url: start }, role: 'first_frame' });
    if (end) c.push({ type: 'image_url', image_url: { url: end }, role: 'last_frame' });
    return c;
  }
  for (const u of references.slice(0, 9)) c.push({ type: 'image_url', image_url: { url: u }, role: 'reference_image' });
  for (const u of videos.slice(0, 3)) c.push({ type: 'video_url', video_url: { url: u }, role: 'reference_video' });
  return c;
}
/** Queues a video → task_id (a string). */
export async function createVideo({ model = 'MiniMax-H3', content, resolution = '768P', duration = 5, ratio = null, promptExpansion = null } = {}) {
  if (!Array.isArray(content) || !content.some(c => c.type === 'text' && c.text)) throw new MinimaxError('MiniMax video: falta el prompt', { final: true });
  const body = { model, content, resolution, duration: Math.round(+duration) || 5 };
  if (ratio) body.ratio = ratio;
  if (promptExpansion) body.extra = { prompt_expansion_mode: promptExpansion };
  const { j, text } = await call('POST', '/v2/video_generation', { body, what: 'MiniMax video', raw: true });
  const id = (/"task_id"\s*:\s*"?(\w+)"?/.exec(text) || [])[1] || j?.task?.id; // an id may be a long integer: kept as text
  if (!id) throw new MinimaxError('MiniMax video: no devolvió el número de la tarea');
  return String(id);
}
const VIDEO_STATE = { queued: 'queued', running: 'running', succeeded: 'succeeded', failed: 'failed', cancelled: 'cancelled', canceled: 'cancelled' };
/** → { state: queued|running|succeeded|failed|cancelled, url, error } */
export async function queryVideo(taskId) {
  const j = await call('GET', `/v2/query/video_generation/${encodeURIComponent(taskId)}`, { what: 'MiniMax video (consulta)', timeout: 60000 });
  const t = j.task || j;
  return { state: VIDEO_STATE[String(t.status || '').toLowerCase()] || 'running', url: t.content?.url || null, error: t.error ? (explain(t.error.code, t.error.message) || t.error.message || String(t.error.code)) : null };
}
/** Cancels a task still in the queue (MiniMax refuses one already running). Best effort: true when it was cancelled. */
export async function cancelVideo(taskId) {
  try { await call('DELETE', `/v2/video_generation/${encodeURIComponent(taskId)}`, { what: 'MiniMax video (cancelar)', timeout: 15000 }); return true; } catch { return false; }
}

/* ======================= VOICE / TTS ======================= */
export const EMOTIONS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'];
/** text (< 10,000 characters) → { buf, ext, seconds, chars }. voiceId: a system voice (Spanish_Narrator…) or one of yours. */
export async function tts({ text, model = 'speech-2.8-hd', voiceId = 'Spanish_Narrator', speed = 1, vol = 1, pitch = 0, emotion = null, languageBoost = 'auto', format = 'mp3', sampleRate = 32000, bitrate = 128000, channel = 1 } = {}) {
  const t = String(text || '').trim(); if (!t) throw new MinimaxError('MiniMax voz: falta el texto', { final: true });
  const voice_setting = { voice_id: String(voiceId || 'Spanish_Narrator'), speed: Number(speed) || 1, vol: Number(vol) || 1, pitch: Math.round(Number(pitch) || 0) };
  if (emotion && EMOTIONS.includes(emotion)) voice_setting.emotion = emotion;
  const audio_setting = { sample_rate: sampleRate, format, channel, ...(format === 'mp3' ? { bitrate } : {}) };
  const j = await call('POST', '/v1/t2a_v2', { body: { model, text: t.slice(0, 9999), stream: false, output_format: 'hex', language_boost: languageBoost || 'auto', voice_setting, audio_setting }, what: 'MiniMax voz' });
  if (!j.data?.audio) throw new MinimaxError('MiniMax voz: no devolvió audio');
  return { buf: hexBuf(j.data.audio), ext: j.extra_info?.audio_format || format, seconds: j.extra_info?.audio_length ? +(j.extra_info.audio_length / 1000).toFixed(1) : null, chars: j.extra_info?.usage_characters ?? t.length };
}

/* ======================= MUSIC ======================= */
/** Instrumental: prompt (1–2000). Sung: lyrics (1–3500, [Verse] [Chorus]…) and an optional style prompt. → { buf, ext, seconds } */
export async function music({ prompt = '', lyrics = '', model = 'music-3.0', instrumental = false, format = 'mp3', sampleRate = 44100, bitrate = 256000 } = {}) {
  const p = String(prompt || '').trim().slice(0, 2000), l = String(lyrics || '').trim().slice(0, 3500);
  if (instrumental && !p) throw new MinimaxError('MiniMax música: una pieza instrumental necesita una descripción', { final: true });
  if (!instrumental && !l) throw new MinimaxError('MiniMax música: una canción necesita la letra (o márcala instrumental)', { final: true });
  const body = { model, stream: false, output_format: 'hex', is_instrumental: !!instrumental, audio_setting: { sample_rate: sampleRate, bitrate, format } };
  if (p) body.prompt = p;
  if (!instrumental) body.lyrics = l;
  const j = await call('POST', '/v1/music_generation', { body, what: 'MiniMax música', timeout: 600000 });
  if (!j.data?.audio) throw new MinimaxError('MiniMax música: no devolvió audio');
  return { buf: hexBuf(j.data.audio), ext: format, seconds: j.extra_info?.music_duration ? +(j.extra_info.music_duration / 1000).toFixed(1) : null };
}

/* ======================= FILES ======================= */
export const PURPOSES = ['voice_clone', 'prompt_audio', 't2a_async_input', 'video_understanding', 'video_generation_input'];
/** Uploads a file (multipart) → its file_id as a STRING of digits (an int64 does not fit a JavaScript number). */
export async function uploadFile(buf, filename, purpose) {
  if (!PURPOSES.includes(purpose)) throw new MinimaxError('MiniMax: propósito de archivo desconocido', { final: true });
  const fd = new FormData(); fd.append('purpose', purpose); fd.append('file', new Blob([buf]), String(filename || 'archivo').replace(/[\\/]/g, '_'));
  const { text } = await call('POST', '/v1/files/upload', { form: fd, what: 'MiniMax (subir archivo)', timeout: 300000, raw: true });
  const id = (/"file_id"\s*:\s*"?(\d+)"?/.exec(text) || [])[1];
  if (!id) throw new MinimaxError('MiniMax (subir archivo): no devolvió file_id');
  return id;
}
export const uploadFilePath = (p, purpose) => uploadFile(fs.readFileSync(p), p.split(/[\\/]/).pop(), purpose);

/* ======================= VOICES: clone · design · list · delete ======================= */
// voice_id rules (MiniMax): 8–256 characters, starts with a letter, letters/digits/-/_, does not end in - or _
export const VOICE_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{6,254}[A-Za-z0-9]$/;
/** Clones a voice from an uploaded audio (purpose voice_clone). With text + model MiniMax also answers a demo_audio URL. */
export async function cloneVoice({ fileId, voiceId, text = null, model = null, accuracy = 0.7, noiseReduction = false, volumeNormalization = false, languageBoost = null } = {}) {
  if (!/^\d+$/.test(String(fileId || ''))) throw new MinimaxError('MiniMax clonar voz: falta el archivo de audio subido', { final: true });
  if (!VOICE_ID_RE.test(String(voiceId || ''))) throw new MinimaxError('MiniMax clonar voz: el voiceId debe tener de 8 a 256 caracteres, empezar por letra, llevar solo letras, números, - o _ y no terminar en - ni _', { final: true });
  const body = { file_id: '__FILE_ID__', voice_id: voiceId, need_noise_reduction: !!noiseReduction, need_volume_normalization: !!volumeNormalization, accuracy };
  if (text && model) { body.text = String(text).slice(0, 1000); body.model = model; }
  if (languageBoost) body.language_boost = languageBoost;
  const raw = JSON.stringify(body).replace('"__FILE_ID__"', String(fileId)); // the int64 goes back exactly as MiniMax wrote it
  const j = await call('POST', '/v1/voice_clone', { body: raw, what: 'MiniMax clonar voz' });
  return { voiceId, demoAudio: j.demo_audio || null, inputSensitive: j.input_sensitive ?? null };
}
/** Designs a voice from a description → { voiceId, preview: Buffer|null }. */
export async function voiceDesign({ prompt, previewText, voiceId = null } = {}) {
  const p = String(prompt || '').trim(), t = String(previewText || '').trim().slice(0, 500);
  if (!p) throw new MinimaxError('MiniMax diseñar voz: describe la voz que quieres', { final: true });
  if (!t) throw new MinimaxError('MiniMax diseñar voz: falta el texto de muestra', { final: true });
  const body = { prompt: p, preview_text: t }; if (voiceId) body.voice_id = voiceId;
  const j = await call('POST', '/v1/voice_design', { body, what: 'MiniMax diseñar voz' });
  if (!j.voice_id) throw new MinimaxError('MiniMax diseñar voz: no devolvió voice_id');
  return { voiceId: String(j.voice_id), preview: j.trial_audio ? hexBuf(j.trial_audio) : null };
}
/** The voices MiniMax knows for this account. type: system · voice_cloning · voice_generation · all */
export async function getVoices(type = 'all') {
  const j = await call('POST', '/v1/get_voice', { body: { voice_type: type }, what: 'MiniMax voces', timeout: 60000 });
  const row = x => ({ voiceId: String(x.voice_id), name: x.voice_name || String(x.voice_id), description: Array.isArray(x.description) ? x.description.join(' ') : String(x.description || ''), created: x.created_time || null });
  return { system: (j.system_voice || []).map(row), cloned: (j.voice_cloning || []).map(row), designed: (j.voice_generation || []).map(row) };
}
/** Deletes one of YOUR voices in MiniMax (a deleted voice_id cannot be used again). kind: clone | design */
export async function deleteVoice(voiceId, kind) {
  await call('POST', '/v1/delete_voice', { body: { voice_type: kind === 'design' ? 'voice_generation' : 'voice_cloning', voice_id: String(voiceId) }, what: 'MiniMax borrar voz', timeout: 30000 });
  return true;
}

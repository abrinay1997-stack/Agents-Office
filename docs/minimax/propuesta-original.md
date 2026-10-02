# MiniMax — propuesta original del dueño (30 sep 2026), tal cual la entregó

> Sin aplicar todavía. Ver `README.md` de esta carpeta: hay que reconciliarla con el código de hoy y comprobarla contra la documentación oficial antes de usarla.

## 1. `minimax.mjs`

```js
// Agents Office — MiniMax: cliente de TODA la plataforma MiniMax para el Estudio.
//
// UN SOLO motor, UNA sola key: platform.minimax.io → API Keys → Create new secret key.
//   setx MINIMAX_API_KEY "tu-key"      (Windows, una vez; reinicia la oficina)
//   (opcional) setx MINIMAX_GROUP_ID "tu-group-id"   — solo si tu cuenta usa el endpoint antiguo con GroupId
//   (opcional) setx MINIMAX_API_BASE  "https://api.minimax.io"   — para apuntar a otro host
//
// La misma key abre: imagen (image-01), video (MiniMax-H3 / H3-Max), voz/TTS (speech-2.8/2.6/02…),
// música (music-3.0), clonación de voz, diseño de voz y la subida de archivos.
//
// Este módulo es autónomo (Node 20+, usa fetch global; sin dependencias). media.mjs lo importa en RUN.minimax,
// y las voces (clonar/diseñar) se usan directamente desde serve.mjs. Ver INTEGRACION-media.mjs.md.
//
// Auth: cabecera  Authorization: Bearer <MINIMAX_API_KEY>  en TODOS los endpoints (api.minimax.io).
// Errores: MiniMax puede devolver HTTP 200 con base_resp.status_code != 0 — por eso se revisan AMBOS.
// Audio: T2A, música y diseño de voz devuelven el audio como HEX en el JSON → Buffer.from(hex,'hex').

import fs from 'node:fs';

/* ---------- configuración ---------- */
export const MINIMAX = { name: 'MiniMax', env: 'MINIMAX_API_KEY', site: 'platform.minimax.io', how: 'setx MINIMAX_API_KEY "tu-key"' };
const BASE = () => (process.env.MINIMAX_API_BASE || 'https://api.minimax.io').replace(/\/$/, '');
const KEY = () => process.env.MINIMAX_API_KEY || '';
const GROUP = () => process.env.MINIMAX_GROUP_ID || '';
export const minimaxOn = () => !!KEY();
const qs = () => (GROUP() ? `?GroupId=${encodeURIComponent(GROUP())}` : ''); // solo si tu cuenta lo exige

export class MinimaxError extends Error { constructor(msg, status) { super(msg); this.name = 'MinimaxError'; this.status = status; } }
const hexBuf = h => Buffer.from(String(h || ''), 'hex');
const authJSON = () => ({ authorization: `Bearer ${KEY()}`, 'content-type': 'application/json' });

// POST JSON y valida HTTP + base_resp. `what` es el nombre humano para el error (lo lee el dueño).
async function postJSON(path, body, what, timeout = 180000) {
  const r = await fetch(`${BASE()}${path}${qs()}`, { method: 'POST', headers: authJSON(), body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = null; }
  const br = j && j.base_resp;
  if (!r.ok || (br && br.status_code !== 0)) {
    const code = br ? br.status_code : r.status;
    const msg = (br && br.status_msg) || (j && j.message) || text.slice(0, 200);
    throw new MinimaxError(`${what}: ${code} ${msg}`, r.status || code);
  }
  return j;
}
async function getJSON(path, what, timeout = 60000) {
  const r = await fetch(`${BASE()}${path}${qs()}`, { headers: { authorization: `Bearer ${KEY()}` }, signal: AbortSignal.timeout(timeout) });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = null; }
  const br = j && j.base_resp;
  if (!r.ok || (br && br.status_code !== 0)) {
    const code = br ? br.status_code : r.status;
    const msg = (br && br.status_msg) || (j && j.message) || text.slice(0, 200);
    throw new MinimaxError(`${what}: ${code} ${msg}`, r.status || code);
  }
  return j;
}
// descarga el resultado (URLs de imagen/video que caducan — hay que guardarlas pronto)
export async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new MinimaxError('no pude descargar el resultado: ' + r.status, r.status);
  return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') || '' };
}

/* ======================= IMAGEN — image-01 ======================= */
// Texto→imagen y (con subjectRef) imagen→imagen con una cara de referencia. subjectRef = URL pública o data:image/…;base64,…
// Devuelve un array de URLs (response_format 'url', caducan en 24 h) — el que llama las descarga con fetchBuf.
export async function image({ prompt, model = 'image-01', aspectRatio = '1:1', n = 1, promptOptimizer = true, subjectRef = null, seed = null } = {}) {
  const body = { model, prompt: String(prompt || '').slice(0, 1500), aspect_ratio: aspectRatio, response_format: 'url', n: Math.max(1, Math.min(9, n)), prompt_optimizer: !!promptOptimizer };
  if (seed != null) body.seed = seed;
  if (subjectRef) body.subject_reference = [{ type: 'character', image_file: subjectRef }];
  const j = await postJSON('/v1/image_generation', body, 'MiniMax imagen');
  const urls = j.data?.image_urls || [];
  if (!urls.length) throw new MinimaxError('MiniMax no devolvió imágenes', 200);
  return urls;
}

/* ======================= VIDEO — MiniMax-H3 / H3-Max (asíncrono) ======================= */
// content[] : { type, text?, image_url{url}?, video_url{url}?, audio_url{url}?, role? }. La imagen/video van como
// URL pública o data URI base64 (data:image/jpeg;base64,…). Siempre debe ir un item type:'text'.
// Crea la tarea → task_id; luego se consulta con queryVideo hasta 'succeeded' y se baja content.url.
export async function createVideo({ model = 'MiniMax-H3', content, resolution = '768P', duration = 5, ratio = null, promptExpansion = null, callbackUrl = null } = {}) {
  if (!Array.isArray(content) || !content.some(c => c.type === 'text' && c.text)) throw new MinimaxError('el video necesita al menos un item type:"text" con texto', 400);
  const body = { model, content, resolution, duration: Number(duration) || 5 };
  if (ratio) body.ratio = ratio;
  if (promptExpansion) body.extra = { prompt_expansion_mode: promptExpansion }; // 'disabled' | 'balanced' | 'quality'
  if (callbackUrl) body.callback_url = callbackUrl;
  const j = await postJSON('/v2/video_generation', body, 'MiniMax video');
  const id = j.task_id || j.task?.id;
  if (!id) throw new MinimaxError('MiniMax no devolvió task_id', 200);
  return id;
}
// GET /v2/query/video_generation/{task_id}. Normaliza el estado y devuelve { state:'queued|running|succeeded|failed', url, raw }.
const VIDEO_STATE = { queued: 'queued', queueing: 'queued', preparing: 'queued', running: 'running', processing: 'running', succeeded: 'succeeded', success: 'succeeded', failed: 'failed', fail: 'failed', cancelled: 'failed', canceled: 'failed' };
export async function queryVideo(taskId) {
  const j = await getJSON(`/v2/query/video_generation/${encodeURIComponent(taskId)}`, 'MiniMax video (consulta)');
  const t = j.task || j;
  const state = VIDEO_STATE[String(t.status || '').toLowerCase()] || 'running';
  return { state, url: t.content?.url || null, prompt: t.content?.prompt || null, raw: t };
}

/* ======================= VOZ / TTS — speech-2.8 / 2.6 / 02 ======================= */
// text ≤ 10.000 caracteres. voiceId = una voz del sistema (300+, p.ej. "Spanish_Narrator") o una voz tuya (clonada/diseñada).
// Devuelve { buf, ext, info } con el audio ya decodificado (hex → Buffer).
export async function tts({ text, model = 'speech-2.8-hd', voiceId = 'Spanish_Narrator', speed = 1, vol = 1, pitch = 0, emotion = null, languageBoost = 'auto', format = 'mp3', sampleRate = 32000, bitrate = 128000, channel = 1 } = {}) {
  const voice_setting = { voice_id: voiceId, speed: Number(speed) || 1, vol: Number(vol) || 1, pitch: Number(pitch) || 0 };
  if (emotion) voice_setting.emotion = emotion; // 'calm'|'happy'|'sad'|'angry'|'fearful'|'disgusted'|'surprised'|'neutral'
  const body = { model, text: String(text || '').slice(0, 10000), stream: false, output_format: 'hex', language_boost: languageBoost, voice_setting, audio_setting: { sample_rate: sampleRate, bitrate, format, channel } };
  const j = await postJSON('/v1/t2a_v2', body, 'MiniMax voz');
  if (!j.data?.audio) throw new MinimaxError('MiniMax no devolvió audio', 200);
  return { buf: hexBuf(j.data.audio), ext: format, info: j.extra_info || {} };
}

/* ======================= MÚSICA — music-3.0 ======================= */
// NOTA: desde el 20-ago-2026 la API de pago de música NO acepta usuarios nuevos; usuarios de pago existentes siguen.
// Si es cantada: pasa `lyrics` (usa [Intro][Verse][Chorus]…). Si es instrumental: `prompt` + isInstrumental:true.
export async function music({ prompt = '', lyrics = '', model = 'music-3.0', isInstrumental = false, format = 'mp3', sampleRate = 44100, bitrate = 256000 } = {}) {
  const body = { model, stream: false, output_format: 'hex', is_instrumental: !!isInstrumental, audio_setting: { sample_rate: sampleRate, bitrate, format } };
  if (prompt) body.prompt = String(prompt).slice(0, 2000);
  if (lyrics) body.lyrics = String(lyrics).slice(0, 3500);
  if (!prompt && !lyrics) throw new MinimaxError('la música necesita prompt (instrumental) o lyrics (cantada)', 400);
  const j = await postJSON('/v1/music_generation', body, 'MiniMax música');
  if (!j.data?.audio) throw new MinimaxError('MiniMax no devolvió música', 200);
  return { buf: hexBuf(j.data.audio), ext: format, info: j.extra_info || {} };
}

/* ======================= ARCHIVOS — subir (para clonar voz y para video) ======================= */
// purpose: 'voice_clone' | 'prompt_audio' | 'video_generation_input' | 't2a_async_input' | 'video_understanding'.
// Devuelve file_id (int64). multipart/form-data.
export async function uploadFile(buf, filename, purpose) {
  const fd = new FormData();
  fd.append('purpose', purpose);
  fd.append('file', new Blob([buf]), filename);
  const r = await fetch(`${BASE()}/v1/files/upload${qs()}`, { method: 'POST', headers: { authorization: `Bearer ${KEY()}` }, body: fd, signal: AbortSignal.timeout(300000) });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = null; }
  const br = j && j.base_resp;
  if (!r.ok || (br && br.status_code !== 0)) throw new MinimaxError(`MiniMax (subir ${purpose}): ${(br && br.status_msg) || text.slice(0, 200)}`, r.status);
  const id = j.file?.file_id;
  if (!id) throw new MinimaxError('MiniMax no devolvió file_id', 200);
  return id;
}
export const uploadFilePath = (p, purpose) => uploadFile(fs.readFileSync(p), p.split(/[\\/]/).pop(), purpose);

/* ======================= CLONAR VOZ ======================= */
// Requiere verificación de cuenta (código 2038 = sin permiso de clonación). Audio: mp3/m4a/wav, 10 s–5 min, ≤20 MB.
// voiceId que tú eliges: 8–256 car., empieza por letra, solo letras/dígitos/-/_, no termina en -/_, único.
// 1) sube el audio con uploadFile(..., 'voice_clone') → file_id   2) cloneVoice({ fileId, voiceId })
// Si pasas `text`+`model`, MiniMax devuelve demo_audio (URL) de muestra.
export async function cloneVoice({ fileId, voiceId, text = null, model = null, accuracy = 0.7, needNoiseReduction = false, needVolumeNormalization = false, languageBoost = null } = {}) {
  if (!fileId) throw new MinimaxError('falta file_id (sube primero el audio con purpose "voice_clone")', 400);
  if (!/^[A-Za-z][A-Za-z0-9_-]{6,254}[A-Za-z0-9]$/.test(String(voiceId || ''))) throw new MinimaxError('voiceId inválido: 8–256 car., empieza por letra, solo letras/dígitos/-/_, no termina en -/_', 400);
  const body = { file_id: fileId, voice_id: voiceId, need_noise_reduction: !!needNoiseReduction, need_volume_normalization: !!needVolumeNormalization, accuracy };
  if (text && model) { body.text = String(text).slice(0, 1000); body.model = model; }
  if (languageBoost) body.language_boost = languageBoost;
  const j = await postJSON('/v1/voice_clone', body, 'MiniMax clonar voz');
  return { voiceId, demoAudio: j.demo_audio || null, inputSensitive: j.input_sensitive ?? null, info: j.extra_info || {} };
}

/* ======================= DISEÑAR VOZ (desde una descripción) ======================= */
// Devuelve un voice_id nuevo y un trial_audio (hex) de muestra. El voice_id sirve directo en tts().
// previewText ≤ 500 car. La previsualización cuesta ~US$30 / 1M car.
export async function voiceDesign({ prompt, previewText, voiceId = null } = {}) {
  const body = { prompt: String(prompt || ''), preview_text: String(previewText || '').slice(0, 500) };
  if (voiceId) body.voice_id = voiceId;
  const j = await postJSON('/v1/voice_design', body, 'MiniMax diseñar voz');
  if (!j.voice_id) throw new MinimaxError('MiniMax no devolvió voice_id', 200);
  return { voiceId: j.voice_id, previewBuf: j.trial_audio ? hexBuf(j.trial_audio) : null, ext: 'mp3' };
}

/* IMPORTANTE sobre las voces (clonadas y diseñadas): son TEMPORALES. Solo se cobran la primera vez que se usan
   en una síntesis real (los previews NO cuentan). Si NINGUNA API de síntesis la usa en 168 h (7 días), se borra.
   → guarda el voice_id en tu registro (minimax-voices.json) y, para «fijarla», haz un tts() corto con ella. */
```

## 2. `minimax-voices.mjs`

```js
// Agents Office — registro de VOCES de MiniMax (clonadas y diseñadas).
//
// Las voces de MiniMax son temporales: se cobran al primer uso real en síntesis y se borran si no se usan en 7 días.
// Este módulo guarda los voice_id del dueño en data/minimax-voices.json y los «fija» haciendo un TTS corto al crearlas,
// para que no se borren. Las voces del SISTEMA (300+) no se guardan aquí: se usan por su id directamente en el TTS.
//
// Lo usa serve.mjs para los endpoints de /estudio/voces (ver INTEGRACION-media.mjs.md). No pasa por el sistema de jobs
// porque no produce media de galería: produce un voice_id reutilizable.

import fs from 'node:fs';
import path from 'node:path';
import { cloneVoice, voiceDesign, uploadFile, tts } from './minimax.mjs';

let FILE = '';
export function configureVoices(dataDir) { FILE = path.join(dataDir, 'minimax-voices.json'); }

function read() { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(j.voices) ? j.voices : []; } catch { return []; } }
function write(list) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify({ voices: list }, null, 1)); fs.renameSync(t, FILE); }

export function list() { return read().slice().reverse(); }
export function remove(voiceId) { const l = read().filter(v => v.voiceId !== voiceId); write(l); return true; }

// «Fija» la voz: un TTS mínimo que la marca como usada (si no, MiniMax la borra a los 7 días). Best-effort.
async function pin(voiceId) { try { await tts({ text: 'Hola.', voiceId, model: 'speech-2.8-turbo', format: 'mp3' }); return true; } catch { return false; } }

// Diseña una voz desde una descripción y la guarda. Devuelve { voiceId, previewBuf }.
export async function design({ name, prompt, previewText = 'Hola, esta es una prueba de mi nueva voz para Agents Office.' }) {
  const r = await voiceDesign({ prompt, previewText });
  const pinned = await pin(r.voiceId);
  const rec = { voiceId: r.voiceId, name: name || 'Voz diseñada', kind: 'design', prompt, at: Date.now(), pinned };
  write([...read(), rec]);
  return { ...rec, previewBuf: r.previewBuf };
}

// Clona una voz a partir de un buffer de audio (10 s–5 min, mp3/m4a/wav, ≤20 MB) y la guarda.
export async function clone({ name, voiceId, audioBuf, filename = 'muestra.mp3', model = 'speech-2.8-hd' }) {
  const fileId = await uploadFile(audioBuf, filename, 'voice_clone');
  const r = await cloneVoice({ fileId, voiceId, text: 'Hola, esta es mi voz clonada.', model });
  const pinned = await pin(voiceId); // «Hola, esta es mi voz clonada.» del clone ya la deja usada, esto es doble seguro
  const rec = { voiceId, name: name || voiceId, kind: 'clone', at: Date.now(), pinned, demoAudio: r.demoAudio || null };
  write([...read(), rec]);
  return rec;
}
```

## 3. `INTEGRACION-media.mjs.md` — parches (resumen fiel; el texto completo está en el mensaje del dueño del 30 sep 2026)

- **media.mjs**
  - **1.1** `import * as mmx from './minimax.mjs'`.
  - **1.2** Motor en `ENGINES`: `minimax: { name: 'MiniMax', env: 'MINIMAX_API_KEY', site: 'platform.minimax.io', how: 'setx MINIMAX_API_KEY "tu-key"' }`.
  - **1.3** En `settingsFor`, el tipo de ajuste `text`: `v = v == null ? f.default : String(v).slice(0, f.max || 2000)`.
  - **1.4** `store()` reconoce como `kind:'audio'` las extensiones mp3, wav, flac, m4a, ogg y pcm.
  - **1.5** `submit()` acepta los kinds `video`, `audio` y `music`.
  - **1.6** Pesos: un video vale 5, la música 3 y la voz 1. Se añade un contador `audios` en `usage()`, `spend()` y `budget()`, y `runJob` gasta en `audios` cuando el job no es de imagen ni de video.
  - **1.7** `inputFiles` conoce los mimes de mp3, wav, m4a y flac.
  - **1.8** Catálogo:

    | Id | Modelo MiniMax | Kind | Costo | Roles | Ajustes |
    |---|---|---|---|---|---|
    | `mmx-image-01` | `image-01` | image | 0,01 | reference 1 | aspectRatio: 1:1, 16:9, 4:3, 3:2, 2:3, 3:4, 9:16, 21:9 |
    | `mmx-h3` | `MiniMax-H3` | video | 0,05 por segundo | start 1, end 1, reference 3 | aspectRatio 16:9…; resolución 768P o 2K; duración 4–15 s |
    | `mmx-h3-max` | `MiniMax-H3-Max` | video | 0,03 por segundo | start 1, end 1, reference 3 | resolución 480P o 768P; duración 5–15 s |
    | `mmx-voz-2.8-hd` | `speech-2.8-hd` | audio | 0,02 | — | voiceId (text, por defecto `Spanish_Narrator`); emoción; velocidad 0,5–2; volumen 0–10; tono −12…12; formato mp3, wav o flac |
    | `mmx-voz-2.8-turbo` | `speech-2.8-turbo` | audio | 0,01 | — | los mismos que la voz HD |
    | `mmx-musica-3` | `music-3.0` | music | 0,1 | — | instrumental (sí/no); formato mp3 o wav |

  - **1.9** `RUN.minimax(m, job, ctx)`:
    - **Imagen:** `subject_reference` = la primera referencia como data URI; descarga las URLs que devuelve.
    - **Voz:** un `tts` por cada n, con voiceId, velocidad, volumen, tono, emoción (se omite si es neutral) y formato.
    - **Música:** si `instrumental`, va como `prompt` + `isInstrumental`; si no, el prompt va como `lyrics`.
    - **Video asíncrono:**
      - `content` lleva el texto, y además:
        - `image_url` con role `first_frame` (start) y `last_frame` (end);
        - o, sin start, las referencias como `reference_image`.
      - Se llama a `createVideo` por cada n y se guarda en `job.remote`.
      - `pollUntil` cada 6 s con `queryVideo`; descarga el resultado.
      - Cancelar es solo local: no hay cancel remoto.
- **serve.mjs**
  - **2.1** Mimes mp3, wav, flac y m4a en `/media/` y en la papelera.
  - **2.2** `attachLines`: un audio se pone como `[🔊 archivo](/media/…)`.
  - **2.3** Galería: `<audio controls>`, filtros Voz y Música, campo `voiceId` (texto, o un select alimentado por `/api/voces`).
  - **2.4** `import * as voces from './minimax-voices.mjs'`, `voces.configureVoices(DATA)` y estas rutas:
    - `GET /api/voces`
    - `POST /api/voces/design {name, prompt, previewText}` → `{voice, preview (base64)}`
    - `POST /api/voces/clone {name, voiceId, audioBase64, filename}`
    - `DELETE /api/voces/<id>`

    Clonar exige una cuenta verificada (error 2038).
- **estudio-mcp.mjs**
  - `generar_voz` (texto, voiceId, modelo; por defecto `mmx-voz-2.8-turbo`) → `kind:'audio'`.
  - `generar_musica` (letra, instrumental, modelo `mmx-musica-3`) → `kind:'music'`.
  - En `studioText` se listan los modelos de audio y música que estén listos.
- **office.config.json** (opcional): `"default": { "image": "mmx-image-01", "video": "mmx-h3", "audio": "mmx-voz-2.8-turbo", "music": "mmx-musica-3" }`.
- **La key**: solo en la variable de entorno `MINIMAX_API_KEY`, solo en el backend, nunca en un archivo. Opcionales: `MINIMAX_GROUP_ID` y `MINIMAX_API_BASE`.

## 4. `check-minimax.mjs` (prueba de humo con key real)

```js
// Prueba rápida de la key y de cada servicio de MiniMax. Pon tu key y corre:
//   MINIMAX_API_KEY="tu-key" node check-minimax.mjs            → solo imagen + voz (barato)
//   MINIMAX_API_KEY="tu-key" node check-minimax.mjs --video    → además encola y espera un video
//   MINIMAX_API_KEY="tu-key" node check-minimax.mjs --music    → además una pista de música (requiere cuenta de pago existente)
// Guarda los resultados en ./salida-minimax/. No usa el resto de la oficina: solo importa minimax.mjs.

import fs from 'node:fs';
import * as mmx from './minimax.mjs';

const OUT = './salida-minimax';
fs.mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const ok = (s) => console.log('  ✓ ' + s);
const fail = (s, e) => console.error('  ✗ ' + s + ' — ' + (e?.message || e));

if (!mmx.minimaxOn()) { console.error('Falta MINIMAX_API_KEY en el entorno.'); process.exit(1); }
console.log('Key detectada. Probando servicios…\n');

// 1) Imagen (image-01)
try {
  const urls = await mmx.image({ prompt: 'logo minimalista de una oficina de agentes de IA, fondo oscuro, neón suave', n: 1 });
  const { buf, mime } = await mmx.fetchBuf(urls[0]);
  const ext = /png/.test(mime) ? 'png' : 'jpg';
  fs.writeFileSync(`${OUT}/imagen.${ext}`, buf); ok(`Imagen → ${OUT}/imagen.${ext} (${buf.length} bytes)`);
} catch (e) { fail('Imagen', e); }

// 2) Voz / TTS (speech-2.8-turbo, barato)
try {
  const { buf, ext, info } = await mmx.tts({ text: 'Hola, soy una voz de prueba para Agents Office. Todo funciona.', model: 'speech-2.8-turbo', voiceId: 'Spanish_Narrator' });
  fs.writeFileSync(`${OUT}/voz.${ext}`, buf); ok(`Voz → ${OUT}/voz.${ext} (${info.usage_characters || '?'} car.)`);
} catch (e) { fail('Voz', e); }

// 3) Video (opcional, tarda minutos y cuesta más)
if (want.has('--video')) {
  try {
    const id = await mmx.createVideo({ model: 'MiniMax-H3', content: [{ type: 'text', text: 'un café humeante sobre un escritorio, luz de mañana, cámara lenta' }], resolution: '768P', duration: 5, ratio: '16:9' });
    ok(`Video encolado (task ${id}); esperando…`);
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 6000));
      const q = await mmx.queryVideo(id);
      process.stdout.write(`\r    estado: ${q.state}        `);
      if (q.state === 'succeeded') { const { buf } = await mmx.fetchBuf(q.url); fs.writeFileSync(`${OUT}/video.mp4`, buf); console.log(`\n  ✓ Video → ${OUT}/video.mp4 (${buf.length} bytes)`); break; }
      if (q.state === 'failed') { console.log(); fail('Video', 'el video falló'); break; }
    }
  } catch (e) { console.log(); fail('Video', e); }
}

// 4) Música (opcional; solo usuarios de pago existentes desde 20-ago-2026)
if (want.has('--music')) {
  try {
    const { buf, ext } = await mmx.music({ lyrics: '[Verse]\nOficina de agentes, trabajo real\n[Chorus]\nTodo sucede, nada es igual', model: 'music-3.0' });
    fs.writeFileSync(`${OUT}/musica.${ext}`, buf); ok(`Música → ${OUT}/musica.${ext} (${buf.length} bytes)`);
  } catch (e) { fail('Música', e); }
}

console.log('\nListo. Revisa la carpeta ' + OUT + '.');
```

## 5. Plan por fases y avisos (del dueño)

- **Fase 0:** con la key puesta, `node check-minimax.mjs` debe dejar una imagen y una voz (opcional: `--video` y `--music`).
- **Fase 1:** el backend (`minimax.mjs`, `minimax-voices.mjs` y los parches de `media.mjs`); `npm run check` y `npm test`.
- **Fase 2:** voz y música en la interfaz (mimes, entregables, reproductor, filtros Voz y Música, el campo voiceId).
- **Fase 3:** las voces (rutas `/api/voces/*`, un panel «Voces» para diseñar, clonar, listar y borrar, que alimente el selector de voiceId).
- **Fase 4:** los agentes (`generar_voz` y `generar_musica`, y su texto en `studioText`); probar con «narra este guion con la voz de la marca».
- **Fase 5:** modelos por defecto, precios ajustados con la factura real, CHANGELOG y README.

**Avisos:**
- La música está cerrada a usuarios nuevos desde el 20 de agosto de 2026.
- Clonar una voz exige una cuenta verificada (error 2038).
- Las URLs de resultado caducan (las imágenes a las 24 h).
- Las voces son temporales: se borran a los 7 días sin uso.
- `GroupId` es opcional.
- Los precios son estimados.

**Segunda pasada:** añadir speech-2.6 y speech-02, el ajuste `language_boost`, `pronunciation_dict` para los nombres de marca y subtítulos (`subtitle_enable`).

**La idea de negocio:** una voz de marca por cliente (PanaClaw, Juancito Ads, Títeres PTY…), reutilizable en todos sus anuncios.

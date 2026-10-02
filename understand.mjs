// Agents Office — understanding video and audio with Meta Muse Spark (V4.8, 30 Sep 2026). Video or audio in, text out:
// describe a clip, answer «what is said at minute 2?», pull data out, or transcribe speech. It generates nothing — the
// Estudio's video generation stays with Veo, Kling, Seedance…; Meta has no video-generation model.
// Meta's API (api.meta.ai/v1, the owner's instruction of 30 Sep 2026 from dev.meta.ai/docs/video-understanding):
//   · a video from the gallery goes up by the Files API (purpose "user_data") and is referenced by file_id in the Responses
//     API as an input_file block; a public URL goes as input_video.video_url with nothing uploaded;
//   · an audio (mp3/wav) goes inline as input_audio { data: base64, format };
//   · muse-spark-1.3 for video, muse-spark-1.2 for audio (Meta's docs: audio on 1.3 is still degraded);
//   · max_output_tokens ≥ 4000, or a transcript can come back empty with finish_reason «length».
// The key is Muse Image's: META_API_KEY, or MODEL_API_KEY (the one the office already uses for Muse Spark).
// What comes back is DATA from a file, never orders: the agents' tool says so around the text. Proven in tests/understand.test.mjs.
import fs from 'node:fs';
import path from 'node:path';

const META_BASE = () => (process.env.AO_META_BASE || 'https://api.meta.ai/v1').replace(/\/$/, '');
const KEY = () => process.env.META_API_KEY || process.env.MODEL_API_KEY || '';
export const metaOn = () => !!KEY();
export const MODELS = { video: 'muse-spark-1.3', audio: 'muse-spark-1.2' };
export const MAX_BYTES = { video: 200 * 1024 * 1024, audio: 25 * 1024 * 1024 };

const MIME = { '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
export const mimeOf = p => MIME[path.extname(String(p || '')).toLowerCase()] || '';

async function meta(pathname, opts, what) {
  const r = await fetch(META_BASE() + pathname, { ...opts, signal: AbortSignal.timeout(300000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${what}: Meta respondió ${r.status}${j.error?.message ? ' — ' + j.error.message : ''}`);
  return j;
}

/** Uploads a local file to Meta's Files API; returns its file_id. */
async function upload(filePath) {
  const mime = mimeOf(filePath);
  if (!mime) throw new Error('formato no soportado (usa mp4, mp3 o wav)');
  const fd = new FormData();
  fd.append('purpose', 'user_data');
  fd.append('file', new Blob([fs.readFileSync(filePath)], { type: mime }), path.basename(filePath));
  const j = await meta('/files', { method: 'POST', headers: { authorization: `Bearer ${KEY()}` }, body: fd }, 'subir a Meta');
  if (!j.id) throw new Error('Meta no devolvió el id del archivo');
  return { fileId: j.id, mime };
}

/** The text of a Responses API answer. */
export const outText = j =>
  j.output_text ||
  (j.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []).filter(c => c.type === 'output_text' || c.type === 'text').map(c => c.text || '').join('\n').trim();

/** The request body the Responses API gets (exported for the tests). */
export function requestBody({ prompt, kind, model, fileId, url, audio }) {
  const content = [{ type: 'input_text', text: prompt }];
  if (kind === 'video') content.push(url ? { type: 'input_video', video_url: url } : { type: 'input_file', file_id: fileId });
  else content.push({ type: 'input_audio', input_audio: audio });
  return { model: model || MODELS[kind], max_output_tokens: 4000, input: [{ type: 'message', role: 'user', content }] };
}

/**
 * Analyses or transcribes a video or an audio with Muse Spark.
 * @param {{ prompt: string, kind: 'video'|'audio', filePath?: string, url?: string, model?: string }} a
 * @returns {Promise<{ text: string, model: string, usage: object|null }>}
 */
export async function understand({ prompt, kind, filePath, url, model }) {
  if (!metaOn()) throw new Error('falta la key de Meta (META_API_KEY)');
  if (!String(prompt || '').trim()) throw new Error('falta la instrucción: qué quieres saber del archivo');
  kind = kind === 'audio' ? 'audio' : 'video';
  if (url && !/^https:\/\/[^\s]+$/i.test(String(url))) throw new Error('la URL tiene que ser pública y empezar por https://');
  let fileId, audio;
  if (kind === 'video') {
    if (!url && !filePath) throw new Error('para un video, pasa un id de la galería o una URL');
    if (!url) {
      if (mimeOf(filePath) !== 'video/mp4') throw new Error('Meta lee video en mp4');
      if (fs.statSync(filePath).size > MAX_BYTES.video) throw new Error('el video pasa de 200 MB');
      ({ fileId } = await upload(filePath));
    }
  } else {
    if (!filePath) throw new Error('para un audio, pasa un id de la galería (mp3 o wav)');
    const mime = mimeOf(filePath); if (!/^audio\//.test(mime)) throw new Error('Meta transcribe audio en mp3 o wav');
    if (fs.statSync(filePath).size > MAX_BYTES.audio) throw new Error('el audio pasa de 25 MB');
    audio = { data: fs.readFileSync(filePath).toString('base64'), format: mime === 'audio/wav' ? 'wav' : 'mp3' };
  }
  const body = requestBody({ prompt: String(prompt), kind, model, fileId, url, audio });
  const j = await meta('/responses', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY()}` }, body: JSON.stringify(body) }, kind === 'audio' ? 'transcribir con Meta' : 'analizar video con Meta');
  const text = outText(j);
  if (!text) {
    const why = j.incomplete_details?.reason || j.output?.[0]?.status || j.status;
    throw new Error(`Muse Spark no devolvió texto${why ? ` (${why})` : ''}${why === 'max_output_tokens' || why === 'length' ? ': el archivo es largo; prueba con un fragmento' : ''}`);
  }
  return { text, model: body.model, usage: j.usage || null };
}

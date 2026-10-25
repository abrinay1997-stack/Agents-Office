// Agents Office — the owner's MiniMax VOICES (V4.10, 30 Sep 2026): the ones cloned from a recording and the ones designed from a
// description. MiniMax keeps a voice only while it is used: one not used by any synthesis in 7 days (168 h) is deleted. So each
// voice is written down in data/minimax-voices.json (this machine's; it does not travel through GitHub) and «pinned» with a short
// TTS right after it is made. The SYSTEM voices (Spanish_Narrator…) are not stored here: they are listed from MiniMax's get_voice
// (cached 12 h) or, without an answer, from a short list read in MiniMax's documentation (docs/faq/system-voice-id).
// serve.mjs uses it for /api/voces/*. No job: a voice is not a gallery file, it is a voice_id used later by the voice models.
import fs from 'node:fs';
import path from 'node:path';
import * as mmx from './minimax.mjs';
import { renombrar } from './fs-seguro.mjs';
import { PRICE, SYSTEM, pub, clean } from './minimax-voces-core.mjs'; // 25 oct 2026: lo puro, compartido con la nube
export { PRICE, SYSTEM }; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

let FILE = '';
export function configureVoices(dataDir) { FILE = path.join(dataDir, 'minimax-voices.json'); systemCache = null; }

function read() { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(j.voices) ? j.voices.filter(v => v && typeof v.voiceId === 'string') : []; } catch { return []; } }
function write(list) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify({ voices: list }, null, 1)); renombrar(t, FILE); }
/** The owner's voices, newest first. */
export function list() { return read().slice().reverse().map(pub); }
export const has = voiceId => read().some(v => v.voiceId === voiceId);

let systemCache = null; // { at, list }
/** The system voices: MiniMax's get_voice (12 h cache), or the curated list. Never throws. */
export async function systemVoices({ fresh = false } = {}) {
  if (!fresh && systemCache && Date.now() - systemCache.at < 12 * 3600e3) return systemCache.list;
  try {
    const { system } = await mmx.getVoices('system');
    if (system.length) { systemCache = { at: Date.now(), list: system.map(v => ({ voiceId: v.voiceId, name: v.name, lang: /^Spanish/i.test(v.voiceId) ? 'es' : /^English/i.test(v.voiceId) ? 'en' : '' })) }; return systemCache.list; }
  } catch {}
  return SYSTEM;
}
/** What the selector needs, without waiting on the network: the owner's voices and the system ones (cached or curated). */
export function summary() { return { voices: list(), system: systemCache?.list || SYSTEM }; }

/** «Pins» a voice: a minimal real synthesis marks it used, so MiniMax does not delete it. Best effort. */
export async function pin(voiceId) { try { await mmx.tts({ text: 'Hola.', voiceId, model: 'speech-2.8-turbo', format: 'mp3' }); return true; } catch { return false; } }

/** Designs a voice from a description and keeps it. → { voice, preview: Buffer|null, chars } */
export async function design({ name, prompt, previewText } = {}) {
  const p = clean(prompt, 2000); if (!p) throw new Error('describe la voz que quieres (edad, tono, ritmo, acento…)');
  const t = clean(previewText, 500) || 'Hola, esta es la voz nueva de la oficina. ¿Cómo suena?';
  const r = await mmx.voiceDesign({ prompt: p, previewText: t });
  const pinned = await pin(r.voiceId);
  const rec = { voiceId: r.voiceId, name: clean(name, 60) || 'Voz diseñada', kind: 'design', prompt: p, at: Date.now(), pinned };
  write([...read().filter(v => v.voiceId !== rec.voiceId), rec]);
  return { voice: pub(rec), preview: r.preview, chars: t.length };
}

/** Clones a voice from a recording (mp3/m4a/wav, 10 s – 5 min, ≤ 20 MB) and keeps it. → { voice } */
// V4.10 (auditoría EST-15 · EST-17, 1 oct 2026): the most common audio is a phone note or a video's sound, so MiniMax cleans the noise and
// evens the volume by default (a recording made here was already cleaned by the browser: `recorded:true` skips the noise pass), in Spanish.
// And no voice is cloned without the owner saying it is theirs or they have that person's written permission: the consent stays in the record.
export async function clone({ name, voiceId, audio, filename = 'muestra.mp3', model = 'speech-2.8-hd', consent = null, recorded = false, languageBoost = 'Spanish' } = {}) {
  const ok = consent && typeof consent === 'object' && Number.isFinite(+consent.at) && String(consent.text || '').trim();
  if (!ok) throw new Error('falta tu confirmación: marca que es tu voz o que tienes permiso por escrito de esa persona');
  const id = String(voiceId || '').trim();
  if (!mmx.VOICE_ID_RE.test(id)) throw new Error('el voiceId debe tener de 8 a 256 caracteres, empezar por letra, llevar solo letras, números, - o _ y no terminar en - ni _');
  if (has(id)) throw new Error('ya tienes una voz con ese voiceId: elige otro');
  if (!Buffer.isBuffer(audio) || !audio.length) throw new Error('falta la grabación de la voz');
  if (audio.length > 20 * 1024 * 1024) throw new Error('la grabación pasa de 20 MB');
  if (!/\.(mp3|m4a|wav)$/i.test(filename)) throw new Error('la grabación debe ser mp3, m4a o wav');
  const fileId = await mmx.uploadFile(audio, filename, 'voice_clone');
  const r = await mmx.cloneVoice({ fileId, voiceId: id, text: 'Hola, esta es mi voz en la oficina.', model, noiseReduction: !recorded, volumeNormalization: true, languageBoost });
  const pinned = await pin(id);
  const rec = { voiceId: id, name: clean(name, 60) || id, kind: 'clone', at: Date.now(), pinned, consent: { at: +consent.at, text: clean(consent.text, 300) }, ...(r.demoAudio ? { demoAudio: r.demoAudio } : {}) };
  write([...read(), rec]);
  return { voice: pub(rec) };
}

/** Removes a voice: in MiniMax (best effort — it may be gone already) and from the register. → { ok, remote } or null if unknown */
export async function remove(voiceId) {
  const all = read(), v = all.find(x => x.voiceId === voiceId); if (!v) return null;
  let remote = false; try { remote = await mmx.deleteVoice(v.voiceId, v.kind); } catch {}
  write(all.filter(x => x.voiceId !== voiceId));
  return { ok: true, remote };
}

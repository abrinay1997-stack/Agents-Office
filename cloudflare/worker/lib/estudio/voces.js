// El Estudio en la nube: las VOCES propias de MiniMax (diseñadas o clonadas). Lo mismo que minimax-voices.mjs en la oficina local,
// con el registro en D1 (documento `estudio.voces`) en vez de data/minimax-voices.json. Lo puro (precios, voces del sistema,
// cómo se dice una voz a la página) es minimax-voces-core.mjs; hablar con MiniMax, minimax.mjs. MiniMax borra una voz que nadie
// usa en 7 días: cada voz se «fija» con una síntesis corta al crearla.
import * as mmx from '../../../../minimax.mjs';
import { PRICE, SYSTEM, pub, clean } from '../../../../minimax-voces-core.mjs';
import { mutarDoc, leerDoc } from '../almacen.js';

export { PRICE };
const DOC = 'estudio.voces';
const todas = async (db) => { const { valor } = await leerDoc(db, DOC, { voices: [] }); return Array.isArray(valor.voices) ? valor.voices.filter((v) => v && typeof v.voiceId === 'string') : []; };
const guardar = (db, cambiar) => mutarDoc(db, DOC, { voices: [] }, (d) => ({ voices: cambiar(Array.isArray(d.voices) ? d.voices : []) }));

export async function list(db) { return (await todas(db)).slice().reverse().map(pub); }
export const has = async (db, voiceId) => (await todas(db)).some((v) => v.voiceId === voiceId);

let sistema = null; // { at, list } — por isla; si no hay, la lista corta
export async function systemVoices({ fresh = false } = {}) {
  if (!fresh && sistema && Date.now() - sistema.at < 12 * 3600e3) return sistema.list;
  try {
    const { system } = await mmx.getVoices('system');
    if (system.length) { sistema = { at: Date.now(), list: system.map((v) => ({ voiceId: v.voiceId, name: v.name, lang: /^Spanish/i.test(v.voiceId) ? 'es' : /^English/i.test(v.voiceId) ? 'en' : '' })) }; return sistema.list; }
  } catch { /* sin respuesta: la lista corta */ }
  return SYSTEM;
}
/** Lo que el selector necesita sin esperar a la red: las voces del dueño y las del sistema (en caché o la lista corta). */
export async function summary(db) { return { voices: await list(db), system: sistema?.list || SYSTEM }; }

export async function pin(voiceId) { try { await mmx.tts({ text: 'Hola.', voiceId, model: 'speech-2.8-turbo', format: 'mp3' }); return true; } catch { return false; } }

export async function design(db, { name, prompt, previewText } = {}) {
  const p = clean(prompt, 2000); if (!p) throw new Error('describe la voz que quieres (edad, tono, ritmo, acento…)');
  const t = clean(previewText, 500) || 'Hola, esta es la voz nueva de la oficina. ¿Cómo suena?';
  const r = await mmx.voiceDesign({ prompt: p, previewText: t });
  const pinned = await pin(r.voiceId);
  const rec = { voiceId: r.voiceId, name: clean(name, 60) || 'Voz diseñada', kind: 'design', prompt: p, at: Date.now(), pinned };
  await guardar(db, (l) => [...l.filter((v) => v.voiceId !== rec.voiceId), rec]);
  return { voice: pub(rec), preview: r.preview, chars: t.length };
}

export async function clone(db, { name, voiceId, audio, filename = 'muestra.mp3', model = 'speech-2.8-hd', consent = null, recorded = false, languageBoost = 'Spanish' } = {}) {
  const ok = consent && typeof consent === 'object' && Number.isFinite(+consent.at) && String(consent.text || '').trim();
  if (!ok) throw new Error('falta tu confirmación: marca que es tu voz o que tienes permiso por escrito de esa persona');
  const id = String(voiceId || '').trim();
  if (!mmx.VOICE_ID_RE.test(id)) throw new Error('el voiceId debe tener de 8 a 256 caracteres, empezar por letra, llevar solo letras, números, - o _ y no terminar en - ni _');
  if (await has(db, id)) throw new Error('ya tienes una voz con ese voiceId: elige otro');
  if (!Buffer.isBuffer(audio) || !audio.length) throw new Error('falta la grabación de la voz');
  if (audio.length > 20 * 1024 * 1024) throw new Error('la grabación pasa de 20 MB');
  if (!/\.(mp3|m4a|wav)$/i.test(filename)) throw new Error('la grabación debe ser mp3, m4a o wav');
  const fileId = await mmx.uploadFile(audio, filename, 'voice_clone');
  const r = await mmx.cloneVoice({ fileId, voiceId: id, text: 'Hola, esta es mi voz en la oficina.', model, noiseReduction: !recorded, volumeNormalization: true, languageBoost });
  const pinned = await pin(id);
  const rec = { voiceId: id, name: clean(name, 60) || id, kind: 'clone', at: Date.now(), pinned, consent: { at: +consent.at, text: clean(consent.text, 300) }, ...(r.demoAudio ? { demoAudio: r.demoAudio } : {}) };
  await guardar(db, (l) => [...l, rec]);
  return { voice: pub(rec) };
}

export async function remove(db, voiceId) {
  const v = (await todas(db)).find((x) => x.voiceId === voiceId); if (!v) return null;
  let remote = false; try { remote = await mmx.deleteVoice(v.voiceId, v.kind); } catch { /* ya no estaba */ }
  await guardar(db, (l) => l.filter((x) => x.voiceId !== voiceId));
  return { ok: true, remote };
}

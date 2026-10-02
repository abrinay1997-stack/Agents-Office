// Agents Office — the Estudio's voice and music (MiniMax, V5.0, 30 Sep 2026), the part with no DOM: what each kind is
// called, how long a text may be, the voices offered in the picker, the voiceId rule, what a sound card says. src/studio.js
// paints it; tests/studio-voz.test.mjs checks it.
//   Kinds of the Estudio: 'image' · 'video' · 'audio' (a voice reading a text) · 'music' (a song or an instrumental).
//   A finished voice or song is a gallery item of kind 'audio'; a song's record carries wanted: 'music'.

export const KINDS = ['image', 'video', 'audio', 'music'];
/** 9999 → «9.999»: Spanish leaves four digits ungrouped (toLocaleString('es') gives «9999»); the counters group from a thousand. */
export const num = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const SOUND = k => k === 'audio' || k === 'music';

/** The words each kind uses on the page: the button, the step 3 title, one/many of what it makes, the GENERAR button. */
const WORDS = {
  image: { btn: 'Imagen', one: 'imagen', many: 'imágenes', go1: 'GENERAR IMAGEN', goN: n => `GENERAR ${n} IMÁGENES`, none: 'imagen', busy: 'Generando' },
  video: { btn: 'Video', one: 'video', many: 'videos', go1: 'GENERAR VIDEO', goN: n => `GENERAR ${n} VIDEOS`, none: 'video', busy: 'Generando video' },
  audio: { btn: 'Voz', one: 'audio', many: 'audios', go1: 'GENERAR VOZ', goN: n => `GENERAR ${n} AUDIOS`, none: 'voz', busy: 'Grabando la voz' },
  music: { btn: 'Música', one: 'pista', many: 'pistas', go1: 'GENERAR MÚSICA', goN: n => `GENERAR ${n} PISTAS`, none: 'música', busy: 'Componiendo' },
};
export const words = k => WORDS[k] || WORDS.image;
export const goLabel = (k, n) => (n > 1 ? words(k).goN(n) : words(k).go1);
export const countOf = (k, n) => `${n} ${n === 1 ? words(k).one : words(k).many}`;

/** Step 3's title and the field's hint. Music: lyrics, or a description when it is instrumental. */
export function promptStep(k, instrumental) {
  if (k === 'audio') return { title: 'Texto que se lee', label: 'Texto que se lee en voz alta', placeholder: 'Escribe lo que dirá la voz, tal cual. Ej.: «Hola, soy Panaclaw. Esta semana tenemos 20 % en todos los planes.»' };
  if (k === 'music') return instrumental
    ? { title: 'Descripción', label: 'Descripción de la música', placeholder: 'Género, ánimo, instrumentos, tempo. Ej.: lo-fi relajado con piano y lluvia suave, 80 bpm, para un reel de producto.' }
    : { title: 'Letra', label: 'Letra de la canción', placeholder: '[Verse]\nLa primera estrofa…\n[Chorus]\nEl estribillo…' };
  return { title: 'Describe lo que quieres', label: 'Qué quieres crear', placeholder: '' };
}
/** The section tags of a song's lyrics, in the order they usually go. */
export const LYRIC_TAGS = ['[Intro]', '[Verse]', '[Pre-Chorus]', '[Chorus]', '[Bridge]', '[Outro]'];

/** How many characters the field takes: the model's own limit when it says one (the engine publishes maxPrompt: a voice 9 999),
 *  else MiniMax's (a voice 9 999; music: lyrics 3 500, a description 2 000), else 4 000. An instrumental's description never passes 2 000. */
export function textLimit(m, k, instrumental) {
  const own = m && (Number(m.maxChars) || Number(m.limits && m.limits.text) || Number(m.maxPrompt));
  if (own > 0) return k === 'music' && instrumental ? Math.min(own, 2000) : own;
  if (k === 'audio') return 9999;
  if (k === 'music') return instrumental ? 2000 : 3500;
  return 4000;
}
/** The quantity's top: a video and a song are heavy (4); a voice, like an image, up to the office's maxPerRequest. */
export const maxQty = (k, maxPerRequest) => (k === 'video' || k === 'music' ? 4 : maxPerRequest || 8);

/** The price of one unit, in words. `perChar` (what the engine publishes for a voice: US$ per character read) wins; then
 *  `per`: 's' (a second of video), 'char' or 'kchar' (characters read), anything else = one item. */
export function priceText(m) {
  if (!m || !(m.cost || m.perChar)) return 'gratis';
  if (Number(m.perChar) > 0) return `~US$${(m.perChar * 1000).toFixed(3)}/1000 car.`;
  const c = m.cost;
  if (m.per === 's') return `~US$${c.toFixed(2)}/s`;
  if (m.per === 'char') return `~US$${(c * 1000).toFixed(3)}/1000 car.`;
  if (m.per === 'kchar') return `~US$${c.toFixed(3)}/1000 car.`;
  const unit = m.kind === 'video' ? 'video' : m.kind === 'audio' ? 'audio' : m.kind === 'music' ? 'pista' : 'imagen';
  return `~US$${c < 0.01 ? c.toFixed(3) : c.toFixed(2)}/${unit}`;
}
/** What one request costs: per character read (perChar, as media.mjs estimates it: never under US$0.001), per second of video, or per item. */
export function unitCost(m, s = {}, textLen = 0) {
  if (!m) return 0;
  if (Number(m.perChar) > 0) return Math.max(0.001, +(m.perChar * Math.max(1, textLen)).toFixed(4));
  if (!m.cost) return 0;
  if (m.per === 's') return m.cost * (m.seconds || Number(s.duration) || 5);
  if (m.per === 'char') return m.cost * Math.max(1, textLen);
  if (m.per === 'kchar') return m.cost * Math.max(1, textLen) / 1000;
  return m.cost;
}

/* ---------- voices ---------- */
/** The voiceId MiniMax accepts for a clone: 8–256 characters, starts with a letter, only letters, digits, - and _, and does not end in - or _. */
export function checkVoiceId(v) {
  const s = String(v == null ? '' : v);
  if (!s) return { ok: false, error: 'Escribe un id para la voz.' };
  if (s.length < 8) return { ok: false, error: `Le faltan ${8 - s.length} ${8 - s.length === 1 ? 'carácter' : 'caracteres'}: mínimo 8.` };
  if (s.length > 256) return { ok: false, error: 'Como mucho 256 caracteres.' };
  if (!/^[A-Za-z]/.test(s)) return { ok: false, error: 'Tiene que empezar por una letra.' };
  const bad = s.match(/[^A-Za-z0-9_-]/);
  if (bad) return { ok: false, error: bad[0] === ' ' ? 'Sin espacios: usa - o _.' : `«${bad[0]}» no vale: solo letras sin tilde, números, - y _.` };
  if (/[-_]$/.test(s)) return { ok: false, error: 'No puede terminar en - ni en _.' };
  return { ok: true, error: '' };
}
/** A voiceId from a name: «Voz de Panaclaw» → «VozDePanaclaw01» — a suggestion the owner can change. */
export function suggestVoiceId(name, taken = []) {
  const base = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('').replace(/^[^A-Za-z]+/, '').slice(0, 40) || 'MiVoz';
  const stem = base.length < 6 ? base.padEnd(6, 'x') : base; // filled BEFORE the number (audit EST-05: «Mi voz» gave «MiVoz010»)
  for (let i = 1; i < 100; i++) { const id = stem + String(i).padStart(2, '0'); if (!taken.includes(id)) return id; }
  return base + Date.now().toString(36);
}
/** The voices, whatever shape they come in (/api/voces gives { voices, system }; /api/media.voices the same, or a bare list of the owner's). */
export function normVoices(x) {
  if (!x) return { mine: [], system: [] };
  const mine = Array.isArray(x) ? x : Array.isArray(x.voices) ? x.voices : Array.isArray(x.mine) ? x.mine : []; // x.mine: already normalized
  const system = Array.isArray(x.system) ? x.system : [];
  const ok = v => v && typeof v.voiceId === 'string' && v.voiceId;
  return { mine: mine.filter(ok), system: system.filter(ok) };
}
/** The picker's groups: the owner's voices first (newest first), then the system's; an id is offered once. */
export function voiceGroups(voices) {
  const { mine, system } = normVoices(voices), seen = new Set(), out = [];
  const take = (label, list, line) => { const l = list.filter(v => !seen.has(v.voiceId) && seen.add(v.voiceId)).map(v => ({ voiceId: v.voiceId, name: v.name || v.voiceId, line: line(v) })); if (l.length) out.push({ label, voices: l }); };
  take('Tus voces', mine.slice().sort((a, b) => (b.at || 0) - (a.at || 0)), v => (v.kind === 'clone' ? 'clonada' : 'diseñada'));
  take('Voces de MiniMax', system, v => v.lang || '');
  return out;
}
/** A voiceId's name, for a card: the owner's name for it, the system's, or the id itself. */
export function voiceName(id, voices) {
  if (!id) return '';
  const { mine, system } = normVoices(voices), v = mine.find(x => x.voiceId === id) || system.find(x => x.voiceId === id);
  return v && v.name ? v.name : id;
}
export const voiceKind = v => (v && v.kind === 'clone' ? 'Clonada' : 'Diseñada');
/** The voice list for an id (revisión EST-13): a known voice selects itself; an id typed by hand that the list does not have gets
 *  its own «Otra: <id>» option, so the list never shows blank while that voice is set; no id → «Elegir una voz…». */
export function voiceSelect(ids, id) {
  const v = String(id || '').trim();
  if (!v) return { value: '', add: { value: '', label: 'Elegir una voz…' } };
  return (ids || []).includes(v) ? { value: v, add: null } : { value: v, add: { value: v, label: 'Otra: ' + v } };
}

/* ---------- the gallery ---------- */
/** A finished sound: 'music' (its record says wanted: 'music'), 'voice' (any other audio), or null. */
export const soundOf = it => (it && it.kind === 'audio' ? (it.wanted === 'music' ? 'music' : 'voice') : null);
/** The kind the composer goes back to for «Repetir» on an item. */
export const kindOfItem = it => (!it ? 'image' : it.kind === 'audio' ? (it.wanted === 'music' ? 'music' : 'audio') : it.kind === 'video' || it.wanted === 'video' ? 'video' : 'image');
/** What a sound card says under its title: what is read or sung, and with what. */
export function soundCaption(it, voices) {
  const s = soundOf(it); if (!s) return null;
  const set = it.settings || {};
  if (s === 'music') return { label: set.instrumental ? 'Descripción' : 'Letra', badge: 'MÚSICA', text: String(it.prompt || ''), voice: '', instrumental: !!set.instrumental };
  return { label: it.upload ? 'Audio' : 'Texto leído', badge: it.upload ? 'AUDIO' : 'VOZ', text: String(it.prompt || ''), voice: set.voiceId ? voiceName(set.voiceId, voices) : '', instrumental: false };
}
/** Does a gallery filter keep this item (only the two new ones; the others stay in studio.js). */
export const soundFilter = (f, it) => (f === 'voice' ? soundOf(it) === 'voice' : f === 'music' ? soundOf(it) === 'music' : true);
/** Does a filter keep this job's tile. */
export const soundJobFilter = (f, j) => (f === 'voice' ? j.kind === 'audio' : f === 'music' ? j.kind === 'music' : true);
/** The gallery audios that can be cloned: mp3, wav or m4a. */
export const cloneable = items => (items || []).filter(it => it && it.kind === 'audio' && /\.(mp3|wav|m4a)$/i.test(String(it.file || '')));
/** A sound file the owner picks for a clone: the type, the size (MiniMax: 20 MB at most). */
export function checkCloneFile(f) {
  if (!f) return 'Elige un audio.';
  if (!/\.(mp3|wav|m4a)$/i.test(f.name || '') && !/^audio\/(mpeg|mp3|wav|x-wav|wave|mp4|x-m4a|m4a)$/.test(f.type || '')) return 'Solo MP3, WAV o M4A.';
  if (f.size > 20 * 1024 * 1024) return 'Pasa de 20 MB: recórtalo (entre 10 s y 5 min basta).';
  if (f.size < 1024) return 'Está vacío o es demasiado corto.';
  return '';
}

/* ---------- V5.0 (1 Oct 2026, the owner: «grabar y clonar esa voz, o subir un fragmento, lo máximo que pueda… entre más aprenda
   mejor»): no editor — record with the microphone, or upload a fragment as it is; the office uses as much as MiniMax takes. ---------- */
/** MiniMax's clone limits (docs/minimax/api-verificada.md): 10 s to 5 min, 20 MB. The office records and converts at 24 kHz mono
    16-bit: 5 min is 14.4 MB, under the cap with room for the upload's base64. */
export const CLONE = { minS: 10, maxS: 300, maxBytes: 20 * 1024 * 1024, rate: 24000 };
/** 75 → «1:15». */
export const clock = s => { const t = Math.max(0, Math.floor(+s || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
/** What the owner reads about a clip's length, for a clone. level: 'bad' (cannot) · 'short' (works, little) · 'good' · 'cut' (over 5 min: the first 5 go). */
export function cloneLength(seconds) {
  const s = +seconds || 0, max = clock(CLONE.maxS);
  if (s < CLONE.minS) return { ok: false, level: 'bad', text: `Dura ${clock(s)}: MiniMax pide al menos ${CLONE.minS} segundos.` };
  if (s < 60) return { ok: true, level: 'short', text: `Dura ${clock(s)}: sirve, pero aprende mejor con más. Lo ideal: de 1 a ${CLONE.maxS / 60} minutos.` };
  if (s <= CLONE.maxS) return { ok: true, level: 'good', text: `Dura ${clock(s)} de ${max} posibles: ${s >= 240 ? 'casi el máximo, muy bien' : 'muy bien'}.` };
  return { ok: true, level: 'cut', text: `Dura ${clock(s)}: MiniMax toma hasta ${max}, así que se usan los primeros ${max}.` };
}
/** Several channels → one (the mean), at most `maxS` seconds. */
export function toMono(channels, rate, maxS = CLONE.maxS) {
  const n = Math.min(channels[0] ? channels[0].length : 0, Math.floor(rate * maxS)), out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}
/** Linear resampling, enough for a voice (MiniMax hears it at 24 kHz anyway). */
export function resample(data, from, to) {
  if (from === to) return data;
  const n = Math.max(1, Math.round(data.length * to / from)), out = new Float32Array(n), k = from / to;
  for (let i = 0; i < n; i++) { const x = i * k, a = Math.floor(x), b = Math.min(a + 1, data.length - 1), f = x - a; out[i] = data[a] * (1 - f) + data[b] * f; }
  return out;
}
/** Mono float samples → a 16-bit PCM WAV file (ArrayBuffer). */
export function encodeWav(samples, rate) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7FFF, true); }
  return buf;
}
/** Can a picked file go to MiniMax as it is (no conversion)? An mp3/wav/m4a of 5 min or less and 20 MB or less. */
export const fitsAsIs = (f, seconds) => /\.(mp3|wav|m4a)$/i.test(f && f.name || '') && f.size <= CLONE.maxBytes && seconds <= CLONE.maxS;

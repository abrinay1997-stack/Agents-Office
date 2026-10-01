// Agents Office — the Estudio's VOICE CLONING as a guided flow (1 Oct 2026, the owner: «el panel de la clonación de voz tiene que
// verse más intuitivo»; audit EST-01…EST-22). The part with no DOM: the three steps, the script to read aloud, the level meter in
// dBFS with its zones, what a take's quality means, the voice id made by the office, the prices, what is missing before «Clonar»
// and what a MiniMax error asks the owner to do. src/studio.js paints it; tests/studio-clonar.test.mjs checks it.
import { clock, CLONE } from './studio-voz.js';

/** What MiniMax charges (minimax-voices.mjs PRICE — the test keeps both equal): a cloned voice, a designed one, its sample per character. */
export const PRICE = { clone: 1.5, design: 3, previewPerChar: 30 / 1e6 };
/** US$ the way the rest of the Estudio writes it (Panamá: decimal point). */
export const usd = n => 'US$' + (+n || 0).toFixed(2);
/** A designed voice with its sample of `chars` characters. */
export const designCost = chars => PRICE.design + Math.max(1, +chars || 60) * PRICE.previewPerChar;

/** The three steps of a clone, in the words the owner reads. */
export const STEPS = ['Graba o sube tu voz', 'Escúchalo', 'Ponle nombre y clona'];

/** The tip, said once: what to do, not what MiniMax's limits are (the office converts and cuts on its own). */
export const TIP = 'Una sola persona, sin música ni ruido de fondo. Lo ideal: de 1 a 2 minutos. Cualquier audio vale: la oficina lo prepara.';
export const VERIFIED = 'MiniMax solo deja clonar a cuentas verificadas. Si la tuya no lo está, MiniMax lo dirá al clonar y no se cobra nada.';
export const VERIFY_URL = 'https://platform.minimax.io/user-center/basic-information';
export const CONSENT = 'Es mi voz, o tengo permiso por escrito de esa persona para clonarla.';

/** What to read aloud while recording: about 90 s each, varied (questions, figures, exclamations, calm and lively lines), in the
 *  owner's tone (tú, Panamá). Varied speech gives a better clone than improvising. */
export const SCRIPTS = [
  `¡Hola! ¿Cómo estás? Te cuento algo rápido: esta semana estamos estrenando un sitio web nuevo, y la verdad, quedó buenísimo.
Imagínatelo: fotos reales, textos claros y un botón de WhatsApp que sí funciona. ¿Y si el primer lunes te llegaran treinta y siete mensajes? ¡Qué alegría!
Mira, yo sé que a veces da pereza pensar en la página de tu negocio. Uno tiene mil cosas: clientes, proveedores, la planilla del quince y del treinta…
Por eso lo hacemos simple. Tú nos cuentas qué vendes, a quién y cómo te gusta hablar, y nosotros nos encargamos del resto.
Ahora, una pregunta honesta: si alguien te busca hoy en el celular, ¿te encuentra? ¿Y entiende en cinco segundos qué ofreces?
Piensa en tu cliente ideal: va en el metro, tiene dos minutos libres y abre tu página. ¿Qué ve primero? ¿Tus precios, tus fotos, tu horario? Esos dos minutos valen oro, y no se repiten.
Si la respuesta es «más o menos», escríbenos. Te mandamos una propuesta en cuarenta y ocho horas, sin compromiso.
Gracias por escucharme. ¡Que tengas un excelente día, y nos vemos pronto!`,
  `Buenas tardes. Hoy quiero hablarte, con calma, de cómo trabajamos.
Primero escuchamos. Una reunión de treinta minutos, café de por medio, y muchas preguntas: ¿qué te funciona?, ¿qué te frustra?, ¿qué esperas de aquí a diciembre?
Después proponemos. Un documento corto, de dos o tres páginas, con lo que incluye, lo que no incluye y cuánto cuesta. Sin letra pequeña.
Luego construimos. Cada viernes te enseñamos el avance, y tú decides. Si algo no te gusta, lo cambiamos. ¡Para eso estamos!
Mientras tanto, te pedimos poco: tus fotos, tu logo y diez minutos a la semana para responder dudas. Nada más. El resto del tiempo es tuyo, para atender a tus clientes como siempre lo has hecho, con calma y con cariño.
Y al final, lanzamos. Ese día revisamos todo dos veces: los formularios, los enlaces, la velocidad en el teléfono.
¿Lo mejor? Que no tienes que aprender nada técnico. Nosotros nos encargamos del hosting, de las copias de seguridad y de los sustos de madrugada.
Si tienes dudas, escríbenos de lunes a viernes, de ocho y media a cinco y media, o pásate por la oficina. Te esperamos.`,
  `¿Alguna vez te ha pasado esto? Abres tu correo un lunes a las siete de la mañana y tienes cincuenta y dos mensajes sin leer.
¡Qué estrés! Y entre todos esos, seguro hay tres o cuatro clientes que querían comprarte algo.
Bueno, para eso existe nuestra oficina de agentes: un equipo que ordena el correo, prepara las respuestas y te las deja listas para aprobar.
Uno se encarga de las facturas, otro de las redes sociales, otro de las propuestas para clientes nuevos. Cada uno sabe lo que hace, y todos trabajan al mismo tiempo, de día y de noche, sin cansarse y sin quejarse.
Tú solo revisas, dices «sí» o «cámbiale esto», y listo. Nada sale sin tu permiso. Nada.
Imagina ahorrar doce horas a la semana. ¡Doce horas! Eso es un día y medio de trabajo.
¿Y qué harías con ese tiempo? Quizá irte a la playa con tu familia el sábado, por primera vez en meses.
Así que te pregunto otra vez: ¿qué harías tú con un día y medio libre cada semana? Piénsalo, y cuando quieras, conversamos.
Un abrazo grande desde Panamá.`,
];
/** The script number `i` (any integer: it wraps). */
export const scriptAt = i => SCRIPTS[((Math.floor(+i || 0) % SCRIPTS.length) + SCRIPTS.length) % SCRIPTS.length];

/* ---------- the level meter ---------- */
/** One frame of the analyser (getByteTimeDomainData: 0…255, silence = 128) → its RMS in dBFS, its peak (0…1) and how many samples clip. */
export function frameLevel(wave) {
  let sum = 0, peak = 0, clip = 0; const n = wave && wave.length || 0;
  for (let i = 0; i < n; i++) { const x = (wave[i] - 128) / 128, a = Math.abs(x); sum += x * x; if (a > peak) peak = a; if (wave[i] <= 1 || wave[i] >= 254) clip++; }
  const rms = n ? Math.sqrt(sum / n) : 0;
  return { db: rms > 0 ? Math.max(-90, 20 * Math.log10(rms)) : -90, peak: Math.min(1, peak), clip };
}
/** The zone a frame is in, and what the owner should do: silence · low («acércate») · ok · clip («aléjate un poco»). */
export function levelZone({ db, peak, clip } = {}) {
  if (clip > 0 || peak >= 0.99) return { zone: 'clip', label: 'Satura: aléjate un poco' };
  if (db < -50) return { zone: 'silence', label: 'Silencio' };
  if (db < -32) return { zone: 'low', label: 'Muy bajo: acércate al micrófono' };
  return { zone: 'ok', label: 'Bien' };
}
/** Where the bar ends: −60 dBFS empty, 0 dBFS full, in percent. */
export const meterPct = db => Math.max(0, Math.min(100, Math.round((60 + (Number.isFinite(+db) ? +db : -90)) / 60 * 100)));

/** A take's quality, counted frame by frame while recording (≈5 frames a second). */
export const newStats = () => ({ frames: 0, clipFrames: 0, clipEvents: 0, silent: 0, low: 0, wasClip: false });
export function addFrame(st, lvl) {
  const z = levelZone(lvl).zone; st.frames++;
  if (z === 'clip') { st.clipFrames++; if (!st.wasClip) st.clipEvents++; st.wasClip = true; } else st.wasClip = false;
  if (z === 'silence') st.silent++; if (z === 'low') st.low++;
  return z;
}
/** What the take's quality means when it stops: 'good', or 'warn' with what to do. */
export function takeVerdict(st) {
  const f = Math.max(1, st && st.frames || 0), out = [];
  if (st && st.clipEvents >= 3) out.push(`Saturó ${st.clipEvents} veces: graba otra vez un poco más lejos del micrófono.`);
  if (st && st.silent / f > 0.45) out.push('Hubo mucho silencio: lee seguido, sin pausas largas.');
  else if (st && (st.low + st.silent) / f > 0.5) out.push('Se oye bajo: acércate al micrófono o habla un poco más fuerte.');
  return out.length ? { level: 'warn', text: out.join(' ') } : { level: 'good', text: 'Se oye bien: volumen parejo, sin saturar.' };
}
/** What a screen reader hears while recording: every 30 s, once. → the text, or '' when nothing is due. */
export function announce(seconds, last) {
  const s = Math.floor(+seconds || 0), slot = Math.floor(s / 30) * 30;
  return slot >= 30 && slot > (+last || 0) ? { at: slot, text: `Grabando: ${clock(slot)}${slot >= CLONE.maxS ? '' : `, quedan ${clock(CLONE.maxS - slot)}`}.` } : null;
}

/* ---------- the clip's length, in one sentence (EST-20) ---------- */
export function lengthLine(seconds, cut) {
  const s = +seconds || 0;
  if (cut || s > CLONE.maxS) return { ok: true, level: 'cut', text: `Lo recorté a los primeros ${clock(CLONE.maxS)} (el máximo de MiniMax). Listo para clonar.` };
  if (s < CLONE.minS) return { ok: false, level: 'bad', text: `Dura ${clock(s)}: hacen falta al menos ${CLONE.minS} segundos. Graba un poco más.` };
  if (s < 60) return { ok: true, level: 'short', text: `Dura ${clock(s)}: sirve, pero el clon sale mejor con 1 a 2 minutos.` };
  return { ok: true, level: 'good', text: `Dura ${clock(s)}: muy bien.` };
}

/* ---------- the voice id: made by the office (EST-05) ---------- */
export const VOICE_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{6,254}[A-Za-z0-9]$/;
/** «Mi voz» → «Voz_MiVoz_mg3k2x1a»: starts with a letter, 8+ characters, only letters, digits and _, never one already taken. */
export function autoVoiceId(name, taken = [], now = Date.now()) {
  const slug = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('').slice(0, 24) || 'Propia';
  const base = `Voz_${slug}_${Math.max(0, Math.floor(+now || 0)).toString(36)}`;
  for (let i = 0; i < 1000; i++) { const id = i ? `${base}${i}` : base; if (!taken.includes(id)) return id; }
  return base + Math.random().toString(36).slice(2, 8);
}

/* ---------- before «Clonar»: what is missing, said beside the button (EST-10) ---------- */
export function missing({ audio, audioOk = true, name, consent, idOk = true } = {}) {
  const m = [];
  if (!audio) m.push('grabar o elegir un audio'); else if (!audioOk) m.push('un audio de al menos 10 segundos');
  if (!String(name || '').trim()) m.push('ponerle un nombre');
  if (!idOk) m.push('un id válido (en «Más opciones»)');
  if (!consent) m.push('marcar la casilla del permiso');
  return m.length ? `Falta: ${m.join(' · ')}.` : '';
}

/* ---------- a MiniMax error, with what to do (EST-16): the server already says it in Spanish; this adds the next step ---------- */
const ADVICE = [
  [/2038|permiso para clonar|verific/i, 'verify', 'Tu cuenta de MiniMax aún no puede clonar voces. Verifícala en platform.minimax.io y vuelve a intentarlo: no se cobró nada.'],
  [/1008|saldo|balance/i, 'balance', 'Tu cuenta de MiniMax no tiene saldo. Recárgala en platform.minimax.io y vuelve a pulsar «Clonar».'],
  [/2037|entre 10 segundos|duration/i, 'length', 'MiniMax no aceptó la duración. Graba entre 10 segundos y 5 minutos.'],
  [/2039|ya existe|duplicate/i, 'dup', 'Ese id ya existía en MiniMax. Pulsa «Clonar» otra vez: la oficina inventa uno nuevo.'],
  [/1043|1044|asr|similar/i, 'quality', 'MiniMax no entendió bien la grabación. Graba otra vez más claro, sin ruido, o sube otro audio.'],
  [/1026|1027|sensible|sensitive/i, 'sensitive', 'MiniMax rechazó el audio por su filtro de contenido. Prueba con otra grabación.'],
  [/1004|2049|key|no autorizado|unauthor/i, 'key', 'La key de MiniMax no es válida. Revisa MINIMAX_API_KEY en Windows y reinicia la oficina.'],
  [/1002|1041|2045|esperar|429/i, 'wait', 'MiniMax pide esperar un poco. Vuelve a intentarlo en un minuto.'],
  [/conexi|network|fetch/i, 'offline', 'No hubo conexión con la oficina. Revisa que siga abierta y vuelve a intentarlo.'],
];
/** → { code, text } — the owner's next step, and the raw reason (without «MiniMax clonar voz:») kept short for the detail. */
export function cloneAdvice(error) {
  const raw = String(error || '').replace(/^MiniMax[^:]*:\s*/i, '').trim();
  for (const [re, code, text] of ADVICE) if (re.test(raw)) return { code, text, raw };
  return { code: 'other', text: `No se pudo clonar${raw ? ': ' + raw.charAt(0).toLowerCase() + raw.slice(1) : '.'}`, raw };
}

/** The day MiniMax deletes a voice nobody used (7 days after it was made), for a row that could not be «pinned». */
export function expiresOn(at, now = Date.now()) {
  const d = new Date((+at || now) + 7 * 864e5);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
}

/** Opening the panel again (revisión EST-02): a take not cloned yet stays, whatever screen the owner left it on — the clone step
 *  or «‹ Voces» from step 2 or 3. Once cloned (`done`) the next opening starts fresh. */
export const keepTake = s => !!(s && s.take && s.step !== 'done');
/** The line on the «Clonar mi voz» card while a take waits, so a recording is never dropped without a word. */
export function pendingLine(s) {
  if (!keepTake(s)) return '';
  return `Tienes un audio sin clonar${s.take.seconds ? ` (${clock(s.take.seconds)})` : ''}: continúa en el paso ${s.step === 3 ? 3 : 2}.`;
}

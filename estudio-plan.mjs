// Agents Office — Dimitri's «estudio» mode (V4.8): what Dimitri reads about the Estudio, and what comes back checked.
// Pure: no file, no network, no serve.mjs. The server hands in the catalog (media.models()), the budget, the folders and a
// galleryHas(id) check; nothing here generates — only POST /api/sub/studio does, after the owner presses GENERAR.
//
//   studioPromptBlock({ models, budget, folders, attach, approved, voices, ask, defaults }) → text for Dimitri's system prompt
//   parseCreatives(json, { models, folders, galleryHas, maxPerRequest, defaultModel, estimate?, voices? }) → [creative]
//   estimatePlan(creatives, { estimate, budget, models? }) → { total, perItem, fits, why }
//   parseActions(list, { galleryHas }) → only carpeta_crear · carpeta_renombrar · mover · enviar_contenido
//   approvedFromNote(name, text) → { title, prompt, model, file } (an Estudio note in the Brain, as Dimitri sees it)
//   presetsBlock({ presets, canales, ask, propios, lotes }) → «PRESETS (usa SOLO estos ids)», ≤ PRESETS_MAX (banco de presets F3, §8.1)
//   A creative may carry `presets` instead of a prompt (§8.2): parseCreatives then compiles it with ctx.compile (presets.compilar),
//   the same compiler the Estudio uses, and the card shows its steps, its model and its cost; the prompt is the compiler's.
import { buscar as buscarPresets } from './src/presets-buscar.js';
import { escenaDe, escenaEs, pilaLimpia, lotesText } from './estudio-lote.mjs';
export const ROLES = ['reference', 'start', 'end', 'video'];
export const ACTIONS = ['carpeta_crear', 'carpeta_renombrar', 'mover', 'enviar_contenido'];
export const MAX_CREATIVES = 8;
export const KINDS = ['image', 'video', 'audio', 'music']; // V4.10: a voice-over (audio) and a piece of music too — MiniMax
const KIND_ES = { image: 'imagen', video: 'video', audio: 'voz', music: 'música' }, KIND_UP = { image: 'IMAGEN', video: 'VIDEO', audio: 'VOZ', music: 'MÚSICA' };
const UNIT_ES = { image: 'imagen', video: 'video', audio: 'locución', music: 'pieza' };
export const WEIGHT = { video: 5, music: 3 }; // the same weights as media.mjs: an image or a voice-over 1 (src/sub-studio.js imports these: one source)
export const weightOf = kind => WEIGHT[kind] || 1;
/** «1 imagen», «2 videos», «1 locución», «2 piezas musicales» — what a finished creative brought (V4.11, DIM-02). */
export const unitWord = (kind, n = 1) => (kind === 'video' ? (n === 1 ? 'video' : 'videos') : kind === 'audio' ? (n === 1 ? 'locución' : 'locuciones') : kind === 'music' ? (n === 1 ? 'pieza musical' : 'piezas musicales') : n === 1 ? 'imagen' : 'imágenes');
export const COMPACT_OVER = 12; // V4.11 (DIM-04): past this many models on, the block lists the best few per kind in full and only the ids of the rest
const ROLE_ES = { reference: 'referencias', start: 'fotograma inicial', end: 'fotograma final', video: 'video de origen' };
const NEED_ES = { start: 'una imagen inicial', end: 'una imagen final', video: 'un video de origen', reference: 'imágenes de referencia' };
const TIER = { 1: 'básica', 2: 'buena', 3: 'alta', 4: 'la mejor' };
const VIDEO_RE = /\.(mp4|webm)$/i, AUDIO_RE = /\.(mp3|wav|flac|m4a|ogg)$/i;
const str = (v, max) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const cleanName = v => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); // the same rule as media.addFolder
const usd = v => 'US$' + (+v || 0).toFixed(2);

const settingText = (k, f) => f.type === 'enum' ? `${k} [${f.values.join('|')}] (def ${f.default})` : f.type === 'range' ? `${k} ${f.min}–${f.max} (def ${f.default})` : f.type === 'boolean' ? `${k} sí/no (def ${f.default ? 'sí' : 'no'})` : f.type === 'text' ? `${k} texto${f.default ? ` (def ${f.default})` : ''}` : k;
function modelLine(m, { settings = true } = {}) {
  const roles = Object.entries(m.roles || {}).filter(([, n]) => n > 0).map(([r, n]) => `${r} ≤${n}`).join(', ');
  const cost = m.engine === 'prueba' ? 'gratis (prueba: una tarjeta, no una imagen de verdad)' : m.perChar ? `${usd(m.cost)} por 1.000 caracteres` : m.per === 's' ? `${usd(m.cost)} por segundo` : `${usd(m.cost)} por ${UNIT_ES[m.kind] || 'imagen'}`;
  return `- ${m.id} · ${m.name} · ${KIND_UP[m.kind] || 'IMAGEN'} · ${m.maker || m.engineName || m.engine} · calidad ${TIER[m.tier] || 'buena'} · ${m.speed || 'normal'}${m.uses?.length ? ' · para: ' + m.uses.join(', ') : ''} · ${cost}` +
    `${roles ? ' · toma: ' + roles : ''}${m.needs?.length ? ' · NECESITA: ' + m.needs.join(', ') : ''}${m.edit ? ' · edita una imagen' : ''}` +
    `${settings && Object.keys(m.settings || {}).length ? ' · ajustes: ' + Object.entries(m.settings).map(([k, f]) => settingText(k, f)).join('; ') : ''}${m.note ? ' · ' + str(m.note, 160) : ''}`;
}
/** The best few of one kind for this request: the default first, then what the request's words hit in «uses» and the name, then quality, then price. */
function pick(list, { ask = '', def = null, n = 3 } = {}) {
  const words = String(ask).toLowerCase().split(/[^a-záéíóúñü0-9]+/).filter(w => w.length > 3);
  const hit = m => words.filter(w => `${m.name} ${(m.uses || []).join(' ')} ${m.maker || ''}`.toLowerCase().includes(w)).length;
  return list.slice().sort((a, b) => (b.id === def) - (a.id === def) || hit(b) - hit(a) || (b.tier || 2) - (a.tier || 2) || (+a.cost || 0) - (+b.cost || 0)).slice(0, n);
}
/**
 * The Estudio as Dimitri reads it: ONLY the models that are on, what is left of the caps, the folders, the attached files, the owner's voices.
 * V4.11 (DIM-04): with more than COMPACT_OVER models on, each kind lists its default with every setting and the next best two in one short
 * line; the rest only by id (parseCreatives fills their defaults). `ask` is the owner's message (it ranks by «uses»); `defaults(kind)` the default id.
 * voices (DIM-03): [{ voiceId, name, kind: 'system'|'clone'|'design', at? }] — the only voiceIds a voice-over may take.
 * What the owner is looking at left this block: it is <viendo> in sub.systemPrompt (DIM-08).
 */
export function studioPromptBlock({ models = [], budget = null, folders = [], attach = [], approved = [], voices = [], ask = '', defaults = () => null } = {}) {
  const on = models.filter(m => m.on && !m.legacy);
  const out = ['MODELOS DEL ESTUDIO ENCENDIDOS (usa SOLO estos ids; los demás no tienen key):'];
  if (!on.length) out.push('- ninguno: el Estudio no tiene motores encendidos (dilo; no propongas creativos)');
  else if (on.length <= COMPACT_OVER) out.push(on.map(m => modelLine(m)).join('\n'));
  else for (const k of KINDS) {
    const list = on.filter(m => m.kind === k); if (!list.length) continue;
    const def = defaults(k), best = pick(list, { ask, def, n: 3 }), rest = list.filter(m => !best.includes(m));
    out.push(`${KIND_UP[k]} (${list.length} encendidos):`);
    out.push(best.map((m, i) => modelLine(m, { settings: i === 0 })).join('\n'));
    if (rest.length) out.push(`- otros de ${KIND_ES[k]} (usa su id; sus ajustes van por defecto): ${rest.slice(0, 40).map(m => m.id).join(', ')}${rest.length > 40 ? '…' : ''}`);
  }
  // V4.10: what a sound creative carries in its prompt · V4.11 (DIM-03): the voices it may take, by id
  if (on.some(m => m.kind === 'audio')) {
    out.push('UNA VOZ (kind "audio"): prompt = el texto EXACTO que se dirá, en el idioma en que se dirá; settings.voiceId = UNA de estas VOCES, ninguna otra:');
    const own = voices.filter(v => v.kind !== 'system'), sys = voices.filter(v => v.kind === 'system');
    out.push(!voices.length ? '- la voz por defecto del modelo'
      : [`- del dueño: ${own.length ? own.map(v => `${v.voiceId} «${str(v.name, 40)}» (${v.kind === 'clone' ? 'clonada' : 'diseñada'}${v.at ? ' el ' + new Date(v.at).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''})`).join(' · ') : 'ninguna todavía (si pide «mi voz», dile que la clone en el Estudio → Voces)'}`,
        sys.length ? `- del sistema: ${sys.slice(0, 24).map(v => `${v.voiceId}${v.name ? ' «' + str(v.name, 30) + '»' : ''}`).join(' · ')}` : ''].filter(Boolean).join('\n'));
  }
  if (on.some(m => m.kind === 'music')) out.push('UNA MÚSICA (kind "music"): prompt = la letra con [Verse] [Chorus]… o, con settings.instrumental = true, la descripción de la pieza; settings.style = el estilo (género, ánimo, voz).');
  if (budget) {
    const caps = [];
    caps.push(budget.left == null ? 'sin tope de cantidad al día' : `hoy quedan ${budget.left} de ${budget.limit} (una imagen o una locución cuenta 1, una música 3, un video 5)`);
    if (budget.costLeftDay != null) caps.push(`dinero del día: quedan ${usd(budget.costLeftDay)} de ${usd(budget.dailyBudget)}`);
    if (budget.costLeftMonth != null) caps.push(`dinero del mes: quedan ${usd(budget.costLeftMonth)} de ${usd(budget.monthlyBudget)}`);
    caps.push(`máximo ${budget.maxPerRequest || 8} imágenes por creativo (video: 4)`);
    out.push('\nTOPES DEL ESTUDIO: ' + caps.join(' · '));
  }
  out.push('\nCARPETAS DEL ESTUDIO: ' + (folders.length ? folders.map(f => `«${f.name}»${f.n != null ? ` (${f.n})` : ''}`).join(', ') : 'ninguna todavía'));
  const isAV = a => VIDEO_RE.test(a.id) || AUDIO_RE.test(a.id), imgs = attach.filter(a => !isAV(a)), av = attach.filter(isAV);
  if (imgs.length) out.push('\nIMÁGENES ADJUNTAS POR EL DUEÑO (las ves arriba; úsalas por su id en media.reference, media.start o media.end):\n' + imgs.map((a, k) => `- ${k + 1}. id: ${a.id}${a.prompt ? ' · su prompt: ' + str(a.prompt, 200) : ''}${a.folder ? ' · carpeta: ' + a.folder : ''}`).join('\n'));
  if (av.length) out.push('\nVIDEO O AUDIO ADJUNTO POR EL DUEÑO (no lo ves: lo conoces por su prompt; un video va en media.video para editarlo o extenderlo con un modelo que lo tome):\n' + av.map(a => `- ${VIDEO_RE.test(a.id) ? 'video' : 'audio'} id: ${a.id}${a.prompt ? ' · su prompt: ' + str(a.prompt, 200) : ''}${a.folder ? ' · carpeta: ' + a.folder : ''}`).join('\n'));
  if (approved.length) out.push('\nCREATIVOS APROBADOS PARECIDOS (los que al dueño le gustaron: parte de ahí, no los copies):\n' + approved.slice(0, 4).map(a => `- «${str(a.title, 90)}» · ${a.model || '?'}${a.file ? ' · ' + a.file : ''} · prompt: ${str(a.prompt, 400)}`).join('\n'));
  return out.join('\n');
}

/* ---------- banco de presets F3 (E7): lo que Dimitri lee del banco, y cómo propone con presets ---------- */
export const PRESETS_MAX = 2500; // §8.1 y §13.4: compacto, y solo en los mensajes del Estudio (DIM-04)
/** Las reglas del lote y de la escena 3D: van con el bloque (solo en los mensajes del Estudio), no en cada mensaje de Dimitri. */
export const LOTE_REGLAS = `CÓMO PROPONES CON PRESETS
- Una edición de UNA o pocas fotos (≤ 4): un creativo {"kind":"image","title","presets":[{"id","params":{}}],"input":"<id de su foto en la galería>","canal":"<id de canal>","refs":[],"escena":null,"idea":"<opcional>","model":null}. Sin "prompt": lo escribe el banco.
- Un LOTE (más de 4 fotos, una carpeta o un Excel adjunto): UN "lote", no creativos: {"nombre":"<≤60>","fotos":{"carpeta":"<nombre>"}|{"ids":[…]}|{"hoja":"<id>"},"receta":{"pila":[{"id","params":{}}],"canal":"<id>","escena":null,"idea":""},"modelo":null,"muestra":3,"carpeta_destino":"<nombre>","por_que":"<una frase>"}.
- ESCENA 3D cuando hablan de distancia, ángulo, picado, cenital, contrapicado («desde sus pies») o medidas: {"tipo":"cama-queen|cama-king|sofa|cafetera|televisor-55|persona|producto","toma":"frontal|tres-cuartos|lateral|picado-45|cenital|contrapicado|ras-piso","distancia":"ajustado|catalogo|margen|aire","proporcion":"4:5","fondo":{"tipo":"color|set|locacion","valor":"#FFFFFF"}} (opcional "ancho","alto","fondoCm" en cm). El margen es DISTANCIA de cámara: no se recorta nada.
- Si falta el canal o qué fotos, NO propongas el lote: modo "pregunta" con UNA pregunta de 2 a 4 opciones (p. ej. «¿Para dónde son?»: Web con margen 60 % (recomendado) · Instagram 4:5 · FB/IG Shop · Amazon 85 %).
- Un lote en marcha (LOTES): "actions" {"type":"lote_pausar","lote":"<id>"} · {"type":"lote_reanudar","lote"} · {"type":"lote_reintentar","lote","filas":"fallidas"|[n],"modelo":null} (gasta: dilo) · {"type":"lote_aprobar","lote","filas":"listas"|[n]}. Cada una espera el clic del dueño.
- Nada empieza hasta PROBAR CON 3 o GENERAR: tú solo propones, con su costo.`;
const presetLinea = p => `${p.id} «${p.nombre}»`;
/**
 * «PRESETS (usa SOLO estos ids)»: los 5 más a propósito del mensaje con su frase, los del dueño, los ids de imagen por grupo (los de la
 * primera fase; si no cabe, solo los grupos de lo encontrado), los canales y los ejes de referencia. Nunca pasa de `max`.
 * presets: el banco (presets.todos().presets); grupos: [{ id, nombre }]; lotes: lotes.lista() (para que nombre los suyos por id).
 */
export function presetsBlock({ presets = [], canales = [], grupos = [], ask = '', lotes = [], max = PRESETS_MAX, buscar = buscarPresets } = {}) {
  const img = presets.filter(p => (p.medios || []).includes('image'));
  if (!img.length) return '';
  const hits = (() => { try { return String(ask).trim() ? buscar(ask, img, { max: 5 }) : []; } catch { return []; } })();
  const byId = new Map(img.map(p => [p.id, p]));
  const top = hits.map(h => byId.get(h.id)).filter(Boolean);
  const propios = img.filter(p => p.propio || /^mio-/.test(p.id) || p.categoria === 'mios');
  const gnombre = id => grupos.find(g => g.id === id)?.nombre || id;
  const enGrupo = g => img.filter(p => p.categoria === g && !propios.includes(p) && (p.fase || 1) <= 1);
  const cats = [...new Set(img.map(p => p.categoria))].filter(g => g !== 'mios');
  const cab = 'PRESETS DEL BANCO (usa SOLO estos ids; los del dueño mandan sobre los de fábrica):';
  const partes = {
    top: top.length ? 'Para este pedido: ' + top.map(p => `${presetLinea(p)} — ${String(p.frase || '').slice(0, 90)}`).join(' · ') : '',
    propios: propios.length ? 'De PanaClaw (del dueño): ' + propios.slice(0, 8).map(presetLinea).join(', ') : '',
    canales: canales.length ? 'CANALES: ' + canales.map(c => `${c.id} (${c.nombre}${c.ocupacion ? ` ${Math.round(c.ocupacion * 100)} %` : ''})`).join(', ') : '',
    ejes: 'REFERENCIA por ejes (0–3): estilo, color, composicion, luz, fondo, pose, producto (producto nunca encendido sin que lo pida).',
    lotes: lotesText(lotes),
  };
  const grupoLinea = g => { const l = enGrupo(g); return l.length ? `${gnombre(g)}: ${l.map(p => p.id).join(', ')}` : ''; };
  const armar = gs => [cab, partes.top, partes.propios, 'Por grupo — ' + gs.map(grupoLinea).filter(Boolean).join(' · '), partes.canales, partes.ejes, partes.lotes].filter(Boolean).join('\n');
  let out = armar(cats);
  if (out.length > max) out = armar([...new Set(top.map(p => p.categoria))].filter(g => g !== 'mios').concat(['catalogo']).filter((g, k, a) => a.indexOf(g) === k)); // §13.4: solo los grupos que tocan el pedido
  return out.length > max ? out.slice(0, max - 1) + '…' : out;
}
/** A creative with presets (§8.2): compiled, never a free prompt. Unknown ids out (said), the photo and the references must be in the gallery. */
function presetCreative(c, i, { presets = [], canales = [], galleryHas = () => false, compile, models = [], maxPerRequest = 8 } = {}) {
  const VID = /\.(mp4|webm)$/i;
  const input = typeof c.input === 'string' && galleryHas(c.input) && !VID.test(c.input) && !AUDIO_RE.test(c.input) ? c.input : null;
  const refs = (Array.isArray(c.refs) ? c.refs : []).slice(0, 4).map(x => (typeof x === 'string' ? { id: x } : x)).filter(x => x && typeof x.id === 'string' && galleryHas(x.id) && !VID.test(x.id) && !AUDIO_RE.test(x.id))
    .map(x => ({ id: x.id, ...(x.ejes && typeof x.ejes === 'object' ? { ejes: x.ejes } : c.ejes && typeof c.ejes === 'object' ? { ejes: c.ejes } : {}) }));
  const notes = [];
  if (c.input && !input) notes.push(`(«${str(c.input, 60)}» no está en la galería.)`);
  // the pile: known ids only (a creative may start from scratch, so the mode is not forced here: the compiler says it)
  const byId = new Map(presets.map(p => [p.id, p])), pila = [];
  for (const x of c.presets.slice(0, 12)) { const it = typeof x === 'string' ? { id: x } : x; if (!it || typeof it.id !== 'string') continue; if (!byId.has(it.id)) { notes.push(`(No conozco el preset «${str(it.id, 40)}»: lo quité.)`); continue; } pila.push({ id: it.id, ...(it.params && typeof it.params === 'object' && !Array.isArray(it.params) ? { params: it.params } : {}) }); }
  const canal = typeof c.canal === 'string' ? canales.find(k => k.id === c.canal || k.nombre.toLowerCase() === c.canal.toLowerCase()) || null : null;
  if (c.canal && !canal) notes.push(`(No conozco el canal «${str(c.canal, 30)}».)`);
  const escena = escenaDe(c.escena), idea = str(c.idea, 600);
  const n = Math.max(1, Math.min(Math.min(4, maxPerRequest), Math.round(+c.n) || 1));
  const why = [str(c.why, 400), ...notes].filter(Boolean).join(' ');
  const base = { i, title: str(c.title, 90) || `Edición ${i + 1}`, kind: 'image', why, presets: pila, input, refs, canal: canal ? canal.id : null, canalEs: canal ? canal.nombre : '', ...(escena ? { escena, escenaEs: escenaEs(escena) } : {}), idea,
    recetaEs: pila.map(x => byId.get(x.id)?.nombre || x.id), n, settings: {}, media: { reference: [input, ...refs.map(r => r.id)].filter(Boolean), start: [], end: [], video: [] },
    purpose: str(c.purpose, 200), folder: c.folder ? str(c.folder, 60) : null, prompt: '', prompt_es: '' };
  if (!pila.length && !escena && !idea) return { ...base, model: null, modelName: '', cost: 0, state: 'skipped', error: 'ningún preset de los que pidió existe en el banco' };
  if (typeof compile !== 'function') return { ...base, model: null, modelName: '', cost: 0, state: 'skipped', error: 'el banco de presets no está disponible' };
  const pedido = { pila, params: canal ? { canal: canal.id } : {}, entradas: { foto: input ? [input] : [], referencias: refs }, escena, idea, n, ...(typeof c.model === 'string' && c.model ? { model: c.model } : {}) };
  let plan; try { plan = compile(pedido); } catch (e) { return { ...base, model: null, modelName: '', cost: 0, state: 'skipped', error: `no pude preparar la receta: ${e.message}` }; }
  const nm = id => models.find(m => m.id === id)?.name || id;
  const out = { ...base, model: plan.model || 'local', modelName: plan.model ? nm(plan.model) : 'En tu máquina (gratis)', soloLocal: !!plan.soloLocal, porque: str(plan.porque, 200),
    pasos: (plan.pasos_es || []).slice(0, 14), conserva: str(plan.conserva_es, 200), prompt: str(plan.prompt, 4000), prompt_es: str(plan.prompt_es, 4000), avisosPreset: (plan.avisos || []).map(a => str(a.texto || a, 200)).slice(0, 6),
    alternativas: (plan.alternativas || []).filter(a => a && a.id && a.on !== false).slice(0, 5).map(a => ({ id: a.id, name: nm(a.id) })),
    cost: plan.soloLocal ? 0 : +(+plan.costo?.usd || 0).toFixed(4), state: 'proposed' }; // costo.usd already counts the n
  if (plan.errores?.length) return { ...out, state: 'skipped', error: plan.errores.join(' · ') };
  return out;
}

/** The settings as the model takes them: unknown keys out, a value off its list → that setting's default, a range clamped. */
export function cleanSettings(m, given = {}) {
  const s = {}, g = given && typeof given === 'object' ? given : {};
  for (const [k, f] of Object.entries(m.settings || {})) {
    let v = g[k];
    if (f.type === 'enum') v = v != null && f.values.includes(String(v)) ? String(v) : f.default;
    else if (f.type === 'range') { v = Number(v); v = g[k] == null || !Number.isFinite(v) ? f.default : Math.min(f.max, Math.max(f.min, v)); if (!f.step || f.step >= 1) v = Math.round(v); }
    else if (f.type === 'boolean') v = typeof v === 'boolean' ? v : f.default;
    else if (f.type === 'text') { v = typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, f.max || 2000) : ''; if (!v) v = f.default; } // V4.10: a voiceId, a music style
    else continue;
    s[k] = v;
  }
  return s;
}
/**
 * Claude's creatives → checked against the real catalog. json: the parsed answer ({ creatives }) or the array itself.
 * A model that is off or unknown → the default for its kind, said in «why». Media not in the gallery, in a role the model does not take, or
 * of the wrong kind → out; each role up to its maximum. A need left unmet → state «skipped» with the reason (nothing to generate).
 */
export function parseCreatives(json, { models = [], folders = [], galleryHas = () => false, maxPerRequest = 8, defaultModel = () => null, estimate = null, voices = null, presets = null, canales = [], compile = null } = {}) { // voices: the voiceIds that exist (the owner's and the system's), V4.11 · presets/canales/compile: the bank (F3)
  const raw = Array.isArray(json) ? json : Array.isArray(json?.creatives) ? json.creatives : [];
  const byId = new Map(models.map(m => [m.id, m]));
  return raw.filter(c => c && typeof c === 'object').slice(0, MAX_CREATIVES).map((c, i) => {
    if (Array.isArray(c.presets) && c.presets.length && (c.kind || 'image') === 'image') { // §8.2: a creative with presets needs no prompt
      const pc = presetCreative(c, i, { presets: presets || [], canales, galleryHas, compile, models, maxPerRequest });
      if (pc.folder) pc.folder = cleanName(folders.find(f => f.id === pc.folder)?.name || pc.folder) || null;
      return pc;
    }
    let kind = KINDS.includes(c.kind) ? c.kind : 'image';
    const asked = str(c.model, 80); let m = byId.get(asked); let why = str(c.why, 400);
    if (m && m.on && !m.legacy) kind = m.kind;
    else {
      const d = byId.get(defaultModel(kind));
      if (asked) why = `${why ? why + ' ' : ''}(Pediste «${asked}», que ${m ? 'no está encendido' : 'no existe en el Estudio'}: uso ${d ? d.name : 'el de por defecto'}.)`.trim();
      m = d && d.on ? d : null;
    }
    const base = { i, title: str(c.title || c.prompt, 90) || `Creativo ${i + 1}`, kind, why, prompt: str(c.prompt, m?.maxPrompt || 4000), prompt_es: str(c.prompt_es, 4000), purpose: str(c.purpose, 200),
      folder: c.folder ? cleanName(folders.find(f => f.id === c.folder)?.name || c.folder) || null : null };
    if (!m) return { ...base, model: asked || null, modelName: asked || '', n: 1, settings: {}, media: { reference: [], start: [], end: [], video: [] }, cost: 0, state: 'skipped', error: `no hay ningún modelo de ${KIND_ES[kind]} encendido en el Estudio` };
    const media = {};
    for (const r of ROLES) {
      const max = +(m.roles || {})[r] || 0; const want = Array.isArray(c.media?.[r]) ? c.media[r] : [];
      media[r] = max ? [...new Set(want.filter(x => typeof x === 'string' && galleryHas(x) && !AUDIO_RE.test(x) && (r === 'video' ? VIDEO_RE.test(x) : !VIDEO_RE.test(x))))].slice(0, max) : [];
    }
    const top = kind === 'video' ? Math.min(4, maxPerRequest) : maxPerRequest;
    const n = Math.max(1, Math.min(top, Math.round(+c.n) || 1));
    const settings = cleanSettings(m, c.settings);
    if (voices && voices.length && m.kind === 'audio' && m.settings?.voiceId && !voices.includes(settings.voiceId)) { // DIM-03: an invented voiceId failed in MiniMax after GENERAR
      const asked = settings.voiceId; settings.voiceId = voices.includes(m.settings.voiceId.default) ? m.settings.voiceId.default : voices[0];
      base.why = `${base.why ? base.why + ' ' : ''}(La voz «${str(asked, 60)}» no está entre tus voces: uso ${settings.voiceId}. Cámbiala en la tarjeta.)`.trim();
    }
    const out = { ...base, model: m.id, modelName: m.name, n, settings, media, cost: estimate ? estimate({ model: m.id, n, settings, prompt: base.prompt }) : 0, state: 'proposed' };
    const unmet = (m.needs || []).filter(r => !media[r]?.length);
    if (unmet.length) return { ...out, state: 'skipped', error: `${m.name} necesita ${unmet.map(r => NEED_ES[r] || r).join(' y ')} y no la hay en la galería` };
    if (!out.prompt && !(m.needs || []).includes('video')) return { ...out, state: 'skipped', error: 'falta el prompt' };
    return out;
  });
}
/** What the plan costs and whether it fits what is left today and this month. Only proposed, included creatives count; the test engine is free. */
export function estimatePlan(creatives = [], { estimate = () => 0, budget = null, models = [] } = {}) {
  const free = id => (models.find(m => m.id === id)?.engine || (/^prueba/.test(id) ? 'prueba' : '')) === 'prueba';
  const live = creatives.filter(c => c.state === 'proposed' && c.include !== false);
  const perItem = live.map(c => ({ i: c.i, cost: free(c.model) || c.soloLocal ? 0 : Array.isArray(c.presets) ? +(+c.cost || 0).toFixed(3) : +(+estimate({ model: c.model, n: c.n, settings: c.settings, prompt: c.prompt }) || 0).toFixed(3) })); // a creative with presets: the compiler's cost
  const total = +perItem.reduce((s, x) => s + x.cost, 0).toFixed(3);
  const weight = live.filter(c => !free(c.model) && !c.soloLocal).reduce((s, c) => s + (WEIGHT[c.kind] || 1) * c.n, 0);
  const no = [];
  if (budget) {
    if (budget.left != null && weight > budget.left) no.push(`el tope de hoy: esto son ${weight} y quedan ${budget.left}`);
    if (budget.costLeftDay != null && total > budget.costLeftDay + 1e-9) no.push(`el dinero del día: quedan ${usd(budget.costLeftDay)}`);
    if (budget.costLeftMonth != null && total > budget.costLeftMonth + 1e-9) no.push(`el dinero del mes: quedan ${usd(budget.costLeftMonth)}`);
  }
  return { total, perItem, fits: !no.length, why: no.length ? `No cabe en ${no.join(' y en ')}. Quita algo o súbelo en Ajustes → Estudio.` : `Cabe: aprox. ${usd(total)}${live.length ? '' : ' (nada que generar)'}.` };
}
/** The organising Dimitri may propose — a closed list. Anything else is ignored; files must be in the gallery. */
export function parseActions(list, { galleryHas = () => false } = {}) {
  const out = [];
  for (const a of (Array.isArray(list) ? list : []).slice(0, 40)) {
    if (!a || typeof a !== 'object' || !ACTIONS.includes(a.type)) continue;
    if (a.type === 'carpeta_crear') { const name = cleanName(a.name); if (name) out.push({ type: a.type, name }); }
    else if (a.type === 'carpeta_renombrar') { const from = cleanName(a.from), to = cleanName(a.to); if (from && to && from !== to) out.push({ type: a.type, from, to }); }
    else if (a.type === 'mover') { const files = [...new Set((Array.isArray(a.files) ? a.files : []).filter(x => typeof x === 'string' && galleryHas(x)))].slice(0, 200), folder = cleanName(a.folder); if (files.length && folder) out.push({ type: a.type, files, folder }); }
    else if (a.type === 'enviar_contenido') { // V4.11 (DIM-17): a title in Spanish, and the day, hour, format and networks when the owner said them
      if (typeof a.file !== 'string' || !galleryHas(a.file)) continue;
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(a.fecha || '') ? a.fecha : '', hora = fecha && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.hora || '') ? a.hora : '';
      const formato = ['post', 'reel', 'carrusel', 'historia'].includes(a.formato) ? a.formato : '', redes = [...new Set((Array.isArray(a.redes) ? a.redes : []).map(r => String(r).toLowerCase()).filter(r => r === 'instagram' || r === 'facebook'))];
      out.push({ type: a.type, file: a.file, ...(str(a.titulo, 120) ? { titulo: str(a.titulo, 120).replace(/\s+/g, ' ') } : {}), ...(str(a.texto, 2200) ? { texto: str(a.texto, 2200) } : {}), ...(fecha ? { fecha } : {}), ...(hora ? { hora } : {}), ...(formato ? { formato } : {}), ...(redes.length ? { redes } : {}) });
    }
    if (out.length >= 20) break;
  }
  return out.map((a, k) => ({ k, ...a, state: 'proposed' }));
}
/** An Estudio note (<brain>/Agents Office/estudio/…) → what Dimitri needs of it. Reads a `key: value` header or body lines and the first /media/ link. */
export function approvedFromNote(name, text) {
  const t = String(text || '');
  const field = (...ks) => { for (const k of ks) { const r = t.match(new RegExp(`^\\s*(?:[-*]\\s*)?\\*{0,2}${k}\\*{0,2}\\s*:\\s*(?:\\*\\*\\s*)?(.+)$`, 'im')); if (r) return r[1].replace(/^["'«]|["'»]$/g, '').trim(); } return ''; };
  const file = (t.match(/\/media\/([^)\s?"]+)/) || [])[1] || field('archivo', 'file');
  const title = field('titulo', 'título', 'title') || (t.match(/^#\s+(.+)$/m) || [])[1] || String(name).replace(/^\d{4}-\d{2}-\d{2}\s*/, '');
  return { title: str(title, 90), prompt: str(field('prompt'), 600), model: str(field('modelo', 'model'), 60), file: file ? decodeURIComponent(file) : '' };
}

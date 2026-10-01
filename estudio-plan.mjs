// Agents Office — Dimitri's «estudio» mode (V4.8): what Dimitri reads about the Estudio, and what comes back checked.
// Pure: no file, no network, no serve.mjs. The server hands in the catalog (media.models()), the budget, the folders and a
// galleryHas(id) check; nothing here generates — only POST /api/sub/studio does, after the owner presses GENERAR.
//
//   studioPromptBlock({ models, budget, folders, attach, context, approved }) → text for Dimitri's system prompt
//   parseCreatives(json, { models, folders, galleryHas, maxPerRequest, defaultModel, estimate? }) → [creative]
//   estimatePlan(creatives, { estimate, budget, models? }) → { total, perItem, fits, why }
//   parseActions(list, { galleryHas }) → only carpeta_crear · carpeta_renombrar · mover · enviar_contenido
//   approvedFromNote(name, text) → { title, prompt, model, file } (an Estudio note in the Brain, as Dimitri sees it)
export const ROLES = ['reference', 'start', 'end', 'video'];
export const ACTIONS = ['carpeta_crear', 'carpeta_renombrar', 'mover', 'enviar_contenido'];
export const MAX_CREATIVES = 8;
export const KINDS = ['image', 'video', 'audio', 'music']; // V4.10: a voice-over (audio) and a piece of music too — MiniMax
const KIND_ES = { image: 'imagen', video: 'video', audio: 'voz', music: 'música' }, KIND_UP = { image: 'IMAGEN', video: 'VIDEO', audio: 'VOZ', music: 'MÚSICA' };
const UNIT_ES = { image: 'imagen', video: 'video', audio: 'locución', music: 'pieza' };
const WEIGHT = { video: 5, music: 3 }; // the same weights as media.mjs: an image or a voice-over 1
const ROLE_ES = { reference: 'referencias', start: 'fotograma inicial', end: 'fotograma final', video: 'video de origen' };
const NEED_ES = { start: 'una imagen inicial', end: 'una imagen final', video: 'un video de origen', reference: 'imágenes de referencia' };
const TIER = { 1: 'básica', 2: 'buena', 3: 'alta', 4: 'la mejor' };
const VIDEO_RE = /\.(mp4|webm)$/i, AUDIO_RE = /\.(mp3|wav|flac|m4a|ogg)$/i;
const str = (v, max) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const cleanName = v => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); // the same rule as media.addFolder
const usd = v => 'US$' + (+v || 0).toFixed(2);

const settingText = (k, f) => f.type === 'enum' ? `${k} [${f.values.join('|')}] (def ${f.default})` : f.type === 'range' ? `${k} ${f.min}–${f.max} (def ${f.default})` : f.type === 'boolean' ? `${k} sí/no (def ${f.default ? 'sí' : 'no'})` : f.type === 'text' ? `${k} texto${f.default ? ` (def ${f.default})` : ''}` : k;
function modelLine(m) {
  const roles = Object.entries(m.roles || {}).filter(([, n]) => n > 0).map(([r, n]) => `${r} ≤${n}`).join(', ');
  const cost = m.engine === 'prueba' ? 'gratis (prueba: una tarjeta, no una imagen de verdad)' : m.perChar ? `${usd(m.cost)} por 1.000 caracteres` : m.per === 's' ? `${usd(m.cost)} por segundo` : `${usd(m.cost)} por ${UNIT_ES[m.kind] || 'imagen'}`;
  return `- ${m.id} · ${m.name} · ${KIND_UP[m.kind] || 'IMAGEN'} · ${m.maker || m.engineName || m.engine} · calidad ${TIER[m.tier] || 'buena'} · ${m.speed || 'normal'}${m.uses?.length ? ' · para: ' + m.uses.join(', ') : ''} · ${cost}` +
    `${roles ? ' · toma: ' + roles : ''}${m.needs?.length ? ' · NECESITA: ' + m.needs.join(', ') : ''}${m.edit ? ' · edita una imagen' : ''}` +
    `${Object.keys(m.settings || {}).length ? ' · ajustes: ' + Object.entries(m.settings).map(([k, f]) => settingText(k, f)).join('; ') : ''}${m.note ? ' · ' + str(m.note, 160) : ''}`;
}
/** The Estudio as Dimitri reads it: ONLY the models that are on, what is left of the caps, the folders, the attached images and what the owner is looking at. */
export function studioPromptBlock({ models = [], budget = null, folders = [], attach = [], context = null, approved = [] } = {}) {
  const on = models.filter(m => m.on && !m.legacy);
  const out = ['MODELOS DEL ESTUDIO ENCENDIDOS (usa SOLO estos ids; los demás no tienen key):', on.length ? on.map(modelLine).join('\n') : '- ninguno: el Estudio no tiene motores encendidos (dilo; no propongas creativos)'];
  // V4.10: what a sound creative carries in its prompt
  if (on.some(m => m.kind === 'audio')) out.push('UNA VOZ (kind "audio"): prompt = el texto EXACTO que se dirá, en el idioma en que se dirá; settings.voiceId = la voz (una del sistema como Spanish_Narrator o una voz del dueño).');
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
  if (attach.length) out.push('\nIMÁGENES ADJUNTAS POR EL DUEÑO (las ves arriba; úsalas por su id en media.reference, media.start o media.end):\n' + attach.map((a, k) => `- ${k + 1}. id: ${a.id}${a.prompt ? ' · su prompt: ' + str(a.prompt, 200) : ''}${a.folder ? ' · carpeta: ' + a.folder : ''}`).join('\n'));
  if (context && context.view) out.push(`\nLO QUE EL DUEÑO ESTÁ VIENDO AHORA: ${context.view}${context.label ? ' — ' + str(context.label, 160) : ''}${context.kind ? ` (${context.kind}${context.id ? ': ' + str(context.id, 200) : ''})` : ''}`);
  if (approved.length) out.push('\nCREATIVOS APROBADOS PARECIDOS (los que al dueño le gustaron: parte de ahí, no los copies):\n' + approved.slice(0, 4).map(a => `- «${str(a.title, 90)}» · ${a.model || '?'}${a.file ? ' · ' + a.file : ''} · prompt: ${str(a.prompt, 400)}`).join('\n'));
  return out.join('\n');
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
export function parseCreatives(json, { models = [], folders = [], galleryHas = () => false, maxPerRequest = 8, defaultModel = () => null, estimate = null } = {}) {
  const raw = Array.isArray(json) ? json : Array.isArray(json?.creatives) ? json.creatives : [];
  const byId = new Map(models.map(m => [m.id, m]));
  return raw.filter(c => c && typeof c === 'object').slice(0, MAX_CREATIVES).map((c, i) => {
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
  const perItem = live.map(c => ({ i: c.i, cost: free(c.model) ? 0 : +(+estimate({ model: c.model, n: c.n, settings: c.settings, prompt: c.prompt }) || 0).toFixed(3) }));
  const total = +perItem.reduce((s, x) => s + x.cost, 0).toFixed(3);
  const weight = live.filter(c => !free(c.model)).reduce((s, c) => s + (WEIGHT[c.kind] || 1) * c.n, 0);
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
    else if (a.type === 'enviar_contenido') { if (typeof a.file === 'string' && galleryHas(a.file)) out.push({ type: a.type, file: a.file, ...(str(a.texto, 2200) ? { texto: str(a.texto, 2200) } : {}) }); }
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

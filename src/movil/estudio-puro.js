// Versión móvil (25 oct 2026) — lo PURO del Estudio móvil (sin DOM, con test): agrupar la galería por día, los ajustes de un modelo, el costo y el
// pedido que se envía a /api/media/jobs, y lo que falta para poder generar. Reutiliza los números de escritorio (studio-voz.js: unitCost, maxQty).
import { unitCost, maxQty } from '../studio-voz.js';
import { UMBRAL } from '../studio-confirmar.js';
import { diaTexto } from './b-comun.js';

export const KINDS = [['image', 'Imagen'], ['video', 'Video'], ['audio', 'Voz'], ['music', 'Música']];
export const FILTROS = [['all', 'Todo'], ['fav', 'Favoritas'], ['you', 'Mías'], ['agent', 'De agentes'], ['video', 'Videos'], ['voice', 'Voz'], ['music', 'Música'], ['up', 'Subidas']];
export const ROLES = { start: 'Imagen inicial', end: 'Imagen final', reference: 'Referencias', video: 'Video de origen' };
export const RATIO = { '1:1': 'Cuadrado', '4:5': 'Feed', '9:16': 'Vertical', '16:9': 'Horizontal', '3:4': 'Retrato', '4:3': 'Clásico', '2:3': 'Póster', '3:2': 'Foto', '21:9': 'Cine', auto: 'Auto' };
export const ETIQ = { aspectRatio: 'Formato', resolution: 'Resolución', duration: 'Duración (s)', batchSize: 'Imágenes por pedido', seed: 'Semilla', imageSize: 'Tamaño', quality: 'Calidad', voiceId: 'Voz', emotion: 'Emoción', speed: 'Velocidad', vol: 'Volumen', pitch: 'Tono', format: 'Archivo', instrumental: 'Instrumental (sin voz)', enhancePrompt: 'Que el motor mejore el prompt', renderingSpeed: 'Velocidad', mode: 'Modo' };
export const CALIDAD = ['imageSize', 'resolution', 'quality', 'renderingSpeed'];
export { UMBRAL };

/** Las fichas de la galería en grupos por día (Hoy · Ayer · lunes 12 oct), en el orden en que vienen. → [{ dia, items }] */
export function agruparPorDia(items, ahora = Date.now()) {
  const out = []; let ult = null;
  for (const it of items) { const d = diaTexto(it.at || 0, ahora); if (!ult || ult.dia !== d) { ult = { dia: d, items: [] }; out.push(ult); } ult.items.push(it); }
  return out;
}
/** Los modelos que se pueden usar para un tipo (con su key puesta o gratis): el predeterminado primero, luego por calidad y precio. */
export function modelosDe(models, kind, defecto) {
  return (models || []).filter(m => m.kind === kind && m.on).slice().sort((a, b) => (b.id === defecto) - (a.id === defecto) || (b.tier || 0) - (a.tier || 0) || (a.cost || 0) - (b.cost || 0));
}
/** Los ajustes de un modelo: lo que eligió el dueño encima de los valores por defecto del modelo; sin los vacíos. */
export function ajustesDe(m, elegidos = {}) {
  const out = {}; if (!m) return out;
  for (const [k, spec] of Object.entries(m.settings || {})) { const v = elegidos[k] !== undefined ? elegidos[k] : spec.default; if (v !== undefined && v !== '' && v !== null) out[k] = v; }
  return out;
}
/** El costo de un pedido (US$): el precio de una unidad × cuántas × las de cada tanda (batchSize). */
export function costoDe(m, ajustes, texto, cantidad) {
  if (!m) return 0; const por = Number(ajustes.batchSize) || 1;
  return +(unitCost(m, ajustes, String(texto || '').length) * cantidad * por).toFixed(4);
}
export const unidadesDe = (ajustes, cantidad) => cantidad * (Number(ajustes.batchSize) || 1);
/** Qué impide generar (en palabras) o ''. `material` = { start:[], end:[], reference:[], video:[] }. */
export function queFalta(m, texto, material = {}) {
  if (!m) return 'No hay un modelo encendido para esto.';
  if (!String(texto || '').trim()) return m.kind === 'audio' ? 'Escribe el texto que se dirá.' : m.kind === 'music' ? 'Describe la pieza.' : 'Escribe la idea.';
  for (const r of m.needs || []) if (!(material[r] || []).length) return `Falta: ${(ROLES[r] || r).toLowerCase()}.`;
  return '';
}
/** Lo que se manda a POST /api/media/jobs. Solo el clic de GENERAR del dueño llega aquí; los topes los vigila el servidor. */
export function pedido({ m, texto, cantidad, ajustes, material, carpeta }) {
  const media = {}; for (const r of Object.keys(m.roles || {})) if ((material[r] || []).length) media[r] = material[r].slice(0, Math.max(1, m.roles[r] || 1));
  return { prompt: String(texto).trim(), n: cantidad, kind: m.kind, model: m.id, settings: ajustes, media, by: 'you', ...(carpeta ? { folder: carpeta } : {}) };
}
/** Lo que queda del tope del día/mes en US$ (el menor), o null si no hay tope. */
export function dineroQueda(b) { if (!b) return null; const l = [b.costLeftDay, b.costLeftMonth].filter(x => x != null); return l.length ? Math.min(...l) : null; }
export const maxCantidad = (kind, b) => maxQty(kind, b && b.maxPerRequest);
/** El tiempo que suele tardar un modelo (mediana de sus últimos trabajos) o una estimación por tipo. */
export function tipico(j, jobs) {
  const mismos = jobs.filter(x => x.model === j.model && x.state === 'done' && x.startedAt && x.doneAt).slice(0, 10).map(x => x.doneAt - x.startedAt).sort((a, b) => a - b);
  return mismos.length >= 2 ? mismos[Math.floor(mismos.length / 2)] : j.engine === 'prueba' ? 5000 : j.kind === 'video' ? 180000 : j.kind === 'music' ? 120000 : j.kind === 'audio' ? 15000 : 25000;
}
/** 0..1 de lo que lleva un trabajo en marcha (nunca 1 hasta que acaba). */
export function avance(j, jobs, ahora = Date.now()) { if (j.state === 'queued') return 0; const t = tipico(j, jobs), e = ahora - (j.startedAt || j.at || ahora); return Math.max(0.04, Math.min(0.95, e / t)); }
/** Variar / Animar / Usar de referencia: cómo queda el compositor al venir de una ficha. → { kind, modelo, texto, ajustes, material } o { error }. */
export function desdeFicha(modo, it, models, defaults = {}) {
  const activos = k => modelosDe(models, k, defaults[k]);
  if (modo === 'animar') { const m = activos('video').find(x => x.roles && x.roles.start); return m ? { kind: 'video', modelo: m.id, texto: it.prompt || '', ajustes: {}, material: { start: [it.file] } } : { error: 'No hay un motor de video encendido que anime una imagen.' }; }
  const mismo = (models || []).find(x => x.id === it.model && x.on), conRef = activos('image').find(x => x.roles && x.roles.reference);
  if (modo === 'ref') { const m = mismo && mismo.roles && mismo.roles.reference ? mismo : conRef; return m ? { kind: 'image', modelo: m.id, texto: '', ajustes: {}, material: { reference: [it.file] } } : { error: 'Ningún motor de imagen encendido admite referencias.' }; }
  const m = mismo || activos('image')[0]; if (!m) return { error: 'No hay un motor de imagen encendido.' }; // variar: el mismo pedido; la imagen como referencia si el modelo la admite
  const ajustes = {}; for (const [k, v] of Object.entries(it.settings || {})) if (m.settings && m.settings[k]) ajustes[k] = v;
  return { kind: it.kind === 'video' ? 'video' : 'image', modelo: m.id, texto: it.prompt || '', ajustes, material: m.roles && m.roles.reference ? { reference: [it.file] } : {}, sinRef: !(m.roles && m.roles.reference) };
}

/* ---------- carpetas de la galería (26 oct 2026): crear, renombrar, eliminar y mover desde el teléfono ----------
   Una carpeta es una etiqueta de la ficha, no un directorio (media/galeria.mjs): moverla no toca el archivo. El servidor repite estas reglas. */
export const MAX_CARPETAS = 200;
/** Igual que media/galeria-core.mjs → cleanName (un test lo compara): sin controles ni <>, espacios colapsados, 60 letras. */
export const limpiarNombreCarpeta = n => String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
/** Por qué ese nombre no vale (en palabras), o '' si vale. `exceptoId`: la carpeta que se está renombrando (puede quedar con el mismo nombre). */
export function errorNombreCarpeta(nombre, carpetas = [], exceptoId = null) {
  const n = limpiarNombreCarpeta(nombre); if (!n) return 'Ponle un nombre a la carpeta.';
  if (carpetas.some(f => f.id !== exceptoId && String(f.name).toLowerCase() === n.toLowerCase())) return `Ya hay una carpeta «${n}».`;
  if (!exceptoId && carpetas.length >= MAX_CARPETAS) return `Como mucho ${MAX_CARPETAS} carpetas.`;
  return '';
}
/** La carpeta de verdad de una ficha (una carpeta borrada en otro sitio ya no cuenta), o null. */
export const carpetaDeFicha = (it, carpetas = []) => (it && it.folder && carpetas.some(f => f.id === it.folder) ? it.folder : null);
/** De dónde viene cada archivo que se va a mover: Map carpeta-de-antes (o null) → archivos. Sirve para DESHACER mover. */
export function origenes(items, files, carpetas = []) {
  const m = new Map(), por = new Map(items.map(i => [i.file, i]));
  for (const f of files) { const k = carpetaDeFicha(por.get(f), carpetas); (m.get(k) || m.set(k, []).get(k)).push(f); }
  return m;
}
/** «3 archivos movidos a «Navidad».» · «1 imagen sacada de su carpeta.» */
export function textoMovida(n, carpeta) {
  const q = n === 1 ? 'Un archivo' : `${n} archivos`;
  return carpeta ? `${q} ${n === 1 ? 'movido' : 'movidos'} a «${carpeta.name}».` : `${q} ${n === 1 ? 'sacado' : 'sacados'} de su carpeta.`;
}
/** Elegir/quitar una ficha de la selección múltiple (un Set de archivos). → el mismo Set */
export function alternarSeleccion(sel, file) { if (sel.has(file)) sel.delete(file); else sel.add(file); return sel; }
/** La selección que sigue valiendo: solo los archivos que aún están en la vista. */
export const seleccionVigente = (sel, items) => new Set([...sel].filter(f => items.some(i => i.file === f)));

// ============================================================
// Compilador del banco de presets del Estudio (PURO: sin red ni archivos)
//
// docs/propuesta-banco-presets.md §5.1–5.4, §5.6, §5.8, y §15–16 (decisiones del dueño, que mandan):
//   · las tres puertas son ATAJOS: aquí se combina todo a la vez (tu foto, varias referencias por ejes, el escenario 3D
//     y una pila de presets); el modo se DEDUCE de las entradas (`modoDe`), nunca se declara;
//   · lo local (luz, color, LUT, copiar color, encuadre, exportar) nunca va a un modelo; sin sharp, «no disponible en
//     esta máquina», y nada cae a la IA sin avisar;
//   · el margen es un ESCENARIO 3D (cámara a cierta distancia, en cm): lo traduce `describirEscena` de
//     src/escena3d-core.js (equipo «escena3d»), que se le PASA al compilador (`escena3d`), y su imagen guía de
//     composición va como referencia rotulada «LAYOUT GUIDE ONLY». La ocupación pasa a ser un RESULTADO que la QA mide.
//   · VIDEO (F5): cámara, plano, look, formato y sonido son ejes exclusivos (un movimiento por clip); las recetas de producto
//     hablan de la acción y traen su cámara como ajuste aparte; el bucle pone la foto final = la inicial; dos fotos van de
//     start a end; la referencia por ejes dice qué es cada imagen (tu producto, la persona, el empaque, el look) y el color
//     va a la IA (sin ffmpeg); el sonido y el movimiento usan el ajuste de CADA modelo (generateAudio, sound, cameraMovement);
//     el escenario 3D dice dónde empieza la cámara y el preset, hacia dónde va. Cubierto por tests/presets-video.test.mjs.
//
// Lo importan la página (vista previa «Qué hará», también en la demo file://), el servidor (presets.mjs, el lote) y el
// bloque de Dimitri. Un solo compilador para todos. Cubierto por tests/presets-core.test.mjs y tests/presets-modelo.test.mjs.
// ============================================================
import { buscar, normalizar } from './presets-buscar.js';
export { buscar, normalizar };

/* ---------- ejes ---------- */
/** En estos ejes el último preset elegido sustituye al anterior (y se avisa con DESHACER). */
export const EJES_EXCLUSIVOS = ['fondo', 'sombra', 'escena', 'encuadre', 'angulo', 'camara', 'plano', 'look', 'formato', 'audio', 'salida'];
/** El nombre de un eje en un aviso («Cámara: … sustituyó a …»). */
const EJE_ES = { angulo: 'Ángulo', camara: 'Cámara', audio: 'Sonido' };
/** En estos se suman. */
export const EJES_SUMABLES = ['limpieza', 'calidad', 'luz', 'color', 'estilo'];
/** El orden canónico en que se aplican los ajustes (después de la receta). */
export const ORDEN_EJES = ['limpieza', 'calidad', 'luz', 'color', 'fondo', 'sombra', 'escena', 'producto', 'encuadre', 'angulo', 'estilo', 'look', 'camara', 'plano', 'formato', 'audio', 'salida'];
/** Los ejes en que se separa una referencia (§5.4), con su nombre para el dueño. */
export const EJES_REF = ['estilo', 'color', 'composicion', 'luz', 'fondo', 'pose', 'producto'];
export const EJES_REF_ES = { estilo: 'Estilo', color: 'Color / LUT', composicion: 'Composición', luz: 'Luz', fondo: 'Fondo', pose: 'Pose', producto: 'Producto' };
/** Al abrir una referencia: Estilo y Color encendidos (normal). Producto NUNCA viene encendido. */
export const EJES_REF_DEF = Object.freeze({ estilo: 2, color: 2, composicion: 0, luz: 0, fondo: 0, pose: 0, producto: 0 });
/** «Hazlo como este anuncio»: estilo, color, luz y composición. */
export const EJES_REF_ANUNCIO = Object.freeze({ estilo: 2, color: 2, composicion: 2, luz: 2, fondo: 0, pose: 0, producto: 0 });
/** El eje de referencia que pide cada `entradas[].eje` del catálogo (los combinados se abren en varios). */
const EJE_DE_ENTRADA = { estilo: ['estilo'], look: ['estilo', 'color'], tipografia: ['composicion'], anuncio: ['estilo', 'color', 'luz', 'composicion'], color: ['color'], 'color-real': ['color'], composicion: ['composicion'], luz: ['luz'], fondo: ['fondo'], escena: ['producto'] /* «Mi producto en esa foto»: tu producto en la escena de la referencia */, pose: ['pose'], persona: ['pose'], producto: ['producto'] };

/** Fuerza de 0 a 3 (apagado, suave, normal, fuerte) → la frase del motor y el factor local de «copiar color». */
export const FUERZA_EN = ['', 'loosely inspired by', 'following', 'closely matching'];
export const FUERZA_ES = ['apagado', 'suave', 'normal', 'fuerte'];
export const FUERZA_COLOR = [0, 0.4, 0.7, 1];
const FUERZA_DE_VALOR = { baja: 1, media: 2, alta: 3, suave: 1, normal: 2, fuerte: 3 };
/** El negativo obligatorio de toda referencia (§5.4). */
export const NEGATIVO_REF = 'do not copy its objects, people, products, text, logos or brand names';
/** La cláusula de conservación por defecto (§5.7, capa 1). Un preset no puede quitarla. */
export const CONSERVAR = 'Preserve the product exactly: same shape, proportions, materials, colors, label, logos and text. Do not add, invent or remove logos, text, parts or accessories. Do not reinterpret the design. Keep everything not mentioned exactly the same.';
/** El rótulo de la imagen guía del escenario 3D (§16.3). */
export const ROTULO_GUIA = n => `Image ${n} is a LAYOUT GUIDE ONLY: match the camera angle, the horizon height, and the size and position of the box, which stands for the product. Do not draw the box.`;
/** El marcador de la imagen guía mientras la página la renderiza y la sube (ver `ponerGuia`). */
export const GUIA = 'escena:guia';

/* ---------- familias de prompt (§5.8) ----------
   La MISMA tabla que FAMILIAS de media/catalogo.mjs y `familias` de docs/presets-catalogo.json (un test lo comprueba):
   aquí también, porque la página no importa el catálogo del servidor. */
export const FAMILIAS = {
  conversacional: ['nano-banana*', 'muse-image', 'mmx-image-01'],
  instrucciones: ['gpt-image-1'],
  'edicion-corta': ['flux-kontext', 'qwen-image-3', 'seedream-4', 'grok-imagine-2', 'nano-banana-fal'],
  descriptiva: ['soul*', 'flux-2*', 'flux-schnell', 'z-image-turbo', 'recraft*', 'ideogram*', 'marketing-studio*', 'grok-image', 'qwen-image-3', 'prueba'],
  veo: ['veo-*'],
  kling: ['kling-*'],
  seedance: ['seedance-*'],
  'minimax-video': ['mmx-h3*', 'minimax-*', 'hailuo-*'],
  'video-generico': ['wan-*', 'ltx-*', 'pixverse-*', 'happy-horse-*', 'grok-imagine-video', 'cinema-studio-4', 'genjutsu-*', 'prueba-video'],
  'musica-minimax': ['mmx-musica-*'],
  'voz-minimax': ['mmx-voz-*'],
};
// {refs}: qué es cada imagen de referencia (el producto, la persona, el look); {sonido}: los efectos y el ambiente en las
// familias que no tienen las líneas «SFX:» de Veo. Una plantilla vieja sin ellos los recibe igual (ver renderPrompt).
const PLANTILLAS_VIDEO = {
  veo: '{camara}, {plano}, {lente}. {sujeto} {accion}. {refs} {escena}. {look}, {luz}.\nSFX: {sfx}\nAmbient noise: {ambiente}',
  kling: '{sujeto} {accion}. {refs} {escena}. Camera: {camara}. {plano}. {look}. {sonido}.',
  seedance: '{plano}, {lente}. {sujeto} {accion}. {refs} {escena}. {camara}. {look}. {sonido}.',
  'minimax-video': '{sujeto} {accion}. {refs} {escena}. {camara}. {look}. {sonido}.',
  'video-generico': '{camara}. {plano}. {sujeto} {accion}. {refs} {escena}. {look}. {sonido}.',
};
/** En video estos ejes son exclusivos (§3.3): una cámara, un plano, un look, un formato y un sonido por clip. */
export const EJES_VIDEO = ['camara', 'plano', 'look', 'formato', 'audio'];
/** Cómo hace sonido un modelo de video: con el ajuste `generateAudio`, con `sound` (Kling), siempre (Veo 3.1 por la API de
 *  Gemini, que no deja apagarlo) o nunca. Sale de los ajustes de su fila del catálogo, nunca escrito a mano. */
export function audioDe(row, familia) {
  const st = row?.settings || {};
  if (st.generateAudio) return 'generateAudio';
  if (st.sound) return 'sound';
  if ((familia ?? familiaDe(row?.id || '')) === 'veo' && row?.kind === 'video') return 'siempre';
  return 'no';
}
/** Lo que se deforma al girar: un preset `soloRigidos` (el giro 360) avisa si el producto o la idea lo nombran. */
export const BLANDO_RE = /\b(sabanas?|tela|telas|ropa|camisas?|vestidos?|cortinas?|almohadas?|cojin|cojines|colchon|colchones|peluches?|toallas?|edredon|cobijas?|vidrio|cristal|copas?|liquidos?|agua|perfumes?|collar|collares|cadenas?|cables?|plantas?|flores?)\b/;
const FAMILIAS_VIDEO = Object.keys(PLANTILLAS_VIDEO);
/** El orden de preferencia de media/catalogo.mjs (PREFER), por si el llamador no lo pasa. */
export const PREFER_DEF = {
  edit: ['nano-banana-2', 'nano-banana-pro', 'nano-banana', 'muse-image', 'gpt-image-1', 'qwen-image-3', 'grok-imagine-2', 'flux-kontext', 'seedream-4', 'nano-banana-fal'],
  image: ['nano-banana-2', 'nano-banana', 'muse-image', 'soul-2', 'nano-banana-fal', 'gpt-image-1', 'seedream-4', 'z-image-turbo', 'flux-schnell', 'grok-image', 'mmx-image-01'],
  video: ['kling-3-std', 'veo-3.1-fast', 'kling-3-turbo', 'seedance-2', 'kling-2.5-fal', 'seedance-1-fal', 'hailuo-02-fal', 'mmx-h3'],
  audio: ['mmx-voz-2.8-turbo', 'mmx-voz-2.8-hd', 'mmx-voz-2.6-turbo', 'mmx-voz-2.6-hd'],
  music: ['mmx-musica-3', 'mmx-musica-3-gratis'],
};

const globRe = p => new RegExp('^' + String(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
/** La familia de prompt de un modelo: un nombre exacto antes que un patrón con «*». `familias`: { nombre: [patrones] | { modelos } }. */
export function familiaDe(id, familias = FAMILIAS) {
  const list = Object.entries(familias || FAMILIAS).map(([k, v]) => [k, Array.isArray(v) ? v : Array.isArray(v?.modelos) ? v.modelos : []]);
  for (const [k, pats] of list) if (pats.includes(id)) return k;
  for (const [k, pats] of list) if (pats.some(p => String(p).includes('*') && globRe(p).test(id))) return k;
  return null;
}

/* ---------- utilidades ---------- */
const arr = x => (x == null ? [] : Array.isArray(x) ? x : [x]);
const uniq = a => [...new Set(a)];
const RATIO_RE = /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/;
const ratioNum = r => { if (!RATIO_RE.test(String(r))) return null; const [a, b] = String(r).split(':').map(Number); return b ? a / b : null; };
/** La proporción de la lista más cercana a la pedida (en escala logarítmica: 4:5 está tan lejos de 1:1 como 5:4). */
export function proporcionCercana(objetivo, lista) {
  const t = ratioNum(objetivo); if (!t || !lista?.length) return null;
  let best = null, d = Infinity;
  for (const r of lista) { const v = ratioNum(r); if (!v) continue; const x = Math.abs(Math.log(v / t)); if (x < d - 1e-9) { d = x; best = r; } }
  return best;
}
const y = l => (l.length > 1 ? `${l.slice(0, -1).join(', ')} and ${l.at(-1)}` : l[0] || '');
const usd = x => `US$${(Math.round(x * 1000) / 1000).toFixed(x < 0.1 && x > 0 ? 3 : 2).replace('.', ',')}`;

/** `byId` puede ser un Map, un objeto o una lista de presets. */
export function indexar(presets) {
  if (presets instanceof Map) return presets;
  if (Array.isArray(presets)) return new Map(presets.filter(p => p && p.id).map(p => [p.id, p]));
  return new Map(Object.entries(presets || {}));
}
/** Un preset es «exclusivo» si es un ajuste que toca algún eje exclusivo (§4.2: se calcula). */
export const esExclusivo = p => !!p && p.capa !== 'receta' && (p.ejes || []).some(e => EJES_EXCLUSIVOS.includes(e));
const ejesExclusivosDe = p => (esExclusivo(p) ? (p.ejes || []).filter(e => EJES_EXCLUSIVOS.includes(e)) : []);
const nombreDe = p => p?.nombre || p?.id || '?';
/** El preset sintético «libre»: una instrucción del dueño sin preset (el editRequest de siempre, §5.9.5). */
const libre = (texto, kind) => ({ id: 'libre', v: 1, nombre: 'Tu instrucción', capa: 'ajuste', ejecutor: 'ia', ia: String(texto || '').trim(), medios: [kind || 'image'], modos: ['cero', 'foto', 'ref', 'foto+ref', 'texto', 'anima', 'ab', 'refs', 'video'], ejes: [], entradas: [], parametros: [], qa: ['identidad'] });

/** ¿Es v un valor permitido? En un «multi», cada uno de la lista (o «a,b,c»). */
const partes = v => (Array.isArray(v) ? v : String(v).split(',')).map(x => String(x).trim()).filter(Boolean);
function valorPermitido(q, valores, v) {
  const ok = x => valores.some(o => String(o.v) === String(x));
  return q.tipo === 'multi' ? partes(v).every(ok) : ok(v);
}
/* ---------- validar (§4.2) ---------- */
const MODOS_IMAGEN = ['cero', 'foto', 'ref', 'foto+ref'], MODOS_VIDEO = ['texto', 'anima', 'ab', 'refs', 'video'];
const EJECUTORES = ['local', 'ia', 'local+ia', 'ajustes'];
/** Los problemas de un preset, en frases. ctx: { byId, grupos: [ids], kinds } */
export function validar(p, ctx = {}) {
  const out = [], by = ctx.byId ? indexar(ctx.byId) : null, n = p?.id || '(sin id)';
  if (!p || typeof p !== 'object') return ['no es un preset'];
  if (!/^[a-z0-9-]{3,40}$/.test(String(p.id || ''))) out.push(`«${n}»: el id debe tener de 3 a 40 letras minúsculas, números o guiones`);
  if (!Number.isInteger(p.v) || p.v < 1) out.push(`«${n}»: falta la versión (v, un entero desde 1)`);
  if (!p.nombre || String(p.nombre).length > 48) out.push(`«${n}»: el nombre falta o pasa de 48 caracteres`);
  if (p.frase && String(p.frase).length > 140) out.push(`«${n}»: la frase pasa de 140 caracteres`);
  if (!['receta', 'ajuste'].includes(p.capa)) out.push(`«${n}»: la capa debe ser «receta» o «ajuste»`);
  if (!EJECUTORES.includes(p.ejecutor)) out.push(`«${n}»: el ejecutor debe ser uno de ${EJECUTORES.join(', ')}`);
  const kinds = ctx.kinds || ['image', 'video', 'music', 'audio'];
  if (!arr(p.medios).length || arr(p.medios).some(m => !kinds.includes(m))) out.push(`«${n}»: medios desconocidos (${arr(p.medios).join(', ') || 'ninguno'})`);
  if (ctx.grupos && !ctx.grupos.includes(p.categoria)) out.push(`«${n}»: el grupo «${p.categoria}» no existe`);
  const img = arr(p.medios).includes('image');
  for (const m of arr(p.modos)) if (![...MODOS_IMAGEN, ...MODOS_VIDEO].includes(m)) out.push(`«${n}»: el modo «${m}» no existe`);
  if (img && arr(p.entradas).some(e => e.rol === 'inicial' || e.rol === 'final')) out.push(`«${n}»: un preset de imagen nunca pide fotogramas (inicial/final)`);
  for (const q of arr(p.parametros)) {
    if (!q.id) { out.push(`«${n}»: un parámetro sin id`); continue; }
    if (Array.isArray(q.valores) && q.valores.length && q.def != null && !valorPermitido(q, q.valores, q.def)) out.push(`«${n}»: el valor por defecto de «${q.id}» (${q.def}) no está entre los permitidos`);
  }
  if ((p.ejecutor === 'ia' || p.ejecutor === 'local+ia') && !p.ia && !p.iaPorIntensidad && !p.prompt) out.push(`«${n}»: es de IA pero no trae el fragmento «ia»`);
  if (p.ejecutor === 'local' && !arr(p.local).length && !arr(p.post).length && !arr(p.incluye).length) out.push(`«${n}»: es local pero no dice qué operación hace`);
  if (by) {
    for (const id of [...arr(p.incluye), ...arr(p.excluye)]) if (!by.has(id)) out.push(`«${n}»: incluye o excluye «${id}», que no existe`);
    if (p.capa !== 'receta' && arr(p.incluye).length) out.push(`«${n}»: solo una receta puede incluir otros presets`);
    const ciclo = buscaCiclo(p.id, by); if (ciclo) out.push(`«${n}»: se incluye a sí mismo (${ciclo.join(' → ')})`);
  }
  return out;
}
function buscaCiclo(id, by, camino = []) {
  if (camino.includes(id)) return [...camino, id];
  for (const h of arr(by.get(id)?.incluye)) { const c = buscaCiclo(h, by, [...camino, id]); if (c) return c; }
  return null;
}

/* ---------- expandir (§3.3, §5.3 paso 1) ---------- */
/**
 * Expande la pila: la receta (como mucho una arriba; la última gana) con sus `incluye` recursivos, después los ajustes.
 * En un eje exclusivo gana el último elegido y se avisa; `excluye` da error con los dos nombres.
 * pila: [id | { id, params, texto? }]. → { lista: [{ id, v, preset, params, origen, explicito }], avisos, errores, sustituidos }
 *   · origen: 'pila' (lo eligió el dueño) o el id de la receta que lo trajo;
 *   · sustituidos: { idReceta: [ejes] } — los ejes de una receta que otro preset le quitó (su frase de IA ya no vale entera).
 */
export function expandir(pila, byId, { kind } = {}) {
  const by = indexar(byId), avisos = [], errores = [], sustituidos = {};
  const items = arr(pila).map(x => (typeof x === 'string' ? { id: x } : x || {})).filter(x => x.id);
  const resuelto = [];
  for (const x of items) {
    if (x.id === 'libre') { if (String(x.texto || '').trim()) resuelto.push({ ...x, preset: libre(x.texto, kind) }); continue; }
    const p = by.get(x.id);
    if (!p) { errores.push(`No conozco el preset «${x.id}»`); continue; }
    resuelto.push({ ...x, preset: p });
  }
  // como mucho una receta elegida por el dueño: la última gana
  const recetas = resuelto.filter(x => x.preset.capa === 'receta');
  for (const r of recetas.slice(0, -1)) avisos.push({ tipo: 'sustituye', eje: 'receta', gana: recetas.at(-1).id, pierde: r.id, texto: `Receta: «${nombreDe(recetas.at(-1).preset)}» sustituyó a «${nombreDe(r.preset)}»` });
  const receta = recetas.at(-1) || null;
  const lista = []; // en orden de «tiempo»: lo de la receta primero, después lo del dueño
  const ya = new Map();
  const mete = (p, origen, params, explicito, t) => { const it = { id: p.id, v: p.v || 1, preset: p, params: { ...(params || {}) }, origen, explicito, t }; lista.push(it); ya.set(p.id, it); return it; };
  let t = 0;
  if (receta) {
    mete(receta.preset, 'pila', receta.params, true, t++);
    const baja = (p, camino) => {
      for (const h of arr(p.incluye)) {
        if (camino.includes(h)) { errores.push(`«${nombreDe(p)}» se incluye a sí mismo (${[...camino, h].join(' → ')})`); continue; }
        const q = by.get(h); if (!q) { errores.push(`«${nombreDe(p)}» incluye «${h}», que no existe`); continue; }
        if (ya.has(h)) continue;
        mete(q, p.id, null, false, t++); baja(q, [...camino, h]);
      }
    };
    baja(receta.preset, [receta.id]);
  }
  for (const x of resuelto) {
    if (x.preset.capa === 'receta') continue;
    const antes = ya.get(x.id);
    if (antes) { // «ya incluido»: si lo elige con otro valor, ese valor manda
      if (!antes.explicito) avisos.push({ tipo: 'ya-incluido', id: x.id, texto: `«${nombreDe(x.preset)}» ya va dentro de la receta${x.params && Object.keys(x.params).length ? ': manda el valor que elegiste' : ''}` });
      Object.assign(antes.params, x.params || {}); antes.explicito = true; antes.t = t++;
      continue;
    }
    mete(x.preset, 'pila', x.params, true, t++);
  }
  // ejes exclusivos: gana el último en el tiempo
  const fuera = new Set(), dueno = {};
  for (const it of [...lista].sort((a, b) => a.t - b.t)) {
    for (const e of ejesExclusivosDe(it.preset)) {
      const prev = dueno[e];
      if (prev && prev !== it && !fuera.has(prev)) {
        fuera.add(prev);
        avisos.push({ tipo: 'sustituye', eje: e, gana: it.id, pierde: prev.id, texto: `${EJE_ES[e] || e[0].toUpperCase() + e.slice(1)}: «${nombreDe(it.preset)}» sustituyó a «${nombreDe(prev.preset)}»` });
        if (prev.origen !== 'pila') (sustituidos[prev.origen] ||= []).push(e);
      }
      dueno[e] = it;
    }
  }
  // lo que una receta trajo y otro preset le quitó se va con lo que colgaba de ello (los hijos de una receta quitada)
  const quedan = lista.filter(it => !fuera.has(it));
  const vivos = quedan.filter(it => it.origen === 'pila' || quedan.some(o => o.id === it.origen));
  // excluye
  for (let i = 0; i < vivos.length; i++) for (let j = i + 1; j < vivos.length; j++) {
    const a = vivos[i].preset, b = vivos[j].preset;
    if (arr(a.excluye).includes(b.id) || arr(b.excluye).includes(a.id)) errores.push(`«${nombreDe(a)}» y «${nombreDe(b)}» no van juntos: quita uno de los dos`);
  }
  // orden final: las recetas primero (la de arriba antes que las de dentro), después los ajustes por el orden de los ejes
  const rango = it => { const es = arr(it.preset.ejes).map(e => ORDEN_EJES.indexOf(e)).filter(i => i >= 0); return es.length ? Math.min(...es) : ORDEN_EJES.length; };
  vivos.sort((a, b) => (a.preset.capa === 'receta' ? 0 : 1) - (b.preset.capa === 'receta' ? 0 : 1) || (a.preset.capa === 'receta' ? a.t - b.t : rango(a) - rango(b) || a.t - b.t));
  for (const it of vivos) delete it.t;
  return { lista: vivos, avisos, errores, sustituidos };
}

/* ---------- modoDe (§3.1, §5.2) ---------- */
const cuenta = x => arr(x).filter(Boolean).length;
/**
 * El modo, deducido de las entradas (nunca declarado).
 * entradas: { foto (o sujeto): id|[ids], referencias: [id | { id, ejes }], inicial, final, origen (un video), ... }
 * Imagen: 'cero' · 'foto' · 'ref' · 'foto+ref'. Video: 'texto' · 'anima' · 'ab' · 'refs' · 'video'. Sonido: 'texto'.
 */
export function modoDe(entradas = {}, kind = 'image') {
  const e = entradas || {}, fotos = cuenta(e.foto ?? e.sujeto), refs = cuenta(e.referencias ?? e.referencia);
  if (kind === 'video') {
    if (cuenta(e.origen ?? e.video ?? e.guia)) return 'video'; // la guía de un «copiar movimiento» también es un video
    const ini = cuenta(e.inicial) || fotos;
    if (ini && cuenta(e.final)) return 'ab';
    if (ini) return 'anima';
    if (refs) return 'refs';
    return 'texto';
  }
  if (kind === 'audio' || kind === 'music') return 'texto';
  if (fotos && refs) return 'foto+ref';
  if (fotos) return 'foto';
  if (refs) return 'ref';
  return 'cero';
}
/** Qué modos de preset sirven en cada modo real (§15.1: combinar sin límites; un preset «sobre tu foto» sirve con una referencia más). */
export const MODOS_COMPATIBLES = { cero: ['cero'], foto: ['foto'], ref: ['ref', 'cero'], 'foto+ref': ['foto+ref', 'foto'], texto: ['texto'], anima: ['anima', 'texto'], ab: ['ab', 'anima', 'texto'], refs: ['refs', 'texto'], video: ['video'] };
export const modoAdmite = (p, modo) => arr(p?.modos).some(m => (MODOS_COMPATIBLES[modo] || [modo]).includes(m));
function porQueNoModo(p, modo, kind) {
  const ms = arr(p.modos);
  if (kind === 'image' && ms.every(m => m === 'foto' || m === 'foto+ref') && (modo === 'cero' || modo === 'ref')) return `«${nombreDe(p)}» trabaja sobre tu foto: súbela o elige uno de «Desde cero»`;
  if (ms.every(m => m === 'ref' || m === 'foto+ref' || m === 'refs')) return `«${nombreDe(p)}» necesita una referencia: añádela o quítalo`;
  if (ms.every(m => m === 'video')) return `«${nombreDe(p)}» trabaja sobre un video: súbelo`;
  if (ms.every(m => m === 'ab')) return `«${nombreDe(p)}» necesita la foto de partida y la de llegada`;
  if (ms.every(m => m === 'anima' || m === 'ab')) return `«${nombreDe(p)}» anima una foto: súbela`;
  if (kind === 'video' && ms.every(m => m === 'anima' || m === 'ab' || m === 'refs')) return `«${nombreDe(p)}» necesita tu foto del producto (para animarla) o como referencia`;
  if (kind === 'image' && ms.every(m => m === 'cero')) return `«${nombreDe(p)}» crea desde cero: no usa tu foto`;
  return `«${nombreDe(p)}» no sirve con estas entradas`;
}

/* ---------- capacidades de un modelo (§5.6) ---------- */
/** Las capacidades de una fila de models() cuando no llegan las de capsOf (la página): la misma forma, derivada igual. */
export function capsDeFila(row, familias = FAMILIAS) {
  if (!row) return null;
  const roles = row.roles || {}, st = row.settings || {};
  return {
    id: row.id, kind: row.kind, engine: row.engine, familia: familiaDe(row.id, familias),
    editar: !!row.edit, maxRefs: roles.reference || 0,
    proporciones: arr(st.aspectRatio?.values).filter(v => RATIO_RE.test(v)),
    tamanos: [...arr(st.imageSize?.values || st.resolution?.values)].filter(Boolean),
    start: (roles.start || 0) > 0, end: (roles.end || 0) > 0, video: (roles.video || 0) > 0, maxVideos: roles.video || 0,
    refYFotogramas: row.engine === 'prueba' && (roles.start || 0) > 0 && (roles.reference || 0) > 0,
    transparencia: !!arr(st.background?.values).includes('transparent'),
    calidad: row.tier || 2, velocidad: row.speed || '', costo: row.cost || 0, per: row.per || 'item',
    necesita: [...arr(row.needs)], maxPrompt: row.maxPrompt || 4000, ...(row.legacy ? { legacy: true } : {}),
  };
}
function capsDe(row, caps, familias) {
  let c = null;
  if (typeof caps === 'function') c = caps(row.id) || null;
  else if (caps instanceof Map) c = caps.get(row.id) || null;
  else if (caps && typeof caps === 'object') c = caps[row.id] || null;
  return c ? { ...capsDeFila(row, familias), ...c, familia: c.familia ?? familiaDe(row.id, familias) } : capsDeFila(row, familias);
}

/** Lo que pide la lista expandida a un modelo: roles, ajustes, mínimos de referencias. */
function requisitosDe(lista) {
  const r = { edit: false, refsMin: 0, roles: {}, settings: [] };
  for (const it of lista) {
    const q = it.preset.requiere || {};
    if (q.edit) r.edit = true;
    if (q.refsMin) r.refsMin = Math.max(r.refsMin, q.refsMin);
    for (const [k, v] of Object.entries(q.roles || {})) r.roles[k] = Math.max(r.roles[k] || 0, +v || 0);
    r.settings.push(...arr(q.settings));
  }
  r.settings = uniq(r.settings);
  return r;
}

/**
 * Los modelos que pueden con la lista, mejor primero (§5.6: filtra, puntúa, explica).
 * lista: la de expandir() (o presets sueltos). models: filas de models(). caps: capsOf (función), un Map o un objeto { id: caps }.
 * req: { kind, modo, nImagenes, proporcion, refs, orden: 'barato'|'calidad', grande: bool, preferencia: PREFER, familias }
 * → [{ id, nombre, on, motivo?, porque?, score, familia, caps }]: los que sirven ahora (on) primero; luego los demás con su motivo.
 */
export function modelosPara(lista, models, caps, req = {}) {
  const items = arr(lista).map(x => (x?.preset ? x : { preset: x })).filter(x => x.preset);
  const kind = req.kind || items[0]?.preset?.medios?.[0] || 'image';
  const modo = req.modo || (kind === 'image' ? 'cero' : 'texto');
  const fams = req.familias || FAMILIAS, pref = req.preferencia || PREFER_DEF;
  const rq = requisitosDe(items);
  const conFoto = modo === 'foto' || modo === 'foto+ref';
  const nImg = req.nImagenes ?? ((conFoto ? 1 : 0) + (req.refs || 0));
  const prefer = uniq(items.flatMap(x => arr(x.preset.prefer)));
  const fallback = arr(pref[kind === 'image' && conFoto ? 'edit' : kind]);
  const catalogo = items.some(x => x.preset.categoria === 'catalogo');
  const quiereAudio = kind === 'video' && items.some(x => x.preset.ajustesModelo?.generateAudio === true);
  const out = [];
  for (const row of arr(models)) {
    if (!row || row.kind !== kind || row.legacy) continue;
    const c = capsDe(row, caps, fams); if (!c || c.legacy) continue;
    const no = [];
    if (row.on === false) no.push(`${row.engineName || row.engine} no tiene key`);
    if (kind === 'image') {
      if (conFoto && !c.editar) no.push('no edita fotos');
      if (nImg > c.maxRefs) no.push(c.maxRefs ? `toma ${c.maxRefs} imagen${c.maxRefs === 1 ? '' : 'es'} y hacen falta ${nImg}` : 'no toma imágenes');
      if (/flux-kontext/.test(row.id) && nImg > 1) no.push('Flux Kontext solo toma una imagen');
      if (rq.settings.includes('background') && !c.transparencia) no.push('no hace fondo transparente');
      if (rq.settings.includes('imageSize') && !c.tamanos.some(t => /^[24]k$/i.test(t))) no.push('no saca 2K ni 4K');
    } else if (kind === 'video') {
      const necStart = modo === 'anima' || modo === 'ab' || rq.roles.start;
      if (necStart && !c.start) no.push('no anima una foto');
      if ((modo === 'ab' || rq.roles.end) && !c.end) no.push('no toma foto de llegada');
      if ((modo === 'video' || rq.roles.video) && !c.video) no.push('no edita un video');
      const refs = req.refs || 0, needRefs = Math.max(refs, rq.roles.reference || 0, modo === 'refs' ? 1 : 0);
      if (needRefs > c.maxRefs) no.push(c.maxRefs ? `toma ${c.maxRefs} referencias y hacen falta ${needRefs}` : 'no toma referencias');
      if (necStart && needRefs && !c.refYFotogramas) no.push('no junta foto de partida y referencias en un pedido');
      if (req.proporcion && c.proporciones.length && !c.proporciones.includes(req.proporcion)) {
        // sin ffmpeg no se recorta un video (§5.5): vale la proporción más cercana si casi no se nota (4:5 → 3:4); 1:1 en Veo, no
        const cerca = proporcionCercana(req.proporcion, c.proporciones);
        if (!cerca || Math.abs(Math.log(ratioNum(cerca) / ratioNum(req.proporcion))) > 0.12) no.push(`no hace ${req.proporcion}`);
      }
      for (const nd of arr(c.necesita)) if (nd === 'video' && modo !== 'video') no.push('necesita un video de origen');
      else if (nd === 'start' && !necStart) no.push('necesita una foto de partida');
      else if (nd === 'reference' && !needRefs) no.push('necesita una imagen de referencia');
    }
    for (const nd of kind === 'image' ? arr(c.necesita) : []) if (nd === 'reference' && nImg < 1) no.push('necesita una imagen');
    // puntos
    const ip = prefer.indexOf(row.id), ifb = fallback.indexOf(row.id);
    let score = (ip >= 0 ? 100 - ip * 6 : 0) + (ifb >= 0 ? 20 - ifb : 0) + (c.calidad || 2) * 8;
    if (catalogo && conFoto && /^(nano-banana-pro|gpt-image-1)$/.test(row.id)) score += 12; // fidelidad en catálogo
    if (catalogo && /muse-image/.test(row.id)) score -= 60; // busca referencias en la web: abajo en catálogo
    if (kind === 'image' && req.proporcion && c.proporciones.includes(req.proporcion)) score += 3;
    if (kind === 'video' && req.proporcion && c.proporciones.length) score += c.proporciones.includes(req.proporcion) ? 3 : -4; // exacta antes que la cercana
    const au = kind === 'video' ? audioDe(row, c.familia) : 'no';
    if (quiereAudio && au === 'no') score -= 40; // pidió sonido: primero los que lo hacen
    if (req.orden === 'barato' || req.grande) score -= (c.costo || 0) * (req.orden === 'barato' ? 300 : 100);
    if (row.engine === 'prueba') score -= 200; // la prueba gratis, siempre al final
    const porque = no.length ? undefined : [
      ip >= 0 ? `de los preferidos para «${nombreDe(items.find(x => arr(x.preset.prefer).includes(row.id))?.preset)}»` : '',
      c.calidad ? `calidad ${'●'.repeat(c.calidad)}${'○'.repeat(Math.max(0, 4 - c.calidad))}` : '',
      kind === 'image' && conFoto ? 'edita tu foto' : '',
      kind === 'image' && nImg > 1 ? `toma las ${nImg} imágenes` : '',
      kind === 'video' ? { anima: 'anima tu foto', ab: 'va de una foto a otra', video: 'trabaja sobre tu video', refs: 'toma tus referencias' }[modo] || '' : '',
      kind === 'video' && quiereAudio && au !== 'no' ? 'hace sonido' : '',
      catalogo && /muse-image/.test(row.id) ? 'en catálogo va al final (busca referencias en la web)' : '',
    ].filter(Boolean).join(' · ');
    out.push({ id: row.id, nombre: row.name || row.id, on: !no.length, ...(no.length ? { motivo: no.join('; ') } : { porque }), score, familia: c.familia, caps: c });
  }
  return out.sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0) || b.score - a.score || a.id.localeCompare(b.id));
}

/* ---------- parámetros (§5.3 paso 2) ---------- */
function valorTipo(tipos, q) {
  const base = tipos?.[q.tipo] || {};
  return { valores: q.valores || base.valores || null, def: q.def ?? base.def };
}
/** Los valores de los parámetros de un preset: su def → el canal → lo global del pedido → lo de su chip. */
function resolverParams(p, it, global, canal, avisos, tipos) {
  const out = {};
  for (const q of arr(p.parametros)) {
    const { valores, def } = valorTipo(tipos, q);
    let v = def;
    if (canal && q.tipo === 'encuadre' && canal.ocupacion != null) v = '@canal';
    if (global[q.id] != null) v = global[q.id];
    if (it.params?.[q.id] != null) v = it.params[q.id];
    if (v !== '@canal' && Array.isArray(valores) && valores.length && v != null && !valorPermitido(q, valores, v)) {
      avisos.push({ tipo: 'valor', id: p.id, texto: `«${nombreDe(p)}»: «${v}» no es un valor de «${q.es || q.id}»; uso «${def}»` });
      v = def;
    }
    if (q.tipo === 'multi' && v != null) v = partes(v);
    if (q.tipo === 'texto' && typeof v === 'string') v = v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, q.max || tipos?.texto?.max || 140);
    out[q.id] = v;
  }
  return out;
}
/** El fragmento «en» de un parámetro (o su valor tal cual). */
function enDe(p, id, v, tipos) {
  const q = arr(p.parametros).find(x => x.id === id); if (!q) return v == null ? '' : String(v);
  const { valores } = valorTipo(tipos, q);
  const x = arr(valores).find(o => String(o.v) === String(v));
  return x ? (x.en ?? String(x.v)) : v == null ? '' : String(v);
}
/** Rellena los marcadores de un fragmento. Lo que no se sabe rellenar se quita y se avisa. */
function rellenar(txt, ctx, avisos, de) {
  return String(txt || '').replace(/\{([a-zA-Z0-9_.-]+)\}/g, (m, k) => {
    if (k === 'idea') return ctx.idea || '';
    if (k === 'producto') return ctx.producto || 'the product';
    if (k === 'conservar') return ''; // la cláusula la pone el compilador una vez, al final
    if (k === 'encuadre') return ctx.encuadreEn || '';
    if (k === 'n1') return String(ctx.n1 || 1);
    if (k.startsWith('p.')) return enDe(de, k.slice(2), ctx.params?.[k.slice(2)], ctx.tipos);
    if (k.startsWith('cifras.')) {
      const v = k.slice(7).split('.').reduce((o, s) => (o == null ? o : o[s]), ctx.cifras);
      if (v == null || typeof v === 'object') { ctx.errores.push(`Falta la cifra «${k.slice(7)}» en cifras.json (Ajustes → Cifras de la empresa): un precio nunca sale del preset`); return ''; }
      return String(v);
    }
    avisos.push({ tipo: 'marcador', id: de?.id, texto: `«${nombreDe(de)}»: no sé rellenar ${m}` });
    return '';
  });
}
const limpiaFrase = s => String(s || '').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/([,;:])\1+/g, '$1').replace(/^[\s,.;:]+|[\s,;:]+$/g, '').trim();

/* ---------- el escenario 3D (§16) ---------- */
/** Lo que devuelve describirEscena (texto, lista de frases u objeto), en una forma: { en, es, ocupacion }. */
export function leerDescripcion(d, sep = '; ') {
  if (d == null) return null;
  if (typeof d === 'string') return { en: limpiaFrase(d), es: '' };
  const una = x => (typeof x === 'string' ? { en: x, es: '' } : { en: x?.en ?? x?.prompt ?? x?.texto ?? '', es: x?.es ?? '' });
  if (Array.isArray(d)) { const l = d.map(una); return { en: limpiaFrase(l.map(x => x.en).filter(Boolean).join(sep)), es: l.map(x => x.es).filter(Boolean).join(' · ') }; }
  if (typeof d === 'object') {
    const fr = Array.isArray(d.frases) ? leerDescripcion(d.frases, sep) : null;
    const en = d.en ?? d.prompt ?? d.texto ?? fr?.en ?? '', es = d.es ?? d.resumen_es ?? d.resumen ?? fr?.es ?? '';
    const oc = d.ocupacion ?? d.ocupacionEstimada;
    return { en: limpiaFrase(typeof en === 'string' ? en : leerDescripcion(en, sep)?.en), es: typeof es === 'string' ? es : leerDescripcion(es)?.es || '', ...(oc != null ? { ocupacion: oc } : {}), ...(typeof d.resumen === 'string' && d.es != null ? { resumen: d.resumen } : {}) };
  }
  return null;
}
/** Una ocupación (número, % o { ancho, alto }) como fracción de 0 a 1, la del lado que más ocupa. */
export function fraccion(o) {
  if (o == null) return null;
  if (typeof o === 'object') { const ns = [o.ancho, o.alto, o.valor, o.fraccion, o.max, o.lado].map(Number).filter(Number.isFinite); return ns.length ? fraccion(Math.max(...ns)) : null; }
  const n = Number(o); if (!Number.isFinite(n) || n < 0) return null;
  return n > 1 ? Math.min(1, n / 100) : n;
}
function escenaPara(escena, familia, escena3d, errores, opts) {
  if (!escena) return null;
  const corta = familia === 'edicion-corta' || familia === 'descriptiva';
  let d = null;
  try { d = escena3d?.describirEscena ? escena3d.describirEscena(escena, familia, opts) : (escena.descripcion ?? escena.frases ?? null); }
  catch (e) { errores.push(`El escenario 3D no se pudo traducir: ${e.message}`); return null; }
  const r = leerDescripcion(d, corta ? ', ' : '; ');
  if (!r || !r.en) { errores.push('El escenario 3D no se pudo traducir al prompt (falta describirEscena de src/escena3d-core.js)'); return null; }
  let oc = r.ocupacion;
  if (oc == null && escena3d?.ocupacionEstimada) { try { oc = escena3d.ocupacionEstimada(escena); } catch { oc = null; } }
  return { en: r.en, es: r.es, ...(r.resumen ? { resumen: r.resumen } : {}), ocupacion: fraccion(oc), proporcion: escena.cuadro?.proporcion || null, fondo: escena.fondo || null };
}
const esBlanco = c => /^#?(fff|ffffff)$/i.test(String(c || '').trim());

/* ---------- referencias por ejes (§5.4) ---------- */
/** Los ejes de una referencia (0–3), con lo que encienden los presets de referencia de la pila. Producto nunca por defecto. */
export function ejesDeReferencia(ref, lista = []) {
  const dada = ref && typeof ref === 'object' && ref.ejes && typeof ref.ejes === 'object';
  const cero = Object.fromEntries(EJES_REF.map(e => [e, 0]));
  if (dada) { for (const e of EJES_REF) if (ref.ejes[e] != null) cero[e] = Math.max(0, Math.min(3, Math.round(+ref.ejes[e] || 0))); return cero; }
  const dePresets = arr(lista).flatMap(it => arr(it.preset?.entradas).filter(en => en.rol === 'referencia' && en.eje).map(en => [it, en]));
  if (!dePresets.length) return { ...EJES_REF_DEF };
  for (const [it, en] of dePresets) {
    const f = FUERZA_DE_VALOR[it.params?.fuerza] || 2;
    for (const e of EJE_DE_ENTRADA[en.eje] || []) if (e !== 'producto' || it.explicito) cero[e] = Math.max(cero[e], f);
  }
  return cero;
}
const FRASE_EJE = {
  estilo: 'for its visual style (medium, texture, mood)',
  composicion: 'as a layout guide (camera angle, framing, placement, negative space)',
  luz: 'for its lighting (direction, softness, color temperature): relight the image like it',
  fondo: 'for its background (materials, colors, depth), without its objects',
  pose: 'for the pose of the person',
  producto: 'as the scene: replace the product shown in it with the product from Image 1',
};
const NOMBRE_EJE_EN = { estilo: 'visual style', composicion: 'composition', luz: 'lighting', fondo: 'background', pose: 'pose', producto: 'scene' };

/* ---------- operaciones locales (§5.5) ---------- */
/** Antes del modelo: lo que le ayuda (enderezar, quitar la dominante, la luz técnica). Lo demás va después. */
export const OPS_ANTES = ['rotar-horizonte', 'dominante', 'balance', 'auto-niveles', 'exposicion', 'sombras', 'altas', 'contraste', 'ruido'];
const ORDEN_OPS = ['rotar-horizonte', 'dominante', 'balance', 'auto-niveles', 'exposicion', 'sombras', 'altas', 'contraste', 'ruido', 'saturacion', 'temperatura', 'blanco-y-negro', 'transferir-color', 'lut', 'lut3d', 'igualar-serie', 'nitidez', 'grano', 'fondo-blanco', 'capa-sombra', 'extender', 'encuadrar', 'exportar-lut', 'quitar-exif', 'exportar', 'exportar-varios'];
const rangoOp = o => { const i = ORDEN_OPS.indexOf(o.op); return i < 0 ? ORDEN_OPS.length : i; };
/** Una operación con sus valores por intensidad ya elegidos ({ ev: { suave, normal, fuerte } } → { ev: 0.4 }). */
function opResuelta(op, params, de) {
  const out = { ...op, de };
  for (const [k, v] of Object.entries(op)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const key = ['suave', 'normal', 'fuerte'].some(x => x in v) ? (params.intensidad || 'normal') : ['baja', 'media', 'alta'].some(x => x in v) ? (params.fuerza || 'media') : null;
      if (key && key in v) out[k] = v[key];
    }
  }
  return out;
}

/* ---------- compilar (§5.1–5.4, §5.8, §16) ---------- */
/**
 * Compila una pila de presets en un pedido para media.submit, lo local de antes y de después, la QA y el resumen.
 * opts: {
 *   pila, params (globales: { canal, encuadre, intensidad… }), entradas ({ foto, referencias: [id | { id, ejes }], inicial, final,
 *   origen, lut, guiaEscena }), idea, producto, model (uno pedido), models (filas de models()), caps (capsOf o mapa),
 *   byId (los presets), familias, tipos, canales, cifras, capacidades ({ local: ¿hay sharp? }), escena (el escenario 3D),
 *   escena3d ({ describirEscena, ocupacionEstimada } de src/escena3d-core.js), kind, n, orden ('barato'), lote (bool), preferencia }
 * → { modo, kind, model, familia, alternativas, porque, request, local: { antes, despues }, post, qa, medir, pasos_es, conserva_es,
 *     resumen_es, prompt, prompt_es, costo, avisos, errores, preset: [{ id, v, params }], guia, soloLocal, escena }
 */
export function compilar(opts = {}) {
  const { idea: idea0 = '', producto: producto0 = '', models = [], caps = null, cifras = {}, capacidades = {}, escena = null, escena3d = null } = opts;
  const by = indexar(opts.byId || []), tipos = opts.tipos || {}, familias = opts.familias || FAMILIAS;
  const canales = arr(opts.canales);
  const idea = String(idea0 || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim(), producto = String(producto0 || '').trim();
  const kind = opts.kind || arr(opts.pila).map(x => by.get(typeof x === 'string' ? x : x?.id)).find(Boolean)?.medios?.[0] || 'image';
  const exp = expandir(arr(opts.pila).length ? opts.pila : idea && kind !== 'music' && kind !== 'audio' ? [{ id: 'libre', texto: idea }] : [], by, { kind });
  const avisos = [...exp.avisos], errores = [...exp.errores];
  let lista = exp.lista;

  // entradas
  const E = opts.entradas || {};
  const fotos = arr(E.foto ?? E.sujeto).filter(Boolean);
  const refs = arr(E.referencias ?? E.referencia).filter(Boolean).map(r => (typeof r === 'string' ? { id: r } : r)).filter(r => r.id);
  const ent = { ...E, foto: fotos, referencias: refs };
  const esVideo = kind === 'video';
  const bucle = esVideo ? lista.find(it => it.preset.bucle) : null;
  if (esVideo) {
    // los fotogramas (§5.2): la foto es la de partida; con dos fotos y un preset que pide la de llegada, la 2.ª es la final
    if (!cuenta(E.inicial) && fotos.length) ent.inicial = fotos[0];
    const pideFinal = lista.some(it => arr(it.preset.entradas).some(en => en.rol === 'final'));
    if (!cuenta(E.inicial) && !cuenta(E.final) && fotos.length > 1) {
      if (pideFinal) ent.final = fotos[1];
      else avisos.push({ tipo: 'entrada', texto: 'Va una foto de partida por clip: uso la primera (para ir de una a otra, «De antes a después» o «Pasar de una foto a otra»)' });
    }
    // el bucle termina en la misma foto en que empieza: inicial = final, se pone sola
    if (bucle && cuenta(ent.inicial)) {
      if (cuenta(ent.final) && arr(ent.final)[0] !== arr(ent.inicial)[0]) avisos.push({ tipo: 'bucle', id: bucle.id, texto: `«${nombreDe(bucle.preset)}» termina en la misma foto en que empieza: no uso la de llegada` });
      ent.final = arr(ent.inicial)[0];
    }
  }
  const modo = modoDe(ent, kind);
  const conFoto = kind === 'image' && fotos.length > 0;

  // cada preset es de este medio y admite el modo
  for (const it of lista) {
    const p = it.preset;
    if (!arr(p.medios).includes(kind)) errores.push(`«${nombreDe(p)}» es para ${arr(p.medios).join(' o ') || '¿?'}, no para ${{ image: 'imagen', video: 'video', music: 'música', audio: 'voz' }[kind] || kind}`);
    else if (!modoAdmite(p, modo)) errores.push(porQueNoModo(p, modo, kind));
    else for (const en of arr(p.entradas)) {
      const tiene = { sujeto: kind === 'video' ? cuenta(ent.inicial) : fotos.length, referencia: refs.length, lut: cuenta(E.lut), inicial: cuenta(ent.inicial), final: cuenta(ent.final), origen: cuenta(E.origen ?? E.video), guia: cuenta(E.guia), extra: cuenta(E.extra) }[en.rol] ?? 0;
      if ((en.min || 0) > tiene) errores.push(`«${nombreDe(p)}» necesita: ${en.es || en.rol}`);
    }
  }
  if (esVideo) {
    // lo que el dueño debe saber de cada preset, en texto (el giro 360 y los objetos rígidos, el bucle…)
    for (const it of lista) if (it.preset.aviso) avisos.push({ tipo: 'preset', id: it.id, texto: `«${nombreDe(it.preset)}»: ${it.preset.aviso}` });
    const blando = BLANDO_RE.exec(normalizar(`${producto} ${idea}`));
    for (const it of lista.filter(x => x.preset.soloRigidos)) if (blando) avisos.push({ tipo: 'rigido', id: it.id, texto: `«${nombreDe(it.preset)}» va con objetos rígidos: «${blando[0]}» suele deformarse al girar. Mejor «Producto protagonista» o «Revelación en detalle»` });
    // un movimiento por clip: la receta mueve el PRODUCTO con la cámara quieta, y otra cámara le quitó la quietud
    for (const a of exp.avisos) if (a.tipo === 'sustituye' && a.eje === 'camara' && a.pierde === 'cam-fija') {
      const receta = lista.find(it => it.preset.capa === 'receta' && arr(it.preset.incluye).includes('cam-fija'));
      if (receta) avisos.push({ tipo: 'movimiento', id: receta.id, texto: `«${nombreDe(receta.preset)}» ya mueve el producto: con «${nombreDe(by.get(a.gana))}» también se mueve la cámara en el mismo clip. Revisa que no se deforme` });
    }
  }
  if (!lista.length && !idea && kind === 'image' && modo === 'foto' && !escena) errores.push('Elige un preset o escribe qué quieres cambiar');

  // el escenario 3D se queda con el encuadre y el ángulo (§15.3) y, en video, con el plano (la distancia de la cámara):
  // los ajustes de esos ejes salen, avisando. El movimiento de cámara del preset se queda: el escenario dice dónde EMPIEZA.
  if (escena) {
    const del = esVideo ? ['encuadre', 'angulo', 'plano'] : ['encuadre', 'angulo'];
    lista = lista.filter(it => {
      const ejes = ejesExclusivosDe(it.preset).filter(e => del.includes(e));
      if (!ejes.length) return true;
      avisos.push({ tipo: 'sustituye', eje: ejes[0], gana: 'escena', pierde: it.id, texto: `${{ angulo: 'Ángulo', encuadre: 'Encuadre', plano: 'Plano' }[ejes[0]]}: el escenario 3D sustituyó a «${nombreDe(it.preset)}»` });
      return false;
    });
  }

  // parámetros: canal y encuadre son del pedido entero
  const global = { ...(opts.params || {}) };
  const elegido = id => { for (const it of lista) if (it.params?.[id] != null) return it.params[id]; return global[id]; };
  const canalId = elegido('canal') ?? lista.map(it => arr(it.preset.parametros).find(q => q.tipo === 'canal')).find(Boolean)?.def ?? null;
  const canal = canalId ? canales.find(c => c.id === canalId) || null : null;
  if (canalId && canales.length && !canal) errores.push(`No conozco el canal «${canalId}»`);
  if (canal) global.canal = canal.id;
  for (const it of lista) it.params = resolverParams(it.preset, it, global, canal, avisos, tipos);

  // el nivel de encuadre: lo que eligió el dueño > la ocupación del canal > el def del preset
  const qEnc = lista.map(it => arr(it.preset.parametros).find(q => q.tipo === 'encuadre')).find(Boolean);
  let nivel = null;
  if (qEnc && !escena) {
    const valores = arr(qEnc.valores || tipos.encuadre?.valores);
    const pedido = elegido('encuadre');
    if (pedido != null && pedido !== '@canal') nivel = valores.find(v => v.v === pedido) || null;
    else if (canal?.ocupacion != null) {
      const medidos = valores.filter(v => v.medido && v.ocupacion != null);
      const cerca = medidos.sort((a, b) => Math.abs(a.ocupacion - canal.ocupacion) - Math.abs(b.ocupacion - canal.ocupacion))[0];
      nivel = cerca ? { ...cerca, ocupacion: canal.ocupacion, en: Math.abs(cerca.ocupacion - canal.ocupacion) < 0.005 ? cerca.en : `entire product centered, about ${Math.round(canal.ocupacion * 100)}% of the frame, even margins, nothing cropped` } : null;
    } else nivel = valores.find(v => v.v === (qEnc.def ?? tipos.encuadre?.def)) || null;
    for (const it of lista) if ('encuadre' in it.params) it.params.encuadre = nivel?.v ?? it.params.encuadre;
  }

  // referencias por ejes
  // en video, cada referencia es la de SU entrada (la 1.ª del probador es la prenda; la 2.ª, la persona): por orden
  const refEntradas = esVideo ? lista.flatMap(it => arr(it.preset.entradas).filter(en => en.rol === 'referencia' && en.eje).map(en => [it, en])) : [];
  const refsE = refs.map((r, i) => {
    const par = esVideo && !(r.ejes && typeof r.ejes === 'object') && refEntradas.length > 1 ? refEntradas[i] : null;
    if (!par) return { id: r.id, i, ejes: ejesDeReferencia(r, lista), ...(esVideo && refEntradas.length === 1 ? { rol: refEntradas[0][1].eje } : {}) };
    const ejes = Object.fromEntries(EJES_REF.map(e => [e, 0])), f = FUERZA_DE_VALOR[par[0].params?.fuerza] || 2;
    for (const e of EJE_DE_ENTRADA[par[1].eje] || []) ejes[e] = Math.max(ejes[e], f);
    return { id: r.id, i, ejes, rol: par[1].eje };
  });
  // «Mi producto en esa foto» pone TU producto en la referencia: sin tu foto no hay qué poner. En video no: allí la
  // referencia de producto ES tu producto (el unboxing, el probador).
  for (const r of refsE) if (r.ejes.producto && !conFoto && !esVideo) { r.ejes.producto = 0; avisos.push({ tipo: 'ref', texto: '«Mi producto en esa foto» necesita tu foto: lo apagué' }); }
  for (const r of refsE) if (r.ejes.pose && r.rol !== 'persona') avisos.push({ tipo: 'ref', texto: 'Copiar la pose solo sirve si en las fotos hay una persona' });
  if (escena) for (const r of refsE) if (r.ejes.composicion) { r.ejes.composicion = 0; avisos.push({ tipo: 'sustituye', eje: 'composicion', gana: 'escena', pierde: r.id, texto: 'Composición: el escenario 3D manda sobre la composición de la referencia' }); }
  // el color de una referencia se copia aquí, sin IA (§5.4)… salvo en video: sin ffmpeg, el color va a la IA como «color grade»
  const refsIA = refsE.filter(r => [...(esVideo ? ['color'] : []), 'estilo', 'composicion', 'luz', 'fondo', 'pose', 'producto'].some(e => r.ejes[e] > 0));
  const refsColor = esVideo ? [] : refsE.filter(r => r.ejes.color > 0);

  // ¿hace falta un modelo?
  const iaItems = lista.filter(it => it.preset.ejecutor === 'ia' || it.preset.ejecutor === 'local+ia' || it.preset.ejecutor === 'ajustes');
  const iaRefs = refsIA;
  if (conFoto && !iaItems.length && !iaRefs.length && !escena && idea && arr(opts.pila).length) { // una idea sobre presets locales: va a la IA, y se dice
    avisos.push({ tipo: 'idea', texto: 'Lo que escribiste se manda a la IA como instrucción (los presets elegidos son locales)' });
    lista.push({ id: 'libre', v: 1, preset: libre(idea, kind), params: {}, origen: 'pila', explicito: true });
  }
  const necesitaIA2 = kind !== 'image' || !conFoto || iaItems.length > 0 || iaRefs.length > 0 || !!escena || lista.some(it => it.id === 'libre');

  // sin sharp: lo local dice «no disponible» y nada cae a la IA
  const sinLocal = capacidades.local === false;
  const tocaLocal = it => it.preset.ejecutor === 'local' || it.preset.ejecutor === 'local+ia' || arr(it.preset.local).length || arr(it.preset.post).length;
  if (sinLocal) {
    for (const it of lista) if (tocaLocal(it)) errores.push(`«${nombreDe(it.preset)}» no está disponible en esta máquina (falta sharp): no se manda a la IA en su lugar`);
    if (refsColor.length) errores.push('Copiar el color de una referencia no está disponible en esta máquina (falta sharp)');
  }

  // lo local
  const ops = [];
  for (const it of lista) for (const op of arr(it.preset.local)) {
    const o = opResuelta(op, it.params, it.id);
    if (o.op === 'exportar-varios') o.canales = arr(it.params.canales).map(id => canales.find(c => c.id === id)).filter(Boolean).map(c => ({ canal: c.id, ancho: c.ancho, alto: c.alto, proporcion: c.proporcion, formato: c.formato, ...(c.pesoMaxKB ? { pesoMaxKB: c.pesoMaxKB } : {}), ...(c.fondo ? { fondo: c.fondo } : {}) }));
    if (o.op === 'lut3d' || o.op === 'lut') { if (cuenta(E.lut)) o.lut = arr(E.lut)[0]; if (it.params.mezcla != null) o.mezcla = +it.params.mezcla / 100; }
    if (o.op === 'transferir-color') { const r = refsE.find(x => x.ejes.color > 0) || refsE[0]; if (r) { o.ref = r.id; const k = refsColor.indexOf(r); if (k >= 0) refsColor.splice(k, 1); } }
    ops.push(o);
  }
  for (const r of refsColor) ops.push({ op: 'transferir-color', metodo: 'reinhard-lab', ref: r.id, fuerza: FUERZA_COLOR[r.ejes.color], zona: 'todo', de: `referencia ${r.i + 1}` });
  // los pasos de después del modelo que piden los presets
  const fondoEscenaNoBlanco = escena?.fondo && !(escena.fondo.tipo === 'color' && esBlanco(escena.fondo.valor));
  for (const it of lista) for (const s of arr(it.preset.post)) {
    if (s === 'fondo-blanco') {
      if (it.preset.capa === 'receta' && arr(exp.sustituidos[it.id]).includes('fondo')) continue; // otro fondo ganó
      if (fondoEscenaNoBlanco) { avisos.push({ tipo: 'post', texto: 'El fondo del escenario no es blanco: no se fuerza el blanco 255' }); continue; }
      ops.push({ op: 'fondo-blanco', color: canal?.fondo || '#FFFFFF', de: it.id });
    } else if (s === 'encuadrar') {
      if (escena) continue; // el escenario fija la distancia; la ocupación se mide, no se impone (§15.3)
      if (!nivel || !nivel.medido || nivel.ocupacion == null) { if (nivel) avisos.push({ tipo: 'post', texto: `«${nivel.es || nivel.v}» no se mide: es una indicación a la IA` }); continue; }
      ops.push({ op: 'encuadrar', ocupacion: nivel.ocupacion, alinear: nivel.alinear === 'base' ? 'base' : (elegido('alinear') && elegido('alinear') !== 'auto' ? elegido('alinear') : canal?.alinear || nivel.alinear || 'auto'), ...(nivel.base ? { base: nivel.base } : {}), ...(canal?.aireMinPx ? { aireMinPx: canal.aireMinPx } : {}), escalaSerie: elegido('escalaSerie') || 'llenar', ...(canal ? { lado: Math.max(canal.ancho || 0, canal.alto || 0) } : {}), de: it.id });
    } else if (s === 'exportar') {
      const rellenar = !!(escena && canal && escena.cuadro?.proporcion && canal.proporcion && escena.cuadro.proporcion !== canal.proporcion);
      if (rellenar) avisos.push({ tipo: 'post', texto: `El escenario es ${escena.cuadro.proporcion} y ${canal.nombre} pide ${canal.proporcion}: al exportar se rellena con el fondo, sin recortar nada` });
      ops.push({ op: 'exportar', ...(canal ? { canal: canal.id, ancho: canal.ancho, alto: canal.alto, proporcion: canal.proporcion, formato: canal.formato, ...(canal.pesoMaxKB ? { pesoMaxKB: canal.pesoMaxKB } : {}), ...(canal.fondo ? { fondo: canal.fondo } : {}) } : {}), ajuste: rellenar || escena ? 'rellenar' : 'auto', srgb: true, sinExif: true, de: it.id });
    } else ops.push({ op: s, de: it.id });
  }
  // una operación una vez (la última gana: la del dueño va después que la de la receta)
  const vistos = new Map(); for (const o of ops) vistos.set(o.op === 'transferir-color' ? `${o.op}:${o.ref}` : o.op, o);
  const opsU = [...vistos.values()].sort((a, b) => rangoOp(a) - rangoOp(b));
  const local = necesitaIA2 ? { antes: opsU.filter(o => OPS_ANTES.includes(o.op)), despues: opsU.filter(o => !OPS_ANTES.includes(o.op)) } : { antes: opsU, despues: [] };

  // QA
  let qa = uniq(lista.flatMap(it => arr(it.preset.qa)));
  if (!opsU.some(o => o.op === 'fondo-blanco')) { qa = qa.filter(q => q !== 'fondo-255'); for (const o of opsU) if (o.op === 'exportar' && o.fondo && o.ajuste !== 'rellenar') delete o.fondo; }
  if (!conFoto) qa = qa.filter(q => q !== 'identidad');
  const medir = {};
  if (escena && kind === 'image') { medir.ocupacion = { objetivo: null, tolerancia: 0.12, fuente: 'escena', medido: true }; if (!qa.includes('ocupacion')) qa.push('ocupacion'); }
  else if (qa.includes('ocupacion')) medir.ocupacion = nivel?.medido && nivel.ocupacion != null ? { objetivo: nivel.ocupacion, tolerancia: 0.03, fuente: 'encuadre', medido: true } : { objetivo: nivel?.ocupacion ?? null, medido: false, fuente: 'encuadre', nota: 'no medido' };

  const presetOut = lista.filter(it => it.id !== 'libre').map(it => ({ id: it.id, v: it.v, params: it.params }));
  const base = { modo, kind, avisos, errores, preset: presetOut, local, post: local.despues.map(o => o.op), qa, medir };

  /* ---------- sin modelo: todo local ---------- */
  if (!necesitaIA2) {
    const pasos_es = pasosEs(lista, refsE, null, nivel, canal, null);
    return { ...base, model: null, familia: null, alternativas: [], porque: 'Todo se hace en esta máquina: sin IA, gratis y al instante', request: null, soloLocal: true, prompt: '', prompt_es: '', costo: { usd: 0, texto: 'gratis' }, pasos_es, conserva_es: conFoto ? 'Tu foto original no se toca: el resultado es una versión nueva.' : '', resumen_es: `${MODO_ES[modo] || modo} · ${pasos_es.length} paso${pasos_es.length === 1 ? '' : 's'} · en esta máquina, gratis`, guia: null, escena: null };
  }

  /* ---------- elegir el modelo ---------- */
  const target = escena?.cuadro?.proporcion || lista.map(it => it.preset.ajustesModelo?.aspectRatio).filter(Boolean).at(-1) || canal?.proporcion || elegido('proporcion') || null;
  const fotoEnModelo = conFoto ? 1 : 0;
  const nBase = fotoEnModelo + iaRefs.length;
  const cands = modelosPara(lista, models, caps, { kind, modo, nImagenes: kind === 'image' ? nBase : undefined, refs: kind === 'video' ? refs.length : iaRefs.length, proporcion: target, orden: opts.orden, grande: !!opts.lote, preferencia: opts.preferencia, familias });
  const buenos = cands.filter(c => c.on);
  let elegidoM = null;
  if (opts.model) {
    elegidoM = cands.find(c => c.id === opts.model) || null;
    if (!elegidoM) errores.push(`El modelo «${opts.model}» no sirve para ${({ image: 'imágenes', video: 'video', music: 'música', audio: 'voz' })[kind] || kind}`);
    else if (!elegidoM.on) { errores.push(`${elegidoM.nombre} no puede con esto: ${elegidoM.motivo}${buenos[0] ? `. Prueba con ${buenos[0].nombre}` : ''}`); elegidoM = null; }
  } else elegidoM = buenos[0] || null;
  if (!elegidoM && !opts.model) {
    const e = kind === 'image' && conFoto ? 'Ningún motor que edita fotos tiene key todavía: activa uno en Ajustes y reinicia la oficina' : `Ningún modelo encendido puede con esto${cands[0]?.motivo ? ` (${cands[0].nombre}: ${cands[0].motivo})` : ''}`;
    errores.push(e); base.sinMotor = true;
  }
  // el preferido que se quedó fuera por la proporción, se dice (Veo no hace 1:1: va Kling o Seedance)
  if (elegidoM && kind === 'video' && target) {
    const top = cands.find(c => /no hace/.test(c.motivo || '') && !/no tiene key/.test(c.motivo || ''));
    if (top && top.score > elegidoM.score) avisos.push({ tipo: 'modelo', texto: `${top.nombre} no hace ${target}: elegí ${elegidoM.nombre}` });
  }
  if (!elegidoM) return { ...base, model: null, familia: null, alternativas: cands.slice(0, 6).map(c => ({ id: c.id, nombre: c.nombre, on: c.on, motivo: c.motivo })), porque: '', request: null, soloLocal: false, prompt: '', prompt_es: '', costo: { usd: 0, texto: '—' }, pasos_es: pasosEs(lista, refsE, null, nivel, canal, null), conserva_es: '', resumen_es: '', guia: null, escena: null };
  const row = arr(models).find(m => m.id === elegidoM.id) || {}, c = elegidoM.caps;
  const familia = c.familia || (kind === 'video' ? 'video-generico' : kind === 'image' ? 'descriptiva' : null);

  /* ---------- las imágenes y sus números ---------- */
  const media = {}; let versionOf, refsVideo = [];
  const imgs = []; // lo que va en reference, en orden
  if (kind === 'image') {
    if (conFoto) { imgs.push(fotos[0]); versionOf = fotos[0]; if (fotos.length > 1) avisos.push({ tipo: 'entrada', texto: `Va una foto por pedido: uso la primera (para varias, un lote)` }); }
    for (const r of iaRefs) { r.n = imgs.length + 1; imgs.push(r.id); }
  } else if (kind === 'video') {
    // los roles de media.mjs (§5.2): start = la foto de partida, end = la de llegada (en el bucle, la misma), video = tu
    // video (o la guía de «copiar movimiento», que no es lo que se versiona), reference = tus referencias y el empaque
    const ini = arr(ent.inicial)[0], fin = arr(ent.final)[0], org = arr(E.origen ?? E.video)[0], guiaV = arr(E.guia)[0];
    if (org) { media.video = [org]; versionOf = org; if (ini) media.start = [ini]; }
    else if (guiaV) { media.video = [guiaV]; if (ini) media.start = [ini]; }
    else if (ini) { media.start = [ini]; if (fin) media.end = [fin]; }
    const extras = refs.length ? arr(E.extra).filter(Boolean) : [];
    const todas = [...refs.map(r => r.id), ...extras];
    const rr = todas.slice(0, c.maxRefs || 0);
    if (rr.length && (!media.start || c.refYFotogramas)) {
      media.reference = rr;
      if (rr.length < todas.length) avisos.push({ tipo: 'entrada', texto: `${elegidoM.nombre} toma ${c.maxRefs} referencia${c.maxRefs === 1 ? '' : 's'}: van las primeras` });
      refsVideo = rr.map((id, k) => ({ n: k + 1, ref: k < refs.length ? refsE[k] : null, extra: k >= refs.length }));
    } else if (refs.length) avisos.push({ tipo: 'entrada', texto: `${elegidoM.nombre} no junta la foto de partida con referencias: van solo como inspiración del texto` });
    if (bucle && media.start && !media.end) avisos.push({ tipo: 'bucle', id: bucle.id, texto: `${elegidoM.nombre} no toma la foto final: el bucle se pide solo con palabras` });
  }
  // la imagen guía del escenario 3D, si cabe (en video el escenario va en el texto, con el movimiento del preset: más abajo)
  let guia = null;
  let escD = esVideo ? null : escenaPara(escena, familia, escena3d, errores);
  if (escD && kind === 'image') {
    if (imgs.length < (c.maxRefs || 0)) {
      const n = imgs.length + 1, dada = arr(E.guiaEscena)[0];
      imgs.push(dada || GUIA);
      guia = { n, pendiente: !dada, marcador: GUIA, proporcion: escD.proporcion || target, rotulo: ROTULO_GUIA(n), ...(dada ? { id: dada } : {}) };
    } else avisos.push({ tipo: 'guia', texto: `${elegidoM.nombre} no toma la imagen guía del escenario: la cámara y la distancia van solo en el texto` });
    medir.ocupacion = { objetivo: escD.ocupacion, tolerancia: 0.12, fuente: 'escena', medido: escD.ocupacion != null };
  }
  if (imgs.length) media.reference = imgs;

  /* ---------- el prompt ---------- */
  const ctx = { idea, producto, tipos, cifras, errores, n1: iaRefs[0]?.n || (conFoto ? 2 : 1), encuadreEn: escD ? '' : nivel?.en || '' };
  const slots = { accion: [], luz: [], escena: [], estilo: [], camara: [], plano: [], look: [], sfx: [], ambiente: [] };
  const sustituidas = new Set(Object.keys(exp.sustituidos));
  const cabecera = new Set(lista.filter(it => it.preset.capa === 'receta' && (it.preset.ia || it.preset.iaPorIntensidad) && !sustituidas.has(it.id)).map(it => it.id));
  const cubierto = it => { let o = it.origen; while (o && o !== 'pila') { if (cabecera.has(o)) return true; o = lista.find(x => x.id === o)?.origen; } return false; };
  for (const it of lista) {
    const p = it.preset;
    if (p.ejecutor === 'local') continue;
    // en imagen la frase de la receta ya dice lo que trae dentro; en video no: la receta es la acción y su cámara, su plano
    // y su sonido son ajustes aparte, cada uno en su hueco (así otra cámara la sustituye limpia: un movimiento por clip)
    if (!esVideo && !it.explicito && cubierto(it)) continue; // la frase de la receta ya lo dice
    if (!esVideo && p.capa === 'receta' && sustituidas.has(it.id)) continue; // otro preset le quitó un eje: hablan sus piezas, no su frase entera
    for (const q of arr(p.parametros)) if (q.ranura && slots[q.ranura] && it.params[q.id] != null && String(it.params[q.id]).trim()) slots[q.ranura].push(limpiaFrase(enDe(p, q.id, it.params[q.id], tipos)));
    const int = it.params.intensidad;
    let f = p.iaPorIntensidad?.[int] ?? p.ia;
    if (!f) continue;
    if (!p.iaPorIntensidad && int && int !== 'normal') { const en = enDe(p, 'intensidad', int, tipos); if (en) f = `${en} ${f}`; }
    f = limpiaFrase(rellenar(f, { ...ctx, params: it.params }, avisos, p));
    if (!f) continue;
    const ejes = arr(p.ejes), slot = p.ranura && slots[p.ranura] ? p.ranura : p.capa === 'receta' ? 'accion' : ejes.includes('escena') ? 'escena' : ejes.includes('estilo') || ejes.includes('look') ? (kind === 'video' ? 'look' : 'estilo') : ejes.length && ejes.every(e => e === 'luz') ? 'luz' : 'accion';
    slots[slot].push(f);
  }
  let camaraEnEscena = false;
  if (esVideo && escena) {
    // el escenario 3D en video (§16.2): dónde empieza la cámara (distancia, altura, lente) + el movimiento del preset
    const cam = lista.find(it => arr(it.preset.ejes).includes('camara') && it.preset.capa === 'ajuste');
    escD = escenaPara(escena, familia, escena3d, errores, { movimiento: slots.camara.join(', '), movimientoEs: cam ? nombreDe(cam.preset).toLowerCase() : '' });
    if (escD) { slots.plano.push(escD.en); slots.camara = []; camaraEnEscena = true; }
  } else if (escD) slots.camara.push(String(escD.en).replace(/^\s*Camera and framing:\s*/i, '')); // la plantilla ya pone «Camera and framing:»
  const conservar = conFoto || iaRefs.some(r => r.ejes.producto) ? (familias[familia]?.conservar || (familia === 'edicion-corta' ? 'Keep the product exactly the same.' : CONSERVAR)) : '';
  const refLineas = (corta) => {
    const out = [];
    for (const r of iaRefs) {
      const on = EJES_REF.filter(e => e !== 'color' && r.ejes[e] > 0);
      const neg = r.ejes.producto ? 'do not copy its product, text, logos or brand names' : NEGATIVO_REF;
      if (corta) { out.push(`Use image ${r.n} only for its ${y(on.map(e => NOMBRE_EJE_EN[e]))}; ${neg}.`); continue; }
      out.push(`Image ${r.n} is a reference for ${y(on.map(e => NOMBRE_EJE_EN[e]))} only. Use Image ${r.n} only ${on.map(e => `${FRASE_EJE[e]}, ${FUERZA_EN[r.ejes[e]]} it`).join('; and ')}; ${neg}.`);
    }
    if (guia) out.push(corta ? `Image ${guia.n} is a layout guide only: match its camera angle and the size and position of the box (the product); do not draw the box.` : guia.rotulo);
    return out;
  };
  const ideaEnPrompt = lista.some(it => it.id === 'libre' && it.preset.ia === idea) ? '' : idea; // la idea hecha «instrucción libre» no se repite
  // video: qué es cada referencia (§5.4 en video) y si el modelo hace sonido
  const refsVideoTxt = esVideo ? lineasRefVideo(refsVideo) : [];
  const auM = esVideo ? audioDe(row, familia) : 'no';
  if (esVideo && auM === 'no' && (slots.sfx.length || slots.ambiente.length)) { slots.sfx = []; slots.ambiente = []; }
  const render = (s) => renderPrompt({ familia, kind, conFoto, slots: s, idea: ideaEnPrompt, producto, conservar, refLineas, encuadreEn: ctx.encuadreEn, plantilla: familias[familia]?.plantilla, iaRefs, guia, refsVideo: refsVideoTxt, camaraFija: !camaraEnEscena && modo !== 'video' });
  let prompt = render(slots);
  const maxP = Math.min(c.maxPrompt || 4000, familias[familia]?.max || Infinity);
  const recortado = [];
  for (const k of ['estilo', 'look', 'escena', 'luz']) { if (prompt.length <= maxP) break; if (slots[k].length) { slots[k] = []; recortado.push(k); prompt = render(slots); } }
  if (recortado.length) avisos.push({ tipo: 'recorte', texto: `El prompt no cabía en ${elegidoM.nombre} (${maxP} caracteres): quité ${recortado.join(', ')}` });
  if (prompt.length > maxP) errores.push(`El pedido es muy largo para ${elegidoM.nombre} (${prompt.length} de ${maxP} caracteres): quita algún preset o acorta tu idea`);
  if (kind === 'audio' && !idea) errores.push('Escribe el texto de la locución: se lee tal cual');

  /* ---------- ajustes del modelo ---------- */
  const settings = {};
  const relleno = (v, it) => limpiaFrase(rellenar(v, { ...ctx, params: it.params }, avisos, it.preset));
  for (const it of lista) for (const [k, v] of Object.entries(it.preset.ajustesModelo || {})) settings[k] = typeof v === 'string' ? relleno(v, it) : Array.isArray(v) ? v.map(x => (typeof x === 'string' ? relleno(x, it) : x)) : v;
  const durP = lista.map(it => arr(it.preset.parametros).find(q => q.tipo === 'duracion') && it.params[arr(it.preset.parametros).find(q => q.tipo === 'duracion').id]).filter(Boolean).at(-1);
  if (durP != null && kind === 'video') settings.duration = Number(durP);
  if (target) settings.aspectRatio = target;
  const lado = canal ? Math.max(canal.ancho || 0, canal.alto || 0) : 0;
  const st = row.settings || {};
  if (esVideo && settings.generateAudio != null) {
    // el sonido, con el ajuste que tenga ESTE modelo: generateAudio, sound (Kling), siempre (Veo 3.1) o ninguno
    const quiere = settings.generateAudio === true || settings.generateAudio === 'true';
    if (auM === 'sound') { settings.sound = quiere; delete settings.generateAudio; }
    else if (auM === 'siempre') { delete settings.generateAudio; if (!quiere) avisos.push({ tipo: 'sonido', texto: `${elegidoM.nombre} siempre trae sonido: no se puede apagar (quítalo al publicar)` }); }
    else if (auM === 'no') { delete settings.generateAudio; if (quiere) avisos.push({ tipo: 'sonido', texto: `${elegidoM.nombre} no hace sonido: el video sale mudo` }); }
  }
  if (kind === 'image' && lado > 1024 && settings.imageSize == null && settings.resolution == null) {
    if (arr(st.imageSize?.values).includes('2K')) settings.imageSize = '2K';
    else if (arr(st.resolution?.values).includes('2k')) settings.resolution = '2k';
  }
  if (settings.imageSize && !st.imageSize && st.resolution) { const v = String(settings.imageSize).toLowerCase(); if (arr(st.resolution.values).includes(v)) settings.resolution = v; }
  const limpios = {};
  for (const [k, v] of Object.entries(settings)) {
    const f = st[k]; if (!f) continue;
    if (k === 'aspectRatio') { const vals = arr(f.values).filter(x => RATIO_RE.test(x)); const r = vals.includes(v) ? v : proporcionCercana(v, vals); if (r) { limpios[k] = r; if (r !== v) avisos.push({ tipo: 'proporcion', texto: `${elegidoM.nombre} no hace ${v}: lo pido en ${r}${kind === 'image' ? ' y se deja exacto al exportar' : ''}` }); } continue; }
    if (Array.isArray(v)) { // candidatos en orden («dolly-in» o «dolly_in»): el primero que este modelo admite; si ninguno, nada
      const nk = x => String(x).toLowerCase().replace(/[\s_]+/g, '-');
      const x = v.map(c => arr(f.values).find(o => o !== '' && nk(o) === nk(c))).find(o => o !== undefined);
      if (x !== undefined) limpios[k] = x;
      continue;
    }
    if (f.type === 'enum') { // el valor con el tipo del modelo («8» o 8, según lo declare)
      let x = arr(f.values).find(o => String(o) === String(v));
      if (x === undefined && k === 'duration' && Number.isFinite(Number(v))) { // la duración más cercana que hace (Veo: 4, 6 u 8 s)
        x = arr(f.values).filter(o => Number.isFinite(Number(o))).sort((a, b) => Math.abs(a - v) - Math.abs(b - v) || b - a)[0];
        if (x !== undefined) avisos.push({ tipo: 'ajuste', texto: `${elegidoM.nombre} no hace ${v} s: lo pido en ${x} s` });
      }
      if (x === undefined) avisos.push({ tipo: 'ajuste', texto: `${elegidoM.nombre} no admite ${k} = ${v}` }); else limpios[k] = x;
      continue;
    }
    if (f.type === 'range') {
      const n = Number(v); if (!Number.isFinite(n)) continue;
      limpios[k] = Math.min(f.max, Math.max(f.min, n));
      if (k === 'duration' && limpios[k] !== n) avisos.push({ tipo: 'ajuste', texto: `${elegidoM.nombre} hace de ${f.min} a ${f.max} s: lo pido en ${limpios[k]} s` });
      continue;
    }
    if (f.type === 'boolean') { limpios[k] = v === true || v === 'true'; continue; }
    limpios[k] = v;
  }
  if (kind === 'image' && target && !limpios.aspectRatio && st.aspectRatio) avisos.push({ tipo: 'proporcion', texto: `${elegidoM.nombre} no deja elegir proporción: se ajusta a ${target} al exportar` });

  /* ---------- costo ---------- */
  const n = Math.max(1, Math.min(kind === 'video' ? 4 : 8, +opts.n || 1));
  const unit = c.per === 's' ? (c.costo || 0) * (Number(limpios.duration) || 5) : (c.costo || 0);
  const costoUsd = unit * n;

  const request = {
    kind, model: elegidoM.id, prompt: kind === 'music' && !prompt ? (limpios.style || '') : prompt, n, settings: limpios, media,
    ...(versionOf ? { versionOf } : {}),
    preset: presetOut, ...(local.antes.length ? { pre: local.antes } : {}), ...(local.despues.length ? { post: local.despues } : {}), ...(qa.length ? { qa } : {}),
  };
  const pasos_es = pasosEs(lista, refsE, elegidoM, nivel, canal, escD, kind);
  if (esVideo) { // lo que el dueño ve del clip antes de gastar: los fotogramas, el formato y el sonido
    if (bucle && media.end) pasos_es.push('Bucle: la misma foto al principio y al final');
    else if (media.start && media.end) pasos_es.push('De la foto de partida a la de llegada');
    const fmt = [limpios.aspectRatio, limpios.duration != null ? `${limpios.duration} s` : ''].filter(Boolean).join(' · ');
    if (fmt) pasos_es.push(`Formato: ${fmt}`);
    if (limpios.generateAudio === true || limpios.sound === true || (auM === 'siempre' && (slots.sfx.length || slots.ambiente.length))) pasos_es.push('Con sonido');
    else if (limpios.generateAudio === false || limpios.sound === false) pasos_es.push('Sin sonido');
  }
  return {
    ...base, model: elegidoM.id, familia, alternativas: buenos.filter(x => x.id !== elegidoM.id).slice(0, 5).map(x => ({ id: x.id, nombre: x.nombre, porque: x.porque })),
    porque: `${elegidoM.nombre}: ${elegidoM.porque || 'el único que puede'}`,
    request, soloLocal: false, prompt: request.prompt, prompt_es: escD?.es || '',
    costo: { usd: +costoUsd.toFixed(4), unidad: +unit.toFixed(4), texto: costoUsd ? `unos ${usd(costoUsd)}` : 'gratis' },
    pasos_es,
    conserva_es: conFoto ? 'Tu foto original no se toca: el resultado es una versión nueva. Se conserva el producto: forma, proporciones, colores, etiqueta y logos.' : '',
    resumen_es: `${MODO_ES[modo] || modo} · ${pasos_es.length} paso${pasos_es.length === 1 ? '' : 's'} · con ${elegidoM.nombre} · ${costoUsd ? `unos ${usd(costoUsd)}` : 'gratis'}`,
    guia, escena: escD ? { en: escD.en, es: escD.es, ocupacion: escD.ocupacion } : null,
  };
}
/** Video: una frase por imagen de referencia, en el orden en que van (§5.4). Tu producto se conserva tal cual; la persona,
 *  su identidad; lo demás («el look», «la luz»…) solo para eso, con el negativo de siempre. */
const NOMBRE_EJE_VIDEO = { estilo: 'visual style', color: 'color grade', composicion: 'composition', luz: 'lighting', fondo: 'background', pose: 'pose and movement' };
function lineasRefVideo(refsVideo) {
  const out = [];
  for (const { n, ref, extra } of refsVideo) {
    if (extra) { out.push(`Reference image ${n} is the packaging`); continue; }
    if (!ref) continue;
    if (ref.ejes.producto) { out.push(`Reference image ${n} is the product: it must look exactly the same (shape, proportions, colors, label and logos)`); continue; }
    if (ref.rol === 'persona') { out.push(`Reference image ${n} is the person: keep the same face, body and look`); continue; }
    if (ref.rol) continue; // la pidió un preset («Copiar el look de una foto»): su propia frase ya dice para qué es
    const on = EJES_REF.filter(e => e !== 'producto' && ref.ejes[e] > 0);
    if (!on.length) continue;
    const f = Math.max(...on.map(e => ref.ejes[e]));
    out.push(`Use reference image ${n} only for its ${y(on.map(e => NOMBRE_EJE_VIDEO[e]))}, ${FUERZA_EN[f]} it; ${NEGATIVO_REF}`);
  }
  return out;
}
const MODO_ES = { cero: 'Desde cero', foto: 'Sobre tu foto', ref: 'Con una referencia', 'foto+ref': 'Tu foto + referencia', texto: 'Desde texto', anima: 'Anima tu foto', ab: 'De una foto a otra', refs: 'Con referencias', video: 'Sobre tu video' };
const DONDE = { local: 'en esta máquina, gratis', ia: 'la IA', 'local+ia': 'la IA, y aquí se garantiza', ajustes: 'ajuste del modelo' };
function pasosEs(lista, refsE, m, nivel, canal, escD, kind = 'image') {
  const out = [], video = kind === 'video';
  for (const it of lista) out.push(`${nombreDe(it.preset)} (${DONDE[it.preset.ejecutor] || it.preset.ejecutor})`);
  for (const r of refsE) {
    if (video && r.ejes.producto) { out.push(`Referencia ${r.i + 1}: tu producto, tal cual`); continue; }
    if (video && r.rol === 'persona') { out.push(`Referencia ${r.i + 1}: la persona`); continue; }
    const on = EJES_REF.filter(e => r.ejes[e] > 0);
    if (on.length) out.push(`Referencia ${r.i + 1}: ${on.map(e => `${EJES_REF_ES[e][0].toLowerCase() + EJES_REF_ES[e].slice(1)} ${FUERZA_ES[r.ejes[e]]}${e === 'color' && !video ? ' (aquí, sin IA)' : ''}`).join(', ')}`);
  }
  if (escD) out.push(`Escenario 3D: ${escD.resumen || escD.es || 'cámara y distancia del escenario'}${escD.ocupacion != null && !video ? ` · ocupa ~${Math.round(escD.ocupacion * 100)} % (se mide al final)` : ''}`);
  else if (nivel) out.push(nivel.medido && nivel.ocupacion != null ? `Producto al ${Math.round(nivel.ocupacion * 100)} % del cuadro, medido aquí` : `${nivel.es || nivel.v} (no medido)`);
  if (canal) out.push(`Para ${canal.nombre}: ${canal.ancho}×${canal.alto}${canal.formato ? ` ${canal.formato}` : ''}`);
  return out;
}

/* ---------- las plantillas por familia (§5.8) ---------- */
/** Una plantilla con huecos vacíos, sin comas ni puntos sueltos ni líneas «SFX:» vacías. */
export function limpiaPlantilla(s) {
  return String(s).split('\n').map(l => {
    let x = l.replace(/[ \t]+/g, ' ');
    for (let i = 0; i < 4; i++) x = x.replace(/,\s*,/g, ',').replace(/,\s*\./g, '.').replace(/\.\s*,/g, '.').replace(/\.\s*\./g, '.').replace(/:\s*\./g, ':');
    x = x.replace(/^\s*[.,]\s*/, '').replace(/\s+([.,])/g, '$1').trim();
    return x.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()); // cada frase empieza en mayúscula
  }).filter(l => l && !/^(SFX|Ambient noise):?\s*[.,]?$/i.test(l)).join('\n');
}
function renderPrompt({ familia, kind, conFoto, slots, idea, producto, conservar, refLineas, encuadreEn, plantilla, iaRefs, guia, refsVideo = [], camaraFija = true }) {
  const prod = producto || 'the product';
  if (kind === 'music') return idea;
  if (kind === 'audio') return idea;
  if (kind === 'video' || FAMILIAS_VIDEO.includes(familia)) {
    let tpl = plantilla || PLANTILLAS_VIDEO[familia] || PLANTILLAS_VIDEO['video-generico'];
    // una plantilla de antes (sin {refs} ni {sonido}) los recibe detrás de la acción y al final
    if (!tpl.includes('{refs}')) tpl = tpl.replace('{accion}', '{accion}. {refs}');
    if (!tpl.includes('{sonido}') && !/\{sfx\}/.test(tpl)) tpl = tpl.replace(/^([^\n]*)/, '$1 {sonido}.');
    const j = a => a.join(', ');
    let accion = [idea, ...slots.accion, ...slots.estilo].filter(Boolean).join('; ') || (producto ? '' : 'The product');
    // «Cafetera roja» + «the product makes a turntable rotation…» → «Cafetera roja makes…»; si no, «Cafetera roja: …»
    let sujeto = producto;
    if (producto && accion && /^the product\b/i.test(accion)) { accion = accion.replace(/^the product\b/i, producto); sujeto = ''; }
    else if (producto && accion) sujeto = `${producto}:`;
    const sonido = [slots.sfx.length ? `Sound: ${slots.sfx.join('; ')}` : '', slots.ambiente.length ? `Ambient noise: ${slots.ambiente.join('; ')}` : ''].filter(Boolean).join('. ');
    if (!slots.camara.length && (familia !== 'kling' || !camaraFija)) tpl = tpl.replace(/Camera:\s*\{camara\}\.?/, '');
    const val = { camara: j(slots.camara) || (familia === 'kling' && camaraFija ? 'static camera' : ''), plano: j(slots.plano), lente: '', sujeto, accion, refs: refsVideo.join('. '), escena: j(slots.escena), look: j(slots.look), luz: j(slots.luz), sfx: j(slots.sfx), ambiente: j(slots.ambiente), sonido };
    return limpiaPlantilla(tpl.replace(/\{(\w+)\}/g, (m, k) => val[k] ?? ''));
  }
  const encuadre = encuadreEn ? encuadreEn : '';
  const extras = (pre) => [
    slots.luz.length ? `${pre}Lighting: ${slots.luz.join('; ')}` : '',
    slots.escena.length ? `${pre}Setting: ${slots.escena.join('; ')}` : '',
    slots.estilo.length ? `${pre}Style: ${slots.estilo.join('; ')}` : '',
    encuadre ? `${pre}Framing: ${encuadre}` : '',
    slots.camara.length ? `${pre}Camera and framing: ${slots.camara.join('; ')}` : '',
  ].filter(Boolean);
  const punto = s => (s && !/[.!?]$/.test(s) ? s + '.' : s);
  if (familia === 'instrucciones') {
    const L = [conFoto ? 'Edit the attached product photo.' : `Create a professional photo of ${prod}.`];
    if (conFoto && (iaRefs.length || guia)) L.push('Image 1 is the product photo to edit.');
    L.push(...refLineas(false));
    const req = [...slots.accion, ...extras(''), idea].filter(Boolean);
    if (req.length) L.push('Requirements:', ...req.map(x => `- ${x}`));
    if (conservar) L.push('Must stay unchanged:', `- ${conservar}`);
    return L.join('\n');
  }
  if (familia === 'edicion-corta') {
    const accion = [...slots.accion, ...slots.luz, ...slots.escena, ...slots.estilo].join('; ');
    const enc = [encuadre, ...slots.camara].filter(Boolean).join('; ');
    return [punto(conFoto ? accion : [prod, accion].filter(Boolean).join(': ')), enc ? punto(enc) : '', ...refLineas(true), idea ? punto(idea) : '', conservar].filter(Boolean).join(' ');
  }
  if (familia === 'descriptiva') {
    const partes = [prod, ...slots.accion, ...slots.escena, ...slots.luz, ...slots.estilo, encuadre, ...slots.camara, idea, 'professional product photography'].filter(Boolean);
    return [partes.join(', '), ...refLineas(true), conservar].filter(Boolean).join(' ');
  }
  // conversacional (y cualquier familia de imagen sin plantilla propia)
  const L = [];
  if (conFoto) L.push('Image 1 is the product photo to edit.');
  L.push(...refLineas(false));
  const accion = slots.accion.join('; ');
  if (conFoto) { if (accion) L.push(punto(`Change only this: ${accion}`)); }
  else L.push(punto(`Create a professional photo of ${prod}${accion ? `: ${accion}` : ''}`));
  L.push(...extras('').map(punto));
  if (idea) L.push(punto(idea));
  if (conservar) L.push(conservar);
  return L.join(' ');
}

/** Pone el id de la imagen guía ya subida en lugar del marcador (la página la renderiza con guiaComposicion y la sube). */
export function ponerGuia(compilado, id) {
  if (!compilado?.request?.media?.reference || !id) return compilado;
  const ref = compilado.request.media.reference.map(x => (x === GUIA ? id : x));
  return { ...compilado, request: { ...compilado.request, media: { ...compilado.request.media, reference: ref } }, guia: compilado.guia ? { ...compilado.guia, pendiente: false, id } : compilado.guia };
}

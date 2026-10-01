// ============================================================
// Buscador del banco de presets (PURO: sin red ni archivos)
//
// docs/propuesta-banco-presets.md §4.3 y §12 («presets-buscar»). Lo importan la página (el banco, al instante,
// también en la demo file://), el servidor (presets.mjs) y el bloque de Dimitri (que filtra los 188 presets
// para no pasar de 2.500 caracteres). El dueño escribe como habla en la tienda («se ve oscura», «quitar lo de
// atrás», «para la web»), con o sin tildes, en plural o con una letra de más: todo eso tiene que encontrar.
//
// Cómo puntúa, de más a menos:
//   1. una frase de `buscar` (o el nombre) contenida entera en lo que se escribió, o al revés: «que se vea pro»;
//   2. cada palabra de la búsqueda contra las palabras del nombre, el técnico, `buscar`, la frase y el grupo,
//      con su raíz (plurales fuera), sus sinónimos de tienda y una letra de error (las de 5 o más letras);
//   3. desempates: estrella, favoritos, recientes, la fase (lo de F1 antes).
// Cubierto por tests/presets-buscar.test.mjs.
// ============================================================

/** Minúsculas, sin tildes ni diéresis (la ñ queda como n), sin signos; espacios simples. «Catálogo» → «catalogo». */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9:/.+ ]+/g, ' ')
    .replace(/[.:/+]+(?=\s|$)/g, ' ') // un punto al final de una palabra no es parte de ella; «.cube» y «4:5» sí
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras que no dicen nada del pedido: «para», «que», «se», «más» fuera; «sin» se queda (cambia el sentido).
 *  Las frases enteras de `buscar` («que se vea pro», «como este anuncio») se siguen encontrando por el paso 1. */
export const VACIAS = new Set(['a', 'al', 'algo', 'como', 'con', 'de', 'del', 'el', 'en', 'es', 'esta', 'este', 'esto', 'la', 'las', 'le', 'lo', 'los', 'me', 'mi', 'mis', 'muy', 'o', 'para', 'por', 'que', 'quiero', 'se', 'su', 'sus', 'te', 'tu', 'tus', 'un', 'una', 'unas', 'unos', 'y', 'ya', 'foto', 'fotos', 'imagen', 'imagenes', 've', 'vea', 'vean', 'ver', 'haz', 'hazlo', 'hacer', 'pon', 'ponle', 'ponerle', 'dale', 'darle', 'mas']);

/** La raíz de una palabra: sin plural y sin la vocal final de género («sombras» → «sombr», «luces» → «luz», «oscura» → «oscur»). */
export function raiz(w) {
  let x = String(w || '');
  if (x.length <= 3 || /\d/.test(x)) return x;
  if (x.endsWith('ces') && x.length > 4) x = x.slice(0, -3) + 'z';
  else if (/[^aeiou]es$/.test(x) && x.length > 5) x = x.slice(0, -2);
  else if (x.endsWith('s')) x = x.slice(0, -1);
  if (x.length > 4 && /[aeo]$/.test(x)) x = x.slice(0, -1);
  return x;
}

/** Sinónimos de tienda: cada grupo son palabras (o frases) que el dueño usa para lo mismo. Todo ya normalizado. */
export const SINONIMOS = [
  ['atras', 'detras', 'fondo', 'background'],
  ['oscura', 'oscuro', 'subexpuesta', 'apagada', 'poca luz', 'negra'],
  ['clara', 'claro', 'iluminar', 'aclarar', 'luz'],
  ['fea', 'feo', 'mala', 'malo', 'horrible', 'baja calidad', 'mala calidad'],
  ['pro', 'profesional', 'estudio', 'calidad'],
  ['instagram', 'ig', 'insta', 'feed', 'reel', 'historia', 'stories'],
  ['whatsapp', 'wasap', 'whats', 'wa', 'guasap'],
  ['vueltas', 'vuelta', 'girar', 'gire', 'giro', 'rotar', 'gira', 'orbita', '360'],
  ['anuncio', 'publicidad', 'ad', 'ads', 'promocion'],
  ['quitar', 'borrar', 'eliminar', 'sacar', 'remover', 'limpiar'],
  ['arrugada', 'arrugado', 'arrugas', 'arruga', 'planchar'],
  ['sabana', 'sabanas', 'cama', 'colcha', 'edredon'],
  ['web', 'pagina', 'sitio', 'tienda online', 'ecommerce'],
  ['vender', 'venta', 'catalogo', 'tienda'],
  ['corte', 'corta', 'cortado', 'recorte', 'recortar'],
  ['espacio', 'aire', 'margen', 'alrededor', 'padding'],
  ['nitida', 'enfocar', 'enfoque', 'definicion'],
  ['borrosa', 'desenfocada', 'movida'],
  ['sombra', 'sombras'],
  ['blanco', 'blanca'],
  ['grande', 'agrandar', 'ampliar', 'upscale'],
  ['mueble', 'muebles', 'sofa', 'cama', 'colchon'],
  ['copiar', 'igual', 'igualar', 'mismo', 'misma', 'como'],
  ['color', 'colores', 'tono'],
];
const SIN = new Map();
for (const g of SINONIMOS) for (const w of g) { const k = raiz(w); const set = SIN.get(k) || new Set(); for (const o of g) if (o !== w) set.add(o); SIN.set(k, set); }
/** Los sinónimos de una palabra (por su raíz), sin ella misma. */
export const sinonimosDe = w => [...(SIN.get(raiz(normalizar(w))) || [])];

/** ¿A una letra (de distancia de edición, con trasposición) o menos? Solo para palabras de 5 letras o más. */
export function cerca(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  // Damerau–Levenshtein acotado a 1
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ra = a.slice(i), rb = b.slice(i);
  if (ra.length === rb.length) return ra.slice(1) === rb.slice(1) || (ra.length >= 2 && ra[0] === rb[1] && ra[1] === rb[0] && ra.slice(2) === rb.slice(2));
  return ra.length > rb.length ? ra.slice(1) === rb : rb.slice(1) === ra;
}

const palabras = s => normalizar(s).split(' ').filter(Boolean);
const significativas = s => palabras(s).filter(w => !VACIAS.has(w));

/** El índice de un preset (se calcula una vez por preset y se guarda). */
const INDICE = new WeakMap();
function indice(p) {
  let ix = INDICE.get(p); if (ix) return ix;
  const campos = [
    ['nombre', 3, [p.nombre]],
    ['tecnico', 2.5, [p.tecnico]],
    ['buscar', 2.2, p.buscar || []],
    ['frase', 0.8, [p.frase]],
    ['grupo', 1, [p.categoria]],
    ['id', 0.6, [String(p.id || '').replace(/-/g, ' ')]],
  ];
  const tokens = []; // { w, r, campo, peso }
  const frases = []; // { f, campo, peso } — para la coincidencia de frase entera
  for (const [campo, peso, vals] of campos) for (const v of vals) {
    if (!v) continue; const f = normalizar(v); if (!f) continue;
    if (campo === 'buscar' || campo === 'nombre' || campo === 'tecnico') frases.push({ f, campo, peso });
    for (const w of f.split(' ')) if (w && !VACIAS.has(w)) tokens.push({ w, r: raiz(w), campo, peso });
  }
  ix = { tokens, frases }; INDICE.set(p, ix); return ix;
}

/** Cuánto vale una palabra de la búsqueda contra el índice de un preset: { peso, por } o null. */
function puntuaPalabra(q, ix) {
  const rq = raiz(q); let best = null;
  const toma = (peso, por) => { if (!best || peso > best.peso) best = { peso, por }; };
  for (const t of ix.tokens) {
    if (t.w === q) toma(t.peso, `${t.campo} «${t.w}»`);
    else if (t.r === rq && rq.length >= 3) toma(t.peso * 0.9, `${t.campo} «${t.w}»`);
    else if (rq.length >= 4 && t.r.length >= 4 && (t.r.startsWith(rq) || rq.startsWith(t.r))) toma(t.peso * 0.6, `${t.campo} «${t.w}»`);
    else if (cerca(q, t.w)) toma(t.peso * 0.75, `${t.campo} «${t.w}» (casi)`);
  }
  for (const s of sinonimosDe(q)) {
    const sw = palabras(s);
    for (const t of ix.tokens) if (sw.length === 1 ? (t.w === sw[0] || t.r === raiz(sw[0])) : false) toma(t.peso * 0.7, `sinónimo «${t.w}»`);
    if (sw.length > 1) for (const fr of ix.frases) if ((' ' + fr.f + ' ').includes(' ' + s + ' ')) toma(fr.peso * 0.7, `sinónimo «${s}»`);
  }
  return best;
}

/** ¿El modo del pedido encaja con lo que el preset admite? (los mismos casos que modoAdmite de presets-core) */
const MODOS_OK = { cero: ['cero'], foto: ['foto'], ref: ['ref', 'cero'], 'foto+ref': ['foto+ref', 'foto'], texto: ['texto'], anima: ['anima', 'texto'], ab: ['ab', 'anima', 'texto'], refs: ['refs', 'texto'], video: ['video'] };
const encajaModo = (p, modo) => !modo || (p.modos || []).some(m => (MODOS_OK[modo] || [modo]).includes(m));

/**
 * Busca en los presets. → [{ id, score, por }] ordenados, mejor primero.
 * opts: { medio: 'image'|'video'|'music'|'audio', modo, grupo, favoritos: [ids], recientes: [ids, más reciente primero], max }
 * Sin texto devuelve los que pasan los filtros, con estrella, favoritos y recientes delante (la portada del banco).
 */
export function buscar(q, presets, opts = {}) {
  const { medio, modo, grupo, favoritos = [], recientes = [], max = 50 } = opts;
  const lista = (presets || []).filter(p => p && p.id
    && (!medio || (p.medios || []).includes(medio))
    && (!grupo || p.categoria === grupo)
    && encajaModo(p, modo));
  const fav = new Set(favoritos), rec = new Map(recientes.map((id, i) => [id, i]));
  const extra = p => (p.estrella ? 0.3 : 0) + (fav.has(p.id) ? 0.6 : 0) + (rec.has(p.id) ? 0.4 - Math.min(0.3, rec.get(p.id) * 0.03) : 0) + (p.fase === 1 ? 0.15 : 0);
  const nq = normalizar(q), qs = significativas(q);
  if (!nq) return lista.map(p => ({ id: p.id, score: +extra(p).toFixed(3), por: fav.has(p.id) ? 'favorito' : rec.has(p.id) ? 'reciente' : p.estrella ? 'estrella' : '' }))
    .filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, max);
  // una búsqueda de puras palabras vacías («que se vea») cuenta con todas sus palabras
  const qw = qs.length ? qs : palabras(q);
  const out = [];
  for (const p of lista) {
    const ix = indice(p); const por = []; let tocadas = 0, frase = 0, palabrasScore = 0;
    // 1. frase entera: la de `buscar` dentro de lo escrito («quiero que se vea pro» ⊃ «que se vea pro»), o lo escrito
    //    dentro de una frase de varias palabras («arrugada» no cuenta aquí: eso es el paso 2)
    for (const fr of ix.frases) {
      if (fr.f.length < 3) continue;
      const n = fr.f.split(' ').length;
      const dentro = (' ' + nq + ' ').includes(' ' + fr.f + ' '), contiene = n > 1 && nq.includes(' ') && (' ' + fr.f + ' ').includes(' ' + nq + ' ');
      if (dentro || contiene) { const w = fr.peso * (1.2 + Math.min(1.5, n * 0.5)); if (w > frase) { frase = w; por.push({ w, t: `${fr.campo} «${fr.f}»` }); } }
    }
    // 2. palabra por palabra
    for (const w of qw) { const m = puntuaPalabra(w, ix); if (m) { palabrasScore += m.peso; tocadas++; por.push({ w: m.peso, t: m.por }); } }
    if (!frase && !palabrasScore) continue;
    // cubrir más palabras de la búsqueda vale más que repetir una
    const cobertura = qw.length ? tocadas / qw.length : 1;
    const score = frase + palabrasScore * (0.55 + 0.45 * cobertura) + extra(p);
    out.push({ id: p.id, score: +score.toFixed(3), por: [...new Set(por.sort((a, b) => b.w - a.w).map(x => x.t))].slice(0, 3).join(' · ') });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, max);
}

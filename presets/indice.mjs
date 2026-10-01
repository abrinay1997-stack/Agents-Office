// Banco de presets: el ÍNDICE de búsqueda que dan los datos (nombre, técnico, sinónimos de cada preset, su grupo y
// presets/sinonimos.json). PURO: sin red ni archivos; corre en la página y en el servidor.
//
// Es la búsqueda de REFERENCIA del equipo de datos: con ella el test comprueba que los sinónimos cubren las frases reales
// del dueño («fondo blanco», «más luz», «quitar sombra», «catálogo web», «como este anuncio»…). El buscador de la
// interfaz (src/presets-buscar.js) puede usar estas piezas (normalizar, singular, expandir, terminosDe) y su propio
// ranking (§7.4); si encuentra MENOS que esta, faltan datos o le falta algo al ranking.
//
//   normalizar(s)                        → «se ve oscura»   minúsculas, sin tildes ni ñ, sin signos
//   palabras(s)                          → ['se','ve','oscura']
//   raiz(w)                              → la misma para singular y plural: 'sombras'/'sombra', 'luces'/'luz', 'colores'/'color'
//   casi(a, b)                           → a una letra de distancia (palabras de 5 letras o más)
//   expandir(q, sinonimos)               → [{ q, peso }]    la búsqueda y lo que suman las frases de sinonimos.json
//   terminosDe(preset, grupos?)          → { nombre, tecnico, usos: [], grupo, bolsa: Set }
//   encontrar(q, presets, { sinonimos, grupos, limite, medio, modo }) → [{ id, score, por }]

export const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'que', 'se', 'me', 'mi', 'mis', 'lo', 'le', 'les', 'para',
  'con', 'y', 'o', 'a', 'al', 'en', 'por', 'su', 'sus', 'es', 'esta', 'este', 'esto', 'como', 'muy', 'mas', 'algo', 'tu', 'te', 'yo', 'quiero', 'hacer', 'haz', 'hazlo', 'foto', 'fotos', 'imagen']);

export const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/:+.]+/g, ' ').replace(/(^|\s)[.:/+]+|[.:/+]+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
export const palabras = s => normalizar(s).split(' ').filter(Boolean);
/** La raíz de una palabra, igual para el singular y el plural: «sombras» y «sombra» → «sombra»; «colores» y «color» →
 *  «color»; «luces» y «luz» → «luc»; «detalles» y «detalle» → «detall». Se aplica a los dos lados (búsqueda y datos). */
export function raiz(w) {
  if (w.length <= 2 || /\d/.test(w)) return w;
  let r = w.replace(/s$/, '');
  if (r.length > 3 && /[^aeiou]e$/.test(r)) r = r.slice(0, -1);
  return r.replace(/z$/, 'c');
}
export const singular = raiz;
/** ¿A una letra de distancia (cambiar, quitar, poner o trasponer una)? Solo en palabras de 5 letras o más. */
export function casi(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ra = a.slice(i + 1), rb = b.slice(i + 1);
  if (a.length === b.length) return ra === rb || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
const contieneFrase = (texto, frase) => (' ' + texto + ' ').includes(' ' + frase + ' ');

/** La búsqueda y lo que le suman las frases de presets/sinonimos.json que aparecen dentro de ella (peso 0,85). */
export function expandir(q, sinonimos) {
  const n = normalizar(q), out = [{ q: n, peso: 1 }];
  const frases = sinonimos?.frases || {};
  const ns = palabras(n).map(raiz).join(' ');
  for (const [k, v] of Object.entries(frases)) {
    const kk = normalizar(k);
    if (!kk) continue;
    if (contieneFrase(n, kk) || contieneFrase(ns, palabras(kk).map(raiz).join(' '))) for (const t of v) out.push({ q: normalizar(t), peso: 0.85 });
  }
  const vistos = new Set();
  return out.filter(x => x.q && !vistos.has(x.q) && vistos.add(x.q));
}

/** Lo que se busca de un preset (normalizado), y la bolsa de raíces de todas sus palabras. */
export function terminosDe(p, grupos) {
  const g = Array.isArray(grupos) ? grupos.find(x => x.id === p.categoria) : null;
  const nombre = normalizar(p.nombre), tecnico = normalizar(p.tecnico || ''), usos = (p.buscar || []).map(normalizar).filter(Boolean), grupo = normalizar(g?.nombre || '');
  const bolsa = new Set([nombre, tecnico, ...usos].flatMap(palabras).filter(w => !VACIAS.has(w)).map(raiz));
  return { nombre, tecnico, usos, grupo, bolsa };
}

function puntuar(q, t, df, N) {
  if (!q) return { score: 0, por: '' };
  let fr = 0, por = '';
  const sube = (s, x) => { if (s > fr) { fr = s; por = x; } };
  if (t.nombre === q) sube(120, 'nombre');
  else if (t.nombre.startsWith(q + ' ') || (q.length >= 4 && t.nombre.startsWith(q))) sube(100, 'nombre');
  if (t.tecnico && t.tecnico === q) sube(90, 'técnico');
  const unaPalabra = !q.includes(' ');
  for (const u of [t.tecnico, ...t.usos].filter(Boolean)) {
    if (u === q) sube(80, 'sinónimo');
    else if (unaPalabra && !u.includes(' ') && casi(q, u)) sube(48, 'sinónimo con una letra cambiada');
    else if (u.includes(' ') && contieneFrase(q, u)) sube(55 + 4 * u.split(' ').length, 'uso');
    else if (q.length >= 4 && q.includes(' ') && contieneFrase(u, q)) sube(50, 'uso');
  }
  if (q.includes(' ') && contieneFrase(t.nombre, q)) sube(75, 'nombre');
  // palabra por palabra, pesada por lo rara que es en el catálogo (IDF): «arrugas» vale más que «fondo»
  const ws = [...new Set(palabras(q).filter(w => !VACIAS.has(w)).map(raiz))];
  let total = 0, hecho = 0, exactas = 0;
  for (const w of ws) {
    const peso = Math.log(1 + N / (1 + (df.get(w) || 0)));
    total += peso;
    if (t.bolsa.has(w)) { hecho += peso; exactas++; }
    else if ([...t.bolsa].some(b => casi(w, b))) hecho += 0.6 * peso;
  }
  const tok = total ? 45 * hecho / total + (exactas === ws.length && ws.length > 1 ? 15 : 0) : 0;
  if (tok > 0 && !por) por = 'palabras';
  const grupo = t.grupo && ws.some(w => palabras(t.grupo).map(raiz).includes(w)) ? 30 * (ws.length === 1 ? 1 : 0.5) : 0;
  return { score: fr + tok + grupo, por: por || (grupo ? 'grupo' : '') };
}

/** Busca en los presets: [{ id, score, por }] de mayor a menor. `medio` ('image'|'video'|'music'|'audio') y `modo` filtran. */
export function encontrar(q, presets, { sinonimos = null, grupos = null, limite = 12, medio = null, modo = null, minimo = 20 } = {}) {
  const lista = (presets || []).filter(p => p && (!medio || (p.medios || []).includes(medio)) && (!modo || (p.modos || []).includes(modo)));
  const terms = new Map(lista.map(p => [p.id, terminosDe(p, grupos)]));
  const df = new Map(); for (const t of terms.values()) for (const w of t.bolsa) df.set(w, (df.get(w) || 0) + 1);
  const qs = expandir(q, sinonimos);
  const out = [];
  for (const p of lista) {
    // la mejor lectura manda; cada otra lectura que también encaja suma un poco (cubre más de lo que se pidió)
    let best = { score: 0, por: '' }, suma = 0;
    for (const { q: x, peso } of qs) {
      const r = puntuar(x, terms.get(p.id), df, lista.length), s = r.score * peso; suma += s;
      if (s > best.score) best = { score: s, por: peso < 1 ? 'frase de tienda' : r.por };
    }
    const score = best.score + Math.min(30, 0.15 * (suma - best.score)) + (best.score && p.estrella ? 2 : 0);
    if (best.score >= minimo) out.push({ id: p.id, score: Math.round(score * 10) / 10, por: best.por });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limite);
}

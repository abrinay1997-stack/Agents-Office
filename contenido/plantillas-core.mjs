// (NÚCLEO PURO, sin disco: lo usan contenido/plantillas.mjs y el Worker de Cloudflare.)
// Agents Office (8 oct 2026, C3) — las PLANTILLAS de publicación: notas del Cerebro, una por plantilla, en
// `<cerebro>/Contenido/Plantillas/<nombre>.md`. Una plantilla es una pieza sin día, sin hora y sin archivos: el formato (y el de cada red),
// las redes, el texto, el primer comentario, los hashtags, el texto propio de cada red y las notas. La nota tiene la misma forma que la de
// una pieza (contenido/piezas.mjs: parsear y serializar), así que se lee y se corrige a mano igual. Viaja por GitHub con las notas del
// equipo, como los textos guardados: nada privado. Borrar la manda a `Contenido/Plantillas/.papelera/`.
//   crearPlantillas({ cerebro, ahora }) → { dir, listar(), guardar({ nombre, pieza }), borrar(nombre) }
//   plantillaDe(pieza, nombre) · aNota(plantilla, { hoy }) · deNota(md, archivo) · nombreLimpio(n)   → puros, con tests
import { parsear, serializar, normalizar } from './piezas-core.mjs';
const basename = (f, ext = '') => { const n = String(f || '').split(/[\\/]/).pop(); return ext && n.endsWith(ext) ? n.slice(0, -ext.length) : n; };

export const DIR_PLANTILLAS = 'Contenido/Plantillas'; // relativa al Cerebro (con / siempre)
export const MAX_PLANTILLAS = 60, MAX_NOMBRE = 60;
const CAMPOS = ['formato', 'formatos', 'redes', 'historiaTambien', 'hashtagsEnComentario', 'texto', 'comentario', 'hashtags', 'textoFacebook', 'textos', 'notas', 'pinterest', 'youtube', 'tiktok'];
const CABECERA = new Set(['tipo', 'titulo', 'formato', 'formatos', 'redes', 'historiaTambien', 'hashtagsEnComentario', 'pinterest', 'youtube', 'tiktok']);

/** Un nombre que sirve de nombre de archivo en Windows: sin \ / : * ? " < > | ni # ni saltos, sin puntos al principio. */
export const nombreLimpio = n => String(n ?? '').replace(/[\\/:*?"<>|#\r\n\t]+/g, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim().slice(0, MAX_NOMBRE).replace(/[.\s]+$/, '');

/** Lo que una pieza guarda como plantilla (sin día, hora, archivos ni estado). → { plantilla } o { error } */
export function plantillaDe(pieza = {}, nombre = '') {
  const n = nombreLimpio(nombre); if (!n) return { error: 'ponle un nombre a la plantilla (por ejemplo «Promo del mes»)' };
  const datos = {}; for (const k of CAMPOS) if (pieza[k] !== undefined && pieza[k] !== null) datos[k] = pieza[k];
  const r = normalizar(datos); if (r.error) return { error: r.error };
  const p = r.pieza;
  if (!String(p.texto || '').trim() && !String(p.comentario || '').trim() && !String(p.hashtags || '').trim() && !Object.keys(p.textos || {}).length && !String(p.textoFacebook || '').trim()) return { error: 'la pieza no tiene texto: una plantilla guarda el texto, el primer comentario o los hashtags' };
  const plantilla = { nombre: n }; for (const k of CAMPOS) plantilla[k] = p[k];
  return { plantilla };
}

/** La plantilla → la nota (la cabecera solo con lo que importa a una plantilla). */
export function aNota(t, { hoy = new Date().toISOString().slice(0, 10) } = {}) {
  const r = normalizar(Object.fromEntries(CAMPOS.filter(k => t[k] !== undefined).map(k => [k, t[k]])));
  const md = serializar({ ...r.pieza, tipo: 'plantilla de contenido', titulo: t.nombre, medios: [], historias: [], fecha: '', hora: '', aprobada: null, entregada: null });
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(md);
  const entradas = []; for (const l of m[1].split('\n')) { if (/^\s+-\s/.test(l) && entradas.length) entradas[entradas.length - 1].push(l); else entradas.push([l]); }
  const cab = entradas.filter(e => CABECERA.has((/^([A-Za-z]\w*):/.exec(e[0]) || [])[1])).map(e => e.join('\n'));
  return `---\n${cab.join('\n')}\nactualizado: ${hoy}\n---\n${m[2]}`;
}

/** La nota → la plantilla (su nombre es el título, o el del archivo). */
export function deNota(md, archivo = '') {
  const p = parsear(md, { file: archivo });
  const nombre = nombreLimpio(p.titulo || basename(archivo, '.md'));
  const t = { nombre, archivo: basename(archivo) }; for (const k of CAMPOS) t[k] = p[k];
  if (!t.redes.length) t.redes = ['instagram'];
  return t;
}


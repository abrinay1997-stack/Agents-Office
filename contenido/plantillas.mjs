// Agents Office (8 oct 2026, C3) — las PLANTILLAS de publicación: notas del Cerebro, una por plantilla, en
// `<cerebro>/Contenido/Plantillas/<nombre>.md`. Una plantilla es una pieza sin día, sin hora y sin archivos: el formato (y el de cada red),
// las redes, el texto, el primer comentario, los hashtags, el texto propio de cada red y las notas. La nota tiene la misma forma que la de
// una pieza (contenido/piezas.mjs: parsear y serializar), así que se lee y se corrige a mano igual. Viaja por GitHub con las notas del
// equipo, como los textos guardados: nada privado. Borrar la manda a `Contenido/Plantillas/.papelera/`.
//   crearPlantillas({ cerebro, ahora }) → { dir, listar(), guardar({ nombre, pieza }), borrar(nombre) }
//   plantillaDe(pieza, nombre) · aNota(plantilla, { hoy }) · deNota(md, archivo) · nombreLimpio(n)   → puros, con tests
import fs from 'node:fs';
import path from 'node:path';
import { parsear, serializar, normalizar } from './piezas.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

export const DIR_PLANTILLAS = path.join('Contenido', 'Plantillas');
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
  const nombre = nombreLimpio(p.titulo || path.basename(archivo, '.md'));
  const t = { nombre, archivo: path.basename(archivo) }; for (const k of CAMPOS) t[k] = p[k];
  if (!t.redes.length) t.redes = ['instagram'];
  return t;
}

export function crearPlantillas({ cerebro, ahora = Date.now } = {}) {
  const dir = path.join(cerebro, DIR_PLANTILLAS);
  const archivos = () => { try { return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort((a, b) => a.localeCompare(b, 'es')); } catch { return []; } };
  const buscar = nombre => { const n = nombreLimpio(nombre).toLowerCase(); return archivos().find(f => f.slice(0, -3).toLowerCase() === n || deNota(fs.readFileSync(path.join(dir, f), 'utf8'), f).nombre.toLowerCase() === n) || null; };
  return {
    dir,
    listar() { const out = []; for (const f of archivos()) { try { out.push(deNota(fs.readFileSync(path.join(dir, f), 'utf8'), f)); } catch { /* una nota rota no tumba la lista */ } } return out; },
    /** Guarda (o reemplaza, por su nombre) una plantilla hecha de una pieza. → { ok, plantilla } o { error } */
    guardar({ nombre, pieza } = {}) {
      const r = plantillaDe(pieza, nombre); if (r.error) return { error: r.error };
      const previa = buscar(r.plantilla.nombre);
      if (previa) { try { r.plantilla.nombre = deNota(fs.readFileSync(path.join(dir, previa), 'utf8'), previa).nombre; } catch { /* se queda el nuevo */ } } // reemplazarla conserva su nombre (y su archivo)
      if (!previa && archivos().length >= MAX_PLANTILLAS) return { error: `ya hay ${MAX_PLANTILLAS} plantillas: borra alguna antes` };
      fs.mkdirSync(dir, { recursive: true });
      const archivo = /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(r.plantilla.nombre) ? `${r.plantilla.nombre} (plantilla)` : r.plantilla.nombre; // nombres que Windows no deja usar
      const f = path.join(dir, previa || `${archivo}.md`);
      fs.writeFileSync(f + '.tmp', aNota(r.plantilla, { hoy: new Date(ahora()).toISOString().slice(0, 10) })); renombrar(f + '.tmp', f);
      return { ok: true, plantilla: { ...r.plantilla, archivo: path.basename(f) }, reemplazada: !!previa };
    },
    /** A la papelera de las plantillas (nada se pierde sin querer). */
    borrar(nombre) {
      const f = buscar(nombre); if (!f) return { error: 'esa plantilla ya no está' };
      const bin = path.join(dir, '.papelera'); fs.mkdirSync(bin, { recursive: true });
      renombrar(path.join(dir, f), path.join(bin, `${ahora()}-${f}`)); return { ok: true };
    },
  };
}

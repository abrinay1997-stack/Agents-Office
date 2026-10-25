// Agents Office (8 oct 2026, C3) — las PLANTILLAS de publicación: notas del Cerebro, una por plantilla, en
// `<cerebro>/Contenido/Plantillas/<nombre>.md`. Una plantilla es una pieza sin día, sin hora y sin archivos: el formato (y el de cada red),
// las redes, el texto, el primer comentario, los hashtags, el texto propio de cada red y las notas. La nota tiene la misma forma que la de
// una pieza (contenido/piezas.mjs: parsear y serializar), así que se lee y se corrige a mano igual. Viaja por GitHub con las notas del
// equipo, como los textos guardados: nada privado. Borrar la manda a `Contenido/Plantillas/.papelera/`.
//   crearPlantillas({ cerebro, ahora }) → { dir, listar(), guardar({ nombre, pieza }), borrar(nombre) }
//   plantillaDe(pieza, nombre) · aNota(plantilla, { hoy }) · deNota(md, archivo) · nombreLimpio(n)   → puros, con tests
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { DIR_PLANTILLAS as DIR_REL, MAX_PLANTILLAS, MAX_NOMBRE, nombreLimpio, plantillaDe, aNota, deNota } from './plantillas-core.mjs';
export { MAX_PLANTILLAS, MAX_NOMBRE, nombreLimpio, plantillaDe, aNota, deNota }; // el núcleo puro salió a plantillas-core.mjs (lo usa también el Worker)
export const DIR_PLANTILLAS = path.join(...DIR_REL.split('/'));

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

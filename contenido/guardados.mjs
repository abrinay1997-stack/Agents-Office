// Agents Office (8 oct 2026, C1: el editor nuevo de Contenido) — los TEXTOS GUARDADOS: la firma, la llamada a la acción, los juegos de
// hashtags que el dueño pone una y otra vez. Son una nota del Cerebro, `<cerebro>/Contenido/Textos guardados.md`, una sección por texto
// («## Firma»): se lee y se corrige a mano, la ven los agentes (pueden usar la firma de la casa) y viaja por GitHub con las demás notas del
// equipo, así que nada privado (el repositorio puede ser público). Una sección hecha solo de hashtags es un JUEGO DE HASHTAGS: el editor
// la pone en el campo «Hashtags» y no en el texto.
//   parsearGuardados(md) · serializarGuardados(lista, { hoy }) · hashtagsUsados(piezas, n)   → puros, con tests
//   crearGuardados({ cerebro, ahora }) → { archivo, listar, guardar({ nombre, texto }), borrar(nombre) }
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { NOTA_GUARDADOS as NOTA_REL, MAX_GUARDADOS, MAX_NOMBRE, MAX_TEXTO, soloHashtags, limpioNombre, parsearGuardados, serializarGuardados, hashtagsUsados, guardarEnLista, borrarDeLista } from './guardados-core.mjs';
export { MAX_GUARDADOS, MAX_NOMBRE, MAX_TEXTO, parsearGuardados, serializarGuardados, hashtagsUsados }; // el núcleo puro salió a guardados-core.mjs (lo usa también el Worker)
export const NOTA_GUARDADOS = path.join(...NOTA_REL.split('/'));

export function crearGuardados({ cerebro, ahora = Date.now } = {}) {
  const archivo = path.join(cerebro, NOTA_GUARDADOS);
  const leer = () => { try { return parsearGuardados(fs.readFileSync(archivo, 'utf8')); } catch { return []; } };
  const escribir = lista => {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo + '.tmp', serializarGuardados(lista, { hoy: new Date(ahora()).toISOString().slice(0, 10) })); renombrar(archivo + '.tmp', archivo);
  };
  return {
    archivo,
    listar: leer,
    /** Guarda (o cambia, por su nombre) un texto. → { ok, lista } o { error } en palabras. */
    guardar(d = {}) { const r = guardarEnLista(leer(), d); if (r.ok) escribir(r.lista); return r; },
    borrar(nombre) { const r = borrarDeLista(leer(), nombre); if (r.ok) escribir(r.lista); return r; },
  };
}

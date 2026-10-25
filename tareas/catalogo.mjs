// Agents Office (6 oct 2026, plan T1/T4 · §5.B, §5.H) — PROYECTOS y ETIQUETAS. Un proyecto cruza departamentos (el lanzamiento de los
// lentes: fotos en el Estudio, post en Marketing, correo en Emails); una etiqueta es libre («#lentes», «urgente-cliente»).
// Viven en data/tareas/proyectos.json y data/tareas/etiquetas.json (de esta máquina, como las tareas: no viajan por GitHub).
// Los colores son claves de una paleta (no hex), y la vista los pinta con tokens que pasan 4,5:1 en claro y en oscuro.
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

import { crearCatalogoCon } from './catalogo-core.mjs';
export { COLORES, ESTADOS_PROYECTO } from './catalogo-core.mjs';
export { progresoProyecto } from './progreso.mjs';

function leer(f) { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; } }
function escribir(f, l) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(l, null, 1)); renombrar(f + '.tmp', f); }

export function crearCatalogo({ dataDir, ahora = () => Date.now() } = {}) {
  const FP = path.join(dataDir, 'tareas', 'proyectos.json'), FE = path.join(dataDir, 'tareas', 'etiquetas.json');
  return crearCatalogoCon({ proyectos: { leer: () => leer(FP), escribir: l => escribir(FP, l) }, etiquetas: { leer: () => leer(FE), escribir: l => escribir(FE, l) } }, { ahora });
}

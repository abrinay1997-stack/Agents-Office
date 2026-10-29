// Banco de presets: la FÁBRICA (los presets que trae la oficina), leída de esta carpeta.
//
//   presets/catalogo.json            versión, fecha y la leyenda (marcadores, ejecutores, modos, capas, ejes exclusivos, fases)
//   presets/grupos.json              los 23 grupos, en el orden de la interfaz
//   presets/tipos.json               los tipos de parámetro compartidos (intensidad, fuerza, encuadre, canal…)
//   presets/canales.json             los destinos con su tamaño, ocupación y peso (Panamá primero)
//   presets/familias.json            las familias de prompt y qué modelos van en cada una
//   presets/iconos.json              id → trazo SVG (viewBox 0 0 24 24, un solo path de trazo)
//   presets/sinonimos.json           frases de tienda → términos, para el buscador (lo que el catálogo no dice)
//   presets/imagen|video|musica/<grupo>.json   { grupo, presets: [...] }
//
// Este módulo lee archivos (servidor, check, build). Lo puro está en presets/validar.mjs, presets/indice.mjs y
// presets/iconos.mjs, que también corren en la página.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARPETA_DE_MEDIO, PARTES, rutaDeGrupo, juntar, cuentas, armarFabrica } from './fabrica-core.mjs';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export { CARPETA_DE_MEDIO, PARTES, rutaDeGrupo, juntar, cuentas, armarFabrica };

const leer = (dir, rel, def) => { const f = path.join(dir, rel); if (!fs.existsSync(f)) { if (def !== undefined) return def; throw new Error(`falta presets/${rel}`); } try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`presets/${rel} no es JSON válido: ${e.message}`); } };

/** Lee la fábrica de `dir` (por defecto, esta carpeta). Lanza si falta una parte o un JSON está roto; lo demás va en `problemas`. */
export function cargarFabrica(dir = DIR) {
  const grupos = leer(dir, 'grupos.json');
  const archivos = {}, listados = {};
  for (const g of grupos) {
    if (!CARPETA_DE_MEDIO[g.medio]) continue;
    const ruta = rutaDeGrupo(g);
    if (fs.existsSync(path.join(dir, ruta))) archivos[ruta] = leer(dir, ruta);
  }
  for (const carpeta of new Set(Object.values(CARPETA_DE_MEDIO))) { const d = path.join(dir, carpeta); if (fs.existsSync(d)) listados[carpeta] = fs.readdirSync(d); }
  return armarFabrica({
    catalogo: leer(dir, 'catalogo.json'), grupos, tipos: leer(dir, 'tipos.json'), canales: leer(dir, 'canales.json'),
    familias: leer(dir, 'familias.json'), iconos: leer(dir, 'iconos.json'), sinonimos: leer(dir, 'sinonimos.json', null), archivos, listados,
  });
}

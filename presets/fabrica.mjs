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

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const CARPETA_DE_MEDIO = { image: 'imagen', video: 'video', music: 'musica', audio: 'musica' };
export const PARTES = ['catalogo.json', 'grupos.json', 'tipos.json', 'canales.json', 'familias.json', 'iconos.json', 'sinonimos.json'];

/** La ruta, dentro de presets/, del archivo de un grupo: «imagen/luz.json», «video/camara.json», «musica/voz.json». */
export function rutaDeGrupo(g) {
  const carpeta = CARPETA_DE_MEDIO[g.medio];
  if (!carpeta) throw new Error(`el grupo «${g.id}» no tiene un medio con carpeta (${g.medio})`);
  return `${carpeta}/${g.id}.json`;
}

/** Junta las partes ya leídas en un catálogo con la forma de docs/presets-catalogo.json (sin `cuentas`: las da `cuentas()`).
 *  `grupos`: [{ grupo, presets }] en cualquier orden; salen en el orden de grupos.json. Puro. */
export function juntar({ catalogo = {}, grupos = [], tipos = {}, canales = [], familias = {}, iconos = {}, sinonimos = null, archivos = [] } = {}) {
  const problemas = [];
  const orden = new Map(grupos.map((g, i) => [g.id, i]));
  const presets = [];
  const vistos = new Set();
  const lista = [...archivos].sort((a, b) => (orden.get(a.grupo) ?? 99) - (orden.get(b.grupo) ?? 99));
  for (const a of lista) {
    if (!orden.has(a.grupo)) problemas.push(`${a.ruta || '?'}: el grupo «${a.grupo}» no está en grupos.json`);
    for (const p of a.presets || []) {
      if (p && p.categoria !== a.grupo) problemas.push(`${a.ruta || a.grupo}: «${p.id}» dice categoria «${p.categoria}» pero está en el archivo de «${a.grupo}»`);
      if (p && vistos.has(p.id)) problemas.push(`el id «${p.id}» está repetido`);
      if (p) vistos.add(p.id);
      presets.push(p);
    }
  }
  return {
    version: catalogo.version ?? 1, fecha: catalogo.fecha || '', leyenda: catalogo.leyenda || {},
    grupos, tipos, canales, familias, iconos, sinonimos: sinonimos || { frases: {} }, presets, problemas,
  };
}

/** Cuántos hay de cada cosa (la tabla del Anexo A). Puro. */
export function cuentas(presets) {
  const n = f => presets.filter(f).length, m = x => p => (p.medios || []).includes(x);
  return { imagen: n(m('image')), video: n(m('video')), musica: n(m('music')), voz: n(m('audio')), total: presets.length, fase1: n(p => p.fase === 1), estrella: n(p => p.estrella === true) };
}

const leer = (dir, rel, def) => { const f = path.join(dir, rel); if (!fs.existsSync(f)) { if (def !== undefined) return def; throw new Error(`falta presets/${rel}`); } try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`presets/${rel} no es JSON válido: ${e.message}`); } };

/** Lee la fábrica de `dir` (por defecto, esta carpeta). Lanza si falta una parte o un JSON está roto; lo demás va en `problemas`. */
export function cargarFabrica(dir = DIR) {
  const grupos = leer(dir, 'grupos.json');
  const archivos = [], problemas = [];
  const esperados = new Set();
  for (const g of grupos) {
    if (!CARPETA_DE_MEDIO[g.medio]) continue; // «todos»: los del dueño, en el Cerebro
    const ruta = rutaDeGrupo(g); esperados.add(ruta);
    if (!fs.existsSync(path.join(dir, ruta))) continue;
    const a = leer(dir, ruta);
    archivos.push({ ruta, grupo: a.grupo ?? g.id, presets: Array.isArray(a.presets) ? a.presets : [] });
    if (a.grupo !== g.id) problemas.push(`presets/${ruta}: dice grupo «${a.grupo}», se esperaba «${g.id}»`);
  }
  for (const carpeta of new Set(Object.values(CARPETA_DE_MEDIO))) { // un archivo que no es de ningún grupo no se pierde en silencio
    const d = path.join(dir, carpeta); if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.json') && !esperados.has(`${carpeta}/${f}`)) problemas.push(`presets/${carpeta}/${f}: no es de ningún grupo de grupos.json (no se carga)`);
  }
  const fab = juntar({
    catalogo: leer(dir, 'catalogo.json'), grupos, tipos: leer(dir, 'tipos.json'), canales: leer(dir, 'canales.json'),
    familias: leer(dir, 'familias.json'), iconos: leer(dir, 'iconos.json'), sinonimos: leer(dir, 'sinonimos.json', null), archivos,
  });
  fab.problemas.unshift(...problemas);
  fab.archivos = archivos.map(a => a.ruta);
  return fab;
}

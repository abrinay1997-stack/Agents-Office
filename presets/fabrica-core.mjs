// Banco de presets: lo PURO de la fábrica (sin archivos ni red). Lo comparten presets/fabrica.mjs (lee la carpeta, para el servidor local,
// el check y el build) y presets/fabrica-worker.js (importa cada JSON en el Worker, donde no hay node:fs).
// `armarFabrica(partes)` es lo único que arma el catálogo: los dos lados lo llaman con las mismas partes, y un test compara su resultado.
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

/** Arma la fábrica con las partes ya leídas.
 *  partes: { catalogo, grupos, tipos, canales, familias, iconos, sinonimos,
 *            archivos: { 'imagen/luz.json': {grupo, presets}, … }  (los archivos de grupo que existen, ya leídos),
 *            listados?: { imagen: ['luz.json', …], … }             (todo lo que hay en cada carpeta, para avisar de un archivo huérfano; sin él, las claves de `archivos`) }
 *  → lo mismo que cargarFabrica(): { …juntar(), archivos: [rutas] }. Puro. */
export function armarFabrica(partes = {}) {
  const { grupos = [], archivos: leidos = {} } = partes;
  const archivos = [], problemas = [], esperados = new Set();
  for (const g of grupos) {
    if (!CARPETA_DE_MEDIO[g.medio]) continue; // «todos»: los del dueño, en el Cerebro
    const ruta = rutaDeGrupo(g); esperados.add(ruta);
    if (!Object.prototype.hasOwnProperty.call(leidos, ruta)) continue;
    const a = leidos[ruta];
    archivos.push({ ruta, grupo: a.grupo ?? g.id, presets: Array.isArray(a.presets) ? a.presets : [] });
    if (a.grupo !== g.id) problemas.push(`presets/${ruta}: dice grupo «${a.grupo}», se esperaba «${g.id}»`);
  }
  const listados = partes.listados || Object.keys(leidos).reduce((o, r) => { const [c, ...f] = r.split('/'); (o[c] ||= []).push(f.join('/')); return o; }, {});
  for (const carpeta of new Set(Object.values(CARPETA_DE_MEDIO))) { // un archivo que no es de ningún grupo no se pierde en silencio
    for (const f of listados[carpeta] || []) if (f.endsWith('.json') && !esperados.has(`${carpeta}/${f}`)) problemas.push(`presets/${carpeta}/${f}: no es de ningún grupo de grupos.json (no se carga)`);
  }
  const fab = juntar({
    catalogo: partes.catalogo, grupos, tipos: partes.tipos, canales: partes.canales,
    familias: partes.familias, iconos: partes.iconos, sinonimos: partes.sinonimos ?? null, archivos,
  });
  fab.problemas.unshift(...problemas);
  fab.archivos = archivos.map(a => a.ruta);
  return fab;
}

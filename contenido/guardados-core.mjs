// (NÚCLEO PURO, sin disco: lo usan contenido/guardados.mjs y el Worker de Cloudflare.)
// Agents Office (8 oct 2026, C1: el editor nuevo de Contenido) — los TEXTOS GUARDADOS: la firma, la llamada a la acción, los juegos de
// hashtags que el dueño pone una y otra vez. Son una nota del Cerebro, `<cerebro>/Contenido/Textos guardados.md`, una sección por texto
// («## Firma»): se lee y se corrige a mano, la ven los agentes (pueden usar la firma de la casa) y viaja por GitHub con las demás notas del
// equipo, así que nada privado (el repositorio puede ser público). Una sección hecha solo de hashtags es un JUEGO DE HASHTAGS: el editor
// la pone en el campo «Hashtags» y no en el texto.
//   parsearGuardados(md) · serializarGuardados(lista, { hoy }) · hashtagsUsados(piezas, n)   → puros, con tests
//   crearGuardados({ cerebro, ahora }) → { archivo, listar, guardar({ nombre, texto }), borrar(nombre) }

export const NOTA_GUARDADOS = 'Contenido/Textos guardados.md'; // relativa al Cerebro (con / siempre; el almacén local la une con path.join)
export const MAX_GUARDADOS = 40, MAX_NOMBRE = 60, MAX_TEXTO = 2200;
const TAG = /^#[\p{L}\p{N}_]+$/u;
export const soloHashtags = t => { const w = String(t ?? '').trim().split(/\s+/).filter(Boolean); return w.length > 0 && w.every(x => TAG.test(x)); };
export const limpioNombre = n => String(n ?? '').replace(/[\r\n#]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);

/** La nota → [{ nombre, texto, hashtags }], en su orden. Lo que va antes de la primera sección es la explicación de la nota. */
export function parsearGuardados(md) {
  const cuerpo = String(md ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const out = []; let cur = null;
  for (const line of cuerpo.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) { cur = { nombre: limpioNombre(h[1]), lineas: [] }; if (cur.nombre) out.push(cur); continue; }
    if (cur) cur.lineas.push(line);
  }
  return out.map(x => { const texto = x.lineas.join('\n').trim().slice(0, MAX_TEXTO); return { nombre: x.nombre, texto, hashtags: soloHashtags(texto) }; }).filter(x => x.texto);
}

/** [{ nombre, texto }] → la nota. `parsearGuardados(serializarGuardados(l))` devuelve lo mismo. */
export function serializarGuardados(lista, { hoy = new Date().toISOString().slice(0, 10) } = {}) {
  const secciones = lista.map(x => `## ${limpioNombre(x.nombre)}\n${String(x.texto ?? '').replace(/^##(\s)/gm, '#$1').trim()}`);
  return `---\ntipo: textos-guardados\nactualizado: ${hoy}\n---\n# Textos guardados\n\nLo que se reutiliza al escribir una publicación en Contenido (la firma, una llamada a la acción, los hashtags de siempre). Cada sección es un texto; una hecha solo de hashtags va al campo «Hashtags». Se edita aquí o desde Contenido → Textos guardados. Viaja con las notas del equipo: nada privado.\n\n${secciones.join('\n\n')}\n`;
}

/** Los hashtags que más se usan en las piezas (el campo «Hashtags» y el texto), del más usado al menos: los del dueño, no unos genéricos. */
export function hashtagsUsados(piezas = [], n = 12) {
  const c = new Map();
  for (const p of piezas) {
    const vistos = new Set(`${p.hashtags || ''} ${p.texto || ''}`.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.map(x => x.trim().toLowerCase()) || []);
    for (const t of vistos) c.set(t, (c.get(t) || 0) + 1);
  }
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([t]) => t);
}


/** La regla de guardar/borrar, sobre una lista ya leída. → { ok, lista } | { error, nada? } (el almacén que sea la escribe). */
export function guardarEnLista(lista, { nombre, texto } = {}) {
  const n = limpioNombre(nombre), t = String(texto ?? '').replace(/\r\n/g, '\n').trim();
  if (!n) return { error: 'ponle un nombre (por ejemplo «Firma»)' };
  if (!t) return { error: 'el texto está vacío' };
  if (t.length > MAX_TEXTO) return { error: `un texto guardado tiene como mucho ${MAX_TEXTO} caracteres` };
  const l = [...lista], i = l.findIndex(x => x.nombre.toLowerCase() === n.toLowerCase());
  if (i < 0 && l.length >= MAX_GUARDADOS) return { error: `ya hay ${MAX_GUARDADOS} textos guardados: borra alguno antes` };
  const nuevo = { nombre: n, texto: t, hashtags: soloHashtags(t) };
  if (i >= 0) l[i] = nuevo; else l.push(nuevo);
  return { ok: true, lista: l };
}
export function borrarDeLista(lista, nombre) {
  const n = limpioNombre(nombre).toLowerCase(), queda = lista.filter(x => x.nombre.toLowerCase() !== n);
  if (queda.length === lista.length) return { error: 'ese texto guardado ya no está', nada: true };
  return { ok: true, lista: queda };
}

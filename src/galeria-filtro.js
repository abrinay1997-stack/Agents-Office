// Auditoría 1 oct 2026 (INF-03) — qué fichas de la galería del Estudio entran en una vista, en un solo sitio.
// Lo usan el servidor (media.mjs: /api/media busca, filtra y cuenta sobre TODA la galería) y la página (src/studio.js:
// lo que la página ya tiene y cambia a mano —una estrella, una carpeta— se vuelve a filtrar igual, sin esperar al servidor).
// Funciones puras, probadas en tests/media-pagina.test.mjs.

/** Los filtros de la galería (las pestañas del Estudio). */
export const FILTERS = ['all', 'fav', 'you', 'agent', 'video', 'up', 'voice', 'music'];
export const fromBots = it => it.by === 'agent' || it.by === 'dimitri';
/** voz o música (MiniMax), o null: igual que src/studio-voz.js soundOf */
export const soundOf = it => (it && it.kind === 'audio' ? (it.wanted === 'music' ? 'music' : 'voice') : null);
export const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** ¿La ficha pasa el filtro de pestaña? */
export function passFilter(f, it) {
  switch (f || 'all') {
    case 'fav': return !!it.fav;
    case 'agent': return fromBots(it);
    case 'you': return !fromBots(it) && !it.upload;
    case 'video': return it.kind === 'video' || it.wanted === 'video';
    case 'up': return !!it.upload;
    case 'voice': case 'music': return soundOf(it) === f;
    default: return true;
  }
}
/** La carpeta de verdad de una ficha (una carpeta borrada fuera ya no cuenta), o null. */
export const folderIn = (it, ids) => (it.folder && ids.has(it.folder) ? it.folder : null);
/** ¿Entra en la carpeta elegida? 'all' · 'none' (sin carpeta) · un id */
export function passFolder(folder, it, ids) {
  if (!folder || folder === 'all') return true;
  const f = folderIn(it, ids); return folder === 'none' ? !f : f === folder;
}
/** Las palabras de una búsqueda: todas deben estar (sin mayúsculas ni acentos). */
export const words = q => fold(q).split(/\s+/).filter(Boolean);
/** El texto en el que se busca una ficha. `extra(it)` añade lo que solo sabe quien llama (el nombre del agente, el título de la tarea). */
const HS = new WeakMap(); // the folded text of a record, worked out once (the index keeps the same objects until one changes)
export function haystack(it, extra) {
  let h = HS.get(it); if (h === undefined) { h = fold(`${it.prompt || ''} ${it.name || ''} ${it.modelName || it.model || ''} ${it.file || ''} ${it.agent || ''} ${it.taskTitle || ''}`); HS.set(it, h); }
  const x = extra ? extra(it) : ''; return x && x.trim() ? h + ' ' + fold(x) : h;
}
export function passQuery(ws, it, extra) { if (!ws.length) return true; const h = haystack(it, extra); return ws.every(w => h.includes(w)); }
/** Clases de archivo admitidas por `kind` (image, video, audio); vacío = todas */
export const passKind = (kinds, it) => !kinds || !kinds.length || kinds.includes(it.kind || 'image');

/** Un predicado con todo lo de una vista: { filter, folder, q, kind } */
export function matcher({ filter = 'all', folder = 'all', q = '', kind = null } = {}, folderIds = new Set(), extra) {
  const ws = words(q), kinds = Array.isArray(kind) ? kind : kind ? String(kind).split(',').filter(Boolean) : null;
  return it => passKind(kinds, it) && passFolder(folder, it, folderIds) && passFilter(filter, it) && passQuery(ws, it, extra);
}
/** Los recuentos de las pestañas y de «Sin carpeta», sobre lo que se le pase (la galería entera). */
export function counts(items, folderIds = new Set()) {
  const c = { all: 0, fav: 0, you: 0, agent: 0, video: 0, up: 0, voice: 0, music: 0, none: 0 };
  for (const it of items) {
    c.all++; if (it.fav) c.fav++;
    const bot = fromBots(it); if (bot) c.agent++; else if (!it.upload) c.you++;
    if (it.kind === 'video' || it.wanted === 'video') c.video++;
    if (it.upload) c.up++;
    const s = soundOf(it); if (s) c[s]++;
    if (!folderIn(it, folderIds)) c.none++;
  }
  return c;
}
/** El orden de la galería: lo más nuevo primero y, a igual hora, por nombre (estable: el cursor no salta ni repite). */
export const cmp = (a, b) => (b.at || 0) - (a.at || 0) || (a.file < b.file ? 1 : a.file > b.file ? -1 : 0);
/** El cursor de «después de esta ficha»: su hora y su archivo. */
export const cursorOf = it => `${it.at || 0}|${it.file}`;
export function parseCursor(s) { const m = /^(\d{1,16})\|(.+)$/.exec(String(s || '')); return m ? { at: +m[1], file: m[2] } : null; }
/** Número con puntos de miles, como lo lee el dueño: 3412 → «3.412» */
export const miles = n => String(Math.max(0, Math.round(+n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

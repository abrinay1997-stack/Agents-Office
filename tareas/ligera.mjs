// La lista ligera de tareas (la que pide el sondeo cada 6 s): pura, para que la usen http-json.mjs y el Worker de Cloudflare.
export const LIGHT_KEEP = ['id', 'archived', 'archivedAt', 'agent', 'dept', 'state', 'title', 'addedAt', 'doneAt'];
/** The poll's list: an archived task keeps only what the page reads from it (its id and when it was archived). */
export function lightTasks(list) {
  return (Array.isArray(list) ? list : []).map(t => t && t.archived ? Object.fromEntries(LIGHT_KEEP.filter(k => k in t).map(k => [k, t[k]])) : t);
}

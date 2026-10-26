// Versión móvil (26 oct 2026) — CARPETAS del Estudio en el teléfono. Pedido del dueño: «que en la versión móvil pueda crear carpetas en el estudio y organizar
// imágenes fácilmente, como en la de escritorio». Aquí vive todo lo que toca una carpeta: el nombre (crear y renombrar), elegir a cuál mover, mover con
// DESHACER y eliminar. Una carpeta es una etiqueta de la ficha (el archivo no se mueve de sitio: los enlaces de las entregas siguen valiendo), así que
// mover y deshacer son baratos. Las rutas son las de escritorio: POST /api/media/folders · PATCH|DELETE /api/media/folders/<id> · POST /api/media/move.
// Las reglas del nombre (vacío, repetido, 60 letras, 200 carpetas) están en estudio-puro.js y las repite el servidor.
import { esc } from '../ui.js';
import { ic } from '../b-comun.js';
import { limpiarNombreCarpeta, errorNombreCarpeta, carpetaDeFicha, origenes, textoMovida } from '../estudio-puro.js';

/** Espera a que una hoja que se está cerrando se haya ido de verdad (cerrar es asíncrono: sale por el historial). Dos hojas que cambian a la vez se pisan. */
export const esperarHoja = (h, ms = 1500) => new Promise(r => { const t0 = Date.now(); (function ver() { if (!h.capa || !h.capa.isConnected || Date.now() - t0 > ms) setTimeout(r, 40); else setTimeout(ver, 40); })(); });
const nombreDe = (E, id) => (E.folders.find(f => f.id === id) || {}).name || '';

/** La hoja del nombre de una carpeta (nueva o renombrada). → Promise<string|null>: el nombre ya limpio, o null si la cierra. */
export function pedirNombre(ctx, E, { titulo, valor = '', ok = 'Guardar', exceptoId = null, ayuda = '' }) {
  return new Promise(res => {
    let hecho = false; const fin = v => { if (!hecho) { hecho = true; res(v); } };
    const h = ctx.hoja({ titulo, alCerrar: () => fin(null),
      cuerpo: `<label class="mv-lab" for="mvCN">Nombre de la carpeta</label><input id="mvCN" class="mv-campo" type="text" maxlength="60" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" value="${esc(valor)}" placeholder="Navidad, Fotos de producto…" aria-describedby="mvCNe">${ayuda ? `<p class="mv-meta">${esc(ayuda)}</p>` : ''}<p class="mv-err" id="mvCNe" role="alert" hidden></p>`,
      acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: ok, tipo: 'primario', alTocar: () => enviar() }] });
    const campo = h.cuerpo.querySelector('#mvCN'), err = h.cuerpo.querySelector('#mvCNe');
    function enviar() {
      const n = limpiarNombreCarpeta(campo.value), mal = errorNombreCarpeta(n, E.folders, exceptoId);
      if (mal) { err.hidden = false; err.textContent = mal; campo.setAttribute('aria-invalid', 'true'); campo.focus(); return; }
      fin(n); h.cerrar();
    }
    campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
    campo.addEventListener('input', () => { err.hidden = true; campo.removeAttribute('aria-invalid'); });
    setTimeout(() => { campo.focus(); campo.setSelectionRange(campo.value.length, campo.value.length); }, 120);
  });
}

/** La hoja «Mover a…»: Sin carpeta, cada carpeta con cuántas tiene y «+ Nueva carpeta…». `actual`: la carpeta (id), null (sin carpeta) o undefined (varias).
 *  → Promise<{ carpeta: id|null } | { nueva: nombre } | null> */
export function elegirCarpeta(ctx, E, { titulo = 'Mover a una carpeta', actual } = {}) {
  return new Promise(res => {
    let hecho = false, pasando = false; const fin = v => { if (!hecho) { hecho = true; res(v); } };
    const fila = (v, t, sub, activo, ico = 'carpeta') => `<li><button type="button" class="mv-lista-b" data-c="${esc(v)}" aria-pressed="${!!activo}">${ic(ico, 'mv-lista-i')}<span><b>${esc(t)}${activo ? ' ✓' : ''}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button></li>`;
    const h = ctx.hoja({ titulo, alCerrar: () => { if (!pasando) fin(null); },
      cuerpo: `<ul class="mv-lista">${fila('+nueva', 'Nueva carpeta…', 'Le pones nombre y se guardan ahí', false, 'mas_c')}${fila('', 'Sin carpeta', 'Sale de su carpeta; no se borra nada', actual === null)}${E.folders.map(f => fila('c:' + f.id, f.name, `${f.n ?? 0} ${f.n === 1 ? 'archivo' : 'archivos'}`, actual === f.id)).join('')}</ul>` });
    h.cuerpo.addEventListener('click', async e => {
      const b = e.target.closest('[data-c]'); if (!b) return; const v = b.dataset.c;
      if (v === '+nueva') { // una hoja a la vez: esta se cierra y, cuando ya se fue, se pide el nombre (dos hojas cerrándose a la vez se pisan en el historial)
        pasando = true; h.cerrar(); await esperarHoja(h);
        const n = await pedirNombre(ctx, E, { titulo: 'Nueva carpeta', ok: 'Crear y mover' }); fin(n ? { nueva: n } : null); return;
      }
      fin({ carpeta: v ? v.slice(2) : null }); h.cerrar();
    });
  });
}

/** Mueve archivos a una carpeta (o a ninguna: `destino.carpeta === null`) o a una nueva (`destino.nueva`), actualiza las fichas y avisa con DESHACER.
 *  → Promise<boolean>. `alCambiar` se llama cuando la galería debe volver a pedirse (el filtro de carpeta puede dejar de verlos). */
export async function mover(ctx, E, files, destino, { alCambiar = () => {} } = {}) {
  if (!files.length) return false;
  const antes = origenes(E.items, files, E.folders);
  try {
    let id = destino.carpeta ?? null;
    if (destino.nueva) { const r = await ctx.api('/api/media/folders', { method: 'POST', body: { name: destino.nueva, files } }); E.folders = r.folders || E.folders; id = r.folder.id; }
    else { const r = await ctx.api('/api/media/move', { method: 'POST', body: { files, folder: id } }); E.folders = r.folders || E.folders; }
    for (const it of E.items) if (files.includes(it.file)) it.folder = id;
    ctx.toast(textoMovida(files.length, id ? { name: nombreDe(E, id) } : null), { accion: 'Deshacer', alAccion: async () => {
      try {
        for (const [prev, fs] of antes) { const r = await ctx.api('/api/media/move', { method: 'POST', body: { files: fs, folder: prev } }); E.folders = r.folders || E.folders; for (const it of E.items) if (fs.includes(it.file)) it.folder = prev; }
        ctx.toast('Deshecho.');
      } catch (er) { ctx.toast('No se pudo deshacer: ' + er.message); }
      alCambiar();
    } });
    alCambiar(); dispatchEvent(new Event('ao:media-changed'));
    return true;
  } catch (er) { ctx.toast('No se pudo mover: ' + er.message, { accion: 'Reintentar', alAccion: () => mover(ctx, E, files, destino, { alCambiar }) }); return false; }
}

/** «+ Nueva carpeta»: pide el nombre y la crea (con los archivos elegidos dentro, si los hay). → la carpeta creada o null */
export async function crear(ctx, E, { files = [], alCambiar = () => {} } = {}) {
  const n = await pedirNombre(ctx, E, { titulo: 'Nueva carpeta', ok: files.length ? 'Crear y mover' : 'Crear', ayuda: files.length ? `Se guardan ahí los ${files.length} archivos que elegiste.` : 'Después puedes mover imágenes con «Seleccionar» o desde cada imagen.' });
  if (!n) return null;
  try {
    const r = await ctx.api('/api/media/folders', { method: 'POST', body: { name: n, ...(files.length ? { files } : {}) } });
    E.folders = r.folders || [...E.folders, r.folder]; for (const it of E.items) if (files.includes(it.file)) it.folder = r.folder.id;
    ctx.toast(files.length ? `Carpeta «${r.folder.name}» creada con ${files.length} ${files.length === 1 ? 'archivo' : 'archivos'}.` : `Carpeta «${r.folder.name}» creada.`);
    alCambiar(r.folder); dispatchEvent(new Event('ao:media-changed')); return r.folder;
  } catch (er) { ctx.toast('No se pudo crear: ' + er.message); return null; }
}

/** Renombrar la carpeta `id`. → true si cambió */
export async function renombrar(ctx, E, id, { alCambiar = () => {} } = {}) {
  const f = E.folders.find(x => x.id === id); if (!f) return false;
  const n = await pedirNombre(ctx, E, { titulo: 'Renombrar la carpeta', valor: f.name, ok: 'Guardar', exceptoId: id }); if (!n || n === f.name) return false;
  try { const r = await ctx.api(`/api/media/folders/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name: n } }); E.folders = r.folders || E.folders; ctx.toast(`Ahora se llama «${r.folder.name}».`); alCambiar(); return true; }
  catch (er) { ctx.toast('No se pudo renombrar: ' + er.message); return false; }
}

/** Eliminar la carpeta `id`: sus archivos se quedan, sin carpeta. DESHACER la vuelve a crear y devuelve los archivos. → true si se eliminó */
export async function eliminar(ctx, E, id, { alCambiar = () => {} } = {}) {
  const f = E.folders.find(x => x.id === id); if (!f) return false;
  const n = f.n ?? E.items.filter(i => i.folder === id).length;
  if (!(await ctx.confirmar({ titulo: `¿Eliminar «${f.name}»?`, texto: n ? `Sus ${n} ${n === 1 ? 'archivo se queda' : 'archivos se quedan'} en el Estudio, sin carpeta. No se borra ninguna imagen.` : 'Está vacía. No se borra ninguna imagen.', ok: 'Eliminar la carpeta', cancelar: 'Conservarla', peligro: true }))) return false;
  const dentro = E.items.filter(i => i.folder === id).map(i => i.file);
  try {
    let todos = dentro;
    // lo que tiene en la galería entera (no solo lo cargado): para poder deshacer, se pide antes de borrar
    try { const j = await ctx.api('/api/media?n=2000&folder=' + encodeURIComponent(id)); todos = (j.items || []).map(i => i.file); } catch { /* con lo cargado basta */ }
    const r = await ctx.api(`/api/media/folders/${encodeURIComponent(id)}`, { method: 'DELETE' }); E.folders = r.folders || E.folders.filter(x => x.id !== id);
    for (const it of E.items) if (it.folder === id) it.folder = null;
    ctx.toast(`Carpeta «${f.name}» eliminada.`, { accion: 'Deshacer', alAccion: async () => {
      try { const c = await ctx.api('/api/media/folders', { method: 'POST', body: { name: f.name, files: todos } }); E.folders = c.folders || E.folders; for (const it of E.items) if (todos.includes(it.file)) it.folder = c.folder.id; ctx.toast(`Carpeta «${f.name}» de vuelta.`); }
      catch (er) { ctx.toast('No se pudo deshacer: ' + er.message); }
      alCambiar();
    } });
    alCambiar(); dispatchEvent(new Event('ao:media-changed')); return true;
  } catch (er) { ctx.toast('No se pudo eliminar: ' + er.message); return false; }
}

export { carpetaDeFicha };

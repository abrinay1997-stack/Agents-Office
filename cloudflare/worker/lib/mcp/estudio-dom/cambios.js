// Lo que `galeria_cambiar` hace en el Estudio: ordenar (carpetas, mover) y la papelera, SIEMPRE reversible y sin gastar. Cada acción recibe la `office` YA restringida (solo las rutas exactas que usa) y devuelve el texto.
// DESHACER: mover, renombrar y mandar a la papelera apuntan cómo volver atrás en `docs` (`mcp.undo:est-<clave>`, 10 minutos, solo de quien lo hizo; la poda diaria de mantenimiento.js los barre por rango de clave).
// Lo que NO se sirve (en datos, con motivo; el test lo vigila): borrar carpetas, vaciar o purgar la papelera, subir, editar, generar, variar, animar y todo lo que llama a un motor.
import { guardarDoc, leerDoc } from '../../almacen.js';
import { testigo as claveAlAzar } from '../../ids.js';
import { clip, rutaDeArchivo, ID_CARPETA } from './comun.js';

export const PREFIJO_UNDO_EST = 'mcp.undo:est-';
export const DESHACER_MS = 10 * 60e3;
export const MAX_ARCHIVOS = 12; // pocas lecturas y escrituras por llamada (límite de consultas de D1 por invocación)
export const ACCIONES_CAMBIAR = Object.freeze(['carpeta_crear', 'carpeta_renombrar', 'mover', 'papelera_mandar', 'papelera_restaurar', 'deshacer']);
export const EXCLUSIONES = Object.freeze({
  generar: 'POST /api/media/jobs, /generate, /edit y /enhance: gastan en un motor de imágenes o video. El clic GENERAR y la confirmación desde US$0,50 son de una persona en el Estudio.',
  generar_con_preset: 'POST /api/media/presets/apply: es el clic GENERAR del banco; gasta. Por MCP solo se prepara el costo (capa1: aplicar_preset).',
  lotes_iniciar: 'POST/PATCH /api/media/lotes y /filas: crear, probar, iniciar, aprobar o reintentar un lote gasta; los pone a trabajar una persona.',
  trabajos_cancelar_reintentar: 'POST /api/media/jobs/<id>/retry y /cancel: reintentar vuelve a gastar y cancelar en un motor de pago puede cobrarse igual.',
  voces_nuevas: 'POST /api/voces/design y /clone: diseñar (~US$3) o clonar (~US$1,5) una voz cuesta; DELETE /api/voces/<id> borra una voz en el proveedor.',
  subir: 'POST /api/media/upload y PUT /api/media/archivo/<clave>: suben bytes (y la migración es de un administrador con la computadora).',
  papelera_vaciar: 'POST /api/media/trash/purge: «Vaciar la papelera» y «Borrar para siempre» no se pueden deshacer.',
  carpeta_borrar: 'DELETE /api/media/folders/<id> y /deshacer: borrar una carpeta manda sus archivos a la papelera; se hace en la oficina.',
  carpeta_reordenar: 'PATCH /api/media/folders/reorder: solo cambia el orden visual; se hace en la oficina.',
  presets_guardar: 'POST/DELETE /api/media/presets: guardar o borrar un preset propio (una nota) es del Cerebro y de la oficina; aquí solo se leen.',
  limites_cambiar: 'PUT /api/media/limites: los topes del Estudio son del dueño y se cambian en la oficina (nunca desde un asistente).',
  descargas: 'GET /api/media/zip, /trash/file y /lotes/<id>/zip|csv: devuelven bytes; el servidor remoto solo manda texto.',
  anotar_usado: 'PATCH /api/media/item/<id>: marcar favorita o «usada» enseña a la memoria de la oficina; lo hace la persona.',
});

/** Un tramo de entrada: texto no vacío y corto. */
const texto = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

/** Apunta cómo deshacer y devuelve la clave (o null si no se pudo guardar: el efecto ya ocurrió y la llamada no falla por eso). */
async function apuntarDeshacer(ctx, que) {
  const clave = claveAlAzar(9);
  try { await guardarDoc(ctx.db, PREFIJO_UNDO_EST + clave, { ...que, at: ctx.ahoraMs, por: ctx.usuario.id }); return clave; }
  catch (e) { console.warn('[mcp:estudio] no se pudo guardar la clave de deshacer:', e?.message ?? e); return null; }
}
const pieDeshacer = (clave) => (clave ? `\nPara deshacerlo (10 minutos): galeria_cambiar con accion «deshacer» y deshacer «${clave}».` : '\nSe hizo, pero no pude guardar la clave para deshacerlo: se corrige con otra acción.');

/** → { permitidas, hacer(office) }: lo que esa acción puede pedir y cómo lo hace. null si los argumentos no valen (con `error`). */
export function preparar(accion, a, ctx) {
  if (accion === 'carpeta_crear') {
    const nombre = texto(a.nombre, 60); if (!nombre) return { error: 'Falta «nombre» (hasta 60 letras).' };
    return { permitidas: ['POST /api/media/folders'], async hacer(office) {
      const r = await office('/api/media/folders', { name: nombre });
      return `Carpeta creada: ${r.folder?.id} · «${clip(r.folder?.name, 60)}». Para mover archivos: accion «mover» con carpeta «${r.folder?.id}». Borrar una carpeta se hace en la oficina.`;
    } };
  }
  if (accion === 'carpeta_renombrar') {
    const id = String(a.carpeta || ''), nombre = texto(a.nombre, 60);
    if (!ID_CARPETA.test(id) || !nombre) return { error: 'Falta «carpeta» (su id, de la acción carpetas) y «nombre» (hasta 60 letras).' };
    return { permitidas: ['GET', `PATCH /api/media/folders/${id}`], async hacer(office) {
      const antes = ((await office('/api/media?n=1')).folders || []).find((f) => f.id === id);
      if (!antes) throw new Error('esa carpeta no existe');
      await office(`/api/media/folders/${id}`, { name: nombre }, 'PATCH');
      const clave = await apuntarDeshacer(ctx, { t: 'renombrar', id, nombre: antes.name });
      return `Carpeta ${id}: «${clip(antes.name, 60)}» → «${clip(nombre, 60)}».${pieDeshacer(clave)}`;
    } };
  }
  if (accion === 'mover') {
    const archivos = Array.isArray(a.archivos) ? [...new Set(a.archivos.filter((x) => typeof x === 'string'))] : [];
    if (!archivos.length || archivos.length > MAX_ARCHIVOS) return { error: `Falta «archivos»: de 1 a ${MAX_ARCHIVOS} ids de la galería.` };
    if (archivos.some((x) => !rutaDeArchivo(x))) return { error: 'Alguno de los ids de archivo no vale.' };
    const destino = a.carpeta === null || a.carpeta === undefined || a.carpeta === '' ? null : String(a.carpeta);
    if (destino !== null && !ID_CARPETA.test(destino)) return { error: '«carpeta» es el id de una carpeta (c…) o null para «sin carpeta».' };
    return { permitidas: ['GET', 'POST /api/media/move'], async hacer(office) {
      const grupos = new Map(); // carpeta de la que salen → archivos (para poder devolverlos a donde estaban)
      for (const f of archivos) { const it = await office(`/api/media/item/${rutaDeArchivo(f)}`); const k = it.folder || ''; grupos.set(k, [...(grupos.get(k) || []), it.file]); }
      const r = await office('/api/media/move', { files: archivos, folder: destino });
      const clave = await apuntarDeshacer(ctx, { t: 'mover', grupos: [...grupos].map(([de, files]) => ({ de: de || null, files })) });
      return `Movidos ${r.moved} de ${archivos.length} archivos a ${destino ? `la carpeta ${destino}` : '«sin carpeta»'}. Nada se borró: solo cambian de carpeta.${pieDeshacer(clave)}`;
    } };
  }
  if (accion === 'papelera_mandar') {
    const f = String(a.archivo || ''), ruta = rutaDeArchivo(f);
    if (!ruta) return { error: 'Falta «archivo»: el id de la galería («2031-01/nombre.png»).' };
    return { permitidas: [`DELETE /api/media/item/${ruta}`], async hacer(office) {
      const r = await office(`/api/media/item/${ruta}`, undefined, 'DELETE'); // el servidor se niega si una pieza de Contenido lo usa
      const clave = r.undo ? await apuntarDeshacer(ctx, { t: 'papelera', undo: r.undo }) : null;
      return `«${clip(f, 120)}» está en la papelera del Estudio (30 días: no se borró). También se recupera con la acción papelera_restaurar.${pieDeshacer(clave)}`;
    } };
  }
  if (accion === 'papelera_restaurar') {
    const f = String(a.archivo || ''); if (!rutaDeArchivo(f)) return { error: 'Falta «archivo»: el id de un archivo de la papelera (la acción papelera de «galeria» los lista).' };
    return { permitidas: ['GET /api/media/trash', 'POST /api/media/restore'], async hacer(office) {
      const x = ((await office('/api/media/trash')).items || []).find((i) => i.id === f);
      if (!x) throw new Error('ese archivo no está en la papelera (¿ya se recuperó o pasaron los 30 días?)');
      await office('/api/media/restore', { id: x.id, bin: x.bin });
      return `«${clip(f, 120)}» volvió a la galería.`;
    } };
  }
  return { error: 'acción desconocida' };
}

/** DESHACER: reclama la clave (borrar la fila es atómico: dos llamadas no deshacen dos veces) y, si falla, la repone. */
export async function deshacer(ctx, clave) {
  const k = String(clave || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const vencida = 'Esa clave ya no sirve: pasaron más de 10 minutos, ya se deshizo o no es tuya. Corrígelo con otra acción.';
  const { valor } = k ? await leerDoc(ctx.db, PREFIJO_UNDO_EST + k) : { valor: null };
  if (!valor || ctx.ahoraMs - (valor.at || 0) > DESHACER_MS || valor.por !== ctx.usuario.id) return { texto: vencida, esError: true };
  const r = await ctx.db.prepare('delete from docs where clave = ?').bind(PREFIJO_UNDO_EST + k).run();
  if (!r.meta?.changes) return { texto: vencida, esError: true };
  const reponer = async () => { try { await guardarDoc(ctx.db, PREFIJO_UNDO_EST + k, valor, { espera: 0 }); } catch { /* ya hay otra */ } };
  const { conOficina } = await import('./comun.js');
  try {
    if (valor.t === 'renombrar') { const o = await conOficina(ctx, [`PATCH /api/media/folders/${valor.id}`]); await o(`/api/media/folders/${valor.id}`, { name: valor.nombre }, 'PATCH'); return { texto: `Deshecho: la carpeta ${valor.id} vuelve a llamarse «${clip(valor.nombre, 60)}».` }; }
    if (valor.t === 'mover') {
      const o = await conOficina(ctx, ['POST /api/media/move']); let n = 0;
      for (const g of valor.grupos || []) n += (await o('/api/media/move', { files: g.files, folder: g.de })).moved || 0;
      return { texto: `Deshecho: ${n} archivos volvieron a su carpeta de antes.` };
    }
    if (valor.t === 'papelera') {
      const o = await conOficina(ctx, ['POST /api/media/restore']); await o('/api/media/restore', valor.undo);
      return { texto: `Deshecho: «${clip(valor.undo?.id, 120)}» volvió a la galería.` };
    }
  } catch (e) { await reponer(); throw e; }
  await reponer();
  return { texto: 'Esa clave no es de una acción que se pueda deshacer.', esError: true };
}

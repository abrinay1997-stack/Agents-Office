// La conversación de Dimitri en D1 (en la oficina local es data/subgerente.json). Cada mensaje es UNA fila de `filas('subgerente')`: un plan, unas tarjetas de ops o unos
// creativos pueden pesar decenas de KB y D1 corta la fila a 2 MB; con una fila por mensaje cambiar uno (marcar una pieza como enviada) no reescribe ni pisa los demás.
// «Nueva conversación» NO borra: mueve las filas a `subgerente-arch:<id>` (se guardan las últimas 50) y DESHACER las devuelve.
import { leerDoc, mutarDoc } from '../almacen.js';
import { MAX, ARCHIVO_MAX, tituloConversacion } from '../../../../sub-core.mjs';

export const COL = 'subgerente';
export const DOC_ARCHIVO = 'subgerente.archivo';
const iso = (t) => new Date(t).toISOString();

let semilla = 0; // dos mensajes en el mismo milisegundo (el del dueño y la respuesta) conservan su orden
const ordenNuevo = (at) => at + ((semilla = (semilla + 1) % 1000) / 1000);

export async function cargar(db, { limite = MAX } = {}) {
  const { results } = await db.prepare('select json from filas where coleccion = ? order by orden desc limit ?').bind(COL, limite).all();
  const messages = [];
  for (const r of results.reverse()) { try { messages.push(JSON.parse(r.json)); } catch { /* un mensaje roto no tumba el chat */ } }
  return { messages };
}
export async function mensaje(db, id) {
  const f = await db.prepare('select json from filas where coleccion = ? and id = ?').bind(COL, String(id)).first();
  if (!f) return null;
  try { return JSON.parse(f.json); } catch { return null; }
}
/** Añade mensajes al final y recorta a los últimos MAX. */
export async function anexar(db, ...ms) {
  const lista = ms.flat().filter(Boolean);
  if (!lista.length) return;
  await db.batch(lista.map((m) => db.prepare('insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?) on conflict (coleccion, id) do update set json = excluded.json').bind(COL, String(m.id), JSON.stringify(m), ordenNuevo(m.at || Date.now()), iso(Date.now()))));
  await recortar(db);
}
/** Cambia un mensaje que ya está (conserva su sitio). Si ya no está, no hace nada (devuelve false). */
export async function reemplazar(db, m) {
  const r = await db.prepare('update filas set json = ?, actualizado = ? where coleccion = ? and id = ?').bind(JSON.stringify(m), iso(Date.now()), COL, String(m.id)).run();
  return !!r.meta?.changes;
}
export async function recortar(db) {
  const f = await db.prepare('select count(*) n from filas where coleccion = ?').bind(COL).first();
  const sobran = (f?.n || 0) - MAX;
  if (sobran > 0) await db.prepare('delete from filas where coleccion = ? and id in (select id from filas where coleccion = ? order by orden asc limit ?)').bind(COL, COL, sobran).run();
}

/** «Nueva conversación»: archiva (las últimas 50) y deja el chat vacío. → el id del archivo, o null si no había nada. */
export async function archivar(db) {
  const f = await db.prepare('select count(*) n from filas where coleccion = ?').bind(COL).first();
  if (!f?.n) return null;
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), titulo = tituloConversacion((await cargar(db)).messages);
  await db.prepare('update filas set coleccion = ? where coleccion = ?').bind('subgerente-arch:' + id, COL).run();
  let fuera = [];
  await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => { const l = [...(d.lista || []), { id, at: Date.now(), n: f.n, titulo }]; fuera = l.slice(0, Math.max(0, l.length - ARCHIVO_MAX)); return { lista: l.slice(-ARCHIVO_MAX) }; });
  for (const x of fuera) await db.prepare('delete from filas where coleccion = ?').bind('subgerente-arch:' + x.id).run();
  return id;
}
/** Trae de vuelta una conversación archivada (la que se acaba de archivar, por su id): lo dicho después de archivar se queda detrás. */
export async function restaurar(db, id) {
  if (!/^c[a-z0-9]{3,24}$/.test(String(id || ''))) return false;
  const lista = (await leerDoc(db, DOC_ARCHIVO, { lista: [] })).valor.lista || [];
  if (!lista.some((x) => x.id === id)) return false;
  await db.prepare('update filas set coleccion = ? where coleccion = ?').bind(COL, 'subgerente-arch:' + id).run();
  await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => ({ lista: (d.lista || []).filter((x) => x.id !== id) }));
  await recortar(db);
  return true;
}

/**
 * Cambia un mensaje SOLO si nadie más lo cambió entre leerlo y escribirlo (compare-and-swap sobre el texto de la fila). `cambiar(m)` lo modifica y devuelve false para no tocar nada.
 * → el mensaje ya cambiado, o null si no existe, `cambiar` dijo que no, o perdió contra otra petición (que ya lo hizo).
 */
export async function reclamar(db, id, cambiar) {
  const f = await db.prepare('select json from filas where coleccion = ? and id = ?').bind(COL, String(id)).first();
  if (!f) return null;
  let m; try { m = JSON.parse(f.json); } catch { return null; }
  if (cambiar(m) === false) return null;
  const r = await db.prepare('update filas set json = ?, actualizado = ? where coleccion = ? and id = ? and json = ?').bind(JSON.stringify(m), iso(Date.now()), COL, String(id), f.json).run();
  return r.meta?.changes ? m : null;
}

const ID = /^c[a-z0-9]{3,24}$/;
const mensajesDe = async (db, id) => { const { results } = await db.prepare('select json from filas where coleccion = ? order by orden asc').bind('subgerente-arch:' + id).all(); const out = []; for (const r of results) { try { out.push(JSON.parse(r.json)); } catch { /* un mensaje roto no tumba el historial */ } } return out; };
/** El historial: la conversación de ahora y las archivadas (la más nueva primero), solo con lo que hace falta para elegir. */
export async function listar(db) {
  const { messages } = await cargar(db), lista = (await leerDoc(db, DOC_ARCHIVO, { lista: [] })).valor.lista || [];
  return { actual: messages.length ? { n: messages.length, titulo: tituloConversacion(messages), at: messages[messages.length - 1].at || 0 } : null, lista: lista.map((x) => ({ id: x.id, at: x.at, n: x.n, titulo: x.titulo || 'Sin título' })).reverse() };
}
/** Una archivada para leerla (sin abrirla). */
export async function ver(db, id) {
  if (!ID.test(String(id || ''))) return null;
  const x = ((await leerDoc(db, DOC_ARCHIVO, { lista: [] })).valor.lista || []).find((y) => y.id === id);
  return x ? { id, at: x.at, titulo: x.titulo || 'Sin título', messages: await mensajesDe(db, id) } : null;
}
/** Abre una archivada como la conversación de ahora; la de ahora (si había algo) pasa al archivo. → { messages, archived } o null. */
export async function abrir(db, id) {
  if (!ID.test(String(id || ''))) return null;
  const lista = (await leerDoc(db, DOC_ARCHIVO, { lista: [] })).valor.lista || [];
  if (!lista.some((x) => x.id === id)) return null;
  await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => ({ lista: (d.lista || []).filter((x) => x.id !== id) })); // primero se saca del archivo: así archivar la de ahora no la recorta ni la pisa
  const archived = await archivar(db);
  await db.prepare('update filas set coleccion = ? where coleccion = ?').bind(COL, 'subgerente-arch:' + id).run();
  return { ...(await cargar(db)), archived };
}
/** Borra una archivada para siempre. */
export async function borrar(db, id) {
  if (!ID.test(String(id || ''))) return false;
  let estaba = false;
  await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => { estaba = (d.lista || []).some((x) => x.id === id); return { lista: (d.lista || []).filter((x) => x.id !== id) }; });
  if (estaba) await db.prepare('delete from filas where coleccion = ?').bind('subgerente-arch:' + id).run();
  return estaba;
}

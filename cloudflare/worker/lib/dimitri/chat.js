// La conversación de Dimitri en D1 (en la oficina local es data/subgerente.json). Cada mensaje es UNA fila de `filas('subgerente')`: un plan, unas tarjetas de ops o unos
// creativos pueden pesar decenas de KB y D1 corta la fila a 2 MB; con una fila por mensaje cambiar uno (marcar una pieza como enviada) no reescribe ni pisa los demás.
// «Nueva conversación» NO borra: mueve las filas a `subgerente-arch:<id>` (se guardan las últimas 10) y DESHACER las devuelve.
import { leerDoc, mutarDoc } from '../almacen.js';
import { MAX } from '../../../../sub-core.mjs';

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

/** «Nueva conversación»: archiva (las últimas 10) y deja el chat vacío. → el id del archivo, o null si no había nada. */
export async function archivar(db) {
  const f = await db.prepare('select count(*) n from filas where coleccion = ?').bind(COL).first();
  if (!f?.n) return null;
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  await db.prepare('update filas set coleccion = ? where coleccion = ?').bind('subgerente-arch:' + id, COL).run();
  let fuera = [];
  await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => { const l = [...(d.lista || []), { id, at: Date.now(), n: f.n }]; fuera = l.slice(0, Math.max(0, l.length - 10)); return { lista: l.slice(-10) }; });
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

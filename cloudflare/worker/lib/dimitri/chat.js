// La conversación de Dimitri en D1 (en la oficina local es data/subgerente.json). Cada mensaje es UNA fila de `filas`: un plan, unas tarjetas de ops o unos
// creativos pueden pesar decenas de KB y D1 corta la fila a 2 MB; con una fila por mensaje cambiar uno (marcar una pieza como enviada) no reescribe ni pisa los demás.
// «Nueva conversación» NO borra: mueve las filas a `subgerente-arch:<cuenta>:<id>` (se guardan las últimas 50) y DESHACER las devuelve.
// CADA CUENTA TIENE SU PROPIA SALA (27 oct 2026, pedido del dueño: «que Avalon no vea lo que hablo con Dimitri»): los mensajes viven en `subgerente:<id de la cuenta>`, el resumen de la sesión en
// `subgerente-hilo` con id `actual:<id>`, y la lista de archivadas en el documento `subgerente.archivo:<id>`. Nadie lee la sala de otro: todo cuelga de `sala(db, uid)`. Lo que había antes
// (la conversación común) la migración 0101 se la dio a la cuenta de administrador más antigua, que es la del dueño.
import { leerDoc, mutarDoc, leerFila, guardarFila } from '../almacen.js';
import { leerCfg } from '../ajustes.js';
import { MAX, ARCHIVO_MAX, tituloConversacion, plegarHilo } from '../../../../sub-core.mjs';

export const PREFIJO_SALA = 'subgerente:';
export const PREFIJO_DOC_ARCHIVO = 'subgerente.archivo:';
// Sesiones largas: lo que se cae por el final de la conversación (más de MAX mensajes) no se pierde, se PLIEGA en un resumen pequeño (sub-core.mjs → plegarHilo) que vive
// en una fila aparte de la MISMA conversación: `actual:<cuenta>` mientras es la de ahora, y el id del archivo cuando se archiva (viaja con ella al archivar, abrir y restaurar).
export const COL_HILO = 'subgerente-hilo', PREFIJO_HILO = 'actual:', PREFIJO_HILO_ARCH = 'arch:';
export const PREFIJO_ARCH = 'subgerente-arch:'; // + <cuenta>:<id de la conversación>: las archivadas llevan SU cuenta en el nombre (revisión de Codex: un id ajeno metido en tu lista no abre la conversación de otro)
export const HOLGURA = 10; // se recorta cuando sobran más de 10 (y se deja en MAX): plegar cuesta unas consultas y no hace falta pagarlas en cada turno
const iso = (t) => new Date(t).toISOString();

let semilla = 0; // dos mensajes en el mismo milisegundo (el del dueño y la respuesta) conservan su orden
const ordenNuevo = (at) => at + ((semilla = (semilla + 1) % 1000) / 1000);
const ID = /^c[a-z0-9]{3,24}$/;
const limpio = (uid) => { const u = String(uid).replace(/[^\w-]/g, '').slice(0, 64); if (!u) throw new Error('cuenta sin id'); return u; };

/* ---------- de quién es cada sala ---------- */

/** La cuenta del dueño: el administrador más antiguo. Es de quien son la conversación de antes de las salas y lo que escribe el Telegram del dueño del bot. → su id, o null. */
export async function duenoUid(db) {
  const f = await db.prepare("select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1").first();
  return f?.id ? String(f.id) : null;
}

/**
 * La sala de una sesión. Una cuenta de la página: la suya. Por Telegram (`telegram:<id>`): la cuenta a la que se le registró ese id en Ajustes → Telegram y, si es el dueño del bot
 * (TELEGRAM_OWNER_ID, sin cuenta registrada), la del dueño. Nadie más tiene sala: `null` (y quien pregunte contesta 403, nunca la de otro).
 */
export async function uidDe(db, usuario) {
  const id = String(usuario?.id ?? '');
  if (id && id !== 'telegram' && id !== 'oficina') return limpio(id);
  const tg = /^telegram:\s*(\d{4,15})$/.exec(String(usuario?.email ?? ''))?.[1];
  if (!tg) return null;
  const registrado = (await leerCfg(db))?.telegram?.admins?.[tg];
  if (typeof registrado === 'string' && registrado) {
    const u = await db.prepare("select id from users where lower(email) = ? and rol = 'admin'").bind(registrado.toLowerCase()).first();
    return u?.id ? limpio(String(u.id)) : null; // un administrador al que ya se le quitó el permiso no conserva el bot
  }
  const d = await duenoUid(db);
  return d ? limpio(d) : null;
}

/** Los ids de las cuentas que hoy tienen una sala (con `enviados`, solo las que esperan que un trabajo del Estudio termine): para lo que el reloj hace por todas. */
export async function uidsConSala(db, { enviados = false } = {}) {
  const { results } = await db.prepare(`select distinct coleccion from filas where coleccion like ? ${enviados ? "and json like '%\"state\":\"sent\"%'" : ''}`).bind(PREFIJO_SALA + '%').all();
  return results.map((r) => String(r.coleccion).slice(PREFIJO_SALA.length)).filter(Boolean);
}
/** Los administradores de ahora (a cada uno le llega su copia del resumen del lunes). */
export async function uidsAdmins(db) {
  const { results } = await db.prepare("select id from users where rol = 'admin' order by created_at asc, rowid asc").all();
  return results.map((r) => String(r.id));
}
/** Un mensaje por su id, esté en la sala que esté (la segunda mitad del clic de Anuncios no sabe de quién es la tarjeta). → { uid, m } | null */
export async function mensajeEnCualquierSala(db, id) {
  const f = await db.prepare('select coleccion, json from filas where coleccion like ? and id = ?').bind(PREFIJO_SALA + '%', String(id)).first();
  if (!f) return null;
  try { return { uid: String(f.coleccion).slice(PREFIJO_SALA.length), m: JSON.parse(f.json) }; } catch { return null; }
}
/** El mensaje cuya tarjeta de anuncios espera ese token de confirmación (aleatorio y de un solo uso). → { uid, m } | null */
export async function mensajeConToken(db, token) {
  const t = String(token || ''); if (!/^[\w-]{6,80}$/.test(t)) return null;
  const f = await db.prepare('select coleccion, json from filas where coleccion like ? and json like ? limit 1').bind(PREFIJO_SALA + '%', `%"token":"${t}"%`).first();
  if (!f) return null;
  try { return { uid: String(f.coleccion).slice(PREFIJO_SALA.length), m: JSON.parse(f.json) }; } catch { return null; }
}

/** La sala de una cuenta: todo lo que se hace con su conversación (leer, escribir, archivar, historial). */
export function sala(db, uid0) {
  const uid = limpio(uid0), COL = PREFIJO_SALA + uid, HILO = PREFIJO_HILO + uid, DOC_ARCHIVO = PREFIJO_DOC_ARCHIVO + uid;
  const ARCH = (id) => `${PREFIJO_ARCH}${uid}:${id}`, HA = (id) => `${PREFIJO_HILO_ARCH}${uid}:${id}`; // dónde viven los mensajes y el resumen de una conversación archivada DE ESTA cuenta

  async function cargar({ limite = MAX } = {}) {
    const { results } = await db.prepare('select json from filas where coleccion = ? order by orden desc limit ?').bind(COL, limite).all();
    const messages = [];
    for (const r of results.reverse()) { try { messages.push(JSON.parse(r.json)); } catch { /* un mensaje roto no tumba el chat */ } }
    return { messages };
  }
  async function mensaje(id) {
    const f = await db.prepare('select json from filas where coleccion = ? and id = ?').bind(COL, String(id)).first();
    if (!f) return null;
    try { return JSON.parse(f.json); } catch { return null; }
  }
  /** Añade mensajes al final y recorta a los últimos MAX. */
  async function anexar(...ms) {
    const lista = ms.flat().filter(Boolean);
    if (!lista.length) return;
    await db.batch(lista.map((m) => db.prepare('insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?) on conflict (coleccion, id) do update set json = excluded.json').bind(COL, String(m.id), JSON.stringify(m), ordenNuevo(m.at || Date.now()), iso(Date.now()))));
    await recortar();
  }
  /** Cambia un mensaje que ya está (conserva su sitio). Si ya no está, no hace nada (devuelve false). */
  async function reemplazar(m) {
    const r = await db.prepare('update filas set json = ?, actualizado = ? where coleccion = ? and id = ?').bind(JSON.stringify(m), iso(Date.now()), COL, String(m.id)).run();
    return !!r.meta?.changes;
  }
  async function recortar() {
    const f = await db.prepare('select count(*) n from filas where coleccion = ?').bind(COL).first();
    const sobran = (f?.n || 0) - MAX;
    if (sobran <= HOLGURA) return; // hasta MAX + HOLGURA se guardan (la página y el prompt solo leen los últimos MAX)
    const { results } = await db.prepare('select id, json from filas where coleccion = ? order by orden asc limit ?').bind(COL, sobran).all();
    const viejos = []; for (const r of results) { try { viejos.push(JSON.parse(r.json)); } catch { /* un mensaje roto no entra al resumen */ } }
    await guardarHilo(plegarHilo(await hiloActual(), viejos)); // primero el resumen y luego el borrado: si el borrado falla, se pliega dos veces y no pasa nada (se funde)
    await db.prepare('delete from filas where coleccion = ? and id in (select id from filas where coleccion = ? order by orden asc limit ?)').bind(COL, COL, sobran).run();
  }
  /** El resumen de lo que se cayó por el final de la conversación de ahora, o null. */
  const hiloActual = () => leerFila(db, COL_HILO, HILO);
  const guardarHilo = (h) => guardarFila(db, COL_HILO, HILO, h);
  const moverHilo = (de, a) => db.prepare('update filas set id = ? where coleccion = ? and id = ?').bind(a, COL_HILO, de).run();
  const quitarHilo = (id) => db.prepare('delete from filas where coleccion = ? and id = ?').bind(COL_HILO, id).run();

  /** «Nueva conversación»: archiva (las últimas 50) y deja el chat vacío. → el id del archivo, o null si no había nada. */
  async function archivar() {
    const f = await db.prepare('select count(*) n from filas where coleccion = ?').bind(COL).first();
    if (!f?.n) return null;
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), titulo = tituloConversacion((await cargar()).messages);
    await db.prepare('update filas set coleccion = ? where coleccion = ?').bind(ARCH(id), COL).run();
    await quitarHilo(HA(id)); await moverHilo(HILO, HA(id)); // su resumen se va con ella
    let fuera = [];
    await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => { const l = [...(d.lista || []), { id, at: Date.now(), n: f.n, titulo }]; fuera = l.slice(0, Math.max(0, l.length - ARCHIVO_MAX)); return { lista: l.slice(-ARCHIVO_MAX) }; });
    for (const x of fuera) { await db.prepare('delete from filas where coleccion = ?').bind(ARCH(x.id)).run(); await quitarHilo(HA(x.id)); }
    return id;
  }
  /** Trae de vuelta una conversación archivada (la que se acaba de archivar, por su id): lo dicho después de archivar se queda detrás. */
  async function restaurar(id) {
    if (!ID.test(String(id || ''))) return false;
    const lista = (await leerDoc(db, DOC_ARCHIVO, { lista: [] })).valor.lista || [];
    if (!lista.some((x) => x.id === id)) return false;
    await db.prepare('update filas set coleccion = ? where coleccion = ?').bind(COL, ARCH(id)).run();
    await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => ({ lista: (d.lista || []).filter((x) => x.id !== id) }));
    await quitarHilo(HILO); await moverHilo(HA(id), HILO); // la conversación recuperada recupera su resumen (lo dicho después de archivar se queda detrás)
    await recortar();
    return true;
  }
  /**
   * Cambia un mensaje SOLO si nadie más lo cambió entre leerlo y escribirlo (compare-and-swap sobre el texto de la fila). `cambiar(m)` lo modifica y devuelve false para no tocar nada.
   * → el mensaje ya cambiado, o null si no existe, `cambiar` dijo que no, o perdió contra otra petición (que ya lo hizo).
   */
  async function reclamar(id, cambiar) {
    const f = await db.prepare('select json from filas where coleccion = ? and id = ?').bind(COL, String(id)).first();
    if (!f) return null;
    let m; try { m = JSON.parse(f.json); } catch { return null; }
    if (cambiar(m) === false) return null;
    const r = await db.prepare('update filas set json = ?, actualizado = ? where coleccion = ? and id = ? and json = ?').bind(JSON.stringify(m), iso(Date.now()), COL, String(id), f.json).run();
    return r.meta?.changes ? m : null;
  }

  const mensajesDe = async (id) => { const { results } = await db.prepare('select json from filas where coleccion = ? order by orden asc').bind(ARCH(id)).all(); const out = []; for (const r of results) { try { out.push(JSON.parse(r.json)); } catch { /* un mensaje roto no tumba el historial */ } } return out; };
  /** El historial: la conversación de ahora y las archivadas (la más nueva primero), solo con lo que hace falta para elegir. */
  async function listar() {
    const { messages } = await cargar(), lista = (await leerDoc(db, DOC_ARCHIVO, { lista: [] })).valor.lista || [];
    return { actual: messages.length ? { n: messages.length, titulo: tituloConversacion(messages), at: messages[messages.length - 1].at || 0 } : null, lista: lista.map((x) => ({ id: x.id, at: x.at, n: x.n, titulo: x.titulo || 'Sin título' })).reverse() };
  }
  /** Una archivada para leerla (sin abrirla). Solo las de ESTA cuenta: el id tiene que estar en su lista. */
  async function ver(id) {
    if (!ID.test(String(id || ''))) return null;
    const x = ((await leerDoc(db, DOC_ARCHIVO, { lista: [] })).valor.lista || []).find((y) => y.id === id);
    return x ? { id, at: x.at, titulo: x.titulo || 'Sin título', messages: await mensajesDe(id) } : null;
  }
  /** Abre una archivada como la conversación de ahora; la de ahora (si había algo) pasa al archivo. → { messages, archived } o null. */
  async function abrir(id) {
    if (!ID.test(String(id || ''))) return null;
    const lista = (await leerDoc(db, DOC_ARCHIVO, { lista: [] })).valor.lista || [];
    if (!lista.some((x) => x.id === id)) return null;
    await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => ({ lista: (d.lista || []).filter((x) => x.id !== id) })); // primero se saca del archivo: así archivar la de ahora no la recorta ni la pisa
    const archived = await archivar();
    await db.prepare('update filas set coleccion = ? where coleccion = ?').bind(COL, ARCH(id)).run();
    await quitarHilo(HILO); await moverHilo(HA(id), HILO); // el resumen es el de ESA conversación
    return { ...(await cargar()), archived };
  }
  /** Borra una archivada para siempre. */
  async function borrar(id) {
    if (!ID.test(String(id || ''))) return false;
    let estaba = false;
    await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => { estaba = (d.lista || []).some((x) => x.id === id); return { lista: (d.lista || []).filter((x) => x.id !== id) }; });
    if (estaba) { await db.prepare('delete from filas where coleccion = ?').bind(ARCH(id)).run(); await quitarHilo(HA(id)); }
    return estaba;
  }
  /** Cambia el título de una conversación archivada (P7). → true si era de esta cuenta. */
  async function renombrar(id, titulo) {
    if (!ID.test(String(id || ''))) return false;
    const t = String(titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 80); if (!t) return false;
    let estaba = false;
    await mutarDoc(db, DOC_ARCHIVO, { lista: [] }, (d) => ({ lista: (d.lista || []).map((x) => { if (x.id === id) { estaba = true; return { ...x, titulo: t }; } return x; }) }));
    return estaba;
  }

  return { uid, cargar, mensaje, anexar, reemplazar, recortar, hiloActual, archivar, restaurar, reclamar, listar, ver, abrir, borrar, renombrar };
}

// Los avisos de la oficina (serve.mjs → notice): lo que el dueño debe saber sin abrir una tarea. N0.0 (D06): este archivo es el ÚNICO que los escribe.
// Hay dos almacenes, que el semáforo y Dimitri leen juntos (`salud.avisosTodos`):
//   · filas('avisos')  — tareas, agentes, disparadores, restablecer, resumen semanal: el destino por defecto;
//   · doc `notices`    — Contenido y Anuncios (la misma forma que data/notices.json: los últimos 200).
// Lo mismo dicho dos veces en 6 horas (misma `key`) se dice una. La futura tabla `notificaciones` será una proyección ADICIONAL (por persona) que cuelgue de
// emitirAvisos(); no reemplaza a estos dos: el `read` global y los ids siguen donde estaban.
import { leerDoc, mutarDoc } from './almacen.js';
import { proyectar } from './notificaciones.js';

export const VENTANA_DEDUPE_MS = 6 * 3600e3;
export const TOPE_DOC = 200;      // lo último que guarda el doc `notices`
const LOTE_CLAVES = 40;           // claves por consulta de dedupe (D1: ≤ 100 parámetros)

const idAviso = (ahora, i = '') => `${ahora.toString(36)}${i}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Emite UN aviso. → el aviso guardado, o null si era repetido.
 * @param {object} aviso { kind, text, level='info', task=null, key=null, ...resto }
 * @param {object} o { ahora, destino: 'filas'|'doc', maxTexto (solo doc), largoId (solo doc) }
 */
export async function emitirAviso(db, aviso, o = {}) {
  const r = await emitirAvisos(db, [aviso], o);
  return r[0] ?? null;
}

/** Emite varios avisos de una vez (un solo lote). Repetidos (misma `key` en 6 h, contra lo guardado o dentro de la tanda) se descartan. → los avisos guardados. */
export async function emitirAvisos(db, avisos, { ahora = Date.now(), destino = 'filas', maxTexto = 0, largoId = 12 } = {}) {
  const t = typeof ahora === 'function' ? ahora() : ahora;
  const lista = (avisos || []).filter(Boolean).map(({ kind, text, level = 'info', task = null, key = null, ...resto }) => ({ kind, level, text: maxTexto ? String(text).slice(0, maxTexto) : text, task, key, ...resto }));
  if (!lista.length) return [];
  const guardados = destino === 'doc' ? await emitirEnDoc(db, lista, t, largoId) : await emitirEnFilas(db, lista, t);
  if (guardados.length) await proyectar(db, guardados, { ahora: t }); // N0: por persona, solo con el flag encendido; atrapa sus errores (un aviso no tumba la acción)
  return guardados;
}

async function emitirEnFilas(db, lista, t) {
  const claves = [...new Set(lista.map((a) => a.key).filter(Boolean))], recientes = new Set();
  for (let i = 0; i < claves.length; i += LOTE_CLAVES) { // una consulta por tanda de claves, no una por aviso
    const trozo = claves.slice(i, i + LOTE_CLAVES);
    const { results } = await db.prepare(`select distinct json_extract(json,'$.key') k from filas where coleccion = 'avisos' and orden > ? and json_extract(json,'$.key') in (${trozo.map(() => '?').join(',')})`).bind(t - VENTANA_DEDUPE_MS, ...trozo).all();
    for (const r of results) recientes.add(r.k);
  }
  const nuevos = [];
  for (const a of lista) {
    if (a.key && (recientes.has(a.key) || nuevos.some((x) => x.key === a.key))) continue;
    const id = idAviso(t, nuevos.length ? nuevos.length : '');
    nuevos.push({ id, t, read: false, ...a });
  }
  if (!nuevos.length) return [];
  const sentencias = nuevos.map((a) => db.prepare('insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?) on conflict (coleccion, id) do nothing').bind('avisos', a.id, JSON.stringify(a), t, new Date(t).toISOString()));
  if (sentencias.length === 1) await sentencias[0].run(); else await db.batch(sentencias);
  return nuevos;
}

async function emitirEnDoc(db, lista, t, largoId) {
  const guardados = [];
  await mutarDoc(db, 'notices', [], (actual) => {
    guardados.length = 0; // mutarDoc puede repetir la función si hubo un choque
    const l = Array.isArray(actual) ? actual : [];
    for (const a of lista) {
      if (a.key && l.some((x) => x.key === a.key && t - x.t < VENTANA_DEDUPE_MS)) continue;
      const n = { id: crypto.randomUUID().slice(0, largoId), t, kind: a.kind, level: a.level, text: a.text, task: a.task, key: a.key, read: false };
      l.push(n); guardados.push(n);
    }
    return l.slice(-TOPE_DOC);
  });
  return guardados;
}

/** Compatibilidad: `avisar(db, aviso, ahora)` de antes. → el aviso guardado, o null. */
export const avisar = (db, aviso, ahora = Date.now()) => emitirAviso(db, aviso, { ahora });

/** Los últimos avisos de filas('avisos'), del más nuevo al más viejo. */
export async function leerAvisos(db, limite = 30) {
  const { results } = await db.prepare("select json from filas where coleccion = 'avisos' order by orden desc limit ?").bind(limite).all();
  return results.map((r) => { try { return JSON.parse(r.json); } catch { return null; } }).filter(Boolean);
}
/** Los avisos del doc `notices` (Contenido y Anuncios), en el orden en que se guardaron. */
export async function leerAvisosDoc(db) {
  const b = (await leerDoc(db, 'notices', [])).valor;
  return Array.isArray(b) ? b : [];
}

/** «Marcar todo como leído» en filas('avisos'). */
export async function marcarAvisosLeidos(db) {
  const { results } = await db.prepare("select id, json from filas where coleccion = 'avisos'").all();
  for (const r of results) { const j = JSON.parse(r.json); if (j.read) continue; j.read = true; await db.prepare("update filas set json = ? where coleccion = 'avisos' and id = ?").bind(JSON.stringify(j), r.id).run(); }
}
/** «Marcar todo como leído» en el doc `notices`. */
export async function marcarAvisosDocLeidos(db) {
  await mutarDoc(db, 'notices', [], (lista) => (Array.isArray(lista) ? lista : []).map((n) => (n && !n.read ? { ...n, read: true } : n)));
}

// C0 (Fase 8): el chat interno del equipo, solo la lógica de D1 (sin pantalla, sin sockets). Reglas del plan (docs/plan-chat-interno.md §3):
//   · la PERTENENCIA (chat_miembros) es la única puerta: un id de canal o de mensaje ajeno da «no existe», y un administrador no lee un directo ni un privado ajeno (solo ve metadatos);
//   · el aviso nunca lleva el texto y un aviso que falla no tumba el mensaje; los avisos entran en `notificaciones` (D10: un solo sistema), solo para directos y menciones;
//   · nada de HTML: el cuerpo es texto plano; `lectura` lee los canales en los que está y no escribe.
// Todo detrás del flag `chat.config.activo` (apagado).
import { leerDoc, guardarDoc } from '../almacen.js';
import { claveNombre } from '../equipo.js';
import { leerConfig as leerConfigNotif } from '../notificaciones.js';
import { tasaPublica } from '../publica.js';
import { cuerpoValido, nombreCanalValido, claveDirecto, leerMenciones, puedeEditar, tituloAviso, pagina, MAX_MENSAJES_POR_MINUTO } from '../../../../chat-core.mjs';

export const DOC_CONFIG = 'chat.config';
export const ID_GENERAL = 'general', MAX_MIEMBROS_INICIALES = 10, MAX_CANALES_POR_PERSONA = 200, MAX_CANALES_CREADOS = 20, MAX_CREAR_POR_MINUTO = 10;
const TROZO = 80; // límite de D1: ≤ 100 parámetros por sentencia

export const leerConfig = async (db) => ({ activo: false, ...((await leerDoc(db, DOC_CONFIG, {})).valor || {}) });
export async function guardarConfig(db, cambios) {
  const nueva = { activo: (await leerConfig(db)).activo === true };
  if (typeof cambios?.activo === 'boolean') nueva.activo = cambios.activo;
  await guardarDoc(db, DOC_CONFIG, nueva);
  if (nueva.activo) await sembrarGeneral(db); // al encender, todas las cuentas ya están en #general
  return nueva;
}

const nombreDe = (f) => (f.nombre || '').trim() || 'Persona'; // nunca el prefijo del correo: no se regala
const trozos = (a, n = TROZO) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const idCorto = () => { const a = 'abcdefghijkmnpqrstuvwxyz23456789', b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map((x) => a[x % a.length]).join(''); };
const err = (error, estado) => ({ error, estado });
export const idCanalValido = (s) => /^[a-z0-9]{3,12}$/.test(String(s));

/** Cuentas activas por id → Map(id → { id, nombre, rol }). */
export async function personasPorId(db, ids) {
  const m = new Map();
  for (const t of trozos([...new Set(ids.filter(Boolean))])) {
    const { results } = await db.prepare(`select u.id, u.email, u.rol, p.nombre from users u left join perfiles p on p.user_id = u.id where p.baja_at is null and u.id in (${t.map(() => '?').join(',')})`).bind(...t).all();
    for (const r of results) m.set(r.id, { id: r.id, nombre: nombreDe(r), rol: r.rol });
  }
  return m;
}
async function nombresMensajes(db, ids) { // incluye a quien ya no está (el mensaje conserva su nombre)
  const m = new Map();
  for (const t of trozos([...new Set(ids.filter(Boolean))])) {
    const { results } = await db.prepare(`select u.id, u.email, p.nombre from users u left join perfiles p on p.user_id = u.id where u.id in (${t.map(() => '?').join(',')})`).bind(...t).all();
    for (const r of results) m.set(r.id, nombreDe(r));
  }
  return m;
}

/** Al encender el chat: #general y todas las cuentas activas dentro, en una sola sentencia. */
export async function sembrarGeneral(db, ahora = Date.now()) {
  await db.prepare("insert or ignore into chat_canales (id, tipo, nombre, clave_nombre, privado, creado_at) values (?, 'general', 'general', 'general', 0, ?)").bind(ID_GENERAL, ahora).run();
  await db.prepare("insert or ignore into chat_miembros (canal_id, user_id, rol, desde) select ?, u.id, 'miembro', ? from users u left join perfiles p on p.user_id = u.id where p.baja_at is null").bind(ID_GENERAL, ahora).run();
}
/** #general existe desde el primer día y toda cuenta es miembro. Lee primero y escribe solo si falta (una cuenta nueva): no son dos escrituras por petición. */
export async function asegurarGeneral(db, userId, ahora = Date.now()) {
  if (await db.prepare('select 1 x from chat_miembros where canal_id = ? and user_id = ?').bind(ID_GENERAL, userId).first()) return;
  await db.prepare("insert or ignore into chat_canales (id, tipo, nombre, clave_nombre, privado, creado_at) values (?, 'general', 'general', 'general', 0, ?)").bind(ID_GENERAL, ahora).run();
  await db.prepare('insert or ignore into chat_miembros (canal_id, user_id, rol, desde) values (?,?,?,?)').bind(ID_GENERAL, userId, 'miembro', ahora).run();
}
export const miembroDe = (db, canalId, userId) => db.prepare('select m.canal_id, m.rol, m.leido_hasta, m.silenciado, c.tipo, c.nombre, c.privado from chat_miembros m join chat_canales c on c.id = m.canal_id where m.canal_id = ? and m.user_id = ? and c.archivado_at is null').bind(String(canalId), userId).first();

/** Mis canales con lo no leído, las menciones y el último mensaje, más el TOTAL de la campanita. */
export async function resumen(db, usuario) {
  await asegurarGeneral(db, usuario.id);
  const { results } = await db.prepare(`select c.id, c.tipo, c.nombre, c.privado, c.ultimo_id, c.ultimo_at, m.leido_hasta, m.silenciado,
      (select count(*) from chat_miembros x where x.canal_id = c.id) miembros, u.user_id u_user, u.cuerpo u_cuerpo, u.creado_at u_at, u.borrado_at u_borrado,
      (select count(*) from chat_mensajes g where g.canal_id = c.id and g.id > m.leido_hasta and g.user_id is not ? and g.borrado_at is null) no_leidos,
      (select count(*) from chat_mensajes g where g.canal_id = c.id and g.id > m.leido_hasta and g.user_id is not ? and g.borrado_at is null and exists (select 1 from json_each(g.menciones) j where j.value = ?)) menciones
      from chat_miembros m join chat_canales c on c.id = m.canal_id left join chat_mensajes u on u.id = c.ultimo_id where m.user_id = ? and c.archivado_at is null order by coalesce(c.ultimo_at, c.creado_at) desc limit ?`).bind(usuario.id, usuario.id, usuario.id, usuario.id, MAX_CANALES_POR_PERSONA).all();
  const directos = results.filter((c) => c.tipo === 'directo');
  const otros = new Map();
  for (const t of trozos(directos.map((c) => c.id))) {
    const { results: ms } = await db.prepare(`select canal_id, user_id from chat_miembros where user_id != ? and canal_id in (${t.map(() => '?').join(',')})`).bind(usuario.id, ...t).all();
    for (const r of ms) otros.set(r.canal_id, r.user_id);
  }
  const nombres = await nombresMensajes(db, [...otros.values()]);
  const canales = [];
  for (const c of results) {
    canales.push({ id: c.id, tipo: c.tipo, nombre: c.tipo === 'directo' ? (nombres.get(otros.get(c.id)) || 'alguien que ya no está') : c.nombre, privado: !!c.privado, miembros: c.miembros, noLeidos: c.no_leidos, menciones: c.menciones, silenciado: !!c.silenciado,
      ultimo: c.u_at && !c.u_borrado ? { texto: c.u_cuerpo.slice(0, 80), at: c.u_at, propio: c.u_user === usuario.id } : null });
  }
  // la campanita: lo no leído de canales NO silenciados + las menciones y los directos aunque estén silenciados
  const total = canales.reduce((s, c) => s + (c.tipo === 'directo' || !c.silenciado ? c.noLeidos : c.menciones), 0);
  return { canales, total };
}

/** Las cuentas activas con las que se puede abrir un directo o armar un canal (id, nombre, color), sin el correo ni la que pregunta. */
export async function personasChat(db, usuario) {
  if (usuario.rol === 'lectura') return []; // quien solo lee no abre directos ni arma canales: no necesita (ni recibe) la lista de cuentas
  const { results } = await db.prepare('select u.id, p.nombre, p.color from users u left join perfiles p on p.user_id = u.id where p.baja_at is null and u.id != ? order by lower(coalesce(p.nombre, \'\')) limit 200').bind(usuario.id).all();
  return results.map((r) => ({ id: r.id, nombre: nombreDe(r), color: r.color || null }));
}

/** Canales públicos (nombre y cuántos son), para unirse. Nunca los privados ni los directos. */
export async function publicos(db, usuario) {
  const { results } = await db.prepare("select c.id, c.nombre, (select count(*) from chat_miembros x where x.canal_id = c.id) miembros, exists (select 1 from chat_miembros y where y.canal_id = c.id and y.user_id = ?) yo from chat_canales c where c.tipo in ('general','canal') and c.privado = 0 and c.archivado_at is null order by c.nombre").bind(usuario.id).all();
  return results.map((r) => ({ id: r.id, nombre: r.nombre, miembros: r.miembros, yoSoy: !!r.yo }));
}

export async function crearCanal(db, usuario, { nombre, privado, miembros }, ahora = Date.now()) {
  const n = nombreCanalValido(nombre); if (!n.ok) return err(n.error, 400);
  if (!privado && n.clave === 'general') return err('Ese nombre ya lo usa #general.', 409);
  if (!(await tasaPublica(db, 'chatcrear:' + usuario.id, MAX_CREAR_POR_MINUTO, ahora)).ok) return err('Vas muy rápido: espera un momento antes de crear otro canal.', 429);
  if (((await db.prepare("select count(*) n from chat_canales where creado_por = ? and tipo = 'canal' and archivado_at is null").bind(usuario.id).first())?.n ?? 0) >= MAX_CANALES_CREADOS) return err(`Ya creaste ${MAX_CANALES_CREADOS} canales. Archiva o deja uno antes de crear otro.`, 429);
  const otros = [...new Set((Array.isArray(miembros) ? miembros : []).map(String))].filter((id) => id !== usuario.id).slice(0, MAX_MIEMBROS_INICIALES);
  const gente = await personasPorId(db, otros);
  const id = idCorto();
  try { await db.prepare("insert into chat_canales (id, tipo, nombre, clave_nombre, privado, creado_por, creado_at) values (?, 'canal', ?, ?, ?, ?, ?)").bind(id, n.nombre, n.clave, privado ? 1 : 0, usuario.id, ahora).run(); }
  catch { return err('Ya hay un canal público con ese nombre.', 409); } // el índice único es solo de los públicos (visibles para todos): un nombre privado nunca delata nada
  await db.batch([db.prepare("insert into chat_miembros (canal_id, user_id, rol, desde) values (?,?, 'dueno', ?)").bind(id, usuario.id, ahora), ...[...gente.keys()].map((u) => db.prepare("insert or ignore into chat_miembros (canal_id, user_id, rol, desde) values (?,?, 'miembro', ?)").bind(id, u, ahora))]);
  return { id, nombre: n.nombre, privado: !!privado, miembros: 1 + gente.size };
}

/** El directo con otra persona (uno por pareja): se crea la primera vez. Quien solo lee no abre directos. */
export async function abrirDirecto(db, usuario, conId, ahora = Date.now()) {
  if (!conId || String(conId) === usuario.id) return err('Elige a otra persona.', 400);
  const con = (await personasPorId(db, [String(conId)])).get(String(conId)); if (!con) return err('Esa persona no está en la oficina.', 404);
  if (!(await tasaPublica(db, 'chatcrear:' + usuario.id, MAX_CREAR_POR_MINUTO, ahora)).ok) return err('Vas muy rápido: espera un momento.', 429);
  const clave = claveDirecto(usuario.id, con.id);
  let c = await db.prepare('select id from chat_canales where clave_directo = ?').bind(clave).first();
  if (!c) {
    const id = idCorto();
    await db.prepare("insert or ignore into chat_canales (id, tipo, nombre, privado, clave_directo, creado_por, creado_at) values (?, 'directo', '', 1, ?, ?, ?)").bind(id, clave, usuario.id, ahora).run();
    c = await db.prepare('select id from chat_canales where clave_directo = ?').bind(clave).first(); // si dos se escriben a la vez, ambos terminan en el mismo
    await db.batch([usuario.id, con.id].map((u) => db.prepare("insert or ignore into chat_miembros (canal_id, user_id, rol, desde) values (?,?, 'miembro', ?)").bind(c.id, u, ahora)));
  }
  return { id: c.id, con: con.nombre };
}

/** Unirse a un canal público (uno mismo) o añadir a otra persona (el dueño del canal; un administrador en los públicos). */
export async function anadirMiembro(db, usuario, canalId, { userId } = {}, ahora = Date.now()) {
  const c = await db.prepare('select id, tipo, privado, creado_por from chat_canales where id = ? and archivado_at is null').bind(String(canalId)).first();
  if (!c || c.tipo === 'general' || c.tipo === 'directo') return err('Canal no encontrado', 404);
  const yo = await miembroDe(db, c.id, usuario.id), meto = !userId || String(userId) === usuario.id;
  if (c.privado && !yo) return err('Canal no encontrado', 404); // lo privado no se confirma
  if (meto) { if (c.privado) return err('Ya estás en este canal.', 409); await db.prepare("insert or ignore into chat_miembros (canal_id, user_id, rol, desde) values (?,?, 'miembro', ?)").bind(c.id, usuario.id, ahora).run(); return { ok: true }; }
  const puede = yo?.rol === 'dueno' || (!c.privado && usuario.rol === 'admin');
  if (!puede) return err('Solo quien creó el canal puede añadir gente.', 403);
  const p = (await personasPorId(db, [String(userId)])).get(String(userId)); if (!p) return err('Esa persona no está en la oficina.', 404);
  await db.prepare("insert or ignore into chat_miembros (canal_id, user_id, rol, desde) values (?,?, 'miembro', ?)").bind(c.id, p.id, ahora).run();
  return { ok: true };
}
/** Salir de un canal, o sacar a alguien (el dueño). #general y los directos no se dejan. */
export async function quitarMiembro(db, usuario, canalId, { userId } = {}, ahora = Date.now()) {
  const yo = await miembroDe(db, canalId, usuario.id); if (!yo || yo.tipo === 'general' || yo.tipo === 'directo') return err('Canal no encontrado', 404);
  const objetivo = userId && String(userId) !== usuario.id ? String(userId) : usuario.id;
  if (objetivo !== usuario.id) {
    if (yo.rol !== 'dueno') return err('Solo quien creó el canal puede sacar a alguien.', 403);
    if (!(await miembroDe(db, canalId, objetivo))) return err('Esa persona no está en el canal.', 404);
  }
  await db.prepare('delete from chat_miembros where canal_id = ? and user_id = ?').bind(String(canalId), objetivo).run();
  // un canal nunca se queda sin dueño: pasa a quien lleva más tiempo; sin nadie, se archiva
  if (!(await db.prepare("select 1 x from chat_miembros where canal_id = ? and rol = 'dueno'").bind(String(canalId)).first())) {
    const heredero = await db.prepare('select user_id from chat_miembros where canal_id = ? order by desde, user_id limit 1').bind(String(canalId)).first();
    if (heredero) await db.prepare("update chat_miembros set rol = 'dueno' where canal_id = ? and user_id = ?").bind(String(canalId), heredero.user_id).run();
    else await db.prepare('update chat_canales set archivado_at = ? where id = ?').bind(ahora, String(canalId)).run();
  }
  return { ok: true };
}

const fila = (r, nombres, yo) => ({ id: r.id, de: r.borrado_at ? null : (nombres.get(r.user_id) || 'alguien que ya no está'), deId: r.borrado_at ? null : r.user_id, tipo: r.tipo, cuerpo: r.borrado_at ? '' : r.cuerpo, borrado: !!r.borrado_at, respondeA: r.responde_a, menciones: r.borrado_at ? [] : JSON.parse(r.menciones || '[]'), at: r.creado_at, editado: !!r.editado_at, mio: r.user_id === yo });

export async function mensajes(db, usuario, canalId, { antes, limite } = {}) {
  if (!idCanalValido(canalId) || !(await miembroDe(db, canalId, usuario.id))) return err('Canal no encontrado', 404);
  const p = pagina(antes, limite);
  const { results } = await db.prepare(`select id, user_id, tipo, cuerpo, responde_a, menciones, creado_at, editado_at, borrado_at from chat_mensajes where canal_id = ?${p.antes ? ' and id < ?' : ''} order by id desc limit ?`).bind(...[String(canalId), ...(p.antes ? [p.antes] : []), p.limite]).all();
  const nombres = await nombresMensajes(db, results.map((r) => r.user_id));
  return { mensajes: results.reverse().map((r) => fila(r, nombres, usuario.id)), hayMas: results.length === p.limite };
}

/** Escribir. Quien solo lee no escribe (lo vigila el módulo). 30 mensajes por minuto y persona. → { mensaje } | { error, estado } */
export async function escribir(db, usuario, canalId, { cuerpo, respondeA } = {}, ahora = Date.now()) {
  if (!idCanalValido(canalId)) return err('Canal no encontrado', 404);
  const canal = await miembroDe(db, canalId, usuario.id); if (!canal) return err('Canal no encontrado', 404);
  const v = cuerpoValido(cuerpo); if (!v.ok) return err(v.error, 400);
  if (!(await tasaPublica(db, 'chat:' + usuario.id, MAX_MENSAJES_POR_MINUTO, ahora)).ok) return err('Vas muy rápido: espera un momento antes de escribir otra vez.', 429);
  let resp = null;
  if (respondeA != null) { const r = await db.prepare('select id from chat_mensajes where id = ? and canal_id = ?').bind(Number(respondeA) || 0, String(canalId)).first(); if (!r) return err('El mensaje al que respondes no está en este canal.', 400); resp = r.id; }
  const { results: ms } = await db.prepare('select user_id from chat_miembros where canal_id = ?').bind(String(canalId)).all();
  const gente = await personasPorId(db, ms.map((m) => m.user_id));
  const menciones = canal.tipo === 'directo' ? [] : leerMenciones(v.cuerpo, [...gente.values()], usuario.id);
  const r = await db.prepare("insert into chat_mensajes (canal_id, user_id, tipo, cuerpo, responde_a, menciones, creado_at) values (?,?, 'texto', ?,?,?,?) returning id").bind(String(canalId), usuario.id, v.cuerpo, resp, JSON.stringify(menciones), ahora).first();
  await db.prepare('update chat_canales set ultimo_id = ?, ultimo_at = ? where id = ?').bind(r.id, ahora, String(canalId)).run();
  await db.prepare('update chat_miembros set leido_hasta = max(leido_hasta, ?) where canal_id = ? and user_id = ?').bind(r.id, String(canalId), usuario.id).run(); // lo propio ya está leído
  await notificar(db, { msgId: r.id, canal: { id: String(canalId), tipo: canal.tipo, nombre: canal.nombre }, autor: usuario, miembros: ms.map((m) => m.user_id), menciones, ahora });
  return { mensaje: { id: r.id, canal: String(canalId), menciones } };
}

/** Directos y menciones entran a `notificaciones` (D10: un solo sistema), sin el texto, una vez por mensaje y persona, nunca al autor. Un error aquí no tumba el mensaje. */
export async function notificar(db, { msgId, canal, autor, miembros, menciones, ahora }) {
  try {
    if (!(await leerConfigNotif(db)).activo) return 0;
    const sentencias = [];
    for (const u of miembros) {
      if (u === autor.id) continue;
      const mencion = menciones.includes(u);
      if (!mencion && canal.tipo !== 'directo') continue;
      sentencias.push(db.prepare('insert into notificaciones (id, user_id, aviso_id, categoria, nivel, titulo, enlace, clave_dedupe, causante_id, creada_at) values (?,?,?,?,?,?,?,?,?,?) on conflict (user_id, aviso_id) do nothing')
        .bind(`chat${msgId}.${u.slice(0, 8)}`, u, `chat-${msgId}`, mencion ? 'menciones' : 'chat', 'info', tituloAviso({ de: autor.nombre, canal: canal.nombre, tipo: canal.tipo, mencion }), `chat:${canal.id}`, `chat:${canal.id}:${u}`.slice(0, 120), autor.id, ahora));
    }
    for (const t of trozos(sentencias, 50)) await db.batch(t);
    return sentencias.length;
  } catch (e) { console.error('[chat] no se pudo avisar:', e?.message ?? e); return 0; }
}

export async function editar(db, usuario, id, cuerpo, ahora = Date.now()) {
  const m = await db.prepare('select m.id, m.canal_id, m.user_id, m.creado_at, m.borrado_at from chat_mensajes m where m.id = ?').bind(Number(id) || 0).first();
  if (!m || !(await miembroDe(db, m.canal_id, usuario.id))) return err('Mensaje no encontrado', 404);
  if (!puedeEditar(m, usuario.id, ahora)) return err('Solo puedes editar lo tuyo, hasta 15 minutos después.', 403);
  const v = cuerpoValido(cuerpo); if (!v.ok) return err(v.error, 400);
  const { results: ms } = await db.prepare('select user_id from chat_miembros where canal_id = ?').bind(m.canal_id).all();
  const gente = await personasPorId(db, ms.map((x) => x.user_id)), esDirecto = (await miembroDe(db, m.canal_id, usuario.id)).tipo === 'directo';
  const menciones = esDirecto ? [] : leerMenciones(v.cuerpo, [...gente.values()], usuario.id); // las menciones siguen al texto; editar no vuelve a avisar a nadie
  await db.prepare('update chat_mensajes set cuerpo = ?, menciones = ?, editado_at = ? where id = ?').bind(v.cuerpo, JSON.stringify(menciones), ahora, m.id).run();
  return { ok: true };
}
/** Borrar = lápida. Lo propio; un administrador, en canales PÚBLICOS. */
export async function borrar(db, usuario, id, ahora = Date.now()) {
  const m = await db.prepare('select m.id, m.canal_id, m.user_id, m.borrado_at, c.privado, c.tipo from chat_mensajes m join chat_canales c on c.id = m.canal_id where m.id = ?').bind(Number(id) || 0).first();
  if (!m || !(await miembroDe(db, m.canal_id, usuario.id))) return err('Mensaje no encontrado', 404);
  if (m.user_id !== usuario.id && !(usuario.rol === 'admin' && !m.privado && m.tipo !== 'directo')) return err('Solo puedes borrar lo tuyo.', 403);
  await db.prepare("update chat_mensajes set cuerpo = '', menciones = '[]', borrado_at = ? where id = ?").bind(ahora, m.id).run();
  return { ok: true };
}
/** Marcar leído (el cursor nunca baja ni pasa del último mensaje). */
export async function marcarLeido(db, usuario, canalId, hasta) {
  if (!idCanalValido(canalId) || !(await miembroDe(db, canalId, usuario.id))) return err('Canal no encontrado', 404);
  const tope = (await db.prepare('select coalesce(max(id), 0) n from chat_mensajes where canal_id = ?').bind(String(canalId)).first()).n;
  const h = Math.min(Math.max(Number.parseInt(String(hasta), 10) || 0, 0), tope);
  await db.prepare('update chat_miembros set leido_hasta = max(leido_hasta, ?) where canal_id = ? and user_id = ?').bind(h, String(canalId), usuario.id).run();
  return { ok: true, leidoHasta: h };
}
export async function silenciar(db, usuario, canalId, silenciado) {
  if (!idCanalValido(canalId) || !(await miembroDe(db, canalId, usuario.id))) return err('Canal no encontrado', 404);
  await db.prepare('update chat_miembros set silenciado = ? where canal_id = ? and user_id = ?').bind(silenciado ? 1 : 0, String(canalId), usuario.id).run();
  return { ok: true };
}

/** La «puesta al día»: lo que pasó después del mensaje `desde` en MIS canales (hasta 200). */
export async function novedades(db, usuario, desde) {
  const d = Math.max(Number.parseInt(String(desde), 10) || 0, 0);
  const { results } = await db.prepare(`select g.id, g.canal_id, g.user_id, g.tipo, g.cuerpo, g.responde_a, g.menciones, g.creado_at, g.editado_at, g.borrado_at from chat_mensajes g join chat_miembros m on m.canal_id = g.canal_id and m.user_id = ? join chat_canales k on k.id = g.canal_id and k.archivado_at is null where g.id > ? order by g.id limit 200`).bind(usuario.id, d).all();
  const nombres = await nombresMensajes(db, results.map((r) => r.user_id));
  return { mensajes: results.map((r) => ({ ...fila(r, nombres, usuario.id), canal: r.canal_id })), ultimo: results.length ? results.at(-1).id : d };
}

/** Para un administrador: que existen, cuántos son y cuántos mensajes llevan. Lo privado y los directos, SIN nombre ni miembros. */
export async function adminCanales(db) {
  const { results } = await db.prepare('select c.id, c.tipo, c.nombre, c.privado, c.creado_at, (select count(*) from chat_miembros x where x.canal_id = c.id) miembros, (select count(*) from chat_mensajes g where g.canal_id = c.id) mensajes from chat_canales c where c.archivado_at is null order by c.creado_at').all();
  return results.map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.privado || r.tipo === 'directo' ? null : r.nombre, privado: !!r.privado, miembros: r.miembros, mensajes: r.mensajes, creado: r.creado_at }));
}
void claveNombre;

// N1 (Fase 8, §3.10 puntos 1-3 y D07/D09): notas para cuando entres y la última visita por cuenta. Detrás de un flag APAGADO (doc `notas.config`, `activo`).
// Reglas (D09): cualquiera con cuenta deja notas, también `lectura`, pero `lectura` SOLO a personas concretas (no a un rol ni a «todos»); nunca a uno mismo;
// texto plano ≤ 500 (sin autoenlace: la página lo escapa); el enlace es interno (tipo:id), nunca una URL; tope por par remitente→destinatario (5 abiertas),
// por remitente y día (20) y de notas grupales abiertas (3). Lo privado es privado: un administrador ve que existe y si se vio, no el texto de una ajena
// (salvo que el destinatario la haya «reportado»). Una nota no exige «Enterado»: se cierra (= eliminarla para sí).
import { leerDoc, guardarDoc } from './almacen.js';
import { nombrePorCorreo } from './sesion.js';

export const DOC_CONFIG = 'notas.config';
export const COLORES = ['amarillo', 'rosa', 'verde', 'azul', 'lila', 'naranja'];
export const TOPE_CUERPO = 500, MAX_ABIERTAS_PAR = 5, MAX_DIA_REMITENTE = 20, MAX_GRUPALES_ABIERTAS = 3, VIDA_DIAS = 30, MAX_VIDA_DIAS = 90, MAX_LISTA = 50;
export const VISITA_NUEVA_MS = 30 * 60_000, TOPE_ESCRITURA_PRESENCIA_MS = 5 * 60_000;
const DIA_MS = 864e5;
const ROLES = ['admin', 'editor', 'lectura'];

export const leerConfig = async (db) => ({ activo: false, ...((await leerDoc(db, DOC_CONFIG, {})).valor || {}) });
export async function guardarConfig(db, cambios) {
  const nueva = { activo: (await leerConfig(db)).activo === true };
  if (typeof cambios?.activo === 'boolean') nueva.activo = cambios.activo;
  await guardarDoc(db, DOC_CONFIG, nueva);
  return nueva;
}

/** Texto plano: sin controles (salvo el salto de línea), sin marcas de dirección bidi, recortado. → '' si no queda nada. */
export const limpiarCuerpo = (t) => String(t ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '').trim();
/** 'tarea:abc' → 'tarea:abc'; cualquier otra cosa (una URL, otro tipo) → null. */
export const parseEnlace = (s) => { const m = /^(tarea|pieza|nota|vista):([A-Za-z0-9._-]{1,80})$/.exec(String(s ?? '').trim()); return m ? `${m[1]}:${m[2]}` : null; };
/** 'persona:<id>' | 'rol:admin' | 'todos' → { tipo, valor } o null. */
export function parsePara(p) {
  const s = String(p ?? '').trim();
  if (s === 'todos') return { tipo: 'todos', valor: '' };
  const m = /^(persona|rol):(.{1,80})$/.exec(s);
  if (!m) return null;
  if (m[1] === 'rol') return ROLES.includes(m[2]) ? { tipo: 'rol', valor: m[2] } : null;
  return { tipo: 'persona', valor: m[2] };
}

const nombreDe = (f) => (f.nombre || '').trim() || nombrePorCorreo(f.email);

/** → { id } o { error, estado }. `remitente`: { id, rol }. */
export async function crear(db, remitente, { para, cuerpo, color, enlace, venceDias } = {}, ahora = Date.now()) {
  const texto = limpiarCuerpo(cuerpo);
  if (!texto) return { error: 'Escribe la nota.', estado: 400 };
  if (texto.length > TOPE_CUERPO) return { error: `La nota pasa de ${TOPE_CUERPO} letras (te sobran ${texto.length - TOPE_CUERPO}).`, estado: 422 };
  const dest = parsePara(para);
  if (!dest) return { error: 'No entendí a quién va la nota.', estado: 400 };
  if (enlace != null && enlace !== '' && !parseEnlace(enlace)) return { error: 'El enlace de la nota solo puede apuntar a algo de la oficina.', estado: 400 };
  const col = color == null || color === '' ? 'amarillo' : (COLORES.includes(color) ? color : null);
  if (!col) return { error: 'Ese color no está en la paleta.', estado: 400 };
  if (remitente.rol === 'lectura' && dest.tipo !== 'persona') return { error: 'Con acceso de lectura puedes dejar notas a personas concretas, no a un grupo.', estado: 403 };
  if (dest.tipo === 'persona') {
    if (dest.valor === remitente.id) return { error: 'No puedes dejarte una nota a ti mismo.', estado: 400 };
    const existe = await db.prepare('select u.id from users u left join perfiles p on p.user_id = u.id where u.id = ? and p.baja_at is null').bind(dest.valor).first();
    if (!existe) return { error: 'Esa persona no está en la oficina.', estado: 404 };
  }
  const hoy = (await db.prepare('select count(*) n from notas_personales where de_user_id = ? and creada_at >= ?').bind(remitente.id, ahora - DIA_MS).first())?.n ?? 0;
  if (hoy >= MAX_DIA_REMITENTE) return { error: `Ya dejaste ${MAX_DIA_REMITENTE} notas en el último día. Mañana podrás dejar más.`, estado: 429 };
  if (dest.tipo === 'persona') {
    const abiertas = (await db.prepare("select count(*) n from notas_personales n left join notas_estado e on e.nota_id = n.id and e.user_id = n.para_valor where n.de_user_id = ? and n.para_tipo = 'persona' and n.para_valor = ? and n.vence_at > ? and e.cerrada_at is null").bind(remitente.id, dest.valor, ahora).first())?.n ?? 0;
    if (abiertas >= MAX_ABIERTAS_PAR) return { error: `Esa persona ya tiene ${MAX_ABIERTAS_PAR} notas tuyas sin cerrar. Espera a que las cierre.`, estado: 429 };
  } else {
    const g = (await db.prepare("select count(*) n from notas_personales where de_user_id = ? and para_tipo != 'persona' and vence_at > ?").bind(remitente.id, ahora).first())?.n ?? 0;
    if (g >= MAX_GRUPALES_ABIERTAS) return { error: `Ya tienes ${MAX_GRUPALES_ABIERTAS} notas para un grupo abiertas. Espera a que venzan o retira una.`, estado: 429 };
  }
  const dias = Math.min(Math.max(parseInt(venceDias, 10) || VIDA_DIAS, 1), MAX_VIDA_DIAS);
  const id = crypto.randomUUID();
  await db.prepare('insert into notas_personales (id, de_user_id, para_tipo, para_valor, cuerpo, color, enlace, creada_at, vence_at) values (?,?,?,?,?,?,?,?,?)')
    .bind(id, remitente.id, dest.tipo, dest.valor, texto, col, parseEnlace(enlace), ahora, ahora + dias * DIA_MS).run();
  return { id, para: await destinatariosIds(db, dest, remitente.id) };
}

/** Las cuentas a las que llega una nota (para el aviso en vivo, que lleva solo ids). Nunca el remitente. */
export async function destinatariosIds(db, dest, remitenteId) {
  if (dest.tipo === 'persona') return [dest.valor];
  const { results } = await db.prepare(`select u.id from users u left join perfiles p on p.user_id = u.id where p.baja_at is null and u.id != ?${dest.tipo === 'rol' ? ' and u.rol = ?' : ''}`).bind(...[remitenteId, ...(dest.tipo === 'rol' ? [dest.valor] : [])]).all();
  return results.map((r) => r.id);
}

const PARA_MI = "(n.de_user_id != ? and n.vence_at > ? and ((n.para_tipo = 'persona' and n.para_valor = ?) or (n.para_tipo = 'rol' and n.para_valor = ?) or n.para_tipo = 'todos'))";

/** Lo que me dejaron y no cerré (las más nuevas primero). Marca como entregadas las que no lo estaban. */
export async function listarMias(db, usuario, ahora = Date.now()) {
  const { results } = await db.prepare(`select n.id, n.cuerpo, n.color, n.enlace, n.para_tipo, n.creada_at, n.vence_at, p.nombre, u.email, p.color pcolor, e.leida_at, e.entregada_at
      from notas_personales n join users u on u.id = n.de_user_id left join perfiles p on p.user_id = u.id left join notas_estado e on e.nota_id = n.id and e.user_id = ?
      where ${PARA_MI} and e.cerrada_at is null order by n.creada_at desc, n.id desc limit ?`).bind(usuario.id, usuario.id, ahora, usuario.id, usuario.rol, MAX_LISTA).all();
  const nuevas = results.filter((r) => r.entregada_at == null);
  for (let i = 0; i < nuevas.length; i += 50) await db.batch(nuevas.slice(i, i + 50).map((r) => db.prepare('insert into notas_estado (nota_id, user_id, entregada_at) values (?,?,?) on conflict (nota_id, user_id) do update set entregada_at = coalesce(entregada_at, excluded.entregada_at)').bind(r.id, usuario.id, ahora)));
  return results.map((r) => ({ id: r.id, de: nombreDe(r), deColor: r.pcolor || null, cuerpo: r.cuerpo, color: r.color, enlace: r.enlace, grupal: r.para_tipo !== 'persona', t: r.creada_at, vence: r.vence_at, leida: r.leida_at != null }));
}

/** 'leer' | 'cerrar' | 'reportar' sobre UNA nota que me tocaba. → true, o null si no es mía (o no existe): es lo mismo, 404. */
export async function marcar(db, usuario, id, accion, ahora = Date.now()) {
  if (!['leer', 'cerrar', 'reportar'].includes(accion)) return null;
  const mia = await db.prepare(`select n.id from notas_personales n where n.id = ? and ${PARA_MI}`).bind(String(id), usuario.id, ahora, usuario.id, usuario.rol).first();
  if (!mia) return null;
  const col = { leer: 'leida_at', cerrar: 'cerrada_at', reportar: 'reportada_at' }[accion];
  await db.prepare(`insert into notas_estado (nota_id, user_id, entregada_at, ${col}) values (?,?,?,?) on conflict (nota_id, user_id) do update set ${col} = excluded.${col}, entregada_at = coalesce(entregada_at, excluded.entregada_at)${accion === 'cerrar' ? ', leida_at = coalesce(leida_at, excluded.cerrada_at)' : ''}`).bind(mia.id, usuario.id, ahora, ahora).run();
  return true;
}

/** Quien la dejó la retira (desaparece para todos). → true | null (no es suya). */
export async function retirar(db, usuario, id) {
  const r = await db.prepare('delete from notas_personales where id = ? and de_user_id = ?').bind(String(id), usuario.id).run();
  return (r.meta?.changes ?? 0) > 0 ? true : null;
}

/** Lo que yo dejé y cómo va (vista, cerrada). Para una grupal, cuántas personas la vieron / la cerraron. */
export async function listarEnviadas(db, usuario, ahora = Date.now()) {
  const { results } = await db.prepare(`select n.id, n.para_tipo, n.para_valor, n.cuerpo, n.color, n.creada_at, n.vence_at, p.nombre, u.email,
      (select count(*) from notas_estado e where e.nota_id = n.id and e.leida_at is not null) vistas, (select count(*) from notas_estado e where e.nota_id = n.id and e.cerrada_at is not null) cerradas
      from notas_personales n left join users u on u.id = n.para_valor and n.para_tipo = 'persona' left join perfiles p on p.user_id = u.id where n.de_user_id = ? and n.vence_at > ? order by n.creada_at desc limit ?`).bind(usuario.id, ahora, MAX_LISTA).all();
  return results.map((r) => ({ id: r.id, para: r.para_tipo === 'persona' ? (r.email ? nombreDe(r) : 'alguien que ya no está') : r.para_tipo === 'rol' ? `todos los ${r.para_valor}` : 'todos', grupal: r.para_tipo !== 'persona', cuerpo: r.cuerpo, color: r.color, t: r.creada_at, vence: r.vence_at, vistas: r.vistas, cerradas: r.cerradas }));
}

/** Para un administrador: que existen y si se vieron, SIN el texto (solo el de las que el destinatario reportó). */
export async function listarParaAdmin(db, ahora = Date.now()) {
  const { results } = await db.prepare(`select n.id, n.para_tipo, n.para_valor, n.creada_at, n.vence_at, ud.email demail, pd.nombre dnombre, ur.email remail, pr.nombre rnombre,
      (select count(*) from notas_estado e where e.nota_id = n.id and e.leida_at is not null) vistas, (select count(*) from notas_estado e where e.nota_id = n.id and e.cerrada_at is not null) cerradas,
      (select count(*) from notas_estado e where e.nota_id = n.id and e.reportada_at is not null) reportes, n.cuerpo
      from notas_personales n join users ur on ur.id = n.de_user_id left join perfiles pr on pr.user_id = ur.id left join users ud on ud.id = n.para_valor and n.para_tipo = 'persona' left join perfiles pd on pd.user_id = ud.id
      where n.vence_at > ? order by n.creada_at desc limit 100`).bind(ahora).all();
  return results.map((r) => ({ id: r.id, de: nombreDe({ nombre: r.rnombre, email: r.remail }), para: r.para_tipo === 'persona' ? (r.demail ? nombreDe({ nombre: r.dnombre, email: r.demail }) : '—') : r.para_tipo === 'rol' ? `rol ${r.para_valor}` : 'todos', t: r.creada_at, vence: r.vence_at, vistas: r.vistas, cerradas: r.cerradas, reportada: r.reportes > 0, ...(r.reportes > 0 ? { cuerpo: r.cuerpo } : {}) }));
}

/** Las cuentas a las que se puede dejar una nota (id, nombre, color, rol). Sin el correo. */
export async function personas(db, usuario) {
  const { results } = await db.prepare('select u.id, u.email, u.rol, p.nombre, p.color from users u left join perfiles p on p.user_id = u.id where p.baja_at is null and u.id != ? order by lower(coalesce(p.nombre, u.email))').bind(usuario.id).all();
  return results.map((r) => ({ id: r.id, nombre: nombreDe(r), color: r.color || null, rol: r.rol }));
}

/**
 * D07: marca que la cuenta está activa. Una sola sentencia, como mucho una escritura cada 5 min por cuenta; una VISITA nueva empieza cuando pasaron más de 30 min desde la última vez
 * (la decide D1, no abrir un socket). Nunca desde el Hub ni desde los estáticos. → { visto, entro, anterior, nueva }
 */
export async function tocarPresencia(db, userId, ahora = Date.now()) {
  await db.prepare(`insert into presencia_cuenta (user_id, visto_at, entro_at, visto_anterior) values (?,?,?,null)
      on conflict (user_id) do update set visto_anterior = case when ? - visto_at > ? then visto_at else visto_anterior end, entro_at = case when ? - visto_at > ? then ? else entro_at end, visto_at = ?
      where ? - presencia_cuenta.visto_at >= ?`).bind(userId, ahora, ahora, ahora, VISITA_NUEVA_MS, ahora, VISITA_NUEVA_MS, ahora, ahora, ahora, TOPE_ESCRITURA_PRESENCIA_MS).run();
  const f = await db.prepare('select visto_at, entro_at, visto_anterior from presencia_cuenta where user_id = ?').bind(userId).first();
  return { visto: f?.visto_at ?? ahora, entro: f?.entro_at ?? ahora, anterior: f?.visto_anterior ?? null, nueva: f?.entro_at === ahora }; // `nueva`: esta llamada abrió una visita
}

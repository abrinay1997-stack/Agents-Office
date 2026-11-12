// Los testigos del conector MCP (P2). Regla de oro: NINGÚN testigo se guarda en claro; en D1 va su SHA-256. Un testigo de acceso vale 1 hora; el de renovación se ROTA en cada uso
// (el viejo queda `rotado_at`) y, si alguien presenta uno ya rotado, se corta TODA la familia (alguien lo copió). Una «conexión» es una familia.
// Hoja: solo importa ids.js y constantes.js (lo importan lib/sesion.js y lib/equipo.js para cortar las conexiones de quien cambia de rol o de contraseña: sin ciclos).
import { sha256, testigo, uuid } from '../ids.js';
import { VIDA_ACCESO_MS, VIDA_RENOVACION_MS, VIDA_MAX_FAMILIA_MS } from './constantes.js';

const PREF_ACCESO = 'mcpa_', PREF_RENOVACION = 'mcpr_';
export const nuevaFamilia = () => testigo(16);
/** ¿Tiene forma de testigo nuestro? (se mira antes de tocar D1: una basura no cuesta una consulta). */
export const formaDeAcceso = (t) => typeof t === 'string' && /^mcpa_[0-9a-f]{64}$/.test(t);
export const formaDeRenovacion = (t) => typeof t === 'string' && /^mcpr_[0-9a-f]{64}$/.test(t);

const hasta = (ahoraMs, familiaCreada) => Math.min(ahoraMs + VIDA_RENOVACION_MS, familiaCreada + VIDA_MAX_FAMILIA_MS);

/** Guarda un par nuevo (acceso + renovación) de una familia. → { access, refresh, expires_in, id }, o null si la familia se cortó mientras tanto. Los testigos en claro solo existen en este retorno. */
export async function emitir(db, { familia, familiaCreada, clienteId, userId, rol, alcance, nombre, ahoraMs }) {
  const access = PREF_ACCESO + testigo(32), refresh = PREF_RENOVACION + testigo(32), id = uuid();
  await db.prepare(`insert into mcp_tokens (id, familia, access_hash, refresh_hash, client_id, user_id, rol, alcance, nombre, familia_creada_at, creado_at, access_caduca_at, refresh_caduca_at)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, familia, await sha256(access), await sha256(refresh), clienteId, userId, rol, alcance, String(nombre).slice(0, 60), familiaCreada, ahoraMs, ahoraMs + VIDA_ACCESO_MS, hasta(ahoraMs, familiaCreada)).run();
  // Carrera: si MIENTRAS se emitía este par otra petición cortó la familia (un código o un testigo reusado), el par nuevo nace muerto. Sin esta comprobación el corte
  // podía caer entre «gastar el testigo viejo» y «escribir el nuevo» y dejar vivo justo el que alguien copió.
  const cortada = await db.prepare('select 1 as x from mcp_tokens where familia = ? and revocado_at is not null limit 1').bind(familia).first();
  if (cortada) { await revocarFamilia(db, familia, ahoraMs); return null; }
  return { access, refresh, expires_in: Math.floor(VIDA_ACCESO_MS / 1000), id };
}

/** La persona de un token, tal como está AHORA en D1 (no como estaba al emitir): administrador y dentro del equipo. */
const PERSONA = `select u.id, u.email, u.rol, p.nombre, p.baja_at from users u left join perfiles p on p.user_id = u.id where u.id = ?`;
export async function personaActual(db, userId) {
  const f = await db.prepare(PERSONA).bind(String(userId)).first();
  if (!f || f.baja_at) return null;
  return { id: f.id, email: f.email, rol: f.rol, nombre: (f.nombre || '').trim() || String(f.email).split('@')[0] };
}

/**
 * ¿Vale este testigo de acceso? → { ok: true, conexion, usuario } | { ok: false, motivo }.
 * Vale si la fila existe, no está rotada ni revocada, no caducó y su persona SIGUE siendo administradora y del equipo (el rol se relee de D1, no se fía del que había al emitir).
 * Si la persona dejó de serlo, la conexión se corta entera (defensa en profundidad: los ganchos de lib/equipo.js ya lo hacen al cambiar el rol).
 */
export async function autenticar(db, bruto, ahoraMs) {
  if (!formaDeAcceso(bruto)) return { ok: false, motivo: 'forma' };
  const t = await db.prepare('select * from mcp_tokens where access_hash = ?').bind(await sha256(bruto)).first();
  if (!t) return { ok: false, motivo: 'desconocido' };
  if (t.revocado_at || t.rotado_at) return { ok: false, motivo: 'revocado' };
  if (t.access_caduca_at <= ahoraMs) return { ok: false, motivo: 'caducado' };
  const usuario = await personaActual(db, t.user_id);
  if (!usuario || usuario.rol !== 'admin') { await revocarFamilia(db, t.familia, ahoraMs); return { ok: false, motivo: 'rol' }; }
  if (!t.ultimo_uso_at || ahoraMs - t.ultimo_uso_at > 60_000) await db.prepare('update mcp_tokens set ultimo_uso_at = ? where id = ?').bind(ahoraMs, t.id).run();
  return { ok: true, conexion: { id: t.familia, fila: t.id, nombre: t.nombre, alcance: t.alcance, clienteId: t.client_id }, usuario };
}

/** Renovar: el testigo de renovación se gasta y nace un par nuevo de la MISMA familia. → { ok, ...tokens, alcance } | { ok: false, motivo, reuso? } */
export async function renovar(db, bruto, clienteId, ahoraMs) {
  if (!formaDeRenovacion(bruto)) return { ok: false, motivo: 'forma' };
  const t = await db.prepare('select * from mcp_tokens where refresh_hash = ?').bind(await sha256(bruto)).first();
  if (!t || t.client_id !== clienteId) return { ok: false, motivo: 'desconocido' };
  if (t.revocado_at) return { ok: false, motivo: 'revocado' };
  if (t.rotado_at) { await revocarFamilia(db, t.familia, ahoraMs); return { ok: false, motivo: 'reuso', reuso: true }; } // un testigo ya rotado: se corta toda la conexión
  if (t.refresh_caduca_at <= ahoraMs) return { ok: false, motivo: 'caducado' };
  const usuario = await personaActual(db, t.user_id);
  if (!usuario || usuario.rol !== 'admin') { await revocarFamilia(db, t.familia, ahoraMs); return { ok: false, motivo: 'rol' }; }
  const r = await db.prepare('update mcp_tokens set rotado_at = ? where id = ? and rotado_at is null and revocado_at is null').bind(ahoraMs, t.id).run();
  if (!(r.meta?.changes > 0)) { await revocarFamilia(db, t.familia, ahoraMs); return { ok: false, motivo: 'reuso', reuso: true }; } // dos renovaciones a la vez con el mismo testigo: una lo copió
  const nuevos = await emitir(db, { familia: t.familia, familiaCreada: t.familia_creada_at, clienteId: t.client_id, userId: t.user_id, rol: usuario.rol, alcance: t.alcance, nombre: t.nombre, ahoraMs });
  if (!nuevos) return { ok: false, motivo: 'reuso', reuso: true };
  return { ok: true, ...nuevos, alcance: t.alcance, familia: t.familia, userId: t.user_id };
}

/** Corta una conexión (toda su familia). → cuántos testigos quedaron revocados. */
export async function revocarFamilia(db, familia, ahoraMs = Date.now()) {
  const r = await db.prepare('update mcp_tokens set revocado_at = ? where familia = ? and revocado_at is null').bind(ahoraMs, String(familia)).run();
  return r.meta?.changes ?? 0;
}
/**
 * Corta TODAS las conexiones de una persona (se la quitó del equipo, bajó de rol, cambió su contraseña o cerró sus sesiones). Tolera que la migración 0400 aún no esté aplicada
 * (nada que cortar): nunca tumba el cambio que la llamó. → cuántos testigos.
 */
export async function revocarDe(db, userId, ahoraMs = Date.now()) {
  try { return (await db.prepare('update mcp_tokens set revocado_at = ? where user_id = ? and revocado_at is null').bind(ahoraMs, String(userId)).run()).meta?.changes ?? 0; }
  catch (e) { console.warn('[mcp] no pude cortar las conexiones de esa persona (¿migración 0400 sin aplicar?):', e?.message ?? e); return 0; }
}
/** Corta TODAS las conexiones de la oficina (restablecer la oficina, «cortar todas»). */
export async function revocarTodas(db, ahoraMs = Date.now()) {
  return (await db.prepare('update mcp_tokens set revocado_at = ? where revocado_at is null').bind(ahoraMs).run()).meta?.changes ?? 0;
}

/** Las conexiones vivas (una por familia: la fila vigente), con su persona. Nunca lleva un testigo ni su huella. */
export async function listar(db, ahoraMs) {
  const { results } = await db.prepare(`select t.familia, t.nombre, t.alcance, t.client_id, t.familia_creada_at, t.creado_at, t.ultimo_uso_at, t.refresh_caduca_at, u.id as uid, u.email, p.nombre as persona, c.nombre as cliente
      from mcp_tokens t join users u on u.id = t.user_id left join perfiles p on p.user_id = u.id left join mcp_clientes c on c.client_id = t.client_id
     where t.rotado_at is null and t.revocado_at is null and t.refresh_caduca_at > ? order by t.familia_creada_at desc limit 100`).bind(ahoraMs).all();
  return results.map((f) => ({
    id: f.familia, nombre: f.nombre, cliente: f.cliente || '', alcance: f.alcance,
    persona: { id: f.uid, nombre: (f.persona || '').trim() || String(f.email).split('@')[0], email: f.email },
    creada: f.familia_creada_at, ultimoUso: f.ultimo_uso_at || null, caduca: f.refresh_caduca_at,
  }));
}

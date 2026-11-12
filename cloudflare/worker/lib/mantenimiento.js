// La poda diaria de lo que solo crece (revisión transversal del 25 oct 2026). Antes: `auditoria`, `auditoria_agentes`, `ejecuciones`, `invitaciones` y `reinicios` no tenían ninguna purga;
// con el uso diario de una oficina con agentes (miles de llamadas a herramientas al día) D1 se llenaba despacio y sin avisar.
// Qué se guarda y cuánto (a propósito largo: es el rastro de quién hizo qué):
//   · auditoria, auditoria_agentes: 400 días (más de un año completo para comparar y para una revisión contable)
//   · ejecuciones (el resultado completo de cada ejecución manual de un agente): 180 días
//   · invitaciones y reinicios de contraseña ya vencidos: 30 días después de vencer (el enlace ya no sirve; solo quedaba la fila)
//   · las plantillas de Contenido borradas (`contenido_papelera`): 30 días, como la papelera de las piezas
//   · las notas del Cerebro mandadas a la papelera (`notas_papelera`): 30 días
//   · las notas personales (`notas_personales`): 30 días DESPUÉS de vencer (su estado cae por cascada)
//   · los mensajes del chat interno (`chat_mensajes`): 365 días (canales y miembros no crecen sin las personas)
//   · las series de imágenes terminadas (`series`, hecho o cancelado): 180 días; una viva nunca
//   · el libro del dinero de las series (`series_libro`): lo ya cerrado (liquidado o liberado) 400 días; lo reservado o incierto NUNCA (es dinero que puede estar en el aire)
//   · el conector MCP: los códigos de autorización caducados (`mcp_codigos`) 1 día; los testigos (`mcp_tokens`) 30 días DESPUÉS de caducar su renovación, de rotarse o de cortarse; las aplicaciones registradas
//     que nunca se usaron y no tienen conexión (`mcp_clientes`) 30 días
//   · las notificaciones por persona (`notificaciones`): leídas 60 días, sin leer 180 días
// Cada tabla se poda por tandas (`LOTE`) y como mucho `TANDAS` por tabla y por día: una poda atrasada se pone al día en los días siguientes, sin gastar de golpe la CPU del reloj.
import { podarSkills } from './skills-api.js';
export const LOTE = 2000, TANDAS = 5;
export const RETENCION_DIAS = Object.freeze({ auditoria: 400, auditoria_agentes: 400, ejecuciones: 180, invitaciones: 30, reinicios: 30, contenido_papelera: 30, notas_papelera: 30, notificaciones: 60, notas_personales: 30, chat_mensajes: 365, estudio_lotes: 90, series: 180, series_libro: 400, series_tokens: 1,
  mcp_codigos: 1, mcp_tokens: 30, mcp_clientes: 30, mcp_solicitudes: 30 });
export const NOTIFICACIONES_SIN_LEER_DIAS = 180;
export const MCP_DOCS_DIAS = 2; // las claves de idempotencia (`mcp.idem:*`) y de deshacer (`mcp.undo:*`) del conector: viven en `docs`, no son una tabla (por eso no están en RETENCION_DIAS)

const iso = (ms) => new Date(ms).toISOString();
const dia = (ms) => iso(ms).slice(0, 10);
const DIA_MS = 864e5;

/** → { tabla: filas borradas }. `db`: D1. Las sentencias son de una sola tabla, sin datos de nadie en el texto SQL. */
export async function podar(db, ahoraMs = Date.now()) {
  const R = RETENCION_DIAS;
  const trabajos = [
    ['auditoria', 'delete from auditoria where id in (select id from auditoria where at < ? limit ?)', iso(ahoraMs - R.auditoria * DIA_MS)],
    ['auditoria_agentes', 'delete from auditoria_agentes where id in (select id from auditoria_agentes where dia < ? limit ?)', dia(ahoraMs - R.auditoria_agentes * DIA_MS)],
    ['ejecuciones', 'delete from ejecuciones where id in (select id from ejecuciones where created_at < ? limit ?)', iso(ahoraMs - R.ejecuciones * DIA_MS)],
    ['invitaciones', 'delete from invitaciones where id in (select id from invitaciones where expires_at < ? limit ?)', iso(ahoraMs - R.invitaciones * DIA_MS)],
    ['reinicios', 'delete from reinicios where id in (select id from reinicios where expires_at < ? limit ?)', iso(ahoraMs - R.reinicios * DIA_MS)],
    ['contenido_papelera', 'delete from contenido_papelera where id in (select id from contenido_papelera where borrada < ? limit ?)', ahoraMs - R.contenido_papelera * DIA_MS],
    ['notas_papelera', 'delete from notas_papelera where id in (select id from notas_papelera where borrada < ? limit ?)', ahoraMs - R.notas_papelera * DIA_MS],
    ['chat_mensajes', 'delete from chat_mensajes where id in (select id from chat_mensajes where creado_at < ? limit ?)', ahoraMs - R.chat_mensajes * DIA_MS],
    ['estudio_lotes', `delete from estudio_lotes where id in (select id from estudio_lotes where (estado in ('hecho','cancelado') or estado = 'hoja') and at < ? limit ?)`, ahoraMs - R.estudio_lotes * DIA_MS],
    ['series', `delete from series where id in (select id from series where estado in ('hecho','cancelado') and actualizada < ? limit ?)`, ahoraMs - R.series * DIA_MS],
    ['series_libro', `delete from series_libro where clave in (select clave from series_libro where estado in ('liquidado','liberado') and at < ? limit ?)`, ahoraMs - R.series_libro * DIA_MS],
    ['series_tokens', 'delete from series_tokens where token in (select token from series_tokens where caduca < ? limit ?)', ahoraMs - DIA_MS], // los de GENERAR SERIE valen 2 minutos (la Idempotency-Key, 10): un día de sobra
    ['mcp_codigos', 'delete from mcp_codigos where codigo_hash in (select codigo_hash from mcp_codigos where caduca_at < ? limit ?)', ahoraMs - R.mcp_codigos * DIA_MS],
    ['mcp_tokens', 'delete from mcp_tokens where id in (select id from mcp_tokens where refresh_caduca_at < ? or rotado_at < ? or revocado_at < ? limit ?)', Array(3).fill(ahoraMs - R.mcp_tokens * DIA_MS)],
    ['mcp_clientes', 'delete from mcp_clientes where client_id in (select c.client_id from mcp_clientes c where coalesce(c.ultimo_uso_at, c.creado_at) < ? and not exists (select 1 from mcp_tokens t where t.client_id = c.client_id) limit ?)', ahoraMs - R.mcp_clientes * DIA_MS],
    ['mcp_solicitudes', 'delete from mcp_solicitudes where id in (select id from mcp_solicitudes where creada_at < ? limit ?)', ahoraMs - R.mcp_solicitudes * DIA_MS], // las tarjetas de gasto de Claude (P4): vencen a las 24 h; el rastro de lo resuelto vive 30 días
    ['docs_mcp', "delete from docs where clave in (select clave from docs where ((clave >= 'mcp.idem:' and clave < 'mcp.idem;') or (clave >= 'mcp.undo:' and clave < 'mcp.undo;')) and actualizado < ? limit ?)", iso(ahoraMs - MCP_DOCS_DIAS * DIA_MS)],
    ['notificaciones', 'delete from notificaciones where id in (select id from notificaciones where (leida_at is not null and leida_at < ?) or creada_at < ? limit ?)', [ahoraMs - R.notificaciones * DIA_MS, ahoraMs - NOTIFICACIONES_SIN_LEER_DIAS * DIA_MS]],
    ['notas_personales', 'delete from notas_personales where id in (select id from notas_personales where vence_at < ? limit ?)', ahoraMs - R.notas_personales * DIA_MS],
  ];
  const borradas = {};
  for (const [tabla, sql, corte] of trabajos) {
    borradas[tabla] = 0;
    for (let i = 0; i < TANDAS; i++) {
      const r = await db.prepare(sql).bind(...[].concat(corte), LOTE).run();
      const n = r.meta?.changes ?? 0; borradas[tabla] += n;
      if (n < LOTE) break;
    }
  }
  // la papelera de skills (30 días) y el historial de las que ya no existen son filas, no tabla: se cuentan solo si borró algo
  try { const r = await podarSkills(db); if (r.papelera + r.historial) borradas.skills = r.papelera + r.historial; } catch { /* la poda de skills no tumba la del resto */ }
  return borradas;
}

/** ¿Toca la poda? Una vez al día, a las 03:17 de la hora de la oficina (la zona ya está instalada: `getHours` es la local). */
export const tocaPodar = (ahoraMs = Date.now()) => { const d = new Date(ahoraMs); return d.getHours() === 3 && d.getMinutes() === 17; };

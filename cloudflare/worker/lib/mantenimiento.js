// La poda diaria de lo que solo crece (revisión transversal del 25 oct 2026). Antes: `auditoria`, `auditoria_agentes`, `ejecuciones`, `invitaciones` y `reinicios` no tenían ninguna purga;
// con el uso diario de una oficina con agentes (miles de llamadas a herramientas al día) D1 se llenaba despacio y sin avisar.
// Qué se guarda y cuánto (a propósito largo: es el rastro de quién hizo qué):
//   · auditoria, auditoria_agentes: 400 días (más de un año completo para comparar y para una revisión contable)
//   · ejecuciones (el resultado completo de cada ejecución manual de un agente): 180 días
//   · invitaciones y reinicios de contraseña ya vencidos: 30 días después de vencer (el enlace ya no sirve; solo quedaba la fila)
// Cada tabla se poda por tandas (`LOTE`) y como mucho `TANDAS` por tabla y por día: una poda atrasada se pone al día en los días siguientes, sin gastar de golpe la CPU del reloj.
export const LOTE = 2000, TANDAS = 5;
export const RETENCION_DIAS = Object.freeze({ auditoria: 400, auditoria_agentes: 400, ejecuciones: 180, invitaciones: 30, reinicios: 30 });

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
  ];
  const borradas = {};
  for (const [tabla, sql, corte] of trabajos) {
    borradas[tabla] = 0;
    for (let i = 0; i < TANDAS; i++) {
      const r = await db.prepare(sql).bind(corte, LOTE).run();
      const n = r.meta?.changes ?? 0; borradas[tabla] += n;
      if (n < LOTE) break;
    }
  }
  return borradas;
}

/** ¿Toca la poda? Una vez al día, a las 03:17 de la hora de la oficina (la zona ya está instalada: `getHours` es la local). */
export const tocaPodar = (ahoraMs = Date.now()) => { const d = new Date(ahoraMs); return d.getHours() === 3 && d.getMinutes() === 17; };

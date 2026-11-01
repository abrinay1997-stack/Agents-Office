// Series en la nube, N1 (carril K): el LIBRO del dinero de las series sobre D1. Es el espejo SQL de serie-topes-core.mjs (reservar → liquidar | liberar | incierto), con una diferencia que importa:
// en local la reserva se comprueba y se escribe en un solo proceso síncrono; aquí puede haber dos Workers a la vez, así que la reserva es UNA sentencia `insert … select … where` con las tres
// condiciones dentro (tope de la serie, tope del mes de carruseles, cupo del día). Si no entra, no se escribe nada. Todo en micro-USD enteros.
// Límites de D1 que SQLite de Node no ve: ≤ 100 parámetros por sentencia (esta usa ~30), sin consultas compuestas (nada de `union`).
// Aquí NO hay ninguna llamada a un motor: solo contabilidad. Quien reserva (la bomba, N3) reserva ANTES de pedir y liquida o libera DESPUÉS.
const SUMA = `coalesce(sum(case estado when 'liquidado' then real_micro when 'liberado' then 0 else max_micro end), 0)`; // = el resumenLibro de serie-topes-core: liquidado real, liberado 0, lo demás su máximo
const entero = (x) => Number.isSafeInteger(x) && x >= 0;
const sano = (clave) => typeof clave === 'string' && clave.length > 0 && clave.length <= 100;

/** Cuánto lleva una serie: { reservado, gastado, incierto, excedido }. Una sola consulta. */
export async function resumenDeSerie(db, serieId) {
  const r = await db.prepare(`select
      coalesce(sum(case estado when 'reservado' then max_micro else 0 end), 0) as reservado,
      coalesce(sum(case estado when 'liquidado' then real_micro else 0 end), 0) as gastado,
      coalesce(sum(case estado when 'incierto' then max_micro else 0 end), 0) as incierto,
      coalesce(max(excedio), 0) as excedido
    from series_libro where serie_id = ?`).bind(serieId).first();
  return { reservado: r.reservado, gastado: r.gastado, incierto: r.incierto, excedido: !!r.excedido };
}
/** Lo gastado, reservado o en duda de los carruseles de un mes, en todas las series. */
export async function gastoDelMes(db, mes) { return (await db.prepare(`select ${SUMA} as m from series_libro where mes = ? and carrusel = 1`).bind(mes).first()).m; }
/** El peso del Estudio que ya usaron las series ese día (lo liberado antes de salir no cuenta). */
export async function usoDelDia(db, dia) { return (await db.prepare(`select coalesce(sum(peso), 0) as p from series_libro where dia = ? and not (estado = 'liberado' and salio = 0)`).bind(dia).first()).p; }
export async function lineaDe(db, clave) { return (await db.prepare('select * from series_libro where clave = ?').bind(clave).first()) ?? null; }
/** Los pasos en duda (de todas las series, o de una): lo que el dueño tiene que decidir. */
export async function inciertos(db, serieId = null) {
  const q = serieId ? db.prepare(`select clave, serie_id, n, intento, max_micro from series_libro where estado = 'incierto' and serie_id = ? order by at limit 100`).bind(serieId) : db.prepare(`select clave, serie_id, n, intento, max_micro from series_libro where estado = 'incierto' order by at limit 100`);
  return (await q.all()).results;
}

/** Reservar ANTES de pedir al motor. Idempotente por clave (la misma clave es la misma reserva; una liberada no se reutiliza).
 *  `d`: { clave, serieId, n, intento, maxMicro, topeSerieMicro, mes, dia, carrusel (bool), topeMesMicro (solo carruseles), peso, cupoDiaPeso (0 = sin tope), ahora }
 *  → { ok: true, repetida? } | { ok: false, codigo: 'clave' | 'liberada' | 'tope_serie' | 'tope_mes' | 'cupo_dia', motivo } */
export async function reservar(db, d) {
  if (!sano(d?.clave) || !sano(d?.serieId)) return { ok: false, codigo: 'clave', motivo: 'falta la clave de idempotencia' };
  const max = d.maxMicro, tope = d.topeSerieMicro, peso = d.peso ?? 1, carrusel = d.carrusel ? 1 : 0, topeMes = d.topeMesMicro ?? 0, cupo = d.cupoDiaPeso ?? 0;
  if (![max, tope, peso, topeMes, cupo, d.n, d.intento].every(entero) || typeof d.mes !== 'string' || typeof d.dia !== 'string' || !Number.isFinite(d.ahora)) return { ok: false, codigo: 'clave', motivo: 'datos de reserva no válidos' };
  const ya = await lineaDe(db, d.clave);
  if (ya && ya.serie_id !== d.serieId) return { ok: false, codigo: 'clave', motivo: 'esa clave ya es de otra serie' }; // falla cerrado: nunca se «repite» la reserva de otra serie
  if (ya) return ya.estado === 'liberado' ? { ok: false, codigo: 'liberada', motivo: 'esa reserva ya se liberó; usa otro intento' } : { ok: true, repetida: true };
  const r = await db.prepare(`insert or ignore into series_libro (clave, serie_id, n, intento, estado, max_micro, real_micro, excedio, mes, dia, carrusel, peso, salio, at)
    select ?, ?, ?, ?, 'reservado', ?, 0, 0, ?, ?, ?, ?, 1, ?
    where (select ${SUMA} from series_libro where serie_id = ?) + ? <= ?
      and (? = 0 or (select ${SUMA} from series_libro where mes = ? and carrusel = 1) + ? <= ?)
      and (? = 0 or (select coalesce(sum(peso), 0) from series_libro where dia = ? and not (estado = 'liberado' and salio = 0)) + ? <= ?)`)
    .bind(d.clave, d.serieId, d.n, d.intento, max, d.mes, d.dia, carrusel, peso, d.ahora, d.serieId, max, tope, carrusel, d.mes, max, topeMes, cupo > 0 ? 1 : 0, d.dia, peso, cupo).run();
  if ((r.meta?.changes ?? 0) === 1) return { ok: true };
  const ahora = await lineaDe(db, d.clave); // otra petición la metió justo antes (misma clave): es la misma reserva
  if (ahora && ahora.serie_id !== d.serieId) return { ok: false, codigo: 'clave', motivo: 'esa clave ya es de otra serie' };
  if (ahora) return ahora.estado === 'liberado' ? { ok: false, codigo: 'liberada', motivo: 'esa reserva ya se liberó; usa otro intento' } : { ok: true, repetida: true };
  // no cupo: se dice cuál tope fue (solo para el mensaje; la decisión ya la tomó la sentencia)
  const res = await resumenDeSerie(db, d.serieId), usado = res.reservado + res.gastado + res.incierto;
  if (max > tope - usado) return { ok: false, codigo: 'tope_serie', motivo: `no cabe en el tope de la serie: quedan ${Math.max(0, tope - usado)} micro-USD y el paso puede costar hasta ${max}` };
  if (carrusel && max > topeMes - await gastoDelMes(db, d.mes)) return { ok: false, codigo: 'tope_mes', motivo: 'no cabe en el tope del mes de carruseles' };
  return { ok: false, codigo: 'cupo_dia', motivo: 'el cupo diario de series no alcanza; se reanuda al cambiar el día' };
}

const motivoDe = async (db, clave, codigoPorDefecto, motivo) => {
  const l = await lineaDe(db, clave);
  if (!l) return { ok: false, codigo: 'sin_reserva', motivo: 'no hay reserva para esa clave' };
  return { ok: false, codigo: codigoPorDefecto, motivo, estado: l.estado };
};
/** Liquidar con el costo real. Un real mayor que lo reservado se anota (`excedio`) y NUNCA se oculta. Repetirlo no cambia nada. Solo desde «reservado» (un «incierto» se decide con `resolverIncierto`). */
export async function liquidar(db, clave, realMicro) {
  if (!sano(clave) || !entero(realMicro)) return { ok: false, codigo: 'clave', motivo: 'datos no válidos' };
  const r = await db.prepare(`update series_libro set estado = 'liquidado', real_micro = ?, excedio = case when ? > max_micro then 1 else 0 end where clave = ? and estado = 'reservado'`).bind(realMicro, realMicro, clave).run();
  if ((r.meta?.changes ?? 0) === 1) return { ok: true };
  const l = await lineaDe(db, clave);
  return l?.estado === 'liquidado' ? { ok: true, repetida: true } : motivoDe(db, clave, 'no_reservado', 'solo un paso reservado se liquida');
}
/** El paso no llegó a salir: devuelve la reserva. `nuncaSalio: true` solo con la certeza de que nada llegó al motor (entonces también se devuelve el cupo del día). */
export async function liberar(db, clave, { nuncaSalio = false, sinTrabajoId = null } = {}) {
  if (!sano(clave)) return { ok: false, codigo: 'clave', motivo: 'datos no válidos' };
  // `sinTrabajoId`: la bomba de series solo libera si el trabajo de ese paso NO existe (en la misma sentencia). Con el `insert … where exists (reservado)` de pedir, o entra el trabajo o se libera la línea: nunca las dos.
  const r = sinTrabajoId
    ? await db.prepare(`update series_libro set estado = 'liberado', salio = ? where clave = ? and estado = 'reservado' and not exists (select 1 from estudio_trabajos where id = ?)`).bind(nuncaSalio ? 0 : 1, clave, String(sinTrabajoId)).run()
    : await db.prepare(`update series_libro set estado = 'liberado', salio = ? where clave = ? and estado = 'reservado'`).bind(nuncaSalio ? 0 : 1, clave).run();
  return (r.meta?.changes ?? 0) === 1 ? { ok: true } : motivoDe(db, clave, 'no_reservado', 'solo se libera una reserva viva');
}
/** Un envío a un motor de pago sin respuesta: «puede haberse cobrado». Sigue contando y pide la decisión del dueño. */
export async function marcarIncierto(db, clave) {
  if (!sano(clave)) return { ok: false, codigo: 'clave', motivo: 'datos no válidos' };
  const r = await db.prepare(`update series_libro set estado = 'incierto' where clave = ? and estado = 'reservado'`).bind(clave).run();
  return (r.meta?.changes ?? 0) === 1 ? { ok: true } : motivoDe(db, clave, 'no_reservado', 'solo un paso reservado puede quedar incierto');
}
/** Decisión del dueño sobre un paso incierto: ¿hubo cobro? Con cobro, se liquida con lo que dijo (o con el máximo si no dijo nada); sin cobro, se libera (el cupo del día sigue gastado: el envío salió). */
export async function resolverIncierto(db, clave, huboCobro, realMicro = 0) {
  if (!sano(clave) || !entero(realMicro) || typeof huboCobro !== 'boolean') return { ok: false, codigo: 'clave', motivo: 'datos no válidos' };
  const r = huboCobro
    ? await db.prepare(`update series_libro set estado = 'liquidado', real_micro = case when ? > 0 then ? else max_micro end, excedio = case when ? > max_micro then 1 else 0 end where clave = ? and estado = 'incierto'`).bind(realMicro, realMicro, realMicro, clave).run()
    : await db.prepare(`update series_libro set estado = 'liberado' where clave = ? and estado = 'incierto'`).bind(clave).run();
  return (r.meta?.changes ?? 0) === 1 ? { ok: true } : motivoDe(db, clave, 'no_incierto', 'ese paso no está en duda');
}

/** ¿Cuántas series están generando AHORA? Una serie cuenta si está en muestra o corriendo, O si tiene algún plano en el aire (trabajo enviado y no terminado) aunque esté pausada o cancelada: lo que va en el aire se liquida después y borrar la serie lo dejaría sin dueño.
 *  Restablecer a Dimitri se niega si hay alguna. Si la tabla aún no existe (migración sin aplicar) no hay ninguna. */
export async function hayCorriendo(db) {
  try { return (await db.prepare(`select count(*) as n from series where estado in ('muestra', 'corriendo') or exists (select 1 from json_each(series.json, '$.escaleta') where json_extract(value, '$.estado') = 'corriendo')`).first()).n; }
  catch (e) { if (/no such table/i.test(String(e?.message || e))) return 0; throw e; }
}
/** Las líneas del libro de una serie (≤ 100), de la más vieja a la más nueva. Solo lectura. */
export async function lineas(db, serieId) {
  const { results } = await db.prepare('select clave, n, intento, estado, max_micro, real_micro, excedio, salio, at from series_libro where serie_id = ? order by n, intento limit 100').bind(serieId).all();
  return results.map((r) => ({ clave: r.clave, n: r.n, intento: r.intento, estado: r.estado, maxMicro: r.max_micro, realMicro: r.estado === 'liquidado' ? r.real_micro : null, excedio: !!r.excedio, salio: !!r.salio, at: r.at }));
}
/** Barrido de líneas HUÉRFANAS (su serie ya no existe: se restableció o se podó): una línea `reservada` que nadie va a cerrar.
 *  Con certeza de que nada salió (`trabajoDe(clave) === false`) se libera y se devuelve el cupo; si hubo trabajo o NO se sabe (`trabajoDe` ausente o null) queda `incierta` (cuenta contra los topes hasta que alguien decida).
 *  Una línea ya `incierta` no se toca. → { liberadas, inciertas, pendientes } */
export async function barrerHuerfanas(db, { trabajoDe = null } = {}) {
  const { results } = await db.prepare(`select clave, estado from series_libro where estado in ('reservado', 'incierto') and serie_id not in (select id from series) limit 100`).all();
  const out = { liberadas: 0, inciertas: 0, pendientes: 0 };
  for (const r of results) {
    if (r.estado === 'incierto') { out.pendientes++; continue; }
    const hubo = trabajoDe ? await trabajoDe(r.clave) : null;
    if (hubo === false) { if ((await liberar(db, r.clave, { nuncaSalio: true })).ok) out.liberadas++; }
    else if ((await marcarIncierto(db, r.clave)).ok) out.inciertas++;
  }
  return out;
}

// ---- Líneas HUÉRFANAS: una línea `reservado` o `incierto` que ningún plano de ninguna serie va a cerrar (la serie ya no existe, o su plano no apunta a ella). Sin esta decisión, siguen contando contra los topes del mes para siempre.
const PASO_FINAL = new Set(['liquidado', 'liberado']);
/** ¿Esta línea la sigue llevando alguien? Pura. Es de la serie (no huérfana) si el plano n está en el aire con ESE intento, o si el paso de la serie todavía no terminó. */
export function esHuerfana(serie, l) {
  if (!l || (l.estado !== 'reservado' && l.estado !== 'incierto')) return false;
  if (!serie || !Array.isArray(serie.escaleta)) return true;
  const plano = serie.escaleta.find((p) => p && p.n === l.n), paso = serie.pasos?.[l.clave];
  if (plano?.estado === 'corriendo' && plano.intento_actual === l.intento) return false;
  if (paso && !PASO_FINAL.has(paso.estado)) return false;
  return true;
}
/** Las líneas vivas del libro (reservadas o en duda), de todas las series; el que llama decide cuáles son huérfanas. ≤ 100. */
export async function vivas(db) {
  return (await db.prepare(`select clave, serie_id, n, intento, estado, max_micro, at from series_libro where estado in ('reservado', 'incierto') order by at limit 100`).all()).results;
}
/** Decide una línea huérfana, TODO en una sentencia (CAS): solo si sigue en el estado que se leyó, la serie no cambió desde que se miró (o sigue sin existir), su trabajo no va en el aire y, si estaba `reservado`, tiene más edad que `antesDeMs`.
 *  Con cobro se liquida con `realMicro` (0 = lo reservado); sin cobro se libera (el cupo del día sigue gastado: el envío pudo salir). → { ok } | { ok: false, motivo } */
export async function resolverHuerfana(db, l, huboCobro, realMicro, { serieVersion = null, antesDeMs, trabajoId }) {
  if (!l || !sano(l.clave) || !entero(realMicro) || typeof huboCobro !== 'boolean' || !Number.isFinite(antesDeMs)) return { ok: false, motivo: 'datos no válidos' };
  const cobro = huboCobro ? 1 : 0, nuevo = huboCobro ? 'liquidado' : 'liberado';
  const r = await db.prepare(`update series_libro set estado = ?,
      real_micro = case when ? = 1 then (case when ? > 0 then ? else max_micro end) else real_micro end,
      excedio = case when ? = 1 and ? > max_micro then 1 else excedio end
    where clave = ? and estado = ?
      and ((? is null and not exists (select 1 from series where id = series_libro.serie_id)) or exists (select 1 from series where id = series_libro.serie_id and version = ?))
      and not exists (select 1 from estudio_trabajos where id = ? and estado in ('queued', 'running'))
      and (estado = 'incierto' or at <= ?)`)
    .bind(nuevo, cobro, realMicro, realMicro, cobro, realMicro, l.clave, l.estado, serieVersion, serieVersion, String(trabajoId), Math.round(antesDeMs)).run();
  return (r.meta?.changes ?? 0) === 1 ? { ok: true } : { ok: false, motivo: 'esa línea cambió mientras la mirabas, o su trabajo todavía va en el aire, o es demasiado reciente: vuelve a mirarla' };
}

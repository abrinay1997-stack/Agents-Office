// Gastos que Claude PIDE por el conector MCP (P4 del plan MCP, §14.2): el PASO 1 del dinero. Un token con alcance «gasto» no gasta: deja una TARJETA «espera tu OK» (tabla mcp_solicitudes) con la cifra
// que calculó el SERVIDOR, los topes de ese momento, quién la pidió y cuándo vence. El PASO 2 —aprobar y ejecutar— lo da SOLO una persona, con su sesión en la oficina o por Telegram, y se ejecuta por
// la MISMA herramienta y las MISMAS rutas de siempre (/api/media/jobs, /presets/apply, /lotes) con la sesión de ESA persona: ahí vuelven a mirarse los topes del Estudio. Un testigo de MCP no tiene
// ruta hacia aquí (las rutas de este archivo viven bajo /api/conectar-claude, que pide la sesión de un administrador) y el registro (registro.js) sigue prohibiendo toda herramienta que canjee o mande un testigo.
//  · La tarjeta es de UN solo uso: aprobar la pasa de «espera» a «ejecutando» con una condición (compare-and-set); dos clics a la vez ejecutan una vez.
//  · Al aprobar se RECALCULA: si ya no cabe en los topes o la cifra SUBIÓ, no se ejecuta y se rechaza con el motivo (nunca se gasta más de lo que la persona vio).
//  · Vence a las 24 h. Si la conexión que la pidió se cortó (o se restableció la oficina), se descarta sola.
//  · Topes de tarjetas: 5 abiertas por conexión y 20 por conexión y día; la misma petición (mismo hash) no abre una segunda tarjeta.
import { sha256, testigo } from '../ids.js';
import { emitirAviso } from '../avisos.js';
import { restringir } from './capa1/restringir.js';

export const VENCE_MS = 24 * 3600e3;
export const MAX_ABIERTAS = 5, MAX_POR_DIA = 20;
export const ESTADOS_FINALES = ['ejecutada', 'rechazada', 'vencida', 'descartada', 'incierta'];
export const INTERRUMPIDA_MS = 10 * 60e3, REABRIR_MS = 30 * 60e3; // un «ejecutando» que lleva 10 min se da por interrumpido; el mismo pedido no se reabre en 30 min si quedó dudoso
const clip = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const MUERTA = 'La conexión que la pidió ya no existe (se cortó o se restableció la oficina).';

/** JSON canónico (claves ordenadas): el mismo contenido da siempre el mismo texto, y por eso el mismo hash. */
export function canonico(x) {
  if (Array.isArray(x)) return `[${x.map(canonico).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${canonico(x[k])}`).join(',')}}`;
  return JSON.stringify(x) ?? 'null';
}
const numeros = (bu) => Object.fromEntries(['left', 'limit', 'costLeftDay', 'dailyBudget', 'costLeftMonth', 'monthlyBudget', 'maxPerRequest'].filter((k) => Number.isFinite(Number(bu?.[k])) && bu[k] !== null).map((k) => [k, Number(bu[k])]));
const dinero = (n) => `US$${(+n || 0).toFixed(2).replace('.', ',')}`;

async function auditarGasto(db, ms, quien, detalle) {
  try { await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date(ms).toISOString(), 'mcp-gasto', String(quien || 'desconocido').slice(0, 120), JSON.stringify(detalle)).run(); }
  catch (e) { console.warn('[mcp-gasto] la auditoría no se pudo escribir:', e?.message ?? e); }
}

/** Pone al día los estados que dependen del tiempo y de la conexión: lo vencido pasa a «vencida» y lo de una conexión cortada, a «descartada». Idempotente; dos sentencias. */
export async function barrer(db, ms) {
  await db.prepare(`update mcp_solicitudes set estado = 'vencida', resuelta_at = ?, motivo = 'Venció sin que nadie la aprobara.' where estado = 'espera' and vence_at <= ?`).bind(ms, ms).run();
  await db.prepare(`update mcp_solicitudes set estado = 'incierta', motivo = 'Se interrumpió a mitad (¿se cayó el servidor?). Puede que sí se haya pedido: revisa el Estudio antes de volver a pedirlo.' where estado = 'ejecutando' and resuelta_at <= ?`).bind(ms - INTERRUMPIDA_MS).run();
  await db.prepare(`update mcp_solicitudes set estado = 'descartada', resuelta_at = ?, motivo = ? where estado = 'espera'
     and not exists (select 1 from mcp_tokens t where t.familia = mcp_solicitudes.familia and t.revocado_at is null and t.rotado_at is null and t.refresh_caduca_at > ?)`).bind(ms, MUERTA, ms).run();
}

/** Qué dice la herramienta del Estudio: con id de trabajo o de lote (o «Listo:» / «En marcha:») se pidió; un error escrito es «rechazada»; el silencio, «incierta» (no se sabe si se creó). Pura. */
export function veredicto(r) {
  const crudo = String(typeof r === 'string' ? r : r?.text ?? '');
  const trabajo = /\b(?:trabajo|lote) ([A-Za-z0-9]{5,30})\b/.exec(crudo)?.[1];
  if (trabajo || /^\s*(Listo:|En marcha:)/.test(crudo)) return { estado: 'ejecutada', texto: `Pedida al Estudio${trabajo ? ` (${trabajo})` : ''}: la oficina te avisa cuando termine.` };
  if (r?.isError || /^\s*(⛔|no se pudo|error)/i.test(crudo)) return { estado: 'rechazada', texto: `El Estudio no lo pidió: ${clip(crudo, 250)}` };
  return { estado: 'incierta', texto: 'No se sabe si se creó (la respuesta no trajo ningún trabajo): mira el Historial del Estudio antes de volver a intentarlo.' };
}

const publica = (f) => ({
  id: f.id, herramienta: f.herramienta, resumen: f.resumen, cifraUsd: f.cifra_usd, cifraNota: f.cifra_nota || '', topes: JSON.parse(f.topes || '{}'), estado: f.estado, motivo: f.motivo || '',
  creada: f.creada_at, vence: f.vence_at, resuelta: f.resuelta_at || null, resueltaPor: f.resuelta_por || '', args: clip(f.args, 2000),
  conexion: { id: f.familia, nombre: f.conexion }, persona: { nombre: (f.persona || '').trim() || String(f.email || '').split('@')[0], email: f.email || '' },
});
const SELECT = `select s.*, u.email, p.nombre as persona from mcp_solicitudes s left join users u on u.id = s.user_id left join perfiles p on p.user_id = s.user_id`;

/** Las tarjetas para la pantalla: las que esperan (más nuevas primero) y las últimas 20 ya resueltas. */
export async function listarSolicitudes(db, ms) {
  await barrer(db, ms);
  const { results: esperan } = await db.prepare(`${SELECT} where s.estado in ('espera','ejecutando') order by s.creada_at desc limit 50`).all();
  const { results: hechas } = await db.prepare(`${SELECT} where s.estado not in ('espera','ejecutando') order by s.creada_at desc limit 20`).all();
  return { esperan: esperan.map(publica), hechas: hechas.map(publica) };
}
export async function contarEsperando(db, ms) {
  await barrer(db, ms);
  return (await db.prepare(`select count(*) n from mcp_solicitudes where estado = 'espera'`).first())?.n || 0;
}

/**
 * El paso 1: deja la tarjeta. `ev` es lo que calculó el SERVIDOR (capa1/estudio.js → evaluarGasto). → { tarjeta } | { repetida: tarjeta } | { limite: texto } | { noCabe: true }.
 * Nada aquí gasta ni llama al Estudio.
 */
export async function crearSolicitud(db, { conexion, usuario, ms, herramienta, args, ev }) {
  await barrer(db, ms);
  const hash = await sha256(`${herramienta}|${canonico(args)}`);
  const ya = await db.prepare(`${SELECT} where s.familia = ? and s.hash = ? and s.estado = 'espera' and s.vence_at > ?`).bind(conexion.id, hash, ms).first();
  if (ya) return { repetida: publica(ya) };
  const dudosa = await db.prepare(`select id from mcp_solicitudes where familia = ? and hash = ? and estado in ('ejecutando','incierta') and creada_at > ?`).bind(conexion.id, hash, ms - REABRIR_MS).first();
  if (dudosa) return { limite: 'Este mismo pedido quedó a medias hace poco y puede haberse gastado: no se abre otra tarjeta en 30 minutos. El dueño lo revisa en el Estudio.' };
  const id = 'g' + testigo(9), resumen = clip(`${ev.que}${ev.idea ? ` — «${ev.idea}»` : ''}`, 400);
  // el tope de tarjetas se aplica EN la misma sentencia que inserta: dos pedidos a la vez no pasan los dos
  const ins = await db.prepare(`insert into mcp_solicitudes (id, familia, user_id, conexion, herramienta, args, resumen, cifra_usd, cifra_nota, topes, hash, estado, creada_at, vence_at)
      select ?,?,?,?,?,?,?,?,?,?,?,'espera',?,? where (select count(*) from mcp_solicitudes where familia = ? and estado = 'espera') < ? and (select count(*) from mcp_solicitudes where familia = ? and creada_at > ?) < ?`)
    .bind(id, conexion.id, usuario.id, clip(conexion.nombre, 80), herramienta, JSON.stringify(args), resumen, Number(ev.usd) || 0, clip(ev.nota, 200) || null, JSON.stringify(numeros(ev.bu)), hash, ms, ms + VENCE_MS, conexion.id, MAX_ABIERTAS, conexion.id, ms - 864e5, MAX_POR_DIA).run();
  if (!ins.meta?.changes) {
    const abiertas = (await db.prepare(`select count(*) n from mcp_solicitudes where familia = ? and estado = 'espera'`).bind(conexion.id).first())?.n || 0;
    const llenas = `Ya hay ${abiertas} tarjetas de esta conexión esperando el OK del dueño (el máximo es ${MAX_ABIERTAS}). No se abre otra hasta que las apruebe, las rechace o venzan.`;
    const dia = `Esta conexión ya pidió ${MAX_POR_DIA} gastos en las últimas 24 horas (el máximo es ${MAX_POR_DIA}). Vuelve a pedir mañana.`;
    return { limite: abiertas >= MAX_ABIERTAS ? llenas : dia };
  }
  await auditarGasto(db, ms, usuario.email, { evento: 'pide', id, herramienta, conexion: conexion.id, cifra: Number(ev.usd) || 0 });
  // el aviso de la oficina (y, a su paso, de Telegram con ✅ / ↩); el texto lo escribe el servidor, nunca el cliente
  const texto = `Claude (la aplicación se llama «${clip(conexion.nombre, 40)}»: lo declara ella, no está verificado) pide gastar ${Number(ev.usd) ? 'unos ' + dinero(ev.usd) : 'nada (gratis)'} en el Estudio: ${resumen.slice(0, 200)}. Espera tu OK en Ajustes → Conectar Claude.`;
  await emitirAviso(db, { kind: 'mcp-gasto', level: 'warn', key: `mcp-gasto:${id}`, text: texto }, { ahora: ms }).catch(() => {});
  return { tarjeta: publica(await db.prepare(`${SELECT} where s.id = ?`).bind(id).first()) };
}

export async function rechazarSolicitud(db, id, { ms, por, motivo = 'La rechazó el dueño.' }) {
  await barrer(db, ms);
  const r = await db.prepare(`update mcp_solicitudes set estado = 'rechazada', motivo = ?, resuelta_at = ?, resuelta_por = ? where id = ? and estado = 'espera'`).bind(clip(motivo, 300), ms, clip(por, 120), String(id)).run();
  if (r.meta?.changes) await auditarGasto(db, ms, por, { evento: 'rechaza', id });
  return !!r.meta?.changes;
}

/**
 * El paso 2, de una PERSONA: `usuario` es la sesión de un administrador (la página o Telegram). → { ok, estado, texto } o { error, status }.
 * Re-evalúa con el catálogo y los topes de AHORA; ejecuta con la misma herramienta del Estudio y la oficina EN PROCESO con la sesión de esa persona (los topes del Estudio se miran otra vez ahí).
 */
export async function aprobarSolicitud({ env, db, usuario, ms, id }) {
  await barrer(db, ms);
  const f = await db.prepare(`${SELECT} where s.id = ?`).bind(String(id)).first();
  if (!f) return { error: 'Esa solicitud no existe.', status: 404 };
  if (f.estado !== 'espera') return { error: `Esa solicitud ya no espera: está «${f.estado}»${f.motivo ? ` (${f.motivo})` : ''}.`, status: 409 };
  const [{ crearOffice }, { MODULOS }, { evaluarGasto, nuevoEstudio }] = await Promise.all([import('../agentes/herramientas.js'), import('../../modulos/index.js'), import('./capa1/estudio.js')]);
  const office = crearOffice({ env, db, usuario: { ...usuario, rol: 'admin' }, modulos: MODULOS });
  const args = JSON.parse(f.args), por = usuario.email;
  // cerrar SIEMPRE con el estado en el que se está: quien perdió una carrera no pisa lo que otro ya resolvió (y la auditoría no miente)
  const cerrar = async (estado, motivo, desde) => {
    const r = await db.prepare(`update mcp_solicitudes set estado = ?, motivo = ?, resuelta_at = ?, resuelta_por = ? where id = ? and estado = ?`).bind(estado, clip(motivo, 400), ms, clip(por, 120), f.id, desde).run();
    if (r.meta?.changes) await auditarGasto(db, ms, por, { evento: estado, id: f.id, motivo: clip(motivo, 200), pidio: { conexion: f.familia, persona: f.email } });
    return !!r.meta?.changes;
  };
  // 1) se vuelve a calcular con lo de ahora (solo GET y compilar un preset: nada de esto gasta)
  let ev;
  try { ev = await evaluarGasto(restringir(office, ['GET', 'POST /api/media/presets/compile']), f.herramienta, args); } catch (e) { ev = { error: true, texto: String(e?.message || e) }; }
  let motivoNo = '';
  if (ev.error) motivoNo = `Ya no se puede hacer así: ${clip(ev.texto, 200)}`;
  else if (!ev.cabe) motivoNo = 'Ya no cabe en los topes de hoy del Estudio.';
  else if (ev.usd > f.cifra_usd + 0.005) motivoNo = `El costo subió de ${dinero(f.cifra_usd)} a ${dinero(ev.usd)}: no se gasta más de lo que viste. Pídelo otra vez.`;
  if (motivoNo) { if (!(await cerrar('rechazada', motivoNo, 'espera'))) return { error: 'Esa solicitud ya se está resolviendo.', status: 409 }; return { ok: false, estado: 'rechazada', texto: motivoNo }; }
  // 2) un solo uso: solo una persona pasa de «espera» a «ejecutando»
  const cas = await db.prepare(`update mcp_solicitudes set estado = 'ejecutando', resuelta_at = ?, resuelta_por = ? where id = ? and estado = 'espera' and vence_at > ?`).bind(ms, clip(por, 120), f.id, ms).run();
  if (!cas.meta?.changes) return { error: 'Esa solicitud ya se está resolviendo o venció.', status: 409 };
  await auditarGasto(db, ms, por, { evento: 'aprueba', id: f.id, herramienta: f.herramienta, cifra: f.cifra_usd, pidio: { conexion: f.familia, persona: f.email } });
  // 3) la herramienta de siempre, con la sesión de la persona (sin esperar el resultado: la oficina avisa cuando termine)
  const sinEspera = (ruta, cuerpo, metodo) => office(ruta, cuerpo && typeof cuerpo === 'object' ? { ...cuerpo, wait: 0 } : cuerpo, metodo);
  try {
    const v = veredicto(await nuevoEstudio(sinEspera).call(f.herramienta, args));
    await cerrar(v.estado, v.texto, 'ejecutando');
    return { ok: v.estado === 'ejecutada', ...v };
  } catch (e) { const m = `Algo falló al pedirlo (${clip(e?.message || e, 200)}). Puede haberse pedido igual: revisa el Estudio antes de volver a intentarlo.`; await cerrar('incierta', m, 'ejecutando'); return { ok: false, estado: 'incierta', texto: m }; }
}

// ============================================================
// Agents Office — Anuncios de Meta, Fase A2 (9 oct 2026): CONTROLAR. Lo único de la oficina que cambia algo en la cuenta publicitaria.
// docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §3 (LA REGLA DEL DINERO, que no se negocia), §5 Fase A2, §7.
//
// Dos clases de acciones:
//   · LIBRES (bajan el gasto, un clic): pausar · bajar_presupuesto · archivar. Pausar y bajar se deshacen durante `approvals.undoSeconds`
//     (30 s); archivar no (en Meta lo archivado no se vuelve a encender: POR VERIFICAR si v26 lo deja).
//   · DE GASTO (dos clics del dueño, con la cifra, dentro de los topes): activar · reanudar · subir_presupuesto · alargar · relanzar.
//     La primera llamada NO cambia nada: devuelve `confirmar` con el texto («Activar «X» — gasta hasta US$15 al día, US$105 esta
//     semana») y un token de 2 minutos, de un solo uso, atado a ESE tipo + id + valor/fechas. La segunda, con `confirmacion`, vuelve a
//     leer el objeto, vuelve a mirar los topes (pueden haber cambiado) y entonces lo hace.
//
// QUIÉN (el SERVIDOR lo decide; que la página pida dos clics no basta):
//   · el dueño (la página sin `por`, `por: 'dueno'`, o Telegram con TELEGRAM_OWNER_ID): todo; solo él confirma un gasto y deshace;
//   · Dimitri (`por: 'dimitri'`, el clic del dueño en su tarjeta): las libres; de las de gasto, solo la primera llamada;
//   · el asistente por MCP (`por: 'asistente'`) y el piloto automático (`por: 'piloto'`, Fase A5): solo las libres, y sin deshacer
//     (deshacer vuelve a gastar);
//   · un agente (`por: 'agente'`): nada (403). anuncios-mcp.mjs no tiene herramientas de escritura.
//
// En Meta, cada cambio PRIMERO se valida (`execution_options: ["validate_only"]`, que no cambia nada) y luego se aplica con
// `POST /<id>`; nunca DELETE (para limpiar se archiva). Todo va por anuncios/meta-ads.mjs → contenido/meta.mjs (el freno por uso).
// Cada cambio aplicado: data/anuncios/historial.jsonl, data/audit/AAAA-MM-DD.jsonl (`kind: 'anuncios'`) y el objeto releído de Meta en
// data/anuncios/cuenta.json (sin esperar a la próxima lectura).
//
// RELANZAR: algo en pausa que no terminó → reanudar. Una campaña terminada o archivada (o `copiar: true`) → una COPIA EN PAUSA con
// `POST /<campaña>/copies` (deep_copy, status_option PAUSED, fechas nuevas, el nombre con `· AO:<id>`); activarla es otra acción de
// gasto. Meta copia síncronamente como mucho 3 anuncios hijos (plan §13.7): con más, se copia POR PARTES (la campaña sola, luego cada
// conjunto con los suyos, y un conjunto de más de 3 anuncios, anuncio por anuncio), hasta MAX_ANUNCIOS_COPIA; con más, se dice.
// ============================================================
import crypto from 'node:crypto';
import { ErrorMeta, mensajeMeta } from '../contenido/meta.mjs';
import { buscar, aMeta, conEtiqueta, offsetDe } from './modelo.mjs';
import { evaluar, dinero, APAGADO, msDe, diarioDeCampana, VERBO } from './topes.mjs';

export const LIBRES = ['pausar', 'bajar_presupuesto', 'archivar'];
export const DE_GASTO = ['activar', 'reanudar', 'subir_presupuesto', 'alargar', 'relanzar'];
export const TIPOS = [...LIBRES, ...DE_GASTO];
export const CONFIRMAR_MS = 2 * 60e3;
export const SUBIDA_APRENDIZAJE = 0.2; // plan §7.1 y §7.5: más de un 20 % de golpe reinicia el aprendizaje
export const MAX_ANUNCIOS_SINCRONO = 3; // plan §13.7 (verificado el 9 oct 2026)
export const MAX_ANUNCIOS_COPIA = 30;
export const DIAS_COPIA = 7; // una copia sin fechas, y sin poder copiar la duración de la original, dura una semana
export const AVISO_APRENDIZAJE = 'esto reinicia el aprendizaje; mejor un 20 % cada 2–3 días';
const EN_REVISION = new Set(['PENDING_REVIEW', 'IN_PROCESS']);
const NIVEL = { campana: 'campaña', conjunto: 'conjunto', anuncio: 'anuncio' };

/** Quién pide, por el campo `por`: sin él (la página) o 'dueno'/'telegram', el dueño. Lo desconocido no puede nada. */
export function quienDe(por) {
  const p = String(por ?? '').trim().toLowerCase();
  if (!p || p === 'dueno' || p === 'dueño' || p === 'telegram') return 'dueno';
  return ['dimitri', 'asistente', 'agente', 'piloto'].includes(p) ? p : 'otro';
}
const valorNorm = v => (v === undefined || v === null || v === '' ? '' : String(Math.round(Number(v) * 100) / 100));
/** La huella de una acción: el token de confirmación vale SOLO para esto. */
export const firmaDe = b => JSON.stringify([String(b.tipo), String(b.id), valorNorm(b.valor), b.fin ? String(b.fin) : '', b.inicio ? String(b.inicio) : '', b.copiar ? 1 : 0]);

const isoMeta = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+0000'); // como Meta escribe sus fechas
export function fechaCorta(ms, zona) {
  try { return new Intl.DateTimeFormat('es', { timeZone: zona || undefined, day: 'numeric', month: 'short' }).format(new Date(ms)).replace('.', ''); } catch { return new Date(ms).toISOString().slice(0, 10); }
}
const propioDe = e => (APAGADO.has(e) ? e : e ? 'ACTIVE' : null);
/** El estado PROPIO: el configurado de Meta si se leyó; si no, el efectivo (CAMPAIGN_PAUSED = encendido, lo para su padre). */
const propioRaw = (raw, r) => propioDe(raw?.configured_status || raw?.status) || propioDe(r.objeto.estado) || 'ACTIVE';
/** Cuándo termina: el suyo, o (campaña sin fin propio) el último de sus conjuntos si todos tienen; un anuncio, el de su conjunto. */
function finDe(r) {
  const o = r.objeto;
  if (r.tipo === 'anuncio') return r.conjunto?.fin || r.campana?.fin || null;
  if (r.tipo === 'conjunto') return o.fin || r.campana?.fin || null;
  if (o.fin) return o.fin;
  const fs = (o.conjuntos || []).map(s => s.fin);
  return fs.length && fs.every(Boolean) ? fs.reduce((a, b) => ((msDe(a) ?? 0) >= (msDe(b) ?? 0) ? a : b)) : null;
}
const presupuestoDe = o => (o?.presupuesto?.usd != null ? { tipo: o.presupuesto.tipo, usd: o.presupuesto.usd } : null);

/** Lo que dice Meta al rechazar, en palabras (el título y el detalle que Meta escribe para el usuario, si los da). */
export function motivoMeta(e) {
  if (!(e instanceof ErrorMeta) || e.frenado) return mensajeMeta(e);
  if (e.subcodigo === 1885272) return `Meta dice que el presupuesto es demasiado bajo${e.detalle ? `: ${e.detalle}` : '.'}`;
  const t = [e.titulo, e.detalle].filter(Boolean).join(': ');
  return t ? `Meta no lo acepta: ${t}` : mensajeMeta(e);
}
/** El mínimo que Meta pide, si lo escribe («al menos 100 centavos», «minimum budget … is $1.00»). POR VERIFICAR el texto real de v26. */
export function minimoDe(e, moneda = 'USD') {
  const t = `${e?.detalle || ''} ${e?.message || ''}`;
  const c = /(\d+)\s*(?:centavos|cents)/i.exec(t); if (c) return Number(c[1]) / offsetDe(moneda);
  const m = /(?:US\$|\$|USD\s?)\s?(\d+(?:[.,]\d{1,2})?)/i.exec(t); if (m) return Number(m[1].replace(',', '.'));
  return null;
}

/**
 * Qué cambia en Meta una acción sobre un objeto, y si se puede (puro). → { error: { status, cuerpo } } o
 * { writes: [{ id, nivel, campos }], revertir, copia, efectivo, antes, despues, valorUsd, finIso, aviso, porQueCero }.
 * r = buscar(vista, id) (con el objeto ya releído de Meta); raw = lo leído (configured_status).
 */
export function planear({ tipo, r, raw = null, valor, fin, inicio, copiar = false, moneda = 'USD', ahora = Date.now(), zona = null }) {
  const o = r.objeto, nivel = r.tipo, n = `«${o.nombre}»`, propio = propioRaw(raw, r), finAhora = finDe(r);
  const err = (status, motivo, extra = {}) => ({ error: { status, cuerpo: { error: status === 409 ? 'estado' : motivo, motivo, ...extra } } });
  const terminado = finAhora && (msDe(finAhora) ?? Infinity) <= ahora;
  const pres = presupuestoDe(o), antes = { estado: propio, ...(pres ? { presupuesto: pres } : {}), fin: finAhora };
  const w = campos => ({ id: o.id, nivel, campos });
  const porQueCero = nivel === 'anuncio' ? (APAGADO.has(r.conjunto?.estado) ? `su conjunto «${r.conjunto.nombre}» está en pausa` : APAGADO.has(r.campana?.estado) ? `su campaña «${r.campana.nombre}» está en pausa` : 'no tiene presupuesto que gastar')
    : nivel === 'conjunto' ? (APAGADO.has(r.campana?.estado) ? `su campaña «${r.campana.nombre}» está en pausa` : 'no tiene anuncios encendidos')
      : 'sus conjuntos están en pausa o no tienen anuncios encendidos';
  const base = { antes, porQueCero, efectivo: tipo };

  if (tipo === 'pausar') {
    if (propio !== 'ACTIVE') return err(409, `${n} ya está ${propio === 'PAUSED' ? 'en pausa' : 'archivada'}.`);
    return { ...base, writes: [w({ status: 'PAUSED' })], revertir: [w({ status: 'ACTIVE' })], despues: { ...antes, estado: 'PAUSED' } };
  }
  if (tipo === 'archivar') {
    if (propio === 'ARCHIVED' || propio === 'DELETED') return err(409, `${n} ya está archivada.`);
    return { ...base, writes: [w({ status: 'ARCHIVED' })], revertir: null, despues: { ...antes, estado: 'ARCHIVED' } };
  }
  if (tipo === 'activar' || tipo === 'reanudar' || (tipo === 'relanzar' && propio === 'PAUSED' && !terminado && !copiar)) {
    if (propio === 'ARCHIVED' || propio === 'DELETED') return err(409, `${n} está archivada: Meta no deja volver a encenderla. Usa «Relanzar», que hace una copia nueva en pausa.`);
    if (propio === 'ACTIVE') return err(409, `${n} ya está activa.`);
    if (terminado) return err(409, `${n} ya terminó (su fecha de fin pasó): alárgala o relánzala como copia.`);
    const aviso = EN_REVISION.has(o.estado) ? 'Está en revisión de Meta: se activa igual y saldrá cuando Meta lo apruebe.' : undefined;
    return { ...base, efectivo: tipo === 'relanzar' ? 'reanudar' : tipo, writes: [w({ status: 'ACTIVE' })], revertir: null, despues: { ...antes, estado: 'ACTIVE' }, ...(aviso ? { aviso } : {}) };
  }
  if (tipo === 'subir_presupuesto' || tipo === 'bajar_presupuesto') {
    if (nivel === 'anuncio') return err(400, `Un anuncio no tiene presupuesto propio: cambia el de su conjunto «${r.conjunto?.nombre}»${r.campana?.presupuesto?.usd != null ? ` o el de su campaña «${r.campana.nombre}»` : ''}.`);
    if (!pres) return err(400, nivel === 'campana' ? `${n} no tiene presupuesto de campaña: el presupuesto está en cada conjunto.` : `${n} no tiene presupuesto propio: lo lleva su campaña «${r.campana?.nombre}».`);
    const v = Number(valor);
    if (!Number.isFinite(v) || v <= 0 || v > 1e6) return err(400, `Falta el presupuesto nuevo (${pres.tipo === 'diario' ? 'al día' : 'en total'}), en ${moneda}.`);
    const nuevo = Math.round(v * offsetDe(moneda)) / offsetDe(moneda);
    if (tipo === 'bajar_presupuesto' && nuevo >= pres.usd) return err(400, `Bajar es a menos de ${dinero(pres.usd, moneda)} (lo de ahora).`);
    if (tipo === 'subir_presupuesto' && nuevo <= pres.usd) return err(400, `Subir es a más de ${dinero(pres.usd, moneda)} (lo de ahora).`);
    const campo = pres.tipo === 'diario' ? 'daily_budget' : 'lifetime_budget';
    let aviso;
    if (tipo === 'subir_presupuesto' && (nuevo - pres.usd) / pres.usd > SUBIDA_APRENDIZAJE + 1e-9) {
      const aprendiendo = nivel === 'conjunto' ? o.aprendizaje?.estado === 'LEARNING' : (o.conjuntos || []).some(s => s.aprendizaje?.estado === 'LEARNING');
      if (aprendiendo) aviso = `Sube un ${Math.round(((nuevo - pres.usd) / pres.usd) * 100)} % y ${nivel === 'conjunto' ? 'el conjunto está' : 'hay conjuntos'} aprendiendo: ${AVISO_APRENDIZAJE}.`;
    }
    return { ...base, valorUsd: nuevo, writes: [w({ [campo]: aMeta(nuevo, moneda) })], revertir: tipo === 'bajar_presupuesto' ? [w({ [campo]: aMeta(pres.usd, moneda) })] : null, despues: { ...antes, presupuesto: { tipo: pres.tipo, usd: nuevo } }, ...(aviso ? { aviso } : {}) };
  }
  if (tipo === 'alargar') {
    if (nivel === 'anuncio') return err(400, `Un anuncio no tiene fecha de fin: alarga su conjunto «${r.conjunto?.nombre}».`);
    const ms = msDe(fin);
    if (ms === null) return err(400, 'Falta la fecha de fin nueva (AAAA-MM-DD o con hora).');
    if (ms <= ahora) return err(400, 'La fecha de fin nueva ya pasó.');
    if (finAhora && ms <= (msDe(finAhora) ?? 0)) return err(400, `La fecha nueva tiene que ser después de la de ahora (${fechaCorta(msDe(finAhora), zona)}).`);
    const iso = isoMeta(ms), writes = [];
    if (nivel === 'conjunto') writes.push(w({ end_time: iso }));
    else {
      // POR VERIFICAR: que `stop_time` se pueda cambiar en una campaña de v26; la entrega la cortan los `end_time` de sus conjuntos.
      if (o.fin || !(o.conjuntos || []).length) writes.push(w({ stop_time: iso }));
      for (const s of o.conjuntos || []) if (!s.fin || (msDe(s.fin) ?? 0) < ms) writes.push({ id: s.id, nivel: 'conjunto', campos: { end_time: iso } });
    }
    return { ...base, finIso: iso, writes, revertir: null, despues: { ...antes, fin: iso } };
  }
  if (tipo === 'relanzar') {
    if (nivel !== 'campana') return err(400, `Solo se relanza como copia una campaña entera: elige su campaña «${r.campana?.nombre}».`);
    if (propio === 'ACTIVE' && !terminado && !copiar) return err(409, `${n} está activa: no hace falta relanzarla.`);
    const anuncios = (o.conjuntos || []).reduce((t, s) => t + (s.anuncios || []).length, 0);
    if (anuncios > MAX_ANUNCIOS_COPIA) return err(400, `${n} tiene ${anuncios} anuncios: la oficina copia hasta ${MAX_ANUNCIOS_COPIA}. Duplícala en el Administrador de anuncios.`);
    const i = inicio ? msDe(inicio) : ahora;
    if (i === null) return err(400, 'La fecha de inicio no se entiende (AAAA-MM-DD o con hora).');
    if (i < ahora - 5 * 60e3) return err(400, 'La fecha de inicio ya pasó.');
    const ini0 = msDe(o.inicio), fin0 = msDe(finAhora), dur = ini0 && fin0 && fin0 - ini0 >= 864e5 && fin0 - ini0 <= 90 * 864e5 ? fin0 - ini0 : DIAS_COPIA * 864e5;
    const f = fin ? msDe(fin) : i + dur;
    if (f === null || f <= i) return err(400, 'La fecha de fin de la copia tiene que ser después de su inicio.');
    return { ...base, copia: { inicio: isoMeta(Math.max(i, ahora)), fin: isoMeta(f), inicioMs: Math.max(i, ahora), finMs: f, anuncios, porPartes: anuncios > MAX_ANUNCIOS_SINCRONO }, writes: [], revertir: null, despues: { estado: 'PAUSED', copiaDe: o.id } };
  }
  return err(400, `«${tipo}» no es una acción de Anuncios.`);
}

/**
 * Dónde viven los tokens de confirmación (2 min, un solo uso) y los de deshacer. En la oficina local, en memoria. En Cloudflare (fase 7,
 * 25 oct 2026) el Worker no recuerda nada entre peticiones: los guarda D1 (cloudflare/worker/lib/tokens.js) con la MISMA interfaz, y
 * `tomar` es atómico (solo una petición se lleva el token). La interfaz puede ser asíncrona: aquí se espera siempre.
 *   poner(tipo, clave, valor, caduca) · leer(tipo, clave) · tomar(tipo, clave) (lo lee y lo quita; null si no está) · quitar(tipo, clave) ·
 *   limpiar(ahora) · cuenta()
 */
export function tokensEnMemoria() {
  const m = { conf: new Map(), desh: new Map() };
  return {
    poner: (tipo, k, v, caduca) => { m[tipo].set(k, { v, caduca }); },
    leer: (tipo, k) => m[tipo].get(k)?.v ?? null,
    tomar: (tipo, k) => { const e = m[tipo].get(k); m[tipo].delete(k); return e?.v ?? null; },
    quitar: (tipo, k) => { m[tipo].delete(k); },
    limpiar: ahora => { for (const t of Object.values(m)) for (const [k, e] of t) if (e.caduca <= ahora) t.delete(k); },
    cuenta: () => ({ confirmaciones: m.conf.size, deshaceres: m.desh.size }),
  };
}

/**
 * @param {object} o
 * @param {object} o.sync         anuncios/sincronizar.mjs (vista, listo, topes, hoy, ponerObjeto, anotar, sincronizar)
 * @param {object} o.ads          anuncios/meta-ads.mjs (leer, cambiar, copiar)
 * @param {Function} o.undoSeconds () → segundos para deshacer (approvals.undoSeconds)
 * @param {Function} o.auditar    (entrada) → data/audit/ (serve.mjs)
 * @param {Function} o.refrescar  () → relee la estructura entera (un lote), sin esperar: lo de debajo de una campaña cambió de estado
 */
export function crearAcciones({ sync, ads, ahora = () => Date.now(), undoSeconds = () => 30, auditar = () => {}, refrescar = () => {}, confirmarMs = CONFIRMAR_MS, tokens = null }) {
  const T = tokens || tokensEnMemoria();
  let cola = Promise.resolve();
  /** Una acción a la vez: dos clics seguidos (o la página y Telegram a la vez) no se pisan. */
  const enFila = fn => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };
  const limpiar = () => T.limpiar(ahora());
  const R = (status, cuerpo) => ({ status, cuerpo });
  const token = () => crypto.randomBytes(9).toString('base64url');

  /** El objeto tal como está AHORA en Meta (y en cuenta.json), con la vista recalculada. */
  async function fresco(id) {
    const r0 = buscar(sync.vista('7d'), id);
    if (!r0) return { error: R(404, { error: `No hay ninguna campaña, conjunto ni anuncio con el id ${id} en lo leído de Meta: pulsa «Actualizar» en Anuncios.` }) };
    let raw;
    try { raw = await ads.leer(id, r0.tipo); } catch (e) { return { error: R(422, { error: 'meta', motivo: `No pude leer «${r0.objeto.nombre}» de Meta antes de cambiarlo: ${mensajeMeta(e)}` }) }; }
    try { sync.ponerObjeto(r0.tipo, raw); } catch { /* lo de antes sigue */ }
    const v = sync.vista('7d');
    return { v, r: buscar(v, id) || r0, raw };
  }
  async function releer(writes) {
    for (const w of writes) { try { sync.ponerObjeto(w.nivel, await ads.leer(w.id, w.nivel)); } catch { /* la próxima lectura lo trae */ } }
  }
  const objetoDe = r => ({ id: r.objeto.id, nivel: r.tipo, nombre: r.objeto.nombre });

  /** La copia de una campaña, entera o por partes. `validar`: solo la primera llamada, con validate_only (no crea nada). */
  async function copiarCampana(r, copia, { validar = false, rid = '' } = {}) {
    const c = r.objeto, base = { status_option: 'PAUSED', rename_options: { rename_strategy: 'NO_RENAME' } }, fechas = { start_time: copia.inicio, end_time: copia.fin };
    if (!copia.porPartes) {
      const x = await ads.copiar(c.id, { deep_copy: true, ...base, ...fechas }, { validar });
      return validar ? null : { campana: x?.copied_campaign_id, llamadas: 1 };
    }
    if (validar) { await ads.copiar(c.id, { deep_copy: false, ...base }, { validar: true }); return null; }
    const x = await ads.copiar(c.id, { deep_copy: false, ...base }), nueva = x?.copied_campaign_id; let llamadas = 1;
    if (!nueva) throw new ErrorMeta({ message: 'Meta no devolvió la campaña copiada' }, 0);
    for (const s of c.conjuntos || []) {
      const hijos = s.anuncios || [];
      if (hijos.length <= MAX_ANUNCIOS_SINCRONO) { await ads.copiar(s.id, { campaign_id: nueva, deep_copy: true, ...base, ...fechas }); llamadas++; continue; }
      const y = await ads.copiar(s.id, { campaign_id: nueva, deep_copy: false, ...base, ...fechas }); llamadas++;
      const conj = y?.copied_adset_id; if (!conj) throw new ErrorMeta({ message: `Meta no devolvió la copia del conjunto ${s.id}` }, 0);
      for (const a of hijos) { await ads.copiar(a.id, { adset_id: conj, status_option: 'PAUSED', rename_options: base.rename_options }); llamadas++; }
    }
    return { campana: nueva, llamadas, rid };
  }

  function textoConfirmar(tipo, p, r, t, moneda, zona) {
    const d = v => dinero(v, moneda), n = `«${r.objeto.nombre}»`, c = t?.cifras || { dia: 0, semana: 0 };
    const gasta = c.dia > 0 ? `gasta hasta ${d(c.dia)} al día, ${d(c.semana)} esta semana` : `no gasta todavía: ${p.porQueCero}`;
    if (p.copia) return `Relanzar ${n} como copia EN PAUSA (del ${fechaCorta(p.copia.inicioMs, zona)} al ${fechaCorta(p.copia.finMs, zona)}) — no gasta nada hasta que la actives; entonces, hasta ${d(p.diarioCopia)} al día`;
    if (tipo === 'relanzar') return `Relanzar ${n} (sigue donde se pausó) — ${gasta}`;
    if (tipo === 'subir_presupuesto') return `Subir el presupuesto de ${n} de ${d(p.antes.presupuesto.usd)} a ${d(p.valorUsd)} ${p.antes.presupuesto.tipo === 'diario' ? 'al día' : 'en total'} — ${gasta}`;
    if (tipo === 'alargar') { const mas = (t?.totales?.despues?.campana ?? 0) - (t?.totales?.antes?.campana ?? 0); return `Alargar ${n} hasta el ${fechaCorta(msDe(p.finIso), zona)} — ${gasta}${mas > 0.004 && mas !== Infinity ? `, hasta ${d(mas)} más en total` : ''}`; }
    return `${VERBO[tipo]} ${n} — ${gasta}`;
  }
  function textoHecho(tipo, p, r, moneda, zona, extra = {}) {
    const d = v => dinero(v, moneda), n = `«${r.objeto.nombre}» (${NIVEL[r.tipo]})`;
    if (tipo === 'pausar') return `En pausa: ${n}. Deja de gastar.`;
    if (tipo === 'archivar') return `Archivado: ${n}. No se puede deshacer: en Meta lo archivado no se vuelve a encender (sí se puede relanzar como copia).`;
    if (tipo === 'bajar_presupuesto' || tipo === 'subir_presupuesto') return `Presupuesto de ${n}: de ${d(p.antes.presupuesto.usd)} a ${d(p.valorUsd)} ${p.antes.presupuesto.tipo === 'diario' ? 'al día' : 'en total'}.`;
    if (tipo === 'alargar') return `${n} sigue hasta el ${fechaCorta(msDe(p.finIso), zona)}.`;
    if (p.copia) return `Copia de ${n} creada EN PAUSA (id ${extra.copia || '—'}), del ${fechaCorta(p.copia.inicioMs, zona)} al ${fechaCorta(p.copia.finMs, zona)}. Actívala cuando quieras: eso gasta y te pide los dos clics.`;
    return `${tipo === 'activar' ? 'Activado' : 'Reanudado'}: ${n}${extra.dia > 0 ? `. Gasta hasta ${d(extra.dia)} al día.` : `. ${p.porQueCero ? `No gasta todavía: ${p.porQueCero}.` : ''}`}`;
  }

  /**
   * POST /api/anuncios/accion { tipo, id, valor?, fin?, inicio?, copiar?, confirmacion?, por? } → { status, cuerpo } (el contrato de
   * anuncios/rutas.mjs).
   */
  async function accion(b = {}) {
    const quien = quienDe(b.por), tipo = String(b.tipo || ''), id = String(b.id || '');
    if (quien === 'agente' || quien === 'otro') return R(403, { error: 'Los agentes leen los anuncios y dejan sugerencias; cambiar algo en Meta es del dueño.' });
    if (!TIPOS.includes(tipo)) return R(400, { error: `«${tipo.slice(0, 40)}» no es una acción de Anuncios (${TIPOS.join(', ')}).` });
    if (!/^[A-Za-z0-9_]{1,40}$/.test(id)) return R(400, { error: 'Falta el id de la campaña, el conjunto o el anuncio.' });
    const gasto = DE_GASTO.includes(tipo);
    if (gasto && (quien === 'asistente' || quien === 'piloto')) return R(403, { error: `«${VERBO[tipo]}» gasta dinero: solo el dueño lo hace, con dos clics, en Anuncios (J) o en Telegram. Desde aquí se puede pausar, bajar un presupuesto o archivar.` });
    if (b.confirmacion && quien !== 'dueno') return R(403, { error: 'Confirmar un gasto lo hace el dueño: el segundo clic es suyo (en Anuncios, en la tarjeta de Dimitri o en Telegram).' });
    return enFila(() => hacer({ ...b, tipo, id, quien, gasto }));
  }

  async function hacer(b) {
    await limpiar();
    let conf = null;
    if (b.gasto && b.confirmacion) { // el token primero: es barato y no gasta cuota de Meta
      const k = String(b.confirmacion), c = await T.tomar('conf', k); // de un solo uso, también si lo de abajo falla (tomar lo quita; en D1, atómico)
      if (!c) return R(409, { error: 'confirmacion', motivo: 'Esa confirmación no existe o ya se usó: vuelve a pedirla para ver la cifra de ahora.' });
      if (c.vence <= ahora()) return R(409, { error: 'confirmacion', motivo: `La confirmación venció (dura ${Math.round(confirmarMs / 60e3)} minutos): vuelve a pedirla para ver la cifra de ahora.` });
      if (c.firma !== firmaDe(b)) return R(409, { error: 'confirmacion', motivo: 'Esa confirmación es de otra acción (otro objeto, otro importe u otra fecha): pide la de esta.' });
      conf = c;
    }
    const l = sync.listo(); if (!l.ok) return R(409, { error: 'conexion', motivo: l.motivo });
    const f = await fresco(b.id); if (f.error) return f.error;
    const { v, r, raw } = f, moneda = v.cuenta?.moneda || 'USD', zona = v.cuenta?.zona || null, objeto = objetoDe(r);
    const p = planear({ tipo: b.tipo, r, raw, valor: b.valor, fin: b.fin, inicio: b.inicio, copiar: Boolean(b.copiar), moneda, ahora: ahora(), zona });
    if (p.error) return R(p.error.status, p.error.cuerpo);
    const avisos = p.aviso ? [p.aviso] : [];
    const fallo = (status, cuerpo) => { auditar({ quien: b.quien, que: b.tipo, objeto, ok: false, motivo: cuerpo.motivo || cuerpo.error }); return R(status, cuerpo); };

    // los topes: lo que gasta YA (una copia nace en pausa: se mira al activarla, y aquí solo se avisa)
    let t = null;
    if (b.gasto && !p.copia) {
      t = evaluar({ vista: v, tipo: p.efectivo, id: b.id, valor: p.valorUsd, fin: p.finIso, topes: sync.topes(), hoy: sync.hoy(), ahora: ahora() });
      if (!t.ok) return fallo(409, { error: 'tope', motivo: t.motivo, cual: t.cual, tope: t.tope, quedaria: t.quedaria, cifras: t.cifras });
    }
    if (p.copia) {
      p.diarioCopia = diarioDeCampana(v, b.id);
      const tt = sync.topes(), hoyDia = evaluar({ vista: v, tipo: 'pausar', id: b.id, topes: tt, hoy: sync.hoy(), ahora: ahora() }).totales?.antes?.dia ?? 0; // lo que ya entrega hoy
      if (hoyDia + p.diarioCopia > (Number(tt.diario) || 0) + 1e-9) avisos.push(`Al activarla pasaría el tope diario (${dinero(hoyDia + p.diarioCopia, moneda)} al día contra ${dinero(Number(tt.diario) || 0, moneda)}): baja su presupuesto o pausa otra antes.`);
      if (p.copia.porPartes) avisos.push(`Tiene ${p.copia.anuncios} anuncios y Meta copia de una vez como mucho ${MAX_ANUNCIOS_SINCRONO}: se copia por partes.`);
    }

    // Meta lo revisa primero (validate_only: no cambia nada)
    try { if (p.copia) await copiarCampana(r, p.copia, { validar: true }); else for (const w of p.writes) await ads.cambiar(w.id, w.campos, { validar: true }); }
    catch (e) { const minimo = minimoDe(e, moneda); return fallo(422, { error: 'meta', motivo: motivoMeta(e), ...(minimo !== null ? { minimo } : {}) }); }

    // de gasto, primera llamada: nada cambia; la cifra y el token para el segundo clic
    if (b.gasto && !conf) {
      const k = token(), vence = ahora() + confirmarMs;
      await T.poner('conf', k, { firma: firmaDe(b), vence, pidio: b.quien, tipo: b.tipo, id: b.id }, vence + 10 * 60e3);
      const cifras = p.copia ? { dia: 0, semana: 0, mes: 0, campana: 0, alActivar: p.diarioCopia } : t.cifras;
      return R(200, { confirmar: { token: k, texto: textoConfirmar(b.tipo, p, r, t, moneda, zona), cifras, vence: new Date(vence).toISOString(), tipo: b.tipo, id: b.id, ...(p.valorUsd !== undefined ? { valor: p.valorUsd } : {}), ...(p.finIso ? { fin: p.finIso } : {}), objeto, moneda }, ...(avisos.length ? { aviso: avisos.join(' ') } : {}) });
    }

    // aplicar
    const hechos = []; let copia = null;
    try {
      if (p.copia) {
        const rid = 'r' + ahora().toString(36);
        copia = await copiarCampana(r, p.copia, { rid });
        if (copia?.campana) { try { await ads.cambiar(copia.campana, { name: conEtiqueta(r.objeto.nombre, rid) }); } catch (e) { avisos.push(`La copia se creó pero no pude ponerle el nombre con la etiqueta de la oficina: ${motivoMeta(e)}`); } }
      } else for (const w of p.writes) { await ads.cambiar(w.id, w.campos); hechos.push(w); }
    } catch (e) {
      if (hechos.length) { const parte = { quien: b.quien, que: b.tipo, objeto, antes: p.antes, despues: { ...p.despues, enParte: hechos.map(w => w.id) } }; sync.anotar(parte); auditar({ ...parte, ok: false }); await releer(hechos); }
      return fallo(422, { error: 'meta', motivo: `Meta no lo aplicó: ${motivoMeta(e)}${hechos.length ? ` (se cambió en parte: ${hechos.map(w => w.id).join(', ')})` : ''}` });
    }
    await releer(p.writes);
    if (p.copia) { try { await sync.sincronizar({ cifras: false }); } catch { /* la próxima lectura la trae */ } if (copia?.campana) try { sync.ponerObjeto('campana', await ads.leer(copia.campana, 'campana')); } catch { /* idem */ } }
    else if (r.tipo !== 'anuncio' && p.writes.some(w => w.campos.status)) refrescar(); // sus conjuntos o anuncios cambian de estado efectivo

    const r2 = buscar(sync.vista('7d'), b.id);
    if ((p.efectivo === 'activar' || p.efectivo === 'reanudar') && r2 && EN_REVISION.has(r2.objeto.estado) && !avisos.some(a => /revisión/.test(a))) avisos.push('Está en revisión de Meta: ya está activado y saldrá cuando Meta lo apruebe.');
    const entrada = { quien: b.quien, ...(conf && conf.pidio !== b.quien ? { propuso: conf.pidio } : {}), que: b.tipo, objeto, antes: p.antes, despues: { ...p.despues, ...(copia?.campana ? { copia: copia.campana } : {}) } };
    sync.anotar(entrada); auditar({ ...entrada, ok: true });

    let deshacer = null;
    const seg = Math.max(0, Number(undoSeconds()) || 0);
    if (p.revertir && seg > 0 && (b.quien === 'dueno' || b.quien === 'dimitri')) {
      const k = token(), hasta = ahora() + seg * 1000;
      await T.poner('desh', k, { tipo: b.tipo, id: b.id, objeto, antes: p.antes, despues: p.despues, revertir: p.revertir, hasta }, hasta);
      deshacer = { token: k, hasta: new Date(hasta).toISOString() };
    }
    const texto = textoHecho(b.tipo === 'relanzar' && !p.copia ? 'reanudar' : b.tipo, p, r, moneda, zona, { copia: copia?.campana, dia: t?.cifras?.dia });
    return R(200, { ok: true, hecho: { tipo: b.tipo, id: b.id, antes: p.antes, despues: entrada.despues, texto, objeto }, deshacer, ...(avisos.length ? { aviso: avisos.join(' ') } : {}) });
  }

  /** POST /api/anuncios/deshacer { token, por? }: pausar y bajar, durante undoSeconds. Volver a como estaba vuelve a gastar: solo el dueño, y dentro de los topes. */
  async function deshacer(b = {}) {
    const quien = quienDe(b.por);
    if (quien !== 'dueno') return R(403, { error: quien === 'agente' || quien === 'otro' ? 'Los agentes no cambian nada en Meta.' : 'Deshacer una pausa o una bajada vuelve a gastar: lo hace el dueño, en Anuncios (J), en Telegram o en la tarjeta de Dimitri.' });
    return enFila(async () => {
      const k = String(b.token || ''), d = await T.leer('desh', k);
      if (!d) { await limpiar(); return R(409, { error: 'deshacer', motivo: 'Eso ya no se puede deshacer: pasó el tiempo, ya se deshizo o la oficina se reinició.' }); }
      if (d.hasta <= ahora()) { await T.quitar('desh', k); return R(409, { error: 'deshacer', motivo: `Pasó el tiempo para deshacerlo (${Number(undoSeconds()) || 0} s): cámbialo en Anuncios.` }); }
      const l = sync.listo(); if (!l.ok) return R(409, { error: 'conexion', motivo: l.motivo });
      const f = await fresco(d.id); if (f.error) return f.error;
      const { v, r, raw } = f, moneda = v.cuenta?.moneda || 'USD', propio = propioRaw(raw, r), pres = presupuestoDe(r.objeto);
      if (d.tipo === 'pausar' && propio !== 'PAUSED') { await T.quitar('desh', k); return R(409, { error: 'deshacer', motivo: `«${r.objeto.nombre}» ya no está en pausa: alguien lo cambió después.` }); }
      if (d.tipo === 'bajar_presupuesto' && (!pres || Math.abs(pres.usd - d.despues.presupuesto.usd) > 0.004)) { await T.quitar('desh', k); return R(409, { error: 'deshacer', motivo: `El presupuesto de «${r.objeto.nombre}» cambió después: ya no se deshace solo.` }); }
      const t = evaluar({ vista: v, tipo: d.tipo === 'pausar' ? 'reanudar' : 'subir_presupuesto', id: d.id, valor: d.antes.presupuesto?.usd, topes: sync.topes(), hoy: sync.hoy(), ahora: ahora(), verbo: d.tipo === 'pausar' ? 'Deshacer la pausa' : 'Deshacer la bajada' });
      if (!t.ok) { auditar({ quien, que: 'deshacer:' + d.tipo, objeto: d.objeto, ok: false, motivo: t.motivo }); return R(409, { error: 'tope', motivo: t.motivo, cual: t.cual, tope: t.tope, quedaria: t.quedaria, cifras: t.cifras }); }
      try { for (const w of d.revertir) await ads.cambiar(w.id, w.campos, { validar: true }); for (const w of d.revertir) await ads.cambiar(w.id, w.campos); }
      catch (e) { auditar({ quien, que: 'deshacer:' + d.tipo, objeto: d.objeto, ok: false, motivo: motivoMeta(e) }); return R(422, { error: 'meta', motivo: motivoMeta(e) }); }
      await T.quitar('desh', k);
      await releer(d.revertir); if (d.objeto.nivel !== 'anuncio' && d.tipo === 'pausar') refrescar();
      const entrada = { quien, que: 'deshacer:' + d.tipo, objeto: d.objeto, antes: d.despues, despues: d.antes };
      sync.anotar(entrada); auditar({ ...entrada, ok: true });
      return R(200, { ok: true, hecho: { tipo: 'deshacer', id: d.id, antes: d.despues, despues: d.antes, texto: `Deshecho: «${d.objeto.nombre}» vuelve a como estaba.`, objeto: d.objeto } });
    });
  }

  return { accion, deshacer, TIPOS, LIBRES, DE_GASTO, pendientes: () => T.cuenta() };
}

// ============================================================
// Agents Office — Anuncios de Meta, Fase A2 (9 oct 2026): LOS TOPES DE GASTO. Puro: sin red, sin disco, sin reloj propio (la hora entra).
// docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §3.4 (la regla del dinero, que no se negocia).
//
// Con la vista de la cuenta (lo que contesta GET /api/anuncios: campañas → conjuntos → anuncios, con su estado, presupuesto y fin) y UNA
// acción propuesta, calcula lo que gastaría como mucho —al día, esta semana (hasta el domingo o hasta su fin), en lo que queda de mes y
// en total para esa campaña— y lo compara con los tres topes de Ajustes → Anuncios:
//   · topeDiario   la suma de los presupuestos diarios de lo que entrega, con lo nuevo;
//   · topeMensual  lo gastado este mes MÁS lo comprometido hasta fin de mes;
//   · topeCampana  lo máximo que puede gastar una campaña desde ahora (con el `spend_cap` de Meta, si lo tiene, como techo).
// Si no cabe: { ok: false, motivo } con la cifra, en palabras. Un tope 0 (o que falta) = no se puede gastar nada.
//
// SIEMPRE HACIA ARRIBA: nunca redondea a favor de gastar. Por eso:
//   · un presupuesto total (lifetime) compromete lo que le QUEDA (o el total si Meta no dijo cuánto queda), repartido hasta su fin;
//   · lo gastado hoy cuenta en el mes Y además el presupuesto entero de hoy (se cuenta dos veces: mejor de más que de menos);
//   · el día de fin cuenta entero, aunque la campaña acabe a las 00:00;
//   · un conjunto del que no se leyeron anuncios cuenta como que entrega;
//   · una campaña con presupuesto diario, sin fecha de fin y sin `spend_cap` gastaría sin límite: no cabe en el tope por campaña.
// Meta puede gastar hasta un 75 % más que el presupuesto diario un día concreto, sin pasar de 7 veces el diario en la semana (POR
// VERIFICAR la regla de 2026): los topes de la oficina comparan PRESUPUESTOS (plan §3.4), y el `spend_cap` de cada campaña es el
// segundo candado en Meta.
// ============================================================
import { fechaEn } from './modelo.mjs';

/** Lo que está apagado por sí mismo (CAMPAIGN_PAUSED o ADSET_PAUSED, en cambio, está encendido y lo para su padre). */
export const APAGADO = new Set(['PAUSED', 'ARCHIVED', 'DELETED']);

/** Hacia arriba, al centavo (15 × 7 = 105, no 105.00000001 → 105.01). */
export const arriba = v => (v === Infinity ? Infinity : Math.ceil(Math.round(v * 1e6) / 1e4 - 1e-7) / 100 + 0); // + 0: nunca «-0»
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Un instante de Meta («2026-10-20T00:00:00-0500») → ms; null si no se puede leer. */
export function msDe(iso) {
  if (iso === null || iso === undefined || iso === '' || iso === 0 || iso === '0') return null;
  if (typeof iso === 'number') return iso > 1e11 ? iso : iso * 1000;
  const t = Date.parse(String(iso).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isFinite(t) ? t : null;
}
const entre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

/** Cuántos días le quedan (hoy incluido, el día de fin incluido) a algo que termina en `fin`. Sin fin: Infinity. Ya terminó: 0. */
export function diasHasta(hoy, fin, { zona = null, ahora = null } = {}) {
  const ms = msDe(fin); if (ms === null) return Infinity;
  if (ahora !== null && ms <= ahora) return 0;
  const f = fechaEn(zona, ms); return f < hoy ? 0 : entre(hoy, f) + 1;
}
/** Los días de esta semana que quedan, hoy incluido, hasta el domingo (lunes → 7, domingo → 1). */
export const diasSemana = hoy => { const d = new Date(hoy + 'T12:00:00Z').getUTCDay(); return d === 0 ? 1 : 8 - d; };
/** Los días de este mes que quedan, hoy incluido. */
export const diasMes = hoy => { const [y, m, d] = hoy.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1; };

/** Dinero para el dueño: «US$15», «US$4.80», «COP 12000». */
export function dinero(v, moneda = 'USD') {
  if (v === null || v === undefined) return 'sin dato';
  if (v === Infinity) return 'sin límite';
  const r = Math.round(v * 100) / 100, t = Number.isInteger(r) ? String(r) : r.toFixed(2);
  return moneda === 'USD' ? `US$${t}` : `${moneda} ${t}`;
}

// ---------------------------------------------------------------- el árbol: lo que importa para gastar

const propio = e => (APAGADO.has(e) ? e : 'ACTIVE');
/** De la vista, lo justo: estado propio, presupuesto (con lo que le queda si es total), fin, `spend_cap`. Una copia: se puede cambiar. */
export function arbol(vista) {
  return (vista?.campanas || []).map(c => ({
    id: c.id, nombre: c.nombre, nivel: 'campana', propio: propio(c.estado), presupuesto: { ...(c.presupuesto || {}) }, fin: c.fin || null, spendCap: num(c.spendCap),
    conjuntos: (c.conjuntos || []).map(s => ({
      id: s.id, nombre: s.nombre, nivel: 'conjunto', propio: propio(s.estado), presupuesto: { ...(s.presupuesto || {}) }, fin: s.fin || null, aprendizaje: s.aprendizaje?.estado || null,
      anuncios: (s.anuncios || []).map(a => ({ id: a.id, nombre: a.nombre, nivel: 'anuncio', propio: propio(a.estado), rechazado: a.estado === 'DISAPPROVED' })),
    })),
  }));
}
/** { nodo, campana, conjunto } del id, o null. */
export function nodoDe(arb, id) {
  for (const c of arb) {
    if (c.id === id) return { nodo: c, campana: c, conjunto: null };
    for (const s of c.conjuntos) {
      if (s.id === id) return { nodo: s, campana: c, conjunto: s };
      for (const a of s.anuncios) if (a.id === id) return { nodo: a, campana: c, conjunto: s };
    }
  }
  return null;
}

/**
 * Cambia el árbol como lo dejaría la acción (sobre una copia). cambio: { id, estado?, presupuesto? (en la moneda), fin? (ISO) }.
 * Alargar una campaña alarga también sus conjuntos que acaban antes (como lo hace anuncios/acciones.mjs).
 */
export function aplicar(arb, cambio) {
  const x = nodoDe(arb, cambio.id); if (!x) return arb;
  const n = x.nodo;
  if (cambio.estado) n.propio = cambio.estado;
  if (cambio.presupuesto !== undefined && cambio.presupuesto !== null && n.presupuesto) {
    const p = n.presupuesto, nuevo = Number(cambio.presupuesto);
    n.presupuesto = { ...p, usd: nuevo, ...(p.tipo === 'total' && num(p.restante) !== null ? { restante: Math.max(0, p.restante + (nuevo - (p.usd ?? 0))) } : {}) };
  }
  if (cambio.fin) {
    n.fin = cambio.fin;
    if (n.nivel === 'campana') for (const s of n.conjuntos) if (s.fin && (msDe(s.fin) ?? 0) < (msDe(cambio.fin) ?? 0)) s.fin = cambio.fin;
  }
  return arb;
}

/**
 * Las «bolsas» de presupuesto: cada campaña con presupuesto propio (CBO), o cada conjunto con el suyo. `gasta`: si entrega (ella y sus
 * padres encendidos, sin terminar, y con algún anuncio que entrega). `ids`: los objetos cuyo cambio la toca.
 */
export function bolsas(arb, { hoy, zona = null, ahora = null } = {}) {
  const out = [], dias = fin => diasHasta(hoy, fin, { zona, ahora });
  const conAnuncio = s => !s.anuncios.length || s.anuncios.some(a => a.propio === 'ACTIVE' && !a.rechazado);
  for (const c of arb) {
    const cOn = c.propio === 'ACTIVE';
    const sOn = s => s.propio === 'ACTIVE' && dias(s.fin || c.fin) > 0 && conAnuncio(s);
    if (num(c.presupuesto?.usd) !== null) {
      const fines = c.conjuntos.map(s => s.fin);
      const fin = c.fin || (fines.length && fines.every(Boolean) ? fines.reduce((a, b) => ((msDe(a) ?? 0) >= (msDe(b) ?? 0) ? a : b)) : null);
      const ids = new Set([c.id, ...c.conjuntos.flatMap(s => [s.id, ...s.anuncios.map(a => a.id)])]);
      out.push({ campana: c.id, ids, tipo: c.presupuesto.tipo, usd: Number(c.presupuesto.usd), restante: num(c.presupuesto.restante), dias: dias(fin), gasta: cOn && dias(fin) > 0 && (!c.conjuntos.length || c.conjuntos.some(sOn)) });
    } else {
      for (const s of c.conjuntos) {
        if (num(s.presupuesto?.usd) === null) continue;
        const ids = new Set([c.id, s.id, ...s.anuncios.map(a => a.id)]);
        out.push({ campana: c.id, ids, tipo: s.presupuesto.tipo, usd: Number(s.presupuesto.usd), restante: num(s.presupuesto.restante), dias: dias(s.fin || c.fin), gasta: cOn && sOn(s) });
      }
    }
  }
  return out;
}
/** Lo que una bolsa gasta como mucho en los próximos `n` días (hoy incluido); Infinity si no tiene fin. */
export function uso(b, n) {
  if (b.dias <= 0) return 0;
  if (b.tipo === 'total') { const q = b.restante ?? b.usd; return b.dias === Infinity ? q : q * Math.min(n, b.dias) / b.dias; }
  const d = Math.min(n, b.dias); return d === Infinity ? Infinity : b.usd * d;
}
/** Lo de un día: el diario, o lo que queda de un total repartido hasta su fin (sin fin, todo en un día). */
export const porDia = b => (b.dias <= 0 ? 0 : b.tipo === 'total' ? (b.restante ?? b.usd) / (b.dias === Infinity ? 1 : b.dias) : b.usd);

/** Sumas por campaña (con su `spend_cap` como techo de cada periodo) de las bolsas que gastan. */
function sumas(lista, arb, ctx) {
  const cap = new Map(arb.map(c => [c.id, c.spendCap ?? Infinity])), por = new Map();
  for (const b of lista.filter(x => x.gasta)) { const l = por.get(b.campana) || []; l.push(b); por.set(b.campana, l); }
  let dia = 0, semana = 0, mes = 0; const campana = new Map();
  for (const [id, l] of por) {
    const techo = cap.get(id) ?? Infinity, s = f => Math.min(l.reduce((t, b) => t + f(b), 0), techo);
    dia += s(porDia); semana += s(b => uso(b, ctx.semana)); mes += s(b => uso(b, ctx.mes)); campana.set(id, s(b => uso(b, Infinity)));
  }
  return { dia: arriba(dia), semana: arriba(semana), mes: arriba(mes), campana };
}

// ---------------------------------------------------------------- la acción contra los topes

/** Cómo deja cada tipo el objeto, para los topes. */
export function cambioDe(tipo, { valor, fin } = {}) {
  if (['activar', 'reanudar', 'relanzar'].includes(tipo)) return { estado: 'ACTIVE' };
  if (tipo === 'pausar') return { estado: 'PAUSED' };
  if (tipo === 'archivar') return { estado: 'ARCHIVED' };
  if (tipo === 'subir_presupuesto' || tipo === 'bajar_presupuesto') return { presupuesto: Number(valor) };
  if (tipo === 'alargar') return { fin };
  return {};
}
export const VERBO = { activar: 'Activar', reanudar: 'Reanudar', subir_presupuesto: 'Subir el presupuesto', alargar: 'Alargar la fecha de fin', relanzar: 'Relanzar', pausar: 'Pausar', bajar_presupuesto: 'Bajar el presupuesto', archivar: 'Archivar' };

/**
 * ¿Cabe la acción en los topes?
 * @param {object} o
 * @param {object} o.vista   GET /api/anuncios (campanas, gasto.mes, cuenta.moneda y zona)
 * @param {string} o.tipo    activar · reanudar · subir_presupuesto · alargar · relanzar (y las libres, que solo se miden)
 * @param {string} o.id      la campaña, el conjunto o el anuncio
 * @param {number} [o.valor] el presupuesto nuevo (en la moneda)
 * @param {string} [o.fin]   la fecha de fin nueva (ISO)
 * @param {object} o.topes   { diario, mensual, campana } en la moneda
 * @param {string} o.hoy     'AAAA-MM-DD' en la zona de la cuenta
 * @param {number} [o.ahora] ms (para saber qué ya terminó)
 * @param {string} [o.verbo] cómo empieza el motivo («Deshacer la pausa»…)
 * @returns {{ ok, motivo, cual, tope, quedaria, cifras: { dia, semana, mes, campana }, totales }}
 */
export function evaluar({ vista, tipo, id, valor, fin, topes = {}, hoy, ahora = null, verbo = null } = {}) {
  const moneda = vista?.cuenta?.moneda || 'USD', d = v => dinero(v, moneda), V = verbo || VERBO[tipo] || tipo;
  const zona = vista?.cuenta?.zona || null, ctx = { hoy, zona, ahora, semana: diasSemana(hoy), mes: diasMes(hoy) };
  const arb0 = arbol(vista), x = nodoDe(arb0, id);
  if (!x) return { ok: false, motivo: `No hay ninguna campaña, conjunto ni anuncio con el id ${id} en lo leído de Meta.`, cual: null, cifras: null };
  const arb1 = aplicar(structuredClone(arb0), { id, ...cambioDe(tipo, { valor, fin }) });
  const b1 = bolsas(arb1, ctx), despues = sumas(b1, arb1, ctx), antes = sumas(bolsas(arb0, ctx), arb0, ctx);
  // lo de ESTA acción: las bolsas que toca el objeto (la de su conjunto o su campaña, o las que cuelgan de él)
  const propias = sumas(b1.filter(b => b.ids.has(id)), arb1, ctx);
  const campId = x.campana.id, campTotal = despues.campana.get(campId) ?? 0;
  const cifras = { dia: propias.dia, semana: propias.semana, mes: propias.mes, campana: propias.campana.get(campId) ?? 0 };
  const gastado = num(vista?.gasto?.mes), mesTotal = gastado === null ? null : arriba(gastado + despues.mes);
  const totales = { antes: { dia: antes.dia, mes: antes.mes, campana: antes.campana.get(campId) ?? 0 }, despues: { dia: despues.dia, mes: mesTotal, comprometidoMes: despues.mes, campana: campTotal } };
  const T = k => { const t = num(topes?.[k]); return t === null || t < 0 ? 0 : t; };
  const no = (cual, motivo, quedaria) => ({ ok: false, motivo, cual, tope: T(cual), quedaria, cifras, totales });
  const cero = t => (t === 0 ? ' (un tope 0 en Ajustes → Anuncios quiere decir «no gastar»)' : '');

  if (despues.dia > T('diario') + 1e-9) return no('diario', `${V} pasaría el tope diario: ${d(despues.dia)} al día contra ${d(T('diario'))}${cero(T('diario'))}.`, despues.dia);
  if (despues.mes > 0) { // con nada comprometido no hay qué comprobar (activar un anuncio de un conjunto en pausa no gasta)
    if (mesTotal === null) return no('mensual', `${V}: todavía no se leyeron de Meta las cifras de este mes y sin ellas no se puede comprobar el tope mensual (${d(T('mensual'))}). Pulsa «Actualizar» en Anuncios y vuelve a intentarlo.`, null);
    if (mesTotal > T('mensual') + 1e-9) return no('mensual', `${V} pasaría el tope mensual: ${d(mesTotal)} este mes (${d(gastado)} ya gastados + ${d(despues.mes)} comprometidos hasta fin de mes) contra ${d(T('mensual'))}${cero(T('mensual'))}.`, mesTotal);
  }
  if (campTotal === Infinity) return no('campana', `${V} dejaría «${x.campana.nombre}» gastando sin límite: no tiene fecha de fin ni tope de gasto en Meta, y el tope por campaña es ${d(T('campana'))}. Ponle una fecha de fin.`, Infinity);
  if (campTotal > T('campana') + 1e-9) return no('campana', `${V} pasaría el tope por campaña: hasta ${d(campTotal)} en total para «${x.campana.nombre}» contra ${d(T('campana'))}${cero(T('campana'))}.`, campTotal);
  return { ok: true, motivo: '', cual: null, tope: null, quedaria: null, cifras, totales };
}

/** Lo que gastaría al día una campaña si se encendiera entera con sus presupuestos de ahora (para el texto de una copia en pausa). */
export function diarioDeCampana(vista, id) {
  const c = (vista?.campanas || []).find(x => x.id === id); if (!c) return 0;
  const p = x => (x?.presupuesto?.tipo === 'diario' ? Number(x.presupuesto.usd) || 0 : 0);
  return arriba(c.presupuesto?.tipo ? p(c) : (c.conjuntos || []).reduce((t, s) => t + p(s), 0));
}

// ============================================================
// Agents Office — Anuncios de Meta, Fase A7 (9 oct 2026): EL INFORME DE ANUNCIOS DEL MES. docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §5.
//
// Como el informe de redes (contenido/informe.mjs): lo arma la oficina con sus propios datos, SIN un modelo de por medio. Cada cifra sale
// de algo apuntado en data/anuncios/ (las filas diarias de Meta, el historial de cambios, las sugerencias y lo que pasó después), y lo
// que no se sabe se dice («sin datos»), nunca se inventa. En el mes en curso separa lo que va del mes (las cifras son hasta hoy).
//   gasto del mes · resultados y costo por resultado por campaña · los mejores creativos (por costo por resultado o, sin resultados, por
//   CTR) · lo que se aplicó de las sugerencias y qué pasó · lo que se pausó o activó (del historial) · qué repetir y qué cambiar.
// Se ve en Anuncios (Resumen → «Informe del mes», una ventana con el selector de mes) y se guarda como nota en
// <cerebro>/Agents Office/informes/AAAA-MM anuncios.md (no viaja por GitHub). Los agentes lo leen con `ver_informe_anuncios`.
//
// Lo puro (con test, y también lo usa la demo de la página en dist/anuncios-vista.js): informeAnuncios, resumirMes, resumenDeVista,
// lineaInforme, leerLinea. `crearInforme` lee y guarda con lo que se le pasa (fs, renombrar): este archivo no importa nada de Node.
// ============================================================
import { cifras, resultadoDe } from './modelo.mjs';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = n => String(n).padStart(2, '0');
const nombreMes = mes => { const [y, m] = mes.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; };
const diasDelMes = mes => { const [y, m] = mes.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = v => (v === null ? null : Math.round(v * 100) / 100);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const corto = (s, n = 80) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
/** 12.4 → «12,40 US$» (la moneda de la cuenta, siempre junto a la cifra; como el panel). null → «sin datos». */
export function dinero(v, moneda = 'USD') {
  const n = num(v); if (n === null) return 'sin datos';
  const cur = String(moneda || 'USD').toUpperCase(), d = Math.abs(n) >= 1000 ? 0 : 2;
  try { return new Intl.NumberFormat('es', { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return `${n.toFixed(d)} ${cur}`; }
}
const cifra = v => (num(v) === null ? 'sin datos' : Math.round(num(v)).toLocaleString('es'));
const pct = v => (num(v) === null ? 'sin datos' : `${num(v).toLocaleString('es', { maximumFractionDigits: 2 })} %`);

const REGLA = { aprendizaje: 'está aprendiendo', limitado: 'aprendizaje limitado', esperar: 'todavía es pronto', cortar: 'gasta sin resultados', fatiga: 'el creativo se cansa',
  escalar: 'va bien: escalar', estructura: 'conjuntos parecidos', rechazado: 'anuncio rechazado', problemas: 'con problemas en Meta', cuenta: 'la cuenta pide atención', impulsar: 'impulsar una publicación' };
const POR = { dueno: 'por ti', 'dueño': 'por ti', dimitri: 'por Dimitri', asistente: 'por tu asistente', piloto: 'por el piloto automático', agente: 'por un agente', telegram: 'por ti (Telegram)' };
const porQuien = q => POR[String(q || '').toLowerCase()] || (q ? `por ${q}` : 'por la oficina');
const HIZO = { pausar: 'Pausa', activar: 'Activación', reanudar: 'Reanudación', subir_presupuesto: 'Subida de presupuesto', bajar_presupuesto: 'Bajada de presupuesto', alargar: 'Nueva fecha de fin',
  relanzar: 'Relanzamiento (en pausa)', archivar: 'Archivado' };
const ESTADO = { ACTIVE: 'activa', PAUSED: 'en pausa', ARCHIVED: 'archivada' };
const DEL = { campana: 'de la campaña', conjunto: 'del conjunto', anuncio: 'del anuncio' };

/** antes → después de una entrada del historial, solo lo que cambió (objetos { estado, presupuesto, fin } o textos de la demo). */
export function cambioTexto(antes, despues, moneda = 'USD') {
  if (antes == null && despues == null) return '';
  if (typeof antes !== 'object' || typeof despues !== 'object' || !antes || !despues) return `${antes ?? '—'} → ${despues ?? '—'}`;
  const out = [];
  if (antes.estado !== despues.estado && (antes.estado || despues.estado)) out.push(`${ESTADO[antes.estado] || antes.estado || '—'} → ${ESTADO[despues.estado] || despues.estado || '—'}`);
  const p = x => (x?.usd == null ? '—' : `${dinero(x.usd, moneda)}${x.tipo === 'diario' ? ' al día' : x.tipo === 'total' ? ' en total' : ''}`);
  if ((antes.presupuesto?.usd ?? null) !== (despues.presupuesto?.usd ?? null)) out.push(`${p(antes.presupuesto)} → ${p(despues.presupuesto)}`);
  if ((antes.fin ?? null) !== (despues.fin ?? null)) out.push(`fin ${String(antes.fin || 'sin fecha').slice(0, 10)} → ${String(despues.fin || 'sin fecha').slice(0, 10)}`);
  return out.join(' · ');
}

/**
 * Las cifras de un mes desde las filas diarias de Meta (level=ad) y la estructura de la cuenta (el árbol de la vista: nombres, objetivos,
 * creativos). Lo que ya no está en la cuenta sale con su id. → { gasto, campanas: [{ id, nombre, objetivoTexto, cifras }],
 * anuncios: [{ id, nombre, campana, creativo, cifras }], dias: días con filas }
 */
export function resumirMes({ campanas = [], filas = [] } = {}) {
  const porCamp = new Map(), porAd = new Map(), dias = new Set();
  for (const f of filas) { dias.add(f.date_start); if (f.campaign_id) (porCamp.get(f.campaign_id) || porCamp.set(f.campaign_id, []).get(f.campaign_id)).push(f); if (f.ad_id) (porAd.get(f.ad_id) || porAd.set(f.ad_id, []).get(f.ad_id)).push(f); }
  const camp = new Map(campanas.map(c => [c.id, c])), ad = new Map();
  for (const c of campanas) for (const s of c.conjuntos || []) for (const a of s.anuncios || []) ad.set(a.id, { a, s, c });
  const outC = [...porCamp].map(([id, fs]) => { const c = camp.get(id); return { id, nombre: c?.nombre || `campaña ${id} (ya no está en la cuenta)`, objetivoTexto: c?.objetivoTexto || '', cifras: cifras(fs, c?.resultado ?? null) }; });
  const outA = [...porAd].map(([id, fs]) => {
    const x = ad.get(id), clave = x ? resultadoDe(x.c.objetivo, { optimizacion: x.s.optimizacion || '', destino: x.s.destino || '' }) ?? x.c.resultado ?? null : camp.get(fs[0]?.campaign_id)?.resultado ?? null;
    return { id, nombre: x?.a.nombre || `anuncio ${id} (ya no está en la cuenta)`, campana: x?.c.nombre || camp.get(fs[0]?.campaign_id)?.nombre || '', creativo: x?.a.creativo || null, cifras: cifras(fs, clave) };
  });
  return { gasto: r2(filas.reduce((s, f) => s + (num(f.spend) || 0), 0)), campanas: outC, anuncios: outA, dias: dias.size };
}

/** La demo (y «Ver con datos de ejemplo»): la vista del rango «mes» ya trae las cifras de cada campaña y anuncio. */
export function resumenDeVista(v) {
  if (!v) return null;
  const anuncios = [];
  for (const c of v.campanas || []) for (const s of c.conjuntos || []) for (const a of s.anuncios || []) anuncios.push({ id: a.id, nombre: a.nombre, campana: c.nombre, creativo: a.creativo || null, cifras: a.cifras });
  return { gasto: num(v.gasto?.mes), campanas: (v.campanas || []).map(c => ({ id: c.id, nombre: c.nombre, objetivoTexto: c.objetivoTexto || '', cifras: c.cifras })), anuncios, dias: null };
}

/** Los mejores creativos: los que trajeron resultados del tipo con más gasto, por su costo; sin resultados, por CTR (con 300 impresiones o más). */
export function mejoresCreativos(anuncios = [], n = 3) {
  const conGasto = anuncios.filter(a => (num(a.cifras?.gasto) || 0) > 0);
  const conRes = conGasto.filter(a => num(a.cifras?.resultados) > 0 && num(a.cifras?.costoPorResultado) !== null);
  if (conRes.length) {
    const gastoTipo = {}; for (const a of conRes) gastoTipo[a.cifras.resultadoTexto] = (gastoTipo[a.cifras.resultadoTexto] || 0) + a.cifras.gasto;
    const tipo = Object.entries(gastoTipo).sort((a, b) => b[1] - a[1])[0][0];
    return { por: 'costo', resultadoTexto: tipo, lista: conRes.filter(a => a.cifras.resultadoTexto === tipo).sort((a, b) => a.cifras.costoPorResultado - b.cifras.costoPorResultado || b.cifras.resultados - a.cifras.resultados).slice(0, n) };
  }
  const porCtr = conGasto.filter(a => num(a.cifras?.ctr) !== null && (num(a.cifras?.impresiones) || 0) >= 300).sort((a, b) => b.cifras.ctr - a.cifras.ctr).slice(0, n);
  return { por: porCtr.length ? 'ctr' : null, resultadoTexto: null, lista: porCtr };
}

/**
 * El informe (puro). → { titulo, texto (Markdown), cifras }
 * @param {object} o
 * @param {string} o.mes           'AAAA-MM'
 * @param {string} o.hoy           'AAAA-MM-DD' en la zona de la cuenta
 * @param {object|null} o.resumen resumirMes / resumenDeVista; null = la oficina no tiene cifras de ese mes
 * @param {object} o.cobertura     { leidos, total } — días del mes de los que la oficina tiene cifras (aunque no gastara)
 * @param {Array}  o.historial     data/anuncios/historial.jsonl ({ at, quien, que, objeto, antes, despues })
 * @param {Array}  o.sugerencias   las de GET /api/anuncios/sugerencias (con estado, aplicadaAt, resultado)
 * @param {object} o.topes         { mensual } (solo se cita en el mes en curso: es el de ahora)
 */
export function informeAnuncios({ mes, hoy, moneda = 'USD', resumen = null, cobertura = null, historial = [], sugerencias = [], topes = {}, conectado = true } = {}) {
  if (!/^\d{4}-\d{2}$/.test(mes || '')) throw Object.assign(new Error('el mes va como AAAA-MM'), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy || '')) throw Object.assign(new Error('falta hoy (AAAA-MM-DD)'), { status: 400 });
  if (mes > hoy.slice(0, 7)) throw Object.assign(new Error(`${nombreMes(mes)} todavía no empieza`), { status: 400 });
  const enCurso = mes === hoy.slice(0, 7), total = diasDelMes(mes), hastaDia = enCurso ? Number(hoy.slice(8, 10)) : total;
  const titulo = `Informe de anuncios — ${nombreMes(mes)}${enCurso ? ' (en curso)' : ''}`;
  const d = v => dinero(v, moneda);
  const sinCifras = !resumen || (cobertura && !cobertura.leidos && !(resumen.gasto > 0));
  const L = [`# ${titulo}`, '', '_Hecho por la oficina con sus propios datos (lo leído de Meta, el historial y las sugerencias). Lo que no se sabe dice «sin datos»._', ''];
  if (enCurso) L.push(`_El mes no ha terminado: las cifras van del 1 al ${hastaDia} de ${MESES[Number(mes.slice(5)) - 1]}, y Meta corrige los resultados de los últimos días._`, '');

  // ---- el gasto
  L.push(enCurso ? '## Lo que va del mes' : '## El gasto');
  if (sinCifras) L.push(conectado ? '- Sin datos: la oficina no tiene cifras de anuncios de este mes (guarda las de los últimos 60 días, y solo desde que Meta está conectada).' : '- Sin datos: Meta no está conectada para anuncios (Ajustes → Anuncios y la variable META_ACCESS_TOKEN).');
  else {
    const tope = enCurso && num(topes?.mensual) > 0 ? ` de un tope mensual de ${d(topes.mensual)} (${Math.round((resumen.gasto / topes.mensual) * 100)} %)` : '';
    L.push(`- Gastado ${enCurso ? 'en lo que va del mes' : 'en el mes'}: **${d(resumen.gasto)}**${tope}.`);
    if (cobertura && cobertura.leidos < (enCurso ? hastaDia : total)) L.push(`- Cifras de ${cobertura.leidos} de los ${enCurso ? hastaDia : total} días${enCurso ? ' que van' : ' del mes'}: de los demás la oficina no tiene lectura (lo gastado esos días no está sumado).`);
    if (!(resumen.gasto > 0)) L.push('- Los anuncios no gastaron nada este mes.');
  }
  L.push('');

  // ---- por campaña
  const camps = sinCifras ? [] : (resumen.campanas || []).filter(c => (num(c.cifras?.gasto) || 0) > 0).sort((a, b) => b.cifras.gasto - a.cifras.gasto);
  L.push('## Por campaña');
  if (sinCifras) L.push('- Sin datos.');
  else if (!camps.length) L.push('- Ninguna campaña gastó este mes.');
  for (const c of camps.slice(0, 15)) {
    const k = c.cifras, res = num(k.resultados) === null ? `${k.resultadoTexto || 'resultados'}: sin datos` : `${cifra(k.resultados)} ${k.resultadoTexto}${num(k.costoPorResultado) !== null ? ` a ${d(k.costoPorResultado)}${k.costoPor === 'mil' ? ' cada mil' : ' cada uno'}` : ''}`;
    L.push(`- **${c.nombre}**${c.objetivoTexto ? ` (${c.objetivoTexto})` : ''}: gastó ${d(k.gasto)} · ${res} · CTR ${pct(k.ctr)}.`);
  }
  if (camps.length > 15) L.push(`- …y ${camps.length - 15} más.`);
  L.push('');

  // ---- los mejores creativos
  const mej = sinCifras ? { por: null, lista: [] } : mejoresCreativos(resumen.anuncios || []);
  L.push('## Los mejores creativos');
  if (!mej.lista.length) L.push(sinCifras ? '- Sin datos.' : '- Sin datos suficientes: ningún anuncio trajo resultados ni llegó a 300 impresiones este mes.');
  else {
    L.push(mej.por === 'costo' ? `_Por costo por resultado (${mej.resultadoTexto}): el más barato primero._` : '_Ninguno trajo resultados medibles: van por CTR (el que más clics consiguió por impresión)._');
    for (const a of mej.lista) {
      const k = a.cifras, txt = corto(a.creativo?.titulo || a.creativo?.texto || '', 70);
      L.push(`- **${a.nombre}**${a.campana ? ` (campaña «${a.campana}»)` : ''}: ${mej.por === 'costo' ? `${cifra(k.resultados)} ${k.resultadoTexto} a ${d(k.costoPorResultado)} cada uno` : `CTR ${pct(k.ctr)} con ${cifra(k.impresiones)} impresiones`} · gastó ${d(k.gasto)}${txt ? ` · «${txt}»` : ''}.`);
    }
  }
  L.push('');

  // ---- las sugerencias aplicadas y qué pasó
  const delMes = at => String(at || '').slice(0, 7) === mes;
  const aplicadas = (sugerencias || []).filter(s => s.estado === 'aplicada' && delMes(s.aplicadaAt));
  const descartadas = (sugerencias || []).filter(s => s.estado === 'descartada' && delMes(s.descartadaAt));
  L.push('## Lo que se aplicó de las sugerencias');
  if (!aplicadas.length) L.push('- Ninguna sugerencia aplicada este mes.');
  for (const s of aplicadas.slice(0, 12)) {
    const r = s.resultado, rt = String(typeof r === 'string' ? r : r?.texto || '').trim().replace(/\.$/, ''), mejoro = typeof r === 'object' && r ? r.mejoro : null;
    const despues = r ? `después: ${rt || 'sin datos'}${mejoro === true ? ' (mejoró)' : mejoro === false ? ' (no mejoró)' : ''}` : 'todavía no se sabe qué pasó: se mide 7 días después de aplicarla';
    L.push(`- ${String(s.aplicadaAt).slice(0, 10)} · «${REGLA[s.regla] || s.regla}» sobre «${s.objeto?.nombre || s.objeto?.id || '?'}»${s.cambio?.tipo ? ` (${String(s.cambio.tipo).replace(/_/g, ' ')})` : ''}, aplicada ${porQuien(s.aplicadaPor || 'dueno')} — ${despues}.`);
  }
  if (descartadas.length) L.push(`- ${plural(descartadas.length, 'sugerencia descartada', 'sugerencias descartadas')} este mes.`);
  L.push('');

  // ---- lo que se pausó o activó (el historial de la oficina)
  const cambios = (historial || []).filter(h => delMes(h.at)).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const cuenta = t => cambios.filter(h => t.includes(h.que)).length;
  L.push('## Lo que se pausó o activó');
  if (!cambios.length) L.push('- Ningún cambio hecho desde la oficina este mes (lo que se cambie en el Administrador de anuncios no se apunta aquí).');
  else {
    const partes = [[cuenta(['pausar']), 'pausa', 'pausas'], [cuenta(['activar', 'reanudar']), 'activación', 'activaciones'], [cuenta(['subir_presupuesto']), 'subida de presupuesto', 'subidas de presupuesto'], [cuenta(['bajar_presupuesto']), 'bajada de presupuesto', 'bajadas de presupuesto'], [cuenta(['relanzar']), 'relanzamiento', 'relanzamientos'], [cuenta(['archivar']), 'archivada', 'archivadas']].filter(p => p[0]);
    if (partes.length) L.push(`- En total: ${partes.map(([n, a, b]) => plural(n, a, b)).join(', ')}.`);
    for (const h of cambios.slice(-15)) {
      const que = String(h.que || ''), base = que.startsWith('deshacer:') ? que.slice(9) : que, de = DEL[h.objeto?.nivel] || 'de';
      const q = HIZO[base] ? `${que.startsWith('deshacer:') ? `Deshecha la ${HIZO[base].toLowerCase()}` : HIZO[base]} ${de}` : `${que ? que.charAt(0).toUpperCase() + que.slice(1) : 'Cambio'}:`;
      const ct = cambioTexto(h.antes, h.despues, moneda);
      L.push(`- ${String(h.at).slice(0, 10)} · ${q} «${h.objeto?.nombre || h.objeto?.id || '?'}»${ct ? ` (${ct})` : ''}, ${porQuien(h.quien)}.`);
    }
    if (cambios.length > 15) L.push(`- …y ${cambios.length - 15} cambios antes (en Anuncios → Historial).`);
  }
  L.push('');

  // ---- qué repetir y qué cambiar
  const ideas = [];
  if (mej.por === 'costo' && mej.lista[0]) ideas.push(`Repite lo de «${mej.lista[0].nombre}»: fue el resultado más barato (${d(mej.lista[0].cifras.costoPorResultado)}). Pídele variaciones a tu agente de anuncios.`);
  const sinRes = sinCifras ? [] : (resumen.anuncios || []).filter(a => (num(a.cifras?.gasto) || 0) >= 5 && num(a.cifras?.resultados) === 0).sort((a, b) => b.cifras.gasto - a.cifras.gasto);
  if (sinRes.length) ideas.push(`${sinRes.slice(0, 3).map(a => `«${a.nombre}» gastó ${d(a.cifras.gasto)}`).join(', ')} sin ningún resultado: si sigue igual, páusalo o cambia el creativo.`);
  const noMejoro = aplicadas.filter(s => typeof s.resultado === 'object' && s.resultado?.mejoro === false);
  if (noMejoro.length) ideas.push(`${plural(noMejoro.length, 'sugerencia aplicada no mejoró', 'sugerencias aplicadas no mejoraron')} lo que prometía: míralas en Sugerencias → Aplicadas antes de repetir el mismo cambio.`);
  if (!ideas.length) ideas.push('Todavía no hay datos suficientes para recomendar algo: con un mes de anuncios leídos de Meta, aquí saldrán.');
  L.push('## Qué repetir y qué cambiar');
  for (const i of ideas) L.push(`- ${i}`);

  const res = {
    mes, enCurso, moneda, gasto: sinCifras ? null : resumen.gasto, campanas: camps.length, dias: cobertura?.leidos ?? resumen?.dias ?? null,
    mejor: mej.lista[0] ? { nombre: mej.lista[0].nombre, por: mej.por, costo: mej.lista[0].cifras.costoPorResultado ?? null, ctr: mej.lista[0].cifras.ctr ?? null } : null,
    aplicadas: aplicadas.length, aplicadasMejoraron: aplicadas.filter(s => typeof s.resultado === 'object' && s.resultado?.mejoro === true).length, cambios: cambios.length,
  };
  return { titulo, texto: L.join('\n') + '\n', cifras: res };
}

/** Una línea para el resumen del lunes (va en la cabecera de la nota guardada, `linea:`). */
export function lineaInforme(c) {
  if (!c?.mes) return '';
  if (c.gasto == null) return `Anuncios de ${nombreMes(c.mes)}: sin cifras de Meta.`;
  return `Anuncios de ${nombreMes(c.mes)}${c.enCurso ? ' (en curso)' : ''}: gastado ${dinero(c.gasto, c.moneda)} en ${plural(c.campanas, 'campaña', 'campañas')}${c.mejor ? `; mejor creativo «${corto(c.mejor.nombre, 50)}»${c.mejor.por === 'costo' && c.mejor.costo != null ? ` (${dinero(c.mejor.costo, c.moneda)} por resultado)` : ''}` : ''}; ${plural(c.aplicadas, 'sugerencia aplicada', 'sugerencias aplicadas')}${c.aplicadas ? ` (${c.aplicadasMejoraron} mejoraron)` : ''}; ${plural(c.cambios, 'cambio', 'cambios')} desde la oficina.`;
}
/** La línea `linea:` de la cabecera de una nota de informe guardada (o null). */
export function leerLinea(nota = '') {
  const m = /^---\n([\s\S]*?)\n---/.exec(String(nota).replace(/\r\n/g, '\n')); if (!m) return null;
  const l = /^linea:\s*(.+)$/m.exec(m[1]); if (!l) return null;
  try { return JSON.parse(l[1]); } catch { return l[1].trim() || null; }
}
const mesAnterior = hoy => { const [y, m] = hoy.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };

/**
 * Leer y guardar (serve.mjs). Nada de Node aquí: `fs` y `renombrar` (fs-seguro.mjs) entran.
 * @param {object} o
 * @param {object} o.sync        anuncios/sincronizar.mjs (hoy, vista, filas, diasLeidos, historial, topes, conexion)
 * @param {object} o.sugerencias anuncios/sugerencias.mjs (lista) — opcional
 * @param {string} o.dir         <cerebro>/Agents Office/informes
 */
export function crearInforme({ sync, sugerencias = null, dir, fs, renombrar, ahora = () => Date.now(), unirRuta = (a, b) => `${a}/${b}` }) {
  function informe(mes) {
    const hoy = sync.hoy();
    if (!/^\d{4}-\d{2}$/.test(mes || '')) throw Object.assign(new Error('el mes va como AAAA-MM'), { status: 400 });
    const desde = `${mes}-01`, fin = `${mes}-${pad(diasDelMes(mes))}`, hasta = fin < hoy ? fin : hoy;
    const v = sync.vista('30d'), moneda = v?.cuenta?.moneda || 'USD', con = sync.conexion?.() || {};
    const leidos = desde <= hasta ? (sync.diasLeidos?.(desde, hasta) ?? null) : 0;
    const filas = desde <= hasta ? sync.filas(desde, hasta) : [];
    const resumen = leidos || filas.length ? resumirMes({ campanas: v?.campanas || [], filas }) : null;
    let sug = []; try { sug = sugerencias?.lista() || []; } catch { /* sin sugerencias todavía */ }
    return informeAnuncios({ mes, hoy, moneda, resumen, cobertura: leidos === null ? null : { leidos, total: diasDelMes(mes) }, historial: sync.historial(), sugerencias: sug, topes: sync.topes?.() || {}, conectado: Boolean(con.configurado || v?.cuenta) });
  }
  const archivo = mes => unirRuta(dir, `${mes} anuncios.md`);
  /** Lo guarda como nota (escritura a un temporal y renombrar). → { …informe, nota: 'Agents Office/informes/AAAA-MM anuncios.md' } */
  function guardar(mes) {
    const r = informe(mes), f = archivo(mes);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(f + '.tmp', `---\ntipo: informe\nde: anuncios\nmes: ${mes}\ncreado: ${new Date(ahora()).toISOString()}\nlinea: ${JSON.stringify(lineaInforme(r.cifras))}\n---\n${r.texto}`);
    renombrar(f + '.tmp', f);
    return { ...r, nota: `Agents Office/informes/${mes} anuncios.md` };
  }
  /** La línea del informe guardado del mes anterior (para el resumen del lunes), o null si no se guardó. */
  function lineaMesAnterior() {
    try { const f = archivo(mesAnterior(sync.hoy())); return fs.existsSync(f) ? leerLinea(fs.readFileSync(f, 'utf8')) : null; } catch { return null; }
  }
  return { informe, guardar, lineaMesAnterior };
}

// La RADIOGRAFÍA del negocio (12 nov 2026, plan-mcp-oficina-panaclaw.md §0 y §7.4): «una lectura completa de cómo está el negocio» en UNA función, en el orden en que el dueño
// pregunta: 1 caja y cifras · 2 pauta · 3 contenido de la semana · 4 tareas y aprobaciones · 5 gasto de IA · 6 semáforo de salud.
//
// Es composición, no una ruta: no sabe de D1 ni de HTTP. Recibe los LECTORES inyectados (`leer`), así que la reutilizan el MCP y una futura ruta, y se prueba con lectores falsos.
//   leer = { negocio, cifras, anuncios, sugerencias?, contenido, tareas, costos, salud }  — cada uno es `async () => dato` con la forma de su ruta de siempre:
//   negocio → /api/business {kpis, office} · cifras → /api/cifras {items, porConfirmar} · anuncios → /api/anuncios {…vista} · sugerencias → /api/anuncios/sugerencias {sugerencias}
//   contenido → /api/contenido {piezas} · tareas → la lista de tareas · costos → /api/costs (el informe de costs-core) · salud → /api/status {overall, checks, unread}
// `lectoresPorOficina` arma esos lectores con la misma puerta que usa Dimitri (`office(ruta)`), sin volver a escribir ninguna consulta.
//
// REGLAS (cloudflare/tests/radiografia.test.mjs las muerde):
//  · SOLO LEE. Nada gasta ni cambia nada; no hay ninguna escritura en este archivo.
//  · Cada sección falla por separado: una lectura caída dice «no pude leerla: motivo» y las demás siguen. Nunca una radiografía entera caída por una parte.
//  · Todo texto de un tercero (títulos de piezas y tareas, nombres de indicadores, cifras, cuentas) pasa por `seguro()` (una línea, acotado, y si trae órdenes escondidas de
//    safety.injectionIn se reemplaza); y cada sección vuelve a pasar por el escudo antes de salir. Tope por sección y tope total (TOPE_TOTAL).
//  · Lo que no se sabe dice «sin datos»; nunca un número inventado, nunca NaN ni undefined.
import * as sub from '../../../sub-core.mjs';
import * as safety from '../../../safety.mjs';
import { agenda as agendaTareas } from '../../../tareas/agenda.mjs';

export const TOPE_TOTAL = 20000;
export const TOPE_SECCION = 3200;
export const SECCIONES = ['caja', 'pauta', 'contenido', 'tareas', 'ia', 'salud'];
const TITULOS = { caja: 'Caja y cifras del negocio', pauta: 'Pauta (anuncios)', contenido: 'Contenido de la semana', tareas: 'Tareas y aprobaciones', ia: 'Gasto de IA', salud: 'Salud de la oficina' };
const DUENO = 'Tú';
const SIN = 'sin datos';

/* ---------- lo pequeño y puro ---------- */
const num = (v) => (v != null && v !== '' && Number.isFinite(+v) ? +v : null);
const miles = (v) => { const n = num(v); if (n == null) return SIN; const [e, d] = String(Math.round(n * 100) / 100).split('.'); return e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : ''); };
const usd = (v) => { const n = num(v); return n == null ? SIN : `US$${n.toFixed(2)}`; };
const pct = (v, dec = 0) => { const n = num(v); return n == null ? SIN : `${(n * 100).toFixed(dec)} %`; };
const dia = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** Una línea, sin controles ni caracteres invisibles, acotada; con órdenes escondidas, un aviso en su lugar. */
export function seguro(v, max = 80) {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029\u200b-\u200f\u202a-\u202e\u2066-\u2069]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return t && safety.injectionIn(t) ? '(texto omitido)' : t;
}
const motivoDe = (e) => seguro(e?.message || e, 160) || 'error desconocido';
const acotar = (t, max) => { t = String(t ?? ''); return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + '…'; };
/** Lo que salga de las funciones de texto de Dimitri nunca deja «undefined» ni «NaN» a la vista. */
const sinBasura = (t) => String(t ?? '').replace(/\b(undefined|NaN)\b/g, SIN).replace(/\[object Object\]/g, SIN);

/* ---------- las seis secciones: cada una recibe el dato y devuelve { texto, datos } ---------- */
function tendencia(k) {
  const c = num(k.change); if (c == null) return '';
  return ` · ${c >= 0 ? 'sube' : 'baja'} ${Math.abs(c * 100).toFixed(0)} % frente a la lectura anterior${k.good === true ? ' (bien)' : k.good === false ? ' (mal)' : ''}`;
}
function textoIndicadores(n) {
  const kpis = Array.isArray(n?.kpis) ? n.kpis : [];
  const lin = kpis.slice(0, 12).map((k) => {
    const v = num(k.value), meta = num(k.goal);
    return `- ${seguro(k.name || k.id, 60) || 'indicador'}: ${v == null ? 'sin dato' : `${miles(v)}${k.unit ? ' ' + seguro(k.unit, 12) : ''}`}${meta ? ` (meta ${miles(meta)}${meta && v != null ? `, al ${pct(v / meta)}` : ''})` : ''}${tendencia(k)}`;
  });
  const of = (Array.isArray(n?.office) ? n.office : []).filter((x) => x && x.name).slice(0, 6).map((x) => `${seguro(x.name, 50)} ${x.value == null || !Number.isFinite(+x.value) ? SIN : `${miles(x.value)}${x.unit ? ' ' + seguro(x.unit, 10) : ''}`}`);
  return [kpis.length ? `Indicadores del dueño (${kpis.length}):\n${lin.join('\n')}${kpis.length > 12 ? `\n- … y ${kpis.length - 12} más` : ''}` : 'Indicadores del dueño: ninguno creado todavía (sin datos).', of.length ? `La oficina esta semana: ${of.join(' · ')}.` : ''].filter(Boolean).join('\n');
}
function textoCifras(c) {
  const items = Array.isArray(c?.items) ? c.items : [], pend = Array.isArray(c?.porConfirmar) ? c.porConfirmar.length : 0;
  if (!items.length) return `Cifras de la empresa: ninguna guardada (sin datos).${pend ? ` ${pend} esperan tu confirmación.` : ''}`;
  return `Cifras de la empresa (${items.length}): ${items.slice(0, 14).map((x) => `${seguro(x.name, 40)} ${seguro(x.value, 30) || SIN}${x.unit ? ' ' + seguro(x.unit, 10) : ''}`).join(' · ')}${items.length > 14 ? ` · y ${items.length - 14} más` : ''}${pend ? `. ${pend} por confirmar.` : '.'}`;
}
function textoPauta(v, sugs) {
  const top = (Array.isArray(sugs) ? sugs : []).slice(0, 3).map((s) => ({ ...s, texto: seguro(s.texto || s.titulo || s.dato, 160) }));
  const t = sinBasura(sub.anunciosText(v, top) || '');
  const sug = top.length ? '\nLo que conviene mirar: ' + top.map((s) => s.texto).filter(Boolean).join(' | ') : '';
  const cuentas = (Array.isArray(v?.porCuenta) ? v.porCuenta : []).slice(0, 6).map((c) => `${seguro(c.texto || c.nombre || c.cuentaTexto || c.id, 50)}: gasto ${usd(c.gasto)}${c.resultados != null ? `, ${miles(c.resultados)} resultados` : ''}`);
  return `${t || 'Anuncios: ' + SIN + ' (Meta no está conectada o no se ha leído).'}${t.includes('Gasto:') || !cuentas.length ? '' : '\nPor cuenta: ' + cuentas.join(' · ')}${sug}`;
}
function textoContenido(c, ahora) {
  const piezas = (Array.isArray(c?.piezas) ? c.piezas : []).map((p) => ({ ...p, titulo: seguro(p.titulo || p.texto, 70), texto: '' }));
  if (!piezas.length) return 'Contenido (próximos 7 días): ' + SIN + ' o nada planificado: ninguna pieza en el calendario.';
  const rev = piezas.filter((p) => p.estado === 'revision');
  return sinBasura(sub.contenidoText(piezas, { now: new Date(ahora), dias: 7 })) + (rev.length ? `\nEsperan tu OK en Contenido: ${rev.length}${rev.length ? ' — ' + rev.slice(0, 5).map((p) => `«${p.titulo}»`).join(', ') : ''}.` : '');
}
function textoTareas(lista, ahora) {
  const l = Array.isArray(lista) ? lista : [];
  if (!l.length) return { texto: 'Tareas: ninguna en la oficina (' + SIN + ').', datos: { esperanOk: 0, vencidas: 0 } };
  const a = agendaTareas(l, { ahora });
  const it = (t) => `«${seguro(t.title, 50)}» (${t.person === DUENO ? 'del dueño' : t.person ? seguro(t.person, 30) : seguro(t.agent, 30) || 'sin agente'}${t.limite ? `, límite ${seguro(t.limite, 10)}` : ''})`;
  const bloque = (rot, arr, n = 5) => (arr.length ? `${rot} (${arr.length}): ${arr.slice(0, n).map(it).join('; ')}${arr.length > n ? `; y ${arr.length - n} más` : ''}` : `${rot}: ninguna.`);
  const horas = (t) => { const ms = num(t.waitingAt); return ms ? Math.max(0, Math.round((ahora - ms) / 3600e3)) : null; };
  const viejas = a.esperanOk.filter((t) => (horas(t) ?? 0) >= 24).length;
  return {
    texto: [bloque('Esperan tu OK', a.esperanOk), viejas ? `De ésas, ${viejas} llevan más de un día esperando.` : '', bloque('Vencidas', a.vencidas), bloque('Bloqueadas', a.bloqueadas, 3), bloque('Para hoy', a.hoy, 4), `En curso ahora: ${a.enCurso.length}.`].filter(Boolean).join('\n'),
    datos: { esperanOk: a.esperanOk.length, vencidas: a.vencidas.length, bloqueadas: a.bloqueadas.length, hoy: a.hoy.length, enCurso: a.enCurso.length },
  };
}
function textoIA(r) {
  if (!r || typeof r !== 'object') return { texto: 'Gasto de IA: ' + SIN + '.', datos: {} };
  const gasto = num(r.usd ?? r.budget?.spent), b = r.budget || {}, tope = num(b.budget), ratio = tope && gasto != null ? gasto / tope : null;
  const estado = !tope ? 'sin presupuesto fijado' : b.level === 'over' ? 'PASADO del presupuesto' : b.level === 'alert' ? 'cerca del tope' : 'dentro del presupuesto';
  const top = (arr, f) => (Array.isArray(arr) ? arr.slice(0, 4).map(f).join('; ') : '');
  const lin = [`Este mes${r.month ? ` (${seguro(r.month, 10)})` : ''}: ${usd(gasto)}${tope ? ` de ${usd(tope)} (${pct(ratio)}) — ${estado}` : ` — ${estado}`}${num(r.runs) != null ? `, ${miles(r.runs)} llamadas` : ''}.`,
    num(r.tasksDone) != null ? `Trabajo hecho: ${miles(r.tasksDone)} tareas, ${num(r.hours) != null ? num(r.hours).toFixed(1) : SIN} horas ahorradas.` : '',
    top(r.byDept, (x) => `${seguro(x.name || x.key, 30)} ${usd(x.usd)}`) ? `Por departamento: ${top(r.byDept, (x) => `${seguro(x.name || x.key, 30)} ${usd(x.usd)}`)}.` : '',
    top(r.byModel, (x) => `${seguro(x.key || x.name, 30)} ${usd(x.usd)}`) ? `Por modelo: ${top(r.byModel, (x) => `${seguro(x.key || x.name, 30)} ${usd(x.usd)}`)}.` : '',
    ...(Array.isArray(r.suggestions) ? r.suggestions.slice(0, 2).map((s) => `Sugerencia: ${seguro(s.text, 180)}`) : [])].filter(Boolean);
  return { texto: lin.join('\n'), datos: { gasto, tope, ratio, nivel: b.level || (tope ? 'ok' : 'none') } };
}
const ROTULO = { ok: 'bien', info: 'info', warn: 'ojo', bad: 'FALLA' };
function textoSalud(s) {
  if (!s || typeof s !== 'object') return { texto: 'Salud: ' + SIN + '.', datos: {} };
  const checks = Array.isArray(s.checks) ? s.checks : [], malos = checks.filter((c) => c.state === 'bad' || c.state === 'warn');
  const semaforo = { ok: 'VERDE: todo en orden', warn: 'ÁMBAR: algo pide atención', bad: 'ROJO: algo falla' }[s.overall] || `semáforo ${SIN}`;
  const lin = [`Semáforo: ${semaforo}.`, malos.length ? 'Lo que no está bien:\n' + malos.slice(0, 8).map((c) => `- [${ROTULO[c.state] || c.state}] ${seguro(c.label || c.id, 40)}: ${seguro(c.detail, 200) || SIN}${c.fix ? ` → ${seguro(c.fix, 140)}` : ''}`).join('\n') : (checks.length ? `Las ${checks.length} comprobaciones están bien.` : 'Comprobaciones: ' + SIN + '.'),
    num(s.unread) ? `Avisos sin leer: ${miles(s.unread)}.` : ''].filter(Boolean);
  return { texto: lin.join('\n'), datos: { overall: s.overall || null, fallan: malos.filter((c) => c.state === 'bad').length, avisan: malos.filter((c) => c.state === 'warn').length } };
}

/* ---------- el ensamblado ---------- */
/** Corre UNA sección sin que pueda tumbar a las demás: sus lectores en paralelo y, si alguno falla, lo dice con su motivo. */
async function seccion(id, trabajo) {
  let texto, datos = {}, ok = true, errores = [];
  try { ({ texto, datos = {}, errores = [], ok = true } = await trabajo()); } catch (e) { ok = false; texto = `No pude leerla: ${motivoDe(e)}.`; }
  texto = acotar(String(texto || '').trim() || `${SIN}.`, TOPE_SECCION);
  if (safety.injectionIn(texto)) { texto = 'Esta sección trae texto con órdenes escondidas; no la muestro (🛡). Revisa las notas y resultados recientes.'; datos = {}; ok = false; }
  return { id, titulo: TITULOS[id], ok, texto, datos, ...(errores.length ? { errores } : {}) };
}
async function leerPartes(partes) { // [[rótulo, lector]] → { valores, errores: ['rótulo: motivo'] }
  const r = await Promise.all(partes.map(async ([rot, f]) => { try { if (typeof f !== 'function') throw new Error('lector no disponible'); return [rot, await f(), null]; } catch (e) { return [rot, null, `${rot}: no pude leerlo (${motivoDe(e)})`]; } }));
  return { v: Object.fromEntries(r.map(([k, val]) => [k, val])), errores: r.filter((x) => x[2]).map((x) => x[2]), todasCayeron: r.every((x) => x[2]) };
}

/** La radiografía entera. `ahora` (ms) inyectable: nada depende del reloj real. → { ok, at, secciones: [{id, titulo, ok, texto, datos}], texto, truncada } */
export async function radiografia({ leer = {}, ahora = Date.now() } = {}) {
  const secs = await Promise.all([
    seccion('caja', async () => {
      const { v, errores, todasCayeron } = await leerPartes([['indicadores', leer.negocio], ['cifras', leer.cifras]]);
      if (todasCayeron) return { texto: `No pude leerla: ${errores.join('; ')}.`, errores, ok: false };
      return { texto: [errores.length ? `(${errores.join('; ')})` : '', v.indicadores ? textoIndicadores(v.indicadores) : '', v.cifras ? textoCifras(v.cifras) : ''].filter(Boolean).join('\n'), datos: { indicadores: Array.isArray(v.indicadores?.kpis) ? v.indicadores.kpis.length : 0, cifras: Array.isArray(v.cifras?.items) ? v.cifras.items.length : 0 }, errores };
    }),
    seccion('pauta', async () => {
      const { v, errores, todasCayeron } = await leerPartes([['anuncios', leer.anuncios]]);
      if (todasCayeron) return { texto: `No pude leerla: ${errores.join('; ')}.`, errores, ok: false };
      let sugs = []; try { sugs = (await leer.sugerencias?.())?.sugerencias || []; } catch { /* sin sugerencias: la pauta sigue */ }
      return { texto: textoPauta(v.anuncios, sugs), datos: { conectada: !!(v.anuncios && (v.anuncios.configurado || v.anuncios.cuenta)), gastoMes: num(v.anuncios?.gasto?.mes) } };
    }),
    seccion('contenido', async () => {
      const { v, errores, todasCayeron } = await leerPartes([['contenido', leer.contenido]]);
      if (todasCayeron) return { texto: `No pude leerla: ${errores.join('; ')}.`, errores, ok: false };
      return { texto: textoContenido(v.contenido, ahora), datos: { piezas: Array.isArray(v.contenido?.piezas) ? v.contenido.piezas.length : 0 } };
    }),
    seccion('tareas', async () => {
      const { v, errores, todasCayeron } = await leerPartes([['tareas', leer.tareas]]);
      if (todasCayeron) return { texto: `No pude leerla: ${errores.join('; ')}.`, errores, ok: false };
      return textoTareas(v.tareas, ahora);
    }),
    seccion('ia', async () => {
      const { v, errores, todasCayeron } = await leerPartes([['costos', leer.costos]]);
      if (todasCayeron) return { texto: `No pude leerla: ${errores.join('; ')}.`, errores, ok: false };
      return textoIA(v.costos);
    }),
    seccion('salud', async () => {
      const { v, errores, todasCayeron } = await leerPartes([['salud', leer.salud]]);
      if (todasCayeron) return { texto: `No pude leerla: ${errores.join('; ')}.`, errores, ok: false };
      return textoSalud(v.salud);
    }),
  ]);
  const bloques = secs.map((s, i) => `${i + 1}. ${s.titulo}\n${s.texto}`);
  let texto = `Radiografía del negocio (${dia(ahora)}):\n\n${bloques.join('\n\n')}`, truncada = false;
  if (texto.length > TOPE_TOTAL) { texto = acotar(texto, TOPE_TOTAL); truncada = true; }
  return { ok: secs.every((s) => s.ok), at: ahora, secciones: secs, texto, truncada };
}

/** Los lectores de la nube, por la misma puerta que usa Dimitri (`office(ruta)` = la ruta de la página, con sus permisos). `lista`: las tareas ya leídas, si las hay. */
export function lectoresPorOficina({ office, lista = null, ahora = Date.now() } = {}) {
  const d13 = new Date(ahora); d13.setDate(d13.getDate() + 13);
  return {
    negocio: () => office('/api/business'),
    cifras: () => office('/api/cifras'),
    anuncios: () => office('/api/anuncios?rango=7d'),
    sugerencias: () => office('/api/anuncios/sugerencias'),
    contenido: () => office(`/api/contenido?desde=${dia(ahora)}&hasta=${dia(d13.getTime())}&sinFecha=1`),
    tareas: async () => { if (lista) return lista; const r = await office('/api/tasks?light=1'); return Array.isArray(r) ? r : r?.tasks || []; },
    costos: () => office('/api/costs'),
    salud: () => office('/api/status'),
  };
}

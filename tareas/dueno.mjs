// Agents Office (7 oct 2026, plan D · docs/analisis-tareas-del-dueno-2026-10-07.md) — las TAREAS DEL DUEÑO: lo que hace él, no un
// agente. Antes la oficina solo pensaba en trabajo de agentes: «Tú» existía como la persona a la que se le pasaba una tarea. Ahora el
// dueño tiene su propia lista, al estilo de TaskView (Bandeja, Hoy, Próximos 7 días, proyectos, hechas), y desde ella hace, DELEGA (a un
// agente o a una persona) o TOMA trabajo de un agente. Los agentes la ven rotulada «del dueño»: no la ejecutan ni la cambian.
// Una tarea del dueño es una tarea normal con `person: 'Tú'` (la marca de siempre: la cola no la arranca). Campos propios, todos opcionales:
//   deAgente 'id'           vino de un agente (la tomó él, se la pasó el agente, o se la sugirió) → «Devolver a …»
//   tomada { at }           el dueño se la quitó a un agente («Lo hago yo»)
//   sugeridaPor 'id'        un agente se la sugirió (nace idea: el dueño la acepta o la descarta)
//   empezada ms             el dueño la está haciendo (la columna «Haciendo»)
//   delegada { at, a, nota } la pasó él a 'agente:<id>' o 'persona:<nombre>'; se queda para seguirla en «Delegadas»
//   borradorAgente '…'      lo que el agente había dejado cuando el dueño la tomó para terminarla él
// Sin `dept` ni `agent` es una tarea personal («llamar al banco»): ningún escritorio la tiene. Puro, con test (tests/tareas-dueno.test.mjs).
import { limiteMs } from './modelo.mjs';
import { ordenCola } from './cola.mjs';

export const DUENO = 'Tú';
export const esDelDueno = t => !!t && t.person === DUENO;
export const delegadaPorMi = t => !!t?.delegada && !esDelDueno(t); // la pasó él y ya la tiene otro
const pad = n => String(n).padStart(2, '0');
export const dia = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const diaDe = t => (t.limite ? String(t.limite).slice(0, 10) : null);
const abierta = t => t.state !== 'done';
// lo que delegó y el agente NO pudo hacer (falló tras sus reintentos): no «volvió hecha», sigue siendo asunto suyo. Lo que el dueño
// detuvo él mismo es una cancelación: ni pendiente ni hecha.
const fallo = t => t.state === 'done' && !!t.error && !t.stopped;

// de dónde vino: 'sugerida' (un agente la propuso) · 'tomada' (el dueño se la quitó a un agente) · 'pasada' (un agente se la pasó) · 'dimitri' · 'propia'
export function origen(t) {
  if (!t) return 'propia';
  if (t.sugeridaPor) return 'sugerida';
  if (t.tomada) return 'tomada';
  if (t.deAgente || (t.handoff && t.handoff.from && t.handoff.from !== 'la página')) return 'pasada';
  if (t.by === 'sub') return 'dimitri';
  return 'propia';
}
export const agenteDeOrigen = t => t?.deAgente || (t?.handoff?.from && t.handoff.from !== 'la página' ? t.handoff.from : null) || null;

// el orden de una lista del dueño: lo que está haciendo primero, luego como la cola (prioridad → fecha límite → orden manual → antigüedad)
export function ordenMio(a, b) {
  const ea = a.empezada ? 0 : 1, eb = b.empezada ? 0 : 1; if (ea !== eb) return ea - eb;
  return ordenCola(a, b);
}

export const LISTAS = [
  { k: 'bandeja', titulo: 'Bandeja', sub: 'Sin fecha ni proyecto: lo que entra, hasta que lo ordenes', icono: 'bandeja' },
  { k: 'hoy', titulo: 'Hoy', sub: 'Lo que vence hoy, lo vencido y lo que estás haciendo', icono: 'hoy' },
  { k: 'proximos', titulo: 'Próximos 7 días', sub: 'Lo que vence esta semana, por día', icono: 'prox' },
  { k: 'todas', titulo: 'Todas las mías', sub: 'Todo lo que tienes abierto, por fecha', icono: 'lista' },
  { k: 'delegadas', titulo: 'Delegadas', sub: 'Lo que pasaste a un agente o a una persona, hasta que vuelva', icono: 'delegar' },
  { k: 'hechas', titulo: 'Hechas', sub: 'Lo que terminaste estos 30 días', icono: 'hecha' },
];

/**
 * Una lista del dueño → { pendientes, hechas } (las dos ya ordenadas). `k`: una de LISTAS, o 'p:<id de proyecto>'.
 * Las «hechas» son las que van bajo el separador COMPLETADAS · N de esa lista (Hoy: las de hoy; Todas: 7 días; un proyecto: todas).
 */
export function deLista(tareas, k, { ahora = Date.now() } = {}) {
  const hoy = dia(ahora), fin = dia(ahora + 7 * 864e5), hace = n => ahora - n * 864e5;
  const vivas = tareas.filter(t => t && !t.archived);
  const mias = vivas.filter(esDelDueno);
  const abiertas = mias.filter(abierta), hechas = mias.filter(t => !abierta(t));
  const hechaDesde = ms => hechas.filter(t => (t.doneAt || 0) >= ms).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const inicioHoy = new Date(hoy + 'T00:00').getTime();
  let p = [], h = [];
  if (k === 'bandeja') { p = abiertas.filter(t => !t.limite && !t.proyecto); h = hechaDesde(inicioHoy).filter(t => !t.limite && !t.proyecto); }
  else if (k === 'hoy') { p = abiertas.filter(t => t.empezada || (diaDe(t) && diaDe(t) <= hoy)); h = hechaDesde(inicioHoy); }
  else if (k === 'proximos') { p = abiertas.filter(t => diaDe(t) && diaDe(t) > hoy && diaDe(t) <= fin); }
  else if (k === 'todas') { p = abiertas; h = hechaDesde(hace(7)); }
  else if (k === 'delegadas') { const d = vivas.filter(delegadaPorMi); p = d.filter(t => abierta(t) || fallo(t)); h = d.filter(t => t.state === 'done' && !t.error && (t.doneAt || 0) >= hace(14)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)); }
  else if (k === 'hechas') { h = hechaDesde(hace(30)); }
  else if (String(k).startsWith('p:')) { const id = String(k).slice(2); p = abiertas.filter(t => t.proyecto === id); h = hechas.filter(t => t.proyecto === id).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)); }
  if (k === 'proximos') p.sort((a, b) => (diaDe(a) || '').localeCompare(diaDe(b) || '') || ordenMio(a, b));
  else if (k === 'delegadas') p.sort((a, b) => (fallo(b) - fallo(a)) || (b.delegada?.at || 0) - (a.delegada?.at || 0)); // lo que falló, arriba
  else p.sort(ordenMio);
  return { pendientes: p, hechas: h };
}

// cuántas hay en cada lista (el número del rail) y los proyectos que tienen alguna tarea del dueño abierta
export function cuentas(tareas, { ahora = Date.now() } = {}) {
  const out = {}; for (const l of LISTAS) { const r = deLista(tareas, l.k, { ahora }); out[l.k] = l.k === 'hechas' ? r.hechas.filter(t => dia(t.doneAt || 0) === dia(ahora)).length : r.pendientes.length; }
  const hoy = dia(ahora); out.vencidas = tareas.filter(t => esDelDueno(t) && !t.archived && abierta(t) && limiteMs(t.limite) != null && limiteMs(t.limite) < ahora).length;
  out.delegadasFallidas = tareas.filter(t => delegadaPorMi(t) && !t.archived && fallo(t)).length;
  out.hechasHoy = tareas.filter(t => esDelDueno(t) && !t.archived && !abierta(t) && t.doneAt && dia(t.doneAt) === hoy).length;
  const pr = {}; for (const t of tareas) if (esDelDueno(t) && !t.archived && abierta(t) && t.proyecto) pr[t.proyecto] = (pr[t.proyecto] || 0) + 1;
  out.proyectos = pr;
  return out;
}

// el grupo por fecha de una tarea (Todas y Próximos, como TaskView agrupa): vencidas · hoy · mañana · esta semana · más adelante · sin fecha
export const GRUPOS_FECHA = { vencidas: 'Vencidas', hoy: 'Hoy', manana: 'Mañana', semana: 'Esta semana', despues: 'Más adelante', sin: 'Sin fecha' };
export function grupoFecha(t, ahora = Date.now()) {
  const d = diaDe(t); if (!d) return 'sin';
  const lim = limiteMs(t.limite); if (lim != null && lim < ahora) return 'vencidas';
  if (d === dia(ahora)) return 'hoy'; if (d === dia(ahora + 864e5)) return 'manana';
  return d <= dia(ahora + 7 * 864e5) ? 'semana' : 'despues';
}
export function porFecha(lista, ahora = Date.now()) {
  const g = new Map(Object.keys(GRUPOS_FECHA).map(k => [k, []]));
  for (const t of lista) g.get(grupoFecha(t, ahora)).push(t);
  return [...g].filter(([, l]) => l.length).map(([k, l]) => ({ k, titulo: GRUPOS_FECHA[k], tareas: l }));
}

// HOY con lo vencido aparte y arriba (8 oct 2026): antes se mezclaba y, como se ordena por prioridad, una vencida podía quedar debajo de lo
// de hoy. Sin vencidas, un solo grupo (la lista no lleva títulos). Dentro de cada grupo, el orden de la lista (lo que estás haciendo primero).
export function gruposHoy(lista, ahora = Date.now()) {
  const vencida = t => { const l = limiteMs(t.limite); return l != null && l < ahora; };
  const v = lista.filter(vencida), h = lista.filter(t => !vencida(t));
  return v.length ? [{ k: 'vencidas', titulo: 'Vencidas', tareas: v }, ...(h.length ? [{ k: 'hoy', titulo: 'Hoy', tareas: h }] : [])] : [{ k: 'hoy', titulo: 'Hoy', tareas: h }];
}
// PRÓXIMOS 7 DÍAS con un título por día (8 oct 2026): «Mañana», «viernes 10 oct»… — tu agenda de la semana (antes: «Mañana» y «Esta semana»)
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const nombreDia = (d, ahora = Date.now()) => { if (d === dia(ahora)) return 'Hoy'; if (d === dia(ahora + 864e5)) return 'Mañana'; const x = new Date(d + 'T12:00'); return `${DIAS[x.getDay()]} ${x.getDate()} ${MESES[x.getMonth()]}`; };
export function porDia(lista, ahora = Date.now()) {
  const g = new Map(); for (const t of lista) { const d = diaDe(t) || ''; if (!g.has(d)) g.set(d, []); g.get(d).push(t); }
  return [...g].sort(([a], [b]) => (a || '9').localeCompare(b || '9')).map(([d, l]) => ({ k: d || 'sin', dia: d || null, titulo: d ? nombreDia(d, ahora) : 'Sin fecha', tareas: l }));
}

/* ---- el TABLERO personal: Por hacer · Haciendo · Hecha (48 h) ---- */
export const COLUMNAS_MIAS = [{ k: 'porhacer', titulo: 'Por hacer' }, { k: 'haciendo', titulo: 'Haciendo' }, { k: 'hecha', titulo: 'Hecha' }];
export const columnaMia = t => (t.state === 'done' ? 'hecha' : t.empezada ? 'haciendo' : 'porhacer');
// ¿qué significa soltar una tarjeta mía de la columna `de` en `a`? → { accion, texto } o null
export function movimientoMio(de, a) {
  if (de === a) return de === 'porhacer' ? { accion: 'orden', texto: 'cambiar su orden' } : null;
  return {
    'porhacer>haciendo': { accion: 'empezar', texto: 'empezarla' },
    'haciendo>porhacer': { accion: 'pausar', texto: 'dejarla para luego' },
    'porhacer>hecha': { accion: 'hecha', texto: 'marcarla hecha' },
    'haciendo>hecha': { accion: 'hecha', texto: 'marcarla hecha' },
    'hecha>porhacer': { accion: 'reabrir', texto: 'reabrirla' },
  }[`${de}>${a}`] || null;
}

/* ---- qué se puede hacer con una tarea, según de quién es (lo usan la API y el detalle: una sola regla) ---- */
// ¿puede el dueño TOMAR esta tarea de un agente? → { ok } | { ok: false, motivo }
export function puedeTomar(t) {
  if (!t) return { ok: false, motivo: 'esa tarea ya no existe' };
  if (esDelDueno(t)) return { ok: false, motivo: 'ya es tuya' };
  if (t.state === 'doing') return { ok: false, motivo: 'el agente está trabajando en ella: detenla primero, o espera a que entregue' };
  if (t.routine && t.state !== 'done') return { ok: false, motivo: 'es una ejecución de rutina: sáltala en el calendario o pausa la rutina' };
  if (t.team) return { ok: false, motivo: 'la tiene un equipo de agentes: espera a que entregue' };
  if (t.state === 'done' && !t.error) return { ok: false, motivo: 'ya está hecha: si hay que rehacerla, repítela' };
  return { ok: true };
}
// ¿puede delegarla? (solo una tarea suya que no está hecha)
export function puedeDelegar(t) {
  if (!t) return { ok: false, motivo: 'esa tarea ya no existe' };
  if (!esDelDueno(t)) return { ok: false, motivo: 'solo delegas una tarea tuya' };
  if (t.state === 'done') return { ok: false, motivo: 'ya está hecha' };
  return { ok: true };
}

/* ---- en palabras: para los agentes (ver_agenda, ver_tareas) y para Dimitri (<estado>) ---- */
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export function quienTexto(t, nombre = id => id) {
  if (esDelDueno(t)) return 'EL DUEÑO';
  if (t.person) return `${t.person} (persona del equipo)`;
  return nombre(t.agent);
}
/** La línea de Dimitri: cómo va la lista del dueño (vencidas, hoy, haciendo, bandeja, sugerencias) y lo que delegó que sigue abierto. */
export function resumenDueno(tareas, { ahora = Date.now(), nombre = id => id } = {}) {
  const c = cuentas(tareas, { ahora });
  const hoy = deLista(tareas, 'hoy', { ahora }).pendientes, venc = hoy.filter(t => limiteMs(t.limite) != null && limiteMs(t.limite) < ahora);
  const haciendo = tareas.filter(t => esDelDueno(t) && !t.archived && abierta(t) && t.empezada);
  const sug = tareas.filter(t => esDelDueno(t) && !t.archived && t.state === 'idea' && t.sugeridaPor);
  const del = deLista(tareas, 'delegadas', { ahora }).pendientes;
  const few = (l, f, n = 3) => l.slice(0, n).map(f).join(', ') + (l.length > n ? ` y ${l.length - n} más` : '');
  const t = x => `«${clip(x.title, 50)}» (${x.id})`;
  const out = [];
  if (venc.length) out.push(`${venc.length} vencidas: ${few(venc, t)}`);
  const deHoy = hoy.filter(x => !venc.includes(x));
  if (deHoy.length) out.push(`${deHoy.length} para hoy: ${few(deHoy, t)}`);
  if (haciendo.length) out.push(`haciendo: ${few(haciendo, t)}`);
  if (c.bandeja) out.push(`${c.bandeja} en la bandeja (sin fecha)`);
  if (c.proximos) out.push(`${c.proximos} en los próximos 7 días`);
  if (sug.length) out.push(`${sug.length} que te sugirieron los agentes: ${few(sug, x => `«${clip(x.title, 40)}» (de ${nombre(x.sugeridaPor)})`)}`);
  if (c.hechasHoy) out.push(`${c.hechasHoy} hechas hoy`);
  const linea1 = out.length ? `Las tareas del dueño (las hace él): ${out.join(' · ')}.` : 'Las tareas del dueño: no tiene nada abierto.';
  const linea2 = del.length ? `\nDelegó y siguen abiertas: ${few(del, x => `«${clip(x.title, 45)}» a ${x.person ? x.person : nombre(x.agent)} (${fallo(x) ? 'FALLÓ: el agente no pudo' : { idea: 'idea', scheduled: 'programada', next: 'en cola', doing: 'en curso', waiting: 'espera su OK' }[x.state] || x.state})`, 4)}.` : '';
  return linea1 + linea2;
}

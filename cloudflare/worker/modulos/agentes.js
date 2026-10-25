// Fase 4 del puerto — los agentes completos. Contesta, con las MISMAS rutas y formas que la oficina local:
//   /api/costs · /api/costs.csv · /api/costs/apply   (costs-core.mjs sobre la tabla `costos`)
//   /api/quality                                     (quality.mjs sobre las tareas)
//   /api/status · /api/notices/read                  (el semáforo y los avisos)
// y, cada minuto, el reloj de los agentes (lib/agentes/ejecutor.js): aprobaciones que salen, recordatorios y caducidad, las tareas de la cola que arrancan, y las corridas
// que avanzan un PASO (bucle de herramientas con el guardián de safety.mjs delante de cada llamada). Aprobar, devolver, detener, editar el borrador, deshacer y guardar
// como ejemplo son rutas de /api/tasks/*: viven en lib/tareas/tasks-api.js y llaman a lib/agentes/aprobaciones.js.
import { json, error, prohibido } from '../lib/respuesta.js';
import * as costsCore from '../../../costs-core.mjs';
import * as quality from '../../../quality.mjs';
import * as approvals from '../../../approvals.mjs';
import { leerContexto } from '../lib/tareas/contexto.js';
import { conSesion, cargarTareas } from '../lib/tareas/sesion.js';
import { guardarAgente } from '../lib/tareas/roster.js';
import * as RT from '../lib/tareas/rutinas.js';
import { leerDoc } from '../lib/almacen.js';
import { crearPresupuesto, contarD1 } from '../lib/contenido/presupuesto.js';
import * as costos from '../lib/agentes/costos.js';
import { tickAprobaciones } from '../lib/agentes/aprobaciones.js';
import { crearCorrida, crearCorridasPendientes, corridasVivas, avanzar, modoInicial } from '../lib/agentes/ejecutor.js';
import { tomarSiguiente } from './tareas.js';
import { secretoPermitido } from '../lib/conectores.js';
import { adjuntarTerminados } from '../lib/agentes/estudio-adjuntos.js';
import * as contenido from './contenido.js';
import * as estudio from './estudio.js';
import * as tareas from './tareas.js';
import { normModel } from '../../../src/models.js';

export const nombre = 'agentes';
export const grupos = ['costs', 'costs.csv', 'quality', 'status', 'notices', 'usage'];

/** Los módulos a los que las herramientas de un agente pueden llamar por función (sin pasar por sí mismo). */
const MODULOS_HERRAMIENTAS = [tareas, contenido, estudio];

const PROVEEDOR = env => (/^muse-/i.test(String(env.AI_MODELO || '')) ? { id: 'meta', name: 'Meta Muse' } : { id: 'anthropic', name: 'Claude (API de Anthropic)' });
const hayLlave = env => !!env.ANTHROPIC_API_KEY || !!(env.META_API_KEY || env.MODEL_API_KEY);

export async function manejar(ctx) {
  const { req, db, ruta, url, usuario, env } = ctx;
  const g = ruta.match(/^\/api\/([a-zA-Z0-9_.-]+)/)?.[1];
  if (!grupos.includes(g)) return null;
  const metodo = req.method;

  if (ruta === '/api/usage' && metodo === 'GET') { // el medidor de la esquina: en la nube no hay plan de Claude Code que medir, así que va el conteo propio de las últimas 5 horas (como la local sin plan)
    const ventana = 5 * 36e5, lineas = await costos.leer(db, Date.now() - ventana), t0 = lineas.length ? Math.min(...lineas.map((l) => l.t)) : null;
    const tokens = lineas.reduce((n, l) => n + (l.in || 0) + (l.out || 0) + (l.cacheRead || 0) + (l.cacheWrite || 0), 0);
    return json({ ok: true, source: 'office', window: { tokens, runs: lineas.length, startedAt: t0, resetsAt: t0 ? t0 + ventana : null } });
  }
  if (ruta === '/api/costs' && metodo === 'GET') {
    const C = await leerContexto(db), ahora = Date.now();
    const lineas = await costos.leer(db, ahora - 70 * 864e5), tareasL = await cargarTareas(db);
    return json({ ...costsCore.report(lineas, tareasL, C.agents, C.ajustes.costs, ahora), publicidad: { configurado: false, motivo: 'Anuncios de Meta todavía no está en la nube (fase 7).', texto: '' },
      subscription: false, provider: PROVEEDOR(env).name, config: costsCore.config(C.ajustes.costs), prices: costsCore.PRICES.map(({ match, ...p }) => p), priceSources: costsCore.PRICE_SOURCES });
  }
  if (ruta === '/api/costs.csv' && metodo === 'GET') {
    const C = await leerContexto(db), mes = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : new Date().toISOString().slice(0, 7);
    const texto = costsCore.csv(await costos.leer(db, Date.parse(mes + '-01T00:00:00Z') - 864e5), await cargarTareas(db), C.agents, mes);
    return new Response(texto, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="costos-${String(C.nombre).replace(/[^\w-]+/g, '-')}-${mes}.csv"`, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' } });
  }
  if (ruta === '/api/costs/apply' && metodo === 'POST') { // C4, C7: el dueño acepta una sugerencia
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador aplica una sugerencia de costos.');
    const b = (await req.json().catch(() => ({}))) || {}, action = b.action;
    const C = await leerContexto(db);
    if (action?.agent && ['sonnet', 'opus', 'fable'].includes(action.model)) {
      const r = await guardarAgente(db, action.agent, { model: action.model });
      if (r.problems?.length) return json({ error: r.problems.join(' · ') }, 400);
      return json({ ok: true, text: `${C.nombreAgente(action.agent)} usa ahora ${normModel(action.model)}.` });
    }
    if (action?.routine && action.paused === true) {
      const r = await RT.editarRutina(db, C.agents, action.routine, { paused: true });
      return r ? json({ ok: true, text: `Rutina «${r.title}» pausada.` }) : json({ error: 'esa rutina ya no existe' }, 404);
    }
    return json({ error: 'acción desconocida' }, 400);
  }
  if (ruta === '/api/quality' && metodo === 'GET') { // D1, D10
    const C = await leerContexto(db), l = await cargarTareas(db), corr = (await leerDoc(db, 'enrutador.correcciones', { lista: [] })).valor.lista || [];
    return json({ agents: quality.byAgent(l, C.agents), drops: [], routing: quality.rerouteRate(l, corr), reviews: l.filter(t => t.review && Date.now() - t.review.at < 28 * 864e5).length });
  }
  if (ruta === '/api/status' && metodo === 'GET') return json(await estado(env, db));
  if (ruta === '/api/notices/read' && metodo === 'POST') {
    if (usuario.rol === 'lectura') return prohibido();
    const { results } = await db.prepare("select id, json from filas where coleccion = 'avisos'").all();
    for (const r of results) { const j = JSON.parse(r.json); if (j.read) continue; j.read = true; await db.prepare("update filas set json = ? where coleccion = 'avisos' and id = ?").bind(JSON.stringify(j), r.id).run(); }
    return json({ ok: true });
  }
  return null;
}

/** El semáforo (serve.mjs → officeStatus), con lo que la nube sabe: el proveedor de IA, los conectores, las rutinas, la cola, las aprobaciones, los fallos, la seguridad. */
export async function estado(env, db) {
  const now = Date.now(), day = 864e5, checks = [];
  const add = (id, label, state, detail, fix = '') => checks.push({ id, label, state, detail, fix });
  const lista = await cargarTareas(db), C = await leerContexto(db);
  const ago = ms => { const m = Math.round(ms / 60000); return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
  const ultima = lista.filter(t => t.state === 'done' && !t.error && t.doneAt).sort((a, b) => b.doneAt - a.doneAt)[0];
  if (!hayLlave(env)) add('claude', 'Proveedor de IA', 'bad', 'Falta el secreto de la llave (ANTHROPIC_API_KEY o META_API_KEY): ninguna tarea puede correr.', 'Guárdala como secreto del repositorio en GitHub y vuelve a desplegar.');
  else add('claude', 'Proveedor de IA', 'ok', ultima ? `Última tarea terminada ${ago(now - ultima.doneAt)}.` : 'Todavía no terminó ninguna tarea.');
  const { results: cons } = await db.prepare('select nombre, secreto, activo from conectores').all();
  const sinToken = cons.filter(c => c.activo && c.secreto && (!secretoPermitido(c.secreto) || !env[c.secreto]));
  add('conectores', 'Conectores', sinToken.length ? 'warn' : 'info', cons.length ? `${cons.length} registrados${sinToken.length ? `; sin su secreto: ${sinToken.map(c => c.nombre).join(', ')}` : ''}.` : 'No hay conectores MCP registrados.', sinToken.length ? 'Guarda el token de cada uno como secreto en GitHub (MCP_<NOMBRE>_TOKEN) y vuelve a desplegar.' : '');
  const rs = (await RT.rutinasConEstado(db, C.agents)).list, falladas = rs.filter(r => { const t = lista.find(x => x.id === r.lastTaskId); return t && t.error; });
  add('rutinas', 'Rutinas', falladas.length ? 'warn' : 'ok', rs.length ? (falladas.length ? `La última ejecución falló en: ${falladas.map(r => '«' + r.title + '»').join(', ')}.` : `${rs.length} en el horario; ninguna falló la última vez.`) : 'No hay rutinas.');
  const esp = lista.filter(t => t.state === 'next' && !t.archived), reint = esp.filter(t => t.retryAt), vivas = (await corridasVivas(db)).length, viejo = esp.reduce((m, t) => Math.min(m, t.addedAt || now), now);
  add('cola', 'Cola de trabajo', esp.length && now - viejo > 3600e3 ? 'warn' : 'ok', esp.length ? `${esp.length} esperando${reint.length ? `, ${reint.length} con reintento programado` : ''}; ${vivas} en marcha.` : `Nada esperando; ${vivas} en marcha.`);
  const ap = lista.filter(t => t.state === 'waiting' && !t.archived), viejas = ap.filter(t => now - (t.waitingAt || now) > day);
  add('aprobaciones', 'Aprobaciones', viejas.length ? 'warn' : 'ok', ap.length ? `${ap.length} esperan tu visto bueno${viejas.length ? `, ${viejas.length} desde hace más de un día` : ''}.` : 'Nada espera tu visto bueno.');
  const errs = lista.filter(t => t.error && !t.stopped && now - (t.doneAt || 0) < day);
  add('errores', 'Fallos (24 h)', errs.length > 2 ? 'bad' : errs.length ? 'warn' : 'ok', errs.length ? `${errs.length} tarea(s) fallaron: ${errs.slice(0, 3).map(t => '«' + t.title.slice(0, 40) + '»').join(', ')}.` : 'Ninguna tarea falló.');
  const sec = lista.filter(t => t.guard && now - (t.guard.at || 0) < day), manchadas = sec.filter(t => t.guard.taint);
  add('seguridad', 'Seguridad (24 h)', manchadas.length ? 'bad' : sec.length ? 'warn' : 'ok', manchadas.length ? `${manchadas.length} tarea(s) leyeron algo con órdenes escondidas; no se envió nada.` : sec.length ? `El guardián detuvo algo en ${sec.length} tarea(s).` : 'Sin bloqueos.', manchadas.length || sec.length ? 'Ábrelas: el detalle dice qué se detuvo y por qué.' : '');
  const mes = await costos.estadoDelMes(db, C.ajustes.costs, now);
  if (mes.level !== 'none') add('presupuesto', 'Presupuesto del mes', mes.level === 'over' ? 'bad' : mes.level === 'alert' ? 'warn' : 'ok', `US$${mes.spent.toFixed(2)} de US$${mes.budget.toFixed(2)}.`);
  const overall = checks.some(c => c.state === 'bad') ? 'bad' : checks.some(c => c.state === 'warn') ? 'warn' : 'ok';
  const { results } = await db.prepare("select json from filas where coleccion = 'avisos' order by orden desc limit 30").all();
  const notices = results.map(r => JSON.parse(r.json));
  return { overall, checks, notices, unread: notices.filter(n => !n.read).length, at: now };
}

/* ---------- el reloj ---------- */
export const TOPE_CORRIDAS_POR_MINUTO = 3;

/** Un minuto de los agentes. `opciones.deps` (pruebas): { fetchFn, ahora }. → un resumen de lo que hizo. */
export async function cadaMinuto(env, opciones = {}) {
  const pres = crearPresupuesto({ CONTENIDO_MAX_LLAMADAS: env['AGENTES_MAX_LLAMADAS'], CONTENIDO_MAX_CONSULTAS: env['AGENTES_MAX_CONSULTAS'], CONTENIDO_MAX_ACCIONES: '9' });
  const db = contarD1(env.DB, pres.interna);
  const ahoraFn = opciones.ahora || (() => Date.now());
  const fetchFn = opciones.fetchFn || env.__pruebas?.fetch || ((...a) => fetch(...a));
  const resumen = { aprobaciones: null, tomadas: [], avanzadas: [] };
  const C = await leerContexto(db), aj = C.ajustes, apr = approvals.config(aj.approvals);
  // 1) lo aprobado cuya ventana de «deshacer» pasó sale; recordatorios y caducidad
  resumen.aprobaciones = await conSesion(db, {}, async s => tickAprobaciones({ s, db, apr, ahora: ahoraFn() }));
  // 2) las órdenes de correr (aprobada, devuelta) y las que se quedaron sin corrida → corridas
  resumen.antes = pres.consultas;
  const sinPresupuesto = await costos.sinPresupuesto(db, aj.costs, ahoraFn()); // B8: con el tope del mes cruzado y «detener al llegar», NADA nuevo arranca (ni la cola, ni lo aprobado, ni una corrida que aún no empezó)
  resumen.sinPresupuesto = sinPresupuesto;
  resumen.pendientes = await crearCorridasPendientes(db, ahoraFn(), { sinPresupuesto });
  // 3) la cola: lo que toca arrancar ahora (si hay con qué pensar y el presupuesto del mes lo permite)
  if (hayLlave(env)) {
    const max = Math.max(1, Math.min(8, +aj.concurrency || 3));
    const tomadas = await tomarSiguiente(db, { max, ahora: ahoraFn(), sinPresupuesto });
    for (const t of tomadas) { await crearCorrida(db, t, { modo: modoInicial(t) }, ahoraFn()); resumen.tomadas.push(t.id); }
  }
  // 4) las corridas avanzan un paso (las que nadie tiene en este momento), hasta que se acabe el presupuesto de la invocación
  const deps = { env, db, presupuesto: pres, modulos: MODULOS_HERRAMIENTAS, fetchFn, ahora: ahoraFn };
  const vivas = (await corridasVivas(db)).filter(c => c.candado_hasta < ahoraFn() && !(sinPresupuesto && c.paso === 0)); // las que ya empezaron terminan; las nuevas esperan
  for (const c of vivas.slice(0, TOPE_CORRIDAS_POR_MINUTO)) {
    if (!pres.puedeSeguir({ llamadas: 3, consultas: 14 })) break;
    resumen.avanzadas.push(await avanzar(deps, c.tarea));
  }
  // 5) lo que el Estudio terminó mientras tanto se pega en la tarea que lo pidió (en lugar de su línea ⏳)
  if (pres.puedeSeguir({ llamadas: 1, consultas: 10 })) resumen.adjuntos = await adjuntarTerminados(db);
  resumen.consultas = pres.consultas; resumen.llamadas = pres.llamadas;
  return resumen;
}


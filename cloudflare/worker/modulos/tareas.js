// Fase 3 del puerto — Tareas, rutinas y calendario. Contesta, con las MISMAS rutas y formas que la oficina local:
//   /api/tasks/*      (serve.mjs: crear, listar, editar, archivar, repetir, comentar…)         → lib/tareas/tasks-api.js
//   /api/tareas/*     (tareas/rutas.mjs y rutas-dueno.mjs, las mismas del repositorio)          → lib/tareas/servicios.js
//   /api/routines/*   (rutinas: crear, pausar, saltar una ejecución, editar, ejecutar ya)      → lib/tareas/rutinas.js
//   /api/team · /api/agents · /api/calendar.ics
// y, cada minuto, el reloj de serve.mjs: las rutinas que tocan se vuelven tareas, las programadas para ahora pasan a la cola y los avisos de fecha límite.
// Los agentes NO se ejecutan aquí (fase 4): la cola queda lista y la fase 4 la lee con tomarSiguiente(db) y devuelve lo que hizo con guardarEjecucion(db, …).
import { json, error, prohibido } from '../lib/respuesta.js';
import { conSesion, cargarTareas } from '../lib/tareas/sesion.js';
import { leerContexto } from '../lib/tareas/contexto.js';
import { armarServicios, correrRuta } from '../lib/tareas/servicios.js';
import { manejarTasks, sinMarca } from '../lib/tareas/tasks-api.js';
import { crearEnrutador } from '../lib/tareas/enrutar.js';
import { guardarAgente, cargarRoster, agentesSalida, DEPTS } from '../lib/tareas/roster.js';
import * as RT from '../lib/tareas/rutinas.js';
import * as R from '../../../routines-core.mjs';
import { icsFeed } from '../../../calendario-ics.mjs';
import { avisosLimite } from '../../../tareas/ritmo.mjs';
import { progresoProyecto } from '../../../tareas/progreso.mjs';
import { planear } from '../../../tareas/cola.mjs';
import { dia, DUENO } from '../../../tareas/dueno.mjs';
import { normModel, normEffort } from '../../../src/models.js';
import { valid as validWhen } from '../../../src/when.js';
import { mutarDoc } from '../lib/almacen.js';
import { skillsDe, leccionesDe } from '../lib/agentes/contexto.js';
import { olvidarLeccion } from '../lib/agentes/lecciones.js';

export const nombre = 'tareas';
export const grupos = ['tasks', 'tareas', 'routines', 'team', 'agents', 'calendar.ics'];

const respuestaDe = res => json(sinMarca(res.objeto), res.estado);

const MAX_CUERPO = 1 << 20; // 1 MB, como la oficina local: una tarea, una rutina o un comentario son unos KB
async function leerCuerpo(req) {
  const t = await req.text();
  if (!t) return {};
  if (t.length > MAX_CUERPO) return 'grande';
  try { const j = JSON.parse(t); return j && typeof j === 'object' ? j : {}; } catch { return null; }
}

export async function manejar(ctx) {
  try { return await manejarGrupo(ctx); }
  catch (e) { // otra petición cambió lo mismo y tres intentos no bastaron: se pide repetir, no es un fallo del servidor
    if (e?.conflicto) return json({ error: 'Otra persona cambió esto al mismo tiempo: vuelve a intentarlo.', conflicto: true }, 409);
    throw e;
  }
}

async function manejarGrupo(ctx) {
  const { req, env, db, ruta, url, usuario } = ctx;
  const g = ruta.match(/^\/api\/([a-zA-Z0-9_.-]+)/)?.[1];
  if (!grupos.includes(g)) return null;
  const escribe = req.method !== 'GET' && req.method !== 'HEAD';
  if (escribe && usuario.rol === 'lectura') return prohibido('Tu usuario solo puede mirar.');
  const b = escribe ? await leerCuerpo(req) : {};
  if (b === 'grande') return json({ error: 'request too large' }, 413);
  if (b === null) return json({ error: 'the body is not valid JSON' }, 400);
  if (escribe && usuario.rol !== 'admin' && (g === 'tareas' || g === 'tasks')) { const v = await vetoNoAdmin({ db, ruta, b, metodo: req.method }); if (v) return prohibido(v); }

  if (g === 'team' && req.method === 'GET') {
    const C = await leerContexto(db);
    return json({ people: C.personas.map(p => ({ name: p.name, depts: p.depts || [], telegram: !!p.telegram })) });
  }
  if (g === 'agents') return manejarAgentes({ req, env, db, ruta, usuario, b });
  if (g === 'routines') return manejarRutinas({ req, env, db, ruta, usuario, b });
  if (g === 'calendar.ics' && req.method === 'GET') {
    const C = await leerContexto(db);
    const { list } = await RT.rutinasConEstado(db, C.agents);
    const texto = icsFeed({ rutinas: list, tareas: await cargarTareas(db), agentes: C.agents, depts: C.depts, nombre: C.nombre, ahora: new Date() });
    return new Response(texto, { status: 200, headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="oficina.ics"', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' } });
  }
  if (g === 'tasks' || g === 'tareas') return manejarTareas({ req, env, db, ruta, url, usuario, b, g });
  return null;
}

/* ---------- lo que en la página es «del dueño» y aquí solo lo hace un administrador ---------- */
/** Las rutas de /api/tareas/* (las MISMAS de la oficina local) tratan a quien llega por la página como EL DUEÑO: en la nube hay editores, y lo que decide el dueño no es de ellos.
 *  Dos cosas que el resto del módulo ya negaba por /api/tasks y que /api/tareas dejaba pasar (revisión transversal del 25 oct):
 *   · `needsOk: false` en cualquier cuerpo (delegar una tarea sin pedir el visto bueno);
 *   · mover, tomar, delegar, archivar, borrar o pasar a una persona una tarea que ESPERA EL OK del dueño (un editor la descartaba o la sacaba de Aprobaciones sin decidir). */
const SOBRE_TAREA = /^\/api\/(?:tareas|tasks)\/([A-Za-z0-9_-]{3,40})\/(estado|tomar|delegar|archive|person|run)$/;
const BORRAR_TAREA = /^\/api\/tasks\/([A-Za-z0-9_-]{3,40})$/;
export async function vetoNoAdmin({ db, ruta, b, metodo = 'POST' }) {
  if (b && typeof b === 'object' && b.needsOk === false) return 'Solo un administrador decide que una tarea no pida su visto bueno.';
  const m = SOBRE_TAREA.exec(ruta) || (metodo === 'DELETE' ? BORRAR_TAREA.exec(ruta) : null);
  if (!m) return null;
  const f = await db.prepare("select json_extract(json,'$.state') as st from filas where coleccion = 'tareas' and id = ?").bind(m[1]).first();
  if (f?.st === 'waiting') return 'Esa tarea espera el visto bueno del dueño: solo un administrador la mueve, la toma, la delega o la archiva.';
  return null;
}

/* ---------- tareas ---------- */
function bitacoraNecesaria(ruta, url) {
  const m = ruta.match(/^\/api\/tareas\/([a-z0-9]{4,24})(?:\/bitacora)?$/i);
  if (m && m[1] !== 'catalogo' && m[1] !== 'agenda' && m[1] !== 'resumen' && m[1] !== 'cronometro') return { tareas: [m[1]] };
  if (ruta === '/api/tareas/resumen') { const dias = Math.max(7, Math.min(180, +url.searchParams.get('dias') || 30)); return { desde: Date.now() - dias * 864e5, tipos: ['estado', 'creada'] }; }
  return null;
}

/** Las rutas que SÍ valen sobre una tarea con el OK dado (todo lo demás la movería o la cambiaría): deshacer, decidir (que contesta por su cuenta), comentar y mirar. */
const CON_OK_PERMITIDAS = new Set(['undo', 'approve', 'reject', 'draft', 'comment', 'seen', 'example', 'vote', 'nota', 'comentario', 'bitacora']);
/** → la tarea con `approving` a la que toca esta petición, o null. Se mira el id de la ruta y los ids del cuerpo (lotes). */
function tareaConAprobacion(s, ruta, b) {
  const m = ruta.match(/^\/api\/(?:tasks|tareas)\/([A-Za-z0-9_-]+)(?:\/([a-z-]+))?/);
  if (m && (m[1] === 'approve-batch' || CON_OK_PERMITIDAS.has(m[2] || ''))) return null; // el lote de aprobar contesta 409 por cada tarea que ya está aprobada
  const ids = new Set(); if (m) ids.add(m[1]);
  for (const k of ['ids', 'tareas']) if (Array.isArray(b?.[k])) for (const x of b[k]) ids.add(String(x));
  if (b?.id) ids.add(String(b.id));
  if (!ids.size) return null;
  return s.alm.load().find(t => t.approving && ids.has(t.id)) || null;
}

async function manejarTareas({ req, env, db, ruta, url, usuario, b, g }) {
  const C = await leerContexto(db);
  const ligera = g === 'tasks' && ruta === '/api/tasks' && req.method === 'GET' && url.searchParams.get('light') === '1';
  const respuesta = await conSesion(db, { bitacora: bitacoraNecesaria(ruta, url), ligera }, async s => {
    const serv = armarServicios(s, { env, contexto: C, fetchFn: env.__pruebas?.fetchIA }, b);
    const choque = req.method === 'GET' ? null : tareaConAprobacion(s, ruta, b); // el OK ya dado vale para ese borrador: mientras corre la ventana de «deshacer», nada lo mueve
    if (choque) return json({ error: `«${choque.title}» ya tiene tu visto bueno y se envía en unos segundos: deshaz la aprobación primero si quieres cambiarla.` }, 409);
    if (g === 'tasks') return await manejarTasks({ req, url, ruta, usuario, db, s, serv, b });
    const consulta = url.searchParams.toString();
    const datos = { metodo: req.method, ruta, query: consulta, headers: {} }; // sin x-office-by: quien llega por la página es el dueño; Telegram entra por su propio camino (fase 6)
    for (const rutas of [serv.dueno, serv.tareas]) { const res = await correrRuta(rutas, datos); if (res) return respuestaDe(res); }
    return json({ error: 'esa ruta no existe' }, 404);
  });
  return respuesta ?? json({ error: 'esa ruta no existe' }, 404);
}

/* ---------- agentes (el roster) ---------- */
async function manejarAgentes({ req, db, ruta, usuario, b }) {
  const C = await leerContexto(db);
  if (ruta === '/api/agents' && req.method === 'GET') {
    const { listarFilas } = await import('../lib/almacen.js');
    const sk = await listarFilas(db, 'skills', { limite: 200 });
    const { results: fb } = await db.prepare("select clave, json from docs where clave like 'feedback.%'").all();
    const reglas = new Map(fb.map(f => { try { return [f.clave.slice(9), (JSON.parse(f.json).rules || []).length]; } catch { return [f.clave.slice(9), 0]; } }));
    const agents = C.salida().map(a => ({ ...a, skills: sk.filter(s => s && s.text && (s.everyone || (s.agents || []).includes(a.id) || (s.departments || []).includes(a.department))).map(s => s.name), lessons: reglas.get(a.id) || 0 }));
    return json({ agents, problems: C.roster.problems, files: C.roster.files });
  }
  const m = ruta.match(/^\/api\/agents\/([a-z0-9_-]+)(?:\/(forget))?$/i);
  if (!m) return null;
  const a = C.agents.find(x => x.id === m[1]);
  if (!a) return json({ error: 'no such agent' }, 404);
  if (m[2] === 'forget' && req.method === 'POST') { // ✕ de la ficha: el agente olvida una lección
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia lo que aprende un agente.');
    return (await olvidarLeccion(db, a.id, b.line)) ? json({ ok: true }) : json({ error: 'esa lección ya no está' }, 404);
  }
  if (req.method === 'PATCH') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia a los agentes.');
    const patch = {};
    for (const k of ['name', 'role', 'does', 'brief', 'model', 'effort']) if (typeof b[k] === 'string') patch[k] = b[k];
    if (Array.isArray(b.tools)) patch.tools = b.tools;
    const r = await guardarAgente(db, a.id, patch);
    if (r.problems.length) return json({ error: r.problems.join(' · ') }, 400);
    const R2 = await cargarRoster(db);
    return json({ ok: true, agent: agentesSalida(R2.agents).find(x => x.id === a.id) });
  }
  if (req.method !== 'GET') return null;
  const tareas = (await cargarTareas(db)).filter(t => t.agent === a.id || t.team?.pieces?.some(p => p.agent === a.id));
  const hechas = tareas.filter(t => t.state === 'done'), bien = hechas.filter(t => !t.error);
  const dur = bien.filter(t => t.startedAt && t.doneAt).map(t => t.doneAt - t.startedAt);
  return json({
    agent: C.salida().find(x => x.id === a.id), skills: (await skillsDe(db, a)).map(s => ({ name: s.name, description: s.description || '', agents: s.agents || [], departments: s.departments || [], everyone: !!s.everyone, files: (s.files || []).map(f => f.name), source: 'brain', path: '' })), biblioteca: [], lessons: await leccionesDe(db, a.id),
    stats: { done: bien.length, failed: hechas.length - bien.length, running: tareas.filter(t => t.state === 'doing').length, waiting: tareas.filter(t => t.state === 'waiting').length, pending: tareas.filter(t => t.state === 'next' || t.state === 'scheduled').length, avgMinutes: dur.length ? Math.round(dur.reduce((x, y) => x + y, 0) / dur.length / 60000) : null },
    recent: tareas.filter(t => !t.archived).sort((x, y) => (y.doneAt || y.addedAt || 0) - (x.doneAt || x.addedAt || 0)).slice(0, 10).map(t => ({ id: t.id, title: t.title, state: t.state, error: !!t.error, at: t.doneAt || t.addedAt })),
    connectors: [], studio: false, contenido: false,
  });
}

/* ---------- rutinas ---------- */
const MAX_TEXTO_RUTINA = 4000;
const CLAVES_WHEN = ['kind', 'at', 'days', 'day', 'nth', 'weekday', 'every', 'from', 'to', 'weekdaysOnly', 'start', 'end', 'count'];
/** El horario de una rutina, solo con las claves que existen (lo demás no se guarda) y ya validado. → el horario limpio, o null si no vale. */
function limpiarWhen(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
  const l = {}; for (const k of CLAVES_WHEN) if (w[k] !== undefined) l[k] = w[k];
  return validWhen(l) ? l : null;
}
async function manejarRutinas({ req, env, db, ruta, usuario, b }) {
  const C = await leerContexto(db);
  const salida = async extra => json({ ...extra, routines: (await RT.rutinasConEstado(db, C.agents)).list });
  if (ruta === '/api/routines' && req.method === 'GET') return json(await RT.salidaRutinas(db, C.agents));
  if (ruta === '/api/routines' && req.method === 'POST') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador crea rutinas.');
    if (!DEPTS[b.dept] || b.dept === 'brain') return json({ error: 'departamento desconocido' }, 400);
    if (!R.ALLOWED.includes(b.dept)) return json({ error: R.refusal(b.dept), refused: true }, 400);
    if (typeof b.text !== 'string' || b.text.trim().length > MAX_TEXTO_RUTINA) return json({ error: 'el texto de la rutina debe tener entre 1 y 4000 caracteres' }, 400);
    let when = b.when; if (when !== undefined && when !== null) { when = limpiarWhen(when); if (!when) return json({ error: 'ese horario no está completo' }, 400); }
    const enrutar = crearEnrutador({ env, agents: C.agents, depts: C.depts, nombre: C.nombre, fetchFn: env.__pruebas?.fetchIA });
    const r = await RT.crearRutina(db, { agents: C.agents, enrutar }, { dept: b.dept, text: b.text, when: when ?? undefined, agent: b.agent, needsOk: b.needsOk, model: b.model, effort: b.effort, team: b.team === true });
    return json(r, r.error ? 400 : 200);
  }
  const m = ruta.match(/^\/api\/routines\/([^/]+)(?:\/(run|pause|resume|skip|unskip))?$/);
  if (!m) return null;
  const { routines } = await RT.cargarRutinas(db, C.agents);
  const r = routines.find(x => x.id === m[1]);
  if (!r) return json({ error: 'no such routine' }, 404);
  if (req.method === 'DELETE') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador borra rutinas.');
    await RT.borrarRutina(db, C.agents, r.id); return salida({ ok: true });
  }
  if (req.method !== 'POST' && req.method !== 'PATCH') return json({ error: 'POST, PATCH or DELETE' }, 405);
  if (m[2] === 'run' && usuario.rol !== 'admin' && (r.autonomous === true || r.needsOk === false)) { // una rutina que envía sola (autonomía ganada) o que no pide el OK la dispara el dueño: un editor la repetiría a su antojo
    return prohibido('Esa rutina no espera tu visto bueno (corre sola o sin OK): solo un administrador la ejecuta ahora. Tú puedes ejecutar las que piden el OK del dueño.');
  }
  if (m[2] === 'run') { // «ejecutar ya»: la rutina se vuelve tarea ahora (pide el OK como toda rutina con needsOk)
    const tarea = await conSesion(db, async s => {
      const serv = armarServicios(s, { env, contexto: C, fetchFn: env.__pruebas?.fetchIA }, {});
      const enLista = (await RT.rutinasConEstado(db, C.agents)).list.find(x => x.id === r.id);
      return RT.dispararRutina(serv.altaTarea, s.avisar, enLista || r, { by: 'you', equipos: C.equipos });
    });
    await mutarDoc(db, RT.DOC_ESTADO, {}, st => { R.advance(st, r, Date.now(), tarea.id, false); return st; });
    return salida({ ok: true, task: tarea });
  }
  if (m[2] === 'pause' || m[2] === 'resume') { await RT.editarRutina(db, C.agents, r.id, { paused: m[2] === 'pause' }); return salida({ ok: true }); }
  if (m[2] === 'skip' || m[2] === 'unskip') { // una ejecución del horario, por su hora (ms): se salta, o vuelve
    const t = +b.at;
    if (!(t > Date.now())) return json({ error: 'esa ejecución ya pasó' }, 400);
    await RT.saltarEjecucion(db, r.id, t, m[2] === 'skip');
    return salida({ ok: true });
  }
  // Pausar o reanudar lo puede cualquiera que trabaje; cambiar lo que la rutina HACE (texto, horario, agente, modelo, si pide OK) es de un administrador.
  if (usuario.rol !== 'admin' && !(Object.keys(b).length > 0 && Object.keys(b).every(k => k === 'paused'))) return prohibido('Solo un administrador cambia lo que hace una rutina; tú puedes pausarla o reanudarla.');
  const patch = {};
  if (typeof b.needsOk === 'boolean') patch.needsOk = b.needsOk; if (typeof b.paused === 'boolean') patch.paused = b.paused;
  if (typeof b.text === 'string') { const t = b.text.trim(); if (!t || t.length > 4000) return json({ error: 'el texto de la rutina debe tener entre 1 y 4000 caracteres' }, 400); patch.text = t; }
  if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 90);
  if (b.when !== undefined) {
    const w = limpiarWhen(b.when);
    if (!w) return json({ error: 'ese horario no está completo' }, 400);
    if (w.start && w.start < dia(Date.now())) return json({ error: 'la fecha de inicio ya pasó' }, 400);
    patch.when = w;
  }
  if (b.agent !== undefined) { const a = C.agents.find(x => x.id === b.agent && x.department === r.dept); if (!a) return json({ error: 'ese agente no está en el departamento de la rutina' }, 400); patch.agent = a.id; }
  if (b.model !== undefined) patch.model = normModel(b.model) || '';
  if (b.effort !== undefined) patch.effort = normEffort(b.effort) || '';
  if (typeof b.team === 'boolean') { patch.team = b.team ? true : undefined; if (b.team) { const lead = C.agents.find(x => x.department === r.dept && x.lead); if (lead) patch.agent = lead.id; } } // todo el equipo: el jefe la lleva
  const out = await RT.editarRutina(db, C.agents, r.id, patch);
  return salida({ ok: true, routine: out });
}

/* ---------- el reloj (serve.mjs → tickRoutines, tickScheduled, tickLimites) ---------- */
export async function cadaMinuto(env, ahoraMs = Date.now()) { // `ahoraMs`: solo las pruebas lo cambian
  const db = env.DB; // la zona de la oficina ya está instalada (lib/rutas.js)
  const ahora = ahoraMs;
  const C = await leerContexto(db);
  // MEDIO-2: primero se crean las tareas (cada una con su id estable) y DESPUÉS se adelanta el reloj. Si algo se cae entre los dos pasos, el reloj no avanzó: el minuto
  // siguiente planea lo mismo, las tareas ya existen (el mismo id no nace dos veces) y solo se confirma el reloj. Nunca queda una rutina «hecha» sin su tarea.
  const plan = await RT.planearReloj(db, C.agents, ahora);
  const { disparos, avisos } = plan;
  const hayProgramadas = !!(await db.prepare("select 1 x from filas where coleccion = 'tareas' and json_extract(json,'$.state') = 'scheduled' and json_extract(json,'$.dueAt') <= ? limit 1").bind(ahora).first());
  const toca10 = new Date(ahora).getMinutes() % 10 === 0;
  if (disparos.length || avisos.length || hayProgramadas || toca10) {
    await conSesion(db, async s => {
      const serv = armarServicios(s, { env, contexto: C, fetchFn: env.__pruebas?.fetchIA }, {});
      for (const a of avisos) s.avisar(a.kind, a.text, { key: a.key });
      for (const d of disparos) RT.dispararRutina(serv.altaTarea, s.avisar, d.rutina, { id: d.id, due: d.due, late: d.late, missed: d.missed, equipos: C.equipos });
      if (hayProgramadas) pasarProgramadas(s, ahora);
      if (toca10) avisarLimites(s, C, ahora);
    });
  }
  await RT.confirmarReloj(db, plan); // si otro reloj lo cambió a la vez, no se pisa: el minuto siguiente lo reintenta (las tareas ya están)
  if (toca10 && new Date(ahora).getHours() === 3 && new Date(ahora).getMinutes() === 10) await limpiar(db, ahora);
}

/** V3.2.1: una tarea programada para una fecha pasa a la cola en su minuto (tarde, una sola vez, si la oficina estuvo parada). */
export function pasarProgramadas(s, ahora) {
  const l = s.alm.load(); let cambio = false;
  for (const t of l) {
    if (t.state !== 'scheduled' || !(t.dueAt <= ahora)) continue;
    t.state = 'next'; t.due = t.dueAt; t.late = ahora - t.dueAt > R.LATE_AFTER; t.addedAt = ahora; cambio = true;
  }
  if (cambio) s.alm.save(l);
}

/** plan T5: los avisos de fecha límite (la víspera, el día de una persona, al vencer) y los proyectos que se atrasan, una vez cada uno. */
export function avisarLimites(s, C, ahora) {
  const l = s.alm.load(), av = avisosLimite(l, ahora);
  if (av.length) {
    const porId = new Map(l.map(t => [t.id, t]));
    for (const x of av) {
      const t = porId.get(x.id); (t.avisos ||= {})[x.tipo] = ahora;
      const quien = t.person === DUENO ? 'tuya' : t.person ? t.person : C.nombreAgente(t.agent);
      const txt = x.tipo === 'vencida' ? `Venció «${t.title}» (${quien}, límite ${String(t.limite).replace('T', ' ')}).` : x.tipo === 'vispera' ? `Mañana vence «${t.title}» y aún no empezó (${quien}).` : `Hoy vence «${t.title}».`;
      s.avisar('limite', txt, { level: x.tipo === 'vencida' ? 'warn' : 'info', task: t.id, key: `limite-${x.tipo}-${t.id}` });
      if (t.person && t.person !== DUENO) s.avisar('persona', `⚑ ${txt}`, { persona: t.person });
    }
    s.alm.save(l, { por: 'oficina' });
  }
  const hoy = dia(ahora);
  for (const p of s.cat.proyectos().filter(x => x.estado === 'activo')) {
    const g = progresoProyecto(p, l, ahora);
    if (g.atrasado && p.avisoAtraso !== hoy) {
      s.cat.cambiarProyecto(p.id, { avisoAtraso: hoy });
      s.avisar('proyecto', `El proyecto «${p.nombre}» va atrasado: ${g.hechas}/${g.total} hechas${g.vencidas ? `, ${g.vencidas} tareas vencidas` : ''}${g.bloqueadas ? `, ${g.bloqueadas} bloqueadas` : ''}. Míralo en Tareas → Proyectos (H).`, { level: 'warn', key: 'proyecto-' + p.id });
    }
  }
}

/** Una vez al día: la bitácora de más de 400 días y los avisos leídos de más de 60 se van (la local los archivaba a mano). */
async function limpiar(db, ahora) {
  await db.prepare('delete from tarea_bitacora where t < ?').bind(ahora - 400 * 864e5).run();
  await db.prepare("delete from filas where coleccion = 'avisos' and orden < ?").bind(ahora - 60 * 864e5).run();
  for (let i = 0; i < TANDAS_ARCHIVO && (await archivarViejas(db, ahora)) >= LOTE_ARCHIVO; i++);
}

/** Las tareas HECHAS hace más de `DIAS_HECHAS_VIVAS` días salen del conjunto vivo (`filas.coleccion = 'tareas'`) y pasan, sin tocarlas, a 'tareas-archivo'.
 *  Por qué: cada petición de tareas carga TODAS las vivas; medido (revisión transversal del 25 oct): con 10.000 tareas hechas una petición tarda ~2 s y una alta sube ~450 MB de montón,
 *  más que los 128 MB de un Worker; a 30 tareas al día eso son menos de 12 meses. El resumen mira como mucho 180 días (`/api/tareas/resumen`). Nada se borra: la fila viaja entera.
 *  Una dependencia (`bloqueadaPor`) a una tarea archivada no bloquea (ya estaba hecha). → cuántas pasó. */
export const DIAS_HECHAS_VIVAS = 180, LOTE_ARCHIVO = 400, TANDAS_ARCHIVO = 5;
export async function archivarViejas(db, ahora = Date.now()) {
  const corte = ahora - DIAS_HECHAS_VIVAS * 864e5;
  const donde = "coleccion = 'tareas' and json_extract(json,'$.state') = 'done' and coalesce(json_extract(json,'$.doneAt'), json_extract(json,'$.startedAt'), json_extract(json,'$.addedAt'), 0) < ?";
  const [ins] = await db.batch([
    db.prepare(`insert or replace into filas (coleccion, id, json, orden, actualizado) select 'tareas-archivo', id, json, orden, actualizado from filas where ${donde} order by orden limit ?`).bind(corte, LOTE_ARCHIVO),
    db.prepare("delete from filas where coleccion = 'tareas' and id in (select id from filas where coleccion = 'tareas-archivo')"),
  ]);
  return ins?.meta?.changes ?? 0;
}

/* ---------- lo que usará la fase 4 (agentes) y las demás fases ---------- */

/** La cola de la oficina (tareas/cola.mjs): decide qué tarea arranca ahora y la RESERVA —next → doing, tomada por su agente— con el mismo candado de versión que
 *  todo lo demás, así dos relojes a la vez no arrancan la misma. Devuelve las tareas reservadas (la fase 4 las ejecuta y devuelve el resultado con guardarEjecucion).
 *  `max`: cuántos procesos a la vez (la local: cfg.concurrency, 3); `sinPresupuesto`: no arranca nada (el tope del mes). */
export async function tomarSiguiente(db, { max = 3, ahora = Date.now(), sinPresupuesto = false } = {}) {
  return conSesion(db, async s => {
    const { arrancar } = planear(s.alm.load(), { enVuelo: 0, max, ahora, sinPresupuesto });
    for (const id of arrancar) s.alm.cambiar(id, t => { t.state = 'doing'; t.startedAt = ahora; t.tomadaPor = 'agente:' + t.agent; delete t.ask; }, { por: 'oficina' });
    const l = s.alm.load();
    return arrancar.map(id => l.find(t => t.id === id));
  });
}

/** Una ejecución terminó: guarda su copia MEZCLADA con lo que el dueño hizo mientras tanto (tareas/cambios.mezclar). `base` es la copia con la que arrancó. */
export async function guardarEjecucion(db, base, mio, { por = null } = {}) {
  return conSesion(db, async s => s.alm.guardarEjecucion(base, mio, { por }));
}

/** Crea una tarea desde otro módulo (Contenido «llenar la semana», un disparador…) con las mismas reglas que la barra. → la tarea */
export async function altaTareaDb(env, campos, opciones = {}) {
  const C = await leerContexto(env.DB);
  return conSesion(env.DB, async s => armarServicios(s, { env, contexto: C, fetchFn: env.__pruebas?.fetchIA }, {}).altaTarea(campos, opciones));
}

export { cargarTareas as leerTareas } from '../lib/tareas/sesion.js';

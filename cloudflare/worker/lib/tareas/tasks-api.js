// /api/tasks/* — las rutas de siempre de serve.mjs (crear, listar, editar, archivar, repetir, comentar, pasar a una persona…), con las mismas respuestas.
// Fase 4: aprobar, devolver, detener, ejecutar con correcciones, editar el borrador, deshacer y los ejemplos (lib/agentes/aprobaciones.js). SOLO un administrador decide sobre un borrador.
import { json } from '../respuesta.js';
import { planear } from '../../../../tareas/cola.mjs';
import { lightTasks } from '../../../../tareas/ligera.mjs';
import { normalizarPasos } from '../../../../tareas/modelo.mjs';
import { DUENO } from '../../../../tareas/dueno.mjs';
import { guessNeedsOk } from '../../../../routines-core.mjs';
import { normModel, normEffort } from '../../../../src/models.js';
import * as approvals from '../../../../approvals.mjs';
import { intent as intencionDeEquipo } from '../../../../teams.mjs';
import { mutarDoc } from '../almacen.js';
import { draftFacts as draftFactsAp, decidirBorrador, deshacerAprobacion, editarBorrador } from '../agentes/aprobaciones.js';
import { registrarLeccion } from '../agentes/lecciones.js';
import { sha256 } from '../ids.js';

// `creadaPorAdmin` es una marca interna (quién creó la tarea): nunca sale en una respuesta, para que las formas sean las de la oficina local.
export const sinMarca = o => (Array.isArray(o) ? o.map(sinMarca) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'textoAdmin').map(([k, v]) => [k, sinMarca(v)])) : o);
const dePaso = (st, obj, extra = {}) => json(sinMarca(obj), st, extra);
// «Sin pedir mi OK» (needsOk:false) deja que el agente envíe, pague o cambie cosas sin que el dueño lo vea: solo un administrador lo decide.
const SOLO_ADMIN_OK = 'Solo un administrador puede dejar una tarea sin pedir su visto bueno (needsOk:false).';
const SOLO_ADMIN_DECIDE = 'Solo un administrador aprueba, devuelve o deshace un borrador: lo que sale de la oficina lo decide el dueño.';
const esAdmin = u => u?.rol === 'admin';

const draftFacts = draftFactsAp;

/** Quién escribe un comentario o pasa una tarea: el dueño es «Tú»; otra persona del equipo, su nombre de usuario. */
const quienEs = usuario => (usuario?.rol === 'admin' ? 'Tú' : String(usuario?.email || 'alguien').split('@')[0].slice(0, 80));

export async function manejarTasks({ req, url, ruta, usuario, db, s, serv, b }) {
  const { alm, cat } = s; const C = serv.contexto; const metodo = req.method;
  const ahora = () => Date.now();

  if (ruta === '/api/tasks' && metodo === 'GET') {
    const l = alm.load();
    const q = planear(l, { enVuelo: 0, max: Math.max(1, Math.min(8, +C.ajustes.concurrency || 3)), ahora: ahora() }).puestos; // V4.4 (B5): dónde está cada una en la cola
    for (const t of l) { if (q[t.id]) t.queue = q[t.id]; if (t.state === 'waiting' && !t.preview) draftFacts(t, C.aprobaciones); }
    const texto = JSON.stringify((url.searchParams.get('light') === '1' ? lightTasks(l) : l).map(({ textoAdmin: _a, ...t }) => t)); // INF-04: el sondeo de 6 s no trae el trabajo de lo archivado
    const tag = '"' + (await sha256(texto)).slice(0, 20) + '"';
    if (String(req.headers.get('if-none-match') || '').split(/\s*,\s*/).includes(tag)) return new Response(null, { status: 304, headers: { etag: tag, 'cache-control': 'no-cache' } });
    return new Response(texto, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', etag: tag, 'cache-control': 'no-cache' } });
  }

  if (ruta === '/api/tasks' && metodo === 'POST') {
    const { dept, text, model, effort, team, at } = b;
    if (b.needsOk === false && usuario?.rol !== 'admin') return dePaso(403, { error: SOLO_ADMIN_OK });
    if (!C.depts[dept] || dept === 'brain') return dePaso(400, { error: 'departamento desconocido' });
    if (!text || !String(text).trim()) return dePaso(400, { error: 'la tarea está vacía' });
    const dueAt = at ? (typeof at === 'number' ? at : Date.parse(at)) : null; // V3.2.1: una tarea para una fecha
    if (at && !(dueAt > 0)) return dePaso(400, { error: 'at must be a time (ms or ISO)' });
    if (dueAt && dueAt < ahora() - 60000) return dePaso(400, { error: 'esa hora ya pasó — elige una que aún esté por venir' });
    const extra = serv.camposT1(b); if (extra.error) return dePaso(400, extra);
    const task = await nuevaTarea(serv, { dept, text, model, effort, team, at: dueAt, agent: b.agent, title: b.title, needsOk: b.needsOk, extra: b.idea ? { ...extra, state: 'idea' } : extra, por: 'dueno' });
    if (esAdmin(usuario)) { const h = await sha256(String(task.text || '')); alm.cambiar(task.id, t => { t.textoAdmin = h; }, { por: 'dueno' }); } // la huella del texto que escribió el administrador: si alguien lo cambia, deja de ampliar destinatarios // solo el texto de una tarea de un administrador amplía a quién puede enviar el agente tras el OK
    const { textoAdmin: _a, ...salida } = task; // la marca es interna: la respuesta tiene la misma forma que la local
    return dePaso(200, salida);
  }

  if (ruta === '/api/tasks/approve-batch' && metodo === 'POST') { // G6
    if (!esAdmin(usuario)) return dePaso(403, { error: SOLO_ADMIN_DECIDE });
    const out = [];
    for (const id of (Array.isArray(b.ids) ? b.ids.slice(0, 50) : [])) out.push({ id: String(id), ...(await decidirBorrador({ s, db, id: String(id), verbo: 'approve', por: quienEs(usuario), apr: C.aprobaciones })) });
    return dePaso(200, { ok: true, results: out, approved: out.filter(x => x.ok).length });
  }

  let m = ruta.match(/^\/api\/tasks\/([^/]+)\/(example|comment|person)$/);
  if (m && metodo === 'POST') {
    const id = m[1], t0 = alm.load().find(x => x.id === id); if (!t0) return dePaso(404, { error: 'esa tarea ya no existe' });
    if (m[2] === 'example') { // H5: un trabajo que gustó, de ejemplo para su agente
      if (usuario?.rol !== 'admin') return dePaso(403, { error: 'Solo un administrador guarda un trabajo como ejemplo.' });
      if (t0.error || !t0.result || !t0.agent) return dePaso(400, { error: 'solo un trabajo terminado sirve de ejemplo' });
      const texto = String(t0.draft && t0.approved ? t0.draft : t0.result).slice(0, 12000);
      await mutarDoc(db, 'ejemplos.' + t0.agent, { items: [] }, d => ({ items: [...(d.items || []).filter(x => x.tarea !== id), { tarea: id, title: String(t0.title).replace(/\n/g, ' ').slice(0, 120), text: texto, at: ahora() }].slice(-8) }));
      alm.cambiar(id, t => { t.example = true; }, { por: 'dueno' });
      return dePaso(200, { ok: true, text: `Guardado como ejemplo de ${C.nombreAgente(t0.agent)}: lo tendrá en cuenta en sus próximos trabajos.` });
    }
    if (m[2] === 'comment') { // I4
      const text = String(b.text || '').trim().slice(0, 2000); if (!text) return dePaso(400, { error: 'el comentario está vacío' });
      const by = quienEs(usuario); let comentarios;
      alm.cambiar(id, t => { (t.comments ||= []).push({ at: ahora(), by, text }); comentarios = t.comments; }, { por: by === 'Tú' ? 'dueno' : 'persona:' + by });
      for (const p of C.personas) if (new RegExp('@' + p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text)) {
        s.avisar('persona', `💬 ${by} te menciona en «${t0.title}»: ${text.slice(0, 300)}`, { persona: p.name, task: id });
        s.avisar('mention', `${by} mencionó a ${p.name} en «${t0.title}».`, { task: id });
      }
      return dePaso(200, { ok: true, comments: comentarios });
    }
    // I3, I6: una persona la toma (o se la devuelve a los agentes)
    const nombre = String(b.person || '').trim();
    if (nombre && !C.persona(nombre) && nombre !== DUENO) return dePaso(400, { error: 'esa persona no está en Ajustes → Equipo' });
    if (t0.state === 'doing' || t0.state === 'waiting') return dePaso(409, { error: 'está en marcha o esperando tu visto bueno: espera a que termine' });
    let person = null;
    alm.cambiar(id, t => {
      if (nombre === DUENO && t.agent) { t.deAgente = t.agent; t.tomada = { at: ahora(), estado: t.state }; delete t.agent; } // plan D: «a ti» es «Lo hago yo»
      if (nombre) { t.person = nombre; if (t.state === 'done') { t.state = 'next'; t.addedAt = ahora(); } t.handoff = t.handoff || { at: ahora(), from: 'la página', why: String(b.why || '').slice(0, 300) }; }
      else delete t.person;
      person = t.person || null;
    }, { por: 'dueno' });
    if (nombre) s.avisar('persona', `👤 Te asignaron «${t0.title}»${b.why ? ': ' + b.why : ''}.`, { persona: nombre, task: id });
    return dePaso(200, { ok: true, person });
  }

  m = ruta.match(/^\/api\/tasks\/([^/]+)\/(undo|draft|vote)$/);
  if (m && metodo === 'POST') {
    if (m[2] === 'undo' || m[2] === 'draft') {
      if (!esAdmin(usuario)) return dePaso(403, { error: SOLO_ADMIN_DECIDE });
      const r = m[2] === 'undo' ? await deshacerAprobacion({ s, db, id: m[1], por: quienEs(usuario) }) : await editarBorrador({ s, db, id: m[1], draft: b.draft, por: quienEs(usuario), apr: C.aprobaciones });
      if (m[2] === 'draft' && r.task) return dePaso(200, { ok: true, task: r.task });
      return dePaso(r.status || 200, r);
    }
    const t = alm.load().find(x => x.id === m[1]); if (!t) return dePaso(404, { error: 'esa tarea ya no existe' });
    const v = b.vote === 'up' || b.vote === 'down' ? b.vote : null; // D2
    if (v === 'down' && String(b.reason || '').trim() && !esAdmin(usuario)) return dePaso(403, { error: 'Solo un administrador explica un 👎: el motivo se vuelve una lección permanente del agente.' }); // D2: 👍 / 👎 con su motivo (el motivo de un 👎 se vuelve una lección: solo un administrador)
    alm.cambiar(m[1], x => { x.vote = v; x.voteReason = v === 'down' ? String(b.reason || '').slice(0, 300) : ''; }, { por: 'dueno' });
    if (v === 'down' && t.agent && String(b.reason || '').trim()) { const a = C.agents.find(x => x.id === t.agent); if (a) await registrarLeccion(db, a, t, String(b.reason).slice(0, 300), null); } // el motivo de un 👎 entra en sus lecciones
    return dePaso(200, { ok: true, vote: v });
  }

  m = ruta.match(/^\/api\/tasks\/([^/]+)\/seen$/);
  if (m && metodo === 'POST') { alm.cambiar(m[1], t => { if (t.seenAt) return false; t.seenAt = ahora(); }, { por: 'dueno' }); return dePaso(200, { ok: true }); }

  m = ruta.match(/^\/api\/tasks\/([^/]+)(?:\/(run|revise|approve|reject|stop|archive|repeat))?$/);
  if (!m) return null;
  const id = m[1], accion = m[2] || '';

  if (accion === 'stop' && metodo === 'POST') { // el dueño detiene a un agente: su corrida se borra (el paso en vuelo pierde el candado y no escribe nada) y la tarea se cierra
    if (usuario?.rol === 'lectura') return dePaso(403, { error: 'Tu usuario solo puede mirar.' });
    const t = alm.load().find(x => x.id === id); if (!t) return dePaso(404, { error: 'esa tarea ya no existe' });
    if (t.state !== 'doing') return dePaso(409, { error: 'no está en curso' });
    await db.prepare('delete from corridas where tarea = ?').bind(id).run();
    alm.cambiar(id, x => { Object.assign(x, { state: 'done', doneAt: ahora(), result: 'Detenida por ti antes de terminar.', error: true, stopped: true }); delete x.tomadaPor; delete x.corrida; delete x.approving; }, { por: 'dueno' });
    return dePaso(200, { ok: true, killed: 1 });
  }
  if ((accion === 'approve' || accion === 'reject') && metodo === 'POST') { // D1: el visto bueno del dueño sobre el borrador
    if (!esAdmin(usuario)) return dePaso(403, { error: SOLO_ADMIN_DECIDE });
    const r = await decidirBorrador({ s, db, id, verbo: accion, nota: String(b.feedback || '').trim(), por: quienEs(usuario), apr: C.aprobaciones, huella: typeof b.huella === 'string' ? b.huella : null });
    return dePaso(r.status || 200, r);
  }

  if (accion === 'archive' && metodo === 'POST') { // fuera de las listas (se queda guardada)
    const t = alm.load().find(x => x.id === id); if (!t) return dePaso(404, { error: 'esa tarea ya no existe' });
    if (t.state === 'doing') return dePaso(409, { error: 'el agente está trabajando en ella — detenla primero' });
    let hecha;
    alm.cambiar(id, x => { x.archived = b.archived !== false; if (x.archived) x.archivedAt = ahora(); else delete x.archivedAt; hecha = x; }, { por: 'dueno' });
    return dePaso(200, { ok: true, task: hecha, trashed: null }); // la nota del Cerebro (note: true) la mueve la fase 4/Cerebro; aquí la tarea sola
  }

  if (accion === 'repeat' && metodo === 'POST') {
    const src = alm.load().find(x => x.id === id); if (!src) return dePaso(404, { error: 'esa tarea ya no existe' });
    return dePaso(200, serv.repetirTarea(src, 'dueno'));
  }

  if (!accion && metodo === 'PATCH') {
    if (b.needsOk === false && usuario?.rol !== 'admin') return dePaso(403, { error: SOLO_ADMIN_OK });
    return editarTarea({ s, serv, C, id, b, db, usuario });
  }

  if (accion === 'run' && metodo === 'POST') { // "ejecútala ya": pasa a la cola y el reloj de la nube la arranca
    const t = alm.load().find(x => x.id === id); if (!t) return dePaso(404, { error: 'esa tarea ya no existe' });
    if (t.state === 'doing') return dePaso(409, { error: 'ya está en curso' });
    if (t.state === 'scheduled') return dePaso(409, { error: 'está programada: corre sola a su hora' });
    if (!C.agents.some(a => a.id === t.agent) || t.person) return dePaso(409, { error: t.person === DUENO ? 'es tuya: delégala a un agente para que la haga' : 'la tiene una persona: devuélvela a los agentes primero' });
    if (t.state !== 'next') alm.cambiar(id, x => { x.state = 'next'; x.addedAt = ahora(); delete x.approving; }, { por: 'dueno' });
    return dePaso(200, { ok: true, id, state: 'next' });
  }
  if (accion === 'revise' && metodo === 'POST') { // «revise: …» — el agente rehace su trabajo con lo que pediste y aprende de la corrección
    if (!esAdmin(usuario)) return dePaso(403, { error: 'Solo un administrador pide una corrección: queda como lección permanente del agente.' });
    const t = alm.load().find(x => x.id === id); if (!t) return dePaso(404, { error: 'esa tarea ya no existe' });
    if (t.state === 'doing') return dePaso(409, { error: 'ya está en curso' });
    if (t.state === 'scheduled') return dePaso(409, { error: 'está programada: corre sola a su hora' });
    if (!C.agents.some(a => a.id === t.agent) || t.person) return dePaso(409, { error: t.person === DUENO ? 'es tuya: delégala a un agente para que la haga' : 'la tiene una persona: devuélvela a los agentes primero' });
    const nota = String(b.feedback || '').trim(); if (!nota) return dePaso(400, { error: 'di qué debe cambiar' });
    alm.cambiar(id, x => { delete x.approving; Object.assign(x, { state: 'doing', startedAt: ahora(), tomadaPor: 'agente:' + x.agent, corrida: { modo: x.needsOk ? 'draft' : 'task', feedback: nota, origen: 'revise' } }); }, { por: 'dueno' });
    return dePaso(200, { ok: true, id, state: 'doing' });
  }

  if (!accion && metodo === 'DELETE') {
    const t = alm.load().find(x => x.id === id); if (!t) return dePaso(404, { error: 'esa tarea ya no existe' });
    if (t.state === 'doing') return dePaso(409, { error: 'el agente está trabajando en ella — espera a que termine' });
    alm.save(alm.load().filter(x => x.id !== id), { por: 'dueno' });
    return dePaso(200, { ok: true, trashed: null });
  }
  return null;
}

/** serve.mjs → newTask: el departamento elige el agente (o el jefe la toma como equipo) y nace la tarea. */
export async function nuevaTarea(serv, { dept, text, team = false, at = null, by = 'you', model, effort, agent: agenteFijo = null, title: tituloFijo = null, needsOk: okFijo, extra = {}, por = null, id = null }) {
  const C = serv.contexto;
  const fijo = agenteFijo && C.agents.find(a => a.id === agenteFijo && a.department === dept); // una ejecución de rutina, movida: su escritorio, sin enrutar
  const r = fijo ? { agent: fijo.id, title: String(tituloFijo || text).slice(0, 90), plan: [], eta: 15, why: 'una ejecución de rutina, movida', needsOk: typeof okFijo === 'boolean' ? okFijo : guessNeedsOk(text) } : await serv.enrutar(dept, String(text).trim());
  const comoEquipo = C.equipos.enabled && (team === true || intencionDeEquipo(text));
  const lead = C.lider(dept);
  return serv.altaTarea({ dept, agent: comoEquipo ? lead.id : r.agent, title: extra.title || r.title, text, plan: r.plan, eta: r.eta, why: comoEquipo ? `team — ${lead.name} splits it across the desks` : r.why, by,
    model: normModel(model) || undefined, effort: normEffort(effort) || undefined, team: comoEquipo ? { lead: lead.id, asked: team === true ? (by === 'you' ? 'you' : by) : 'text' } : undefined,
    // En la nube la herramienta de envío NO se ofrece fuera de una ejecución aprobada (agentes/herramientas.js), así que un agente no puede «intentar» enviar y que el guardián lo
    // detenga, como en local: sin esto, «Responde a Ana…» terminaría como «hecha» con solo un texto y nada pediría el OK. Si el enrutador (o el propio dueño) dice que lleva OK, nace pidiéndolo.
    ...(at ? { dueAt: at, needsOk: typeof okFijo === 'boolean' ? okFijo : r.needsOk } : typeof okFijo === 'boolean' ? { needsOk: okFijo } : r.needsOk === true ? { needsOk: true } : {}), ...extra }, { por, id });
}

async function editarTarea({ s, serv, C, id, b, db, usuario }) {
  const { alm } = s; const ahora = () => Date.now();
  const cur = alm.load().find(t => t.id === id);
  if (!cur) return dePaso(404, { error: 'esa tarea ya no existe' });
  if (cur.state !== 'scheduled' && cur.state !== 'next' && cur.state !== 'idea') return dePaso(409, { error: 'solo se edita una tarea que aún no empezó' });
  if (cur.routine && cur.state === 'next') return dePaso(409, { error: 'es una ejecución de rutina: edita la rutina en el calendario' });
  const patch = {};
  if (b.state === 'done') { // «ya está hecha» — la cierra el dueño sin ejecutarla
    if (cur.state !== 'next' && cur.state !== 'scheduled') return dePaso(409, { error: 'ya empezó' });
    let hecha; alm.cambiar(id, t => { Object.assign(t, { state: 'done', doneAt: ahora(), result: 'Marcada como hecha por ti, sin ejecutarla.', manual: true }); hecha = t; }, { por: 'dueno' });
    return dePaso(200, hecha);
  }
  if (b.dept !== undefined && cur.person === DUENO && !cur.agent) { if (b.dept && (!C.depts[b.dept] || b.dept === 'brain')) return dePaso(400, { error: 'departamento desconocido' }); patch.dept = b.dept || undefined; }
  if (b.agent !== undefined) {
    const a = C.agents.find(x => x.id === b.agent); if (!a) return dePaso(400, { error: 'no existe ese agente' });
    if (cur.team && !a.lead) return dePaso(400, { error: 'una tarea en equipo va al líder del departamento' });
    patch.agent = a.id; patch.dept = a.department;
    if (a.id !== cur.agent && cur.by !== 'routine' && !cur.routine && !cur.piece) { // V4.4 (D10): el enrutador aprende de que el dueño la mueva
      await mutarDoc(db, 'enrutador.correcciones', { lista: [] }, d => ({ lista: [...d.lista, { t: ahora(), dept: a.department, fromDept: cur.dept, text: String(cur.text || cur.title).slice(0, 300), from: cur.agent, to: a.id }].slice(-300) }));
    }
  }
  if (b.at === null && cur.state === 'scheduled') { patch.state = 'next'; patch.dueAt = undefined; patch.addedAt = ahora(); } // desprogramada: va a la cola ya
  if (b.at !== undefined && b.at !== null) {
    const at = typeof b.at === 'number' ? b.at : /T\d/.test(String(b.at)) ? Date.parse(b.at) : NaN; // una fecha sin hora se leería como medianoche UTC: se rechaza
    if (!(at > ahora() - 60000)) return dePaso(400, { error: 'esa hora ya pasó — elige una que aún esté por venir' });
    if (at > ahora() + 2 * 365 * 864e5) return dePaso(400, { error: 'como mucho dos años adelante' });
    patch.dueAt = at; if (cur.state === 'next' || cur.state === 'idea') { patch.state = 'scheduled'; if (cur.needsOk === undefined) patch.needsOk = guessNeedsOk(cur.text || cur.title); }
  }
  if (typeof b.text === 'string') {
    const t = b.text.trim(); if (!t || t.length > 4000) return dePaso(400, { error: 'el texto debe tener entre 1 y 4000 caracteres' });
    if (t !== cur.text) { patch.text = t; if (b.reroute !== false && b.agent === undefined && cur.agent && !cur.person) { const r = await serv.enrutar(patch.dept || cur.dept, t); Object.assign(patch, { title: r.title, plan: r.plan, needsOk: r.needsOk, why: r.why, ...(cur.team ? {} : { agent: r.agent }) }); } }
  }
  if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 90);
  if (b.model !== undefined) patch.model = normModel(b.model) || undefined;
  if (b.effort !== undefined) patch.effort = normEffort(b.effort) || undefined;
  if (typeof b.needsOk === 'boolean') patch.needsOk = b.needsOk;
  { const t1 = serv.camposT1(b, { tareaId: id }); if (t1.error) return dePaso(400, t1); if (t1.pasos) t1.pasos = normalizarPasos(t1.pasos, cur.pasos); Object.assign(patch, t1); for (const k of ['prioridad', 'etiquetas', 'limite', 'proyecto', 'estimacion', 'bloqueadaPor', 'pasos', 'repetir']) if (b[k] === null || (Array.isArray(b[k]) && !b[k].length)) patch[k] = undefined; }
  const hashAdmin = patch.text !== undefined && usuario?.rol === 'admin' ? await sha256(patch.text) : null;
  const r = alm.cambiar(id, task => {
    if (task.state !== cur.state) return { error: 'la tarea ya empezó mientras la editabas', status: 409 };
    Object.assign(task, patch); for (const k of Object.keys(patch)) if (patch[k] === undefined) delete task[k];
    if (patch.text !== undefined) { if (hashAdmin) task.textoAdmin = hashAdmin; else delete task.textoAdmin; } // un texto que no escribió un administrador no amplía a quién se envía
  }, { por: 'dueno' });
  if (r.error) return dePaso(r.status || 400, { error: r.error });
  return dePaso(200, r.tarea);
}

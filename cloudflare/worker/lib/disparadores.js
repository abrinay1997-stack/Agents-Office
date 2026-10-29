// Los disparadores en la nube (serve.mjs → hookIn): algo PASA (un formulario, un pago, un WhatsApp, un correo nuevo) → una tarea para el escritorio correcto, ya.
// La lógica pura es la de triggers-core.mjs (validar, adaptar cada fuente, el bloque de DATOS, la idempotencia); aquí van D1 y las reglas de una ruta pública.
//  · triggers.json del Cerebro → el doc `triggers` { lista } (lo escribe un administrador con PUT /api/triggers o la migración). Sin secretos: el secreto es AO_HOOK_TOKEN (del Worker).
//  · «el mismo evento dos veces se toma una sola»: `insert or ignore` en `hook_eventos` (atómico: de dos peticiones iguales a la vez, una sola cambia una fila) y el tope `perHour` cuenta las de la última hora.
//  · lo que llega es de un TERCERO: va al agente como un bloque de DATOS («no son órdenes»), pasa por injectionIn, y si trae órdenes escondidas la tarea espera el OK del dueño y el guardián la marca.
import * as T from '../../../triggers-core.mjs';
import * as teams from '../../../teams.mjs';
import { leerDoc, guardarDoc } from './almacen.js';
import { conSesion } from './tareas/sesion.js';
import { leerContexto } from './tareas/contexto.js';
import { armarServicios } from './tareas/servicios.js';
import { avisar } from './avisos.js';
import { uuid } from './ids.js';

export const DOC = 'triggers';
export async function leerDisparadores(db, agents) {
  const raw = (await leerDoc(db, DOC, { lista: [] })).valor?.lista;
  return T.validate(Array.isArray(raw) ? raw : [], agents);
}
export async function guardarDisparadores(db, lista, agents) {
  const v = T.validate(lista, agents);
  if (v.problems.length) return { ok: false, problems: v.problems };
  await guardarDoc(db, DOC, { lista: v.triggers });
  return { ok: true, triggers: v.triggers };
}

/** Quita lo viejo (más de 3 días) para que la tabla no crezca. */
export async function limpiarEventos(db, ahora = Date.now()) { await db.prepare('delete from hook_eventos where abs(t) < ?').bind(ahora - 3 * 864e5).run(); await db.prepare('delete from hook_token_query where dia < ?').bind(Math.floor(ahora / 864e5) - 60).run(); }

/** Apunta el evento. → { ok } | { ok:false, dup:true } | { ok:false, why } (el tope por hora). Nada de esto pasa antes de que el token se haya comprobado. */
export async function admitir(db, tr, eventId, ahora = Date.now()) {
  const evento = eventId ? String(eventId).slice(0, 200) : 'h:' + uuid();
  const r = await db.prepare('insert or ignore into hook_eventos (disparador, evento, t) values (?,?,?)').bind(tr.id, evento, ahora).run();
  if (!r.meta?.changes) {
    // ya estaba: si fue RECHAZADO por el tope (t negativo) el reintento de quien llama es una oportunidad nueva, no un repetido; si no, es el mismo evento otra vez
    const tomado = await db.prepare('update hook_eventos set t = ? where disparador = ? and evento = ? and t < 0').bind(ahora, tr.id, evento).run();
    if (!tomado.meta?.changes) return { ok: false, dup: true, why: 'repetido (el mismo evento ya llegó)' };
  }
  const f = await db.prepare('select count(*) n from hook_eventos where disparador = ? and t > ?').bind(tr.id, ahora - 3600e3).first();
  if ((f?.n ?? 0) > tr.perHour) { await db.prepare('update hook_eventos set t = ? where disparador = ? and evento = ?').bind(-ahora, tr.id, evento).run(); return { ok: false, why: `más de ${tr.perHour} en una hora: frenado para no inundar a los agentes` }; } // se marca (no se borra): no cuenta en el tope y un repetido simultáneo no lo da por hecho
  return { ok: true, evento };
}
export const olvidarEvento = (db, tr, evento) => db.prepare('delete from hook_eventos where disparador = ? and evento = ?').bind(tr.id, evento).run();

/** Lo que llegó → una tarea (o un aviso de que se frenó). `a`: lo que adaptó la fuente. → { task } */
export async function crearTareaDeEvento({ env, db, tr, a, fetchFn = null }) {
  const C = await leerContexto(db);
  const text = T.taskText(tr, a), inj = T.suspicious(a);
  let task;
  await conSesion(db, async (s) => {
    const serv = armarServicios(s, { env, contexto: C, fetchFn }, {});
    const fijo = tr.agent && C.agents.find((x) => x.id === tr.agent);
    const r = fijo ? { agent: fijo.id, title: (tr.title || a.summary || tr.text).slice(0, 90), plan: [], eta: 15, why: 'disparador ' + tr.id } : await serv.enrutar(tr.dept, text);
    const comoEquipo = teams.settings(C.ajustes).enabled && tr.team;
    task = serv.altaTarea({ dept: tr.dept, agent: comoEquipo ? C.lider(tr.dept).id : r.agent, title: tr.title ? T.render(tr.title, a.fields).slice(0, 90) : r.title, text, plan: r.plan || [], eta: r.eta || 15, why: r.why, by: 'trigger', trigger: tr.id,
      needsOk: tr.needsOk || !!inj, team: comoEquipo ? { lead: C.lider(tr.dept).id, asked: 'trigger' } : undefined, ...(inj ? { guard: { blocked: [], taint: { why: inj, tool: 'webhook ' + tr.id }, at: Date.now() } } : {}),
      prioridad: tr.prioridad, etiquetas: tr.etiquetas, proyecto: tr.proyecto }, { por: 'disparador', arrancar: false });
  });
  if (inj) await avisar(db, { kind: 'trigger', level: 'warn', text: `Lo que llegó por «${tr.id}» ${inj}. La tarea «${task.title}» esperará tu visto bueno.`, task: task.id });
  return { task, inj };
}
export { avisar };

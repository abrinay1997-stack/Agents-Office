// Las rutinas en la nube: lo que en la oficina local es <cerebro>/Agents Office/routines.json (la definición, que viaja con el equipo) y data/routines.json
// (el estado: cuándo toca la próxima y cuándo corrió la última). Aquí la definición son filas de la colección 'rutinas' y el estado un documento
// ('rutinas.estado'). Las reglas —validar, calcular la próxima ejecución, qué toca ahora, las atrasadas— son las de routines-core.mjs y src/when.js,
// las mismas que usa la oficina local.
import * as R from '../../../../routines-core.mjs';
import { parseWhen, describe, valid as validWhen, untilText } from '../../../../src/when.js';
import { normModel, normEffort } from '../../../../src/models.js';
import { leerDoc, guardarDoc, mutarDoc, listarFilas, guardarFila, borrarFila } from '../almacen.js';

export const COLECCION = 'rutinas';
export const DOC_ESTADO = 'rutinas.estado';

const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const clonar = x => JSON.parse(JSON.stringify(x));

/** Las rutinas validadas con el roster (las malas se dejan fuera y se cuentan en `problems`, como en routines.load). */
export async function cargarRutinas(db, agents) {
  const crudas = await listarFilas(db, COLECCION);
  const routines = [], problems = [];
  for (const r of crudas) { const v = R.validate(r, agents, routines); if (v.problems.length) problems.push(...v.problems); else routines.push(v.routine); }
  return { routines, problems, crudas };
}

/** → { list (con su estado, como la sirve /api/routines), st, version, changed } */
export async function rutinasConEstado(db, agents, now = Date.now()) {
  const { routines, problems, crudas } = await cargarRutinas(db, agents);
  const { valor, version } = await leerDoc(db, DOC_ESTADO, {});
  const st = clonar(valor || {});
  const { list, changed } = R.withState(routines, st, now);
  return { list, st, version, changed, problems, routines, crudas };
}

/** GET /api/routines. Si el estado cambió (una rutina nueva, una que se agotó), se guarda; si otro lo cambió a la vez, da igual: el siguiente lo recalcula. */
export async function salidaRutinas(db, agents, now = Date.now()) {
  const x = await rutinasConEstado(db, agents, now);
  if (x.changed) { try { await guardarDoc(db, DOC_ESTADO, x.st, { espera: x.version }); } catch (e) { if (!e.conflicto) throw e; } }
  return { routines: x.list, depts: R.ALLOWED, path: 'la nube (D1)', problems: x.problems };
}

const idUnico = (base, lista) => { let id = base || 'routine', n = 2; while (lista.some(r => r.id === id)) id = `${base}-${n++}`; return id; };

/** Una frase (o el selector de REPETIR) → una rutina. El enrutador (IA) pone agente y título, como en la local. → { ok, routine, why, guessed } o { error } */
export async function crearRutina(db, { agents, enrutar }, { dept, text, when, agent, needsOk, model, effort }) {
  let taskText = String(text || '').trim(), w = when, parsed = null;
  if (!w) {
    parsed = parseWhen(taskText);
    if (!parsed) return { error: 'No hay horario en esa frase. Di cuándo: "every weekday at 8am, …", "Mondays 9am, …", "every hour 9-5, …".', noSchedule: true };
    if (parsed.needsDay) return { error: '¿Qué día? Di "every Monday …" o "Mon and Thu …".', needsDay: true };
    if (parsed.needsTime) return { error: '¿A qué hora? Di "… at 8am" o "… at 17:30".', needsTime: true };
    w = parsed.when; taskText = parsed.text;
  }
  if (!validWhen(w)) return { error: 'Ese horario no está completo.' };
  if (!taskText) return { error: '¿Qué debe pasar? La frase tiene hora pero no tarea.' };
  const { routines } = await cargarRutinas(db, agents);
  const r = await enrutar(dept, taskText);
  const a = agent && agents.find(x => x.id === agent && x.department === dept) ? agent : r.agent;
  const v = R.validate({ id: idUnico(slug(r.title).slice(0, 40), routines), dept, agent: a, title: r.title, text: taskText, when: w, needsOk: typeof needsOk === 'boolean' ? needsOk : r.needsOk, plan: r.plan, model: normModel(model) || undefined, effort: normEffort(effort) || undefined }, agents, routines);
  if (v.problems.length) return { error: v.problems.join('; ') };
  const s = v.routine;
  await guardarFila(db, COLECCION, s.id, { id: s.id, dept: s.dept, agent: s.agent, title: s.title, text: s.text, when: s.when, needsOk: s.needsOk, paused: s.paused, ...(s.team ? { team: true } : {}), ...(s.model ? { model: s.model } : {}), ...(s.effort ? { effort: s.effort } : {}), ...(s.plan ? { plan: s.plan } : {}) }, Date.now());
  const out = (await rutinasConEstado(db, agents)).list.find(x => x.id === s.id);
  return { ok: true, routine: out, why: r.why, guessed: parsed?.guessed ? parsed.guessWord : null };
}

/** Cambia campos de UNA rutina tal como está guardada (los campos que la validación no conoce se conservan). patch = null la borra. false si no existe. */
export async function parcharRutina(db, id, patch) {
  const ahora = await db.prepare('select json from filas where coleccion = ? and id = ?').bind(COLECCION, id).first();
  if (!ahora) return false;
  if (patch === null) { await borrarFila(db, COLECCION, id); return true; }
  const fila = JSON.parse(ahora.json);
  for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === '') delete fila[k]; else fila[k] = v; }
  await db.prepare('update filas set json = ?, actualizado = ? where coleccion = ? and id = ?').bind(JSON.stringify(fila), new Date().toISOString(), COLECCION, id).run();
  return true;
}

export async function editarRutina(db, agents, id, patch) {
  const { routines } = await cargarRutinas(db, agents);
  if (!routines.some(x => x.id === id)) return null;
  await parcharRutina(db, id, patch);
  if (patch.paused === false) await mutarDoc(db, DOC_ESTADO, {}, st => { if (st[id]) st[id].nextAt = 0; return st; }); // reanudada: la próxima es desde ahora, no la que durmió
  return (await rutinasConEstado(db, agents)).list.find(x => x.id === id) || null;
}

export async function borrarRutina(db, agents, id) {
  const { routines } = await cargarRutinas(db, agents);
  if (!routines.some(x => x.id === id)) return false;
  await parcharRutina(db, id, null);
  return true;
}

/** Salta (o devuelve) UNA ejecución del horario, por su hora en ms. */
export async function saltarEjecucion(db, id, at, saltar) {
  await mutarDoc(db, DOC_ESTADO, {}, st => {
    const s = st[id] || (st[id] = {});
    s.skip = (s.skip || []).filter(x => x !== at); if (saltar) s.skip.push(at);
    return st;
  });
}

// ---- el reloj ----

/** Un número estable (de 52 bits) para el mismo texto: el id de la tarea de una ejecución de rutina es el mismo si el reloj repite el minuto. */
function huella(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export const idDeEjecucion = (rutina, due) => 'rt' + huella(`${rutina}:${due}`).toString(36);

/** Lo que toca ahora: adelanta el reloj de cada rutina (guardando su estado con versión: si otra petición lo cambió, no se dispara nada y el siguiente minuto lo reintenta)
 *  y devuelve las tareas por crear. Así una rutina se dispara como mucho una vez. → { disparos: [{ rutina, id, due, late, missed }], avisos: [{ kind, text }] } */
export async function adelantarReloj(db, agents, now = Date.now()) {
  const { routines } = await cargarRutinas(db, agents);
  if (!routines.length) return { disparos: [], avisos: [] };
  const { valor, version } = await leerDoc(db, DOC_ESTADO, {});
  const st = clonar(valor || {});
  const { list } = R.withState(routines, st, now);
  const hits = R.due(list, st, now);
  const disparos = [], avisos = [];
  for (const h of hits) {
    if (h.skipped) {
      if (h.missed) avisos.push({ kind: 'missed', text: `«${h.routine.title}» no corrió ${h.missed === 1 ? 'una vez' : h.missed + ' veces'} con la oficina parada; esta rutina no se recupera tarde.` });
      continue;
    }
    const id = idDeEjecucion(h.routine.id, h.due);
    R.advance(st, h.routine, now, id, h.late);
    disparos.push({ rutina: h.routine, id, due: h.due, late: h.late, missed: h.missed });
  }
  if (!hits.length && JSON.stringify(st) === JSON.stringify(valor || {})) return { disparos: [], avisos: [] };
  try { await guardarDoc(db, DOC_ESTADO, st, { espera: version }); } catch (e) { if (e.conflicto) return { disparos: [], avisos: [], conflicto: true }; throw e; }
  return { disparos, avisos };
}

/** Si las tareas de esas ejecuciones no se pudieron crear, el reloj vuelve a «tocaba esa hora» (y una ejecución menos). */
export async function devolverReloj(db, disparos) {
  await mutarDoc(db, DOC_ESTADO, {}, st => { for (const d of disparos) { const s = st[d.rutina.id]; if (s) { s.nextAt = d.due; s.runs = Math.max(0, (s.runs || 1) - 1); } } return st; });
}

/** La rutina se vuelve tarea (serve.mjs → fire). `altaTarea` es la de servicios.js. */
export function dispararRutina(altaTarea, avisar, r, { id, due = Date.now(), late = false, by = 'routine', missed = 0, equipos = { enabled: true }, zonaTexto = d => new Date(d).toLocaleString('es-PA', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) } = {}) {
  const task = altaTarea({ dept: r.dept, agent: r.agent, title: r.title, text: r.text, plan: r.plan || [], eta: 15, why: '', by, routine: r.id, when: r.desc || describe(r.when), needsOk: r.needsOk, autonomous: r.autonomous || undefined, due, late, missed: missed > 1 ? missed : undefined, timeout: r.timeout, minutesSaved: r.minutesSaved, routineModel: r.model || undefined, routineEffort: r.effort || undefined, team: r.team && equipos.enabled ? { lead: r.agent, asked: 'routine' } : undefined,
    prioridad: r.prioridad, etiquetas: r.etiquetas, proyecto: r.proyecto, estimacion: r.estimacion }, { por: by === 'routine' ? 'rutina' : 'dueno', arrancar: false, id });
  if (late) avisar('late', `«${r.title}» se hizo tarde${missed > 1 ? ` (se perdieron ${missed} ejecuciones con la oficina parada; se hace una)` : ''}: tocaba el ${zonaTexto(due)}`);
  return task;
}

export { untilText };

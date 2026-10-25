// Las ops de Dimitri en la nube: serve.mjs → runOp / undoOp / subOps / subOpUndo / subSend. UNA sola puerta para cambiar el calendario, las tareas, Contenido y la publicidad:
// la lista cerrada `sub.OPS` (sub-core.mjs), validada por `parseOps`, y aquí el ejecutor, que NO reescribe las reglas: cada op entra por la ruta del módulo que las posee
// (rutinas, tareas, Contenido, Anuncios) con un `Request` sintético y la sesión del DUEÑO que pulsó HACER — así valen sus candados (quién puede qué, la huella de lo aprobado,
// los topes del dinero, «en pausa siempre») exactamente igual que si lo hubiera hecho en la página.
//
// LO QUE NUNCA HACE (los tests lo muerden):
//  · aprobar, enviar, publicar, pagar ni borrar: no están en `sub.OPS` y un tipo que suene a eso no entra (tests/control-oficina.test.mjs lo vigila en la raíz);
//  · CONFIRMAR UN GASTO: las ops de `sub.OPS_GASTO` (activar, reanudar, subir presupuesto, relanzar) solo piden la cifra (la PRIMERA llamada de Anuncios, que no cambia nada);
//    el segundo clic es del dueño en Anuncios. Si Anuncios contestara que ya lo hizo sin pedir la cifra, la op falla con ese aviso.
import * as sub from '../../../../sub-core.mjs';
import { DUENO } from '../../../../tareas/dueno.mjs';
import { conSesion, cargarTareas } from '../tareas/sesion.js';
import * as RT from '../tareas/rutinas.js';
import { ALLOWED as DEPTS_RUTINAS } from '../../../../routines-core.mjs';
import { leerContexto } from '../tareas/contexto.js';
import { armarServicios } from '../tareas/servicios.js';
import { nuevaTarea } from '../tareas/tasks-api.js';
import { crearOffice } from '../agentes/herramientas.js';
import { localDia, anuncioDeVista } from './datos.js';
import * as chat from './chat.js';

export const OPS_UNDO_MS = 30000;

/** `office(ruta, cuerpo?, método?)` con la sesión del dueño. */
export function oficinaDelDueno({ env, db, usuario, modulos }) {
  return crearOffice({ env, db, usuario: { id: usuario.id, email: usuario.email, rol: 'admin' }, modulos });
}

/** El contexto con el que `parseOps` valida: la oficina como está AHORA. Lo que se mira por id y es asíncrono se trae antes (solo lo que las ops nombran). */
export async function contextoDeOps({ office, C, db, ops = [] }) {
  const ids = [...new Set(ops.filter((o) => o?.type === 'pieza_mover' && o.id).map((o) => String(o.id)))];
  const piezas = new Set();
  for (const id of ids) { try { if ((await office(`/api/contenido/piezas/${encodeURIComponent(id)}`)).pieza) piezas.add(id); } catch { /* no está */ } }
  let vista = null;
  if (ops.some((o) => sub.ANUNCIO_TIPO[o?.type])) { try { vista = await office('/api/anuncios?rango=7d'); } catch { vista = null; } }
  const [tasks, rutinas] = [await cargarTareas(db), (await RT.rutinasConEstado(db, C.agents)).list];
  return { depts: C.depts, agents: C.agents, routineDepts: DEPTS_RUTINAS, routines: rutinas, tasks, piezaHas: (id) => piezas.has(String(id)), anuncio: (id) => (vista ? anuncioDeVista(vista, id) : null) };
}

export function crearEjecutor({ env, db, usuario, modulos }) {
  const office = oficinaDelDueno({ env, db, usuario, modulos });
  const listaRutinas = async () => (await office('/api/routines')).routines || [];

  /** Hace UNA op ya validada. Lanza Error con un mensaje en español si no se pudo. Deja en `o` lo que hizo y `o.undo` (qué la deshace). */
  async function runOp(o, { por = 'dimitri' } = {}) {
    if (!sub.OPS.includes(o.type)) throw new Error('no sé hacer eso');
    if (o.type === 'rutina_crear') {
      const r = await office('/api/routines', { dept: o.dept, text: o.text, when: o.when, agent: o.agent || undefined, needsOk: o.needsOk });
      let rt = r.routine;
      if (o.titled && o.title && rt && o.title !== rt.title) { const e = await office(`/api/routines/${rt.id}`, { title: String(o.title).slice(0, 90) }, 'PATCH'); rt = (e.routines || []).find((x) => x.id === rt.id) || e.routine || rt; }
      Object.assign(o, { routineId: rt.id, desc: rt.desc, agent: rt.agent, title: rt.title, undo: { routine: rt.id } }); return;
    }
    if (o.type === 'rutina_saltar') { await office(`/api/routines/${encodeURIComponent(o.id)}/skip`, { at: o.at }); o.undo = { unskip: o.at }; return; }
    if (o.type === 'rutina_pausar' || o.type === 'rutina_reanudar') {
      const r = (await listaRutinas()).find((x) => x.id === o.id); if (!r) throw new Error('esa rutina ya no está');
      await office(`/api/routines/${encodeURIComponent(r.id)}/${o.type === 'rutina_pausar' ? 'pause' : 'resume'}`, {});
      o.desc = r.desc; o.undo = { paused: !!r.paused }; return;
    }
    if (o.type === 'rutina_editar') {
      const r = (await listaRutinas()).find((x) => x.id === o.id); if (!r) throw new Error('esa rutina ya no está');
      if (o.when?.start && o.when.start < localDia(Date.now())) throw new Error('la fecha de inicio ya pasó');
      const patch = { ...(o.when ? { when: o.when } : {}), ...(o.text ? { text: o.text } : {}), ...(typeof o.needsOk === 'boolean' ? { needsOk: o.needsOk } : {}) };
      o.undo = { when: r.when, text: r.text, needsOk: r.needsOk };
      const e = await office(`/api/routines/${encodeURIComponent(r.id)}`, patch, 'PATCH');
      o.desc = (e.routines || []).find((x) => x.id === r.id)?.desc || e.routine?.desc || ''; return;
    }
    if (o.type === 'rutina_ahora') { await listaRutinas().then((l) => { if (!l.find((x) => x.id === o.id)) throw new Error('esa rutina ya no está'); }); const r = await office(`/api/routines/${encodeURIComponent(o.id)}/run`, {}); o.task = r.task?.id; o.undo = r.task ? { task: r.task.id } : null; return; }
    if (o.type === 'pieza_crear') {
      const r = await office('/api/contenido/piezas', { titulo: o.titulo, fecha: o.fecha, hora: o.hora, formato: o.formato, redes: o.redes, texto: o.texto, estado: 'borrador', origen: por });
      o.pieza = r.pieza.id; o.undo = { pieza: r.pieza.id }; return;
    }
    if (o.type === 'pieza_mover') {
      const prev = (await office(`/api/contenido/piezas/${encodeURIComponent(o.id)}`).catch(() => ({}))).pieza; if (!prev) throw new Error('esa pieza ya no está');
      const r = await office(`/api/contenido/piezas/${encodeURIComponent(o.id)}`, { fecha: o.fecha, ...(o.hora ? { hora: o.hora } : {}) }, 'PATCH');
      o.soltada = !!r.soltada; o.titulo = o.titulo || prev.titulo; o.undo = { fecha: prev.fecha, hora: prev.hora }; return;
    }
    if (o.type === 'contenido_llenar') { // el plan de «Llenar la semana» como está AHORA, cada hueco tomado como se propone
      const redes = (o.redes || []).length ? `&redes=${o.redes.join(',')}` : '';
      const plan = await office(`/api/contenido/llenar?desde=${localDia(Date.now())}&dias=${o.dias || 7}${redes}`);
      if (!(plan.huecos || []).length) throw new Error(`no hay días sin publicación en los próximos ${o.dias || 7} días`);
      const r = await office('/api/contenido/llenar', { huecos: plan.huecos, redes: plan.redes, pide: o.pide });
      Object.assign(o, { huecos: plan.huecos.length, creadas: (r.creadas || []).map((p) => p.id), tarea: r.tarea?.id || null, avisos: (r.errores || []).slice(0, 3), undo: { piezas: (r.creadas || []).map((p) => p.id), task: r.tarea?.id || null } });
      if (!(r.creadas || []).length && !r.tarea) throw new Error((r.errores || [])[0] || 'no se pudo llenar');
      return;
    }
    if (o.type === 'tarea_mover' || o.type === 'tarea_cancelar') { // solo tareas de agentes que no empezaron (parseOps ya lo comprobó; aquí otra vez, con la oficina de ahora)
      return conSesion(db, async (s) => {
        const l = s.alm.load(), t = l.find((x) => x.id === o.id);
        if (!t || t.person || (t.state !== 'scheduled' && t.state !== 'next')) throw new Error('esa tarea ya empezó o ya no está');
        if (o.type === 'tarea_mover') {
          o.undo = { state: t.state, dueAt: t.dueAt ?? null };
          s.alm.cambiar(t.id, (x) => { x.dueAt = o.at; if (x.state === 'next') x.state = 'scheduled'; }, { por: 'dimitri' });
        } else { o.undo = { task: t }; s.alm.save(l.filter((x) => x.id !== o.id), { por: 'dimitri' }); }
      });
    }
    if (o.type === 'tarea_editar') {
      await office(`/api/tareas/${encodeURIComponent(o.id)}/organizar`, { ...(o.prioridad ? { prioridad: o.prioridad } : {}), ...(o.limite !== undefined ? { limite: o.limite } : {}) });
      o.undo = { prioridad: o.antes?.prioridad || 'media', limite: o.antes?.limite ?? null }; return;
    }
    if (o.type === 'tarea_repetir') { const t = await office(`/api/tasks/${encodeURIComponent(o.id)}/repeat`, {}); o.task = t.id; o.undo = { task: t.id }; return; }
    if (o.type === 'mia_delegar') {
      const r = await office(`/api/tareas/${encodeURIComponent(o.id)}/delegar`, { a: 'agente', dept: o.dept, ...(o.agent ? { agente: o.agent } : {}), ...(o.nota ? { nota: o.nota } : {}) });
      o.agent = r.a; o.agentName = r.a; o.undo = { deAgente: r.tarea?.deAgente || null }; return;
    }
    if (o.type === 'mia_hecha') { await office(`/api/tareas/${encodeURIComponent(o.id)}/estado`, { a: 'done' }); o.undo = { reabrir: true, at: Date.now() }; return; }
    if (o.type === 'anuncio_borrador') { // un BORRADOR en la oficina; nada en Meta (crearlo allí, en pausa, es un clic del dueño en Anuncios)
      const creativos = (o.media || []).length ? o.media.map((m) => ({ media: m, texto: o.texto || '' })) : o.texto ? [{ texto: o.texto }] : [];
      const r = await office('/api/anuncios/borradores', { nombre: o.nombre, objetivo: o.objetivo, ...(o.destino ? { destino: o.destino } : {}), ...(o.usd ? { presupuesto: { usd: o.usd } } : {}), creativos });
      const b = r.borrador || r;
      o.borrador = b.id; o.desc = `Borrador «${b.nombre}» en Anuncios (J), id ${b.id}: nada en Meta todavía.`; o.undo = { borrador: b.id }; return;
    }
    if (sub.ANUNCIO_TIPO[o.type]) { // Anuncios decide (topes, estado, Meta). Lo que gasta NO se hace aquí: vuelve la confirmación y el segundo clic es del dueño
      const tipo = sub.ANUNCIO_TIPO[o.type], gasta = sub.OPS_GASTO.includes(o.type);
      if (gasta && por !== 'dimitri') throw new Error('eso gasta dinero: lo hace el dueño, con dos clics, en Anuncios (J) o en Telegram');
      const c = await office('/api/anuncios/accion', { tipo, id: o.id, ...(o.valor !== undefined ? { valor: o.valor } : {}) });
      if (gasta && !c.confirmar) throw new Error('Anuncios lo hizo sin pedir la cifra: no debía. Revísalo en Anuncios (J).'); // la regla del dinero: sin los dos clics del dueño no se gasta
      if (c.confirmar) { o.confirmar = c.confirmar; o.moneda = c.confirmar.moneda || 'USD'; o.desc = c.confirmar.texto; o.anuncio = { tipo, id: o.id, ...(c.confirmar.valor !== undefined ? { valor: c.confirmar.valor } : {}) }; o.pendiente = true; o.undo = null; if (c.aviso) o.aviso = c.aviso; return; }
      o.hecho = c.hecho?.texto || ''; o.desc = o.hecho; if (c.aviso) o.aviso = c.aviso;
      o.undo = c.deshacer && por === 'dimitri' ? { token: c.deshacer.token } : null; return;
    }
    throw new Error('no sé hacer eso');
  }

  /** Lo deshace (el DESHACER de la tarjeta de Dimitri). → {} o { error } */
  async function undoOp(o) {
    const u = o.undo; if (!u) return { error: 'eso no se puede deshacer' };
    try {
      if (sub.ANUNCIO_TIPO[o.type]) { await office('/api/anuncios/deshacer', { token: u.token }); return {}; }
      if (o.type === 'anuncio_borrador') {
        const b = (await office(`/api/anuncios/borradores/${encodeURIComponent(u.borrador)}`).catch(() => ({}))).borrador;
        if (b && (b.estado === 'creado' || b.estado === 'creando')) return { error: 'ya se creó en Meta (en pausa): archívalo desde Anuncios → Campañas' };
        if (b) await office(`/api/anuncios/borradores/${encodeURIComponent(u.borrador)}`, undefined, 'DELETE');
        return {};
      }
      const fueraDeCola = async (id) => { // solo se quita lo que nadie empezó
        const lista = (await office('/api/tasks?light=1')) || [];
        const t = (Array.isArray(lista) ? lista : lista.tasks || []).find((x) => x.id === id);
        if (!t) return true; if (t.state !== 'next') return false;
        await office(`/api/tasks/${encodeURIComponent(id)}`, undefined, 'DELETE'); return true;
      };
      if (o.type === 'rutina_crear') await office(`/api/routines/${encodeURIComponent(u.routine)}`, undefined, 'DELETE');
      else if (o.type === 'rutina_saltar') await office(`/api/routines/${encodeURIComponent(o.id)}/unskip`, { at: u.unskip });
      else if (o.type === 'rutina_pausar' || o.type === 'rutina_reanudar') await office(`/api/routines/${encodeURIComponent(o.id)}/${u.paused ? 'pause' : 'resume'}`, {});
      else if (o.type === 'rutina_editar') await office(`/api/routines/${encodeURIComponent(o.id)}`, { when: u.when, text: u.text, needsOk: u.needsOk }, 'PATCH');
      else if (o.type === 'rutina_ahora' || o.type === 'tarea_repetir') { if (!(await fueraDeCola(u.task))) return { error: 'el agente ya empezó: detenla en la tarea si hace falta' }; }
      else if (o.type === 'pieza_crear') await office(`/api/contenido/piezas/${encodeURIComponent(u.pieza)}`, undefined, 'DELETE');
      else if (o.type === 'pieza_mover') await office(`/api/contenido/piezas/${encodeURIComponent(o.id)}`, { fecha: u.fecha || '', hora: u.hora || '' }, 'PATCH');
      else if (o.type === 'contenido_llenar') {
        for (const id of u.piezas || []) { const p = (await office(`/api/contenido/piezas/${encodeURIComponent(id)}`).catch(() => ({}))).pieza; if (p && p.estado !== 'aprobada') await office(`/api/contenido/piezas/${encodeURIComponent(id)}`, undefined, 'DELETE'); }
        if (u.task && !(await fueraDeCola(u.task))) return { error: 'quité las copias, pero Marketing ya empezó los borradores: detén su tarea si hace falta' };
      } else if (o.type === 'tarea_mover') {
        await conSesion(db, async (s) => {
          const t = s.alm.load().find((x) => x.id === o.id); if (!t || (t.state !== 'scheduled' && t.state !== 'next')) throw new Error('esa tarea ya empezó');
          s.alm.cambiar(o.id, (x) => { x.state = u.state; if (u.dueAt == null) delete x.dueAt; else x.dueAt = u.dueAt; }, { por: 'dimitri' });
        });
      } else if (o.type === 'tarea_cancelar') {
        await conSesion(db, async (s) => { const l = s.alm.load(); if (!l.some((x) => x.id === u.task.id)) { l.push(u.task); s.alm.save(l, { por: 'dimitri' }); } });
      } else if (o.type === 'tarea_editar') await office(`/api/tareas/${encodeURIComponent(o.id)}/organizar`, { prioridad: u.prioridad, limite: u.limite });
      else if (o.type === 'mia_delegar') await office(`/api/tareas/${encodeURIComponent(o.id)}/tomar`, { deshacer: true, ...(u.deAgente ? { deAgente: u.deAgente } : {}) });
      else if (o.type === 'mia_hecha') {
        await office(`/api/tareas/${encodeURIComponent(o.id)}/estado`, { a: 'next' });
        await conSesion(db, async (s) => { const l = s.alm.load(); const sig = l.filter((x) => x.repeatOf === o.id && (x.addedAt || 0) >= u.at - 1000 && x.state !== 'doing' && x.state !== 'done'); if (sig.length) s.alm.save(l.filter((x) => !sig.includes(x)), { por: 'dimitri' }); }); // la siguiente repetición que nació al marcarla
      } else return { error: 'eso no se puede deshacer' };
    } catch (e) { return { error: String(e?.message || e).slice(0, 300) }; }
    return {};
  }
  return { runOp, undoOp, office };
}

/* ---------- las tarjetas: HACER, DESHACER y ENVIAR A LOS JEFES (serve.mjs → subOpsRun, subOpUndo, subSend) ---------- */
const enCurso = new Set(); // mensajes cuyo HACER corre: un segundo clic (u otra pestaña) mientras tanto se rechaza, nunca corre dos veces
const claveDe = (msgId) => String(msgId);

export async function hacerOps({ env, db, usuario, modulos, C, msgId, items }) {
  if (enCurso.has(claveDe(msgId))) return { error: 'ya lo estoy haciendo: espera a que termine', busy: true };
  enCurso.add(claveDe(msgId));
  try { return await hacerOpsRun({ env, db, usuario, modulos, C, msgId, items }); } finally { enCurso.delete(claveDe(msgId)); }
}
async function hacerOpsRun({ env, db, usuario, modulos, C, msgId, items }) {
  const previo = await chat.mensaje(db, msgId);
  if (!previo || !previo.ops) return { error: 'esa propuesta ya no existe' };
  const byK = new Map((Array.isArray(items) ? items : []).filter((e) => e && Number.isInteger(e.k)).map((e) => [e.k, e]));
  // se RECLAMAN las ops (proposed → running) con compare-and-swap en la fila ANTES de hacerlas: dos peticiones a la vez (o dos instancias del Worker) no pueden hacer la misma. Una «running» de hace más de 2 min se cayó a medias: se puede reclamar otra vez.
  const mias = new Set();
  const m = await chat.reclamar(db, msgId, (x) => {
    if (!Array.isArray(x.ops)) return false;
    let cambio = false;
    for (const o of x.ops) {
      if (!byK.has(o.k)) continue;
      if (o.state === 'proposed') { o.state = 'running'; o.runningAt = Date.now(); mias.add(o.k); cambio = true; }
      else if (o.state === 'running' && Date.now() - (o.runningAt || 0) > 120e3) { o.state = 'failed'; o.error = 'se interrumpió a medias: mira el calendario antes de repetirlo (puede que ya se haya hecho)'; delete o.runningAt; cambio = true; } // nunca se rehace sola: duplicaría el efecto
    }
    return cambio;
  });
  if (!m) return { error: 'ya lo está haciendo otra petición, o ya está hecho: espera un momento y recarga', busy: true };
  if (!mias.size) return { ok: true, message: m, messages: [] }; // solo se marcaron como interrumpidas las que se habían caído
  const ej = crearEjecutor({ env, db, usuario, modulos });
  let done = 0, failed = 0, segundo = 0;
  try {
  for (const o of m.ops) {
    if (!mias.has(o.k) || o.state !== 'running') continue;
    const e = byK.get(o.k);
    if (e.include === false) { o.state = 'skipped'; continue; }
    const pick = (k) => (e[k] !== undefined ? { [k]: e[k] } : {}); // lo que el dueño editó en la tarjeta, comprobado otra vez como la primera
    const base = { ...o }; if (o.type === 'rutina_crear' && !o.titled) delete base.title; // un título que Dimitri no dio es del enrutador
    const pedido = [{ ...base, ...pick('when'), ...pick('needsOk'), ...pick('text'), ...pick('at'), ...pick('fecha'), ...pick('hora'), ...pick('titulo'), ...pick('texto'), ...pick('formato'), ...pick('redes'), ...pick('agent'), ...pick('prioridad'), ...pick('limite'), ...pick('dept'), ...pick('nota'), ...pick('dias'), ...pick('pide'), ...pick('valor') }];
    const ctxP = await contextoDeOps({ office: ej.office, C, db, ops: pedido });
    const [v] = sub.parseOps(pedido, { ...ctxP, owner: true }).ops; // owner: «pide tu OK» de la tarjeta es del dueño
    if (!v) { o.state = 'failed'; o.error = 'ya no se puede: algo cambió en la oficina, la hora ya pasó o el horario no está completo'; failed++; continue; }
    Object.assign(o, v, { k: o.k, state: 'running', runningAt: o.runningAt });
    try {
      await ej.runOp(o, { por: 'dimitri' });
      if (o.pendiente) { delete o.pendiente; o.state = 'confirmar'; delete o.error; segundo++; } // gasta dinero: la tarjeta enseña la cifra y espera el SEGUNDO clic del dueño
      else { o.state = 'done'; o.doneAt = Date.now(); delete o.error; done++; }
    } catch (err) { o.state = 'failed'; o.error = String(err.message || err).slice(0, 300); failed++; }
    await chat.reemplazar(db, m); // cada cambio queda apuntado al terminar: si el Worker muere ahora, lo ya hecho no se rehace
  }
  } finally {
    for (const o of m.ops) if (mias.has(o.k)) { if (o.state === 'running') { o.state = 'failed'; o.error = 'se interrumpió a medias: mira el calendario antes de repetirlo'; } delete o.runningAt; }
    await chat.reemplazar(db, m);
  }
  const cuenta = sub.message('sub', `${done ? `Hecho: ${done} ${done === 1 ? 'cambio' : 'cambios'} en el calendario y la oficina. Puedes deshacerlo en la tarjeta durante ${OPS_UNDO_MS / 1000} s.` : segundo ? '' : 'No cambié nada.'}${segundo ? ` ${segundo === 1 ? 'Un cambio gasta' : segundo + ' cambios gastan'} dinero en anuncios: su tarjeta dice cuánto y espera tu segundo clic (tienes 2 minutos).` : ''}${failed ? ` ${failed} no se pudo: lo dice su tarjeta.` : ''}`.trim());
  if (done || failed || segundo) await chat.anexar(db, cuenta);
  const confirmar = m.ops.filter((o) => o.state === 'confirmar' && o.confirmar).map((o) => ({ k: o.k, ...o.anuncio, ...o.confirmar, sub: { msg: m.id, k: o.k } })); // lo que la página pide para el segundo clic (/api/anuncios/accion con `confirmacion` y `sub`)
  return { ok: true, message: m, messages: (done || failed || segundo) ? [cuenta] : [], ...(confirmar.length ? { confirmar } : {}) };
}

export async function deshacerOp({ env, db, usuario, modulos, msgId, k }) {
  const m = await chat.mensaje(db, msgId), o = m?.ops?.find((x) => x.k === k);
  if (!o || o.state !== 'done' || !o.undo) return { error: 'eso ya no se puede deshacer' };
  if (Date.now() - (o.doneAt || 0) > OPS_UNDO_MS) return { error: 'pasó el tiempo para deshacerlo: cámbialo en el calendario' };
  const r = await crearEjecutor({ env, db, usuario, modulos }).undoOp(o);
  if (r.error) return r;
  o.state = 'undone'; delete o.undo;
  await chat.reemplazar(db, m);
  return { ok: true, message: m };
}

/** Lo que Anuncios hace cuando el dueño da el SEGUNDO clic desde la tarjeta de Dimitri: la tarjeta queda hecha (serve.mjs → marcarOpAnuncio). */
export async function marcarOpAnuncio(db, { sub: ref, confirmacion, hecho, aviso }) {
  let m = null, o = null;
  if (ref?.msg) { m = await chat.mensaje(db, String(ref.msg)); o = m?.ops?.find((x) => x.k === Number(ref.k)) || null; }
  if (!o && confirmacion) { const { messages } = await chat.cargar(db); for (const x of messages) { o = (x.ops || []).find((y) => y.confirmar?.token === String(confirmacion)) || null; if (o) { m = x; break; } } }
  if (!o || !sub.ANUNCIO_TIPO[o.type] || o.state !== 'confirmar') return false;
  o.state = 'done'; o.doneAt = Date.now(); o.hecho = hecho?.texto || ''; o.desc = o.hecho; if (aviso) o.aviso = aviso; delete o.confirmar; o.undo = null;
  await chat.reemplazar(db, m);
  return true;
}

/** ENVIAR A LOS JEFES: cada pieza incluida se vuelve una tarea (o una tarea del dueño). Nada sale de la oficina: las tareas esperan en su departamento y piden el OK como siempre. */
export async function enviarPlan({ env, db, C, msgId, edits, fetchIA }) {
  const m = await chat.mensaje(db, msgId);
  if (!m || !m.plan) return { error: 'ese plan ya no existe' };
  const byI = new Map((Array.isArray(edits) ? edits : []).map((e) => [e.i, e]));
  const todo = [];
  for (const t of m.plan.tasks) {
    if (t.state !== 'proposed') continue;
    const e = byI.get(t.i) || {};
    if (e.include === false) { t.state = 'skipped'; continue; }
    if (e.dept && ((C.depts[e.dept] && e.dept !== 'brain') || e.dept === 'dueno')) t.dept = e.dept; // «Tú» es una opción más
    if (typeof e.instruction === 'string' && e.instruction.trim()) t.instruction = e.instruction.trim().slice(0, 4000);
    if (typeof e.team === 'boolean') t.team = e.team;
    if (e.at === null) t.at = null; else if (typeof e.at === 'number') t.at = e.at;
    if (t.at && t.at <= Date.now() + 30000) { t.error = 'esa hora ya pasó: elige mañana a la misma hora, ahora u otra hora'; continue; } // nunca «ya» en silencio
    delete t.past; delete t.error;
    todo.push(t);
  }
  if (!todo.length) { await chat.reemplazar(db, m); return { ok: true, message: m, tasks: [] }; }
  const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ids = new Map(todo.map((t) => [t.i, nid()])); // cada pieza sabe su id antes de que nazca cualquiera: «espera a las fotos» existe antes de que la cola pueda arrancarla
  const enviadas = [];
  await conSesion(db, async (s) => {
    enviadas.length = 0;
    const serv = armarServicios(s, { env, contexto: C, fetchFn: fetchIA }, {});
    let proyecto = null;
    if (m.plan.proyecto && edits?.proyecto !== false) {
      const pp = m.plan.proyecto;
      proyecto = pp.id ? s.cat.proyecto(pp.id) : s.cat.proyectos().find((x) => x.nombre.toLowerCase() === String(pp.nombre).toLowerCase() && x.estado !== 'archivado') || s.cat.crearProyecto({ nombre: pp.nombre, objetivo: pp.objetivo, limite: pp.limite }).proyecto || null;
      if (proyecto) m.plan.proyecto = { ...pp, id: proyecto.id, nombre: proyecto.nombre };
    }
    for (const t of todo) {
      const espera = (t.espera || []).map((x) => ids.get(x)).filter(Boolean);
      try {
        let task;
        if (t.dept === 'dueno') {
          task = serv.altaTarea({ person: DUENO, title: t.title, text: t.instruction, why: t.why, by: 'sub', sub: { msg: m.id, i: t.i }, prioridad: t.prioridad, limite: t.limite || (t.at ? `${localDia(t.at)}T${new Date(t.at).toTimeString().slice(0, 5)}` : undefined), proyecto: proyecto?.id, bloqueadaPor: espera }, { id: ids.get(t.i), por: 'dimitri', arrancar: false });
        } else {
          task = await nuevaTarea(serv, { dept: t.dept, text: t.instruction, team: t.team, at: t.at, by: 'sub', id: ids.get(t.i), por: 'dimitri', extra: { title: t.title, sub: { msg: m.id, i: t.i }, prioridad: t.prioridad, limite: t.limite, proyecto: proyecto?.id, bloqueadaPor: espera } });
        }
        t.state = 'sent'; t.taskId = task.id; t.agent = task.agent; enviadas.push(task);
      } catch (err) { t.state = 'failed'; t.error = String(err.message || err).slice(0, 300); }
    }
  });
  const sent = enviadas;
  const esperan = sent.filter((t) => t.bloqueadaPor?.length).length;
  const nombres = [...new Set(sent.map((t) => (t.person === DUENO ? 'tu lista (Tareas → Mías)' : C.depts[t.dept]?.name || t.dept)))].join(', ');
  const proyectoTxt = m.plan.proyecto?.nombre && sent.some((t) => t.proyecto) ? `, en el proyecto «${m.plan.proyecto.nombre}»` : '';
  const aviso = sub.message('sub', `Listo: envié ${sent.length} ${sent.length === 1 ? 'tarea' : 'tareas'} a ${nombres}${proyectoTxt}.${esperan ? ` ${esperan} ${esperan === 1 ? 'espera' : 'esperan'} a que termine otra antes de empezar.` : ''} Te aviso aquí cómo van (y en Tareas, H).${todo.length > sent.length ? ` ${todo.length - sent.length} no se pudo enviar.` : ''}`);
  await chat.reemplazar(db, m);
  await chat.anexar(db, aviso);
  return { ok: true, message: m, tasks: sent, messages: [aviso] };
}


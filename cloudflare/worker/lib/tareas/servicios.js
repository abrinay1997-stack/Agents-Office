// Arma, para UNA petición, lo que serve.mjs tiene suelto: la fábrica de tareas (altaTarea), las rutas de tareas/ (rutas.mjs y rutas-dueno.mjs,
// que son las MISMAS de la oficina local, sin copiar una línea) y los oyentes del bus (desbloquear lo que esperaba, repetir lo que se repite).
// Lo que en la local es "arrancar un agente" (pump) aquí no existe: en la nube los agentes arrancan desde el reloj de cada minuto (modulos/tareas.js →
// tomarSiguiente), así que pump es no hacer nada.
import { crearTarea, leerCampos as leerCamposTarea } from '../../../../tareas/modelo.mjs';
import { crearRutasTareas, despachadorDependencias } from '../../../../tareas/rutas.mjs';
import { crearRutasDueno } from '../../../../tareas/rutas-dueno.mjs';
import { limpiar as limpiarBloqueos, ciclo as cicloBloqueos } from '../../../../tareas/dependencias.mjs';
import { siguiente as siguienteRepeticion } from '../../../../tareas/ritmo.mjs';
import { DUENO } from '../../../../tareas/dueno.mjs';
import * as approvals from '../../../../approvals.mjs';
import { guessNeedsOk } from '../../../../routines-core.mjs';
import { crearEnrutador } from './enrutar.js';

if (typeof globalThis.setImmediate !== 'function') globalThis.setImmediate = (fn, ...a) => setTimeout(fn, 0, ...a); // las rutas piden "arranca la cola" con setImmediate(pump)

const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** La respuesta que arma una ruta (json(res, estado, objeto)) se queda aquí; el módulo la convierte en Response. */
export const jsonCapturado = (res, estado, objeto, opciones = {}) => { res.estado = estado; res.objeto = objeto; res.opciones = opciones; return res; };

/** `entorno`: { env, contexto (leerContexto), fetchFn? }. `cuerpo`: el cuerpo ya leído de la petición. → { altaTarea, enrutar, tareas, dueno, camposT1, repetirTarea, … } */
export function armarServicios(sesion, entorno, cuerpo = {}) {
  const { env, contexto: C, fetchFn } = entorno;
  const { alm, cat } = sesion;
  const enrutar = entorno.enrutar || crearEnrutador({ env, agents: C.agents, depts: C.depts, nombre: C.nombre, fetchFn });
  const avisar = (k, t, o) => sesion.avisar(k, t, o);
  const nombre = id => C.nombreAgente(id);

  // plan T0: LA forma de que nazca una tarea. La regla de la oficina (un importe grande pide el OK) se aplica aquí, una vez.
  function altaTarea(campos, { por = null, arrancar = true, id = null } = {}) { // `arrancar` no hace nada en la nube: la cola la mira el reloj
    const task = crearTarea(campos, { id: id || nid });
    if (approvals.overLimit(task.text, C.aprobaciones.amountLimit).length) task.needsOk = true;
    const list = alm.load();
    if (list.some(t => t.id === task.id)) return list.find(t => t.id === task.id); // el mismo id otra vez (un reintento): ya nació
    list.push(task); alm.save(list, { por: por || undefined });
    return task;
  }

  function camposT1(b, { tareaId = null } = {}) {
    const r = leerCamposTarea(b, { existeProyecto: id => !!cat.proyecto(id), existeEtiqueta: id => cat.etiquetas().some(e => e.id === id) });
    if (r.error) return r; const c = r.campos;
    if (c.bloqueadaPor) { const l = alm.load(); c.bloqueadaPor = limpiarBloqueos(l, tareaId || '-', c.bloqueadaPor); if (tareaId && c.bloqueadaPor.length && cicloBloqueos(l, tareaId, c.bloqueadaPor)) return { error: 'eso haría un círculo: dos tareas esperándose' }; }
    for (const k of Object.keys(c)) if (c[k] === null) delete c[k];
    return c;
  }

  const body = async () => cuerpo || {};
  const comunes = { alm, cat, json: jsonCapturado, body, pump: () => {}, agentes: C.agents, depts: C.depts, leadOf: C.lider, avisar, altaTarea, nombre };
  const tareas = crearRutasTareas({ ...comunes, webhooks: null });
  const dueno = crearRutasDueno({ ...comunes, avisarPersona: (n, t) => avisar('persona', t, { persona: n }), personas: () => C.personas.map(p => p.name), enrutar, adivinarOk: guessNeedsOk, exigeOk: text => approvals.overLimit(text, C.aprobaciones.amountLimit).length > 0 });

  // los oyentes del bus (se reparten DESPUÉS de volcar a D1: sesion.terminar)
  despachadorDependencias({ bus: sesion.bus, alm, pump: () => {}, avisar, nombre });
  sesion.bus.on('tarea.estado', ({ tarea, a }) => { // plan T5: al terminar bien una tarea que se repite, nace la siguiente (una sola abierta)
    if (a !== 'done' || !tarea.repetir) return;
    const c = siguienteRepeticion(tarea); if (!c) return;
    if (alm.load().some(t => t.repeatOf === tarea.id && t.state !== 'done')) return;
    altaTarea(c, { por: 'oficina' });
  });

  function repetirTarea(src, por = 'dueno') { // la misma tarea otra vez, como una nueva
    if (src.person === DUENO && !src.agent) return altaTarea({ person: DUENO, dept: src.dept, deAgente: src.deAgente, title: src.title, text: src.text, by: 'you', repeatOf: src.id, prioridad: src.prioridad, etiquetas: src.etiquetas, proyecto: src.proyecto, estimacion: src.estimacion, pasos: (src.pasos || []).map(p => p.texto) }, { por, arrancar: false });
    const lead = C.lider(src.dept);
    return altaTarea({ dept: src.dept, agent: src.team ? lead.id : src.agent, title: src.title, text: src.text, plan: src.plan || [], eta: src.eta || 30, why: 'otra vez', by: 'you', model: src.model, effort: src.effort, needsOk: src.needsOk,
      team: src.team ? { lead: lead.id, asked: 'repeat' } : undefined, repeatOf: src.id, prioridad: src.prioridad, etiquetas: src.etiquetas, proyecto: src.proyecto, estimacion: src.estimacion }, { por, arrancar: false });
  }

  return { altaTarea, camposT1, enrutar, tareas, dueno, repetirTarea, avisar, nombre, contexto: C };
}

/** Corre una ruta de tareas/ (rutas.mjs o rutas-dueno.mjs) y devuelve la respuesta capturada, o null si no era suya. */
export async function correrRuta(manejador, { metodo, ruta, query = '', headers = {} }) {
  const res = {};
  const url = new URL('http://oficina' + ruta + (query ? '?' + query : ''));
  const req = { method: metodo, headers, url: url.pathname };
  const hecho = await manejador(req, res, url);
  return hecho && res.estado ? res : null;
}

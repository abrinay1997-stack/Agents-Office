// Agents Office (6 oct 2026, plan T0/T1 · docs/analisis-taskview-2026-10-06.md §5.B) — la TAREA: su forma, la única fábrica y la
// migración. Antes seis sitios de serve.mjs armaban el mismo objeto a mano (la barra, la API, una rutina, un disparador, «repetir»,
// el Estudio) y ya no hacían lo mismo. Ahora todos llaman a crearTarea(); lo que es regla de la oficina (el tope de importe que pide
// el OK, la marca de un disparador sospechoso) lo aplica serve.mjs en un solo sitio (altaTarea), no aquí: este archivo es puro.
// Campos nuevos (T1), todos opcionales y con valor por defecto que no pide nada:
//   prioridad 'alta' | 'media' | 'baja' (media) · etiquetas [id] · limite 'AAAA-MM-DD' o 'AAAA-MM-DDTHH:MM' (para cuándo; `dueAt`
//   sigue siendo cuándo ARRANCA) · estimacion minutos · pasos [{ id, texto, hecho, por, at }] · bloqueadaPor [id] · proyecto id ·
//   orden número (orden manual dentro de su estado, ver orden.mjs) · version (sube en cada cambio, almacen.mjs) · v 2 (el esquema).

import { leerRepetir } from './ritmo.mjs';

export const ESQUEMA = 2;
export const PRIORIDADES = ['alta', 'media', 'baja'];
export const PESO_PRIORIDAD = { alta: 0, media: 1, baja: 2 };
export const NOMBRE_PRIORIDAD = { alta: 'Alta', media: 'Media', baja: 'Baja' };
export const MAX = { pasos: 30, paso: 200, etiquetas: 8, bloqueadaPor: 10, titulo: 90, texto: 4000 };

const nidBase = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const idPaso = (i = 0) => 'p' + (Date.now() % 1e6).toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 4);

const FECHA = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
export function limiteValido(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim(); if (!FECHA.test(s)) return undefined;
  const d = new Date(s.length === 10 ? s + 'T12:00' : s); return Number.isNaN(d.getTime()) ? undefined : s;
}
// la fecha límite como momento (el final del día si no lleva hora)
export const limiteMs = v => { const s = limiteValido(v); if (!s) return null; return new Date(s.length === 10 ? s + 'T23:59' : s).getTime(); };

const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36).slice(0, 5); };
export function pasosDe(plan, por = 'enrutador', semilla = null) { // el plan del enrutador (["…", "…"]) → pasos que se marcan; con `semilla` (el id de la tarea) los ids son fijos: migrar dos veces da lo mismo
  return (Array.isArray(plan) ? plan : []).map(x => String(typeof x === 'string' ? x : x?.texto || '').trim()).filter(Boolean)
    .slice(0, MAX.pasos).map((texto, i) => ({ id: semilla ? 'p' + i + hash(semilla + texto) : idPaso(i), texto: texto.slice(0, MAX.paso), hecho: false, por }));
}

export function normalizarPasos(lista, previos = []) {
  if (!Array.isArray(lista)) return undefined;
  const viejo = new Map((previos || []).map(p => [p.id, p]));
  return lista.slice(0, MAX.pasos).map((p, i) => {
    const texto = String(typeof p === 'string' ? p : p?.texto || '').trim().slice(0, MAX.paso);
    if (!texto) return null;
    const antes = p?.id && viejo.get(p.id);
    const hecho = typeof p === 'object' && typeof p.hecho === 'boolean' ? p.hecho : !!antes?.hecho;
    return { id: (p && p.id) || antes?.id || idPaso(i), texto, hecho, por: p?.por || antes?.por || 'dueno', ...(hecho ? { at: p?.at || antes?.at || Date.now() } : {}) };
  }).filter(Boolean);
}

const lista = (v, max) => (Array.isArray(v) ? [...new Set(v.map(String).filter(Boolean))].slice(0, max) : []);

// LA fábrica. `campos` trae lo que sabe quien crea; lo demás sale con su valor por defecto. No toca el disco.
export function crearTarea(campos = {}, { id = nidBase, ahora = Date.now() } = {}) {
  const c = { ...campos };
  const t = {
    id: typeof id === 'function' ? id() : id,
    dept: c.dept, agent: c.agent,
    title: String(c.title || c.text || '').trim().slice(0, MAX.titulo),
    text: String(c.text || '').trim(),
    plan: Array.isArray(c.plan) ? c.plan : [],
    eta: Number.isFinite(c.eta) ? c.eta : 15,
    why: c.why || '',
    state: c.state && ['idea', 'next', 'scheduled'].includes(c.state) ? c.state : 'next',
    addedAt: ahora, by: c.by || 'you',
  };
  for (const k of ['model', 'effort', 'needsOk', 'team', 'routine', 'when', 'due', 'late', 'missed', 'timeout', 'minutesSaved', 'routineModel', 'routineEffort', 'autonomous',
    'trigger', 'guard', 'repeatOf', 'sub', 'refs', 'person', 'handoff', 'agenteOrigen', 'por']) if (c[k] !== undefined && c[k] !== null && c[k] !== '') t[k] = c[k];
  if (c.dueAt) { t.dueAt = c.dueAt; t.state = 'scheduled'; }
  // T1: lo nuevo
  t.prioridad = PRIORIDADES.includes(c.prioridad) ? c.prioridad : 'media';
  const et = lista(c.etiquetas, MAX.etiquetas); if (et.length) t.etiquetas = et;
  const lim = limiteValido(c.limite); if (lim) t.limite = lim;
  if (Number.isFinite(+c.estimacion) && +c.estimacion > 0) t.estimacion = Math.min(60 * 24 * 30, Math.round(+c.estimacion));
  const pasos = c.pasos ? normalizarPasos(c.pasos) : pasosDe(t.plan); if (pasos?.length) t.pasos = pasos;
  const bl = lista(c.bloqueadaPor, MAX.bloqueadaPor).filter(x => x !== t.id); if (bl.length) t.bloqueadaPor = bl;
  if (c.proyecto) t.proyecto = String(c.proyecto);
  if (Number.isFinite(c.orden)) t.orden = c.orden;
  { const r = leerRepetir(c.repetir); if (r.repetir) t.repetir = r.repetir; } // plan T5
  t.v = ESQUEMA; t.version = 1;
  return t;
}

// lo que viene de un tasks.json anterior (v1) → la forma de hoy. Idempotente: una tarea v2 vuelve igual (mismo objeto si nada cambió).
export function normalizar(t) {
  if (!t || typeof t !== 'object') return t;
  if (t.v === ESQUEMA && t.prioridad && Number.isFinite(t.version)) return t;
  const n = { ...t };
  if (!PRIORIDADES.includes(n.prioridad)) n.prioridad = 'media';
  if (!Number.isFinite(n.version)) n.version = 1;
  if (!n.pasos && Array.isArray(n.plan) && n.plan.length && n.state !== 'done') n.pasos = pasosDe(n.plan, 'enrutador', String(n.id)); // las hechas no ganan pasos sin marcar; ids fijos
  n.v = ESQUEMA;
  return n;
}

export const progresoPasos = t => { const p = t?.pasos || []; return p.length ? { hechos: p.filter(x => x.hecho).length, total: p.length } : null; };

// los campos de T1 que llegan en un pedido (la API, Dimitri, un agente) → { campos } o { error } en palabras. Solo lo que viene.
// `existeProyecto(id)` y `existeEtiqueta(id)` los da quien llama; los bloqueos se revisan aparte (dependencias.mjs: ciclos).
export function leerCampos(b = {}, { existeProyecto = () => true, existeEtiqueta = () => true } = {}) {
  const c = {};
  if (b.prioridad !== undefined) { if (!PRIORIDADES.includes(b.prioridad)) return { error: 'la prioridad es alta, media o baja' }; c.prioridad = b.prioridad; }
  if (b.etiquetas !== undefined) {
    if (!Array.isArray(b.etiquetas)) return { error: 'las etiquetas van en una lista' };
    const l = [...new Set(b.etiquetas.map(String))]; if (l.length > MAX.etiquetas) return { error: `como mucho ${MAX.etiquetas} etiquetas` };
    const mala = l.find(e => !existeEtiqueta(e)); if (mala) return { error: `no existe la etiqueta «${mala}»` }; c.etiquetas = l;
  }
  if (b.limite !== undefined) { const v = limiteValido(b.limite); if (v === undefined) return { error: 'la fecha límite va como AAAA-MM-DD (y la hora, si quieres, THH:MM)' }; c.limite = v; }
  if (b.estimacion !== undefined) { if (b.estimacion === null || b.estimacion === '') c.estimacion = null; else { const n = Math.round(+b.estimacion); if (!(n > 0 && n <= 60 * 24 * 30)) return { error: 'la estimación va en minutos (1 a 43.200)' }; c.estimacion = n; } }
  if (b.proyecto !== undefined) { if (b.proyecto === null || b.proyecto === '') c.proyecto = null; else if (!existeProyecto(String(b.proyecto))) return { error: 'ese proyecto no existe' }; else c.proyecto = String(b.proyecto); }
  if (b.pasos !== undefined) { if (!Array.isArray(b.pasos)) return { error: 'los pasos van en una lista' }; if (b.pasos.length > MAX.pasos) return { error: `como mucho ${MAX.pasos} pasos` }; c.pasos = b.pasos; }
  if (b.bloqueadaPor !== undefined) { if (!Array.isArray(b.bloqueadaPor)) return { error: 'los bloqueos van en una lista de tareas' }; if (b.bloqueadaPor.length > MAX.bloqueadaPor) return { error: `como mucho ${MAX.bloqueadaPor} bloqueos` }; c.bloqueadaPor = b.bloqueadaPor.map(String); }
  if (b.orden !== undefined) { if (!Number.isFinite(+b.orden)) return { error: 'el orden es un número' }; c.orden = +b.orden; }
  if (b.repetir !== undefined) { const r = leerRepetir(b.repetir); if (r.error) return { error: r.error }; c.repetir = r.repetir; } // plan T5
  return { campos: c };
}

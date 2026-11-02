// Agents Office (6 oct 2026, plan T0/T3 · §5.E) — la COLA: qué tarea arranca ahora y por qué esperan las demás. Puro, con test.
// La usan pump() (serve.mjs, la que arranca) y el «puesto en la cola» que ve la página (reliability.queueOf): una sola regla.
// Orden: prioridad (alta primero) → fecha límite más cercana → orden manual (arrastre) → la más antigua.
// No arranca: una bloqueada por otra sin terminar, la de una persona, la que espera su reintento, la de un agente ocupado, ni nada
// si el presupuesto del mes se acabó y el dueño pidió parar. Un equipo cuenta por cada pieza en marcha, y sus agentes están ocupados.
import { PESO_PRIORIDAD, limiteMs } from './modelo.mjs';
import { bloqueos } from './estados.mjs';

export function ordenCola(a, b) {
  const pa = PESO_PRIORIDAD[a.prioridad] ?? 1, pb = PESO_PRIORIDAD[b.prioridad] ?? 1; if (pa !== pb) return pa - pb;
  const la = limiteMs(a.limite) ?? Infinity, lb = limiteMs(b.limite) ?? Infinity; if (la !== lb) return la - lb;
  const oa = Number.isFinite(a.orden) ? a.orden : Infinity, ob = Number.isFinite(b.orden) ? b.orden : Infinity; if (oa !== ob) return oa - ob;
  return (a.addedAt || 0) - (b.addedAt || 0);
}

// los agentes ocupados y los procesos en marcha que dice la lista (las piezas de un equipo cuentan cada una)
export function ocupacion(tareas) {
  const agentes = new Set(); let procesos = 0;
  for (const t of tareas) {
    if (t.state !== 'doing') continue;
    agentes.add(t.agent);
    const piezas = (t.team?.pieces || []).filter(p => p.state === 'doing');
    for (const p of piezas) agentes.add(p.agent);
    procesos += Math.max(1, piezas.length);
  }
  return { agentes, procesos };
}

// → { arrancar: [id], puestos: { id: { pos, why, retryAt? } } }
export function planear(tareas, { enVuelo = 0, max = 3, ahora = Date.now(), sinPresupuesto = false } = {}) {
  const porId = new Map(tareas.map(t => [t.id, t]));
  const { agentes, procesos } = ocupacion(tareas);
  let libres = Math.max(0, max - Math.max(enVuelo, procesos));
  const arrancar = [], puestos = {};
  const enCola = tareas.filter(t => t.state === 'next' && !t.archived).sort(ordenCola);
  let pos = 0;
  for (const t of enCola) {
    pos++;
    if (t.person) { puestos[t.id] = { pos, why: 'persona' }; continue; }
    if (bloqueos(t, porId).length) { puestos[t.id] = { pos, why: 'bloqueada' }; continue; }
    if (t.retryAt && t.retryAt > ahora) { puestos[t.id] = { pos, why: 'reintento', retryAt: t.retryAt }; continue; }
    if (agentes.has(t.agent)) { puestos[t.id] = { pos, why: 'agente' }; continue; }
    if (sinPresupuesto) { puestos[t.id] = { pos, why: 'presupuesto' }; continue; }
    if (libres > 0) { libres--; agentes.add(t.agent); arrancar.push(t.id); puestos[t.id] = { pos, why: 'turno' }; continue; }
    puestos[t.id] = { pos, why: 'oficina' };
  }
  return { arrancar, puestos };
}

// ---------------------------------------------------------------- por qué espera cada una (punto 17 de la auditoría de Anuncios)
// «12 esperando; 0 en marcha» asustaba cuando casi todas eran del dueño, de personas o bloqueadas: la cola nunca las arranca, así que
// no «esperan a la oficina». Esta función solo MIRA (usa planear tal cual, sin cambiar qué arranca) y dice en palabras por qué espera cada una.
const RAZONES = ['persona', 'bloqueada', 'reintento', 'agente', 'oficina', 'presupuesto', 'llave', 'turno'];
const REAL = ['reintento', 'agente', 'oficina', 'presupuesto', 'llave', 'turno']; // lo que SÍ espera a la oficina (persona y bloqueada, no)
const FRASE = {
  persona: n => `${n} ${n === 1 ? 'es tuya o de una persona' : 'son tuyas o de personas'} (la oficina no las arranca sola)`,
  bloqueada: n => `${n} ${n === 1 ? 'espera' : 'esperan'} a que termine otra tarea de la que dependen`,
  reintento: n => `${n} con reintento programado`,
  agente: n => `${n} ${n === 1 ? 'espera' : 'esperan'} a que su agente termine lo que está haciendo`,
  oficina: (n, o) => `${n} ${n === 1 ? 'espera' : 'esperan'} sitio (la oficina hace ${o.max} a la vez)`,
  presupuesto: n => `${n} ${n === 1 ? 'parada' : 'paradas'} porque se acabó el presupuesto del mes`,
  llave: n => `${n} sin poder arrancar: falta la llave de IA`,
  turno: n => `${n} ${n === 1 ? 'arranca' : 'arrancan'} en el próximo minuto`,
};
/**
 * → { total, razones: { persona, bloqueada, reintento, agente, oficina, presupuesto, llave, turno }, esperando (las que sí esperan a la
 * oficina: todas menos persona y bloqueada), okPendiente (esperan tu OK), masViejaMs (de las que esperan a la oficina), texto }.
 * `texto` es null si no hay nada en la lista.
 */
export function explicarCola(tareas, { enVuelo = 0, max = 3, ahora = Date.now(), sinPresupuesto = false, sinLlave = false } = {}) {
  const { puestos } = planear(tareas, { enVuelo, max, ahora, sinPresupuesto });
  const razones = Object.fromEntries(RAZONES.map(r => [r, 0])); let masViejaMs = 0, total = 0;
  for (const t of tareas) {
    if (t.state !== 'next' || t.archived) continue;
    const p = puestos[t.id]; if (!p) continue;
    total++;
    const why = sinLlave && p.why === 'turno' ? 'llave' : p.why;
    razones[why]++;
    if (REAL.includes(why)) masViejaMs = Math.max(masViejaMs, ahora - (t.addedAt || ahora));
  }
  const esperando = REAL.reduce((n, r) => n + razones[r], 0);
  const okPendiente = tareas.filter(t => t.state === 'waiting' && !t.archived).length;
  const partes = RAZONES.filter(r => razones[r]).map(r => FRASE[r](razones[r], { max }));
  const texto = total || okPendiente ? [total ? `${total} en la lista${partes.length ? ': ' + partes.join('; ') : ''}` : '', okPendiente ? `${okPendiente} ${okPendiente === 1 ? 'espera' : 'esperan'} tu OK` : ''].filter(Boolean).join('. ') + '.' : null;
  return { total, razones, esperando, okPendiente, masViejaMs, texto };
}

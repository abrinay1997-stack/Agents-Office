// Agents Office (6 oct 2026, plan T0 · docs/analisis-taskview-2026-10-06.md §5.A) — los ESTADOS de una tarea, en un solo sitio.
// Lo guardado (`state`) sigue siendo lo de siempre, para no romper la página, Telegram ni las cuentas: idea · scheduled · next · doing ·
// waiting · done. Lo que se VE se deduce de eso y de las marcas (error, person, bloqueos, archived) con `visible(t)`: así «falló»,
// «bloqueada» o «en manos de una persona» son estados con nombre y no se leen como «hecha» o «pendiente».
// Y cada puerta (la página, la API, Telegram, Dimitri, una rutina, un agente) pregunta a `puede()` antes de mover una tarea.
// Puro, con test (tests/tareas-estados.test.mjs).

import { esMia } from './identidad.mjs';

export const GUARDADOS = ['idea', 'scheduled', 'next', 'doing', 'waiting', 'done'];

// visible → { etiqueta, tono } (el tono es una clase de color de la vista)
export const VISIBLES = {
  idea: { etiqueta: 'Idea', corta: 'IDEA', tono: 'gris', abierta: true },
  programada: { etiqueta: 'Programada', corta: 'PROGRAMADA', tono: 'azul', abierta: true },
  en_cola: { etiqueta: 'En cola', corta: 'EN COLA', tono: 'gris', abierta: true },
  bloqueada: { etiqueta: 'Bloqueada', corta: 'BLOQUEADA', tono: 'ambar', abierta: true },
  tuya: { etiqueta: 'Tuya', corta: 'TUYA', tono: 'violeta', abierta: true }, // plan D (7 oct 2026): la hace el dueño (tareas/dueno.mjs)
  en_manos: { etiqueta: 'En manos de una persona', corta: 'PERSONA', tono: 'violeta', abierta: true },
  en_curso: { etiqueta: 'En curso', corta: 'EN CURSO', tono: 'azul', abierta: true },
  espera_ok: { etiqueta: 'Espera tu OK', corta: 'ESPERA OK', tono: 'ambar', abierta: true },
  hecha: { etiqueta: 'Hecha', corta: 'HECHA', tono: 'verde', abierta: false },
  fallida: { etiqueta: 'Falló', corta: 'FALLÓ', tono: 'rojo', abierta: false },
};
export const ORDEN_VISIBLE = ['espera_ok', 'en_curso', 'bloqueada', 'tuya', 'en_manos', 'en_cola', 'programada', 'idea', 'hecha', 'fallida'];

// ¿la bloquea algo que no ha terminado? `deps` = id → tarea (o una función id → tarea). Una dependencia borrada no bloquea.
export function bloqueos(t, deps) {
  const ids = Array.isArray(t?.bloqueadaPor) ? t.bloqueadaPor : [];
  const get = typeof deps === 'function' ? deps : id => deps?.[id] || (deps instanceof Map ? deps.get(id) : undefined);
  return ids.map(id => get(id)).filter(d => d && !(d.state === 'done' && !d.error));
}

export function visible(t, deps, yo) { // `yo`: quién mira (tareas/identidad.mjs); omitido = el de la página; el servidor pasa null
  if (!t) return 'idea';
  if (t.state === 'done') return t.error ? 'fallida' : 'hecha';
  if (t.state === 'waiting') return 'espera_ok';
  if (t.state === 'doing') return 'en_curso';
  if (t.state === 'idea') return 'idea';
  if (deps && bloqueos(t, deps).length) return 'bloqueada';
  if (t.person) return esMia(t, yo) ? 'tuya' : 'en_manos';
  if (t.state === 'scheduled') return 'programada';
  return 'en_cola';
}

// quién mueve: 'dueno' (la página, el dueño), 'persona', 'jefe', 'dimitri', 'rutina', 'disparador', 'telegram', 'agente', 'oficina' (el motor)
const TODOS = ['dueno', 'persona', 'jefe', 'dimitri', 'rutina', 'disparador', 'telegram', 'agente', 'oficina'];
// guardado de → a: quién puede, y por qué no en palabras
const PASOS = {
  'idea>next': { quien: ['dueno', 'jefe', 'telegram', 'oficina'], porque: 'una idea la pide el dueño o el jefe del departamento' },
  'idea>scheduled': { quien: ['dueno', 'jefe', 'oficina'], porque: 'una idea la programa el dueño o el jefe del departamento' },
  'next>idea': { quien: ['dueno', 'dimitri'], porque: 'solo el dueño la devuelve a ideas' },
  'next>scheduled': { quien: ['dueno', 'jefe', 'dimitri', 'oficina'] },
  'scheduled>next': { quien: ['dueno', 'jefe', 'dimitri', 'oficina'] },
  'next>doing': { quien: ['oficina'], porque: 'una tarea la arranca la cola de la oficina' },
  'doing>waiting': { quien: ['oficina'] },
  'doing>done': { quien: ['oficina', 'dueno'], porque: 'la cierra el agente al entregar, o el dueño al detenerla' },
  'doing>next': { quien: ['oficina'] }, // un reintento, o se la pasó a una persona
  'waiting>doing': { quien: ['oficina'] }, // el OK o un «devolver» la ponen a trabajar
  'waiting>done': { quien: ['oficina', 'dueno'], porque: 'solo el dueño (o quien él autorizó) aprueba' },
  'waiting>next': { quien: ['dueno'], porque: 'solo el dueño se queda con un borrador para terminarlo él' }, // plan D: «Lo termino yo»
  'next>done': { quien: ['dueno', 'persona', 'oficina'], porque: 'la marca hecha el dueño o la persona que la tiene' },
  'scheduled>done': { quien: ['dueno', 'oficina'] },
  'done>next': { quien: ['dueno', 'persona', 'oficina'], porque: 'la reabre el dueño' },
  'idea>done': { quien: ['dueno'] },
};

export function puede(de, a, quien = 'dueno') {
  if (!GUARDADOS.includes(a)) return { ok: false, codigo: 'estado', motivo: `«${a}» no es un estado` };
  if (de === a) return { ok: true };
  const p = PASOS[`${de}>${a}`];
  if (!p) return { ok: false, codigo: 'transicion', motivo: `no se pasa de «${VISIBLES[visible({ state: de })]?.etiqueta || de}» a «${VISIBLES[visible({ state: a })]?.etiqueta || a}»` };
  if (!TODOS.includes(quien) || !p.quien.includes(quien)) return { ok: false, codigo: 'permiso', motivo: p.porque || 'no te toca mover esta tarea así' };
  return { ok: true };
}

export const abierta = t => VISIBLES[visible(t)]?.abierta ?? true;

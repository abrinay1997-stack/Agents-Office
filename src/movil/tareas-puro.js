// Versión móvil (25 oct 2026) — TAREAS, lo PURO: filtros (prioridad, etiquetas, proyecto, texto) y filtros guardados, a qué columnas se
// puede mover una tarea, quién bloquea a quién dentro de un proyecto, y los pasos. Sin DOM: se prueba en Node (tests/movil-e.test.mjs).
// La regla de qué movimiento vale es la del tablero de escritorio (src/tareas/tablero.js → movimiento): aquí solo se lista, no se reinventa.
import { COLUMNAS, columnaDe, movimiento } from '../tareas/tablero.js';
import { visible } from '../../tareas/estados.mjs';

export { COLUMNAS, columnaDe };
export const FILTRO_VACIO = Object.freeze({ prio: [], etiquetas: [], proyecto: '', texto: '' });
const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const filtroVacio = f => !f || (!(f.prio || []).length && !(f.etiquetas || []).length && !f.proyecto && !String(f.texto || '').trim());
export const contarFiltro = f => (f ? (f.prio || []).length + (f.etiquetas || []).length + (f.proyecto ? 1 : 0) + (String(f.texto || '').trim() ? 1 : 0) : 0);

/** ¿Esta tarea pasa el filtro? Prioridad: cualquiera de las elegidas. Etiquetas: todas las elegidas. Texto: en el título o las notas. */
export function pasaFiltro(t, f) {
  if (filtroVacio(f)) return true;
  if ((f.prio || []).length && !f.prio.includes(t.prioridad || 'media')) return false;
  if ((f.etiquetas || []).length && !f.etiquetas.every(e => (t.etiquetas || []).includes(e))) return false;
  if (f.proyecto && (f.proyecto === '-' ? t.proyecto : t.proyecto !== f.proyecto)) return false;
  const q = sinTildes(f.texto).trim();
  if (q && !sinTildes(`${t.title} ${t.text || ''}`).includes(q)) return false;
  return true;
}
export const aplicarFiltro = (tareas, f) => (filtroVacio(f) ? tareas : tareas.filter(t => pasaFiltro(t, f)));

/** El filtro en palabras: «Prioridad alta · #ventas · Proyecto Lanzamiento · “banco”» */
export function filtroTexto(f, cat = {}) {
  if (filtroVacio(f)) return 'Sin filtro';
  const p = [];
  if ((f.prio || []).length) p.push('Prioridad ' + f.prio.join(' o '));
  for (const e of f.etiquetas || []) p.push('#' + ((cat.etiquetas || []).find(x => x.id === e)?.nombre || e));
  if (f.proyecto) p.push(f.proyecto === '-' ? 'Sin proyecto' : 'Proyecto ' + ((cat.proyectos || []).find(x => x.id === f.proyecto)?.nombre || f.proyecto));
  if (String(f.texto || '').trim()) p.push(`“${String(f.texto).trim()}”`);
  return p.join(' · ');
}

/** Filtros guardados: [{ id, nombre, filtro }] (máximo 8, en este teléfono). */
let _n = 0;
export function guardarFiltro(lista, nombre, filtro) {
  const n = String(nombre || '').trim().slice(0, 30); if (!n || filtroVacio(filtro)) return lista;
  const sin = (lista || []).filter(x => x.nombre.toLowerCase() !== n.toLowerCase());
  return [...sin, { id: 'f' + Date.now().toString(36) + (++_n).toString(36), nombre: n, filtro: { prio: [...(filtro.prio || [])], etiquetas: [...(filtro.etiquetas || [])], proyecto: filtro.proyecto || '', texto: filtro.texto || '' } }].slice(-8);
}
export const quitarFiltro = (lista, id) => (lista || []).filter(x => x.id !== id);

/** A qué columnas del tablero se puede llevar una tarea desde donde está: [{ k, titulo, accion, texto }]. */
export function destinos(t, porId) {
  const de = columnaDe(t, porId);
  return COLUMNAS.filter(c => c.k !== de).map(c => ({ c, m: movimiento(t, de, c.k) })).filter(x => x.m).map(({ c, m }) => ({ k: c.k, titulo: c.titulo, accion: m.accion, texto: m.texto }));
}

/** Las tareas de un proyecto agrupadas por estado visible, en el orden en que importan. */
export const ORDEN_PROY = ['espera_ok', 'en_curso', 'bloqueada', 'en_manos', 'tuya', 'en_cola', 'programada', 'idea', 'fallida', 'hecha'];
export function porEstado(tareas, porId) {
  const g = new Map();
  for (const t of tareas) { const v = visible(t, porId); (g.get(v) || g.set(v, []).get(v)).push(t); }
  return ORDEN_PROY.filter(k => g.has(k)).map(k => ({ k, tareas: g.get(k) })).concat([...g.keys()].filter(k => !ORDEN_PROY.includes(k)).map(k => ({ k, tareas: g.get(k) })));
}

/** Quién espera a quién dentro de un conjunto: [{ id, title, espera: [{id,title,state}], laEsperan: [...] }] — solo las que tienen alguna relación. */
export function bloqueos(tareas) {
  const por = new Map(tareas.map(t => [t.id, t])), res = new Map(tareas.map(t => [t.id, { id: t.id, title: t.title, state: t.state, espera: [], laEsperan: [] }]));
  for (const t of tareas) for (const d of t.bloqueadaPor || []) {
    const dep = por.get(d); if (!dep) continue;
    res.get(t.id).espera.push({ id: dep.id, title: dep.title, state: dep.state });
    res.get(dep.id).laEsperan.push({ id: t.id, title: t.title, state: t.state });
  }
  return [...res.values()].filter(x => x.espera.length || x.laEsperan.length);
}

export const pasosHechos = t => { const p = t.pasos || []; return [p.filter(x => x.hecho).length, p.length]; };
/** El cronómetro de una persona: la tarea con un tramo abierto (`cronometro: [{quien, inicio, fin?}]`). */
export function conCronometro(tareas, quien = 'Tú') {
  for (const t of tareas) { const c = (t.cronometro || []).find(x => x.quien === quien && !x.fin); if (c) return { tarea: t, desde: c.inicio }; }
  return null;
}
export function reloj(ms) { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`; }

/** Las tareas que forman una cifra de Medidas (`ids`). */
export const idsDeCifra = (r, k) => (r && r[k] && Array.isArray(r[k].ids) ? r[k].ids : []);

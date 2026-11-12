// Ayudas del dominio AGENTES y DIMITRI del conector remoto (P5): formatear lo que la oficina contesta, paginar con cursor y guardar las versiones del brief (para VOLVER).
// Todo es texto corto: la salida de una herramienta no pasa de 20.000 letras y el servidor ya revisa órdenes escondidas en lo que devuelve.
import { leerDoc, mutarDoc } from '../../almacen.js';

export const DEPARTAMENTOS = Object.freeze(['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery']);
export const BRIEF_MAX = 2000;
export const VERSIONES_MAX = 10;
export const PREFIJO_VERSIONES = 'agentes.brief:'; // un doc por agente; NO está en las listas de «conservar»: es parte del equipo, no una clave de la P2
export const ID_AGENTE = /^[a-z0-9_-]{2,40}$/i;
export const ID_CONVERSACION = /^c[a-z0-9]{3,24}$/;

export const corta = (x, n = 160) => { const t = String(x ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
export const dia = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16).replace('T', ' ') : '—');
/** «hace 3 h» respecto de `ahora` (un número, no la hora de hoy: así el texto no depende del reloj). */
export function hace(ms, ahora) {
  if (!ms) return '—';
  const m = Math.max(0, Math.round((ahora - ms) / 60000));
  return m < 60 ? `hace ${m} min` : m < 2880 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
}
export function leccionTexto(l) { return corta(typeof l === 'string' ? l : l?.line || l?.text || l?.rule || JSON.stringify(l), 200); }

/** Una página de `items` con un cursor numérico opaco. → { pagina, siguiente, total } */
export function paginar(items, cursor, limite = 20) {
  const n = Math.max(1, Math.min(50, Math.floor(+limite) || 20)), desde = Math.max(0, Math.floor(+cursor) || 0);
  const pagina = items.slice(desde, desde + n);
  return { pagina, siguiente: desde + n < items.length ? String(desde + n) : undefined, total: items.length };
}
export const cabecera = (titulo, p) => `${titulo}: ${p.total}${p.pagina.length < p.total ? ` (mostrando ${p.pagina.length})` : ''}`;

/* ---------- versiones del brief ---------- */
/** → [{ n (1 = la más nueva), at, brief, por }] */
export async function versionesDe(db, id) {
  const { valor } = await leerDoc(db, PREFIJO_VERSIONES + id, { lista: [] });
  return (valor.lista || []).map((v, i) => ({ n: i + 1, at: v.at, brief: String(v.brief ?? ''), por: v.por || '' }));
}
/** Apunta el brief que había ANTES de un cambio (la más nueva primero; se guardan 10). */
export async function guardarVersion(db, id, { brief, at, por }) {
  await mutarDoc(db, PREFIJO_VERSIONES + id, { lista: [] }, (d) => ({ lista: [{ at, brief: String(brief ?? '').slice(0, BRIEF_MAX), por: String(por || '').slice(0, 80) }, ...(d.lista || [])].slice(0, VERSIONES_MAX) }));
}
/** Quita la versión más nueva (cuando el cambio que la motivó falló y no hay nada a lo que volver). */
export async function quitarUltimaVersion(db, id) {
  try { await mutarDoc(db, PREFIJO_VERSIONES + id, { lista: [] }, (d) => ({ lista: (d.lista || []).slice(1) })); } catch { /* la poda de 10 lo arregla sola */ }
}

/* ---------- formas de texto ---------- */
export function lineaAgente(a) {
  return `${a.id} · ${a.name} (${a.role || '—'}) — ${a.department}${a.lead ? ' · jefe' : ''} · modelo ${a.model || 'el de la oficina'}${a.effort ? ' · esfuerzo ' + a.effort : ''} · skills ${Array.isArray(a.skills) ? a.skills.length : 0} · lecciones ${a.lessons ?? 0}`;
}
export function lineaTarea(t, ahora, extra = '') {
  const quien = t.person ? `${t.person} (persona)` : t.agent || 'sin agente';
  return `${t.id} · «${corta(t.title, 90)}» — ${quien} · ${t.dept || '—'} · ${t.state}${t.error ? ' · CON FALLO' : ''}${extra} · ${hace(t.doneAt || t.waitingAt || t.startedAt || t.addedAt, ahora)}`;
}

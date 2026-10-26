// Versión móvil (25 oct 2026) — la AGENDA del Calendario: una lista de días con lo que pasa en cada uno. Pura (sin DOM), con test.
// Junta lo que la oficina ya sabe: tareas programadas (dueAt), fechas límite, las tareas del dueño (limite), y las rutinas
// (sus próximas ejecuciones, con when.js). Es la misma regla que calendar.js, sin su cuadrícula.
import { occurrences } from '../when.js';
import { ymd, pad, startOfDay, DOW_LONG, DOW_SHORT, MONTHS } from '../calendar-core.js';

const DIA = 864e5;
const limiteMs = s => { s = String(s || ''); if (!s) return null; const t = new Date(s.length > 10 ? s : s + 'T23:59').getTime(); return Number.isFinite(t) ? t : null; };

/** «Hoy», «Mañana» o «vie 30 oct» */
export function etiquetaDia(d, ahora = Date.now()) {
  if (d === ymd(new Date(ahora))) return 'Hoy';
  if (d === ymd(new Date(ahora + DIA))) return 'Mañana';
  if (d === ymd(new Date(ahora - DIA))) return 'Ayer';
  const x = new Date(d + 'T12:00'); return `${DOW_LONG[x.getDay()]} ${x.getDate()} de ${MONTHS[x.getMonth()].toLowerCase()}`;
}

/**
 * Los eventos del rango [desde, hasta) en milisegundos, ordenados por hora.
 * @returns {{tipo:'tarea'|'limite'|'mia'|'rutina', at:number, titulo:string, dept?:string, agente?:string, id?:string, hecha?:boolean, conHora:boolean, estado?:string, pausada?:boolean, saltada?:boolean}[]}
 */
export function eventos({ tareas = [], rutinas = [], desde, hasta, hechas = false } = {}) {
  const out = [];
  for (const t of tareas) {
    if (!t || t.archived || t.piece) continue;
    const mia = t.person === 'Tú';
    if (t.state === 'done') { if (hechas && t.doneAt >= desde && t.doneAt < hasta) out.push({ tipo: mia ? 'mia' : 'tarea', at: t.doneAt, titulo: t.title, dept: t.dept, agente: t.agent, id: t.id, hecha: true, conHora: true, estado: t.state }); continue; }
    if (!mia && t.state === 'scheduled' && t.dueAt >= desde && t.dueAt < hasta) out.push({ tipo: 'tarea', at: t.dueAt, titulo: t.title, dept: t.dept, agente: t.agent, id: t.id, conHora: true, estado: t.state });
    if (t.limite) {
      const s = String(t.limite), at = limiteMs(s);
      if (at != null && at >= desde && at < hasta) out.push({ tipo: mia ? 'mia' : 'limite', at, titulo: t.title, dept: t.dept, agente: t.agent, id: t.id, conHora: s.length > 10, estado: t.state });
    }
  }
  for (const r of rutinas) {
    if (!r || !r.when || r.when.kind === 'minutes') continue; // una cadencia de rodaje no es un calendario
    const occ = occurrences(r.when, Math.max(desde - 1, Date.now() - 1), hasta - 1, 400);
    const unaPorDia = r.when.kind === 'hourly', vistos = new Set();
    for (const at of occ) {
      if (unaPorDia) { const k = ymd(new Date(at)); if (vistos.has(k)) continue; vistos.add(k); }
      out.push({ tipo: 'rutina', at, titulo: r.title, dept: r.dept, agente: r.agent, id: r.id, conHora: !unaPorDia, pausada: !!r.paused, saltada: (r.skips || []).includes(at) });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Agrupa por día. Siempre incluye el día de `ahora` si cae en el rango (aunque esté vacío: «Hoy · nada»). */
export function agrupar(evs, { ahora = Date.now(), desde, hasta, conHoyVacio = true, rellenar = false } = {}) {
  const por = new Map();
  for (const e of evs) { const k = ymd(new Date(e.at)); if (!por.has(k)) por.set(k, []); por.get(k).push(e); }
  const hoy = ymd(new Date(ahora));
  if (rellenar) for (let t = startOfDay(desde); t < hasta; t += DIA) { const k = ymd(new Date(t + DIA / 2)); if (!por.has(k)) por.set(k, []); } // la vista de 3 días enseña los tres, aunque estén vacíos
  if (conHoyVacio && ahora >= desde && ahora < hasta && !por.has(hoy)) por.set(hoy, []);
  return [...por].sort(([a], [b]) => a.localeCompare(b)).map(([dia, items]) => ({ dia, titulo: etiquetaDia(dia, ahora), esHoy: dia === hoy, items }));
}

/** La hora de un evento: «09:30», o «todo el día» */
export const horaDe = e => (e.conHora ? `${pad(new Date(e.at).getHours())}:${pad(new Date(e.at).getMinutes())}` : 'todo el día');

/** El mes compacto: semanas de lunes a domingo con los puntos de cada día. → { titulo, semanas: [[{dia, delMes, n, tipos:Set}]] } */
export function mesGrid(ancla, evs = []) {
  const a = new Date(startOfDay(ancla)), primero = new Date(a.getFullYear(), a.getMonth(), 1);
  const ini = new Date(primero); ini.setDate(1 - ((primero.getDay() + 6) % 7));
  const cuenta = new Map();
  for (const e of evs) { const k = ymd(new Date(e.at)); const c = cuenta.get(k) || { n: 0, tipos: new Set() }; c.n++; c.tipos.add(e.tipo); cuenta.set(k, c); }
  const semanas = [];
  for (let s = 0; s < 6; s++) {
    const fila = [];
    for (let i = 0; i < 7; i++) { const d = new Date(ini); d.setDate(ini.getDate() + s * 7 + i); const k = ymd(d), c = cuenta.get(k); fila.push({ dia: k, num: d.getDate(), delMes: d.getMonth() === a.getMonth(), n: c ? c.n : 0, tipos: c ? c.tipos : new Set() }); }
    if (s >= 4 && !fila.some(c => c.delMes)) break; // sin semanas vacías al final
    semanas.push(fila);
  }
  return { titulo: `${MONTHS[a.getMonth()]} ${a.getFullYear()}`, desde: new Date(semanas[0][0].dia + 'T00:00').getTime(), hasta: new Date(semanas.at(-1)[6].dia + 'T00:00').getTime() + DIA, semanas };
}
export const cabeceraSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const nombreDiaCorto = d => DOW_SHORT[new Date(d + 'T12:00').getDay()];

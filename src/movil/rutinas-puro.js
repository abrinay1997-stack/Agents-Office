// Versión móvil (25 oct 2026) — RUTINAS, lo PURO: el formulario de una rutina (los siete botones L M X J V S D, la hora, mensual,
// cada hora, desde/hasta, N veces) se vuelve el `when` que entiende el servidor, y mover una ejecución («solo esta vez» o «siempre»).
// Sin DOM: se prueba en Node (tests/movil-e.test.mjs). La regla del horario es la de src/when.js (valid, describe): aquí no se inventa otra.
import { valid, describe } from '../when.js';

export const DIAS = [['L', 1, 'lunes'], ['M', 2, 'martes'], ['X', 3, 'miércoles'], ['J', 4, 'jueves'], ['V', 5, 'viernes'], ['S', 6, 'sábado'], ['D', 0, 'domingo']];
export const CADENCIAS = [['daily', 'Cada día'], ['weekdays', 'Entre semana'], ['weekly', 'Semanal'], ['monthly', 'Mensual'], ['hourly', 'Cada hora']];
export const NTH = [[1, 'el primer'], [2, 'el segundo'], [3, 'el tercer'], [4, 'el cuarto'], [-1, 'el último']];
const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** El estado del formulario: desde una rutina que existe, o con lo que se pide más seguido (semanal, lunes 9:00). */
export function formDe(r = null, { dept = 'ops' } = {}) {
  const w = r?.when || { kind: 'weekly', days: [1], at: '09:00' };
  const f = {
    texto: r?.text || '', dept: r?.dept || dept, agente: r?.agent || '', needsOk: r ? r.needsOk !== false : true, equipo: !!r?.team,
    kind: w.kind === 'minutes' ? 'hourly' : w.kind, at: w.at || '09:00', days: [...(w.days || [new Date().getDay()])],
    modo: w.nth !== undefined ? 'nth' : 'dia', dia: w.day ?? 1, nth: w.nth ?? 1, weekday: w.weekday ?? 1,
    cada: w.every || 1, desde: w.from || '09:00', hasta: w.to || '17:00', ventana: !!w.from, soloLab: !!w.weekdaysOnly,
    inicio: w.start || '', fin: w.end || '', veces: w.count || '',
  };
  if (!r) f.days = [1];
  return f;
}

/** El formulario → { when, errores } (errores: { campo: motivo en palabras }). `when` es null si falta algo. */
export function whenDeForm(f, { hoy = ymd(new Date()) } = {}) {
  const errores = {}, w = { kind: f.kind };
  const hora = /^\d{2}:\d{2}$/;
  if (f.kind === 'hourly') {
    const n = Math.round(+f.cada); if (!(n >= 1 && n <= 24)) errores.cada = 'Cada cuántas horas: de 1 a 24.'; else w.every = n;
    if (f.ventana) {
      if (!hora.test(f.desde) || !hora.test(f.hasta)) errores.ventana = 'Pon la hora de inicio y la de fin.';
      else if (!(f.desde < f.hasta)) errores.ventana = 'La hora de inicio tiene que ser antes que la de fin.';
      else { w.from = f.desde; w.to = f.hasta; }
    }
    if (f.soloLab) w.weekdaysOnly = true;
  } else {
    if (!hora.test(f.at)) errores.at = 'Pon la hora.'; else w.at = f.at;
    if (f.kind === 'weekly') { if (!f.days.length) errores.days = 'Elige al menos un día.'; else w.days = [...f.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); }
    if (f.kind === 'monthly') {
      if (f.modo === 'nth') { w.nth = +f.nth; w.weekday = +f.weekday; }
      else { const d = +f.dia; if (d === -1 || (Number.isInteger(d) && d >= 1 && d <= 31)) w.day = d; else errores.dia = 'El día del mes va de 1 a 31.'; }
    }
  }
  if (f.inicio) { if (f.inicio < hoy) errores.inicio = 'Esa fecha de inicio ya pasó.'; else w.start = f.inicio; }
  if (f.fin) { if (f.inicio && f.fin < f.inicio) errores.fin = 'Termina antes de empezar.'; else if (f.fin < hoy) errores.fin = 'Esa fecha de fin ya pasó.'; else w.end = f.fin; }
  if (f.veces !== '' && f.veces != null) { const n = Math.round(+f.veces); if (n >= 1 && n <= 999) w.count = n; else errores.veces = 'Las veces van de 1 a 999.'; }
  if (Object.keys(errores).length) return { when: null, errores };
  if (!valid(w)) return { when: null, errores: { general: 'Ese horario no está completo.' } };
  return { when: w, errores };
}

/** Lo que se dice bajo el formulario: «Se repetirá: todos los días a las 09:00». */
export const resumenForm = (f, op) => { const { when } = whenDeForm(f, op); return when ? describe(when) : ''; };

/** ¿Se puede crear/guardar? → { ok, errores, cuerpo } (cuerpo = lo que se manda a POST /api/routines). */
export function validarForm(f, { crear = true, hoy } = {}) {
  const { when, errores } = whenDeForm(f, { hoy });
  const e = { ...errores };
  if (!String(f.texto || '').trim()) e.texto = 'Escribe qué debe hacer la rutina.';
  else if (String(f.texto).trim().length > 4000) e.texto = 'Es muy larga: máximo 4.000 caracteres.';
  if (crear && !f.dept) e.dept = 'Elige el departamento.';
  if (Object.keys(e).length) return { ok: false, errores: e };
  const cuerpo = { text: String(f.texto).trim(), when, needsOk: !!f.needsOk, ...(f.agente ? { agent: f.agente } : {}), team: !!f.equipo };
  if (crear) cuerpo.dept = f.dept;
  return { ok: true, errores: {}, cuerpo };
}

/** Lo que cambió en una rutina que se edita: solo esos campos (un PATCH corto). */
export function cambiosDe(r, f, op) {
  const v = validarForm(f, { crear: false, hoy: op?.hoy }); if (!v.ok) return v;
  const c = v.cuerpo, p = {};
  if (c.text !== (r.text || '').trim()) p.text = c.text;
  if (JSON.stringify(c.when) !== JSON.stringify(r.when)) p.when = c.when;
  if (c.needsOk !== (r.needsOk !== false)) p.needsOk = c.needsOk;
  if (c.agent && c.agent !== r.agent) p.agent = c.agent;
  if (c.team !== !!r.team) p.team = c.team;
  return { ok: true, errores: {}, cambios: p };
}

/**
 * Mover UNA ejecución de una rutina (la que le toca a `at`) a `nuevo` (ms). Devuelve las dos formas que se le ofrecen al dueño:
 *   unaVez: crear una tarea para `nuevo` y saltar la ejecución de `at` (siempre se puede, si `nuevo` es futuro)
 *   siempre: el horario nuevo (solo si el cambio se expresa en el horario: la hora, y el día en una semanal), o null con el porqué
 */
export function moverEjecucion(r, at, nuevo, ahora = Date.now()) {
  const d0 = new Date(at), d1 = new Date(nuevo), w = r.when || {};
  const out = { unaVez: nuevo > ahora && at > ahora, motivoUnaVez: !(at > ahora) ? 'Esa ejecución ya pasó.' : !(nuevo > ahora) ? 'Esa hora ya pasó: elige una por venir.' : '', siempre: null, motivoSiempre: '' };
  const hora = `${pad(d1.getHours())}:${pad(d1.getMinutes())}`, cambiaHora = !!w.at && hora !== w.at, cambiaDia = ymd(d0) !== ymd(d1);
  if (w.kind === 'hourly' || w.kind === 'minutes') { out.motivoSiempre = 'Una rutina que corre cada cierto número de horas no se mueve en bloque: cambia su horario desde «Editar».'; return out; }
  if (!cambiaHora && !cambiaDia) { out.motivoSiempre = 'No cambió nada.'; return out; }
  const nueva = { ...w };
  if (cambiaHora) nueva.at = hora;
  if (cambiaDia) {
    if (w.kind === 'weekly') { const de = d0.getDay(), a = d1.getDay(); nueva.days = [...new Set((w.days || []).map(x => (x === de ? a : x)))]; }
    else if (w.kind === 'monthly' && w.nth === undefined) nueva.day = d1.getDate();
    else { out.motivoSiempre = `Una rutina «${describe(w).split(' a las')[0]}» no cambia de día para siempre: muévela solo esta vez, o cambia su horario desde «Editar».`; return out; }
  }
  if (!valid(nueva)) { out.motivoSiempre = 'Ese horario no queda completo.'; return out; }
  out.siempre = nueva; return out;
}

/** Los departamentos con rutinas y sus agentes, listos para los selectores. agentes: [{id, name, dept, lead}] */
export const agentesDeDept = (agentes, dept) => (agentes || []).filter(a => a.dept === dept || a.department === dept);

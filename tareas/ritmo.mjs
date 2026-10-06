// Agents Office (6 oct 2026, plan T5 · §5.G) — el RITMO de las tareas: repetir una tarea suelta (sobre todo las de personas: «revisar
// la caja cada viernes», «llamar al contador cada mes desde que la hice») y los avisos de fecha límite. Puro, con test.
//   repetir = { cada: 'dia' | 'semana' | '2semanas' | 'mes', modo: 'fijo' | 'alcompletar', hasta?: 'AAAA-MM-DD' }
//   · fijo: la siguiente vence un intervalo después de la fecha límite de la anterior (el 31 cae el último día de los meses cortos).
//   · alcompletar: un intervalo después del día en que se terminó. Si se termina tarde, no se amontonan atrasadas: hay UNA abierta.
// Las rutinas de los agentes siguen siendo rutinas (src/when.js); esto es para lo que no corre solo.
import { fechasRepetidas, CADA } from '../src/contenido-repetir.js';

export const CADAS = Object.keys(CADA);
export const NOMBRE_CADA = { dia: 'cada día', semana: 'cada semana', '2semanas': 'cada 2 semanas', mes: 'cada mes' };
const pad = n => String(n).padStart(2, '0');
const ymd = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function leerRepetir(v) {
  if (v === null || v === '' || v === false) return { repetir: null };
  if (!v || typeof v !== 'object' || !CADAS.includes(v.cada)) return { error: 'repetir: «cada» es dia, semana, 2semanas o mes' };
  const modo = v.modo === 'alcompletar' ? 'alcompletar' : 'fijo';
  if (v.hasta != null && v.hasta !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v.hasta))) return { error: 'repetir: «hasta» va como AAAA-MM-DD' };
  return { repetir: { cada: v.cada, modo, ...(v.hasta ? { hasta: String(v.hasta) } : {}) } };
}

// la base de la siguiente: fijo → la fecha límite de esta (o el día que se hizo, si no tenía); alcompletar → el día que se hizo
export const baseDe = (t, ahora = Date.now()) => (t.repetir?.modo === 'alcompletar' ? ymd(t.doneAt || ahora) : String(t.limite || '').slice(0, 10) || ymd(t.doneAt || ahora));

// las próximas `n` fechas (para la vista previa del detalle)
export function proximas(repetir, base, n = 5) {
  if (!repetir || !CADAS.includes(repetir.cada) || !/^\d{4}-\d{2}-\d{2}$/.test(base || '')) return [];
  return fechasRepetidas(base, repetir.cada, n).filter(f => !repetir.hasta || f <= repetir.hasta);
}

// al terminar BIEN una tarea con repetir → los campos de la siguiente (o null: no se repite, falló, o ya pasó de «hasta»)
export function siguiente(t, ahora = Date.now()) {
  if (!t?.repetir || t.state !== 'done' || t.error || t.stopped) return null;
  let f = proximas(t.repetir, baseDe(t, ahora), 1)[0];
  // fijo y terminada tarde: la siguiente no nace ya vencida — se salta hasta la primera que aún no pasó (una sola abierta)
  for (let i = 0; i < 400 && f && f < ymd(ahora); i++) f = proximas(t.repetir, f, 1)[0];
  if (!f) return null;
  const hora = String(t.limite || '').length > 10 ? String(t.limite).slice(10) : '';
  const c = { dept: t.dept, agent: t.agent, title: t.title, text: t.text, plan: (t.pasos || []).map(p => p.texto), prioridad: t.prioridad, etiquetas: t.etiquetas, proyecto: t.proyecto, estimacion: t.estimacion, person: t.person, repetir: t.repetir, repeatOf: t.id, by: t.by === 'routine' ? 'you' : t.by, limite: f + hora };
  // una tarea de un AGENTE que se repite arranca ese día a las 9 (programada); la de una persona espera en su lista con la fecha límite
  if (!t.person) c.dueAt = new Date(f + 'T09:00').getTime();
  return c;
}

// los avisos de fecha límite que tocan ahora y no se dieron: la víspera (si no empezó) y al vencer (si no está hecha)
export function avisosLimite(tareas, ahora = Date.now()) {
  const hoy = ymd(ahora), manana = ymd(ahora + 864e5), out = [];
  for (const t of tareas) {
    if (!t.limite || t.archived || t.state === 'done' || t.state === 'idea') continue;
    const dia = String(t.limite).slice(0, 10), fin = new Date(String(t.limite).length > 10 ? t.limite : t.limite + 'T23:59').getTime(), a = t.avisos || {};
    if (fin < ahora && !a.vencida) out.push({ id: t.id, tipo: 'vencida' });
    else if (dia === manana && !a.vispera && ['next', 'scheduled'].includes(t.state)) out.push({ id: t.id, tipo: 'vispera' });
    else if (dia === hoy && !a.hoy && t.person && fin >= ahora) out.push({ id: t.id, tipo: 'hoy' });
  }
  return out;
}

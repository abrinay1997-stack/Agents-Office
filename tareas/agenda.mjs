// Agents Office (6 oct 2026, plan T2/T3) — la AGENDA: qué hay hoy, qué se venció, qué viene. Pura: la usan la vista Tareas (Inicio),
// la herramienta ver_agenda de los agentes y Dimitri. Las fechas son las del reloj de esta máquina.
import { visible, bloqueos } from './estados.mjs';
import { limiteMs } from './modelo.mjs';
import { ordenCola } from './cola.mjs';

const dia = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const diaLocal = dia;
// la fecha que manda para «cuándo toca»: la límite; si no, la de arranque
export const fechaDe = t => (t.limite ? String(t.limite).slice(0, 10) : t.dueAt ? dia(t.dueAt) : null);

// → { esperanOk, hoy, vencidas, enCurso, bloqueadas, proximas, recientes } (listas de tareas) — cada una ya ordenada
export function agenda(tareas, { ahora = Date.now(), dias = 7, recientesHoras = 48, agente = null, dept = null } = {}) {
  const porId = new Map(tareas.map(t => [t.id, t]));
  const hoy = dia(ahora), fin = dia(ahora + dias * 864e5);
  const mias = tareas.filter(t => !t.archived && (!agente || (!t.person && (t.agent === agente || (t.team?.pieces || []).some(p => p.agent === agente)))) && (!dept || t.dept === dept)); // lo de una persona (o del dueño) no es del agente
  const out = { esperanOk: [], hoy: [], vencidas: [], enCurso: [], bloqueadas: [], proximas: [], recientes: [] };
  for (const t of mias) {
    const v = visible(t, porId), f = fechaDe(t), lim = limiteMs(t.limite);
    if (v === 'hecha' || v === 'fallida') { if ((t.doneAt || 0) >= ahora - recientesHoras * 3600e3) out.recientes.push(t); continue; }
    if (v === 'espera_ok') { out.esperanOk.push(t); continue; }
    if (v === 'en_curso') { out.enCurso.push(t); continue; }
    if (v === 'bloqueada') out.bloqueadas.push(t);
    if (lim && lim < ahora) out.vencidas.push(t);
    else if (f === hoy || (!f && t.state === 'next' && v !== 'bloqueada' && v !== 'idea')) out.hoy.push(t);
    else if (f && f > hoy && f <= fin) out.proximas.push(t);
  }
  out.esperanOk.sort((a, b) => (a.waitingAt || 0) - (b.waitingAt || 0));
  out.vencidas.sort((a, b) => limiteMs(a.limite) - limiteMs(b.limite));
  out.hoy.sort(ordenCola); out.bloqueadas.sort(ordenCola);
  out.proximas.sort((a, b) => (fechaDe(a) || '').localeCompare(fechaDe(b) || '') || ordenCola(a, b));
  out.recientes.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  out.bloqueadasPor = Object.fromEntries(out.bloqueadas.map(t => [t.id, bloqueos(t, porId).map(d => d.id)]));
  return out;
}

// la agenda en palabras (para un agente o Dimitri): corta, con ids para que no adivinen
export function agendaTexto(a, { nombre = id => id, max = 8 } = {}) {
  const linea = t => `- ${t.id} · «${t.title}» · ${t.person === 'Tú' ? 'DEL DUEÑO (la hace él)' : t.person ? `${t.person} (persona)` : nombre(t.agent)}${t.prioridad === 'alta' ? ' · prioridad ALTA' : ''}${t.limite ? ' · límite ' + t.limite.replace('T', ' ') : ''}${t.pasos?.length ? ` · pasos ${t.pasos.filter(p => p.hecho).length}/${t.pasos.length}` : ''}`;
  const bloque = (titulo, l) => l.length ? `${titulo} (${l.length}):\n${l.slice(0, max).map(linea).join('\n')}${l.length > max ? `\n- … y ${l.length - max} más` : ''}` : `${titulo}: nada.`;
  return [bloque('VENCIDAS', a.vencidas), bloque('HOY', a.hoy), bloque('EN CURSO', a.enCurso), bloque('ESPERAN EL OK DEL DUEÑO', a.esperanOk), bloque('BLOQUEADAS', a.bloqueadas), bloque('PRÓXIMOS DÍAS', a.proximas)].join('\n\n');
}

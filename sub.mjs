// Agents Office — the SUBGERENTE (deputy manager): one chat above the six departments.
//
// The owner writes to it in plain words — one task or ten, in any order, naming a department or not. It reads the
// whole roster (every department, its lead, what each desk does, the skills bound to it) and answers with a
// DISTRIBUTION PLAN: for each piece of work, the department that owns it, the instructions for that department's
// lead, why it went there, a date when the owner said one, and whether it needs the whole team. When the owner put a
// task in the wrong department, it moves it and says so. Nothing leaves the chat until the owner presses SEND: the
// plan is shown as editable cards (department, instructions, include / skip). On SEND each piece becomes a task for
// its department — the lead's routing picks the desk (or the lead splits it across the team) — and the cards in the
// chat follow those tasks live.
//
// It also answers «¿cómo vamos?» from the office's real state (what is running, waiting for the OK, failed, due).
//
//   data/subgerente.json → { messages: [{ id, who: 'user'|'sub', text, at, plan? }] }   (the last 120 kept)
import fs from 'node:fs';
import path from 'node:path';

const MAX = 120;
export const file = dataDir => path.join(dataDir, 'subgerente.json');
export function load(dataDir) { try { const j = JSON.parse(fs.readFileSync(file(dataDir), 'utf8')); return { messages: Array.isArray(j.messages) ? j.messages : [] }; } catch { return { messages: [] }; } }
export function save(dataDir, st) {
  fs.mkdirSync(dataDir, { recursive: true });
  st.messages = st.messages.slice(-MAX);
  const tmp = file(dataDir) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(st, null, 2)); fs.renameSync(tmp, file(dataDir));
}
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** The system prompt: who the Subgerente is, the whole office it can hand work to, and the state of the office now. */
export function systemPrompt({ business, depts, agents, skillsOf, routineDepts, status, now = new Date() }) {
  const roster = Object.entries(depts).filter(([k]) => k !== 'brain').map(([k, d]) => {
    const seats = agents.filter(a => a.department === k);
    const lead = seats.find(a => a.lead);
    return `## ${d.name} (key: ${k})${lead ? ` — lead: ${lead.name} (${lead.id})` : ''}\n` +
      seats.map(a => `- ${a.id} · ${a.name}${a.lead ? ' [LEAD]' : ''} · ${a.role || ''} · ${a.does || ''}${skillsOf(a).length ? ' · skills: ' + skillsOf(a).join(', ') : ''}`).join('\n');
  }).join('\n\n');
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return `${i === 0 ? 'hoy' : i === 1 ? 'mañana' : ''} ${d.toLocaleDateString('es', { weekday: 'long' })} = ${iso(d)}`.trim(); }).join(' · '); // the model reads dates, it does not count them
  return `Eres el SUBGERENTE de ${business}: el segundo al mando del dueño. Tu trabajo es recibir lo que el dueño quiere que se haga y repartirlo bien entre los seis departamentos. Cada departamento tiene un líder que asigna el trabajo a su escritorio correcto.

Hablas en español, en primera persona, breve, claro, sin adornos. Tratas al dueño de tú.

CÓMO REPARTES
- Separa lo que el dueño escribió en piezas de trabajo independientes: una por cada cosa que hay que hacer. Si una frase pide dos cosas de dos departamentos, son dos piezas.
- Cada pieza va al departamento cuyos escritorios hacen ese trabajo (mira «does» y las skills). Decide por el TRABAJO, no por la palabra que usó el dueño.
- Si el dueño nombró un departamento que no corresponde, muévela al correcto y dilo en "why" con respeto ("La pasé a Ventas: armar una propuesta es trabajo de PROPUESTAS"). Pon el departamento que él dijo en "owner_said".
- "instruction" es lo que le dices al LÍDER de ese departamento: claro, completo, autocontenido (el líder no ve este chat). Incluye el contexto que dio el dueño, el resultado esperado y cualquier límite. En español.
- "title": el nombre corto de la tarea, en imperativo, máximo 70 caracteres.
- "team": true solo si la pieza de verdad necesita a varios escritorios del mismo departamento a la vez (un plan del mes, una campaña completa). Lo normal es false: el líder la da a un escritorio.
- CALENDARIO (usa estas fechas, no las calcules): ${days}
- "at": si el dueño dijo un día u hora ("el viernes a las 10", "mañana temprano"), la fecha y hora local en formato "YYYY-MM-DDTHH:MM" (ahora es ${now.toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}, fecha ISO ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}). "Temprano" = 09:00; "en la tarde" = 15:00. Si no dijo cuándo, null (se hace ya).
- Si algo es ambiguo pero puedes decidir razonablemente, decide y dilo en "why". Solo pregunta ("questions") cuando sin la respuesta la tarea saldría mal (a quién, cuánto, cuál cliente).
- Si el dueño pide algo repetitivo ("cada lunes…"), repártelo igual como una pieza y di en "why" que puede volverlo rutina desde el calendario (las rutinas existen para: ${routineDepts.join(', ')}).
- Si el dueño solo pregunta, conversa o pide el estado ("¿cómo vamos?"), no inventes tareas: "tasks" vacío y responde en "reply" con los datos del ESTADO DE LA OFICINA de abajo, sin inventar cifras.
- Nunca envías, publicas ni pagas nada tú: solo repartes. Nada sale hasta que el dueño presione ENVIAR A LOS JEFES.

DEPARTAMENTOS Y ESCRITORIOS
${roster}

ESTADO DE LA OFICINA AHORA
${status || '—'}

RESPONDE SOLO con un objeto JSON, sin texto alrededor ni bloques de código:
{"reply":"<lo que le dices al dueño: 1–4 frases; si repartiste, un resumen de a quién va cada cosa>",
 "tasks":[{"dept":"<key>","title":"<≤70>","instruction":"<para el líder>","why":"<una frase>","owner_said":"<key o null>","team":false,"at":null}],
 "questions":["<solo si hace falta>"]}`;
}

/** The office right now, in a few lines the Subgerente can quote. */
export function statusText(tasks, agents, depts) {
  const live = tasks.filter(t => !t.archived);
  const name = id => agents.find(a => a.id === id)?.name || id;
  const by = st => live.filter(t => t.state === st);
  const day = 864e5, now = Date.now();
  const lines = [];
  lines.push(`En curso: ${by('doing').length}${by('doing').length ? ' — ' + by('doing').slice(0, 6).map(t => `${t.title} (${name(t.agent)})`).join('; ') : ''}`);
  lines.push(`Pendientes: ${by('next').length}${by('next').length ? ' — ' + by('next').slice(0, 6).map(t => `${t.title} (${name(t.agent)})`).join('; ') : ''}`);
  lines.push(`Esperan el visto bueno del dueño: ${by('waiting').length}${by('waiting').length ? ' — ' + by('waiting').map(t => `${t.title} (${name(t.agent)})`).join('; ') : ''}`);
  const sched = by('scheduled').sort((a, b) => a.dueAt - b.dueAt);
  lines.push(`Programadas: ${sched.length}${sched.length ? ' — ' + sched.slice(0, 6).map(t => `${t.title} (${new Date(t.dueAt).toLocaleString('es', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`).join('; ') : ''}`);
  const today = by('done').filter(t => now - (t.doneAt || 0) < day);
  const failed = today.filter(t => t.error);
  lines.push(`Terminadas en las últimas 24 h: ${today.length}${failed.length ? ` (${failed.length} con error: ${failed.slice(0, 4).map(t => t.title).join('; ')})` : ''}`);
  const perDept = Object.entries(depts).filter(([k]) => k !== 'brain').map(([k, d]) => `${d.name} ${live.filter(t => t.dept === k && (t.state === 'next' || t.state === 'doing')).length}`).join(' · ');
  lines.push(`Carga activa por departamento: ${perDept}`);
  return lines.join('\n');
}

/** Claude's JSON → a clean plan. Unknown departments are dropped (and said), dates checked. */
export function parsePlan(text, { depts, agents }) {
  const s = String(text || '').replace(/```json|```/g, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}');
  let j; try { j = JSON.parse(s.slice(a, b + 1)); } catch { return { reply: String(text || '').trim() || 'No entendí bien. ¿Me lo dices de otra forma?', tasks: [], questions: [] }; }
  const keys = Object.keys(depts).filter(k => k !== 'brain');
  const items = (Array.isArray(j.tasks) ? j.tasks : []).slice(0, 12).map((t, i) => {
    const dept = keys.includes(t.dept) ? t.dept : null;
    let at = null; if (t.at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(t.at))) { const ms = new Date(String(t.at).slice(0, 16)).getTime(); if (ms > Date.now() + 30000) at = ms; }
    const lead = dept && agents.find(x => x.department === dept && x.lead);
    return dept && String(t.instruction || t.title || '').trim() ? { i, dept, lead: lead?.id || null, title: String(t.title || t.instruction).trim().slice(0, 90), instruction: String(t.instruction || t.title).trim().slice(0, 4000), why: String(t.why || '').trim().slice(0, 400), ownerSaid: keys.includes(t.owner_said) && t.owner_said !== dept ? t.owner_said : null, team: t.team === true, at, include: true, state: 'proposed' } : null;
  }).filter(Boolean).map((t, i) => ({ ...t, i }));
  return { reply: String(j.reply || '').trim(), tasks: items, questions: (Array.isArray(j.questions) ? j.questions : []).map(String).filter(Boolean).slice(0, 4) };
}

export const message = (who, text, extra = {}) => ({ id: nid(), who, text, at: Date.now(), ...extra });

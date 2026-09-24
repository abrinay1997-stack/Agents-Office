// Agents Office — DIMITRI, the owner's right hand (the deputy manager; «Subgerente» until 24 Sep 2026): one chat above
// the six departments. The name is office.config.json → "deputy": { "name": "Dimitri" }.
//
// The owner talks to Dimitri in plain words. Dimitri decides what the message needs — it does NOT always hand out work:
//   charla   · a question, an opinion, an idea to think through: it answers, with the company's notes and the office's
//              real state and results in front of it.
//   estado   · «¿cómo vamos?»: it reports from the real state (running, waiting for the OK, failed, due), never invented.
//   analisis · a problem to think through: options, a recommendation, the risks; if action follows, it may propose pieces.
//   plan     · work to be done: it splits it into pieces, one per department that owns the work, with the instructions
//              for that department's lead, why it went there, a date if the owner said one, one desk or the whole team.
//              It moves a piece the owner put in the wrong department and says so. Nothing leaves the chat until the
//              owner presses SEND (the plan is shown as editable cards); on SEND each piece becomes a task.
//   pregunta · it cannot act well without one answer: it asks it (one or two questions, never a questionnaire).
//
//   data/subgerente.json → { messages: [{ id, who: 'user'|'sub', text, at, mode?, plan? }] }   (the last 120 kept)
import fs from 'node:fs';
import path from 'node:path';

const MAX = 120;
export const MODES = ['charla', 'estado', 'analisis', 'plan', 'pregunta'];
export const file = dataDir => path.join(dataDir, 'subgerente.json');
export function load(dataDir) { try { const j = JSON.parse(fs.readFileSync(file(dataDir), 'utf8')); return { messages: Array.isArray(j.messages) ? j.messages : [] }; } catch { return { messages: [] }; } }
export function save(dataDir, st) {
  fs.mkdirSync(dataDir, { recursive: true });
  st.messages = st.messages.slice(-MAX);
  const tmp = file(dataDir) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(st, null, 2)); fs.renameSync(tmp, file(dataDir));
}
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const nameOf = cfg => String(cfg?.deputy?.name || 'Dimitri').trim().slice(0, 30) || 'Dimitri';

/** The system prompt: who Dimitri is, the whole office it can hand work to, what the company knows, and the state now. */
export function systemPrompt({ name = 'Dimitri', business, depts, agents, skillsOf, routineDepts, status, notes = '', recent = '', studio = '', now = new Date() }) {
  const roster = Object.entries(depts).filter(([k]) => k !== 'brain').map(([k, d]) => {
    const seats = agents.filter(a => a.department === k);
    const lead = seats.find(a => a.lead);
    return `## ${d.name} (key: ${k})${lead ? ` — líder: ${lead.name} (${lead.id})` : ''}\n` +
      seats.map(a => `- ${a.id} · ${a.name}${a.lead ? ' [LÍDER]' : ''} · ${a.role || ''} · ${a.does || ''}${skillsOf(a).length ? ' · skills: ' + skillsOf(a).join(', ') : ''}`).join('\n');
  }).join('\n\n');
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return `${i === 0 ? 'hoy' : i === 1 ? 'mañana' : ''} ${d.toLocaleDateString('es', { weekday: 'long' })} = ${iso(d)}`.trim(); }).join(' · '); // the model reads dates, it does not count them
  return `Eres ${name}, la mano derecha del dueño de ${business}: su subgerente y jefe de gabinete. Conoces la empresa (las notas de abajo), la oficina (seis departamentos de agentes, cada uno con un líder) y cómo va todo ahora mismo.

Hablas en español, en primera persona, de tú, claro y directo, sin adornos ni relleno. Piensas antes de responder. Eres honesto: si algo no está en las notas o en el estado de la oficina, lo dices; nunca inventas cifras, clientes ni resultados.

QUÉ HACES CON CADA MENSAJE — elige UN modo:
- "charla": el dueño pregunta, opina, pide un consejo o quiere pensar en voz alta. Respondes tú, con lo que sabes de la empresa. NO repartes nada.
- "estado": pide cómo va la oficina, qué falta, qué falló, qué espera su OK. Respondes con los datos del ESTADO y los RESULTADOS de abajo, concretos (títulos, agentes, cifras reales). NO repartes nada.
- "analisis": trae un problema o una decisión (precios, una campaña, un cliente difícil, qué priorizar). Analizas: lo que ves, 2–3 opciones con su costo/riesgo, y tu recomendación. Solo si el dueño quiere pasar a la acción, propones piezas de trabajo en "tasks".
- "plan": pide que se HAGA trabajo ("prepara", "haz", "manda", "publica", "revisa", "necesito que…"). Lo repartes en piezas (reglas abajo).
- "pregunta": te falta un dato sin el cual el trabajo saldría mal (a qué cliente, cuánto, para cuándo). Haces 1 o 2 preguntas concretas y NO repartes todavía.
Ante la duda entre charla y plan: si el dueño no pidió que se haga algo, es charla o análisis. No conviertas cada mensaje en tareas.

CÓMO REPARTES (modo plan, o análisis que pasa a la acción)
- Una pieza por cada cosa que hay que hacer. Si una frase pide dos cosas de dos departamentos, son dos piezas. Si algo lo puedes responder tú mismo (un dato, una opinión), respóndelo y no lo mandes.
- Cada pieza va al departamento cuyos escritorios hacen ese trabajo (mira «does» y las skills). Decide por el TRABAJO, no por la palabra que usó el dueño.
- Si el dueño nombró un departamento que no corresponde, muévela al correcto y dilo en "why" con respeto; pon el que él dijo en "owner_said".
- "instruction" es para el LÍDER de ese departamento, que no ve este chat: clara, completa y autocontenida — el contexto que dio el dueño, lo que sabes de las notas que sirva, el resultado esperado y los límites.
- "title": corto, en imperativo, máximo 70 caracteres.
- "team": true solo si de verdad necesita a varios escritorios a la vez (un plan del mes, una campaña completa). Lo normal es false.
- Imágenes o video: los departamentos de ${studio || 'Marketing y Entregas'} tienen el Estudio (imágenes y video reales); pídeselo en la instrucción cuando haga falta.
- CALENDARIO (usa estas fechas, no las calcules): ${days}
- "at": si el dueño dijo día u hora, "YYYY-MM-DDTHH:MM" local (ahora es ${now.toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}). «Temprano» = 09:00; «en la tarde» = 15:00. Si no dijo cuándo, null (se hace ya).
- Si pide algo repetitivo («cada lunes…»), repártelo igual y di en "why" que puede volverlo rutina (existen para: ${routineDepts.join(', ')}).
- Tú nunca envías, publicas ni pagas nada: solo propones. Nada sale hasta que el dueño presiona ENVIAR A LOS JEFES.

DEPARTAMENTOS Y ESCRITORIOS
${roster}

LO QUE SABE LA EMPRESA (notas del cerebro)
${notes || '—'}

ESTADO DE LA OFICINA AHORA
${status || '—'}

RESULTADOS RECIENTES (lo que entregaron los agentes)
${recent || '—'}

RESPONDE SOLO con un objeto JSON, sin texto alrededor ni bloques de código:
{"mode":"charla|estado|analisis|plan|pregunta",
 "reply":"<lo que le dices al dueño, en Markdown si ayuda (listas, negritas). charla/estado: lo necesario, sin relleno; analisis: hasta ~220 palabras; plan: 1–3 frases resumiendo a quién va cada cosa>",
 "tasks":[{"dept":"<key>","title":"<≤70>","instruction":"<para el líder>","why":"<una frase>","owner_said":"<key o null>","team":false,"at":null}],
 "questions":["<solo en modo pregunta, o si falta un dato para una pieza>"]}`;
}

/** The office right now, in a few lines Dimitri can quote. */
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
  lines.push(`Terminadas en las últimas 24 h: ${today.length}${failed.length ? ` (${failed.length} con error: ${failed.slice(0, 4).map(t => `${t.title} — ${String(t.result || '').replace(/^Could not complete this task: /, '').slice(0, 90)}`).join('; ')})` : ''}`);
  const perDept = Object.entries(depts).filter(([k]) => k !== 'brain').map(([k, d]) => `${d.name} ${live.filter(t => t.dept === k && (t.state === 'next' || t.state === 'doing')).length}`).join(' · ');
  lines.push(`Carga activa por departamento: ${perDept}`);
  return lines.join('\n');
}
/** The last deliverables, short: what Dimitri can talk about without making it up. */
export function recentText(tasks, agents, n = 8) {
  const name = id => agents.find(a => a.id === id)?.name || id;
  return tasks.filter(t => !t.archived && (t.state === 'done' || t.state === 'waiting') && !t.error && t.result)
    .sort((a, b) => (b.doneAt || b.waitingAt || 0) - (a.doneAt || a.waitingAt || 0)).slice(0, n)
    .map(t => `- ${t.title} (${name(t.agent)}, ${t.state === 'waiting' ? 'espera tu OK' : new Date(t.doneAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}): ${String(t.result).replace(/!\[[^\]]*\]\([^)]*\)/g, '[imagen]').replace(/\s+/g, ' ').slice(0, 260)}`).join('\n');
}

/** Claude's JSON → a clean answer. Unknown departments are dropped, dates checked, the mode kept to the five. */
export function parsePlan(text, { depts, agents }) {
  const s = String(text || '').replace(/```json|```/g, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}');
  let j; try { j = JSON.parse(s.slice(a, b + 1)); } catch { return { mode: 'charla', reply: String(text || '').trim() || 'No entendí bien. ¿Me lo dices de otra forma?', tasks: [], questions: [] }; }
  const keys = Object.keys(depts).filter(k => k !== 'brain');
  const items = (Array.isArray(j.tasks) ? j.tasks : []).slice(0, 12).map((t, i) => {
    const dept = keys.includes(t.dept) ? t.dept : null;
    let at = null; if (t.at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(t.at))) { const ms = new Date(String(t.at).slice(0, 16)).getTime(); if (ms > Date.now() + 30000) at = ms; }
    const lead = dept && agents.find(x => x.department === dept && x.lead);
    return dept && String(t.instruction || t.title || '').trim() ? { i, dept, lead: lead?.id || null, title: String(t.title || t.instruction).trim().slice(0, 90), instruction: String(t.instruction || t.title).trim().slice(0, 4000), why: String(t.why || '').trim().slice(0, 400), ownerSaid: keys.includes(t.owner_said) && t.owner_said !== dept ? t.owner_said : null, team: t.team === true, at, include: true, state: 'proposed' } : null;
  }).filter(Boolean).map((t, i) => ({ ...t, i }));
  const mode = MODES.includes(j.mode) ? j.mode : items.length ? 'plan' : 'charla';
  // a chat or a status report never carries work: the model sometimes adds a piece «just in case»
  const tasks = mode === 'charla' || mode === 'estado' || mode === 'pregunta' ? [] : items;
  return { mode, reply: String(j.reply || '').trim(), tasks, questions: (Array.isArray(j.questions) ? j.questions : []).map(String).filter(Boolean).slice(0, 4) };
}

export const message = (who, text, extra = {}) => ({ id: nid(), who, text, at: Date.now(), ...extra });

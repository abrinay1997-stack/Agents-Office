// Agents Office — the department lead interviews the owner (Beta).
// In the chat with a department lead, say "set up". The lead asks five questions, one at a time,
// about how that department works here, then writes it down for the team:
//   · a brief for each agent in the department   → <brain>/Agents Office/agents.json
//   · one skill for the job the owner described  → <brain>/Agents Office/skills/<name>/
// Nothing is written until the last answer. "skip" skips a question, "done" finishes early,
// "cancel" throws the answers away. State lives in data/interviews.json while an interview runs.
import fs from 'node:fs';
import path from 'node:path';

// Spanish triggers must be the whole message, so "configurar el Gmail" stays ordinary chat.
const START = /^\s*((set\s?-?up|onboard(ing)?|interview\s+me|teach\s+(you|the\s+team)|let'?s\s+(set\s?up|start)|start\s+the\s+interview)\b|[¡!]?(configurar|configuraci[oó]n|config[uú]ralo|entr[eé]v[ií]stame|empecemos|empezar|iniciar|comenzar)(\s+(el\s+|este\s+)?(departamento|equipo|la\s+oficina|la\s+entrevista|con\s+la\s+entrevista))?\s*[.!]?\s*$)/i;
const CANCEL = /^\s*(cancel|stop|never\s?mind|forget\s+it|cancelar|cancela|para|detente|olv[ií]dalo|d[eé]jalo)\s*[.!]?\s*$/i;
const SKIP = /^\s*(skip|pass|next|saltar|salta|s[aá]ltala|paso|siguiente|omitir|omite)\s*[.!]?\s*$/i;
const DONE = /^\s*(done|finish|that'?s\s+(it|all|enough)|enough|listo|lista|termin(ar|amos|[eé])|ya\s+est[aá]|suficiente|(eso\s+)?es\s+todo)\s*[.!]?\s*$/i;

export const QUESTIONS = [
  { k: 'what', q: d => `Primero: ¿qué hace ${d} realmente aquí, en tus palabras? ¿Qué entra, qué sale y para quién es?` },
  { k: 'job', q: d => `Cuéntame el trabajo de ${d.toLowerCase()} que haces con más frecuencia, de principio a fin. ¿Dónde empieza, qué revisas, cómo se ve cuando está terminado?` },
  { k: 'good', q: () => `¿Cómo se ve un buen resultado? Si tienes uno que te haya gustado, pégalo o descríbelo. Si tienes una plantilla, describe sus secciones.` },
  { k: 'never', q: () => `¿Qué no debe pasar nunca? Límites claros, cosas que siempre te esperan a ti, algo que haya salido mal antes y no deba repetirse.` },
  { k: 'tools', q: () => `¿Qué herramientas o sistemas usamos para esto y quiénes participan (clientes, proveedores, personal, un contador)? Di "skip" si no se te ocurre nada.` },
];

export const stateFile = dataDir => path.join(dataDir, 'interviews.json');
const load = dataDir => { try { return JSON.parse(fs.readFileSync(stateFile(dataDir), 'utf8')); } catch { return {}; } };
const save = (dataDir, s) => { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(stateFile(dataDir), JSON.stringify(s, null, 2)); };
export const active = (dataDir, dept) => !!load(dataDir)[dept];

/** Is this department set up yet? True when any of its agents has a brief or a skill of the owner's. */
export function isSetUp(agents, skills, dept) {
  return agents.some(a => a.department === dept && (a.brief || skills.forAgent(a).some(s => s.source === 'brain')));
}

const progress = (i, d) => `**Pregunta ${i + 1} de ${QUESTIONS.length}.** ${QUESTIONS[i].q(d)}`;

/**
 * One chat turn. Returns { reply, wrote? } when the interview handles it, or null to let the normal chat answer.
 * ctx: { dept, deptName, lead, agents (this dept), connected (names), brainPath, dataDir, ask, afterWrite }
 */
export async function handle(text, ctx) {
  const { dept, deptName: d, lead, dataDir } = ctx;
  const st = load(dataDir); const cur = st[dept];
  if (!cur) {
    if (!START.test(text)) return null;
    st[dept] = { step: 0, answers: [], startedAt: Date.now() }; save(dataDir, st);
    return { reply: `Perfecto. Cinco preguntas sobre cómo funciona ${d} aquí, una por una. Responde con tus palabras, tanto o tan poco como quieras. "saltar" salta una, "listo" termina antes, "cancelar" descarta todo. No se escribe nada hasta el final, y entonces te diré exactamente qué escribí y dónde.\n\n${progress(0, d)}` };
  }
  if (CANCEL.test(text)) { delete st[dept]; save(dataDir, st); return { reply: `Cancelado. No se escribió nada. Di "configurar" cuando quieras empezar de nuevo.` }; }
  let finish = false;
  if (DONE.test(text)) { if (!cur.answers.some(Boolean)) { delete st[dept]; save(dataDir, st); return { reply: `Todavía no hay nada que anotar. Di "configurar" cuando tengas unos minutos.` }; } finish = true; }
  else { cur.answers.push(SKIP.test(text) ? '' : String(text).trim()); cur.step = cur.answers.length; if (cur.step >= QUESTIONS.length) finish = true; }
  if (!finish) { save(dataDir, st); return { reply: `Anotado.\n\n${progress(cur.step, d)}` }; }
  delete st[dept]; save(dataDir, st); // whatever happens next, the interview is over
  const answers = QUESTIONS.map((q, i) => ({ k: q.k, q: q.q(d), a: cur.answers[i] || '' })).filter(x => x.a);
  const wrote = await writeUp(answers, ctx);
  const briefs = wrote.briefs.map(b => `${ctx.agents.find(a => a.id === b.id)?.name || b.id}`).join(', ');
  const lines = [`Listo. Esto es lo que anoté para ${d}:`];
  if (wrote.briefs.length) lines.push(`- Un brief para ${briefs} en \`${wrote.agentsFile}\` — lo que cada uno ahora sabe sobre cómo trabajas.`);
  if (wrote.skill) lines.push(`- Un skill, **${wrote.skill.name}**${wrote.skill.description ? ' (' + wrote.skill.description + ')' : ''}, para ${wrote.skill.agents.map(id => ctx.agents.find(a => a.id === id)?.name || id).join(' y ')} en \`${wrote.skill.dir}\`${wrote.skill.template ? ' con una plantilla al lado' : ''}.`);
  if (!wrote.briefs.length && !wrote.skill) lines.push(`- De las respuestas no salió nada utilizable, así que no se escribió nada. Di "configurar" para intentarlo de nuevo con más detalle.`);
  if (wrote.problems.length) lines.push(`- Omitido: ${wrote.problems.join('; ')}.`);
  lines.push(`Se aplican desde la próxima tarea. Pruébalo: elige ${d} en la barra de tareas y escribe "${wrote.tryTask || 'el trabajo que describiste, para un cliente real'}". Si el resultado no te convence, devuélvelo con "revise: …" y recordaré la corrección. Puedes editar los archivos cuando quieras; son tuyos.`);
  return { reply: lines.join('\n'), wrote };
}

/** Claude turns the answers into briefs + one skill, and they are written into the brain. */
export async function writeUp(answers, ctx) {
  const { dept, deptName: d, lead, agents, connected = [], brainPath, ask, business = '' } = ctx;
  const roster = agents.map(a => `- ${a.id} · ${a.name}${a.lead ? ' (lead)' : ''} · ${a.role} · ${a.does}`).join('\n');
  const system = `Conviertes las respuestas de la entrevista del dueño en instrucciones de trabajo para los agentes de IA del departamento de ${d} de ${business || 'su negocio'}. Devuelve SOLO un objeto JSON, sin texto adicional, sin bloques de código.`;
  const user = `Agents in ${d} (id · name · role · what they do):\n${roster}\n\nConnected tools: ${connected.join(', ') || 'none'}\n\nThe owner's answers:\n` +
    answers.map(x => `Q: ${x.q}\nA: ${x.a}`).join('\n\n') + '\n\n' +
    'Write:\n' +
    '1. "briefs": for each agent whose work the answers touch (the lead always), a brief — the owner\'s standing instructions to that agent in 2–6 short sentences, second person, concrete, in the owner\'s terms. Tone, red lines, who to escalate to, which tool to use. Only what the owner actually said or clearly implied; never invent a process. Skip agents the answers say nothing about.\n' +
    '2. "skill": ONE skill for the job the owner described most (question 2), or null if they did not describe a job. name = short kebab-case; description = one line; agents = the ids that do this job (1–3); body = Markdown: a heading, then the first line saying when this skill applies, then "## Steps" (numbered, what to read or check first, by note name if the owner named one), "## The shape" (the sections of the finished thing), "## Rules" (short, absolute, from the red lines). Under 3000 characters. template = the finished thing\'s skeleton in Markdown with the owner\'s sections and placeholders in {braces}, or "" if the owner gave no shape.\n' +
    '3. "try": one task, under 90 characters, the owner could type to test this, in their terms.\n' +
    'Write every brief, the skill body, the template, the description and "try" in Latin American Spanish. Keep the JSON keys, the skill name (kebab-case) and the Markdown headings "## Steps", "## The shape", "## Rules" exactly as given.\n' +
    'Return: {"briefs":[{"id":"<agent id>","brief":"<text>"}],"skill":{"name":"","description":"","agents":[],"body":"","template":""}|null,"try":""}';
  let j = null; try { const t = await ask(system, user, { maxTokens: 3000, timeout: 180000 }); const s = t.replace(/```json|```/g, ''); j = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch (e) { j = { briefs: [], skill: null, try: '', error: e.message }; }
  const ids = new Set(agents.map(a => a.id)); const problems = [];
  if (j.error) problems.push('Claude no devolvió instrucciones utilizables (' + j.error.split('\n')[0] + ')');
  // briefs → <brain>/Agents Office/agents.json (merged: other agents and other fields untouched)
  const briefs = (Array.isArray(j.briefs) ? j.briefs : []).filter(b => b && ids.has(b.id) && String(b.brief || '').trim()).map(b => ({ id: b.id, brief: String(b.brief).trim().slice(0, 2000) }));
  for (const b of (Array.isArray(j.briefs) ? j.briefs : [])) if (b && b.id && !ids.has(b.id)) problems.push(`"${b.id}" no está en ${d}`);
  const agentsFile = path.join(brainPath, 'Agents Office', 'agents.json');
  if (briefs.length) {
    fs.mkdirSync(path.dirname(agentsFile), { recursive: true });
    let doc = { agents: [] }; try { const x = JSON.parse(fs.readFileSync(agentsFile, 'utf8')); if (Array.isArray(x?.agents)) doc = x; } catch {}
    for (const b of briefs) { const e = doc.agents.find(x => x && x.id === b.id); if (e) e.brief = b.brief; else doc.agents.push({ id: b.id, brief: b.brief }); }
    fs.writeFileSync(agentsFile, JSON.stringify(doc, null, 2) + '\n');
  }
  // the skill → <brain>/Agents Office/skills/<name>/SKILL.md (+ template.md)
  let skill = null;
  if (j.skill && typeof j.skill === 'object' && String(j.skill.body || '').trim()) {
    const name = String(j.skill.name || `${dept}-job`).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '') || `${dept}-job`;
    let bound = (Array.isArray(j.skill.agents) ? j.skill.agents : []).filter(id => ids.has(id));
    if (!bound.length) bound = [lead.id];
    const dir = path.join(brainPath, 'Agents Office', 'skills', name);
    if (fs.existsSync(path.join(dir, 'SKILL.md'))) { const bak = path.join(dir, `SKILL.md.backup-${Date.now()}`); fs.copyFileSync(path.join(dir, 'SKILL.md'), bak); problems.push(`ya existía un skill llamado ${name} — el SKILL.md anterior se guardó al lado como ${path.basename(bak)}`); }
    fs.mkdirSync(dir, { recursive: true });
    const description = String(j.skill.description || '').replace(/\n/g, ' ').trim().slice(0, 160);
    const body = String(j.skill.body).trim().slice(0, 6000);
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\nagents: [${bound.join(', ')}]\n---\n${body}\n`);
    const template = String(j.skill.template || '').trim();
    if (template) fs.writeFileSync(path.join(dir, 'template.md'), template.slice(0, 4000) + '\n');
    skill = { name, description, agents: bound, dir: path.relative(process.cwd(), dir), template: !!template };
  }
  if (ctx.afterWrite) ctx.afterWrite();
  return { briefs, skill, agentsFile: path.relative(process.cwd(), agentsFile), problems, tryTask: String(j.try || '').trim().slice(0, 90) };
}

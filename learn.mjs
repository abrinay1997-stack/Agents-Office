// Agents Office — the agents learn from your corrections (Beta).
// Every time a deliverable is sent back ("revise: …" in the chat), the correction is written to
//   <brain>/Agents Office/feedback/<agent-id>.md
// Claude sorts it: a one-off about that task, or a standing rule that should apply every time.
// Standing rules are read by that agent before every task and chat turn. The file is yours:
// edit a rule, delete a line to unlearn it, move a line up to "Standing rules" to promote it.
import fs from 'node:fs';
import path from 'node:path';

export const dir = brainPath => path.join(brainPath, 'Agents Office', 'feedback');
const file = (brainPath, id) => path.join(dir(brainPath), id + '.md');
const MAX_RULES = 15; // the most recent standing rules an agent carries into a task
const HEAD = (a) => `# Correcciones para ${a.name} (${a.id})\n\n` +
  'Cada vez que el dueño devuelve el trabajo de este agente, la corrección queda aquí. Las líneas bajo\n' +
  '"Standing rules" las lee este agente antes de cada tarea y cada turno de chat. Edita libremente: cambia\n' +
  'una regla, borra una línea para desaprenderla, sube un caso puntual para volverlo regla. Cuando una regla sea en realidad un\n' +
  'proceso, ponla en una skill (SKILLS.md).\n\n## Standing rules\n\n## One-offs\n';

/** Read the file → { rules: [...], oneOffs: [...] } (each a line without the leading "- "). */
export function read(brainPath, id) {
  const p = file(brainPath, id); if (!fs.existsSync(p)) return { rules: [], oneOffs: [] };
  const out = { rules: [], oneOffs: [] }; let sec = null;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (/^##\s+standing rules/i.test(line)) { sec = 'rules'; continue; }
    if (/^##\s+one-offs/i.test(line)) { sec = 'oneOffs'; continue; }
    if (/^##?\s/.test(line)) { sec = null; continue; }
    const m = line.match(/^\s*[-*]\s+(.+)$/); if (m && sec) out[sec].push(m[1].trim());
  }
  return out;
}

/** Append one correction. `verdict` = { standing, rule } from classify(), or null when Claude was unavailable. */
export function record(brainPath, agent, task, feedback, verdict) {
  fs.mkdirSync(dir(brainPath), { recursive: true });
  const p = file(brainPath, agent.id);
  let text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : HEAD(agent);
  if (!/^## Standing rules/m.test(text)) text += '\n## Standing rules\n'; if (!/^## One-offs/m.test(text)) text += '\n## One-offs\n';
  const date = new Date().toISOString().slice(0, 10);
  const quote = String(feedback).replace(/\s+/g, ' ').trim().slice(0, 160);
  const ctx = task?.title ? ` (${String(task.title).slice(0, 60)})` : '';
  const standing = !!(verdict && verdict.standing && verdict.rule);
  const line = standing ? `- ${date} · ${String(verdict.rule).replace(/\s+/g, ' ').trim().slice(0, 240)} ← "${quote}"${ctx}` : `- ${date} · "${quote}"${ctx}`;
  const insertAfter = standing ? /^## Standing rules[^\n]*\n/m : /^## One-offs[^\n]*\n/m;
  const m = text.match(insertAfter);
  // append at the END of that section (before the next "## " or the end of the file)
  const start = m.index + m[0].length; const rest = text.slice(start); const next = rest.search(/^## /m);
  const end = next < 0 ? text.length : start + next;
  const before = text.slice(0, end).replace(/\s*$/, '\n'); const after = text.slice(end);
  text = before + line + '\n' + (after && !after.startsWith('\n') ? '\n' : '') + after;
  fs.writeFileSync(p, text);
  return { standing, line, path: p };
}

/** Ask Claude whether a correction is a one-off or a standing rule. `ask(system, user)` → text. */
export async function classify(ask, agent, task, feedback) {
  const system = 'Clasificas la retroalimentación del dueño sobre el trabajo de un agente de IA. Devuelve SOLO un objeto JSON, sin texto adicional, sin bloques de código.';
  const user = `Agente: ${agent.name} — ${agent.role}. ${agent.does}\nTarea: ${task?.title || ''}\nRetroalimentación del dueño: "${feedback}"\n\n` +
    '¿Es un CASO PUNTUAL (sobre esta tarea, este cliente, este borrador solamente) o una REGLA PERMANENTE (una preferencia que el dueño querrá aplicar a cada trabajo futuro de este tipo)?\n' +
    'Señales de una regla permanente: "siempre", "nunca", "de ahora en adelante", "nosotros no", una preferencia de formato o tono, un límite claro. Señales de un caso puntual: un dato sobre este cliente, un cambio solo para este borrador, "esta vez", "aquí".\n' +
    'Devuelve: {"standing": true|false, "rule": "<si es permanente: la preferencia como UNA frase corta en imperativo, general, sin nombres de clientes ni proyectos; si no, cadena vacía>"}';
  try {
    const j = JSON.parse((await ask(system, user, { maxTokens: 200, timeout: 60000 })).replace(/```json|```/g, '').trim());
    return { standing: !!j.standing && !!j.rule, rule: String(j.rule || '').trim() };
  } catch { return null; }
}

/** The block for an agent's system prompt: its standing rules, newest last. */
export function promptText(brainPath, agent) {
  const { rules } = read(brainPath, agent.id); if (!rules.length) return '';
  const recent = rules.slice(-MAX_RULES).map(r => '- ' + r.replace(/^\d{4}-\d{2}-\d{2}\s*·\s*/, '').replace(/\s*←\s*".*$/, ''));
  return 'LESSONS — lo que el dueño corrigió antes. Aplica cada una de estas, siempre, sin que te lo pidan:\n' + recent.join('\n');
}
export const count = (brainPath, id) => read(brainPath, id).rules.length;

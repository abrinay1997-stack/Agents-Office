// Agents Office — lo PURO de cómo se le habla a un agente y de cómo se juzga lo que entrega (sin archivos, sin procesos).
// Lo usan serve.mjs (la oficina local, con `claude -p`) y el Worker de Cloudflare (cloudflare/worker/lib/agentes/): las mismas
// palabras, el mismo reparto de modos (borrador · aprobada · rutina) y la misma regla de cuándo el jefe revisa, en los dos sitios.
// Nada aquí lee ni escribe: recibe lo que necesita y devuelve texto o un veredicto.
import * as approvals from './approvals.mjs';

/** «PASAR A UNA PERSONA:» al principio de lo que entrega un agente: no puede hacerlo, lo tiene que hacer alguien. */
export const HANDOFF = /^\s*(?:\*\*)?PASAR A UNA PERSONA\s*:?\s*(?:\*\*)?\s*/i;

/** Las líneas de modo de una ejecución: borrador (espera el OK del dueño) o aprobada (el paso que envía). */
export const modeLineFor = (mode, task) => mode === 'draft' ? '\nPrepare everything, but send, post, pay or change NOTHING outside this machine: the owner reads this first and approves it. Name every recipient with the exact email address or phone number, and every amount: after the OK the office only lets a send reach the addresses written in this draft. End with one line saying exactly what will go out when approved (or that nothing needs to).'
  : mode === 'approve' ? `\nThe owner has APPROVED the draft below. Carry out the outbound step now, exactly as drafted, with your tools (send, post, update). If a tool you need is not connected, say so and show what you would have sent. Then report in one short section: what went out, to whom, and anything that did not.\nApproved draft:\n${task.draft || task.result}` : '';

/** T1/T3: los pasos que el agente marca, su fecha límite y prioridad, el proyecto (`proyectoDe(id)` → { nombre, objetivo } | null) y, tras un bloqueo, lo que tenía. */
export function pasosLine(task, proyectoDe = () => null) {
  const p = task.pasos || [], bits = [];
  if (p.length) bits.push(`\nSteps (mark each one with the tool marcar_paso as soon as it is done; if one cannot be done, say why in anotar_en_bitacora):\n${p.map((x, i) => `${i + 1}. ${x.hecho ? '[done] ' : ''}${x.texto} (id ${x.id})`).join('\n')}`);
  else if (task.plan?.length) bits.push(`\nAgreed plan: ${task.plan.join(' → ')}`);
  if (task.limite) bits.push(`\nDeadline: ${task.limite.replace('T', ' ')}.`);
  if (task.prioridad === 'alta') bits.push('\nThe owner marked this HIGH priority.');
  if (task.proyecto) { const pr = proyectoDe(task.proyecto); if (pr) bits.push(`\nPart of the project «${pr.nombre}»${pr.objetivo ? ' — goal: ' + pr.objetivo : ''}.`); }
  return bits.join('');
}
export function reanudaLine(task) {
  const b = task.pidioBloqueo; if (!b || !task.partial) return '';
  return `\n\nYou paused this task earlier because: ${b.porque}. That is resolved now. What you had so far:\n${String(task.partial).slice(0, 6000)}\nContinue from there.`;
}

/** Las instrucciones fijas que cierran el encabezado de todo agente (el entregable, las fuentes, la revisión en silencio, pasar a una persona). */
export const instruccionesBase = (words = 260) => 'Escribe el entregable terminado en sí, no una descripción de lo que harías. Texto plano: un encabezado corto, luego secciones cortas o viñetas. ' +
  `Como máximo ${words} palabras, salvo que una skill o las instrucciones del dueño indiquen otra forma — eso prevalece. Sin preámbulo, sin despedida. Apóyalo en las notas de la empresa de abajo; donde falte un dato, haz una suposición razonable y márcala (assumed). ` +
  'Si usaste una herramienta, dilo en una línea al final ("Used: Gmail — searched the client thread"). ' +
  'FUENTES: cada cifra, precio, fecha o dato de un cliente sale de algún lado; al final, una línea «Fuentes:» con las notas (por su nombre) o las páginas que usaste; lo que no tenga fuente va marcado (assumed). ' + // V4.4 (D3)
  'ANTES DE ENTREGAR, revisa tu trabajo en silencio contra las reglas de tu skill, las lecciones y la petición del dueño (¿falta un precio, un nombre, un paso, el tono?) y corrige lo que falle; no muestres la revisión. ' + // V4.4 (D4)
  'Si de verdad no puedes hacerlo (falta un acceso, una decisión del dueño, algo físico o una llamada), empieza tu respuesta con «PASAR A UNA PERSONA:» y di en dos líneas qué hace falta y lo que ya adelantaste.\n\n'; // V4.4 (I6)

/** Las cifras de la empresa que todo agente lee antes de trabajar. */
export const cifrasLine = items => items?.length ? '\n\nTHE COMPANY\'S FIGURES (the owner keeps these up to date — use them exactly; never invent a price, a rate or a goal that is not here or in the notes; if one you need is missing, say so):\n' + items.map(x => `- ${x.name}: ${x.value}${x.unit ? ' ' + x.unit : ''}${x.note ? ' — ' + x.note : ''} (al ${x.updated})`).join('\n') : '';

/** Las lecciones permanentes del agente (feedback/<id>.md → «Standing rules»), las más nuevas al final. */
export function leccionesLine(rules = [], max = 15) {
  if (!rules.length) return '';
  const recent = rules.slice(-max).map(r => '- ' + r.replace(/^\d{4}-\d{2}-\d{2}\s*·\s*/, '').replace(/\s*←\s*".*$/, ''));
  return 'LESSONS — lo que el dueño corrigió antes. Aplica cada una de estas, siempre, sin que te lo pidan:\n' + recent.join('\n');
}

/** Las skills que le tocan a un agente (cada una con el texto ya recortado), como el bloque de su sistema. */
export function skillsLine(skills = []) {
  if (!skills.length) return '';
  return 'SKILLS — how the owner wants this kind of work done. When a task matches a skill, follow it exactly: its steps, its format, its wording rules. Say which skill you followed in one line at the end ("Skill: proposal").\n\n' +
    skills.map(s => `### ${s.name}${s.description ? ' — ' + s.description : ''}\n${s.text}` +
      (s.files || []).map(f => f.text === null ? `\n\n(attached file: ${f.name} — not readable here)` : `\n\n--- ${f.name} ---\n${f.text}`).join('')).join('\n\n');
}

/** Lo que un agente sabe de sí mismo: el trabajo, las instrucciones fijas del dueño, las skills y las lecciones. */
export function agentBrief(a, { skills = [], rules = [] } = {}) {
  const sk = skillsLine(skills), le = leccionesLine(rules);
  return (a.brief ? `\nSTANDING INSTRUCTIONS FROM THE OWNER\n${[].concat(a.brief).join('\n')}\n` : '') + (sk ? `\n${sk}\n` : '') + (le ? `\n${le}\n` : '');
}

/** Cuándo el jefe del departamento revisa antes de que le llegue al dueño (quality.review). `cfgReview`: lo guardado; `amountLimit`: el tope de importes. */
export const REVIEW_DEFAULTS = { enabled: true, departments: ['fin'], words: ['contrato', 'propuesta', 'cotización', 'cotizacion', 'factura', 'presupuesto', 'legal', 'contract', 'proposal', 'invoice'] };
export function needsReview(task, result, { agent, cfgReview = {}, amountLimit = 0 } = {}) {
  const r = { ...REVIEW_DEFAULTS, ...(cfgReview || {}) };
  if (!r.enabled || task.piece || task.team) return false;
  if (!agent || agent.lead) return false;
  const hay = `${task.title} ${task.text}`.toLowerCase();
  return r.departments.includes(task.dept) || r.words.some(w => hay.includes(String(w).toLowerCase())) || approvals.overLimit(result, amountLimit).length > 0;
}
/** El pedido que se le hace al jefe para revisar un borrador: { system, user }. */
export function reviewPrompt({ task, lead, agent, deptName, negocio, result }) {
  return {
    system: `Eres ${lead.name}, jefe de ${deptName} en ${negocio}. Revisas el trabajo de ${agent.name} antes de que llegue al dueño. Devuelve SOLO JSON, sin texto alrededor.`,
    user: `Pedido del dueño: ${task.text}\n\nBorrador de ${agent.name}:\n${result.slice(0, 12000)}\n\nRevisa: datos o cifras sin fuente, importes o cálculos que no cuadran, destinatarios o nombres dudosos, partes del pedido que faltan, promesas que la empresa no puede cumplir, tono.\nDevuelve {"ok": true} si puede ir al dueño tal cual, o {"ok": false, "fixes": ["<corrección concreta>", …]} (máximo 5).`,
  };
}
/** El texto de un JSON con ruido alrededor (``` o prosa) → objeto. Lanza si no hay JSON. */
export function parseJSON(text) {
  const s = String(text).replace(/```json|```/g, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}');
  return JSON.parse(s.slice(a, b + 1));
}

/** Lo que se le dice a TODO agente de las herramientas de Tareas (tareas-tools.mjs), y a los de Contenido (contenido-tools.mjs). */
export const TAREAS_TEXT = '\n- TAREAS (mcp__tareas__*): ver_mi_tarea al empezar (pasos con su id, fecha límite, comentarios del dueño); marcar_paso en cuanto termines cada paso (el dueño ve el avance); anotar_en_bitacora para lo que encontraste o decidiste; ' +
    'pedir_bloqueo si NO puedes seguir sin un dato, una decisión o que otra tarea termine (no lo inventes: tu tarea se para con lo que llevas y sigue sola después); crear_borrador_tarea para pedirle trabajo a otro departamento (nace idea); registrar_trabajo para algo hecho fuera de una tarea. ' +
    'El DUEÑO también tiene su propia lista de tareas: las que ver_tareas marca «DEL DUEÑO» las hace él en persona — no las ejecutes, no las repitas ni las cambies; si tu trabajo depende de una, pide_bloqueo con su id. Si algo solo lo puede hacer o decidir él y no te bloquea (una llamada, una firma, un precio), sugerir_al_dueno se lo deja en su Bandeja. ' + // plan D (7 oct 2026)
    'Nada de esto aprueba ni envía.';
export const CONTENIDO_TEXT = '\n- CONTENIDO (mcp__contenido__*): el calendario de lo que se va a publicar en Instagram y Facebook. ver_calendario_contenido y ver_pieza LEEN lo que hay (míralo antes de proponer, para no repetir ni pisar); crear_borrador deja una pieza como BORRADOR con su día, hora, formato, redes, texto y las imágenes del Estudio (pasa sus ids en `medios`); mejorar_borrador corrige un borrador tuyo. ' +
    'Tú NO apruebas, NO programas y NO publicas: el dueño revisa cada borrador y lo aprueba en Contenido, y solo lo aprobado sale. Escribe el texto completo y listo para salir, con la voz de la marca (sus notas del cerebro). Para una imagen, genérala primero con el Estudio y usa su id. Termina tu entregable diciendo qué borradores dejaste y para qué días.';

/** Ask Claude whether a correction is a one-off or a standing rule. `ask(system, user)` → text. */
export async function clasificarCorreccion(ask, agent, task, feedback) {
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


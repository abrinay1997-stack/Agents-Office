// Agents Office — the agents' safety rules (V4.4, 25 Sep 2026). Pure functions: guard.mjs applies them on every tool call
// an agent makes (a Claude Code hook, so the rule is a lock, not a line in the prompt), serve.mjs decides each run's policy,
// and tests/safety.test.mjs proves them.
//
// office.config.json → "safety":
//   writes         "aprobar" (default) — nothing goes out (send, post, pay, delete, change) except in the run after the owner's OK
//                  "pedido"            — as before V4.4: a task may send when its text asks for it; a draft waiting for the OK never can
//                  "nunca"             — the agents never send: they prepare, the owner does it
//   departments    { "fin": "nunca" }    the same, per department (wins over `writes`)
//   browserSites   ["*.google.com"]      sites the agents' Chrome may open; empty = any site not in browserBlock
//   browserBlock   ["*.bank.com"]        sites it may never open
//   limits         { perAgentDay: 40, perRecipientDay: 5 }   outbound actions a day, per desk and per address; 0 = no cap
//   safeTools      ["draft"]             words in a tool's name that make it not outbound (a Gmail draft sends nothing)
//   injection      true                  a page or an email that gives the agent orders stops every send for the rest of that run
//   checkRecipients true                  after the OK, a send may only go to addresses and numbers that are in the approved draft

export const WRITE_MODES = ['aprobar', 'pedido', 'nunca'];
export const DEFAULTS = { writes: 'aprobar', departments: {}, browserSites: [], browserBlock: [], limits: { perAgentDay: 40, perRecipientDay: 5 }, safeTools: ['draft', 'borrador'], injection: true, checkRecipients: true };

export function normalize(s = {}) {
  const o = { ...DEFAULTS, ...s, limits: { ...DEFAULTS.limits, ...(s.limits || {}) } };
  if (!WRITE_MODES.includes(o.writes)) o.writes = DEFAULTS.writes;
  o.departments = Object.fromEntries(Object.entries(o.departments || {}).filter(([, v]) => WRITE_MODES.includes(v)));
  for (const k of ['browserSites', 'browserBlock', 'safeTools']) o[k] = Array.isArray(o[k]) ? o[k].map(String).filter(Boolean) : DEFAULTS[k];
  return o;
}
/** Problems in plain words, for `npm run check`. */
export function problems(s = {}) {
  const out = [];
  if (s.writes !== undefined && !WRITE_MODES.includes(s.writes)) out.push(`safety.writes «${s.writes}» no existe: usa ${WRITE_MODES.join(', ')}`);
  for (const [d, v] of Object.entries(s.departments || {})) if (!WRITE_MODES.includes(v)) out.push(`safety.departments.${d} «${v}» no existe: usa ${WRITE_MODES.join(', ')}`);
  for (const k of ['browserSites', 'browserBlock', 'safeTools']) if (s[k] !== undefined && !Array.isArray(s[k])) out.push(`safety.${k} debe ser una lista`);
  return out;
}
export const modeFor = (s, dept) => normalize(s).departments[dept] || normalize(s).writes;

/** May this run send? runMode: 'task' (a task that does not wait for the OK) · 'draft' (waits for the OK) · 'approve' (the run after the OK) · 'piece' (a teammate's part) · 'chat' (the owner, typing) · 'autonomous' (a routine that earned it). */
export function writesAllowed(mode, runMode) {
  if (mode === 'nunca' || runMode === 'draft' || runMode === 'piece') return false;
  if (runMode === 'approve' || runMode === 'chat' || runMode === 'autonomous') return true; // autonomous: a routine the owner freed after N clean approvals (approvals.earnedAutonomy)
  return mode === 'pedido';
}

/* ---------- which tools send ---------- */
const WRITE_VERBS = new Set(['send', 'reply', 'forward', 'post', 'publish', 'create', 'update', 'edit', 'modify', 'patch', 'put', 'delete', 'remove', 'trash', 'archive', 'move', 'pay', 'charge', 'refund', 'transfer', 'payout', 'book', 'schedule', 'cancel', 'invite', 'share', 'upload', 'write', 'insert', 'append', 'set', 'add', 'assign', 'approve', 'submit', 'execute', 'run', 'merge', 'push', 'comment', 'like', 'follow', 'unfollow', 'subscribe', 'unsubscribe', 'import', 'rename', 'label', 'mark', 'void', 'issue', 'dispatch', 'enviar', 'publicar', 'crear', 'borrar', 'eliminar', 'pagar', 'actualizar']);
const READ_VERBS = new Set(['get', 'list', 'search', 'read', 'fetch', 'find', 'query', 'describe', 'lookup', 'view', 'show', 'check', 'count', 'download', 'retrieve', 'preview', 'status', 'buscar', 'leer', 'listar', 'ver']);
const CHROME_WRITE = new Set(['form_input', 'computer', 'javascript_tool', 'upload_image', 'file_upload']);
const INTERNAL = new Set(['estudio']); // the office's own Estudio: it makes files on this machine, nothing leaves
export function splitTool(name) {
  const m = /^mcp__(.+?)__(.+)$/.exec(String(name)); return m ? { server: m[1], tool: m[2] } : { server: '', tool: String(name) };
}
const words = t => String(t).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/** 'write' when the tool can change something outside this machine, else 'read'. */
export function kindOf(name, safeTools = DEFAULTS.safeTools) {
  const { server, tool } = splitTool(name);
  if (!server) return 'read'; // WebSearch, WebFetch — the office never gives an agent Bash or file tools
  if (INTERNAL.has(server)) return 'read';
  if (server === 'claude-in-chrome') return CHROME_WRITE.has(tool) ? 'write' : 'read';
  const w = words(tool);
  if (safeTools.some(s => w.includes(String(s).toLowerCase()))) return 'read';
  for (const x of w) { if (READ_VERBS.has(x)) return 'read'; if (WRITE_VERBS.has(x)) return 'write'; } // the first verb decides: get_schedule reads, schedule_post writes
  return 'read';
}

/* ---------- who a send reaches ---------- */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const digits = s => String(s).replace(/\D/g, '');
export function targetsOf(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input || {});
  const emails = [...new Set((s.match(EMAIL) || []).map(e => e.toLowerCase()))];
  const phones = [...new Set((s.match(PHONE) || []).map(digits).filter(d => d.length >= 8 && d.length <= 15))];
  return { emails, phones };
}
/** The addresses and numbers of a send that the approved text does not name. */
export function unknownTargets(targets, knownText) {
  const k = String(knownText || '').toLowerCase(), kd = digits(knownText || '');
  return [...targets.emails.filter(e => !k.includes(e)), ...targets.phones.filter(p => !kd.includes(p) && !kd.includes(p.slice(-8)))]; // +507 6123-4567 and 61234567 are the same number
}

/* ---------- amounts of money (V4.4, G9): a send over the owner's limit needs the OK ---------- */
const AMOUNT = /(?:US\$|USD|B\/\.|\$|€|EUR)\s?(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(?:US\$|USD|dólares|dolares|balboas|euros|€)/gi;
const num = s => { let t = String(s).replace(/\s/g, ''); if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, ''); const n = parseFloat(t); return Number.isFinite(n) ? n : 0; };
/** Every amount of money written in a text: [12.5, 1200]. */
export function amountsIn(text) {
  const s = typeof text === 'string' ? text : JSON.stringify(text || '');
  return [...s.matchAll(AMOUNT)].map(m => num(m[1] || m[2])).filter(n => n > 0);
}
/* ---------- orders hidden in what an agent reads (prompt injection) ---------- */
const INJECTION = [
  [/\b(ignore|disregard|forget)\b.{0,30}\b(previous|prior|above|earlier|all)\b.{0,20}\b(instructions?|prompts?|rules?)\b/i, 'pide ignorar las instrucciones'],
  [/\b(ignora|olvida|omite)\b.{0,30}\b(las |tus |todas )?(instrucciones|reglas|indicaciones)\b/i, 'pide ignorar las instrucciones'],
  [/\b(new|updated|nuevas?)\s+(system\s+)?(instructions?|instrucciones)\s*[:：]/i, 'trae «nuevas instrucciones»'],
  [/<\s*\/?\s*(system|instructions?|assistant)\s*>/i, 'imita un mensaje del sistema'],
  [/\b(you are now|from now on,? you|a partir de ahora (eres|debes))\b/i, 'intenta cambiar el papel del agente'],
  [/\b(ai|ia|assistant|asistente|agent|agente|claude|gpt)\b\s*[,:]\s*(please\s+|por favor\s+)?(send|forward|delete|transfer|pay|email|reenv[ií]a|env[ií]a|borra|elimina|transfiere|paga)\b/i, 'le da órdenes directas a la IA'],
  [/\b(forward|send|reenv[ií]a|env[ií]a|exporta|export)\b.{0,50}\b(all|every|todos|todas|cada)\b.{0,40}\b(emails?|correos|messages|mensajes|contacts|contactos|files|archivos|passwords?|contraseñas|invoices|facturas)\b/i, 'pide sacar datos en bloque'],
  [/\b(do not|don't|never|no)\s+(tell|inform|mention|notify|le digas|avises|menciones|informes)\b.{0,40}\b(user|owner|human|dueño|usuario|jefe)\b/i, 'pide ocultarle algo al dueño'],
];
export function injectionIn(text) {
  const s = String(text || '').slice(0, 200000);
  for (const [re, why] of INJECTION) if (re.test(s)) return why;
  return null;
}

/* ---------- which sites the agents' Chrome may open ---------- */
const hostOf = u => { try { return new URL(/^[a-z]+:\/\//i.test(u) ? u : 'https://' + u).hostname.toLowerCase(); } catch { return ''; } };
const hostMatch = (host, pat) => { const p = String(pat).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); return p.startsWith('*.') ? host === p.slice(2) || host.endsWith(p.slice(1)) : host === p || host.endsWith('.' + p); };
export function siteAllowed(url, allow = [], block = []) {
  const h = hostOf(url); if (!h) return { ok: false, why: 'dirección no válida' };
  if (block.some(p => hostMatch(h, p))) return { ok: false, why: `${h} está en la lista de sitios prohibidos` };
  if (allow.length && !allow.some(p => hostMatch(h, p))) return { ok: false, why: `${h} no está en la lista de sitios permitidos` };
  return { ok: true };
}
export const urlOf = input => input && (input.url || input.href || input.link || '');

/**
 * The decision for one tool call. ctx: { writes, known, safety, tainted, counts: { agentToday, byTarget: { addr: n } } }
 * → { allow: true, kind } or { allow: false, kind, why } (the why is what the agent reads and the owner sees).
 */
export function decide(toolName, input, ctx) {
  const s = normalize(ctx.safety), kind = kindOf(toolName, s.safeTools), { server, tool } = splitTool(toolName);
  if (server === 'claude-in-chrome' && (tool === 'navigate' || tool === 'tabs_create')) {
    const u = urlOf(input); if (u) { const r = siteAllowed(u, s.browserSites, s.browserBlock); if (!r.ok) return { allow: false, kind, code: 'site', why: `Sitio bloqueado: ${r.why}. Trabaja sin él y dilo en tu entrega.` }; }
  }
  if (kind !== 'write') return { allow: true, kind };
  if (!ctx.writes) return { allow: false, kind, code: 'no-writes', why: 'Bloqueado: en esta ejecución no se envía, publica, paga ni cambia nada fuera de la oficina. Prepara el borrador completo (destinatario, asunto, texto, importe) y el dueño lo aprobará.' };
  if (s.injection && ctx.tainted) return { allow: false, kind, code: 'taint', why: `Bloqueado: algo que leíste en esta ejecución parece traer órdenes escondidas (${ctx.tainted}). No se envía nada; explica en tu entrega qué ibas a hacer.` };
  if (ctx.runMode !== 'approve' && ctx.amountLimit > 0) { const over = amountsIn(input).filter(n => n > ctx.amountLimit); if (over.length) return { allow: false, kind, code: 'amount', why: `Bloqueado: ${over.map(n => '$' + n).join(', ')} pasa del límite de $${ctx.amountLimit} que el dueño aprueba siempre. Deja el borrador listo para su visto bueno.` }; }
  const t = targetsOf(input);
  if (s.checkRecipients && ctx.known !== undefined && ctx.known !== null) {
    const unknown = unknownTargets(t, ctx.known);
    if (unknown.length) return { allow: false, kind, code: 'recipient', why: `Bloqueado: ${unknown.join(', ')} no está en lo que aprobó el dueño. Solo se envía a quien aparece en el borrador aprobado.` };
  }
  const L = s.limits || {}, c = ctx.counts || {};
  if (L.perAgentDay > 0 && (c.agentToday || 0) >= L.perAgentDay) return { allow: false, kind, code: 'cap-agent', why: `Bloqueado: este agente ya hizo ${c.agentToday} envíos o cambios hoy (tope ${L.perAgentDay}).` };
  if (L.perRecipientDay > 0) for (const a of [...t.emails, ...t.phones]) if ((c.byTarget?.[a] || 0) >= L.perRecipientDay) return { allow: false, kind, code: 'cap-target', why: `Bloqueado: ${a} ya recibió ${c.byTarget[a]} envíos hoy (tope ${L.perRecipientDay}).` };
  return { allow: true, kind, targets: t };
}

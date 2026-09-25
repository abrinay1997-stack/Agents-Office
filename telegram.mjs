// Agents Office — Dimitri on Telegram (V4.4, 25 Sep 2026; audit F1, F2, F6, F9, E3).
// The owner talks to the office from the phone: every approval arrives with ✅ Aprobar / ↩ Devolver buttons, failures and
// the office's notices arrive as messages, quiet hours hold what is not urgent, and any other text goes to Dimitri.
//
// SECRETS LIVE ONLY IN ENVIRONMENT VARIABLES (never in a file, never in the repository):
//   TELEGRAM_BOT_TOKEN   the bot's token from @BotFather            → setx TELEGRAM_BOT_TOKEN "123456789:AA…"
//   TELEGRAM_OWNER_ID    who may use it: your numeric Telegram id    → setx TELEGRAM_OWNER_ID "123456789"  (several: "1,2")
// Anyone else who writes to the bot is refused (and told their id, so the owner can add them on purpose).
// office.config.json → "telegram": { "quiet": { "from": "21:00", "to": "07:00" }, "notify": { "approvals": true, "failures": true, "done": false, "notices": true } }
//
// It polls Telegram (getUpdates): nothing is exposed, it works from the owner's own PC with no public address. Every action
// goes through the office's own local API, so the same rules apply as in the page (the guard, the approvals, the logs).
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'; // tests point it at a local fake
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const owners = (env = process.env) => String(env.TELEGRAM_OWNER_ID || '').split(/[\s,;]+/).map(s => s.trim()).filter(s => /^-?\d+$/.test(s));
export const configured = (env = process.env) => /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(String(env.TELEGRAM_BOT_TOKEN || '').trim()) && owners(env).length > 0;
export const allowed = (id, list) => list.includes(String(id));

const toMin = hm => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '')); return m ? +m[1] * 60 + +m[2] : null; };
/** Inside the quiet hours? quiet: { from: "21:00", to: "07:00" } (may cross midnight). */
export function isQuiet(quiet, d = new Date()) {
  const f = toMin(quiet?.from), t = toMin(quiet?.to); if (f === null || t === null || f === t) return false;
  const n = d.getHours() * 60 + d.getMinutes();
  return f < t ? n >= f && n < t : n >= f || n < t;
}
/** What a message from the owner asks for. */
export function parseCommand(text) {
  const t = String(text || '').trim();
  const m = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/.exec(t);
  if (!m) return { cmd: 'dimitri', arg: t };
  const cmd = m[1].toLowerCase(), arg = m[2].trim();
  const alias = { start: 'ayuda', help: 'ayuda', ayuda: 'ayuda', estado: 'estado', status: 'estado', pendientes: 'pendientes', aprobaciones: 'pendientes', tarea: 'tarea', task: 'tarea', silencio: 'silencio', quiet: 'silencio', id: 'id' };
  return { cmd: alias[cmd] || 'desconocido', arg };
}
const DEPT_WORDS = { emails: ['correos', 'emails', 'correo'], sales: ['ventas', 'sales'], marketing: ['marketing', 'mercadeo'], ops: ['operaciones', 'ops'], fin: ['finanzas', 'contabilidad', 'fin'], delivery: ['entregas', 'delivery'] };
/** «/tarea ventas: llama a Sol» → { dept: 'sales', text: 'llama a Sol' } */
export function parseTask(arg) {
  const m = /^([a-záéíóúñ]+)\s*[:,-]\s*([\s\S]+)$/i.exec(String(arg || '').trim()); if (!m) return null;
  const w = m[1].toLowerCase(); const dept = Object.keys(DEPT_WORDS).find(k => DEPT_WORDS[k].includes(w)); return dept ? { dept, text: m[2].trim() } : null;
}
/** Split a long text into Telegram-sized pieces (4096 max), on line breaks where possible. */
export function chunks(text, max = 3900) {
  const out = []; let s = String(text || '');
  while (s.length > max) { let i = s.lastIndexOf('\n', max); if (i < max * 0.5) i = max; out.push(s.slice(0, i)); s = s.slice(i).replace(/^\n/, ''); }
  if (s) out.push(s); return out;
}
export function approvalText(t, agentName, deptName) {
  const draft = String(t.draft || t.result || '').trim();
  return `⚠ <b>Espera tu visto bueno</b>\n<b>${esc(t.title)}</b>\n${esc(agentName)} · ${esc(deptName)}${previewText(t)}${t.heldForOk ? '\n🛡 El agente quiso enviarlo sin tu OK; la oficina lo detuvo.' : ''}\n\n${esc(draft.slice(0, 1400))}${draft.length > 1400 ? '\n…' : ''}`;
}
export function previewText(t) { // V4.4 (G3): what will go out, as a card
  const p = t.preview || {}; const bits = [];
  if (p.channel) bits.push('📨 ' + esc(p.channel)); if (p.to?.length) bits.push('Para: ' + esc(p.to.join(', '))); if (p.phones?.length) bits.push('Tel: ' + esc(p.phones.join(', ')));
  if (p.subject) bits.push('Asunto: ' + esc(p.subject)); if (p.amounts?.length) bits.push('Importes: ' + p.amounts.map(n => '$' + n).join(', ')); if (p.attachments?.length) bits.push('Adjuntos: ' + esc(p.attachments.join(', ')));
  const r = t.risk ? { alto: '🔴 riesgo alto', medio: '🟡 riesgo medio', bajo: '🟢 riesgo bajo' }[t.risk] : '';
  return bits.length || r ? `\n${[r, ...bits].filter(Boolean).join('\n')}` : '';
}
export const approvalButtons = id => ({ inline_keyboard: [[{ text: '✅ Aprobar y enviar', callback_data: 'ap:' + id }, { text: '↩ Devolver', callback_data: 'rj:' + id }], [{ text: '👁 Ver completo', callback_data: 'vw:' + id }]] });

export function start({ port, cfg, dataDir, onTask, onNotice, log = console }) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim(), who = owners();
  if (!configured()) return null;
  const tg = { ...(cfg.telegram || {}) }, notify = { approvals: true, failures: true, done: false, notices: true, ...(tg.notify || {}) };
  // V4.4 (G5): people who may approve for some departments only — office.config.local.json → telegram.approvers { "<id>": ["emails", "sales"] }
  const approvers = Object.fromEntries(Object.entries(tg.approvers || {}).filter(([id, d]) => /^-?\d+$/.test(id) && Array.isArray(d)).map(([id, d]) => [String(id), d.map(String)]));
  const isOwner = id => allowed(id, who), canApprove = (id, dept) => isOwner(id) || (approvers[String(id)] || []).includes(dept);
  const stateFile = path.join(dataDir, 'telegram.json');
  let st = { offset: 0, pendingReject: {}, held: [], snoozeUntil: 0 }; try { st = { ...st, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; } catch {}
  const saveSt = () => { try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(stateFile + '.tmp', JSON.stringify(st)); fs.renameSync(stateFile + '.tmp', stateFile); } catch {} };
  const local = async (method, p, body, by) => { const r = await fetch(`http://127.0.0.1:${port}${p}`, { method, headers: { 'content-type': 'application/json', ...(by ? { 'x-office-by': by } : {}) }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };
  const call = async (m, body) => { const r = await fetch(`${process.env.TELEGRAM_API_BASE || API}/bot${token}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.description || 'Telegram ' + r.status); return j.result; };
  const send = async (chat, text, extra = {}) => { for (const c of chunks(text)) await call('sendMessage', { chat_id: chat, text: c, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }).catch(e => log.warn('telegram:', e.message)); };
  const toOwners = (text, extra, { urgent = false } = {}) => {
    if (!urgent && (isQuiet(tg.quiet) || Date.now() < (st.snoozeUntil || 0))) { st.held.push({ text, extra, t: Date.now() }); st.held = st.held.slice(-60); saveSt(); return; } // F6: kept for when the quiet ends
    for (const id of who) send(id, text, extra);
  };
  const flushHeld = () => {
    if (!st.held.length || isQuiet(tg.quiet) || Date.now() < (st.snoozeUntil || 0)) return;
    const held = st.held; st.held = []; saveSt();
    for (const id of who) send(id, `🌅 <b>Mientras no molestaba</b>: ${held.length} ${held.length === 1 ? 'mensaje' : 'mensajes'}.`);
    for (const h of held) for (const id of who) send(id, h.text, h.extra);
  };
  const flushTimer = setInterval(flushHeld, 60000);

  // the office tells us: a task changed, a notice was raised
  onTask(t => {
    if (!t || t.piece) return;
    const name = t.agentName || t.agent, dept = t.deptName || t.dept;
    if (t.state === 'waiting' && notify.approvals) { toOwners(approvalText(t, name, dept), { reply_markup: approvalButtons(t.id) }); for (const [id, ds] of Object.entries(approvers)) if (ds.includes(t.dept) && !who.includes(id)) send(id, approvalText(t, name, dept), { reply_markup: approvalButtons(t.id) }); }
    else if (t.state === 'done' && t.error && !t.stopped && notify.failures) toOwners(`✗ <b>Falló</b> «${esc(t.title)}» (${esc(name)})\n${esc(String(t.result || '').slice(0, 600))}`, { reply_markup: { inline_keyboard: [[{ text: '↻ Reintentar', callback_data: 'rp:' + t.id }]] } }, { urgent: t.errorKind === 'login' });
    else if (t.state === 'done' && !t.error && notify.done) toOwners(`✓ <b>Lista</b> «${esc(t.title)}» (${esc(name)})\n${esc(String(t.result || '').slice(0, 700))}`);
  });
  onNotice(n => { if (notify.notices && !['failed'].includes(n.kind)) toOwners(`${n.level === 'error' ? '🛑' : n.level === 'warn' ? '⚠' : 'ℹ'} ${esc(n.text)}`, {}, { urgent: n.level === 'error' }); });

  async function handleText(chat, text) {
    if (st.pendingReject[chat]) { // the note for a «↩ Devolver»
      const pr = st.pendingReject[chat], id = typeof pr === 'string' ? pr : pr.id, rby = typeof pr === 'string' ? 'telegram' : pr.by; delete st.pendingReject[chat]; saveSt();
      try { await local('POST', `/api/tasks/${id}/reject`, { feedback: text }, rby); await send(chat, '↩ Devuelta con tu nota. El agente la rehace y te llega de nuevo.'); } catch (e) { await send(chat, '✗ ' + esc(e.message)); }
      return;
    }
    const { cmd, arg } = parseCommand(text);
    if (cmd === 'ayuda') return send(chat, `Hola, soy <b>${esc(cfg.deputy?.name || 'Dimitri')}</b>, desde tu oficina ${esc(cfg.name || '')}.\n\nEscríbeme lo que necesites, como en la oficina.\n/estado · cómo va la oficina\n/pendientes · lo que espera tu visto bueno\n/tarea ventas: … · una tarea para un departamento\n/silencio 2 · no molestar durante 2 horas (sin número: vuelve a avisar)\n\nLas aprobaciones te llegan con botones.`);
    if (cmd === 'id') return send(chat, `Tu id de Telegram: <code>${esc(chat)}</code>`);
    if (cmd === 'estado') { const s = await local('GET', '/api/status'); const mark = { ok: '🟢', info: '⚪', warn: '🟡', bad: '🔴' }; return send(chat, `<b>Estado de la oficina</b>\n` + s.checks.map(c => `${mark[c.state]} <b>${esc(c.label)}</b>: ${esc(c.detail)}${c.fix ? '\n   → ' + esc(c.fix) : ''}`).join('\n')); }
    if (cmd === 'pendientes') {
      const list = (await local('GET', '/api/tasks')).filter(t => t.state === 'waiting' && !t.archived);
      if (!list.length) return send(chat, 'Nada espera tu visto bueno. ✓');
      await send(chat, `${list.length} ${list.length === 1 ? 'espera' : 'esperan'} tu visto bueno:`);
      for (const t of list.slice(0, 10)) await send(chat, approvalText(t, t.agent, t.dept), { reply_markup: approvalButtons(t.id) });
      return;
    }
    if (cmd === 'tarea') {
      const p = parseTask(arg); if (!p) return send(chat, 'Así: <code>/tarea ventas: prepara la propuesta para Sol</code> (correos, ventas, marketing, operaciones, finanzas, entregas).');
      const r = await local('POST', '/api/tasks', { dept: p.dept, text: p.text }); return send(chat, `➕ Tarea para ${esc(p.dept)}: «${esc(r.title || p.text)}».`);
    }
    if (cmd === 'silencio') { const h = Math.max(0, Math.min(24, +arg || 0)); st.snoozeUntil = h ? Date.now() + h * 3600e3 : 0; saveSt(); if (!h) flushHeld(); return send(chat, h ? `🔕 Sin avisos durante ${h} h (salvo lo urgente).` : '🔔 Avisos activados.'); }
    if (cmd === 'desconocido') return send(chat, 'No conozco ese comando. /ayuda');
    // anything else: Dimitri (E3)
    await call('sendChatAction', { chat_id: chat, action: 'typing' }).catch(() => {});
    const r = await local('POST', '/api/sub/chat', { text: arg });
    const m = (r.messages || []).find(x => x.who === 'sub') || {};
    const pieces = (m.plan?.tasks || []).filter(t => t.state === 'proposed');
    const body = esc(m.text || '…') + (pieces.length ? '\n\n' + pieces.map((t, i) => `${i + 1}. <b>${esc(t.title)}</b> → ${esc(t.dept)}${t.team ? ' (equipo)' : ''}`).join('\n') : '') + (m.plan?.questions?.length ? '\n\n' + m.plan.questions.map(q => '❓ ' + esc(q)).join('\n') : '');
    return send(chat, body, pieces.length ? { reply_markup: { inline_keyboard: [[{ text: `📤 Enviar ${pieces.length === 1 ? 'la pieza' : 'las ' + pieces.length + ' piezas'} a los jefes`, callback_data: 'sd:' + m.id }]] } } : {});
  }
  async function handleCallback(q) {
    const chat = String(q.message?.chat?.id || q.from.id), [k, id] = String(q.data || '').split(':');
    const by = 'telegram: ' + (q.from.first_name || q.from.username || q.from.id) + (isOwner(q.from.id) ? '' : ' (aprobador)');
    if (!isOwner(q.from.id)) { // an approver: only the approval buttons, only for their departments
      const t = ['ap', 'rj', 'vw', 'ud'].includes(k) ? (await local('GET', '/api/tasks').catch(() => [])).find(x => x.id === id) : null;
      if (!t || !canApprove(q.from.id, t.dept)) { await call('answerCallbackQuery', { callback_query_id: q.id, text: 'No tienes permiso para eso' }).catch(() => {}); return; }
    }
    const done = txt => call('answerCallbackQuery', { callback_query_id: q.id, text: txt }).catch(() => {});
    const strip = () => call('editMessageReplyMarkup', { chat_id: chat, message_id: q.message?.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    try {
      if (k === 'ap') { const r = await local('POST', `/api/tasks/${id}/approve`, {}, by); await strip(); await done('Aprobada'); return r.sendAt ? send(chat, `✅ Aprobada: sale en ${r.undoSeconds} s.`, { reply_markup: { inline_keyboard: [[{ text: '↶ Deshacer', callback_data: 'ud:' + id }]] } }) : send(chat, '✅ Aprobada: el agente la envía ahora. Te aviso si algo falla.'); }
      if (k === 'ud') { await local('POST', `/api/tasks/${id}/undo`, {}, by); await strip(); await done('Deshecho'); return send(chat, '↶ Deshecho: no se envió nada. Sigue esperando tu visto bueno.', { reply_markup: approvalButtons(id) }); }
      if (k === 'rj') { st.pendingReject[chat] = { id, by }; saveSt(); await done(''); return send(chat, '↩ ¿Qué debe cambiar? Escríbelo en tu próximo mensaje.', { reply_markup: { force_reply: true } }); }
      if (k === 'vw') { const t = (await local('GET', '/api/tasks')).find(x => x.id === id); local('POST', `/api/tasks/${id}/seen`, {}).catch(() => {}); await done(''); return send(chat, t ? esc(t.draft || t.result || '') : 'Esa tarea ya no existe.'); }
      if (k === 'rp') { await local('POST', `/api/tasks/${id}/repeat`); await strip(); await done('Otra vez'); return send(chat, '↻ Va de nuevo a la cola.'); }
      if (k === 'sd') { const r = await local('POST', '/api/sub/send', { msg: id }); await strip(); await done('Enviado'); return send(chat, `📤 Enviado a los jefes${r.tasks?.filter(Boolean).length ? ': ' + r.tasks.filter(Boolean).length + ' tarea(s)' : ''}.`); }
      await done('');
    } catch (e) { await done('No se pudo'); return send(chat, '✗ ' + esc(e.message)); }
  }
  const refused = new Map();
  let stopped = false;
  async function loop() {
    while (!stopped) {
      try {
        const ups = await call('getUpdates', { offset: st.offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
        for (const u of ups) {
          st.offset = u.update_id + 1; saveSt();
          const from = u.message?.from?.id ?? u.callback_query?.from?.id, chat = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
          if (!allowed(from, who) && approvers[String(from)]) { // V4.4 (G5): an approver — approval buttons and /pendientes for their departments, nothing else
            if (u.callback_query) await handleCallback(u.callback_query);
            else if (u.message?.text && st.pendingReject[String(chat)]) await handleText(String(chat), u.message.text);
            else if (u.message?.text) { const { cmd } = parseCommand(u.message.text); if (cmd === 'pendientes') { const list = (await local('GET', '/api/tasks')).filter(t => t.state === 'waiting' && !t.archived && canApprove(from, t.dept)); if (!list.length) await send(chat, 'Nada de tus departamentos espera visto bueno. ✓'); for (const t of list.slice(0, 10)) await send(chat, approvalText(t, t.agent, t.dept), { reply_markup: approvalButtons(t.id) }); } else await send(chat, 'Puedes aprobar o devolver lo de tus departamentos con los botones, y ver lo pendiente con /pendientes.'); }
            continue;
          }
          if (!allowed(from, who)) { // a stranger: refused, told their id once a day, and the owner hears about it
            if (Date.now() - (refused.get(from) || 0) > 864e5) { refused.set(from, Date.now()); send(chat, `Este bot es privado. Tu id es <code>${esc(from)}</code>; si el dueño quiere darte acceso, lo añade a TELEGRAM_OWNER_ID.`); log.warn(`telegram: refused user ${from}`); }
            continue;
          }
          if (u.callback_query) await handleCallback(u.callback_query);
          else if (u.message?.text) await handleText(String(chat), u.message.text).catch(e => send(chat, '✗ ' + esc(e.message)));
        }
      } catch (e) { if (stopped) break; log.warn('telegram:', e.message); await new Promise(r => setTimeout(r, +process.env.TELEGRAM_RETRY_MS || 15000)); }
    }
  }
  call('setMyCommands', { commands: [{ command: 'estado', description: 'Cómo va la oficina' }, { command: 'pendientes', description: 'Lo que espera tu visto bueno' }, { command: 'tarea', description: 'ventas: … — una tarea' }, { command: 'silencio', description: 'No molestar N horas' }, { command: 'ayuda', description: 'Qué puedo hacer' }] }).catch(() => {});
  loop();
  return { owners: who.length, send: text => toOwners(text), sendTo: (id, text) => send(String(id), esc(text)), stop: () => { stopped = true; clearInterval(flushTimer); } };
}

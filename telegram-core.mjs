// @ts-check
// Agents Office — Dimitri on Telegram (V4.4, 25 Sep 2026; audit F1, F2, F6, F9, E3).
// The owner talks to the office from the phone: every approval arrives with ✅ Aprobar / ↩ Devolver buttons, failures and
// the office's notices arrive as messages, quiet hours hold what is not urgent, and any other text goes to Dimitri.
//
// SECRETS LIVE ONLY IN ENVIRONMENT VARIABLES (never in a file, never in the repository):
//   TELEGRAM_BOT_TOKEN   the bot's token from @BotFather            → setx TELEGRAM_BOT_TOKEN "123456789:AA…"
//   TELEGRAM_OWNER_ID    who may use it: your numeric Telegram id    → setx TELEGRAM_OWNER_ID "123456789"  (several: "1,2")
// Anyone else who writes to the bot is refused (and told their id, so the owner can add them on purpose).
// office.config.json → "telegram": { "quiet": { "from": "21:00", "to": "07:00" }, "notify": { "approvals": true, "failures": true, "done": false, "notices": true, "comentarios": true, "mensajes": true } }
//
// (telegram-core.mjs: lo puro y el cerebro del bot —los comandos y los botones—, para que lo usen la oficina local y el Worker de Cloudflare.
//  telegram.mjs solo pone el sondeo de getUpdates y los archivos de esta computadora.)
// It polls Telegram (getUpdates): nothing is exposed, it works from the owner's own PC with no public address. Every action
// goes through the office's own local API, so the same rules apply as in the page (the guard, the approvals, the logs).
import { leerRapida } from './tareas/rapida.mjs'; // plan D: «/yo llamar al banco el viernes»
import { NOMBRE_RED } from './contenido/piezas-core.mjs'; // C3 (8 oct 2026): las piezas de Contenido, con su foto, para aprobarlas desde el teléfono

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
  const alias = { start: 'ayuda', help: 'ayuda', ayuda: 'ayuda', estado: 'estado', status: 'estado', pendientes: 'pendientes', aprobaciones: 'pendientes', tarea: 'tarea', task: 'tarea', silencio: 'silencio', quiet: 'silencio', id: 'id',
    mias: 'mias', mías: 'mias', hoy: 'mias', yo: 'yo', mia: 'yo', mía: 'yo', // plan D (7 oct 2026): tus tareas
    contenido: 'contenido', piezas: 'contenido', redes: 'contenido', // C3 (8 oct 2026): lo de Contenido que espera tu OK
    anuncios: 'anuncios', publicidad: 'anuncios', ads: 'anuncios' }; // Fase A2 (9 oct 2026): los anuncios de Meta, con ⏸ Pausar
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
/* ---------- C3 (8 oct 2026): una pieza de Contenido, para aprobarla desde el teléfono con su vista previa ---------- */
const FORMATO_TG = { post: 'post', reel: 'reel', carrusel: 'carrusel', historia: 'historia' };
const DOW_TG = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MES_TG = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaTG = f => { const d = new Date(`${f}T12:00:00`); return Number.isNaN(d.getTime()) ? f : `${DOW_TG[d.getDay()]} ${d.getDate()} ${MES_TG[d.getMonth()]}`; };
/** ¿Puede salir ya con un clic? (en revisión o borrador, sin lo que le falta, con día y hora que no pasaron) */
export const piezaLista = (p, ahora = Date.now()) => ['revision', 'borrador'].includes(p?.estado) && !(p.revision?.errores || []).length && !!p.fecha && !!p.hora && new Date(`${p.fecha}T${p.hora}:00`).getTime() > ahora + 60e3;
/** El pie de foto (HTML, ≤ 1024 caracteres: el tope de Telegram para una foto). */
export function piezaTexto(p, { nombreAgente = id => id, motivo = '' } = {}) {
  const redes = (p.redes || []).map(r => `${NOMBRE_RED[r] || r}${p.formatos?.[r] ? ` (${FORMATO_TG[p.formatos[r]] || p.formatos[r]})` : ''}`).join(' y ');
  const quien = String(p.origen || '').startsWith('agente:') ? ` · de ${esc(nombreAgente(p.origen.slice(7)) || 'un agente')}` : String(p.origen || '').startsWith('vuelve:') ? ' · vuelve (ya funcionó)' : '';
  const errores = p.revision?.errores || [], estado = p.estado === 'revision' ? 'En revisión' : p.estado === 'borrador' ? 'Borrador' : p.estado === 'aprobada' ? 'Aprobada' : 'Idea';
  const cab = `📣 <b>${esc(motivo || 'Contenido para tu visto bueno')}</b>\n<b>${esc(p.titulo || String(p.texto || '').split('\n')[0].slice(0, 60) || 'Sin título')}</b>\n🗓 ${p.fecha ? `${esc(diaTG(p.fecha))}${p.hora ? ' · ' + esc(p.hora) : ' · sin hora'}` : 'sin día'} · ${esc(FORMATO_TG[p.formato] || p.formato)} · ${esc(redes)}\n${estado}${quien}`;
  const pie = errores.length ? `\n⚠ Le falta: ${esc(errores[0])}${errores.length > 1 ? ` (+${errores.length - 1})` : ''}` : piezaLista(p) ? '\n✓ Puede salir' : '';
  const libre = 1000 - cab.length - pie.length - 8, texto = String(p.texto || '').trim(), tags = String(p.hashtags || '').trim();
  const cuerpo = `${texto}${tags ? '\n' + tags : ''}`, corto = cuerpo.length > libre ? cuerpo.slice(0, Math.max(0, libre - 1)) + '…' : cuerpo;
  return `${cab}${corto ? '\n\n' + esc(corto) : ''}${pie}`;
}
export const piezaBotones = p => ({ inline_keyboard: [[...(piezaLista(p) ? [{ text: '✅ Aprobar', callback_data: 'pa:' + p.id }] : []), ...(p.estado === 'revision' ? [{ text: '↩ A borrador', callback_data: 'pb:' + p.id }] : [])], [{ text: '👁 Ver completo', callback_data: 'pv:' + p.id }]].filter(f => f.length) });

/* ---------- Fase A2 de Anuncios (9 oct 2026): /anuncios, ⏸ Pausar con un toque, y lo que gasta con DOS toques del dueño ---------- */
const usdTG = v => (v == null ? 'sin dato' : `US$${Number.isInteger(Math.round(v * 100) / 100) ? Math.round(v) : Number(v).toFixed(2)}`);
const presTG = p => (p?.usd != null ? `${usdTG(p.usd)}${p.tipo === 'diario' ? '/día' : ' en total'}` : '');
/** Lo activo y el gasto de hoy (la vista de GET /api/anuncios?rango=hoy), en HTML. */
export function anunciosTexto(v) {
  if (!v?.cuenta) return `📣 <b>Anuncios</b>: ${esc(v?.motivo || 'todavía no se leyó la cuenta publicitaria.')}`;
  const activas = (v.campanas || []).filter(c => c.estado === 'ACTIVE'), t = v.topes || {};
  return `📣 <b>Anuncios</b> · hoy ${esc(usdTG(v.gasto?.hoy))}${t.diario != null ? ` de un tope de ${esc(usdTG(t.diario))}` : ''} · este mes ${esc(usdTG(v.gasto?.mes))}${t.mensual != null ? ` de ${esc(usdTG(t.mensual))}` : ''}${(v.avisos || []).length ? '\n' + v.avisos.slice(0, 3).map(a => `⚠ ${esc(a.texto)}`).join('\n') : ''}\n${activas.length ? `${activas.length} ${activas.length === 1 ? 'campaña activa' : 'campañas activas'}:` : 'Ninguna campaña activa ahora mismo.'}`;
}
export const campanaTexto = c => `<b>${esc(c.nombre)}</b> · ${esc(c.estadoTexto)}${c.cuentaTexto ? ` · ${esc(c.cuentaTexto)}` : ''}${c.presupuesto?.usd != null ? ' · ' + esc(presTG(c.presupuesto)) : ''}${c.cifras?.gasto != null ? ` · hoy ${esc(usdTG(c.cifras.gasto))}` : ''}${c.cifras?.resultados != null ? ` · ${c.cifras.resultados} ${esc(c.cifras.resultadoTexto)}` : ''}`;
/** ⏸ Pausar (libre, un toque) para lo activo; «✅ Activar — gasta hasta US$X/día» (el PRIMER toque: pide la cifra) para lo pausado. */
export const campanaBotones = c => ({ inline_keyboard: [[c.estado === 'ACTIVE' ? { text: '⏸ Pausar', callback_data: 'xp:' + c.id } : { text: `✅ Activar${c.presupuesto?.tipo === 'diario' ? ` — gasta hasta ${usdTG(c.presupuesto.usd)}/día` : ''}`, callback_data: 'xa:' + c.id }]] });
/** El aviso de un anuncio rechazado o con problemas (sincronizar.mjs: key «anuncios-rechazado:<id>»): trae ⏸ Pausar. */
export const pausaDeAviso = n => { const m = /^anuncios-(?:rechazado|problemas):([A-Za-z0-9_]{1,40})$/.exec(String(n?.key || '')); return m ? { reply_markup: { inline_keyboard: [[{ text: '⏸ Pausar', callback_data: 'xp:' + m[1] }]] } } : {}; };
/* ---------- Fase A5 (9 oct 2026): la sugerencia de escalar del día (dos toques: el servidor da la cifra y el token) y lo que pausó el piloto ---------- */
/** «anuncios-escalar:<sugerencia>@<valor>» → «✅ Subir 20 % — hasta US$X/día» (el PRIMER toque: pide la cifra) y «Descartar». */
export const escalarDeAviso = n => { const m = /^anuncios-escalar:([a-z]+-[A-Za-z0-9_-]{1,70})@(\d+(?:\.\d+)?)$/.exec(String(n?.key || '')); return m ? { reply_markup: { inline_keyboard: [[{ text: `✅ Subir 20 % — hasta ${usdTG(Number(m[2]))}/día`, callback_data: 'sx:' + m[1] }, { text: 'Descartar', callback_data: 'sq:' + m[1] }]] } } : {}; };
/** «anuncios-piloto:<id>» (anuncios/piloto.mjs) → «↶ Deshacer»: reanudar vuelve a gastar, así que pide la cifra y el segundo toque. */
export const pilotoDeAviso = n => { const m = /^anuncios-piloto:([A-Za-z0-9_]{1,40})$/.exec(String(n?.key || '')); return m ? { reply_markup: { inline_keyboard: [[{ text: '↶ Deshacer (vuelve a gastar)', callback_data: 'xr:' + m[1] }]] } } : {}; };
/** Los botones del aviso de anuncios que toque (rechazado → ⏸, escalar → ✅/Descartar, piloto → ↶). */
/** P4 (plan MCP §14.2): «mcp-gasto:<id>» (lib/mcp/gasto.js) → ✅ Aprobar / ↩ Rechazar el gasto que pidió Claude. Aprobar es el paso 2: lo da la persona, aquí, con el mismo servidor. */
export const gastoMcpDeAviso = n => {
  const m = /^mcp-gasto:(g[0-9a-f]{9,40})$/.exec(String(n?.key || ''));
  if (!m) return {};
  return { reply_markup: { inline_keyboard: [[{ text: '✅ Aprobar el gasto', callback_data: 'mg:' + m[1] }, { text: '↩ Rechazar', callback_data: 'mr:' + m[1] }]] } };
};
export const botonesAnuncio = n => { for (const f of [pausaDeAviso, escalarDeAviso, pilotoDeAviso]) { const x = f(n); if (x.reply_markup) return x; } return {}; };
const SI = { activar: '✅ Sí, activar', reanudar: '✅ Sí, reanudar', subir_presupuesto: '✅ Sí, subir' };

export const approvalButtons = id => ({ inline_keyboard: [[{ text: '✅ Aprobar y enviar', callback_data: 'ap:' + id }, { text: '↩ Devolver', callback_data: 'rj:' + id }], [{ text: '👁 Ver completo', callback_data: 'vw:' + id }]] });

/* ---------- el cerebro del bot (compartido: la oficina local lo corre con getUpdates; el Worker de Cloudflare, con su webhook) ---------- */
/** Lo que SALE: una tarea que cambió y un aviso de la oficina → mensajes al dueño (y a quien aprueba por departamento), con el no molestar. `send(chat, html, extra)` y `sendPieza(chat, pieza, motivo)` los pone quien lo use. */
export function crearAvisador({ tg, notify, who, approvers, st, saveSt, send, sendPieza, nombreAgente = id => id, log = console }) {
  const pend = []; const enviar = (...a) => { const p = Promise.resolve(send(...a)); pend.push(p); return p; }; // los envíos de esta llamada, para poder esperarlos (en el Worker la respuesta no puede irse antes)
  const toOwners = (text, extra, { urgent = false } = {}) => {
    if (!urgent && (isQuiet(tg.quiet) || Date.now() < (st.snoozeUntil || 0))) { st.held.push({ text, extra, t: Date.now() }); st.held = st.held.slice(-60); saveSt(); return; } // F6: kept for when the quiet ends
    return Promise.all(who.map(id => enviar(id, text, extra)));
  };
  const flushHeld = async () => {
    if (!st.held.length || isQuiet(tg.quiet) || Date.now() < (st.snoozeUntil || 0)) return;
    const held = st.held; st.held = []; saveSt();
    for (const id of who) await enviar(id, `🌅 <b>Mientras no molestaba</b>: ${held.length} ${held.length === 1 ? 'mensaje' : 'mensajes'}.`);
    for (const h of held) for (const id of who) await enviar(id, h.text, h.extra);
  };
  const piezaAOwners = (p, motivo) => {
    if (isQuiet(tg.quiet) || Date.now() < (st.snoozeUntil || 0)) { st.held.push({ text: piezaTexto(p, { nombreAgente, motivo }), extra: { reply_markup: piezaBotones(p) }, t: Date.now() }); st.held = st.held.slice(-60); saveSt(); return; } // sin foto al volver: el texto y los botones
    return Promise.all(who.map(id => sendPieza(id, p, motivo).catch(e => log.warn('telegram:', e.message))));
  };
  const tarea = t => {
    if (!t || t.piece) return;
    const name = t.agentName || t.agent, dept = t.deptName || t.dept;
    if (t.state === 'waiting' && notify.approvals) { toOwners(approvalText(t, name, dept), { reply_markup: approvalButtons(t.id) }); for (const [id, ds] of Object.entries(approvers)) if (ds.includes(t.dept) && !who.includes(id)) enviar(id, approvalText(t, name, dept), { reply_markup: approvalButtons(t.id) }); }
    else if (t.state === 'done' && t.error && !t.stopped && notify.failures) toOwners(`✗ <b>Falló</b> «${esc(t.title)}» (${esc(name)})\n${esc(String(t.result || '').slice(0, 600))}`, { reply_markup: { inline_keyboard: [[{ text: '↻ Reintentar', callback_data: 'rp:' + t.id }]] } }, { urgent: t.errorKind === 'login' });
    else if (t.state === 'done' && !t.error && notify.done) toOwners(`✓ <b>Lista</b> «${esc(t.title)}» (${esc(name)})\n${esc(String(t.result || '').slice(0, 700))}`);
  };
  const aviso = n => { if (n.kind === 'bandeja-comentario') { if (notify.comentarios) toOwners(esc(n.text)); return; } // B1: ya agrupados (uno cada 15 min, «y N más»); el no molestar los guarda
    if (n.kind === 'bandeja-mensaje') { if (notify.mensajes) toOwners(esc(n.text)); return; } // B2: los mensajes privados, igual (sin el texto completo del cliente; un 🛡 no se cita)
    if (notify.notices && !['failed', 'contenido-borrador'].includes(n.kind)) toOwners(
      `${n.level === 'error' ? '🛑' : n.level === 'warn' ? '⚠' : 'ℹ'} ${esc(n.text)}`,
      n.kind === 'anuncios' ? botonesAnuncio(n) : n.kind === 'mcp-gasto' ? gastoMcpDeAviso(n) : {},
      { urgent: n.level === 'error' },
    ); }; // A2: un anuncio rechazado o con problemas trae ⏸ Pausar
  const esperar = async f => { pend.length = 0; try { f(); } finally { await Promise.allSettled(pend.splice(0)); } };
  return { toOwners, flushHeld, piezaAOwners, tarea: t => esperar(() => tarea(t)), aviso: n => esperar(() => aviso(n)), esperar };
}

/** Lo que ENTRA: los mensajes y los botones del teléfono. `local(método, ruta, cuerpo, por)` es la API de la oficina (con las mismas reglas que la página); `call` habla con Telegram;
 *  `gastos` recuerda el token del segundo toque de un gasto ({ recordar, get, delete }); `refused` es un Map-like de desconocidos (id → cuándo se le avisó). */
export function crearBot({ cfg, who, approvers, st, saveSt, local, call, send, sendPieza, flushHeld, gastos, refused, silencioExtranos = false, log = console }) {
  const isOwner = id => allowed(id, who), canApprove = (id, dept) => isOwner(id) || (approvers[String(id)] || []).includes(dept);
  /** Lo que espera tu OK en Contenido: lo que está en revisión y los borradores de la semana que ya pueden salir. */
  async function piezasPendientes() {
    const d = new Date(), y = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`, fin = new Date(d); fin.setDate(fin.getDate() + 7);
    const { piezas = [] } = await local('GET', `/api/contenido?desde=${y(d)}&hasta=${y(new Date(d.getTime() + 30 * 864e5))}`);
    return piezas.filter(p => p.estado === 'revision' || (p.estado === 'borrador' && p.fecha <= y(fin) && piezaLista(p)));
  }
  async function handleText(chat, text) {
    if (st.pendingReject[chat]) { // the note for a «↩ Devolver»
      const pr = st.pendingReject[chat], id = typeof pr === 'string' ? pr : pr.id, rby = typeof pr === 'string' ? 'telegram' : pr.by; delete st.pendingReject[chat]; saveSt();
      try { await local('POST', `/api/tasks/${id}/reject`, { feedback: text }, rby); await send(chat, '↩ Devuelta con tu nota. El agente la rehace y te llega de nuevo.'); } catch (e) { await send(chat, '✗ ' + esc(e.message)); }
      return;
    }
    const { cmd, arg } = parseCommand(text);
    if (cmd === 'ayuda') return send(chat, `Hola, soy <b>${esc(cfg.deputy?.name || 'Dimitri')}</b>, desde tu oficina ${esc(cfg.name || '')}.\n\nEscríbeme lo que necesites, como en la oficina.\n/estado · cómo va la oficina\n/pendientes · lo que espera tu visto bueno\n/tarea ventas: … · una tarea para un departamento\n/mias · lo tuyo de hoy (con ✅ para marcarlo hecho)\n/contenido · lo de Contenido que espera tu OK, con su foto\n/anuncios · lo activo y el gasto de hoy (⏸ Pausar con un toque; activar pide dos)\n/yo llamar al banco el viernes · una tarea para ti\n/silencio 2 · no molestar durante 2 horas (sin número: vuelve a avisar)\n\nLas aprobaciones te llegan con botones.`);
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
    if (cmd === 'mias') { // plan D: lo tuyo de hoy, cada una con su ✅
      const r = await local('GET', '/api/tareas/mias'), hoy = r.listas?.hoy?.pendientes || [], b = r.cuentas?.bandeja || 0;
      if (!hoy.length) return send(chat, `Nada tuyo para hoy. ✓${b ? `\nEn tu bandeja hay ${b} sin fecha.` : ''}`);
      await send(chat, `<b>Lo tuyo hoy</b> (${hoy.length})${b ? ` · ${b} en tu bandeja` : ''}:`);
      for (const t of hoy.slice(0, 10)) await send(chat, `${t.empezada ? '▶ ' : ''}<b>${esc(t.title)}</b>${t.limite ? ' · ' + esc(String(t.limite).replace('T', ' ')) : ''}${t.prioridad === 'alta' ? ' · prioridad alta' : ''}`, { reply_markup: { inline_keyboard: [[{ text: '✅ Hecha', callback_data: 'mh:' + t.id }]] } });
      return;
    }
    if (cmd === 'yo') { // plan D: una tarea para ti, con la fecha en palabras
      if (!arg) return send(chat, 'Así: <code>/yo llamar al banco el viernes a las 10</code>');
      const p = leerRapida(arg), r = await local('POST', '/api/tareas/mias', { title: p.texto || arg, ...(p.prioridad ? { prioridad: p.prioridad } : {}), ...(p.limite ? { limite: p.limite } : {}), ...(p.at ? { at: p.at } : {}) });
      return send(chat, `➕ Para ti: «${esc(r.tarea.title)}»${r.tarea.limite ? ' · ' + esc(String(r.tarea.limite).replace('T', ' ')) : ' · en tu bandeja'}.`);
    }
    if (cmd === 'contenido') { // C3: lo de Contenido que espera tu OK, cada pieza con su foto
      const l = await piezasPendientes();
      if (!l.length) return send(chat, 'Nada de Contenido espera tu visto bueno. ✓');
      const listas = l.filter(p => piezaLista(p)).length;
      await send(chat, `<b>Contenido</b>: ${l.length} ${l.length === 1 ? 'pieza espera' : 'piezas esperan'} tu visto bueno${listas ? ` (${listas} ${listas === 1 ? 'puede' : 'pueden'} salir ya)` : ''}.`, listas > 1 ? { reply_markup: { inline_keyboard: [[{ text: `✅ Aprobar las ${listas} que pueden salir`, callback_data: 'pt:todas' }]] } } : {});
      for (const p of l.slice(0, 8)) await sendPieza(chat, p);
      if (l.length > 8) await send(chat, `…y ${l.length - 8} más: ábrelas en Contenido (K).`);
      return;
    }
    if (cmd === 'anuncios') { // A2: lo activo y el gasto de hoy, ⏸ Pausar por campaña; lo pausado, con «✅ Activar» (dos toques)
      const v = await local('GET', '/api/anuncios?rango=hoy');
      await send(chat, anunciosTexto(v));
      const activas = (v.campanas || []).filter(c => c.estado === 'ACTIVE'), pausadas = (v.campanas || []).filter(c => c.estado === 'PAUSED');
      for (const c of activas.slice(0, 10)) await send(chat, campanaTexto(c), { reply_markup: campanaBotones(c) });
      if (pausadas.length) { await send(chat, `En pausa (${pausadas.length}):`); for (const c of pausadas.slice(0, 5)) await send(chat, campanaTexto(c), { reply_markup: campanaBotones(c) }); }
      return;
    }
    if (cmd === 'silencio') { const h = Math.max(0, Math.min(24, +arg || 0)); st.snoozeUntil = h ? Date.now() + h * 3600e3 : 0; saveSt(); if (!h) flushHeld(); return send(chat, h ? `🔕 Sin avisos durante ${h} h (salvo lo urgente).` : '🔔 Avisos activados.'); }
    if (cmd === 'desconocido') return send(chat, 'No conozco ese comando. /ayuda');
    // anything else: Dimitri (E3)
    await call('sendChatAction', { chat_id: chat, action: 'typing' }).catch(() => {});
    const r = await local('POST', '/api/sub/chat', { text: arg }, 'telegram:' + chat); // 26 oct 2026: Dimitri sabe quién le escribe (el id de Telegram de una persona del equipo)
    const m = (r.messages || []).find(x => x.who === 'sub') || {};
    const pieces = (m.plan?.tasks || []).filter(t => t.state === 'proposed');
    const body = esc(m.text || '…') + (pieces.length ? '\n\n' + pieces.map((t, i) => `${i + 1}. <b>${esc(t.title)}</b> → ${esc(t.dept === 'persona' ? t.persona || 'una persona' : t.dept === 'dueno' ? 'tu lista' : t.dept)}${t.team ? ' (equipo)' : ''}`).join('\n') : '') + (m.plan?.questions?.length ? '\n\n' + m.plan.questions.map(q => '❓ ' + esc(typeof q === 'string' ? q : q.q + (q.options?.length ? ` — ${q.options.map(o => o.label).join(' / ')}` : ''))).join('\n') : ''); // V4.11: a question may carry options (sub.parseQuestions)
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
      if (k === 'mh') { await local('POST', `/api/tareas/${id}/estado`, { a: 'done' }); await strip(); await done('Hecha'); return send(chat, '✅ Hecha. Lo que la esperaba sigue solo.'); } // plan D: una tarea tuya, desde /mias
      // C3: una pieza de Contenido — aprobar, devolver a borrador, ver entera; o todas las que pueden salir
      if (k === 'pa') { const r = await local('POST', `/api/contenido/piezas/${id}/aprobar`, { quien: by.slice(0, 40) }, by); await strip(); await done('Aprobada'); return send(chat, `✅ Aprobada: sale el ${esc(diaTG(r.pieza.fecha))} a las ${esc(r.pieza.hora)}.${(r.avisos || []).length ? '\nℹ ' + esc(r.avisos[0]) : ''}`); }
      if (k === 'pb') { await local('POST', `/api/contenido/piezas/${id}/devolver`, { estado: 'borrador' }, by); await strip(); await done('A borrador'); return send(chat, '↩ Vuelve a borrador: la corriges en Contenido (K).'); }
      if (k === 'pv') { const { pieza: p } = await local('GET', `/api/contenido/piezas/${id}`); await done(''); return send(chat, `<b>${esc(p.titulo || 'Sin título')}</b>\n\n${esc(p.texto || '(sin texto)')}${p.comentario ? `\n\n<b>Primer comentario</b>\n${esc(p.comentario)}` : ''}${p.hashtags ? `\n\n${esc(p.hashtags)}` : ''}${(p.revision?.errores || []).length ? `\n\n⚠ <b>Le falta</b>\n${p.revision.errores.map(e => '· ' + esc(e)).join('\n')}` : ''}`); }
      if (k === 'pt') { let ok = 0, mal = 0; for (const p of (await piezasPendientes()).filter(x => piezaLista(x))) { try { await local('POST', `/api/contenido/piezas/${p.id}/aprobar`, { quien: by.slice(0, 40) }, by); ok++; } catch { mal++; } } await strip(); await done('Hecho'); return send(chat, `✅ ${ok} ${ok === 1 ? 'aprobada' : 'aprobadas'}${mal ? ` · ${mal} no ${mal === 1 ? 'pudo' : 'pudieron'}` : ''}.`); }
      // A2: anuncios — ⏸ Pausar (libre) y su ↶ Deshacer; ✅ Activar pide la cifra al servidor y la manda con «Sí, activar» (el segundo toque)
      if (k === 'mg' || k === 'mr') { // P4: el gasto que pidió Claude por MCP (aprobar es el paso 2: lo da quien pulsa)
        const r = await local('POST', `/api/conectar-claude/solicitudes/${id}/${k === 'mg' ? 'aprobar' : 'rechazar'}`, {}, by).catch(e => ({ ok: false, texto: e.message }));
        await strip(); await done(k === 'mg' ? (r.ok ? 'Aprobado' : 'No se pudo') : 'Rechazado');
        if (k === 'mr') return send(chat, '↩ Rechazado: no se gasta nada.');
        return send(chat, r.ok ? `✅ Aprobado y pedido al Estudio. ${esc(r.texto || '')}` : `✗ ${esc(r.texto || 'No se pudo aprobar.')}`);
      }
      if (k === 'xp') { const r = await local('POST', '/api/anuncios/accion', { tipo: 'pausar', id, por: 'dueno' }, by); await strip(); await done('En pausa'); return send(chat, `⏸ ${esc(r.hecho?.texto || 'En pausa.')}`, r.deshacer ? { reply_markup: { inline_keyboard: [[{ text: '↶ Deshacer', callback_data: 'xu:' + r.deshacer.token }]] } } : {}); }
      if (k === 'xu') { const r = await local('POST', '/api/anuncios/deshacer', { token: id, por: 'dueno' }, by); await strip(); await done('Deshecho'); return send(chat, `↶ ${esc(r.hecho?.texto || 'Deshecho.')}`); }
      // A5: «xr» deshace una pausa del piloto (reanudar: gasta, dos toques); «sx» aplica la sugerencia de escalar (subir: gasta, dos toques)
      if (k === 'xa' || k === 'xr' || k === 'sx') {
        const r = k === 'sx' ? await local('POST', `/api/anuncios/sugerencias/${id}/aplicar`, { por: 'dueno' }, by) : await local('POST', '/api/anuncios/accion', { tipo: k === 'xr' ? 'reanudar' : 'activar', id, por: 'dueno' }, by), c = r.confirmar; await done('');
        if (!c) { await strip(); return send(chat, `✓ ${esc(r.hecho?.texto || 'Hecho.')}`); }
        gastos.recordar(c.token, { tipo: c.tipo, id: c.id, ...(c.valor !== undefined ? { valor: c.valor } : {}), ...(c.fin ? { fin: c.fin } : {}), ...(k === 'sx' ? { sugerencia: id } : {}), vence: Date.parse(c.vence) || Date.now() + 120e3 });
        return send(chat, `💸 <b>${esc(c.texto)}</b>${c.cuenta ? `\n📣 En: ${esc(c.cuenta)}` : ''}${r.aviso ? `\nℹ ${esc(r.aviso)}` : ''}\n¿Seguro? Tienes 2 minutos.`, { reply_markup: { inline_keyboard: [[{ text: SI[c.tipo] || '✅ Sí', callback_data: 'xc:' + c.token }, { text: '✗ No', callback_data: 'xn:' + c.token }]] } });
      }
      if (k === 'sq') { await local('POST', `/api/anuncios/sugerencias/${id}/descartar`, { por: 'dueno' }, by); await strip(); await done('Descartada'); return send(chat, 'Vale: descartada. No vuelve en 7 días.'); }
      if (k === 'xc') {
        const g = gastos.get(id); gastos.delete(id);
        if (!g) { await strip(); await done('Venció'); return send(chat, 'Esa confirmación ya no sirve (venció o ya se usó). Pide /anuncios otra vez.'); }
        const { vence, ...pedido } = g, r = await local('POST', '/api/anuncios/accion', { ...pedido, confirmacion: id, por: 'dueno' }, by);
        await strip(); await done('Hecho'); return send(chat, `✅ ${esc(r.hecho?.texto || 'Hecho.')}${r.aviso ? `\nℹ ${esc(r.aviso)}` : ''}`);
      }
      if (k === 'xn') { gastos.delete(id); await strip(); await done('No'); return send(chat, 'Vale: no se cambia nada.'); }
      if (k === 'sd') { const r = await local('POST', '/api/sub/send', { msg: id }, 'telegram:' + q.from.id); await strip(); await done('Enviado'); return send(chat, `📤 Enviado a los jefes${r.tasks?.filter(Boolean).length ? ': ' + r.tasks.filter(Boolean).length + ' tarea(s)' : ''}.`); }
      await done('');
    } catch (e) { await done('No se pudo'); return send(chat, '✗ ' + esc(e.message)); }
  }
  /** Un mensaje o un botón de Telegram (`u` = el update). Quién es se decide AQUÍ: un extraño no pasa de la primera línea. */
  async function procesar(u) {
          const from = u.message?.from?.id ?? u.callback_query?.from?.id, chat = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
          if (!allowed(from, who) && approvers[String(from)]) { // V4.4 (G5): an approver — approval buttons and /pendientes for their departments, nothing else
            if (u.callback_query) await handleCallback(u.callback_query);
            else if (u.message?.text && st.pendingReject[String(chat)]) await handleText(String(chat), u.message.text);
            else if (u.message?.text) { const { cmd } = parseCommand(u.message.text); if (cmd === 'pendientes') { const list = (await local('GET', '/api/tasks')).filter(t => t.state === 'waiting' && !t.archived && canApprove(from, t.dept)); if (!list.length) await send(chat, 'Nada de tus departamentos espera visto bueno. ✓'); for (const t of list.slice(0, 10)) await send(chat, approvalText(t, t.agent, t.dept), { reply_markup: approvalButtons(t.id) }); } else await send(chat, 'Puedes aprobar o devolver lo de tus departamentos con los botones, y ver lo pendiente con /pendientes.'); }
            return;
          }
          if (!allowed(from, who)) { // a stranger: refused, told their id once a day, and the owner hears about it (la nube: silencio total, `silencioExtranos`)
            if (silencioExtranos) return;
            if (Date.now() - (refused.get(from) || 0) > 864e5) { refused.set(from, Date.now()); send(chat, `Este bot es privado. Tu id es <code>${esc(from)}</code>; si el dueño quiere darte acceso, lo añade a TELEGRAM_OWNER_ID.`); log.warn(`telegram: refused user ${from}`); }
            return;
          }
          if (u.callback_query) await handleCallback(u.callback_query);
          else if (u.message?.text) await handleText(String(chat), u.message.text).catch(e => send(chat, '✗ ' + esc(e.message)));
  }
  return { handleText, handleCallback, procesar, piezasPendientes, isOwner, canApprove };
}

export const COMANDOS = [{ command: 'contenido', description: 'Lo de Contenido que espera tu OK' }, { command: 'anuncios', description: 'Lo activo y el gasto de hoy' }, { command: 'estado', description: 'Cómo va la oficina' }, { command: 'pendientes', description: 'Lo que espera tu visto bueno' }, { command: 'tarea', description: 'ventas: … — una tarea' }, { command: 'mias', description: 'Lo tuyo de hoy' }, { command: 'yo', description: 'Una tarea para ti' }, { command: 'silencio', description: 'No molestar N horas' }, { command: 'ayuda', description: 'Qué puedo hacer' }];
/** Las opciones de aviso, con lo que no se pone se queda como siempre. */
export const avisosPorDefecto = tg => ({ approvals: true, failures: true, done: false, notices: true, comentarios: true, mensajes: true, ...((tg || {}).notify || {}) });
/** Quién aprueba por departamento: telegram.approvers { "<id>": ["emails","sales"] } (solo ids numéricos y listas). */
export const aprobadoresDe = tg => Object.fromEntries(Object.entries((tg || {}).approvers || {}).filter(([id, d]) => /^-?\d+$/.test(id) && Array.isArray(d)).map(([id, d]) => [String(id), d.map(String)]));

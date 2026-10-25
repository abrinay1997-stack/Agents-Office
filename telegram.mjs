// Agents Office — Dimitri on Telegram, the owner's machine (see telegram-core.mjs for the whole description, the commands and the buttons).
// This file keeps what only a computer has: the getUpdates polling, the state in data/telegram.json and the photo of a piece from disk.
// The Cloudflare Worker runs the same core with Telegram's webhook (cloudflare/worker/lib/telegram.js).
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from './fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { owners, configured, chunks, esc, isQuiet, piezaTexto, piezaBotones, crearAvisador, crearBot, COMANDOS, avisosPorDefecto, aprobadoresDe } from './telegram-core.mjs';
export * from './telegram-core.mjs';

const API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'; // tests point it at a local fake

export function start({ port, cfg, dataDir, onTask, onNotice, log = console, mediaRuta = () => null, nombreAgente = id => id }) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim(), who = owners();
  if (!configured()) return null;
  const tg = { ...(cfg.telegram || {}) }, notify = avisosPorDefecto(tg); // B1: comentarios = los comentarios nuevos de la Bandeja (Meta); B2: mensajes = los mensajes privados nuevos
  // V4.4 (G5): people who may approve for some departments only — office.config.local.json → telegram.approvers { "<id>": ["emails", "sales"] }
  const approvers = aprobadoresDe(tg);
  const stateFile = path.join(dataDir, 'telegram.json');
  let st = { offset: 0, pendingReject: {}, held: [], snoozeUntil: 0 }; try { st = { ...st, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; } catch {}
  const saveSt = () => { try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(stateFile + '.tmp', JSON.stringify(st)); renombrar(stateFile + '.tmp', stateFile); } catch {} };
  const local = async (method, p, body, by) => { const r = await fetch(`http://127.0.0.1:${port}${p}`, { method, headers: { 'content-type': 'application/json', ...(by ? { 'x-office-by': by } : {}) }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.motivo && ['tope', 'meta', 'confirmacion', 'estado', 'conexion', 'deshacer'].includes(j.error) ? j.motivo : j.error) || 'HTTP ' + r.status); return j; }; // A2: Anuncios dice el porqué en `motivo`
  const call = async (m, body) => { const r = await fetch(`${process.env.TELEGRAM_API_BASE || API}/bot${token}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.description || 'Telegram ' + r.status); return j.result; };
  /** C3: una llamada con un archivo (sendPhoto): multipart, con el FormData y el Blob de Node. */
  const callForm = async (m, campos, archivo) => {
    const fd = new FormData(); for (const [k, v] of Object.entries(campos)) fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    fd.append(archivo.campo, new Blob([archivo.bytes], { type: archivo.tipo }), archivo.nombre);
    const r = await fetch(`${process.env.TELEGRAM_API_BASE || API}/bot${token}/${m}`, { method: 'POST', body: fd }); const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.description || 'Telegram ' + r.status); return j.result;
  };
  const send = async (chat, text, extra = {}) => { for (const c of chunks(text)) await call('sendMessage', { chat_id: chat, text: c, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }).catch(e => log.warn('telegram:', e.message)); };
  /* C3: la pieza con su foto (la primera imagen, si es JPEG, PNG o WebP de menos de 10 MB); si no, solo el texto. */
  const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  function fotoDe(p) {
    const m = (p.medios || [])[0], ext = path.extname(String(m || '')).toLowerCase(); if (!m || !TIPOS[ext]) return null;
    try { const f = mediaRuta(m); if (!f) return null; const st = fs.statSync(f); if (!st.isFile() || st.size > 10e6) return null; return { campo: 'photo', bytes: fs.readFileSync(f), tipo: TIPOS[ext], nombre: 'pieza' + ext }; } catch { return null; }
  }
  async function sendPieza(chat, p, motivo = '') {
    const caption = piezaTexto(p, { nombreAgente, motivo }), reply_markup = piezaBotones(p), foto = fotoDe(p);
    if (foto) { try { return await callForm('sendPhoto', { chat_id: String(chat), caption, parse_mode: 'HTML', reply_markup }, foto); } catch (e) { log.warn('telegram: foto —', e.message); } }
    return send(chat, caption, { reply_markup });
  }
  const gastos = Object.assign(new Map(), { recordar(k, x) { const t = Date.now(); for (const [a, b] of this) if (b.vence <= t) this.delete(a); this.set(k, x); } }); // A2: si la oficina se reinicia, se olvida (y vence)
  const refused = new Map();
  const av = crearAvisador({ tg, notify, who, approvers, st, saveSt, send, sendPieza, nombreAgente, log });
  const flushTimer = setInterval(av.flushHeld, 60000);
  const bot = crearBot({ cfg, who, approvers, st, saveSt, local, call, send, sendPieza, flushHeld: av.flushHeld, gastos, refused, log });
  // the office tells us: a task changed, a notice was raised
  onTask(av.tarea); onNotice(av.aviso);
  let stopped = false;
  async function loop() {
    while (!stopped) {
      try {
        const ups = await call('getUpdates', { offset: st.offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
        for (const u of ups) { st.offset = u.update_id + 1; saveSt(); await bot.procesar(u); }
      } catch (e) { if (stopped) break; log.warn('telegram:', e.message); await new Promise(r => setTimeout(r, +process.env.TELEGRAM_RETRY_MS || 15000)); }
    }
  }
  call('setMyCommands', { commands: COMANDOS }).catch(() => {});
  loop();
  return { owners: who.length, send: text => av.toOwners(text), pieza: (p, motivo) => { if (notify.approvals && p?.id) av.piezaAOwners(p, motivo); }, /* C3 */ sendTo: (id, text) => send(String(id), esc(text)), stop: () => { stopped = true; clearInterval(flushTimer); } };
}

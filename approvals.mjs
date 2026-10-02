// Agents Office — approvals (V4.4, 25 Sep 2026; audit G1–G10). Pure functions, proven in tests/approvals.test.mjs:
//   what a draft will send, laid out as a card (G3) · how risky it is (G2) · amounts over the owner's limit (G9) ·
//   reminders and expiry (G4) · when a routine has earned the right to stop asking (G2) · who approved what (G8).
// office.config.json → "approvals": { "undoSeconds": 30, "remindAfterHours": 24, "expireAfterDays": 7, "amountLimit": 200,
//   "autonomyAfter": 20 }   (0 turns a feature off)
import { targetsOf, amountsIn } from './safety.mjs';
export { amountsIn };

export const DEFAULTS = { undoSeconds: 30, remindAfterHours: 24, expireAfterDays: 7, amountLimit: 200, autonomyAfter: 20 };
export const config = c => ({ ...DEFAULTS, ...(c || {}) });

export const overLimit = (text, limit) => limit > 0 ? amountsIn(text).filter(n => n > limit) : [];

const ATTACH = /\b[\w\-() ]{1,60}\.(pdf|docx?|xlsx?|csv|pptx?|png|jpe?g|zip|mp4)\b/gi;
/** What will go out, read from the draft: recipients, subject, amounts, attachments, channel. */
export function preview(draft) {
  const d = String(draft || ''), t = targetsOf(d);
  const subject = (/^\s*(?:asunto|subject|título|title)\s*[:：]\s*(.+)$/im.exec(d) || [])[1] || '';
  const channel = /whatsapp/i.test(d) ? 'WhatsApp' : /\b(correo|email|e-mail|gmail|asunto|subject)\b/i.test(d) || t.emails.length ? 'Correo' : /instagram|facebook|linkedin|publicar|post\b/i.test(d) ? 'Redes' : /\b(pago|pagar|transferencia|factura|cobro)\b/i.test(d) ? 'Pago o factura' : '';
  return { to: t.emails, phones: t.phones, subject: subject.trim().slice(0, 140), amounts: amountsIn(d), attachments: [...new Set((d.match(ATTACH) || []).map(s => s.trim()))].slice(0, 8), channel };
}

/** 'alto' · 'medio' · 'bajo': money or deleting is high; reaching people outside is medium; the rest is low. */
export function risk(draft, cfg = DEFAULTS) {
  const d = String(draft || ''), p = preview(d);
  if (/\b(pag[ao]r?|transfer|transferencia|reembolso|refund|borra|elimina|delete|cancela la cuenta|despide)\b/i.test(d) || overLimit(d, cfg.amountLimit).length) return 'alto';
  if (p.to.length > 3 || p.phones.length > 3) return 'alto'; // a mass send
  if (p.to.length || p.phones.length || /\b(publica|publicar|post|enviar|envía|responde|reply)\b/i.test(d)) return 'medio';
  return 'bajo';
}

/** Reminders and expiry for drafts waiting on the OK. → { remind: [ids], expire: [ids] } */
export function due(tasks, cfg = DEFAULTS, now = Date.now()) {
  const out = { remind: [], expire: [] };
  for (const t of tasks) {
    if (t.state !== 'waiting' || t.archived || t.approving) continue;
    const since = now - (t.waitingAt || now);
    if (cfg.expireAfterDays > 0 && since > cfg.expireAfterDays * 864e5) { out.expire.push(t.id); continue; }
    if (cfg.remindAfterHours > 0 && since > cfg.remindAfterHours * 3600e3 && now - (t.remindedAt || 0) > cfg.remindAfterHours * 3600e3) out.remind.push(t.id);
  }
  return out;
}

/** G2: the last N drafts of a routine were approved as they came (no edits, no send-backs) → it may stop asking. */
export function earnedAutonomy(tasks, routineId, cfg = DEFAULTS) {
  if (!(cfg.autonomyAfter > 0)) return false;
  const mine = tasks.filter(t => t.routine === routineId && (t.approved || t.rejected || t.expired)).sort((a, b) => (b.approvedAt || b.doneAt || 0) - (a.approvedAt || a.doneAt || 0)).slice(0, cfg.autonomyAfter);
  return mine.length >= cfg.autonomyAfter && mine.every(t => t.approved && !t.editedDraft && !t.revisions && !t.expired && risk(t.draft, cfg) !== 'alto');
}

/** G8: one entry in a task's approval history. */
export const entry = (action, by, extra = {}) => ({ at: Date.now(), action, by: by || 'la oficina', ...extra });

/* ---------- el LOTE del Estudio que pide un agente (banco de presets E8, §8.4 y §15.5) ----------
   Un agente que pide un lote por encima de sus umbrales (lotes.agenteSinOk fotos o lotes.agenteUsd US$) lo deja «espera_ok»
   (lotes.mjs). La oficina lo pone en ⚠ Aprobaciones como cualquier borrador: su tarea pasa a esperar tu OK con «Lo que saldrá»
   (fotos, receta, costo). Aprobar la tarea autoriza el lote y lo arranca; devolverla o dejarla caducar lo cancela sin gastar.
   Ninguna herramienta de un agente aprueba: solo este camino, que es el del dueño. Todo puro (tests/estudio-mcp-presets.test.mjs). */
const usdEs = v => 'US$' + (+v || 0).toFixed(2).replace('.', ',');
const limpia = (s, n = 80) => String(s ?? '').replace(/[\u0000-\u001f«»]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
/** La línea que el agente deja en su entrega y que la oficina cambia por el resumen al terminar el lote. */
export const lineaLote = l => `⏳ Estudio: lote «${limpia(l?.nombre) || 'sin nombre'}» (lote ${l?.id})`;
export const marcaLote = id => new RegExp(`^.*\\(lote ${String(id).replace(/[^A-Za-z0-9]/g, '')}\\).*$`, 'm');
/** Lo que el dueño aprueba de un lote: { id, nombre, fotos, total, receta, canal, escena, costo, motivo }. nombreDe(id) da el nombre de un preset. */
export function loteParaAprobar(l, { nombreDe = id => id, canalDe = id => id } = {}) {
  if (!l) return null;
  const pila = Array.isArray(l.receta?.pila) ? l.receta.pila : [], filas = Array.isArray(l.filas) ? l.filas : [];
  const fotos = filas.filter(f => f.estado !== 'revisar' && f.estado !== 'omitida').length;
  return { id: l.id, nombre: limpia(l.nombre), fotos, total: filas.length, receta: pila.map(x => limpia(nombreDe(x.id), 60)).join(' + ') || (l.receta?.idea ? 'su idea' : 'la de cada fila'),
    canal: l.receta?.canal ? limpia(canalDe(l.receta.canal), 60) : '', escena: !!l.receta?.escena, costo: +(+l.costo?.estimado || 0).toFixed(4), motivo: limpia(l.motivo, 240) };
}
/** El bloque que va al final del borrador: lo que saldrá del Estudio si apruebas. */
export function bloqueLote(x) {
  if (!x) return '';
  return [`**Lote del Estudio que espera tu OK:** «${x.nombre}» · ${x.id}`,
    `- Fotos: ${x.fotos}${x.total > x.fotos ? ` (y ${x.total - x.fotos} que no se pueden editar y no gastan)` : ''}`,
    `- Receta: ${x.receta}${x.canal ? ` · para ${x.canal}` : ''}${x.escena ? ' · con una misma escena 3D para toda la serie' : ''}`,
    `- Costo estimado: ${usdEs(x.costo)}${x.costo ? '' : ' (todo en tu máquina)'}`,
    x.motivo ? `- Por qué espera: ${x.motivo}` : '',
    `Si apruebas, la oficina lo autoriza y lo empieza${x.fotos >= 10 ? ' con una prueba de 3 fotos (las revisas antes de seguir)' : ''}, dentro de los topes del Estudio. Si lo devuelves o caduca, se cancela sin gastar nada.`].filter(Boolean).join('\n');
}
/** «Lo que saldrá» con los lotes: el canal dice Estudio, las fotos y la receta; el costo va en los importes. */
export function previewConLotes(p, lotes) {
  const ls = (Array.isArray(lotes) ? lotes : []).filter(Boolean); if (!ls.length) return p;
  const est = ls.map(x => `Estudio: lote «${x.nombre}» · ${x.fotos} foto${x.fotos === 1 ? '' : 's'} · ${x.receta}`).join(' · ');
  return { ...(p || {}), channel: [p?.channel, est].filter(Boolean).join(' + '), amounts: [...(p?.amounts || []), ...ls.map(x => x.costo).filter(n => n > 0)], lotes: ls };
}
/** Un lote gasta dinero: al menos riesgo medio; alto si pasa del límite de importes del dueño. */
export function riesgoConLotes(r, lotes, cfg = DEFAULTS) {
  const ls = (Array.isArray(lotes) ? lotes : []).filter(Boolean); if (!ls.length) return r;
  if (r === 'alto' || (cfg.amountLimit > 0 && ls.some(x => x.costo > cfg.amountLimit))) return 'alto';
  return 'medio';
}
const srcMedia = f => '/media/' + String(f).split('/').map(encodeURIComponent).join('/');
/** Lo que reemplaza la línea ⏳ del lote al terminar: el resumen y hasta `max` miniaturas de lo que quedó listo. */
export function resumenLote(l, { max = 6 } = {}) {
  const filas = Array.isArray(l?.filas) ? l.filas : [];
  const ok = filas.filter(f => (f.estado === 'lista' || f.estado === 'aprobada') && f.out);
  const n = e => filas.filter(f => f.estado === e).length;
  const partes = [`${ok.length} lista${ok.length === 1 ? '' : 's'}`, n('revisar') && `${n('revisar')} para revisar`, n('fallo') && `${n('fallo')} ${n('fallo') === 1 ? 'falló' : 'fallaron'}`, n('omitida') && `${n('omitida')} omitida${n('omitida') === 1 ? '' : 's'}`].filter(Boolean);
  const cab = l?.estado === 'cancelado' ? `✗ Estudio: el lote «${limpia(l.nombre)}» se canceló (${partes.join(', ')}; gastado ${usdEs(l.costo?.gastado)}).` : `✓ Estudio: lote «${limpia(l?.nombre)}» terminado: ${partes.join(', ')} · gastado ${usdEs(l?.costo?.gastado)}.`;
  const fotos = ok.slice(0, max).map(f => `![${limpia(f.sku || f.nombre || `foto ${f.n}`, 50).replace(/[[\]()]/g, '')}](${srcMedia(f.out)})`);
  return [cab, ...fotos, ok.length > max ? `…y ${ok.length - max} más en el Estudio (pestaña Lotes).` : ''].filter(Boolean).join('\n');
}
/** Cambia la línea «(lote <id>)» de un texto por el resumen; si el agente no la dejó, lo añade al final. */
export function ponerResumenLote(text, l, resumen = resumenLote(l)) {
  const t = String(text || ''), m = marcaLote(l.id);
  return m.test(t) ? t.replace(m, () => resumen) : `${t}${t ? '\n\n' : ''}${resumen}`;
}

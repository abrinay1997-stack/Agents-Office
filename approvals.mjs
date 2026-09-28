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

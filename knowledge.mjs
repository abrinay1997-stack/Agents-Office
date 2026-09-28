// Agents Office — what the agents know (V4.4, 25 Sep 2026; audit H1, H3, H7). Proven in tests/knowledge.test.mjs.
//   H1 · the brain is searched by PASSAGE, not by note name: every note is cut into passages, ranked with BM25 over Spanish
//        and English words (accents folded, light stemming), and the agent gets the best passages of the best notes — not the
//        first 1,800 characters of whatever matched a word. With an embeddings key on the machine (GEMINI_API_KEY, OPENAI_API_KEY
//        or VOYAGE_API_KEY) the ranking is hybrid: words + meaning.
//   H3 · notes that need a look: a `revisar: AAAA-MM-DD` date in the note's front matter that has passed, or a company note
//        untouched for 180 days. The agent is told «(nota sin revisar desde …)» and the traffic light lists them.
//   H7 · what the office already did with the same client: tasks of any department that name the same email, phone or name.
import crypto from 'node:crypto';

const STOP = new Set('de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos que unos yo otro otras otra el tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros the of and to in is for on that with as are be this it by or at from an your you we our can will not have has its was were if what how when which who'.split(' '));
export const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const stem = w => w.length > 5 && w.endsWith('ciones') ? w.slice(0, -2) : w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
export const tokens = s => fold(s).split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

/** A note in passages of about `size` characters, cut at headings and paragraphs; each passage keeps its heading. */
export function passages(name, text, size = 900) {
  const body = String(text || '').replace(/^---[\s\S]*?---\s*/, '');
  const out = []; let head = '', buf = '';
  const flush = () => { const t = buf.trim(); if (t) out.push({ note: name, head, text: t }); buf = ''; };
  for (const block of body.split(/\n\s*\n/)) {
    const h = /^#{1,4}\s+(.+)$/m.exec(block); if (h && block.trim().startsWith('#')) { flush(); head = h[1].trim(); }
    if ((buf + '\n\n' + block).length > size && buf) flush();
    buf += (buf ? '\n\n' : '') + block;
  }
  flush();
  return out.map((p, i) => ({ ...p, i, id: `${name}#${i}`, hash: hash(p.text) }));
}

/** BM25 over passages. notes: Map name → text. */
export function buildIndex(notes) {
  const docs = []; for (const [name, text] of notes) for (const p of passages(name, text)) docs.push({ ...p, tf: new Map(), len: 0 });
  const df = new Map();
  for (const d of docs) { const ws = tokens(d.note.replace(/[-_]/g, ' ') + ' ' + d.head + ' ' + d.text); d.len = ws.length; for (const w of ws) d.tf.set(w, (d.tf.get(w) || 0) + 1); for (const w of new Set(ws)) df.set(w, (df.get(w) || 0) + 1); }
  const avg = docs.reduce((s, d) => s + d.len, 0) / (docs.length || 1);
  return { docs, df, avg, N: docs.length };
}
export function bm25(index, query, { k1 = 1.4, b = 0.75 } = {}) {
  const q = [...new Set(tokens(query))]; const out = [];
  for (const d of index.docs) {
    let s = 0;
    for (const w of q) { const f = d.tf.get(w); if (!f) continue; const n = index.df.get(w) || 0; const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5)); s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / index.avg)); }
    if (fold(d.note).split(/[-_ ]/).some(p => q.includes(stem(p)))) s += 1.5; // the note's own name is a strong hint
    if (s > 0) out.push({ d, s });
  }
  return out.sort((a, b) => b.s - a.s);
}
const cos = (a, b) => { let x = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { x += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? x / Math.sqrt(na * nb) : 0; };
/**
 * The notes and passages for a task. vectors (optional): { passageHash: [..] } and queryVec — the hybrid ranking.
 * → [{ note, passages: [text], score }] best first, at most `n` notes and `per` passages each.
 */
export function search(index, query, { n = 5, per = 2, vectors = null, queryVec = null, always = [] } = {}) {
  let hits = bm25(index, query);
  if (vectors && queryVec) {
    const top = hits.length ? hits[0].s : 1, lex = new Map(hits.map(h => [h.d.id, h.s / top]));
    hits = index.docs.map(d => ({ d, s: 0.5 * (lex.get(d.id) || 0) + 0.5 * Math.max(0, vectors[d.hash] ? cos(vectors[d.hash], queryVec) : 0) })).filter(h => h.s > 0.15).sort((a, b) => b.s - a.s);
  }
  const byNote = new Map();
  for (const h of hits) { const e = byNote.get(h.d.note) || { note: h.d.note, passages: [], score: 0 }; if (e.passages.length < per) { e.passages.push((h.d.head && !h.d.text.startsWith('#') ? '## ' + h.d.head + '\n' : '') + h.d.text); e.score += h.s; } byNote.set(h.d.note, e); }
  const ranked = [...byNote.values()].sort((a, b) => b.score - a.score).slice(0, n);
  for (const name of always) if (!ranked.some(r => r.note === name)) { const d = index.docs.find(x => x.note === name); if (d) ranked.push({ note: name, passages: [d.text], score: 0 }); }
  return ranked;
}

/* ---------- embeddings (optional): whichever key the machine already has ---------- */
export function embedder(env = process.env) {
  if (env.GEMINI_API_KEY) return { name: 'Gemini text-embedding-004', embed: async texts => { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requests: texts.map(t => ({ model: 'models/text-embedding-004', content: { parts: [{ text: t.slice(0, 8000) }] } })) }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'embeddings ' + r.status); return j.embeddings.map(e => e.values); } };
  if (env.OPENAI_API_KEY) return { name: 'OpenAI text-embedding-3-small', embed: async texts => { const r = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.OPENAI_API_KEY }, body: JSON.stringify({ model: 'text-embedding-3-small', input: texts.map(t => t.slice(0, 8000)) }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'embeddings ' + r.status); return j.data.map(e => e.embedding); } };
  if (env.VOYAGE_API_KEY) return { name: 'Voyage voyage-3.5-lite', embed: async texts => { const r = await fetch('https://api.voyageai.com/v1/embeddings', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.VOYAGE_API_KEY }, body: JSON.stringify({ model: 'voyage-3.5-lite', input: texts.map(t => t.slice(0, 8000)) }) }); const j = await r.json(); if (!r.ok) throw new Error(j.detail || 'embeddings ' + r.status); return j.data.map(e => e.embedding); } };
  return null;
}

/* ---------- H3: notes that need a look ---------- */
const COMPANY = /^(10|20|30|40|50|60|70|80|90)-/;
export function staleness(name, text, mtimeMs, group = '', now = Date.now(), maxDays = 180) {
  const fm = /^---([\s\S]*?)---/.exec(String(text || ''))?.[1] || '';
  const rev = /^\s*(?:revisar|review|revisar_el|review_by)\s*:\s*(\d{4}-\d{2}-\d{2})/im.exec(fm)?.[1];
  if (rev && Date.parse(rev + 'T00:00:00') < now) return { stale: true, why: `tocaba revisarla el ${rev}`, since: Date.parse(rev) };
  const upd = /^\s*(?:actualizado|updated|reviewed|revisado)\s*:\s*(\d{4}-\d{2}-\d{2})/im.exec(fm)?.[1];
  const last = upd ? Date.parse(upd + 'T00:00:00') : mtimeMs;
  if (COMPANY.test(group) && last && now - last > maxDays * 864e5) return { stale: true, why: `sin revisar desde ${new Date(last).toISOString().slice(0, 10)}`, since: last };
  return { stale: false };
}

/* ---------- H7: the same client across departments ---------- */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const NAME_STOP = new Set(fold('Hola Buenos Buenas Gracias Saludos Para Asunto Tarea Lunes Martes Miércoles Jueves Viernes Sábado Domingo Enero Febrero Marzo Abril Mayo Junio Julio Agosto Septiembre Octubre Noviembre Diciembre Prepara Escribe Responde Revisa Envía Haz Lista Llama The This Please Dear').split(' '));
/** The people and companies a text names: emails, phones, and capitalised names (two words or a rare one). */
export function entities(text) {
  const t = String(text || ''), out = new Set();
  for (const e of t.match(EMAIL) || []) out.add(e.toLowerCase());
  for (const p of t.match(/\+?\d[\d\s().-]{7,}\d/g) || []) { const d = p.replace(/\D/g, ''); if (d.length >= 8 && d.length <= 15) out.add(d.slice(-8)); }
  for (const m of t.matchAll(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})*)\b/g)) { const w = m[1]; if (!NAME_STOP.has(fold(w.split(' ')[0])) && w.length >= 4) out.add(fold(w)); }
  return out;
}
/** Tasks of the last `days` that name the same client, newest first (not the task itself). */
export function sameClient(tasks, task, { days = 60, n = 5, now = Date.now() } = {}) {
  const mine = entities(`${task.title} ${task.text}`); if (!mine.size) return [];
  const out = [];
  for (const t of tasks) {
    if (t.id === task.id || t.piece || (t.doneAt || t.addedAt || 0) < now - days * 864e5 || !(t.state === 'done' || t.state === 'waiting') || t.error) continue;
    const theirs = entities(`${t.title} ${t.text} ${String(t.result || t.draft || '').slice(0, 3000)}`); const shared = [...mine].filter(e => theirs.has(e));
    if (shared.length) out.push({ t, shared });
  }
  return out.sort((a, b) => (b.t.doneAt || b.t.addedAt) - (a.t.doneAt || a.t.addedAt)).slice(0, n);
}
export function sameClientText(hits, nameOf, deptName) {
  if (!hits.length) return '';
  return '\nWHAT THE OFFICE ALREADY DID WITH THIS CLIENT (other desks too — stay consistent with it, do not contradict it):\n' + hits.map(({ t }) => `- ${new Date(t.doneAt || t.addedAt).toISOString().slice(0, 10)} · ${deptName(t.dept)} · ${nameOf(t.agent)} · «${t.title}»${t.state === 'waiting' ? ' (draft waiting for the owner)' : ''}: ${String(t.result || t.draft || '').replace(/\s+/g, ' ').slice(0, 280)}`).join('\n');
}

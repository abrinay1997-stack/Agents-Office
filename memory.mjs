// Agents Office — how the Brain remembers (V4.6, 27 Sep 2026). Pure functions, proven in tests/memory.test.mjs.
// After studying cognee, Graphiti, Mem0, HippoGraph, company-brain and Engram (the owner asked for «las mejores prácticas»),
// the ideas that fit an office that pays per use — no extra call to a model for any of this:
//   · MENTIONS — a note that names another one without a [[link]] is connected to it anyway (company-brain's deterministic
//     extraction; cognee's cross-connections). The owner's forgotten links still count.
//   · SUMMARIES — a few lines per note (its title, its sections' first sentences, its amounts): what a neighbour contributes to
//     an agent's context, and the Brain's preview (cognee's TextSummary; Engram's core memory).
//   · A CONTEXT BUDGET — passages ranked, near-copies dropped, stopped at a size (Engram's materialisation; Graphiti's MMR).
//   · THE NEIGHBOURHOOD — the best notes bring their closest neighbours, weighted by the link and damped for hubs, so an index
//     linked to everything does not flood every task (cognee's graph completion; HippoGraph and Mem0 damp hubs).
//   · SYNAPSES THAT LEARN — the notes an agent cited in work the owner approved get stronger, and so does the link between
//     notes cited together; work sent back or 👎 weakens them; everything drifts back to neutral in a few months if unused
//     (cognee's feedback weights, Engram's reconsolidation, HippoGraph's decay). Idempotent per task: a new vote replaces the
//     old one, it is never counted twice.
import { tokens, fold } from './knowledge.mjs';

/* ---------- mentions: a note that names another without linking it ---------- */
const WIKI = /\[\[([^\]|#]+)/g;
/** The name of a note as words: «plazos-entrega» → ['plazo', 'entrega'] (the same stemmed tokens the search uses). */
const nameTokens = name => tokens(String(name).replace(/[-_]+/g, ' '));
/**
 * Mentions between notes: [[a, b]] where the text of `a` contains the name of `b` as words and `a` has no [[link]] to b.
 * A name counts when it has two words or more, or one of 7 letters or more (a note called «voz» would be everywhere).
 */
export function mentions(notes) {
  const names = [...notes.keys()], byFirst = new Map();
  for (const n of names) {
    const tk = nameTokens(n); if (!tk.length || (tk.length < 2 && tk[0].length < 7)) continue;
    (byFirst.get(tk[0]) || byFirst.set(tk[0], []).get(tk[0])).push({ n, tk });
  }
  const out = [], seen = new Set();
  for (const [a, text] of notes) {
    const linked = new Set([...String(text).matchAll(WIKI)].map(m => fold(m[1].trim().split('/').pop())));
    const body = String(text).replace(/^---[\s\S]*?---\s*/, '').replace(/\[\[[^\]]*\]\]/g, ' '); // what is already a link is not a mention
    const tk = tokens(body);
    for (let i = 0; i < tk.length; i++) {
      for (const c of byFirst.get(tk[i]) || []) {
        if (c.n === a || linked.has(fold(c.n))) continue;
        let ok = true; for (let k = 1; k < c.tk.length; k++) if (tk[i + k] !== c.tk[k]) { ok = false; break; }
        if (!ok) continue;
        const key = a < c.n ? a + '\u0001' + c.n : c.n + '\u0001' + a; if (seen.has(key)) continue; seen.add(key);
        out.push([a, c.n]);
      }
    }
  }
  return out;
}

/* ---------- summaries: a few lines that say what a note holds ---------- */
const MONEY = /(US\$|\$|€|B\/\.|\d+\s?%|\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+(?:[.,]\d+)?\s?(?:dólares|usd|balboas)\b)/i;
/** Its title, a `resumen:`/`summary:` line, the first sentence under each heading and the lines with amounts, up to `max`. */
export function summary(text, max = 320) {
  const t = String(text || '').replace(/\r\n?/g, '\n'), fm = /^---\n([\s\S]*?)\n---/.exec(t)?.[1] || '';
  const body = t.replace(/^---[\s\S]*?---\s*/, '');
  const clean = s => s.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1').replace(/[*_`>#]+/g, '').replace(/\s+/g, ' ').trim();
  const bits = [], add = s => { s = clean(s).replace(/(\s*·\s*)+/g, ' · ').replace(/^[\s·]+|[\s·]+$/g, ''); if (!s || bits.some(b => b.includes(s))) return; for (let i = bits.length - 1; i >= 0; i--) if (s.includes(bits[i])) bits.splice(i, 1); bits.push(s); }; // table cells: one separator, none at the ends; a line already said by a longer one goes
  const own = /^(?:resumen|summary|descripcion|description)\s*:\s*(.+)$/im.exec(fm)?.[1]; if (own) add(own);
  const h1 = /^#\s+(.+)$/m.exec(body)?.[1]; if (h1) add(h1);
  for (const sec of body.split(/\n(?=#{2,3}\s)/)) { // the first real sentence under each heading
    const lines = sec.split('\n'), head = /^#{2,3}\s+(.+)$/.exec(lines[0])?.[1];
    const first = lines.slice(head ? 1 : 0).map(l => l.trim()).find(l => l && !/^[#|\-:]/.test(l) && !/^[-*]\s*$/.test(l));
    if (first) add((head ? head + ': ' : '') + first.split(/(?<=[.!?])\s/)[0]);
  }
  for (const l of body.split('\n')) if (MONEY.test(l) && !/^\s*\|?\s*:?-{2,}/.test(l)) add(l.replace(/\|/g, ' · '));
  let out = ''; for (const b of bits) { if ((out + (out ? ' · ' : '') + b).length > max) { if (!out) out = b.slice(0, max - 1) + '…'; break; } out += (out ? ' · ' : '') + b; }
  return out;
}

/* ---------- a context budget: best first, near-copies out ---------- */
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
/**
 * blocks: [{ head, body }] best first → the text an agent gets, never over `budget` characters. A passage that repeats one
 * already in (Jaccard ≥ 0.8 of its words) is left out; the block that does not fit is cut at a paragraph.
 */
export function pack(blocks, budget = 9000) {
  const kept = [], out = []; let used = 0;
  for (const b of blocks) {
    const parts = String(b.body || '').split(/\n…\n/).filter(p => { const w = new Set(tokens(p)); if (kept.some(k => jaccard(k, w) >= 0.8)) return false; kept.push(w); return true; });
    if (!parts.length) continue;
    let text = `${b.head}\n${parts.join('\n…\n')}`;
    if (used + text.length > budget) { const room = budget - used; if (room < 400) break; text = text.slice(0, room).replace(/\n[^\n]*$/, '') + '\n…'; }
    out.push(text); used += text.length + 2;
    if (used >= budget) break;
  }
  return out.join('\n\n');
}

/* ---------- the neighbourhood: what the best notes bring with them ---------- */
/**
 * A graph for the search: adj Map name → Map(neighbour → weight). Wiki links weigh 1, mentions 0.35, links learned from use
 * their weight (0–1).
 */
export function linkGraph(notes, { extra = [] } = {}) {
  const adj = new Map(), put = (a, b, w) => { if (a === b || !notes.has(a) || !notes.has(b)) return; for (const [x, y] of [[a, b], [b, a]]) { const m = adj.get(x) || adj.set(x, new Map()).get(x); m.set(y, Math.max(m.get(y) || 0, w)); } };
  const byFold = new Map([...notes.keys()].map(n => [fold(n), n]));
  for (const [a, text] of notes) for (const m of String(text).matchAll(WIKI)) { const b = byFold.get(fold(m[1].trim().split('/').pop())); if (b) put(a, b, 1); }
  for (const [a, b] of mentions(notes)) put(a, b, 0.35);
  for (const [a, b, w] of extra) put(a, b, Math.max(0, Math.min(1, w)));
  return adj;
}
/**
 * The neighbours worth adding to the best notes (seeds: [{ note, score }] best first): a neighbour scores
 * seed × link weight × 0.5 / log2(2 + its degree) — a hub linked to everything scores little. At most `max`, never a seed.
 */
export function expand(seeds, adj, { take = 3, max = 2, skip = new Set() } = {}) {
  const best = new Map();
  for (const s of seeds.slice(0, take)) for (const [nb, w] of adj.get(s.note) || []) {
    if (skip.has(nb) || seeds.some(x => x.note === nb)) continue;
    const deg = (adj.get(nb) || new Map()).size, sc = (s.score || 1) * w * 0.5 / Math.log2(2 + deg);
    const cur = best.get(nb); if (!cur || cur.score < sc) best.set(nb, { note: nb, via: s.note, score: sc });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/* ---------- synapses that learn ---------- */
export const ALPHA = 0.1, HALF_LIFE_DAYS = 90;
const pairKey = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a);
export const emptyMemory = () => ({ v: 1, notes: {}, edges: {}, applied: {} });
/** How good a finished task turned out, 0–1: 👍 or approved 1, used as it came 0.75, −0.25 per send-back (at least 0.25), 👎 0. */
export function outcome(t) {
  if (t.vote === 'down') return 0; if (t.vote === 'up') return 1;
  return Math.max(0.25, Math.min(1, (t.approved ? 1 : 0.75) - 0.25 * (t.revisions || 0)));
}
/** The notes a deliverable names in its «Fuentes:» line(s), among the ones it read (names matched by their words). */
export function cited(result, read = []) {
  const src = String(result || '').split('\n').filter(l => /^\W*(fuentes|sources)\W*:/i.test(l.trim())).join(' ');
  if (!src) return [];
  const words = new Set(tokens(src)), raw = fold(src);
  return read.filter(n => raw.includes(fold(n)) || (() => { const tk = nameTokens(n); return tk.length && tk.every(w => words.has(w)); })());
}
/** A weight as it is today: learned weights drift back to neutral (notes, 0.5) or away (learned links, 0) when unused. */
export function effective(e, now = Date.now(), neutral = 0.5) {
  if (!e) return neutral;
  const k = Math.pow(0.5, Math.max(0, now - (e.last || now)) / 864e5 / HALF_LIFE_DAYS);
  return neutral + (e.w - neutral) * k;
}
/**
 * Learn from one finished task: { id, r, cited, read }. The notes it cited move towards r (α), the ones it read but did not
 * cite move half as fast towards 0.4; every pair cited together strengthens its link (a new link is born only from good work).
 * Applying the same task again first undoes what it did before, so a vote that changes is never counted twice.
 */
export function reinforce(mem, { id, r, cited: cit = [], read = [] }, now = Date.now()) {
  const prev = mem.applied[id];
  if (prev && prev.r === r && prev.cit === cit.join('|')) return mem; // nothing new
  if (prev) { // undo the last time this task taught the memory
    for (const [n, d] of Object.entries(prev.dn)) { const e = mem.notes[n]; if (e) e.w = Math.max(0, Math.min(1, e.w - d)); }
    for (const [k, d] of Object.entries(prev.de)) { const e = mem.edges[k]; if (e) { e.w = Math.max(0, Math.min(1, e.w - d)); if (e.w < 0.1) delete mem.edges[k]; } }
  }
  const dn = {}, de = {};
  const move = (n, target, a) => { const e = mem.notes[n] || (mem.notes[n] = { w: 0.5, n: 0, last: now }); const w0 = effective(e, now); const w1 = w0 + a * (target - w0); dn[n] = (dn[n] || 0) + (w1 - e.w); e.w = w1; e.n++; e.last = now; };
  const citSet = new Set(cit);
  for (const n of cit) move(n, r, ALPHA);
  for (const n of read) if (!citSet.has(n)) move(n, 0.4, ALPHA / 2);
  const list = [...citSet];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const k = pairKey(list[i], list[j]); let e = mem.edges[k];
    if (!e) { if (r < 0.75) continue; e = mem.edges[k] = { w: 0.2, n: 0, last: now }; de[k] = 0.2; }
    const w0 = effective(e, now, 0), w1 = w0 + ALPHA * (r - w0); de[k] = (de[k] || 0) + (w1 - e.w); e.w = w1; e.n++; e.last = now;
    if (e.w < 0.1) delete mem.edges[k];
  }
  mem.applied[id] = { r, cit: cit.join('|'), dn, de, at: now };
  const ids = Object.keys(mem.applied); if (ids.length > 3000) for (const old of ids.sort((a, b) => mem.applied[a].at - mem.applied[b].at).slice(0, ids.length - 3000)) delete mem.applied[old];
  return mem;
}
/** The learned weight of a note (0–1, 0.5 neutral) → a factor for its search score: 0.8 … 1.2 (1 when neutral). */
export const boostOf = (mem, name, now = Date.now()) => 0.8 + 0.4 * effective(mem.notes[name], now);
/** Learned links [[a, b, w]] still worth anything today. */
export function learnedLinks(mem, now = Date.now()) {
  return Object.entries(mem.edges).map(([k, e]) => { const [a, b] = k.split('\u0001'); return [a, b, +effective(e, now, 0).toFixed(3)]; }).filter(x => x[2] >= 0.1);
}

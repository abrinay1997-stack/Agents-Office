// La búsqueda del Cerebro (nombres Y texto, sin tildes, con un fragmento alrededor del acierto). Pura: la usan
// serve.mjs (notas del disco) y el Worker de Cloudflare (notas de D1), así que contestan igual.
const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** entries: iterable de [nombre, texto]. Devuelve { q, hits } o { q, total, hits } (como siempre). */
export function buscarEnCerebro(entries, qRaw) {
  const q = fold(qRaw || '').trim().slice(0, 120); if (q.length < 2) return { q, hits: [] };
  const words = q.split(/\s+/).filter(Boolean), hits = [];
  for (const [name, raw] of entries) {
    const body = String(raw).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''), fn = fold(name), fb = fold(body);
    if (!words.every(w => fn.includes(w) || fb.includes(w))) continue;
    let score = 0; for (const w of words) { if (fn.includes(w)) score += 10; let i = -1, c = 0; while ((i = fb.indexOf(w, i + 1)) >= 0 && c < 20) c++; score += c; }
    const at = Math.max(0, fb.indexOf(words.find(w => fb.includes(w)) || words[0]));
    const snippet = at >= 0 && fb.includes(words[0]) || words.some(w => fb.includes(w)) ? (at > 50 ? '…' : '') + body.slice(Math.max(0, at - 50), at + 110).replace(/\s+/g, ' ').trim() + '…' : '';
    hits.push({ name, score, snippet, inName: words.every(w => fn.includes(w)) });
  }
  hits.sort((a, b) => b.score - a.score);
  return { q, total: hits.length, hits: hits.slice(0, 40) };
}

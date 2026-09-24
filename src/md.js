// Agents Office — a small, safe Markdown renderer for what the agents write (the chat, deliverables, the Brain's reader).
// Safety first: the whole text is HTML-escaped BEFORE any markup is added, so nothing an agent or a note says can
// become a tag or a script; links are http(s) only. Covers what the agents actually produce: headings, **bold**,
// *italics*, `code`, fenced code, lists (one nested level), > quotes, --- rules, | tables |, [[wiki links]], and the
// footer lines the skills ask for ("Used: …", "Skill: …", "Read: …") drawn as a quiet foot.

export const escHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FOOT = /^(used|usado|usé|skills?|read|leí|herramientas|tools)\s*:/i;

function inline(s) { // s is already escaped
  const kept = []; const keep = html => `\u0000${kept.push(html) - 1}\u0000`; // code and links are finished HTML: no emphasis inside them (a_b_c in a URL)
  s = s.replace(/`([^`\n]+)`/g, (_, c) => keep(`<code>${c}</code>`));
  // the Estudio's own files only (/media/…): an image, or a video link → a player. Anything else stays text.
  s = s.replace(/!\[([^\]\n]*)\]\((\/media\/[^\s)"'<>]+)\)/g, (_, alt, u) => keep(`<a class="md-media" href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="${alt}" loading="lazy"></a>`));
  s = s.replace(/\[([^\]\n]*)\]\((\/media\/[^\s)"'<>]+\.(?:mp4|webm))\)/gi, (_, t, u) => keep(`<video class="md-video" src="${u}" controls preload="metadata" title="${t.replace(/^▶\s*/, '')}"></video>`));
  s = s.replace(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g, (_, n) => keep(`<a class="md-wiki" data-note="${n.trim()}" role="button" tabindex="0">${n.trim()}</a>`));
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => keep(`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, pre, u) => pre + keep(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`));
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\w])__([^_\n]+)__(?!\w)/g, '$1<strong>$2</strong>');
  s = s.replace(/(^|[^\w*])\*([^*\s][^*\n]*?)\*(?!\w)/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\s][^_\n]*?)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/\(assumed\)|\(supuesto\)|\(asumido\)/gi, m => `<span class="md-assumed">${m}</span>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[+i]);
}

const cells = line => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
const isSep = line => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Markdown → safe HTML. opts.front: drop a leading --- front matter --- block (notes). */
export function mdToHtml(text, { front = false } = {}) {
  let src = String(text ?? '').replace(/\r\n?/g, '\n');
  if (front) src = src.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const lines = escHTML(src).split('\n');
  const out = []; let para = [], list = null, foot = [];
  const flushP = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i.text)}${i.sub.length ? `<ul>${i.sub.map(x => `<li>${inline(x)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</${list.tag}>`); list = null; } };
  const flush = () => { flushP(); flushL(); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], t = line.trim();
    if (/^```/.test(t)) { // fenced code: verbatim
      flush(); const body = [];
      for (i++; i < lines.length && !/^```/.test(lines[i].trim()); i++) body.push(lines[i]);
      out.push(`<pre><code>${body.join('\n')}</code></pre>`); continue;
    }
    if (!t) { flush(); continue; }
    if (FOOT.test(t) && (i >= lines.length - 4 || lines.slice(i + 1).every(l => !l.trim() || FOOT.test(l.trim()) || /^-{3,}$/.test(l.trim())))) { flush(); foot.push(inline(t)); continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(t))) { flush(); const lv = Math.min(6, m[1].length + 2); out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push('<hr>'); continue; }
    if (t.startsWith('&gt;')) { flush(); const q = [t.replace(/^&gt;\s?/, '')]; while (i + 1 < lines.length && lines[i + 1].trim().startsWith('&gt;')) q.push(lines[++i].trim().replace(/^&gt;\s?/, '')); out.push(`<blockquote>${q.map(inline).join('<br>')}</blockquote>`); continue; }
    const piped = l => /^\|.*\|$/.test((l || '').trim());
    if ((t.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) || (piped(t) && piped(lines[i + 1]))) { // a table — with the |---| line, or (as the agents write it) just rows of | … |
      flush(); const head = cells(t); if (isSep(lines[i + 1])) i++; const rows = [];
      while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) { const l = lines[++i]; if (!isSep(l)) rows.push(cells(l)); }
      out.push(`<div class="md-tbl"><table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if ((m = /^(\s*)([-*•·]|\d+[.)])\s+(.*)$/.exec(line))) {
      flushP(); const ordered = /\d/.test(m[2]), nested = m[1].length >= 2 && list;
      if (nested) { list.items[list.items.length - 1].sub.push(m[3]); continue; }
      const tag = ordered ? 'ol' : 'ul';
      if (!list || list.tag !== tag) { flushL(); list = { tag, items: [] }; }
      list.items.push({ text: m[3], sub: [] }); continue;
    }
    flushL(); para.push(t);
  }
  flush();
  if (foot.length) out.push(`<div class="md-foot">${foot.map(f => `<span>${f}</span>`).join('')}</div>`);
  return out.join('');
}

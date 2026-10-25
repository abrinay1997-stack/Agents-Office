// Agents Office — documents into the brain: the PURE half (which files are read, safe names, CSV and text → Markdown, the note). No libraries, no files:
// the Cloudflare Worker imports it. documents.mjs adds Word, Excel and PDF (mammoth, exceljs, pdfjs: they do not fit in a Worker).
export const KINDS = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', csv: 'CSV', txt: 'Texto', md: 'Markdown', json: 'JSON', html: 'HTML' };
export const MAX_BYTES = 15 * 1024 * 1024;
export const kindOf = name => { const e = (/\.([A-Za-z0-9]+)$/.exec(String(name || '')) || [])[1]?.toLowerCase(); return e && KINDS[e] ? e : null; };
export const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'documento';
export const cell = v => { if (v === null || v === undefined) return ''; if (typeof v === 'object') { if (v.text) return String(v.text); if (v.result !== undefined) return String(v.result); if (v.richText) return v.richText.map(r => r.text).join(''); if (v instanceof Date) return v.toISOString().slice(0, 10); return ''; } return String(v); };
export const table = rows => { const w = Math.max(...rows.map(r => r.length), 1); const esc = s => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim(); const full = rows.map(r => Array.from({ length: w }, (_, i) => esc(r[i] ?? ''))); return full.length ? [`| ${full[0].join(' | ')} |`, `| ${full[0].map(() => '---').join(' | ')} |`, ...full.slice(1).map(r => `| ${r.join(' | ')} |`)].join('\n') : ''; };
export function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false; const s = String(text).replace(/^﻿/, ''); const sep = (s.split('\n')[0].match(/;/g) || []).length > (s.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === sep) { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
/** The kinds that need no library: text, Markdown, JSON, HTML, CSV. Anything else → null. `bytes`: a Buffer or a Uint8Array. */
export function basicToMarkdown(k, bytes) {
  const text = () => new TextDecoder('utf-8').decode(bytes);
  if (k === 'txt' || k === 'md') return text();
  if (k === 'json') { try { return '```json\n' + JSON.stringify(JSON.parse(text()), null, 2).slice(0, 200000) + '\n```'; } catch { return text(); } }
  if (k === 'html') return text().replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
  if (k === 'csv') return table(parseCSV(text()).slice(0, 2000));
  return null;
}

/** The note: front matter (where it came from, when) + the text. */
export const note = (name, md, now = new Date()) => `---\nfuente: ${String(name).replace(/\n/g, ' ')}\ntipo: ${KINDS[kindOf(name)] || 'documento'}\nsubido: ${now.toISOString().slice(0, 10)}\nactualizado: ${now.toISOString().slice(0, 10)}\n---\n# ${String(name).replace(/\.[a-z0-9]+$/i, '')}\n\n${md.trim()}\n`;

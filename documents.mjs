// Agents Office — documents into the brain (V4.4, 25 Sep 2026; audit E9). The owner drops a PDF, a Word, an Excel, a CSV
// or a text file on the Brain; it becomes a Markdown note in <brain>/Documentos/ that every agent can find (the brain's
// search reads it by passage). Nothing leaves the machine: the conversion runs here.
import path from 'node:path';

export const KINDS = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', csv: 'CSV', txt: 'Texto', md: 'Markdown', json: 'JSON', html: 'HTML' };
export const MAX_BYTES = 15 * 1024 * 1024;
export const kindOf = name => { const e = path.extname(String(name || '')).slice(1).toLowerCase(); return KINDS[e] ? e : null; };
export const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'documento';
const cell = v => { if (v === null || v === undefined) return ''; if (typeof v === 'object') { if (v.text) return String(v.text); if (v.result !== undefined) return String(v.result); if (v.richText) return v.richText.map(r => r.text).join(''); if (v instanceof Date) return v.toISOString().slice(0, 10); return ''; } return String(v); };
const table = rows => { const w = Math.max(...rows.map(r => r.length), 1); const esc = s => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim(); const full = rows.map(r => Array.from({ length: w }, (_, i) => esc(r[i] ?? ''))); return full.length ? [`| ${full[0].join(' | ')} |`, `| ${full[0].map(() => '---').join(' | ')} |`, ...full.slice(1).map(r => `| ${r.join(' | ')} |`)].join('\n') : ''; };
export function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false; const s = String(text).replace(/^﻿/, ''); const sep = (s.split('\n')[0].match(/;/g) || []).length > (s.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === sep) { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
/** buf → Markdown text of the document (without front matter). */
export async function toMarkdown(name, buf) {
  const k = kindOf(name); if (!k) throw new Error('ese tipo de archivo no se puede leer: usa PDF, Word (.docx), Excel (.xlsx), CSV o texto');
  if (buf.length > MAX_BYTES) throw new Error('el archivo pasa de 15 MB');
  if (k === 'txt' || k === 'md') return buf.toString('utf8');
  if (k === 'json') { try { return '```json\n' + JSON.stringify(JSON.parse(buf.toString('utf8')), null, 2).slice(0, 200000) + '\n```'; } catch { return buf.toString('utf8'); } }
  if (k === 'html') return buf.toString('utf8').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
  if (k === 'csv') return table(parseCSV(buf.toString('utf8')).slice(0, 2000));
  if (k === 'docx') { const mammoth = (await import('mammoth')).default; const r = await mammoth.convertToMarkdown ? await mammoth.convertToMarkdown({ buffer: buf }) : await mammoth.extractRawText({ buffer: buf }); return String(r.value || '').replace(/\\([.()\-!#])/g, '$1').trim(); }
  if (k === 'xlsx') {
    const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    const out = []; wb.eachSheet(ws => { const rows = []; ws.eachRow({ includeEmpty: false }, r => { rows.push((r.values || []).slice(1).map(cell)); }); if (rows.length) out.push(`## ${ws.name}\n\n${table(rows.slice(0, 2000))}`); });
    return out.join('\n\n');
  }
  if (k === 'pdf') {
    // pdfjs-dist 6 calls Promise.withResolvers, which Node has only since 22; the office supports Node 20 (and GitHub checks
    // on it): without this, every PDF failed there with «Promise.withResolvers is not a function»
    if (typeof Promise.withResolvers !== 'function') Promise.withResolvers = function () { let resolve, reject; const promise = new this((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, verbosity: 0 }).promise;
    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 300); i++) { const c = await (await doc.getPage(i)).getTextContent(); let line = '', lastY = null; const lines = []; for (const it of c.items) { const y = it.transform?.[5]; if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = ''; } line += it.str + (it.hasEOL ? '\n' : ''); lastY = y; } lines.push(line.trim()); pages.push(`<!-- página ${i} -->\n${lines.filter(Boolean).join('\n')}`); }
    const text = pages.join('\n\n').trim();
    if (text.replace(/<!--.*?-->/g, '').trim().length < 3) throw new Error('el PDF no tiene texto (parece escaneado): exporta una versión con texto o pásalo por un OCR');
    return text;
  }
  throw new Error('tipo no soportado');
}
/** The note: front matter (where it came from, when) + the text. */
export const note = (name, md, now = new Date()) => `---\nfuente: ${String(name).replace(/\n/g, ' ')}\ntipo: ${KINDS[kindOf(name)] || 'documento'}\nsubido: ${now.toISOString().slice(0, 10)}\nactualizado: ${now.toISOString().slice(0, 10)}\n---\n# ${String(name).replace(/\.[a-z0-9]+$/i, '')}\n\n${md.trim()}\n`;

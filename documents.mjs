// Agents Office — documents into the brain (V4.4, 25 Sep 2026; audit E9). The owner drops a PDF, a Word, an Excel, a CSV
// or a text file on the Brain; it becomes a Markdown note in <brain>/Documentos/ that every agent can find (the brain's
// search reads it by passage). Nothing leaves the machine: the conversion runs here.
// (documents-core.mjs: the pure half — kinds, names, CSV, text → Markdown, the note — which the Cloudflare Worker imports too.)
import { KINDS, MAX_BYTES, kindOf, slug, parseCSV, basicToMarkdown, note, cell, table } from './documents-core.mjs';
export { KINDS, MAX_BYTES, kindOf, slug, parseCSV, note };

/** buf → Markdown text of the document (without front matter). */
export async function toMarkdown(name, buf) {
  const k = kindOf(name); if (!k) throw new Error('ese tipo de archivo no se puede leer: usa PDF, Word (.docx), Excel (.xlsx), CSV o texto');
  if (buf.length > MAX_BYTES) throw new Error('el archivo pasa de 15 MB');
  { const basic = basicToMarkdown(k, buf); if (basic !== null) return basic; }
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

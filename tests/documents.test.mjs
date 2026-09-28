// V4.4 — documents into the brain (documents.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../documents.mjs';

test('which files are read; names become safe note names', () => {
  assert.equal(D.kindOf('Lista de precios.PDF'), 'pdf'); assert.equal(D.kindOf('x.exe'), null);
  assert.equal(D.slug('Catálogo 2027 (final).pdf'), 'catalogo-2027-final');
});
test('CSV with commas or semicolons and quotes becomes a table', async () => {
  const md = await D.toMarkdown('precios.csv', Buffer.from('Producto;Precio\n"Web; landing";450\nTienda;1200\n'));
  assert.match(md, /\| Producto \| Precio \|/); assert.match(md, /\| Web; landing \| 450 \|/);
});
test('Excel sheets become tables', async () => {
  const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Precios'); ws.addRow(['Plan', 'US$']); ws.addRow(['Care', 99]);
  const md = await D.toMarkdown('precios.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
  assert.match(md, /## Precios/); assert.match(md, /\| Care \| 99 \|/);
});
test('a PDF with text is read page by page', async () => {
  // a minimal one-page PDF with the text «Hola PanaClaw»
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 20 100 Td (Hola PanaClaw) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  const md = await D.toMarkdown('hola.pdf', Buffer.from(pdf));
  assert.match(md, /Hola PanaClaw/); assert.match(md, /página 1/);
});
test('unsupported files and oversized ones are refused in plain words; the note says where it came from', async () => {
  await assert.rejects(D.toMarkdown('virus.exe', Buffer.from('x')), /no se puede leer/);
  assert.match(D.note('precios.csv', '| a |', new Date('2026-09-25')), /^---\nfuente: precios\.csv\ntipo: CSV\nsubido: 2026-09-25/);
});

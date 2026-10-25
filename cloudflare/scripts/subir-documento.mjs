#!/usr/bin/env node
// Sube un PDF, un Word o un Excel al Cerebro de la nube. Un Worker no puede leer esos formatos (sus librerías no caben), así que el documento se convierte AQUÍ,
// en tu computadora, con el mismo código de la oficina local (documents.mjs), y a la nube sube el texto como nota (Documentos/<nombre>.md).
//   AO_NUBE_EMAIL=… AO_NUBE_CLAVE=… node cloudflare/scripts/subir-documento.mjs https://agents-office.<tu>.workers.dev ruta/al/archivo.pdf
// La contraseña viene SOLO del entorno. Hasta 15 MB. Un PDF escaneado se rechaza con la razón (no tiene texto).
import fs from 'node:fs';
import path from 'node:path';
import { toMarkdown, kindOf, MAX_BYTES } from '../../documents.mjs';

export async function subir(base, archivo, { email, clave, fetchFn = fetch } = {}) {
  const nombre = path.basename(archivo);
  if (!kindOf(nombre)) throw new Error('ese tipo de archivo no se puede leer: usa un PDF, un Word (.docx), un Excel (.xlsx), un CSV o un texto');
  const bytes = fs.readFileSync(archivo);
  if (bytes.length > MAX_BYTES) throw new Error('el archivo pasa de 15 MB');
  const md = await toMarkdown(nombre, bytes);
  if (!String(md).trim()) throw new Error('el archivo no tiene texto que guardar');
  const entrar = await fetchFn(base + '/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, contrasena: clave }) });
  if (!entrar.ok) throw new Error('no pude entrar: revisa AO_NUBE_EMAIL y AO_NUBE_CLAVE');
  const cookie = (entrar.headers.get('set-cookie') || '').split(';')[0];
  const nota = nombre.replace(/\.[a-z0-9]+$/i, '') + '.md';
  const r = await fetchFn(base + '/api/brain/upload', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ name: nota, data: Buffer.from(md).toString('base64') }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `la nube contestó ${r.status}`);
  return j;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [base, archivo] = process.argv.slice(2);
  if (!/^(https:\/\/|http:\/\/localhost)/.test(base || '') || !archivo) { console.error('Uso: node cloudflare/scripts/subir-documento.mjs https://tu-oficina.workers.dev archivo.pdf'); process.exit(1); }
  try { const j = await subir(base.replace(/\/$/, ''), archivo, { email: process.env.AO_NUBE_EMAIL, clave: process.env.AO_NUBE_CLAVE }); console.log(`Listo: ${j.path} (${j.chars} caracteres)`); }
  catch (e) { console.error('No pude subirlo: ' + e.message); process.exit(1); }
}

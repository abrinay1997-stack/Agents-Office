#!/usr/bin/env node
// Sube el Cerebro de esta computadora a la oficina en Cloudflare (notas + mapa 3D ya calculado).
//   AO_NUBE_EMAIL=… AO_NUBE_CLAVE=… node scripts/migrar-a-nube.mjs https://agents-office.<tu>.workers.dev [--simulacro] [--solo=<módulo>] [--forzar]
// La contraseña va SOLO en variables de entorno (nunca en un archivo ni en la línea de comandos).
// Es idempotente: volver a correrla actualiza las notas, no las duplica. No borra nada de la nube. Lo que la nube ya trabaja (tareas, conversación con Dimitri, rutinas,
// ajustes y los demás documentos con algo dentro) NO se pisa: se dice «ya estaban en la nube» y sigue; --forzar los reemplaza.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, ROOT } from '../config.mjs';
import { readVault, readOfficeNotes } from '../graph-build.mjs';
import { layoutGraphFromNotes } from '../graph-core.mjs';

const MAX_NOTAS = 100, MAX_BYTES = 1_500_000;

/** Las notas del Cerebro (las del equipo y las entregas de los agentes) en la forma que espera el Worker. */
export function notasDelCerebro(vault) {
  const { notes, raw } = readVault(vault);
  const salida = [];
  const mtime = (p) => { try { return Math.trunc(fs.statSync(p).mtimeMs); } catch { return 0; } };
  for (const [nombre, n] of notes) salida.push({ nombre, grupo: n.group, oficina: 0, texto: n.text, actualizado: mtime(n.path) });
  for (const n of readOfficeNotes(vault)) {
    const tarea = /\ntask: (\S+)/.exec(n.text)?.[1] || null;
    salida.push({ nombre: n.name, grupo: 'Agents Office', oficina: 1, texto: n.text, actualizado: mtime(n.path), tarea });
    notes.set(n.name, { group: 'Agents Office', path: n.path, text: n.text });
    for (const m of n.text.matchAll(/\[\[([^\]|#]+)/g)) raw.push([n.name, m[1].trim().split('/').pop()]);
  }
  return { notas: salida, notes, raw };
}

/**
 * Los datos de cada módulo (tareas, rutinas, piezas…): cada archivo de scripts/migrar/<módulo>.mjs exporta
 *   export async function exportar({ raiz, vault }) → { filas: { coleccion: [{ id, valor, orden? }] }, docs: { clave: valor } }
 * Solo LEE de esta computadora; nunca incluye llaves ni contraseñas.
 */
export async function exportadores(dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrar')) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) out.push({ modulo: f.slice(0, -4), ...(await import(pathToFileURL(path.join(dir, f)).href)) });
  return out.filter((m) => typeof m.exportar === 'function');
}

/** Parte las filas de una colección en subidas de como mucho 200 (el máximo del Worker). */
export function partirFilas(filas, max = 200) { const o = []; for (let i = 0; i < filas.length; i += max) o.push(filas.slice(i, i + max)); return o; }

/** Parte las notas en subidas que no pasen de MAX_NOTAS ni de MAX_BYTES. */
export function lotes(notas) {
  const out = []; let actual = [], bytes = 0;
  for (const n of notas) {
    const b = Buffer.byteLength(n.texto) + 400;
    if (actual.length && (actual.length >= MAX_NOTAS || bytes + b > MAX_BYTES)) { out.push(actual); actual = []; bytes = 0; }
    actual.push(n); bytes += b;
  }
  if (actual.length) out.push(actual);
  return out;
}

async function api(base, ruta, { cookie, cuerpo } = {}) {
  const r = await fetch(base + ruta, { method: cuerpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`${ruta}: ${d.error || r.status}`), { estado: r.status });
  return { d, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

if (process.argv[1] && process.argv[1].endsWith('migrar-a-nube.mjs')) {
  const base = (process.argv[2] || '').replace(/\/$/, '');
  const simulacro = process.argv.includes('--simulacro');
  if (!/^(https:\/\/|http:\/\/localhost)/.test(base)) { console.error('Uso: node scripts/migrar-a-nube.mjs https://tu-sitio.workers.dev [--simulacro]'); process.exit(1); }
  const vault = loadConfig().brainPath;
  const { notas, notes, raw } = notasDelCerebro(vault);
  console.log(`Cerebro local: ${notas.length} notas (${notas.filter((n) => n.oficina).length} entregas de agentes) en ${vault}`);
  const grafo = await layoutGraphFromNotes(notes, raw);
  console.log(`Mapa 3D calculado: ${grafo.nodes.length} notas con enlaces, ${grafo.links.length} enlaces.`);
  const partes = lotes(notas);
  if (simulacro) { for (const mod of await exportadores()) { const { filas = {}, docs = {} } = await mod.exportar({ raiz: ROOT, vault }); console.log(`  ${mod.modulo}: ${Object.entries(filas).map(([c, l]) => `${l.length} en ${c}`).concat(Object.keys(docs).map((d) => `doc ${d}`)).join(', ') || 'nada'}`); } console.log(`Simulacro: se harían ${partes.length} subida(s). No se envió nada.`); process.exit(0); }
  const email = process.env.AO_NUBE_EMAIL, clave = process.env.AO_NUBE_CLAVE;
  if (!email || !clave) { console.error('Faltan AO_NUBE_EMAIL y AO_NUBE_CLAVE (variables de entorno).'); process.exit(1); }
  const { cookie } = await api(base, '/api/acceso', { cuerpo: { email, contrasena: clave } });
  let i = 0;
  for (const p of partes) { i++; const { d } = await api(base, '/api/migrar/notas', { cookie, cuerpo: { notas: p, ...(process.argv.includes('--forzar') ? { forzar: true } : {}) } }); console.log(`  subida ${i}/${partes.length}: ${p.length} notas (en la nube: ${d.notas})`); }
  const { d } = await api(base, '/api/migrar/notas', { cookie, cuerpo: { grafo } });
  console.log(`Mapa subido: ${d.grafo ? 'sí' : 'no'}. En la nube: ${d.notas} notas.`);
  const solo = (process.argv.find((a) => a.startsWith('--solo=')) || '').slice(7), forzar = process.argv.includes('--forzar');
  for (const mod of await exportadores()) {
    if (solo && mod.modulo !== solo) continue;
    const { filas = {}, docs = {} } = await mod.exportar({ raiz: ROOT, vault });
    const omitidas = [];
    for (const [coleccion, lista] of Object.entries(filas)) for (const parte of partirFilas(lista)) { const { d } = await api(base, '/api/migrar/filas', { cookie, cuerpo: { coleccion, filas: parte, ...(forzar ? { forzar: true } : {}) } }); if (d.omitidas) omitidas.push(`${d.omitidas} de ${coleccion}`); }
    // Un documento que la nube ya tiene (y tiene algo dentro) NO se pisa: desde la primera migración la nube es la copia de trabajo. Se dice y se sigue con el resto.
    for (const [clave, valor] of Object.entries(docs)) {
      try { await api(base, '/api/migrar/docs', { cookie, cuerpo: { clave, valor, ...(forzar ? { forzar: true } : {}) } }); }
      catch (e) { if (e.estado === 409) omitidas.push(`doc ${clave}`); else throw e; }
    }
    console.log(`  ${mod.modulo}: ${Object.entries(filas).map(([c, l]) => `${l.length} en ${c}`).concat(Object.keys(docs).map((d) => `doc ${d}`)).join(', ') || 'nada que subir'}`);
    if (omitidas.length) console.log(`    · ya estaban en la nube y NO se pisaron: ${omitidas.join(', ')} (con --forzar se reemplazan)`);
  }
  await api(base, '/api/salir', { cookie, cuerpo: {} }).catch(() => {});
}

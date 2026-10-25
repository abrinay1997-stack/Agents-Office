// Migración del Estudio a la nube (fase 8a): lo que `node scripts/migrar-a-nube.mjs` sube de este módulo.
//   filas  'estudio-fichas'    la ficha de cada archivo de la galería (lo que en la oficina era el .json de al lado)
//   docs   'estudio.carpetas'  las carpetas del dueño
//          'estudio.voces'     sus voces de MiniMax (diseñadas o clonadas; solo voiceId, nombre, tipo y fecha: ninguna llave)
//   archivos                   los BYTES de cada archivo, que no caben en una subida de JSON: se suben uno a uno con
//                              PUT /api/media/archivo/<clave> (solo administrador; el Worker les pone la ficha de 'estudio-fichas')
// Uso suelto (sube también los archivos):  AO_NUBE_EMAIL=… AO_NUBE_CLAVE=… node scripts/migrar/estudio.mjs https://tu-sitio.workers.dev [--simulacro]
// No incluye la papelera, los trabajos en marcha ni lo gastado del día. Solo LEE de esta computadora.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOPE_ARCHIVO = 60 * 1024 * 1024; // lo máximo que un Worker recibe de una vez (los más grandes se dicen y se quedan en la computadora)
const MES = /^\d{4}-\d{2}$/, ARCHIVO = /^\d{4}-\d{2}\/[^/\\]+\.(png|jpe?g|webp|svg|mp4|webm|mp3|wav|flac|m4a|ogg)$/i;
const leerJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** `vault`: la carpeta del Cerebro; la galería vive en <vault>/Agents Office/media. `raiz`: este repositorio (data/ con las voces). */
export async function exportar({ raiz, vault, galeria } = {}) {
  const base = galeria || path.join(vault || '', 'Agents Office', 'media');
  const fichas = [], archivos = [], grandes = [];
  if (fs.existsSync(base)) {
    for (const mes of fs.readdirSync(base).filter((x) => MES.test(x))) {
      const dir = path.join(base, mes), nombres = new Set(fs.readdirSync(dir));
      for (const f of nombres) {
        if (!f.endsWith('.json')) continue;
        const it = leerJson(path.join(dir, f));
        if (!it || typeof it.file !== 'string' || !ARCHIVO.test(it.file) || it.file.includes('..') || !nombres.has(it.file.split('/').pop())) continue;
        const { hf, ...ficha } = it; // la copia de la referencia en Higgsfield caduca en horas: no viaja
        const ruta = path.join(dir, it.file.split('/').pop()), tam = fs.statSync(ruta).size;
        if (tam > TOPE_ARCHIVO) { grandes.push({ clave: it.file, tam }); continue; }
        fichas.push({ id: it.file, valor: ficha, orden: Number(it.at) || 0 });
        archivos.push({ clave: it.file, ruta, tam });
      }
    }
  }
  const carpetas = leerJson(path.join(base, 'folders.json'));
  const datos = path.join(raiz || '', 'data');
  const v = leerJson(path.join(process.env.AO_DATA || datos, 'minimax-voices.json'));
  const docs = {};
  if (carpetas && Array.isArray(carpetas.folders) && carpetas.folders.length) docs['estudio.carpetas'] = { folders: carpetas.folders };
  if (v && Array.isArray(v.voices) && v.voices.length) docs['estudio.voces'] = { voices: v.voices.map(({ voiceId, name, kind, at, pinned, prompt, consent }) => ({ voiceId, name, kind, at, pinned: !!pinned, ...(prompt ? { prompt } : {}), ...(consent ? { consent } : {}) })) };
  return { filas: fichas.length ? { 'estudio-fichas': fichas } : {}, docs, archivos, grandes };
}

/** Sube los bytes de los archivos (después de las fichas): uno por petición, idempotente (la misma clave se reescribe). */
export async function subirArchivos({ base, cookie, archivos, fetchFn = fetch, alAvanzar = () => {} }) {
  let n = 0;
  for (const a of archivos) {
    const r = await fetchFn(`${base}/api/media/archivo/${encodeURIComponent(a.clave)}`, { method: 'PUT', headers: { cookie, 'content-type': 'application/octet-stream' }, body: fs.readFileSync(a.ruta) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(`${a.clave}: ${d.error || r.status}`); }
    n++; alAvanzar(n, archivos.length, a);
  }
  return n;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const base = (process.argv[2] || '').replace(/\/$/, ''), simulacro = process.argv.includes('--simulacro');
  if (!/^(https:\/\/|http:\/\/localhost)/.test(base)) { console.error('Uso: node scripts/migrar/estudio.mjs https://tu-sitio.workers.dev [--simulacro]'); process.exit(1); }
  const { loadConfig } = await import('../../config.mjs');
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { filas, docs, archivos, grandes } = await exportar({ raiz, vault: loadConfig().brainPath });
  console.log(`Estudio local: ${archivos.length} archivos (${(archivos.reduce((s, a) => s + a.tam, 0) / 1048576).toFixed(1)} MB), ${Object.keys(docs).length} documento(s)${grandes.length ? `, ${grandes.length} más grandes de 60 MB que se quedan aquí` : ''}.`);
  if (simulacro) { console.log('Simulacro: no se envió nada.'); process.exit(0); }
  const email = process.env.AO_NUBE_EMAIL, clave = process.env.AO_NUBE_CLAVE;
  if (!email || !clave) { console.error('Faltan AO_NUBE_EMAIL y AO_NUBE_CLAVE (variables de entorno).'); process.exit(1); }
  const login = await fetch(base + '/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, contrasena: clave }) });
  if (!login.ok) { console.error('No pude entrar a la nube con ese correo y esa contraseña.'); process.exit(1); }
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const post = async (ruta, cuerpo) => { const r = await fetch(base + ruta, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(cuerpo) }); if (!r.ok) throw new Error(`${ruta}: ${(await r.json().catch(() => ({}))).error || r.status}`); };
  for (const [coleccion, lista] of Object.entries(filas)) for (let i = 0; i < lista.length; i += 200) await post('/api/migrar/filas', { coleccion, filas: lista.slice(i, i + 200) });
  for (const [k, valor] of Object.entries(docs)) await post('/api/migrar/docs', { clave: k, valor });
  const n = await subirArchivos({ base, cookie, archivos, alAvanzar: (i, t) => { if (i % 25 === 0 || i === t) console.log(`  ${i}/${t} archivos`); } });
  console.log(`Listo: ${n} archivos del Estudio en la nube.`);
}

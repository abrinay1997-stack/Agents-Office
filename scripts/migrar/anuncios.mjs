// Lo que Anuncios de Meta y la Bandeja recuerdan en esta computadora, para llevarlo a la nube (fase 7 de Cloudflare). Solo LEE.
//   los borradores de campaña y su papelera · las sugerencias (y lo que se midió de las aplicadas) · el historial de cambios · el diario de las
//   creaciones en Meta (para que una que quedó a medias se retome sin duplicar) · la cola de conversiones que aún espera salir · lo que ya se avisó ·
//   la Bandeja (el estado de cada mensaje: borradores, respondidos, ocultos) · y los ajustes de Anuncios y Contenido (ids y topes; nunca un token).
// NO sube: las cifras diarias, la estructura de la cuenta ni lo leído de Meta (la nube lo vuelve a leer en su primera lectura), ni ninguna llave
// (META_ACCESS_TOKEN y las demás van como secretos del Worker: cloudflare/secretos.json).
// Cada archivo va como un documento `anuncios.migracion.<nombre>` = { ruta, texto }; el Worker lo pasa a su sitio la primera vez que se abre Anuncios o
// la Bandeja (cloudflare/worker/lib/anuncios-nube.js → aplicarMigracion) con una lista blanca de rutas y comprobando que el texto sea JSON.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../../config.mjs';

/** nombre del documento → ruta dentro de data/ (la MISMA en la nube). */
export const ARCHIVOS = {
  borradores: 'data/anuncios/borradores.json', papelera: 'data/anuncios/papelera.json', sugerencias: 'data/anuncios/sugerencias.json',
  creaciones: 'data/anuncios/creaciones.json', conversiones: 'data/anuncios/conversiones.json', avisados: 'data/anuncios/avisados.json', historial: 'data/anuncios/historial.jsonl',
  bandeja: 'data/contenido/bandeja.json', 'bandeja-meta': 'data/contenido/bandeja-meta.json',
};
const MAX = 1_900_000; // una fila de D1 no pasa de 2 MB

/** Quita de un texto cualquier cosa que parezca un token de Meta (por si un error guardado lo citara). Defensa extra: el cliente ya los quita. */
const sinTokens = (t) => String(t).replace(/EAA[A-Za-z0-9]{20,}/g, '…');

export async function exportar({ raiz, vault: _vault } = {}) {
  const datos = process.env.AO_DATA ? path.resolve(process.env.AO_DATA) : path.join(raiz, 'data');
  const docs = {}, avisos = [];
  for (const [nombre, ruta] of Object.entries(ARCHIVOS)) {
    const f = path.join(datos, ruta.slice('data/'.length));
    let texto; try { texto = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!texto.trim()) continue;
    const doc = { ruta, texto: sinTokens(texto) };
    const peso = new TextEncoder().encode(JSON.stringify(doc)).length; // BYTES de la fila (escapes y UTF-8 incluidos), no caracteres
    if (peso > MAX) { avisos.push(`${ruta} pesa ${(peso / 1e6).toFixed(2)} MB y no cabe en una fila de D1 (tope ${(MAX / 1e6).toFixed(1)} MB): no se sube (se vuelve a leer de Meta o se parte a mano)`); continue; }
    docs[`anuncios.migracion.${nombre}`] = doc;
  }
  const c = loadConfig();
  const ajustes = { anuncios: { ...(c.anuncios || {}) }, contenido: { modo: c.contenido?.modo, bandejaFuente: c.contenido?.bandejaFuente, metaPagina: c.contenido?.metaPagina, redes: c.contenido?.redes }, approvals: { undoSeconds: c.approvals?.undoSeconds }, name: c.name };
  for (const k of Object.keys(ajustes.contenido)) if (ajustes.contenido[k] === undefined) delete ajustes.contenido[k];
  if (ajustes.approvals.undoSeconds === undefined) delete ajustes.approvals;
  docs['anuncios.ajustes'] = JSON.parse(sinTokens(JSON.stringify(ajustes)));
  for (const a of avisos) console.warn('  anuncios: ' + a);
  return { filas: {}, docs };
}

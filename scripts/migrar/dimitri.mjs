// Exportador de la fase 6 (Dimitri): su conversación y su archivo de conversaciones. Solo LEE; nunca llaves.
//   filas.subgerente   data/subgerente.json   un mensaje por fila (el id y el orden del archivo)
//   docs['subgerente.archivo']  data/subgerente-archivo.json   las conversaciones archivadas (se restauran desde «Nueva conversación → DESHACER» en la oficina local; en la nube se guardan para leerlas)
import fs from 'node:fs';
import path from 'node:path';

const leer = (f, defecto = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return defecto; } };
export const nombre = 'dimitri', modulo = 'dimitri';

export function exportar({ raiz } = {}) {
  const data = path.join(raiz, 'data');
  const st = leer(path.join(data, 'subgerente.json'), { messages: [] });
  const ms = (Array.isArray(st?.messages) ? st.messages : []).filter((m) => m && typeof m === 'object' && m.id);
  const filas = { subgerente: ms.map((m, i) => ({ id: String(m.id), valor: m, orden: Number(m.at) ? Number(m.at) + i / 1000 : i })) };
  const docs = {}, ar = leer(path.join(data, 'subgerente-archivo.json'), null);
  if (ar && typeof ar === 'object') docs['subgerente.archivo'] = ar;
  return { filas, docs, resumen: { mensajes: ms.length, archivadas: Array.isArray(ar?.items) ? ar.items.length : 0 } };
}

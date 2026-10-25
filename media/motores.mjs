// Agents Office — el Estudio: los MOTORES (F0 del banco de presets, 1 oct 2026: salió de media.mjs, que es la fachada).
// Hablar con cada servicio: la prueba gratis, Google (Nano Banana y Veo), Grok, OpenAI, Meta, fal.ai, MiniMax y Higgsfield.
// RUN[engine](model, job, ctx) genera y entrega cada archivo con ctx.add(buf, ext); friendly() dice el error en palabras.
// 25 oct 2026 (fase 8a del puerto a Cloudflare): el código de cada motor vive en media/motores-core.mjs, sin disco ni entorno, y
// aquí solo se le da lo de ESTA máquina: los archivos de la galería en el disco, process.env y un bucle que espera. El Worker de
// la nube usa el mismo core con R2, sus secretos y un paso por cron. tests/media-fachada.test.mjs vigila que nada cambió.
import fs from 'node:fs';
import { resolve, item, update } from './galeria.mjs';
import { crearMotores, veoRequest as veoCore, friendly } from './motores-core.mjs';

export { friendly };
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4' };
// the media a job uses (gallery ids) → what each engine takes. `data` reads the file when an engine asks for it (not before)
function inputFiles(job) {
  const out = { start: [], end: [], reference: [], video: [], audio: [] };
  for (const role of Object.keys(out)) for (const id of (job.media?.[role] || [])) {
    const p = resolve(id); if (!p) throw new Error(`no encuentro el archivo «${id}» en el Estudio`);
    const ext = p.split('.').pop().toLowerCase();
    out[role].push({ id, p, ext, mime: MIME[ext], get data() { return fs.readFileSync(p); } });
  }
  return out;
}
/** Veo's request body (tests/google.test.mjs): the files may be bare { p, mime } — their bytes are read from the disk. */
export const veoRequest = (m, job, files) => veoCore(m, job, files, f => f.data ?? fs.readFileSync(f.p));

export const { RUN } = crearMotores({ env: () => process.env, inputFiles, item, update, paso: false });

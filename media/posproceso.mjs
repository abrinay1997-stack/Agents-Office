// Agents Office — el Estudio: lo de después del modelo (banco de presets, integración F1, 1 oct 2026; §5.5, §5.7, §5.9).
// runJob (media/trabajos.mjs) pasa por aquí cada imagen que trae un trabajo con pasos locales (`post`) o comprobaciones
// (`qa`): primero imagen-local.pipeline (fondo blanco, encuadre, tonos, LUT, copiar color, exportar sin EXIF), después la QA
// determinista de verificar.mjs. Un trabajo «local» (todo en esta máquina, sin IA) también pasa por aquí, con la foto del dueño
// como entrada. Sin sharp: NoDisponible, y el trabajo lo dice; nada se manda a la IA en su lugar (D3).
import fs from 'node:fs';
import path from 'node:path';
import * as L from '../imagen-local.mjs';
import { verificar } from '../verificar.mjs';
import { cargarFabrica } from '../presets/fabrica.mjs';
import { dir, resolve } from './galeria.mjs';

let CANALES = null;
/** Los canales de la fábrica (presets/canales.json), leídos una vez. */
export function canales() {
  if (!CANALES) { try { CANALES = cargarFabrica().canales || []; } catch { CANALES = []; } }
  return CANALES;
}
/** El canal del trabajo: el de un paso que lo nombre, o el del pedido; con los números del paso encima. */
export function canalDe(pasos = [], id = null) {
  const op = pasos.find(p => p && typeof p === 'object' && (p.canal || p.op === 'exportar'));
  const cid = op?.canal || id;
  const base = cid ? canales().find(c => c.id === cid) || null : null;
  if (!base && !(op && op.ancho)) return null;
  const extra = op && op.op === 'exportar' ? Object.fromEntries(['ancho', 'alto', 'proporcion', 'formato', 'pesoMaxKB', 'fondo'].filter(k => op[k] != null).map(k => [k, op[k]])) : {};
  return { ...(base || { id: cid || 'propio' }), ...extra };
}
const leerArchivo = id => { const p = id ? resolve(String(id)) : null; return p ? fs.readFileSync(p) : null; };

/** Los crudos del modelo, 7 días en media/.crudo (cuentan para el disco del semáforo). Nunca rompe el trabajo. */
export function guardarCrudo(j, n, buf, ext) {
  try {
    if (!dir()) return null;
    const d = path.join(dir(), '.crudo'); fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, `${j.id}-${n}.${ext}`); fs.writeFileSync(f, buf);
    const cut = Date.now() - 7 * 864e5;
    for (const x of fs.readdirSync(d)) { try { const p = path.join(d, x); if (fs.statSync(p).mtimeMs < cut) fs.unlinkSync(p); } catch {} }
    return f;
  } catch { return null; }
}

/** Una imagen del trabajo `j` por sus pasos locales y su QA.
 *  j: { post: [op], qa: [id], medir: { ocupacion: { objetivo, tolerancia, fuente } }, canal, versionOf, esEscena }
 *  → { buffer, ext, post: { pasos, medido, avisos }, qa: { estado, checks, motivo } | null, nombre } */
export async function procesar(buf, j = {}) {
  const pasos = Array.isArray(j.post) ? j.post : [];
  const canal = canalDe(pasos, j.canal);
  const ref = pasos.find(p => p && p.op === 'transferir-color' && p.ref)?.ref;
  const original = j.versionOf ? leerArchivo(j.versionOf) : null;
  const out = await L.pipeline(buf, pasos.map(({ de, ...p }) => p), {
    canal, referencia: ref ? leerArchivo(ref) : undefined, original: original || undefined, sku: j.sku || undefined, n: j.n || 1,
  });
  let qa = null;
  let ids = Array.isArray(j.qa) ? j.qa.filter(x => typeof x === 'string') : [];
  // copiar el color de una referencia cambia el color A PROPÓSITO: medir ΔE contra tu foto daría un «revisar» falso
  const colorCopiado = !!ref && ids.includes('delta-e'); if (colorCopiado) ids = ids.filter(x => x !== 'delta-e');
  const extra = colorCopiado ? [{ id: 'delta-e', ok: null, valor: null, objetivo: null, motivo: 'No medido: el color se copió de la referencia a propósito (en tu máquina, sin IA).' }] : [];
  if (!ids.length && extra.length) qa = { estado: 'ok', checks: extra, motivo: '' };
  if (ids.length) {
    const oc = j.medir?.ocupacion || null, deEscena = oc?.fuente === 'escena';
    // con el escenario 3D la ocupación se compara con la estimada de la escena (±12 puntos), no con la del canal
    const lista = deEscena ? [...new Set(ids.map(x => (x === 'ocupacion' ? 'escena' : x)))] : ids;
    const canalQa = canal ? { ...canal, ...(deEscena ? { ocupacion: undefined } : {}) } : {};
    qa = await verificar(out.buffer, {
      qa: lista, canal: canalQa,
      objetivo: !deEscena && oc && oc.objetivo != null ? { ocupacion: oc.objetivo, tolerancia: oc.tolerancia ?? 0.03 } : {},
      escena: deEscena ? { ocupacionEstimada: oc.objetivo, tolerancia: oc.tolerancia ?? 0.12 } : undefined,
      esEscena: !!j.esEscena, original: original || undefined,
    });
    if (extra.length) qa = { ...qa, checks: [...qa.checks, ...extra] };
  }
  const medido = { ...out.medido, ...(qa?.medido ? Object.fromEntries(Object.entries(qa.medido).filter(([, v]) => v != null)) : {}) };
  return {
    buffer: out.buffer, ext: out.formato === 'jpeg' ? 'jpg' : out.formato,
    post: { pasos: out.pasos, medido, avisos: out.avisos },
    qa: qa ? { estado: qa.estado, checks: qa.checks, motivo: qa.motivo } : null,
    nombre: out.nombre || null,
  };
}
export { L as imagenLocal };

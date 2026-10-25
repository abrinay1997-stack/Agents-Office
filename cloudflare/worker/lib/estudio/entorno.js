// El Estudio en la nube: el entorno. La oficina local lee sus keys de process.env y su configuración de office.config.json;
// el Worker, de SUS secretos (env.*, nunca escritos en un archivo) y de un documento `estudio.config` en D1.
// Las keys no salen nunca en una respuesta, un registro ni un error: aquí solo se copian a los módulos puros que las usan.
import * as catalogo from '../../../../media/catalogo.mjs';
import * as mmx from '../../../../minimax.mjs';
import { S } from '../../../../media/estado.mjs';
import { leerDoc, guardarDoc } from '../almacen.js';

/** Los nombres de los secretos que el Estudio lee (cloudflare/secretos.json los declara). */
export const CLAVES = ['HF_KEY', 'HF_API_KEY', 'HF_API_SECRET', 'HF_API_BASE_URL', 'GEMINI_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'FAL_KEY', 'MINIMAX_API_KEY', 'MINIMAX_GROUP_ID', 'MINIMAX_API_BASE',
  'AO_GEMINI_BASE', 'AO_META_BASE', 'AO_FAL_RUN', 'AO_FAL_QUEUE', 'AO_POLL_MS']; // las AO_* apuntan a un doble de prueba: solo las pone un test

/** Un objeto con SOLO lo que el Estudio necesita del env del Worker (así nada más se cuela en un módulo compartido). */
export function entornoDe(env) {
  const o = {};
  for (const k of CLAVES) if (typeof env?.[k] === 'string' && env[k]) o[k] = env[k];
  return o;
}

export const CLAVE_CONFIG = 'estudio.config';
const DEFECTO = { dailyLimit: 40, maxPerRequest: 8, concurrency: 3 };
/** Lo que el dueño puede fijar para el Estudio de la nube (en la oficina local es Ajustes → Estudio / office.config.json → media). */
const NUM = ['dailyLimit', 'dailyBudget', 'monthlyBudget', 'maxPerRequest', 'concurrency'];
export function validarConfig(b) {
  const out = {};
  for (const k of NUM) if (b?.[k] !== undefined) {
    const v = Number(b[k]);
    if (!Number.isFinite(v) || v < 0 || v > 1_000_000) return { ok: false, error: `«${k}» debe ser un número de 0 en adelante (0 = sin tope).` };
    out[k] = k === 'maxPerRequest' ? Math.max(1, Math.min(30, Math.floor(v))) : k === 'concurrency' ? Math.max(1, Math.min(6, Math.floor(v))) : v;
  }
  if (b?.departments !== undefined) {
    if (!Array.isArray(b.departments) || b.departments.some((d) => !['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'].includes(d))) return { ok: false, error: 'departments: una lista de departamentos de la oficina.' };
    out.departments = [...new Set(b.departments)];
  }
  if (b?.default !== undefined) {
    if (!b.default || typeof b.default !== 'object' || Array.isArray(b.default)) return { ok: false, error: 'default: { image, video, audio, music } con ids de modelo.' };
    out.default = Object.fromEntries(Object.entries(b.default).filter(([k, v]) => catalogo.KINDS.includes(k) && typeof v === 'string' && catalogo.model(v)));
  }
  return { ok: true, valor: out };
}
export async function leerConfig(db) { return (await leerDoc(db, CLAVE_CONFIG, {})).valor || {}; }
export async function guardarConfig(db, cambios) {
  const actual = await leerConfig(db);
  await guardarDoc(db, CLAVE_CONFIG, { ...actual, ...cambios });
  return { ...actual, ...cambios };
}

/**
 * Deja los módulos compartidos (catálogo, MiniMax, configuración del Estudio) mirando al env de ESTE Worker. Se llama al empezar
 * cada petición y cada paso del cron: el Worker no recuerda nada entre peticiones, y una isla puede servir a un env distinto en un test.
 */
export async function prepararEstudio(env, db) {
  const e = entornoDe(env);
  catalogo.setEnv(e); mmx.setEnv(e);
  const cfg = await leerConfig(db);
  S.cfg = { ...DEFECTO, ...cfg, models: { ...catalogo.DEFAULT_MODELS, ...(cfg.models || {}) } };
  catalogo.setCustom(cfg.custom);
  return { e, cfg: S.cfg, departments: Array.isArray(cfg.departments) ? cfg.departments : ['marketing', 'delivery', 'sales', 'ops'] };
}
export const motoresEncendidos = () => catalogo.engines().filter((x) => x.id !== 'prueba' && x.on).map((x) => x.id);

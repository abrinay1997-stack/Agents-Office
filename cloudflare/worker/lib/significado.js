// Cerebro en la nube — buscar por SIGNIFICADO (issue #45, idea 2: «embeddings sumados a BM25»). Hoy los agentes encuentran notas por palabras (knowledge.mjs: BM25 por pasajes); si la pregunta usa otras palabras que
// la nota («cuánto guarda eBot las conversaciones» frente a «se borran solas a los 90 días»), la nota no aparece. Un vector por pasaje arregla justo eso; el ranking híbrido (palabras + significado) ya existe en
// knowledge.search y es el mismo código que usa la oficina local con sus embeddings.
//
// Cómo se enciende (a propósito a mano y con números, no a ciegas):
//  1 · hace falta un modelo de significado: el binding `AI` de Cloudflare (Workers AI, bge-m3, multilingüe) o un secreto GEMINI_API_KEY / OPENAI_API_KEY / VOYAGE_API_KEY (knowledge.embedder).
//  2 · «Indexar» guarda un vector por pasaje de las notas escritas (de a LOTE por llamada) en `notas_vectores`.
//  3 · «Medir» corre las preguntas de evals-cerebro/preguntas.json con palabras solas y con significado, y enseña los dos resultados.
//  4 · «Activar para los agentes» (doc `cerebro.significado`): solo entonces los agentes usan el ranking híbrido. Si el modelo falla, o hay pocos pasajes con vector, la búsqueda sigue como siempre (por palabras).
import * as knowledge from '../../../knowledge.mjs';
import { resumir } from '../../../cerebro-evals.mjs';
import PREGUNTAS from '../../../evals-cerebro/preguntas.json' with { type: 'json' };
import { leerDoc, guardarDoc } from './almacen.js';
import * as costos from './agentes/costos.js';
import { leerCfg } from './ajustes.js';

export const MODELO_CF = '@cf/baai/bge-m3';
export const DOC_SIGNIFICADO = 'cerebro.significado';
export const LOTE = 24;                 // pasajes por llamada al modelo
export const MAX_PASAJES = 4000;        // tope de pasajes con vector (≈ 5,6 MB); más que eso no se indexa
export const MIN_COBERTURA = 0.8;       // fracción de los pasajes de las notas escritas que debe tener vector para usar el ranking híbrido
const MAX_TEXTO = 1500;                 // letras de un pasaje que ve el modelo
const NO_BUSCAR = new Set(['CLAUDE', 'index', 'log']);

/* ------------------------------------------------------------------ vectores ------------------------------------------------------------------ */

/** Un vector de números → enteros de 8 bits en base64 con su escala. cos(a, b) no cambia al cuantizar (la escala se cancela al normalizar). */
export function cuantizar(vec) {
  let max = 0; for (const x of vec) max = Math.max(max, Math.abs(x));
  const escala = max || 1, u = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) u[i] = Math.max(-127, Math.min(127, Math.round((vec[i] / escala) * 127)));
  let bin = ''; const bytes = new Uint8Array(u.buffer);
  for (let i = 0; i < bytes.length; i += 4096) bin += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return { escala, v: btoa(bin) };
}
export function descuantizar(b64) {
  const bin = atob(String(b64)), u = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = (bin.charCodeAt(i) << 24) >> 24;
  return u;
}

/* ------------------------------------------------------------------ el modelo ------------------------------------------------------------------ */

/**
 * → { id, nombre, proveedor, embed(textos) → Promise<number[][]> } o null si no hay con qué. `env.__pruebas.embedder` lo sustituye en las pruebas.
 * Prefiere Workers AI (el binding `AI`: sin secretos que subir) y, si no, el primero de los secretos de knowledge.embedder (Gemini, OpenAI, Voyage).
 */
export function embedder(env) {
  if (env?.__pruebas?.embedder) return env.__pruebas.embedder;
  if (env?.AI && typeof env.AI.run === 'function') {
    return { id: 'cf-bge-m3', nombre: 'Cloudflare bge-m3 (Workers AI)', proveedor: 'cloudflare', embed: async (textos) => {
      const r = await env.AI.run(MODELO_CF, { text: textos }), d = r?.data ?? r?.embeddings;
      if (!Array.isArray(d) || d.length !== textos.length || !Array.isArray(d[0])) throw new Error('Workers AI no devolvió los vectores esperados.');
      return d;
    } };
  }
  const k = knowledge.embedder(env || {});
  if (!k) return null;
  const id = k.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { id, nombre: k.name, proveedor: /gemini/i.test(k.name) ? 'google' : /openai/i.test(k.name) ? 'openai' : 'voyage', embed: k.embed };
}

/** Lo que cuesta embeber estos textos, para el libro de costos (unos 4 caracteres por token). Workers AI tiene capa gratis: se apunta como estimado 0. */
const tokensDe = (textos) => Math.ceil(textos.reduce((t, x) => t + String(x).length, 0) / 4);
async function anotarCosto(db, emb, textos, ms) {
  try { const cfg = await leerCfg(db); await costos.anotar(db, { tipo: 'embeddings', modelo: emb.id, proveedor: emb.proveedor, usage: { input_tokens: tokensDe(textos), output_tokens: 0 }, cfgPrices: cfg.costs?.prices, ms }); } catch { /* el libro no tumba una búsqueda */ }
}

/* ------------------------------------------------------------------ pasajes ------------------------------------------------------------------ */

/** Los pasajes de las notas ESCRITAS (no las entregas de los agentes): [{ hash, nota, texto }]. */
export function pasajesDe(filas) {
  const out = [];
  for (const f of filas) { if (f.oficina || NO_BUSCAR.has(f.nombre)) continue; for (const p of knowledge.passages(f.nombre, f.texto)) out.push({ hash: p.hash, nota: f.nombre, texto: (p.head && !p.text.startsWith('#') ? p.head + '\n' : '') + p.text }); }
  return out;
}
const escritas = async (db) => (await db.prepare('select nombre, grupo, oficina, texto from notas where oficina = 0').all()).results;

/* ------------------------------------------------------------------ estado e indexar ------------------------------------------------------------------ */

const leerAjuste = async (db) => { const v = (await leerDoc(db, DOC_SIGNIFICADO, {})).valor || {}; return { activo: !!v.activo, medido: v.medido || null }; };

/** Lo que se ve al abrir: ¿hay modelo?, ¿cuántos pasajes tienen vector?, ¿está encendido? No llama al modelo. */
export async function estadoSignificado({ db, env }) {
  const emb = embedder(env), ajuste = await leerAjuste(db), pas = pasajesDe(await escritas(db));
  const unicos = new Map(pas.map((p) => [p.hash, p]));
  const hechos = emb ? new Set((await db.prepare('select hash from notas_vectores where modelo = ?').bind(emb.id).all()).results.map((r) => r.hash)) : new Set();
  const con = [...unicos.keys()].filter((h) => hechos.has(h)).length;
  return {
    hayModelo: !!emb, modelo: emb ? { id: emb.id, nombre: emb.nombre } : null,
    pasajes: unicos.size, conVector: con, faltan: unicos.size - con, cobertura: unicos.size ? +(con / unicos.size).toFixed(3) : 0, cabe: unicos.size <= MAX_PASAJES,
    activo: ajuste.activo, medido: ajuste.medido,
  };
}

/** Embebe hasta LOTE pasajes que aún no tienen vector y borra los de pasajes que ya no existen. → { ok, hechos, faltan, borrados } */
export async function indexarLote({ db, env }) {
  const emb = embedder(env); if (!emb) return { error: 'No hay un modelo de significado: falta el binding AI de Workers AI o uno de los secretos GEMINI_API_KEY, OPENAI_API_KEY o VOYAGE_API_KEY.', estado: 409 };
  const pas = new Map(pasajesDe(await escritas(db)).map((p) => [p.hash, p]));
  if (pas.size > MAX_PASAJES) return { error: `Son ${pas.size} pasajes: pasa del tope de ${MAX_PASAJES} para guardar significado aquí.`, estado: 409 };
  const guardados = (await db.prepare('select hash from notas_vectores where modelo = ?').bind(emb.id).all()).results.map((r) => r.hash);
  const viejos = guardados.filter((h) => !pas.has(h)), tengo = new Set(guardados);
  for (let i = 0; i < viejos.length; i += 80) await db.prepare(`delete from notas_vectores where modelo = ? and hash in (${viejos.slice(i, i + 80).map(() => '?').join(',')})`).bind(emb.id, ...viejos.slice(i, i + 80)).run();
  const faltan = [...pas.values()].filter((p) => !tengo.has(p.hash)), lote = faltan.slice(0, LOTE);
  if (lote.length) {
    const textos = lote.map((p) => p.texto.slice(0, MAX_TEXTO)), t0 = Date.now(); let vecs;
    try { vecs = await emb.embed(textos); } catch (e) { return { error: 'El modelo de significado no contestó: ' + String(e?.message || e).slice(0, 160), estado: 502 }; }
    if (!Array.isArray(vecs) || vecs.length !== lote.length) return { error: 'El modelo de significado devolvió otra cantidad de vectores que de pasajes.', estado: 502 };
    const ahora = Date.now(), stmts = lote.map((p, i) => { const { escala, v } = cuantizar(vecs[i]); return db.prepare('insert or replace into notas_vectores (hash, modelo, nota, dim, escala, v, creado) values (?,?,?,?,?,?,?)').bind(p.hash, emb.id, p.nota, vecs[i].length, escala, v, ahora); });
    await db.batch(stmts);
    await anotarCosto(db, emb, textos, Date.now() - t0);
  }
  return { ok: true, hechos: lote.length, faltan: Math.max(0, faltan.length - lote.length), borrados: viejos.length };
}

/* ------------------------------------------------------------------ usar el significado ------------------------------------------------------------------ */

/** → { [hash]: Int8Array } de todos los vectores de este modelo. */
export async function cargarVectores(db, modeloId) {
  const { results } = await db.prepare('select hash, v from notas_vectores where modelo = ?').bind(modeloId).all();
  return Object.fromEntries(results.map((r) => [r.hash, descuantizar(r.v)]));
}

/**
 * Lo que necesita knowledge.search para el ranking híbrido: { vectors, queryVec } o null (sin modelo, apagado, pocos pasajes con vector o el modelo falló: la búsqueda sigue por palabras).
 * `forzar`: ignora el interruptor (para MEDIR antes de activar).
 */
export async function semanticaPara({ db, env, texto, forzar = false }) {
  try {
    const L = await listo({ db, env, forzar }); if (!L) return null;
    const q = String(texto || '').slice(0, MAX_TEXTO), t0 = Date.now(), [queryVec] = await L.emb.embed([q]);
    if (!Array.isArray(queryVec)) return null;
    await anotarCosto(db, L.emb, [q], Date.now() - t0);
    return { vectors: L.vectors, queryVec };
  } catch (e) { console.error('significado: se busca por palabras —', String(e?.message || e).slice(0, 200)); return null; }
}

/** Los vectores y los pasajes de ahora si el significado está listo para usarse (hay modelo, está encendido —o `forzar`— y la cobertura alcanza); si no, null. */
async function listo({ db, env, forzar = false }) {
  const emb = embedder(env); if (!emb) return null;
  if (!forzar && !(await leerAjuste(db)).activo) return null;
  const vectors = await cargarVectores(db, emb.id); if (!Object.keys(vectors).length) return null;
  const pasajes = pasajesDe(await escritas(db)), unicos = new Set(pasajes.map((p) => p.hash)), cubiertos = [...unicos].filter((h) => vectors[h]).length;
  return unicos.size && cubiertos / unicos.size >= MIN_COBERTURA ? { emb, vectors, pasajes } : null;
}

const coseno = (a, b) => { let x = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { x += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? x / Math.sqrt(na * nb) : 0; };

/**
 * Las notas más cercanas por SIGNIFICADO a un texto (una nota nueva que aún no tiene vectores): cuenta el mejor pasaje de cada nota, así una nota larga y variada no se pierde por promediarse.
 * Sirve para sumar candidatas a «Actualizar conexiones» que las palabras no encuentran.
 * → [nombre] (como mucho k, las más cercanas primero, sin las de `excluir`) o [] si el significado no está encendido o falla.
 */
export async function vecinasPorSignificado({ db, env, texto, excluir = new Set(), k = 8 }) {
  try {
    const L = await listo({ db, env }); if (!L) return [];
    const [q] = await L.emb.embed([String(texto || '').slice(0, MAX_TEXTO)]); if (!Array.isArray(q)) return [];
    const mejor = new Map();
    for (const p of L.pasajes) { const v = L.vectors[p.hash]; if (!v || excluir.has(p.nota)) continue; const c = coseno(q, v); if (c > (mejor.get(p.nota) ?? -1)) mejor.set(p.nota, c); }
    return [...mejor].filter(([, s]) => s > 0.3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map(([n]) => n);
  } catch (e) { console.error('significado: vecinas por palabras —', String(e?.message || e).slice(0, 200)); return []; }
}

/* ------------------------------------------------------------------ medir y activar ------------------------------------------------------------------ */

/** Corre las preguntas del conjunto de evals con palabras solas y con significado. → { n, palabras, significado, mejoran, empeoran } o { error } si las notas de las preguntas no existen aquí. */
export async function medirSignificado({ db, env }) {
  const emb = embedder(env); if (!emb) return { error: 'No hay un modelo de significado.', estado: 409 };
  const filas = await escritas(db), notas = new Map(filas.map((f) => [f.nombre, f.texto]));
  const preguntas = PREGUNTAS.preguntas.filter((p) => p.esperadas.some((e) => notas.has(e))).map((p) => ({ ...p, esperadas: p.esperadas.filter((e) => notas.has(e)) }));
  if (preguntas.length < 20) return { error: 'Las preguntas de prueba son de las notas de fábrica y aquí faltan casi todas: no se puede medir con ellas.', estado: 409 };
  const vectors = await cargarVectores(db, emb.id); if (!Object.keys(vectors).length) return { error: 'Primero indexa las notas.', estado: 409 };
  const ix = knowledge.buildIndex(new Map([...notas].filter(([k]) => !NO_BUSCAR.has(k))));
  const t0 = Date.now(), qv = []; for (let i = 0; i < preguntas.length; i += LOTE) qv.push(...await emb.embed(preguntas.slice(i, i + LOTE).map((p) => p.q)));
  await anotarCosto(db, emb, preguntas.map((p) => p.q), Date.now() - t0);
  const rank = (p, i, hibrido) => knowledge.search(ix, p.q, { n: 10, per: 1, ...(hibrido ? { vectors, queryVec: qv[i] } : {}) }).filter((x) => x.score > 0).map((x) => x.note);
  const a = preguntas.map((p, i) => ({ ...p, ranking: rank(p, i, false) })), b = preguntas.map((p, i) => ({ ...p, ranking: rank(p, i, true) }));
  const ra = resumir(a), rb = resumir(b), pos = (c) => { const i = c.ranking.findIndex((x) => c.esperadas.includes(x)); return i < 0 ? 99 : i; };
  const mejoran = [], empeoran = [];
  a.forEach((c, i) => { const x = pos(c), y = pos(b[i]); if (y < x) mejoran.push(c.id); else if (y > x) empeoran.push(c.id); });
  const med = { n: preguntas.length, palabras: { recall: ra.recall, mrr: ra.mrr }, significado: { recall: rb.recall, mrr: rb.mrr }, mejoran, empeoran, modelo: emb.id, at: Date.now() };
  const aj = await leerAjuste(db); await guardarDoc(db, DOC_SIGNIFICADO, { activo: aj.activo, medido: med });
  return { ok: true, ...med };
}

/** Enciende o apaga el ranking híbrido de los agentes. Solo con vectores hechos. */
export async function activarSignificado({ db, env, activo }) {
  const aj = await leerAjuste(db);
  if (activo) { const e = await estadoSignificado({ db, env }); if (!e.hayModelo || e.cobertura < MIN_COBERTURA) return { error: 'Primero indexa las notas: faltan pasajes con significado.', estado: 409 }; }
  await guardarDoc(db, DOC_SIGNIFICADO, { activo: !!activo, medido: aj.medido });
  return { ok: true, activo: !!activo };
}

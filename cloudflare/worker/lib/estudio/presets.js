// El banco de presets del Estudio en la nube (Fase 4 A+B, 29 oct 2026). Las MISMAS rutas y formas que la oficina local (presets.mjs), con el
// mismo cálculo puro (presets-api-core.mjs) y la misma fábrica (presets/fabrica-worker.js, el JSON de la oficina empaquetado):
//   · lista y compilar: no gastan nada;
//   · aplicar: compila otra vez y pide el trabajo con trabajos.pedir (topes del día y del mes, solo un administrador con motores de pago);
//   · los presets del dueño son NOTAS del Cerebro (tabla `notas`, grupo «Estudio», cabecera `tipo: preset`): neuronas como cualquier otra, con su
//     papelera de 30 días; la versión de antes de cada guardado queda en `filas` (colección `presets-versiones`, las últimas 20 por preset).
// Lo que necesita sharp (retoques locales, la QA que mide, el blanco 255, copiar el color) NO corre en un Worker: el compilador lo dice con
// `capacidades.local = false` y esos presets salen marcados «solo en la oficina», nunca caen a la IA en su lugar y nunca llevan un ✓ inventado.
import { cargarFabrica } from '../../../../presets/fabrica-worker.js';
import * as API from '../../../../presets-api-core.mjs';
import * as notas from '../../../../presets-notas.mjs';
import * as core from '../../../../src/presets-core.js';
import * as e3 from '../../../../src/escena3d-core.js';
import * as catalogo from '../../../../media/catalogo.mjs';
import { leerDoc } from '../almacen.js';
import { ahora } from '../ids.js';
import * as cerebro from '../cerebro.js';
import * as galeria from './galeria.js';
import * as trabajos from './trabajos.js';

export const GRUPO_NOTAS = 'Estudio';
export const COLECCION_VERSIONES = 'presets-versiones';
export const MAX_VERSIONES = 20;
export const SIN_LOCAL = 'Los retoques de foto (luz, color, fondo blanco, recorte) todavía no corren en la nube: siguen en la oficina de tu computadora.';
export const AVISO_QA = 'La revisión automática (QA) todavía no corre en la nube: mira el resultado antes de usarlo.';

const orden = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sinMd = (n) => String(n).replace(/\.md$/i, '');
const esPreset = (md) => notas.notaAPreset(md, {}).preset != null;

/** Mensajes del compilador que dicen «esta máquina»: en la nube se dice dónde sí funciona. */
const enNube = (t) => String(t).replace(/no está disponible en esta máquina \(falta sharp\)/g, 'todavía no está disponible en la nube (los retoques de foto siguen en la oficina de tu computadora)');

/** Las notas de presets del dueño, en el orden de siempre (por nombre de archivo). */
async function notasDePresets(db) {
  const { results } = await db.prepare(`select nombre, texto from notas where grupo = ? and texto like '%tipo: preset%' limit 500`).bind(GRUPO_NOTAS).all();
  return results.filter((r) => esPreset(r.texto)).sort((a, b) => orden(`${a.nombre}.md`, `${b.nombre}.md`))
    .map((r) => ({ archivo: `${notas.CARPETA}/${r.nombre}.md`, nombre: `${r.nombre}.md`, md: r.texto }));
}

/** La fábrica, los presets del dueño y el contexto del compilador (modelos encendidos, cifras de la empresa). */
export async function cargar(db) {
  const fab = cargarFabrica();
  const propios = API.propiosDeNotas(await notasDePresets(db), { fab });
  const banco = API.bancoDe({ fab, ...propios });
  const cifras = (await leerDoc(db, 'cifras', null)).valor;
  const models = catalogo.models();
  const ctx = API.contextoDe({ fab, models, caps: (m) => catalogo.capsOf(m.id || m, { familias: fab.familias }), cifras: Array.isArray(cifras?.items) ? cifras.items : [], local: false });
  return { fab, banco, ctx };
}

/** GET /api/media/presets */
export async function lista(db, filtro = {}) {
  const { fab, banco, ctx } = await cargar(db);
  return API.listar(banco, ctx, filtro, { fab, sinLocal: SIN_LOCAL, sharp: false });
}

/** POST /api/media/presets/compile: el plan, sin gastar nada. */
export async function compilar(db, b = {}) {
  const { banco, ctx } = await cargar(db);
  const r = API.compilar(b, banco, ctx);
  return { plan: conAvisos(r.plan), pedido: r.pedido };
}
function conAvisos(plan) {
  const errores = (plan.errores || []).map(enNube);
  const avisos = [...(plan.avisos || [])];
  if (Array.isArray(plan.qa) && plan.qa.length && !avisos.some((a) => a.tipo === 'qa')) avisos.push({ tipo: 'qa', texto: AVISO_QA });
  return { ...plan, errores, avisos };
}

/** La guía del escenario 3D se sube UNA vez por escena (la galería la muestra como «Guía de composición»). → { file, nueva } */
async function guiaDe(env, db, escena) {
  const h = (await sha1(JSON.stringify(e3.normalizar(escena)))).slice(0, 16);
  const ya = await db.prepare(`select file from estudio_archivos where papelera_at is null and json like ? and json like ? limit 1`).bind('%"guia":true%', `%"escena":"${h}"%`).first();
  if (ya) return { file: ya.file, nueva: false };
  const dataUrl = e3.guiaPNG(escena, { lado: 768 });
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const it = await galeria.store(env, db, buf, 'png', { prompt: 'Guía de composición (escenario 3D)', provider: 'subida', model: '', by: 'you', upload: true, agent: null, task: null, guia: true, escena: h });
  return { file: it.file, nueva: true };
}
async function sha1(t) { const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(t)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''); }

/** POST /api/media/presets/apply: lo único que gasta, y solo con el clic GENERAR. Pasa por los topes del Estudio (trabajos.pedir). → { plan, jobs, avisos } */
export async function aplicar(env, db, b = {}, { usuario } = {}) {
  const { banco, ctx } = await cargar(db);
  let A;
  try { A = API.planAplicar(b, banco, ctx); } // lanza Error(status 400, plan) si el plan trae errores: nada se sube ni se gasta
  catch (e) { if (e.plan) { e.message = enNube(e.message); e.plan = conAvisos(e.plan); } throw e; }
  const P = A.pedido;
  const creados = [];
  try {
    let c = A.plan;
    if (c.guia?.pendiente) { const g = await guiaDe(env, db, P.escena); if (g.nueva) creados.push(g.file); c = core.ponerGuia(c, g.file); }
    const { pre, post, qa, ...req } = c.request; // pre/post/qa necesitan sharp: aquí no hay (el plan ya no los trae cuando local=false; esto lo asegura)
    void pre; void post; void qa;
    const j = await trabajos.pedir(env, db, { ...req, canal: A.canal, esEscena: A.esEscena, receta: A.receta, folder: P.folder, purpose: 'banco de presets' }, { usuario, presets: true });
    const plan = conAvisos(c);
    return { plan, jobs: [j], avisos: plan.avisos };
  } catch (e) {
    for (const f of creados) { try { await galeria.trash(db, f); } catch { /* una guía de más no daña */ } } // un clic repetido con el tope alcanzado no llena la galería de guías
    throw e;
  }
}

/* ---------- los presets propios: notas del Cerebro ---------- */
const tapaDeVersiones = (id) => `${id}:`;
async function guardarVersion(db, id, texto) {
  const clave = `${id}:${String(Date.now()).padStart(13, '0')}`;
  await db.prepare(`insert or replace into filas (coleccion, id, json, orden, actualizado) values (?,?,?,0,?)`).bind(COLECCION_VERSIONES, clave, JSON.stringify({ at: Date.now(), texto }), ahora()).run();
  // solo las últimas MAX_VERSIONES de este preset
  await db.prepare(`delete from filas where coleccion = ? and id like ? and id not in (select id from filas where coleccion = ? and id like ? order by id desc limit ${MAX_VERSIONES})`)
    .bind(COLECCION_VERSIONES, `${tapaDeVersiones(id)}%`, COLECCION_VERSIONES, `${tapaDeVersiones(id)}%`).run();
}

/** POST /api/media/presets: «Guardar como preset» — una nota en el Cerebro (grupo «Estudio»). Si ya existe con ese nombre, la versión de antes se guarda y la nueva sube su v. */
export async function guardar(env, db, b = {}, { usuario } = {}) {
  const nombre = API.nombreLimpio(b);
  const item = !(b.receta && typeof b.receta === 'object') && typeof b.desde === 'string' ? await galeria.item(db, b.desde) : null;
  const r = API.recetaDeGuardar(b, item);
  const { fab } = await cargar(db);
  const propios = API.propiosDeNotas(await notasDePresets(db), { fab }).propios;
  const mismo = propios.find((x) => x.id === notas.idDesdeNombre(nombre));
  const nota = mismo ? sinMd(mismo.archivo.split('/').pop()) : sinMd(notas.archivoDeNombre(nombre));
  const fila = await db.prepare('select texto, actualizado from notas where nombre = ?').bind(nota).first();
  if (fila && !esPreset(fila.texto)) throw Object.assign(new Error(`Ya hay una nota llamada «${nota}» que no es un preset: elige otro nombre.`), { status: 409 });
  const byId0 = new Map(fab.presets.map((p) => [p.id, p]));
  const antes = fila ? notas.notaAPreset(fila.texto, { byId: byId0 }).preset : null;
  const hoy = new Date().toISOString().slice(0, 10);
  const { p, byId } = API.presetParaGuardar(b, r, { fab, antes, hoy });
  const md = notas.presetANota(p, { byId, previa: fila?.texto ?? null });
  const por = String(usuario?.nombre || usuario?.email || 'alguien').slice(0, 80);
  let res;
  if (fila) {
    res = await cerebro.guardarNota(db, { nombre: nota, texto: md, base: fila.actualizado, por });
    if (!res.error) await guardarVersion(db, p.id, fila.texto);
  } else res = await cerebro.crearNota(db, { nombre: nota, texto: md, grupo: GRUPO_NOTAS, por });
  if (res.error) throw Object.assign(new Error(res.error), { status: res.estado || 400 });
  return { preset: p, archivo: `${notas.CARPETA}/${nota}.md`, nota };
}

/** DELETE /api/media/presets/<id>: la nota va a la papelera del Cerebro (30 días). → true | false si ese preset no es del dueño */
export async function borrar(db, id, { usuario } = {}) {
  const { fab } = await cargar(db);
  const p = API.propiosDeNotas(await notasDePresets(db), { fab }).propios.find((x) => x.id === id);
  if (!p) return false;
  const r = await cerebro.mandarAPapelera(db, sinMd(p.archivo.split('/').pop()), { por: String(usuario?.nombre || usuario?.email || 'alguien').slice(0, 80) });
  if (r.error) throw Object.assign(new Error(r.error), { status: r.estado || 400 });
  await db.prepare('delete from filas where coleccion = ? and id like ?').bind(COLECCION_VERSIONES, `${tapaDeVersiones(id)}%`).run(); // sus versiones no quedan huérfanas
  return true;
}

/** GET /api/media/presets/<id>/versiones: las versiones de antes de un preset del dueño, de la más nueva a la más vieja. */
export async function versiones(db, id) {
  if (!API.ID_RE.test(id)) return [];
  const { results } = await db.prepare(`select json from filas where coleccion = ? and id like ? order by id desc limit ${MAX_VERSIONES}`).bind(COLECCION_VERSIONES, `${tapaDeVersiones(id)}%`).all();
  return results.map((r) => { const v = JSON.parse(r.json); const p = notas.notaAPreset(v.texto).preset; return { at: v.at, v: p?.v || null, nombre: p?.nombre || id }; });
}

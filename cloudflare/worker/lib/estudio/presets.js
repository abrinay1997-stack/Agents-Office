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
import { leerConfig } from './entorno.js';
import { hayRetoques, motivoPreset, motivoPlan, retocar } from './retoques.js';

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
export async function cargar(db, env = null) {
  const retoques = env ? hayRetoques(env, await leerConfig(db)) : false; // Fase 4 D: con el interruptor y el binding IMAGES, unos retoques de foto SÍ corren en la nube
  const fab = cargarFabrica();
  const propios = API.propiosDeNotas(await notasDePresets(db), { fab });
  const banco = API.bancoDe({ fab, ...propios });
  const cifras = (await leerDoc(db, 'cifras', null)).valor;
  const models = catalogo.models();
  const ctx = API.contextoDe({ fab, models, caps: (m) => catalogo.capsOf(m.id || m, { familias: fab.familias }), cifras: Array.isArray(cifras?.items) ? cifras.items : [], local: retoques });
  return { fab, banco, ctx, retoques };
}

/** GET /api/media/presets */
export async function lista(db, filtro = {}, env = null) {
  const { fab, banco, ctx, retoques } = await cargar(db, env);
  return API.listar(banco, ctx, filtro, retoques ? { fab, localOk: motivoPreset, sharp: true } : { fab, sinLocal: SIN_LOCAL, sharp: false });
}

/** POST /api/media/presets/compile: el plan, sin gastar nada. */
export async function compilar(db, b = {}, env = null, cargado = null) { // `cargado`: lo de cargar() ya hecho (un lote compila muchas filas: la fábrica y las notas se leen una vez)
  const { banco, ctx, retoques } = cargado || await cargar(db, env);
  const r = API.compilar(b, banco, ctx);
  return { plan: conAvisos(r.plan, retoques), pedido: r.pedido };
}
function conAvisos(plan, retoques = false) {
  const errores = (plan.errores || []).map(enNube);
  if (retoques && !errores.length) { const m = motivoPlan(plan); if (m) errores.push(m); } // lo que IMAGES no hace: el plan lo dice y no se aplica
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

/** POST /api/media/presets/apply: lo único que gasta, y solo con el clic GENERAR. Pasa por los topes del Estudio (trabajos.pedir). → { plan, jobs, avisos }
 *  Con los retoques de la nube encendidos (Fase 4 D): lo todo-local se hace aquí mismo, gratis y sin IA, como una versión nueva de tu foto; lo de «antes» de la IA
 *  se hace sobre tu foto y la IA recibe esa copia; lo de «después» lo hace el cron cuando llega la imagen (trabajos.js). */
export async function aplicar(env, db, b = {}, { usuario, cargado = null, purpose = 'banco de presets' } = {}) { // `purpose`: un lote pone aquí su marca (lote <id>:<n>) para no mandar una foto dos veces
  const { banco, ctx, retoques } = cargado || await cargar(db, env);
  let A;
  try {
    A = API.planAplicar(b, banco, ctx); // lanza Error(status 400, plan) si el plan trae errores: nada se sube ni se gasta
    const m = retoques ? motivoPlan(A.plan) : '';
    if (m) throw Object.assign(new Error(m), { status: 400, plan: A.plan });
  } catch (e) { if (e.plan) { e.message = enNube(e.message); e.plan = conAvisos(e.plan, retoques); } throw e; }
  const P = A.pedido, creados = [], leer = (id) => galeria.leerBytes(env, id);
  try {
    let c = A.plan;
    if (c.soloLocal) return await aplicarLocal(env, db, { A, c, P, leer, usuario, retoques, purpose });
    if (c.guia?.pendiente) { const g = await guiaDe(env, db, P.escena); if (g.nueva) creados.push(g.file); c = core.ponerGuia(c, g.file); }
    const { pre, qa, ...req } = c.request; // la QA que mide necesita sharp: no corre aquí (el plan lo avisa)
    void qa;
    if (pre?.length) { // §5.2: lo de antes, antes — la IA recibe tu foto ya preparada
      if (!retoques || !A.foto || req.media.reference?.[0] !== A.foto) throw Object.assign(new Error('Lo de antes de la IA (luz y color) todavía no se puede hacer en la nube: no se manda a la IA en su lugar.'), { status: 400 });
      const bytes = await leer(A.foto); if (!bytes) throw Object.assign(new Error('no encuentro tu foto en el Estudio'), { status: 400 });
      const r = await retocar(env, bytes, pre, { leerRef: leer });
      const it = await galeria.store(env, db, Buffer.from(r.bytes), r.ext, { prompt: 'Tu foto, preparada para la IA', provider: 'subida', model: '', by: 'you', upload: true, agent: null, task: null, prep: true, versionOf: A.foto, post: { pasos: r.pasos, avisos: r.avisos } });
      creados.push(it.file); req.media = { ...req.media, reference: [it.file, ...req.media.reference.slice(1)] };
    }
    const j = await trabajos.pedir(env, db, { ...req, canal: A.canal, esEscena: A.esEscena, receta: A.receta, folder: P.folder, purpose }, { usuario, presets: true });
    const plan = conAvisos(c, retoques);
    return { plan, jobs: [j], avisos: plan.avisos };
  } catch (e) {
    for (const f of creados) { try { await galeria.trash(db, f); } catch { /* una guía o una copia de más no daña */ } } // un clic repetido con el tope alcanzado no llena la galería
    throw e;
  }
}

/** Todo local: una versión nueva de tu foto, sin IA, gratis, el original intacto (la oficina local hace lo mismo con sharp). */
async function aplicarLocal(env, db, { A, c, P, leer, retoques, purpose }) {
  const mal = (m) => Object.assign(new Error(m), { status: 400 });
  if (!A.foto) throw mal('Lo local trabaja sobre tu foto: súbela o elige una de la galería');
  const bytes = await leer(A.foto); if (!bytes) throw mal('tu foto ya no está en el Estudio');
  const carpeta = P.folder ? await galeria.folderOf(db, P.folder) : null, byId = A.byId;
  const prompt = c.preset.map((x) => byId.get(x.id)?.nombre || x.id).join(' + ') || 'Edición en la nube';
  const r = await retocar(env, bytes, [...c.local.antes, ...c.local.despues], { leerRef: leer });
  const it = await galeria.store(env, db, Buffer.from(r.bytes), r.ext, { prompt, provider: 'local', model: '', modelName: 'En la nube (sin IA)', cost: 0, by: 'you', agent: null, task: null, versionOf: A.foto, preset: c.preset, receta: A.receta, ...(A.canal ? { canal: A.canal } : {}),
    post: { pasos: r.pasos, medido: {}, avisos: r.avisos }, ...(carpeta ? { folder: carpeta.id } : {}) });
  await galeria.update(db, A.foto, { versions: [...new Set([...(Array.isArray((await galeria.item(db, A.foto))?.versions) ? (await galeria.item(db, A.foto)).versions : []), it.file])] }).catch(() => {});
  const avisos = [...r.avisos, ...(r.sinHacer.length ? [`no se hizo: ${r.sinHacer.join(' · ')}`] : [])];
  const j = await trabajos.registrarLocal(db, { prompt, item: it, source: A.foto, preset: c.preset, receta: A.receta, canal: A.canal, folder: carpeta?.id, avisos, purpose });
  const plan = conAvisos(c, retoques);
  return { plan, jobs: [j], avisos: plan.avisos };
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

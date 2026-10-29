// El Estudio en la nube: los TRABAJOS. En la oficina local un trabajo corre en el fondo de un proceso que no se muere; un Worker
// no puede esperar minutos dentro de una petición, así que aquí cada trabajo es una fila de D1 (`estudio_trabajos`) que se avanza
// por PASOS, uno a la vez, en el cron de cada minuto (y cuando la página pregunta, si el paso es corto):
//   · pedir() valida TODO antes de gastar (modelo, llave, prompt, medios, topes del día y del mes) y solo crea la fila;
//   · un paso toma el permiso del trabajo (`lease`, con caducidad), apunta que va a ENVIAR antes de llamar al motor y suelta el permiso;
//   · los motores con cola (Higgsfield, fal, Veo, MiniMax video) guardan su id remoto antes de nada y en cada paso solo preguntan
//     "¿ya?" (el motor lanza Pendiente y el trabajo sigue en marcha); los que contestan en el acto hacen todo en su paso;
//   · ENVIAR a un motor de pago es lo único que no se repite: si un paso murió a medias, el trabajo NO se vuelve a enviar solo,
//     se dice que puede haberse cobrado y el dueño decide si reintenta.
// Lo puro (validación, topes, rastro) es media/trabajos-core.mjs; los motores, media/motores-core.mjs: los mismos de la oficina local.
import { S } from '../../../../media/estado.mjs';
import { model, engines as engines_ } from '../../../../media/catalogo.mjs';
import { limpiarSecretos } from '../secretos.js';
import * as mmx from '../../../../minimax.mjs';
import { explicar } from '../../../../media/errores.mjs';
import { sniffExt, MEDIA_MIME } from '../../../../media/galeria-core.mjs';
import { crearMotores } from '../../../../media/motores-core.mjs';
import { usageOf, spendOn, budgetOf, checkBudgetOf, armarTrabajo, pubJob, editRequestOf, weightOf } from '../../../../media/trabajos-core.mjs';
import { mutarDoc, leerDoc } from '../almacen.js';
import * as galeria from './galeria.js';
import { entornoDe } from './entorno.js';

const USO = 'estudio.uso';
const LEASE_MS = 10 * 60e3, EMPUJE_MS = 3000, MAX_TRABAJOS = 400, SEMANA = 7 * 864e5;
export const AVISO_PRUEBA = 'una tarjeta de prueba';
let GANCHOS = {}, FETCH = null;
/** Lo que se hace al terminar un trabajo (en la oficina local: costos, tareas de agentes, Telegram…). Lo conecta quien porte esa fase. */
export const setGanchos = (h = {}) => { GANCHOS = { ...GANCHOS, ...h }; };
/** Para las pruebas: un fetch de mentira para los motores (nunca la red real). */
export const usarFetch = (f) => { FETCH = f; };

/* ---------- el presupuesto ---------- */
export async function usoDelDia(env, db) {
  const { valor } = await leerDoc(db, USO, null);
  return usageOf(valor, galeria.diaLocal(Date.now(), galeria.ZONA(env)));
}
const filas = (results) => results.map((r) => JSON.parse(r.json));
async function activos(db) { const { results } = await db.prepare(`select json from estudio_trabajos where estado in ('queued','running')`).all(); return filas(results); }
export async function budget(env, db) { return budgetOf(await usoDelDia(env, db), await activos(db), S.cfg); }
export async function checkBudget(env, db, est) { return checkBudgetOf(est, await budget(env, db)); }
async function gastar(env, db, kind, n, cost) {
  const dia = galeria.diaLocal(Date.now(), galeria.ZONA(env));
  await mutarDoc(db, USO, null, (v) => spendOn(usageOf(v, dia), kind, n, cost), { intentos: 30 }); // varios trabajos pueden terminar a la vez: se reintenta hasta que entre
}
/** Dinero que el Estudio gasta fuera de un trabajo (una voz de MiniMax diseñada o clonada): cuenta en el día y el mes. */
export async function charge(env, db, usd) { const c = +(+usd || 0).toFixed(3); if (c > 0) await gastar(env, db, 'images', 0, c); return budget(env, db); }

/* ---------- la fila ---------- */
const pub = pubJob;
const cargar = async (db, id) => { const r = await db.prepare('select json, cancelar from estudio_trabajos where id = ?').bind(id).first(); if (!r) return null; const j = JSON.parse(r.json); if (r.cancelar) j.cancel = true; return j; };
async function guardarFila(db, j) { await db.prepare('update estudio_trabajos set json = ?, estado = ?, paso = ? where id = ?').bind(JSON.stringify(j), j.state, Date.now(), j.id).run(); }

export async function jobs(db, { task, active } = {}) {
  const { results } = await db.prepare('select json from estudio_trabajos order by at desc, rowid desc').all();
  return filas(results).filter((j) => (!task || j.task === task) && (!active || j.state === 'queued' || j.state === 'running')).map(pub);
}
export async function job(db, id) { const j = await cargar(db, id); return j ? pub(j) : null; }

/* ---------- pedir ---------- */
/** Lo que la página (o un agente) puede pedir; lo local del banco de presets (pasos con sharp) no existe en la nube. */
export function limpiarPedido(b, { por = 'you' } = {}) {
  const ids = (v) => (Array.isArray(v) ? v : []).filter((x) => typeof x === 'string').map((x) => x.replace(/\\/g, '/')).slice(0, 30);
  const m = b?.media && typeof b.media === 'object' ? Object.fromEntries(['start', 'end', 'reference', 'video', 'audio'].map((k) => [k, ids(b.media[k])]).filter(([, v]) => v.length)) : {};
  return { prompt: b?.prompt, n: b?.n, kind: b?.kind, model: typeof b?.model === 'string' ? b.model : undefined, provider: typeof b?.provider === 'string' ? b.provider : undefined, ratio: b?.ratio, seconds: b?.seconds,
    settings: b?.settings && typeof b.settings === 'object' && !Array.isArray(b.settings) ? b.settings : {}, media: m, by: por, folder: typeof b?.folder === 'string' ? b.folder : undefined,
    retryOf: typeof b?.retryOf === 'string' && /^j[a-z0-9]{4,30}$/.test(b.retryOf) ? b.retryOf : undefined,
    agent: null, task: typeof b?.task === 'string' && /^[a-z0-9]{4,20}$/i.test(b.task) ? b.task : null };
}
/** Cambia lo que dice la validación local de la key faltante («guárdala en Windows…») por lo que vale en la nube. */
export function enNube(msg) {
  const m = /^(.+) no tiene key: /.exec(String(msg));
  if (!m) return msg;
  const e = engines_().find((x) => x.name === m[1]);
  return `${m[1]} no tiene su llave en la nube: guarda ${e?.env || 'su key'} como secreto del repositorio en GitHub (Settings → Secrets → Actions) y vuelve a desplegar`;
}
class ErrorPedido extends Error { constructor(m, estado = 400, extra = {}) { super(m); this.estado = estado; Object.assign(this, extra); } }
export { ErrorPedido };

/** Pone en cola una generación. `usuario`: quien la pide (los motores de pago son del administrador). → el trabajo */
export async function pedir(env, db, req, { usuario, presets = false } = {}) { // `presets`: solo lo pasa lib/estudio/presets.js (y retry, con lo que ya guardó el propio trabajo); un body crudo de /api/media/jobs nunca trae el rastro del banco
  const hay = (v) => Array.isArray(v) && v.length > 0;
  // el rastro del banco de presets (preset, receta, canal) SÍ viaja; los pasos que necesitan sharp (retoques locales, QA) todavía no existen en la nube
  if (req.local === true || hay(req.post) || hay(req.pre) || hay(req.qa)) throw new ErrorPedido('Los retoques en el equipo del dueño (presets locales, QA) todavía no están en la nube.', 501);
  const pedido = limpiarPedido(req, { por: usuario?.agente ? 'agent' : 'you' });
  if (usuario?.agente) pedido.agent = String(usuario.agente); // lo pidió un agente: la galería, la tarjeta y el rastro lo dicen (by/agent)
  if (req.versionOf != null) pedido.versionOf = req.versionOf;
  if (presets) for (const k of ['preset', 'receta', 'canal', 'esEscena']) if (req[k] !== undefined) pedido[k] = req[k]; // armarTrabajo los valida (presetTrail)
  if (typeof req.purpose === 'string') pedido.purpose = req.purpose;
  const ids = [...Object.values(pedido.media).flat(), ...(pedido.versionOf != null ? [String(pedido.versionOf).replace(/\\/g, '/')] : [])];
  const existen = await galeria.cuales(db, ids), carpeta = pedido.folder ? await galeria.folderOf(db, pedido.folder) : null, b = await budget(env, db);
  let j;
  try { j = armarTrabajo(pedido, { cfg: S.cfg, resolve: (id) => existen.has(String(id).replace(/\\/g, '/')), folderOf: (id) => (carpeta && carpeta.id === id ? carpeta : null), budget: () => b }); }
  catch (e) { throw new ErrorPedido(enNube(e.message), 400); }
  if (j.engine !== 'prueba' && usuario?.rol !== 'admin') throw new ErrorPedido('Solo un administrador pide trabajos de pago del Estudio (las tarjetas de «Prueba» son gratis para todos).', 403);
  await db.prepare('insert into estudio_trabajos (id, json, estado, at, lease, paso, cancelar) values (?,?,?,?,0,0,0)').bind(j.id, JSON.stringify(j), j.state, j.at).run();
  // el tope se comprueba DESPUÉS de insertar y contando solo lo que llegó antes (por su orden de entrada): dos pedidos a la vez no pueden pasarse del tope los dos
  if (j.engine !== 'prueba') {
    try {
      const mio = (await db.prepare('select rowid r from estudio_trabajos where id = ?').bind(j.id).first()).r;
      const { results } = await db.prepare(`select json from estudio_trabajos where estado in ('queued','running') and rowid < ?`).bind(mio).all();
      const b2 = budgetOf(await usoDelDia(env, db), filas(results), S.cfg);
      if (b2.left != null && j.weight > b2.left) throw new Error(`tope diario alcanzado: quedan ${b2.left} de ${b2.limit} (cámbialo en Ajustes → Estudio)`);
      checkBudgetOf(j.unit * j.n, b2);
    } catch (e) { await db.prepare('delete from estudio_trabajos where id = ?').bind(j.id).run(); throw new ErrorPedido(e.message, 400); }
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'estudio', usuario?.email || '?', JSON.stringify({ trabajo: j.id, modelo: j.model, n: j.n, costo: +(j.unit * j.n).toFixed(3) })).run();
  }
  return pub(j);
}
/** Editar una imagen: una versión nueva al lado (el original no se toca). */
export async function pedirEdicion(env, db, { file, instruction, model: want } = {}, { usuario } = {}) {
  const it = await galeria.item(db, file);
  const req = editRequestOf({ file, instruction, model: want }, it);
  return pedir(env, db, req, { usuario });
}

export async function cancel(env, db, id) {
  const j = await cargar(db, id); if (!j) return null;
  if (j.state === 'queued') {
    const r = await db.prepare(`update estudio_trabajos set estado = 'failed', cancelar = 1 where id = ? and estado = 'queued'`).bind(id).run();
    if (r.meta?.changes) { Object.assign(j, { state: 'failed', error: 'Cancelado por ti.', doneAt: Date.now() }); await guardarFila(db, j); return pub(j); }
    return cancel(env, db, id); // arrancó entre medias
  }
  if (j.state === 'running') {
    await db.prepare('update estudio_trabajos set cancelar = 1 where id = ?').bind(id).run(); j.cancel = true;
    try {
      if (j.engine === 'minimax') { for (const rq of j.remote || []) if (!rq.done) await mmx.cancelVideo(rq.id).catch(() => {}); }
      else for (const rq of j.remote || []) if (!rq.done && rq.cancel) await propiaCancelacion(env, j.engine, rq.cancel);
    } catch { /* cancelar en el servicio es lo mejor que se puede: el trabajo ya está marcado */ }
  }
  return pub(j);
}
async function propiaCancelacion(env, engine, url) {
  const e = entornoDe(env);
  const base = engine === 'higgsfield' ? (e.HF_API_BASE_URL || 'https://api.higgsfield.ai') : engine === 'fal' ? (e.AO_FAL_QUEUE || 'https://queue.fal.run') : null;
  if (!base || new URL(url).origin !== new URL(base).origin) return; // la dirección de seguimiento solo vale si es del propio servicio (esa petición lleva la llave)
  const key = engine === 'higgsfield' ? (e.HF_KEY || `${e.HF_API_KEY}:${e.HF_API_SECRET}`) : e.FAL_KEY;
  await (FETCH || fetch)(url, { method: engine === 'fal' ? 'PUT' : 'POST', headers: { authorization: `Key ${key}` }, signal: AbortSignal.timeout(15000) });
}
export async function retry(env, db, id, { usuario } = {}) {
  const j = await cargar(db, id); if (!j) return null;
  if (j.state !== 'failed' && j.state !== 'done') throw new ErrorPedido('ese trabajo sigue en marcha: espera a que termine para reintentarlo', 409);
  return pedir(env, db, { model: j.model, kind: j.kind, prompt: j.prompt, n: j.n - j.items.length || j.n, settings: j.s, media: j.media, task: j.task, folder: j.folder, versionOf: j.versionOf, purpose: j.purpose, preset: j.preset, receta: j.receta, canal: j.canal, esEscena: j.esEscena, retryOf: j.id }, { usuario, presets: true });
}
export async function forget(db, id) { const r = await db.prepare(`delete from estudio_trabajos where id = ? and estado in ('done','failed')`).bind(id).run(); return !!r.meta?.changes; }
export async function markAttached(db, id) { const j = await cargar(db, id); if (j) { j.attached = true; await guardarFila(db, j); } }

/* ---------- avanzar: un paso de un trabajo ---------- */
const MOTOR_SIN_ARCHIVOS = new Set(); // reservado: motores que no necesitan leer la galería

function crearIO(env, db, j) {
  const e = entornoDe(env);
  return {
    env: () => e, paso: true, fetch: FETCH || undefined,
    item: (id) => galeria.item(db, id), update: (id, p) => galeria.update(db, id, p),
    inputFiles: async (job) => {
      const out = { start: [], end: [], reference: [], video: [], audio: [] };
      for (const role of Object.keys(out)) for (const id of (job.media?.[role] || [])) {
        const rel = galeria.validoId(id); if (!rel || !(await galeria.existe(db, rel))) throw new Error(`no encuentro el archivo «${id}» en el Estudio`);
        const data = await galeria.leerBytes(env, rel); if (!data) throw new Error(`el archivo «${id}» ya no está guardado`);
        const ext = rel.split('.').pop().toLowerCase();
        out[role].push({ id, p: rel, ext, mime: MEDIA_MIME[ext], data });
      }
      return out;
    },
  };
}

/** Da UN paso al trabajo, si nadie más lo está avanzando. → { job, hizo } o null si no existe */
export async function avanzar(env, db, id, { ahora = Date.now() } = {}) {
  const tomado = await db.prepare(`update estudio_trabajos set lease = ? where id = ? and lease < ? and estado in ('queued','running')`).bind(ahora + LEASE_MS, id, ahora).run();
  if (!tomado.meta?.changes) { const j = await cargar(db, id); return j ? { job: pub(j), hizo: false } : null; }
  try { return await paso(env, db, id, ahora); }
  finally { await db.prepare('update estudio_trabajos set lease = 0 where id = ?').bind(id).run(); }
}

async function paso(env, db, id, ahora) {
  const j = await cargar(db, id); if (!j) return null;
  if (j.state !== 'queued' && j.state !== 'running') return { job: pub(j), hizo: false };
  const m = model(j.model);

  // un paso anterior murió a mitad: lo que ya se envió NO se vuelve a enviar
  if (j.enviando) {
    delete j.enviando;
    if (!j.remote?.length) {
      const motivo = 'se interrumpió mientras se enviaba al servicio: puede que ya lo haya cobrado. Revisa su panel y, si no llegó nada, reintenta.';
      if (j.items.length) { j.state = 'done'; j.warning = `llegaron ${j.items.length} de ${j.n}: ${motivo}`; } else { j.state = 'failed'; j.error = limpiarSecretos(motivo); j.errorClass = 'tiempo'; }
      return cerrar(env, db, j, m, ahora);
    }
  }
  if (j.cancel && !j.remote?.length && !j.items.length && j.state === 'queued') { Object.assign(j, { state: 'failed', error: 'Cancelado por ti.' }); return cerrar(env, db, j, m, ahora); }

  if (j.state === 'queued') {
    const { results } = await db.prepare(`select count(*) n from estudio_trabajos where estado = 'running'`).all();
    if ((results[0]?.n ?? 0) >= Math.max(1, Math.min(6, +S.cfg.concurrency || 3))) return { job: pub(j), hizo: false }; // los de arriba terminan primero
    j.state = 'running'; j.startedAt = j.startedAt || ahora;
    if (j.remote?.length) j.pollFrom = ahora; else delete j.pollFrom;
  }
  if (!j.remote?.length) { j.enviando = ahora; j.note = 'enviando'; } else j.note = j.note || 'consultando';
  await guardarFila(db, j);

  const guardar = async (buf, ext, extra = {}) => {
    const real = sniffExt(buf, { svg: j.engine === 'prueba' }); // la verdad la dicen los primeros bytes, no el tipo que declare el motor
    if (!real) throw new Error('el motor devolvió algo que no es una imagen, un video ni un audio');
    const it = await galeria.store(env, db, buf, real, { prompt: j.prompt, provider: j.engine, model: j.model, modelName: m?.name || j.model, ratio: j.s.aspectRatio || null, settings: j.s, media: Object.keys(j.media).length ? j.media : undefined, cost: j.unit, by: j.by, agent: j.agent, task: j.task, job: j.id, ...(j.folder ? { folder: j.folder } : {}), ...(j.versionOf ? { versionOf: j.versionOf } : {}), ...(j.sub ? { sub: j.sub } : {}), ...(j.purpose ? { purpose: j.purpose } : {}), ...(j.read ? { read: j.read } : {}), ...(j.preset ? { preset: j.preset } : {}), ...(j.receta ? { receta: j.receta } : {}), ...(j.canal ? { canal: j.canal } : {}), ...extra }, { zona: galeria.ZONA(env) });
    j.items.push(it.file); await guardarFila(db, j); return it;
  };
  const ctx = { save: async () => { const r = await db.prepare('select cancelar from estudio_trabajos where id = ?').bind(j.id).first(); if (r?.cancelar) j.cancel = true; await guardarFila(db, j); }, add: guardar };
  const { RUN } = crearMotores(crearIO(env, db, j));
  try {
    if (!m) throw new Error('el modelo ya no está en el catálogo');
    const r = await db.prepare('select cancelar from estudio_trabajos where id = ?').bind(j.id).first(); if (r?.cancelar) j.cancel = true;
    await RUN[m.engine](m, j, ctx);
    if (!j.items.length) throw new Error('el motor terminó sin devolver nada');
    j.state = 'done';
  } catch (e) {
    if (e?.pendiente) { delete j.enviando; j.state = 'running'; await guardarFila(db, j); return { job: pub(j), hizo: true }; }
    const ex = j.cancel ? { texto: 'Cancelado por ti.', clase: 'cancelado' } : explicar(e.message, e.status);
    ex.texto = String(ex.texto).replace(/[A-Za-z0-9_-]{24,}/g, '…'); // nunca un cuerpo crudo ni nada que parezca una llave: ni errorRaw, que en la nube no se guarda
    if (j.items.length) { j.state = 'done'; j.warning = ex.texto; } else { j.state = 'failed'; j.error = limpiarSecretos(ex.texto); j.errorClass = ex.clase; }
    if (!j.cancel) console.warn(`estudio: ${j.id} ${j.model}: ${String(e.message).replace(/[A-Za-z0-9_-]{24,}/g, '…')}`);
  }
  delete j.enviando;
  return cerrar(env, db, j, m, ahora);
}

async function cerrar(env, db, j, m, ahora) {
  j.doneAt = Date.now(); j.cost = +(j.unit * j.items.length).toFixed(3); delete j.note;
  if (j.versionOf && j.items.length) { try { const o = await galeria.item(db, j.versionOf); if (o) await galeria.update(db, j.versionOf, { versions: [...new Set([...(Array.isArray(o.versions) ? o.versions : []), ...j.items])] }); } catch (e) { console.warn('estudio versions:', e.message); } }
  if (j.engine !== 'prueba' && j.items.length) await gastar(env, db, { video: 'videos', audio: 'audios', music: 'music' }[j.kind] || 'images', j.items.length, j.cost);
  delete j.remote;
  await guardarFila(db, j);
  const out = pub(j);
  try { await GANCHOS.onDone?.(out); } catch (e) { console.warn('estudio onDone:', e.message); }
  return { job: out, hizo: true };
}

/** Los trabajos que esperan un paso. `soloCortos`: lo que la página puede empujar sin esperar un servicio lento (consultar uno que ya salió, o la tarjeta de prueba). */
export async function pendientes(db, { soloCortos = false, ahora = Date.now() } = {}) {
  const { results } = await db.prepare(`select id, json, paso from estudio_trabajos where estado in ('queued','running') and lease < ? order by at asc`).bind(ahora).all();
  const out = [];
  for (const r of results) {
    const j = JSON.parse(r.json);
    if (soloCortos) { if (!(j.remote?.length || j.engine === 'prueba')) continue; if (ahora - r.paso < EMPUJE_MS) continue; }
    out.push(j.id);
  }
  return out;
}
/** Empuja los trabajos cortos (lo hace la página al preguntar). */
export async function empujar(env, db, { max = 4 } = {}) {
  let n = 0;
  for (const id of (await pendientes(db, { soloCortos: true })).slice(0, max)) { try { await avanzar(env, db, id); n++; } catch (e) { console.warn('estudio empujar:', e.message); } }
  return n;
}
/** El cron: todo lo que espera, a la vez. Uno que falle no tumba a los demás. */
export async function cadaMinuto(env, db) {
  const ids = (await pendientes(db)).slice(0, 12);
  await Promise.allSettled(ids.map((id) => avanzar(env, db, id)));
  await limpiar(db);
  return ids.length;
}
/** Los trabajos terminados se guardan una semana (y no más de 400): los archivos viven en la galería. */
async function limpiar(db, ahora = Date.now()) {
  await db.prepare(`delete from estudio_trabajos where estado in ('done','failed') and at < ?`).bind(ahora - SEMANA).run();
  await db.prepare(`delete from estudio_trabajos where estado in ('done','failed') and id not in (select id from estudio_trabajos order by at desc limit ?)`).bind(MAX_TRABAJOS).run();
}

/** Espera a que el trabajo termine, o a `ms` (lo que pase primero), empujándolo si hace falta. Los agentes y los scripts esperan un poco, nunca un video entero. */
export async function wait(env, db, id, ms = 15 * 60e3) {
  const hasta = Date.now() + Math.min(ms, 100_000);
  for (;;) {
    let j = await cargar(db, id); if (!j) return null;
    if (j.state === 'done' || j.state === 'failed' || Date.now() >= hasta) return pub(j);
    if (j.engine === 'prueba' || j.remote?.length) await avanzar(env, db, id); else await avanzar(env, db, id); // quien espera pone el paso: así no depende de que llegue el cron
    j = await cargar(db, id); if (j.state === 'done' || j.state === 'failed') return pub(j);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
export { weightOf };

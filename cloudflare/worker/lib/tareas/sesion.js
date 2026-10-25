// Una SESIÓN de tareas: lo que serve.mjs hace con data/tasks.json (leer, cambiar, guardar), pero contra D1.
// Las rutas de tareas/ (rutas.mjs, rutas-dueno.mjs) son síncronas y hablan con un almacén que tiene load/save/cambiar. D1 es asíncrona. El puente:
//   1. abrir()   → lee todas las tareas, los proyectos y las etiquetas, y los pone en un almacén EN MEMORIA (tareas/almacen-memoria.mjs);
//   2. la ruta corre tal cual contra esa copia (misma lógica que en la oficina local, sin una línea duplicada);
//   3. commit()  → vuelca a D1 solo lo que cambió, tarea por tarea, con su versión: si otro cambió esa tarea entre medias, NO se pisa — se avisa con
//      `Conflicto` y quien llamó repite la petición desde cero (con la copia nueva). Así "mezclar en vez de pisar" también vale en la nube.
// Los eventos del almacén (tarea.estado, tarea.creada…) se reparten DESPUÉS de volcar (desbloquear lo que esperaba, repetir…), con el mismo bus que la local.
import { crearAlmacenMemoria } from '../../../../tareas/almacen-memoria.mjs';
import { crearCatalogoCon } from '../../../../tareas/catalogo-core.mjs';
import { crearBus } from '../../../../tareas/eventos.mjs';
import { LIGHT_KEEP } from '../../../../tareas/ligera.mjs';
import { Conflicto, leerDoc, guardarDoc } from '../almacen.js';

export const TAREAS = 'tareas';
export const DOC_PROYECTOS = 'tareas.proyectos';
export const DOC_ETIQUETAS = 'tareas.etiquetas';
const LOTE_IDS = 90; // D1: como mucho 100 parámetros por sentencia (1 es la colección)

/** Todas las tareas. Con `ligera` (el sondeo de cada 6 s), lo archivado llega solo con lo que la página lee de ello (tareas/ligera.mjs): su trabajo entregado, que es lo más
 *  pesado, ni sale de D1. Una sesión con la lista ligera es solo para LEER (lo archivado quedaría recortado si se guardara). */
export async function cargarTareas(db, { ligera = false } = {}) {
  const ok = t => t && typeof t === 'object' && t.id;
  const out = [];
  if (!ligera) {
    const { results } = await db.prepare('select json from filas where coleccion = ? order by orden, id').bind(TAREAS).all();
    for (const r of results) { try { const t = JSON.parse(r.json); if (ok(t)) out.push(t); } catch { /* una fila rota no tumba la oficina */ } }
    return out;
  }
  const cols = LIGHT_KEEP.filter(k => k !== 'id' && k !== 'archived');
  const { results } = await db.prepare(`select id, case when json_extract(json,'$.archived') then null else json end as json, json_extract(json,'$.archived') as _a${cols.map((k, i) => `, json_extract(json,'$.${k}') as _c${i}`).join('')} from filas where coleccion = ? order by orden, id`).bind(TAREAS).all();
  for (const r of results) {
    try {
      if (r.json) { const t = JSON.parse(r.json); if (ok(t)) out.push(t); }
      else { const t = { id: r.id, archived: true }; cols.forEach((k, i) => { if (r['_c' + i] !== null && r['_c' + i] !== undefined) t[k] = r['_c' + i]; }); out.push(t); }
    } catch { /* */ }
  }
  return out;
}

async function lineasDeBitacora(db, { tareas = [], desde = null, tipos = null, limite = 4000 } = {}) {
  const lineas = [];
  for (const id of tareas) {
    const { results } = await db.prepare('select json from tarea_bitacora where tarea = ? order by n desc limit 300').bind(String(id)).all();
    for (const r of results.reverse()) { try { lineas.push(JSON.parse(r.json)); } catch { /* */ } }
  }
  if (desde !== null) {
    const { results } = await db.prepare('select json from tarea_bitacora where t >= ? order by n desc limit ?').bind(desde, limite).all();
    for (const r of results.reverse()) { try { const j = JSON.parse(r.json); if (!tipos || tipos.includes(j.tipo)) lineas.push(j); } catch { /* */ } }
  }
  return lineas;
}

/** { alm, cat, commit(), bus, avisos } — `bitacora`: qué líneas de la bitácora hacen falta ({ tareas: [id], desde, tipos }); nada por defecto (es lo caro). */
export async function abrirSesion(db, { ahora = () => Date.now(), bitacora = null, ligera = false } = {}) {
  const [tareas, proy, etiq] = await Promise.all([cargarTareas(db, { ligera }), leerDoc(db, DOC_PROYECTOS, { lista: [] }), leerDoc(db, DOC_ETIQUETAS, { lista: [] })]);
  const lineas = bitacora ? await lineasDeBitacora(db, bitacora) : [];
  let P = Array.isArray(proy.valor?.lista) ? proy.valor.lista : [], E = Array.isArray(etiq.valor?.lista) ? etiq.valor.lista : [];
  let vP = proy.version, vE = etiq.version, sucioP = false, sucioE = false;
  const alm = crearAlmacenMemoria({ tareas, bitacora: lineas, ahora });
  const cat = crearCatalogoCon({
    proyectos: { leer: () => P, escribir: l => { P = JSON.parse(JSON.stringify(l)); sucioP = true; } },
    etiquetas: { leer: () => E, escribir: l => { E = JSON.parse(JSON.stringify(l)); sucioE = true; } },
  }, { ahora });
  const bus = crearBus({ registrar: (tipo, e) => console.warn(`eventos: ${tipo}:`, e?.message ?? e) });
  const avisos = []; // lo que la oficina quiere decir (avisar): se guarda al volcar
  const extra = []; // sentencias de D1 que deben entrar en el MISMO lote que el cambio de las tareas (p. ej. la auditoría de una aprobación): si el cambio se repite por un choque, no se duplican
  const sesion = { db, alm, cat, bus, avisos, extra, avisar: (kind, text, { level = 'info', task = null, key = null, ...resto } = {}) => { avisos.push({ kind, level, text, task, key, ...resto }); }, ahora };

  /** Vuelca a D1 lo que cambió. Lanza Conflicto si otra petición cambió una de esas tareas (o un catálogo) mientras tanto; entonces no se pisa nada. */
  sesion.commit = async function commit() {
    const c = alm.cambios();
    if (c.subir.length || c.borrar.length) {
      // 1) mirar antes, para no empezar a escribir si ya se sabe que hay un choque. D1 admite 100 parámetros por sentencia: de a LOTE_IDS ids por consulta.
      const consulta = [...c.subir.map(x => x.tarea.id), ...c.borrar.map(x => x.id)];
      const hay = new Map();
      for (let i = 0; i < consulta.length; i += LOTE_IDS) {
        const trozo = consulta.slice(i, i + LOTE_IDS);
        const { results } = await db.prepare(`select id, coalesce(json_extract(json,'$.version'),1) v from filas where coleccion = ? and id in (${trozo.map(() => '?').join(',')})`).bind(TAREAS, ...trozo).all();
        for (const r of results) hay.set(r.id, r.v);
      }
      for (const x of c.subir) { const v = hay.get(x.tarea.id); if (x.versionAntes === null ? v !== undefined : v !== x.versionAntes) throw new Conflicto(x.tarea.id); }
      for (const x of c.borrar) if (hay.get(x.id) !== x.versionAntes) throw new Conflicto(x.id);
    }
    // 2) escribir, cada tarea solo si sigue en la versión que se leyó. La bitácora va en el MISMO lote: o entra todo o no entra nada (antes un corte las separaba).
    const t0 = ahora(), sentencias = [];
    for (const x of c.subir) {
      const json = JSON.stringify(x.tarea);
      sentencias.push(x.versionAntes === null
        ? db.prepare('insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?) on conflict (coleccion, id) do nothing').bind(TAREAS, x.tarea.id, json, t0, new Date(t0).toISOString())
        : db.prepare("update filas set json = ?, actualizado = ? where coleccion = ? and id = ? and coalesce(json_extract(json,'$.version'),1) = ?").bind(json, new Date(t0).toISOString(), TAREAS, x.tarea.id, x.versionAntes));
    }
    for (const x of c.borrar) sentencias.push(db.prepare("delete from filas where coleccion = ? and id = ? and coalesce(json_extract(json,'$.version'),1) = ?").bind(TAREAS, x.id, x.versionAntes));
    const hayTareas = sentencias.length;
    for (const l of c.lineas) sentencias.push(db.prepare('insert into tarea_bitacora (t, tarea, json) values (?,?,?)').bind(+l.t || ahora(), String(l.tarea), JSON.stringify(l)));
    for (const e of extra.splice(0)) sentencias.push(e);
    if (sentencias.length) { // UN solo lote: D1 lo corre como una transacción (tareas y bitácora entran juntas o ninguna)
      const res = await db.batch(sentencias);
      for (let k = 0; k < hayTareas; k++) {
        if ((res[k]?.meta?.changes ?? 0) !== 1) { const x = k < c.subir.length ? c.subir[k].tarea : c.borrar[k - c.subir.length]; throw new Conflicto(x?.id || 'tareas'); }
      }
    }
    if (sucioP) { await guardarDoc(db, DOC_PROYECTOS, { lista: P }, { espera: vP }); vP += 1; sucioP = false; }
    if (sucioE) { await guardarDoc(db, DOC_ETIQUETAS, { lista: E }, { espera: vE }); vE += 1; sucioE = false; }
    if (avisos.length) {
      const t0 = ahora(), nuevos = [];
      const lista = avisos.splice(0), claves = [...new Set(lista.map(a => a.key).filter(Boolean))], recientes = new Set();
      for (let i = 0; i < claves.length; i += LOTE_IDS) { // MEDIO-6: una consulta por tanda de claves, no una por aviso
        const trozo = claves.slice(i, i + LOTE_IDS);
        const { results } = await db.prepare(`select distinct json_extract(json,'$.key') k from filas where coleccion = 'avisos' and orden > ? and json_extract(json,'$.key') in (${trozo.map(() => '?').join(',')})`).bind(t0 - 6 * 3600e3, ...trozo).all();
        for (const r of results) recientes.add(r.k);
      }
      for (const a of lista) { // lo mismo dicho dos veces en 6 horas se dice una (serve.mjs → notice con key)
        if (a.key && (recientes.has(a.key) || nuevos.some(x => x.key === a.key))) continue;
        nuevos.push(a);
      }
      if (nuevos.length) await db.batch(nuevos.map((a, i) => { const id = `${t0.toString(36)}${i}${Math.random().toString(36).slice(2, 5)}`; return db.prepare('insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?) on conflict (coleccion, id) do nothing').bind('avisos', id, JSON.stringify({ id, t: t0, read: false, ...a }), t0, new Date(t0).toISOString()); }));
    }
    const eventos = c.eventos; alm.confirmar();
    return eventos;
  };

  /** Vuelca y reparte los eventos (que pueden provocar más cambios: desbloquear, repetir) hasta que no quede nada, con un tope. */
  sesion.terminar = async function terminar() {
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const eventos = await sesion.commit();
      if (!eventos.length) return;
      for (const [tipo, datos] of eventos) bus.emit(tipo, datos);
      const c = alm.cambios();
      if (!c.subir.length && !c.borrar.length && !c.lineas.length && !avisos.length && !sucioP && !sucioE) return;
    }
    await sesion.commit(); // la última vuelta: lo que quedó sin repartir se guarda igual
  };
  return sesion;
}

/** Corre `fn(sesion)` y vuelca; si otra petición cambió lo mismo en medio, lo repite desde cero (hasta 3 veces). `fn` debe poder repetirse. */
export async function conSesion(db, opciones, fn) {
  if (typeof opciones === 'function') { fn = opciones; opciones = {}; }
  let ultimo;
  for (let i = 0; i < 3; i++) {
    const s = await abrirSesion(db, opciones);
    try { const r = await fn(s); await s.terminar(); return r; }
    catch (e) { if (!e?.conflicto) throw e; ultimo = e; }
  }
  throw ultimo;
}

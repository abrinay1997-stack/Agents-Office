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
  const sesion = { db, alm, cat, bus, avisos, avisar: (kind, text, { level = 'info', task = null, key = null, ...resto } = {}) => { avisos.push({ kind, level, text, task, key, ...resto }); }, ahora };

  /** Vuelca a D1 lo que cambió. Lanza Conflicto si otra petición cambió una de esas tareas (o un catálogo) mientras tanto; entonces no se pisa nada. */
  sesion.commit = async function commit() {
    const c = alm.cambios();
    if (c.subir.length || c.borrar.length) {
      // 1) mirar antes, para no empezar a escribir si ya se sabe que hay un choque
      const ids = [...c.subir.filter(x => x.versionAntes !== null).map(x => x.tarea.id), ...c.borrar.map(x => x.id)];
      const nuevas = c.subir.filter(x => x.versionAntes === null).map(x => x.tarea.id);
      const consulta = [...ids, ...nuevas];
      if (consulta.length) {
        const marcas = consulta.map(() => '?').join(',');
        const { results } = await db.prepare(`select id, coalesce(json_extract(json,'$.version'),1) v from filas where coleccion = ? and id in (${marcas})`).bind(TAREAS, ...consulta).all();
        const hay = new Map(results.map(r => [r.id, r.v]));
        for (const x of c.subir) { const v = hay.get(x.tarea.id); if (x.versionAntes === null ? v !== undefined : v !== x.versionAntes) throw new Conflicto(x.tarea.id); }
        for (const x of c.borrar) if (hay.get(x.id) !== x.versionAntes) throw new Conflicto(x.id);
      }
      // 2) escribir, cada una solo si sigue en la versión que se leyó
      const t0 = ahora(), sentencias = [];
      for (const x of c.subir) {
        const json = JSON.stringify(x.tarea);
        sentencias.push(x.versionAntes === null
          ? db.prepare('insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?) on conflict (coleccion, id) do nothing').bind(TAREAS, x.tarea.id, json, t0, new Date(t0).toISOString())
          : db.prepare("update filas set json = ?, actualizado = ? where coleccion = ? and id = ? and coalesce(json_extract(json,'$.version'),1) = ?").bind(json, new Date(t0).toISOString(), TAREAS, x.tarea.id, x.versionAntes));
      }
      for (const x of c.borrar) sentencias.push(db.prepare("delete from filas where coleccion = ? and id = ? and coalesce(json_extract(json,'$.version'),1) = ?").bind(TAREAS, x.id, x.versionAntes));
      const res = await db.batch(sentencias);
      const malo = res.findIndex(r => (r?.meta?.changes ?? 0) !== 1);
      if (malo >= 0) throw new Conflicto((c.subir[malo] || c.borrar[malo - c.subir.length])?.tarea?.id || (c.borrar[malo - c.subir.length])?.id || 'tareas');
    }
    if (c.lineas.length) {
      for (let i = 0; i < c.lineas.length; i += 25) await db.batch(c.lineas.slice(i, i + 25).map(l => db.prepare('insert into tarea_bitacora (t, tarea, json) values (?,?,?)').bind(+l.t || ahora(), String(l.tarea), JSON.stringify(l))));
    }
    if (sucioP) { await guardarDoc(db, DOC_PROYECTOS, { lista: P }, { espera: vP }); vP += 1; sucioP = false; }
    if (sucioE) { await guardarDoc(db, DOC_ETIQUETAS, { lista: E }, { espera: vE }); vE += 1; sucioE = false; }
    if (avisos.length) {
      const t0 = ahora(), nuevos = [];
      for (const a of avisos.splice(0)) { // lo mismo dicho dos veces en 6 horas se dice una (serve.mjs → notice con key)
        if (a.key && (nuevos.some(x => x.key === a.key) || await db.prepare("select 1 x from filas where coleccion = 'avisos' and orden > ? and json_extract(json,'$.key') = ? limit 1").bind(t0 - 6 * 3600e3, a.key).first())) continue;
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

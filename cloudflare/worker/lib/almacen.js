// El almacén de la nube: lo que en la oficina local eran archivos de data/ (leer, mutar, escribir con renombrar).
//  · docs  — UN documento JSON por clave (con versión: guardar solo si nadie lo cambió desde que lo leíste).
//  · filas — una fila JSON por id dentro de una colección (tareas, rutinas, piezas…): cambiar una no reescribe las demás.
// D1 corta la fila a 2 MB: un documento que pueda crecer así va en `filas`, no en `docs`.
import { ahora } from './ids.js';

export class Conflicto extends Error { constructor(clave) { super(`«${clave}» cambió mientras lo editabas`); this.clave = clave; this.conflicto = true; } }

const LOTE = 25;

export async function leerDoc(db, clave, defecto = null) {
  const f = await db.prepare('select json, version from docs where clave = ?').bind(clave).first();
  return f ? { valor: JSON.parse(f.json), version: f.version } : { valor: defecto, version: 0 };
}

/** Guarda un documento. Con `espera` (la versión que leíste) falla con Conflicto si otro lo cambió; sin ella, pisa. Devuelve la versión nueva. */
export async function guardarDoc(db, clave, valor, { espera } = {}) {
  const json = JSON.stringify(valor);
  if (espera === undefined) {
    await db.prepare(`insert into docs (clave, json, version, actualizado) values (?,?,1,?)
      on conflict (clave) do update set json=excluded.json, version=docs.version+1, actualizado=excluded.actualizado`).bind(clave, json, ahora()).run();
    return (await db.prepare('select version from docs where clave = ?').bind(clave).first()).version;
  }
  if (espera === 0) {
    const r = await db.prepare('insert or ignore into docs (clave, json, version, actualizado) values (?,?,1,?)').bind(clave, json, ahora()).run();
    if (!r.meta?.changes) throw new Conflicto(clave);
    return 1;
  }
  const r = await db.prepare('update docs set json=?, version=version+1, actualizado=? where clave=? and version=?').bind(json, ahora(), clave, espera).run();
  if (!r.meta?.changes) throw new Conflicto(clave);
  return espera + 1;
}

/** Lee, aplica `cambiar(valor)` y guarda; si otro guardó entre medias, lo repite (hasta `intentos`). `cambiar` debe ser pura. */
export async function mutarDoc(db, clave, defecto, cambiar, { intentos = 4 } = {}) {
  for (let i = 0; i < intentos; i++) {
    const { valor, version } = await leerDoc(db, clave, defecto);
    const nuevo = await cambiar(structuredClone(valor));
    try { await guardarDoc(db, clave, nuevo, { espera: version }); return nuevo; } catch (e) { if (!e.conflicto) throw e; }
  }
  throw new Conflicto(clave);
}

export async function leerFila(db, coleccion, id) {
  const f = await db.prepare('select json from filas where coleccion = ? and id = ?').bind(coleccion, String(id)).first();
  return f ? JSON.parse(f.json) : null;
}

export async function listarFilas(db, coleccion, { limite = 1000, desde = 0 } = {}) {
  const { results } = await db.prepare('select json from filas where coleccion = ? order by orden, id limit ? offset ?').bind(coleccion, limite, desde).all();
  return results.map((r) => JSON.parse(r.json));
}

export async function guardarFila(db, coleccion, id, valor, orden = 0) {
  await db.prepare(`insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?)
    on conflict (coleccion, id) do update set json=excluded.json, orden=excluded.orden, actualizado=excluded.actualizado`)
    .bind(coleccion, String(id), JSON.stringify(valor), orden, ahora()).run();
  return valor;
}

/** Guarda muchas filas de una colección: [{ id, valor, orden? }]. */
export async function guardarFilas(db, coleccion, filas) {
  const sql = `insert into filas (coleccion, id, json, orden, actualizado) values (?,?,?,?,?)
    on conflict (coleccion, id) do update set json=excluded.json, orden=excluded.orden, actualizado=excluded.actualizado`;
  for (let i = 0; i < filas.length; i += LOTE)
    await db.batch(filas.slice(i, i + LOTE).map((f) => db.prepare(sql).bind(coleccion, String(f.id), JSON.stringify(f.valor), f.orden ?? 0, ahora())));
  return filas.length;
}

export async function borrarFila(db, coleccion, id) {
  const r = await db.prepare('delete from filas where coleccion = ? and id = ?').bind(coleccion, String(id)).run();
  return !!r.meta?.changes;
}

export async function contarFilas(db, coleccion) {
  return (await db.prepare('select count(*) n from filas where coleccion = ?').bind(coleccion).first()).n;
}

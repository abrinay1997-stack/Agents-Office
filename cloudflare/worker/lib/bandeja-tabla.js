// CON-11 paso 3 (Fase 6): la Bandeja en la tabla `bandeja_items` en lugar del archivo `bandeja.json` del espejo. SOLO con el flag `nube.bandejaTabla` (config-local) ENCENDIDO.
//
// El módulo de la Bandeja (contenido/bandeja.mjs) pide su estado por un almacén SÍNCRONO `{ leer, escribir }`. Aquí se carga de D1 antes de correr (`cargarTabla`),
// vive en memoria durante la petición y `flush()` vuelca SOLO lo que cambió, fila por fila:
//   · un GET no escribe nada (compara cada fila con lo que leyó);
//   · cada fila lleva su `version`: si otra petición la cambió, se junta con `fusionarJson` (tres vías, la del espejo) en vez de pisarla;
//   · «enviando» (el testigo de «una sola vez») es COMPARE-AND-SET: la columna `enviando_at` solo pasa de nulo a un valor si sigue nula en D1; si otra petición ya
//     lo puso, `flush()` lanza ANTES de llamar a Meta y la respuesta no se manda dos veces;
//   · lo que no es un ítem (`ultimo`, `error`, `alias`, `fuentes`, `aviso`, `avisoMensajes`) vive en el documento 'bandeja.estado' (con su versión).
// La primera vez (tabla y documento vacíos) se importa lo que hubiera en el archivo `fs:data/contenido/bandeja.json` (INSERT OR IGNORE: repetirlo no duplica).
// El archivo viejo NO se borra: es la copia para volver atrás (`tablaAArchivo`).
import { leerDoc, guardarDoc } from './almacen.js';
import { fusionarJson, PREFIJO } from './espejo.js';

export const DOC_ESTADO = 'bandeja.estado';
export const RUTA_ARCHIVO = 'data/contenido/bandeja.json';
const CLAVE_ARCHIVO = PREFIJO + RUTA_ARCHIVO;
const COLUMNAS = (m) => [String(m.estado || ''), String(m.fuente || ''), String(m.tipo || ''), String(m.cuando || '')];
const enviandoAt = (m, ahora) => (m?.enviando ? (Date.parse(m.enviando.at) || ahora()) : null);
const partir = (d) => { const { items = {}, ...resto } = d || {}; return { items, resto }; };

/** ¿Está encendido el flag? (config-local: { "nube": { "bandejaTabla": true } }) */
export const tablaActiva = (cfg) => Boolean(cfg?.nube && typeof cfg.nube === 'object' && cfg.nube.bandejaTabla === true);

async function importarDelArchivo(db, ahora) {
  const f = await leerDoc(db, CLAVE_ARCHIVO, null);
  let viejo = null; try { viejo = f.valor?.t ? JSON.parse(f.valor.t) : null; } catch { viejo = null; }
  if (!viejo || typeof viejo !== 'object') { await guardarDoc(db, DOC_ESTADO, {}, { espera: 0 }).catch((e) => { if (!e.conflicto) throw e; }); return null; } // sin archivo: se deja constancia de que ya se miró (no se vuelve a buscar en cada petición)
  const { items, resto } = partir(viejo);
  for (const [id, m] of Object.entries(items)) {
    if (!m || typeof m !== 'object') continue;
    await db.prepare('insert or ignore into bandeja_items (id, estado, fuente, tipo, ts, json, version, enviando_at, actualizado) values (?,?,?,?,?,?,1,?,?)')
      .bind(id, ...COLUMNAS(m), JSON.stringify({ ...m, id }), enviandoAt(m, ahora), ahora()).run();
  }
  await guardarDoc(db, DOC_ESTADO, resto, { espera: 0 }).catch((e) => { if (!e.conflicto) throw e; });
  return viejo;
}

// `~estado` no puede ser el id de un ítem (los de Meta son números o «meta:…»).
const LEER = `select id, json, version from bandeja_items union all select '~estado', json, version from docs where clave = '${DOC_ESTADO}'`; // UNA lectura: las filas y el documento del estado general // secrets-ok: la clave de un documento, no una llave
const separar = (results) => { const est = results.find((r) => r.id === '~estado'); return { filas: results.filter((r) => r !== est), estado: est ? { valor: JSON.parse(est.json), version: est.version } : { valor: null, version: 0 } }; };

/** Carga la Bandeja de D1 (importándola del archivo la primera vez) y devuelve el almacén de la petición. */
export async function cargarTabla(db, { ahora = () => Date.now() } = {}) {
  let { filas: results, estado } = separar((await db.prepare(LEER).all()).results);
  if (!results.length && estado.version === 0) {
    if (await importarDelArchivo(db, ahora)) ({ filas: results, estado } = separar((await db.prepare(LEER).all()).results));
    else estado = await leerDoc(db, DOC_ESTADO, null);
  }
  const filas = new Map(results.map((r) => [r.id, { json: r.json, version: r.version }]));
  let meta = { json: JSON.stringify(estado.valor ?? {}), version: estado.version };
  let actual = { ...(estado.valor ?? {}), items: Object.fromEntries(results.map((r) => [r.id, JSON.parse(r.json)])) };
  const cuenta = { lecturas: 0, escrituras: 0, filasEscritas: 0, conflictos: 0 };

  async function subir(id, m) {
    for (let intento = 0; intento < 5; intento++) {
      const base = filas.get(id), json = JSON.stringify(m);
      if (base && base.json === json) return;
      const nuevoEnv = Boolean(m.enviando) && !(base && JSON.parse(base.json).enviando); // el testigo «enviando» pasa de nada a algo: compare-and-set
      const r = !base
        ? await db.prepare('insert or ignore into bandeja_items (id, estado, fuente, tipo, ts, json, version, enviando_at, actualizado) values (?,?,?,?,?,?,1,?,?)').bind(id, ...COLUMNAS(m), json, enviandoAt(m, ahora), ahora()).run()
        : await db.prepare(`update bandeja_items set estado=?, fuente=?, tipo=?, ts=?, json=?, version=version+1, enviando_at=?, actualizado=? where id=? and version=?${nuevoEnv ? ' and enviando_at is null' : ''}`)
          .bind(...COLUMNAS(m), json, enviandoAt(m, ahora), ahora(), id, base.version).run();
      if (r.meta?.changes) { cuenta.filasEscritas++; filas.set(id, { json, version: (base?.version ?? 0) + 1 }); return; }
      cuenta.conflictos++; // otra petición tocó (o creó) esta fila mientras tanto
      const suya = await db.prepare('select json, version, enviando_at from bandeja_items where id = ?').bind(id).first();
      if (!suya) { filas.delete(id); continue; } // la quitaron: se vuelve a crear
      if (nuevoEnv && suya.enviando_at != null) throw new Error('esa respuesta ya se está enviando desde otra petición: no se envía dos veces');
      const unida = fusionarJson(base ? JSON.parse(base.json) : {}, m, JSON.parse(suya.json));
      filas.set(id, { json: suya.json, version: suya.version });
      m = unida; actual.items[id] = unida; // lo unido es lo que se escribe y lo que el módulo verá
    }
    throw new Error('la Bandeja cambia sin parar en otra petición: no pude guardarla; vuelve a intentarlo.');
  }

  async function flush() {
    const { items, resto } = partir(actual);
    for (const [id, m] of Object.entries(items)) await subir(id, m);
    for (const [id, f] of [...filas]) {
      if (id in items) continue;
      await db.prepare('delete from bandeja_items where id = ? and version = ?').bind(id, f.version).run(); // el módulo recorta a los 800 más recientes
      filas.delete(id); cuenta.filasEscritas++;
    }
    const j = JSON.stringify(resto);
    if (j !== meta.json) {
      cuenta.escrituras++;
      let mio = resto, base = JSON.parse(meta.json), version = meta.version;
      for (let i = 0; i < 4; i++) {
        try { version = await guardarDoc(db, DOC_ESTADO, mio, { espera: version }); meta = { json: JSON.stringify(mio), version }; break; }
        catch (e) { if (!e.conflicto) throw e; const suyo = await leerDoc(db, DOC_ESTADO, {}); mio = fusionarJson(base, mio, suyo.valor ?? {}); base = suyo.valor ?? {}; version = suyo.version; }
      }
      actual = { ...mio, items: actual.items };
    }
  }
  return {
    cuenta, flush,
    leer() { cuenta.lecturas++; return structuredClone(actual); },
    escribir(nuevo) { const { items, resto } = partir(nuevo); actual = { ...structuredClone(resto), items: structuredClone(items) }; },
  };
}

/** Volver atrás: escribe la tabla de nuevo en el archivo del espejo (`fs:data/contenido/bandeja.json`) para apagar el flag sin perder lo que llegó. */
export async function tablaAArchivo(db) {
  const alm = await cargarTabla(db);
  const d = alm.leer();
  const { valor, version } = await leerDoc(db, CLAVE_ARCHIVO, null);
  await guardarDoc(db, CLAVE_ARCHIVO, { t: JSON.stringify(d, null, 1) }, valor ? { espera: version } : { espera: 0 });
  return Object.keys(d.items).length;
}

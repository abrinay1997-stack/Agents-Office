// La cola de publicación en D1: lo que en la oficina local era data/contenido/cola.json + el reloj de serve.mjs.
//
//  · `crearColaD1(db)` — la cola, una fila por pieza entregada. `leer()` trae todo; `guardar(d)` escribe SOLO las filas que cambiaron (compara con lo que leyó) y borra las
//    que ya no están. Cada paso del programador llama a `guardar` ANTES de hablar con Meta: si el Worker muere a medias, la cola ya dice qué se estaba haciendo.
//  · `tomarCandado` / `soltarCandado` — «una vuelta a la vez». Un Worker no recuerda nada y dos invocaciones pueden coincidir (el cron y un clic en «Entregar»):
//    quien entrega, publica o toca la agenda de Meta tiene el candado (con caducidad, por si muere), y quien no lo consigue no hace nada.
//  · `crearProgramadorD1` — el programador de la oficina local (contenido/programador-core.mjs, el MISMO código) con esta cola y estas piezas.
import { crearNucleoProgramador, publica, reintentarEntrada, entregarYaEntrada, estadoDeCola } from '../../../../contenido/programador-core.mjs';

export function crearColaD1(db) {
  let vistas = new Map(); // pieza → el JSON como se leyó
  return {
    async leer() {
      const { results } = await db.prepare('select pieza, json from contenido_cola').all();
      vistas = new Map(results.map(f => [f.pieza, f.json]));
      return { entradas: Object.fromEntries(results.map(f => [f.pieza, JSON.parse(f.json)])) };
    },
    async guardar(d) {
      const entradas = d.entradas || {}, t = new Date().toISOString(), orden = [];
      for (const [id, e] of Object.entries(entradas)) {
        const json = JSON.stringify(e);
        if (vistas.get(id) === json) continue;
        orden.push(db.prepare('insert into contenido_cola (pieza, json, actualizado) values (?,?,?) on conflict (pieza) do update set json = excluded.json, actualizado = excluded.actualizado').bind(id, json, t));
        vistas.set(id, json);
      }
      for (const id of [...vistas.keys()]) if (!(id in entradas)) { orden.push(db.prepare('delete from contenido_cola where pieza = ?').bind(id)); vistas.delete(id); }
      for (let i = 0; i < orden.length; i += 25) await db.batch(orden.slice(i, i + 25));
    },
  };
}

/** Toma el candado `nombre` por `ttlMs`. Verdadero si es tuyo; falso si otro lo tiene vigente. */
export async function tomarCandado(db, nombre, dueno, ttlMs, ahora = Date.now) {
  const t = ahora();
  const r = await db.prepare('insert into contenido_candado (nombre, hasta, dueno) values (?,?,?) on conflict (nombre) do update set hasta = excluded.hasta, dueno = excluded.dueno where contenido_candado.hasta < ?')
    .bind(nombre, t + ttlMs, dueno, t).run();
  return (r.meta?.changes ?? 0) > 0;
}
export async function soltarCandado(db, nombre, dueno) { await db.prepare('delete from contenido_candado where nombre = ? and dueno = ?').bind(nombre, dueno).run(); }
export async function candadoVigente(db, nombre, ahora = Date.now) { const f = await db.prepare('select hasta from contenido_candado where nombre = ?').bind(nombre).first(); return !!f && f.hasta >= ahora(); }

/**
 * El programador con piezas y cola en D1. Devuelve los mismos métodos que contenido/programador.mjs (todos asíncronos):
 * tick · salidaDe · estado · reintentar · entregarYa · cancelar · refrescar. `ultimo` (lo de la última vuelta) viene del núcleo.
 * Los que CAMBIAN la cola desde la página (reintentar, entregarYa) toman el candado: si una vuelta está trabajando, dicen que esperes un momento.
 */
export function crearProgramadorD1({ db, almacen, conductor, porId = null, modo = () => 'simulacro', horasAntes = () => 24, avisar = () => {}, auditar = () => {}, ahora = Date.now, puedeSeguir = () => true, maxAcciones = Infinity, dueno = 'worker' }) {
  const cola = crearColaD1(db);
  const nucleo = crearNucleoProgramador({ almacen, cola, conductor, porId, modo, horasAntes, avisar, auditar, ahora, puedeSeguir, maxAcciones });
  const conCandado = async fn => {
    const id = dueno + ':' + crypto.randomUUID();
    if (!(await tomarCandado(db, 'vuelta', id, 30_000, ahora))) return { error: 'la cola está trabajando en este momento: inténtalo de nuevo en unos segundos' };
    try { return await fn(); } finally { await soltarCandado(db, 'vuelta', id); }
  };
  // Listar el calendario pregunta la salida de CADA pieza: se lee la cola una vez y se recuerda hasta que la cola cambie (un Worker tiene un tope de consultas por petición).
  let foto = null;
  const lectura = async () => (foto ??= await cola.leer());
  const olvidar = () => { foto = null; };
  return {
    tick: async o => { try { return await nucleo.tick(o); } finally { olvidar(); } },
    retirarAhora: id => conCandado(async () => { try { return await nucleo.retirarAhora(id); } finally { olvidar(); } }), // B05
    refrescar: async id => { try { return await nucleo.refrescar(id); } finally { olvidar(); } },
    ultimo: nucleo.ultimo,
    salidaDe: async id => publica((await lectura()).entradas?.[id]) || null,
    estado: async () => estadoDeCola({ d: await lectura(), c: conductor(), modo: modo(), horasAntes: horasAntes(), ultimo: nucleo.ultimo() }),
    reintentar: id => conCandado(async () => { const d = await cola.leer(), r = reintentarEntrada(d.entradas?.[id], ahora()); if (r.ok) await cola.guardar(d); olvidar(); return r; }),
    entregarYa: id => conCandado(async () => { const d = await cola.leer(), r = entregarYaEntrada(d.entradas?.[id]); if (r.ok) await cola.guardar(d); olvidar(); return r; }),
    /** Quitar una pieza de la cola: se le quita el OK (vuelve a revisión) y la próxima vuelta la retira del conductor. */
    async cancelar(id) { const r = await almacen.devolver(id, 'revision'); return r.error ? r : { ok: true, pieza: r.pieza }; },
  };
}

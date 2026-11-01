// Series en la nube, N1 (carril K): el almacén de series sobre D1, con el MISMO contrato que series.mjs (`todas`, `uno`, `estadoDe`, `crear`, `actualizar`), pero asíncrono y con candado por versión.
// `actualizar(id, fn)`: lee la fila, aplica `fn` (SÍNCRONA, como en local: devuelve la serie cambiada o `undefined` para no escribir) y guarda SOLO si la versión sigue siendo la leída
// (`update … where version = ?`). Si otra petición escribió en medio, vuelve a leer y a aplicar `fn` (hasta REINTENTOS veces): nunca se pisa lo que otro cambió. Si no se logra, lanza (falla cerrado).
// El dinero NO está aquí: vive en `series_libro` (libro.js), con su propia sentencia atómica.
import { hashEscaleta } from '../../../../serie-core.mjs';
import { serieValida, normalizarSerie, ID_SERIE_OK } from '../../../../series-bomba-core.mjs';

export const REINTENTOS = 6;
export const MAX_JSON = 1_000_000; // BYTES (UTF-8) de la serie, no caracteres: un acento o un emoji pesan más de uno; el límite de fila de D1 es 2 MB
export const MAX_LISTA = 200;
const copia = (s) => (s ? structuredClone(s) : null);
const leerFila = (f) => { try { const s = JSON.parse(f.json); return serieValida(s) ? { ...normalizarSerie(s), v: f.version } : null; } catch { return null; } }; // una fila rota se salta: no puede hacer lanzar a la bomba

export function crearAlmacenD1(db, { ahora = () => Date.now(), azar = () => Math.random().toString(36).slice(2, 6) } = {}) {
  if (!db) throw new Error('el almacén de series necesita la base');
  const enc = new TextEncoder();
  const texto = (s) => { const j = JSON.stringify(s); if (enc.encode(j).length > MAX_JSON) throw new Error('la serie es demasiado grande para guardarla'); return j; };
  const fila = (id) => db.prepare('select id, estado, version, json from series where id = ?').bind(id).first();
  return {
    /** Las series vivas (muestra, corriendo, pausado) SIEMPRE primero, y luego las más nuevas: con más de MAX_LISTA series, la bomba y la lista nunca dejan fuera una que está generando. */
    async todas() { return (await db.prepare(`select id, estado, version, json from series order by (case when estado in ('muestra','corriendo','pausado') then 0 else 1 end), creada desc limit ?`).bind(MAX_LISTA).all()).results.map(leerFila).filter(Boolean); },
    /** Las series con algún plano en el aire (corriendo), sea cual sea su estado (también pausadas o canceladas): lo que la bomba tiene que reconciliar. */
    async enVuelo() { return (await db.prepare(`select id, estado, version, json from series where exists (select 1 from json_each(series.json, '$.escaleta') where json_extract(value, '$.estado') = 'corriendo') limit 50`).all()).results.map(leerFila).filter(Boolean); },
    async estadoDe(id) { return (await db.prepare('select estado from series where id = ?').bind(String(id)).first())?.estado ?? null; },
    /** Varias series por su id en UNA consulta (≤ 90 ids por sentencia: D1 admite 100 parámetros) → Map id → serie. */
    async variasPorId(ids) {
      const lim = [...new Set((ids || []).map(String).filter((x) => ID_SERIE_OK.test(x)))], mapa = new Map();
      for (let i = 0; i < lim.length; i += 90) {
        const parte = lim.slice(i, i + 90);
        const { results } = await db.prepare(`select id, estado, version, json from series where id in (${parte.map(() => '?').join(',')})`).bind(...parte).all();
        for (const f of results) { const s = leerFila(f); if (s) mapa.set(s.id, s); }
      }
      return mapa;
    },
    async uno(id) { const f = ID_SERIE_OK.test(String(id)) ? await fila(String(id)) : null; return f ? leerFila(f) : null; },
    /** Guarda una serie NUEVA. Nunca pisa otra con el mismo id (si existe, el id lleva un sufijo). */
    async crear(serie, extra = {}) {
      let id = String(serie?.id || '');
      if (!ID_SERIE_OK.test(id)) id = 'serie';
      const t = ahora();
      for (let i = 0; i < REINTENTOS; i++) {
        const cand = i === 0 ? id : `${id.slice(0, 54)}-${azar()}${i > 1 ? i : ''}`; // ≤ 60: 54 + «-» + 4 del azar + el número del intento; cada vuelta prueba un candidato DISTINTO (un id largo recortado volvía a dar el mismo)
        const s = { ...structuredClone(serie), id: cand, estado: 'previsto', creada: t, actualizada: t, v: 1, escaleta_v: 1, intentos: {}, fallos: {}, pasos: {}, libro: null, autorizado: null, token_reg: null, ...extra };
        s.hash = hashEscaleta(s);
        const r = await db.prepare('insert or ignore into series (id, estado, version, json, creada, actualizada) values (?, ?, 1, ?, ?, ?)').bind(cand, s.estado, texto(s), t, t).run();
        if ((r.meta?.changes ?? 0) === 1) return copia(s);
      }
      throw new Error('no se pudo dar un id libre a la serie');
    },
    async actualizar(id, fn) {
      id = String(id);
      for (let i = 0; i < REINTENTOS; i++) {
        const f = await fila(id); if (!f) return null;
        const antes = leerFila(f); if (!antes) return null;
        const hecha = fn(structuredClone(antes)); if (hecha === undefined) return copia(antes);
        const s = { ...hecha, id: antes.id, creada: antes.creada, v: f.version + 1, actualizada: ahora() };
        const h = hashEscaleta(s); if (h !== antes.hash) s.escaleta_v = (antes.escaleta_v || 1) + 1; s.hash = h;
        const r = await db.prepare('update series set json = ?, estado = ?, version = version + 1, actualizada = ? where id = ? and version = ?').bind(texto(s), s.estado, s.actualizada, id, f.version).run();
        if ((r.meta?.changes ?? 0) === 1) return copia(s);
      }
      throw new Error('la serie cambió demasiadas veces a la vez; vuelve a intentarlo');
    },
  };
}

// Analíticas en la nube: la foto diaria de cada cuenta de Meta (seguidores, alcance, interacciones) y sus publicaciones recientes con cifras.
// Lo que se LEE de Meta y cómo se arman las filas es el código de la oficina local (contenido/metricas-core.mjs); aquí solo se decide DÓNDE se guarda:
//   · la fila de cada cuenta y día → `contenido_dias`; las publicaciones → `contenido_pubs`; las miniaturas (que Meta deja caducar en días) → R2: contenido/miniaturas/<hash>.<ext>.
//   · el token de Meta nunca se guarda: el cliente de Meta (conductores.js) lo lee de `env`.
// Un Worker tiene un tope de llamadas por vuelta: `fotografiarVuelta` hace UNA cuenta por vuelta del cron (o las que alcancen en una petición, con `puedeSeguir`).
import { createHash } from 'node:crypto';
import { mensajeMeta } from '../../../../contenido/meta-nucleo.mjs';
import { crearRecolector, claveDia, filaDeFallo, pendientesDe, mesesDeLectura, armarLectura, mezclarPublicaciones, fechaDeFoto, tipoDeImagen, MAX_BYTES_MINIATURA, DOMINIO_DE_META, HORA_DE_LA_FOTO } from '../../../../contenido/metricas-core.mjs';

const EXTENSIONES = ['jpg', 'png', 'webp'];
export const RAIZ_MINIATURAS = 'contenido/miniaturas/';

export function crearAnaliticasD1({ db, bucket, meta, fetchFn = (...a) => fetch(...a), ahora = Date.now, puedeSeguir = () => true }) {
  const recolector = crearRecolector({ graph: meta.graph, tokenDe: meta.tokenDe, ahora });
  const filasDelMes = async mes => Object.fromEntries((await db.prepare('select id, json from contenido_dias where mes = ?').bind(mes).all()).results.map(f => [f.id, JSON.parse(f.json)]));
  const pubsGuardadas = async () => Object.fromEntries((await db.prepare('select id, json from contenido_pubs').all()).results.map(f => [f.id, JSON.parse(f.json)]));
  const escribirDia = (cuenta, fila) => db.prepare('insert into contenido_dias (id, mes, json) values (?,?,?) on conflict (id) do update set json = excluded.json').bind(claveDia(cuenta, fila.fecha), fila.fecha.slice(0, 7), JSON.stringify(fila)).run();

  /** Baja UNA miniatura a R2. Solo de los dominios de Meta, solo imágenes, con tope de tamaño. */
  async function guardarMiniatura(url, clave) {
    if (!bucket) return null;
    let u; try { u = new URL(url); } catch { return null; }
    if (u.protocol !== 'https:' || !DOMINIO_DE_META.test(u.hostname)) return null;
    const hash = createHash('sha1').update(clave).digest('hex').slice(0, 20);
    for (const e of EXTENSIONES) if (await bucket.head(RAIZ_MINIATURAS + `${hash}.${e}`)) return hash;
    try {
      const res = await fetchFn(u); if (!res.ok) return null;
      const b = Buffer.from(await res.arrayBuffer()); if (!b.length || b.length > MAX_BYTES_MINIATURA) return null;
      const e = tipoDeImagen(b); if (!e) return null;
      await bucket.put(RAIZ_MINIATURAS + `${hash}.${e}`, b, { httpMetadata: { contentType: e === 'jpg' ? 'image/jpeg' : `image/${e}` } });
      return hash;
    } catch { return null; }
  }

  /** La copia de una miniatura para servirla: solo con un hash hexadecimal, nunca con una ruta que llegue de la red. → { cuerpo, tipo } | null */
  async function miniatura(hash) {
    if (!/^[a-f0-9]{20}$/.test(String(hash)) || !bucket) return null;
    for (const e of EXTENSIONES) { const o = await bucket.get(RAIZ_MINIATURAS + `${hash}.${e}`); if (o) return { cuerpo: o.body, tipo: e === 'jpg' ? 'image/jpeg' : `image/${e}` }; }
    return null;
  }

  /** Fotografía una cuenta y guarda su fila de `fecha` y sus publicaciones. Lanza si Meta no entregó ni los seguidores. */
  async function fotografiarCuenta(cuenta, fecha = fechaDeFoto(new Date(ahora()))) {
    const { fila, publicaciones } = await recolector.recolectar(cuenta, fecha);
    await escribirDia(cuenta, fila);
    const guardadas = await pubsGuardadas();
    const nuevas = await mezclarPublicaciones({ guardadas: { ...guardadas }, cuenta, publicaciones, miniatura: guardarMiniatura, ahora });
    const lotes = [];
    for (const [id, p] of Object.entries(nuevas)) if (JSON.stringify(guardadas[id]) !== JSON.stringify(p)) lotes.push(db.prepare('insert into contenido_pubs (id, publicada, json) values (?,?,?) on conflict (id) do update set publicada = excluded.publicada, json = excluded.json').bind(id, String(p.publicadaAt || ''), JSON.stringify(p)));
    for (const id of Object.keys(guardadas)) if (!(id in nuevas)) lotes.push(db.prepare('delete from contenido_pubs where id = ?').bind(id));
    for (let i = 0; i < lotes.length; i += 25) await db.batch(lotes.slice(i, i + 25));
    return fila;
  }
  async function apuntarFallo(cuenta, fecha, e) {
    const dias = await filasDelMes(fecha.slice(0, 7)), fila = filaDeFallo(cuenta, fecha, e, dias[claveDia(cuenta, fecha)], ahora);
    if (fila) await escribirDia(cuenta, fila);
  }
  const pendientes = async (cuentas, fecha = fechaDeFoto(new Date(ahora()))) => pendientesDe(cuentas, fecha, await filasDelMes(fecha.slice(0, 7)), ahora);

  /** Fotografía las cuentas que faltan (o todas con `todas`) mientras `puedeSeguir()` lo permita: lo que falla se apunta y no frena a las demás. */
  async function actualizar({ todas = false } = {}) {
    const fecha = fechaDeFoto(new Date(ahora())), cuentas = todas ? meta.estado().cuentas : await pendientes(meta.estado().cuentas, fecha);
    const lote = { hechas: 0, fallidas: [], total: cuentas.length, fecha };
    for (const c of cuentas) {
      if (!puedeSeguir()) break;
      try { await fotografiarCuenta(c, fecha); lote.hechas++; }
      catch (e) { lote.fallidas.push({ cuenta: c.nombre, motivo: mensajeMeta(e) }); await apuntarFallo(c, fecha, e); }
    }
    return lote;
  }

  /** Lo guardado de los últimos `dias` días, listo para las cuentas de src/contenido-cifras.js. */
  async function leer({ dias = 90 } = {}) {
    const filasPorMes = []; for (const m of mesesDeLectura(dias, ahora)) filasPorMes.push(await filasDelMes(m));
    return armarLectura({ filasPorMes, pubs: await pubsGuardadas(), dias, ahora });
  }
  return { fotografiarCuenta, actualizar, pendientes, leer, miniatura, fechaDeFoto: () => fechaDeFoto(new Date(ahora())), horaDeLaFoto: HORA_DE_LA_FOTO };
}

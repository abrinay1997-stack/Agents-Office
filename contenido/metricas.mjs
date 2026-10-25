// ============================================================
// Agents Office V4.7 (F2) — la foto diaria de métricas
//
// PORTADO de Juancito Ads — juanarrietabusiness-pixel/CALENDARIOS-MARKETING-APP, worker/lib/metricas.js (30 sep 2026). Lo que
// se cambió al traerlo: la D1 y el cron por una carpeta (`data/contenido/metricas/`) y un reloj de la oficina; se quitó TikTok
// (no es de F2) y la competencia (la oficina no sigue competidores todavía); no hay tope de 50 peticiones por vuelta (esto corre
// en una computadora, no en un Worker gratuito), pero las cuentas se leen UNA A UNA y las peticiones en serie: Meta limita por
// uso y no hay prisa.
//
// POR QUÉ UNA FOTO CADA DÍA
//   Meta guarda pocos días de historia de una cuenta: la evolución de seguidores de un mes solo existe si alguien la apunta cada
//   día. La foto es de AYER (el último día completo), y se hace desde las 6:00 del reloj de esta máquina. Si la computadora estaba
//   apagada a esa hora, se hace al encenderla: lo que cuenta es que falte la de ayer, no la hora.
//
// LO QUE META NO DA NO ROMPE LA FOTO
//   Meta retira y renombra métricas a menudo (`impressions` pasó a `views` en 2025). Cada grupo se pide por su lado y lo que falle
//   queda vacío: una foto con el alcance en blanco vale más que ninguna foto. Y si Meta no entrega ni los seguidores, no se guarda
//   una foto de ceros: se apunta el fallo y se reintenta más tarde.
//
// LAS MINIATURAS CADUCAN
//   Las direcciones de imagen de Meta dejan de servir en días. Al fotografiar se guarda una copia local de cada miniatura (solo
//   de los dominios de Meta, comprobando por sus primeros bytes que sea una imagen) y la foto apunta a la copia.
//
// NADA DE ESTO SE HA PROBADO CONTRA META (ver contenido/meta.mjs): los tests usan un Graph de mentira.
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { mensajeMeta } from './meta.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { DIAS_PUBLICACIONES, MAX_PUBLICACIONES, MAX_PUBLICACIONES_GUARDADAS, HORA_DE_LA_FOTO, REINTENTO_MIN, INTENTOS_POR_DIA, MAX_BYTES_MINIATURA, DOMINIO_DE_META, ymd,
  fechaDeFoto, tipoDeImagen, crearRecolector, claveDia, filaDeFallo, pendientesDe, mesesDeLectura, armarLectura, mezclarPublicaciones } from './metricas-core.mjs';
// Lo que LEE de Meta, las cuentas y el armado de lo guardado salieron a metricas-core.mjs (sin disco): el Worker de Cloudflare usa el mismo.
export { DIAS_PUBLICACIONES, MAX_PUBLICACIONES, MAX_PUBLICACIONES_GUARDADAS, HORA_DE_LA_FOTO, REINTENTO_MIN, INTENTOS_POR_DIA, fechaDeFoto, tipoDeImagen };

const escribirJSON = (f, datos) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(datos)); renombrar(f + '.tmp', f); };
const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };

export function crearMetricas({ meta, dir, fetchFn = (...a) => fetch(...a), ahora = () => Date.now(), avisar = () => {}, alFotografiar = () => {} }) {
  const { graph, tokenDe } = meta;
  const carpeta = path.join(dir, 'metricas');
  const archivoDias = mes => path.join(carpeta, `dias-${mes}.json`);
  const archivoPubs = path.join(carpeta, 'publicaciones.json');
  const carpetaMiniaturas = path.join(dir, 'miniaturas');
  let enMarcha = null; // la actualización en curso: una a la vez
  const recolector = crearRecolector({ graph, tokenDe, ahora });

  // ---------------------------------------------------------------- miniaturas

  /** Baja UNA miniatura a `data/contenido/miniaturas/`. Solo de los dominios de Meta, solo imágenes, con tope de tamaño. */
  async function guardarMiniatura(url, clave) {
    let u; try { u = new URL(url); } catch { return null; }
    if (u.protocol !== 'https:' || !DOMINIO_DE_META.test(u.hostname)) return null;
    const hash = crypto.createHash('sha1').update(clave).digest('hex').slice(0, 20);
    for (const ext of ['jpg', 'png', 'webp']) if (fs.existsSync(path.join(carpetaMiniaturas, `${hash}.${ext}`))) return hash;
    try {
      const res = await fetchFn(u); if (!res.ok) return null;
      const b = Buffer.from(await res.arrayBuffer()); if (!b.length || b.length > MAX_BYTES_MINIATURA) return null;
      const ext = tipoDeImagen(b); if (!ext) return null;
      fs.mkdirSync(carpetaMiniaturas, { recursive: true });
      fs.writeFileSync(path.join(carpetaMiniaturas, `${hash}.${ext}`), b);
      return hash;
    } catch { return null; }
  }

  /** La copia de una miniatura, para servirla: nunca construye una ruta con lo que llega de la red, solo con un hash hexadecimal. */
  function miniatura(hash) {
    if (!/^[a-f0-9]{20}$/.test(String(hash))) return null;
    for (const ext of ['jpg', 'png', 'webp']) {
      const f = path.join(carpetaMiniaturas, `${hash}.${ext}`);
      if (fs.existsSync(f)) return { archivo: f, tipo: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
    }
    return null;
  }

  // ---------------------------------------------------------------- la foto

  const leerDias = mes => leerJSON(archivoDias(mes), {});

  /** Fotografía una cuenta: su fila de `fecha` y sus publicaciones recientes. Lanza si Meta no entregó ni los seguidores. */
  async function fotografiarCuenta(cuenta, fecha = fechaDeFoto(new Date(ahora()))) {
    const { fila, publicaciones } = await recolector.recolectar(cuenta, fecha);
    const mes = fecha.slice(0, 7), dias = leerDias(mes);
    dias[claveDia(cuenta, fecha)] = fila;
    escribirJSON(archivoDias(mes), dias);

    // Las publicaciones se guardan por id (se reescriben: sus cifras maduran) con una copia local de su miniatura.
    const guardadas = await mezclarPublicaciones({ guardadas: leerJSON(archivoPubs, {}), cuenta, publicaciones, miniatura: guardarMiniatura, ahora });
    escribirJSON(archivoPubs, guardadas);
    return fila;
  }

  /** Apunta que una cuenta falló hoy, para no martillarla: se reintenta pasada una hora, hasta tres veces al día. */
  function apuntarFallo(cuenta, fecha, e) {
    const mes = fecha.slice(0, 7), dias = leerDias(mes), fila = filaDeFallo(cuenta, fecha, e, dias[claveDia(cuenta, fecha)], ahora);
    if (!fila) return;
    dias[claveDia(cuenta, fecha)] = fila;
    escribirJSON(archivoDias(mes), dias);
  }

  /** Las cuentas que faltan por fotografiar para `fecha`: sin foto, o con un fallo ya reposado y con intentos por gastar. */
  function pendientes(cuentas, fecha = fechaDeFoto(new Date(ahora()))) { return pendientesDe(cuentas, fecha, leerDias(fecha.slice(0, 7)), ahora); }

  /**
   * Una vuelta: fotografía las cuentas que faltan (o todas, con `todas`). Una a la vez; lo que falla se apunta y no frena a las demás.
   * Solo hay una en marcha: pedirla otra vez mientras corre devuelve la misma.
   */
  function actualizar({ todas = false } = {}) {
    if (enMarcha) return enMarcha.promesa;
    const estado = meta.estado(), fecha = fechaDeFoto(new Date(ahora()));
    const cuentas = todas ? estado.cuentas : pendientes(estado.cuentas, fecha);
    const lote = { hechas: 0, fallidas: [], total: cuentas.length, promesa: null };
    lote.promesa = (async () => {
      try {
        for (const c of cuentas) {
          try { await fotografiarCuenta(c, fecha); lote.hechas++; }
          catch (e) { lote.fallidas.push({ cuenta: c.nombre, motivo: mensajeMeta(e) }); apuntarFallo(c, fecha, e); }
        }
        if (lote.hechas) { try { alFotografiar(leer({ dias: 90 })); } catch (e) { console.warn('analíticas: al fotografiar:', e.message); } }
        if (lote.fallidas.length) avisar(`Meta no entregó datos de ${lote.fallidas.map(f => '«' + f.cuenta + '»').join(', ')}: ${lote.fallidas[0].motivo}`, { level: 'warn', key: 'analiticas-fallo' });
        return { hechas: lote.hechas, fallidas: lote.fallidas, total: lote.total, fecha };
      } finally { enMarcha = null; }
    })();
    enMarcha = lote;
    return lote.promesa;
  }

  /** Lo guardado de los últimos `dias` días, listo para las cuentas de src/contenido-cifras.js. */
  function leer({ dias = 90 } = {}) {
    return armarLectura({ filasPorMes: mesesDeLectura(dias, ahora).map(leerDias), pubs: leerJSON(archivoPubs, {}), dias, ahora });
  }

  return { fotografiarCuenta, actualizar, pendientes, leer, miniatura, enMarcha: () => Boolean(enMarcha), fechaDeFoto: () => fechaDeFoto(new Date(ahora())), horaDeLaFoto: HORA_DE_LA_FOTO };
}

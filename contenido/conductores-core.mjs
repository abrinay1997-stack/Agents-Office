// (NÚCLEO de los conductores simulacro y Metricool, sin disco: lo usa contenido/conductores.mjs —archivos— y el Worker de Cloudflare —D1 y R2—.)
// Agents Office (6 oct 2026, plan M1) — los CONDUCTORES: quién se lleva lo aprobado a las redes. La cola (contenido/programador.mjs) habla
// con una sola interfaz y no sabe cuál hay detrás:
//   { id, nombre, listo() → { ok, motivo }, programar(entrega) → { id, uuid, zona, redes }, retirar(remoto), estado(remoto) → { redes } | null }
//
//   · simulacro — no sale nada de esta máquina: «publica» a su hora en un archivo (data/contenido/simulacro.json). Es el modo por defecto,
//                 para probar todo el circuito sin arriesgar un perfil real (principio 7 de docs/propuesta-contenido-y-meta.md).
//   · metricool — sube los archivos a Metricool (Instagram solo acepta JPEG: las PNG y WebP se convierten antes) y programa la publicación con
//                 su fecha y su hora: Metricool la publica desde sus servidores, con esta computadora apagada.
//   · meta      — (8 oct 2026, F3) directo en Instagram y Facebook, sin Metricool: Facebook queda programado en Meta; Instagram (que no
//                 se programa por API) lo publica esta oficina a su hora. Vive en contenido/meta-publicar.mjs.
import * as MC from './metricool.mjs';

/** El simulacro: todo el circuito, sin salir de esta máquina. `almacen` { leer() → { posts }, guardar(d) } (síncronos o promesas); `aleatorio()` → 8 hex. */
export function crearSimulacroNucleo({ almacen, ahora = Date.now, fallan = () => [], aleatorio } = {}) {
  const leer = async () => (await almacen.leer()) ?? { posts: {} };
  return {
    id: 'simulacro', nombre: 'Simulacro',
    listo: () => ({ ok: true, motivo: '' }),
    async programar(e) {
      const d = await leer(), id = 'sim-' + aleatorio();
      d.posts[id] = { momento: e.momento, redes: e.redes, texto: String(e.texto || '').slice(0, 200), medios: e.medios, ...(e.cuentas ? { cuentas: e.cuentas } : {}), creada: ahora() }; // 9 oct 2026: y en qué cuenta habría salido
      await almacen.guardar(d);
      return { id, uuid: '', zona: '', redes: Object.fromEntries(e.redes.map(r => [r, { estado: 'en_red', url: '', detalle: '' }])) };
    },
    async retirar(r) { const d = await leer(); if (d.posts[r.id]) { d.posts[r.id].borrada = ahora(); await almacen.guardar(d); } return true; },
    async estado(r) {
      const p = (await leer()).posts[r.id]; if (!p || p.borrada) return null;
      if (ahora() < p.momento) return { redes: Object.fromEntries(p.redes.map(x => [x, { estado: 'en_red', url: '', detalle: '' }])) };
      const mal = fallan();
      return { redes: Object.fromEntries(p.redes.map(x => [x, mal.includes(x) ? { estado: 'fallo', url: '', detalle: 'Fallo simulado' } : { estado: 'publicada', url: `https://simulacro.invalid/${x}/${r.id}`, detalle: 'Simulacro: no salió de verdad' }])) };
    },
  };
}

const esImagen = f => /\.(png|jpe?g|webp)$/i.test(f), esJpeg = f => /\.jpe?g$/i.test(f);
const TIPO = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

/**
 * Metricool. `medios` { info(id) → { version, nombre (con extensión) } | null, datos(id) → bytes }: de dónde salen los archivos del Estudio;
 * `aJpeg(bytes)` → JPEG (Instagram solo acepta JPEG); `cache` { leer() → { clave: url }, guardar(d) }: lo ya subido (por id y versión), para no subir dos veces.
 */
export function crearConductorMetricoolNucleo({ mc, medios, aJpeg, cache, cuentaValida = () => '' } = {}) {
  // 9 oct 2026: Metricool publica en las cuentas de SU marca; si la pieza pide otra (`cuentaValida(red, id)` da el motivo), no sale en ninguna
  const noEsDeLaMarca = e => { for (const [red, id] of Object.entries(e.cuentas || {})) { if (!(e.redes || []).includes(red)) continue; const m = cuentaValida(red, id); if (m) return m; } return ''; };
  async function subir(id, jpeg) {
    const info = await medios.info(id); if (!info) throw Object.assign(new Error(`el Estudio ya no tiene «${id}»: quizá se fue a la papelera`), { transitorio: false });
    const convertir = jpeg && esImagen(info.nombre) && !esJpeg(info.nombre), clave = `${id}|${info.version}|${convertir ? 'jpg' : 'tal'}`;
    const c = (await cache.leer()) ?? {}; if (c[clave]) return c[clave];
    let datos = await medios.datos(id), nombre = info.nombre, ext = (/\.([^.]+)$/.exec(nombre)?.[1] || '').toLowerCase();
    if (convertir) { datos = await aJpeg(datos); nombre = nombre.replace(/\.[^.]+$/, '.jpg'); ext = 'jpg'; }
    const url = await mc.subirArchivo({ datos, nombre, tipo: TIPO[ext] || 'application/octet-stream' });
    const d = (await cache.leer()) ?? {}; d[clave] = url; await cache.guardar(d); return url;
  }
  return {
    id: 'metricool', nombre: 'Metricool',
    listo: () => (mc.configurado() ? { ok: true, motivo: '' } : { ok: false, motivo: 'Faltan METRICOOL_USER_TOKEN y METRICOOL_USER_ID (variables de Windows; Metricool → Ajustes de la cuenta → API, plan Advanced).' }),
    async programar(e) {
      const otra = noEsDeLaMarca(e); if (otra) throw Object.assign(new Error(otra), { transitorio: false });
      const jpeg = e.redes.includes('instagram'), urls = [];
      for (const id of e.medios) urls.push(await subir(id, jpeg));
      const m = await mc.marca(), zona = m?.zona || MC.zonaDeEstaMaquina();
      let r;
      try { r = await mc.programar(MC.cuerpoPost({ ...e, medios: urls, zona })); }
      catch (err) { // A1: si Metricool no contestó (red, 5xx) no se sabe si recibió la publicación: se marca para que la cola NO la repita sola
        if (err && (err.estado === undefined || err.estado === 0 || [500, 502, 504].includes(err.estado))) err.incierto = true; // 429 y 503 dicen «no la procesé»: esos sí se reintentan
        throw err;
      }
      if (!r.id) throw Object.assign(new Error('Metricool no devolvió el número de la publicación: compruébalo en su planificador antes de reintentar.'), { transitorio: false });
      return { id: r.id, uuid: r.uuid, zona, redes: Object.fromEntries(e.redes.map(x => [x, { estado: 'en_red', url: '', detalle: '' }])) };
    },
    async retirar(r) { try { await mc.borrar(r.id); } catch (e) { if (e.estado !== 404) throw e; } return true; },
    async estado(r) {
      const p = await mc.estado(r.id, r.momento, r.zona); if (!p) return null;
      return { redes: Object.fromEntries(p.redes.map(x => [x.red, { estado: x.estado, url: x.url, detalle: x.detalle }])) };
    },
  };
}

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
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as MC from './metricool.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); renombrar(f + '.tmp', f); };

/** El simulacro: todo el circuito, sin salir de esta máquina. */
export function crearSimulacro({ archivo, ahora = Date.now, fallan = () => [] } = {}) {
  const leer = () => leerJSON(archivo, { posts: {} });
  return {
    id: 'simulacro', nombre: 'Simulacro',
    listo: () => ({ ok: true, motivo: '' }),
    async programar(e) {
      const d = leer(), id = 'sim-' + crypto.randomBytes(4).toString('hex');
      d.posts[id] = { momento: e.momento, redes: e.redes, texto: String(e.texto || '').slice(0, 200), medios: e.medios, ...(e.cuentas ? { cuentas: e.cuentas } : {}), creada: ahora() }; // 9 oct 2026: y en qué cuenta habría salido
      escribirJSON(archivo, d);
      return { id, uuid: '', zona: '', redes: Object.fromEntries(e.redes.map(r => [r, { estado: 'en_red', url: '', detalle: '' }])) };
    },
    async retirar(r) { const d = leer(); if (d.posts[r.id]) { d.posts[r.id].borrada = ahora(); escribirJSON(archivo, d); } return true; },
    async estado(r) {
      const p = leer().posts[r.id]; if (!p || p.borrada) return null;
      if (ahora() < p.momento) return { redes: Object.fromEntries(p.redes.map(x => [x, { estado: 'en_red', url: '', detalle: '' }])) };
      const mal = fallan();
      return { redes: Object.fromEntries(p.redes.map(x => [x, mal.includes(x) ? { estado: 'fallo', url: '', detalle: 'Fallo simulado' } : { estado: 'publicada', url: `https://simulacro.invalid/${x}/${r.id}`, detalle: 'Simulacro: no salió de verdad' }])) };
    },
  };
}

const esImagen = f => /\.(png|jpe?g|webp)$/i.test(f), esJpeg = f => /\.jpe?g$/i.test(f);
const TIPO = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

/**
 * Metricool. `rutaMedio(id)` da la ruta de un archivo del Estudio; `aJpeg(buffer)` lo convierte (sharp); `cache` es el archivo donde se
 * recuerda lo ya subido (por id y fecha de cambio), para no subir dos veces la misma imagen.
 */
export function crearConductorMetricool({ mc, rutaMedio, aJpeg, cache, cuentaValida = () => '' } = {}) {
  // 9 oct 2026: Metricool publica en las cuentas de SU marca; si la pieza pide otra (`cuentaValida(red, id)` da el motivo), no sale en ninguna
  const noEsDeLaMarca = e => { for (const [red, id] of Object.entries(e.cuentas || {})) { if (!(e.redes || []).includes(red)) continue; const m = cuentaValida(red, id); if (m) return m; } return ''; };
  const subidas = () => leerJSON(cache, {});
  async function subir(id, jpeg) {
    const ruta = rutaMedio(id); if (!ruta || !fs.existsSync(ruta)) throw Object.assign(new Error(`el Estudio ya no tiene «${id}»: quizá se fue a la papelera`), { transitorio: false });
    const st = fs.statSync(ruta), convertir = jpeg && esImagen(ruta) && !esJpeg(ruta), clave = `${id}|${st.mtimeMs}|${convertir ? 'jpg' : 'tal'}`;
    const c = subidas(); if (c[clave]) return c[clave];
    let datos = fs.readFileSync(ruta), nombre = path.basename(ruta), ext = path.extname(ruta).slice(1).toLowerCase();
    if (convertir) { datos = await aJpeg(datos); nombre = nombre.replace(/\.[^.]+$/, '.jpg'); ext = 'jpg'; }
    const url = await mc.subirArchivo({ datos, nombre, tipo: TIPO[ext] || 'application/octet-stream' });
    const d = subidas(); d[clave] = url; escribirJSON(cache, d); return url;
  }
  return {
    id: 'metricool', nombre: 'Metricool',
    listo: () => (mc.configurado() ? { ok: true, motivo: '' } : { ok: false, motivo: 'Faltan METRICOOL_USER_TOKEN y METRICOOL_USER_ID (variables de Windows; Metricool → Ajustes de la cuenta → API, plan Advanced).' }),
    async programar(e) {
      const otra = noEsDeLaMarca(e); if (otra) throw Object.assign(new Error(otra), { transitorio: false });
      const jpeg = e.redes.includes('instagram'), medios = [];
      for (const id of e.medios) medios.push(await subir(id, jpeg));
      const m = await mc.marca(), zona = m?.zona || MC.zonaDeEstaMaquina();
      const r = await mc.programar(MC.cuerpoPost({ ...e, medios, zona }));
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

/** Meta directo (F3, 8 oct 2026): contenido/meta-publicar.mjs. */
export { crearConductorMeta } from './meta-publicar.mjs';

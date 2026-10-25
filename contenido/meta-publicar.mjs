// Agents Office (8 oct 2026, F3) — el conductor META: lo aprobado en Contenido sale directo en Instagram y Facebook, sin Metricool.
// Pedido del dueño: «construye la publicación directa con Meta». Habla la misma interfaz que los demás conductores
// (contenido/conductores.mjs): { id, nombre, listo, programar, retirar, estado } y además `pulso()` y `comprobar()`.
//
// LO QUE META DEJA Y LO QUE NO (comprobado contra el SDK oficial facebook_business 26.0.2 —generado de la especificación de la Graph
// API— y contra las notas de ig-publish, deegitech, MIT, octubre de 2026; la documentación de Meta no se pudo abrir desde aquí):
//   · FACEBOOK sí programa: /{página}/photos, /feed y /videos aceptan `published=false` + `scheduled_publish_time` (de 10 minutos a
//     30 días). Lo programado sale solo, con esta computadora apagada. Las historias (/photo_stories) no se programan: salen a su hora.
//   · INSTAGRAM NO programa: /{ig}/media no tiene `scheduled_publish_time`. La oficina lo publica A SU HORA, desde esta computadora:
//     15 minutos antes prepara el contenedor (y sube el video), y a la hora lo publica (/media_publish). Si la oficina está apagada a esa
//     hora, sale al encenderla hasta 30 minutos tarde; después ya no, y lo dice.
//   · Instagram baja las IMÁGENES de una dirección pública (image_url): esta oficina no tiene una. La imagen se sube a la página de
//     Facebook como foto temporal sin publicar y se le da a Instagram su dirección de Meta (`images[0].source`). VERIFICADO el 9 oct 2026 con la
//     cuenta real (scripts/check-meta-publicar.mjs: Instagram dejó el contenedor FINISHED). Los VIDEOS van por la subida reanudable
//     (rupload.facebook.com), que no necesita dirección pública.
//   · Un contenedor de Instagram se publica una sola vez: si /media_publish no contesta, se lee el contenedor antes de nada
//     (PUBLISHED = ya salió). Nunca se publica dos veces (ig-publish: «an error does not mean not published»).
//   · Un POST a Facebook que no contesta (red caída, 5xx) NO se repite: no se sabe si se creó, y repetirlo podría duplicarla. Falla
//     diciendo que se mire la página, como hace el conductor de Metricool.
//
// `programar()` no llama a Meta: valida y apunta la AGENDA (data/contenido/meta-agenda.json, de esta máquina). El `pulso()` (cada 30 s,
// serve.mjs, solo en modo real) hace el trabajo: programar en Facebook, preparar y publicar en Instagram, y mirar si salió. El token
// nunca toca la agenda ni un error (meta.sinToken).
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { crearConductorMeta as crearConductorMetaNucleo, tipoDe } from './meta-publicar-core.mjs';
// Todo lo que no toca el disco (el plan de cada red, los tiempos, el conductor entero) vive en meta-publicar-core.mjs: el Worker de Cloudflare usa el mismo.
export * from './meta-publicar-core.mjs';

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); renombrar(f + '.tmp', f); };
const propio = (mensaje, transitorio = false) => Object.assign(new Error(mensaje), { transitorio });

/**
 * El conductor. `meta`: el cliente de contenido/meta.mjs (sin él, «no listo»). `rutaMedio(id)` → la ruta de un archivo del Estudio;
 * `aJpeg(buffer)` → JPEG (Instagram); `archivo` → la agenda; `pagina()` → el id de la página elegida (office.config → contenido.metaPagina;
 * vacío = la primera); `alCambiar()` → algo salió o falló (la cola lo mira ya); `inmediato` → un pulso al programar (los tests lo apagan).
 */
export function crearConductorMeta({ meta = null, rutaMedio = () => null, aJpeg = async b => b, archivo = null, pagina = () => '', ahora = Date.now, alCambiar = () => {}, avisar = () => {}, inmediato = true } = {}) {
  const ext = f => path.extname(String(f || '')).slice(1).toLowerCase();
  const medios = {
    tipo: async id => { const ruta = rutaMedio(id); return ruta && fs.existsSync(ruta) ? tipoDe(ruta) : null; },
    bytes: async (id, jpeg) => {
      const ruta = rutaMedio(id); if (!ruta || !fs.existsSync(ruta)) throw propio(`el Estudio ya no tiene «${id}»: quizá se fue a la papelera`);
      let datos = fs.readFileSync(ruta), nombre = path.basename(ruta), tipo = tipoDe(ruta) === 'video' ? (ext(ruta) === 'mov' ? 'video/quicktime' : 'video/mp4') : `image/${ext(ruta) === 'jpg' ? 'jpeg' : ext(ruta)}`;
      if (jpeg && tipoDe(ruta) === 'imagen' && !/^jpe?g$/.test(ext(ruta))) { datos = await aJpeg(datos); nombre = nombre.replace(/\.[^.]+$/, '.jpg'); tipo = 'image/jpeg'; }
      return { datos, nombre, tipo };
    },
  };
  const agenda = archivo ? { leer: () => leerJSON(archivo, { trabajos: {} }), guardar: d => escribirJSON(archivo, d) } : null;
  return crearConductorMetaNucleo({ meta, medios, agenda, pagina, ahora, alCambiar, avisar, inmediato });
}

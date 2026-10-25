// Los conductores de Contenido en el Worker: Meta (el cliente con su freno por uso y sus cuentas), el simulacro, Metricool y el conductor «meta» que publica directo.
// Es la misma lógica que la oficina local (contenido/meta-nucleo.mjs, meta-publicar-core.mjs, conductores-core.mjs); aquí solo se le pone DÓNDE guardar (D1)
// y de dónde salen los archivos (R2). Reglas que no cambian:
//  · el token de Meta (`env.META_ACCESS_TOKEN`, y `META_APP_SECRET` si la app pide prueba de secreto) no se escribe en D1, ni en un registro, ni en una respuesta;
//    los tokens de cada página se piden a Meta en cada vuelta y no se guardan.
//  · el freno por uso de Meta (`X-App-Usage`…, `pedir`) se recuerda en D1 (un Worker no recuerda nada entre peticiones): si Meta pidió esperar, ninguna vuelta llama.
//  · la agenda de Instagram (qué contenedor está listo, cuál es «incierto») se guarda ANTES de la siguiente llamada: el «nunca dos veces» sobrevive a un Worker que muere.
import { crearMetaNucleo } from '../../../../contenido/meta-nucleo.mjs';
import { crearConductorMeta, tipoDe } from '../../../../contenido/meta-publicar-core.mjs';
import { crearSimulacroNucleo, crearConductorMetricoolNucleo } from '../../../../contenido/conductores-core.mjs';
import { crearMetricool } from '../../../../contenido/metricool.mjs';
import { porDefecto as porDefectoCuentas, MOTIVO_METRICOOL } from '../../../../src/contenido-cuentas.js';
import { leerDoc, guardarDoc } from '../almacen.js';

export const CLAVES = { cuentas: 'contenido.meta.cuentas', freno: 'contenido.meta.freno', agenda: 'contenido.meta.agenda', simulacro: 'contenido.simulacro', subidas: 'contenido.metricool.subidas', mejoresHoras: 'contenido.mejores-horas' };
const ext = f => { const m = /\.([^./\\]+)$/.exec(String(f || '')); return m ? m[1].toLowerCase() : ''; };
const propio = (mensaje, transitorio = false) => Object.assign(new Error(mensaje), { transitorio });
const claveValida = id => { const rel = String(id ?? '').replace(/\\/g, '/'); return rel && !rel.includes('..') && !rel.startsWith('/') && rel.length <= 300 ? rel : null; };

/** Los archivos del Estudio en R2 (la clave es el id: `2026-10/<archivo>`, como en la galería local). */
export function crearMediosR2({ bucket, aJpeg }) {
  const info = async id => { const k = claveValida(id); if (!k || !bucket) return null; try { const h = await bucket.head(k); return h ? { clave: k, version: h.etag || h.uploaded?.toISOString?.() || String(h.size), nombre: k.split('/').pop() } : null; } catch { return null; } };
  return {
    info,
    async tipo(id) { const i = await info(id); return i ? tipoDe(i.nombre) : null; },
    async datos(id) { const k = claveValida(id); const o = k && bucket ? await bucket.get(k) : null; if (!o) throw propio(`el Estudio ya no tiene «${id}»: quizá se fue a la papelera`); return new Uint8Array(await o.arrayBuffer()); },
    async bytes(id, jpeg) {
      const i = await info(id); if (!i) throw propio(`el Estudio ya no tiene «${id}»: quizá se fue a la papelera`);
      let datos = await this.datos(id), nombre = i.nombre, e = ext(nombre), tipo = tipoDe(nombre) === 'video' ? (e === 'mov' ? 'video/quicktime' : 'video/mp4') : `image/${e === 'jpg' ? 'jpeg' : e}`;
      if (jpeg && tipoDe(nombre) === 'imagen' && !/^jpe?g$/.test(e)) { datos = await aJpeg(datos); nombre = nombre.replace(/\.[^.]+$/, '.jpg'); tipo = 'image/jpeg'; }
      return { datos, nombre, tipo };
    },
  };
}

/** PNG/WebP → JPEG con el binding de imágenes de Cloudflare (el binding `IMAGES`), si el Worker lo tiene. Sin él, un mensaje que dice qué hacer (nunca se manda a Instagram algo que no acepta). */
export function aJpegDeEnv(env) {
  return async datos => {
    const IMAGES = env['IMAGES']; // el binding de imágenes de Cloudflare (hay que declararlo en wrangler.jsonc: ver docs/cloudflare.md, Fase 5); con corchetes porque no es un secreto
    if (!IMAGES?.input) throw propio('Instagram solo acepta JPEG y esta imagen no lo es. En la nube no hay con qué convertirla (falta el binding IMAGES del Worker): guárdala como JPEG en el Estudio o publícala solo en Facebook.');
    try {
      const salida = await IMAGES.input(new Blob([datos]).stream()).output({ format: 'image/jpeg', quality: 90 });
      return new Uint8Array(await salida.response().arrayBuffer());
    } catch (e) { throw propio(`no pude convertir la imagen a JPEG: ${String(e?.message || e).slice(0, 160)}`); }
  };
}

/** El cliente de Meta con sus cuentas y su freno en D1. `await cargar()` antes de usarlo y `await vaciar()` al terminar (lo que se apuntó se escribe entonces). */
export function crearMetaD1({ env, db, fetchFn = (...a) => fetch(...a), ahora = Date.now }) {
  let cuentas = null, pendientes = [], frenoGuardado = { pct: -1, hasta: 0 };
  const almacen = { leer: () => cuentas, escribir: d => { cuentas = JSON.parse(JSON.stringify(d)); pendientes.push(guardarDoc(db, CLAVES.cuentas, d)); } };
  const meta = crearMetaNucleo({
    env, fetchFn, ahora, almacen,
    alCambiarFreno: f => { // solo si cambió de verdad (cada llamada a Meta no es una escritura a D1)
      if (f.hasta === frenoGuardado.hasta && Math.abs(f.pct - frenoGuardado.pct) < 5) return;
      frenoGuardado = { pct: f.pct, hasta: f.hasta }; pendientes.push(guardarDoc(db, CLAVES.freno, f));
    },
  });
  return {
    meta,
    async cargar() {
      cuentas = (await leerDoc(db, CLAVES.cuentas, null)).valor;
      const f = (await leerDoc(db, CLAVES.freno, null)).valor; if (f) { meta.ponerFreno(f); frenoGuardado = { pct: f.pct ?? 0, hasta: f.hasta ?? 0 }; }
      return this;
    },
    async vaciar() { const p = pendientes; pendientes = []; await Promise.all(p); },
  };
}

/** La agenda del conductor Meta en D1 (se carga al empezar la vuelta; cada `guardar` se espera: el avance queda apuntado antes de seguir). */
function crearAgendaD1(db) {
  let cache = { trabajos: {} };
  return {
    async cargar() { cache = (await leerDoc(db, CLAVES.agenda, { trabajos: {} })).valor; if (!cache.trabajos) cache.trabajos = {}; },
    leer: () => JSON.parse(JSON.stringify(cache)),
    async guardar(d) { cache = JSON.parse(JSON.stringify(d)); await guardarDoc(db, CLAVES.agenda, d); },
  };
}

/**
 * Los tres conductores y cuál toca. `config()` (síncrono) da los ajustes de Contenido ya cargados; `puedeSeguir()` corta una vuelta que ya hizo demasiadas llamadas;
 * `alCambiar()` avisa de que Meta publicó o falló algo (la cola lo mira en la misma vuelta). `cargar()` antes, `vaciar()` después.
 */
export function crearConductoresD1({ env, db, fetchFn = (...a) => fetch(...a), ahora = Date.now, config, avisar = () => {}, alCambiar = () => {}, puedeSeguir = () => true, inyectados = {} }) {
  const m = inyectados.meta || crearMetaD1({ env, db, fetchFn, ahora });
  const medios = inyectados.medios || crearMediosR2({ bucket: env.MEDIA, aJpeg: aJpegDeEnv(env) });
  const agenda = crearAgendaD1(db);
  const doc = clave => ({ leer: async () => (await leerDoc(db, clave, null)).valor, guardar: d => guardarDoc(db, clave, d) });
  const aleatorio = () => [...crypto.getRandomValues(new Uint8Array(4))].map(x => x.toString(16).padStart(2, '0')).join('');
  const cuentasMeta = () => { try { return m.meta.estado().cuentas || []; } catch { return []; } };
  const mc = inyectados.metricool || crearMetricool({ env, fetchFn, ahora });
  const conductores = {
    simulacro: crearSimulacroNucleo({ almacen: doc(CLAVES.simulacro), ahora, aleatorio }),
    metricool: crearConductorMetricoolNucleo({
      mc, medios, aJpeg: aJpegDeEnv(env), cache: doc(CLAVES.subidas),
      cuentaValida: (red, id) => { const d = porDefectoCuentas(cuentasMeta(), config().metaPagina || ''); return d[red] && id !== d[red] ? MOTIVO_METRICOOL : ''; }, // solo las de su marca
    }),
    meta: crearConductorMeta({ meta: m.meta, medios, agenda, pagina: () => config().metaPagina || '', ahora, alCambiar, avisar, inmediato: false, puedeSeguir }),
  };
  const actual = () => (config().modo === 'real' ? conductores[config().conductor] || conductores.metricool : conductores.simulacro);
  return {
    ...m, conductores, actual, metricool: mc, medios, porId: id => conductores[id] || null,
    async cargar() { await m.cargar(); await agenda.cargar(); return this; },
    vaciar: () => m.vaciar(),
  };
}

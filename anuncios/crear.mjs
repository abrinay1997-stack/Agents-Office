// ============================================================
// Agents Office — Anuncios de Meta, Fase A3 (9 oct 2026): «Crear en Meta (en pausa)». SOLO el dueño, un clic: no gasta (todo nace PAUSED;
// activar es la acción de gasto de la A2, con sus dos clics y sus topes). docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §3 y §5 (A3).
//
// El orden (cada paso, en data/anuncios/creaciones.json ANTES y DESPUÉS de llamar a Meta):
//   (a) validar: lo local (anuncios/modelo.mjs → validarBorrador) y Meta con `execution_options: ["validate_only"]` en la campaña (no crea
//       nada; en conjuntos, creativos y anuncios no se puede validar antes de que exista su padre: POR VERIFICAR si v26 lo deja);
//   (b) subir las imágenes (POST /act_<id>/adimages → hash) y los videos (POST /act_<id>/advideos; se espera `video_status = ready`);
//   (c) un creativo por cada uno (POST /act_<id>/adcreatives);
//   (d) la campaña, PAUSED;  (e) el conjunto, PAUSED;  (f) un anuncio por creativo, PAUSED.
//
// NUNCA DOS VECES. Antes de crear cada campaña, conjunto, creativo o anuncio se busca en Meta por su nombre EXACTO (lleva `· AO:<id del
// borrador>`, anuncios/construir.mjs → nombres): si la oficina se cortó a mitad (o Meta lo creó y la respuesta se perdió), se toma ese y se
// sigue. Al arrancar, `alArrancar()` retoma lo que quedó «creando». Lo archivado no cuenta (es de un intento que falló).
// SI UN PASO FALLA: se archiva lo creado en ESE intento (nunca DELETE), el borrador queda «fallo» con el error en palabras, y se puede
// reintentar (empieza un intento nuevo).
// Al terminar: «creado» con los ids en `meta`, una línea en historial.jsonl («crear en pausa») y en data/audit/, y se relee la cuenta.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { mensajeMeta, ErrorMeta } from '../contenido/meta.mjs';
import { validarBorrador } from './modelo.mjs';
import { cuerpoCampana, cuerpoConjunto, cuerpoCreativo, cuerpoAnuncio, nombres } from './construir.mjs';
import { motivoMeta } from './acciones.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, datos) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(datos, null, 1)); renombrar(f + '.tmp', f); };
export const VIDEO_CADA_MS = 4000, VIDEO_MAX_MS = 10 * 60e3;
export const FORMATOS_VISTA = ['MOBILE_FEED_STANDARD', 'INSTAGRAM_STANDARD', 'INSTAGRAM_STORY'];
const TIPO_IMAGEN = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const TIPO_VIDEO = { '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const PASO_TEXTO = { validar: 'Validando con Meta', imagenes: 'Subiendo las imágenes y los videos', creativos: 'Creando los creativos', campana: 'Creando la campaña en pausa', conjunto: 'Creando el conjunto en pausa', anuncios: 'Creando los anuncios en pausa' };

/**
 * La página y el Instagram de los anuncios: los de Ajustes → Anuncios; si no, la página de Contenido (contenido.metaPagina) o la primera que
 * tenga Instagram, y su Instagram. Puro.
 */
export function resolverCuentas({ ajustes = {}, cuentas = [], paginaContenido = '' } = {}) {
  const fbs = (cuentas || []).filter(c => c.red === 'facebook'), igDe = pid => (cuentas || []).find(c => c.red === 'instagram' && c.paginaId === pid)?.externoId || null;
  const quiero = String(ajustes.pagina || '').trim() || String(paginaContenido || '').trim();
  const fb = (quiero && fbs.find(c => c.paginaId === quiero || c.externoId === quiero)) || (!quiero && (fbs.find(c => igDe(c.paginaId)) || fbs[0])) || null;
  const pagina = quiero || fb?.paginaId || null;
  const instagram = String(ajustes.instagram || '').trim() || (pagina ? igDe(pagina) : null);
  return { pagina, instagram };
}

/**
 * @param {object} o
 * @param {string}   o.dir         data/anuncios
 * @param {object}   o.ads         anuncios/meta-ads.mjs
 * @param {object}   o.sync        anuncios/sincronizar.mjs (listo, cuenta, anotar, sincronizar)
 * @param {object}   o.borradores  anuncios/borradores.mjs
 * @param {object}   o.galeria     { ruta(id) → archivo, item(id) → { kind } } (media.mjs: resolve, item)
 * @param {Function} o.ajustes     () → cfg.anuncios
 * @param {object}   o.defaults    los topes de settings.mjs
 * @param {Function} o.cuentas     () → { pagina, instagram } (resolverCuentas con lo de Meta y Contenido)
 * @param {Function} o.aJpeg       (Buffer) → Buffer JPEG (sharp), para una imagen que no es JPEG ni PNG
 * @param {Function} o.auditar     (entrada) → data/audit/ (serve.mjs)
 * @param {boolean}  o.diferir     Cloudflare (fase 7): un Worker no sigue trabajando tras contestar. Con `diferir`, `crear` solo valida, apunta el diario
 *                                 y deja el borrador «creando»; lo crea en Meta el cron, con `alArrancar` (que ya sabe retomar lo apuntado).
 */
export function crearCreador({ dir, ads, sync, borradores, galeria, ajustes = () => ({}), defaults = {}, cuentas = () => ({}), aJpeg = null, auditar = () => {}, ahora = () => Date.now(), dormir = ms => new Promise(r => setTimeout(r, ms)), videoCadaMs = VIDEO_CADA_MS, videoMaxMs = VIDEO_MAX_MS, diferir = false }) {
  const F = path.join(dir, 'creaciones.json');
  const diario = () => leerJSON(F, {});
  const apuntar = (bid, j) => { const d = diario(); d[bid] = j; escribirJSON(F, d); };
  const enMarcha = new Map(); // id del borrador → la promesa de su creación (una a la vez por borrador)
  const R = (status, cuerpo) => ({ status, cuerpo });
  const medio = id => { try { return galeria.item(id); } catch { return null; } };
  const ctxDe = () => { const a = ajustes() || {}, c = cuentas() || {}; return { ajustes: a, defaults, moneda: 'USD', pagina: c.pagina, instagram: c.instagram, pixel: a.pixel, ahora: ahora() }; };

  /** Lo local: la forma del borrador y lo que pide (página, WhatsApp, píxel, creativos de la galería). */
  function local(b) { const c = cuentas() || {}; return validarBorrador(b, { ajustes: ajustes() || {}, defaults, medio, cuentas: c, ahora: ahora() }); }

  /** Lo local y, si pasa y Meta está, `validate_only` en la campaña. → la validación (también la guarda en el borrador). */
  async function validar(id) {
    const b = borradores.leer(id); if (!b) return R(404, { error: 'Ese borrador no existe.' });
    const v = local(b), l = sync.listo();
    if (!l.ok) v.meta = { ok: null, texto: `No se validó con Meta: ${l.motivo}` };
    else if (v.ok && b.origen && ads.impulsable) { // A4: ¿deja Meta impulsar esa publicación? Antes que nada (si no, no se crea)
      try {
        const i = await ads.impulsable(b.origen.red, b.origen.id);
        v.impulsable = i;
        if (i.ok === false) { v.problemas.push({ campo: 'origen', texto: i.motivo, nivel: 'error' }); v.ok = false; }
        else if (i.ok === null) v.problemas.push({ campo: 'origen', texto: 'Meta no dijo si deja impulsar esta publicación: lo dirá al crearla.', nivel: 'aviso' });
        if (b.origen.red === 'facebook' && i.instagram === false) v.problemas.push({ campo: 'origen', texto: 'Meta no deja usar esta publicación en Instagram: el anuncio saldrá solo en Facebook.', nivel: 'aviso' });
      } catch (e) { v.problemas.push({ campo: 'origen', texto: `No pude preguntarle a Meta por esa publicación: ${motivoMeta(e)}`, nivel: 'error' }); v.ok = false; }
    }
    if (l.ok && v.ok) {
      try { await ads.crearEn(sync.cuenta(), 'campana', cuerpoCampana(b, ctxDe()), { validar: true }); v.meta = { ok: true, texto: 'Meta revisó la campaña y la acepta (validate_only: no se creó nada).' }; }
      catch (e) { v.meta = { ok: false, texto: motivoMeta(e) }; v.problemas.push({ campo: 'meta', texto: motivoMeta(e), nivel: 'error' }); v.ok = false; }
    } else if (l.ok) v.meta = { ok: null, texto: 'Primero hay que arreglar lo de arriba; luego se valida con Meta.' };
    return R(200, { borrador: borradores.poner(id, { validacion: v }) });
  }

  /** POST …/crear: solo el dueño. Valida, deja el borrador «creando» y crea en segundo plano (la página sondea). */
  async function crear(id, { quien = 'dueno' } = {}) {
    if (quien !== 'dueno') return R(403, { error: 'Crear en Meta lo hace el dueño, con su clic en Anuncios (J). Los agentes, Dimitri y el asistente dejan borradores.' });
    const b = borradores.leer(id); if (!b) return R(404, { error: 'Ese borrador no existe.' });
    if (b.estado === 'creando' || enMarcha.has(id)) return R(409, { error: 'estado', motivo: 'Ya se está creando en Meta: espera a que termine.' });
    if (b.estado === 'creado') return R(409, { error: 'estado', motivo: `Ya está creado en Meta, en pausa${b.meta?.campana ? ` (campaña ${b.meta.campana})` : ''}: actívalo desde Campañas.` });
    const l = sync.listo(); if (!l.ok) return R(409, { error: 'conexion', motivo: l.motivo });
    const r = await validar(id), v = r.cuerpo.borrador?.validacion;
    if (!v?.ok) return R(422, { error: 'validacion', problemas: (v?.problemas || []).filter(x => x.nivel === 'error'), validacion: v });
    // un intento nuevo (tras un fallo, los de antes están archivados: la búsqueda por nombre no los toma)
    apuntar(id, { intento: (diario()[id]?.intento || 0) + 1, empezado: new Date(ahora()).toISOString(), pasos: { imagenes: {}, videos: {}, creativos: {}, campana: null, conjunto: null, anuncios: {} }, enCurso: null, creados: [] });
    borradores.poner(id, { estado: 'creando', error: null, progreso: { paso: 'imagenes', texto: PASO_TEXTO.imagenes } });
    if (!diferir) lanzar(id);
    return R(202, { ok: true });
  }

  function lanzar(id) {
    if (enMarcha.has(id)) return enMarcha.get(id);
    const p = ejecutar(id).catch(e => { console.warn('anuncios (crear):', e.message); }).finally(() => enMarcha.delete(id));
    enMarcha.set(id, p); return p;
  }

  /** Al arrancar la oficina (y cuando Meta vuelve): sigue lo que quedó «creando». Lo hecho se reconoce en Meta por su nombre. */
  function alArrancar(soloIds = null) { // `soloIds` (Cloudflare): solo esos borradores (el cron toma un candado por cada uno)
    if (!sync.listo().ok) return [];
    const ids = borradores.lista().filter(b => b.estado === 'creando' && (!soloIds || soloIds.includes(b.id))).map(b => b.id);
    for (const id of ids) { if (!diario()[id]) apuntar(id, { intento: 1, empezado: new Date(ahora()).toISOString(), pasos: { imagenes: {}, videos: {}, creativos: {}, campana: null, conjunto: null, anuncios: {} }, enCurso: null, creados: [] }); lanzar(id); }
    return ids;
  }

  async function ejecutar(id) {
    const b0 = borradores.leer(id); if (!b0 || b0.estado !== 'creando') return;
    const b = b0, ctx = { ...ctxDe(), sinInstagram: b0.validacion?.impulsable?.instagram === false }, act = sync.cuenta(), N = nombres(b); // A4: un post de FB que Meta no deja en Instagram
    let j = diario()[id];
    const guardar = () => apuntar(id, j);
    const progreso = paso => borradores.poner(id, { progreso: { paso, texto: PASO_TEXTO[paso] } });
    const objeto = (nivel, idm, nombre) => ({ id: idm, nivel, nombre });

    /** Un objeto de Meta: el del diario, o el que ya existe con ese nombre, o uno nuevo — con el diario ANTES y DESPUÉS. */
    async function paso(nivel, clave, nombre, cuerpo) {
      const ya = clave === null ? j.pasos[nivel] : j.pasos[nivel][clave]; if (ya) return ya;
      const poner = v => { if (clave === null) j.pasos[nivel] = v; else j.pasos[nivel][clave] = v; };
      const nivelMeta = nivel === 'creativos' ? 'creativo' : nivel === 'anuncios' ? 'anuncio' : nivel;
      const hallados = await ads.buscarPorNombre(act, nivelMeta, nombre, `AO:${b.id}`);
      if (hallados.length) { poner(hallados[0].id); j.creados.push({ nivel: nivelMeta, id: hallados[0].id, reconciliado: true }); j.enCurso = null; guardar(); return hallados[0].id; }
      j.enCurso = { nivel: nivelMeta, clave, nombre, at: new Date(ahora()).toISOString() }; guardar(); // ANTES
      const r = await ads.crearEn(act, nivelMeta, cuerpo());
      if (!r?.id) throw new ErrorMeta({ message: `Meta no devolvió el id ${nivelMeta === 'campana' ? 'de la campaña' : nivelMeta === 'conjunto' ? 'del conjunto' : nivelMeta === 'creativo' ? 'del creativo' : 'del anuncio'}` }, 0);
      poner(String(r.id)); j.creados.push({ nivel: nivelMeta, id: String(r.id) }); j.enCurso = null; guardar(); // DESPUÉS
      auditar({ quien: 'dueno', que: 'crear en pausa', paso: nivelMeta, objeto: objeto(nivelMeta, String(r.id), nombre), ok: true, borrador: b.id });
      return String(r.id);
    }

    try {
      // (b) los archivos del Estudio
      progreso('imagenes');
      const medios = {};
      for (const c of b.origen ? [] : b.creativos) { // A4: una publicación impulsada no sube nada (ya está en Meta)
        if (medios[c.media]) continue;
        const it = medio(c.media), archivo = galeria.ruta(c.media);
        if (!it || !archivo || !fs.existsSync(archivo)) throw new Error(`la imagen o el video «${c.media}» ya no está en la galería del Estudio`);
        const ext = path.extname(archivo).toLowerCase();
        if (it.kind === 'video') {
          let v = j.pasos.videos[c.media];
          if (!v) {
            if (!TIPO_VIDEO[ext]) throw new Error(`Meta pide el video en MP4 o MOV (este es ${ext || 'sin extensión'})`);
            j.enCurso = { nivel: 'video', clave: c.media, at: new Date(ahora()).toISOString() }; guardar();
            const up = await ads.subirVideo(act, { datos: fs.readFileSync(archivo), nombre: `${b.id}-${path.basename(archivo)}`, tipo: TIPO_VIDEO[ext] });
            v = j.pasos.videos[c.media] = { id: up.id, listo: false }; j.enCurso = null; guardar();
          }
          if (!v.listo) {
            const t0 = ahora();
            for (;;) {
              const s = await ads.leerVideo(v.id);
              if (s.estado === 'ready') { v.listo = true; v.miniatura = s.miniatura || null; guardar(); break; }
              if (s.estado === 'error') throw new Error('Meta no pudo procesar el video: prueba con otro (MP4, H.264)');
              if (ahora() - t0 > videoMaxMs) throw new Error(`Meta sigue procesando el video tras ${Math.round(videoMaxMs / 60e3)} minutos: reinténtalo más tarde`);
              await dormir(videoCadaMs);
            }
          }
          medios[c.media] = { video: v.id, miniatura: v.miniatura };
        } else {
          let h = j.pasos.imagenes[c.media];
          if (!h) {
            let datos = fs.readFileSync(archivo), nombre = path.basename(archivo);
            if (!TIPO_IMAGEN[ext]) { if (!aJpeg) throw new Error(`Meta pide la imagen en JPEG o PNG (esta es ${ext})`); datos = await aJpeg(datos); nombre = nombre.replace(/\.[^.]+$/, '') + '.jpg'; }
            h = j.pasos.imagenes[c.media] = (await ads.subirImagen(act, { datos, nombre })).hash; guardar(); // el hash es del contenido: subirla otra vez da el mismo
          }
          medios[c.media] = { hash: h };
        }
      }
      // (c) los creativos
      progreso('creativos');
      for (const c of b.creativos) await paso('creativos', c.id, N.creativo(c), () => cuerpoCreativo(b, c, ctx, medios[c.media]));
      // (d) la campaña y (e) el conjunto, en pausa
      progreso('campana');
      const campana = await paso('campana', null, N.campana, () => cuerpoCampana(b, ctx));
      progreso('conjunto');
      const conjunto = await paso('conjunto', null, N.conjunto, () => cuerpoConjunto(b, ctx, campana));
      // (f) los anuncios, en pausa
      progreso('anuncios');
      for (const c of b.creativos) await paso('anuncios', c.id, N.anuncio(c), () => cuerpoAnuncio(b, c, conjunto, j.pasos.creativos[c.id]));

      const metaIds = { campana, conjunto, creativos: b.creativos.map(c => j.pasos.creativos[c.id]), anuncios: b.creativos.map(c => j.pasos.anuncios[c.id]) };
      j.terminado = new Date(ahora()).toISOString(); guardar();
      borradores.poner(id, { estado: 'creado', meta: metaIds, error: null, progreso: null });
      const entrada = { quien: 'dueno', que: 'crear en pausa', objeto: objeto('campana', campana, b.nombre), antes: null, despues: { estado: 'PAUSED', borrador: b.id, conjunto, anuncios: metaIds.anuncios.length, presupuesto: { tipo: b.presupuesto.tipo, usd: b.presupuesto.usd } } };
      try { sync.anotar(entrada); } catch { /* el historial no es lo importante */ }
      auditar({ ...entrada, ok: true });
      try { await sync.sincronizar({ cifras: false }); } catch { /* la próxima lectura la trae */ }
      return { ok: true, meta: metaIds };
    } catch (e) {
      // lo creado en ESTE intento se archiva (nunca DELETE): primero lo que pudo quedar a medias (Meta lo creó y la respuesta se perdió)
      const motivo = e instanceof ErrorMeta ? motivoMeta(e) : mensajeMeta(e);
      try { if (j.enCurso && ['campana', 'conjunto', 'anuncio'].includes(j.enCurso.nivel)) for (const x of await ads.buscarPorNombre(act, j.enCurso.nivel, j.enCurso.nombre, `AO:${b.id}`)) j.creados.push({ nivel: j.enCurso.nivel, id: x.id }); } catch { /* sin poder mirar: se dice abajo */ }
      const archivados = [], sinArchivar = [];
      for (const x of [...j.creados].reverse()) {
        if (x.nivel === 'creativo') continue; // un creativo no gasta ni se entrega solo; Meta no lo archiva como a los demás
        try { await ads.cambiar(x.id, { status: 'ARCHIVED' }); archivados.push(x.id); } catch { sinArchivar.push(x.id); }
      }
      j.fallo = { at: new Date(ahora()).toISOString(), motivo, archivados, sinArchivar }; j.enCurso = null; guardar();
      const texto = `No se pudo crear en Meta: ${motivo}${archivados.length ? ` Lo que se alcanzó a crear quedó ARCHIVADO (${archivados.length}).` : ''}${sinArchivar.length ? ` No pude archivar ${sinArchivar.join(', ')}: archívalo en el Administrador de anuncios.` : ''}`;
      borradores.poner(id, { estado: 'fallo', error: texto, progreso: null });
      const entrada = { quien: 'dueno', que: 'crear en pausa (falló)', objeto: objeto('borrador', b.id, b.nombre), antes: null, despues: { motivo, archivados } };
      try { sync.anotar(entrada); } catch { /* idem */ }
      auditar({ ...entrada, ok: false, motivo });
      return { ok: false, motivo: texto };
    }
  }

  /**
   * La vista previa de Meta de un creativo SIN crear nada: sube su imagen (adimages: idempotente, no gasta) y pide generatepreviews.
   * Un video no: subirlo es pesado (la página usa su propia vista previa).
   */
  async function vistaPrevia(id, { formato = 'MOBILE_FEED_STANDARD', creativo = null } = {}) {
    if (!FORMATOS_VISTA.includes(formato)) return R(400, { error: `El formato es uno de: ${FORMATOS_VISTA.join(', ')}.` });
    const b = borradores.leer(id); if (!b) return R(404, { error: 'Ese borrador no existe.' });
    if (b.origen) return R(409, { error: 'estado', motivo: `Se impulsa la publicación tal como está: ábrela en ${b.origen.red === 'instagram' ? 'Instagram' : 'Facebook'} para verla${b.origen.enlace ? ` (${b.origen.enlace})` : ''}.` });
    const l = sync.listo(); if (!l.ok) return R(409, { error: 'conexion', motivo: l.motivo });
    const ctx = ctxDe(); if (!ctx.pagina) return R(409, { error: 'conexion', motivo: 'Falta la página de Facebook (Ajustes → Anuncios).' });
    const c = creativo ? b.creativos.find(x => x.id === creativo) : b.creativos.find(x => medio(x.media)?.kind === 'image');
    if (!c) return R(409, { error: 'estado', motivo: creativo ? 'Ese creativo no está en el borrador.' : 'La vista previa de Meta necesita un creativo con imagen.' });
    const it = medio(c.media), archivo = galeria.ruta(c.media);
    if (!it || it.kind !== 'image' || !archivo || !fs.existsSync(archivo)) return R(409, { error: 'estado', motivo: 'La vista previa de Meta es de imágenes: la de un video es la de la oficina.' });
    try {
      let datos = fs.readFileSync(archivo), nombre = path.basename(archivo); const ext = path.extname(archivo).toLowerCase();
      if (!TIPO_IMAGEN[ext]) { if (!aJpeg) return R(409, { error: 'estado', motivo: 'Meta pide JPEG o PNG.' }); datos = await aJpeg(datos); nombre = nombre.replace(/\.[^.]+$/, '') + '.jpg'; }
      const { hash } = await ads.subirImagen(sync.cuenta(), { datos, nombre });
      const cuerpo = cuerpoCreativo(b, c, ctx, { hash });
      const html = await ads.vistaPrevia(sync.cuenta(), { object_story_spec: cuerpo.object_story_spec }, formato);
      return R(200, { html, formato, creativo: c.id });
    } catch (e) { return R(422, { error: 'meta', motivo: motivoMeta(e) }); }
  }

  return { validar, crear, alArrancar, vistaPrevia, enMarcha: () => [...enMarcha.keys()], esperar: id => enMarcha.get(id) || Promise.resolve(), local, diario };
}

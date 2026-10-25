// (NÚCLEO del conductor Meta, sin disco: lo usa contenido/meta-publicar.mjs —que le pone la carpeta del Estudio y un archivo— y el Worker de Cloudflare —R2 y D1—.)
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
import { createHash } from 'node:crypto';
import { mensajeMeta, permisosQueFaltan, ErrorMeta, NOMBRE_FUNCION } from './meta-nucleo.mjs';
import { porDefectoCuentas, motivoNoPublica } from '../src/contenido-cuentas.js'; // 9 oct 2026: la cuenta de cada pieza

export const REDES_META = ['instagram', 'facebook'];
export const PREPARAR_ANTES_MS = 15 * 60e3;  // Instagram: el contenedor (y la subida del video) se prepara 15 min antes
export const NATIVA_MIN_MS = 11 * 60e3;      // Facebook programa desde 10 min en adelante: con menos, sale a su hora desde aquí
export const NATIVA_MAX_MS = 28 * 864e5;     // y hasta 30 días (con margen): más lejos, se programa cuando entre en la ventana
export const TARDE_MAX_MS = 30 * 60e3;       // con la computadora apagada a su hora, sale al encenderla hasta 30 min tarde; después, no
export const AVISO_ANTES_MS = 60 * 60e3;     // una hora antes de lo que sale desde aquí, un aviso (y Telegram): no apagues la computadora
const ESPERAS = [30e3, 60e3, 2 * 60e3, 5 * 60e3, 10 * 60e3];
const MIRAR_CADA_MS = 2 * 60e3;              // lo programado en Facebook se mira cada 2 min desde su hora
const ESENCIALES = ['pages_manage_posts', 'instagram_content_publish']; // sin estos no se publica; los de comentarios solo quitan el primer comentario
const NOMBRE = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', threads: 'Threads', bluesky: 'Bluesky', tiktok: 'TikTok', pinterest: 'Pinterest', youtube: 'YouTube' };
const nombreRed = r => NOMBRE[r] || r;
export const NOTA = 'Facebook queda programado en Meta y sale solo. Instagram no se puede programar por API: lo publica esta oficina a su hora, así que esa hora la computadora tiene que estar encendida con la oficina abierta (hasta 30 min tarde todavía sale).';

const ext = f => { const m = /\.([^./\\]+)$/.exec(String(f || '')); return m ? m[1].toLowerCase() : ''; };
/** imagen · video · otro, por la extensión (Instagram: imágenes que se pasan a JPEG, y videos MP4 o MOV). */
export const tipoDe = archivo => (/^(jpe?g|png|webp)$/.test(ext(archivo)) ? 'imagen' : /^(mp4|mov|m4v)$/.test(ext(archivo)) ? 'video' : 'otro');

/**
 * Qué se publica en una red con esos archivos → { como } o { error } en palabras.
 * Instagram: imagen · reel (un video suelto también: Instagram ya no publica «video» de feed por API) · carrusel (2–10) · historia.
 * Facebook: imagen · fotos (varias) · video · texto · historia (solo imagen).
 */
export function planRed(red, formato, tipos = []) {
  const n = tipos.length, vid = tipos.filter(t => t === 'video').length;
  if (tipos.some(t => t === 'otro')) return { error: red === 'instagram' ? 'Instagram solo acepta imágenes (JPG, PNG o WebP) y videos MP4 o MOV' : 'Facebook: hay un archivo que no es imagen ni video MP4 o MOV' };
  if (red === 'instagram') {
    if (!n) return { error: 'Instagram necesita una imagen o un video' };
    if (formato === 'historia') return n === 1 ? { como: 'historia' } : { error: 'una historia lleva un solo archivo' };
    if (formato === 'reel') return n === 1 && vid === 1 ? { como: 'reel' } : { error: 'un reel lleva un video, y solo uno' };
    if (n === 1) return { como: vid ? 'reel' : 'imagen' };
    return n <= 10 ? { como: 'carrusel' } : { error: 'un carrusel de Instagram lleva de 2 a 10 archivos' };
  }
  if (red === 'facebook') {
    if (formato === 'historia') return n === 1 && !vid ? { como: 'historia' } : { error: n === 1 ? 'las historias de Facebook con video todavía no salen por aquí: súbela a mano' : 'una historia lleva un solo archivo' };
    if (!n) return { como: 'texto' };
    if (vid) return n === 1 ? { como: 'video' } : { error: 'Facebook no publica por API un carrusel con video: sepáralo en dos piezas' };
    return { como: n === 1 ? 'imagen' : 'fotos' };
  }
  return { error: `Meta solo publica en Instagram y Facebook: ${nombreRed(red)} va con Metricool o a mano` };
}
/** ¿Facebook la puede dejar programada en Meta? (las historias no; y solo desde 10 minutos antes de su hora) */
export const vaNativa = (red, como, momento, ahora) => red === 'facebook' && ['imagen', 'fotos', 'video', 'texto'].includes(como) && momento - ahora >= NATIVA_MIN_MS;

const sinRespuesta = e => !e || e.estado === 0 || e.estado >= 500; // Meta no contestó: no se sabe si lo hizo
const permalinkFB = u => (!u ? '' : /^https?:/.test(u) ? u : `https://www.facebook.com${u.startsWith('/') ? '' : '/'}${u}`);
const propio = (mensaje, transitorio = false) => Object.assign(new Error(mensaje), { transitorio });

/**
 * El conductor. `meta`: el cliente de contenido/meta.mjs (sin él, «no listo»). `rutaMedio(id)` → la ruta de un archivo del Estudio;
 * `aJpeg(buffer)` → JPEG (Instagram); `archivo` → la agenda; `pagina()` → el id de la página elegida (office.config → contenido.metaPagina;
 * vacío = la primera); `alCambiar()` → algo salió o falló (la cola lo mira ya); `inmediato` → un pulso al programar (los tests lo apagan).
 */
export function crearConductorMeta({ meta = null, medios: mediosIO = null, agenda: almacenAgenda = null, pagina = () => '', ahora = Date.now, alCambiar = () => {}, avisar = () => {}, inmediato = true, puedeSeguir = () => true } = {}) {
  // `mediosIO` { tipo(id) → 'imagen'|'video'|'otro'|null (null = el Estudio ya no lo tiene), bytes(id, jpeg) → { datos, nombre, tipo } }: de dónde salen los archivos
  // (la carpeta del Estudio en la oficina local —contenido/meta-publicar.mjs—, el R2 en el Worker). `almacenAgenda` { leer() → la agenda (síncrono), guardar(d) (puede ser
  // una promesa: se espera) }: un archivo en la oficina local, D1 en el Worker. `puedeSeguir()` deja al Worker parar el pulso antes de pasarse de sus llamadas por vuelta.
  let memoria = { trabajos: {} }; // sin almacén (las pruebas): la agenda vive aquí
  const leer = () => (almacenAgenda ? almacenAgenda.leer() : JSON.parse(JSON.stringify(memoria)));
  const medios0 = mediosIO || { tipo: async () => null, bytes: async id => { throw propio(`el Estudio ya no tiene «${id}»: quizá se fue a la papelera`); } };
  let agenda = null; // la copia en memoria mientras corre un pulso; fuera de él se lee del disco
  // UNA COSA A LA VEZ sobre la agenda: programar, retirar y el pulso van en fila. Sin esto, un pulso con la agenda vieja en la mano
  // podía volver a escribir lo que la cola acababa de quitar (y publicarlo), o borrar lo recién programado.
  let candado = Promise.resolve();
  const enFila = fn => { const r = candado.then(fn, fn); candado = r.catch(() => {}); return r; };
  const guardar = d => { if (almacenAgenda) return almacenAgenda.guardar(d); memoria = JSON.parse(JSON.stringify(d)); };
  const limpio = t => (meta?.sinToken ? meta.sinToken(t) : String(t ?? '')).slice(0, 400);
  const textoDe = e => limpio(mensajeMeta(e));

  function listo() {
    if (!meta || !meta.configurado()) return { ok: false, motivo: 'Falta META_ACCESS_TOKEN (variable de Windows con el token de un usuario del sistema de Meta). Los pasos están en Analíticas (R) → «Conecta Meta».' };
    const est = meta.estado();
    if (!est.cuentas.some(c => c.red === 'facebook')) return { ok: false, motivo: est.error || 'Todavía no sé con qué página publicar: abre Analíticas (R) y pulsa «Comprobar conexión».' };
    const faltan = permisosQueFaltan(est.token?.permisos, ESENCIALES);
    if (faltan.length) return { ok: false, motivo: `Al token de Meta le faltan permisos para publicar: ${faltan.join(', ')}. Genéralo otra vez con ellos (Business Manager → Usuarios del sistema) y pulsa «Comprobar conexión».` };
    const extra = permisosQueFaltan(est.token?.permisos, ['pages_manage_engagement', 'instagram_manage_comments']);
    return { ok: true, motivo: '', nota: NOTA + (extra.length ? ` Sin ${extra.join(' ni ')}, el primer comentario no se pone.` : '') };
  }

  /** La página y su Instagram: la elegida en la configuración, o la primera que el token ve. */
  function cuentas() { return porDefectoCuentas(meta.estado().cuentas || [], pagina()); }
  /**
   * (9 oct 2026) Dónde sale UNA red de una entrega: la cuenta que eligió la pieza (`e.cuentas[red]`) o, sin elegir, la de siempre.
   * Instagram sale con la página a la que está vinculado (su página decide el token). → { fb, ig } o { error } en palabras.
   */
  function dondeSale(e, red, def) {
    const id = e.cuentas?.[red]; if (!id) return def;
    const c = meta.estado().cuentas || [], x = c.find(y => y.id === id);
    const motivo = motivoNoPublica(x); if (motivo) return { error: x ? motivo : `la cuenta elegida (${String(id).split(':')[1]}) ya no la ve el token de Meta: elige otra en la pieza o pulsa «Comprobar conexión»` };
    if (red === 'facebook') return { fb: x, ig: null };
    return { fb: c.find(y => y.red === 'facebook' && y.paginaId === x.paginaId) || { paginaId: x.paginaId, nombre: '' }, ig: x };
  }
  const token = j => meta.tokenDe({ paginaId: j.pagina });
  const bytes = (id, jpeg) => medios0.bytes(id, jpeg);

  // ---------- la interfaz de la cola ----------
  /** Valida y apunta en la agenda (sin llamar a Meta). Idempotente: la misma entrega dos veces es el mismo grupo. */
  const programar = e => enFila(() => programarYa(e));
  async function programarYa(e) {
    const l = listo(); if (!l.ok) throw propio(l.motivo);
    const grupo = 'mt-' + createHash('sha256').update(JSON.stringify([e.clave, e.momento, e.redes, e.texto, e.medios, ...(e.cuentas && Object.keys(e.cuentas).length ? [e.cuentas] : [])])).digest('hex').slice(0, 12); // otra cuenta = otro grupo
    const d = await leer(), ya = Object.values(d.trabajos).filter(j => j.grupo === grupo);
    if (ya.length) return { id: grupo, uuid: '', zona: '', redes: redesDe(ya, d.otras?.[grupo]) };
    const medios = []; for (const id of e.medios || []) { const tipo = await medios0.tipo(id); if (!tipo) throw propio(`el Estudio ya no tiene «${id}»: quizá se fue a la papelera`); medios.push({ id, tipo }); }
    const def = cuentas(), t = ahora(), otras = {}, nuevos = [];
    for (const red of e.redes || []) {
      const plan = planRed(red, e.formato, medios.map(m => m.tipo));
      if (plan.error) { otras[red] = plan.error; continue; }
      const donde = dondeSale(e, red, def), { fb, ig } = donde;
      if (donde.error) { otras[red] = donde.error; continue; }
      if (red === 'instagram' && !ig) { otras[red] = `la página «${fb?.nombre || '—'}» no tiene un Instagram de empresa vinculado (o el token no lo ve)`; continue; }
      const id = `${grupo}-${red}`;
      nuevos.push({ id, grupo, red, pagina: fb.paginaId, ig: red === 'instagram' ? ig.externoId : '', cuenta: red === 'instagram' ? ig.id : fb.id || '', como: plan.como, variante: e.variante || 'post', momento: e.momento,
        texto: red === 'instagram' && plan.como === 'historia' ? '' : String(e.texto || ''), comentario: plan.como === 'historia' ? '' : String(e.comentario || ''),
        colaboradores: red === 'instagram' && plan.como !== 'historia' ? (e.extras?.colaboradores || []).slice(0, 3) : [], medios,
        modo: vaNativa(red, plan.como, e.momento, t) ? 'nativa' : 'local', estado: 'programada', remoto: null, contenedores: {}, padre: '', temporales: [], url: '', error: '', detalle: '', intentos: 0, proximo: 0, creada: t });
    }
    if (!nuevos.length) throw propio(Object.entries(otras).map(([r, x]) => `${nombreRed(r)}: ${x}`).join(' · ') || 'no hay ninguna red que Meta pueda publicar');
    for (const j of nuevos) d.trabajos[j.id] = j;
    if (Object.keys(otras).length) (d.otras ||= {})[grupo] = otras;
    await guardar(d);
    if (inmediato) setTimeout(() => pulso().catch(() => {}), 50);
    return { id: grupo, uuid: '', zona: '', redes: redesDe(nuevos, otras) };
  }

  function redesDe(trabajos, otras = {}) {
    const r = Object.fromEntries(Object.entries(otras || {}).map(([red, x]) => [red, { estado: 'fallo', url: '', detalle: x }]));
    for (const j of trabajos) {
      r[j.red] = j.estado === 'publicada' ? { estado: 'publicada', url: j.url || '', detalle: j.detalle || '', ...(j.publicadoId ? { id: j.publicadoId } : {}) } // A4: el id de Meta (para impulsarla)
        : j.estado === 'fallo' ? { estado: 'fallo', url: '', detalle: j.error || 'falló' }
        : { estado: 'en_red', url: '', local: j.modo === 'local', detalle: j.modo === 'local' ? (j.error ? `Sale a su hora desde esta computadora (último intento: ${j.error})` : 'Sale a su hora desde esta computadora: déjala encendida con la oficina abierta.') : j.estado === 'nativa' ? 'Programada en Facebook: sale sola a su hora.' : `Se programa en Facebook en un momento${j.error ? ` (último intento: ${j.error})` : ''}.` };
    }
    return r;
  }

  function estado(r) {
    const d = leer(), ts = Object.values(d.trabajos).filter(j => j.grupo === r.id);
    return ts.length ? { redes: redesDe(ts, d.otras?.[r.id]) } : null;
  }

  /** Quitar lo entregado (la pieza cambió o perdió el OK). Lo ya publicado no se quita desde aquí: se dice. */
  const retirar = r => enFila(() => retirarYa(r));
  async function retirarYa(r) {
    const d = await leer(), ts = Object.values(d.trabajos).filter(j => j.grupo === r.id);
    for (const j of ts) {
      if (j.estado === 'publicada') throw propio(`ya salió en ${nombreRed(j.red)}${j.url ? ` (${j.url})` : ''}: si no la quieres, bórrala allí`);
      if (j.estado === 'incierta') { const st = await leerContenedor(j).catch(() => null); if (st === 'PUBLISHED') throw propio(`ya salió en Instagram: si no la quieres, bórrala allí`); }
    }
    for (const j of ts) {
      if (j.estado === 'nativa' && j.remoto?.id) await meta.borrar(await token(j), j.remoto.id); // si falla, la cola lo dice: «quítala allí a mano»
      await limpiarTemporales(j);
    }
    const d2 = await leer(); for (const j of ts) delete d2.trabajos[j.id]; if (d2.otras) delete d2.otras[r.id]; await guardar(d2);
    return true;
  }

  // ---------- el pulso: lo que toca ahora ----------
  let enMarcha = null;
  function pulso() {
    if (enMarcha) return enMarcha;
    enMarcha = enFila(async () => {
      if (!meta || !meta.configurado()) return { cambios: 0 };
      agenda = await leer(); let cambios = 0;
      try {
        for (const j of Object.values(agenda.trabajos)) {
          if (['publicada', 'fallo'].includes(j.estado)) continue;
          if (!puedeSeguir()) break; // el Worker corta la vuelta antes de pasarse de sus llamadas; el resto sigue en la próxima
          const antes = j.estado;
          await paso(j);
          j.actualizada = ahora(); await guardar(agenda);
          if (j.estado !== antes && ['nativa', 'publicada', 'fallo'].includes(j.estado)) cambios++; // programada en Facebook, salió o falló: la cola lo mira ya
        }
        // lo terminado hace más de 30 días se olvida (la cola y la auditoría lo conservan)
        for (const [id, j] of Object.entries(agenda.trabajos)) if (['publicada', 'fallo'].includes(j.estado) && ahora() - (j.actualizada || j.creada || 0) > 30 * 864e5) delete agenda.trabajos[id];
        await guardar(agenda);
      } finally { agenda = null; }
      return { cambios };
    }).then(r => { if (r.cambios) { try { alCambiar(); } catch {} } return r; }).finally(() => { enMarcha = null; }); // alCambiar, fuera de la fila
    return enMarcha;
  }

  const falla = (j, msg) => { j.estado = 'fallo'; j.error = limpio(msg); };
  const reintentarLuego = (j, msg) => { j.intentos = (j.intentos || 0) + 1; j.error = limpio(msg); j.proximo = ahora() + ESPERAS[Math.min(j.intentos, ESPERAS.length) - 1]; };

  async function paso(j) {
    const t = ahora(); if (t < (j.proximo || 0)) return;
    try {
      if (j.estado === 'programada' && j.modo === 'nativa') {
        if (j.momento - t < NATIVA_MIN_MS) { j.modo = 'local'; j.detalle = 'No dio tiempo a programarla en Facebook: sale a su hora desde esta computadora.'; }
        else if (j.momento - t <= NATIVA_MAX_MS) return await programarNativa(j);
        else return;
      }
      if (j.estado === 'programada' && j.modo === 'local' && !j.avisado && t < j.momento && j.momento - t <= AVISO_ANTES_MS) { // una vez por publicación
        j.avisado = true;
        avisar(`En ${Math.max(1, Math.round((j.momento - t) / 60e3))} min sale en ${nombreRed(j.red)} «${String(j.texto || 'una historia').split('\n')[0].slice(0, 60)}» desde esta computadora: déjala encendida con la oficina abierta.`, { key: `meta-aviso-${j.id}`, level: 'info' });
      }
      if (j.estado === 'programada' && j.modo === 'local') {
        if (t > j.momento + TARDE_MAX_MS) { falla(j, 'No salió: a su hora la oficina estaba cerrada o sin conexión (y ya pasó más de media hora). Cámbiale el día y vuelve a aprobarla.'); return await limpiarTemporales(j); }
        if (j.red === 'instagram' && t >= j.momento - PREPARAR_ANTES_MS) await prepararIG(j);
        else if (j.red === 'facebook' && t >= j.momento) return await publicarFB(j);
        if (j.estado !== 'preparada') return;
      }
      if (j.estado === 'preparada' && t > j.momento + TARDE_MAX_MS) { falla(j, 'No salió: a su hora la oficina estaba cerrada o sin conexión (y ya pasó más de media hora). Cámbiale el día y vuelve a aprobarla.'); return await limpiarTemporales(j); }
      if (j.estado === 'preparada' || j.estado === 'incierta') { if (t >= j.momento) await publicarIG(j); return; } // «incierta» se lee siempre, aunque sea tarde: quizá ya salió
      if (j.estado === 'nativa' && t >= j.momento) return await mirarNativa(j);
    } catch (e) {
      // un fallo que Meta dice pasajero (saturación, límites) se reintenta; lo demás (permisos, formato, un archivo que falta) no
      if (e?.transitorio && t <= j.momento + TARDE_MAX_MS) reintentarLuego(j, e instanceof ErrorMeta ? textoDe(e) : e.message);
      else { falla(j, e instanceof ErrorMeta ? textoDe(e) : e?.message || 'error'); await limpiarTemporales(j); }
    }
  }

  // ---------- Facebook ----------
  /** Lo que sale en Facebook, ahora (`programada` = null) o programado en Meta para su hora. → { id, tipo, foto? } */
  async function crearEnFacebook(j, programada) {
    const tk = await token(j), pg = j.pagina, cuando = programada ? { published: false, scheduled_publish_time: Math.floor(j.momento / 1000) } : {};
    if (j.como === 'texto') { const r = await meta.enviar(tk, `/${pg}/feed`, { campos: { ...cuando, message: j.texto } }); return { id: r.id, tipo: 'post' }; }
    if (j.como === 'imagen') { const r = await meta.enviar(tk, `/${pg}/photos`, { campos: { ...cuando, caption: j.texto }, archivo: await bytes(j.medios[0].id, false) }); return { id: r.post_id || r.id, tipo: 'post', foto: r.id }; }
    if (j.como === 'video') { const r = await meta.enviar(tk, `/${pg}/videos`, { campos: { ...cuando, description: j.texto }, archivo: await bytes(j.medios[0].id, false), video: true }); return { id: r.id, tipo: 'video' }; }
    if (j.como === 'fotos') {
      const ids = [];
      for (const m of j.medios) { const r = await meta.enviar(tk, `/${pg}/photos`, { campos: { published: false, temporary: true }, archivo: await bytes(m.id, false) }); ids.push(r.id); }
      const r = await meta.enviar(tk, `/${pg}/feed`, { campos: { ...cuando, message: j.texto, attached_media: ids.map(id => ({ media_fbid: id })) } });
      return { id: r.id, tipo: 'post' };
    }
    if (j.como === 'historia') {
      const f = await meta.enviar(tk, `/${pg}/photos`, { campos: { published: false }, archivo: await bytes(j.medios[0].id, false) });
      const r = await meta.enviar(tk, `/${pg}/photo_stories`, { campos: { photo_id: f.id } });
      return { id: r.post_id || r.id || '', tipo: 'historia' };
    }
    throw propio(`Facebook: no sé publicar «${j.como}»`);
  }

  async function programarNativa(j) {
    try { j.remoto = await crearEnFacebook(j, true); j.estado = 'nativa'; j.error = ''; j.intentos = 0; j.proximo = 0; }
    catch (e) {
      if (sinRespuesta(e)) return falla(j, 'Meta no contestó al programarla en Facebook y no sé si la recibió: mira las publicaciones programadas de tu página; si no está, vuelve a aprobarla.');
      if (e?.transitorio) return reintentarLuego(j, textoDe(e));
      throw e;
    }
  }

  async function publicarFB(j) {
    let r;
    try { r = await crearEnFacebook(j, false); }
    catch (e) {
      if (sinRespuesta(e)) return falla(j, 'Meta no contestó al publicarla en Facebook y no sé si salió: mira tu página antes de volver a aprobarla.');
      throw e;
    }
    j.remoto = r; await despues(j, r.id, r.tipo === 'video' ? 'published,permalink_url' : 'permalink_url');
  }

  async function mirarNativa(j) {
    const tk = await token(j), campos = j.remoto.tipo === 'video' ? 'published,permalink_url' : 'is_published,permalink_url';
    let r;
    try { r = await meta.graph(tk, `/${j.remoto.id}`, { params: { fields: campos } }); }
    catch (e) { if (e?.codigo === 100 && !e.transitorio) return falla(j, 'Ya no está en las programadas de Facebook: ¿la borraste allí?'); throw e; }
    if (r?.is_published === true || r?.published === true) return despues(j, j.remoto.id, null, r);
    if (ahora() > j.momento + TARDE_MAX_MS) return falla(j, 'Facebook no la publicó a su hora: mírala en las publicaciones programadas de tu página.');
    j.proximo = ahora() + MIRAR_CADA_MS;
  }

  /** Ya salió: su enlace, el primer comentario (si lo hay y se puede) y la limpieza. Lo que falle aquí no la vuelve «no publicada». */
  async function despues(j, id, campos, ya = null) {
    j.estado = 'publicada'; j.error = ''; j.publicadaAt = ahora(); if (id && j.variante !== 'historia') j.publicadoId = String(id); // A4 (anuncios/impulsar.mjs)
    const tk = await token(j);
    try {
      const r = ya || (campos ? await meta.graph(tk, `/${id}`, { params: { fields: campos } }) : null);
      j.url = j.red === 'instagram' ? String(r?.permalink || '') : permalinkFB(r?.permalink_url || '');
    } catch { /* sin enlace: salió igual */ }
    if (j.comentario && id && !j.comentado) {
      try { await meta.enviar(tk, `/${id}/comments`, { campos: { message: j.comentario } }); j.comentado = true; }
      catch (e) { j.detalle = `Salió, pero el primer comentario no se pudo poner (${textoDe(e)}).`; }
    }
    await limpiarTemporales(j);
  }

  async function limpiarTemporales(j) {
    if (!j.temporales?.length || !meta) return;
    const tk = await token(j).catch(() => null); if (!tk) return;
    const quedan = [];
    for (const id of j.temporales) { try { await meta.borrar(tk, id); } catch { quedan.push(id); } } // Meta borra las temporales sola: no es grave
    j.temporales = quedan;
  }

  // ---------- Instagram ----------
  /** La dirección de una imagen para Instagram: foto temporal sin publicar en la página, y su dirección de Meta. Verificado el 9 oct 2026 con la cuenta real. */
  async function urlDeImagen(j, medio) {
    const tk = await token(j);
    const f = await meta.enviar(tk, `/${j.pagina}/photos`, { campos: { published: false, temporary: true }, archivo: await bytes(medio.id, true) });
    j.temporales.push(f.id); await guardar(agenda);
    const r = await meta.graph(tk, `/${f.id}`, { params: { fields: 'images' } });
    const mejor = [...(r?.images || [])].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    if (!mejor?.source || !/^https:\/\//.test(mejor.source)) throw propio('Facebook no dio una dirección para la imagen: Instagram no tiene de dónde bajarla');
    return mejor.source;
  }

  async function prepararIG(j) {
    const tk = await token(j);
    if (!Object.keys(j.contenedores).length && !j.padre) { // la cuota de 24 h, antes de empezar
      try {
        const q = (await meta.graph(tk, `/${j.ig}/content_publishing_limit`, { params: { fields: 'config,quota_usage' } }))?.data?.[0];
        const total = q?.config?.quota_total, usadas = q?.quota_usage;
        apuntarCuota(usadas, total);
        if (Number.isFinite(total) && Number.isFinite(usadas) && usadas >= total) throw propio(`Instagram ya usó sus ${total} publicaciones por API de las últimas 24 horas; lo intento de nuevo en unos minutos`, true);
      } catch (e) { if (!(e instanceof ErrorMeta)) throw e; /* si Meta no da la cuota, se intenta igual */ }
    }
    const carrusel = j.como === 'carrusel';
    for (const [i, m] of j.medios.entries()) {
      if (j.contenedores[i]) continue;
      const campos = {};
      if (carrusel) campos.is_carousel_item = true;
      else { if (j.como !== 'historia') { campos.caption = j.texto; if (j.colaboradores.length) campos.collaborators = j.colaboradores; } }
      if (m.tipo === 'video') {
        Object.assign(campos, { media_type: carrusel ? 'VIDEO' : j.como === 'historia' ? 'STORIES' : 'REELS', upload_type: 'resumable' });
        if (j.como === 'reel') campos.share_to_feed = true;
        const r = await meta.enviar(tk, `/${j.ig}/media`, { campos });
        await meta.subirReanudable(tk, r.id, (await bytes(m.id, false)).datos, r.uri);
        j.contenedores[i] = r.id;
      } else {
        campos.image_url = await urlDeImagen(j, m);
        if (j.como === 'historia') campos.media_type = 'STORIES';
        j.contenedores[i] = (await meta.enviar(tk, `/${j.ig}/media`, { campos })).id;
      }
      await guardar(agenda);
    }
    if (carrusel && !j.padre) {
      const campos = { media_type: 'CAROUSEL', children: j.medios.map((_, i) => j.contenedores[i]).join(','), caption: j.texto };
      if (j.colaboradores.length) campos.collaborators = j.colaboradores;
      j.padre = (await meta.enviar(tk, `/${j.ig}/media`, { campos })).id;
    }
    if (!carrusel) j.padre = j.contenedores[0];
    j.estado = 'preparada'; j.error = ''; j.intentos = 0;
  }

  async function leerContenedor(j) {
    const r = await meta.graph(await token(j), `/${j.padre}`, { params: { fields: 'status_code,status' } });
    j.estadoContenedor = r?.status_code || ''; return j.estadoContenedor;
  }

  /** ¿Cuál de las últimas publicaciones es esta? (cuando salió pero no se supo su id) */
  async function buscarPublicada(j) {
    try {
      const r = await meta.graph(await token(j), `/${j.ig}/media`, { params: { fields: 'id,permalink,caption,timestamp', limit: 6 } });
      const l = r?.data || [], texto = String(j.texto || '').trim();
      return l.find(x => texto && String(x.caption || '').trim() === texto) || l.find(x => Date.parse(x.timestamp || 0) >= j.momento - 10 * 60e3) || null;
    } catch { return null; }
  }

  async function publicarIG(j) {
    const st = await leerContenedor(j); // siempre se lee antes: un contenedor PUBLICADO ya salió, y no se publica dos veces
    if (st === 'PUBLISHED') { const m = await buscarPublicada(j); return despues(j, m?.id || '', null, { permalink: m?.permalink || '' }); }
    if (st === 'ERROR') return falla(j, 'Instagram no pudo procesar el archivo (un video que no le gusta, una imagen fuera de proporción): revísalo en el Estudio.');
    if (st === 'EXPIRED') { j.contenedores = {}; j.padre = ''; j.estado = 'programada'; j.error = 'el contenedor caducó: se prepara de nuevo'; return; }
    if (st === 'IN_PROGRESS' || !st) {
      if (ahora() > j.momento + TARDE_MAX_MS) return falla(j, 'Instagram no terminó de procesar el video a tiempo.');
      j.proximo = ahora() + 30e3; return;
    }
    // FINISHED: se publica (si una vez anterior no contestó, el contenedor no está PUBLICADO: no salió, y repetir no duplica)
    let r;
    try { r = await meta.enviar(await token(j), `/${j.ig}/media_publish`, { campos: { creation_id: j.padre } }); }
    catch (e) {
      if (sinRespuesta(e)) { j.estado = 'incierta'; j.error = 'Meta no contestó al publicar: se mira de nuevo antes de hacer nada'; j.proximo = ahora() + 30e3; return; }
      if (await leerContenedor(j).catch(() => '') === 'PUBLISHED') { const m = await buscarPublicada(j); return despues(j, m?.id || '', null, { permalink: m?.permalink || '' }); }
      if ((e?.transitorio || e?.subcodigo === 2207008) && (j.intentos || 0) < 3 && ahora() <= j.momento + TARDE_MAX_MS) { j.estado = 'preparada'; return reintentarLuego(j, textoDe(e)); }
      throw Object.assign(e, { transitorio: false });
    }
    if (!r?.id) { j.estado = 'incierta'; j.proximo = ahora() + 30e3; return; }
    return despues(j, r.id, 'permalink');
  }

  /** C2 (8 oct 2026): la cuota de Instagram a la vista. La última que dio Meta (al preparar una o al comprobar) se apunta en la agenda;
   *  lo publicado por la oficina en las últimas 24 h se cuenta siempre (Meta no la devuelve si no se le pregunta). */
  function apuntarCuota(usadas, total) {
    if (!Number.isFinite(usadas) || !Number.isFinite(total)) return;
    const c = { usadas, total, cuando: ahora() };
    if (agenda) agenda.cuota = c; else enFila(async () => { const d = await leer(); d.cuota = c; await guardar(d); });
  }
  function cuota() {
    const d = leer(), desde = ahora() - 24 * 3600e3;
    const nuestras = Object.values(d.trabajos || {}).filter(j => j.red === 'instagram' && j.estado === 'publicada' && (j.publicadaAt || 0) > desde).length;
    const c = d.cuota && ahora() - d.cuota.cuando < 24 * 3600e3 ? d.cuota : null;
    return { nuestras, usadas: c ? c.usadas : null, total: c ? c.total : null, cuando: c ? c.cuando : null };
  }

  /** «Comprobar conexión» con Meta como conductor: las cuentas, los permisos y la cuota de Instagram (sin publicar nada). */
  async function comprobar() {
    if (!meta || !meta.configurado()) return { ok: false, error: listo().motivo };
    await meta.sincronizar();
    const l = listo(); if (!l.ok) return { ok: false, error: l.motivo };
    const { fb, ig } = cuentas(); let cuota = '';
    if (ig) { try { const q = (await meta.graph(await meta.tokenDe({ paginaId: fb.paginaId }), `/${ig.externoId}/content_publishing_limit`, { params: { fields: 'config,quota_usage' } }))?.data?.[0]; if (q) { cuota = ` · Instagram: ${q.quota_usage ?? '?'} de ${q.config?.quota_total ?? '?'} publicaciones por API en 24 h`; apuntarCuota(q.quota_usage, q.config?.quota_total); } } catch { /* sin cuota: no es grave */ } }
    // Fase 0 de Anuncios (8 oct 2026): lo que le falta al token para las otras funciones, separado por función (publicar ya pasó).
    const otras = Object.entries(meta.estado().token?.faltanPor || {}).filter(([k, x]) => k !== 'publicar' && x.length);
    const faltanOtras = otras.length ? ` Para otras funciones le faltan permisos: ${otras.map(([k, x]) => `${NOMBRE_FUNCION[k] || k}: ${x.join(', ')}`).join(' · ')}.` : '';
    return { ok: true, texto: `Meta responde: publica en la página «${fb.nombre}»${ig ? ` y en Instagram @${ig.usuario || ig.nombre}` : ' (sin Instagram vinculado)'}${cuota}.`, nota: l.nota + faltanOtras, faltanPor: meta.estado().token?.faltanPor || {} };
  }

  return { id: 'meta', nombre: 'Meta', listo, programar, retirar, estado, pulso, comprobar, cuota, agenda: () => leer() };
}

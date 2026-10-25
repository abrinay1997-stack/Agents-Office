// ============================================================
// (NÚCLEO de la foto diaria, sin disco: lo usa contenido/metricas.mjs —archivos— y el Worker de Cloudflare —D1 y R2—.)
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
import { mensajeMeta } from './meta-nucleo.mjs';
import { sumarDias } from '../src/contenido-cifras.js';

export const DIAS_PUBLICACIONES = 45; // hasta dónde atrás se leen las publicaciones de cada cuenta
export const MAX_PUBLICACIONES = 18;
export const MAX_PUBLICACIONES_GUARDADAS = 600;
export const HORA_DE_LA_FOTO = 6; // desde las 6:00 locales, «ayer» está cerrado del lado de Meta
export const REINTENTO_MIN = 60; // una cuenta que falló se vuelve a intentar pasada una hora
export const INTENTOS_POR_DIA = 3;
export const MAX_MINIATURAS_POR_VUELTA = 24;
export const MAX_BYTES_MINIATURA = 2_000_000;
export const DOMINIO_DE_META = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const num = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

/** El día que se fotografía: AYER en el reloj de esta máquina, que es el último completo. */
export const fechaDeFoto = (ahora = new Date()) => sumarDias(ymd(ahora), -1);
export const inicioDelDia = fecha => { const [y, m, d] = fecha.split('-').map(Number); return Math.floor(new Date(y, m - 1, d).getTime() / 1000); };

/** Una llamada que puede fallar sin tumbar la foto. El error no se pierde: se apunta en `errores` para poder decir POR QUÉ no llegó nada. */
async function intentar(fn, errores) { try { return await fn(); } catch (e) { errores?.push(e); return null; } }

/** `total_value` de cada métrica de /insights, por nombre. */
function totales(datos) {
  const salida = {};
  for (const m of datos?.data ?? []) salida[m.name] = num(m.total_value?.value ?? m.values?.at(-1)?.value);
  return salida;
}

/** Los bytes son una imagen de las que se pintan sin riesgo (nada de SVG ni HTML disfrazado). */
export function tipoDeImagen(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}


/** Lo que se LEE de Meta para fotografiar una cuenta (sin guardar nada): `graph` y `tokenDe` del cliente de Meta. */
export function crearRecolector({ graph, tokenDe, ahora = () => Date.now() }) {
  // ----------------------------------------------------------------- Instagram

  async function metricasDelDiaIG(token, ig, fecha, errores) {
    const params = { period: 'day', metric_type: 'total_value', since: inicioDelDia(fecha), until: inicioDelDia(sumarDias(fecha, 1)) };
    const todas = ['reach', 'views', 'total_interactions', 'profile_views', 'accounts_engaged'];
    const juntas = await intentar(() => graph(token, `/${ig}/insights`, { params: { ...params, metric: todas.join(',') } }), errores);
    if (juntas) return totales(juntas);
    // Alguna ya no existe en esta versión: una a una.
    const salida = {};
    for (const m of todas) Object.assign(salida, totales(await intentar(() => graph(token, `/${ig}/insights`, { params: { ...params, metric: m } }), errores)));
    return salida;
  }

  async function audienciaIG(token, ig, errores) {
    const salida = {};
    for (const desglose of ['age', 'gender', 'city']) {
      const r = await intentar(() => graph(token, `/${ig}/insights`, { params: { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: desglose } }), errores);
      const resultados = r?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      if (resultados.length) {
        salida[desglose] = resultados.map(x => ({ clave: String(x.dimension_values?.[0] ?? ''), valor: num(x.value) ?? 0 })).sort((a, b) => b.valor - a.valor).slice(0, desglose === 'city' ? 8 : 12);
      }
    }
    return salida;
  }

  const TIPO_IG = { IMAGE: 'imagen', VIDEO: 'video', CAROUSEL_ALBUM: 'carrusel' };

  async function publicacionesIG(token, ig, desde, errores) {
    const lista = await intentar(() => graph(token, `/${ig}/media`, { params: { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url', limit: 30 } }), errores);
    const recientes = (lista?.data ?? []).filter(m => Date.parse(m.timestamp) >= desde).slice(0, MAX_PUBLICACIONES);
    const salida = [];
    for (const m of recientes) {
      const reel = m.media_product_type === 'REELS';
      const ins = totales((await intentar(() => graph(token, `/${m.id}/insights`, { params: { metric: 'reach,saved,shares,views,total_interactions' } }), errores)) ?? (await intentar(() => graph(token, `/${m.id}/insights`, { params: { metric: 'reach,saved' } }), errores)));
      const meGusta = num(m.like_count) ?? 0, comentarios = num(m.comments_count) ?? 0;
      salida.push({
        externoId: String(m.id), tipo: reel ? 'reel' : TIPO_IG[m.media_type] ?? 'imagen', enlace: m.permalink ?? '', texto: String(m.caption ?? '').slice(0, 300),
        miniaturaMeta: m.thumbnail_url || (m.media_type === 'VIDEO' ? '' : m.media_url) || '', publicadaAt: m.timestamp ? new Date(m.timestamp).toJSON() : null,
        meGusta, comentarios, guardados: ins.saved ?? 0, compartidos: ins.shares ?? 0, alcance: ins.reach ?? 0, vistas: ins.views ?? 0,
        interacciones: ins.total_interactions ?? meGusta + comentarios + (ins.saved ?? 0) + (ins.shares ?? 0),
      });
    }
    return salida;
  }

  // ------------------------------------------------------------------ Facebook

  async function metricasDelDiaFB(token, pagina, fecha, errores) {
    const params = { period: 'day', since: inicioDelDia(fecha), until: inicioDelDia(sumarDias(fecha, 1)) };
    const salida = {};
    // Fase 0 (8 oct 2026): `page_impressions_unique` está retirada desde Graph v25 (documentación de Page Insights); el alcance es
    // ahora `page_total_media_view_unique` (personas que vieron contenido de la página). La vieja queda de respaldo por si una página
    // aún no tiene la nueva. La primera que responda gana; los errores de las demás se apuntan igual.
    for (const [metricas, clave] of [[['page_total_media_view_unique', 'page_impressions_unique'], 'reach'], [['page_post_engagements'], 'total_interactions'], [['page_views_total'], 'profile_views'], [['page_media_view'], 'views']]) {
      for (const m of metricas) {
        const r = await intentar(() => graph(token, `/${pagina}/insights`, { params: { ...params, metric: m } }), errores);
        const v = r?.data?.[0]?.values?.at(-1)?.value;
        if (v !== undefined) { salida[clave] = num(v); break; }
      }
    }
    return salida;
  }

  /**
   * Las publicaciones recientes de la página. Meta no dice lo mismo a todas las cuentas: con ciertos permisos, pedir las
   * reacciones hace fallar la petición ENTERA. Se prueba de más a menos campos, y el motivo de cada fallo se devuelve para
   * guardarlo en la foto: callado, eso se ve como «esta página no publicó nada en un mes».
   */
  async function publicacionesFB(token, pagina, desde, errores) {
    const intentos = [
      ['/posts', 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)'],
      ['/posts', 'id,message,created_time,permalink_url,full_picture,shares'],
      ['/published_posts', 'id,message,created_time,permalink_url,full_picture,shares'],
    ];
    const fallos = [];
    let r = null;
    for (const [ruta, fields] of intentos) {
      try { r = await graph(token, `/${pagina}${ruta}`, { params: { fields, limit: 25 } }); break; }
      catch (e) { errores?.push(e); fallos.push(`${ruta} (${fields.includes('reactions') ? 'con reacciones' : 'básico'}): ${mensajeMeta(e)}`.slice(0, 240)); }
    }
    const lista = (r?.data ?? []).filter(p => Date.parse(p.created_time) >= desde).slice(0, MAX_PUBLICACIONES).map(p => {
      const reacciones = num(p.reactions?.summary?.total_count) ?? 0, comentarios = num(p.comments?.summary?.total_count) ?? 0, compartidos = num(p.shares?.count) ?? 0;
      return {
        externoId: String(p.id), tipo: p.full_picture ? 'imagen' : 'texto', enlace: p.permalink_url ?? '', texto: String(p.message ?? '').slice(0, 300),
        miniaturaMeta: p.full_picture ?? '', publicadaAt: p.created_time ? new Date(p.created_time).toJSON() : null,
        meGusta: reacciones, comentarios, guardados: 0, compartidos, alcance: 0, vistas: 0, interacciones: reacciones + comentarios + compartidos,
      };
    });
    // Parcial: se leyeron, pero con menos campos (sin reacciones). No es lo mismo que no poder leer nada, y la pantalla lo dice distinto.
    return { lista, fallos, parcial: Boolean(r) && fallos.length > 0, recibidas: r?.data?.length ?? 0 };
  }


  /** Fotografía una cuenta: su fila de `fecha` y sus publicaciones recientes (con la miniatura de Meta aún sin bajar). Lanza si Meta no entregó ni los seguidores. */
  async function recolectar(cuenta, fecha = fechaDeFoto(new Date(ahora()))) {
    const token = await tokenDe(cuenta);
    const desde = ahora() - DIAS_PUBLICACIONES * 86400_000;
    const errores = [];
    let base = {}, dia = {}, datos = {}, publicaciones = [];
    if (cuenta.red === 'instagram') {
      base = (await intentar(() => graph(token, `/${cuenta.externoId}`, { params: { fields: 'followers_count,media_count' } }), errores)) ?? {};
      dia = await metricasDelDiaIG(token, cuenta.externoId, fecha, errores);
      datos = { audiencia: await audienciaIG(token, cuenta.externoId, errores) };
      publicaciones = await publicacionesIG(token, cuenta.externoId, desde, errores);
    } else if (cuenta.red === 'facebook') {
      base = (await intentar(() => graph(token, `/${cuenta.externoId}`, { params: { fields: 'followers_count,fan_count' } }), errores)) ?? {};
      dia = await metricasDelDiaFB(token, cuenta.externoId, fecha, errores);
      const fb = await publicacionesFB(token, cuenta.externoId, desde, errores);
      publicaciones = fb.lista;
      // Por qué no llegaron publicaciones, si no llegaron: sin esto, un permiso que falta se ve igual que una página que no publica.
      datos = fb.fallos.length ? { avisos: { publicaciones: fb.fallos, ...(fb.parcial ? { parcial: true } : {}) } } : { recibidas: fb.recibidas };
    }
    // Si ni siquiera llegaron los seguidores, el token no vale: no se guardan ceros.
    const seguidores = num(base.followers_count ?? base.fan_count);
    if (seguidores === null && !publicaciones.length) {
      // Sin el porqué, un permiso que falta y un token muerto se ven igual: «no devolvió datos». Se dice lo primero que Meta contestó.
      const motivo = errores.length ? ` ${mensajeMeta(errores[0])}` : '';
      const e = new Error(`Meta no devolvió datos de ${cuenta.nombre || cuenta.externoId}.${motivo}`); e.motivoMeta = errores[0] ?? null; throw e;
    }
    const fila = {
      cuentaId: cuenta.id, red: cuenta.red, fecha, seguidores, publicaciones: num(base.media_count),
      alcance: dia.reach ?? null, vistas: dia.views ?? null, interacciones: dia.total_interactions ?? null, visitas: dia.profile_views ?? null,
      datos, creadaAt: new Date(ahora()).toJSON(),
    };
    return { fila, publicaciones };
  }
  return { recolectar, metricasDelDiaIG, audienciaIG, publicacionesIG, metricasDelDiaFB, publicacionesFB };
}

export const claveDia = (cuenta, fecha) => `${cuenta.id}|${fecha}`;

/** La fila que se apunta cuando una cuenta falló hoy (para no martillarla), o null si ya había una foto buena de ese día. */
export function filaDeFallo(cuenta, fecha, e, previa, ahora = Date.now) {
  if (previa && !previa.error) return null; // ya había una foto buena de ese día: un fallo posterior no la pisa
  return { cuentaId: cuenta.id, red: cuenta.red, fecha, error: mensajeMeta(e).slice(0, 300), intentos: (previa?.intentos ?? 0) + 1, falloAt: new Date(ahora()).toJSON(), creadaAt: previa?.creadaAt ?? new Date(ahora()).toJSON() };
}

/** Las cuentas que faltan por fotografiar para `fecha`: sin foto, o con un fallo ya reposado y con intentos por gastar. `dias` = las filas de ese mes por `cuenta|fecha`. */
export function pendientesDe(cuentas, fecha, dias, ahora = Date.now) {
  return cuentas.filter(c => {
    const f = dias[claveDia(c, fecha)];
    if (!f) return true;
    if (!f.error) return false;
    return (f.intentos ?? 1) < INTENTOS_POR_DIA && ahora() - Date.parse(f.falloAt || 0) >= REINTENTO_MIN * 60_000;
  });
}

/** Los meses (AAAA-MM) que hay que leer para los últimos `dias` días. */
export function mesesDeLectura(dias, ahora = Date.now) {
  const hoy = new Date(ahora()), meses = new Set();
  for (let i = 0; i <= dias + 31; i += 28) meses.add(sumarDias(ymd(hoy), -i).slice(0, 7));
  meses.add(ymd(hoy).slice(0, 7));
  return [...meses];
}

/** Lo guardado de los últimos `dias` días, listo para las cuentas de src/contenido-cifras.js. `filasPorMes` = [objeto de filas de cada mes], `pubs` = las publicaciones guardadas. */
export function armarLectura({ filasPorMes, pubs, dias = 90, ahora = Date.now }) {
  const desde = sumarDias(ymd(new Date(ahora())), -dias);
  const serie = [];
  for (const f of filasPorMes) for (const x of Object.values(f)) if (x.fecha >= desde) serie.push(x);
  serie.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cuentaId.localeCompare(b.cuentaId));
  const publicaciones = Object.values(pubs).sort((a, b) => String(b.publicadaAt).localeCompare(String(a.publicadaAt)));
  return { serie, publicaciones, ultimaFoto: serie.filter(f => !f.error).at(-1)?.fecha ?? null };
}

/** Mezcla las publicaciones recién leídas con las guardadas (por id: se reescriben, sus cifras maduran) y recorta a las más recientes. `miniatura(p, id, previa)` → ruta (puede ser asíncrona). */
export async function mezclarPublicaciones({ guardadas, cuenta, publicaciones, miniatura, ahora = Date.now }) {
  let bajadas = 0;
  for (const p of publicaciones) {
    const id = `${cuenta.id}|${p.externoId}`, previa = guardadas[id];
    let mini = previa?.miniatura || '';
    if (!mini && p.miniaturaMeta && bajadas < MAX_MINIATURAS_POR_VUELTA) { const h = await miniatura(p.miniaturaMeta, id); if (h) { mini = `/api/contenido/miniatura/${h}`; bajadas++; } }
    const { miniaturaMeta, ...limpia } = p; void miniaturaMeta;
    guardadas[id] = { id, cuentaId: cuenta.id, red: cuenta.red, ...limpia, miniatura: mini, actualizadaAt: new Date(ahora()).toJSON() };
  }
  const ordenadas = Object.values(guardadas).sort((a, b) => String(b.publicadaAt).localeCompare(String(a.publicadaAt))).slice(0, MAX_PUBLICACIONES_GUARDADAS);
  return Object.fromEntries(ordenadas.map(p => [p.id, p]));
}

/** El hash (20 hex) con el que se guarda una miniatura: de la clave de la publicación. */
export const hashMiniatura = (clave, sha1hex) => sha1hex(clave).slice(0, 20);

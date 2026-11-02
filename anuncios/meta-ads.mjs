// ============================================================
// Agents Office — Anuncios de Meta, Fase A1 (8 oct 2026): el cliente de LECTURA de la Marketing API.
//
// Va encima de contenido/meta.mjs (crearMeta): el mismo token (META_ACCESS_TOKEN, nunca en un archivo), el mismo `appsecret_proof`
// y el MISMO FRENO por uso, porque publicar, Analíticas, Anuncios y la Bandeja gastan la misma cuota. Aquí no hay `fetch` propio.
//
// LEE, y desde la Fase A2 (9 oct 2026) también CAMBIA, pero solo por `cambiar()` y `copiar()` y siempre por `meta.enviar` (el freno).
// Quién puede pedir un cambio, los dos clics del dinero y los topes viven en anuncios/acciones.mjs: este archivo no decide nada.
// El LOTE (`POST /` con `batch`, que Graph exige así) sigue siendo solo de lectura: `lote()` se niega a mandar dentro algo que no sea un GET.
//
// Buenas prácticas (plan §4.1): `fields=` explícitos, `limit` y paginación por cursor; la estructura (cuenta, campañas, conjuntos,
// anuncios, creativos) en UN lote; las cifras por cuenta (`/act_<id>/insights?level=ad&time_increment=1`), no objeto a objeto.
// ============================================================
import { ErrorMeta } from '../contenido/meta.mjs';

export const MAX_LOTE = 50; // lo que Graph admite en un lote
const LIMITE_LISTA = 200, LIMITE_CIFRAS = 500, MAX_PAGINAS = 20;

// Los campos de cada objeto. Pedir un campo que la versión no conoce hace fallar la petición ENTERA: aquí solo van los de la
// referencia de v26 que la oficina usa. POR VERIFICAR contra la referencia de v26 antes de añadir `advantage_state_info` a las
// campañas (plan §13.3): por eso todavía no se pide.
export const CAMPOS = {
  cuenta: 'id,account_id,name,account_status,disable_reason,currency,timezone_name,amount_spent,spend_cap,balance',
  campanas: 'id,name,objective,status,configured_status,effective_status,daily_budget,lifetime_budget,budget_remaining,bid_strategy,spend_cap,start_time,stop_time,special_ad_categories,created_time,updated_time,issues_info',
  conjuntos: 'id,name,campaign_id,status,configured_status,effective_status,optimization_goal,billing_event,destination_type,daily_budget,lifetime_budget,budget_remaining,bid_strategy,start_time,end_time,targeting,learning_stage_info,promoted_object,issues_info',
  // VERIFICADO el 9 oct 2026 con la cuenta real: `effective_instagram_media_id` existe en el creativo (la Fase B1 lo usará para los comentarios de los anuncios).
  anuncios: 'id,name,adset_id,campaign_id,status,configured_status,effective_status,issues_info,ad_review_feedback,created_time,creative{id,name,thumbnail_url,image_url,body,title,call_to_action_type,object_story_spec,effective_object_story_id,instagram_user_id}',
  // 2 nov 2026: `instagram_user_id` (AdCreative, v26) dice de qué Instagram es el anuncio; con `object_story_spec.page_id` y el `promoted_object` del
  // conjunto da la cuenta de cada anuncio sin llamadas nuevas (anuncios/cuentas.mjs). POR VERIFICAR con la cuenta real que v26 lo devuelve.
  creativos: 'id,name,thumbnail_url,image_url,body,title,call_to_action_type,object_story_spec,effective_object_story_id,instagram_user_id',
  // las cifras diarias por anuncio (plan §5 A1). `purchase_roas` solo tiene sentido con píxel: se añade si hay uno en Ajustes.
  cifras: 'ad_id,adset_id,campaign_id,date_start,date_stop,spend,impressions,reach,frequency,clicks,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,ctr,cpc,cpm,actions,cost_per_action_type',
  alcance: 'campaign_id,adset_id,ad_id,reach,impressions,frequency',
};
export const NIVELES_ALCANCE = ['account', 'campaign', 'adset', 'ad'];

/** «act_123» con o sin el prefijo → «act_123»; cualquier otra cosa → ''. */
export const idCuenta = s => { const t = String(s || '').trim(); return /^act_\d+$/.test(t) ? t : /^\d+$/.test(t) ? `act_${t}` : ''; };

const urlRelativa = (ruta, params = {}) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  const s = String(q); return `${String(ruta).replace(/^\//, '')}${s ? '?' + s : ''}`;
};

/**
 * @param {object} o
 * @param {object} o.meta  el cliente de contenido/meta.mjs (graph, enviar, tokenDe, uso)
 */
export function crearMetaAds({ meta }) {
  const token = () => meta.tokenDe({}); // sin página: el token de usuario del sistema (el que tiene la cuenta publicitaria asignada)

  /** Un lote de GET (hasta 50) en una sola llamada. Cada respuesta llega con su código; una que falla no tumba a las demás. */
  async function lote(peticiones) {
    if (!Array.isArray(peticiones) || !peticiones.length) return [];
    if (peticiones.length > MAX_LOTE) throw new Error(`un lote de Meta admite ${MAX_LOTE} peticiones (llegaron ${peticiones.length})`);
    for (const p of peticiones) if ((p.method || 'GET').toUpperCase() !== 'GET') throw new Error('Anuncios (A1) solo lee: un lote no puede llevar más que GET');
    const r = await meta.enviar(await token(), '/', { campos: { batch: peticiones.map(p => ({ method: 'GET', relative_url: urlRelativa(p.ruta, p.params) })), include_headers: false } });
    if (!Array.isArray(r)) throw new ErrorMeta({ message: 'Meta no devolvió el lote como se esperaba' }, 0);
    return r.map(x => {
      let cuerpo = null; try { cuerpo = typeof x?.body === 'string' ? JSON.parse(x.body) : x?.body ?? null; } catch { /* cuerpo ilegible */ }
      if (!x || x.code !== 200 || cuerpo?.error) return { ok: false, error: new ErrorMeta({ ...(cuerpo?.error ?? {}), message: cuerpo?.error?.message || `Meta respondió ${x?.code ?? '?'} en el lote` }, x?.code ?? 0) };
      return { ok: true, datos: cuerpo };
    });
  }

  /** Sigue los cursores de una lista (`paging.next` → `after`), hasta MAX_PAGINAS. `datos` = la primera página si ya se tiene. */
  async function resto(ruta, params, datos) {
    const salida = [...(datos?.data ?? [])];
    let d = datos;
    for (let vuelta = 0; vuelta < MAX_PAGINAS && d?.paging?.next && d?.paging?.cursors?.after; vuelta++) {
      d = await meta.graph(await token(), ruta, { params: { ...params, after: d.paging.cursors.after } });
      salida.push(...(d?.data ?? []));
    }
    return salida;
  }
  async function todas(ruta, params) { return resto(ruta, params, await meta.graph(await token(), ruta, { params })); }

  /** La cuenta y todo lo que cuelga de ella, en UN lote (más las páginas que falten de una lista larga). */
  async function estructura(cuenta) {
    const act = idCuenta(cuenta); if (!act) throw new Error('falta la cuenta publicitaria (act_…)');
    const listas = { campanas: 'campaigns', conjuntos: 'adsets', anuncios: 'ads', creativos: 'adcreatives' };
    const pet = [{ ruta: `/${act}`, params: { fields: CAMPOS.cuenta } }, ...Object.entries(listas).map(([k, sub]) => ({ ruta: `/${act}/${sub}`, params: { fields: CAMPOS[k], limit: LIMITE_LISTA } }))];
    const [rc, ...rl] = await lote(pet);
    if (!rc.ok) throw rc.error;
    const out = { cuenta: rc.datos, avisos: [] };
    const claves = Object.keys(listas);
    for (let i = 0; i < claves.length; i++) {
      const k = claves[i], r = rl[i];
      if (!r.ok) { if (k === 'creativos') { out.creativos = []; out.avisos.push(`no se pudieron leer los creativos: ${r.error.message}`); continue; } throw r.error; }
      out[k] = await resto(pet[i + 1].ruta, pet[i + 1].params, r.datos);
    }
    return out;
  }

  /** Las cifras diarias por anuncio entre dos días (en la zona de la cuenta). */
  async function cifrasDiarias(cuenta, desde, hasta, { pixel = false } = {}) {
    const act = idCuenta(cuenta); if (!act) throw new Error('falta la cuenta publicitaria (act_…)');
    return todas(`/${act}/insights`, { level: 'ad', time_increment: 1, fields: CAMPOS.cifras + (pixel ? ',purchase_roas' : ''), time_range: { since: desde, until: hasta }, limit: LIMITE_CIFRAS });
  }

  /**
   * El ALCANCE de cada rango y nivel: personas únicas, que no se pueden sumar día a día. Un lote con una petición por rango y nivel
   * (4 × 4 = 16). rangos: { hoy: ['AAAA-MM-DD', 'AAAA-MM-DD'], … } → { hoy: { desde, hasta, account, campaign: {id: n}, adset, ad } }.
   * Una lista de más de LIMITE_CIFRAS objetos se queda en su primera página (esos objetos salen sin alcance: null, no inventado).
   */
  async function alcances(cuenta, rangos) {
    const act = idCuenta(cuenta); if (!act) throw new Error('falta la cuenta publicitaria (act_…)');
    const pares = Object.entries(rangos).flatMap(([nombre, [desde, hasta]]) => NIVELES_ALCANCE.map(nivel => ({ nombre, desde, hasta, nivel })));
    const r = await lote(pares.map(p => ({ ruta: `/${act}/insights`, params: { level: p.nivel, fields: CAMPOS.alcance, time_range: { since: p.desde, until: p.hasta }, limit: LIMITE_CIFRAS } })));
    const out = {};
    pares.forEach((p, i) => {
      const x = (out[p.nombre] ||= { desde: p.desde, hasta: p.hasta, account: null, campaign: {}, adset: {}, ad: {} });
      if (!r[i]?.ok) return;
      for (const f of r[i].datos?.data ?? []) {
        const v = Number(f.reach); if (!Number.isFinite(v)) continue;
        if (p.nivel === 'account') x.account = v; else if (f[`${p.nivel}_id`]) x[p.nivel][f[`${p.nivel}_id`]] = v;
      }
    });
    return out;
  }

  // ---------------------------------------------------------------- Fase A2: leer UN objeto y cambiarlo

  const NIVEL_CAMPOS = { campana: CAMPOS.campanas, conjunto: CAMPOS.conjuntos, anuncio: CAMPOS.anuncios };
  const idValido = id => { const t = String(id || ''); if (!/^[A-Za-z0-9_]{1,40}$/.test(t)) throw new Error('id de Meta no válido'); return t; };

  /** Una campaña, un conjunto o un anuncio tal como está AHORA en Meta (para el «antes» y para refrescar data/anuncios/cuenta.json). */
  async function leer(id, nivel) {
    if (!NIVEL_CAMPOS[nivel]) throw new Error(`nivel desconocido: ${nivel}`);
    return meta.graph(await token(), `/${idValido(id)}`, { params: { fields: NIVEL_CAMPOS[nivel] } });
  }
  /**
   * POST /<id> con los campos que cambian (status, daily_budget, lifetime_budget, end_time, stop_time, name). `validar: true` manda
   * `execution_options: ["validate_only"]`: Meta lo revisa y contesta `{ success: true }` SIN cambiar nada (verificado el 9 oct 2026 en la
   * referencia de Campaign, plan §13.2; POR VERIFICAR que conjuntos y anuncios lo acepten igual en v26).
   */
  async function cambiar(id, campos, { validar = false } = {}) {
    if (campos && 'execution_options' in campos) throw new Error('execution_options lo pone cambiar() con `validar`');
    return meta.enviar(await token(), `/${idValido(id)}`, { campos: { ...campos, ...(validar ? { execution_options: ['validate_only'] } : {}) } });
  }
  /**
   * POST /<id>/copies (campaña, conjunto o anuncio). Verificado el 9 oct 2026 para campañas (plan §13.7): `deep_copy`, `status_option`
   * (PAUSED por defecto), `start_time`/`end_time` de los conjuntos copiados, `rename_options`; síncrona solo con hasta 3 anuncios hijos.
   * POR VERIFICAR: que las copias de conjuntos (`campaign_id`) y de anuncios (`adset_id`) y `validate_only` funcionen igual en v26.
   */
  async function copiar(id, campos, { validar = false } = {}) {
    return meta.enviar(await token(), `/${idValido(id)}/copies`, { campos: { ...campos, ...(validar ? { execution_options: ['validate_only'] } : {}) } });
  }

  // ---------------------------------------------------------------- Fase A3 (9 oct 2026): CREAR, siempre en pausa (anuncios/crear.mjs decide)

  const SUB_CREAR = { campana: 'campaigns', conjunto: 'adsets', creativo: 'adcreatives', anuncio: 'ads' };
  /**
   * POST /act_<id>/<campaigns|adsets|adcreatives|ads>. `validar: true` = `execution_options: ["validate_only"]` (verificado para campañas,
   * plan §13.2; POR VERIFICAR en conjuntos, creativos y anuncios). Se niega a crear algo que no nazca en pausa: la regla del dinero (§3.3).
   */
  async function crearEn(cuenta, nivel, campos, { validar = false } = {}) {
    const act = idCuenta(cuenta); if (!act) throw new Error('falta la cuenta publicitaria (act_…)');
    if (!SUB_CREAR[nivel]) throw new Error(`nivel desconocido: ${nivel}`);
    if (nivel !== 'creativo' && campos?.status !== 'PAUSED') throw new Error('la oficina solo crea en Meta EN PAUSA (status PAUSED)');
    if (campos && 'execution_options' in campos) throw new Error('execution_options lo pone crearEn() con `validar`');
    return meta.enviar(await token(), `/${act}/${SUB_CREAR[nivel]}`, { campos: { ...campos, ...(validar ? { execution_options: ['validate_only'] } : {}) } });
  }
  /**
   * Lo que ya existe en Meta con ese texto en el nombre (para reconciliar tras un corte: la etiqueta `AO:<id>`). Pide la lista filtrada por
   * nombre (`filtering` CONTAIN; POR VERIFICAR en v26 para adcreatives) y comprueba el nombre EXACTO aquí. Lo archivado o borrado no cuenta:
   * es de un intento que falló.
   */
  async function buscarPorNombre(cuenta, nivel, nombre, contiene) {
    const act = idCuenta(cuenta); if (!act) throw new Error('falta la cuenta publicitaria (act_…)');
    const campos = nivel === 'creativo' ? 'id,name,status' : 'id,name,status,effective_status';
    let l;
    try { l = await todas(`/${act}/${SUB_CREAR[nivel]}`, { fields: campos, limit: LIMITE_LISTA, filtering: JSON.stringify([{ field: 'name', operator: 'CONTAIN', value: String(contiene) }]) }); }
    catch (e) { if (!(e instanceof ErrorMeta) || e.codigo !== 100) throw e; l = await todas(`/${act}/${SUB_CREAR[nivel]}`, { fields: campos, limit: LIMITE_LISTA }); } // sin el filtro: la lista entera (hasta MAX_PAGINAS)
    return l.filter(x => x?.name === nombre && !['ARCHIVED', 'DELETED'].includes(x.effective_status || x.status));
  }
  /**
   * Una imagen a la biblioteca de la cuenta: POST /act_<id>/adimages con `bytes` (la imagen en base64, como lo documenta la referencia de
   * AdImage; POR VERIFICAR frente al multipart). Meta devuelve `{ images: { <nombre>: { hash, url } } }`; el hash es del contenido, así que
   * volver a subir la misma imagen da el mismo hash (no duplica nada ni gasta).
   */
  async function subirImagen(cuenta, { datos, nombre = 'imagen.jpg' }) {
    const act = idCuenta(cuenta); if (!act) throw new Error('falta la cuenta publicitaria (act_…)');
    const r = await meta.enviar(await token(), `/${act}/adimages`, { campos: { bytes: Buffer.from(datos).toString('base64'), name: nombre } });
    const img = Object.values(r?.images || {})[0];
    if (!img?.hash) throw new ErrorMeta({ message: 'Meta no devolvió el hash de la imagen' }, 0);
    return { hash: img.hash, url: img.url || null };
  }
  /** Un video a la cuenta: POST /act_<id>/advideos (multipart en `source`, por graph-video). Hasta MAX_VIDEO de una vez (POR VERIFICAR la subida por partes). */
  async function subirVideo(cuenta, { datos, nombre = 'video.mp4', tipo = 'video/mp4' }) {
    const act = idCuenta(cuenta); if (!act) throw new Error('falta la cuenta publicitaria (act_…)');
    if (datos.length > MAX_VIDEO) throw new Error(`el video pesa ${Math.round(datos.length / 1048576)} MB: la oficina sube hasta ${Math.round(MAX_VIDEO / 1048576)} MB de una vez (por partes, todavía no)`);
    const r = await meta.enviar(await token(), `/${act}/advideos`, { campos: { name: nombre }, archivo: { datos, nombre, tipo }, video: true });
    if (!r?.id) throw new ErrorMeta({ message: 'Meta no devolvió el id del video' }, 0);
    return { id: String(r.id) };
  }
  /** El estado de un video subido (`status.video_status`: processing · ready · error) y su miniatura (POR VERIFICAR `picture`). */
  async function leerVideo(id) {
    const r = await meta.graph(await token(), `/${idValido(id)}`, { params: { fields: 'status,picture' } });
    return { estado: r?.status?.video_status || null, miniatura: r?.picture || null };
  }
  /** La vista previa de Meta de un creativo SIN crearlo: GET /act_<id>/generatepreviews?creative=<spec>&ad_format=… → el HTML (un iframe). */
  async function vistaPrevia(cuenta, creativo, formato = 'MOBILE_FEED_STANDARD') {
    const act = idCuenta(cuenta); if (!act) throw new Error('falta la cuenta publicitaria (act_…)');
    const r = await meta.graph(await token(), `/${act}/generatepreviews`, { params: { creative: JSON.stringify(creativo), ad_format: formato } });
    return String(r?.data?.[0]?.body || '');
  }

  /**
   * Fase A4 (9 oct 2026): ¿deja Meta impulsar esta publicación? Solo LEE. Verificado (guía «Use posts as ads»): de Instagram se pregunta
   * `boost_eligibility_info` del medio; de Facebook, `is_instagram_eligible` del post (si es false, el anuncio sale solo en Facebook).
   * POR VERIFICAR: los nombres de dentro de boost_eligibility_info (`eligible_to_boost`, `boost_ineligible_reason`) y si un post de
   * Facebook que no se puede impulsar lo dice aquí o al crear el creativo.
   * → { ok: true|false|null (null = Meta no lo dijo), instagram: true|false|null, motivo }
   */
  async function impulsable(red, id) {
    const pid = idValido(id);
    if (red === 'instagram') {
      const r = await meta.graph(await token(), `/${pid}`, { params: { fields: 'boost_eligibility_info' } });
      const i = r?.boost_eligibility_info;
      if (!i || typeof i !== 'object' || typeof i.eligible_to_boost !== 'boolean') return { ok: null, instagram: true, motivo: '' };
      return { ok: i.eligible_to_boost, instagram: true, motivo: i.eligible_to_boost ? '' : motivoNoImpulsable(i.boost_ineligible_reason) };
    }
    const r = await meta.graph(await token(), `/${pid}`, { params: { fields: 'is_instagram_eligible' } });
    return { ok: true, instagram: typeof r?.is_instagram_eligible === 'boolean' ? r.is_instagram_eligible : null, motivo: '' };
  }

  return { lote, estructura, cifrasDiarias, alcances, todas, leer, cambiar, copiar, crearEn, buscarPorNombre, subirImagen, subirVideo, leerVideo, vistaPrevia, impulsable };
}
export const MAX_VIDEO = 200 * 1048576;

/** A4: el motivo de Meta para no dejar impulsar algo, en palabras (los casos de la guía; lo demás, tal como lo dice Meta). */
export function motivoNoImpulsable(m) {
  const t = String(m || '').trim(), l = t.toLowerCase();
  const pre = 'Meta no deja impulsar esta publicación: ';
  if (/music|copyright|audio|licen/.test(l)) return pre + 'tiene música con derechos.';
  if (/interactive|sticker|filter|effect|poll|quiz/.test(l)) return pre + 'tiene elementos interactivos (filtros, stickers o encuestas).';
  if (/igtv/.test(l)) return pre + 'es de Instagram TV.';
  if (/expired|story/.test(l)) return pre + 'es una historia que ya no está activa.';
  return pre + (t ? `«${t.slice(0, 200)}».` : 'no dio el motivo.');
}

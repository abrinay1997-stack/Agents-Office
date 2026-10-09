// ============================================================
// Agents Office V4.7 (F2) — el cliente de la Graph API de Meta (Facebook e Instagram). SOLO LECTURA.
//
// PORTADO de Juancito Ads — juanarrietabusiness-pixel/CALENDARIOS-MARKETING-APP, worker/lib/meta.js (30 sep 2026): el cliente
// de `graph()`, `ErrorMeta` y las frases de `mensajeMeta`, que ya vivieron un año de errores reales de Meta. Lo que NO viene:
// el OAuth con inicio de sesión, la cifra de tokens en D1 y el cambio de token de corta por larga duración. Esta oficina corre en
// una computadora, no en un servidor con una web pública a la que Meta pueda volver: entra con un TOKEN DE USUARIO DEL SISTEMA
// (Business Manager → Usuarios del sistema), que no caduca y se pone una vez.
//
// EL TOKEN
//   · `META_ACCESS_TOKEN` — variable de entorno de Windows, como las llaves del Estudio. NUNCA se escribe en un archivo, ni en
//     `data/`, ni en un aviso, ni en un error: `sinToken()` lo quita de cualquier texto que salga de aquí.
//   · `META_APP_SECRET` (opcional) — si la app de Meta exige «prueba del secreto», cada llamada lleva `appsecret_proof`.
//   · `META_GRAPH_VERSION` (opcional) — para no depender de que esta versión no se retire.
//   · `META_GRAPH_HOST` (solo para pruebas) — otra dirección en lugar de graph.facebook.com; `npm run check` la apunta a un Graph de mentira.
// Los tokens de cada PÁGINA (los que piden las métricas de Facebook) se piden con el de usuario y viven solo en memoria.
//
// NADA DE ESTO SE HA PROBADO CONTRA META desde la máquina donde se escribió (no había token ni salida a graph.facebook.com):
// los tests usan un `fetch` de mentira que habla como Graph. Lo primero con un token de verdad es «Comprobar conexión».
//
// 8 oct 2026 (F3, publicar directo): `enviar()` (POST, también con un archivo), `borrar()` y `subirReanudable()` (los videos de Instagram
// van a rupload.facebook.com sin necesitar una dirección pública). En ellas el token viaja en la cabecera `Authorization`, nunca en la
// dirección. Los nombres de rutas y parámetros se comprobaron contra el SDK oficial de Meta (facebook_business 26.0.2, generado de la
// especificación de la Graph API) y contra ig-publish (deegitech, MIT, notas de octubre de 2026). Ver contenido/meta-publicar.mjs.
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

// Fase 0 de Anuncios (8 oct 2026): de v23.0 a v26.0. La Graph API v23 vivía hasta el 8 oct 2027, pero la Marketing API v23 caducó el
// 9 jun 2026 (y la v24 el 6 oct 2026), y la oficina usa UNA versión para publicar, Analíticas, Anuncios y la Bandeja.
export const VERSION_GRAPH = 'v26.0';
export const HOST_GRAPH = 'https://graph.facebook.com';

/**
 * Cuándo deja de existir cada versión, de las páginas oficiales de Meta (consultadas el 8 oct 2026):
 * developers.facebook.com/docs/graph-api/changelog/versions y …/marketing-api/marketing-api-changelog/versions.
 * null = Meta aún no la ha fijado. `npm run check` avisa cuando a la versión fijada le quedan menos de 90 días en cualquiera de
 * las dos: al actualizar la tabla, se miran esas dos páginas.
 */
export const VERSIONES_AL = '2026-10-08';
export const VERSIONES = {
  'v22.0': { graph: '2027-05-20', marketing: '2026-02-19' },
  'v23.0': { graph: '2027-10-08', marketing: '2026-06-09' },
  'v24.0': { graph: '2028-02-18', marketing: '2026-10-06' },
  'v25.0': { graph: '2028-07-29', marketing: null },
  'v26.0': { graph: null, marketing: null },
};

/** Días que le quedan a una versión en cada API (null = sin fecha; negativo = ya caducó; undefined = versión desconocida). */
export function caducidad(version = VERSION_GRAPH, ahora = Date.now()) {
  const v = VERSIONES[version];
  if (!v) return { version, conocida: false, graph: undefined, marketing: undefined };
  const dias = f => (f ? Math.floor((Date.parse(f + 'T00:00:00Z') - ahora) / 864e5) : null);
  return { version, conocida: true, graph: dias(v.graph), marketing: dias(v.marketing), fechas: v };
}

/** Lo que hace falta para LEER (F2). */
export const PERMISOS_LECTURA = ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'read_insights', 'business_management', 'instagram_basic', 'instagram_manage_insights'];
/** Lo que hará falta para PROGRAMAR (F3): se pide ya, para no volver a generar el token después. */
export const PERMISOS_PUBLICAR = ['pages_manage_posts', 'pages_manage_engagement', 'instagram_content_publish', 'instagram_manage_comments']; // 8 oct 2026: + pages_manage_engagement (el primer comentario en Facebook)
/** Fase 0 de Anuncios (8 oct 2026): lo que piden el panel de Anuncios (leer y cambiar campañas) y los mensajes privados de la Bandeja. */
export const PERMISOS_ANUNCIOS = ['ads_management', 'ads_read'];
export const PERMISOS_MENSAJES = ['pages_messaging', 'pages_manage_metadata', 'instagram_manage_messages'];
/** Cada función de la oficina con lo que necesita: «Comprobar conexión» dice lo que falta por separado. */
export const PERMISOS_POR_FUNCION = { lectura: PERMISOS_LECTURA, publicar: PERMISOS_PUBLICAR, anuncios: PERMISOS_ANUNCIOS, mensajes: PERMISOS_MENSAJES };
export const NOMBRE_FUNCION = { lectura: 'Analíticas', publicar: 'Publicar', anuncios: 'Anuncios', mensajes: 'Mensajes de la Bandeja' };
/** { lectura: [...], publicar: [...], … } con lo que falta en cada una ({} si Meta no dijo los permisos). */
export const faltanPorFuncion = concedidos => (Array.isArray(concedidos) ? Object.fromEntries(Object.entries(PERMISOS_POR_FUNCION).map(([k, l]) => [k, l.filter(p => !concedidos.includes(p))])) : {});

// ---- El freno por uso (Fase 0, 8 oct 2026; developers.facebook.com/docs/graph-api/overview/rate-limiting).
// Meta dice cuánto de su cuota se lleva gastado en tres cabeceras (porcentajes) y, al pasarse, contesta con uno de estos códigos.
// Su consejo: «si se alcanza el límite, deja de hacer llamadas a la API» — seguir llamando alarga la espera.
export const CODIGOS_LIMITE = [4, 17, 32, 613, ...Array.from({ length: 15 }, (_, i) => 80000 + i)];
export const UMBRAL_ESPACIAR = 75; // desde aquí, quien sondea espacia (ritmo 2); desde el 90 %, más (ritmo 4)
export const ESPERA_LIMITE_MIN = 5; // si Meta limita y no dice cuánto esperar

/**
 * Lo que dicen las cabeceras de uso de una respuesta: el mayor porcentaje y cuántos minutos pide Meta esperar.
 * `X-App-Usage` {call_count,total_time,total_cputime} · `X-Business-Use-Case-Usage` {<id>: [{…, estimated_time_to_regain_access (min)}]}
 * · `X-Ad-Account-Usage` {acc_id_util_pct, reset_time_duration (s)}. Lo que no se puede leer no cuenta.
 */
export function leerUso(cabeceras) {
  const get = k => (typeof cabeceras?.get === 'function' ? cabeceras.get(k) : cabeceras?.[k]);
  const leer = k => { try { const v = get(k); return v ? JSON.parse(v) : null; } catch { return null; } };
  const pcts = [], minutos = [];
  const sumar = o => { for (const k of ['call_count', 'total_time', 'total_cputime', 'acc_id_util_pct']) if (Number.isFinite(Number(o?.[k]))) pcts.push(Number(o[k])); };
  const app = leer('x-app-usage'); if (app) sumar(app);
  const negocio = leer('x-business-use-case-usage');
  if (negocio && typeof negocio === 'object') for (const lista of Object.values(negocio)) for (const o of Array.isArray(lista) ? lista : []) { sumar(o); if (Number(o?.estimated_time_to_regain_access) > 0) minutos.push(Number(o.estimated_time_to_regain_access)); }
  const cuenta = leer('x-ad-account-usage'); if (cuenta) { sumar(cuenta); if (Number(cuenta.reset_time_duration) > 0 && Number(cuenta.acc_id_util_pct) >= 100) minutos.push(Number(cuenta.reset_time_duration) / 60); }
  return { visto: Boolean(app || negocio || cuenta), pct: pcts.length ? Math.max(...pcts) : 0, recuperarMin: minutos.length ? Math.max(...minutos) : 0 };
}

/** Cuánto espaciar un sondeo según el uso: 1 normal, 2 desde el 75 %, 4 desde el 90 %. */
export const ritmoDe = pct => (pct >= 90 ? 4 : pct >= UMBRAL_ESPACIAR ? 2 : 1);

/** Los de `necesarios` que no están en lo concedido (vacío si no se sabe). */
export const permisosQueFaltan = (concedidos, necesarios = PERMISOS_LECTURA) => (Array.isArray(concedidos) ? necesarios.filter(p => !concedidos.includes(p)) : []);

export class ErrorMeta extends Error {
  constructor(error = {}, estado = 0) {
    super(error?.message || `Meta respondió ${estado}`);
    this.name = 'ErrorMeta';
    this.estado = estado;
    this.codigo = Number(error?.code ?? 0);
    this.subcodigo = Number(error?.error_subcode ?? 0);
    this.titulo = error?.error_user_title || '';
    this.detalle = error?.error_user_msg || '';
    // Saturación, límites de uso o fallos de Meta: se reintenta. Lo demás (permisos, formato) no se arregla solo.
    this.transitorio = Boolean(error?.is_transient) || [1, 2, 4, 17, 32, 341, 613, 9004].includes(this.codigo) || [2207052, 2207003, 2207042].includes(this.subcodigo) || estado >= 500;
  }
}

/** Lo que se le enseña al dueño, en español y con qué hacer. */
export function mensajeMeta(e) {
  if (!(e instanceof ErrorMeta)) return e?.message || 'No se pudo completar la operación con Meta.';
  if (e.codigo === 190) return 'El token de Meta caducó, se revocó o no es válido. Genera uno nuevo en Business Manager → Usuarios del sistema y ponlo en la variable META_ACCESS_TOKEN.';
  if (e.subcodigo === 2207042 || e.codigo === 9) return 'Instagram llegó a su límite de publicaciones por API en 24 horas (Meta lo dice en content_publishing_limit; suele ser 100). Se reintentará más tarde.';
  if (e.subcodigo === 2207051) return 'Instagram bloqueó la acción porque le pareció spam o actividad restringida. Espera unas horas antes de volver a publicar por API.';
  if (e.subcodigo === 2207026) return 'Instagram no acepta ese video: tiene que ser MP4 o MOV (H.264 y AAC), de 3 segundos a 15 minutos.';
  if (e.subcodigo === 2207052 || e.codigo === 9004) return 'Instagram no pudo bajar el archivo. Si es una imagen, Meta no la dejó leer desde Facebook: cuéntaselo a Claude Code con este mensaje.';
  if ([2207006, 2207020, 2207032, 2207053].includes(e.subcodigo)) return 'Instagram ya no puede usar lo que se le preparó (caducó o falló la subida). Se prepara de nuevo en el próximo intento.';
  if (e.codigo === 10 || (e.codigo >= 200 && e.codigo < 300)) {
    return `Meta no dio permiso: ${e.detalle || e.message}. Revisa que el usuario del sistema tenga asignada esta página y su Instagram, con los permisos que pide la oficina.`;
  }
  if (e.codigo === 100) return `Meta no aceptó la petición: ${e.detalle || e.message}`;
  if (e.transitorio) return 'Meta está saturado o limitó las peticiones. Se reintentará en unos minutos.';
  return `Meta respondió: ${e.detalle || e.message}`;
}

const CAMPOS_PAGINA = 'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}';
const escribirJSON = (f, datos) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(datos, null, 1)); renombrar(f + '.tmp', f); };
const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };

/**
 * El cliente. Todo lo que depende del mundo (variables de entorno, red, reloj, dónde guardar) se inyecta, para que los tests
 * le den un Graph de mentira y una carpeta temporal.
 */
export function crearMeta({ env = process.env, fetchFn = (...a) => fetch(...a), dir, ahora = () => Date.now() } = {}) {
  const tokenUsuario = () => String(env.META_ACCESS_TOKEN || '').trim();
  const secreto = () => String(env.META_APP_SECRET || '').trim();
  const host = () => String(env.META_GRAPH_HOST || '').trim().replace(/\/+$/, '') || HOST_GRAPH;
  const base = () => `${host()}/${String(env.META_GRAPH_VERSION || '').trim() || VERSION_GRAPH}`;
  const archivo = path.join(dir || '.', 'cuentas.json');
  const tokensPagina = new Map(); // paginaId → token de la página: solo en memoria

  /** El token nunca sale en un texto: ni el de usuario ni los de página. */
  const sinToken = texto => {
    let t = String(texto ?? '');
    for (const k of [tokenUsuario(), ...tokensPagina.values()]) if (k && k.length > 8) t = t.split(k).join('…');
    return t;
  };

  // El freno: compartido por publicar, Analíticas, Anuncios y la Bandeja, porque todos gastan la misma cuota.
  const freno = { pct: 0, hasta: 0, vistoAt: null, motivo: '' };
  /**
   * Toda llamada a Meta pasa por aquí. Si Meta pidió esperar, ni se intenta: se contesta como un fallo pasajero (quien llama ya
   * sabe reintentar), sin gastar cuota y sin alargar el castigo.
   */
  async function pedir(url, init) {
    if (ahora() < freno.hasta) {
      const min = Math.max(1, Math.ceil((freno.hasta - ahora()) / 60e3));
      throw Object.assign(new ErrorMeta({ message: `Meta pidió esperar por el límite de uso: se vuelve a intentar en ${min} min.`, is_transient: true, code: 17 }, 429), { frenado: true });
    }
    const res = await fetchFn(url, init);
    const uso = leerUso(res.headers);
    if (uso.visto) { freno.pct = uso.pct; freno.vistoAt = ahora(); }
    let codigo = 0;
    if (!res.ok) { try { codigo = Number((await res.clone().json())?.error?.code ?? 0); } catch { /* sin cuerpo */ } }
    if (CODIGOS_LIMITE.includes(codigo) || uso.pct >= 100) {
      const min = uso.recuperarMin > 0 ? uso.recuperarMin : ESPERA_LIMITE_MIN;
      freno.hasta = Math.max(freno.hasta, ahora() + min * 60e3);
      freno.motivo = codigo ? `código ${codigo}` : `uso al ${Math.round(uso.pct)} %`;
    }
    return res;
  }
  /** Lo que se sabe del uso: para espaciar los sondeos (`ritmo`) y para Estado. */
  const uso = () => ({ pct: freno.pct, ritmo: ritmoDe(freno.pct), frenadoHasta: freno.hasta > ahora() ? new Date(freno.hasta).toJSON() : null, motivo: freno.hasta > ahora() ? freno.motivo : '', vistoAt: freno.vistoAt ? new Date(freno.vistoAt).toJSON() : null });

  /** Una llamada a la Graph API. Los parámetros van en la dirección (GET); el token, como parámetro, nunca en un registro. */
  async function graph(token, ruta, { params = {}, host = null } = {}) {
    const u = new URL(`${host ?? base()}${ruta}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    if (token) {
      u.searchParams.set('access_token', token);
      if (secreto()) u.searchParams.set('appsecret_proof', crypto.createHmac('sha256', secreto()).update(token).digest('hex'));
    }
    let res;
    try { res = await pedir(u, { method: 'GET' }); }
    catch (e) { if (e?.frenado) throw e; throw new ErrorMeta({ message: sinToken(`No se pudo contactar con Meta (${e?.message || e})`), is_transient: true }, 0); }
    const datos = await res.json().catch(() => ({}));
    if (!res.ok || datos?.error) throw new ErrorMeta({ ...(datos?.error ?? {}), message: sinToken(datos?.error?.message) }, res.status);
    return datos;
  }

  // ---- F3 (8 oct 2026): escribir. El token va en la cabecera (Bearer para Graph, OAuth para rupload), nunca en la dirección ni en un error.
  const hostVideo = () => String(env.META_GRAPH_HOST || '').trim().replace(/\/+$/, '') || 'https://graph-video.facebook.com'; // los videos de Facebook se suben aquí
  const hostRupload = () => String(env.META_RUPLOAD_HOST || '').trim().replace(/\/+$/, '') || 'https://rupload.facebook.com';
  const prueba = token => (secreto() ? crypto.createHmac('sha256', secreto()).update(token).digest('hex') : '');
  async function respuestaDe(res) {
    const datos = await res.json().catch(() => ({}));
    if (!res.ok || datos?.error) throw new ErrorMeta({ ...(datos?.error ?? {}), message: sinToken(datos?.error?.message || `Meta respondió ${res.status}`) }, res.status);
    return datos;
  }
  /**
   * POST a la Graph API. `campos` va como formulario (un arreglo u objeto, en JSON, como lo lee Graph); con `archivo`
   * ({ datos: Buffer, nombre, tipo }), como multipart con el archivo en `source`. `video: true` lo manda a graph-video.
   */
  async function enviar(token, ruta, { campos = {}, archivo = null, video = false } = {}) {
    const u = new URL(`${video ? hostVideo() : host()}/${String(env.META_GRAPH_VERSION || '').trim() || VERSION_GRAPH}${ruta}`);
    const pares = Object.entries(campos).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    if (prueba(token)) pares.push(['appsecret_proof', prueba(token)]);
    let cuerpo;
    if (archivo) { cuerpo = new FormData(); for (const [k, v] of pares) cuerpo.append(k, v); cuerpo.append('source', new Blob([archivo.datos], { type: archivo.tipo || 'application/octet-stream' }), archivo.nombre || 'archivo'); }
    else cuerpo = new URLSearchParams(pares);
    let res;
    try { res = await pedir(u, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: cuerpo }); }
    catch (e) { if (e?.frenado) throw e; throw new ErrorMeta({ message: sinToken(`No se pudo contactar con Meta (${e?.message || e})`), is_transient: true }, 0); }
    return respuestaDe(res);
  }
  /** DELETE de un objeto (una publicación programada, una foto temporal). Un error NO se da por borrado: Meta dice lo mismo («does not
   *  exist, cannot be loaded due to missing permissions») cuando falta un permiso, y una programada que sigue viva saldría igual. */
  async function borrar(token, id) {
    const u = new URL(`${base()}/${encodeURIComponent(id)}`); if (prueba(token)) u.searchParams.set('appsecret_proof', prueba(token));
    let res;
    try { res = await pedir(u, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }); }
    catch (e) { if (e?.frenado) throw e; throw new ErrorMeta({ message: sinToken(`No se pudo contactar con Meta (${e?.message || e})`), is_transient: true }, 0); }
    await respuestaDe(res); return true;
  }
  /**
   * La subida reanudable de Instagram (videos): los bytes van a rupload.facebook.com/ig-api-upload/<versión>/<contenedor> con
   * `Authorization: OAuth <token>`, `offset: 0` y `file_size`. Solo vale un `{ "success": true }` (ig-publish lo observó: otra respuesta
   * es que no se aceptó). Solo se sube a ese host; una dirección que Meta devuelva de otro sitio se rechaza.
   */
  async function subirReanudable(token, contenedor, datos, uri = '') {
    const propia = `${hostRupload()}/ig-api-upload/${String(env.META_GRAPH_VERSION || '').trim() || VERSION_GRAPH}/${encodeURIComponent(contenedor)}`;
    const destino = uri && String(uri).startsWith(`${hostRupload()}/ig-api-upload/`) ? String(uri) : propia;
    let res;
    try { res = await pedir(destino, { method: 'POST', headers: { authorization: `OAuth ${token}`, offset: '0', file_size: String(datos.length), 'content-type': 'application/octet-stream' }, body: datos }); }
    catch (e) { if (e?.frenado) throw e; throw new ErrorMeta({ message: sinToken(`No se pudo subir el video a Instagram (${e?.message || e})`), is_transient: true }, 0); }
    const r = await res.json().catch(() => null);
    if (!res.ok || r?.error || r?.success !== true) throw new ErrorMeta({ ...(r?.error ?? {}), message: sinToken(r?.error?.message || r?.debug_info?.message || 'Instagram no confirmó la subida del video'), is_transient: res.status >= 500 }, res.status);
    return true;
  }

  /** Todas las páginas que el token ve, de resultado en resultado. Una dirección «siguiente» solo se sigue si es de Graph. */
  async function paginas() {
    const salida = [];
    let datos = await graph(tokenUsuario(), '/me/accounts', { params: { fields: CAMPOS_PAGINA, limit: 100 } });
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      salida.push(...(datos?.data ?? []));
      const siguiente = datos?.paging?.next;
      if (!siguiente || !String(siguiente).startsWith(`${host()}/`)) break;
      const res = await pedir(siguiente);
      datos = await res.json().catch(() => ({}));
      if (datos?.error) throw new ErrorMeta({ ...datos.error, message: sinToken(datos.error.message) }, res.status);
    }
    return salida;
  }

  /**
   * Qué es este token y qué puede: su tipo, cuándo caduca y los permisos que lleva DE VERDAD. `/debug_token` lo dice todo; si no
   * contesta, `/me/permissions`. null en `permisos` = «Meta no lo dijo», que no es lo mismo que «no tiene ninguno».
   */
  async function inspeccionar() {
    const t = tokenUsuario();
    try {
      const r = (await graph(t, '/debug_token', { params: { input_token: t } }))?.data;
      if (r) return { valido: r.is_valid !== false, tipo: r.type || null, caduca: r.expires_at ? new Date(r.expires_at * 1000).toJSON() : null, permisos: Array.isArray(r.scopes) ? r.scopes : null };
    } catch (e) { if (e.codigo === 190) throw e; }
    try {
      const r = await graph(t, '/me/permissions');
      return { valido: true, tipo: null, caduca: null, permisos: (r?.data ?? []).filter(p => p.status === 'granted').map(p => p.permission) };
    } catch (e) { if (e.codigo === 190) throw e; return { valido: true, tipo: null, caduca: null, permisos: null }; }
  }

  const aCuentas = lista => {
    const salida = [];
    for (const p of lista) {
      if (!p?.id) continue;
      if (p.access_token) tokensPagina.set(String(p.id), String(p.access_token));
      salida.push({ id: `facebook:${p.id}`, red: 'facebook', externoId: String(p.id), paginaId: String(p.id), nombre: p.name || `Página ${p.id}`, foto: p.picture?.data?.url || '' });
      const ig = p.instagram_business_account;
      if (ig?.id) salida.push({ id: `instagram:${ig.id}`, red: 'instagram', externoId: String(ig.id), paginaId: String(p.id), nombre: ig.name || ig.username || `Instagram ${ig.id}`, usuario: ig.username || '', foto: ig.profile_picture_url || '' });
    }
    return salida;
  }

  const guardado = () => leerJSON(archivo, { cuentas: [], token: null, sincronizadaAt: null, error: null });

  /** El estado que se enseña: nunca lleva un token. */
  function estado() {
    const g = guardado();
    return { configurado: Boolean(tokenUsuario()), secreto: Boolean(secreto()), permisos: PERMISOS_POR_FUNCION, version: String(env.META_GRAPH_VERSION || '').trim() || VERSION_GRAPH, uso: uso(), cuentas: g.cuentas || [], token: g.token || null, sincronizadaAt: g.sincronizadaAt || null, error: g.error || null };
  }

  /** Verifica el token y lista las cuentas: lo que hace «Comprobar conexión». Guarda el resultado (sin tokens) o el motivo del fallo. */
  async function sincronizar() {
    if (!tokenUsuario()) return { ...estado(), error: 'Falta la variable META_ACCESS_TOKEN.' };
    const previo = guardado();
    try {
      const token = await inspeccionar();
      const cuentas = aCuentas(await paginas());
      const faltan = permisosQueFaltan(token.permisos), faltanPor = faltanPorFuncion(token.permisos);
      const sinCuentas = cuentas.length ? null : 'El token no ve ninguna página. En Business Manager, asígnale al usuario del sistema las páginas de PanaClaw (con acceso a su Instagram).';
      escribirJSON(archivo, { cuentas, token: { ...token, faltan, faltanPor, verificadoAt: new Date(ahora()).toJSON() }, sincronizadaAt: new Date(ahora()).toJSON(), error: sinCuentas });
    } catch (e) {
      // Un fallo no borra lo que ya se sabía: se apunta el motivo y las cuentas de antes siguen ahí.
      escribirJSON(archivo, { ...previo, error: mensajeMeta(e), sincronizadaAt: new Date(ahora()).toJSON() });
    }
    return estado();
  }

  /** El token con el que se lee una cuenta: el de su página si se sabe (Facebook lo pide), y si no, el de usuario. */
  async function tokenDe(cuenta) {
    const pid = cuenta?.paginaId;
    if (pid && tokensPagina.has(pid)) return tokensPagina.get(pid);
    if (pid) {
      try { const r = await graph(tokenUsuario(), `/${pid}`, { params: { fields: 'access_token' } }); if (r?.access_token) { tokensPagina.set(pid, String(r.access_token)); return String(r.access_token); } } catch { /* se lee con el de usuario */ }
    }
    return tokenUsuario();
  }

  return { configurado: () => Boolean(tokenUsuario()), graph, enviar, borrar, subirReanudable, tokenDe, estado, sincronizar, sinToken, uso };
}

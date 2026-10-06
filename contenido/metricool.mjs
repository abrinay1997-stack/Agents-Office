// ============================================================
// Agents Office (6 oct 2026, plan M0 de docs/analisis-metricool-cli-2026-10-06.md) — el cliente de la API REST de METRICOOL.
//
// Metricool es el «conductor» que publica: la oficina decide (piezas, aprobación del dueño, cola) y le entrega lo aprobado con su
// fecha y su hora; Metricool lo publica desde sus servidores, con esta computadora apagada, en hasta nueve redes.
//
// DE DÓNDE SALE LA FORMA DE LA API (no hay acceso a help.metricool.com desde donde se escribió):
//   · el MCP OFICIAL de Metricool (PyPI `mcp-metricool` 1.1.0, server.py): base `https://app.metricool.com/api`, la key SOLO en la cabecera
//     `X-Mc-Auth`, `userId` y `blogId` en la dirección, `POST /v2/scheduler/posts` y `PUT /v2/scheduler/posts/{id}` con su cuerpo
//     (`providers: [{ network }]`, `publicationDate: { dateTime, timezone }`, `draft`, `autoPublish`, `media`, `firstCommentText` y los
//     datos de cada red), `GET /v2/scheduler/besttimes/{red}`, `GET /v2/settings/brands`, `GET /v2/analytics/posts|reels/{red}`;
//   · metricool-cli (Purple-Horizons, MIT, commit 5fd93d1), que no es oficial: `GET` y `DELETE /v2/scheduler/posts`, la subida por
//     `PUT /v2/media/s3/upload-transactions`, `GET /actions/normalize/image/url` y la bandeja (`/v2/inbox/*`, `provider` en mayúsculas).
//   Lo que viene solo del CLI o se deduce está marcado «por verificar»: `node scripts/check-metricool.mjs` lo comprueba con la key real.
//
// LA KEY
//   · `METRICOOL_USER_TOKEN` y `METRICOOL_USER_ID` (y opcional `METRICOOL_BLOG_ID`, la marca) — variables de entorno de Windows. La key NUNCA
//     va en la dirección (el CLI la ponía también ahí: se filtra en registros) ni en un archivo, un aviso o un error: `sinToken()` la quita.
//   · La API es del plan Advanced de Metricool. Un 401/403 lo dice en palabras.
//   · `METRICOOL_API_BASE` (solo para pruebas) apunta a un Metricool de mentira (tests/metricool-stand.mjs).
//
//   cuerpoPost(...) · redMetricool(red) · estadoDeProveedor(s) · fechaLocal(ms) · mensajeMetricool(e)   → puros, con tests
//   crearMetricool({ env, fetchFn, ahora })                                                            → el cliente
// Cubierto por tests/metricool.test.mjs.
// ============================================================

export const BASE = 'https://app.metricool.com/api';
export const ORIGEN = 'AgentsOffice'; // `integrationSource`: el MCP oficial manda el suyo; Metricool sabe así quién llama

/** Las redes de la oficina → su nombre en Metricool. X se llama «twitter» en la API. */
export const RED_METRICOOL = Object.freeze({ instagram: 'instagram', facebook: 'facebook', linkedin: 'linkedin', x: 'twitter', tiktok: 'tiktok', threads: 'threads', bluesky: 'bluesky', pinterest: 'pinterest', youtube: 'youtube' });
export const redMetricool = red => RED_METRICOOL[red] || null;
export const redDeMetricool = n => Object.keys(RED_METRICOOL).find(k => RED_METRICOOL[k] === String(n || '').toLowerCase()) || null;
/** Las redes para las que Metricool calcula la mejor hora (MCP oficial: «Only these are accepted»). */
export const CON_MEJOR_HORA = Object.freeze(['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube']);

export class ErrorMetricool extends Error {
  constructor(message, estado = 0, detalle = '') {
    super(message);
    this.name = 'ErrorMetricool';
    this.estado = estado;
    this.detalle = detalle;
    this.transitorio = estado === 0 || estado === 429 || estado >= 500;
  }
}

/** Lo que se le enseña al dueño: en español y con qué hacer. */
export function mensajeMetricool(e) {
  if (!(e instanceof ErrorMetricool)) return e?.message || 'No se pudo completar la operación con Metricool.';
  if (e.estado === 401) return 'Metricool no reconoce la key: revisa METRICOOL_USER_TOKEN y METRICOOL_USER_ID (Metricool → Ajustes de la cuenta → API).';
  if (e.estado === 403) return 'Metricool no deja usar la API con esta cuenta o esta marca: la API es del plan Advanced, y la marca (METRICOOL_BLOG_ID) tiene que ser tuya.';
  if (e.estado === 404) return `Metricool no encuentra eso${e.detalle ? `: ${e.detalle}` : ''}. Si es una publicación, quizá ya se borró allí.`;
  if (e.estado === 429) return 'Metricool limitó las peticiones por un rato. Se reintentará sola.';
  if (e.estado === 0) return `No se pudo contactar con Metricool (${e.detalle || 'sin conexión'}). Se reintentará.`;
  if (e.estado >= 500) return 'Metricool está fallando ahora mismo. Se reintentará en unos minutos.';
  if (e.estado === 400) return `Metricool no aceptó la petición${e.detalle ? `: ${e.detalle}` : ''}.`;
  return `Metricool respondió ${e.estado}${e.detalle ? `: ${e.detalle}` : ''}.`;
}

const pad = n => String(n).padStart(2, '0');
/** Un instante → «AAAA-MM-DDTHH:mm:ss» en el reloj de la zona dada (por defecto, la de esta máquina). Metricool recibe la hora TAL CUAL + la zona: sin pasar a UTC. */
export function fechaLocal(ms, zona = '') {
  const d = new Date(ms);
  if (!zona) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
export const zonaDeEstaMaquina = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

/** El estado de una red en una publicación de Metricool → el de la oficina. */
export function estadoDeProveedor(s) {
  const x = String(s || '').toUpperCase();
  if (x === 'PUBLISHED') return 'publicada';
  if (x === 'ERROR' || x === 'FAILED' || x === 'REJECTED') return 'fallo';
  return 'en_red'; // PENDING, SCHEDULED, DRAFT…: todavía no salió
}

/** El tipo de publicación de Instagram (y Facebook) en Metricool: POST (también carrusel), REEL o STORY (metricool-cli `--instagram-type`). */
const tipoMeta = formato => (formato === 'reel' ? 'REEL' : formato === 'historia' ? 'STORY' : 'POST');

/**
 * El cuerpo de `POST /v2/scheduler/posts` para unas redes de una pieza (puro). `entrega` es lo que el conductor ya resolvió:
 *   { redes: ['instagram', 'linkedin'], texto, comentario, medios: [urls públicas], momento (ms), zona, formato, extras: { youtube, pinterest, tiktok, colaboradores } }
 * Los datos de cada red van SOLO para las redes que están (así lo pide el MCP oficial), y vacíos si no hay más información.
 */
export function cuerpoPost(entrega, { borrador = false } = {}) {
  const e = entrega || {}, redes = (e.redes || []).filter(r => RED_METRICOOL[r]), x = e.extras || {};
  const body = {
    text: String(e.texto ?? ''),
    providers: redes.map(r => ({ network: RED_METRICOOL[r] })),
    publicationDate: { dateTime: fechaLocal(e.momento, e.zona), timezone: e.zona || zonaDeEstaMaquina() },
    draft: !!borrador,
    autoPublish: !borrador, // solo lo aprobado y entregado se publica solo; un borrador queda quieto en Metricool
    media: (e.medios || []).filter(Boolean),
    mediaAltText: (e.medios || []).map(() => ''),
    firstCommentText: String(e.comentario ?? ''),
    shortener: false,
    smartLinkData: { ids: [] },
  };
  for (const r of redes) {
    if (r === 'instagram') body.instagramData = { autoPublish: !borrador, type: tipoMeta(e.formato), tags: [], ...(x.colaboradores?.length ? { collaborators: x.colaboradores.map(u => ({ username: u })) } : {}) };
    if (r === 'facebook') body.facebookData = { type: tipoMeta(e.formato) }; // por verificar: el MCP solo enseña `type: <string>`
    if (r === 'linkedin') body.linkedinData = {};
    if (r === 'x') body.twitterData = { tags: [] };
    if (r === 'threads') body.threadsData = {};
    if (r === 'bluesky') body.blueskyData = { postLanguages: [x.idioma || 'es'] };
    if (r === 'tiktok') body.tiktokData = { privacyOption: x.tiktok?.privacidad || 'PUBLIC_TO_EVERYONE', disableComment: false, disableDuet: false, disableStitch: false, ...(x.tiktok?.titulo ? { title: x.tiktok.titulo } : {}) }; // por verificar: los valores de privacyOption
    if (r === 'pinterest') body.pinterestData = { boardId: String(x.pinterest?.tablero || ''), pinTitle: String(x.pinterest?.titulo || ''), pinLink: String(x.pinterest?.enlace || ''), pinNewFormat: true };
    if (r === 'youtube') body.youtubeData = { title: String(x.youtube?.titulo || ''), type: e.formato === 'reel' ? 'short' : 'video', privacy: x.youtube?.privacidad || 'public', tags: [], madeForKids: !!x.youtube?.paraNinos }; // por verificar: los valores de type
  }
  return body;
}

/** Lo que interesa de una publicación de Metricool: su id, su uuid y el estado de cada red. */
export function resumenPost(p) {
  const x = p?.data && !Array.isArray(p.data) ? p.data : p || {};
  return {
    id: x.id != null ? String(x.id) : '', uuid: x.uuid ? String(x.uuid) : '',
    momento: x.publicationDate?.dateTime || '', zona: x.publicationDate?.timezone || '', borrador: !!x.draft,
    redes: (x.providers || []).map(pr => ({ red: redDeMetricool(pr.network) || String(pr.network || ''), estado: estadoDeProveedor(pr.status), url: pr.publicUrl || '', detalle: pr.detailedStatus || '' })),
  };
}

/** Las marcas, en la forma de la oficina. El nombre exacto de los campos no está documentado en lo leído: se toman los que estén. */
export function resumenMarca(b = {}) {
  return { id: String(b.id ?? b.blogId ?? ''), nombre: String(b.label ?? b.title ?? b.name ?? b.brandName ?? `Marca ${b.id ?? ''}`), zona: String(b.timezone ?? b.timeZone ?? ''), redes: Object.keys(RED_METRICOOL).filter(r => b[RED_METRICOOL[r]] || b[`${RED_METRICOOL[r]}Account`] || (Array.isArray(b.networks) && b.networks.map(String).map(s => s.toLowerCase()).includes(RED_METRICOOL[r]))) };
}

/**
 * El cliente. Todo lo que toca el mundo (variables de entorno, red, reloj) se inyecta, para que los tests le den un Metricool de mentira.
 */
export function crearMetricool({ env = process.env, fetchFn = (...a) => fetch(...a), ahora = () => Date.now(), timeoutMs = 30000 } = {}) {
  const token = () => String(env.METRICOOL_USER_TOKEN || '').trim();
  const usuario = () => String(env.METRICOOL_USER_ID || '').trim();
  const base = () => String(env.METRICOOL_API_BASE || '').trim().replace(/\/+$/, '') || BASE;
  let marcaElegida = String(env.METRICOOL_BLOG_ID || '').trim(), marcasCache = null, marcasAt = 0;

  const sinToken = texto => { let t = String(texto ?? ''); const k = token(); if (k && k.length > 6) t = t.split(k).join('…'); return t; };
  const configurado = () => Boolean(token() && usuario());

  /** Una llamada. La key va en la cabecera; `userId`, `blogId` e `integrationSource` en la dirección, como hace el MCP oficial. */
  async function api(method, ruta, { query = {}, body, marca = true, crudo = false } = {}) {
    if (!configurado()) throw new ErrorMetricool('Faltan METRICOOL_USER_TOKEN y METRICOOL_USER_ID.', 401);
    const u = new URL(base() + ruta);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    u.searchParams.set('userId', usuario());
    if (marca) { const b = await idMarca(); if (b) u.searchParams.set('blogId', b); }
    u.searchParams.set('integrationSource', ORIGEN);
    let res;
    try {
      res = await fetchFn(u, { method, headers: { 'X-Mc-Auth': token(), accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) { throw new ErrorMetricool(sinToken(`No se pudo contactar con Metricool: ${e?.message || e}`), 0, sinToken(e?.message || '')); }
    const texto = await res.text().catch(() => '');
    if (!res.ok) {
      let detalle = texto.slice(0, 300); try { const j = JSON.parse(texto); detalle = j?.message || j?.error || j?.detail || detalle; } catch {}
      const err = new ErrorMetricool(`Metricool respondió ${res.status}`, res.status, sinToken(String(detalle)));
      err.message = mensajeMetricool(err); throw err;
    }
    if (crudo) return texto;
    try { return texto ? JSON.parse(texto) : null; } catch { return texto; }
  }

  /** Las marcas de la cuenta (cacheadas 10 minutos). */
  async function marcas({ fresco = false } = {}) {
    if (!fresco && marcasCache && ahora() - marcasAt < 600e3) return marcasCache;
    const r = await api('GET', '/v2/settings/brands', { marca: false });
    const lista = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
    marcasCache = lista.map(resumenMarca).filter(m => m.id); marcasAt = ahora();
    return marcasCache;
  }
  /** La marca con la que se publica: METRICOOL_BLOG_ID, o la primera de la cuenta. */
  async function idMarca() {
    if (marcaElegida) return marcaElegida;
    const m = await marcas().catch(() => []);
    return m[0]?.id || '';
  }
  async function marca() { const id = await idMarca(); const m = (await marcas().catch(() => [])).find(x => x.id === id); return m || (id ? { id, nombre: `Marca ${id}`, zona: '', redes: [] } : null); }

  /** Programar (o dejar como borrador) una publicación. → { id, uuid, redes } */
  async function programar(body) { return resumenPost(await api('POST', '/v2/scheduler/posts', { body })); }
  /** Cambiar una publicación ya entregada (el MCP oficial pide `id` y `uuid` en el cuerpo). */
  async function cambiar(id, uuid, body) { return resumenPost(await api('PUT', `/v2/scheduler/posts/${encodeURIComponent(id)}`, { body: { ...body, id: Number(id) || id, ...(uuid ? { uuid } : {}) } })); }
  /** Quitarla de Metricool (por verificar: solo el CLI lo usa). */
  async function borrar(id) { await api('DELETE', `/v2/scheduler/posts/${encodeURIComponent(id)}`); return true; }
  /** Las publicaciones entre dos instantes. */
  async function listar(desdeMs, hastaMs, zona = '') {
    const z = zona || zonaDeEstaMaquina();
    const r = await api('GET', '/v2/scheduler/posts', { query: { start: fechaLocal(desdeMs, zona), end: fechaLocal(hastaMs, zona), timezone: z } });
    return (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []).map(resumenPost);
  }
  /** El estado de UNA publicación: se busca en el día de su hora (no hay un GET por id en lo leído). */
  async function estado(id, momentoMs, zona = '') {
    const lista = await listar(momentoMs - 864e5, momentoMs + 864e5, zona);
    return lista.find(p => p.id === String(id)) || null;
  }
  /** La mejor hora para una red entre dos días: [{ dia (0 = domingo), hora, valor }] cuando Metricool lo da en esa forma. */
  async function mejoresHoras(red, desde, hasta, zona = '') {
    const n = redMetricool(red); if (!n || !CON_MEJOR_HORA.includes(red)) return [];
    const r = await api('GET', `/v2/scheduler/besttimes/${n}`, { query: { start: `${desde}T00:00:00`, end: `${hasta}T23:59:59`, timezone: zona || zonaDeEstaMaquina() } });
    return normalizarMejoresHoras(r);
  }
  /** Sube un archivo de esta máquina y devuelve su dirección pública en Metricool (por verificar: forma de la transacción, del CLI). */
  async function subirArchivo({ datos, nombre, tipo }) {
    const t = await api('PUT', '/v2/media/s3/upload-transactions', { body: { filename: nombre, contentType: tipo, size: datos.length } });
    const tx = t?.data && !Array.isArray(t.data) ? t.data : t || {};
    const firmada = tx.presignedUrl || tx.uploadUrl || tx.signedUrl || tx.putUrl || tx.url;
    if (!firmada || !/^https?:\/\//.test(String(firmada))) throw new ErrorMetricool('Metricool no devolvió a dónde subir el archivo.', 502, JSON.stringify(Object.keys(tx)).slice(0, 120));
    let res; try { res = await fetchFn(firmada, { method: 'PUT', headers: { 'content-type': tipo }, body: datos, signal: AbortSignal.timeout(120000) }); }
    catch (e) { throw new ErrorMetricool(`No se pudo subir el archivo: ${e?.message || e}`, 0); }
    if (!res.ok) throw new ErrorMetricool(`El almacén de Metricool no aceptó el archivo (${res.status}).`, res.status);
    return String(tx.fileUrl || tx.publicUrl || tx.mediaUrl || tx.location || String(firmada).split('?')[0]);
  }
  /** Una imagen de fuera → una copia alojada en Metricool. */
  async function normalizar(url) { const r = await api('GET', '/actions/normalize/image/url', { query: { url } }); return typeof r === 'string' ? r.replace(/^"|"$/g, '') : String(r?.url || r?.data || ''); }
  /** El rendimiento de las publicaciones de una red (para Analíticas y la hora sugerida). */
  async function analiticas(red, desde, hasta, { tipo = 'posts', zona = '' } = {}) {
    const n = redMetricool(red); if (!n) return [];
    const r = await api('GET', `/v2/analytics/${tipo}/${n}`, { query: { from: `${desde}T00:00:00`, to: `${hasta}T23:59:59`, timezone: zona || zonaDeEstaMaquina() } });
    return Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
  }
  /* ----- la bandeja (por verificar: rutas del CLI; `provider` va en mayúsculas) ----- */
  async function bandeja(tipo, { red = '', estado: est = '' } = {}) {
    const ruta = { conversaciones: '/v2/inbox/conversations', comentarios: '/v2/inbox/post-comments', resenas: '/v2/inbox/reviews' }[tipo];
    if (!ruta) return [];
    const r = await api('GET', ruta, { query: { provider: red ? String(redMetricool(red) || red).toUpperCase() : '', status: est } });
    return Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
  }
  async function responder(tipo, id, mensaje) {
    if (tipo === 'conversaciones') return api('POST', '/v2/inbox/conversations', { body: { conversationId: id, message: mensaje } });
    if (tipo === 'comentarios') return api('POST', '/v2/inbox/post-comments', { body: { commentId: id, message: mensaje } });
    if (tipo === 'resenas') return api('POST', '/v2/inbox/reviews', { body: { reviewId: id, message: mensaje } });
    throw new ErrorMetricool('No sé responder a eso.', 400);
  }

  return {
    configurado, sinToken, api, marcas, marca, idMarca, elegirMarca: id => { marcaElegida = String(id || ''); },
    programar, cambiar, borrar, listar, estado, mejoresHoras, subirArchivo, normalizar, analiticas, bandeja, responder,
  };
}

/**
 * Las mejores horas de Metricool → [{ dia (0 domingo … 6 sábado), hora (0–23), valor }]. La forma exacta no está en lo leído («una lista
 * de horas y días con un valor»), así que se aceptan las formas razonables: [{ day, hour, value }], [{ dateTime, value }] o { lunes: { 9: v } }.
 */
export function normalizarMejoresHoras(r) {
  const out = [], DIAS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const lista = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : null;
  const dia = d => (typeof d === 'number' ? d % 7 : DIAS[String(d || '').toLowerCase()] ?? (Number.isFinite(+d) ? +d % 7 : null));
  if (lista) {
    for (const x of lista) {
      const v = Number(x.value ?? x.score ?? x.weight ?? x.count ?? 0);
      if (x.dateTime || x.date) { const d = new Date(String(x.dateTime || x.date).slice(0, 19)); if (!Number.isNaN(d.getTime())) out.push({ dia: d.getDay(), hora: d.getHours(), valor: v }); continue; }
      const dd = dia(x.day ?? x.dayOfWeek ?? x.weekday), h = Number(x.hour ?? x.hourOfDay);
      if (dd !== null && dd !== undefined && Number.isFinite(h)) out.push({ dia: dd, hora: h % 24, valor: v });
    }
  } else if (r && typeof r === 'object') {
    for (const [d, horas] of Object.entries(r)) { const dd = dia(d); if (dd === null || dd === undefined || !horas || typeof horas !== 'object') continue; for (const [h, v] of Object.entries(horas)) if (Number.isFinite(+h)) out.push({ dia: dd, hora: +h % 24, valor: Number(v) || 0 }); }
  }
  return out.filter(x => x.valor > 0);
}

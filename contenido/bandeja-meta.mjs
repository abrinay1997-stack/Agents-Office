// Agents Office (9 oct 2026, Fase B1 de docs/plan-meta-anuncios-y-bandeja-2026-10-09.md) — la fuente META de la Bandeja: los
// COMENTARIOS de Instagram y Facebook, de lo orgánico y de los anuncios, con responder y ocultar (nunca borrar).
//
// La misma interfaz que la fuente de Metricool de contenido/bandeja.mjs: { id, listo, traer, responder, ocultar, estado }. La Bandeja no
// distingue de dónde viene un mensaje salvo por `fuente: 'meta'` (y lo que solo Meta sabe: `oculto`, `padre`, `enAnuncio`, `publicacion`).
//
// Lo VERIFICADO (§13.11 del plan, 9 oct 2026, referencias de IG Comment y su /replies):
//   · IG Comment: id, text, timestamp, username, from{id,username}, hidden, like_count, replies, parent_id, media.
//   · Responder: POST /<comentario>/replies { message } → { id }, SOLO a uno de primer nivel (a una respuesta se le responde en el de
//     arriba) y NUNCA a uno oculto ni en un directo. Ocultar: POST /<comentario> { hide: true|false } con el token del dueño de la publicación.
// Lo de FACEBOOK (developers.facebook.com, «Comment» y «/{object-id}/comments», leídas el 9 oct 2026):
//   · GET /<objeto>/comments admite `filter` (toplevel · stream), `order` (chronological · reverse_chronological) y `summary`.
//   · Publicar un comentario: POST /<objeto>/comments { message } con el token de una página con la tarea MODERATE o con
//     pages_manage_engagement. Ocultar: POST /<comentario> { is_hidden } («solo para comentarios de una página»).
//   · POR VERIFICAR: `is_hidden` y `from` como campos de LECTURA (la referencia de lectura no los lista; los datos de una persona solo
//     llegan «si lo autorizó»). Por eso: si Meta rechaza `is_hidden` (error 100), se vuelve a pedir sin él y se recuerda; y un comentario
//     sin `from` sale como «Alguien en Facebook».
//   · POR VERIFICAR: si responder a una respuesta en Facebook la cuelga del de arriba: la oficina siempre responde en el de arriba.
// Lo de los ANUNCIOS: el id de la publicación sale de la estructura que ya leyó Anuncios (data/anuncios/cuenta.json): el creativo trae
//   `effective_object_story_id` (Facebook). Para Instagram, `effective_instagram_media_id` del creativo (verificado el 9 oct 2026): se pide una vez
//   por creativo (`GET /<creativo>?fields=effective_instagram_media_id`); si Meta no conoce el campo, se deja de pedir 7 días y se dice.
//
// Todo pasa por el cliente de contenido/meta.mjs (su freno por uso, su `appsecret_proof`, `sinToken`): nunca un fetch directo.
// Estado en data/contenido/bandeja-meta.json (sin tokens): cuántos comentarios tenía cada publicación la última vez (solo se vuelven a
// leer las que cambiaron), los creativos ya mirados y el último sondeo.
import fs from 'node:fs';
import path from 'node:path';
import { mensajeMeta } from './meta.mjs';
import { refsDeAnuncio } from '../anuncios/cuentas.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

/** Versión de la atribución de cuentas (2 nov 2026): antes, un comentario de un anuncio se guardaba con la primera página/Instagram que se encontró. */
export const ATRIBUCION = 2;
export const DIAS = 30; // las publicaciones de los últimos 30 días
export const MAX_PUBLICACIONES = 25, LIMITE_COMENTARIOS = 50, MAX_ANUNCIOS = 20;
export const DIAS_RECIENTE = 3; // lo publicado hace menos de 3 días se relee siempre (el recuento de Facebook no cuenta las respuestas)
export const REINTENTO_CAMPO_DIAS = 7;
export const CAMPOS_IG_COMENTARIO = 'id,text,username,timestamp,from,hidden,like_count,parent_id';
export const CAMPOS_IG = `${CAMPOS_IG_COMENTARIO},replies{${CAMPOS_IG_COMENTARIO}}`;
const FB_BASE = 'id,message,from,created_time,comment_count,permalink_url';
export const camposFB = (conOculto = true) => `${FB_BASE}${conOculto ? ',is_hidden' : ''},comments{id,message,from,created_time${conOculto ? ',is_hidden' : ''}}`;
const VIVOS = new Set(['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'PENDING_REVIEW', 'IN_PROCESS', 'WITH_ISSUES', 'PREAPPROVED']);

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); renombrar(f + '.tmp', f); };
const txt = (v, max = 4000) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const iso = v => { const ms = Date.parse(String(v || '')); return Number.isFinite(ms) ? new Date(ms).toJSON() : null; };

/** ¿Lo escribió la propia cuenta (la página o su Instagram)? Lo propio no es un mensaje: es una respuesta nuestra. */
export function esPropio(c = {}, cuenta = {}) {
  const de = c.from || {};
  if (cuenta.red === 'instagram') return String(de.id || '') === String(cuenta.externoId) || (!!cuenta.usuario && String(c.username || de.username || '').toLowerCase() === String(cuenta.usuario).toLowerCase());
  return String(de.id || '') === String(cuenta.paginaId || cuenta.externoId);
}

/** Un comentario de Meta en la forma de la Bandeja (puro). `padre` es el id de Meta del comentario de arriba (una respuesta). */
export function mensajeDe(c = {}, { cuenta = {}, publicacion = null, padre = null, enAnuncio = null } = {}) {
  const ig = cuenta.red === 'instagram', idRemoto = String(c.id || '');
  const autor = ig ? txt(c.username || c.from?.username, 80) : txt(c.from?.name, 80);
  const cuando = iso(ig ? c.timestamp : c.created_time);
  const p = padre || (ig ? c.parent_id : c.parent?.id) || null;
  return {
    id: `meta:${idRemoto}`, fuente: 'meta', tipo: 'comentarios', idRemoto, red: ig ? 'instagram' : 'facebook', cuentaId: cuenta.id || '',
    autor: autor || (ig ? 'Alguien en Instagram' : 'Alguien en Facebook'), autorId: String(c.from?.id || ''),
    texto: txt(ig ? c.text : c.message), cuando, at: cuando,
    publicacion, enlace: publicacion?.enlace || '',
    padre: p ? `meta:${p}` : null, padreRemoto: p ? String(p) : null,
    oculto: Boolean(ig ? c.hidden : c.is_hidden), meGusta: Number.isFinite(+c.like_count) ? +c.like_count : null,
    ...(enAnuncio ? { enAnuncio } : {}),
    puntuacion: null, yaRespondida: false,
  };
}

/**
 * La lista de comentarios de una publicación → los mensajes (los de primer nivel y sus respuestas). Lo propio no entra, y si la
 * cuenta ya respondió un comentario, ese queda `yaRespondida` (respondido desde la app de Instagram o desde Facebook). Puro.
 */
export function aplanar(lista = [], ctx = {}) {
  const ig = ctx.cuenta?.red === 'instagram', out = [];
  for (const c of lista) {
    if (!c?.id) continue;
    const hijos = (ig ? c.replies?.data : c.comments?.data) || [];
    if (esPropio(c, ctx.cuenta)) continue;
    const m = mensajeDe(c, ctx); m.padre = null; m.padreRemoto = null; // los de la lista son de primer nivel
    if (hijos.some(h => esPropio(h, ctx.cuenta))) m.yaRespondida = true;
    out.push(m);
    for (const h of hijos) if (h?.id && !esPropio(h, ctx.cuenta)) out.push(mensajeDe(h, { ...ctx, padre: String(c.id) }));
  }
  return out;
}

// ---------------------------------------------------------------- Fase B2 (9 oct 2026): los MENSAJES PRIVADOS de Instagram y Messenger
// Lo VERIFICADO (§13.10 del plan, 9 oct 2026, guías «Conversations API» y «Send a message»):
//   · GET /<página>/conversations?platform=instagram|messenger → id, updated_time. Los mensajes, en
//     /<conversación>?fields=messages{id,created_time,from,to,message,…}: SOLO los 20 más recientes; las de «Solicitudes» con 30 días sin
//     actividad no llegan; lo compartido trae solo la dirección.
//   · Enviar: POST /<página>/messages { recipient: { id: IGSID|PSID }, messaging_type: 'RESPONSE', message: { text } }, el texto de menos de
//     1.000 caracteres y 1.000 bytes UTF-8 como mucho. Sin etiquetas (HUMAN_AGENT POR VERIFICAR): fuera de las 24 h no se envía.
//   · Permisos: Messenger pages_manage_metadata, pages_read_engagement, pages_messaging; Instagram instagram_basic,
//     instagram_manage_messages, pages_manage_metadata. Y el ACCESO AVANZADO para hablar con clientes (app de un negocio verificado).
// POR VERIFICAR: `participants` (no se pide: el cliente sale de from/to de los mensajes), `attachments` como campo de un mensaje (VERIFICADO el 9 oct 2026: Meta lo acepta; si un día
//   lo rechaza con error 100, se pide sin él y se recuerda), su forma (image_data/video_data/file_url), el `from` de lo que manda la cuenta
//   de Instagram (su id o su usuario), el orden en que llegan los mensajes (se ordenan aquí) y qué error da Meta sin el acceso avanzado
//   (se toma como «sin acceso» un 10, un 3, un 230 o un 200–299).
export const VENTANA_H = 24;
export const MAX_CONVERSACIONES = 25, MENSAJES_POR_CONV = 20, GUARDAR_MENSAJES = 50;
export const LIMITE_CARACTERES = 1000, LIMITE_BYTES = 1000; // menos de 1.000 caracteres y 1.000 bytes como mucho
export const REINTENTO_MENSAJES_H = 6; // sin acceso: se vuelve a probar cada 6 h (o al cambiar los permisos del token)
export const PERMISOS_DM = { messenger: ['pages_manage_metadata', 'pages_read_engagement', 'pages_messaging'], instagram: ['instagram_basic', 'instagram_manage_messages', 'pages_manage_metadata'] };
export const MOTIVO_SIN_ACCESO = 'Meta todavía no te dio el acceso avanzado para leer los mensajes de tus clientes: se pide en la Revisión de la app (docs/conectar-meta.md).';
export const camposMensajes = (conAdjuntos = true) => `messages.limit(${MENSAJES_POR_CONV}){id,created_time,from,to,message${conAdjuntos ? ',attachments' : ''}}`;
const DOMINIO_META = /(^|\.)(cdninstagram\.com|fbcdn\.net|fbsbx\.com)$/i; // POR VERIFICAR: lookaside.fbsbx.com es donde Messenger deja los adjuntos
const PLATAFORMA = { instagram: 'instagram', messenger: 'facebook' };
const sinAcceso = e => [3, 10, 230].includes(e?.codigo) || (e?.codigo >= 200 && e?.codigo < 300);

/** ¿Se puede responder todavía? Abierta si el último mensaje DEL CLIENTE es de hace menos de 24 h. Puro. */
export function ventanaDe(ultimoCliente, ahora = Date.now()) {
  const ms = Date.parse(ultimoCliente || '');
  if (!Number.isFinite(ms)) return { abierta: false, hasta: null, quedaMin: null };
  const hasta = ms + VENTANA_H * 3600e3, abierta = ahora < hasta;
  return { abierta, hasta: new Date(hasta).toJSON(), quedaMin: abierta ? Math.floor((hasta - ahora) / 60e3) : 0 };
}
const dos = n => String(n).padStart(2, '0');
/** Por qué no se puede responder (la hora de esta máquina). */
export function motivoVentana(v = {}) {
  if (!v.hasta) return 'El cliente todavía no escribió en esta conversación: Meta solo deja responder durante las 24 horas siguientes a su último mensaje.';
  const d = new Date(v.hasta);
  return `La ventana de 24 horas se cerró a las ${dos(d.getHours())}:${dos(d.getMinutes())} del ${d.getDate()}: Meta no deja responder por aquí. Si el cliente vuelve a escribir, se abre otra vez.`;
}
/** «te quedan 23 h» / «te quedan 40 min» / «la ventana se cerró». */
export function quedaTexto(v = {}) {
  if (!v.abierta) return 'la ventana de 24 h ya se cerró';
  return v.quedaMin >= 60 ? `te quedan ${Math.floor(v.quedaMin / 60)} h para responder` : `te quedan ${Math.max(1, v.quedaMin)} min para responder`;
}
/** El texto de una respuesta por mensaje privado: { ok } o { error, motivo, caracteres, bytes, sobran }. Puro. */
export function revisarTextoMensaje(texto) {
  const t = String(texto ?? '').replace(/\r\n/g, '\n').trim(), caracteres = [...t].length, bytes = Buffer.byteLength(t, 'utf8');
  if (!t) return { error: 'vacio', motivo: 'Escribe la respuesta antes de enviarla.', caracteres, bytes, sobran: 0 };
  if (caracteres >= LIMITE_CARACTERES) { const sobran = caracteres - (LIMITE_CARACTERES - 1); return { error: 'largo', motivo: `Meta acepta menos de 1.000 caracteres por mensaje y este tiene ${caracteres}: te sobran ${sobran} ${sobran === 1 ? 'carácter' : 'caracteres'}.`, caracteres, bytes, sobran }; }
  if (bytes > LIMITE_BYTES) { const sobran = Math.max(1, Math.ceil((bytes - LIMITE_BYTES) / (bytes / caracteres))); return { error: 'largo', motivo: `Meta acepta 1.000 bytes por mensaje como mucho y este ocupa ${bytes} (los acentos y los emoji ocupan más): te sobran unos ${sobran} ${sobran === 1 ? 'carácter' : 'caracteres'}.`, caracteres, bytes, sobran }; }
  return { ok: true, texto: t, caracteres, bytes };
}

/** Los adjuntos de un mensaje: solo la dirección, y solo si es de Meta (nada se descarga). POR VERIFICAR la forma. Puro. */
export function adjuntosDe(x = {}) {
  const out = [];
  const segura = u => { try { const url = new URL(String(u)); return url.protocol === 'https:' && DOMINIO_META.test(url.hostname) ? url.toString() : ''; } catch { return ''; } };
  for (const a of x.attachments?.data || []) {
    const [tipo, u] = a.image_data ? ['imagen', a.image_data.url || a.image_data.preview_url] : a.video_data ? ['video', a.video_data.url || a.video_data.preview_url] : a.file_url ? ['archivo', a.file_url] : ['otro', a.url || a.payload?.url];
    out.push({ tipo, url: segura(u) });
  }
  for (const s of x.shares?.data || []) out.push({ tipo: 'compartido', url: segura(s.link || s.url) });
  return out.slice(0, 10);
}

/** ¿Es de la cuenta (la página o su Instagram)? */
const esDeLaCuenta = (de = {}, cuenta = {}) => [cuenta.externoId, cuenta.paginaId].filter(Boolean).map(String).includes(String(de.id || '')) || (!!cuenta.usuario && String(de.username || '').toLowerCase() === String(cuenta.usuario).toLowerCase());

/** Una conversación de Meta en la forma de la Bandeja (puro): sus mensajes en orden, quién es el cliente y su ventana. null si no hay cliente. */
export function conversacionDe(conv = {}, { cuenta = {}, ahora = Date.now() } = {}) {
  const lista = (conv.messages?.data || []).filter(x => x?.id).map(x => ({ x, at: iso(x.created_time) })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  let cliente = null;
  for (const { x } of lista) { if (!esDeLaCuenta(x.from, cuenta)) { cliente = x.from || null; break; } }
  if (!cliente) for (const { x } of lista) { const t = (x.to?.data || []).find(p => !esDeLaCuenta(p, cuenta)); if (t) { cliente = t; break; } }
  if (!cliente?.id) return null;
  const mensajes = lista.map(({ x, at }) => ({ id: String(x.id), de: esDeLaCuenta(x.from, cuenta) ? 'tu' : 'cliente', texto: txt(x.message, 2000), at, adjuntos: adjuntosDe(x) }));
  const delCliente = mensajes.filter(m => m.de === 'cliente'), ultimoC = delCliente.at(-1) || null, ultimo = mensajes.at(-1) || null;
  const ig = cuenta.red === 'instagram', autor = txt(cliente.username || cliente.name, 80);
  return {
    id: `meta:conv:${conv.id}`, fuente: 'meta', tipo: 'conversaciones', idRemoto: String(conv.id), red: ig ? 'instagram' : 'facebook', cuentaId: cuenta.id || '', paginaId: String(cuenta.paginaId || ''),
    autor: autor || (ig ? 'Alguien en Instagram' : 'Alguien en Messenger'), autorId: String(cliente.id),
    texto: ultimoC ? (ultimoC.texto || (ultimoC.adjuntos.length ? `(${ultimoC.adjuntos.map(a => a.tipo).join(', ')})` : '')) : '',
    mensajes, ultimoCliente: ultimoC?.at || null, ventana: ventanaDe(ultimoC?.at, ahora), actualizado: iso(conv.updated_time) || ultimo?.at || null,
    cuando: ultimoC?.at || ultimo?.at || null, at: ultimoC?.at || ultimo?.at || null, enlace: '', publicacion: null, puntuacion: null,
    yaRespondida: Boolean(ultimo && ultimo.de === 'tu' && ultimoC && String(ultimo.at) >= String(ultimoC.at)),
  };
}

/**
 * @param {object} o.meta      el cliente de contenido/meta.mjs (graph, enviar, tokenDe, estado, configurado, uso)
 * @param {string} o.archivo   data/contenido/bandeja-meta.json
 * @param {Function} o.anuncios () → lo que Anuncios guardó en data/anuncios/cuenta.json (o null): { anuncios: [...], campanas: [...] }
 * @param {Function} o.tokenAnuncios () → el token con el que se leen los creativos (por defecto, el de usuario: el de Anuncios)
 */
export function crearFuenteMeta({ meta, archivo, anuncios = () => null, ahora = () => Date.now(), dias = DIAS } = {}) {
  const leer = () => ({ convs: {}, dm: {}, dmAt: null, adjuntos: true, ...leerJSON(archivo, { pubs: {}, creativos: {}, campoIG: null, campoIGAt: null, fbOculto: true, ultimaAt: null, error: '' }) });
  const cuentas = () => (meta?.estado?.().cuentas || []).filter(c => c.red === 'instagram' || c.red === 'facebook');
  const cuentaDe = id => cuentas().find(c => c.id === id) || null;

  function listo() {
    if (!meta?.configurado?.()) return { ok: false, motivo: 'Meta no está conectada: falta la variable META_ACCESS_TOKEN (mira docs/conectar-meta.md).' };
    if (!cuentas().length) return { ok: false, motivo: 'Meta todavía no dice qué páginas ve el token: abre Analíticas (R) → «Comprobar conexión».' };
    const p = meta.estado()?.token?.permisos;
    if (Array.isArray(p) && !p.includes('pages_read_engagement')) return { ok: false, motivo: 'Al token le falta pages_read_engagement: sin él Meta no deja leer los comentarios. Genéralo de nuevo en Business Manager.' };
    return { ok: true, motivo: '' };
  }
  /** Lo que conviene saber aunque se pueda leer (permisos que quitan el nombre de quien comenta o el poder responder). */
  function avisos() {
    const p = meta?.estado?.()?.token?.permisos; if (!Array.isArray(p)) return [];
    const out = [];
    if (!p.includes('instagram_manage_comments')) out.push('Sin instagram_manage_comments, Instagram no da el usuario de quien comenta ni deja responder u ocultar.');
    if (!p.includes('pages_manage_engagement')) out.push('Sin pages_manage_engagement, no se puede responder ni ocultar en Facebook.');
    if (!p.includes('ads_read') && !p.includes('ads_management')) out.push('Sin ads_read (o ads_management), los comentarios de los anuncios no llegan (el usuario del sistema lo necesita por Business Manager).');
    return out;
  }

  const reciente = (at, d = dias) => { const ms = Date.parse(at || ''); return !Number.isFinite(ms) || ahora() - ms <= d * 864e5; };

  /** Los anuncios con su publicación: { fb: Map(storyId → info), ig: [{ creativo, info }] }. Lo archivado o borrado no cuenta. */
  function anunciosVivos() {
    const g = anuncios() || {}, campanas = new Map((g.campanas || []).map(c => [String(c.id), c.name || '']));
    const fb = new Map(), ig = [];
    for (const a of (g.anuncios || []).filter(x => VIVOS.has(x.effective_status || x.status || 'ACTIVE')).slice(0, MAX_ANUNCIOS)) {
      const info = { campana: campanas.get(String(a.campaign_id)) || String(a.campaign_id || ''), campanaId: String(a.campaign_id || ''), anuncio: String(a.id || ''), nombre: a.name || 'sin nombre' };
      const story = a.creative?.effective_object_story_id; if (story) fb.set(String(story), info);
      const igDirecto = a.creative?.effective_instagram_media_id; // si un día Anuncios lo pide en su estructura
      // 2 nov 2026: de qué Instagram es el anuncio (para leer y responder con ESA cuenta, no con la primera): la pista del creativo, sin adivinar
      const igId = refsDeAnuncio(a.creative, (g.conjuntos || []).find(c => c.id === a.adset_id)).instagramId || '';
      if (a.creative?.id || igDirecto) ig.push({ creativo: String(a.creative?.id || ''), igMedia: igDirecto ? String(igDirecto) : null, info, igId });
    }
    return { fb, ig };
  }

  async function comentariosIG(token, id) { return (await meta.graph(token, `/${id}/comments`, { params: { fields: CAMPOS_IG, limit: LIMITE_COMENTARIOS } }))?.data || []; }
  async function comentariosFB(token, id, s) {
    const pedir = conOculto => meta.graph(token, `/${id}/comments`, { params: { fields: camposFB(conOculto), order: 'reverse_chronological', limit: LIMITE_COMENTARIOS } });
    if (s.fbOculto !== false) {
      try { return (await pedir(true))?.data || []; }
      catch (e) { if (e?.codigo !== 100) throw e; s.fbOculto = false; } // POR VERIFICAR: `is_hidden` como campo de lectura
    }
    return (await pedir(false))?.data || [];
  }

  /** B2: las plataformas de mensajes de cada página: [{ plataforma, cuenta }] (Messenger con la de Facebook, Instagram con la suya). */
  function plataformas() {
    const out = [];
    for (const c of cuentas()) if (c.paginaId) out.push({ plataforma: c.red === 'instagram' ? 'instagram' : 'messenger', cuenta: c });
    return out;
  }
  const faltanDM = plataforma => { const p = meta?.estado?.()?.token?.permisos; return Array.isArray(p) ? PERMISOS_DM[plataforma].filter(x => !p.includes(x)) : []; };
  /** ¿Se leen los mensajes de esa plataforma? { ok, motivo } — sin permisos o sin acceso avanzado, no (y se reintenta cada 6 h). */
  function dmListo(plataforma, s = leer()) {
    const f = faltanDM(plataforma); if (f.length) return { ok: false, motivo: `Al token le faltan ${f.join(', ')} para leer los mensajes privados de ${plataforma === 'instagram' ? 'Instagram' : 'Messenger'}. ${MOTIVO_SIN_ACCESO}` };
    const e = s.dm?.[plataforma];
    if (e && e.ok === false && e.at && ahora() - Date.parse(e.at) < REINTENTO_MENSAJES_H * 3600e3 && e.permisos === JSON.stringify(meta?.estado?.()?.token?.permisos || null)) return { ok: false, motivo: e.motivo };
    return { ok: true, motivo: '' };
  }
  /** El estado de los mensajes para la Bandeja y Estado (O): { ok, motivo, instagram, messenger, ultimaAt }. */
  function mensajesEstado(s = leer()) {
    const p = [...new Set(plataformas().map(x => x.plataforma))];
    if (!listo().ok) return { ok: false, motivo: listo().motivo, ultimaAt: s.dmAt || null };
    const por = Object.fromEntries(p.map(k => [k, dmListo(k, s)]));
    const ok = p.length > 0 && Object.values(por).some(x => x.ok);
    const motivos = [...new Set(Object.values(por).filter(x => !x.ok).map(x => x.motivo))];
    return { ok, motivo: ok ? motivos.join(' ') : (motivos.join(' ') || MOTIVO_SIN_ACCESO), ...por, ultimaAt: s.dmAt || null, conversaciones: Object.keys(s.convs || {}).length };
  }

  /** B2: lee las conversaciones que cambiaron (por `updated_time`) y sus 20 mensajes más recientes. → { items, primera } */
  async function leerConversaciones(s, errores) {
    const items = []; let leidas = 0;
    const primera = !s.dmAt;
    for (const { plataforma, cuenta } of plataformas()) {
      if (!dmListo(plataforma, s).ok) continue;
      const nombre = plataforma === 'instagram' ? 'Mensajes de Instagram' : 'Mensajes de Messenger';
      try {
        const token = await meta.tokenDe(cuenta);
        let lista;
        try { lista = (await meta.graph(token, `/${cuenta.paginaId}/conversations`, { params: { platform: plataforma, fields: 'id,updated_time', limit: MAX_CONVERSACIONES } }))?.data || []; }
        catch (e) {
          if (sinAcceso(e)) { s.dm[plataforma] = { ok: false, motivo: MOTIVO_SIN_ACCESO, at: new Date(ahora()).toJSON(), permisos: JSON.stringify(meta?.estado?.()?.token?.permisos || null) }; continue; }
          throw e;
        }
        s.dm[plataforma] = { ok: true, at: new Date(ahora()).toJSON() }; leidas++;
        for (const c of lista.filter(x => x?.id && reciente(x.updated_time))) {
          const clave = `${plataforma}:${c.id}`;
          if (s.convs[clave] && s.convs[clave] === String(c.updated_time || '')) continue; // nada nuevo en esa conversación
          let conv;
          const pedir = conAdj => meta.graph(token, `/${c.id}`, { params: { fields: camposMensajes(conAdj) } });
          if (s.adjuntos !== false) {
            try { conv = await pedir(true); }
            catch (e) { if (e?.codigo !== 100) throw e; s.adjuntos = false; } // `attachments` verificado el 9 oct 2026; esto queda por si Meta lo retira
          }
          conv ||= await pedir(false);
          const it = conversacionDe({ ...conv, id: c.id, updated_time: c.updated_time }, { cuenta, ahora: ahora() });
          if (it) items.push(it);
          s.convs[clave] = String(c.updated_time || '');
        }
      } catch (e) { errores.push(`${nombre} (${cuenta.nombre || cuenta.paginaId}): ${mensajeMeta(e)}`); if (e?.frenado) break; }
    }
    if (leidas) s.dmAt = new Date(ahora()).toJSON();
    return { items, primera: primera && leidas > 0 };
  }

  /** Trae los comentarios: { mensajes, error, primera }. Un fallo de una cuenta no para las demás. */
  async function traer() {
    const l = listo(); if (!l.ok) return { mensajes: [], error: l.motivo };
    const s = leer(), primera = !s.ultimaAt, mensajes = [], errores = [], vistas = new Set();
    if (s.atribucion !== ATRIBUCION) { s.pubs = {}; s.atribucion = ATRIBUCION; } // 2 nov 2026: se vuelve a leer todo UNA vez para que cada comentario quede con la cuenta que le toca
    let saltados = 0; // anuncios cuyos comentarios no se leen por no saber de qué cuenta son (se dice, no se esconde)
    const { fb: anunciosFB, ig: anunciosIG } = anunciosVivos();
    const porRed = { instagram: null, facebook: null };
    for (const cuenta of cuentas()) {
      porRed[cuenta.red] ||= cuenta;
      try {
        const token = await meta.tokenDe(cuenta);
        if (cuenta.red === 'instagram') {
          const lista = (await meta.graph(token, `/${cuenta.externoId}/media`, { params: { fields: 'id,caption,permalink,timestamp,comments_count,thumbnail_url,media_url,media_type', limit: MAX_PUBLICACIONES } }))?.data || [];
          for (const m of lista.filter(x => reciente(x.timestamp))) {
            vistas.add(String(m.id));
            const n = Number.isFinite(+m.comments_count) ? +m.comments_count : null, previo = s.pubs[m.id];
            if (previo && n !== null && previo.n === n && !reciente(m.timestamp, DIAS_RECIENTE)) continue; // nada nuevo
            if (n === 0) { s.pubs[m.id] = { n, at: new Date(ahora()).toJSON() }; continue; }
            const publicacion = { id: String(m.id), enlace: String(m.permalink || ''), texto: txt(m.caption, 140), miniatura: String(m.thumbnail_url || (m.media_type === 'VIDEO' ? '' : m.media_url) || '') };
            mensajes.push(...aplanar(await comentariosIG(token, m.id), { cuenta, publicacion }));
            s.pubs[m.id] = { n, at: new Date(ahora()).toJSON() };
          }
        } else {
          const lista = (await meta.graph(token, `/${cuenta.paginaId}/posts`, { params: { fields: 'id,message,created_time,permalink_url,full_picture,comments.summary(total_count).limit(0)', limit: MAX_PUBLICACIONES } }))?.data || [];
          for (const p of lista.filter(x => reciente(x.created_time))) {
            vistas.add(String(p.id));
            const n = Number.isFinite(+p.comments?.summary?.total_count) ? +p.comments.summary.total_count : null, previo = s.pubs[p.id];
            if (previo && n !== null && previo.n === n && !reciente(p.created_time, DIAS_RECIENTE)) continue;
            if (n === 0) { s.pubs[p.id] = { n, at: new Date(ahora()).toJSON() }; continue; }
            const publicacion = { id: String(p.id), enlace: String(p.permalink_url || ''), texto: txt(p.message, 140), miniatura: String(p.full_picture || '') };
            mensajes.push(...aplanar(await comentariosFB(token, p.id, s), { cuenta, publicacion, enAnuncio: anunciosFB.get(String(p.id)) || null }));
            s.pubs[p.id] = { n, at: new Date(ahora()).toJSON() };
          }
        }
      } catch (e) { errores.push(`${cuenta.red === 'instagram' ? 'Instagram' : 'Facebook'} (${cuenta.nombre || cuenta.externoId}): ${mensajeMeta(e)}`); if (e?.frenado) break; }
    }

    // ---- los anuncios: su publicación (la de Facebook la da el creativo; la de Instagram, POR VERIFICAR)
    // 2 nov 2026: con varias páginas, el comentario de un anuncio es de la página DEL ANUNCIO (el prefijo «<página>_<post>» de su historia), no de la
    // primera que se encontró: se lee con el token de esa página y queda con su `cuentaId`. Una historia de una página que el token no ve se salta y se dice.
    if (porRed.facebook) {
      const sinPagina = new Set();
      for (const [story, info] of anunciosFB) {
        if (vistas.has(story)) continue; // una publicación impulsada ya se leyó arriba (y ya va marcada)
        const pid = String(story).split('_')[0], cuenta = cuentas().find(c => c.red === 'facebook' && String(c.paginaId || c.externoId) === pid);
        if (!cuenta) { sinPagina.add(pid); continue; }
        try {
          const token = await meta.tokenDe(cuenta), publicacion = { id: story, enlace: `https://www.facebook.com/${story}`, texto: '', miniatura: '' };
          mensajes.push(...aplanar(await comentariosFB(token, story, s), { cuenta, publicacion, enAnuncio: info }));
        } catch (e) { errores.push(`Anuncios en Facebook (${cuenta.nombre || pid}): ${mensajeMeta(e)}`); if (e?.frenado) break; }
      }
      saltados += sinPagina.size;
      if (sinPagina.size) errores.push(`Anuncios en Facebook: ${sinPagina.size === 1 ? 'una página con anuncios que el token no ve' : sinPagina.size + ' páginas con anuncios que el token no ve'}; sus comentarios no se leen.`);
    }
    const igAnuncio = new Map();
    if (porRed.instagram && anunciosIG.length) {
      const reintentar = s.campoIG === false && s.campoIGAt && ahora() - Date.parse(s.campoIGAt) > REINTENTO_CAMPO_DIAS * 864e5;
      if (s.campoIG !== false || reintentar) {
        const tokenU = await meta.tokenDe({}); // el de usuario: el que lee la cuenta publicitaria
        for (const a of anunciosIG) {
          let mid = a.igMedia ?? s.creativos[a.creativo];
          if (mid === undefined && a.creativo) {
            try { mid = String((await meta.graph(tokenU, `/${a.creativo}`, { params: { fields: 'effective_instagram_media_id' } }))?.effective_instagram_media_id || ''); s.creativos[a.creativo] = mid; s.campoIG = true; }
            catch (e) { if (e?.codigo === 100) { s.campoIG = false; s.campoIGAt = new Date(ahora()).toJSON(); break; } errores.push(`Anuncios en Instagram: ${mensajeMeta(e)}`); break; }
          }
          if (mid) igAnuncio.set(mid, { info: a.info, igId: a.igId || '' });
        }
      }
      // 2 nov 2026: el Instagram del anuncio lo dice su creativo; con un solo Instagram conectado, es ese; con varios y sin pista, NO se adivina (se salta y se dice)
      const igs = cuentas().filter(c => c.red === 'instagram'), sinIg = new Set();
      for (const [mid, { info, igId }] of igAnuncio) {
        if (vistas.has(mid)) { for (const m of mensajes) if (m.publicacion?.id === mid) m.enAnuncio = info; continue; }
        const cuenta = igId ? igs.find(c => String(c.externoId) === igId) : igs.length === 1 ? igs[0] : null;
        if (!cuenta) { sinIg.add(igId || '?'); saltados++; continue; }
        try { const token = await meta.tokenDe(cuenta); mensajes.push(...aplanar(await comentariosIG(token, mid), { cuenta, publicacion: { id: mid, enlace: '', texto: '', miniatura: '' }, enAnuncio: info })); }
        catch (e) { errores.push(`Anuncios en Instagram (${cuenta.nombre || cuenta.externoId}): ${mensajeMeta(e)}`); if (e?.frenado) break; }
      }
      if (sinIg.size) errores.push('Anuncios en Instagram: ' + (sinIg.has('?') ? 'hay anuncios con varios Instagram conectados y sin saber de cuál es (el creativo no lo dice)' : 'hay anuncios de un Instagram que el token no ve') + '; sus comentarios no se leen.');
    }
    // ---- B2: los mensajes privados (solo con los permisos y el acceso avanzado; sin ellos, los comentarios siguen)
    let primeraMensajes = false;
    try { const r = await leerConversaciones(s, errores); mensajes.push(...r.items); primeraMensajes = r.primera; }
    catch (e) { errores.push(`Mensajes: ${mensajeMeta(e)}`); }
    { const k = Object.keys(s.convs); if (k.length > 500) for (const x of k.slice(0, k.length - 500)) delete s.convs[x]; }
    // lo que ya no está en los últimos 30 días se olvida
    for (const id of Object.keys(s.pubs)) if (!vistas.has(id) && !reciente(s.pubs[id].at, dias + 5)) delete s.pubs[id];
    s.ultimaAt = new Date(ahora()).toJSON(); s.error = errores.join(' · '); s.saltados = saltados;
    escribirJSON(archivo, s);
    return { mensajes, error: s.error, primera, primeraMensajes };
  }

  /** Responder: Instagram a /replies, Facebook a /comments; siempre en el comentario de primer nivel. → { id }
   *  B2: a una conversación, POST /<página>/messages (messaging_type RESPONSE, sin etiquetas). La Bandeja ya miró la ventana y el largo. */
  /**
   * LA cuenta de un mensaje: la suya, o un error. Con varias marcas, caer en «la primera de esa red» respondería u ocultaría con el token de OTRA
   * marca. Solo sin `cuentaId` y con EXACTAMENTE una cuenta de esa red se usa esa; un mensaje «por confirmar» (atribución vieja) nunca.
   */
  function cuentaDelMensaje(m) {
    const c = cuentaDe(m.cuentaId); if (c) return c;
    if (!m.cuentaId && !m.cuentaPorConfirmar) { const l = cuentas().filter(x => x.red === m.red && (!m.paginaId || x.paginaId === m.paginaId)); if (l.length === 1) return l[0]; }
    throw Object.assign(new Error(m.cuentaPorConfirmar ? 'No sé desde qué cuenta es este mensaje (se guardó antes de que la oficina supiera distinguir las cuentas): vuelve a leer la Bandeja («Traer lo nuevo») y se confirma sola.' : 'No sé desde qué cuenta es este mensaje, o esa cuenta ya no la ve Meta: vuelve a leer la Bandeja («Traer lo nuevo») o abre Analíticas → «Comprobar conexión». No se envía nada para no responder desde otra marca.'), { conflicto: true, cuentaDesconocida: true });
  }
  async function responder(m, texto) {
    if (m.tipo === 'conversaciones') {
      const cuenta = cuentaDelMensaje(m);
      if (!cuenta?.paginaId) throw new Error('Meta ya no dice qué página tiene esa conversación: abre Analíticas → «Comprobar conexión».');
      if (!m.autorId) throw new Error('no se sabe a quién responder en esa conversación (Meta no dio el id del cliente)');
      const token = await meta.tokenDe(cuenta);
      let r; try { r = await meta.enviar(token, `/${encodeURIComponent(cuenta.paginaId)}/messages`, { campos: { recipient: { id: m.autorId }, messaging_type: 'RESPONSE', message: { text: texto } } }); }
      catch (e) { if (e?.subcodigo === 2018278) throw new Error('Meta dice que la ventana de 24 horas ya se cerró: no deja responder por aquí. Si el cliente vuelve a escribir, se abre otra vez.'); throw new Error(mensajeMeta(e)); }
      return { id: String(r?.message_id || r?.id || '') };
    }
    if (m.oculto) throw Object.assign(new Error('está oculto: vuélvelo a mostrar para responder'), { conflicto: true });
    const cuenta = cuentaDelMensaje(m);
    const destino = m.padreRemoto || m.idRemoto, token = await meta.tokenDe(cuenta);
    let r; try { r = await meta.enviar(token, `/${encodeURIComponent(destino)}/${m.red === 'instagram' ? 'replies' : 'comments'}`, { campos: { message: texto } }); } catch (e) { throw new Error(mensajeMeta(e)); }
    return { id: String(r?.id || '') };
  }
  /** Ocultar o mostrar (nunca borrar): Instagram { hide }, Facebook { is_hidden }. */
  async function ocultar(m, si = true) {
    const cuenta = cuentaDelMensaje(m);
    const token = await meta.tokenDe(cuenta);
    try { await meta.enviar(token, `/${encodeURIComponent(m.idRemoto)}`, { campos: m.red === 'instagram' ? { hide: si } : { is_hidden: si } }); } catch (e) { throw new Error(mensajeMeta(e)); }
    return true;
  }

  function estado() {
    const l = listo(), s = leer();
    return { ok: l.ok, motivo: l.motivo, ultimaAt: s.ultimaAt || null, error: s.error || '', saltados: Number(s.saltados) || 0, avisos: avisos(), anunciosInstagram: s.campoIG === false ? 'Meta no da la publicación de Instagram de los anuncios (effective_instagram_media_id): sus comentarios no llegan; se vuelve a probar en 7 días.' : '', mensajes: mensajesEstado(s) };
  }
  /** '' si se sabe desde qué cuenta se respondería u ocultaría; si no, el motivo (se mira ANTES de apuntar nada: no es un fallo del envío). */
  const verificarCuenta = m => { try { cuentaDelMensaje(m); return ''; } catch (e) { return e.message; } };
  return { id: 'meta', verificarCuenta, configurado: () => Boolean(meta?.configurado?.()), uso: () => meta?.uso?.() || {}, listo, traer, responder, ocultar, estado, ocultable: true };
}

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
//   `effective_object_story_id` (Facebook). Para Instagram, `effective_instagram_media_id` del creativo es POR VERIFICAR: se pide una vez
//   por creativo (`GET /<creativo>?fields=effective_instagram_media_id`); si Meta no conoce el campo, se deja de pedir 7 días y se dice.
//
// Todo pasa por el cliente de contenido/meta.mjs (su freno por uso, su `appsecret_proof`, `sinToken`): nunca un fetch directo.
// Estado en data/contenido/bandeja-meta.json (sin tokens): cuántos comentarios tenía cada publicación la última vez (solo se vuelven a
// leer las que cambiaron), los creativos ya mirados y el último sondeo.
import fs from 'node:fs';
import path from 'node:path';
import { mensajeMeta } from './meta.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

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

/**
 * @param {object} o.meta      el cliente de contenido/meta.mjs (graph, enviar, tokenDe, estado, configurado, uso)
 * @param {string} o.archivo   data/contenido/bandeja-meta.json
 * @param {Function} o.anuncios () → lo que Anuncios guardó en data/anuncios/cuenta.json (o null): { anuncios: [...], campanas: [...] }
 * @param {Function} o.tokenAnuncios () → el token con el que se leen los creativos (por defecto, el de usuario: el de Anuncios)
 */
export function crearFuenteMeta({ meta, archivo, anuncios = () => null, ahora = () => Date.now(), dias = DIAS } = {}) {
  const leer = () => leerJSON(archivo, { pubs: {}, creativos: {}, campoIG: null, campoIGAt: null, fbOculto: true, ultimaAt: null, error: '' });
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
      if (a.creative?.id || igDirecto) ig.push({ creativo: String(a.creative?.id || ''), igMedia: igDirecto ? String(igDirecto) : null, info });
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

  /** Trae los comentarios: { mensajes, error, primera }. Un fallo de una cuenta no para las demás. */
  async function traer() {
    const l = listo(); if (!l.ok) return { mensajes: [], error: l.motivo };
    const s = leer(), primera = !s.ultimaAt, mensajes = [], errores = [], vistas = new Set();
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
    if (porRed.facebook) {
      try {
        const cuenta = porRed.facebook, token = await meta.tokenDe(cuenta);
        for (const [story, info] of anunciosFB) {
          if (vistas.has(story)) continue; // una publicación impulsada ya se leyó arriba (y ya va marcada)
          const publicacion = { id: story, enlace: `https://www.facebook.com/${story}`, texto: '', miniatura: '' };
          mensajes.push(...aplanar(await comentariosFB(token, story, s), { cuenta, publicacion, enAnuncio: info }));
        }
      } catch (e) { errores.push(`Anuncios en Facebook: ${mensajeMeta(e)}`); }
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
          if (mid) igAnuncio.set(mid, a.info);
        }
      }
      try {
        const cuenta = porRed.instagram, token = await meta.tokenDe(cuenta);
        for (const [mid, info] of igAnuncio) {
          if (vistas.has(mid)) { for (const m of mensajes) if (m.publicacion?.id === mid) m.enAnuncio = info; continue; }
          mensajes.push(...aplanar(await comentariosIG(token, mid), { cuenta, publicacion: { id: mid, enlace: '', texto: '', miniatura: '' }, enAnuncio: info }));
        }
      } catch (e) { errores.push(`Anuncios en Instagram: ${mensajeMeta(e)}`); }
    }
    // lo que ya no está en los últimos 30 días se olvida
    for (const id of Object.keys(s.pubs)) if (!vistas.has(id) && !reciente(s.pubs[id].at, dias + 5)) delete s.pubs[id];
    s.ultimaAt = new Date(ahora()).toJSON(); s.error = errores.join(' · ');
    escribirJSON(archivo, s);
    return { mensajes, error: s.error, primera };
  }

  /** Responder: Instagram a /replies, Facebook a /comments; siempre en el comentario de primer nivel. → { id } */
  async function responder(m, texto) {
    if (m.oculto) throw Object.assign(new Error('está oculto: vuélvelo a mostrar para responder'), { conflicto: true });
    const cuenta = cuentaDe(m.cuentaId) || cuentas().find(c => c.red === m.red); if (!cuenta) throw new Error('Meta ya no dice qué cuenta tiene ese comentario: abre Analíticas → «Comprobar conexión».');
    const destino = m.padreRemoto || m.idRemoto, token = await meta.tokenDe(cuenta);
    let r; try { r = await meta.enviar(token, `/${encodeURIComponent(destino)}/${m.red === 'instagram' ? 'replies' : 'comments'}`, { campos: { message: texto } }); } catch (e) { throw new Error(mensajeMeta(e)); }
    return { id: String(r?.id || '') };
  }
  /** Ocultar o mostrar (nunca borrar): Instagram { hide }, Facebook { is_hidden }. */
  async function ocultar(m, si = true) {
    const cuenta = cuentaDe(m.cuentaId) || cuentas().find(c => c.red === m.red); if (!cuenta) throw new Error('Meta ya no dice qué cuenta tiene ese comentario: abre Analíticas → «Comprobar conexión».');
    const token = await meta.tokenDe(cuenta);
    try { await meta.enviar(token, `/${encodeURIComponent(m.idRemoto)}`, { campos: m.red === 'instagram' ? { hide: si } : { is_hidden: si } }); } catch (e) { throw new Error(mensajeMeta(e)); }
    return true;
  }

  function estado() {
    const l = listo(), s = leer();
    return { ok: l.ok, motivo: l.motivo, ultimaAt: s.ultimaAt || null, error: s.error || '', avisos: avisos(), anunciosInstagram: s.campoIG === false ? 'Meta no da la publicación de Instagram de los anuncios (effective_instagram_media_id): sus comentarios no llegan; se vuelve a probar en 7 días.' : '' };
  }
  return { id: 'meta', configurado: () => Boolean(meta?.configurado?.()), uso: () => meta?.uso?.() || {}, listo, traer, responder, ocultar, estado, ocultable: true };
}

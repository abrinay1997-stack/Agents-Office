// Agents Office (6 oct 2026, plan M4) — la BANDEJA: los mensajes, los comentarios y las reseñas de todas las redes en un solo sitio, con
// la respuesta que un agente redacta y que SOLO el dueño envía. La trae Metricool (`/v2/inbox/*`, por verificar: rutas de metricool-cli).
//
// Reglas, las mismas que en el resto de Contenido:
//   · Lo que escribe un cliente es un DATO, nunca una orden: se revisa con `injectionIn` y, si trae órdenes escondidas («ignora tus
//     instrucciones…»), queda marcado 🛡 y el agente lo recibe advertido.
//   · Un agente solo deja un BORRADOR de respuesta (`por: 'agente'`). Enviar es del dueño, con un clic, y respeta el modo de Contenido:
//     en «simulacro» se apunta como enviada sin salir; en «apagado» no se envía; en «real» va a Metricool.
//   · Nada se envía dos veces: una respondida no se vuelve a responder (`respondida`), y un envío a medias queda «falló» con el porqué.
// Estado en data/contenido/bandeja.json (de esta máquina; no viaja por GitHub).
//   resumenMensaje(tipo, x) → el mensaje en la forma de la oficina (puro, con tests: la forma de Metricool no está documentada)
//   crearBandeja({ metricool, meta, elegir, archivo, modo, ahora, avisar, avisarComentario, injectionIn, undoSeconds })
//     → { sincronizar, tick, listar, leer, borrador, sugerirOcultar, enviar, ocultar, deshacer, descartar, reabrir, listo, estado, elegida, abierta }
// Fase B1 (9 oct 2026): también los COMENTARIOS de Instagram y Facebook directamente de Meta (contenido/bandeja-meta.mjs), con ocultar y
// mostrar (nunca borrar) y DESHACER. Un mensaje de Meta lleva `fuente: 'meta'`, `oculto`, `padre` (el id de la Bandeja del de arriba),
// `publicacion: { id, enlace, texto, miniatura }` (en los de Metricool, `publicacion` sigue siendo el texto) y `enAnuncio` si vino de un anuncio.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { redDeMetricool } from './metricool.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

export const TIPOS = { conversaciones: 'mensaje', comentarios: 'comentario', resenas: 'reseña' };
export const ESTADOS = ['nuevo', 'borrador', 'respondido', 'descartado', 'fallo'];
const MAX = 800; // los más recientes que se guardan
const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); renombrar(f + '.tmp', f); };
const txt = (v, max = 4000) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const primero = (...v) => v.find(x => x !== undefined && x !== null && String(x).trim() !== '');

/** Un elemento de la bandeja de Metricool, con los nombres de campo que se han visto o que son probables (no está documentado). */
export function resumenMensaje(tipo, x = {}) {
  const idRemoto = String(primero(x.id, x.conversationId, x.commentId, x.reviewId, x.uuid) ?? '');
  const red = redDeMetricool(String(primero(x.provider, x.network, x.socialNetwork) ?? '').toLowerCase()) || String(primero(x.provider, x.network) ?? '').toLowerCase();
  const ultimo = x.lastMessage || x.last_message || null;
  const cuando = primero(x.date, x.createdAt, x.created, x.timestamp, x.updatedAt, ultimo?.date, ultimo?.createdAt);
  const ms = cuando ? Date.parse(String(cuando).length === 19 ? cuando + 'Z' : cuando) : NaN;
  return {
    id: `${tipo}:${idRemoto}`, tipo, idRemoto, red,
    autor: txt(primero(x.author?.name, x.author?.username, x.from?.name, x.from?.username, x.userName, x.username, x.authorName, x.reviewer, x.name) ?? 'Alguien', 80),
    texto: txt(primero(x.text, x.message, x.content, x.comment, x.review, x.body, ultimo?.text, ultimo?.message)),
    publicacion: txt(primero(x.postText, x.post?.text, x.post?.caption, x.postTitle), 300),
    enlace: String(primero(x.url, x.permalink, x.postUrl, x.link, x.post?.url) ?? '').slice(0, 500),
    puntuacion: Number.isFinite(+x.rating) ? +x.rating : Number.isFinite(+x.stars) ? +x.stars : null,
    cuando: Number.isFinite(ms) ? new Date(ms).toJSON() : null,
    yaRespondida: !!(x.replied || x.answered || x.hasReply || /REPLIED|ANSWERED/i.test(String(x.status || ''))),
  };
}

// ---------------------------------------------------------------- Fase B1 (9 oct 2026): varias FUENTES
// Una fuente es { id, configurado, listo, traer, responder, ocultar?, estado?, uso? } (contenido/bandeja-meta.mjs es la de Meta; la de
// Metricool está aquí abajo). `contenido.bandejaFuente` elige: auto (Meta si hay token; si no, Metricool; §12 del plan) · meta · metricool · ambas.
export const FUENTES = ['auto', 'meta', 'metricool', 'ambas'];
export const VENTANA_EMPAREJAR_MS = 2 * 60e3; // el mismo comentario por las dos fuentes: misma red, autor y texto, ± 2 min
export const AVISO_CADA_MIN = 15; // Telegram: como mucho un aviso de comentarios cada 15 min («y N más»)
export const SONDEO_MIN = { metaAbierta: 3, meta: 10, metricool: 10 }; // §4.1 del plan
export const BANDEJA_ABIERTA_MS = 3 * 60e3; // la página pide /api/contenido/bandeja?abierta=1 mientras se ve
const RED = { instagram: 'Instagram', facebook: 'Facebook' };

/** La fuente Metricool sobre su cliente (contenido/metricool.mjs): la de siempre, con la interfaz común. */
export function fuenteMetricool(metricool) {
  const configurado = () => Boolean(metricool?.configurado?.());
  return {
    id: 'metricool', configurado, ocultable: false,
    listo: () => (configurado() ? { ok: true, motivo: '' } : { ok: false, motivo: 'La bandeja la trae Metricool: faltan METRICOOL_USER_TOKEN y METRICOOL_USER_ID (variables de Windows, plan Advanced).' }),
    async traer() {
      const mensajes = [], errores = [];
      for (const tipo of Object.keys(TIPOS)) {
        let lista = [];
        try { lista = await metricool.bandeja(tipo); } catch (e) { errores.push(`${TIPOS[tipo]}s: ${e.message}`); continue; }
        for (const x of lista) { const m = resumenMensaje(tipo, x); if (m.idRemoto) mensajes.push({ ...m, fuente: 'metricool' }); }
      }
      return { mensajes, error: errores.join(' · ') };
    },
    async responder(m, texto) { try { await metricool.responder(m.tipo, m.idRemoto, texto); } catch (e) { throw new Error(`Metricool no la aceptó: ${e.message}`); } return {}; },
  };
}

const norma = s => String(s ?? '').toLowerCase().replace(/^@/, '').replace(/\s+/g, ' ').trim();
/** ¿Es el mismo mensaje traído por dos fuentes? Por el id de Meta si Metricool lo da, o por red + autor + texto + hora (± 2 min). Puro. */
export function mismoMensaje(a = {}, b = {}) {
  if (!a.red || a.red !== b.red || (a.fuente || 'metricool') === (b.fuente || 'metricool')) return false;
  if (a.idRemoto && String(a.idRemoto) === String(b.idRemoto)) return true;
  if (!norma(a.texto) || norma(a.texto) !== norma(b.texto) || norma(a.autor) !== norma(b.autor)) return false;
  const ta = Date.parse(a.cuando || ''), tb = Date.parse(b.cuando || '');
  return !Number.isFinite(ta) || !Number.isFinite(tb) || Math.abs(ta - tb) <= VENTANA_EMPAREJAR_MS;
}

/**
 * @param o.metricool  el cliente de Metricool (se envuelve en su fuente) · o.meta la fuente de Meta (crearFuenteMeta)
 * @param o.elegir     () → contenido.bandejaFuente (auto · meta · metricool · ambas)
 * @param o.avisarComentario (texto, { key }) → el aviso de un comentario nuevo (Telegram lo manda si telegram.notify.comentarios)
 * @param o.undoSeconds () → approvals.undoSeconds: cuánto dura el DESHACER de ocultar
 */
export function crearBandeja({ metricool = null, meta = null, elegir = () => 'auto', archivo, modo = () => 'simulacro', ahora = Date.now, avisar = () => {}, avisarComentario = null, injectionIn = () => null, undoSeconds = () => 30 } = {}) {
  const F = { ...(meta ? { meta } : {}), ...(metricool ? { metricool: fuenteMetricool(metricool) } : {}) };
  const leer = () => { const d = leerJSON(archivo, {}); return { items: {}, ultimo: null, error: '', alias: {}, fuentes: {}, aviso: { at: null, cola: [] }, ...d }; };
  const guardar = d => {
    const l = Object.values(d.items).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)));
    if (l.length > MAX) { d.items = Object.fromEntries(l.slice(0, MAX).map(x => [x.id, x])); for (const [k, v] of Object.entries(d.alias)) if (!d.items[v]) delete d.alias[k]; }
    escribirJSON(archivo, d);
  };
  const ahoraIso = () => new Date(ahora()).toJSON();
  const resolver = (d, id) => d.alias?.[id] || id;
  let abiertaAt = 0, enMarcha = null;
  const enviando = new Set(), deshacerTokens = new Map();

  /** La fuente elegida, ya resuelta: «auto» = Meta si hay token, si no Metricool. */
  function elegida() {
    const e = String(elegir?.() || 'auto');
    if (['meta', 'metricool', 'ambas'].includes(e)) return e;
    if (F.meta?.configurado?.()) return 'meta';
    return F.metricool ? 'metricool' : 'meta';
  }
  const activas = () => (elegida() === 'ambas' ? ['meta', 'metricool'] : [elegida()]).filter(k => F[k]);
  /** ¿Se puede traer algo? Combinado: basta una fuente activa lista; el motivo dice lo de las que no. */
  function listo() {
    const a = activas(); if (!a.length) return { ok: false, motivo: elegida() === 'meta' ? 'Meta no está conectada: falta la variable META_ACCESS_TOKEN (mira docs/conectar-meta.md).' : 'La bandeja no tiene de dónde traer mensajes.' };
    const l = a.map(k => F[k].listo());
    return { ok: l.some(x => x.ok), motivo: l.filter(x => !x.ok).map(x => x.motivo).join(' ') };
  }
  function estadoFuentes(d = leer()) {
    const act = activas();
    return Object.fromEntries(Object.entries(F).map(([k, f]) => {
      const l = f.listo(), e = f.estado?.() || {};
      return [k, { ok: l.ok, motivo: l.motivo, activa: act.includes(k), ultimaAt: d.fuentes?.[k]?.ultimaAt || e.ultimaAt || null, error: d.fuentes?.[k]?.error || '', ...(e.avisos?.length ? { avisos: e.avisos } : {}), ...(e.anunciosInstagram ? { anunciosInstagram: e.anunciosInstagram } : {}) }];
    }));
  }

  const respondidoFuera = x => { x.estado = 'respondido'; x.respuesta ||= { fuera: true, cuando: ahoraIso() }; x.enviando = null; };
  /** Mete un mensaje traído: lo ya visto conserva su estado; lo nuevo entra «nuevo»; el que ya vino por la otra fuente no se duplica. */
  function integrar(d, m) {
    if (d.alias[m.id]) { const x = d.items[d.alias[m.id]]; if (x && m.yaRespondida && ['nuevo', 'borrador', 'fallo'].includes(x.estado)) respondidoFuera(x); return 'alias'; }
    const previo = d.items[m.id];
    if (previo) {
      const { yaRespondida, ...fresco } = m, x = { ...previo, ...fresco };
      if (previo.ocultoSimulado) x.oculto = previo.oculto; // lo ocultado en simulacro no lo deshace la lectura de Meta
      if (previo.texto !== m.texto) x.sospecha = injectionIn(`${m.texto}\n${m.autor}`) || '';
      if (yaRespondida && ['nuevo', 'borrador', 'fallo'].includes(previo.estado)) respondidoFuera(x); // respondido desde la app de la red
      if (yaRespondida) x.enviando = null;
      x.yaRespondida = Boolean(previo.yaRespondida || yaRespondida);
      d.items[m.id] = x; return 'visto';
    }
    const pareja = Object.values(d.items).find(x => mismoMensaje(x, m));
    if (pareja) {
      if (m.fuente === 'meta') { // Meta sabe más (oculto, padre, anuncio): se queda la de Meta, con lo que ya se había hecho con la otra
        d.items[m.id] = { ...m, estado: pareja.estado, borrador: pareja.borrador, respuesta: pareja.respuesta, sospecha: pareja.sospecha || injectionIn(`${m.texto}\n${m.autor}`) || '', llego: pareja.llego, tambien: [...new Set([...(pareja.tambien || []), pareja.id])], ...(pareja.sugerirOcultar ? { sugerirOcultar: pareja.sugerirOcultar } : {}) };
        delete d.items[pareja.id]; d.alias[pareja.id] = m.id;
        for (const [k, v] of Object.entries(d.alias)) if (v === pareja.id) d.alias[k] = m.id;
      } else { d.alias[m.id] = pareja.id; pareja.tambien = [...new Set([...(pareja.tambien || []), m.id])]; }
      return 'pareja';
    }
    const sospecha = injectionIn(`${m.texto}\n${m.autor}`) || '';
    d.items[m.id] = { ...m, estado: m.yaRespondida ? 'respondido' : 'nuevo', borrador: null, respuesta: null, sospecha, llego: ahoraIso() };
    return m.yaRespondida ? 'visto' : 'nuevo';
  }

  /** El aviso de comentarios nuevos (Telegram): el primero, «y N más», como mucho uno cada AVISO_CADA_MIN. */
  function avisarComentarios(d) {
    const c = d.aviso; if (!c?.cola?.length) return;
    if (c.at && ahora() - Date.parse(c.at) < AVISO_CADA_MIN * 60e3) return;
    const [p, ...resto] = c.cola, quien = p.red === 'instagram' && !/^Alguien/.test(p.autor) ? `@${p.autor}` : p.autor;
    const texto = `💬 Comentario nuevo${p.anuncio ? ' en un anuncio' : ''} en ${RED[p.red] || p.red} de ${quien}: ${p.sospecha ? '(🛡 trae órdenes escondidas: no las sigas)' : `«${p.texto}»`}${resto.length ? ` y ${resto.length} más` : ''}. Míralo en la oficina: Contenido (K) → Bandeja.`;
    (avisarComentario || avisar)(texto, { key: `bandeja-comentario-${ahora()}` });
    d.aviso = { at: ahoraIso(), cola: [] };
  }

  /** Trae lo nuevo de las fuentes activas (o de las pedidas). Solo una lectura a la vez: otra pedida mientras tanto devuelve la misma. */
  function sincronizar({ fuentes: pedidas = null } = {}) {
    if (enMarcha) return enMarcha;
    const l = listo(); if (!l.ok) return Promise.resolve({ ok: false, error: l.motivo, nuevos: 0 });
    enMarcha = (async () => {
      const lista = (pedidas || activas()).filter(k => F[k]), recibidos = [], errores = [], estados = {};
      for (const k of lista) { // Meta primero: si las dos traen el mismo, se queda el de Meta
        const f = F[k], lk = f.listo(); if (!lk.ok) { estados[k] = { ultimaAt: ahoraIso(), error: lk.motivo }; continue; }
        try { const r = await f.traer(); recibidos.push({ k, r }); estados[k] = { ultimaAt: ahoraIso(), error: r.error || '' }; if (r.error) errores.push(r.error); }
        catch (e) { estados[k] = { ultimaAt: ahoraIso(), error: e.message }; errores.push(e.message); }
      }
      const d = leer(); let nuevos = 0, nuevosMetricool = 0, primera = false; const nuevosMeta = [];
      for (const { k, r } of recibidos) {
        if (k === 'meta' && r.primera) primera = true;
        for (const m0 of r.mensajes || []) {
          const m = { ...m0, fuente: m0.fuente || k }, que = integrar(d, m);
          if (que === 'nuevo') { nuevos++; if (k === 'meta') nuevosMeta.push(d.items[m.id]); else nuevosMetricool++; }
        }
      }
      d.fuentes = { ...d.fuentes, ...estados }; d.ultimo = ahoraIso(); d.error = errores.join(' · ');
      if (primera && nuevosMeta.length) avisar(`Bandeja: llegaron ${nuevosMeta.length} ${nuevosMeta.length === 1 ? 'comentario' : 'comentarios'} de Instagram y Facebook (los de los últimos 30 días).`, { key: 'bandeja-meta-primera' });
      else if (nuevosMeta.length) d.aviso.cola = [...(d.aviso.cola || []), ...nuevosMeta.map(m => ({ red: m.red, autor: m.autor, texto: String(m.texto || '').replace(/\s+/g, ' ').slice(0, 120), sospecha: Boolean(m.sospecha), anuncio: Boolean(m.enAnuncio) }))].slice(-50);
      avisarComentarios(d);
      guardar(d);
      if (nuevosMetricool) avisar(`Bandeja: ${nuevosMetricool} ${nuevosMetricool === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en tus redes.`, { key: 'bandeja-nuevos' });
      return { ok: !errores.length, error: d.error, nuevos };
    })().finally(() => { enMarcha = null; });
    return enMarcha;
  }

  /** El reloj (serve.mjs, cada minuto): Meta cada 3 min con la Bandeja abierta y 10 si no (× el freno de Meta); Metricool cada 10. */
  async function tick() {
    try {
      if (enMarcha) return null;
      const d = leer(), t = ahora(), abierta = t - abiertaAt < BANDEJA_ABIERTA_MS, toca = [];
      for (const k of activas()) {
        const f = F[k]; if (!f.listo().ok) continue;
        const uso = f.uso?.() || {}; if (uso.frenadoHasta) continue;
        const min = k === 'meta' ? (abierta ? SONDEO_MIN.metaAbierta : SONDEO_MIN.meta) * (uso.ritmo || 1) : SONDEO_MIN.metricool;
        const last = Date.parse(d.fuentes?.[k]?.ultimaAt || '');
        if (!Number.isFinite(last) || t - last >= min * 60e3) toca.push(k);
      }
      return toca.length ? await sincronizar({ fuentes: toca }) : null;
    } catch (e) { console.warn('bandeja:', e.message); return null; }
  }

  function listar({ estado = '', red = '', tipo = '', fuente = '' } = {}) {
    const d = leer(), todos = Object.values(d.items);
    const items = todos.filter(x => (!estado || (estado === 'pendiente' ? ['nuevo', 'borrador', 'fallo'].includes(x.estado) : x.estado === estado)) && (!red || x.red === red) && (!tipo || x.tipo === tipo) && (!fuente || (x.fuente || 'metricool') === fuente))
      .sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)));
    const cuenta = Object.fromEntries(ESTADOS.map(e => [e, todos.filter(x => x.estado === e).length]));
    return { items, cuenta, pendientes: cuenta.nuevo + cuenta.borrador + cuenta.fallo, ultimo: d.ultimo, error: d.error, fuente: listo(), modo: modo(), bandejaFuente: elegida(), fuentes: estadoFuentes(d) };
  }
  const uno = id => { const d = leer(); return d.items[resolver(d, id)] || null; };
  function estado() {
    const d = leer(), todos = Object.values(d.items);
    return { fuente: elegida(), fuentes: estadoFuentes(d), ultimo: d.ultimo, error: d.error, pendientes: todos.filter(x => ['nuevo', 'borrador', 'fallo'].includes(x.estado)).length, ocultos: todos.filter(x => x.oculto).length };
  }

  /** El borrador de la respuesta: lo deja un agente o lo escribe el dueño. Una ya respondida o descartada no se toca. */
  function borrador(id, texto, { por = 'dueno', agente = '' } = {}) {
    const d = leer(), m = d.items[resolver(d, id)]; if (!m) return { error: 'ese mensaje ya no está en la bandeja', nada: true };
    if (m.estado === 'respondido') return { error: 'ese mensaje ya está respondido' };
    if (m.estado === 'descartado' && por === 'agente') return { error: 'el dueño descartó ese mensaje: no necesita respuesta' };
    const t = txt(texto, 2000);
    m.borrador = t ? { texto: t, por: por === 'agente' ? `agente:${agente || '?'}` : 'dueno', cuando: ahoraIso() } : null;
    m.estado = t ? 'borrador' : 'nuevo';
    guardar(d); return { ok: true, item: m };
  }

  /** Un agente SUGIERE ocultar (insulto, spam): solo se marca; ocultar es del dueño. */
  function sugerirOcultar(id, motivo, { agente = '' } = {}) {
    const d = leer(), m = d.items[resolver(d, id)]; if (!m) return { error: 'ese mensaje ya no está en la bandeja', nada: true };
    if (m.fuente !== 'meta' || m.tipo !== 'comentarios') return { error: 'solo se puede ocultar un comentario que trae Meta' };
    if (m.oculto) return { error: 'ese comentario ya está oculto' };
    const t = txt(motivo, 300); if (!t) return { error: 'di por qué conviene ocultarlo (insulto, spam, datos personales…)' };
    m.sugerirOcultar = { motivo: t, quien: agente || 'agente', por: `agente:${agente || '?'}`, cuando: ahoraIso() };
    guardar(d); return { ok: true, item: m };
  }

  /** Enviar la respuesta: solo el dueño (la ruta lo comprueba), UNA vez, y según el modo de Contenido. */
  async function enviar(id, texto, { forzar = false } = {}) {
    let d = leer(); id = resolver(d, id); let m = d.items[id]; if (!m) return { error: 'ese mensaje ya no está en la bandeja', nada: true };
    if (m.estado === 'respondido') return { error: 'ya está respondido: no se envía dos veces' };
    if (enviando.has(id)) return { error: 'esa respuesta ya se está enviando: no se envía dos veces' };
    if (m.enviando && !forzar) return { error: 'Hubo un corte mientras se enviaba esta respuesta: mira en la red si salió (la próxima lectura lo sabrá y la dará por respondida). Si no salió, vuelve a enviarla con «forzar».', incierta: true };
    if (m.fuente === 'meta' && m.oculto) return { error: 'está oculto: vuélvelo a mostrar para responder', oculto: true };
    const t = txt(texto ?? m.borrador?.texto, 2000); if (!t) return { error: 'escribe la respuesta antes de enviarla' };
    const md = modo();
    if (md === 'apagado') return { error: 'la publicación está apagada (Ajustes → Contenido): no sale nada, tampoco las respuestas' };
    let remoto = null;
    if (md === 'real') {
      const f = F[m.fuente || 'metricool'], l = f ? f.listo() : { ok: false, motivo: `la fuente ${m.fuente} ya no está conectada` }; if (!l.ok) return { error: l.motivo };
      enviando.add(id); m.enviando = { at: ahoraIso(), texto: t }; guardar(d); // el testigo: si la oficina se corta aquí, no se vuelve a mandar sin «forzar»
      try { remoto = await f.responder(m, t); }
      catch (e) {
        d = leer(); m = d.items[id] || m;
        m.estado = 'fallo'; m.enviando = null; m.borrador = { ...(m.borrador || {}), texto: t, cuando: m.borrador?.cuando || ahoraIso(), por: m.borrador?.por || 'dueno' }; m.error = e.message; d.items[id] = m; guardar(d);
        return { error: e.conflicto ? e.message : /no la aceptó/.test(e.message) ? e.message : `Meta no la aceptó: ${e.message}`, ...(e.conflicto ? { oculto: true } : {}) };
      } finally { enviando.delete(id); }
      d = leer(); m = d.items[id] || m; // durante el envío, una lectura pudo cambiar el archivo
    }
    m.estado = 'respondido'; m.enviando = null; m.respuesta = { texto: t, cuando: ahoraIso(), simulada: md !== 'real', ...(remoto?.id ? { idRemoto: remoto.id } : {}) }; m.error = '';
    d.items[id] = m; guardar(d); return { ok: true, item: m, simulada: md !== 'real' };
  }

  /** Ocultar o mostrar un comentario de Meta (nunca borrar): solo el dueño (la ruta lo comprueba), según el modo, con DESHACER. */
  async function ocultar(id, si = true, { deshaciendo = false } = {}) {
    let d = leer(); id = resolver(d, id); let m = d.items[id]; if (!m) return { error: 'ese mensaje ya no está en la bandeja', nada: true };
    if (m.fuente !== 'meta' || m.tipo !== 'comentarios' || !F.meta) return { error: 'solo los comentarios que trae Meta se pueden ocultar desde la oficina' };
    if (Boolean(m.oculto) === Boolean(si)) return { error: si ? 'ya está oculto' : 'ya se ve: no está oculto' };
    if (enviando.has('oc:' + id)) return { error: 'ya se está cambiando: espera un momento' };
    const md = modo();
    if (md === 'apagado') return { error: 'la publicación está apagada (Ajustes → Contenido): no se cambia nada en las redes' };
    if (md === 'real') {
      const l = F.meta.listo(); if (!l.ok) return { error: l.motivo };
      enviando.add('oc:' + id);
      try { await F.meta.ocultar(m, Boolean(si)); }
      catch (e) { return { error: `Meta no lo dejó: ${e.message}` }; }
      finally { enviando.delete('oc:' + id); }
      d = leer(); m = d.items[id] || m;
    }
    m.oculto = Boolean(si); m.ocultoSimulado = md !== 'real'; m.ocultadoAt = si ? ahoraIso() : null;
    d.items[id] = m; guardar(d);
    const r = { ok: true, item: m, simulada: md !== 'real' };
    if (!deshaciendo) {
      const token = crypto.randomBytes(12).toString('hex'), hasta = ahora() + Math.max(5, Number(undoSeconds()) || 30) * 1000;
      for (const [k, v] of deshacerTokens) if (v.hasta < ahora()) deshacerTokens.delete(k);
      deshacerTokens.set(token, { id, a: !si, hasta }); r.deshacer = { token, hasta: new Date(hasta).toJSON() };
    }
    return r;
  }
  /** DESHACER lo último de ocultar/mostrar, dentro de su tiempo (una vez). */
  async function deshacer(token) {
    const e = deshacerTokens.get(String(token || ''));
    if (!e) return { error: 'no hay nada que deshacer (o ya se deshizo)', nada: true };
    deshacerTokens.delete(String(token));
    if (e.hasta < ahora()) return { error: 'ya pasó el tiempo para deshacer: usa el botón otra vez' };
    return ocultar(e.id, e.a, { deshaciendo: true });
  }

  function descartar(id) { const d = leer(), m = d.items[resolver(d, id)]; if (!m) return { error: 'ese mensaje ya no está', nada: true }; if (m.estado === 'respondido') return { error: 'ya está respondido' }; m.estado = 'descartado'; guardar(d); return { ok: true, item: m }; }
  function reabrir(id) { const d = leer(), m = d.items[resolver(d, id)]; if (!m) return { error: 'ese mensaje ya no está', nada: true }; if (m.estado !== 'descartado') return { error: 'solo se reabre lo descartado' }; m.estado = m.borrador ? 'borrador' : 'nuevo'; guardar(d); return { ok: true, item: m }; }
  return { sincronizar, tick, listar, leer: uno, borrador, sugerirOcultar, enviar, ocultar, deshacer, descartar, reabrir, listo, estado, elegida, abierta: () => { abiertaAt = ahora(); } };
}

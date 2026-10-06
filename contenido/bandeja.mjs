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
//   crearBandeja({ metricool, archivo, modo, ahora, avisar, injectionIn }) → { sincronizar, listar, leer, borrador, enviar, descartar, reabrir, estado }
import fs from 'node:fs';
import path from 'node:path';
import { redDeMetricool } from './metricool.mjs';

export const TIPOS = { conversaciones: 'mensaje', comentarios: 'comentario', resenas: 'reseña' };
export const ESTADOS = ['nuevo', 'borrador', 'respondido', 'descartado', 'fallo'];
const MAX = 800; // los más recientes que se guardan
const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); fs.renameSync(f + '.tmp', f); };
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

export function crearBandeja({ metricool = null, archivo, modo = () => 'simulacro', ahora = Date.now, avisar = () => {}, injectionIn = () => null } = {}) {
  const leer = () => leerJSON(archivo, { items: {}, ultimo: null, error: '' });
  const guardar = d => { const l = Object.values(d.items).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando))); if (l.length > MAX) d.items = Object.fromEntries(l.slice(0, MAX).map(x => [x.id, x])); escribirJSON(archivo, d); };
  const listo = () => (metricool?.configurado?.() ? { ok: true, motivo: '' } : { ok: false, motivo: 'La bandeja la trae Metricool: faltan METRICOOL_USER_TOKEN y METRICOOL_USER_ID (variables de Windows, plan Advanced).' });

  /** Trae lo nuevo de Metricool. Lo ya visto conserva su estado y su borrador; lo nuevo entra «nuevo» (o «respondido» si ya lo estaba). */
  async function sincronizar() {
    const l = listo(); if (!l.ok) return { ok: false, error: l.motivo, nuevos: 0 };
    const d = leer(); let nuevos = 0; const errores = [];
    for (const tipo of Object.keys(TIPOS)) {
      let lista = [];
      try { lista = await metricool.bandeja(tipo); } catch (e) { errores.push(`${TIPOS[tipo]}s: ${e.message}`); continue; }
      for (const x of lista) {
        const m = resumenMensaje(tipo, x); if (!m.idRemoto) continue;
        const previo = d.items[m.id];
        if (previo) { d.items[m.id] = { ...previo, ...m, estado: previo.estado, borrador: previo.borrador, respuesta: previo.respuesta, sospecha: previo.sospecha }; continue; }
        const sospecha = injectionIn(`${m.texto}\n${m.autor}`) || '';
        d.items[m.id] = { ...m, estado: m.yaRespondida ? 'respondido' : 'nuevo', borrador: null, respuesta: null, sospecha, llego: new Date(ahora()).toJSON() };
        if (!m.yaRespondida) nuevos++;
      }
    }
    d.ultimo = new Date(ahora()).toJSON(); d.error = errores.join(' · ');
    guardar(d);
    if (nuevos) avisar(`Bandeja: ${nuevos} ${nuevos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en tus redes.`, { key: 'bandeja-nuevos' });
    return { ok: !errores.length, error: d.error, nuevos };
  }

  function listar({ estado = '', red = '', tipo = '' } = {}) {
    const d = leer(), todos = Object.values(d.items);
    const items = todos.filter(x => (!estado || (estado === 'pendiente' ? ['nuevo', 'borrador', 'fallo'].includes(x.estado) : x.estado === estado)) && (!red || x.red === red) && (!tipo || x.tipo === tipo))
      .sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)));
    const cuenta = Object.fromEntries(ESTADOS.map(e => [e, todos.filter(x => x.estado === e).length]));
    return { items, cuenta, pendientes: cuenta.nuevo + cuenta.borrador + cuenta.fallo, ultimo: d.ultimo, error: d.error, fuente: listo(), modo: modo() };
  }
  const uno = id => leer().items[id] || null;

  /** El borrador de la respuesta: lo deja un agente o lo escribe el dueño. Una ya respondida o descartada no se toca. */
  function borrador(id, texto, { por = 'dueno', agente = '' } = {}) {
    const d = leer(), m = d.items[id]; if (!m) return { error: 'ese mensaje ya no está en la bandeja', nada: true };
    if (m.estado === 'respondido') return { error: 'ese mensaje ya está respondido' };
    if (m.estado === 'descartado' && por === 'agente') return { error: 'el dueño descartó ese mensaje: no necesita respuesta' };
    const t = txt(texto, 2000);
    m.borrador = t ? { texto: t, por: por === 'agente' ? `agente:${agente || '?'}` : 'dueno', cuando: new Date(ahora()).toJSON() } : null;
    m.estado = t ? 'borrador' : 'nuevo';
    guardar(d); return { ok: true, item: m };
  }

  /** Enviar la respuesta: solo el dueño (la ruta lo comprueba) y según el modo de Contenido. */
  async function enviar(id, texto) {
    const d = leer(), m = d.items[id]; if (!m) return { error: 'ese mensaje ya no está en la bandeja', nada: true };
    if (m.estado === 'respondido') return { error: 'ya está respondido: no se envía dos veces' };
    const t = txt(texto ?? m.borrador?.texto, 2000); if (!t) return { error: 'escribe la respuesta antes de enviarla' };
    const md = modo();
    if (md === 'apagado') return { error: 'la publicación está apagada (Ajustes → Contenido): no sale nada, tampoco las respuestas' };
    if (md === 'real') {
      const l = listo(); if (!l.ok) return { error: l.motivo };
      try { await metricool.responder(m.tipo, m.idRemoto, t); }
      catch (e) { m.estado = 'fallo'; m.borrador = { ...(m.borrador || {}), texto: t, cuando: m.borrador?.cuando || new Date(ahora()).toJSON(), por: m.borrador?.por || 'dueno' }; m.error = e.message; guardar(d); return { error: `Metricool no la aceptó: ${e.message}` }; }
    }
    m.estado = 'respondido'; m.respuesta = { texto: t, cuando: new Date(ahora()).toJSON(), simulada: md !== 'real' }; m.error = '';
    guardar(d); return { ok: true, item: m, simulada: md !== 'real' };
  }
  function descartar(id) { const d = leer(), m = d.items[id]; if (!m) return { error: 'ese mensaje ya no está', nada: true }; if (m.estado === 'respondido') return { error: 'ya está respondido' }; m.estado = 'descartado'; guardar(d); return { ok: true, item: m }; }
  function reabrir(id) { const d = leer(), m = d.items[id]; if (!m) return { error: 'ese mensaje ya no está', nada: true }; if (m.estado !== 'descartado') return { error: 'solo se reabre lo descartado' }; m.estado = m.borrador ? 'borrador' : 'nuevo'; guardar(d); return { ok: true, item: m }; }
  return { sincronizar, listar, leer: uno, borrador, enviar, descartar, reabrir, listo };
}

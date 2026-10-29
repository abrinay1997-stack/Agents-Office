// Telegram en la nube (serve.mjs + telegram.mjs, hechos con un webhook en lugar de getUpdates). El CEREBRO del bot es el de la oficina local, sin copiar una línea: los comandos, los botones
// y los textos están en telegram-core.mjs (`crearBot`, `crearAvisador`). Aquí solo se ponen las tres cosas que cambian en un Worker:
//   · la API de Telegram (`call`, con el token del Worker: sale en la URL de la llamada, nunca en un texto, un error o un registro);
//   · `local(método, ruta, cuerpo, por)`: la puerta de la oficina. En vez de un `fetch` a 127.0.0.1, la ruta entra POR FUNCIÓN al módulo que la posee con la sesión del DUEÑO, así valen las mismas
//     reglas que en la página (solo el dueño aprueba; el gasto de anuncios pide dos toques y la cifra; un aprobador delegado solo toca los departamentos que se le dieron — lo comprueba `crearBot`);
//   · el estado (lo que el bot recuerda entre mensajes: el «¿qué debe cambiar?» de un Devolver, lo retenido por el no molestar, el token del segundo toque de un gasto) vive en D1, doc `telegram.estado`.
import { crearBot, crearAvisador, esc, chunks, configured, owners, avisosPorDefecto, aprobadoresDe, piezaTexto, piezaBotones, approvalText, approvalButtons, COMANDOS } from '../../../telegram-core.mjs';
import { leerDoc, mutarDoc } from './almacen.js';
import { avisosTodos } from './salud.js';
import { cargarTareas } from './tareas/sesion.js';
import { leerContexto } from './tareas/contexto.js';
import { leerCfg } from './ajustes.js';
import { crearOffice } from './agentes/herramientas.js';
import { avisarPorTelegram, usuarioPorNombre, conectadosAhora } from './telegram-cuentas.js';

/** Los ids que mandan, AHORA: TELEGRAM_OWNER_ID (secreto) y los administradores que se registraron en Ajustes (`telegram.admins`) CUYO USUARIO SIGUE SIENDO ADMIN. Se mira en cada mensaje: degradar a alguien le quita el bot al instante. */
export async function idsAdmins(env, db, cfg) {
  const reg = cfg?.telegram?.admins && typeof cfg.telegram.admins === 'object' ? Object.entries(cfg.telegram.admins).filter(([id, c]) => /^\d{4,15}$/.test(id) && typeof c === 'string') : [];
  const vivos = [];
  if (reg.length) {
    const { results } = await db.prepare(`select email from users where rol = 'admin' and email in (${reg.map(() => '?').join(',')})`).bind(...reg.map(([, c]) => c.toLowerCase())).all();
    const admins = new Set(results.map((r) => r.email));
    for (const [id, c] of reg) if (admins.has(c.toLowerCase())) vivos.push(id);
  }
  return [...new Set([...owners(env), ...vivos])];
}

export const DOC_ESTADO = 'telegram.estado';
const API = 'https://api.telegram.org';
const ESTADO_VACIO = () => ({ pendingReject: {}, held: [], snoozeUntil: 0, gastos: {}, refused: {}, tareas: {}, avisosHasta: 0, avisosIds: [], ultimoUpdate: 0, errorAviso: '' });

/** Lo que el bot recuerda, con lo que falte puesto a su valor de siempre. */
export async function leerEstado(db) {
  const { valor, version } = await leerDoc(db, DOC_ESTADO, {});
  return { st: { ...ESTADO_VACIO(), ...(valor || {}) }, version };
}

const MAPAS = ['pendingReject', 'gastos', 'refused', 'tareas']; // objetos id → valor: se fusionan clave por clave
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Los desconocidos avisados: solo las últimas 200 entradas y de las últimas 24 h (un extraño por mensaje no llena D1). */
export function podarRefused(refused, ahora) {
  const v = Object.entries(refused || {}).filter(([, t]) => ahora - Number(t) < 864e5).sort((a, b) => b[1] - a[1]).slice(0, 200);
  return Object.fromEntries(v);
}
/** Guarda el estado SIN pisar a nadie: la webhook y el reloj corren a la vez. Con la versión como condición (mutarDoc reintenta) y campo por campo: de los mapas se aplica solo lo que cambió aquí. */
export async function guardarEstado(db, st, foto, ahora = Date.now()) {
  st.refused = podarRefused(st.refused, ahora);
  return mutarDoc(db, DOC_ESTADO, ESTADO_VACIO(), (actual) => {
    const o = { ...ESTADO_VACIO(), ...(actual || {}) };
    for (const k of Object.keys(st)) {
      if (MAPAS.includes(k)) {
        const m = { ...(o[k] || {}) };
        for (const [id, v] of Object.entries(st[k] || {})) if (!igual(v, foto[k]?.[id])) m[id] = v;
        for (const id of Object.keys(foto[k] || {})) if (!(id in (st[k] || {}))) delete m[id];
        o[k] = m;
      } else if (k === 'avisosIds') { if (!igual(st[k], foto[k])) o[k] = [...new Set([...(o[k] || []), ...(st[k] || [])])].slice(-300); }
      else if (!igual(st[k], foto[k])) o[k] = k === 'ultimoUpdate' || k === 'avisosHasta' ? Math.max(Number(o[k]) || 0, Number(st[k]) || 0) : st[k];
    }
    if (o.refused) o.refused = podarRefused(o.refused, ahora);
    return o;
  });
}

/**
 * El bot de ESTA invocación: { bot, av, st, guardar, send, call }. `modulos`: los módulos por los que entra cada ruta.
 * `fetchFn` (pruebas): un Telegram de mentira.
 */
export async function armar({ env, db, modulos, fetchFn = null, ahoraFn = () => Date.now() }) {
  if (!configured(env)) return null;
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const cfg = await leerCfg(db), C = await leerContexto(db), who = await idsAdmins(env, db, cfg);
  const tg = { ...(cfg.telegram || {}) }, notify = avisosPorDefecto(tg), approvers = aprobadoresDe(tg);
  const { st } = await leerEstado(db), foto = structuredClone(st); // `foto` = lo que había al leer: al guardar solo se aplica lo que ESTA invocación cambió
  const f = fetchFn || env.__pruebas?.fetch || ((...a) => fetch(...a));
  const guardar = () => guardarEstado(db, st, foto, ahoraFn());

  // Telegram: el token solo va en la URL; un error dice lo que Telegram contestó, nunca la URL
  const call = async (m, body) => {
    let r; try { r = await f(`${API}/bot${token}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); } catch { throw new Error('Telegram no contesta'); }
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(String(j.description || 'Telegram ' + r.status).replace(token, '«token»'));
    return j.result;
  };
  const callForm = async (m, campos, archivo) => {
    const fd = new FormData(); for (const [k, v] of Object.entries(campos)) fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    fd.append(archivo.campo, new Blob([archivo.bytes], { type: archivo.tipo }), archivo.nombre);
    let r; try { r = await f(`${API}/bot${token}/${m}`, { method: 'POST', body: fd }); } catch { throw new Error('Telegram no contesta'); }
    const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(String(j.description || 'Telegram ' + r.status).replace(token, '«token»')); return j.result;
  };
  const log = { warn: (...a) => console.warn('[telegram]', ...a.map((x) => String(x).replace(token, '«token»'))) };
  const send = async (chat, text, extra = {}) => { for (const c of chunks(text)) { try { await call('sendMessage', { chat_id: chat, text: c, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }); } catch (e) { log.warn(e.message); st.errorAviso = e.message.slice(0, 200); } } };

  // la puerta de la oficina: por función, con la sesión del dueño (rol admin)
  const local = async (method, p, body, by) => {
    const office = crearOffice({ env, db, usuario: { id: 'telegram', email: String(by || 'telegram').slice(0, 80), rol: 'admin' }, modulos });
    try { return await office(p, body, method); } catch (e) {
      const m = String(e.message || ''); throw new Error(m.slice(0, 300) || 'no se pudo');
    }
  };

  // la foto de una pieza (la primera imagen, de R2): JPEG, PNG o WebP de menos de 10 MB
  const TIPOS = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  async function fotoDe(p) {
    const m = (p.medios || [])[0], ext = String(m || '').split('.').pop().toLowerCase(); if (!m || !TIPOS[ext] || !env.MEDIA || /\.\./.test(m)) return null;
    try { const o = await env.MEDIA.get(m); if (!o || o.size > 10e6) return null; return { campo: 'photo', bytes: new Uint8Array(await o.arrayBuffer()), tipo: TIPOS[ext], nombre: 'pieza.' + ext }; } catch { return null; }
  }
  const nombreAgente = (id) => C.nombreAgente(id);
  async function sendPieza(chat, p, motivo = '') {
    const caption = piezaTexto(p, { nombreAgente, motivo }), reply_markup = piezaBotones(p), foto = await fotoDe(p);
    if (foto) { try { return await callForm('sendPhoto', { chat_id: String(chat), caption, parse_mode: 'HTML', reply_markup }, foto); } catch (e) { log.warn('foto —', e.message); } }
    return send(chat, caption, { reply_markup });
  }

  const av = crearAvisador({ tg, notify, who, approvers, st, saveSt: () => {}, send, sendPieza, nombreAgente, log });
  const gastos = { recordar(k, x) { const t = ahoraFn(); for (const [a, b] of Object.entries(st.gastos)) if (b.vence <= t) delete st.gastos[a]; st.gastos[k] = x; }, get: (k) => st.gastos[k], delete: (k) => { delete st.gastos[k]; } };
  const refused = { get: (k) => st.refused[k], set: (k, v) => { st.refused[k] = v; } };
  // `saveSt` del bot: el estado vive en el objeto `st` y se guarda al terminar la invocación
  const bot = crearBot({ cfg: { ...cfg, deputy: { name: cfg.deputy?.name || 'Dimitri' } }, who, approvers, st, saveSt: () => {}, local, call, send, sendPieza, flushHeld: av.flushHeld, gastos, refused, silencioExtranos: true, log });
  return { db, env, bot, av, st, guardar, send, call, who, notify, approvers, C, cfg, local, ahoraFn };
}

/** Un update de Telegram (el webhook). Primero se anota su número (Telegram reintenta si tarda: un botón no se pulsa dos veces) y luego `crearBot.procesar` decide quién es y qué hacer:
 *  un extraño no pasa de su primera línea, un aprobador solo toca los departamentos que se le dieron, el dueño todo. */
export async function atenderUpdate(t, update) {
  if (!update || !Number.isInteger(update.update_id)) return { ignorado: true };
  const now = t.ahoraFn();
  const r = await t.db.prepare('insert or ignore into telegram_updates (update_id, t) values (?,?)').bind(update.update_id, now).run();
  if (!r.meta?.changes) return { duplicado: true };
  if (update.update_id % 50 === 0) await t.db.prepare('delete from telegram_updates where t < ?').bind(now - 3 * 864e5).run().catch(() => {});
  t.st.ultimoUpdate = now;
  try { await t.bot.procesar(update); } catch (e) { console.warn('[telegram] update:', String(e?.message || e).slice(0, 200)); }
  await t.guardar();
  return { ok: true };
}

const asc = (a, b) => (a.t || 0) - (b.t || 0);
/** Lo que SALE cada minuto: lo retenido por el no molestar cuando acaba, las aprobaciones y fallos nuevos, los avisos de la oficina. La primera vez solo se apunta lo que ya había (no se manda el historial). */
export async function salientes(t) {
  const { st, av, db, C, notify } = t, now = t.ahoraFn();
  await av.flushHeld();
  // los avisos de la oficina (de las dos tablas) que no salieron todavía
  const avisos = await avisosTodos(db, 100);
  if (!st.avisosHasta) { st.avisosHasta = now; st.avisosIds = avisos.map((n) => n.id).slice(0, 200); }
  else {
    const nuevos = avisos.filter((n) => n.t >= st.avisosHasta - 1000 && !st.avisosIds.includes(n.id)).sort(asc);
    for (const n of nuevos) {
      if (n.kind === 'persona') await alPersona(t, n);
      else await av.aviso(n);
      st.avisosIds.push(n.id); st.avisosHasta = Math.max(st.avisosHasta, n.t || 0);
    }
    st.avisosIds = st.avisosIds.slice(-300);
  }
  // las tareas: esperando el OK, falló, terminó
  const lista = await cargarTareas(db, { ligera: false });
  const marca = (x) => (x.state === 'waiting' ? `w:${x.waitingAt || 0}` : x.state === 'done' ? `${x.error ? 'e' : 'd'}:${x.doneAt || 0}` : null);
  const primera = !Object.keys(st.tareas).length && !st.sembrado;
  for (const x of lista) {
    if (x.archived || x.piece) continue;
    const mk = marca(x); if (!mk) continue;
    if (x.state === 'done' && now - (x.doneAt || 0) > 36 * 3600e3 && !primera) continue;
    if (st.tareas[x.id] === mk) continue;
    st.tareas[x.id] = mk;
    if (primera) continue; // el historial no se manda
    if (x.state === 'done' && x.error && x.stopped) continue;
    await av.tarea({ ...x, agentName: C.nombreAgente(x.agent), deptName: C.depts[x.dept]?.name || x.dept });
  }
  st.sembrado = true;
  const ids = new Set(lista.map((x) => x.id)); for (const id of Object.keys(st.tareas)) if (!ids.has(id)) delete st.tareas[id]; // lo que ya no existe se olvida
  await t.guardar();
}

/** Un aviso para una persona del equipo (con su id de Telegram en Ajustes → Equipo): solo a ella, nunca al dueño. */
async function alPersona(t, n) {
  // N2 (D03): si la persona tiene una CUENTA con su Telegram vinculado, el aviso va ahí (con su «no molestar»); si no, el id de Ajustes → Equipo, como siempre.
  try {
    const u = await usuarioPorNombre(t.db, n.persona);
    if (u) { const r = await avisarPorTelegram(t.env, t.db, t.cfg, u.id, esc(n.text), { conectados: await conectadosAhora(t.env) }); if (r !== 'omitido:sin-telegram' && r !== 'omitido:apagado') return; } // con su Telegram de cuenta (aunque esté en silencio) no se le manda también por el viejo
  } catch { /* cae al camino de siempre */ }
  const p = t.C.persona(n.persona);
  if (p?.telegram && /^-?\d{4,15}$/.test(String(p.telegram))) await t.send(String(p.telegram), esc(n.text));
}
export { COMANDOS, approvalText, approvalButtons };

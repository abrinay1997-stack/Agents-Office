// ============================================================
// Agents Office — Anuncios de Meta, Fase A6 (10 oct 2026): LA API DE CONVERSIONES (servidor a servidor). docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §A6.
//
// Le dice a Meta «esta persona compró» o «esta persona es un contacto de verdad» desde la oficina, sin depender del navegador del
// cliente (el píxel se pierde con bloqueadores, iOS y cookies). Meta lo usa para atribuir resultados a los anuncios y para optimizar.
// APAGADA por defecto (Ajustes → Anuncios → «API de conversiones»): el dueño todavía no confirmó si vende en una web o por mensajes,
// así que están las dos vías y él enciende la que use.
//
//   1. WEB / SISTEMA — `action_source: website` (con la dirección de la página: Meta la pide para lo de una web) o `system_generated`
//      (un pago de Stripe, un formulario sin dirección). Llegan por los disparadores (triggers.mjs: `stripe` → Purchase con su importe,
//      `form` → Lead) y por su propio webhook (POST /api/anuncios/conversiones/webhook, con AO_HOOK_TOKEN).
//   2. MENSAJES — `action_source: business_messaging` + `messaging_channel` (messenger · instagram · whatsapp). El dueño marca en una
//      conversación de la Bandeja «Registrar venta» (con el importe) o «Registrar contacto calificado»: Purchase / LeadSubmitted con
//      la página y el id del cliente en esa página (PSID en Messenger, IGSID en Instagram). WhatsApp necesita el `ctwa_clid` del clic
//      en el anuncio: solo por el webhook.
//
// LO VERIFICADO en la documentación oficial de Meta (10 oct 2026):
//   · developers.facebook.com/docs/marketing-api/conversions-api/using-the-api — POST /<PIXEL_ID>/events con `data` (un arreglo JSON,
//     hasta 1.000 eventos; si UNO no vale, Meta rechaza el lote entero) y `test_event_code` solo para probar; `event_time` en segundos
//     Unix, como mucho 7 días atrás (si no, error para toda la petición).
//   · …/conversions-api/parameters/server-event — event_name, event_time, user_data y action_source obligatorios; event_id
//     recomendado (deduplicar); event_source_url obligatorio para lo de una web. action_source: email · website · app · phone_call ·
//     chat · physical_store · system_generated · business_messaging · other.
//   · …/conversions-api/parameters/customer-information-parameters — `em` (recortar y minúsculas) y `ph` (solo dígitos, sin ceros
//     delante y CON código de país) van en SHA-256; `page_id`, `page_scoped_user_id`, `ctwa_clid`, `ig_sid`, `ig_account_id` NO se
//     cifran. `external_id`: cifrarlo es lo recomendado.
//   · …/conversions-api/business-messaging — `action_source: business_messaging`, `messaging_channel` messenger · whatsapp · instagram;
//     Messenger con `page_id` + `page_scoped_user_id`; WhatsApp con `whatsapp_business_account_id` + `ctwa_clid` (obligatorio);
//     Instagram con `instagram_business_account_id` + `ig_sid`. Eventos admitidos: Purchase, LeadSubmitted, QualifiedLead, … Un
//     conjunto de datos por página.
//   · …/conversions-api/deduplicate-pixel-and-server-events — el `eventID` del píxel y el `event_id` de aquí, con el mismo nombre de
//     evento, se cuentan una vez si llegan dentro de 48 horas.
// POR VERIFICAR con el token real (scripts/check-meta-conversiones.mjs --probar):
//   · la respuesta (`events_received`, `messages`, `fbtrace_id`): la página no la documenta; se lee si está.
//   · Instagram: la página de mensajes usa `instagram_business_account_id`, la de datos del cliente nombra `ig_account_id`. Se manda
//     el primero (el de los ejemplos de mensajes).
//   · un `event_time` en el futuro: la doc no dice; aquí se rechaza más de 5 minutos adelante (relojes desfasados).
//   · que el conjunto de datos del píxel sea el mismo que está ligado a la página (para mensajes): un conjunto por página.
//
// NUNCA SALE UN DATO PERSONAL EN CLARO: el correo y el teléfono se cifran (SHA-256) en `armarEvento`, antes de guardarse en la cola;
// lo que enseña la oficina (la página, el registro de data/audit/, los avisos) es `resumen()`, sin correo, sin teléfono, sin hashes.
// Un AGENTE NUNCA manda eventos (anuncios/rutas.mjs: 403).
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs';
import { retryConfig, classify } from '../reliability.mjs';
import { mensajeMeta } from '../contenido/meta.mjs';

export const ACTION_SOURCES = ['email', 'website', 'app', 'phone_call', 'chat', 'physical_store', 'system_generated', 'business_messaging', 'other'];
export const CANALES = ['messenger', 'instagram', 'whatsapp'];
/** Lo que el dueño elige en Ajustes (casillas) → los nombres de Meta por vía. */
export const TIPOS = { compra: { web: 'Purchase', mensajes: 'Purchase' }, contacto: { web: 'Lead', mensajes: 'LeadSubmitted' } };
export const TIPO_DE_EVENTO = { Purchase: 'compra', Lead: 'contacto', LeadSubmitted: 'contacto' };
export const DIAS_MAX = 7; // Meta: event_time hasta 7 días atrás
export const FUTURO_MAX_MS = 5 * 60e3;
export const PAIS_POR_DEFECTO = '507'; // Panamá: un teléfono de 7 u 8 dígitos sin código de país se toma como de aquí
export const RETRIES = { max: 5, backoff: [60, 300, 900, 3600, 3600 * 6] };
const LISTA_MAX = 500; // eventos guardados en data/anuncios/conversiones.json (los más viejos, ya enviados o descartados, se van)

export class ErrorConversion extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

export const sha256 = s => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
export const esHash = s => /^[0-9a-f]{64}$/.test(String(s || ''));
/** El correo como lo pide Meta antes de cifrarlo: sin espacios y en minúsculas. '' si no parece un correo. */
export const normEmail = s => { const t = String(s ?? '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : ''; };
/** El teléfono: solo dígitos, sin ceros delante, con código de país (7–8 dígitos → Panamá). '' si no alcanza. */
export function normTelefono(s, pais = PAIS_POR_DEFECTO) {
  let d = String(s ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return '';
  if (d.length <= 8 && pais) d = String(pais) + d;
  return d.length >= 8 && d.length <= 15 ? d : '';
}
/** Un `event_id` que sale igual cada vez para el mismo hecho (así un reenvío o el píxel con el mismo id cuentan una vez). */
export const idEvento = ({ origen = 'oficina', ref = '', nombre = '' } = {}) => 'ao_' + sha256(`${origen}|${ref}|${nombre}`).slice(0, 32);
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = v => Math.round(v * 100) / 100;
const httpsUrl = u => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString().slice(0, 1000) : ''; } catch { return ''; } };
const limpioId = (s, max = 64) => (/^[A-Za-z0-9._:-]{1,200}$/.test(String(s ?? '')) ? String(s).slice(0, max) : '');

/**
 * Arma UN evento de Meta (puro). Nunca guarda un dato personal en claro: lo que vuelve ya va cifrado.
 * @param {object} e  { nombre: 'Purchase'|'Lead'|'LeadSubmitted', via: 'web'|'sistema'|'mensajes', at (ms), valor, moneda, email, telefono,
 *                      externoId, url, canal, paginaId, usuarioId (PSID/IGSID), igCuentaId, wabaId, ctwaClid, eventId, origen, ref }
 * @returns {{ evento, errores: string[] }}  `evento` = el objeto que va en `data` (null si hay errores)
 */
export function armarEvento(e = {}, { ahora = Date.now(), pais = PAIS_POR_DEFECTO, monedaPorDefecto = 'USD' } = {}) {
  const errores = [];
  const nombre = String(e.nombre || '');
  if (!['Purchase', 'Lead', 'LeadSubmitted'].includes(nombre)) errores.push(`el evento «${nombre || '(vacío)'}» no es uno de los que manda la oficina (Purchase, Lead, LeadSubmitted)`);
  const via = ['web', 'sistema', 'mensajes'].includes(e.via) ? e.via : 'sistema';
  const at = num(e.at) ?? ahora;
  if (at > ahora + FUTURO_MAX_MS) errores.push('la hora del evento está en el futuro');
  if (at < ahora - DIAS_MAX * 864e5) errores.push(`el evento pasó hace más de ${DIAS_MAX} días: Meta ya no lo acepta`);
  const ev = { event_name: nombre, event_time: Math.floor(at / 1000), action_source: via === 'mensajes' ? 'business_messaging' : via === 'web' ? 'website' : 'system_generated', user_data: {} };
  const ref = String(e.ref ?? '').slice(0, 200);
  ev.event_id = limpioId(e.eventId, 100) || idEvento({ origen: e.origen || via, ref: ref || `${at}`, nombre });
  if (via === 'web') { const u = httpsUrl(e.url); if (u) ev.event_source_url = u; else errores.push('un evento de la web necesita la dirección de la página donde pasó (event_source_url)'); }
  if (via === 'mensajes') {
    const canal = String(e.canal || '');
    if (!CANALES.includes(canal)) errores.push('falta el canal del mensaje (messenger, instagram o whatsapp)');
    ev.messaging_channel = canal;
    if (nombre === 'Lead') ev.event_name = 'LeadSubmitted'; // en mensajes, Meta habla de LeadSubmitted
    const id = s => limpioId(s, 64);
    if (canal === 'messenger') { const p = id(e.paginaId), u = id(e.usuarioId); if (!p || !u) errores.push('Messenger necesita la página y el id del cliente en esa página'); ev.user_data.page_id = p; ev.user_data.page_scoped_user_id = u; }
    if (canal === 'instagram') { const c = id(e.igCuentaId), u = id(e.usuarioId); if (!c || !u) errores.push('Instagram necesita la cuenta de Instagram y el id del cliente en ella'); ev.user_data.instagram_business_account_id = c; ev.user_data.ig_sid = u; }
    if (canal === 'whatsapp') { const w = id(e.wabaId), k = id(e.ctwaClid, 200); if (!w || !k) errores.push('WhatsApp necesita la cuenta de WhatsApp Business y el ctwa_clid del clic en el anuncio'); ev.user_data.whatsapp_business_account_id = w; ev.user_data.ctwa_clid = k; }
  }
  const em = normEmail(e.email), ph = normTelefono(e.telefono, pais), ext = String(e.externoId ?? '').trim().slice(0, 200);
  if (em) ev.user_data.em = [sha256(em)];
  if (ph) ev.user_data.ph = [sha256(ph)];
  if (ext) ev.user_data.external_id = [sha256(ext)];
  if (via !== 'mensajes' && !em && !ph && !ext) errores.push('Meta necesita algo para reconocer a la persona: su correo, su teléfono o un id tuyo de cliente');
  if (ev.event_name === 'Purchase') {
    const v = num(e.valor), m = String(e.moneda || monedaPorDefecto).trim().toUpperCase();
    if (v === null || v <= 0) errores.push('una venta necesita su importe (mayor que 0)');
    if (!/^[A-Z]{3}$/.test(m)) errores.push(`la moneda «${m}» no es un código de tres letras (USD)`);
    ev.custom_data = { value: v === null ? 0 : r2(v), currency: m };
  } else if (num(e.valor) > 0) ev.custom_data = { value: r2(num(e.valor)), currency: String(e.moneda || monedaPorDefecto).toUpperCase().slice(0, 3) };
  return { evento: errores.length ? null : ev, errores };
}

/** Lo que se enseña y se registra de un evento: NUNCA correo, teléfono ni hashes. */
export function resumen(x) {
  const ev = x?.evento || {};
  return {
    id: ev.event_id || x?.id || '', evento: ev.event_name || '', tipo: TIPO_DE_EVENTO[ev.event_name] || '', fuente: ev.action_source || '',
    ...(ev.messaging_channel ? { canal: ev.messaging_channel } : {}),
    ...(ev.custom_data?.value ? { valor: ev.custom_data.value, moneda: ev.custom_data.currency } : {}),
    at: ev.event_time ? new Date(ev.event_time * 1000).toJSON() : null, origen: x?.origen || '', ref: x?.refVisible || '',
    estado: x?.estado || '', intentos: x?.intentos || 0, ...(x?.error ? { error: x.error } : {}), ...(x?.enviadoAt ? { enviadoAt: x.enviadoAt } : {}), ...(x?.prueba ? { prueba: true } : {}),
    datos: ['em', 'ph', 'external_id', 'page_scoped_user_id', 'ig_sid', 'ctwa_clid'].filter(k => ev.user_data?.[k]), // qué se mandó para reconocer a la persona (el nombre, no el dato)
  };
}

/**
 * De lo que llegó por un disparador (triggers.mjs → adapt) al evento: stripe → compra; form → contacto. null si no toca.
 * `crudo` es el cuerpo recibido (un formulario puede traer `event_id`, la dirección de la página o el teléfono con otro nombre).
 */
export function deDisparador(trigger, a, crudo = {}) {
  if (!trigger || trigger.conversion === false || !a?.fields) return null;
  const f = a.fields, c = crudo && typeof crudo === 'object' ? crudo : {};
  const pick = (...ks) => { for (const k of ks) { const v = f[k] ?? c[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v); } return ''; };
  const forzado = typeof trigger.conversion === 'string' ? trigger.conversion : '';
  if (trigger.source === 'stripe' || forzado === 'Purchase') {
    if (trigger.source === 'stripe' && !/succeeded|paid|completed/.test(String(f.type || ''))) return null; // un «created» no es una venta todavía
    return { nombre: 'Purchase', via: 'sistema', valor: num(f.amount) ?? num(pick('amount', 'value', 'valor')), moneda: f.currency || pick('currency', 'moneda'), email: f.email || pick('email', 'correo'), telefono: pick('phone', 'telefono', 'teléfono', 'tel', 'whatsapp'), origen: `disparador:${trigger.id}`, ref: a.eventId || '', eventId: pick('event_id') };
  }
  if (trigger.source === 'form' || forzado === 'Lead') {
    const url = pick('event_source_url', 'page_url', 'url', 'pagina');
    return { nombre: 'Lead', via: url ? 'web' : 'sistema', url, email: pick('email', 'correo', 'mail'), telefono: pick('phone', 'telefono', 'teléfono', 'tel', 'whatsapp', 'celular'), origen: `disparador:${trigger.id}`, ref: a.eventId || pick('submission_id', 'id') || '', eventId: pick('event_id', 'eventID') };
  }
  return null;
}

/** De una conversación de la Bandeja (contenido/bandeja-meta.mjs) al evento: venta o contacto calificado. */
export function deConversacion(item, { tipo, valor, moneda, ahora = Date.now() } = {}) {
  if (!item || item.tipo !== 'conversaciones' || item.fuente !== 'meta') throw new ErrorConversion('eso no es una conversación privada de Meta en la Bandeja', 400);
  const ig = item.red === 'instagram';
  return {
    nombre: tipo === 'venta' ? 'Purchase' : 'LeadSubmitted', via: 'mensajes', canal: ig ? 'instagram' : 'messenger', valor, moneda,
    paginaId: item.paginaId, usuarioId: item.autorId, igCuentaId: ig ? String(item.cuentaId || '').replace(/^instagram:/, '') : '',
    // una venta puede repetirse (otro pedido) pero el mismo importe en el mismo minuto es un doble clic; un contacto calificado, una vez por conversación
    origen: 'bandeja', ref: tipo === 'venta' ? `${item.id}|venta|${Number(valor) || 0}|${Math.floor(ahora / 60e3)}` : `${item.id}|contacto`,
    refVisible: item.id,
  };
}

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); renombrar(f + '.tmp', f); };
const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * La cola y el envío. Todo lo de afuera se inyecta (los tests le dan el Meta de mentira y una carpeta temporal).
 * @param {object} o
 * @param {object} o.meta      contenido/meta.mjs (enviar, tokenDe, configurado, uso) — NUNCA un fetch directo
 * @param {string} o.archivo   data/anuncios/conversiones.json
 * @param {Function} o.ajustes () → cfg.anuncios (conversiones, pixel, conversionesEventos, conversionesPrueba)
 * @param {Function} o.moneda  () → la moneda de la cuenta publicitaria ('USD' si no se sabe)
 * @param {Function} o.auditar (registro sin datos personales) → data/audit/ (kind: conversiones)
 * @param {Function} o.avisar  (texto, { level, key }) → notice()
 */
export function crearConversiones({ meta, archivo, ajustes = () => ({}), moneda = () => 'USD', ahora = () => Date.now(), auditar = () => {}, avisar = () => {}, retries = RETRIES }) {
  const aj = () => ajustes() || {};
  const encendida = () => aj().conversiones === true;
  const dataset = () => String(aj().pixel || '').trim();
  const tipos = () => (Array.isArray(aj().conversionesEventos) && aj().conversionesEventos.length ? aj().conversionesEventos : ['compra', 'contacto']);
  const codigoPrueba = () => String(aj().conversionesPrueba || '').trim();
  const leer = () => ({ eventos: [], ultimoError: null, ultimoErrorAt: null, ultimoEnvioAt: null, ...leerJSON(archivo, {}) });
  const guardar = d => { d.eventos = d.eventos.slice(-LISTA_MAX); escribirJSON(archivo, d); };
  let enMarcha = null;

  /** ¿Se puede mandar? { ok, motivo } — el motivo dice qué hacer. */
  function listo() {
    if (!encendida()) return { ok: false, motivo: 'La API de conversiones está apagada (Ajustes → Anuncios → «API de conversiones»).' };
    if (!/^\d{5,25}$/.test(dataset())) return { ok: false, motivo: 'Falta el píxel o conjunto de datos en Ajustes → Anuncios: los eventos van a ese conjunto.' };
    if (!meta.configurado()) return { ok: false, motivo: 'Meta no está conectada: falta la variable META_ACCESS_TOKEN (mira docs/conectar-meta.md).' };
    return { ok: true, motivo: '' };
  }

  /**
   * Pone un evento en la cola (no lo manda: lo hace `tick`, ahora mismo si se pide). Idempotente por `event_id`.
   * → { ok, ya?, resumen } · lanza ErrorConversion (409 apagada o sin ese tipo; 422 datos que no alcanzan)
   */
  function registrar(entrada, { quien = 'dueno', prueba = false } = {}) {
    if (!prueba && !encendida()) throw new ErrorConversion(listo().motivo, 409); // sin píxel o sin token, se guarda y sale cuando esté
    const tipo = TIPO_DE_EVENTO[entrada?.nombre];
    if (!prueba && !tipos().includes(tipo)) throw new ErrorConversion(`no mandas eventos de ${tipo === 'compra' ? 'compras' : 'contactos'} (Ajustes → Anuncios → «Eventos que se mandan»)`, 409);
    const { evento, errores } = armarEvento(entrada, { ahora: ahora(), monedaPorDefecto: moneda() || 'USD' });
    if (!evento) throw new ErrorConversion(errores.join('; '), 422);
    const d = leer();
    const ya = d.eventos.find(x => x.id === evento.event_id);
    if (ya) return { ok: true, ya: true, resumen: resumen(ya) };
    const x = { id: evento.event_id, evento, estado: 'pendiente', intentos: 0, proximo: ahora(), creadoAt: new Date(ahora()).toJSON(), origen: String(entrada.origen || quien).slice(0, 60), refVisible: String(entrada.refVisible || '').slice(0, 120), quien, ...(prueba ? { prueba: true } : {}) };
    d.eventos.push(x); guardar(d);
    auditar({ que: 'registrar', quien, ...resumen(x) });
    return { ok: true, resumen: resumen(x) };
  }

  /** Manda UN evento a Meta por el cliente de contenido/meta.mjs (el freno por uso y VERSION_GRAPH incluidos). */
  async function mandar(x, { codigo = '' } = {}) {
    const token = await meta.tokenDe(null);
    const r = await meta.enviar(token, `/${encodeURIComponent(dataset())}/events`, { campos: { data: [x.evento], ...(codigo ? { test_event_code: codigo } : {}) } });
    return { recibidos: Number(r?.events_received ?? NaN), mensajes: Array.isArray(r?.messages) ? r.messages.slice(0, 3).map(String) : [], traza: r?.fbtrace_id ? String(r.fbtrace_id) : '' };
  }

  /** Manda lo pendiente cuya hora llegó, de uno en uno (Meta rechaza el lote entero si uno no vale). → { enviados, fallos } */
  function tick() {
    if (enMarcha) return enMarcha;
    enMarcha = (async () => {
      const salida = { enviados: 0, fallos: 0 };
      if (!listo().ok) return salida;
      const R = retryConfig(retries);
      for (const id of leer().eventos.filter(x => x.estado === 'pendiente' && (x.proximo || 0) <= ahora()).map(x => x.id)) {
        let d = leer(), x = d.eventos.find(e => e.id === id); if (!x || x.estado !== 'pendiente') continue;
        if (x.evento.event_time * 1000 < ahora() - DIAS_MAX * 864e5) { // pasaron los 7 días esperando: Meta ya no lo toma
          x.estado = 'descartado'; x.error = `pasaron más de ${DIAS_MAX} días sin poder mandarlo: Meta ya no lo acepta`; guardar(d); auditar({ que: 'descartar', ...resumen(x) }); continue;
        }
        try {
          const r = await mandar(x, { codigo: x.prueba ? codigoPrueba() : '' });
          d = leer(); x = d.eventos.find(e => e.id === id); if (!x) continue;
          x.estado = 'enviado'; x.enviadoAt = new Date(ahora()).toJSON(); x.intentos++; delete x.error; if (r.traza) x.traza = r.traza;
          d.ultimoEnvioAt = x.enviadoAt; guardar(d); salida.enviados++;
          auditar({ que: 'enviar', ...resumen(x), recibidos: Number.isFinite(r.recibidos) ? r.recibidos : null });
        } catch (e) {
          const motivo = mensajeMeta(e);
          d = leer(); x = d.eventos.find(z => z.id === id); if (!x) continue;
          x.intentos++; x.error = motivo; d.ultimoError = motivo; d.ultimoErrorAt = new Date(ahora()).toJSON();
          const pasajero = e?.transitorio || e?.frenado || ['transient', 'limit', 'timeout'].includes(classify(e?.message));
          if (pasajero && x.intentos <= R.max) x.proximo = ahora() + R.backoff[Math.min(x.intentos - 1, R.backoff.length - 1)] * 1000;
          else { x.estado = 'fallo'; avisar(`Meta no aceptó un evento de conversión (${x.evento.event_name}): ${motivo}`, { level: 'warn', key: 'conversiones-fallo' }); }
          guardar(d); salida.fallos++;
          auditar({ que: pasajero && x.estado === 'pendiente' ? 'reintentar' : 'fallo', ...resumen(x) });
          if (e?.frenado) break; // Meta pidió esperar: lo demás, en el próximo tick
        }
      }
      return salida;
    })().finally(() => { enMarcha = null; });
    return enMarcha;
  }

  /** «Mandar un evento de prueba»: uno solo, con el código de prueba (Administrador de eventos → Probar eventos). Ahora mismo. */
  async function probar({ codigo } = {}) {
    const c = String(codigo || codigoPrueba()).trim();
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(c)) throw new ErrorConversion('falta el código de prueba (Administrador de eventos → tu conjunto de datos → «Probar eventos»; se pone en Ajustes → Anuncios)', 409);
    if (!/^\d{5,25}$/.test(dataset())) throw new ErrorConversion('falta el píxel o conjunto de datos en Ajustes → Anuncios', 409);
    if (!meta.configurado()) throw new ErrorConversion('Meta no está conectada: falta la variable META_ACCESS_TOKEN', 409);
    const { evento } = armarEvento({ nombre: 'Lead', via: 'sistema', externoId: 'agents-office-prueba', origen: 'prueba', ref: String(ahora()) }, { ahora: ahora() });
    const x = { id: evento.event_id, evento, estado: 'pendiente', intentos: 0, creadoAt: new Date(ahora()).toJSON(), origen: 'prueba', prueba: true };
    try {
      const r = await mandar(x, { codigo: c });
      x.estado = 'enviado'; x.enviadoAt = new Date(ahora()).toJSON(); x.intentos = 1;
      const d = leer(); d.eventos.push(x); guardar(d); auditar({ que: 'probar', ...resumen(x) });
      return { ok: true, resumen: resumen(x), recibidos: Number.isFinite(r.recibidos) ? r.recibidos : null, texto: 'Mandé un evento de prueba («Lead», sin datos de nadie). Míralo en el Administrador de eventos → «Probar eventos»: sale en uno o dos minutos.' };
    } catch (e) { const motivo = mensajeMeta(e); auditar({ que: 'probar-fallo', error: motivo }); throw new ErrorConversion(`Meta no aceptó el evento de prueba: ${motivo}`, 502); }
  }

  /** Lo que se enseña (sin datos personales). */
  function estado({ ultimos = 20 } = {}) {
    const d = leer(), l = listo(), hoy = d.eventos.filter(x => !x.prueba && x.enviadoAt && mismoDia(x.enviadoAt, ahora()));
    return {
      encendida: encendida(), listo: l.ok, motivo: l.motivo, dataset: dataset() || null, eventos: tipos(), prueba: Boolean(codigoPrueba()), conMeta: meta.configurado(),
      hoy: { enviados: hoy.length, compras: hoy.filter(x => x.evento.event_name === 'Purchase').length, contactos: hoy.filter(x => x.evento.event_name !== 'Purchase').length },
      pendientes: d.eventos.filter(x => x.estado === 'pendiente').length, fallos: d.eventos.filter(x => x.estado === 'fallo').length,
      ultimoError: d.ultimoError, ultimoErrorAt: d.ultimoErrorAt, ultimoEnvioAt: d.ultimoEnvioAt,
      ultimos: d.eventos.slice(-ultimos).reverse().map(resumen),
    };
  }

  /** Lo vendido que se registró por aquí (compras enviadas o en cola, sin las de prueba) desde `desde` (ms). → { compras, vendido } */
  function ventas(desde = 0, hasta = Infinity) {
    let compras = 0, vendido = 0;
    for (const x of leer().eventos) {
      if (x.prueba || x.evento.event_name !== 'Purchase' || !['enviado', 'pendiente'].includes(x.estado)) continue;
      const t = x.evento.event_time * 1000; if (t < desde || t > hasta) continue;
      compras++; vendido += Number(x.evento.custom_data?.value) || 0;
    }
    return { compras, vendido: r2(vendido) };
  }

  /** Lo registrado de una conversación de la Bandeja (para enseñarlo en ella). */
  const deItem = itemId => leer().eventos.filter(x => x.refVisible === itemId).map(resumen);

  return { listo, registrar, tick, probar, estado, ventas, deItem, encendida, enMarcha: () => Boolean(enMarcha) };
}

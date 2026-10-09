// El BORRADOR de una campaña en la página (Fase A3, 9 oct 2026; plan §5.A3, §8 y §12). Puro: lo usan el asistente, la demo y
// tests/anuncios-vista.test.mjs. Aquí vive lo que la página necesita saber del borrador sin preguntar al servidor: los cinco pasos y su
// orden, los objetivos en palabras del dueño, las llamadas a la acción de cada objetivo, las mejoras automáticas de Meta una por una,
// a qué paso (y a qué campo) lleva cada problema de la revisión, y el costo máximo en palabras. Quien decide de verdad es el servidor
// (`POST /api/anuncios/borradores/<id>/validar`, que pregunta a Meta con validate_only): lo de aquí solo guía.
import { dinero } from './comun.js';

/** Los cinco pasos del asistente, en su orden. */
export const PASOS = [
  { k: 'objetivo', n: 'Objetivo' },
  { k: 'publico', n: 'Público' },
  { k: 'presupuesto', n: 'Presupuesto y fechas' },
  { k: 'creativos', n: 'Creativos' },
  { k: 'revision', n: 'Revisión' },
];

/** Los objetivos, como los diría el dueño (plan §5.A3 paso 1). `enlace`: pide la dirección de la web. */
export const OBJETIVOS = [
  { k: 'mensajes', n: 'Que me escriban', d: 'Por WhatsApp, Instagram o Messenger: lo más habitual para un negocio local.', meta: 'OUTCOME_ENGAGEMENT', enlace: false },
  { k: 'web', n: 'Visitas a mi web', d: 'Que entren a tu página y miren.', meta: 'OUTCOME_TRAFFIC', enlace: true },
  { k: 'ventas', n: 'Ventas en mi web', d: 'Que compren en tu tienda en línea. Necesita el píxel de Meta en tu web: si no está, la revisión te lo dirá.', meta: 'OUTCOME_SALES', enlace: true },
  { k: 'contactos', n: 'Contactos con formulario', d: 'Que dejen su nombre y su teléfono en un formulario de Meta, sin salir de Instagram o Facebook.', meta: 'OUTCOME_LEADS', enlace: false },
  { k: 'conocer', n: 'Que me conozcan', d: 'Que mucha gente de la zona vea tu marca. No busca mensajes ni ventas.', meta: 'OUTCOME_AWARENESS', enlace: false },
];
export const DESTINOS = [
  { k: 'whatsapp', n: 'WhatsApp' },
  { k: 'instagram', n: 'Instagram Direct' },
  { k: 'messenger', n: 'Messenger' },
];
export const objetivoDe = k => OBJETIVOS.find(o => o.k === k) || null;
export function objetivoTexto(b) {
  const o = objetivoDe(b?.objetivo); if (!o) return 'Sin objetivo';
  if (o.k === 'mensajes') { const d = DESTINOS.find(x => x.k === b.destino); return d ? `Que me escriban por ${d.n}` : 'Que me escriban'; }
  return o.n;
}

/** Las llamadas a la acción (los valores de Meta y su nombre en español). */
export const LLAMADA = {
  WHATSAPP_MESSAGE: 'Enviar WhatsApp', MESSAGE_PAGE: 'Enviar mensaje', INSTAGRAM_MESSAGE: 'Enviar mensaje por Instagram', LEARN_MORE: 'Más información', SHOP_NOW: 'Comprar',
  ORDER_NOW: 'Pedir ahora', BUY_NOW: 'Comprar ya', GET_OFFER: 'Ver la oferta', SIGN_UP: 'Registrarte', CONTACT_US: 'Contactarnos', APPLY_NOW: 'Solicitar',
  GET_QUOTE: 'Pedir presupuesto', SUBSCRIBE: 'Suscribirte', BOOK_NOW: 'Reservar', NO_BUTTON: 'Sin botón',
};
const LLAMADAS = {
  mensajes: { whatsapp: ['WHATSAPP_MESSAGE', 'LEARN_MORE', 'SHOP_NOW', 'BOOK_NOW'], instagram: ['INSTAGRAM_MESSAGE', 'MESSAGE_PAGE', 'LEARN_MORE', 'SHOP_NOW'], messenger: ['MESSAGE_PAGE', 'LEARN_MORE', 'SHOP_NOW', 'BOOK_NOW'], '': ['MESSAGE_PAGE', 'LEARN_MORE'] },
  web: ['LEARN_MORE', 'SHOP_NOW', 'BOOK_NOW', 'SIGN_UP', 'CONTACT_US', 'GET_OFFER'],
  ventas: ['SHOP_NOW', 'BUY_NOW', 'ORDER_NOW', 'GET_OFFER', 'LEARN_MORE'],
  contactos: ['SIGN_UP', 'GET_QUOTE', 'APPLY_NOW', 'SUBSCRIBE', 'LEARN_MORE'],
  conocer: ['LEARN_MORE', 'CONTACT_US', 'NO_BUTTON'],
};
/** Las llamadas que tienen sentido para ese objetivo (y destino), la primera es la de por defecto. */
export function llamadasDe(objetivo, destino) {
  const l = LLAMADAS[objetivo]; if (!l) return ['LEARN_MORE'];
  return Array.isArray(l) ? l : l[destino || ''] || l[''];
}

/** Los formatos de un creativo: dónde se ve cada uno. */
export const FORMATOS = [
  { k: '1:1', n: 'Cuadrado 1:1', d: 'feed' },
  { k: '4:5', n: 'Vertical 4:5', d: 'feed (ocupa más pantalla)' },
  { k: '9:16', n: 'Alto 9:16', d: 'historias y reels' },
  { k: '', n: 'Que Meta lo ajuste', d: 'Meta recorta para cada lugar' },
];
/** Del ancho y alto de un archivo, el formato que le toca (o '' si no encaja en ninguno). */
export function formatoDeMedidas(w, h) {
  const r = Number(w) / Number(h); if (!(r > 0) || !Number.isFinite(r)) return '';
  if (r >= 0.95 && r <= 1.05) return '1:1';
  if (r >= 0.75 && r < 0.95) return '4:5';
  if (r >= 0.5 && r <= 0.6) return '9:16';
  return '';
}

/** Las mejoras automáticas de Meta, una por una (plan §5.A3 paso 4 y §12: solo las que no tocan el texto, encendidas). */
export const MEJORAS = [
  { k: 'texto', n: 'Mejorar el texto', d: 'Meta puede reescribir, acortar o cambiar de orden tu texto principal y tu titular. Apagada, lo que escribes sale tal cual.', def: false },
  { k: 'retoques', n: 'Retoques de imagen', d: 'Brillo y contraste automáticos, sin cambiar lo que se ve en la foto.', def: true },
  { k: 'recorte', n: 'Ajustar al espacio', d: 'Recorta o amplía la imagen o el video para cada lugar (feed, historias, reels), así no quedan bandas.', def: true },
  { k: 'plantilla', n: 'Plantilla con marco', d: 'Pone un marco o un fondo con tu texto alrededor de la imagen. Cambia el aspecto de tu marca.', def: false },
];
export const MEJORAS_DEF = Object.fromEntries(MEJORAS.map(m => [m.k, m.def]));

export const CATEGORIAS = [
  { k: '', n: 'Ninguna', d: 'Lo normal: un producto o un servicio.' },
  { k: 'EMPLOYMENT', n: 'Empleo', d: 'Ofertas de trabajo, prácticas, formación para un puesto.' },
  { k: 'HOUSING', n: 'Vivienda', d: 'Alquiler o venta de casas, seguros de hogar, hipotecas.' },
  { k: 'FINANCIAL_PRODUCTS_SERVICES', n: 'Crédito y finanzas', d: 'Préstamos, tarjetas, financiación de compras a plazos.' },
  { k: 'ISSUES_ELECTIONS_POLITICS', n: 'Política o temas sociales', d: 'Elecciones, candidatos, leyes, causas sociales. Meta pide además una autorización.' },
];
export const PAISES = [['PA', 'Panamá'], ['CR', 'Costa Rica'], ['CO', 'Colombia'], ['MX', 'México'], ['US', 'Estados Unidos'], ['ES', 'España'], ['DO', 'República Dominicana'], ['GT', 'Guatemala'], ['SV', 'El Salvador'], ['HN', 'Honduras'], ['NI', 'Nicaragua'], ['EC', 'Ecuador'], ['PE', 'Perú'], ['CL', 'Chile'], ['AR', 'Argentina'], ['VE', 'Venezuela']];
export const paisNombre = k => (PAISES.find(([c]) => c === k) || [k, k])[1];

/** Los límites de Meta para que el texto no se corte (lo que se ve sin «Ver más»), como guía: el servidor dice lo que no pasa. */
export const LARGO = { texto: 125, titular: 40, descripcion: 30 };
export const MAX_CREATIVOS = 6, MIN_RECOMENDADO = 3;

/* ---------- a qué paso lleva cada problema ---------- */
const META_PASO = [
  [/^(objective|promoted_object|destination_type|optimization_goal|pixel|link|enlace|url)/i, 'objetivo'],
  [/^(targeting|geo_locations|age_min|age_max|special_ad_categor|audience|interests)/i, 'publico'],
  [/^(daily_budget|lifetime_budget|start_time|end_time|spend_cap|bid_strategy|budget|presupuesto|tope)/i, 'presupuesto'],
  [/^(creative|object_story_spec|call_to_action|image_hash|video_id|asset_feed_spec|degrees_of_freedom)/i, 'creativos'],
];
/**
 * El campo de un problema de la revisión → { paso (índice 0..4), k (clave del paso), campo (el campo de la página, o null) }.
 * Admite los campos del borrador («publico.edadMin», «creativos.2.texto», «creativos[2].texto», «presupuesto») y algunos de Meta
 * («daily_budget», «targeting»); lo que no se reconoce va a la Revisión.
 */
export function pasoDe(campo) {
  const c = String(campo || '').trim().replace(/\[(\d+)\]/g, '.$1');
  const r = (k, cm = c || null) => ({ paso: PASOS.findIndex(p => p.k === k), k, campo: cm });
  if (!c) return r('revision', null);
  const raiz = c.split('.')[0];
  if (['objetivo', 'destino', 'enlace'].includes(raiz)) return r('objetivo');
  if (raiz === 'publico' || raiz === 'categoriaEspecial') return r('publico');
  if (['presupuesto', 'inicio', 'fin'].includes(raiz)) return r('presupuesto', raiz === 'presupuesto' && c === 'presupuesto' ? 'presupuesto.usd' : c);
  if (raiz === 'creativos' || raiz === 'mejoras' || raiz === 'origen') return r('creativos'); // A4: la publicación que se impulsa va en el paso 4
  if (raiz === 'nombre') return r('objetivo', 'nombre');
  for (const [re, k] of META_PASO) if (re.test(c)) return r(k, null);
  return r('revision', null);
}

/* ---------- el costo máximo en palabras ---------- */
/** { dia, total, campana } → «hasta 5,00 US$ al día · 70,00 US$ en total · tope de la campaña 150,00 US$». Sin cifras, ''. */
export function costoTexto(c, moneda = 'USD') {
  if (!c) return '';
  const p = [];
  if (c.dia != null) p.push(`hasta ${dinero(c.dia, moneda)} al día`);
  if (c.total != null) p.push(`${c.dia != null ? '' : 'hasta '}${dinero(c.total, moneda)} en total`);
  else if (c.dia != null) p.push('sin fecha de fin, el total no tiene límite');
  if (c.campana != null) p.push(`tope de la campaña ${dinero(c.campana, moneda)}`);
  return p.join(' · ');
}
/** El aviso del paso 3 (la regla del tope por campaña de la A2): presupuesto diario sin fecha de fin = no se podrá activar. */
export function avisoSinFin(b) {
  return b?.presupuesto?.tipo === 'diario' && !b?.fin ? 'Sin fecha de fin, una campaña de presupuesto diario no cabe en tu tope por campaña: podrás crearla en pausa, pero no activarla hasta ponerle fin.' : '';
}

/* ---------- quién y en qué estado ---------- */
export function deQuien(de, agentName = id => id) {
  const s = String(de || 'dueno');
  if (s === 'dueno') return 'Tú';
  if (s === 'dimitri') return 'Dimitri';
  if (s.startsWith('agente:')) { const id = s.slice(7); return `${String(agentName(id) || id).toUpperCase()} (agente)`; }
  return s;
}
/* ---------- Fase A4 (9 oct 2026): impulsar una publicación (b.origen) ---------- */
export const RED_ORIGEN = { instagram: 'Instagram', facebook: 'Facebook' };
/** «se impulsa la publicación de Instagram del 5 oct» (sin fecha si no se sabe). */
export function origenTexto(b) {
  const o = b?.origen; if (!o) return '';
  const t = Date.parse(o.publicadaAt || ''), f = Number.isFinite(t) ? new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';
  return `se impulsa la publicación de ${RED_ORIGEN[o.red] || o.red}${f ? ` del ${f}` : ''}`;
}
export const ESTADO_B = { borrador: ['Borrador', 'gris'], creando: ['Creando en Meta…', 'ambar'], creado: ['Creado en pausa', 'verde'], fallo: ['No se pudo crear', 'rojo'] };
export const estadoB = b => { const [t, tono] = ESTADO_B[b?.estado] || ESTADO_B.borrador; return { texto: t, tono }; };
export const editable = b => !b || b.estado === 'borrador' || b.estado === 'fallo';

/* ---------- leer y cambiar un campo por su ruta ---------- */
export function leer(b, ruta) { return String(ruta).split('.').reduce((o, k) => (o == null ? undefined : o[k]), b); }
/** Devuelve una COPIA del borrador con ese campo cambiado y la clave de arriba que hay que mandar en el PATCH. */
export function poner(b, ruta, v) {
  const partes = String(ruta).split('.'), copia = structuredClone(b || {});
  let o = copia;
  for (let i = 0; i < partes.length - 1; i++) { const k = partes[i]; if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(partes[i + 1]) ? [] : {}; o = o[k]; }
  o[partes.at(-1)] = v;
  return { b: copia, raiz: partes[0] };
}

/** Un creativo nuevo para un archivo de la galería. */
export function creativoNuevo(media, { formato = '', objetivo = 'mensajes', destino = 'whatsapp', id } = {}) {
  return { id: id || 'cr-' + Math.random().toString(36).slice(2, 9), media, formato: formato || null, texto: '', titular: '', descripcion: '', llamada: llamadasDe(objetivo, destino)[0] };
}
/** Al cambiar de objetivo o destino, la llamada que ya no vale pasa a la primera del nuevo. */
export function ajustarLlamadas(b) {
  const l = llamadasDe(b.objetivo, b.destino);
  return { ...b, creativos: (b.creativos || []).map(c => (l.includes(c.llamada) ? c : { ...c, llamada: l[0] })) };
}

/**
 * La vista previa de Meta (`GET …/vista-previa`) llega como HTML con un <iframe> de facebook.com. NUNCA se pinta ese HTML: se saca
 * solo la dirección del iframe, y solo si es la de las vistas previas de Meta (https://www.facebook.com/ads/api/preview_iframe.php).
 * → la dirección limpia o null.
 */
export function iframeMeta(html) {
  const m = /<iframe\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(String(html || '')); if (!m) return null;
  const crudo = (m[2] ?? m[3] ?? '').replace(/&amp;/g, '&');
  let u; try { u = new URL(crudo); } catch { return null; }
  if (u.protocol !== 'https:' || !/^(www\.)?facebook\.com$/.test(u.hostname) || !u.pathname.startsWith('/ads/api/preview_iframe.php')) return null;
  return u.href;
}
export const UBICACIONES_META = [['MOBILE_FEED_STANDARD', 'Feed de Facebook'], ['INSTAGRAM_STANDARD', 'Feed de Instagram'], ['INSTAGRAM_STORY', 'Historia de Instagram']];

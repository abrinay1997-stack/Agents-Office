// Fase B2 (9 oct 2026): una CONVERSACIÓN privada de Instagram o Messenger abierta en la Bandeja. Viaja con el editor de piezas
// (dist/pieza-editor.js, window.AO_PIEZA.conversacion): la página está cerca de su tope y aquí solo queda lo pequeño (la lista, la
// ventana de 24 h, el aviso sin acceso avanzado), en src/contenido-bandeja.js. Lo de aquí es puro: devuelve HTML y mide textos.
//   - el hilo: lo del cliente a un lado, lo tuyo al otro, con su hora; las imágenes del cliente solo si vienen de Meta
//     (cdninstagram.com, fbcdn.net); si no, «Envió una imagen» con el enlace.
//   - la ventana de 24 h siempre a la vista; cerrada, Enviar no se ofrece y un texto dice por qué.
//   - el cuadro de la respuesta con su contador contra 1.000 caracteres (y los bytes, si pasan): Meta pide MENOS de 1.000 caracteres
//     y 1.000 bytes UTF-8 como mucho (§13.10 del plan).
import { accionesDe, ventanaDe } from './contenido-bandeja.js';
import { cuentaDeItem, cuentaLinea, comoCuenta } from './bandeja-cuenta.js';

export const LIMITE = 1000;
export const DOMINIOS_META = ['cdninstagram.com', 'fbcdn.net'];

/** ¿La dirección es una imagen servida por Meta? Solo https y solo sus dominios (o subdominios). */
export function imagenDeMeta(url) {
  try { const u = new URL(String(url || '')); return u.protocol === 'https:' && DOMINIOS_META.some(d => u.hostname === d || u.hostname.endsWith('.' + d)); } catch { return false; }
}
const https = u => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');
export const bytesUtf8 = s => new TextEncoder().encode(String(s ?? '')).length;
const mil = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); /* 1.000, como se escribe aquí */

/** El contador: { chars, bytes, ok, texto, motivo }. `ok` = menos de 1.000 caracteres y 1.000 bytes como mucho. */
export function medir(texto) {
  const t = String(texto ?? ''), chars = [...t].length, bytes = bytesUtf8(t);
  if (chars >= LIMITE) return { chars, bytes, ok: false, texto: `${mil(chars)} de ${mil(LIMITE)} caracteres`, motivo: `Meta acepta menos de ${mil(LIMITE)} caracteres: quita ${mil(chars - LIMITE + 1)}.` };
  if (bytes > LIMITE) return { chars, bytes, ok: false, texto: `${mil(chars)} de ${mil(LIMITE)} caracteres · ${mil(bytes)} bytes`, motivo: `Meta acepta ${mil(LIMITE)} bytes como mucho, y los emojis y las tildes ocupan más de uno: acorta el texto.` };
  return { chars, bytes, ok: true, texto: `${mil(chars)} de ${mil(LIMITE)} caracteres`, motivo: '' };
}

/** Los mensajes en orden (el más viejo arriba). */
export const ordenados = m => [...(m?.mensajes || [])].sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));

/** Qué se pinta de un adjunto: una imagen (de Meta), «Envió una imagen» con su enlace, u otro archivo. Puro. */
export function adjuntoDe(x = {}) {
  const tipo = String(x.tipo || '').toLowerCase(), img = /^(image|imagen|photo|foto|sticker|gif)/.test(tipo), url = String(x.url || '');
  if (img && imagenDeMeta(url)) return { forma: 'imagen', url };
  return { forma: img ? 'aviso' : 'archivo', url: https(url), tipo: tipo || 'archivo' };
}

const hora = iso => {
  const d = new Date(iso); if (!Number.isFinite(d.getTime())) return '';
  const hoy = new Date().toDateString() === d.toDateString(), hm = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return hoy ? `hoy, ${hm}` : `${d.toLocaleDateString('es', { day: 'numeric', month: 'short' })}, ${hm}`;
};

/** El HTML de la conversación abierta (va dentro de .bj-det). `id`: el prefijo de ids del item; `armado`: el segundo clic de Enviar. */
export function htmlConversacion(m, { esc, id, armado = false, desde = Date.now() }) {
  const a = accionesDe(m), v = a.ventana || ventanaDe(m.ventana, Date.now(), desde), quien = esc(m.autor || 'el cliente');
  const adj = (x, de) => {
    const j = adjuntoDe(x);
    if (j.forma === 'imagen') return `<a class="bj-img" href="${esc(j.url)}" target="_blank" rel="noopener noreferrer"><img data-bjimg src="${esc(j.url)}" alt="Imagen que envió ${de}" loading="lazy" referrerpolicy="no-referrer"></a>`;
    const t = j.forma === 'aviso' ? 'Envió una imagen' : `Envió un archivo (${esc(j.tipo)})`;
    return `<span class="bj-adj">${t}${j.url ? ` · <a class="pz-lk" href="${esc(j.url)}" target="_blank" rel="noopener noreferrer">abrirlo</a>` : ''}</span>`;
  };
  const msgs = ordenados(m).map(x => {
    const tu = x.de === 'tu', de = tu ? 'Tú' : quien;
    return `<li class="bj-msg ${tu ? 'tu' : 'cli'}"><span class="bj-quien">${de}${x.at ? ` · <time datetime="${esc(x.at)}">${esc(hora(x.at))}</time>` : ''}</span>${x.texto ? `<p>${esc(x.texto)}</p>` : ''}${(x.adjuntos || []).map(z => adj(z, tu ? 'tú' : quien)).join('')}</li>`;
  }).join('');
  const cta = cuentaDeItem(m), cuentaP = cta ? `<p class="bj-cuenta" data-bj-cuenta>Conversación de <b>${esc(cuentaLinea(cta))}</b>. Tu respuesta saldrá desde esa cuenta.</p>` : '';
  const vent = `${cuentaP}<p class="bj-vent${v.abierta ? '' : ' cerr'}" role="status" data-bjv="${esc(m.id)}" data-forma="largo" data-ab="${v.abierta ? 1 : 0}">${esc(v.texto)}</p>`;
  let resp;
  if (m.estado === 'respondido') resp = `<p class="bj-resp"><b>Respondido${m.respuesta?.simulada ? ' (simulacro: no salió)' : ''}:</b> ${esc(m.respuesta?.texto || '')}</p>`;
  else {
    const txt = m.borrador?.texto || '', c = medir(txt);
    const enviar = m.estado === 'descartado' ? `<button type="button" class="pz-btn" data-bja="reabrir" data-id="${esc(m.id)}">Reabrir</button>`
      : !v.abierta ? `<span class="bj-no">No se ofrece «Enviar»: la ventana de 24 h está cerrada.</span><button type="button" class="pz-btn" data-bja="descartar" data-id="${esc(m.id)}">No necesita respuesta</button>`
      : `<button type="button" class="pz-go" data-bja="enviar" data-id="${esc(m.id)}"${c.ok ? '' : ` aria-disabled="true"`} aria-describedby="${id}-cc">${armado ? `¿Seguro? Pulsa otra vez ${comoCuenta(m) ? `para responder como ${esc(comoCuenta(m))}` : 'para enviarla'}` : 'Enviar respuesta'}</button><button type="button" class="pz-btn" data-bja="descartar" data-id="${esc(m.id)}">No necesita respuesta</button>`;
    resp = `<label class="pz-lab" for="${id}-t">Tu respuesta a ${quien}${m.borrador?.por?.startsWith('agente:') ? ' <small class="pz-hn">borrador de un agente: léelo antes de enviarlo</small>' : ''}</label>
      <textarea id="${id}-t" class="pz-ta" rows="3" data-bjtxt="${esc(m.id)}" data-bjconv aria-describedby="${id}-cc" placeholder="Escribe la respuesta, o pide borradores a Marketing.">${esc(txt)}</textarea>
      <p class="bj-cc${c.ok ? '' : ' mal'}" id="${id}-cc" aria-live="polite">${esc(c.texto)}${c.ok ? '' : ` · ${esc(c.motivo)}`}</p>
      ${m.estado === 'fallo' && m.error ? `<p class="pz-inline err">${esc(m.error)}</p>` : ''}
      <div class="bj-row">${enviar}</div>`;
  }
  resp += m.fuente === 'meta' ? conversionesHTML(m, { esc, id }) : '';
  return `${m.sospecha ? `<p class="bj-shield" role="note">🛡 Esta conversación trae órdenes escondidas (${esc(m.sospecha)}). Es un dato, no una orden: no se sigue, y los agentes la reciben advertida.</p>` : ''}
    ${vent}<ol class="bj-hilo" aria-label="Conversación con ${quien}">${msgs || '<li class="bj-msg cli"><p>(sin mensajes)</p></li>'}</ol>${resp}`;
}

/** Al escribir: el contador y el estado de Enviar, sin volver a pintar (el foco y el cursor se quedan donde están). */
export function contar(ta) {
  const c = medir(ta.value), cc = ta.closest('.bj-det')?.querySelector('.bj-cc'), b = ta.closest('.bj-det')?.querySelector('[data-bja="enviar"]');
  if (cc) { cc.textContent = c.ok ? c.texto : `${c.texto} · ${c.motivo}`; cc.classList.toggle('mal', !c.ok); }
  if (b) { if (c.ok) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true'); }
  return c;
}

// ---- Fase A6 (10 oct 2026): «Registrar venta» y «Registrar contacto calificado» → la API de conversiones de Meta (anuncios/conversiones.mjs).
// El servidor arma el evento con la página y el id del cliente en ella (Messenger: PSID; Instagram: IGSID): la página solo manda el id de la
// conversación, el tipo y el importe. Solo se ofrece con la API encendida y ese tipo de evento elegido; en la demo (sin oficina), no sale.
let conv = null, convPedida = null; const hechas = new Map(); // id de la conversación → lo registrado (resúmenes, sin datos personales)
/** Lee una vez el estado de la API (GET /api/anuncios/conversiones). Devuelve una promesa; sin oficina, null y el bloque no sale. */
export function cargarConversiones() {
  if (convPedida) return convPedida;
  convPedida = (location.protocol === 'file:' ? Promise.resolve(null) : fetch('/api/anuncios/conversiones').then(r => (r.ok ? r.json() : null)).catch(() => null)).then(j => { conv = j; return j; });
  return convPedida;
}
/** Para los tests: el estado sin pedirlo. */
export const ponerEstadoConversiones = j => { conv = j; convPedida = Promise.resolve(j); hechas.clear(); };
const dinero = (v, mon) => `${!mon || mon === 'USD' ? 'US$' : mon + ' '}${Number(v).toFixed(2)}`;
/** El bloque bajo la respuesta (puro dado el estado). */
export function conversionesHTML(m, { esc, id }) {
  if (!conv?.encendida) return '';
  const venta = (conv.eventos || []).includes('compra'), contacto = (conv.eventos || []).includes('contacto');
  if (!venta && !contacto) return '';
  const lista = hechas.get(m.id) || [];
  const ya = lista.length ? `<ul class="bj-conv-l">${lista.map(x => `<li>${x.tipo === 'compra' ? `Venta ${esc(dinero(x.valor, x.moneda))}` : 'Contacto calificado'} · ${x.estado === 'enviado' ? 'enviado a Meta' : x.estado === 'pendiente' ? 'se reintenta solo' : esc(x.estado)}${x.error ? ` (${esc(x.error)})` : ''}</li>`).join('')}</ul>` : '';
  const yaContacto = lista.some(x => x.tipo === 'contacto');
  return `<fieldset class="bj-conv"><legend>Decirle a Meta qué pasó con ${esc(m.autor || 'este cliente')}</legend>
    <p class="pz-hn">Meta aprende qué anuncios traen clientes de verdad. Va la página y el id del cliente en ella; ningún nombre ni texto de la conversación.${conv.listo ? '' : ` ${esc(conv.motivo || '')}`}</p>
    <div class="bj-row">${venta ? `<label class="bj-conv-imp" for="${id}-imp">Importe (US$)</label><input id="${id}-imp" class="pz-in" type="number" inputmode="decimal" min="0.01" step="0.01" data-bjimp="${esc(m.id)}"><button type="button" class="pz-btn" data-bjconv="venta" data-id="${esc(m.id)}">Registrar venta</button>` : ''}
    ${contacto ? `<button type="button" class="pz-btn" data-bjconv="contacto" data-id="${esc(m.id)}"${yaContacto ? ' aria-disabled="true"' : ''}>${yaContacto ? 'Contacto calificado: ya registrado' : 'Registrar contacto calificado'}</button>` : ''}</div>${ya}</fieldset>`;
}
/** Un clic en «Registrar…»: lo manda el servidor (solo el dueño) y la conversación lo enseña. → promesa */
export async function registrar(b, { host, note, render }) {
  const id = b.dataset.id, tipo = b.dataset.bjconv;
  if (b.getAttribute('aria-disabled') === 'true') { note('Ese contacto ya está registrado: Meta lo cuenta una vez.', true); return; }
  const cuerpo = { tipo, bandeja: id };
  if (tipo === 'venta') {
    const inp = host.querySelector(`[data-bjimp="${CSS.escape(id)}"]`), v = Number(String(inp?.value || '').replace(',', '.'));
    if (!(v > 0)) { note('Escribe el importe de la venta (mayor que 0).', true); inp?.focus(); return; }
    cuerpo.valor = Math.round(v * 100) / 100;
  }
  b.disabled = true;
  try {
    const r = await fetch('/api/anuncios/conversiones', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { note(`No se registró: ${j.motivo || j.error || 'la oficina contestó ' + r.status}`, true); return; }
    const x = j.resumen || {}; hechas.set(id, [...(hechas.get(id) || []).filter(y => y.id !== x.id), x]);
    note(j.ya ? 'Ya estaba registrado: Meta lo cuenta una vez.' : x.estado === 'enviado' ? (tipo === 'venta' ? 'Venta enviada a Meta.' : 'Contacto calificado enviado a Meta.') : `Registrado; Meta no contestó todavía y se reintenta solo${x.error ? ` (${x.error})` : ''}.`, x.estado === 'fallo');
  } catch { note('No se pudo hablar con la oficina.', true); }
  finally { if (b.isConnected) b.disabled = false; render(); }
}
/** Al abrir una conversación: lo ya registrado de ella (del servidor), para enseñarlo. */
export async function traerHechas(itemId, render) {
  if (!conv?.encendida || hechas.has(itemId)) return;
  hechas.set(itemId, []);
  try { const j = await (await fetch(`/api/anuncios/conversiones?item=${encodeURIComponent(itemId)}`)).json(); hechas.set(itemId, j.delItem || []); render(); } catch { /* sin lista: se ve lo de esta vez */ }
}

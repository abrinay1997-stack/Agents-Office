// Fase B2 (9 oct 2026): una CONVERSACIÓN privada de Instagram o Messenger abierta en la Bandeja. Viaja con el editor de piezas
// (dist/pieza-editor.js, window.AO_PIEZA.conversacion): la página está cerca de su tope y aquí solo queda lo pequeño (la lista, la
// ventana de 24 h, el aviso sin acceso avanzado), en src/contenido-bandeja.js. Lo de aquí es puro: devuelve HTML y mide textos.
//   - el hilo: lo del cliente a un lado, lo tuyo al otro, con su hora; las imágenes del cliente solo si vienen de Meta
//     (cdninstagram.com, fbcdn.net); si no, «Envió una imagen» con el enlace.
//   - la ventana de 24 h siempre a la vista; cerrada, Enviar no se ofrece y un texto dice por qué.
//   - el cuadro de la respuesta con su contador contra 1.000 caracteres (y los bytes, si pasan): Meta pide MENOS de 1.000 caracteres
//     y 1.000 bytes UTF-8 como mucho (§13.10 del plan).
import { accionesDe, ventanaDe } from './contenido-bandeja.js';

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
  const vent = `<p class="bj-vent${v.abierta ? '' : ' cerr'}" role="status" data-bjv="${esc(m.id)}" data-forma="largo" data-ab="${v.abierta ? 1 : 0}">${esc(v.texto)}</p>`;
  let resp;
  if (m.estado === 'respondido') resp = `<p class="bj-resp"><b>Respondido${m.respuesta?.simulada ? ' (simulacro: no salió)' : ''}:</b> ${esc(m.respuesta?.texto || '')}</p>`;
  else {
    const txt = m.borrador?.texto || '', c = medir(txt);
    const enviar = m.estado === 'descartado' ? `<button type="button" class="pz-btn" data-bja="reabrir" data-id="${esc(m.id)}">Reabrir</button>`
      : !v.abierta ? `<span class="bj-no">No se ofrece «Enviar»: la ventana de 24 h está cerrada.</span><button type="button" class="pz-btn" data-bja="descartar" data-id="${esc(m.id)}">No necesita respuesta</button>`
      : `<button type="button" class="pz-go" data-bja="enviar" data-id="${esc(m.id)}"${c.ok ? '' : ` aria-disabled="true"`} aria-describedby="${id}-cc">${armado ? '¿Seguro? Pulsa otra vez para enviarla' : 'Enviar respuesta'}</button><button type="button" class="pz-btn" data-bja="descartar" data-id="${esc(m.id)}">No necesita respuesta</button>`;
    resp = `<label class="pz-lab" for="${id}-t">Tu respuesta a ${quien}${m.borrador?.por?.startsWith('agente:') ? ' <small class="pz-hn">borrador de un agente: léelo antes de enviarlo</small>' : ''}</label>
      <textarea id="${id}-t" class="pz-ta" rows="3" data-bjtxt="${esc(m.id)}" data-bjconv aria-describedby="${id}-cc" placeholder="Escribe la respuesta, o pide borradores a Marketing.">${esc(txt)}</textarea>
      <p class="bj-cc${c.ok ? '' : ' mal'}" id="${id}-cc" aria-live="polite">${esc(c.texto)}${c.ok ? '' : ` · ${esc(c.motivo)}`}</p>
      ${m.estado === 'fallo' && m.error ? `<p class="pz-inline err">${esc(m.error)}</p>` : ''}
      <div class="bj-row">${enviar}</div>`;
  }
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

// La pestaña BORRADORES (Fase A3, 9 oct 2026; plan §8.3): la lista de los borradores de campaña con su estado, de quién viene (Tú,
// Dimitri, un agente), su objetivo y su costo máximo; «+ Nueva campaña»; un borrador creado enlaza a su campaña en Campañas. Puro.
// Borrar pide un segundo clic EN LA FILA (no hay DESHACER: el servidor lo manda a su papelera). Un botón nunca va dentro de otro: el
// nombre es el botón que abre el asistente; lo demás va al lado.
import { esc, chip, haceCuanto } from './comun.js';
import { deQuien, estadoB, objetivoTexto, costoTexto } from './borrador.js';
import { srcDemo } from './demo-borradores.js';

export const srcDe = id => srcDemo(id) || (typeof id === 'string' && id && !id.startsWith('demo/') ? '/media/' + id.split('/').map(encodeURIComponent).join('/') : null);
export const esVideo = id => /\.(mp4|webm|mov)$/i.test(id || '');

export function miniHTML(id, cls = 'anu-bmini') {
  const s = srcDe(id);
  if (!s) return `<span class="${cls} vacio" aria-hidden="true">Sin imagen</span>`;
  return esVideo(id) ? `<span class="${cls}" aria-hidden="true"><video src="${esc(s)}#t=0.1" preload="metadata" muted playsinline></video></span>` : `<span class="${cls}" aria-hidden="true"><img src="${esc(s)}" alt="" loading="lazy" decoding="async"></span>`;
}

/** Una fila de la lista. `confirmar`: el id del que espera el segundo clic de «Borrar». */
export function filaBorradorHTML(b, { moneda = 'USD', confirmar = null, agentName, ahora = Date.now() } = {}) {
  const e = estadoB(b), cm = b.validacion?.costoMax, n = (b.creativos || []).length, cuando = haceCuanto(b.actualizadoAt || b.creadoAt, ahora);
  const costo = cm ? costoTexto(cm, moneda) : '';
  const acciones = confirmar === b.id
    ? `<span class="anu-bconf" role="group" aria-label="Confirmar el borrado"><span>¿Borrar «${esc(b.nombre)}»? Va a la papelera de la oficina; en Meta no cambia nada.</span><button type="button" class="anu-btn pri" data-bborrar-si="${esc(b.id)}">Sí, borrar</button><button type="button" class="anu-btn" data-bborrar-no="${esc(b.id)}">No</button></span>`
    : `${b.estado === 'creado' && b.meta?.campana ? `<button type="button" class="anu-btn" data-vercamp="${esc(b.meta.campana)}">Ver la campaña en pausa</button>` : ''}${b.estado !== 'creando' ? `<button type="button" class="anu-btn" data-bborrar="${esc(b.id)}" aria-label="Borrar el borrador «${esc(b.nombre)}»">Borrar</button>` : ''}`;
  return `<li class="anu-bfila" data-bfila="${esc(b.id)}">${miniHTML(b.creativos?.[0]?.media)}
    <div class="anu-bcuerpo"><h3><button type="button" class="anu-abrir" data-babrir="${esc(b.id)}">${esc(b.nombre || '(sin nombre)')}</button></h3>
      <p class="anu-tchips">${chip(e.texto, e.tono)}${chip('De: ' + deQuien(b.de, agentName), b.de === 'dueno' ? 'gris' : 'azul')}</p>
      <p class="anu-tobj">${esc(objetivoTexto(b))} · ${n} ${n === 1 ? 'creativo' : 'creativos'}${cuando ? ` · cambiado ${esc(cuando)}` : ''}</p>
      <p class="anu-bcosto">${costo ? `Costo máximo: ${esc(costo)}` : 'Costo máximo: se calcula al revisarlo.'}</p>
      ${b.estado === 'fallo' && b.error ? `<p class="anu-derr">${esc(b.error)}</p>` : ''}</div>
    <div class="anu-bacc">${acciones}</div></li>`;
}

export function listaBorradoresHTML(items, { moneda = 'USD', confirmar = null, agentName, error = '', ahora = Date.now(), cargando = false } = {}) {
  const cab = `<div class="anu-bcab"><h2 id="anuBorT">Borradores <span class="anu-cuenta">${(items || []).length}</span></h2><button type="button" class="anu-btn pri" data-a="nueva">+ Nueva campaña</button></div>
    <p class="anu-ayuda">Un borrador vive en la oficina: no gasta ni sale en Meta hasta que pulses «Crear en Meta (en pausa)». Activarla después te pide los dos clics con la cifra.</p>`;
  if (error) return `${cab}<p class="anu-aviso-error" role="alert">No se pudieron traer los borradores: ${esc(error)} <button type="button" class="anu-btn" data-a="recargar-b">Reintentar</button></p>`;
  if (items == null || cargando && !items.length) return `${cab}<p class="anu-cargando">Cargando…</p>`;
  if (!items.length) return `${cab}<div class="anu-vacio"><b>Todavía no hay borradores</b><span>Empieza una campaña con «+ Nueva campaña»; Dimitri y tu agente de anuncios también pueden dejarte uno.</span></div>`;
  const orden = [...items].sort((a, b) => (a.estado === 'creado') - (b.estado === 'creado') || String(b.actualizadoAt || '').localeCompare(String(a.actualizadoAt || '')));
  return `${cab}<ul class="anu-blista" aria-labelledby="anuBorT">${orden.map(b => filaBorradorHTML(b, { moneda, confirmar, agentName, ahora })).join('')}</ul>`;
}

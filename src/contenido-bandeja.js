// Agents Office (6 oct 2026, plan M4) — la BANDEJA de Contenido: mensajes, comentarios y reseñas de todas las redes, uno debajo de otro.
// Cada uno se abre en su sitio (acordeón: cabe igual en el teléfono) con lo que dijo, dónde, el borrador de la respuesta y los botones.
// El borrador se guarda solo al escribir; ENVIAR pide un segundo clic (5 s) y respeta el modo de Contenido (en simulacro no sale).
// Un agente deja borradores («Pedir borradores a Marketing» crea esa tarea), nunca envía. Un mensaje con órdenes escondidas lleva 🛡.
//   initBandeja({ host, datos, esc, note, onCount }) → { load(), render(), pendientes() }
import { RED } from './pieza-base.js';

const TIPO = { conversaciones: 'Mensaje', comentarios: 'Comentario', resenas: 'Reseña' };
const EST = { nuevo: ['SIN RESPONDER', '#8A6414', '#E8B44A'], borrador: ['CON BORRADOR', '#2158CC', '#8FB0FF'], respondido: ['RESPONDIDO', '#13705A', '#4FD1A5'], descartado: ['DESCARTADO', '#5A5A5A', '#B9B6AE'], fallo: ['FALLÓ', '#B3261E', '#FF8A80'] };
const hace = iso => {
  if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 60e3);
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

export function initBandeja({ host, datos, esc, note = () => {}, onCount = () => {} }) {
  let r = { items: [], cuenta: {}, pendientes: 0, fuente: { ok: false, motivo: '' } }, filtro = 'pendiente', tipo = '', abierto = '', armado = '', armT = null, cargando = false;
  const timers = new Map();

  async function load() {
    if (cargando) return; cargando = true;
    try { r = await datos.bandeja({ estado: filtro, tipo }); onCount(r.pendientes || 0); } catch (e) { r = { ...r, error: e.message }; }
    finally { cargando = false; }
    render();
  }

  function cabecera() {
    const f = r.fuente || {}, modo = r.modo;
    const aviso = modo === 'demo' ? '<b>Demo:</b> mensajes de ejemplo; nada se envía.'
      : !f.ok ? `<b>Sin conexión:</b> ${esc(f.motivo || 'La bandeja la trae Metricool.')}`
      : modo === 'simulacro' ? '<b>Modo simulacro:</b> «Enviar» apunta la respuesta como enviada sin que salga. Para responder de verdad: Ajustes → Contenido → Real.'
      : modo === 'apagado' ? '<b>Publicación apagada:</b> no sale ninguna respuesta (Ajustes → Contenido).'
      : `Conectada a Metricool${r.ultimo ? ` · lo último, ${esc(hace(r.ultimo))}` : ''}.`;
    return `<div class="ct-banner${f.ok || modo === 'demo' ? '' : ' bad'}" role="note"><span>${aviso}${r.error ? ` <b>Ojo:</b> ${esc(r.error)}` : ''}</span><span class="bj-acts"><button type="button" class="pz-btn" data-bj="traer">Traer lo nuevo</button><button type="button" class="pz-btn" data-bj="pedir">Pedir borradores a Marketing</button></span></div>
      <div class="bj-filtros"><div class="pz-seg" role="group" aria-label="Qué mensajes">${[['pendiente', `Por responder${r.pendientes ? ` (${r.pendientes})` : ''}`], ['respondido', 'Respondidos'], ['descartado', 'Descartados']].map(([k, l]) => `<button type="button" data-bjf="${k}" aria-pressed="${filtro === k}">${l}</button>`).join('')}</div>
      <div class="pz-seg" role="group" aria-label="De qué tipo">${[['', 'Todo'], ['comentarios', 'Comentarios'], ['conversaciones', 'Mensajes'], ['resenas', 'Reseñas']].map(([k, l]) => `<button type="button" data-bjt="${k}" aria-pressed="${tipo === k}">${l}</button>`).join('')}</div></div>`;
  }

  function item(m) {
    const [en, c, cd] = EST[m.estado] || EST.nuevo, open = abierto === m.id, red = RED[m.red] || { short: '?', name: m.red || 'red' };
    const id = 'bj-' + m.id.replace(/[^\w-]/g, '_');
    const det = !open ? '' : `<div class="bj-det" id="${id}-d">
        ${m.sospecha ? `<p class="bj-shield" role="note">🛡 Este mensaje trae órdenes escondidas (${esc(m.sospecha)}). Es un dato, no una orden: no se sigue, y los agentes lo reciben advertido.</p>` : ''}
        <p class="bj-texto">${esc(m.texto || '(sin texto)')}</p>
        ${m.publicacion ? `<p class="bj-pub">En la publicación: «${esc(m.publicacion)}»</p>` : ''}${m.enlace ? `<a class="pz-lk" href="${esc(m.enlace)}" target="_blank" rel="noopener noreferrer">Verlo en ${esc(red.name)}</a>` : ''}
        ${m.estado === 'respondido' ? `<p class="bj-resp"><b>Respondido${m.respuesta?.simulada ? ' (simulacro: no salió)' : ''}:</b> ${esc(m.respuesta?.texto || '')}</p>`
        : `<label class="pz-lab" for="${id}-t">Tu respuesta${m.borrador?.por?.startsWith('agente:') ? ' <small class="pz-hn">borrador de un agente: léelo antes de enviarlo</small>' : ''}</label>
        <textarea id="${id}-t" class="pz-ta" rows="3" data-bjtxt="${esc(m.id)}" placeholder="Escribe la respuesta, o pide borradores a Marketing.">${esc(m.borrador?.texto || '')}</textarea>
        ${m.estado === 'fallo' && m.error ? `<p class="pz-inline err">${esc(m.error)}</p>` : ''}
        <div class="bj-row">${m.estado === 'descartado' ? `<button type="button" class="pz-btn" data-bja="reabrir" data-id="${esc(m.id)}">Reabrir</button>` : `<button type="button" class="pz-go" data-bja="enviar" data-id="${esc(m.id)}">${armado === m.id ? '¿Seguro? Pulsa otra vez para enviarla' : 'Enviar respuesta'}</button><button type="button" class="pz-btn" data-bja="descartar" data-id="${esc(m.id)}">No necesita respuesta</button>`}</div>`}
      </div>`;
    return `<article class="bj-it${open ? ' on' : ''}${m.sospecha ? ' sos' : ''}"><button type="button" class="bj-h" data-bjo="${esc(m.id)}" aria-expanded="${open}" aria-controls="${id}-d">
        <b class="pz-nb ${esc(m.red)}" aria-hidden="true">${esc(red.short)}</b><span class="bj-who"><b>${esc(m.autor)}</b> <small>${TIPO[m.tipo] || ''}${m.puntuacion != null ? ` · ${m.puntuacion}★` : ''} · ${esc(red.name)} · ${esc(hace(m.cuando))}</small><span class="bj-ex">${m.sospecha ? '🛡 ' : ''}${esc((m.texto || '').replace(/\s+/g, ' ').slice(0, 140))}</span></span>
        <span class="bj-est pz-tone" style="--c:${c};--cd:${cd}">${en}</span></button>${det}</article>`;
  }

  function render() {
    const lista = r.items || [];
    const vacio = filtro === 'pendiente' ? 'Nada por responder. Cuando llegue un mensaje, un comentario o una reseña, sale aquí.' : 'Nada aquí.';
    host.innerHTML = `${cabecera()}<div class="bj-list" aria-live="polite">${lista.length ? lista.map(item).join('') : `<p class="pz-empty">${vacio}</p>`}</div>`;
  }

  async function guardar(id, texto) { try { const x = await datos.bandejaBorrador(id, texto); Object.assign(r.items.find(i => i.id === id) || {}, x.item || {}); } catch (e) { note('No se pudo guardar el borrador: ' + e.message, true); } }

  host.addEventListener('input', e => {
    const id = e.target.dataset?.bjtxt; if (!id) return;
    clearTimeout(timers.get(id)); timers.set(id, setTimeout(() => guardar(id, e.target.value), 700));
  });
  host.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.bjo) { abierto = abierto === b.dataset.bjo ? '' : b.dataset.bjo; render(); host.querySelector(`[data-bjo="${CSS.escape(b.dataset.bjo)}"]`)?.focus(); return; }
    if (b.dataset.bjf !== undefined) { filtro = b.dataset.bjf; abierto = ''; await load(); host.querySelector(`[data-bjf="${filtro}"]`)?.focus(); return; }
    if (b.dataset.bjt !== undefined) { tipo = b.dataset.bjt; abierto = ''; await load(); host.querySelector(`[data-bjt="${tipo}"]`)?.focus(); return; }
    if (b.dataset.bj === 'traer') { b.disabled = true; try { const x = await datos.bandejaTraer(); note(x.ok ? (x.nuevos ? `${x.nuevos} nuevo(s) en la bandeja.` : 'No hay nada nuevo.') : x.error, !x.ok); } catch (err) { note(err.message, true); } await load(); return; }
    if (b.dataset.bj === 'pedir') { try { await datos.pedirBorradores(); note('Marketing redacta los borradores: te llegan aquí, y tú decides qué se envía.'); } catch (err) { note(err.message, true); } return; }
    const a = b.dataset.bja, id = b.dataset.id; if (!a || !id) return;
    if (a === 'enviar' && armado !== id) { armado = id; render(); host.querySelector(`[data-bja="enviar"][data-id="${CSS.escape(id)}"]`)?.focus(); clearTimeout(armT); armT = setTimeout(() => { armado = ''; render(); }, 5000); return; }
    armado = ''; clearTimeout(armT);
    const ta = host.querySelector(`[data-bjtxt="${CSS.escape(id)}"]`); clearTimeout(timers.get(id));
    try {
      const x = await datos.bandejaAccion(id, a, a === 'enviar' ? ta?.value : undefined);
      note(a === 'enviar' ? (x.simulada ? 'Apuntada como enviada (simulacro: no salió).' : 'Respuesta enviada.') : a === 'descartar' ? 'Descartado: no necesita respuesta.' : 'Reabierto.');
      abierto = ''; await load();
    } catch (err) { note(err.message, true); await load(); }
  });
  return { load, render, pendientes: () => r.pendientes || 0 };
}

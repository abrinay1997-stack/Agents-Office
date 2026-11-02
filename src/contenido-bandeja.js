// Agents Office (6 oct 2026, plan M4) — la BANDEJA de Contenido: mensajes, comentarios y reseñas de todas las redes, uno debajo de otro.
// Cada uno se abre en su sitio (acordeón: cabe igual en el teléfono) con lo que dijo, dónde, el borrador de la respuesta y los botones.
// El borrador se guarda solo al escribir; ENVIAR pide un segundo clic (5 s) y respeta el modo de Contenido (en simulacro no sale).
// Un agente deja borradores («Pedir borradores a Marketing» crea esa tarea), nunca envía. Un mensaje con órdenes escondidas lleva 🛡.
// Fase B1 (9 oct 2026): los comentarios de Instagram y Facebook llegan de Meta (`fuente`), con la publicación de la que vienen, «en un
// anuncio» (botón a esa campaña: evento `ao:abrir-anuncios`, y si nadie lo atiende, el botón Anuncios del dock), de cuál cuelgan, y
// OCULTAR / MOSTRAR (nunca borrar), con DESHACER y su cuenta atrás. Un oculto no se responde (el servidor también dice 409).
// Fase B2 (9 oct 2026): las conversaciones privadas de Instagram y Messenger. Aquí, lo pequeño: la fila (red, cliente, el último mensaje
// y «quedan N h» o «ventana cerrada»), la ventana de 24 h (que se recalcula cada minuto) y la franja si Meta no da los mensajes. La
// conversación abierta (el hilo, las imágenes, el contador de 1.000) viaja con el editor de piezas: src/contenido-conversacion.js.
//   initBandeja({ host, datos, esc, note, onCount, paquete }) → { load(), render(), pendientes() } · paquete() → window.AO_PIEZA
import { RED, nbRed } from './pieza-base.js';
import { cuentaDeItem, cuentaLinea, comoCuenta, opcionesCuentaBandeja } from './bandeja-cuenta.js';

const TIPO = { conversaciones: 'Mensaje', comentarios: 'Comentario', resenas: 'Reseña' };
const EST = { nuevo: ['SIN RESPONDER', '#8A6414', '#E8B44A'], borrador: ['CON BORRADOR', '#2158CC', '#8FB0FF'], respondido: ['RESPONDIDO', '#13705A', '#4FD1A5'], descartado: ['DESCARTADO', '#5A5A5A', '#B9B6AE'], fallo: ['FALLÓ', '#B3261E', '#FF8A80'] };
const FUENTE = { meta: 'Meta', metricool: 'Metricool' };
export const OCULTO_TXT = 'Oculto: solo tú y quien lo escribió lo ven';
export const OCULTO_NO_RESPONDE = 'Está oculto: vuélvelo a mostrar para responder.';
const hace = iso => {
  if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 60e3);
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};
const web = u => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
const imagen = u => (/^(https?:\/\/|\/)/i.test(String(u || '')) ? String(u) : '');

export const VENTANA_CERRADA = 'La ventana de 24 h se cerró: Meta no deja responder por aquí. Si te vuelve a escribir, se abre otra vez.';
export const GUIA_META = 'https://github.com/abrinay1997-stack/Agents-Office/blob/main/docs/conectar-meta.md';
/** Una conversación de Meta (B2): la que trae su hilo y su ventana de 24 h. */
export const esConversacion = m => m?.tipo === 'conversaciones' && m?.fuente === 'meta';
/** La ventana de 24 h → { abierta, min, texto, corto }. `hasta` manda; si no, `quedaMin` contado desde `desde` (cuando llegó). Puro. */
export function ventanaDe(v, ahora = Date.now(), desde = ahora) {
  const t = Date.parse(v?.hasta || ''), q = Number(v?.quedaMin);
  const min = Number.isFinite(t) ? Math.floor((t - ahora) / 60e3) : v?.quedaMin != null && Number.isFinite(q) ? Math.floor(q - (ahora - desde) / 60e3) : null;
  if (!v?.abierta || (min != null && min <= 0)) return { abierta: false, min: 0, texto: VENTANA_CERRADA, corto: 'ventana cerrada' };
  if (min == null) return { abierta: true, min: null, texto: 'Puedes responder: la ventana de 24 h está abierta.', corto: 'ventana abierta' };
  const h = Math.floor(min / 60), r = min % 60, largo = h ? `${h} h${h < 3 && r ? ` ${r} min` : ''}` : `${min} min`;
  return { abierta: true, min, texto: `Puedes responder durante ${largo} más.`, corto: `quedan ${h ? `${h} h` : `${min} min`}` };
}
/** El último mensaje de una conversación (el más reciente). */
export const ultimoMensaje = m => (m?.mensajes || []).reduce((a, x) => (!a || (Date.parse(x.at) || 0) >= (Date.parse(a.at) || 0) ? x : a), null);

/** De dónde viene un mensaje: lo de antes de B1 no lo decía y era de Metricool. */
export const fuenteDe = m => (m?.fuente === 'meta' ? 'meta' : 'metricool');
/** Las fuentes que hay en una lista (el filtro solo sale si hay más de una). */
export const fuentesDe = items => [...new Set((items || []).map(fuenteDe))].sort();
/** La publicación de la que viene: un objeto desde B1, un texto antes. */
export function publicacionDe(m) {
  const p = m?.publicacion; if (!p) return null;
  if (typeof p === 'string') return { id: '', texto: p, enlace: '', miniatura: '' };
  return { id: p.id || '', texto: String(p.texto || ''), enlace: web(p.enlace), miniatura: imagen(p.miniatura) };
}
/** Qué ofrece un mensaje: ocultar o mostrar (solo un comentario que llegó de Meta), si se puede responder y por qué no, la sugerencia
 *  del agente (si no está oculto y el dueño no dijo «No»), el anuncio y la publicación de la que viene, y de cuál cuelga. Puro. */
export function accionesDe(m = {}, { noSugerir = new Set() } = {}) {
  const ocultable = m.tipo === 'comentarios' && fuenteDe(m) === 'meta', oculto = ocultable && !!m.oculto;
  const cerrado = m.estado === 'respondido' || m.estado === 'descartado';
  const s = m.sugerirOcultar, v = esConversacion(m) ? ventanaDe(m.ventana) : null;
  return {
    ventana: v,
    ocultar: ocultable ? (oculto ? 'mostrar' : 'ocultar') : null,
    oculto,
    responder: oculto ? { puede: false, motivo: OCULTO_NO_RESPONDE } : v && !v.abierta && !cerrado ? { puede: false, motivo: VENTANA_CERRADA } : { puede: !cerrado, motivo: cerrado ? (m.estado === 'respondido' ? 'Ya está respondido.' : 'Lo descartaste: reábrelo para responder.') : '' },
    sugerencia: ocultable && !oculto && s && !noSugerir.has(m.id) ? { quien: String(s.quien || (m.enAnuncio ? 'ANUNCIOS' : 'MARKETING')).toUpperCase(), motivo: String(s.motivo || '') } : null,
    anuncio: m.enAnuncio ? { campana: m.enAnuncio.campana || '', anuncio: m.enAnuncio.anuncio || '', nombre: String(m.enAnuncio.nombre || 'sin nombre') } : null,
    padre: m.padre || null,
    publicacion: publicacionDe(m),
  };
}
/** Los filtros de B1, sobre lo que ya llegó: por fuente y «solo en anuncios». */
export const filtrarBandeja = (items, { fuente = '', anuncios = false } = {}) => (items || []).filter(m => (!fuente || fuenteDe(m) === fuente) && (!anuncios || !!m.enAnuncio));
/** Segundos que le quedan a un DESHACER (`hasta`: ms o fecha ISO). */
export const restante = (hasta, ahora = Date.now()) => { const t = typeof hasta === 'number' ? hasta : Date.parse(hasta); return Number.isFinite(t) ? Math.max(0, Math.ceil((t - ahora) / 1000)) : 0; };

const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento: solo esta vez */ } } };

export function initBandeja({ host, datos, esc, note = () => {}, onCount = () => {}, paquete = null }) {
  let r = { items: [], cuenta: {}, pendientes: 0, fuente: { ok: false, motivo: '' } }, filtro = 'pendiente', tipo = '', abierto = '', armado = '', armT = null, cargando = false;
  let fuente = '', soloAnuncios = false, undo = null, undoT = null, cuentaSel = '';
  const vistas = new Set(), timers = new Map(), noSugerir = new Set(ls.get('ao.bj.nosug'));
  let hayAnuncios = false, conv = null, convPedida = false, desde = Date.now();
  function traerConv() { /* B2: la conversación abierta viaja con el editor de piezas */
    if (conv || convPedida || !paquete) return; convPedida = true;
    paquete().then(x => { conv = x?.conversacion || null; if (!conv) throw new Error('el editor no trae la conversación'); render(); conv.cargarConversiones?.().then(render); }).catch(e => { convPedida = false; note('No se pudo abrir la conversación: ' + e.message, true); });
  }
  const tic = () => { /* B2: la ventana de 24 h, cada minuto y al volver a la pestaña; si una se cierra, se vuelve a pintar (Enviar deja de ofrecerse) */
    if (!host.isConnected || host.hidden) return; let cambio = false;
    for (const el of host.querySelectorAll('[data-bjv]')) {
      const m = (r.items || []).find(x => x.id === el.dataset.bjv); if (!m) continue;
      const v = ventanaDe(m.ventana, Date.now(), desde); el.textContent = el.dataset.forma === 'largo' ? v.texto : v.corto;
      if (!v.abierta && el.dataset.ab === '1') cambio = true;
    }
    if (cambio) render();
  };
  setInterval(tic, 60e3); document.addEventListener('visibilitychange', () => { if (!document.hidden) tic(); });
  host.addEventListener('error', e => { if (e.target?.matches?.('img[data-bjimg]')) e.target.closest('a').outerHTML = '<span class="bj-adj">Envió una imagen (no se pudo ver aquí)</span>'; }, true);

  async function load() {
    if (cargando) return; cargando = true;
    await null; // quien la abre pinta antes: así se sabe si está a la vista (el servidor mira más seguido mientras lo está)
    const aLaVista = !host.hidden && host.isConnected && !host.closest('[inert]');
    try {
      r = await datos.bandeja({ estado: filtro, tipo, fuente, cuenta: cuentaSel, abierta: aLaVista ? 1 : '' }); desde = Date.now(); onCount(r.pendientes || 0);
      for (const m of r.items || []) { vistas.add(fuenteDe(m)); if (m.enAnuncio) hayAnuncios = true; }
    } catch (e) { r = { ...r, error: e.message }; }
    finally { cargando = false; }
    render();
  }

  function cabecera() {
    const f = r.fuente || {}, modo = r.modo;
    const de = f.nombre || (vistas.has('meta') && vistas.has('metricool') ? 'Meta y Metricool' : vistas.has('meta') ? 'Meta' : 'Metricool');
    const aviso = modo === 'demo' ? '<b>Demo:</b> mensajes de ejemplo; nada se envía ni se oculta de verdad.'
      : !f.ok ? `<b>Sin conexión:</b> ${esc(f.motivo || 'La bandeja la trae Meta o Metricool (Ajustes → Contenido).')}`
      : modo === 'simulacro' ? '<b>Modo simulacro:</b> «Enviar» apunta la respuesta como enviada sin que salga. Para responder de verdad: Ajustes → Contenido → Real.'
      : modo === 'apagado' ? '<b>Publicación apagada:</b> no sale ninguna respuesta (Ajustes → Contenido).'
      : `Conectada a ${esc(de)}${r.ultimo ? ` · lo último, ${esc(hace(r.ultimo))}` : ''}.`;
    const seg = (lab, attr, opts, cur) => `<div class="pz-seg" role="group" aria-label="${lab}">${opts.map(([k, l]) => `<button type="button" ${attr}="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
    return `<div class="ct-banner${f.ok || modo === 'demo' ? '' : ' bad'}" role="note"><span>${aviso}${r.error ? ` <b>Ojo:</b> ${esc(r.error)}` : ''}</span><span class="bj-acts"><button type="button" class="pz-btn" data-bj="traer">Traer lo nuevo</button><button type="button" class="pz-btn" data-bj="pedir">Pedir borradores a Marketing</button></span></div>
${r.fuentes?.meta?.mensajes?.ok === false ? `<div class="ct-banner bad bj-sinmsg" role="note"><span><b>Los mensajes privados no llegan:</b> ${esc(r.fuentes.meta.mensajes.motivo || 'Meta no da acceso a los mensajes.')} Los comentarios siguen llegando. <a class="pz-lk" href="${GUIA_META}" target="_blank" rel="noopener noreferrer">Cómo conectarlos (docs/conectar-meta.md)</a></span></div>` : ''}
      <div class="bj-filtros">${seg('Qué mensajes', 'data-bjf', [['pendiente', `Por responder${r.pendientes ? ` (${r.pendientes})` : ''}`], ['respondido', 'Respondidos'], ['descartado', 'Descartados']], filtro)}
      ${seg('De qué tipo', 'data-bjt', [['', 'Todo'], ['comentarios', 'Comentarios'], ['conversaciones', 'Mensajes'], ['resenas', 'Reseñas']], tipo)}
      ${vistas.size > 1 ? seg('De dónde', 'data-bjs', [['', 'Todas'], ['meta', 'Meta'], ['metricool', 'Metricool']], fuente) : ''}
      ${hayAnuncios ? `<button type="button" class="pz-btn bj-anf" data-bjan aria-pressed="${soloAnuncios}">En anuncios</button>` : ''}
      ${(() => { const o = opcionesCuentaBandeja(r); return o.length ? `<label class="bj-cuentasel">Cuenta <select data-bjc>${o.map(([k, n]) => `<option value="${esc(k)}"${k === cuentaSel ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''; })()}</div>`;
  }

  function undoHTML() {
    if (!undo) return '<div class="bj-undo" role="status" hidden></div>';
    const s = restante(undo.hasta);
    return `<div class="bj-undo" role="status"><span>${esc(undo.texto)}</span><button type="button" class="pz-btn" data-bjundo>DESHACER <span class="bj-cnt">(${s} s)</span></button></div>`;
  }

  function item(m, todos) {
    const a = accionesDe(m, { noSugerir });
    const [en, c, cd] = EST[m.estado] || EST.nuevo, open = abierto === m.id, red = RED[m.red] || { name: m.red || 'red' };
    const id = 'bj-' + m.id.replace(/[^\w-]/g, '_'), pub = a.publicacion;
    const padre = a.padre && todos.find(x => x.id === a.padre);
    const cuelga = !a.padre ? '' : `<p class="bj-padre">↳ Respuesta a ${padre ? `<b>${esc(padre.autor)}</b>: «${esc((padre.texto || '').replace(/\s+/g, ' ').slice(0, 90))}»` : 'otro comentario de la publicación'}</p>`;
    const ocultarBtn = a.ocultar ? `<button type="button" class="pz-btn" data-bjh="${a.ocultar}" data-id="${esc(m.id)}">${a.ocultar === 'ocultar' ? 'Ocultar comentario' : 'Mostrar comentario'}</button>` : '';
    const responder = m.estado === 'respondido' ? `<p class="bj-resp"><b>Respondido${m.respuesta?.simulada ? ' (simulacro: no salió)' : ''}:</b> ${esc(m.respuesta?.texto || '')}</p>${ocultarBtn ? `<div class="bj-row">${ocultarBtn}</div>` : ''}`
      : `<label class="pz-lab" for="${id}-t">Tu respuesta${m.borrador?.por?.startsWith('agente:') ? ' <small class="pz-hn">borrador de un agente: léelo antes de enviarlo</small>' : ''}</label>
        <textarea id="${id}-t" class="pz-ta" rows="3" data-bjtxt="${esc(m.id)}" placeholder="Escribe la respuesta, o pide borradores a Marketing.">${esc(m.borrador?.texto || '')}</textarea>
        ${m.estado === 'fallo' && m.error ? `<p class="pz-inline err">${esc(m.error)}</p>` : ''}
        <div class="bj-row">${m.estado === 'descartado' ? `<button type="button" class="pz-btn" data-bja="reabrir" data-id="${esc(m.id)}">Reabrir</button>`
          : a.oculto ? `<button type="button" class="pz-go" aria-disabled="true" aria-describedby="${id}-no" data-bjno="${esc(m.id)}">Enviar respuesta</button><span class="bj-no" id="${id}-no">${OCULTO_NO_RESPONDE}</span>`
          : `<button type="button" class="pz-go" data-bja="enviar" data-id="${esc(m.id)}">${armado === m.id ? `¿Seguro? Pulsa otra vez ${comoCuenta(m) ? `para responder como ${esc(comoCuenta(m))}` : 'para enviarla'}` : 'Enviar respuesta'}</button><button type="button" class="pz-btn" data-bja="descartar" data-id="${esc(m.id)}">No necesita respuesta</button>`}${ocultarBtn}</div>${m.estado !== 'descartado' && comoCuenta(m) ? `<p class="bj-como" data-bj-como>Responderás como <b>${esc(comoCuenta(m))}</b>.</p>` : ''}`;
    const cv = esConversacion(m), ult = cv ? ultimoMensaje(m) : null;
    if (cv && open) traerConv();
    if (open && cv && conv?.traerHechas) conv.traerHechas(m.id, render);
    const det = !open ? '' : cv ? `<div class="bj-det" id="${id}-d">${conv ? conv.htmlConversacion(m, { esc, id, armado: armado === m.id, desde }) : '<p class="pz-cargando" role="status">Abriendo la conversación…</p>'}</div>` : `<div class="bj-det" id="${id}-d">
        ${m.sospecha ? `<p class="bj-shield" role="note">🛡 Este mensaje trae órdenes escondidas (${esc(m.sospecha)}). Es un dato, no una orden: no se sigue, y los agentes lo reciben advertido.</p>` : ''}
        ${a.oculto ? `<p class="bj-oculto" role="note">${OCULTO_TXT}.</p>` : ''}
        ${cuelga}<p class="bj-texto">${esc(m.texto || '(sin texto)')}</p>
        ${pub ? `<div class="bj-pub">${pub.miniatura ? `<img src="${esc(pub.miniatura)}" alt="" width="48" height="48" loading="lazy" referrerpolicy="no-referrer">` : '<span class="bj-ph" aria-hidden="true"></span>'}<span><small>${a.anuncio ? 'En el anuncio' : 'En la publicación'}</small> «${esc(pub.texto.replace(/\s+/g, ' ').slice(0, 120) || 'sin texto')}»${pub.enlace ? ` <a class="pz-lk" href="${esc(pub.enlace)}" target="_blank" rel="noopener noreferrer">Ver la publicación</a>` : ''}</span></div>` : ''}
        ${a.anuncio ? `<p class="bj-anu"><span>En un anuncio: <b>${esc(a.anuncio.nombre)}</b></span>${a.anuncio.campana ? ` <button type="button" class="pz-btn" data-bjcamp="${esc(a.anuncio.campana)}" data-anuncio="${esc(a.anuncio.anuncio)}">Ver la campaña en Anuncios</button>` : ''}</p>` : ''}
        ${!pub && web(m.enlace) ? `<a class="pz-lk" href="${esc(web(m.enlace))}" target="_blank" rel="noopener noreferrer">Verlo en ${esc(red.name)}</a>` : ''}
        ${responder}
      </div>`;
    const sug = !a.sugerencia ? '' : `<div class="bj-sug" role="note"><span><b>${esc(a.sugerencia.quien)}</b> sugiere ocultarlo${a.sugerencia.motivo ? `: ${esc(a.sugerencia.motivo)}` : '.'}</span><span class="bj-row"><button type="button" class="pz-btn" data-bjh="ocultar" data-id="${esc(m.id)}">Ocultar</button><button type="button" class="pz-btn" data-bjnosug="${esc(m.id)}">No</button></span></div>`;
    const cta = cuentaDeItem(m), ctaTag = cta ? `<span class="bj-tag bj-cta" data-bj-cuenta title="Cuenta desde la que se lee y se responde">${cta.foto ? `<img src="${esc(cta.foto)}" alt="" width="14" height="14" loading="lazy" referrerpolicy="no-referrer"> ` : ''}${esc(cuentaLinea(cta))}</span>` : '';
    const tags = `${ctaTag}${a.ventana ? `<span class="bj-tag vt${a.ventana.abierta ? '' : ' oc'}" data-bjv="${esc(m.id)}" data-ab="${a.ventana.abierta ? 1 : 0}">${esc(a.ventana.corto)}</span>` : ''}${a.anuncio ? `<span class="bj-tag">EN UN ANUNCIO: ${esc(a.anuncio.nombre)}</span>` : ''}${a.oculto ? '<span class="bj-tag oc">OCULTO</span>' : ''}${a.padre ? '<span class="bj-tag">RESPUESTA</span>' : ''}`;
    return `<article class="bj-it${open ? ' on' : ''}${m.sospecha ? ' sos' : ''}${a.oculto ? ' oc' : ''}" data-it="${esc(m.id)}"><button type="button" class="bj-h" data-bjo="${esc(m.id)}" aria-expanded="${open}" aria-controls="${id}-d">
        ${nbRed(String(m.red || ''))}<span class="bj-who"><b>${esc(m.autor)}</b> <small>${TIPO[m.tipo] || ''}${m.puntuacion != null ? ` · ${m.puntuacion}★` : ''} · ${cv && m.red === 'facebook' ? 'Messenger' : esc(red.name)}${vistas.size > 1 ? ` · ${FUENTE[fuenteDe(m)]}` : ''} · ${esc(hace(m.cuando))}</small>${tags ? `<span class="bj-tags">${tags}</span>` : ''}<span class="bj-ex">${m.sospecha ? '🛡 ' : ''}${ult?.de === 'tu' ? 'Tú: ' : ''}${esc(((ult ? ult.texto || (ult.adjuntos?.length ? 'Envió una imagen' : '') : m.texto) || '').replace(/\s+/g, ' ').slice(0, 140))}</span></span>
        <span class="bj-est pz-tone" style="--c:${c};--cd:${cd}">${en}</span></button>${sug}${det}</article>`;
  }

  function render() {
    const todos = r.items || [], lista = filtrarBandeja(todos, { fuente, anuncios: soloAnuncios });
    const vacio = soloAnuncios ? 'Ningún comentario de anuncios aquí.' : filtro === 'pendiente' ? 'Nada por responder. Cuando llegue un mensaje, un comentario o una reseña, sale aquí.' : 'Nada aquí.';
    host.innerHTML = `${cabecera()}${undoHTML()}<div class="bj-list" aria-live="polite">${lista.length ? lista.map(m => item(m, todos)).join('') : `<p class="pz-empty">${vacio}</p>`}</div>`;
  }
  const foco = sel => host.querySelector(sel)?.focus();

  function armarUndo(d, texto, itemId) {
    clearInterval(undoT); undo = d?.token ? { token: d.token, hasta: d.hasta, texto, itemId } : null; if (!undo) return;
    undoT = setInterval(() => {
      const s = restante(undo?.hasta); const cnt = host.querySelector('.bj-cnt');
      if (!undo || s <= 0) { clearInterval(undoT); const tenia = host.contains(document.activeElement) && document.activeElement.matches('[data-bjundo]'); undo = null; const u = host.querySelector('.bj-undo'); if (u) { u.hidden = true; u.innerHTML = ''; } if (tenia) foco(`[data-bjo="${CSS.escape(itemId)}"]`); return; }
      if (cnt) cnt.textContent = `(${s} s)`;
    }, 1000);
  }

  async function ocultar(id, si) {
    const m = (r.items || []).find(x => x.id === id);
    try {
      const x = await datos.bandejaOcultar(id, si);
      const quien = m?.autor ? ` de ${m.autor}` : '';
      armarUndo(x.deshacer, si ? `Comentario${quien} oculto: ya no lo ve nadie más.` : `Comentario${quien} visible otra vez.`, id);
      noSugerir.delete(id);
      await load(); foco(undo ? '[data-bjundo]' : `[data-bjo="${CSS.escape(id)}"]`);
    } catch (err) { note('No se pudo: ' + (err.motivo || err.message), true); await load(); }
  }

  host.addEventListener('input', e => {
    const id = e.target.dataset?.bjtxt; if (!id) return;
    if (conv && e.target.hasAttribute('data-bjconv')) conv.contar(e.target);
    clearTimeout(timers.get(id)); timers.set(id, setTimeout(() => guardar(id, e.target.value), 700));
  });
  async function guardar(id, texto) { try { const x = await datos.bandejaBorrador(id, texto); Object.assign(r.items.find(i => i.id === id) || {}, x.item || {}); } catch (e) { note('No se pudo guardar el borrador: ' + e.message, true); } }

  host.addEventListener('change', async e => { if (e.target.matches?.('[data-bjc]')) { cuentaSel = e.target.value; abierto = ''; await load(); foco('[data-bjc]'); } });
  host.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.bjo) { abierto = abierto === b.dataset.bjo ? '' : b.dataset.bjo; render(); foco(`[data-bjo="${CSS.escape(b.dataset.bjo)}"]`); return; }
    if (b.dataset.bjf !== undefined) { filtro = b.dataset.bjf; abierto = ''; await load(); foco(`[data-bjf="${filtro}"]`); return; }
    if (b.dataset.bjt !== undefined) { tipo = b.dataset.bjt; abierto = ''; await load(); foco(`[data-bjt="${tipo}"]`); return; }
    if (b.dataset.bjs !== undefined) { fuente = b.dataset.bjs; abierto = ''; await load(); foco(`[data-bjs="${fuente}"]`); return; }
    if (b.hasAttribute('data-bjan')) { soloAnuncios = !soloAnuncios; render(); foco('[data-bjan]'); return; }
    if (b.hasAttribute('data-bjundo')) {
      const u = undo; if (!u) return; clearInterval(undoT); undo = null;
      try { await datos.bandejaDeshacer(u.token); note('Deshecho.'); } catch (err) { note('No se pudo deshacer: ' + (err.motivo || err.message), true); }
      await load(); foco(`[data-bjo="${CSS.escape(u.itemId)}"]`); return;
    }
    if (b.dataset.bjh) return ocultar(b.dataset.id, b.dataset.bjh === 'ocultar');
    if (b.dataset.bjnosug) { const id = b.dataset.bjnosug; noSugerir.add(id); ls.set('ao.bj.nosug', [...noSugerir].slice(-200)); render(); foco(`[data-bjo="${CSS.escape(id)}"]`); note('Hecho: se queda a la vista.'); return; }
    if (b.dataset.bjno) { note(OCULTO_NO_RESPONDE, true); return; }
    if (b.dataset.bjcamp) {
      const ev = new CustomEvent('ao:abrir-anuncios', { cancelable: true, detail: { campana: b.dataset.bjcamp, anuncio: b.dataset.anuncio || '' } });
      if (window.dispatchEvent(ev)) { const t = document.getElementById('topAnuncios'); if (t) t.click(); else note('Anuncios no está en esta oficina.', true); }
      return;
    }
    if (b.dataset.bj === 'traer') { b.disabled = true; try { const x = await datos.bandejaTraer(); note(x.ok ? (x.nuevos ? `${x.nuevos} nuevo(s) en la bandeja.` : 'No hay nada nuevo.') : x.error, !x.ok); } catch (err) { note(err.message, true); } await load(); return; }
    if (b.dataset.bj === 'pedir') { try { await datos.pedirBorradores(); note('Marketing redacta los borradores: te llegan aquí, y tú decides qué se envía.'); } catch (err) { note(err.message, true); } return; }
    if (b.dataset.bjconv && conv?.registrar) return conv.registrar(b, { host, note, render }); // A6: la API de conversiones (en el paquete del editor)
    const a = b.dataset.bja, id = b.dataset.id; if (!a || !id) return;
    if (a === 'enviar' && conv && b.getAttribute('aria-disabled') === 'true') { const c = conv.medir(host.querySelector(`[data-bjtxt="${CSS.escape(id)}"]`)?.value); note(c.motivo || 'No se puede enviar.', true); return; }
    if (a === 'enviar' && armado !== id) { const it = r.items.find(x => x.id === id), t0 = host.querySelector(`[data-bjtxt="${CSS.escape(id)}"]`); if (it && t0) it.borrador = { ...(it.borrador || {}), texto: t0.value }; armado = id; render(); foco(`[data-bja="enviar"][data-id="${CSS.escape(id)}"]`); clearTimeout(armT); armT = setTimeout(() => { armado = ''; render(); }, 5000); return; }
    armado = ''; clearTimeout(armT);
    const ta = host.querySelector(`[data-bjtxt="${CSS.escape(id)}"]`); clearTimeout(timers.get(id));
    try {
      const x = await datos.bandejaAccion(id, a, a === 'enviar' ? ta?.value : undefined);
      note(a === 'enviar' ? (x.simulada ? 'Apuntada como enviada (simulacro: no salió).' : 'Respuesta enviada.') : a === 'descartar' ? 'Descartado: no necesita respuesta.' : 'Reabierto.');
      abierto = ''; await load();
    } catch (err) { note(err.motivo ? (err.message === 'ventana' || err.status === 422 ? err.motivo : `${err.message}: ${err.motivo}`) : err.message, true); await load(); }
  });
  return { load, render, pendientes: () => r.pendientes || 0 };
}

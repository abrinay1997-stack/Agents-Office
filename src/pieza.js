// Agents Office V4.7 (30 sep 2026) — el PANEL de una pieza de contenido: cuándo sale, dónde, qué archivos, qué dice, y si puede salir.
// Se guarda solo, con una pausa al teclear, y siempre al cerrarlo: el guardado cuelga del cierre y no del botón, o cerrar con Esc o con un
// clic fuera perdería lo escrito.
// V4.10 (1 oct 2026, auditoría CON-07/08/09/10/13/20 y PRE-01…17): el panel es un cajón sobre el calendario (no lo estruja) y, con sitio,
// va en DOS COLUMNAS: a la izquierda lo que se edita, a la derecha la vista previa en vivo por red y formato (contenido-preview.js). Con poco
// sitio, «Editar · Vista previa» arriba. El veredicto («Lista para salir» / «2 problemas») vive en el pie, junto a Aprobar. Los campos siguen
// al formato (una historia no lleva pie), hay horas rápidas, «siguiente hueco», aviso de choque, «también como historia» y Duplicar.
//   initPieza({ host, datos, esc, pickMedia, openEstudio, onChange, note, otras, cuenta, medidaDe }) → { open, close, isOpen, current, addMedios, flush, refresh }
// `datos` es lo de contenido-datos.js; `pickMedia()` abre el selector de la galería del Estudio y devuelve los ids elegidos; `otras()` las
// demás piezas (choques, huecos, la cuadrícula del perfil); `cuenta()` con qué cuenta sale; `medidaDe(id)` las medidas de un archivo.
import { modal } from './modal.js';
import { dateOpts, timeOpts, fmtLong, fmtDay } from './calendar-core.js';
import { LIMITES, postDePieza, aplicarArreglo, textoPara, contarHashtags, revisarPublicacion, revisarMomento } from './contenido-reglas.js';
import { initPreview } from './contenido-preview.js';
import { choqueDe, siguienteHueco } from './contenido-cola.js';

export const ESTADO = {
  idea: { name: 'IDEA', glyph: '◌', color: '#5A5A5A', dark: '#B9B6AE', help: 'Una idea suelta: todavía no es una publicación.' },
  borrador: { name: 'BORRADOR', glyph: '✎', color: '#8A6414', dark: '#E8B44A', help: 'Se está escribiendo.' },
  revision: { name: 'A REVISAR', glyph: '●', color: '#2B6BEB', dark: '#8FB0FF', help: 'Lista para que la mires y la apruebes.' },
  aprobada: { name: 'APROBADA', glyph: '✓', color: '#13705A', dark: '#4FD1A5', help: 'Aprobada por ti: puede salir.' },
};
export const FORMATO = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };
export const RED = { instagram: { name: 'Instagram', short: 'IG' }, facebook: { name: 'Facebook', short: 'FB' } };
/** El icono de cada formato (trazos, el color del texto): en las tarjetas del calendario, la programación y el panel. */
export const FICON = {
  post: '<svg class="pz-fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>',
  carrusel: '<svg class="pz-fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3" width="9.5" height="10" rx="1.6"/><path d="M13 4.5v7M15 5.8v4.4"/></svg>',
  reel: '<svg class="pz-fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="1.5" width="10" height="13" rx="2.4"/><path d="M6.6 5.6v4.8l3.8-2.4z" class="fill"/></svg>',
  historia: '<svg class="pz-fi" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.8" stroke-dasharray="3.2 1.6"/><circle cx="8" cy="8" r="2.2"/></svg>',
};
export const HORAS_RAPIDAS = ['09:00', '12:30', '18:00', '20:00'];
export const mediaUrl = id => (typeof id === 'string' && !id.startsWith('demo/') ? '/media/' + id.split('/').map(encodeURIComponent).join('/') : null);
const esVideo = id => /\.(mp4|webm|mov)$/i.test(id || '');
let uid = 0;

/** Qué cambia en la pieza al aplicar el arreglo de un problema (las reglas hablan en «post»; la pieza, en español). */
export function parchePorArreglo(p, codigo) {
  const antes = postDePieza(p), despues = aplicarArreglo(antes, codigo), patch = {};
  if (despues.format !== antes.format) patch.formato = despues.format;
  if (despues.hashtagsEnComentario !== antes.hashtagsEnComentario) patch.hashtagsEnComentario = despues.hashtagsEnComentario;
  if (despues.hashtagsFinales !== antes.hashtagsFinales) patch.hashtags = despues.hashtagsFinales;
  if (JSON.stringify(despues.redes) !== JSON.stringify(antes.redes)) patch.redes = despues.redes;
  if (despues.historiaTambien !== antes.historiaTambien) patch.historiaTambien = despues.historiaTambien;
  const m1 = antes.medios.map(m => m.src), m2 = despues.medios.map(m => m.src); if (JSON.stringify(m1) !== JSON.stringify(m2)) patch.medios = m2;
  return patch;
}

export { choqueDe, siguienteHueco };

export function thumbHTML(src, esc, cls = 'pz-th') {
  const u = mediaUrl(src);
  if (!u) return `<span class="${cls} ph" aria-hidden="true" style="--h:${[...String(src)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}">${esVideo(src) ? '<i>▶</i>' : ''}</span>`;
  return esVideo(src) ? `<span class="${cls} vid" aria-hidden="true"><video src="${esc(u)}#t=0.1" preload="metadata" muted playsinline></video><i>▶</i></span>` : `<span class="${cls}" aria-hidden="true"><img src="${esc(u)}" alt="" loading="lazy" decoding="async"></span>`;
}

export function initPieza({ host, datos, esc, pickMedia, openEstudio, onChange = () => {}, note = () => {}, otras = () => [], cuenta = () => ({}), medidaDe = () => null }) {
  const id0 = ++uid, I = k => `pz${id0}-${k}`;
  host.innerHTML = `<div class="pz-head"></div>
    <div class="pz-swap" role="tablist" aria-label="Qué ver"><button type="button" role="tab" data-swap="edit" aria-selected="true">Editar</button><button type="button" role="tab" data-swap="ver" aria-selected="false">Vista previa</button></div>
    <div class="pz-body"><div class="pz-scroll" tabindex="-1"></div><aside class="pz-side" aria-label="Vista previa"><div class="pz-side-h">Así se verá</div><div class="pz-preview"></div></aside></div>
    <div class="pz-foot"></div>`;
  const head = host.querySelector('.pz-head'), scroll = host.querySelector('.pz-scroll'), foot = host.querySelector('.pz-foot'), side = host.querySelector('.pz-side');
  const preview = initPreview(host.querySelector('.pz-preview'), { esc, cuenta, otras: () => otras().map(o => (cur && o.id === cur.id ? cur : o)) });
  let cur = null, dirty = {}, timer = null, saving = Promise.resolve(), opener = null, isModal = false, gone = false, stateText = '', stateBad = false;
  // la revisión se calcula aquí, con las mismas reglas que el servidor: se ve al instante, sin esperar al guardado. El servidor la vuelve a comprobar al aprobar.
  const rev = () => {
    const r = revisarPublicacion(postDePieza(cur), cur.redes), m = revisarMomento(cur.fecha, cur.hora);
    return { errores: [...m.errores, ...r.errores], avisos: [...m.avisos, ...r.avisos], arreglos: r.arreglos, momento: m };
  };
  const narrow = () => matchMedia('(max-width: 900px)').matches;
  const isOpen = () => !host.hidden;

  /* ---------- guardar ---------- */
  const hayAlgo = p => !!(p.titulo || p.texto || (p.medios || []).length || p.comentario || p.hashtags || p.notas);
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, 700); setState('Escribiendo…'); }
  function set(patch) { if (!cur) return; Object.assign(cur, patch); Object.assign(dirty, patch); schedule(); paintReview(); paintFoot(); }
  function flush() {
    clearTimeout(timer); timer = null;
    saving = saving.then(async () => {
      if (!cur || gone || !Object.keys(dirty).length) return;
      const patch = dirty; dirty = {};
      try {
        setState('Guardando…');
        if (!cur.id) { if (!hayAlgo(cur)) { dirty = patch; setState(''); return; } const nueva = await datos.create({ ...cur, ...patch }); adopt(nueva); onChange(nueva, { creada: true }); }
        else { const r = await datos.patch(cur.id, patch); adopt(r.pieza); if (r.soltada) note('Ya no está aprobada: cambiaste algo de lo que sale. Vuelve a aprobarla.'); onChange(r.pieza, { soltada: r.soltada }); }
        setState('Guardado');
      } catch (e) { dirty = { ...patch, ...dirty }; setState(e.message || 'No se pudo guardar', true); }
    });
    return saving;
  }
  function adopt(p) { // lo del servidor (estado, revisión, id, medidas); lo que se está escribiendo no se pisa
    if (!cur) return; cur.id = p.id; cur.estado = p.estado; cur.aprobada = p.aprobada; cur.cambiadaTrasAprobar = p.cambiadaTrasAprobar; cur.creada = p.creada;
    if (p.medidas) cur.medidas = { ...(cur.medidas || {}), ...p.medidas };
    paintHead(); paintReview(); paintFoot();
  }
  function setState(t, bad) { stateText = t; stateBad = !!bad; const s = foot.querySelector('.pz-state'); if (s) { s.textContent = t; s.classList.toggle('bad', !!bad); } }

  /* ---------- pintar ---------- */
  const est = () => ESTADO[cur.estado] || ESTADO.borrador;
  function paintHead() {
    const e = est();
    head.innerHTML = `<span class="pz-chip pz-tone" style="--c:${e.color};--cd:${e.dark}" title="${esc(e.help)}"><i aria-hidden="true">${e.glyph}</i>${e.name}${cur.cambiadaTrasAprobar ? ' · CAMBIÓ' : ''}</span>
      <input class="pz-title" id="${I('t')}" maxlength="140" placeholder="Título (solo se ve aquí)" aria-label="Título de la pieza" value="${esc(cur.titulo)}">
      <button type="button" class="pz-x" data-a="close" aria-label="Cerrar la pieza" title="Cerrar (Esc)">✕</button>`;
  }
  const cnt = (n, max) => `${n.toLocaleString('es')} / ${max.toLocaleString('es')}`;
  function paintCuando() {
    const box = scroll.querySelector('.pz-cuando'); if (!box) return;
    const p = cur, ch = choqueDe(p, otras()), m = revisarMomento(p.fecha, p.hora);
    box.innerHTML = `<div class="pz-row"><label for="${I('d')}">Día</label><select id="${I('d')}" class="pz-sel" data-f="fecha"><option value=""${p.fecha ? '' : ' selected'}>Sin día (banco de ideas)</option>${dateOpts(p.fecha)}</select>
        <label for="${I('h')}">Hora</label><select id="${I('h')}" class="pz-sel" data-f="hora"><option value=""${p.hora ? '' : ' selected'}>Sin hora</option>${timeOpts(p.hora)}</select></div>
      <div class="pz-row pz-quick" role="group" aria-label="Horas rápidas">${HORAS_RAPIDAS.map(h => `<button type="button" class="pz-qh" data-qh="${h}" aria-pressed="${p.hora === h}">${h}</button>`).join('')}<button type="button" class="pz-qh wide" data-a="hueco" title="El siguiente día sin nada en estas redes">Siguiente hueco libre</button></div>
      ${ch ? `<p class="pz-inline warn" role="status">Ya hay ${esc(FORMATO[ch.formato]?.toLowerCase() === 'historia' ? 'una historia' : 'un ' + (FORMATO[ch.formato] || 'post').toLowerCase())} a las ${esc(ch.hora)} ese día: «${esc(ch.titulo || 'sin título')}». Sepáralas al menos una hora.</p>` : ''}
      ${p.fecha && m.errores.length ? `<p class="pz-inline err" role="status">${esc(m.errores[0])}</p>` : p.fecha && p.hora ? `<p class="pz-inline ok">Sale ${esc(fmtLong(m.momento))}.</p>` : ''}`;
  }
  function paintBody() {
    const p = cur, post = postDePieza(p), chars = textoPara(post, 'instagram').length, charsFb = textoPara(post, 'facebook').length, hist = p.formato === 'historia';
    const textos = `
        <label for="${I('tx')}" class="pz-lab">Texto de la publicación <small class="pz-cnt" data-cnt="texto">${cnt(chars, LIMITES.instagram.caracteres)}</small></label>
        <textarea id="${I('tx')}" class="pz-ta" data-f="texto" rows="6" placeholder="Escribe aquí lo que se publica, listo para salir. La primera línea es el gancho: es lo que se lee antes de «más».">${esc(p.texto)}</textarea>
        <label for="${I('ht')}" class="pz-lab">Hashtags <small class="pz-cnt" data-cnt="hashtags">${contarHashtags(p.hashtags)} / ${LIMITES.instagram.hashtags}</small></label>
        <input id="${I('ht')}" class="pz-in" data-f="hashtags" value="${esc(p.hashtags)}" placeholder="#optica #gafas">
        <label class="pz-chk"><input type="checkbox" data-f="hashtagsEnComentario"${p.hashtagsEnComentario ? ' checked' : ''}> Los hashtags van en el primer comentario, no en el texto</label>
        <label for="${I('cm')}" class="pz-lab">Primer comentario <small class="pz-hn">opcional · solo Instagram</small></label>
        <textarea id="${I('cm')}" class="pz-ta" data-f="comentario" rows="2" placeholder="Lo que se publica justo después.">${esc(p.comentario)}</textarea>
        ${p.redes.includes('facebook') ? `<details class="pz-more"${p.textoFacebook ? ' open' : ''}><summary>Otro texto para Facebook</summary><label class="pz-lab" for="${I('fb')}">Texto de Facebook <small class="pz-cnt" data-cnt="fb">${cnt(charsFb, LIMITES.facebook.caracteres)}</small></label><textarea id="${I('fb')}" class="pz-ta" data-f="textoFacebook" rows="4" placeholder="Si en Facebook debe decir otra cosa. Vacío = el mismo.">${esc(p.textoFacebook)}</textarea></details>` : ''}`;
    scroll.innerHTML = `
      <section class="pz-sec" aria-labelledby="${I('h1')}"><h3 id="${I('h1')}">1 · Cuándo, cómo y dónde</h3>
        <div class="pz-cuando"></div>
        <div class="pz-row"><span class="pz-lab" id="${I('fm')}">Formato</span><div class="pz-seg" role="group" aria-labelledby="${I('fm')}">${Object.entries(FORMATO).map(([k, l]) => `<button type="button" data-fmt="${k}" aria-pressed="${p.formato === k}">${FICON[k]}${l}</button>`).join('')}</div></div>
        <div class="pz-row"><span class="pz-lab" id="${I('rd')}">Redes</span><div class="pz-nets" role="group" aria-labelledby="${I('rd')}">${Object.entries(RED).map(([k, r]) => `<button type="button" class="pz-net" data-red="${k}" aria-pressed="${p.redes.includes(k)}"><b class="pz-nb ${k}">${r.short}</b> ${r.name}</button>`).join('')}</div></div>
        ${!hist && p.redes.includes('instagram') ? `<label class="pz-chk"><input type="checkbox" data-f="historiaTambien"${p.historiaTambien ? ' checked' : ''}> También como historia de Instagram, 15 minutos después${p.historiaTambien ? ` <small class="pz-hn">· ${(p.historias || []).length ? `con ${(p.historias || []).length === 1 ? 'su imagen' : (p.historias || []).length + ' archivos'}` : 'falta su imagen'}</small>` : ''}</label>${p.historiaTambien ? `<div class="pz-row"><button type="button" class="pz-btn" data-a="hist-post"${p.medios.length ? '' : ' disabled'}>Usar la del post</button><button type="button" class="pz-btn" data-a="hist-pick">Elegir para la historia</button></div>` : ''}` : ''}
      </section>
      <section class="pz-sec" aria-labelledby="${I('h2')}"><h3 id="${I('h2')}">2 · Imágenes o video</h3>
        <div class="pz-medios"></div>
        <div class="pz-row"><button type="button" class="pz-btn" data-a="pick">Elegir del Estudio</button><button type="button" class="pz-btn" data-a="estudio">Crear con el Estudio</button></div>
        <p class="pz-help">${p.formato === 'carrusel' ? 'Un carrusel lleva de 2 a 10, y todos toman la proporción del primero.' : p.formato === 'reel' ? 'Un reel lleva un video vertical 9:16, de 3 s a 15 min.' : p.formato === 'historia' ? 'Una historia es vertical, 9:16 (1080×1920). Un video, hasta 60 s.' : 'Un post lleva una imagen de 4:5 (1080×1350) a 1.91:1.'}</p>
      </section>
      <section class="pz-sec" aria-labelledby="${I('h3')}"><h3 id="${I('h3')}">3 · Lo que dice</h3>
        ${hist ? `<p class="pz-help">Una historia no muestra texto ni hashtags: lo que deba leerse va dentro de la imagen o el video.</p><details class="pz-more"${p.texto || p.hashtags ? ' open' : ''}><summary>Escribir texto de todos modos</summary>${textos}</details>` : textos}
        <label for="${I('nt')}" class="pz-lab">Notas para el equipo <small class="pz-hn">no se publican</small></label>
        <textarea id="${I('nt')}" class="pz-ta" data-f="notas" rows="2" placeholder="Por qué esta idea, qué falta, qué dato confirmar.">${esc(p.notas)}</textarea>
      </section>
      <section class="pz-sec pz-review" aria-labelledby="${I('h5')}"><h3 id="${I('h5')}">4 · ¿Puede salir?</h3><div class="pz-rv" aria-live="polite"></div></section>`;
    paintCuando(); paintMedios(); paintPreview(); paintReview();
  }
  function paintMedios() {
    const box = scroll.querySelector('.pz-medios'); if (!box) return;
    const md = m => { const x = cur.medidas?.[m]; return x?.ancho ? `${x.ancho}×${x.alto}${x.duracion ? ` · ${Math.round(x.duracion)} s` : ''}` : x?.duracion ? `${Math.round(x.duracion)} s` : ''; };
    box.innerHTML = cur.medios.length ? cur.medios.map((m, i) => `<div class="pz-m">${thumbHTML(m, esc, 'pz-mt')}<span class="pz-mn" title="${esc(m)}">${i + 1}. ${esc(m.split('/').pop())}</span>${md(m) ? `<span class="pz-mn">${md(m)}</span>` : ''}
        <span class="pz-ma"><button type="button" data-mv="${i}:-1" aria-label="Mover a la izquierda"${i === 0 ? ' disabled' : ''}>‹</button><button type="button" data-mv="${i}:1" aria-label="Mover a la derecha"${i === cur.medios.length - 1 ? ' disabled' : ''}>›</button><button type="button" data-rm="${i}" aria-label="Quitar este archivo">✕</button></span></div>`).join('') : '<p class="pz-empty">Sin archivos todavía.</p>';
  }
  function paintPreview() { if (cur) preview.paint(cur); }
  function paintReview() {
    const box = scroll.querySelector('.pz-rv'); if (!box) return;
    const r = rev();
    const fix = t => { const a = r.arreglos?.[t]; return a ? `<button type="button" class="pz-fix" data-fix="${esc(a.codigo)}">${esc(a.etiqueta)}</button>` : ''; };
    box.innerHTML = (r.errores.length ? `<ul class="pz-list">${r.errores.map(t => `<li class="err"><span><b class="pz-k">No puede salir:</b> ${esc(t)}</span>${fix(t)}</li>`).join('')}</ul>` : '<p class="pz-ok"><b>✓</b> Cumple las reglas de cada red y tiene día y hora.</p>')
      + (r.avisos.length ? `<ul class="pz-list">${r.avisos.map(t => `<li class="warn"><span><b class="pz-k">Ojo:</b> ${esc(t)}</span>${fix(t)}</li>`).join('')}</ul>` : '');
  }
  function paintFoot() {
    if (!cur) return;
    const p = cur, r = rev(), listo = !r.errores.length, n = r.errores.length;
    const cuando = p.fecha ? fmtLong(new Date(`${p.fecha}T${p.hora || '00:00'}:00`).getTime()).replace(/, \d{2}:\d{2}$/, p.hora ? `, ${p.hora}` : ' (sin hora)') : '';
    const paso = p.fecha && p.hora && new Date(`${p.fecha}T${p.hora}:00`).getTime() < Date.now();
    const veredicto = p.estado === 'aprobada' ? (paso ? `<span class="pz-verd bad">Vencida: era para el ${esc(cuando)} y no salió. Cámbiale el día.</span>` : `<span class="pz-when">✓ Sale ${esc(cuando)}</span>`) : listo ? `<span class="pz-verd ok">✓ Lista para salir${p.fecha ? ' el ' + esc(cuando) : ''}</span>` : `<button type="button" class="pz-verd bad" data-a="ver-problemas">${n === 1 ? '1 problema' : n + ' problemas'}: ${esc(r.errores[0])}</button>`;
    foot.innerHTML = `<div class="pz-vline">${veredicto}</div>
      <div class="pz-acts">${p.estado === 'aprobada' ? `<button type="button" class="pz-btn" data-a="back">Quitar el OK</button>`
        : `${p.estado === 'borrador' || p.estado === 'idea' ? '<button type="button" class="pz-btn" data-a="review">Pasar a revisión</button>' : '<button type="button" class="pz-btn" data-a="draft">Volver a borrador</button>'}<button type="button" class="pz-go${listo ? '' : ' locked'}" data-a="approve"${listo ? '' : ' aria-disabled="true"'} title="${listo ? 'Aprobarla: queda lista para salir' : 'Todavía no puede salir: ' + esc(r.errores[0] || '')}">${listo ? 'Aprobar' : '<span aria-hidden="true">🔒</span> Aprobar'}</button>`}
        <span class="sp"></span><button type="button" class="pz-lk" data-a="dup">Duplicar</button><button type="button" class="pz-lk warn" data-a="delete">Eliminar</button></div>
      <div class="pz-state${stateBad ? ' bad' : ''}" role="status" aria-live="polite">${esc(stateText)}</div>`;
  }

  /* ---------- eventos ---------- */
  host.addEventListener('input', e => {
    const f = e.target.dataset?.f; if (e.target.classList.contains('pz-title')) { set({ titulo: e.target.value }); return; } if (!f || e.target.tagName === 'SELECT' || e.target.type === 'checkbox') return;
    set({ [f]: e.target.value });
    const post = postDePieza(cur), c1 = scroll.querySelector('[data-cnt="texto"]'), c2 = scroll.querySelector('[data-cnt="hashtags"]'), c3 = scroll.querySelector('[data-cnt="fb"]');
    if (c1) { const n = textoPara(post, 'instagram').length; c1.textContent = cnt(n, LIMITES.instagram.caracteres); c1.classList.toggle('over', n > LIMITES.instagram.caracteres); }
    if (c2) { const n = contarHashtags(cur.hashtags); c2.textContent = `${n} / ${LIMITES.instagram.hashtags}`; c2.classList.toggle('over', n > LIMITES.instagram.hashtags); }
    if (c3) { const n = textoPara(post, 'facebook').length; c3.textContent = cnt(n, LIMITES.facebook.caracteres); c3.classList.toggle('over', n > LIMITES.facebook.caracteres); }
    preview.text(cur);
  });
  host.addEventListener('change', e => {
    const f = e.target.dataset?.f; if (!f) return;
    if (e.target.type === 'checkbox') {
      if (f === 'historiaTambien') { set({ historiaTambien: e.target.checked, ...(e.target.checked && !(cur.historias || []).length && cur.medios[0] ? { historias: [cur.medios[0]] } : {}) }); keep(() => paintBody(), `[data-f="historiaTambien"]`); return; }
      set({ [f]: e.target.checked }); paintPreview(); return;
    }
    if (e.target.tagName === 'SELECT') { set({ [f]: e.target.value }); keep(paintCuando, `[data-f="${f}"]`); paintPreview(); }
  });
  /** Repinta y deja el foco donde estaba (un select o una casilla que se vuelve a crear). */
  function keep(fn, sel) { fn(); const el = scroll.querySelector(sel); if (el) el.focus({ preventScroll: true }); }
  const swapMedios = list => { const extra = {}; for (const m of list) if (!cur.medidas?.[m]) { const x = medidaDe(m); if (x) extra[m] = x; } if (Object.keys(extra).length) cur.medidas = { ...(cur.medidas || {}), ...extra }; set({ medios: list }); paintMedios(); paintPreview(); };
  function swap(to) { host.dataset.swap = to; host.querySelectorAll('[data-swap]').forEach(b => b.setAttribute('aria-selected', b.dataset.swap === to)); if (to === 'ver') paintPreview(); }
  host.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || !cur || b.closest('.pz-preview')) return;
    if (b.dataset.swap) { swap(b.dataset.swap); return; }
    if (b.dataset.fmt) { set({ formato: b.dataset.fmt }); keep(() => paintBody(), `[data-fmt="${b.dataset.fmt}"]`); return; }
    if (b.dataset.qh) { set({ hora: b.dataset.qh }); keep(paintCuando, `[data-qh="${b.dataset.qh}"]`); paintPreview(); return; }
    if (b.dataset.red) { const on = cur.redes.includes(b.dataset.red); const next = on ? cur.redes.filter(r => r !== b.dataset.red) : [...cur.redes, b.dataset.red]; if (!next.length) { setState('Elige al menos una red.', true); return; } set({ redes: next }); keep(() => paintBody(), `[data-red="${b.dataset.red}"]`); return; }
    if (b.dataset.rm !== undefined) { swapMedios(cur.medios.filter((_, i) => i !== +b.dataset.rm)); return; }
    if (b.dataset.mv) { const [i, d] = b.dataset.mv.split(':').map(Number), l = [...cur.medios], j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; swapMedios(l); return; }
    if (b.dataset.fix) { if (b.dataset.fix === 'medios') { const ids = await pickMedia(cur.medios); if (ids?.length) swapMedios([...cur.medios, ...ids.filter(x => !cur.medios.includes(x))]); return; } const patch = parchePorArreglo(cur, b.dataset.fix); if (Object.keys(patch).length) { set(patch); await flush(); paintBody(); } return; }
    const a = b.dataset.a; if (!a) return;
    if (a === 'close') return close();
    if (a === 'hueco') { const f = siguienteHueco(cur.redes, otras().filter(o => o.id !== cur.id)); set({ fecha: f, hora: cur.hora || '18:00' }); keep(paintCuando, '[data-a="hueco"]'); paintPreview(); setState(`Siguiente hueco: ${fmtDay(new Date(f + 'T00:00:00').getTime())}.`); return; }
    if (a === 'hist-post') { if (cur.medios[0]) { set({ historias: [cur.medios[0]] }); keep(() => paintBody(), '[data-a="hist-post"]'); } return; }
    if (a === 'hist-pick') { const ids = await pickMedia(cur.historias || []); if (ids?.length) { set({ historias: ids.slice(0, 10) }); keep(() => paintBody(), '[data-a="hist-pick"]'); } return; }
    if (a === 'ver-problemas') { swap('edit'); const sec = scroll.querySelector('.pz-review'); sec?.scrollIntoView({ block: 'start', behavior: 'smooth' }); (sec?.querySelector('.pz-fix') || sec)?.focus?.({ preventScroll: true }); return; }
    if (a === 'pick') { const ids = await pickMedia(cur.medios); if (ids?.length) swapMedios([...cur.medios, ...ids.filter(x => !cur.medios.includes(x))]); return; }
    if (a === 'estudio') { await flush(); if (!cur.id) { if (!hayAlgo(cur)) set({ titulo: cur.titulo || 'Pieza nueva' }); await flush(); } openEstudio(cur); return; }
    if (a === 'approve') {
      await flush(); if (!cur.id) { setState('Escribe algo antes de aprobarla.', true); return; }
      const r = rev(); if (r.errores.length) { setState(r.errores[0], true); scroll.querySelector('.pz-review')?.scrollIntoView({ block: 'nearest' }); return; }
      try { setState('Aprobando…'); const res = await datos.approve(cur.id); adopt(res.pieza); paintBody(); onChange(res.pieza, { aprobada: true }); setState('Aprobada'); note('Aprobada. Queda lista en Programación.'); }
      catch (err) { setState(err.message, true); }
      return;
    }
    if (a === 'review' || a === 'draft') { await flush(); if (!cur.id) return; try { const p = await datos.back(cur.id, a === 'review' ? 'revision' : 'borrador'); adopt(p); onChange(p, {}); setState(a === 'review' ? 'Pasó a revisión' : 'Vuelve a ser borrador'); } catch (err) { setState(err.message, true); } return; }
    if (a === 'back') { await flush(); try { const p = await datos.back(cur.id, 'revision'); adopt(p); paintBody(); onChange(p, {}); setState('Ya no está aprobada'); } catch (err) { setState(err.message, true); } return; }
    if (a === 'dup') {
      await flush(); const src = cur; const copia = {}; for (const k of ['titulo', 'fecha', 'hora', 'formato', 'redes', 'medios', 'historiaTambien', 'historias', 'texto', 'comentario', 'hashtags', 'hashtagsEnComentario', 'textoFacebook', 'notas']) copia[k] = JSON.parse(JSON.stringify(src[k] ?? ''));
      copia.titulo = (src.titulo || 'Pieza') + ' (copia)'; copia.fecha = ''; copia.hora = ''; copia.estado = 'borrador';
      try { const nueva = await datos.create(copia); nueva.medidas = { ...(src.medidas || {}), ...(nueva.medidas || {}) }; onChange(nueva, { creada: true }); open(nueva); setState('Duplicada sin día: elige cuándo sale.'); } catch (err) { setState(err.message, true); }
      return;
    }
    if (a === 'delete') { const p = cur; gone = true; close({ discard: true }); onChange(p, { eliminar: true }); return; }
  });
  host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.stopPropagation(); });

  /* ---------- abrir y cerrar ---------- */
  function open(p) {
    gone = false; if (!isOpen()) opener = document.activeElement;
    cur = p.id ? JSON.parse(JSON.stringify(p)) : { id: '', titulo: '', fecha: p.fecha || '', hora: p.hora || '', formato: p.formato || 'post', redes: p.redes || ['instagram', 'facebook'], estado: 'borrador', responsable: '', medios: p.medios || [], historiaTambien: false, historias: [], texto: '', comentario: '', hashtags: '', hashtagsEnComentario: false, textoFacebook: '', notas: '', origen: 'dueno', tarea: '', aprobada: null, medidas: {}, ...(p.extra || {}) };
    cur.medidas ||= {};
    dirty = {}; stateText = ''; stateBad = false; if (!cur.id && (cur.medios.length || cur.fecha)) dirty = { medios: cur.medios, ...(cur.fecha ? { fecha: cur.fecha, hora: cur.hora, formato: cur.formato } : {}) };
    host.hidden = false; host.classList.add('on'); isModal = narrow(); host.setAttribute('role', isModal ? 'dialog' : 'complementary'); if (isModal) host.setAttribute('aria-modal', 'true'); else host.removeAttribute('aria-modal');
    host.setAttribute('aria-label', 'Pieza de contenido'); if (isModal) modal.open(host);
    preview.reset(); swap('edit');
    paintHead(); paintBody(); paintFoot(); if (!cur.id && cur.medios.length) schedule();
    (cur.id ? scroll : head.querySelector('.pz-title')).focus({ preventScroll: true });
  }
  async function close(o = {}) {
    if (!isOpen()) return;
    if (!o.discard) await flush();
    if (isModal) modal.close(host);
    host.classList.remove('on'); host.hidden = true; const was = cur; cur = null; dirty = {};
    if (opener && document.contains(opener) && !o.quiet) opener.focus({ preventScroll: true });
    if (o.after) o.after(was);
    onChange(was, { cerrada: true });
  }
  return {
    open, close, isOpen, flush, current: () => cur,
    addMedios(ids) { if (!cur) return; swapMedios([...cur.medios, ...ids.filter(x => !cur.medios.includes(x))]); },
    refresh(p) { if (cur && p && p.id === cur.id) { adopt(p); if (p.fecha !== cur.fecha || p.hora !== cur.hora) { cur.fecha = p.fecha; cur.hora = p.hora; paintCuando(); paintPreview(); } } },
    repaintPreview: paintPreview,
  };
}

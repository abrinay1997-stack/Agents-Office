// Agents Office V4.7 (30 sep 2026) — el PANEL de una pieza de contenido: cuándo sale, dónde, qué archivos, qué dice, y si puede salir.
// Un panel a un lado del calendario (a lo ancho el calendario sigue a mano; en el teléfono ocupa la pantalla). Se guarda solo, con una pausa al
// teclear, y siempre al cerrarlo: el guardado cuelga del cierre y no del botón, o cerrar con Esc o con un clic fuera perdería lo escrito.
//   initPieza({ host, datos, esc, pickMedia, openEstudio, onChange, note }) → { open(pieza | { fecha }), close(), isOpen(), current(), addMedios(ids) }
// `datos` es lo de contenido-datos.js; `pickMedia()` abre el selector de la galería del Estudio y devuelve los ids elegidos.
import { modal } from './modal.js';
import { dateOpts, timeOpts, fmtLong } from './calendar-core.js';
import { LIMITES, postDePieza, aplicarArreglo, textoPara, primerComentario, contarHashtags, revisarPublicacion } from './contenido-reglas.js';

export const ESTADO = {
  idea: { name: 'IDEA', glyph: '◌', color: '#5A5A5A', dark: '#B9B6AE', help: 'Una idea suelta: todavía no es una publicación.' },
  borrador: { name: 'BORRADOR', glyph: '✎', color: '#8A6414', dark: '#E8B44A', help: 'Se está escribiendo.' },
  revision: { name: 'A REVISAR', glyph: '●', color: '#2B6BEB', dark: '#8FB0FF', help: 'Lista para que la mires y la apruebes.' },
  aprobada: { name: 'APROBADA', glyph: '✓', color: '#13705A', dark: '#4FD1A5', help: 'Aprobada por ti: puede salir.' },
};
export const FORMATO = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };
export const RED = { instagram: { name: 'Instagram', short: 'IG' }, facebook: { name: 'Facebook', short: 'FB' } };
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

export function thumbHTML(src, esc, cls = 'pz-th') {
  const u = mediaUrl(src);
  if (!u) return `<span class="${cls} ph" aria-hidden="true" style="--h:${[...String(src)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}"></span>`;
  return esVideo(src) ? `<span class="${cls} vid" aria-hidden="true"><video src="${esc(u)}#t=0.1" preload="metadata" muted playsinline></video><i>▶</i></span>` : `<span class="${cls}" aria-hidden="true"><img src="${esc(u)}" alt="" loading="lazy" decoding="async"></span>`;
}

export function initPieza({ host, datos, esc, pickMedia, openEstudio, onChange = () => {}, note = () => {} }) {
  const id0 = ++uid, I = k => `pz${id0}-${k}`;
  host.innerHTML = '<div class="pz-head"></div><div class="pz-scroll" tabindex="-1"></div><div class="pz-foot"></div>';
  const head = host.querySelector('.pz-head'), scroll = host.querySelector('.pz-scroll'), foot = host.querySelector('.pz-foot');
  let cur = null, dirty = {}, timer = null, saving = Promise.resolve(), opener = null, isModal = false, gone = false, stateText = '', stateBad = false;
  // la revisión se calcula aquí, con las mismas reglas que el servidor: se ve al instante, sin esperar al guardado. El servidor la vuelve a comprobar al aprobar.
  const rev = () => { const r = revisarPublicacion(postDePieza(cur), cur.redes); return { errores: r.errores, avisos: r.avisos, arreglos: r.arreglos }; };
  const narrow = () => matchMedia('(max-width: 900px)').matches;
  const isOpen = () => !host.hidden;

  /* ---------- guardar ---------- */
  const hayAlgo = p => !!(p.titulo || p.texto || (p.medios || []).length || p.comentario || p.hashtags || p.notas);
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, 700); setState('Escribiendo…'); }
  function set(patch) { if (!cur) return; Object.assign(cur, patch); Object.assign(dirty, patch); schedule(); paintReview(); paintApprove(); }
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
  function adopt(p) { // lo del servidor (estado, revisión, id); lo que se está escribiendo no se pisa
    if (!cur) return; cur.id = p.id; cur.estado = p.estado; cur.aprobada = p.aprobada; cur.cambiadaTrasAprobar = p.cambiadaTrasAprobar; cur.creada = p.creada;
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
  const opts = (list, val) => list.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('');
  function paintBody() {
    const p = cur, chars = textoPara(postDePieza(p), 'instagram').length;
    scroll.innerHTML = `
      <section class="pz-sec" aria-labelledby="${I('h1')}"><h3 id="${I('h1')}">1 · Cuándo y dónde sale</h3>
        <div class="pz-row"><label for="${I('d')}">Día</label><select id="${I('d')}" class="pz-sel" data-f="fecha"><option value=""${p.fecha ? '' : ' selected'}>Sin día (banco de ideas)</option>${dateOpts(p.fecha)}</select>
          <label for="${I('h')}">Hora</label><select id="${I('h')}" class="pz-sel" data-f="hora"><option value=""${p.hora ? '' : ' selected'}>Sin hora</option>${timeOpts(p.hora)}</select></div>
        <div class="pz-row"><span class="pz-lab" id="${I('fm')}">Formato</span><div class="pz-seg" role="group" aria-labelledby="${I('fm')}">${Object.entries(FORMATO).map(([k, l]) => `<button type="button" data-fmt="${k}" aria-pressed="${p.formato === k}">${l}</button>`).join('')}</div></div>
        <div class="pz-row"><span class="pz-lab" id="${I('rd')}">Redes</span><div class="pz-nets" role="group" aria-labelledby="${I('rd')}">${Object.entries(RED).map(([k, r]) => `<button type="button" class="pz-net" data-red="${k}" aria-pressed="${p.redes.includes(k)}"><b>${r.short}</b> ${r.name}</button>`).join('')}</div></div>
      </section>
      <section class="pz-sec" aria-labelledby="${I('h2')}"><h3 id="${I('h2')}">2 · Imágenes o video</h3>
        <div class="pz-medios"></div>
        <div class="pz-row"><button type="button" class="pz-btn" data-a="pick">Elegir del Estudio</button><button type="button" class="pz-btn" data-a="estudio">Crear con el Estudio</button></div>
        <p class="pz-help">Los archivos son los de la galería del Estudio. ${p.formato === 'carrusel' ? 'Un carrusel lleva de 2 a 10.' : p.formato === 'reel' ? 'Un reel lleva un video.' : p.formato === 'historia' ? 'Una historia es vertical, 9:16.' : 'Un post lleva una imagen (o un video).'}</p>
      </section>
      <section class="pz-sec" aria-labelledby="${I('h3')}"><h3 id="${I('h3')}">3 · Lo que dice</h3>
        <label for="${I('tx')}" class="pz-lab">Texto de la publicación <small class="pz-cnt" data-cnt="texto">${chars.toLocaleString('es')} / ${LIMITES.instagram.caracteres.toLocaleString('es')}</small></label>
        <textarea id="${I('tx')}" class="pz-ta" data-f="texto" rows="6" placeholder="Escribe aquí lo que se publica, listo para salir.">${esc(p.texto)}</textarea>
        <label for="${I('ht')}" class="pz-lab">Hashtags <small class="pz-cnt" data-cnt="hashtags">${contarHashtags(p.hashtags)} / ${LIMITES.instagram.hashtags}</small></label>
        <input id="${I('ht')}" class="pz-in" data-f="hashtags" value="${esc(p.hashtags)}" placeholder="#optica #gafas">
        <label class="pz-chk"><input type="checkbox" data-f="hashtagsEnComentario"${p.hashtagsEnComentario ? ' checked' : ''}> Los hashtags van en el primer comentario, no en el texto</label>
        <label for="${I('cm')}" class="pz-lab">Primer comentario <small class="pz-hn">opcional</small></label>
        <textarea id="${I('cm')}" class="pz-ta" data-f="comentario" rows="2" placeholder="Lo que se publica justo después.">${esc(p.comentario)}</textarea>
        <details class="pz-more"${p.textoFacebook ? ' open' : ''}><summary>Otro texto para Facebook</summary><textarea class="pz-ta" data-f="textoFacebook" rows="4" aria-label="Texto de Facebook" placeholder="Si en Facebook debe decir otra cosa. Vacío = el mismo.">${esc(p.textoFacebook)}</textarea></details>
        <label for="${I('nt')}" class="pz-lab">Notas para el equipo <small class="pz-hn">no se publican</small></label>
        <textarea id="${I('nt')}" class="pz-ta" data-f="notas" rows="2" placeholder="Por qué esta idea, qué falta, qué dato confirmar.">${esc(p.notas)}</textarea>
      </section>
      <section class="pz-sec" aria-labelledby="${I('h4')}"><h3 id="${I('h4')}">4 · Así se ve</h3><div class="pz-preview"></div></section>
      <section class="pz-sec pz-review" aria-labelledby="${I('h5')}" aria-live="polite"><h3 id="${I('h5')}">5 · ¿Puede salir?</h3><div class="pz-rv"></div></section>`;
    paintMedios(); paintPreview(); paintReview();
  }
  function paintMedios() {
    const box = scroll.querySelector('.pz-medios'); if (!box) return;
    box.innerHTML = cur.medios.length ? cur.medios.map((m, i) => `<div class="pz-m">${thumbHTML(m, esc, 'pz-mt')}<span class="pz-mn">${esc(m.split('/').pop())}</span>
        <span class="pz-ma"><button type="button" data-mv="${i}:-1" aria-label="Mover a la izquierda"${i === 0 ? ' disabled' : ''}>‹</button><button type="button" data-mv="${i}:1" aria-label="Mover a la derecha"${i === cur.medios.length - 1 ? ' disabled' : ''}>›</button><button type="button" data-rm="${i}" aria-label="Quitar este archivo">✕</button></span></div>`).join('') : '<p class="pz-empty">Sin archivos todavía.</p>';
  }
  function paintPreview() {
    const box = scroll.querySelector('.pz-preview'); if (!box) return;
    const post = postDePieza(cur), txt = textoPara(post, 'instagram'), first = cur.medios[0], com = primerComentario(post);
    box.innerHTML = `<div class="pz-ig"><div class="pz-ig-h"><i></i><b>tu_cuenta</b></div><div class="pz-ig-m">${first ? thumbHTML(first, esc, 'pz-igt') : '<span class="pz-igt none">Sin imagen</span>'}${cur.medios.length > 1 ? `<span class="pz-ig-n">1 / ${cur.medios.length}</span>` : ''}</div>
      <div class="pz-ig-c"><b>tu_cuenta</b> ${esc(txt.length > 125 ? txt.slice(0, 125).trimEnd() + '… más' : txt) || '<em>Sin texto todavía</em>'}</div>${com ? `<div class="pz-ig-cm"><b>tu_cuenta</b> ${esc(com.slice(0, 90))}</div>` : ''}
      ${cur.medios.length === 0 ? '' : '<p class="pz-help">Vista aproximada: Instagram corta lo que no cabe en 4:5.</p>'}</div>`;
  }
  function paintReview() {
    const box = scroll.querySelector('.pz-rv'); if (!box) return;
    const r = rev();
    const fix = t => { const a = r.arreglos?.[t]; return a ? `<button type="button" class="pz-fix" data-fix="${esc(a.codigo)}">${esc(a.etiqueta)}</button>` : ''; };
    const sinDia = cur.fecha ? '' : '<li class="err"><span>Ponle un día para poder aprobarla.</span></li>';
    box.innerHTML = (r.errores.length || sinDia ? `<ul class="pz-list">${sinDia}${r.errores.map(t => `<li class="err"><span>${esc(t)}</span>${fix(t)}</li>`).join('')}</ul>` : '<p class="pz-ok"><b>✓</b> Cumple las reglas de cada red.</p>')
      + (r.avisos.length ? `<ul class="pz-list">${r.avisos.map(t => `<li class="warn"><span>${esc(t)}</span>${fix(t)}</li>`).join('')}</ul>` : '');
  }
  function paintFoot() {
    const p = cur, listo = !rev().errores.length && !!p.fecha;
    const cuando = p.fecha ? fmtLong(new Date(`${p.fecha}T${p.hora || '09:00'}:00`).getTime()).replace(/, (\d{2}:\d{2})$/, p.hora ? ', $1' : '') : '';
    foot.innerHTML = `<div class="pz-state${stateBad ? ' bad' : ''}" role="status" aria-live="polite">${esc(stateText)}</div>
      <div class="pz-acts">${p.estado === 'aprobada' ? `<span class="pz-when">Sale ${esc(cuando)}</span><button type="button" class="pz-btn" data-a="back">Quitar el OK</button>`
        : `${p.estado === 'borrador' || p.estado === 'idea' ? '<button type="button" class="pz-btn" data-a="review">Pasar a revisión</button>' : '<button type="button" class="pz-btn" data-a="draft">Volver a borrador</button>'}<button type="button" class="pz-go" data-a="approve"${listo ? '' : ' aria-disabled="true"'} title="${listo ? 'Aprobarla: queda lista para salir' : 'Todavía no puede salir: mira «¿Puede salir?»'}">Aprobar</button>`}
        <span class="sp"></span><button type="button" class="pz-lk warn" data-a="delete">Eliminar</button></div>`;
  }

  function paintApprove() { const b = foot.querySelector('[data-a="approve"]'); if (!b) return; const listo = !rev().errores.length && !!cur.fecha; if (listo) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true'); b.title = listo ? 'Aprobarla: queda lista para salir' : 'Todavía no puede salir: mira «¿Puede salir?»'; }

  /* ---------- eventos ---------- */
  host.addEventListener('input', e => {
    const f = e.target.dataset?.f; if (e.target.classList.contains('pz-title')) { set({ titulo: e.target.value }); return; } if (!f || e.target.tagName === 'SELECT' || e.target.type === 'checkbox') return;
    set({ [f]: e.target.value });
    const post = postDePieza(cur), c1 = scroll.querySelector('[data-cnt="texto"]'), c2 = scroll.querySelector('[data-cnt="hashtags"]');
    if (c1) { const n = textoPara(post, 'instagram').length; c1.textContent = `${n.toLocaleString('es')} / ${LIMITES.instagram.caracteres.toLocaleString('es')}`; c1.classList.toggle('over', n > LIMITES.instagram.caracteres); }
    if (c2) { const n = contarHashtags(cur.hashtags); c2.textContent = `${n} / ${LIMITES.instagram.hashtags}`; c2.classList.toggle('over', n > LIMITES.instagram.hashtags); }
    paintPreview();
  });
  host.addEventListener('change', e => {
    const f = e.target.dataset?.f; if (!f) return;
    if (e.target.type === 'checkbox') { set({ [f]: e.target.checked }); paintPreview(); return; }
    if (e.target.tagName === 'SELECT') { set({ [f]: e.target.value }); paintFoot(); }
  });
  const swapMedios = list => { set({ medios: list }); paintMedios(); paintPreview(); };
  host.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || !cur) return;
    if (b.dataset.fmt) { set({ formato: b.dataset.fmt }); scroll.querySelectorAll('[data-fmt]').forEach(x => x.setAttribute('aria-pressed', x === b)); paintPreview(); return; }
    if (b.dataset.red) { const on = cur.redes.includes(b.dataset.red); const next = on ? cur.redes.filter(r => r !== b.dataset.red) : [...cur.redes, b.dataset.red]; if (!next.length) { setState('Elige al menos una red.', true); return; } set({ redes: next }); b.setAttribute('aria-pressed', !on); return; }
    if (b.dataset.rm !== undefined) { swapMedios(cur.medios.filter((_, i) => i !== +b.dataset.rm)); return; }
    if (b.dataset.mv) { const [i, d] = b.dataset.mv.split(':').map(Number), l = [...cur.medios], j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; swapMedios(l); return; }
    if (b.dataset.fix) { if (b.dataset.fix === 'medios') { const ids = await pickMedia(cur.medios); if (ids?.length) swapMedios([...cur.medios, ...ids.filter(x => !cur.medios.includes(x))]); return; } const patch = parchePorArreglo(cur, b.dataset.fix); if (Object.keys(patch).length) { set(patch); await flush(); paintBody(); } return; }
    const a = b.dataset.a; if (!a) return;
    if (a === 'close') return close();
    if (a === 'pick') { const ids = await pickMedia(cur.medios); if (ids?.length) swapMedios([...cur.medios, ...ids.filter(x => !cur.medios.includes(x))]); return; }
    if (a === 'estudio') { await flush(); if (!cur.id) { if (!hayAlgo(cur)) set({ titulo: cur.titulo || 'Pieza nueva' }); await flush(); } openEstudio(cur); return; }
    if (a === 'approve') {
      await flush(); if (!cur.id) { setState('Escribe algo antes de aprobarla.', true); return; }
      if (b.getAttribute('aria-disabled') === 'true' || !cur.fecha) { setState(!cur.fecha ? 'Ponle un día antes de aprobarla.' : (rev().errores[0] || 'Todavía no puede salir.'), true); scroll.querySelector('.pz-review')?.scrollIntoView({ block: 'nearest' }); return; }
      try { setState('Aprobando…'); const r = await datos.approve(cur.id); adopt(r.pieza); paintBody(); onChange(r.pieza, { aprobada: true }); setState('Aprobada'); note('Aprobada. Queda lista en Programación.'); }
      catch (err) { setState(err.message, true); }
      return;
    }
    if (a === 'review' || a === 'draft') { await flush(); if (!cur.id) return; try { const p = await datos.back(cur.id, a === 'review' ? 'revision' : 'borrador'); adopt(p); onChange(p, {}); setState(a === 'review' ? 'Pasó a revisión' : 'Vuelve a ser borrador'); } catch (err) { setState(err.message, true); } return; }
    if (a === 'back') { await flush(); try { const p = await datos.back(cur.id, 'revision'); adopt(p); paintBody(); onChange(p, {}); setState('Ya no está aprobada'); } catch (err) { setState(err.message, true); } return; }
    if (a === 'delete') { const p = cur; gone = true; close({ discard: true }); onChange(p, { eliminar: true }); return; }
  });
  host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.stopPropagation(); });

  /* ---------- abrir y cerrar ---------- */
  function open(p) {
    gone = false; opener = document.activeElement;
    cur = p.id ? JSON.parse(JSON.stringify(p)) : { id: '', titulo: '', fecha: p.fecha || '', hora: p.hora || '', formato: p.formato || 'post', redes: p.redes || ['instagram', 'facebook'], estado: 'borrador', responsable: '', medios: p.medios || [], historiaTambien: false, historias: [], texto: '', comentario: '', hashtags: '', hashtagsEnComentario: false, textoFacebook: '', notas: '', origen: 'dueno', tarea: '', aprobada: null, ...(p.extra || {}) };
    dirty = {}; stateText = ''; stateBad = false; if (!cur.id && cur.medios.length) dirty = { medios: cur.medios };
    host.hidden = false; host.classList.add('on'); isModal = narrow(); host.setAttribute('role', isModal ? 'dialog' : 'complementary'); if (isModal) host.setAttribute('aria-modal', 'true'); else host.removeAttribute('aria-modal');
    host.setAttribute('aria-label', 'Pieza de contenido'); if (isModal) modal.open(host);
    paintHead(); paintBody(); paintFoot(); if (!cur.id && dirty.medios) schedule();
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
    refresh(p) { if (cur && p && p.id === cur.id) { adopt(p); } },
  };
}

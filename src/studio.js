// Agents Office — the ESTUDIO on the page (E, or the clapperboard in the bar): generate images and video by hand or in
// batches, and see everything the agents generated. The work happens on the server (media.mjs) as background jobs.
//   initStudio(ctx) → { open, close, toggle, isOpen }
//   ctx: isLive() · esc · agentName(id) · openTask?(taskSid)
// V2 (24 Sep 2026, after open-higgsfield): a catalog of models with their own settings, start/end frames and references,
// «Animar», live tiles, a masonry gallery, multi-select with ZIP and undo, an Uploads tab.
// V2.1 (same day, the owner: «organizar esta suite… más intuitivo»): a guided composer — 1 what, 2 model (a picker that
// says what each model is good at), 3 the idea, 4 starting material, 5 format as shapes + «más ajustes» folded — with the
// quantity and GENERAR fixed at the bottom; card actions as icons over the picture; clear names everywhere.
import { modal } from './modal.js'; // V4.1: the page outside an open window is inert
const LBL = { aspectRatio: 'Formato', resolution: 'Resolución', duration: 'Duración (segundos)', batchSize: 'Imágenes por pedido', enhancePrompt: 'Que el motor mejore el prompt', sound: 'Con sonido', cfgScale: 'Fidelidad al prompt', multiShots: 'Varias tomas', generateAudio: 'Con audio', outputFormat: 'Archivo', quality: 'Calidad', keepOriginalSound: 'Mantener el sonido del video', characterOrientation: 'Orientación del personaje' };
const VAL = { auto: 'Auto', low: 'Baja', medium: 'Media', high: 'Alta', video: 'la del video', image: 'la de la imagen' };
const RATIO_USE = { '1:1': 'Cuadrado', '4:5': 'Feed', '9:16': 'Reel · Story', '16:9': 'Web · YouTube', '3:4': 'Vertical', '4:3': 'Horizontal', '2:3': 'Póster', '3:2': 'Foto', '21:9': 'Cine', auto: 'Auto' };
const ROLE = { start: 'Imagen inicial', end: 'Imagen final', reference: 'Referencias', video: 'Video de origen' };
const ROLE_HELP = { start: 'el video empieza así', end: 'el video termina así', reference: 'tu producto, logo, personaje o estilo', video: 'el video que se cambia o se alarga' };
// V4.2 (audit A1): an image model's slots are not «el video empieza así» — the same roles, in image words
const ROLE_IMG = { start: 'Imagen a editar', end: 'Resultado parecido a esta' }, ROLE_IMG_HELP = { start: 'la foto que el modelo cambia', end: 'cómo debería quedar' };
const I = { // line icons (stroke = currentColor)
  img: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 9"/>',
  vid: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', up: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  plus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>', again: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', spark: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};
const svg = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const store = { get(k, d) { try { const v = localStorage.getItem('ao.st.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('ao.st.' + k, JSON.stringify(v)); } catch {} } };

export function initStudio(ctx) {
  const { isLive, esc, agentName } = ctx;
  const el = document.createElement('div'); el.id = 'studioOv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'stTitle'); el.tabIndex = -1; el.hidden = true;
  el.innerHTML = `
    <div class="st-head">
      <span class="st-logo">${svg('vid')}</span><div><div class="st-name" id="stTitle">Estudio</div><div class="st-sub">Imágenes y video reales. Sigue generando aunque cierres esta ventana; tus agentes también lo usan.</div></div>
      <span class="sp"></span><div class="st-budget" aria-live="polite"></div><button type="button" class="st-x" aria-label="Cerrar el Estudio" title="Cerrar (Esc)">${svg('x')}</button>
    </div>
    <div class="st-ptabs" role="tablist" aria-label="Estudio"><button type="button" role="tab" data-pt="gen" aria-selected="true">Crear</button><button type="button" role="tab" data-pt="gal" aria-selected="false">Galería <b class="st-ptn"></b></button></div>
    <div class="st-body">
      <section class="st-gen" aria-label="Crear">
        <div class="st-scroll">
          <div class="st-step"><div class="st-h"><b>1</b> ¿Qué quieres crear?</div>
            <div class="st-kind" role="group" aria-label="Tipo"><button type="button" data-kind="image" aria-pressed="false">${svg('img')}<span>Imagen</span></button><button type="button" data-kind="video" aria-pressed="false">${svg('vid')}<span>Video</span></button></div></div>
          <div class="st-step"><div class="st-h"><b>2</b> Modelo</div>
            <div class="st-mwrap"><button type="button" class="st-mpick" aria-haspopup="listbox" aria-expanded="false"></button><div class="st-mlist" hidden role="listbox" aria-label="Modelos"></div></div></div>
          <div class="st-step"><div class="st-h"><b>3</b> Describe lo que quieres <span class="sp"></span><label class="st-batch" title="Varias ideas a la vez: una por línea"><input type="checkbox" class="st-mode"> Varias ideas (una por línea)</label></div>
            <div class="st-pwrap"><textarea class="st-prompt" rows="4" aria-label="Qué quieres crear"></textarea>
              <div class="st-ferr" hidden role="alert"></div><div class="st-prow"><button type="button" class="st-enh" title="Claude lo reescribe como un prompt de producción">${svg('spark')}<span>Mejorar el prompt</span></button><select class="st-lang" aria-label="Idioma del prompt mejorado" title="En inglés los motores suelen entenderlo mejor; te muestro la traducción debajo"><option value="en">en inglés</option><option value="es">en español</option></select><button type="button" class="st-undo-enh" hidden>Volver al mío</button><span class="sp"></span><span class="st-plen"></span></div>
              <div class="st-es" hidden><b>En español:</b> <span></span></div></div></div>
          <div class="st-step st-matstep"><div class="st-h"><b>4</b> Material de partida <span class="st-hn">opcional</span></div><div class="st-slots"></div></div>
          <div class="st-step"><div class="st-h"><b class="st-n5">5</b> Formato y ajustes</div><div class="st-ratios"></div><div class="st-sets"></div>
            <details class="st-more"><summary>Más ajustes</summary><div class="st-sets2"></div></details></div>
          <details class="st-keys"><summary>Motores y cómo activarlos</summary><div class="st-engs"></div>
            <p>La key se guarda en Windows una sola vez (con el comando de arriba en una ventana de comandos, o en «Editar las variables de entorno de esta cuenta») y se reinicia la oficina con el iniciador. Nunca va en un archivo. Pon también un límite de gasto en la web de cada servicio.</p>
            <p>El tope diario de la oficina está en <code>office.config.json → media.dailyLimit</code> (un video cuenta como 5 imágenes).</p></details>
        </div>
        <div class="st-foot">
          <div class="st-qty" role="group" aria-label="Cantidad"><span>Cantidad</span><button type="button" data-d="-1" aria-label="Menos">−</button><output class="st-n">1</output><button type="button" data-d="1" aria-label="Más">+</button></div>
          <button type="button" class="st-go">GENERAR</button>
          <button type="button" class="st-sum" title="Cambiar el formato y los ajustes (paso 5)"></button>
          <div class="st-est"></div>
          <div class="st-keyhelp" hidden role="alert"></div>
          <div class="st-msg" aria-live="polite"></div>
        </div>
      </section>
      <section class="st-gal" aria-label="Galería">
        <div class="st-filt">
          <div class="st-tabs" role="group" aria-label="Mostrar"><button type="button" data-f="all" class="on" aria-pressed="true">Todo</button><button type="button" data-f="fav" aria-pressed="false">Favoritas</button><button type="button" data-f="you" aria-pressed="false">Tuyas</button><button type="button" data-f="agent" aria-pressed="false">De agentes</button><button type="button" data-f="video" aria-pressed="false">Videos</button><button type="button" data-f="up" aria-pressed="false">Subidas</button></div>
          <span class="sp"></span>
          <label class="st-qwrap">${svg('search')}<input type="search" class="st-q" placeholder="Buscar…" aria-label="Buscar en la galería"></label>
          <button type="button" class="st-upbtn" title="Sube tus fotos o videos (producto, logo, personaje) para usarlos de referencia o animarlos">${svg('up')}<span>Subir</span></button>
          <button type="button" class="st-selbtn" aria-pressed="false" title="Elegir varias para descargarlas juntas, marcarlas o borrarlas">${svg('grid')}<span>Seleccionar</span></button>
        </div>
        <div class="st-selbar" hidden><b class="st-seln"></b><button type="button" data-b="all">Todas las visibles</button><button type="button" data-b="fav">${svg('star')} Favoritas</button><button type="button" data-b="zip">${svg('down')} Descargar ZIP</button><button type="button" data-b="del">${svg('trash')} Papelera</button><span class="sp"></span><button type="button" data-b="none">Listo</button></div>
        <div class="st-picking" hidden></div>
        <div class="st-count" aria-live="polite"></div>
        <div class="st-grid"></div>
      </section>
    </div>
    <div class="st-light" hidden role="dialog" aria-modal="true" aria-label="Vista ampliada"></div>
    <div class="st-toast" hidden role="status"><span></span><button type="button">DESHACER</button></div>
    <input type="file" class="st-file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" multiple hidden>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  let items = [], models = [], engines = [], budget = null, jobs = [], def = {}, loadErr = '', catalogSig = '';
  let kind = store.get('kind', 'image'), mode = 'one', filter = 'all', q = '', sel = new Set(), selecting = false, lastPick = -1, picking = null, uploadRole = null, busy = false, opener = null, lightIdx = -1, lightFrom = null, prevPrompt = null, qty = 1;
  const modelOf = { image: store.get('model.image', ''), video: store.get('model.video', '') };
  $('.st-lang').value = store.get('lang', 'en') === 'es' ? 'es' : 'en';
  const setsOf = store.get('sets', {}); // model id → its settings
  let media = { start: [], end: [], reference: [], video: [] };

  const cur = () => models.find(m => m.id === modelOf[kind]) || null;
  const roleName = (r, m = cur()) => (m && m.kind === 'image' && ROLE_IMG[r]) || ROLE[r];
  const roleHelp = (r, m = cur()) => (m && m.kind === 'image' && ROLE_IMG_HELP[r]) || ROLE_HELP[r];
  const itemOf = f => items.find(x => x.file === f);
  const src = it => '/media/' + String(it.file || it).split('/').map(encodeURIComponent).join('/');
  const isVid = f => /\.(mp4|webm)$/i.test(f);
  const ar = r => (r && /^\d+:\d+$/.test(r) ? r.replace(':', ' / ') : '');
  const ratioOf = it => (it.w && it.h ? `${it.w} / ${it.h}` : ar(it.ratio) || '');
  function fieldErr(where, text) { // V4.2 (audit A4): the field that is missing lights up and says so, in view — not a red line at the foot
    const step = where === 'slot' ? $('.st-matstep') : $('.st-prompt').closest('.st-step');
    step.classList.add('st-need'); step.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (where === 'slot') { const sl = el.querySelector('.st-slot.need') || el.querySelector('.st-slot'); if (sl) sl.querySelector('button')?.focus({ preventScroll: true }); say(text, true); }
    else { const fe = $('.st-ferr'); fe.textContent = text; fe.hidden = false; $('.st-prompt').focus({ preventScroll: true }); say(''); }
    showPane('gen');
  }
  function clearFieldErr() { el.querySelectorAll('.st-need').forEach(n => n.classList.remove('st-need')); $('.st-ferr').hidden = true; }
  const say = (t, bad) => { $('.st-msg').textContent = t; $('.st-msg').className = 'st-msg' + (bad ? ' bad' : ''); };
  const fmtDur = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const api = async (method, url, body) => { const r = await fetch(url, body === undefined ? { method } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
  const price = m => !m.cost ? 'gratis' : m.per === 's' ? `~US$${m.cost.toFixed(2)}/s` : `~US$${m.cost < 0.01 ? m.cost.toFixed(3) : m.cost.toFixed(2)}/imagen`;
  const tags = m => [m.roles.reference && 'Referencias', m.roles.start && (m.kind === 'video' ? 'Anima una imagen' : 'Edita una imagen'), m.roles.end && 'Fotograma final', m.roles.video && 'Parte de un video',
    (m.settings.sound || m.settings.generateAudio) && 'Sonido', /texto/i.test(m.note) && 'Texto legible', m.cost && m.cost < 0.012 && m.per !== 's' && 'Muy barato'].filter(Boolean);

  /* ---------- the composer ---------- */
  function pickModel(k = kind) { // the remembered one if it is on, else the office's default, else the first that is on
    const on = models.filter(m => m.kind === k && m.on);
    if (!on.some(m => m.id === modelOf[k])) modelOf[k] = (on.find(m => m.id === def[k]) || on.find(m => m.engine !== 'prueba') || on[0] || {}).id || '';
  }
  function settingsOf(m) {
    const s = { ...(setsOf[m.id] || {}) };
    for (const [k, f] of Object.entries(m.settings)) if (s[k] === undefined || (f.type === 'enum' && !f.values.includes(String(s[k])))) s[k] = f.default;
    return s;
  }
  function setSetting(k, v) { const m = cur(); if (!m) return; const s = settingsOf(m); s[k] = v; setsOf[m.id] = s; store.set('sets', setsOf); }
  function renderModels() {
    pickModel();
    el.querySelectorAll('[data-kind]').forEach(b => { const on = b.dataset.kind === kind; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    renderPick(); renderModel();
  }
  function renderPick() {
    const m = cur(), b = $('.st-mpick');
    b.innerHTML = m ? `<span class="st-mp-top"><span class="st-mp-name">${esc(m.name)}</span>${m.engineName && m.engineName.toLowerCase() !== m.name.toLowerCase() ? `<span class="st-mp-eng">${esc(m.engineName)}</span>` : ''}<span class="sp"></span><span class="st-mp-cost">${price(m)}</span><span class="st-mp-caret" aria-hidden="true">▾</span></span>${m.note ? `<span class="st-mp-note">${esc(m.note)}</span>` : ''}${tags(m).length ? `<span class="st-tags">${tags(m).map(t => `<i>${t}</i>`).join('')}</span>` : ''}`
      : `<span class="st-mp-top"><span class="st-mp-name">Ningún modelo de ${kind === 'video' ? 'video' : 'imagen'} encendido</span><span class="sp"></span><span class="st-mp-caret">▾</span></span><span class="st-mp-note">Abre «Motores y cómo activarlos» abajo.</span>`;
  }
  function renderList(qs = '') {
    const L = $('.st-mlist'), w = qs.toLowerCase();
    const mine = models.filter(x => x.kind === kind && (!w || `${x.name} ${x.engineName} ${x.note}`.toLowerCase().includes(w)));
    const engs = engines.filter(e => mine.some(x => x.engine === e.id)).sort((a, b) => (b.on - a.on) || (a.id === 'prueba') - (b.id === 'prueba'));
    const row = x => `<button type="button" role="option" class="st-mo${x.id === modelOf[kind] ? ' on' : ''}" data-id="${x.id}" aria-selected="${x.id === modelOf[kind]}"${x.on ? '' : ' disabled'}><span class="st-mo-top"><b>${esc(x.name)}</b><span class="sp"></span><span class="st-mp-cost">${price(x)}</span></span>${x.note ? `<span class="st-mo-note">${esc(x.note)}</span>` : ''}${tags(x).length ? `<span class="st-tags">${tags(x).map(t => `<i>${t}</i>`).join('')}</span>` : ''}</button>`;
    L.innerHTML = `<label class="st-mq">${svg('search')}<input type="search" placeholder="Buscar modelo…" aria-label="Buscar modelo" value="${esc(qs)}"></label>` +
      engs.filter(e => e.on).map(e => `<div class="st-mg"><div class="st-mg-h">${esc(e.name)} <span class="ok">● listo</span></div>${mine.filter(x => x.engine === e.id).map(row).join('')}</div>`).join('') +
      (engs.some(e => !e.on) ? `<details class="st-mg off"><summary>Sin activar: ${engs.filter(e => !e.on).map(e => esc(e.name)).join(', ')}</summary>${engs.filter(e => !e.on).map(e => `<div class="st-mg-h">${esc(e.name)} <code>${esc(e.how || '')}</code></div>${mine.filter(x => x.engine === e.id).map(row).join('')}`).join('')}</details>` : '') +
      (mine.length ? '' : '<div class="st-empty-s">Ningún modelo con eso.</div>');
  }
  function openList(on) {
    const L = $('.st-mlist'), b = $('.st-mpick');
    if (on === undefined) on = L.hidden;
    L.hidden = !on; b.setAttribute('aria-expanded', on);
    if (on) { renderList(); setTimeout(() => L.querySelector('input').focus(), 20); }
  }
  function renderModel() {
    const m = cur();
    $('.st-prompt').placeholder = mode === 'batch' ? 'Una idea por línea — cada línea genera «Cantidad» archivos. Ej.: los 12 fondos del mes de Instagram.' : kind === 'video' ? (media.start.length ? 'Describe el movimiento: la cámara se acerca despacio, el vapor sube, luz de tarde…' : 'Qué pasa en el video: sujeto, acción, cámara, luz, estilo. Para animar una imagen, pulsa Animar sobre ella en la galería.') : 'Ej.: fondo oscuro de roca volcánica con brillo naranja #FF5100, espacio limpio abajo para el texto';
    if (!m) { $('.st-slots').innerHTML = ''; $('.st-matstep').hidden = true; $('.st-ratios').innerHTML = ''; $('.st-sets').innerHTML = ''; $('.st-sets2').innerHTML = ''; $('.st-more').hidden = true; estimate(); return; }
    for (const r of Object.keys(media)) media[r] = media[r].slice(0, m.roles[r] || 0); // what no longer fits this model is dropped
    const roles = Object.entries(m.roles).filter(([r, n]) => n > 0 && ROLE[r]);
    $('.st-matstep').hidden = !roles.length; $('.st-n5').textContent = roles.length ? '5' : '4'; // the steps count on without a gap
    $('.st-matstep .st-hn').textContent = (m.needs || []).length ? 'obligatorio' : 'opcional';
    $('.st-slots').innerHTML = roles.map(([r, n]) => `<div class="st-slot${(m.needs || []).includes(r) && !media[r].length ? ' need' : ''}" data-role="${r}">
        <div class="st-slot-h"><b>${roleName(r, m)}</b> <span>${roleHelp(r, m)}${n > 1 ? ` · ${media[r].length} de ${n}` : ''}</span></div>
        <div class="st-chips">${media[r].map(f => `<span class="st-chip" data-f="${esc(f)}">${isVid(f) ? `<video src="${src(f)}" muted preload="metadata"></video>` : `<img src="${src(f)}" alt="">`}<button type="button" data-unslot="${esc(f)}" aria-label="Quitar">${svg('x')}</button></span>`).join('')}
          ${media[r].length < n ? `<button type="button" class="st-add" data-slot="${r}">${svg('up')}<span>Subir</span></button><button type="button" class="st-add" data-gpick="${r}">${svg('grid')}<span>De la galería</span></button>` : ''}</div></div>`).join('');
    const s = settingsOf(m), ent = Object.entries(m.settings);
    const ratio = m.settings.aspectRatio;
    $('.st-ratios').innerHTML = ratio ? `<div class="st-lab">Formato</div><div class="st-ars" role="group" aria-label="Formato">${ratio.values.map(v => { const [w, h] = v === 'auto' ? [1, 1] : v.split(':').map(Number); const k = Math.min(26 / Math.max(w, h), 26); return `<button type="button" class="st-ar${String(s.aspectRatio) === v ? ' on' : ''}" data-ar="${esc(v)}" aria-pressed="${String(s.aspectRatio) === v}" title="${esc(RATIO_USE[v] || v)}"><i style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px"></i><b>${esc(v === 'auto' ? 'Auto' : v)}</b><small>${esc(RATIO_USE[v] || '')}</small></button>`; }).join('')}</div>` : '';
    const ctl = ([k, f]) => {
      if (f.type === 'enum') return `<label class="st-lab">${LBL[k] || k}<select data-set="${k}">${f.values.map(v => `<option value="${esc(v)}"${String(s[k]) === v ? ' selected' : ''}>${esc(VAL[v] || v)}</option>`).join('')}</select></label>`;
      if (f.type === 'range') return `<label class="st-lab st-range">${LBL[k] || k} <output>${s[k]}</output><input type="range" data-set="${k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${s[k]}"></label>`;
      return `<label class="st-tog"><input type="checkbox" data-set="${k}"${s[k] ? ' checked' : ''}><span>${LBL[k] || k}</span></label>`;
    };
    const main = ent.filter(([k]) => k === 'duration' || k === 'resolution'), rest = ent.filter(([k]) => k !== 'aspectRatio' && k !== 'duration' && k !== 'resolution');
    $('.st-sets').innerHTML = main.map(ctl).join('');
    $('.st-sets2').innerHTML = rest.map(ctl).join('');
    $('.st-more').hidden = !rest.length;
    $('.st-more summary').textContent = `Más ajustes · ${rest.map(([k]) => (LBL[k] || k).toLowerCase()).slice(0, 3).join(', ')}${rest.length > 3 ? '…' : ''}`;
    qty = Math.min(qty, kind === 'video' ? 4 : (budget && budget.maxPerRequest) || 8);
    estimate();
  }
  const lines = () => $('.st-prompt').value.split('\n').map(x => x.trim()).filter(Boolean);
  function estimate() {
    $('.st-n').textContent = qty;
    const m = cur(); const n = (mode === 'batch' ? Math.max(1, lines().length) : 1) * qty;
    if (!m) { $('.st-est').textContent = ''; return 0; }
    const s = settingsOf(m), per = Number(s.batchSize) || 1, secs = m.seconds || Number(s.duration) || 5;
    const cost = (m.per === 's' ? m.cost * secs : m.cost) * n * per, total = n * per;
    $('.st-est').textContent = `${total} ${kind === 'video' ? (total === 1 ? 'video' : 'videos') : total === 1 ? 'imagen' : 'imágenes'}${m.per === 's' ? ` de ${secs} s` : ''} · ${cost ? 'aprox. US$' + cost.toFixed(2) : 'gratis'}${budget ? ` · te quedan ${budget.left} hoy` : ''}`;
    const sum = [s.aspectRatio && s.aspectRatio !== 'auto' ? `${s.aspectRatio}${RATIO_USE[s.aspectRatio] ? ' ' + RATIO_USE[s.aspectRatio] : ''}` : s.aspectRatio ? 'formato auto' : '', m.settings.duration ? `${secs} s` : '', s.resolution ? String(s.resolution) : ''].filter(Boolean);
    $('.st-sum').innerHTML = sum.length ? `${sum.map(esc).join(' · ')} <u>cambiar</u>` : ''; $('.st-sum').hidden = !sum.length;
    $('.st-go').textContent = kind === 'video' ? (total > 1 ? `GENERAR ${total} VIDEOS` : 'GENERAR VIDEO') : total > 1 ? `GENERAR ${total} IMÁGENES` : 'GENERAR IMAGEN';
    $('.st-plen').textContent = $('.st-prompt').value.length > 3000 ? `${$('.st-prompt').value.length}/4000` : '';
    return cost;
  }
  function renderHead() {
    $('.st-budget').innerHTML = budget ? `<span class="st-bm" title="El tope diario de la oficina (office.config.json → media.dailyLimit); un video cuenta como 5"><i style="width:${Math.min(100, Math.round((budget.limit - budget.left) / Math.max(1, budget.limit) * 100))}%"></i></span><span>Hoy ${budget.limit - budget.left} de ${budget.limit}${budget.reserved ? ` · ${budget.reserved} en curso` : ''} · US$${(budget.cost || 0).toFixed(2)}</span>` : '';
    $('.st-engs').innerHTML = engines.map(e => `<div class="st-eng${e.on ? ' on' : ''}"><b>${e.on ? '●' : '○'} ${esc(e.name)}</b> <span>${e.on ? `listo · ${e.models} modelos` : e.id === 'prueba' ? 'siempre listo' : `${e.models} modelos · <code>${esc(e.how || '')}</code>${e.site ? ` · ${esc(e.site)}` : ''}`}</span></div>`).join('');
  }

  /* ---------- the gallery ---------- */
  function shown() {
    const w = q.toLowerCase();
    return items.filter(it => (filter === 'all' || (filter === 'fav' && it.fav) || (filter === 'agent' && it.by === 'agent') || (filter === 'you' && it.by !== 'agent' && !it.upload) || (filter === 'video' && (it.kind === 'video' || it.wanted === 'video')) || (filter === 'up' && it.upload))
      && (!w || `${it.prompt} ${it.modelName || it.model || ''} ${it.file} ${it.by === 'agent' ? agentName(it.agent) || '' : ''} ${it.task && ctx.taskTitle ? ctx.taskTitle(it.task) : ''}`.toLowerCase().includes(w)));
  }
  const tileJobs = () => jobs.filter(j => j.state === 'queued' || j.state === 'running' || (j.state === 'failed' && Date.now() - (j.doneAt || j.at) < 3 * 864e5));
  // V4.2 (audit A39): how long this model usually takes — the median of its last finished jobs, else a sensible guess
  function typical(j) {
    const same = jobs.filter(x => x.model === j.model && x.state === 'done' && x.startedAt && x.doneAt).slice(0, 10).map(x => x.doneAt - x.startedAt).sort((a, b) => a - b);
    return same.length >= 2 ? same[Math.floor(same.length / 2)] : j.engine === 'prueba' ? 5000 : j.kind === 'video' ? 180000 : 25000;
  }
  const approx = ms => ms < 60000 ? `~${Math.max(5, Math.round(ms / 5000) * 5)} s` : `~${Math.round(ms / 60000)} min`;
  const askCancel = new Set(); // V4.2 (audit A40): a job already sent to a paid engine asks once, in the tile, before it is cancelled
  function jobTile(j) {
    const live = j.state !== 'failed', t = Date.now() - (j.startedAt || j.at);
    const typ = typical(j), pct = j.state === 'running' ? Math.min(95, Math.round(t / typ * 100)) : 0, slow = j.state === 'running' && t > typ * 1.6;
    const paid = j.state === 'running' && j.engine !== 'prueba';
    return `<figure class="st-card st-job ${j.state}" data-job="${j.id}">
      <div class="st-jbody" style="aspect-ratio:${ar(j.s && j.s.aspectRatio) || '1 / 1'}">
        ${live ? `<div class="st-spin" aria-hidden="true"></div><b>${j.state === 'queued' ? 'En cola' : j.kind === 'video' ? 'Generando video' : 'Generando'}${j.n > 1 ? ` · ${j.items.length} de ${j.n}` : ''}</b><span class="st-jt">${esc(j.note || '')}${j.note ? ' · ' : ''}${fmtDur(t)} · ${slow ? 'tarda más de lo normal' : `suele tardar ${approx(typ)}`}</span>${j.state === 'running' ? `<span class="st-jbar" aria-hidden="true"><i style="width:${pct}%"></i></span>` : ''}` : `<b>No se pudo</b><span class="st-jerr">${esc(j.error || '')}</span>`}
        <p>${esc(j.prompt)}</p><span class="st-meta">${esc(j.modelName)}${j.by === 'agent' ? ' · ' + esc(agentName(j.agent) || 'agente') : ''}</span>
      </div>
      <div class="st-jacts">${live ? (askCancel.has(j.id) ? `<span class="st-jq">Ya se envió a ${esc(j.engineName || 'el motor')}: puede cobrarse igual.</span><button type="button" data-j="cancel-yes" class="warn">Cancelar igual</button><button type="button" data-j="cancel-no">Seguir</button>`
        : `<button type="button" data-j="cancel" title="${j.state === 'queued' ? 'Aún no empezó: no se cobra' : paid ? 'Ya se envió al motor: puede cobrarse igual' : 'Gratis: no se cobra'}">Cancelar</button>`) : `<button type="button" data-j="retry" class="pri">Reintentar</button><button type="button" data-j="forget">Quitar</button>`}</div></figure>`;
  }
  function card(it) {
    const vid = it.kind === 'video', on = sel.has(it.file), label = String(it.prompt).slice(0, 70);
    // V4.2 (audit A20 · A21): one action in words (Animar an image, Repetir a video), the star, and «⋯» for the rest — the
    // six unlabelled icons are gone, the bin is last in the menu and apart. On a touch screen only «⋯» shows (st-mi-t: the
    // star and the main action repeat in the menu there), so the picture is not covered.
    const primary = !vid ? ['anim', 'Animar', 'Convertirla en video', 'vid'] : !it.upload ? ['again', 'Repetir', 'Otra vez, con el mismo prompt y ajustes', 'again'] : null;
    const menu = [
      ['fav', it.fav ? 'Quitar de favoritas' : 'Favorita', 'star', 'st-mi-t', it.fav ? 'fill' : ''],
      ...(primary ? [[primary[0], primary[1], primary[3], 'st-mi-t']] : []),
      ...(vid ? [] : [['vary', 'Variar: otra versión parecida', 'spark'], ['ref', 'Usar de referencia', 'plus']]),
      ...(!it.upload && !vid ? [['again', 'Repetir con el mismo prompt', 'again']] : []),
      ['dl'], '-', ['del', 'Mover a la papelera', 'trash', 'warn']];
    return `<figure class="st-card${on ? ' sel' : ''}" data-f="${esc(it.file)}">
      <label class="st-ck" title="Seleccionar (Mayús para un rango)"><input type="checkbox"${on ? ' checked' : ''} aria-label="Seleccionar: ${esc(label)}"></label>
      <button type="button" class="st-thumb" style="${ratioOf(it) ? `aspect-ratio:${ratioOf(it)}` : ''}" aria-label="Ver en grande: ${esc(label)}">${vid ? `<video src="${src(it)}" preload="metadata" muted loop playsinline></video><span class="st-play" aria-hidden="true">▶</span>` : `<img src="${src(it)}" alt="" loading="lazy" decoding="async">`}
        ${it.upload ? '<span class="st-badge">SUBIDA</span>' : it.provider === 'prueba' ? `<span class="st-badge">PRUEBA${it.wanted === 'video' ? ' · VIDEO' : ''}</span>` : ''}${it.fav ? `<span class="st-favb" aria-label="Favorita">${svg('star', 'fill')}</span>` : ''}</button>
      <div class="st-ov" role="group" aria-label="Acciones">
        <button type="button" data-a="fav" class="st-oi${it.fav ? ' on' : ''}" aria-label="${it.fav ? 'Quitar de favoritas' : 'Marcar favorita'}" title="${it.fav ? 'Quitar de favoritas' : 'Favorita'}">${svg('star', it.fav ? 'fill' : '')}</button>
        ${primary ? `<button type="button" data-a="${primary[0]}" class="st-op" title="${primary[2]}">${svg(primary[3])}<span>${primary[1]}</span></button>` : ''}
        <button type="button" data-a="menu" class="st-oi st-more" aria-haspopup="menu" aria-expanded="false" aria-label="Más acciones: ${esc(label)}" title="Más acciones">${svg('dots')}</button>
      </div>
      <div class="st-menu" role="menu" hidden>
        ${menu.map(m => m === '-' ? '<div class="st-msep" role="separator"></div>' : m[0] === 'dl' ? `<a role="menuitem" href="${src(it)}" download tabindex="-1">${svg('down')}<span>Descargar</span></a>` : `<button type="button" role="menuitem" tabindex="-1" data-a="${m[0]}" class="${m[3] || ''}">${svg(m[2], m[4] || '')}<span>${m[1]}</span></button>`).join('')}
      </div>
      <figcaption><span class="st-p">${esc(it.prompt)}</span>${it.task && it.by === 'agent' ? `<button type="button" class="st-tchip" data-a="task" title="Abrir la tarea">para: ${esc((ctx.taskTitle && ctx.taskTitle(it.task)) || 'su tarea')}</button>` : ''}<span class="st-meta">${it.upload ? 'subida por ti' : esc(it.by === 'agent' ? (agentName(it.agent) || 'agente') : 'tú')}${it.modelName || (it.model && !it.upload) ? ' · ' + esc(it.modelName || it.model) : ''} · ${esc(when(it.at))}</span></figcaption>
    </figure>`;
  }
  // V4.2 (audit A17 · A18): the gallery is updated in place. A card whose content did not change keeps its node — a playing
  // preview, the keyboard focus and the scroll survive the 20-second refresh and the 2.5-second job ticks. The cards go into
  // columns in order, each to the shortest column, so the newest read left to right (CSS columns filled top to bottom).
  const nodes = new Map(); let layoutSig = '', lastWant = [];
  const expanded = new Set(); // jobs the owner split into single cards
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  function dayName(ts) { const d = new Date(ts), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1); if (d.toDateString() === n.toDateString()) return 'Hoy'; if (d.toDateString() === y.toDateString()) return 'Ayer'; const s = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) }); return s.charAt(0).toUpperCase() + s.slice(1); }
  function groupCard(its) { // V4.2 (audit A19): «(1/2)» and «(2/2)» of one request, one card: the prompt once, the pictures side by side
    const f = its[0], n = its.length, vid = f.kind === 'video';
    const thumbs = its.slice(0, 4).map((it, i) => `<button type="button" class="st-gt" data-gf="${esc(it.file)}" aria-label="Ver ${i + 1} de ${n} en grande"${ratioOf(it) ? ` style="aspect-ratio:${ratioOf(it)}"` : ''}>${isVid(it.file) ? `<video src="${src(it)}" muted preload="metadata" playsinline></video>` : `<img src="${src(it)}" alt="" loading="lazy" decoding="async">`}${it.fav ? `<span class="st-favb">${svg('star', 'fill')}</span>` : ''}${i === 3 && n > 4 ? `<span class="st-gmore">+${n - 4}</span>` : ''}</button>`).join('');
    return `<figure class="st-card st-group" data-g="${esc(f.job)}"><div class="st-gthumbs n${Math.min(n, 4)}">${thumbs}</div>
      <figcaption><span class="st-p">${esc(f.prompt)}</span>${f.task && f.by === 'agent' ? `<span class="st-tchip st-tchip-s">para: ${esc((ctx.taskTitle && ctx.taskTitle(f.task)) || 'su tarea')}</span>` : ''}<span class="st-meta"><b>${n} ${vid ? 'videos' : 'imágenes'} de un pedido</b> · ${esc(f.by === 'agent' ? (agentName(f.agent) || 'agente') : 'tú')}${f.modelName ? ' · ' + esc(f.modelName) : ''} · ${esc(when(f.at))}</span>
      <span class="st-gacts"><button type="button" data-ga="split">Ver por separado</button><button type="button" data-ga="zip">${svg('down')} Descargar las ${n}</button></span></figcaption></figure>`;
  }
  const aspect = it => { if (it.w && it.h) return it.h / it.w; const r = String(it.ratio || (it.s && it.s.aspectRatio) || '').split(':').map(Number); return r.length === 2 && r[0] && r[1] ? r[1] / r[0] : 1; };
  const colCount = () => { const w = $('.st-grid').clientWidth - 36; return w > 0 ? Math.max(1, Math.floor((w + 14) / (230 + 14))) : 0; };
  function when(ts) { const d = new Date(ts), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1); const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; return d.toDateString() === n.toDateString() ? `hoy ${t}` : d.toDateString() === y.toDateString() ? `ayer ${t}` : d.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) }); }
  function renderGrid() {
    const list = shown(), tj = tileJobs().filter(j => filter === 'all' || (filter === 'you' && j.by !== 'agent') || (filter === 'agent' && j.by === 'agent') || (filter === 'video' && j.kind === 'video'));
    const active = tileJobs().filter(j => j.state !== 'failed').length;
    $('.st-count').textContent = `${list.length} ${list.length === 1 ? 'archivo' : 'archivos'}${list.length !== items.length ? ` de ${items.length}` : ''}${active ? ` · ${active} generándose` : ''}`;
    $('.st-ptn').textContent = active ? `· ${active} en curso` : items.length ? String(items.length) : '';
    renderSel();
    const G = $('.st-grid');
    const empty = loadErr && !items.length ? `<div class="st-empty">No pude cargar la galería (${esc(loadErr)}). <button type="button" class="st-retry">Reintentar</button></div>`
      : !tj.length && !list.length ? `<div class="st-empty">${items.length ? `Nada con este filtro. <button type="button" class="st-all">Ver todo</button>` : 'Aún no hay nada. Genera tu primera imagen con el compositor, sube una foto tuya (Subir), o pídesela a un agente de Marketing.'}</div>` : '';
    if (empty) { if (G.innerHTML !== empty) G.innerHTML = empty; nodes.clear(); layoutSig = ''; lastWant = []; return; }
    let root = G.querySelector(':scope > .st-days'); if (!root) { G.innerHTML = '<div class="st-days"></div>'; root = G.firstElementChild; nodes.clear(); layoutSig = ''; }
    const flat = selecting || sel.size || picking, byJob = new Map();
    if (!flat) for (const it of list) if (it.job && !expanded.has(it.job)) byJob.set(it.job, [...(byJob.get(it.job) || []), it]);
    const want = tj.map(j => ['j:' + j.id, jobTile(j), aspect(j), dayKey(Date.now()), 1, Date.now()]), placed = new Set();
    for (const it of list) {
      const g = !flat && it.job && byJob.get(it.job);
      if (g && g.length > 1) { if (placed.has(it.job)) continue; placed.add(it.job); const a = aspect(g[0]); want.push(['g:' + it.job, groupCard(g), (g.length === 2 ? a / 2 : a) + 0.15, dayKey(it.at), g.length, it.at]); continue; }
      want.push(['f:' + it.file, card(it), aspect(it), dayKey(it.at), 1, it.at]);
    }
    const keep = new Set(), active_ = document.activeElement;
    for (const [k, html] of want) {
      keep.add(k); const n = nodes.get(k); if (n && n.html === html) continue;
      const t = document.createElement('template'); t.innerHTML = html.trim(); const fresh = t.content.firstElementChild;
      const hadFocus = n && n.el.contains(active_), fsel = hadFocus && active_.dataset && (active_.dataset.a || active_.dataset.j) ? `[data-${active_.dataset.a ? 'a' : 'j'}="${active_.dataset.a || active_.dataset.j}"]` : hadFocus && active_.classList.contains('st-thumb') ? '.st-thumb' : null;
      if (n) n.el.replaceWith(fresh); nodes.set(k, { html, el: fresh });
      if (hadFocus) (fsel && fresh.querySelector(fsel) || fresh.querySelector('button'))?.focus({ preventScroll: true }); // a changed card (a star, a tick) keeps the keyboard where it was
    }
    for (const [k, n] of nodes) if (!keep.has(k)) { n.el.remove(); nodes.delete(k); }
    lastWant = want; layout(root);
  }
  function layout(root, force) {
    const n = colCount(); if (!n) return; // hidden (a phone on the Crear tab): laid out when it shows
    const sig = n + '|' + lastWant.map(w => w[3] + ':' + w[0]).join(',');
    if (!force && sig === layoutSig) return; layoutSig = sig;
    const days = []; for (const w of lastWant) { let d = days.find(x => x.k === w[3]); if (!d) days.push(d = { k: w[3], at: w[5], n: 0, list: [] }); d.list.push(w); d.n += w[4]; }
    const out = [];
    for (const d of days) { // V4.2 (audit A23): a heading per day, the day's cards in their own columns
      const hd = document.createElement('h3'); hd.className = 'st-day'; hd.innerHTML = `${esc(dayName(d.at))} <span>${d.n}</span>`;
      const cols = [...Array(n)].map(() => { const c = document.createElement('div'); c.className = 'st-col'; return c; }), h = new Array(n).fill(0);
      for (const [k, , a] of d.list) { const j = h.indexOf(Math.min(...h)); cols[j].appendChild(nodes.get(k).el); h[j] += a + 0.3; } // 0.3: the caption under each picture
      const box = document.createElement('div'); box.className = 'st-cols'; box.replaceChildren(...cols); out.push(hd, box);
    }
    root.replaceChildren(...out);
  }
  function relayout() { const root = $('.st-grid > .st-days'); if (root) layout(root); }
  if (window.ResizeObserver) new ResizeObserver(() => { if (!el.hidden) relayout(); }).observe($('.st-grid'));
  function renderSel() {
    $('.st-selbar').hidden = !(selecting || sel.size); $('.st-seln').textContent = sel.size ? `${sel.size} ${sel.size === 1 ? 'seleccionada' : 'seleccionadas'}` : 'Toca las que quieras';
    el.classList.toggle('st-selecting', selecting || sel.size > 0);
    $('.st-selbtn').setAttribute('aria-pressed', selecting || sel.size > 0); $('.st-selbtn').classList.toggle('on', selecting || sel.size > 0);
    el.querySelectorAll('.st-selbar [data-b="fav"], .st-selbar [data-b="zip"], .st-selbar [data-b="del"]').forEach(b => { b.disabled = !sel.size; });
    $('.st-picking').hidden = !picking;
    if (picking) $('.st-picking').innerHTML = `Elige ${picking === 'video' ? 'un video' : 'una imagen'} para «${roleName(picking)}»: haz clic en ella. <button type="button" data-b="unpick">Cancelar</button>`;
    el.classList.toggle('st-pickmode', !!picking);
  }
  let loading = null;
  async function load({ full = true } = {}) { // full: the catalog too (the 20-second refresh only touches the gallery, so an open menu stays open)
    if (loading) return loading;
    loading = (async () => {
      try { if (!location.protocol.startsWith('http')) throw new Error('el Estudio trabaja con la oficina real: ábrela con el iniciador (.bat)'); // the demo file has no server to ask (it logged a fetch error)
        const j = await api('GET', '/api/media'); items = j.items || []; budget = j.budget || null; jobs = j.jobs || []; loadErr = '';
        const sig = JSON.stringify((j.models || []).map(m => m.id + (m.on ? 1 : 0)));
        if (full || sig !== catalogSig) { models = j.models || []; engines = j.engines || []; def = j.default || {}; catalogSig = sig; full = true; }
      } catch (e) { loadErr = e.message; }
      for (const f of [...sel]) if (!itemOf(f)) sel.delete(f);
      renderHead(); if (full) renderModels(); renderGrid(); watch();
    })();
    try { await loading; } finally { loading = null; }
  }
  // while something generates, the tiles are refreshed every 2.5 s; when one finishes, the gallery reloads
  let jtimer = null;
  function watch() {
    const active = jobs.some(j => j.state === 'queued' || j.state === 'running');
    if (!active || el.hidden) { clearTimeout(jtimer); jtimer = null; return; }
    if (jtimer) return;
    jtimer = setTimeout(async () => {
      jtimer = null;
      try {
        const before = new Map(jobs.map(j => [j.id, j.state]));
        const r = await api('GET', '/api/media/jobs'); jobs = r.jobs; budget = r.budget;
        const finished = jobs.filter(j => (j.state === 'done' || j.state === 'failed') && (before.get(j.id) === 'running' || before.get(j.id) === 'queued'));
        if (finished.length) { await load({ full: false }); const ok = finished.filter(j => j.state === 'done'), bad = finished.filter(j => j.state === 'failed'); if (ok.length && !bad.length) say(`Listo: ${ok.reduce((s, j) => s + j.items.length, 0)} archivo(s) nuevos en la galería.`); if (bad.length) say(`${bad.length} no se pudo: ${bad[0].error}`, true); return; }
        renderHead(); renderGrid();
      } catch {}
      watch();
    }, 2500);
  }

  /* ---------- actions ---------- */
  async function generate(prompts) {
    const m = cur(); if (!m) return say('Elige un modelo.', true);
    if (busy) return; busy = true; $('.st-go').disabled = true;
    const settings = settingsOf(m), mediaNow = Object.fromEntries(Object.entries(media).filter(([, v]) => v.length));
    let ok = 0;
    for (const p of prompts) {
      try { const r = await api('POST', '/api/media/jobs', { prompt: p, n: qty, kind, model: m.id, settings, media: mediaNow, by: 'you' }); jobs.unshift(r.job); budget = r.budget; ok++; }
      catch (e) { if (/key/i.test(e.message)) { keyHelp(m, e.message); break; } say(`No se pudo${prompts.length > 1 ? ` (${ok + 1} de ${prompts.length})` : ''}: ${e.message}`, true); if (/tope/.test(e.message)) break; }
    }
    if (ok) { say(`${ok === 1 ? 'En marcha' : `${ok} trabajos en marcha`}: ${kind === 'video' ? 'un video tarda unos minutos; ' : ''}aparece en la galería al terminar. Puedes seguir.`); if (phone()) showPane('gal'); } // on a phone, the new tile is what to look at
    busy = false; $('.st-go').disabled = false;
    renderHead(); renderGrid(); watch();
  }
  function keyHelp(m, message) { // V4.2 (audit A38): what to do, step by step, and a way to keep going now
    const eng = engines.find(x => x.id === m.engine) || {}, K = $('.st-keyhelp');
    const test = models.find(x => x.kind === kind && x.engine === 'prueba' && x.on);
    K.innerHTML = `<b>${esc(m.name)} necesita su key de ${esc(eng.name || m.engineName || 'su servicio')}.</b>
      <ol><li>Crea la key en ${eng.site ? `<code>${esc(eng.site)}</code>` : 'la web del servicio'} y ponle un límite de gasto.</li>
      <li>Guárdala en Windows: abre una ventana de comandos y pega ${eng.how ? `<code>${esc(eng.how)}</code>` : 'el comando de «Motores y cómo activarlos»'}.</li>
      <li>Cierra la oficina y ábrela con el iniciador.</li></ol>
      <div class="st-kh-row">${test ? `<button type="button" data-kh="test" class="pri">Usar ${esc(test.name)} mientras tanto</button>` : ''}<button type="button" data-kh="engs">Ver los motores</button><button type="button" data-kh="x">Cerrar</button></div>`;
    K.hidden = false; K.dataset.test = test ? test.id : ''; say('');
    K.querySelector('button')?.focus({ preventScroll: true });
    if (!test && message) say(message, true);
  }
  function setKind(k) { if (k === kind) return; clearFieldErr(); $('.st-keyhelp').hidden = true; kind = k; store.set('kind', kind); openList(false); renderModels(); }
  function useModelFor(role, want) { // a model of `want` kind that takes `role`: the current one if it does, else the best that is on
    const c = models.find(m => m.id === modelOf[want]);
    if (c && c.on && c.roles[role]) return c;
    const pref = { image: ['nano-banana', 'nano-banana-fal', 'seedream-4', 'gpt-image-1', 'flux-kontext', 'flux-2'], video: ['kling-3-std', 'seedance-2-fast', 'kling-2.5-fal', 'seedance-1-fal', 'hailuo-02-fal', 'dop'] }[want];
    const on = models.filter(m => m.kind === want && m.on && m.roles[role]);
    return pref.map(id => on.find(m => m.id === id)).find(Boolean) || on.find(m => m.engine !== 'prueba') || on[0] || null;
  }
  function animate(it) {
    const m = useModelFor('start', 'video'); if (!m) return say('Ningún modelo de video encendido acepta una imagen inicial.', true);
    kind = 'video'; store.set('kind', kind); modelOf.video = m.id; store.set('model.video', m.id);
    media = { start: [it.file], end: [], reference: [], video: [] };
    renderModels(); showPane('gen'); $('.st-prompt').focus();
    say(m.engine === 'prueba' ? 'Animar: aún no tienes una key de video (Higgsfield o fal.ai); puedes probar el flujo gratis con «Prueba de video».' : `Animar con ${m.name}: describe el movimiento y pulsa GENERAR.`, m.engine === 'prueba');
  }
  function addMedia(role, f) {
    const m = cur(); if (!m || !m.roles[role]) return false;
    if (role === 'video' ? !isVid(f) : isVid(f)) { say(role === 'video' ? 'Ahí va un video.' : 'Ahí va una imagen, no un video.', true); return false; }
    if (m.engine !== 'prueba' && /\.svg$/i.test(f)) { say('Una tarjeta de prueba no sirve de referencia para un motor real: usa una imagen generada o subida.', true); return false; }
    if (media[role].includes(f)) return true;
    if (media[role].length >= m.roles[role]) { if (m.roles[role] === 1) media[role] = []; else { say(`${roleName(role)}: como mucho ${m.roles[role]}.`, true); return false; } }
    media[role].push(f); renderModel(); return true;
  }
  function useAsRef(it) {
    let m = cur();
    if (!m || !m.roles.reference) { m = useModelFor('reference', kind); if (!m && kind === 'video') { kind = 'image'; m = useModelFor('reference', 'image'); } if (!m) return say('Ningún modelo encendido acepta referencias.', true); modelOf[kind] = m.id; store.set('model.' + kind, m.id); renderModels(); }
    if (addMedia('reference', it.file)) say(`Referencia añadida a ${m.name}. Describe qué hacer con ella.`);
  }
  function vary(it) { // V4.2 (audit A35): another take close to this one — its prompt and model, the picture itself as the reference
    reuse(it, true);
    let m = cur();
    if (!m || !m.roles.reference) { m = useModelFor('reference', 'image'); if (!m) return say('Ningún modelo encendido acepta una imagen de referencia para variarla.', true); kind = 'image'; modelOf.image = m.id; store.set('model.image', m.id); renderModels(); }
    if (!addMedia('reference', it.file)) return;
    qty = 1; estimate();
    if (!isLive()) return say('Variar necesita la oficina real.', true);
    generate([it.prompt || 'una variación de esta imagen']).then(() => { if (!$('.st-msg').classList.contains('bad')) say(`Variando con ${m.name}: mismo prompt, esta imagen como referencia. Aparece en la galería al terminar.`); });
  }
  function reuse(it, quiet) {
    const k = it.kind === 'video' || it.wanted === 'video' ? 'video' : 'image';
    kind = k; store.set('kind', kind);
    const m = models.find(x => x.id === it.model && x.on); if (m) { modelOf[k] = m.id; if (it.settings) { setsOf[m.id] = { ...it.settings }; store.set('sets', setsOf); } }
    media = { start: [], end: [], reference: [], video: [], ...(it.media || {}) };
    for (const r of Object.keys(media)) media[r] = (media[r] || []).filter(f => itemOf(f));
    mode = 'one'; $('.st-mode').checked = false;
    $('.st-prompt').value = it.prompt; renderModels(); $('.st-prompt').focus();
    if (!quiet) say(m ? 'Mismo prompt, modelo y ajustes: cambia lo que quieras y pulsa GENERAR.' : 'Ese modelo no está encendido; elige otro.', !m);
  }
  let toastT = null;
  function toast(text, undo) {
    const T = $('.st-toast'); T.querySelector('span').textContent = text; T.hidden = false;
    T.querySelector('button').hidden = !undo; T.querySelector('button').onclick = async () => { T.hidden = true; await undo(); };
    clearTimeout(toastT); toastT = setTimeout(() => { T.hidden = true; }, 9000);
  }
  async function trashMany(files) {
    const undo = []; let failed = 0;
    for (const f of files) { try { const r = await api('DELETE', '/api/media/item/' + encodeURIComponent(f)); if (r.undo) undo.push(r.undo); } catch { failed++; } }
    items = items.filter(x => !undo.some(u => u.id === x.file)); for (const u of undo) sel.delete(u.id);
    for (const r of Object.keys(media)) media[r] = media[r].filter(f => !undo.some(u => u.id === f));
    renderGrid(); renderModel(); closeLight();
    if (!undo.length) return say(`No se pudo mover ${failed === 1 ? 'el archivo' : `ninguno de los ${failed}`} a la papelera.`, true);
    toast(`${undo.length} ${undo.length === 1 ? 'archivo movido' : 'archivos movidos'} a la papelera${failed ? ` · ${failed} no se pudo` : ''} (se vacía a los 30 días).`, async () => {
      let back = 0; for (const u of undo) { try { await api('POST', '/api/media/restore', u); back++; } catch {} }
      await load({ full: false }); say(back === undo.length ? 'Recuperado.' : `Recuperé ${back} de ${undo.length}.`, back !== undo.length);
    });
  }
  async function favMany(files) {
    const all = files.every(f => itemOf(f)?.fav);
    await Promise.all(files.map(async f => { const it = itemOf(f); if (!it) return; const was = it.fav; it.fav = !all; try { await api('PATCH', '/api/media/item/' + encodeURIComponent(f), { fav: it.fav }); } catch { it.fav = was; say('No se pudo guardar la favorita.', true); } }));
    renderGrid();
  }
  async function zip(files) {
    say(`Preparando ${files.length} archivo(s)…`);
    try {
      const r = await fetch('/api/media/zip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: files }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
      const url = URL.createObjectURL(await r.blob()), a = document.createElement('a');
      a.href = url; a.download = (r.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'estudio.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      say(`Descargado: ${files.length} archivo(s) en un ZIP.`);
    } catch (e) { say('No se pudo descargar: ' + e.message, true); }
  }
  async function uploadFiles(files, role) {
    let ok = 0;
    for (const file of files) {
      const vid = /^video\//.test(file.type);
      if (!/^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/.test(file.type)) { say(`«${file.name}»: solo PNG, JPG, WEBP, MP4 o WEBM.`, true); continue; }
      if (file.size > (vid ? 25 : 12) * 1024 * 1024) { say(`«${file.name}» pasa de ${vid ? 25 : 12} MB.`, true); continue; }
      say(`Subiendo «${file.name}»…`);
      try {
        const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('no pude leerlo')); fr.readAsDataURL(file); });
        const r = await api('POST', '/api/media/upload', { name: file.name, data });
        items.unshift(r.item); ok++;
        if (role) addMedia(role, r.item.file);
      } catch (e) { say(`«${file.name}»: ${e.message}`, true); }
    }
    if (ok) { say(`${ok === 1 ? 'Subida' : ok + ' subidas'}${role ? ` y puesta en «${roleName(role)}»` : ''}. Están en la pestaña Subidas.`); renderGrid(); }
  }

  /* ---------- the lightbox ---------- */
  function closeLight() { const L = $('.st-light'); if (L.hidden) return; L.hidden = true; L.innerHTML = ''; lightIdx = -1; modal.close(L); if (lightFrom && document.contains(lightFrom)) lightFrom.focus({ preventScroll: true }); }
  function light(i) {
    const list = shown(); const it = list[i]; if (!it) return; if (lightIdx < 0) lightFrom = document.activeElement; lightIdx = i;
    const L = $('.st-light'); L.hidden = false; modal.open(L);
    const setTxt = it.settings ? Object.entries(it.settings).map(([k, v]) => `${LBL[k] || k}: ${typeof v === 'boolean' ? (v ? 'sí' : 'no') : VAL[v] || v}`).join(' · ') : '';
    const used = it.media ? Object.entries(it.media).flatMap(([r, fs]) => fs.map(f => [r, f])) : [];
    L.innerHTML = `<div class="st-lbox"><button type="button" class="st-lx" aria-label="Cerrar" title="Cerrar (Esc)">${svg('x')}</button>
      <div class="st-lmedia">${it.kind === 'video' ? `<video src="${src(it)}" controls autoplay playsinline></video>` : `<img src="${src(it)}" alt="${esc(String(it.prompt).slice(0, 120))}">`}</div>
      <div class="st-linfo"><div class="st-lpos"><button type="button" class="st-lnav prev" aria-label="Anterior" title="Anterior (←)"${i > 0 ? '' : ' disabled'}>‹</button><span aria-live="polite">${i + 1} de ${list.length}</span><button type="button" class="st-lnav next" aria-label="Siguiente" title="Siguiente (→)"${i < list.length - 1 ? '' : ' disabled'}>›</button></div>
      <p class="st-lp">${esc(it.prompt)}</p>
      <p class="st-meta">${it.upload ? 'Subida por ti' : `${esc(it.modelName || it.model || it.provider)} · ${it.by === 'agent' ? esc(agentName(it.agent) || 'agente') : 'tú'}`} · ${esc(when(it.at))}${it.w ? ` · ${it.w}×${it.h}` : ''}${it.cost ? ` · ~US$${it.cost}` : ''}</p>
      ${setTxt ? `<p class="st-meta">${esc(setTxt)}</p>` : ''}
      ${used.length ? `<div class="st-lused">${used.map(([r, f]) => `<span title="${esc(ROLE[r] || r)}">${isVid(f) ? svg('vid') : `<img src="${src(f)}" alt="">`}<i>${esc(ROLE[r] || r)}</i></span>`).join('')}</div>` : ''}
      <div class="st-lacts">${it.kind === 'video' ? '' : `<button type="button" data-l="anim" class="pri">${svg('vid')} Animar</button><button type="button" data-l="vary" title="Otra versión parecida: mismo prompt, esta imagen como referencia">${svg('spark')} Variar</button><button type="button" data-l="ref">${svg('plus')} Usar de referencia</button>`}${it.upload ? '' : `<button type="button" data-l="again">${svg('again')} Repetir</button>`}
        <a href="${src(it)}" download>${svg('down')} Descargar</a><button type="button" data-l="copy">Copiar prompt</button><button type="button" data-l="fav">${svg('star', it.fav ? 'fill' : '')} ${it.fav ? 'Quitar de favoritas' : 'Favorita'}</button><button type="button" data-l="del">${svg('trash')} Papelera</button>${it.task && ctx.openTask ? '<button type="button" data-l="task">Ver la tarea</button>' : ''}</div></div></div>`;
    L.querySelector('.st-lx').focus();
    L.onclick = e => {
      if (e.target === L || e.target.closest('.st-lx')) return closeLight();
      if (e.target.closest('.st-lnav.prev') && i > 0) { light(i - 1); L.querySelector('.st-lnav.prev')?.focus(); return; }
      if (e.target.closest('.st-lnav.next') && i < list.length - 1) { light(i + 1); L.querySelector('.st-lnav.next')?.focus(); return; }
      const a = e.target.closest('[data-l]')?.dataset.l; if (!a) return;
      if (a === 'copy') { const btn = e.target.closest('button'); (navigator.clipboard ? navigator.clipboard.writeText(it.prompt) : Promise.reject()).then(() => { btn.textContent = 'Copiado ✓'; }, () => { btn.textContent = 'No se pudo copiar'; }).finally(() => setTimeout(() => { if (document.contains(btn)) btn.textContent = 'Copiar prompt'; }, 1600)); }
      if (a === 'vary') { closeLight(); vary(it); }
      if (a === 'again') { closeLight(); reuse(it); }
      if (a === 'anim') { closeLight(); animate(it); }
      if (a === 'ref') { closeLight(); useAsRef(it); }
      if (a === 'fav') favMany([it.file]).then(() => light(i));
      if (a === 'del') trashMany([it.file]);
      if (a === 'task') { closeLight(); close(); ctx.openTask(it.task); }
    };
  }

  /* ---------- events ---------- */
  function closeMenus(except) { el.querySelectorAll('.st-menu:not([hidden])').forEach(m => { if (m === except) return; m.hidden = true; m.closest('.st-card')?.classList.remove('menu-on'); m.closest('.st-card')?.querySelector('.st-more')?.setAttribute('aria-expanded', 'false'); }); }
  function openMenu(card, focusFirst) {
    const m = card.querySelector('.st-menu'), b = card.querySelector('.st-more'); if (!m || !b) return;
    if (!m.hidden) { closeMenus(); b.focus(); return; }
    closeMenus(); m.hidden = false; card.classList.add('menu-on'); b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect(), W = m.offsetWidth, H = m.offsetHeight; // fixed: a card is overflow-hidden and a short banner would cut the menu
    m.style.left = Math.max(8, Math.min(innerWidth - W - 8, r.right - W)) + 'px';
    m.style.top = (r.bottom + 6 + H > innerHeight - 8 ? Math.max(8, r.top - H - 6) : r.bottom + 6) + 'px';
    if (focusFirst) [...m.querySelectorAll('[role="menuitem"]')].find(x => x.offsetParent)?.focus(); // the first one shown (the star and the main action hide in it on a mouse screen)
  }
  $('.st-grid').addEventListener('scroll', () => closeMenus(), { passive: true });
  el.addEventListener('click', async e => {
    if (e.target.closest('.st-x')) return close();
    if (!e.target.closest('.st-more')) closeMenus();
    if (!e.target.closest('.st-mwrap')) openList(false);
    const kb = e.target.closest('[data-kind]'); if (kb) return setKind(kb.dataset.kind);
    if (e.target.closest('.st-mpick')) return openList();
    const mo = e.target.closest('.st-mo'); if (mo && !mo.disabled) { $('.st-keyhelp').hidden = true; modelOf[kind] = mo.dataset.id; store.set('model.' + kind, mo.dataset.id); openList(false); renderPick(); renderModel(); $('.st-mpick').focus(); return; }
    const arb = e.target.closest('[data-ar]'); if (arb) { setSetting('aspectRatio', arb.dataset.ar); renderModel(); return; }
    const qd = e.target.closest('.st-qty [data-d]'); if (qd) { const max = kind === 'video' ? 4 : (budget && budget.maxPerRequest) || 8; qty = Math.max(1, Math.min(max, qty + +qd.dataset.d)); estimate(); return; }
    const f = e.target.closest('[data-f]'); if (f && f.closest('.st-tabs')) { filter = f.dataset.f; el.querySelectorAll('.st-tabs [data-f]').forEach(b => { b.classList.toggle('on', b === f); b.setAttribute('aria-pressed', b === f); }); renderGrid(); return; }
    if (e.target.closest('.st-upbtn')) { uploadRole = null; $('.st-file').click(); return; }
    if (e.target.closest('.st-selbtn')) { selecting = !(selecting || sel.size); if (!selecting) sel.clear(); renderGrid(); return; }
    if (e.target.closest('.st-retry')) { load(); return; }
    if (e.target.closest('.st-all')) { el.querySelector('.st-tabs [data-f="all"]').click(); return; }
    const sl = e.target.closest('[data-slot]'); if (sl) { uploadRole = sl.dataset.slot; $('.st-file').accept = uploadRole === 'video' ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp'; $('.st-file').click(); return; }
    const gp = e.target.closest('[data-gpick]'); if (gp) { picking = gp.dataset.gpick; renderSel(); return; }
    const us = e.target.closest('[data-unslot]'); if (us) { for (const r of Object.keys(media)) media[r] = media[r].filter(x => x !== us.dataset.unslot); renderModel(); return; }
    const bb = e.target.closest('[data-b]');
    if (bb) {
      const b = bb.dataset.b, files = [...sel];
      if (b === 'unpick') { picking = null; renderSel(); }
      if (b === 'none') { sel.clear(); selecting = false; renderGrid(); }
      if (b === 'all') { for (const it of shown()) sel.add(it.file); renderGrid(); }
      if (b === 'fav') favMany(files);
      if (b === 'zip') zip(files);
      if (b === 'del' && confirm(`¿Mover ${files.length} ${files.length === 1 ? 'archivo' : 'archivos'} a la papelera? Podrás deshacerlo.`)) trashMany(files);
      return;
    }
    if (e.target.closest('.st-enh')) {
      const p = $('.st-prompt').value.trim(); if (!p) { $('.st-prompt').focus(); return say('Escribe primero la idea, aunque sea corta.', true); }
      if (!isLive()) return say('Mejorar el prompt necesita la oficina real.', true);
      const b = $('.st-enh'); b.disabled = true; b.querySelector('span').textContent = 'Pensando…';
      try { const lang = $('.st-lang').value; const r = await api('POST', '/api/media/enhance', { prompt: p, kind, lang }); prevPrompt = p; $('.st-prompt').value = r.prompt; $('.st-undo-enh').hidden = false;
        const es = $('.st-es'); es.hidden = !(r.lang === 'en' && r.es); es.querySelector('span').textContent = r.es || '';
        say(r.lang === 'en' ? 'Prompt mejorado, en inglés (los motores lo entienden mejor). Debajo tienes lo que dice en español; «Volver al mío» lo deshace.' : 'Prompt mejorado, en español. «Volver al mío» lo deshace.'); estimate(); }
      catch (err) { say(err.message, true); }
      b.disabled = false; b.querySelector('span').textContent = 'Mejorar el prompt'; return;
    }
    if (e.target.closest('.st-undo-enh')) { if (prevPrompt != null) $('.st-prompt').value = prevPrompt; prevPrompt = null; $('.st-undo-enh').hidden = true; $('.st-es').hidden = true; return; }
    if (e.target.closest('.st-go')) {
      if (!isLive()) return say('El Estudio necesita la oficina real (ábrela con el iniciador).', true);
      const m = cur(); if (!m) return say('Elige un modelo.', true);
      const miss = (m.needs || []).find(r => !media[r].length); if (miss) return fieldErr('slot', `${m.name} necesita «${roleName(miss)}»: súbela o elígela de la galería.`);
      const ps = mode === 'batch' ? lines() : [$('.st-prompt').value.trim()].filter(Boolean);
      if (!ps.length && !(m.needs || []).includes('video')) return fieldErr('prompt', mode === 'batch' ? 'Escribe al menos una idea: una por línea.' : 'Escribe qué quieres crear: qué se ve, el estilo, la luz.');
      const c = estimate(); if (c > 1 && !confirm(`Esto cuesta aprox. US$${c.toFixed(2)}. ¿Generar?`)) return;
      return generate(ps.length ? ps : ['']);
    }
    const kh = e.target.closest('[data-kh]'); if (kh) {
      const K = $('.st-keyhelp'); K.hidden = true;
      if (kh.dataset.kh === 'test' && K.dataset.test) { modelOf[kind] = K.dataset.test; renderPick(); renderModel(); say('Con el motor de prueba: gratis, tarjetas de muestra para ver el flujo. Pulsa GENERAR.'); $('.st-go').focus(); }
      if (kh.dataset.kh === 'engs') { const d = $('.st-keys'); d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      return;
    }
    if (e.target.closest('.st-sum')) { const st = $('.st-ratios').closest('.st-step'); st.scrollIntoView({ block: 'start', behavior: 'smooth' }); st.classList.add('st-flash'); setTimeout(() => st.classList.remove('st-flash'), 1200); (st.querySelector('.st-ar.on') || st.querySelector('select, button'))?.focus({ preventScroll: true }); return; }
    const pt = e.target.closest('[data-pt]'); if (pt) { showPane(pt.dataset.pt); return; }
    const jt = e.target.closest('.st-job');
    if (jt) {
      const a = e.target.closest('[data-j]')?.dataset.j, id = jt.dataset.job; if (!a) return;
      try {
        const jj = jobs.find(x => x.id === id);
        if (a === 'cancel' && jj && jj.state === 'running' && jj.engine !== 'prueba') { askCancel.add(id); renderGrid(); el.querySelector(`[data-job="${id}"] [data-j="cancel-no"]`)?.focus(); return; }
        if (a === 'cancel-no') { askCancel.delete(id); renderGrid(); return; }
        if (a === 'cancel' || a === 'cancel-yes') { askCancel.delete(id); const r = await api('POST', `/api/media/jobs/${id}/cancel`); jobs = jobs.map(j => j.id === id ? r.job : j); say(jj && jj.state === 'queued' ? 'Cancelado antes de empezar: no se cobra.' : 'Cancelado.'); }
        if (a === 'retry') { const r = await api('POST', `/api/media/jobs/${id}/retry`); await api('DELETE', `/api/media/jobs/${id}`).catch(() => {}); jobs = [r.job, ...jobs.filter(j => j.id !== id)]; say('Reintentando…'); }
        if (a === 'forget') { await api('DELETE', `/api/media/jobs/${id}`); jobs = jobs.filter(j => j.id !== id); }
      } catch (err) { say(err.message, true); }
      renderGrid(); watch(); return;
    }
    const gc = e.target.closest('.st-group'); if (gc) {
      const its = items.filter(x => x.job === gc.dataset.g);
      const gt = e.target.closest('.st-gt'); if (gt) { const it = itemOf(gt.dataset.gf); if (it) light(shown().indexOf(it)); return; }
      const ga = e.target.closest('[data-ga]')?.dataset.ga;
      if (ga === 'split') { expanded.add(gc.dataset.g); renderGrid(); el.querySelector(`.st-card[data-f="${CSS.escape(its[0]?.file || '')}"] .st-thumb`)?.focus(); }
      if (ga === 'zip') zip(its.map(x => x.file));
      return;
    }
    const cd = e.target.closest('.st-card[data-f]'); if (!cd) return;
    const it = itemOf(cd.dataset.f); if (!it) return;
    if (picking) { // choosing a file for a slot
      e.preventDefault();
      if (addMedia(picking, it.file)) { const r = picking; picking = null; renderSel(); say(`Puesta en «${roleName(r)}».`); }
      return;
    }
    const ck = e.target.closest('.st-ck');
    if (ck || ((selecting || sel.size) && e.target.closest('.st-thumb'))) { // selecting: a click toggles, Shift extends from the last one
      e.preventDefault();
      const list = shown(), idx = list.indexOf(it);
      if (e.shiftKey && lastPick >= 0) { const [a, b] = [Math.min(lastPick, idx), Math.max(lastPick, idx)]; for (const x of list.slice(a, b + 1)) sel.add(x.file); }
      else if (sel.has(it.file)) sel.delete(it.file); else sel.add(it.file);
      lastPick = idx; renderGrid(); return;
    }
    if (e.target.closest('.st-thumb')) return light(shown().indexOf(it));
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'menu') { openMenu(cd, e.detail === 0); return; } // opened from the keyboard: the first item takes the focus
    if (a === 'fav') favMany([it.file]);
    if (a === 'del') trashMany([it.file]);
    if (a === 'again') reuse(it);
    if (a === 'anim') animate(it);
    if (a === 'ref') useAsRef(it);
    if (a === 'vary') vary(it);
    if (a === 'task' && it.task && ctx.openTask) { close(); ctx.openTask(it.task); } // V4.2 (audit A25)
  });
  el.addEventListener('change', e => {
    if (e.target.classList.contains('st-lang')) { store.set('lang', e.target.value); return; }
    if (e.target.classList.contains('st-mode')) { mode = e.target.checked ? 'batch' : 'one'; renderModel(); return; }
    if (e.target.classList.contains('st-file')) { const fs = [...e.target.files]; e.target.value = ''; e.target.accept = 'image/png,image/jpeg,image/webp,video/mp4,video/webm'; uploadFiles(fs, uploadRole); uploadRole = null; return; }
    const k = e.target.dataset?.set; if (k && cur()) { setSetting(k, e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value); estimate(); }
  });
  el.addEventListener('input', e => {
    if (e.target.classList.contains('st-prompt')) { clearFieldErr(); if (prevPrompt == null) $('.st-es').hidden = true; }
    if (e.target.closest('.st-mq')) { const v = e.target.value; renderList(v); const i = $('.st-mq input'); i.focus(); i.setSelectionRange(v.length, v.length); return; }
    if (e.target.type === 'range' && e.target.dataset.set && cur()) { const o = e.target.parentElement.querySelector('output'); if (o) o.textContent = e.target.value; setSetting(e.target.dataset.set, +e.target.value); }
    if (e.target.classList.contains('st-q')) { q = e.target.value; renderGrid(); return; }
    estimate();
  });
  // drop files: on a slot they go into it, anywhere else they are uploaded to the gallery
  el.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); el.classList.add('st-drop'); } });
  el.addEventListener('dragleave', e => { if (e.target === el || !el.contains(e.relatedTarget)) el.classList.remove('st-drop'); });
  el.addEventListener('drop', e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); el.classList.remove('st-drop'); const slot = e.target.closest('.st-slot'); uploadFiles([...e.dataTransfer.files], slot ? slot.dataset.role : null); });
  el.addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return; e.preventDefault(); const m = cur(); uploadFiles(fs, m && m.roles.reference ? 'reference' : m && m.roles.start ? 'start' : null); });
  // a video card plays on hover
  el.addEventListener('mouseover', e => { const v = e.target.closest('.st-card .st-thumb')?.querySelector('video'); if (v && v.paused) v.play().catch(() => {}); });
  el.addEventListener('mouseout', e => { const t = e.target.closest('.st-card .st-thumb'); if (t && !t.contains(e.relatedTarget)) { const v = t.querySelector('video'); if (v) { v.pause(); } } });
  el.addEventListener('keydown', e => {
    e.stopPropagation();
    const om = el.querySelector('.st-menu:not([hidden])');
    if (om) { // the open «⋯» menu: arrows move, Esc and Tab close it, back on its button
      const its = [...om.querySelectorAll('[role="menuitem"]')].filter(x => x.offsetParent), i = its.indexOf(document.activeElement), btn = om.closest('.st-card')?.querySelector('.st-more');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]?.focus(); return; }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); its[e.key === 'Home' ? 0 : its.length - 1]?.focus(); return; }
      if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); closeMenus(); btn?.focus(); if (e.key === 'Escape') return; }
    }
    if (!$('.st-light').hidden) { if (e.key === 'Escape') closeLight(); else if (e.key === 'ArrowLeft' && lightIdx > 0) light(lightIdx - 1); else if (e.key === 'ArrowRight' && lightIdx < shown().length - 1) light(lightIdx + 1); return; }
    if (e.key === 'Escape') {
      if (!$('.st-mlist').hidden) { openList(false); $('.st-mpick').focus(); return; }
      if (e.target.matches('input[type=search], textarea') && e.target.value && e.target.classList.contains('st-q')) { e.target.value = ''; q = ''; renderGrid(); return; } // Esc empties the search first
      if (picking) { picking = null; renderSel(); } else if (sel.size || selecting) { sel.clear(); selecting = false; renderGrid(); } else close(); return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.classList.contains('st-prompt')) { e.preventDefault(); $('.st-go').click(); }
  });
  /* V4.2 (audit A41): with the Estudio closed, a job that ends still says so — a count on the clapperboard in the dock and a
     note at the bottom with VER. It «keeps generating when you close it»; now it also tells you when it is done. */
  let seenAt = Date.now(), unseen = 0, bgT = null, noteT = null;
  const dock = document.getElementById('topStudio'), dockLabel = dock ? dock.getAttribute('aria-label') : '';
  const note = document.createElement('div'); note.className = 'st-note'; note.hidden = true; note.setAttribute('role', 'status'); note.setAttribute('data-modal-keep', '');
  note.innerHTML = `<span></span><button type="button" class="st-note-go">VER</button><button type="button" class="st-note-x" aria-label="Cerrar el aviso">${svg('x')}</button>`;
  document.body.appendChild(note);
  const hideNote = () => { note.hidden = true; clearTimeout(noteT); };
  note.querySelector('.st-note-go').addEventListener('click', () => { hideNote(); open(); });
  note.querySelector('.st-note-x').addEventListener('click', hideNote);
  note.addEventListener('mouseenter', () => clearTimeout(noteT)); note.addEventListener('mouseleave', () => { noteT = setTimeout(hideNote, 6000); });
  function setDock() { if (!dock) return; dock.classList.toggle('st-news', unseen > 0); if (unseen) { dock.dataset.n = unseen > 9 ? '9+' : unseen; dock.setAttribute('aria-label', `${dockLabel} · ${unseen} ${unseen === 1 ? 'nuevo' : 'nuevos'}`); } else { delete dock.dataset.n; dock.setAttribute('aria-label', dockLabel); } }
  function tellFinished(fresh) {
    const ok = fresh.filter(j => j.state === 'done'), bad = fresh.filter(j => j.state === 'failed' && !/Cancelado por ti/.test(j.error || ''));
    const img = ok.filter(j => j.kind !== 'video').reduce((s, j) => s + (j.items ? j.items.length : 1), 0), vid = ok.filter(j => j.kind === 'video').reduce((s, j) => s + (j.items ? j.items.length : 1), 0);
    const parts = [img && `${img} ${img === 1 ? 'imagen' : 'imágenes'}`, vid && `${vid} ${vid === 1 ? 'video' : 'videos'}`].filter(Boolean);
    if (!parts.length && !bad.length) return;
    unseen += img + vid + bad.length; setDock();
    const agent = ok.find(j => j.by === 'agent');
    note.querySelector('span').textContent = `Estudio: ${parts.length ? `${parts.join(' y ')} ${img + vid === 1 ? 'lista' : 'listas'}${agent ? ` (de ${agentName(agent.agent) || 'un agente'})` : ''}` : ''}${parts.length && bad.length ? ' · ' : ''}${bad.length ? `${bad.length} no se ${bad.length === 1 ? 'pudo' : 'pudieron'}` : ''}.`;
    note.hidden = false; clearTimeout(noteT); noteT = setTimeout(hideNote, 12000);
  }
  function bgPoll() {
    clearTimeout(bgT);
    bgT = setTimeout(async () => {
      if (el.hidden && isLive() && location.protocol.startsWith('http') && !document.hidden) {
        try { const r = await api('GET', '/api/media/jobs'); jobs = r.jobs || []; budget = r.budget || budget;
          const fresh = jobs.filter(j => (j.state === 'done' || j.state === 'failed') && (j.doneAt || 0) > seenAt);
          if (fresh.length) { seenAt = Math.max(...fresh.map(j => j.doneAt)); tellFinished(fresh); } } catch {}
      }
      bgPoll();
    }, 15000);
  }
  bgPoll();
  const phone = () => matchMedia('(max-width: 760px)').matches;
  function showPane(p) { // on a phone one pane at a time; on a wider screen both are always there
    el.dataset.pane = p;
    el.querySelectorAll('[data-pt]').forEach(b => b.setAttribute('aria-selected', b.dataset.pt === p));
    if (p === 'gal') relayout();
  }
  showPane('gen');
  let timer = null;
  function open() { if (!el.hidden) return; unseen = 0; setDock(); hideNote(); seenAt = Date.now(); opener = document.activeElement; el.hidden = false; modal.open(el); document.body.classList.add('studioOpen'); requestAnimationFrame(() => el.classList.add('on')); load(); timer = setInterval(() => { if (!busy && $('.st-light').hidden && $('.st-mlist').hidden) load({ full: false }); }, 20000); setTimeout(() => { if (document.body.classList.contains('studioOpen')) $('.st-prompt').focus(); }, 60); } // closed again before the timer: the focus must not land in a hidden window
  function close() { if (el.hidden) return; seenAt = Date.now(); closeLight(); if (el.contains(document.activeElement)) document.activeElement.blur(); modal.close(el); el.classList.remove('on'); document.body.classList.remove('studioOpen'); clearInterval(timer); clearTimeout(jtimer); jtimer = null; picking = null; openList(false); setTimeout(() => { el.hidden = true; }, 220); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden };
}

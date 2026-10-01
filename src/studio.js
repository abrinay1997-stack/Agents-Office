// Agents Office — the ESTUDIO on the page (E, or the clapperboard in the bar): generate images and video by hand or in
// batches, and see everything the agents generated. The work happens on the server (media.mjs) as background jobs.
//   initStudio(ctx) → { open, close, toggle, isOpen, forTarget, selection, openFile }
//   ctx: isLive() · esc · agentName(id) · openTask?(taskSid) · askDimitri?(files) · studioDepts?: [{ key, name }]
// V2 (24 Sep 2026, after open-higgsfield): a catalog of models with their own settings, start/end frames and references,
// «Animar», live tiles, a masonry gallery, multi-select with ZIP and undo, an Uploads tab.
// V2.1 (same day, the owner: «organizar esta suite… más intuitivo»): a guided composer — 1 what, 2 model (a picker that
// says what each model is good at), 3 the idea, 4 starting material, 5 format as shapes + «más ajustes» folded — with the
// quantity and GENERAR fixed at the bottom; card actions as icons over the picture; clear names everywhere.
import { modal } from './modal.js'; // V4.1: the page outside an open window is inert
import { views } from './views.js'; // V4.5: the Estudio, the calendar and the Brain take turns under the top bar
import * as Z from './viewer-zoom.js'; // V4.9: the viewer's zoom, as tested arithmetic
const LBL = { aspectRatio: 'Formato', resolution: 'Resolución', duration: 'Duración (segundos)', batchSize: 'Imágenes por pedido', enhancePrompt: 'Que el motor mejore el prompt', sound: 'Con sonido', cfgScale: 'Fidelidad al prompt', multiShots: 'Varias tomas', generateAudio: 'Con audio', outputFormat: 'Archivo', quality: 'Calidad', keepOriginalSound: 'Mantener el sonido del video', characterOrientation: 'Orientación del personaje',
  imageSize: 'Tamaño', mode: 'Modo', renderingSpeed: 'Velocidad', promptOptimizer: 'Que el motor mejore el prompt', promptExtend: 'Que el motor amplíe el prompt', cameraMovement: 'Movimiento de cámara', fps: 'Cuadros por segundo', genre: 'Género', era: 'Época', light: 'Luz', pacing: 'Ritmo', cameraModel: 'Cámara', cameraLens: 'Lente', cameraAperture: 'Apertura', colorPalette: 'Paleta de color', bitrateMode: 'Calidad del archivo' }; // V4.4: the settings Higgsfield's own schemas bring
const VAL = { '': 'El motor decide', auto: 'Auto', adaptive: 'Se adapta', low: 'Baja', medium: 'Media', high: 'Alta', xhigh: 'Muy alta', max: 'Máxima', standard: 'Estándar', video: 'la del video', image: 'la de la imagen', std: 'Estándar', pro: 'Pro', '4k': '4K', TURBO: 'Rápida', DEFAULT: 'Normal', QUALITY: 'Máxima calidad',
  epic: 'Épico', drama: 'Drama', noir: 'Noir', comedy: 'Comedia', horror: 'Terror', action: 'Acción', calm: 'Calmado', dynamic: 'Dinámico', chaotic: 'Caótico', 'single-shot': 'Un solo plano', static: 'Fija', dolly_in: 'Acercarse', dolly_out: 'Alejarse', dolly_left: 'A la izquierda', dolly_right: 'A la derecha', jib_up: 'Subir', jib_down: 'Bajar', focus_shift: 'Cambio de foco' };
const RATIO_USE = { '1:1': 'Cuadrado', '4:5': 'Feed', '9:16': 'Reel · Story', '16:9': 'Web · YouTube', '3:4': 'Vertical', '4:3': 'Horizontal', '2:3': 'Póster', '3:2': 'Foto', '21:9': 'Cine', auto: 'Auto' };
const RATIO_WORD = { '1:1': 'Cuadrado', '4:5': 'Feed', '9:16': 'Vertical', '16:9': 'Horizontal', '3:4': 'Retrato', '4:3': 'Clásico', '2:3': 'Póster', '3:2': 'Foto', '21:9': 'Cine', auto: 'Auto' }; // V4.2 (audit A15): one word that fits; the use goes in the title
// V4.2 (audit A5): the engine beside the model only when it adds something («Kling 3 · Higgsfield», not «Prueba (gratis) · Prueba (gratis)»)
const engineAdds = m => m.engineName && !m.name.toLowerCase().includes(m.engineName.toLowerCase().split(/[\s.(]/)[0]);
// The media a model takes. Fotogramas (start, end) are video-only: the first and the last picture of the clip. An image model takes
// references only — the photo to edit, a product, a logo, a face, a style — and the catalog never gives an image model a frame.
const ROLE = { start: 'Fotograma inicial', end: 'Fotograma final', reference: 'Referencias', video: 'Video de origen' };
const ROLE_HELP = { start: 'la primera imagen del video: empieza así', end: 'la última imagen: el video termina así', reference: 'tu producto, logo, personaje o estilo', video: 'el video que se cambia o se alarga' };
const helpFor = (r, m) => r === 'reference' && m && m.kind === 'image' ? 'la foto que quieres editar, o tu producto, logo, personaje o estilo' : r === 'video' && m && (m.needs || []).includes('start') ? 'el video cuyo movimiento se copia' : ROLE_HELP[r];
const I = { // line icons (stroke = currentColor)
  img: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 9"/>',
  vid: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', up: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  plus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>', ref: '<rect x="3" y="7" width="13" height="13" rx="2.5"/><circle cx="7.8" cy="11.6" r="1.4"/><path d="m16 17-3.5-3.5L6 20"/><path d="M19.5 2.5v7M16 6h7"/>', again: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/>', spark: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', chat: '<path d="M4 5.5h16v10.5H9.5L4 20z"/><path d="M8 9.5h8M8 12.5h5"/>', send: '<path d="M4 12h12M11 6l6 6-6 6"/><path d="M20.5 4v16"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  cal: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><path d="M12 13v5M9.5 15.5h5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};
const svg = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const DEPT_NAMES = { emails: 'Emails', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Contabilidad', delivery: 'Entregas' }; // V4.9: «Mandar a un departamento…» when ctx.studioDepts is not given
const EDIT_EX = ['quita el fondo', 'pon el logo abajo', 'cámbiale la ropa a roja']; // V4.9: examples under «¿Qué cambio?»
const store = { get(k, d) { try { const v = localStorage.getItem('ao.st.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('ao.st.' + k, JSON.stringify(v)); } catch {} } };

export function initStudio(ctx) {
  const { isLive, esc, agentName } = ctx;
  // V4.7: the Estudio and Contenido work together. A picture or a video can be sent to the content calendar (ctx.toCalendar), and the calendar can open
  // the Estudio «for a piece» (forTarget): the cards then offer «Usar en la pieza» and «Volver a la pieza» hands back what was chosen.
  let pickFor = null; // { target: { id, titulo }, onPick(ids), ids: [] }
  const el = document.createElement('div'); el.id = 'studioOv'; el.setAttribute('role', 'dialog'); el.setAttribute('data-view', ''); el.setAttribute('aria-labelledby', 'stTitle'); el.tabIndex = -1; el.hidden = true;
  el.innerHTML = `
    <div class="st-head">
      <span class="st-logo">${svg('vid')}</span><div><div class="st-name" id="stTitle">Estudio</div><div class="st-sub"${store.get('subSeen', false) ? ' hidden' : ''}>Imágenes y video reales. Sigue generando aunque cierres esta ventana; tus agentes también lo usan.</div></div>
      <span class="sp"></span><button type="button" class="st-budget" aria-live="polite" title="Tus topes del Estudio: se cambian en Ajustes → Estudio"></button><button type="button" class="st-x" aria-label="Cerrar el Estudio" title="Cerrar (Esc)">${svg('x')}</button>
    </div>
    <div class="st-ptabs" role="tablist" aria-label="Estudio"><button type="button" role="tab" data-pt="gen" aria-selected="true">Crear</button><button type="button" role="tab" data-pt="gal" aria-selected="false">Galería <b class="st-ptn"></b></button></div>
    <div class="st-forpiece" hidden role="status"></div>
    <div class="st-body">
      <section class="st-gen" aria-label="Crear">
        <button type="button" class="st-unfold" title="Mostrar el compositor" aria-label="Mostrar el compositor">${svg('spark')}<span>Crear</span></button>
        <div class="st-scroll"><button type="button" class="st-fold" title="Plegar el compositor: más sitio para la galería" aria-label="Plegar el compositor">‹ plegar</button>
          <div class="st-step"><div class="st-h"><b>1</b> ¿Qué quieres crear?</div>
            <div class="st-kind" role="group" aria-label="Tipo"><button type="button" data-kind="image" aria-pressed="false">${svg('img')}<span>Imagen</span></button><button type="button" data-kind="video" aria-pressed="false">${svg('vid')}<span>Video</span></button></div></div>
          <div class="st-step"><div class="st-h"><b>2</b> Modelo</div>
            <div class="st-mwrap"><button type="button" class="st-mpick" aria-haspopup="listbox" aria-expanded="false"></button><div class="st-mlist" hidden></div></div></div>
          <div class="st-step"><div class="st-h"><b>3</b> Describe lo que quieres</div>
            <div class="st-modeseg" role="group" aria-label="Cuántas ideas"><button type="button" data-mode="one" aria-pressed="true">Una idea</button><button type="button" data-mode="batch" aria-pressed="false" title="Una idea por línea: cada línea es un pedido aparte">Varias ideas, una por línea</button></div>
            <div class="st-pwrap"><textarea class="st-prompt" rows="4" aria-label="Qué quieres crear"></textarea>
              <div class="st-bcount" hidden></div><div class="st-ferr" hidden role="alert"></div><div class="st-prow"><button type="button" class="st-enh" title="Claude lo reescribe como un prompt de producción">${svg('spark')}<span>Mejorar el prompt</span></button><select class="st-lang" aria-label="Idioma del prompt mejorado" title="En inglés los motores suelen entenderlo mejor; te muestro la traducción debajo"><option value="en">en inglés</option><option value="es">en español</option></select><button type="button" class="st-undo-enh" hidden>Volver al mío</button><span class="sp"></span><span class="st-plen"></span><button type="button" class="st-new" title="Vacía la idea y el material de partida">Nuevo</button></div>
              <div class="st-es" hidden><b>En español:</b> <span></span></div></div></div>
          <div class="st-step st-matstep"><div class="st-h"><b>4</b> <span class="st-mt">Material de partida</span> <span class="st-hn">opcional</span></div><div class="st-slots"></div></div>
          <div class="st-step"><div class="st-h"><b class="st-n5">5</b> Formato y ajustes</div><div class="st-ratios"></div><div class="st-sets"></div>
            <details class="st-more"><summary>Más ajustes</summary><div class="st-sets2"></div></details></div>
          <details class="st-keys"><summary>Motores y cómo activarlos</summary><div class="st-engs"></div>
            <p>La key se guarda en Windows una sola vez (con el comando de arriba en una ventana de comandos, o en «Editar las variables de entorno de esta cuenta») y se reinicia la oficina con el iniciador. Nunca va en un archivo. Pon también un límite de gasto en la web de cada servicio.</p>
            <p>El tope de generaciones al día y el gasto máximo (del día y del mes) se cambian en <button type="button" class="st-lk" data-open="settings">Ajustes → Estudio</button> (un video cuenta como 5 imágenes).</p></details>
        </div>
        <div class="st-foot">
          <div class="st-qty" role="group" aria-label="Cantidad"><span>Cantidad</span><button type="button" data-d="-1" aria-label="Menos">−</button><output class="st-n">1</output><button type="button" data-d="1" aria-label="Más">+</button></div>
          <button type="button" class="st-go" title="Generar (Ctrl + Enter desde la idea)">GENERAR</button>
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
          <button type="button" class="st-histbtn" title="Todos los trabajos de la última semana: hechos, fallados y cancelados, con el motivo">${svg('again')}<span>Historial</span></button>
          <button type="button" class="st-binbtn" title="Lo que mandaste a la papelera: vuelve con un clic durante 30 días">${svg('trash')}<span>Papelera</span></button>
        </div>
        <div class="st-folders" role="toolbar" aria-label="Carpetas: arrastra imágenes a una carpeta para guardarlas ahí"></div>
        <div class="st-selbar" hidden><b class="st-seln"></b><button type="button" data-b="all">Todas las visibles</button><button type="button" data-b="clear">Ninguna</button><button type="button" data-b="fav">${svg('star')} Favoritas</button><button type="button" data-b="zip">${svg('down')} Descargar ZIP</button><label class="st-mvw">${svg('folder')}<select class="st-mv" aria-label="Mover las seleccionadas a una carpeta"></select></label><button type="button" data-b="del">${svg('trash')} Papelera</button><span class="sp"></span><button type="button" data-b="none">Listo</button></div>
        <div class="st-picking" hidden></div>
        <div class="st-count" aria-live="polite"></div>
        <div class="st-grid"></div>
      </section>
    </div>
    <div class="st-light" hidden role="dialog" aria-modal="true" aria-label="Vista ampliada"></div>
    <div class="st-hist" hidden role="dialog" aria-modal="true" aria-labelledby="stHistT"></div>
    <div class="st-hist st-binov" hidden role="dialog" aria-modal="true" aria-labelledby="stBinT"></div>
    <div class="st-toast" hidden role="status"><span></span><button type="button">DESHACER</button></div>
    <input type="file" class="st-file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav" multiple hidden>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  let items = [], models = [], engines = [], budget = null, jobs = [], def = {}, loadErr = '', catalogSig = '';
  let editModels = [], editBlock = null, depts = []; // V4.9: the models that edit a picture (on), the engines to switch on when none is (a 409 says which), the departments a picture can be sent to
  // V4.6 (27 Sep 2026, the owner): folders — labels on each file (nothing moves on disk); drag pictures onto one, rename it, remove it
  let folders = [], folderF = store.get('folder', 'all'), dragFiles = null, fdEdit = null, fdNewFor = null; // fdEdit: 'new' or a folder id being renamed · fdNewFor: files waiting for the new folder
  const folderName = id => (folders.find(f => f.id === id) || {}).name || '';
  const inFolder = it => (it.folder && folders.some(f => f.id === it.folder) ? it.folder : null);
  let lastSig = '', lastAt = 0, armed = false;
  let kind = store.get('kind', 'image'), mode = 'one', filter = 'all', q = '', sel = new Set(), selecting = false, lastPick = -1, picking = null, uploadRole = null, busy = false, opener = null, lightIdx = -1, lightAt = null, lightFrom = null, prevPrompt = null, qty = 1;
  const modelOf = { image: store.get('model.image', ''), video: store.get('model.video', '') };
  $('.st-lang').value = store.get('lang', 'en') === 'es' ? 'es' : 'en';
  const setsOf = store.get('sets', {}); // model id → its settings
  let media = { start: [], end: [], reference: [], video: [] };

  const cur = () => models.find(m => m.id === modelOf[kind]) || null;
  const roleName = r => ROLE[r];
  const roleHelp = (r, m = cur()) => helpFor(r, m);
  const itemOf = f => items.find(x => x.file === f);
  // V4.9: who made it — the owner, an agent, or Dimitri (the plan the owner OK'd); «De agentes» shows the agents' and Dimitri's
  const fromBots = x => x.by === 'agent' || x.by === 'dimitri';
  const who = x => (x.by === 'agent' ? agentName(x.agent) || 'agente' : x.by === 'dimitri' ? 'Dimitri' : 'tú');
  // V4.9: what was used is what was liked — a reference, a piece, the calendar teach the office's memory (it never blocks the action)
  const learn = (file, used) => { if (isLive() && location.protocol.startsWith('http')) api('PATCH', '/api/media/item/' + encodeURIComponent(file), { used }).catch(() => {}); };
  // the address carries the file's own moment (?v=): a picture never shows another one that once had its name (the browser keeps them a day)
  const src = it => { const f = String(it.file || it), x = typeof it === 'object' && it.at ? it : itemOf(f); return '/media/' + f.split('/').map(encodeURIComponent).join('/') + (x && x.at ? '?v=' + x.at : ''); };
  const isVid = f => /\.(mp4|webm)$/i.test(f);
  const ar = r => (r && /^\d+:\d+$/.test(r) ? r.replace(':', ' / ') : '');
  const dlName = it => { const d = new Date(it.at || Date.now()), ext = String(it.file).split('.').pop(); return `${String(it.prompt || 'estudio').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'estudio'}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.${ext}`; }; // V4.2 (audit A37)
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
  const tags = m => [m.roles.reference && (m.kind === 'image' ? 'Edita o combina imágenes' : 'Referencias'), m.kind === 'video' && m.roles.start && 'Anima una imagen', m.kind === 'video' && m.roles.end && 'Fotograma final', m.roles.video && 'Parte de un video',
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
    b.innerHTML = m ? `<span class="st-mp-top"><span class="st-mp-name">${esc(m.name)}</span>${engineAdds(m) ? `<span class="st-mp-eng">${esc(m.engineName)}</span>` : ''}<span class="sp"></span><span class="st-mp-cost">${price(m)}</span><span class="st-mp-caret" aria-hidden="true">▾</span></span>${m.note ? `<span class="st-mp-note">${esc(m.note)}</span>` : ''}${tags(m).length ? `<span class="st-tags">${tags(m).map(t => `<i>${t}</i>`).join('')}</span>` : ''}`
      : `<span class="st-mp-top"><span class="st-mp-name">Ningún modelo de ${kind === 'video' ? 'video' : 'imagen'} encendido</span><span class="sp"></span><span class="st-mp-caret">▾</span></span><span class="st-mp-note">Abre «Motores y cómo activarlos» abajo.</span>`;
  }
  // V4.4 (27 Sep 2026): the model list sorts (recommended, best quality, cheapest, most expensive, fastest, by maker) and
  // filters by maker; each model says its maker, its quality (1–4), its speed and what it is good for. The ones without a
  // key stay in the list, apart and dimmed, with how to switch their engine on.
  const SORTS = [['rec', 'Recomendado'], ['tier', 'Mejor calidad'], ['cheap', 'Más barato'], ['dear', 'Más caro'], ['fast', 'Más rápido'], ['maker', 'Por creador']];
  const SPEED = { 'muy rápido': 0, 'rápido': 1, normal: 2, lento: 3 };
  const TIER = { 1: 'básica', 2: 'buena', 3: 'alta', 4: 'la mejor' };
  const dots = n => `<span class="st-tier" title="Calidad ${TIER[n] || ''}" aria-label="Calidad ${TIER[n] || ''}">${'●'.repeat(n)}<span aria-hidden="true">${'●'.repeat(4 - n)}</span></span>`;
  function renderList(qs = '') {
    const L = $('.st-mlist'), w = qs.toLowerCase(), sort = store.get('msort', 'rec'), maker = store.get('mmaker', '');
    const all = models.filter(x => x.kind === kind);
    const makers = [...new Set(all.map(x => x.maker))].sort((a, b) => a.localeCompare(b, 'es'));
    const mine = all.filter(x => (!maker || x.maker === maker) && (!w || `${x.name} ${x.engineName} ${x.note} ${x.maker} ${(x.uses || []).join(' ')}`.toLowerCase().includes(w)));
    const unit = x => x.cost || 0;
    const cmp = { tier: (a, b) => b.tier - a.tier || unit(a) - unit(b), cheap: (a, b) => unit(a) - unit(b) || b.tier - a.tier, dear: (a, b) => unit(b) - unit(a) || b.tier - a.tier, fast: (a, b) => SPEED[a.speed] - SPEED[b.speed] || b.tier - a.tier, maker: (a, b) => a.maker.localeCompare(b.maker, 'es') || b.tier - a.tier }[sort];
    const row = x => `<button type="button" role="option" class="st-mo${x.id === modelOf[kind] ? ' on' : ''}" data-id="${x.id}" aria-selected="${x.id === modelOf[kind]}"${x.on ? '' : ' aria-disabled="true" disabled'} tabindex="-1"><span class="st-mo-top"><b>${esc(x.name)}</b><span class="sp"></span><span class="st-mp-cost">${price(x)}</span></span>
      <span class="st-mo-meta">${dots(x.tier)}<span>${esc(x.maker)}</span><span>· ${esc(x.speed)}</span>${x.legacy ? '<span class="st-old">· antiguo</span>' : ''}</span>
      ${x.note ? `<span class="st-mo-note">${esc(x.note)}</span>` : ''}${(x.uses || []).length ? `<span class="st-mo-uses"><b>Para:</b> ${x.uses.map(esc).join(' · ')}</span>` : ''}${tags(x).length ? `<span class="st-tags">${tags(x).map(t => `<i>${t}</i>`).join('')}</span>` : ''}</button>`;
    const how = e => `<div class="st-mg-how">Para activarlo: ${e.site ? `crea la key en <b>${esc(e.site)}</b> y ` : ''}pega <code>${esc(e.how || '')}</code> en una ventana de comandos; luego reinicia la oficina.</div>`;
    let body = '';
    if (sort === 'rec') { // as before: by engine, the ones that are on first
      const engs = engines.filter(e => mine.some(x => x.engine === e.id)).sort((a, b) => (b.on - a.on) || (a.id === 'prueba') - (b.id === 'prueba'));
      body = engs.filter(e => e.on).map(e => `<div class="st-mg" role="group" aria-label="${esc(e.name)}, listo"><div class="st-mg-h" aria-hidden="true">${esc(e.name)} <span class="ok">● listo</span></div>${mine.filter(x => x.engine === e.id).map(row).join('')}</div>`).join('') +
        engs.filter(e => !e.on).map(e => `<div class="st-mg off" role="group" aria-label="${esc(e.name)}, sin activar"><div class="st-mg-h">${esc(e.name)} <span class="st-mg-off">sin activar</span></div>${how(e)}${mine.filter(x => x.engine === e.id).map(row).join('')}</div>`).join('');
    } else if (sort === 'maker') {
      const ms = [...new Set(mine.slice().sort(cmp).map(x => x.maker))];
      body = ms.map(mk => { const l = mine.filter(x => x.maker === mk).sort((a, b) => (b.on - a.on) || cmp(a, b)); return `<div class="st-mg" role="group" aria-label="${esc(mk)}"><div class="st-mg-h" aria-hidden="true">${esc(mk)} <span class="st-mg-n">${l.length}</span></div>${l.map(row).join('')}</div>`; }).join('');
    } else {
      const on = mine.filter(x => x.on).sort(cmp), off = mine.filter(x => !x.on).sort(cmp);
      body = (on.length ? `<div class="st-mg" role="group" aria-label="Listos"><div class="st-mg-h" aria-hidden="true">Listos para usar <span class="ok">● ${on.length}</span></div>${on.map(row).join('')}</div>` : '') +
        (off.length ? `<div class="st-mg off" role="group" aria-label="Sin activar"><div class="st-mg-h">Sin activar <span class="st-mg-off">${off.length} · su motor necesita una key</span></div>${off.map(row).join('')}</div>` : '');
    }
    L.innerHTML = `<label class="st-mq">${svg('search')}<input type="search" placeholder="Buscar modelo, creador o uso…" aria-label="Buscar modelo" value="${esc(qs)}"></label>` +
      `<div class="st-mctl"><label>Ordenar<select data-msort aria-label="Ordenar los modelos">${SORTS.map(([k, t]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${t}</option>`).join('')}</select></label><label>Creador<select data-mmaker aria-label="Filtrar por creador"><option value="">Todos (${all.length})</option>${makers.map(mk => `<option${mk === maker ? ' selected' : ''}>${esc(mk)}</option>`).join('')}</select></label></div>` +
      `<div role="listbox" aria-label="Modelos">${body}</div>` + (mine.length ? '' : '<div class="st-empty-s">Ningún modelo con eso.</div>');
  }
  function openList(on) {
    const L = $('.st-mlist'), b = $('.st-mpick');
    if (on === undefined) on = L.hidden;
    L.hidden = !on; b.setAttribute('aria-expanded', on); b.hidden = on; // V4.2 (audit A8): the list takes the card's place — the chosen model is marked in it, not shown twice
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
    $('.st-mt').textContent = m.kind === 'image' ? 'Imágenes de referencia' : roles.some(([r]) => r === 'start' || r === 'end') ? 'Fotogramas y material' : 'Material de partida'; // the title says what this model takes
    $('.st-slots').innerHTML = roles.map(([r, n]) => `<div class="st-slot${(m.needs || []).includes(r) && !media[r].length ? ' need' : ''}" data-role="${r}">
        <div class="st-slot-h"><b>${roleName(r, m)}</b> <span>${roleHelp(r, m)}${n > 1 ? ` · ${media[r].length} de ${n}` : ''}</span></div>
        <div class="st-chips">${media[r].map(f => `<span class="st-chip" data-f="${esc(f)}">${isVid(f) ? `<video src="${src(f)}" muted preload="metadata"></video>` : `<img src="${src(f)}" alt="">`}<button type="button" data-unslot="${esc(f)}" aria-label="Quitar">${svg('x')}</button></span>`).join('')}
          ${media[r].length < n ? `<button type="button" class="st-add" data-slot="${r}">${svg('up')}<span>Subir</span></button><button type="button" class="st-add" data-gpick="${r}">${svg('grid')}<span>De la galería</span></button>` : ''}</div></div>`).join('');
    const s = settingsOf(m), ent = Object.entries(m.settings);
    const ratio = m.settings.aspectRatio;
    $('.st-ratios').innerHTML = ratio ? `<div class="st-lab">Formato</div><div class="st-ars" role="group" aria-label="Formato">${ratio.values.map(v => { const [w, h] = /^\d+:\d+$/.test(v) ? v.split(':').map(Number) : [1, 1]; const k = Math.min(26 / Math.max(w, h), 26); return `<button type="button" class="st-ar${String(s.aspectRatio) === v ? ' on' : ''}" data-ar="${esc(v)}" aria-pressed="${String(s.aspectRatio) === v}" title="${esc(!/^\d+:\d+$/.test(v) ? 'El motor elige' : `${v} · ${RATIO_USE[v] || ''}`)}"><i style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px"></i><b>${esc(v === 'auto' ? 'Auto' : v)}</b><small>${esc(RATIO_WORD[v] || '')}</small></button>`; }).join('')}</div>` : '';
    const ctl = ([k, f]) => {
      if (f.type === 'enum') return `<label class="st-lab">${LBL[k] || k}<select data-set="${k}">${f.values.map(v => `<option value="${esc(v)}"${String(s[k]) === v ? ' selected' : ''}>${esc(VAL[v] || v)}</option>`).join('')}</select></label>`;
      if (f.type === 'range') return `<label class="st-lab st-range">${LBL[k] || k} <output>${s[k]}${k === 'duration' ? ' s' : ''}</output><input type="range" data-set="${k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${s[k]}"></label>`;
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
    const room = moneyLeft(); // V4.5: the Estudio's own spending caps (Ajustes → Estudio)
    $('.st-est').textContent = `${total} ${kind === 'video' ? (total === 1 ? 'video' : 'videos') : total === 1 ? 'imagen' : 'imágenes'}${m.per === 's' ? ` de ${secs} s` : ''} · ${cost ? 'aprox. US$' + cost.toFixed(2) : 'gratis'}${budget ? ` · hoy llevas US$${(budget.cost || 0).toFixed(2)}${budget.left == null ? '' : ` · te quedan ${budget.left}`}${room == null ? '' : ` · quedan US$${room.toFixed(2)} de tu presupuesto`}` : ''}`;
    $('.st-est').classList.toggle('over', !!(cost && room != null && cost > room + 1e-9 && m.engine !== 'prueba'));
    const sum = [s.aspectRatio && s.aspectRatio !== 'auto' ? `${s.aspectRatio}${RATIO_WORD[s.aspectRatio] ? ' ' + RATIO_WORD[s.aspectRatio] : ''}` : s.aspectRatio ? 'formato auto' : '', m.settings.duration ? `${secs} s` : '', s.resolution ? String(s.resolution) : ''].filter(Boolean);
    $('.st-sum').innerHTML = sum.length ? `${sum.map(esc).join(' · ')} <u>cambiar</u>` : ''; $('.st-sum').hidden = !sum.length;
    $('.st-go').textContent = kind === 'video' ? (total > 1 ? `GENERAR ${total} VIDEOS` : 'GENERAR VIDEO') : total > 1 ? `GENERAR ${total} IMÁGENES` : 'GENERAR IMAGEN';
    const len = $('.st-prompt').value.length; $('.st-plen').textContent = len ? `${len}/4000` : ''; $('.st-plen').classList.toggle('near', len > 3500); // V4.2 (audit A11)
    const bc = $('.st-bcount'); bc.hidden = mode !== 'batch'; if (mode === 'batch') { const nl = lines().length; bc.textContent = nl ? `${nl} ${nl === 1 ? 'idea' : 'ideas'} × ${qty} = ${nl * qty * per} ${kind === 'video' ? 'videos' : 'imágenes'}` : 'Escribe una idea por línea.'; }
    const maxQ = kind === 'video' ? 4 : (budget && budget.maxPerRequest) || 8; // V4.2 (audit A12): the ends say why they stop
    const [dn, up] = el.querySelectorAll('.st-qty [data-d]'); dn.disabled = qty <= 1; up.disabled = qty >= maxQ; up.title = qty >= maxQ ? `Máximo ${maxQ} por pedido${kind === 'video' ? ' (un video pesa como 5 imágenes)' : ''}` : 'Más';
    return cost;
  }
  // V4.5 (27 Sep 2026): the caps come from Ajustes → Estudio — a count a day (0 = none; a video counts 5) and, new, a spend
  // limit a day and a month in US$ (0 = none). null left = no cap of that kind.
  function moneyLeft() { if (!budget) return null; const l = [budget.costLeftDay, budget.costLeftMonth].filter(x => x != null); return l.length ? Math.min(...l) : null; }
  function budgetHTML(b) {
    const used = b.used ?? (b.limit - b.left), pct = Math.max(b.left == null ? 0 : (used + (b.reserved || 0)) / Math.max(1, b.limit), b.dailyBudget ? ((b.cost || 0) + (b.costReserved || 0)) / b.dailyBudget : 0, b.monthlyBudget ? ((b.monthCost || 0) + (b.costReserved || 0)) / b.monthlyBudget : 0);
    const usd = n => 'US$' + (+n || 0).toFixed(2);
    const long = [`Hoy ${used}${b.left == null ? '' : ` de ${b.limit}`}${b.reserved ? ` · ${b.reserved} en curso` : ''}`, `${usd(b.cost)}${b.dailyBudget ? ` de ${usd(b.dailyBudget)}` : ''}`, b.monthlyBudget ? `mes ${usd(b.monthCost)} de ${usd(b.monthlyBudget)}` : ''].filter(Boolean).join(' · ');
    return `<span class="st-bm${pct >= 0.9 ? ' hot' : ''}" aria-hidden="true"><i style="width:${Math.min(100, Math.round(pct * 100))}%"></i></span><span class="st-bshort">${used}${b.left == null ? '' : '/' + b.limit} hoy</span><span class="st-blong">${long}</span><span class="vh">: cambiar los topes en Ajustes</span>`;
  }
  function renderHead() {
    $('.st-budget').innerHTML = budget ? budgetHTML(budget) : ''; $('.st-budget').hidden = !budget;
    $('.st-engs').innerHTML = engines.map(e => `<div class="st-eng${e.on ? ' on' : ''}"><b>${e.on ? '●' : '○'} ${esc(e.name)}</b> <span>${e.on ? `listo · ${e.models} modelos` : e.id === 'prueba' ? 'siempre listo' : `${e.models} modelos · <code>${esc(e.how || '')}</code>${e.site ? ` · ${esc(e.site)}` : ''}`}</span></div>`).join('');
  }

  /* ---------- the gallery ---------- */
  function shown() {
    const w = q.toLowerCase();
    return items.filter(it => (folderF === 'all' || (folderF === 'none' ? !inFolder(it) : inFolder(it) === folderF)) && (filter === 'all' || (filter === 'fav' && it.fav) || (filter === 'agent' && fromBots(it)) || (filter === 'you' && !fromBots(it) && !it.upload) || (filter === 'video' && (it.kind === 'video' || it.wanted === 'video')) || (filter === 'up' && it.upload))
      && (!w || `${it.prompt} ${it.modelName || it.model || ''} ${it.file} ${fromBots(it) ? who(it) : ''} ${it.task && ctx.taskTitle ? ctx.taskTitle(it.task) : ''}`.toLowerCase().includes(w)));
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
        <p>${esc(j.prompt)}</p><span class="st-meta">${esc(j.modelName)}${fromBots(j) ? ' · ' + esc(who(j)) : ''}${j.versionOf ? ' · versión' : ''}</span>
      </div>
      <div class="st-jacts">${live ? (askCancel.has(j.id) ? `<span class="st-jq">Ya se envió a ${esc(j.engineName || 'el motor')}: puede cobrarse igual.</span><button type="button" data-j="cancel-yes" class="warn">Cancelar igual</button><button type="button" data-j="cancel-no">Seguir</button>`
        : `<button type="button" data-j="cancel" title="${j.state === 'queued' ? 'Aún no empezó: no se cobra' : paid ? 'Ya se envió al motor: puede cobrarse igual' : 'Gratis: no se cobra'}">Cancelar</button>`) : `<button type="button" data-j="retry" class="pri">Reintentar</button><button type="button" data-j="forget">Quitar</button>`}</div></figure>`;
  }
  function card(it) {
    const aud = it.kind === 'audio', vid = it.kind === 'video' || aud, on = sel.has(it.file), label = String(it.prompt).slice(0, 70); // V4.8: an audio (for Muse Spark to transcribe) is neither animated nor a reference
    // V4.4 (25–27 Sep 2026): a row under the caption, on the card's own background (it used to float over the picture,
    // where a light image swallowed it): the main action as its icon (the clapperboard animates an image; a video repeats),
    // Descargar and the bin always in sight, and «⋯» for the favourite, Variar and Repetir.
    // V4.5 (27 Sep 2026, the owner: «una función que se usaría bastante»): «Usar de referencia» joins the row, beside Animar.
    const primary = aud ? null : !vid ? ['anim', 'Animar', 'Convertirla en video', 'vid'] : !it.upload ? ['again', 'Repetir', 'Otra vez, con el mismo prompt y ajustes', 'again'] : null;
    const menu = [ // V4.4 (27 Sep 2026): the row shows the main action, Descargar and the bin as icons; the rest lives here
      ['fav', it.fav ? 'Quitar de favoritas' : 'Marcar favorita', 'star', '', it.fav ? 'fill' : ''],
      ...(vid ? [] : [['vary', 'Variar: otra versión parecida', 'spark']]),
      ...(!it.upload && !vid ? [['again', 'Repetir con el mismo prompt', 'again']] : []), ['move', 'Mover a una carpeta…', 'folder'], ...(ctx.toCalendar ? [['cal', 'Enviar al calendario de contenido', 'cal']] : []),
      ...(ctx.askDimitri ? [['dimitri', 'Pedírselo a Dimitri', 'chat']] : []), ['dept', 'Mandar a un departamento…', 'send']]; // V4.9
    return `<figure class="st-card${on ? ' sel' : ''}" data-f="${esc(it.file)}" draggable="true">
      <label class="st-ck" title="Seleccionar (Mayús para un rango)"><input type="checkbox"${on ? ' checked' : ''} aria-label="Seleccionar: ${esc(label)}"></label>
      <button type="button" class="st-thumb" style="${ratioOf(it) ? `aspect-ratio:${ratioOf(it)}` : ''}" aria-label="Ver en grande: ${esc(label)}">${aud ? '<span class="st-aud" aria-hidden="true">♪</span>' : vid ? `<video src="${src(it)}" preload="metadata" muted loop playsinline draggable="false"></video><span class="st-play" aria-hidden="true">▶</span>` : `<img src="${src(it)}" alt="" loading="lazy" decoding="async" draggable="false">`}
        ${aud ? '<span class="st-badge">AUDIO</span>' : it.upload ? '<span class="st-badge">SUBIDA</span>' : it.provider === 'prueba' ? `<span class="st-badge">PRUEBA${it.wanted === 'video' ? ' · VIDEO' : ''}</span>` : ''}</button>
      <div class="st-menu" role="menu" hidden>
        ${menu.map(m => m === '-' ? '<div class="st-msep" role="separator"></div>' : m[0] === 'dl' ? `<a role="menuitem" href="${src(it)}" download="${esc(dlName(it))}" tabindex="-1">${svg('down')}<span>Descargar</span></a>` : `<button type="button" role="menuitem" tabindex="-1" data-a="${m[0]}" class="${m[3] || ''}">${svg(m[2], m[4] || '')}<span>${m[1]}</span></button>`).join('')}
      </div>
      <figcaption><span class="st-p">${esc(it.prompt)}</span>${it.task && it.by === 'agent' ? `<button type="button" class="st-tchip" data-a="task" title="Abrir la tarea">para: ${esc((ctx.taskTitle && ctx.taskTitle(it.task)) || 'su tarea')}</button>` : ''}<span class="st-meta">${it.fav ? '<span class="st-fav" title="Favorita">★ favorita</span> · ' : ''}${it.upload ? 'subida por ti' : esc(who(it))}${it.versionOf ? ' · versión' : ''}${it.modelName || (it.model && !it.upload) ? ' · ' + esc(it.modelName || it.model) : ''} · ${esc(when(it.at))}${folderF === 'all' && inFolder(it) ? ` · <span class="st-infd">${svg('folder')}${esc(folderName(it.folder))}</span>` : ''}</span></figcaption>
      <div class="st-ov" role="group" aria-label="Acciones">
        ${pickFor ? `<button type="button" data-a="usar" class="st-use${pickFor.ids.includes(it.file) ? ' on' : ''}" aria-pressed="${pickFor.ids.includes(it.file)}" title="Usarla en la pieza «${esc(pickFor.target.titulo)}»">${pickFor.ids.includes(it.file) ? '✓ En la pieza' : 'Usar en la pieza'}</button>` : ''}
        ${primary ? `<button type="button" data-a="${primary[0]}" class="st-oi" aria-label="${primary[1]}: ${esc(label)}" title="${primary[1]} — ${primary[2].toLowerCase()}">${svg(primary[3])}</button>` : ''}
        ${vid ? '' : `<button type="button" data-a="ref" class="st-oi" aria-label="Usar de referencia: ${esc(label)}" title="Usar de referencia — tu producto, logo, personaje o estilo en lo próximo que crees">${svg('ref')}</button>`}
        ${vid ? '' : `<button type="button" data-a="edit" class="st-oi" aria-label="Editar: ${esc(label)}" title="Editar — pide un cambio y sale una versión nueva; la original no se toca">${svg('pen')}</button>`}
        <a class="st-oi" href="${src(it)}" download="${esc(dlName(it))}" aria-label="Descargar: ${esc(label)}" title="Descargar">${svg('down')}</a>
        <button type="button" data-a="del" class="st-oi st-odel" aria-label="Mover a la papelera: ${esc(label)}" title="Mover a la papelera (30 días para recuperarla)">${svg('trash')}</button>
        <button type="button" data-a="menu" class="st-oi st-more" aria-haspopup="menu" aria-expanded="false" aria-label="Más acciones: ${esc(label)}" title="Más: favorita, variar, repetir, carpeta, Dimitri, un departamento">${svg('dots')}</button>
      </div>
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
    return `<figure class="st-card st-group" data-g="${esc(f.job)}" draggable="true"><div class="st-gthumbs n${Math.min(n, 4)}">${thumbs.replace(/<(img|video) /g, '<$1 draggable="false" ')}</div>
      <figcaption><span class="st-p">${esc(f.prompt)}</span>${f.task && f.by === 'agent' ? `<span class="st-tchip st-tchip-s">para: ${esc((ctx.taskTitle && ctx.taskTitle(f.task)) || 'su tarea')}</span>` : ''}<span class="st-meta"><b>${n} ${vid ? 'videos' : 'imágenes'} de un pedido</b> · ${esc(who(f))}${f.modelName ? ' · ' + esc(f.modelName) : ''} · ${esc(when(f.at))}</span>
      <span class="st-gacts"><button type="button" data-ga="split">Ver por separado</button><button type="button" data-ga="zip">${svg('down')} Descargar las ${n}</button></span></figcaption></figure>`;
  }
  const aspect = it => { if (it.w && it.h) return it.h / it.w; const r = String(it.ratio || (it.s && it.s.aspectRatio) || '').split(':').map(Number); return r.length === 2 && r[0] && r[1] ? r[1] / r[0] : 1; };
  const colCount = () => { const w = $('.st-grid').clientWidth - 36; return w > 0 ? Math.max(1, Math.floor((w + 14) / (230 + 14))) : 0; };
  function when(ts) { const d = new Date(ts), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1); const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; return d.toDateString() === n.toDateString() ? `hoy ${t}` : d.toDateString() === y.toDateString() ? `ayer ${t}` : d.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) }); }
  function renderGrid() {
    const list = shown(), tj = tileJobs().filter(j => (folderF === 'all' || (folderF === 'none' ? !j.folder : j.folder === folderF)) && (filter === 'all' || (filter === 'you' && !fromBots(j)) || (filter === 'agent' && fromBots(j)) || (filter === 'video' && j.kind === 'video')));
    renderFolders();
    const active = tileJobs().filter(j => j.state !== 'failed').length;
    $('.st-count').textContent = `${list.length} ${list.length === 1 ? 'archivo' : 'archivos'}${list.length !== items.length ? ` de ${items.length}` : ''}${active ? ` · ${active} generándose` : ''}`;
    const cnt = { all: items.length, fav: items.filter(i => i.fav).length, you: items.filter(i => !fromBots(i) && !i.upload).length, agent: items.filter(fromBots).length, video: items.filter(i => i.kind === 'video' || i.wanted === 'video').length, up: items.filter(i => i.upload).length }; // V4.2 (audit A22)
    el.querySelectorAll('.st-tabs [data-f]').forEach(b => { if (!b.dataset.lbl) b.dataset.lbl = b.textContent; b.innerHTML = `${b.dataset.lbl} <b>${cnt[b.dataset.f]}</b>`; });
    $('.st-ptn').textContent = active ? `· ${active} en curso` : items.length ? String(items.length) : '';
    renderSel();
    const G = $('.st-grid');
    const empty = loadErr && !items.length ? `<div class="st-empty">No pude cargar la galería (${esc(loadErr)}). <button type="button" class="st-retry">Reintentar</button></div>`
      : !tj.length && !list.length ? `<div class="st-empty">${items.length ? `Nada con este filtro. <button type="button" class="st-all">Ver todo</button>` : `<div class="st-start"><h3>Empieza aquí</h3><ol><li>Escribe una idea en el paso 3 y pulsa <b>GENERAR</b>.</li><li>Con <b>Prueba (gratis)</b> ves todo el recorrido sin gastar: salen tarjetas de muestra con tu texto, no imágenes reales.</li><li>Para imágenes y videos de verdad, activa un motor una sola vez: <button type="button" class="st-open-engs">Motores y cómo activarlos</button></li><li>También puedes subir tus fotos (Subir) o pedírsela a un agente de Marketing.</li></ol></div>`}</div>` : '';
    if (empty) { if (G.innerHTML !== empty) G.innerHTML = empty; nodes.clear(); layoutSig = ''; lastWant = []; return; }
    let root = G.querySelector(':scope > .st-days'); if (!root) { G.innerHTML = '<div class="st-days"></div>'; root = G.firstElementChild; nodes.clear(); layoutSig = ''; }
    const flat = selecting || sel.size || picking, byJob = new Map();
    if (!flat) for (const it of list) if (it.job && !expanded.has(it.job)) byJob.set(it.job, [...(byJob.get(it.job) || []), it]);
    const want = tj.map(j => ['j:' + j.id, jobTile(j), aspect(j), dayKey(Date.now()), 1, Date.now()]), placed = new Set();
    for (const it of list) {
      const g = !flat && it.job && byJob.get(it.job);
      if (g && g.length > 1) { if (placed.has(it.job)) continue; placed.add(it.job); const a = aspect(g[0]); want.push(['g:' + it.job, groupCard(g), (g.length === 2 ? a / 2 : a) + 0.15, dayKey(it.at), g.length, it.at]); continue; }
      want.push(['f:' + it.file + '@' + it.at, card(it), aspect(it), dayKey(it.at), 1, it.at]);
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
    $('.st-selbar').hidden = !(selecting || sel.size); $('.st-seln').textContent = (sel.size ? `${sel.size} ${sel.size === 1 ? 'seleccionada' : 'seleccionadas'}` : 'Toca las que quieras') + ' · Mayús + clic elige un rango';
    el.classList.toggle('st-selecting', selecting || sel.size > 0);
    $('.st-selbtn').setAttribute('aria-pressed', selecting || sel.size > 0); $('.st-selbtn').classList.toggle('on', selecting || sel.size > 0);
    el.querySelectorAll('.st-selbar [data-b="fav"], .st-selbar [data-b="zip"], .st-selbar [data-b="del"], .st-selbar .st-mv').forEach(b => { b.disabled = !sel.size; });
    const mv = $('.st-mv'); if (mv && document.activeElement !== mv) mv.innerHTML = `<option value="">Mover a…</option>${folders.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}<option value="none">Sin carpeta</option><option value="__new">+ Nueva carpeta…</option>`;
    $('.st-picking').hidden = !picking;
    if (picking) $('.st-picking').innerHTML = `Elige ${picking === 'video' ? 'un video' : 'una imagen'} para «${roleName(picking)}»: haz clic en ella. <button type="button" data-b="unpick">Cancelar</button>`;
    el.classList.toggle('st-pickmode', !!picking);
  }
  let loading = null;
  async function load({ full = true } = {}) { // full: the catalog too (the 20-second refresh only touches the gallery, so an open menu stays open)
    if (loading) return loading;
    loading = (async () => {
      try { if (!location.protocol.startsWith('http')) throw new Error('el Estudio trabaja con la oficina real: ábrela con el iniciador (.bat)'); // the demo file has no server to ask (it logged a fetch error)
        const j = await api('GET', '/api/media'); items = j.items || []; budget = j.budget || null; jobs = j.jobs || []; folders = j.folders || []; loadErr = '';
        depts = ctx.studioDepts && ctx.studioDepts.length ? ctx.studioDepts : (j.departments || []).map(k => ({ key: k, name: DEPT_NAMES[k] || k })); // V4.9
        if (folderF !== 'all' && folderF !== 'none' && !folders.some(f => f.id === folderF)) { folderF = 'all'; store.set('folder', 'all'); } // a folder removed elsewhere
        const sig = JSON.stringify((j.models || []).map(m => m.id + (m.on ? 1 : 0)));
        if (full || sig !== catalogSig) { models = j.models || []; engines = j.engines || []; def = j.default || {}; catalogSig = sig; full = true; }
        editModels = (j.editModels || []).map(m => (typeof m === 'string' ? models.find(x => x.id === m) : m)).filter(m => m && m.on !== false); if (editModels.length) editBlock = null; // V4.9
      } catch (e) { loadErr = e.message; }
      for (const f of [...sel]) if (!itemOf(f)) sel.delete(f);
      renderHead(); if (full) renderModels(); else if (cur()) estimate(); renderGrid(); watch(); // V4.5: the cost line follows the caps too
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
        renderHead(); if (cur()) estimate(); renderGrid();
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
      try { const r = await api('POST', '/api/media/jobs', { prompt: p, n: qty, kind, model: m.id, settings, media: mediaNow, by: 'you', ...(folders.some(f => f.id === folderF) ? { folder: folderF } : {}) }); jobs.unshift(r.job); budget = r.budget; ok++; }
      catch (e) { if (/key/i.test(e.message)) { keyHelp(m, e.message); break; } say(`No se pudo${prompts.length > 1 ? ` (${ok + 1} de ${prompts.length})` : ''}: ${e.message}`, true); if (/tope|presupuesto/.test(e.message)) break; }
    }
    if (ok) { say(`${ok === 1 ? 'En marcha' : `${ok} trabajos en marcha`}: ${kind === 'video' ? 'un video tarda unos minutos; ' : ''}aparece en la galería al terminar. Puedes seguir.`); if (phone()) showPane('gal'); } // on a phone, the new tile is what to look at
    busy = false; $('.st-go').disabled = false;
    renderHead(); estimate(); renderGrid(); watch();
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
  // V4.2 (audit A42): every job of the last week — done, failed, cancelled — with its reason, not only the last three days' tiles
  let histFrom = null;
  function openHist() {
    const H = $('.st-hist'), ok = { done: 'Hecho', failed: 'No se pudo', queued: 'En cola', running: 'Generando' };
    const rows = jobs.slice().sort((a, b) => (b.doneAt || b.at) - (a.doneAt || a.at));
    H.innerHTML = `<div class="st-hbox"><div class="st-hhead"><h2 id="stHistT">Historial de trabajos</h2><span class="sp"></span><button type="button" class="st-hx" aria-label="Cerrar">${svg('x')}</button></div>
      <p class="st-hsub">La última semana: ${rows.length} ${rows.length === 1 ? 'trabajo' : 'trabajos'}. Los archivos siguen en la galería aunque el trabajo salga de aquí.</p>
      <ol class="st-hlist">${rows.map(j => { const cancel = j.state === 'failed' && /Cancelado por ti/.test(j.error || ''); return `<li class="${cancel ? 'cancel' : j.state}"><b>${cancel ? 'Cancelado' : ok[j.state] || j.state}</b><span class="st-hp">${esc(j.prompt || '(sin texto)')}</span><span class="st-hm">${esc(j.modelName || j.model)} · ${esc(who(j))} · ${esc(when(j.doneAt || j.at))}${j.items && j.items.length ? ` · ${j.items.length} ${j.kind === 'video' ? 'video(s)' : 'imagen(es)'}` : ''}${j.cost ? ` · US$${j.cost}` : ''}</span>${j.state === 'failed' && !cancel ? `<span class="st-hr">${esc(j.error || '')}</span>` : ''}</li>`; }).join('') || '<li>Todavía no hay trabajos.</li>'}</ol></div>`;
    histFrom = document.activeElement; H.hidden = false; modal.open(H); H.querySelector('.st-hx').focus();
    H.onclick = e => { if (e.target === H || e.target.closest('.st-hx')) closeHist(); };
  }
  // V4.4 (25 Sep 2026): the Estudio's bin, where «Mover a la papelera» sends a file — 30 days to bring it back, then it goes.
  // It used to be reachable only from the 8-second DESHACER after throwing something away.
  let binFrom = null, binItems = [];
  async function openBin() {
    const B = $('.st-binov');
    const draw = msg => {
      B.innerHTML = `<div class="st-hbox"><div class="st-hhead"><h2 id="stBinT">Papelera</h2><span class="sp"></span>${binItems.length ? '<button type="button" class="st-binall">Vaciar la papelera</button>' : ''}<button type="button" class="st-hx" aria-label="Cerrar">${svg('x')}</button></div>
        <p class="st-hsub">${binItems.length ? `${binItems.length} ${binItems.length === 1 ? 'archivo' : 'archivos'}. Cada uno se borra solo a los 30 días de tirarlo; hasta entonces vuelve a la galería con «Recuperar».` : 'Vacía. Lo que mandes a la papelera queda aquí 30 días.'}</p>
        <div class="st-bmsg" role="status" aria-live="polite">${msg ? esc(msg) : ''}</div>
        <ul class="st-blist">${binItems.map((b, i) => `<li><span class="st-bthumb">${b.kind === 'video' ? `<video src="/api/media/trash/file?n=${encodeURIComponent(b.name)}" muted preload="metadata" playsinline></video>` : `<img src="/api/media/trash/file?n=${encodeURIComponent(b.name)}" alt="" loading="lazy">`}</span>
          <span class="st-binfo"><span class="st-bp">${esc(b.prompt)}</span><span class="st-hm">${b.upload ? 'subida por ti' : esc(b.modelName || '')}${b.at ? ' · creada ' + esc(when(b.at)) : ''} · se borra en ${b.daysLeft} ${b.daysLeft === 1 ? 'día' : 'días'}</span>
          <span class="st-bacts"><button type="button" data-bin="back" data-i="${i}">Recuperar</button><button type="button" data-bin="gone" data-i="${i}" class="warn">Borrar para siempre</button></span></span></li>`).join('')}</ul></div>`;
    };
    binFrom = binFrom || document.activeElement; B.hidden = false; modal.open(B);
    try { const r = await api('GET', '/api/media/trash'); binItems = r.items || []; draw(); } catch (e) { binItems = []; draw('No pude abrir la papelera: ' + e.message); }
    B.querySelector('.st-hx').focus();
    B.onclick = async e => {
      if (e.target === B || e.target.closest('.st-hx')) return closeBin();
      if (e.target.closest('.st-binall')) {
        const btn = e.target.closest('.st-binall'); if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = `¿Borrar los ${binItems.length} para siempre? Pulsa otra vez`; return; }
        try { await api('POST', '/api/media/trash/purge', { all: true }); binItems = []; draw('Papelera vacía.'); B.querySelector('.st-hx').focus(); } catch (err) { draw('No se pudo: ' + err.message); }
        return;
      }
      const b = e.target.closest('[data-bin]'); if (!b) return; const it = binItems[+b.dataset.i]; if (!it) return;
      if (b.dataset.bin === 'gone' && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro? Pulsa otra vez'; return; } // a second click: this one does not come back
      try {
        if (b.dataset.bin === 'back') { await api('POST', '/api/media/restore', { id: it.id, bin: it.bin }); await load({ full: false }); }
        else await api('POST', '/api/media/trash/purge', { bin: it.bin });
        binItems = binItems.filter(x => x !== it); draw(b.dataset.bin === 'back' ? 'Recuperada: ya está en la galería.' : 'Borrada para siempre.');
        (B.querySelector('[data-bin]') || B.querySelector('.st-hx')).focus();
      } catch (err) { draw(b.dataset.bin === 'back' ? 'No se pudo recuperar: ' + err.message : 'No se pudo borrar: ' + err.message); }
    };
  }
  function closeBin() { const B = $('.st-binov'); if (B.hidden) return; B.hidden = true; B.innerHTML = ''; modal.close(B); if (binFrom && document.contains(binFrom)) binFrom.focus({ preventScroll: true }); binFrom = null; }
  function closeHist() { const H = $('.st-hist'); if (H.hidden) return; H.hidden = true; H.innerHTML = ''; modal.close(H); if (histFrom && document.contains(histFrom)) histFrom.focus({ preventScroll: true }); }
  function setMode(m) { mode = m; el.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m)); renderModel(); }
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
    media = { start: [it.file], end: [], reference: [], video: [] }; learn(it.file, 'ref'); // its first frame: used, so liked
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
    if (addMedia('reference', it.file)) { learn(it.file, 'ref'); say(`Referencia añadida a ${m.name}. Describe qué hacer con ella.`); if (phone()) showPane('gen'); }
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
    setMode('one');
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
    toast(`${undo.length} ${undo.length === 1 ? 'archivo movido' : 'archivos movidos'} a la papelera${failed ? ` · ${failed} no se pudo` : ''}: está en «Papelera», 30 días.`, async () => {
      let back = 0; for (const u of undo) { try { await api('POST', '/api/media/restore', u); back++; } catch {} }
      await load({ full: false }); say(back === undo.length ? 'Recuperado.' : `Recuperé ${back} de ${undo.length}.`, back !== undo.length);
    });
  }
  /* ---------- V4.6: folders — the strip, dragging onto it, renaming, removing ---------- */
  const FD_ICON = svg('folder');
  function renderFolders() {
    const box = $('.st-folders'); if (!box || (fdEdit && box.contains(document.activeElement) && document.activeElement.classList.contains('st-fdin'))) return; // a name being typed is not redrawn under the caret
    const none = items.filter(it => !inFolder(it)).length;
    const chip = (id, label, n, extra = '') => `<button type="button" class="st-fd" data-fd="${esc(id)}"${extra}>${label} <b>${n}</b></button>`;
    const html = chip('all', 'Todas', items.length) + chip('none', 'Sin carpeta', none, ' title="Suelta aquí para sacarlas de su carpeta"') +
      folders.map(f => fdEdit === f.id
        ? `<input class="st-fdin" data-fdr="${esc(f.id)}" value="${esc(f.name)}" maxlength="60" aria-label="Nuevo nombre de la carpeta">`
        : `<span class="st-fdw">${chip(f.id, FD_ICON + esc(f.name), items.filter(it => it.folder === f.id).length, ` title="Carpeta «${esc(f.name)}»: clic para verla, suelta imágenes aquí para guardarlas, doble clic para renombrarla"`)}<button type="button" class="st-fdm" data-fdm="${esc(f.id)}" aria-label="Opciones de la carpeta ${esc(f.name)}" aria-haspopup="menu" title="Renombrar o eliminar">⋯</button></span>`).join('') +
      (fdEdit === 'new' ? `<input class="st-fdin" data-fdnew="1" placeholder="Nombre de la carpeta" maxlength="60" aria-label="Nombre de la carpeta nueva">` : `<button type="button" class="st-fdnew">+ Nueva carpeta</button>`);
    if (box._html !== html) { box._html = html; box.innerHTML = html; const inp = box.querySelector('.st-fdin'); if (inp) { inp.focus(); if (inp.dataset.fdr) inp.select(); } } // the same chips stay the same elements: a double click is not lost to a redraw
    box.querySelectorAll('.st-fd').forEach(b => { const on = b.dataset.fd === folderF; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  function setFolder(id) { folderF = id; store.set('folder', id); closeFdMenu(); renderGrid(); }
  async function moveFiles(files, folder, quiet) { // folder: an id, or null (out of any folder)
    files = files.filter(f => itemOf(f)); if (!files.length) return;
    const prev = new Map(files.map(f => [f, itemOf(f).folder || null]));
    try { const r = await api('POST', '/api/media/move', { files, folder }); folders = r.folders || folders; }
    catch (err) { return say('No se pudo mover: ' + err.message, true); }
    for (const f of files) itemOf(f).folder = folder;
    sel.clear(); selecting = false; renderGrid();
    if (quiet) return;
    const where = folder ? `a «${folderName(folder)}»` : 'fuera de su carpeta';
    toast(`${files.length} ${files.length === 1 ? 'archivo movido' : 'archivos movidos'} ${where}.`, async () => { // DESHACER: each one back to where it was
      const back = new Map(); for (const [f, p] of prev) back.set(p, [...(back.get(p) || []), f]);
      for (const [p, fs] of back) { try { await api('POST', '/api/media/move', { files: fs, folder: p }); for (const f of fs) { const it = itemOf(f); if (it) it.folder = p; } } catch {} }
      await load({ full: false }); say('Deshecho.');
    });
  }
  async function saveFolderName(inp) {
    const name = inp.value.trim(), rid = inp.dataset.fdr, isNew = !!inp.dataset.fdnew;
    if (!name) { fdEdit = null; fdNewFor = null; renderFolders(); return; }
    try {
      if (isNew) {
        const files = fdNewFor || [];
        const r = await api('POST', '/api/media/folders', { name, files }); folders = r.folders || folders;
        for (const f of files) { const it = itemOf(f); if (it) it.folder = r.folder.id; }
        fdEdit = null; fdNewFor = null; if (files.length) { sel.clear(); selecting = false; }
        say(files.length ? `Carpeta «${r.folder.name}» creada con ${files.length} ${files.length === 1 ? 'archivo' : 'archivos'}.` : `Carpeta «${r.folder.name}» creada: arrastra imágenes a ella.`);
      } else {
        const r = await api('PATCH', '/api/media/folders/' + rid, { name }); folders = r.folders || folders; fdEdit = null; say(`Ahora se llama «${r.folder.name}».`);
      }
    } catch (err) { say(err.message.charAt(0).toUpperCase() + err.message.slice(1) + '.', true); inp.focus(); inp.select(); return; }
    renderGrid();
  }
  async function removeFolder(id) {
    const f = folders.find(x => x.id === id); if (!f) return;
    const n = items.filter(it => it.folder === id).length;
    if (!confirm(`¿Eliminar la carpeta «${f.name}»?\n\n${n ? `Sus ${n} ${n === 1 ? 'archivo no se borra: queda' : 'archivos no se borran: quedan'} en «Sin carpeta».` : 'Está vacía.'}`)) return;
    try { const r = await api('DELETE', '/api/media/folders/' + id); folders = r.folders || folders.filter(x => x.id !== id); for (const it of items) if (it.folder === id) it.folder = null; }
    catch (err) { return say('No se pudo eliminar: ' + err.message, true); }
    if (folderF === id) { folderF = 'all'; store.set('folder', 'all'); }
    say(`Carpeta «${f.name}» eliminada${n ? `; sus ${n} ${n === 1 ? 'archivo está' : 'archivos están'} en «Sin carpeta»` : ''}.`); renderGrid();
  }
  // the small menu of a folder: rename, remove
  let fdMenu = null;
  function closeFdMenu() { if (fdMenu) { fdMenu.remove(); fdMenu = null; } }
  function openFdMenu(btn) {
    const id = btn.dataset.fdm; if (fdMenu && fdMenu.dataset.for === id) return closeFdMenu(); closeFdMenu();
    fdMenu = document.createElement('div'); fdMenu.className = 'st-menu st-fdmenu'; fdMenu.setAttribute('role', 'menu'); fdMenu.dataset.for = id;
    fdMenu.innerHTML = `<button type="button" role="menuitem" data-fda="rename">${svg('spark')}<span>Renombrar</span></button><button type="button" role="menuitem" data-fda="remove" class="warn">${svg('trash')}<span>Eliminar la carpeta</span></button>`;
    el.appendChild(fdMenu);
    const r = btn.getBoundingClientRect(); fdMenu.style.left = Math.max(8, Math.min(innerWidth - fdMenu.offsetWidth - 8, r.left)) + 'px'; fdMenu.style.top = (r.bottom + 6) + 'px';
    fdMenu.querySelector('button').focus();
    fdMenu.addEventListener('click', e => { const a = e.target.closest('[data-fda]')?.dataset.fda; closeFdMenu(); if (a === 'rename') { fdEdit = id; renderFolders(); } if (a === 'remove') removeFolder(id); });
    fdMenu.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeFdMenu(); btn.focus(); } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const b = [...fdMenu.querySelectorAll('button')], i = b.indexOf(document.activeElement); b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length].focus(); } });
  }
  {
    const box = $('.st-folders');
    box.addEventListener('click', e => {
      const fdm = e.target.closest('[data-fdm]'); if (fdm) return openFdMenu(fdm);
      if (e.target.closest('.st-fdnew')) { fdEdit = 'new'; fdNewFor = sel.size ? [...sel] : null; renderFolders(); return; }
      const fd = e.target.closest('[data-fd]'); if (fd) setFolder(fd.dataset.fd);
    });
    box.addEventListener('dblclick', e => { const fd = e.target.closest('[data-fd]'); if (fd && folders.some(f => f.id === fd.dataset.fd)) { fdEdit = fd.dataset.fd; renderFolders(); } });
    box.addEventListener('keydown', e => {
      const inp = e.target.closest('.st-fdin'); if (!inp) { if (e.key === 'F2') { const fd = e.target.closest('[data-fd]'); if (fd && folders.some(f => f.id === fd.dataset.fd)) { e.preventDefault(); fdEdit = fd.dataset.fd; renderFolders(); } } return; }
      e.stopPropagation(); // typing a name: no Estudio shortcut fires
      if (e.key === 'Enter') { e.preventDefault(); saveFolderName(inp); }
      if (e.key === 'Escape') { e.preventDefault(); fdEdit = null; fdNewFor = null; renderFolders(); box.querySelector('.st-fd.on')?.focus(); }
    });
    box.addEventListener('focusout', e => { const inp = e.target.closest?.('.st-fdin'); if (inp && !box.contains(e.relatedTarget)) setTimeout(() => { if (fdEdit && document.activeElement !== inp) saveFolderName(inp); }, 0); });
    // dropping pictures on a folder
    box.addEventListener('dragover', e => { const fd = e.target.closest('[data-fd]'); if (!dragFiles || !fd || fd.dataset.fd === 'all') return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; box.querySelectorAll('.drop').forEach(x => x !== fd && x.classList.remove('drop')); fd.classList.add('drop'); });
    box.addEventListener('dragleave', e => { const fd = e.target.closest('[data-fd]'); if (fd && !fd.contains(e.relatedTarget)) fd.classList.remove('drop'); });
    box.addEventListener('drop', e => { const fd = e.target.closest('[data-fd]'); if (!dragFiles || !fd || fd.dataset.fd === 'all') return; e.preventDefault(); e.stopPropagation(); fd.classList.remove('drop'); const files = dragFiles; dragFiles = null; el.classList.remove('st-dragging'); moveFiles(files, fd.dataset.fd === 'none' ? null : fd.dataset.fd); });
    // dragging a card (or all the selected ones, when it is one of them)
    const grid = $('.st-grid');
    grid.addEventListener('dragstart', e => {
      const g = e.target.closest?.('.st-group'), c = e.target.closest?.('.st-card[data-f]');
      const files = g ? items.filter(x => x.job === g.dataset.g).map(x => x.file) : c ? (sel.has(c.dataset.f) && sel.size > 1 ? [...sel] : [c.dataset.f]) : null;
      if (!files || !files.length) return;
      dragFiles = files; el.classList.add('st-dragging');
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-ao-media', JSON.stringify(files)); e.dataTransfer.setData('text/plain', files.length + ' archivo(s)');
      if (files.length > 1) { const b = document.createElement('div'); b.className = 'st-dragn'; b.textContent = `${files.length} archivos`; document.body.appendChild(b); e.dataTransfer.setDragImage(b, 20, 20); setTimeout(() => b.remove(), 0); }
    });
    grid.addEventListener('dragend', () => { dragFiles = null; el.classList.remove('st-dragging'); $('.st-folders').querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); });
    // «Mover a…» in the selection bar (the keyboard's and the phone's way: a finger cannot drag here)
    el.addEventListener('change', e => {
      if (!e.target.classList.contains('st-mv')) return;
      const v = e.target.value; e.target.value = ''; if (!v || !sel.size) return;
      if (v === '__new') { fdEdit = 'new'; fdNewFor = [...sel]; renderFolders(); return; }
      moveFiles([...sel], v === 'none' ? null : v);
    });
    document.addEventListener('click', e => { if (fdMenu && !fdMenu.contains(e.target) && !e.target.closest('[data-fdm]')) closeFdMenu(); });
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
    let ok = 0; const done = [];
    for (const file of files) {
      const vid = /^video\//.test(file.type);
      if (!/^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/.test(file.type)) { say(`«${file.name}»: solo PNG, JPG, WEBP, MP4 o WEBM.`, true); continue; }
      if (file.size > (vid ? 25 : 12) * 1024 * 1024) { say(`«${file.name}» pasa de ${vid ? 25 : 12} MB.`, true); continue; }
      say(`Subiendo «${file.name}»…`);
      try {
        const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('no pude leerlo')); fr.readAsDataURL(file); });
        const r = await new Promise((res, rej) => { // V4.2 (audit A16): with a percentage — a 25 MB video used to sit on «Subiendo…»
          const x = new XMLHttpRequest(); x.open('POST', '/api/media/upload'); x.setRequestHeader('content-type', 'application/json');
          x.upload.onprogress = ev => { if (ev.lengthComputable) say(`Subiendo «${file.name}»… ${Math.round(ev.loaded / ev.total * 100)} %`); };
          x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status < 300 ? res(j) : rej(new Error(j.error || x.statusText)); };
          x.onerror = () => rej(new Error('sin conexión con la oficina')); x.send(JSON.stringify({ name: file.name, data, ...(folders.some(f => f.id === folderF) ? { folder: folderF } : {}) }));
        });
        items.unshift(r.item); ok++; done.push(r.item);
        if (role) addMedia(role, r.item.file);
      } catch (e) { say(`«${file.name}»: ${e.message}`, true); }
    }
    if (ok) { say(`${ok === 1 ? 'Subida' : ok + ' subidas'}${role ? ` y puesta en «${roleName(role)}»` : ''}. Están en la pestaña Subidas.`); renderGrid(); }
    return done;
  }

  /* ---------- the lightbox ---------- */
  // V4.9 (30 Sep 2026, the owner: «las fotos grandes no caben» · «no se puede editar una imagen»): the picture always fits whole (its stage is a
  // grid row of minmax(0, 1fr), src/css/estudio.css) and zooms (src/viewer-zoom.js): Ajustar / 100 %, the wheel and a pinch around the pointer,
  // dragging, a double click, + − 0 and F (full screen). The panel gains Editar (a new version: the original is never touched), «Versión de…» and
  // «Versiones (n)», «Pedírselo a Dimitri» and «Mandar a un departamento…».
  let zs = Z.fitted(), zImg = null, lPanel = null, lPanelFrom = null;
  const zDims = () => (zImg && zImg.naturalWidth && zImg.clientWidth ? { nw: zImg.naturalWidth, nh: zImg.naturalHeight, bw: zImg.clientWidth, bh: zImg.clientHeight } : null);
  function zPaint() {
    const L = $('.st-light'), d = zDims(); if (!zImg) return;
    const on = Z.isZoomed(zs); zImg.style.transform = on ? Z.css(zs) : ''; L.classList.toggle('st-zoomed', on);
    const pct = d ? Z.percent(zs, d) : 0, p = L.querySelector('.st-zpct'); if (p) p.textContent = d ? pct + ' %' : '';
    L.querySelector('[data-z="fit"]')?.setAttribute('aria-pressed', String(!on));
    L.querySelector('[data-z="real"]')?.setAttribute('aria-pressed', String(!!d && pct === 100));
    const lim = d && Z.limits(d), inB = L.querySelector('[data-z="in"]'), outB = L.querySelector('[data-z="out"]');
    const off = (b, v) => { if (!b) return; if (v && document.activeElement === b) (L.querySelector(b === outB ? '[data-z="in"]:not(:disabled)' : '[data-z="out"]:not(:disabled)') || L.querySelector('[data-z="fit"]'))?.focus({ preventScroll: true }); b.disabled = v; };
    off(inB, !d || zs.scale >= lim.max - 1e-6); off(outB, !on); // a button that turns off under the focus passes it on first: a disabled one drops it to <body>, inert under modal.js
  }
  function zSet(s) { const d = zDims(); if (!d) return; zs = Z.clampPan(s, d); zPaint(); }
  const zPoint = (cx, cy) => { const r = zImg.parentElement.getBoundingClientRect(); return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) }; }; // from the stage's centre, which is the picture's
  function wireZoom(im) {
    zImg = im; zs = Z.fitted(); if (!im) return;
    const ptr = new Map(); let drag = null, pin = null;
    im.addEventListener('load', zPaint);
    im.addEventListener('wheel', e => { const d = zDims(); if (!d) return; e.preventDefault(); const p = zPoint(e.clientX, e.clientY); zs = Z.zoomAt(zs, Z.wheelFactor(e.deltaY), p.x, p.y, d); zPaint(); }, { passive: false });
    im.addEventListener('dblclick', e => { const d = zDims(); if (!d) return; const p = zPoint(e.clientX, e.clientY); zs = Z.toggle(zs, p.x, p.y, d); zPaint(); });
    im.addEventListener('pointerdown', e => {
      if (e.button > 0) return; ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { im.setPointerCapture(e.pointerId); } catch {}
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pin = { s: zs, p1: zPoint(a.x, a.y), p2: zPoint(b.x, b.y) }; drag = null; } else if (ptr.size === 1) drag = { x: e.clientX, y: e.clientY };
    });
    im.addEventListener('pointermove', e => {
      if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); const d = zDims(); if (!d) return;
      if (pin && ptr.size >= 2) { const [a, b] = [...ptr.values()]; zs = Z.pinch(pin, zPoint(a.x, a.y), zPoint(b.x, b.y), d); zPaint(); return; }
      if (drag && Z.isZoomed(zs)) { zs = Z.pan(zs, e.clientX - drag.x, e.clientY - drag.y, d); drag = { x: e.clientX, y: e.clientY }; im.classList.add('st-grabbing'); zPaint(); }
    });
    const up = e => { ptr.delete(e.pointerId); if (ptr.size < 2) pin = null; if (ptr.size === 1) drag = { ...[...ptr.values()][0] }; if (!ptr.size) { drag = null; im.classList.remove('st-grabbing'); } };
    im.addEventListener('pointerup', up); im.addEventListener('pointercancel', up);
  }
  function fullScreen() {
    const m = $('.st-light .st-lmedia'); if (!m) return;
    if (document.fullscreenElement) { document.exitFullscreen?.().catch(() => {}); return; }
    if (!m.requestFullscreen) return toast('Este navegador no deja ver la imagen a pantalla completa.');
    m.requestFullscreen().catch(() => toast('Este navegador no dejó abrir la pantalla completa.'));
  }
  document.addEventListener('fullscreenchange', () => {
    const b = el.querySelector('.st-light [data-z="full"]'), on = !!document.fullscreenElement;
    if (b) { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Salir de la pantalla completa (F)' : 'Pantalla completa (F)'); b.querySelector('span').textContent = on ? 'Salir' : 'Pantalla completa'; }
    if (zImg) requestAnimationFrame(() => zSet(zs));
  });
  window.addEventListener('resize', () => { if (zImg && !$('.st-light').hidden) zSet(zs); });
  function closeLight() { const L = $('.st-light'); if (L.hidden) return; if (document.fullscreenElement && L.contains(document.fullscreenElement)) document.exitFullscreen?.().catch(() => {}); L.hidden = true; L.innerHTML = ''; lightIdx = -1; lightAt = null; zImg = null; lPanel = null; L.classList.remove('st-zoomed'); modal.close(L); if (lightFrom && document.contains(lightFrom)) lightFrom.focus({ preventScroll: true }); }
  /** Open the viewer on a file, wherever it is: a filter or a folder that hides it is cleared first. */
  function lightFile(file, o = {}) {
    let i = shown().findIndex(x => x.file === file);
    if (i < 0 && itemOf(file)) {
      filter = 'all'; q = ''; $('.st-q').value = ''; folderF = 'all'; store.set('folder', 'all');
      el.querySelectorAll('.st-tabs [data-f]').forEach(b => { b.classList.toggle('on', b.dataset.f === 'all'); b.setAttribute('aria-pressed', b.dataset.f === 'all'); });
      renderGrid(); i = shown().findIndex(x => x.file === file);
    }
    if (i >= 0) light(i, o);
    return i >= 0;
  }
  const short = t => { const x = String(t || '').trim(); return x.length > 60 ? x.slice(0, 58) + '…' : x || 'sin texto'; };
  function editEngines() { // the engines that bring a model that edits a picture, with how to switch each on
    if (editBlock && editBlock.length) return editBlock;
    return engines.filter(e => e.id !== 'prueba' && models.some(m => m.engine === e.id && m.edit)).map(e => ({ id: e.id, name: e.name, how: e.how || '' }));
  }
  function panelHTML(it) {
    if (lPanel === 'edit') {
      const ms = editBlock ? [] : editModels, off = !ms.length, engs = off ? editEngines() : [], want = store.get('editModel', ''), fd = inFolder(it) ? folderName(it.folder) : '';
      return `<section class="st-lpanel" aria-labelledby="stEdT"><h3 id="stEdT">${svg('pen')} Editar: una versión nueva</h3>
        <label class="st-plab" for="stEdQ">¿Qué cambio?</label><textarea id="stEdQ" class="st-edq" rows="3" maxlength="2000" placeholder="Ej.: quita el fondo · pon el logo abajo · cámbiale la ropa a roja"></textarea>
        <div class="st-edex" role="group" aria-label="Ejemplos">${EDIT_EX.map(x => `<button type="button" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        ${off ? `<div class="st-edoff" role="alert" tabindex="-1"><b>Ningún motor que edite imágenes está activado.</b> Activa uno una sola vez (pega su comando en una ventana de comandos) y reinicia la oficina:${engs.length ? `<ul>${engs.map(e => `<li><b>${esc(e.name)}</b>${e.how ? `: <code>${esc(e.how)}</code>` : ''}</li>`).join('')}</ul>` : ''}</div>`
          : `<label class="st-plab">Modelo<select class="st-edm">${ms.map(m => `<option value="${esc(m.id)}"${m.id === want ? ' selected' : ''}>${esc(m.name)} · ${price(m)}</option>`).join('')}</select></label>`}
        <p class="st-edn">La original no se toca: sale una imagen nueva${fd ? ` en «${esc(fd)}»` : ' en la galería'}, unida a esta como versión.</p>
        <div class="st-edrow"><button type="button" class="st-edgo pri"${off ? ' disabled aria-disabled="true"' : ''} title="Ctrl + Enter desde el campo">Crear versión</button><button type="button" data-lp="x">Cancelar</button></div>
        <div class="st-edmsg" role="status" aria-live="polite"></div></section>`;
    }
    if (lPanel === 'dept') {
      const last = store.get('dept', '');
      return `<section class="st-lpanel" aria-labelledby="stDpT"><h3 id="stDpT">${svg('send')} Mandar a un departamento</h3>
        ${depts.length ? `<label class="st-plab">Departamento<select class="st-dpd">${depts.map(d => `<option value="${esc(d.key)}"${d.key === last ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
        <label class="st-plab" for="stDpQ">Qué hacer con ${it.kind === 'video' ? 'este video' : 'esta imagen'}</label><input id="stDpQ" class="st-dpq" maxlength="300" placeholder="Ej.: úsala en el post del lanzamiento del viernes">
        <p class="st-edn">Se crea una tarea para el departamento; su agente la recibe con este archivo de referencia.</p>
        <div class="st-edrow"><button type="button" class="st-dpgo pri">Crear la tarea</button><button type="button" data-lp="x">Cancelar</button></div>`
        : `<p class="st-edn">Ningún departamento usa el Estudio (Ajustes → Estudio).</p><div class="st-edrow"><button type="button" data-lp="x">Cerrar</button></div>`}
        <div class="st-edmsg" role="status" aria-live="polite"></div></section>`;
    }
    return '';
  }
  function paintPanel(it, focus = true) {
    const W = $('.st-light .st-lpwrap'); if (!W) return; W.innerHTML = panelHTML(it);
    $('.st-light [data-l="edit"]')?.setAttribute('aria-expanded', String(lPanel === 'edit')); $('.st-light [data-l="dept"]')?.setAttribute('aria-expanded', String(lPanel === 'dept'));
    if (focus && lPanel) { W.scrollIntoView({ block: 'nearest' }); (W.querySelector('textarea, input, select') || W.querySelector('button'))?.focus({ preventScroll: true }); }
  }
  function setPanel(it, p, from) { lPanel = lPanel === p ? null : p; lPanelFrom = from || null; paintPanel(it); if (!lPanel && lPanelFrom && document.contains(lPanelFrom)) lPanelFrom.focus({ preventScroll: true }); }
  function closePanel() { if (!lPanel) return false; lPanel = null; const W = $('.st-light .st-lpwrap'); if (W) W.innerHTML = ''; el.querySelectorAll('.st-light [aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false')); (lPanelFrom && document.contains(lPanelFrom) ? lPanelFrom : $('.st-light .st-lx'))?.focus({ preventScroll: true }); return true; }
  async function sendEdit(it) {
    const P = $('.st-light .st-lpanel'); if (!P) return; const msg = P.querySelector('.st-edmsg'), q_ = P.querySelector('.st-edq'), go = P.querySelector('.st-edgo');
    if (!go || go.disabled) return;
    const instruction = q_.value.trim(); if (!instruction) { msg.textContent = 'Escribe qué cambio quieres: «quita el fondo», «pon el logo abajo»…'; q_.focus(); return; }
    if (!isLive() || !location.protocol.startsWith('http')) { msg.textContent = 'Editar necesita la oficina real (ábrela con el iniciador).'; return; }
    const model = P.querySelector('.st-edm')?.value || ''; if (model) store.set('editModel', model);
    go.disabled = true; go.textContent = 'Enviando…';
    let r, j = {};
    try { r = await fetch('/api/media/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: it.file, instruction, ...(model ? { model } : {}) }) }); j = await r.json().catch(() => ({})); }
    catch { go.disabled = false; go.textContent = 'Crear versión'; msg.textContent = 'Sin conexión con la oficina.'; return; }
    if (r.status === 409) { editBlock = j.engines || []; paintPanel(it, false); const t = $('.st-light .st-edq'); if (t) t.value = instruction; $('.st-light .st-edoff')?.focus(); return; } // no engine edits: say which to switch on, and leave the button off
    if (!r.ok || !j.job) { go.disabled = false; go.textContent = 'Crear versión'; msg.textContent = 'No se pudo: ' + (j.error || r.statusText || 'error'); return; }
    jobs.unshift(j.job); if (j.budget) budget = j.budget;
    const mName = j.job.modelName || (editModels.find(m => m.id === model) || {}).name || 'el modelo de edición';
    closeLight(); renderHead(); renderGrid(); watch(); if (phone()) showPane('gal');
    toast(`Versión en marcha con ${mName}: aparece en la galería al terminar, junto a la original.`);
  }
  async function sendToDept(it) {
    const P = $('.st-light .st-lpanel'); if (!P) return; const msg = P.querySelector('.st-edmsg'), inp = P.querySelector('.st-dpq'), go = P.querySelector('.st-dpgo'), dept = P.querySelector('.st-dpd')?.value;
    if (!go || go.disabled) return;
    const text = inp.value.trim(); if (!text) { msg.textContent = 'Escribe en una línea qué hacer con ella.'; inp.focus(); return; }
    if (!isLive() || !location.protocol.startsWith('http')) { msg.textContent = 'Esto necesita la oficina real (ábrela con el iniciador).'; return; }
    store.set('dept', dept); go.disabled = true; go.textContent = 'Creando…';
    try {
      const r = await api('POST', '/api/media/to-dept', { file: it.file, dept, text }), name = (depts.find(d => d.key === dept) || {}).name || dept;
      closePanel(); toast(`Tarea creada en ${name}: «${short((r.task && r.task.title) || text)}».`);
    } catch (err) { go.disabled = false; go.textContent = 'Crear la tarea'; msg.textContent = 'No se pudo: ' + err.message; }
  }
  /** Where the picture in the viewer sits in shown() now: load() (a job ending while it is open) can move it, so the file is the truth, not lightIdx. */
  function lightPos() { if (!lightAt) return -1; const k = shown().findIndex(x => x.file === lightAt); if (k >= 0) lightIdx = k; return k; }
  function light(i, o = {}) {
    const list = shown(); const it = list[i]; if (!it) return; if (lightIdx < 0) lightFrom = document.activeElement; lightIdx = i; lightAt = it.file;
    const L = $('.st-light'); L.hidden = false; modal.open(L); L.classList.remove('st-zoomed');
    const img = it.kind !== 'video' && it.kind !== 'audio';
    lPanel = o.panel && (o.panel !== 'edit' || img) ? o.panel : null; lPanelFrom = null;
    const setTxt = it.settings ? Object.entries(it.settings).map(([k, v]) => `${LBL[k] || k}: ${typeof v === 'boolean' ? (v ? 'sí' : 'no') : VAL[v] || v}`).join(' · ') : '';
    const used = it.media ? Object.entries(it.media).flatMap(([r, fs]) => fs.map(f => [r, f])) : [];
    const orig = it.versionOf ? itemOf(it.versionOf) : null, vers = (it.versions || []).map(itemOf).filter(Boolean);
    const tools = it.kind === 'audio' ? '' : `<div class="st-ztools" role="toolbar" aria-label="${img ? 'Zoom' : 'Vista'}">${img ? `<button type="button" data-z="out" aria-label="Alejar (−)" title="Alejar (−)">−</button><span class="st-zpct" aria-label="Tamaño"></span><button type="button" data-z="in" aria-label="Acercar (+)" title="Acercar (+, o la rueda del ratón)">+</button><button type="button" data-z="fit" aria-pressed="true" title="Ajustar: la imagen entera (0)">Ajustar</button><button type="button" data-z="real" aria-pressed="false" title="100 %: un píxel de la imagen, un píxel de la pantalla (doble clic sobre la imagen)">100 %</button>` : ''}<button type="button" data-z="full" aria-pressed="false" aria-label="Pantalla completa (F)" title="Pantalla completa (F)">${svg('full')}<span>Pantalla completa</span></button></div>`;
    L.innerHTML = `<div class="st-lbox"><button type="button" class="st-lx" aria-label="Cerrar" title="Cerrar (Esc)">${svg('x')}</button>
      <div class="st-lmedia">${it.kind === 'audio' ? `<div class="st-laud"><span aria-hidden="true">♪</span><audio src="${src(it)}" controls></audio></div>` : `<div class="st-lstage"${it.w && it.h ? ` style="--ar:${+it.w} / ${+it.h}"` : ''}>${it.kind === 'video' ? `<video src="${src(it)}" controls autoplay playsinline></video>` : `<img src="${src(it)}" alt="${esc(String(it.prompt).slice(0, 120))}" draggable="false">`}</div>${tools}`}</div>
      <div class="st-linfo"><div class="st-lpos"><button type="button" class="st-lnav prev" aria-label="Anterior" title="Anterior (←)"${i > 0 ? '' : ' disabled'}>‹</button><span aria-live="polite">${i + 1} de ${list.length}</span><button type="button" class="st-lnav next" aria-label="Siguiente" title="Siguiente (→)"${i < list.length - 1 ? '' : ' disabled'}>›</button></div>
      ${it.versionOf ? `<p class="st-lver">Versión de ${orig ? `<button type="button" class="st-lk" data-vf="${esc(orig.file)}" title="Abrir la original">«${esc(short(orig.prompt))}»</button>` : 'una imagen que ya no está en la galería'}</p>` : ''}
      <p class="st-lp">${esc(it.prompt)}</p>
      <p class="st-meta">${it.upload ? 'Subida por ti' : `${esc(it.modelName || it.model || it.provider)} · ${esc(who(it))}`} · ${esc(when(it.at))}${it.w ? ` · ${it.w}×${it.h}` : ''}${it.cost ? ` · ~US$${it.cost}` : ''}</p>
      ${setTxt ? `<p class="st-meta">${esc(setTxt)}</p>` : ''}
      ${used.length ? `<div class="st-lused">${used.map(([r, f]) => `<span title="${esc(ROLE[r] || r)}">${isVid(f) ? svg('vid') : `<img src="${src(f)}" alt="">`}<i>${esc(ROLE[r] || r)}</i></span>`).join('')}</div>` : ''}
      ${vers.length ? `<div class="st-lvers"><h3>Versiones (${vers.length})</h3><div>${vers.map((v, k) => `<button type="button" data-vf="${esc(v.file)}" aria-label="Abrir la versión ${k + 1}: ${esc(short(v.prompt))}" title="${esc(v.prompt)}"><img src="${src(v)}" alt=""></button>`).join('')}</div></div>` : ''}
      <div class="st-lacts">${!img ? (it.upload ? '' : `<button type="button" data-l="again" class="pri">${svg('again')} Repetir</button>`) : `<button type="button" data-l="edit" class="pri" aria-expanded="false" title="Pide un cambio: sale una versión nueva y la original no se toca">${svg('pen')} Editar</button><button type="button" data-l="anim">${svg('vid')} Animar</button><button type="button" data-l="vary" title="Otra versión parecida: mismo prompt, esta imagen como referencia">${svg('spark')} Variar</button>`}<a href="${src(it)}" download="${esc(dlName(it))}">${svg('down')} Descargar</a></div>
      <div class="st-lpwrap"></div>
      <div class="st-lacts2">${img ? '<button type="button" data-l="ref">Usar de referencia</button>' : ''}${it.upload || !img ? '' : '<button type="button" data-l="again">Repetir</button>'}<button type="button" data-l="copy">Copiar prompt</button>${ctx.toCalendar ? '<button type="button" data-l="cal">Enviar al calendario</button>' : ''}${ctx.askDimitri ? '<button type="button" data-l="dimitri">Pedírselo a Dimitri</button>' : ''}<button type="button" data-l="dept" aria-expanded="false">Mandar a un departamento…</button><button type="button" data-l="fav">${it.fav ? 'Quitar de favoritas' : 'Favorita'}</button>${it.task && ctx.openTask ? '<button type="button" data-l="task">Ver la tarea</button>' : ''}</div>
      <button type="button" class="st-ldel" data-l="del">${svg('trash')} Mover a la papelera</button></div></div>`;
    wireZoom(img ? L.querySelector('.st-lstage img') : null); zPaint();
    if (lPanel) paintPanel(it); else L.querySelector('.st-lx').focus();
    L.onclick = e => {
      if (e.target === L || e.target.closest('.st-lx')) return closeLight();
      const at = lightPos() < 0 ? i : lightIdx;
      if (e.target.closest('.st-lnav.prev') && at > 0) { light(at - 1); L.querySelector('.st-lnav.prev')?.focus(); return; }
      if (e.target.closest('.st-lnav.next') && at < shown().length - 1) { light(at + 1); L.querySelector('.st-lnav.next')?.focus(); return; }
      const z = e.target.closest('[data-z]')?.dataset.z;
      if (z) { if (z === 'full') return fullScreen(); const d = zDims(); if (!d) return;
        if (z === 'in') zs = Z.zoomAt(zs, 1.5, 0, 0, d); if (z === 'out') zs = Z.zoomAt(zs, 1 / 1.5, 0, 0, d); if (z === 'fit') zs = Z.fitted(); if (z === 'real') zs = Z.zoomTo(zs, Z.realScale(d), 0, 0, d);
        zPaint(); return; }
      const vf = e.target.closest('[data-vf]'); if (vf) { lightFile(vf.dataset.vf); return; }
      const ex = e.target.closest('[data-ex]'); if (ex) { const t = L.querySelector('.st-edq'); if (t) { t.value = t.value.trim() ? `${t.value.trim()}; ${ex.dataset.ex}` : ex.dataset.ex; t.focus(); } return; }
      if (e.target.closest('[data-lp="x"]')) { closePanel(); return; }
      if (e.target.closest('.st-edgo')) { sendEdit(it); return; }
      if (e.target.closest('.st-dpgo')) { sendToDept(it); return; }
      const a = e.target.closest('[data-l]')?.dataset.l; if (!a) return;
      if (a === 'copy') { const btn = e.target.closest('button'); (navigator.clipboard ? navigator.clipboard.writeText(it.prompt) : Promise.reject()).then(() => { btn.textContent = 'Copiado ✓'; }, () => { btn.textContent = 'No se pudo copiar'; }).finally(() => setTimeout(() => { if (document.contains(btn)) btn.textContent = 'Copiar prompt'; }, 1600)); }
      if (a === 'edit' || a === 'dept') setPanel(it, a, e.target.closest('button'));
      if (a === 'dimitri' && ctx.askDimitri) { closeLight(); ctx.askDimitri([it.file]); }
      if (a === 'vary') { closeLight(); vary(it); }
      if (a === 'again') { closeLight(); reuse(it); }
      if (a === 'anim') { closeLight(); animate(it); }
      if (a === 'ref') { closeLight(); useAsRef(it); }
      if (a === 'cal' && ctx.toCalendar) { closeLight(); learn(it.file, 'calendario'); ctx.toCalendar(it.file, it.kind, it.prompt); }
      if (a === 'fav') favMany([it.file]).then(() => { const k = lightPos(); if (k >= 0) light(k); });
      if (a === 'del') trashMany([it.file]);
      if (a === 'task') { closeLight(); close(); ctx.openTask(it.task); }
    };
  }
  /** The viewer's keys: Esc, ← → (a picture to the side, or moving a zoomed one), + − 0, F. Typing in its panel: Esc closes the panel, Ctrl+Enter sends. */
  function lightKey(e, typing) {
    if (typing) { if (e.key === 'Escape') { e.preventDefault(); closePanel(); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('.st-light .st-edgo, .st-light .st-dpgo')?.click(); } return; }
    if (e.key === 'Escape') { if (!closePanel()) closeLight(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const d = zDims(), arrow = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }[e.key];
    if (d && arrow && Z.isZoomed(zs)) { e.preventDefault(); zSet(Z.pan(zs, arrow[0], arrow[1], d)); return; } // zoomed: the arrows move around the picture
    const at = lightPos();
    if (e.key === 'ArrowLeft' && at > 0) return light(at - 1);
    if (e.key === 'ArrowRight' && at >= 0 && at < shown().length - 1) return light(at + 1);
    if (e.key === 'f' || e.key === 'F') { if ($('.st-light [data-z="full"]')) { e.preventDefault(); fullScreen(); } return; }
    if (!d) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zSet(Z.zoomAt(zs, 1.5, 0, 0, d)); }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); zSet(Z.zoomAt(zs, 1 / 1.5, 0, 0, d)); }
    if (e.key === '0') { e.preventDefault(); zSet(Z.fitted()); }
  }

  /* ---------- events ---------- */
  function closeMenus(except) { el.querySelectorAll('.st-menu:not([hidden]):not(.st-fdmenu)').forEach(m => { /* a folder's menu closes on its own */ if (m === except) return; m.hidden = true; m.closest('.st-card')?.classList.remove('menu-on'); m.closest('.st-card')?.querySelector('.st-more')?.setAttribute('aria-expanded', 'false'); }); }
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
    if (e.target.closest('.st-budget, [data-open="settings"]')) { if (ctx.openSettings) ctx.openSettings('estudio'); return; } // V4.5: the caps live in Ajustes → Estudio
    if (!e.target.closest('.st-more')) closeMenus();
    if (!e.target.closest('.st-mwrap')) openList(false);
    const kb = e.target.closest('[data-kind]'); if (kb) return setKind(kb.dataset.kind);
    if (e.target.closest('.st-mpick')) return openList();
    const mo = e.target.closest('.st-mo'); if (mo && !mo.disabled) { $('.st-keyhelp').hidden = true; modelOf[kind] = mo.dataset.id; store.set('model.' + kind, mo.dataset.id); openList(false); renderPick(); renderModel(); $('.st-mpick').focus(); return; }
    const arb = e.target.closest('[data-ar]'); if (arb) { setSetting('aspectRatio', arb.dataset.ar); renderModel(); return; }
    if (e.target.closest('.st-fold')) { el.classList.add('st-folded'); store.set('fold', true); relayout(); $('.st-unfold').focus(); return; }
    if (e.target.closest('.st-unfold')) { el.classList.remove('st-folded'); store.set('fold', false); relayout(); $('.st-prompt').focus(); return; }
    if (e.target.closest('.st-open-engs')) { showPane('gen'); el.classList.remove('st-folded'); const d = $('.st-keys'); d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); d.querySelector('summary').focus({ preventScroll: true }); return; }
    if (e.target.closest('.st-histbtn')) { openHist(); return; }
    if (e.target.closest('.st-binbtn')) { openBin(); return; }
    const md = e.target.closest('[data-mode]'); if (md) { setMode(md.dataset.mode); $('.st-prompt').focus(); return; }
    if (e.target.closest('.st-new')) { $('.st-prompt').value = ''; media = { start: [], end: [], reference: [], video: [] }; prevPrompt = null; $('.st-undo-enh').hidden = true; $('.st-es').hidden = true; clearFieldErr(); armed = false; renderModel(); say('Compositor vacío: empieza una idea nueva.'); $('.st-prompt').focus(); return; }
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
      if (b === 'clear') { sel.clear(); renderGrid(); }
      if (b === 'fav') favMany(files);
      if (b === 'zip') zip(files);
      if (b === 'del') trashMany(files); // V4.2 (audit A27): like the card — straight to the bin, with DESHACER
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
      const c = estimate(); if (c >= 0.5 && !confirm(`Esto cuesta aprox. US$${c.toFixed(2)}${budget && budget.cost ? ` (hoy llevas US$${budget.cost.toFixed(2)})` : ''}. ¿Generar?`)) return; // V4.2 (audit A10): from US$0.50, not only above 1
      const sig = JSON.stringify([ps, m.id, settingsOf(m), media, qty]); // V4.2 (audit A13): the same request twice in a row asks for a second click
      if (sig === lastSig && Date.now() - lastAt < 10 * 60e3 && !armed) { armed = true; say('Es lo mismo que acabas de generar. Pulsa GENERAR otra vez para repetirlo, o cambia algo.', true); return; }
      armed = false; lastSig = sig; lastAt = Date.now();
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
      if (addMedia(picking, it.file)) { const r = picking; picking = null; renderSel(); learn(it.file, 'ref'); say(`Puesta en «${roleName(r)}».`); }
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
    if (a === 'cal' && ctx.toCalendar) { learn(it.file, 'calendario'); ctx.toCalendar(it.file, it.kind, it.prompt); } // Contenido opens (and the Estudio steps aside) with a new piece that carries this file
    if (a === 'usar' && pickFor) { const k = pickFor.ids.indexOf(it.file); if (k >= 0) pickFor.ids.splice(k, 1); else { pickFor.ids.push(it.file); learn(it.file, 'pieza'); } paintFor(); }
    if (a === 'edit') lightFile(it.file, { panel: 'edit' }); // V4.9: Editar opens the viewer with its small panel
    if (a === 'dept') lightFile(it.file, { panel: 'dept' });
    if (a === 'dimitri' && ctx.askDimitri) ctx.askDimitri([it.file]);
    if (a === 'move') { sel.clear(); sel.add(it.file); selecting = true; showPane('gal'); renderGrid(); $('.st-mv').focus(); say('Elige la carpeta en «Mover a…», arriba (o arrastra la imagen a una carpeta).'); }
    if (a === 'task' && it.task && ctx.openTask) { close(); ctx.openTask(it.task); } // V4.2 (audit A25)
  });
  el.addEventListener('change', e => {
    if (e.target.classList.contains('st-lang')) { store.set('lang', e.target.value); return; }

    if (e.target.classList.contains('st-file')) { const fs = [...e.target.files]; e.target.value = ''; e.target.accept = 'image/png,image/jpeg,image/webp,video/mp4,video/webm'; uploadFiles(fs, uploadRole); uploadRole = null; return; }
    if (e.target.matches?.('[data-msort], [data-mmaker]')) { store.set(e.target.hasAttribute('data-msort') ? 'msort' : 'mmaker', e.target.value); const qv = $('.st-mq input')?.value || ''; renderList(qv); $(e.target.hasAttribute('data-msort') ? '[data-msort]' : '[data-mmaker]')?.focus(); return; }
    const k = e.target.dataset?.set; if (k && cur()) { setSetting(k, e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value); estimate(); }
  });
  el.addEventListener('input', e => {
    if (e.target.classList.contains('st-prompt')) { clearFieldErr(); if (prevPrompt == null) $('.st-es').hidden = true; }
    if (e.target.closest('.st-mq')) { const v = e.target.value; renderList(v); const i = $('.st-mq input'); i.focus(); i.setSelectionRange(v.length, v.length); return; }
    if (e.target.type === 'range' && e.target.dataset.set && cur()) { const o = e.target.parentElement.querySelector('output'); if (o) o.textContent = e.target.value + (e.target.dataset.set === 'duration' ? ' s' : ''); setSetting(e.target.dataset.set, +e.target.value); }
    if (e.target.classList.contains('st-q')) { q = e.target.value; renderGrid(); return; }
    estimate();
  });
  // drop files: on a slot they go into it, anywhere else they are uploaded to the gallery
  el.addEventListener('dragover', e => { if (!dragFiles && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); el.classList.add('st-drop'); } });
  el.addEventListener('dragleave', e => { if (e.target === el || !el.contains(e.relatedTarget)) el.classList.remove('st-drop'); });
  el.addEventListener('drop', e => { if (dragFiles || !e.dataTransfer?.files?.length) return; e.preventDefault(); el.classList.remove('st-drop'); const slot = e.target.closest('.st-slot'); uploadFiles([...e.dataTransfer.files], slot ? slot.dataset.role : null); });
  el.addEventListener('paste', async e => { const fs = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type)); if (!fs.length) return; e.preventDefault(); const m = cur(); const role = m && m.roles.reference ? 'reference' : m && m.roles.start ? 'start' : null;
    const up = await uploadFiles(fs, role); if (!up.length) return;
    toast(`${up.length === 1 ? 'Imagen pegada' : up.length + ' imágenes pegadas'}${role ? ` como «${roleName(role)}»` : ' en Subidas'}.`, async () => { // V4.2 (audit A14): pasting no longer uploads silently
      for (const it of up) for (const r of Object.keys(media)) media[r] = media[r].filter(f => f !== it.file);
      await trashMany(up.map(it => it.file)); renderModel(); say('Deshecho: la imagen pegada se quitó.');
    }); });
  // a video card plays on hover
  el.addEventListener('mouseover', e => { const v = e.target.closest('.st-card .st-thumb')?.querySelector('video'); if (v && v.paused) v.play().catch(() => {}); });
  el.addEventListener('mouseout', e => { const t = e.target.closest('.st-card .st-thumb'); if (t && !t.contains(e.relatedTarget)) { const v = t.querySelector('video'); if (v) { v.pause(); } } });
  el.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (!typing && (e.key === '?' || (e.key === '/' && e.shiftKey))) return; // V4.2 (audit A48): the shortcuts sheet opens over the Estudio too
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && /^[epgonu,]$/i.test(e.key) && $('.st-light').hidden && $('.st-hist').hidden && $('.st-binov').hidden && !el.querySelector('.st-menu:not([hidden])')) return; // V4.5: the dock's keys reach the office — P and G switch views, O N U , open a window on top
    e.stopPropagation();
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && $('.st-light').hidden && $('.st-hist').hidden && $('.st-binov').hidden && !el.querySelector('.st-menu:not([hidden])')) { // V4.2 (audit A47)
      if (e.key === '/') { e.preventDefault(); showPane('gal'); $('.st-q').focus(); return; }
      if (e.key === 'i' || e.key === 'I') { setKind('image'); return; }
      if (e.key === 'v' || e.key === 'V') { setKind('video'); return; }
    }
    if (!$('.st-hist').hidden) { if (e.key === 'Escape') closeHist(); return; }
    if (!$('.st-binov').hidden) { if (e.key === 'Escape') closeBin(); return; }
    const om = el.querySelector('.st-menu:not([hidden])');
    if (om) { // the open «⋯» menu: arrows move, Esc and Tab close it, back on its button
      const its = [...om.querySelectorAll('[role="menuitem"]')].filter(x => x.offsetParent), i = its.indexOf(document.activeElement), btn = om.closest('.st-card')?.querySelector('.st-more');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]?.focus(); return; }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); its[e.key === 'Home' ? 0 : its.length - 1]?.focus(); return; }
      if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); closeMenus(); btn?.focus(); if (e.key === 'Escape') return; }
    }
    const inList = e.target.closest && e.target.closest('.st-mlist');
    if (inList && e.target.tagName !== 'SELECT' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { // V4.2 (audit A7): the model list moves with the arrows, like a real list
      const opts = [...inList.querySelectorAll('.st-mo:not([disabled])')], i = opts.indexOf(document.activeElement); e.preventDefault();
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? opts.length - 1 : i < 0 ? (e.key === 'ArrowDown' ? 0 : opts.length - 1) : Math.max(0, Math.min(opts.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      if (e.key === 'ArrowUp' && i === 0) inList.querySelector('input').focus(); else opts[n]?.focus();
      return;
    }
    if (!$('.st-light').hidden) { lightKey(e, typing); return; } // V4.9: + − 0 F, and the panel
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
    const agent = ok.find(fromBots);
    note.querySelector('span').textContent = `Estudio: ${parts.length ? `${parts.join(' y ')} ${img + vid === 1 ? 'lista' : 'listas'}${agent ? ` (de ${who(agent)})` : ''}` : ''}${parts.length && bad.length ? ' · ' : ''}${bad.length ? `${bad.length} no se ${bad.length === 1 ? 'pudo' : 'pudieron'}` : ''}.`;
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
  /* V4.7: «para la pieza» — the calendar opened the Estudio to make (or pick) the pictures of one piece */
  const forBar = $('.st-forpiece');
  function paintFor() {
    if (!pickFor) { forBar.hidden = true; forBar.innerHTML = ''; el.classList.remove('st-for'); if (typeof renderGrid === 'function') renderGrid(); return; }
    const n = pickFor.ids.length;
    forBar.hidden = false; el.classList.add('st-for');
    forBar.innerHTML = `<span>Para la pieza <b>«${esc(pickFor.target.titulo)}»</b> · ${n ? `${n} ${n === 1 ? 'elegida' : 'elegidas'}` : 'crea algo o elige de la galería y pulsa «Usar en la pieza»'}</span><span class="sp"></span><button type="button" data-f="back" class="pri">Volver a la pieza${n ? ` (${n})` : ''}</button><button type="button" data-f="no">Cancelar</button>`;
    renderGrid();
  }
  forBar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !pickFor) return; const p = pickFor; pickFor = null; paintFor();
    if (b.dataset.f === 'back') p.onPick(p.ids); else say('Sin cambios en la pieza.');
  });
  let timer = null;
  el.classList.toggle('st-folded', !!store.get('fold', false));
  const isOn = () => document.body.classList.contains('studioOpen'); // not el.hidden: that waits 220 ms for the fade after close
  let hideT = 0;
  function open() { if (isOn()) return; clearTimeout(hideT); views.opening('studio'); if (!store.get('subSeen', false)) setTimeout(() => store.set('subSeen', true), 1000); unseen = 0; setDock(); hideNote(); seenAt = Date.now(); opener = document.activeElement; el.hidden = false; modal.open(el); document.body.classList.add('studioOpen'); requestAnimationFrame(() => el.classList.add('on')); load(); timer = setInterval(() => { if (!busy && $('.st-light').hidden && $('.st-mlist').hidden) load({ full: false }); }, 20000); setTimeout(() => { if (document.body.classList.contains('studioOpen')) $('.st-prompt').focus(); }, 60); } // closed again before the timer: the focus must not land in a hidden window
  function close(o = {}) { if (!isOn()) return; if (pickFor) { pickFor = null; paintFor(); } seenAt = Date.now(); closeLight(); closeHist(); closeBin(); if (el.contains(document.activeElement)) document.activeElement.blur(); modal.close(el); el.classList.remove('on'); document.body.classList.remove('studioOpen'); clearInterval(timer); clearTimeout(jtimer); jtimer = null; picking = null; openList(false); hideT = setTimeout(() => { el.hidden = true; }, 220); if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  views.add('studio', { isOpen: isOn, close });
  return { open, close, toggle: () => (isOn() ? close() : open()), isOpen: isOn,
    /** V4.7: open the Estudio for one piece of content; `onPick(ids)` gets the gallery files chosen when the owner goes back to it. */
    forTarget(target, onPick) { pickFor = { target, onPick, ids: [] }; open(); showPane('gal'); paintFor(); },
    /** V4.9: what the owner is looking at, for Dimitri's «Viendo: …» — the picture in the viewer, the selected ones, the open folder, or nothing. */
    selection() {
      const it = !$('.st-light').hidden && lightAt ? itemOf(lightAt) : null; // the file the viewer shows, never shown()[lightIdx]: a job that ends while it is open reorders the gallery
      if (it) return { view: 'studio', label: `${it.kind === 'video' ? 'Video' : it.kind === 'audio' ? 'Audio' : 'Imagen'} «${short(it.prompt)}»`, kind: 'image', id: it.file };
      const ids = [...sel].filter(f => itemOf(f));
      if (ids.length) return { view: 'studio', label: `${ids.length} ${ids.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'} en el Estudio`, kind: 'images', ids };
      if (folders.some(f => f.id === folderF)) return { view: 'studio', label: `Carpeta «${folderName(folderF)}» del Estudio`, kind: 'folder', folder: folderF, folderName: folderName(folderF) };
      return { view: 'studio', label: 'Estudio · galería', kind: null };
    },
    /** V4.9: open the Estudio and its viewer on one file (a thumbnail in Dimitri's chat, a deliverable…). */
    async openFile(file) { open(); await load({ full: false }); showPane('gal'); if (!lightFile(file)) say('Ese archivo ya no está en la galería (¿en la papelera?).', true); } };
}

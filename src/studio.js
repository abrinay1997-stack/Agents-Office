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
import * as SV from './studio-voz.js'; // V5.0: voice and music (MiniMax) — the words, limits, voices and sound cards, as tested functions
import * as GF from './galeria-filtro.js';
import * as BR from './studio-borrador.js'; // 6 Oct 2026 (audit IMG-01/02): the composer's draft with DESHACER, and Variar as a request of its own
import * as AV from './studio-avisos.js';
import * as AC from './studio-acciones.js';
import * as CF from './studio-confirmar.js';
import * as CMP from './studio-comparar.js'; // 6 Oct 2026 (audit IMG-14): compare 2–4 pictures, or a version with its original
import { elegirAuto } from './studio-auto.js'; // 6 Oct 2026 (audit IMG-36): «Automático» in Básico picks the model by what is asked
import { ignorar as ignorarTecla } from './teclas1.js'; // IMG-26: single-key shortcuts can be turned off // 6 Oct 2026 (audit IMG-11): a spend is confirmed with a second click, not the browser's confirm() // 6 Oct 2026 (audit IMG-09/48): one list of what can be done with a file — card, «⋯», group card and viewer // 6 Oct 2026 (audit IMG-03): what the Estudio says when jobs end, with its plurals // Auditoría 1 oct 2026 (INF-03): the gallery's filters, the same on the server and here
import * as VC from './studio-clonar.js'; // 1 Oct 2026 (audit EST): cloning a voice as a guided flow — prices, script, meter, id, advice
// 1 Oct 2026 (banco de presets F1, F2): the bank and the Lotes tab live in their own modules; here only their hooks. They load on demand
// (INF-09: the page's budget): dist/estudio-extra.js comes the first time the Studio shows the image composer (its Presets step), or the
// bank, the 3D stage or Lotes is asked for — never with the office alone. Until then a stand-in with the same face
// (src/estudio-carga.js) says «Cargando…», or why it failed with «Reintentar»
import { initPaneles } from './studio-paneles.js';
import { bancoDiferido as initBanco, lotesDiferidos as initLotes } from './estudio-carga.js';
const LBL = { seed: 'Semilla (vacía = al azar; un número repite el resultado)', aspectRatio: 'Formato', resolution: 'Resolución', duration: 'Duración (segundos)', batchSize: 'Imágenes por pedido', enhancePrompt: 'Que el motor mejore el prompt', sound: 'Con sonido', cfgScale: 'Fidelidad al prompt', multiShots: 'Varias tomas', generateAudio: 'Con audio', outputFormat: 'Archivo', quality: 'Calidad', keepOriginalSound: 'Mantener el sonido del video', characterOrientation: 'Orientación del personaje',
  imageSize: 'Tamaño', mode: 'Modo', renderingSpeed: 'Velocidad', promptOptimizer: 'Que el motor mejore el prompt', promptExtend: 'Que el motor amplíe el prompt', cameraMovement: 'Movimiento de cámara', fps: 'Cuadros por segundo', genre: 'Género', era: 'Época', light: 'Luz', pacing: 'Ritmo', cameraModel: 'Cámara', cameraLens: 'Lente', cameraAperture: 'Apertura', colorPalette: 'Paleta de color', bitrateMode: 'Calidad del archivo',
  voiceId: 'Voz', emotion: 'Emoción', speed: 'Velocidad', vol: 'Volumen', pitch: 'Tono', format: 'Archivo', languageBoost: 'Reforzar el idioma', instrumental: 'Instrumental (sin voz)', sampleRate: 'Frecuencia de muestreo', bitrate: 'Calidad (bitrate)', channel: 'Canales', style: 'Estilo de la música', promptExpansion: 'Que el motor amplíe el prompt' }; // V5.0: MiniMax's voice and music // V4.4: the settings Higgsfield's own schemas bring
const CALIDAD = ['imageSize', 'resolution', 'quality', 'renderingSpeed']; // 6 Oct 2026: shown as buttons for a picture
const VAL = { '': 'El motor decide', auto: 'Auto', adaptive: 'Se adapta', low: 'Baja', medium: 'Media', high: 'Alta', xhigh: 'Muy alta', max: 'Máxima', standard: 'Estándar', video: 'la del video', image: 'la de la imagen', std: 'Estándar', pro: 'Pro', '4k': '4K', TURBO: 'Rápida', DEFAULT: 'Normal', QUALITY: 'Máxima calidad',
  epic: 'Épico', drama: 'Drama', noir: 'Noir', comedy: 'Comedia', horror: 'Terror', action: 'Acción', calm: 'Calmado', dynamic: 'Dinámico', chaotic: 'Caótico', 'single-shot': 'Un solo plano', static: 'Fija', dolly_in: 'Acercarse', dolly_out: 'Alejarse', dolly_left: 'A la izquierda', dolly_right: 'A la derecha', jib_up: 'Subir', jib_down: 'Bajar', focus_shift: 'Cambio de foco',
  happy: 'Alegre', sad: 'Triste', angry: 'Enfadada', fearful: 'Con miedo', disgusted: 'Con asco', surprised: 'Sorprendida', neutral: 'Neutra', fluent: 'Fluida', whisper: 'Susurro', mp3: 'MP3', wav: 'WAV', flac: 'FLAC', pcm: 'PCM', Spanish: 'Español', English: 'Inglés', Portuguese: 'Portugués', French: 'Francés', Italian: 'Italiano', German: 'Alemán' }; // V5.0
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
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>', note: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  anim: '<rect x="2.5" y="5" width="14" height="14" rx="3"/><path d="m7.8 9.3 4.4 2.7-4.4 2.7z"/><path d="M19 8.5v7M21.5 10.5v3"/>', // IMG-18: Animar has its own icon (the clapperboard is the Estudio and «Video»)
  panel: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16M15.5 9.5 13 12l2.5 2.5"/>', // IMG-51: fold the composer
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
  let pickFor = null; // { target: { id, titulo, para? }, onPick(ids), ids: [] } — para: 'anuncio' (Anuncios, A3) cambia las palabras
  const forW = () => (pickFor?.target?.para === 'anuncio' ? { en: 'en el anuncio', En: 'En el anuncio', a: 'al anuncio', para: 'Para el anuncio' } : { en: 'en la pieza', En: 'En la pieza', a: 'a la pieza', para: 'Para la pieza' });
  const el = document.createElement('div'); el.id = 'studioOv'; el.setAttribute('role', 'dialog'); el.setAttribute('data-view', ''); el.setAttribute('aria-labelledby', 'stTitle'); el.tabIndex = -1; el.hidden = true;
  el.innerHTML = `
    <div class="st-head">
      <span class="st-logo">${svg('vid')}</span><div><div class="st-name" id="stTitle">Estudio</div><div class="st-sub"${store.get('subSeen', false) ? ' hidden' : ''}>Imágenes y video reales. Sigue generando aunque cierres esta ventana; tus agentes también lo usan.</div></div>
      <div class="st-ptabs" role="tablist" aria-label="Estudio"><button type="button" role="tab" data-pt="gen" aria-selected="true">Crear<span class="st-ptg"> y galería</span></button><button type="button" role="tab" data-pt="gal" aria-selected="false">Galería <b class="st-ptn"></b></button><button type="button" role="tab" data-pt="lotes" aria-selected="false" title="Muchas fotos con la misma receta (L)">Lotes <b class="st-ptl"></b></button></div> <!-- IMG-23 (6 Oct 2026): the tabs share the header row -->
      <span class="sp"></span><button type="button" class="st-budget" aria-live="polite" title="Tus topes del Estudio: se cambian en Ajustes → Estudio"></button><button type="button" class="st-x" aria-label="Cerrar el Estudio" title="Cerrar (Esc)" data-tip="Cerrar (Esc)">${svg('x')}</button>
    </div>
    <div class="st-forpiece" hidden role="status"></div>
    <div class="st-body">
      <section class="st-gen" aria-label="Crear">
        <button type="button" class="st-unfold" title="Mostrar el compositor" aria-label="Mostrar el compositor">${svg('spark')}<span>Crear</span></button>
        <div class="st-scroll"><button type="button" class="st-fold" title="Plegar el compositor: más sitio para la galería" aria-label="Plegar el compositor">${svg('panel')}<span>Plegar</span></button>
          <div class="st-step st-s1"><div class="st-h"><b>1</b> ¿Qué quieres crear?</div>
            <div class="st-kind" role="group" aria-label="Tipo"><button type="button" data-kind="image" aria-pressed="false">${svg('img')}<span>Imagen</span></button><button type="button" data-kind="video" aria-pressed="false">${svg('vid')}<span>Video</span></button><button type="button" data-kind="audio" aria-pressed="false" title="Un texto leído en voz alta (MiniMax)">${svg('mic')}<span>Voz</span></button><button type="button" data-kind="music" aria-pressed="false" title="Una canción con letra o una pista instrumental (MiniMax)">${svg('note')}<span>Música</span></button></div>
            <div class="st-nivel" role="group" aria-label="Modo de imagen"><button type="button" data-nivel="basico" aria-pressed="true" title="Describe y genera: modelo, idea y formato">Básico</button><button type="button" data-nivel="avanzado" aria-pressed="false" title="Presets, tu foto, referencias y el escenario 3D (B)">Avanzado</button></div>
            <button type="button" class="st-vcta" hidden>${svg('mic')}<span><b>Clonar tu voz o diseñar una</b><small>Para que tus audios suenen como tú</small></span></button></div>
          <div class="st-step st-s2"><div class="st-h"><b>2</b> Modelo</div>
            <div class="st-mwrap"><button type="button" class="st-mpick" aria-haspopup="listbox" aria-expanded="false"></button><div class="st-mlist" hidden></div></div>
            <p class="st-mnote" hidden role="note"><b>Aviso:</b> MiniMax cerró su API de música a usuarios nuevos el 20 de agosto de 2026. Si tu cuenta no la tiene, el error lo dirá.</p></div>
          <div class="st-step st-s3"><div class="st-h"><b>3</b> <span class="st-p3t">Describe lo que quieres</span></div>
            <div class="st-modeseg" role="group" aria-label="Cuántas ideas"><button type="button" data-mode="one" aria-pressed="true">Una idea</button><button type="button" data-mode="batch" aria-pressed="false" title="Una idea por línea: cada línea es un pedido aparte">Varias ideas, una por línea</button></div>
            <div class="st-pwrap"><textarea class="st-prompt" rows="4" aria-label="Qué quieres crear"></textarea>
              <div class="st-ltags" hidden role="group" aria-label="Partes de la canción"><span>Marca las partes:</span>${SV.LYRIC_TAGS.map(t => `<button type="button" data-ltag="${t}" title="Añadir ${t} en una línea nueva">${t}</button>`).join('')}</div><div class="st-bcount" hidden></div><div class="st-ferr" hidden role="alert"></div><div class="st-prow"><button type="button" class="st-enh" title="Claude lo reescribe como un prompt de producción">${svg('spark')}<span>Mejorar el prompt</span></button><select class="st-lang" aria-label="Idioma del prompt mejorado" title="En inglés los motores suelen entenderlo mejor; te muestro la traducción debajo"><option value="en">en inglés</option><option value="es">en español</option></select><button type="button" class="st-undo-enh" hidden>Volver al mío</button><button type="button" class="st-addimg" title="Añade una imagen de referencia: tu producto, tu logo, un estilo (o suéltala aquí)">${svg('up')}<span>Imagen</span></button><span class="sp"></span><span class="st-plen"></span><span class="st-kbh" title="Ctrl + Enter genera">Ctrl+Enter</span><button type="button" class="st-new" title="Vacía la idea y el material de partida (con DESHACER)">Vaciar</button></div>
              <div class="st-es" hidden><b>En español:</b> <span></span></div>
              <div class="st-sug" hidden role="status"><b>Propuesta:</b> <span class="st-sugt"></span><span class="st-sugb"><button type="button" data-sug="usar" class="pri">Usar esta</button><button type="button" data-sug="no">Seguir con la mía</button></span></div></div></div>
          <div class="st-step st-matstep"><div class="st-h"><b>4</b> <span class="st-mt">Material de partida</span> <span class="st-hn">opcional</span></div><div class="st-slots"></div></div>
          <div class="st-step st-s5"><div class="st-h"><b class="st-n5">5</b> <span class="st-s5t">Formato y ajustes</span></div><div class="st-ratios"></div><div class="st-sets"></div><div class="st-bchips" role="group" aria-label="Cantidad"><div class="st-lab" id="stQnL">Cantidad</div><div class="st-qch st-qn" role="radiogroup" aria-labelledby="stQnL"></div></div>
            <details class="st-more"><summary>Más ajustes</summary><div class="st-sets2"></div></details>
            <div class="st-plant" role="group" aria-label="Plantillas"><label class="st-lab">Plantilla<select class="st-plsel"></select></label><button type="button" class="st-plsave" title="Guarda el modelo, el formato y los ajustes, la cantidad, la idea y las imágenes de referencia como una plantilla (una nota del Cerebro)">Guardar como plantilla…</button><button type="button" class="st-pldel" hidden data-tip="Borrar la plantilla elegida" aria-label="Borrar la plantilla elegida">${svg('trash')}</button>
              <div class="st-plform" hidden><input type="text" class="st-plname" maxlength="48" aria-label="Nombre de la plantilla" placeholder="Nombre, p. ej. Catálogo 4:5"><button type="button" class="st-plok pri">Guardar</button><button type="button" class="st-plno">Cancelar</button></div></div></div>
        </div>
        <div class="st-foot">
          <div class="st-qty" role="group" aria-label="Cantidad"><span>Cantidad</span><button type="button" data-d="-1" aria-label="Menos">−</button><output class="st-n">1</output><button type="button" data-d="1" aria-label="Más">+</button></div>
          <button type="button" class="st-go" title="Generar (Ctrl + Enter desde la idea)" aria-keyshortcuts="Control+Enter">GENERAR</button>
          <button type="button" class="st-sum" title="Cambiar el formato y los ajustes"></button>
          <div class="st-est"></div>
          <div class="st-refwarn" hidden role="status"><span></span><button type="button" data-refpass>Pasarlas a «Referencias»</button></div>
          <div class="st-keyhelp" hidden role="alert"></div>
          <div class="st-msg" aria-live="polite"></div>
        </div>
      </section>
      <section class="st-gal" aria-label="Galería">
        <div class="st-filt">
          <label class="st-fwrap"><span>Mostrar</span><select class="st-fsel" aria-label="Mostrar en la galería"><option value="all">Todo</option><option value="fav">Favoritas</option><option value="you">Tuyas</option><option value="agent">De agentes</option><option value="video">Videos</option><option value="voice">Voz</option><option value="music">Música</option><option value="up">Subidas</option></select></label>
          <div class="st-folders" role="toolbar" aria-label="Carpetas: arrastra imágenes a una carpeta para guardarlas ahí"></div>
          <label class="st-qwrap">${svg('search')}<input type="search" class="st-q" placeholder="Buscar…" aria-label="Buscar en la galería"></label>
          <button type="button" class="st-upbtn" title="Sube tus fotos o videos (producto, logo, personaje) para usarlos de referencia o animarlos" aria-label="Subir" data-tip="Subir">${svg('up')}<span>Subir</span></button>
          <button type="button" class="st-selbtn" aria-pressed="false" title="Elegir varias para descargarlas juntas, marcarlas o borrarlas" aria-label="Seleccionar" data-tip="Seleccionar">${svg('grid')}<span>Seleccionar</span></button>
          <details class="st-gmas"><summary aria-label="Más: historial, papelera, motores" title="Historial, Papelera y Motores" data-tip="Historial, Papelera, Motores">${svg('dots')}</summary><div class="st-gmasl">
            <button type="button" class="st-histbtn" title="Todos los trabajos de la última semana: hechos, fallados y cancelados, con el motivo">${svg('again')}<span>Historial</span></button>
            <button type="button" class="st-binbtn" title="Lo que mandaste a la papelera: vuelve con un clic durante 30 días">${svg('trash')}<span>Papelera</span></button>
            <button type="button" class="st-engbtn" title="Qué motores están listos y cómo activar los demás">${svg('spark')}<span>Motores y keys</span></button></div></details>
        </div>
        <div class="st-selbar" hidden><b class="st-seln"></b><button type="button" data-b="all">Todas las visibles</button><button type="button" data-b="clear">Ninguna</button><button type="button" data-b="fav">${svg('star')} Favoritas</button><button type="button" data-b="zip">${svg('down')} Descargar ZIP</button><label class="st-mvw">${svg('folder')}<select class="st-mv" aria-label="Mover las seleccionadas a una carpeta"></select></label><button type="button" data-b="del">${svg('trash')} Papelera</button><button type="button" data-b="cmp" title="Ver de 2 a 4 imágenes lado a lado; con dos, una cortina para el antes y el después">Comparar</button><button type="button" data-b="lote" title="Aplicar la misma receta a todas las seleccionadas, con su costo antes de gastar (L)">${svg('grid')} Editar en lote…</button><span class="sp"></span><button type="button" data-b="none">Listo</button></div>
        <div class="st-picking" hidden></div>
        <div class="st-count" aria-live="polite"></div>
        <div class="st-grid"></div>
      </section>
    </div>
    <div class="st-lotes" hidden></div>
    <div class="st-light" hidden role="dialog" aria-modal="true" aria-label="Vista ampliada"></div>
    <div class="st-hist" hidden role="dialog" aria-modal="true" aria-labelledby="stHistT"></div>
    <div class="st-hist st-binov" hidden role="dialog" aria-modal="true" aria-labelledby="stBinT"></div>
    <div class="st-hist st-vocov" hidden role="dialog" aria-modal="true" aria-labelledby="stVocT"></div>
    <div class="st-hist st-cmpov" hidden role="dialog" aria-modal="true" aria-labelledby="stCmpT"></div>
    <div class="st-hist st-engov" hidden role="dialog" aria-modal="true" aria-labelledby="stEngT"><div class="st-hbox"><div class="st-hhead"><h2 id="stEngT">Motores y keys</h2><span class="sp"></span><button type="button" class="st-hx" aria-label="Cerrar">${svg('x')}</button></div>
      <p class="st-hsub">Cada motor se enciende con su key, guardada en Windows una sola vez. Lo que ya está listo sale con ●.</p><div class="st-engs"></div>
      <p class="st-hsub">La key se guarda en Windows una sola vez (con el comando de su línea en una ventana de comandos, o en «Editar las variables de entorno de esta cuenta») y se reinicia la oficina con el iniciador. Nunca va en un archivo. Pon también un límite de gasto en la web de cada servicio.</p>
      <p class="st-hsub">El tope de generaciones al día y el gasto máximo (del día y del mes) se cambian en <button type="button" class="st-lk" data-open="settings">Ajustes → Estudio</button> (un video cuenta como 5 imágenes).</p></div></div>
    <div class="st-toast" hidden role="status"><span></span><button type="button">DESHACER</button><button type="button" class="st-tback" hidden>VOLVER A LA IMAGEN</button></div>
    <input type="file" class="st-file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.m4a" multiple hidden>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  let items = [], models = [], engines = [], budget = null, jobs = [], def = {}, loadErr = '', catalogSig = '';
  // INF-03: `items` is what is loaded of the view (filter · folder · search), page by page, never the whole gallery. The server
  // searches, filters and counts over everything: `total` is how many match, `counts` the tabs and «Sin carpeta» over the whole
  // gallery, `nextCur` the cursor of the next page. `known` keeps every record seen, so a reference, a version or a selection
  // outside the loaded pages is still found. `gone`: files sent to the bin here (a reference to them is dropped).
  const PAGE = 120; let total = 0, counts = null, nextCur = null, loadedKey = null, moreBusy = false, audioPool = []; const known = new Map(), gone = new Set(), jumped = new Map(); // jumped (file → its place in the view): an old file opened from afar (Ctrl+K), placed at the end before the pages between reach it
  const remember = l => { for (const it of l) if (it && it.file) known.set(it.file, it); return l; };
  let voices = { mine: [], system: [] }; // V5.0: the owner's MiniMax voices and the system's, for the voice picker (from /api/media, refreshed by the Voces panel)
  let editModels = [], editBlock = null, depts = []; // V4.9: the models that edit a picture (on), the engines to switch on when none is (a 409 says which), the departments a picture can be sent to
  // V4.6 (27 Sep 2026, the owner): folders — labels on each file (nothing moves on disk); drag pictures onto one, rename it, remove it
  let folders = [], folderF = store.get('folder', 'all'), dragFiles = null, fdEdit = null, fdNewFor = null; // fdEdit: 'new' or a folder id being renamed · fdNewFor: files waiting for the new folder
  const folderName = id => (folders.find(f => f.id === id) || {}).name || '';
  const inFolder = it => (it.folder && folders.some(f => f.id === it.folder) ? it.folder : null);
  let lastSig = '', lastAt = 0, armed = false, verMasFormatos = false;
  const nuevos = new Set(); let nuevosT = 0; // IMG-07: the files that just came out, marked «Nuevo» for a few seconds
  let kind = store.get('kind', 'image'), mode = 'one', filter = 'all', q = '', sel = new Set(), selecting = false, lastPick = -1, picking = null, uploadRole = null, busy = false, opener = null, lightIdx = -1, lightAt = null, lightFrom = null, prevPrompt = null, qty = 1;
  let nivel = store.get('modo', 'basico') === 'avanzado' ? 'avanzado' : 'basico'; // 2 Oct 2026: images in Básico (the plain composer) or Avanzado (presets and the 3D stage)
  const modelOf = { image: store.get('model.image', ''), video: store.get('model.video', ''), audio: store.get('model.audio', ''), music: store.get('model.music', '') };
  if (!SV.KINDS.includes(kind)) kind = 'image';
  $('.st-lang').value = store.get('lang', 'en') === 'es' ? 'es' : 'en';
  const setsOf = store.get('sets', {}); // model id → its settings
  let media = { start: [], end: [], reference: [], video: [] };
  let banco = null; // banco de presets (F1): src/studio-banco.js, created once the composer exists (below)
  let lotesUI = null; // banco de presets (F2): src/studio-lotes.js, the Lotes tab (below)

  // IMG-36 (6 Oct 2026): in Básico, «Automático» (on by default) picks the image model by what is asked; the owner's own choice stays in modelOf
  let auto = store.get('auto.image', true), autoSel = null;
  const basico = () => kind === 'image' && nivel === 'basico';
  const autoOn = () => basico() && auto && !!autoSel;
  const cur = () => models.find(m => m.id === (kind === 'image' && autoOn() ? autoSel.id : modelOf[kind])) || null;
  /** Picks the automatic model again; true when it changed. `masRefs`: an image is about to be added. */
  function aplicarAuto(masRefs = 0) {
    if (!basico() || !auto) return false;
    const prev = autoSel && autoSel.id; autoSel = elegirAuto(models, { refs: (media.reference || []).length + masRefs, prompt: $('.st-prompt').value, def: def.image });
    return (autoSel && autoSel.id) !== prev;
  }
  const roleName = r => ROLE[r];
  const roleHelp = (r, m = cur()) => helpFor(r, m);
  const itemOf = f => items.find(x => x.file === f) || known.get(f);
  // V4.9: who made it — the owner, an agent, or Dimitri (the plan the owner OK'd); «De agentes» shows the agents' and Dimitri's
  const fromBots = x => x.by === 'agent' || x.by === 'dimitri';
  const who = x => (x.by === 'agent' ? agentName(x.agent) || 'agente' : x.by === 'dimitri' ? 'Dimitri' : 'tú');
  // V4.9: what was used is what was liked — a reference, a piece, the calendar teach the office's memory (it never blocks the action)
  const learn = (file, used) => { if (isLive() && location.protocol.startsWith('http')) api('PATCH', '/api/media/item/' + encodeURIComponent(file), { used }).catch(() => {}); };
  // the address carries the file's own moment (?v=): a picture never shows another one that once had its name (the browser keeps them a day)
  const src = it => { const f = String(it.file || it), x = typeof it === 'object' && it.at ? it : itemOf(f); return '/media/' + f.split('/').map(encodeURIComponent).join('/') + (x && x.at ? '?v=' + x.at : ''); };
  const isVid = f => /\.(mp4|webm)$/i.test(f);
  const sound = () => SV.SOUND(kind); // V5.0: the composer makes a voice or a song
  const mmxOn = () => !!(engines.find(e => e.id === 'minimax') || {}).on;
  const offModel = (k = kind) => models.find(m => m.kind === k && !m.on) || null; // a model of this kind whose engine has no key yet: shown dimmed, with how to switch it on
  const ar = r => (r && /^\d+:\d+$/.test(r) ? r.replace(':', ' / ') : '');
  const dlName = it => { const d = new Date(it.at || Date.now()), ext = String(it.file).split('.').pop(); return `${String(it.prompt || 'estudio').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'estudio'}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.${ext}`; }; // V4.2 (audit A37)
  const ratioOf = it => (it.w && it.h ? `${it.w} / ${it.h}` : ar(it.ratio) || '');
  function fieldErr(where, text) { // V4.2 (audit A4): the field that is missing lights up and says so, in view — not a red line at the foot
    const step = where === 'slot' ? $('.st-matstep') : $('.st-prompt').closest('.st-step');
    step.classList.add('st-need'); step.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (where === 'slot') { const sl = el.querySelector('.st-slot.need') || el.querySelector('.st-slot'), b = sl && sl.querySelector('button'); $('.st-msg').id = 'stMsg'; if (b) { b.setAttribute('aria-describedby', 'stMsg'); b.focus({ preventScroll: true }); } say(text, true); } // IMG-25: the button that fixes it carries the reason
    else { const fe = $('.st-ferr'); fe.id = 'stFerr'; fe.textContent = text; fe.hidden = false; const pr = $('.st-prompt'); pr.setAttribute('aria-invalid', 'true'); pr.setAttribute('aria-describedby', 'stFerr'); pr.focus({ preventScroll: true }); say(''); } // IMG-25
    showPane('gen');
  }
  function clearFieldErr() { el.querySelectorAll('.st-need').forEach(n => n.classList.remove('st-need')); $('.st-ferr').hidden = true; const pr = $('.st-prompt'); pr.removeAttribute('aria-invalid'); pr.removeAttribute('aria-describedby'); }
  const say = (t, bad) => { $('.st-msg').textContent = t; $('.st-msg').className = 'st-msg' + (bad ? ' bad' : ''); };
  const fmtDur = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const api = async (method, url, body) => { const r = await fetch(url, body === undefined ? { method } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
  const price = m => SV.priceText(m); // V5.0: per image, video, audio, song, second or 1000 characters
  const tags = m => [m.roles.reference && (m.kind === 'image' ? 'Edita o combina imágenes' : 'Referencias'), m.kind === 'video' && m.roles.start && 'Anima una imagen', m.kind === 'video' && m.roles.end && 'Fotograma final', m.roles.video && 'Parte de un video',
    (m.settings.sound || m.settings.generateAudio) && 'Sonido', /texto/i.test(m.note) && 'Texto legible', m.cost && m.cost < 0.012 && m.per !== 's' && 'Muy barato'].filter(Boolean);

  /* ---------- banco de presets (F1, docs/propuesta-banco-presets.md §7): a step of the composer and a sheet over the gallery ---------- */
  banco = initBanco({ esc, api, src: f => src(f), live: () => isLive() && location.protocol.startsWith('http'), say,
    pick: (label, take) => { picking = { label, take }; renderSel(); showPane('gal'); say(`${label}: haz clic en una imagen de la galería.`); },
    subir: files => uploadFiles(files, null), idea: () => $('.st-prompt').value.trim(), n: () => qty, onState: () => bancoState(),
    abrirArchivo: f => lightFile(f), mostrarGaleria: () => { if (phone()) showPane('gal'); },
    confirmar: c => okCosto(c, 'banco'), // IMG-11: the presets spend through the same gate
    trabajos: (js, b) => { jobs.unshift(...js); if (b) budget = b; renderHead(); renderGrid(); watch(); }, recargar: () => load({ full: false }),
    pedirDimitri: ctx.askDimitri ? () => ctx.askDimitri([]) : null,
    // the model and the format are always the composer's (2 Oct 2026): the bank reads them and never picks them
    modelo: () => modelOf[kind] || '', proporcion: () => ratioNow(), kind: () => kind,
    material: () => JSON.parse(JSON.stringify(media)), usarModelo: id => { modelOf[kind] = id; store.set('model.' + kind, id); renderModels(); }, // F5: video uses step 4
    elegir: r => { const m = cur(); if (!(m && m.roles[r] > 0)) return say(`${m ? m.name : 'Ese modelo'} no toma «${roleName(r)}»: elige otro en el paso 2.`, true); picking = r; renderSel(); showPane('gal'); },
    ajustes: () => { const m = cur(); return m && { id: m.id, name: m.name, settings: m.settings, valores: settingsOf(m) }; }, ponerAjustes: o => { for (const k in o) setSetting(k, o[k]); renderModel(); }, // F6: Voz and Música quick cards
    setProporcion: v => { const m = cur(), vals = m?.settings.aspectRatio?.values || []; if (vals.includes(v)) { setSetting('aspectRatio', v); renderModel(); } else { say(m ? `${m.name} no hace ${v}: el cuadro se queda en el de «Formato y ajustes».` : 'Elige antes un modelo.', true); banco.replan(); } } });
  $('.st-mwrap').closest('.st-step').after(banco.el); $('.st-gal').appendChild(banco.sheet);
  // IMG-42 (6 Oct 2026): with room, the bank's sheet is a panel beside the gallery, not over it — the class says when it is open
  $('.st-plname').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); guardarPlantilla(e.target.value); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); $('.st-plform').hidden = true; $('.st-plsave').focus(); } }); // IMG-46
  new MutationObserver(() => el.classList.toggle('st-hoja', !!el.querySelector('.st-gal > .st-bank:not([hidden])'))).observe($('.st-gal'), { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true });
  initPaneles({ el, store }); // 6 Oct 2026 (the owner): both side panels widen by dragging their edge; the right one hides or fills the window
  /* ---------- lotes (F2, §6 y §7.4): many photos with the same recipe, in their own tab. Nothing is spent until PROBAR or GENERAR there ---------- */
  const esImg = f => /\.(png|jpe?g|webp)$/i.test(String(f));
  lotesUI = initLotes($('.st-lotes'), { esc, api, say, live: () => isLive() && location.protocol.startsWith('http'), src: f => src(f),
    carpetas: () => folders.map(f => ({ id: f.id, name: f.name, n: f.n ?? items.filter(it => it.folder === f.id).length })),
    seleccion: () => [...sel].filter(esImg), subir: async files => (await uploadFiles(files, null)).map(it => it.file).filter(esImg),
    compositor: () => banco.estado(), modelos: () => models.filter(m => m.on && m.kind === 'image' && m.roles?.reference).map(m => ({ id: m.id, name: m.name, cost: m.cost })),
    abrirArchivo: f => lightFile(f),
    onCambio: c => { const b = $('.st-ptl'); if (b) { const n = c.activos + c.espera; b.textContent = n ? String(n) : ''; b.title = n ? `${c.activos} en marcha${c.espera ? ` · ${c.espera} esperan tu OK` : ''}${c.revisar ? ` · ${c.revisar} fotos para revisar` : ''}` : ''; } } });
  addEventListener('ao:ver-lote', e => { const id = e.detail && e.detail.id; if (!id) return; open(); showPane('lotes'); lotesUI?.seguir(id); }); // F3: «Ver el lote» on Dimitri's card
  /** «Editar en lote…» in the selection bar: the Lotes tab, with these photos as its first step done (§6.1). */
  function editarEnLote(files) {
    const ids = files.filter(esImg);
    if (!ids.length) { say('Para un lote, selecciona fotos (PNG, JPG o WEBP).', true); return; }
    if (ids.length < files.length) say(`${files.length - ids.length} de las seleccionadas no son fotos: el lote lleva las ${ids.length} que sí.`);
    showPane('lotes'); lotesUI.nuevo({ tipo: 'seleccion', files: ids });
  }
  /** The chosen format, when it is a ratio (the bank and the 3D stage follow it). */
  function ratioNow() { const m = cur(), v = m && m.settings.aspectRatio ? String(settingsOf(m).aspectRatio || '') : ''; return /^\d+(\.\d+)?:\d+$/.test(v) ? v : null; }
  /** Avanzado shows the bank's step; with presets in it, GENERAR is the bank's (its plan and its cost), with the model and the format still yours. */
  const VB = () => kind === 'image' || kind === 'video'; // F5: the bank serves images and video (Avanzado); Voz and Música get its quick cards
  const avanzado = () => VB() && nivel === 'avanzado';
  const bancoManda = () => !!banco && avanzado() && banco.activo();
  function bancoState() {
    if (!banco) return;
    const av = avanzado(), on = av && banco.activo();
    const nv = $('.st-nivel'); nv.hidden = !VB(); nv.querySelectorAll('[data-nivel]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nivel === nivel)));
    banco.el.hidden = !av && !sound(); if (!av) banco.cerrar(false);
    if ((av || sound()) && document.body.classList.contains('studioOpen')) banco.preparar(); // Avanzado shows the bank's step: it comes now (once); Básico never loads it
    const im = kind === 'image'; el.classList.toggle('st-banco-on', on && im); el.classList.toggle('st-avz', av && im); // in video the bank uses the composer's own material (step 4)
    if (av && media.reference.length) { const ok = banco.anadirRefs(media.reference.slice()); if (ok.length) { media.reference = media.reference.filter(f => !ok.includes(f)); renderModel(); } } // IMG-39 (Fase 6): in Avanzado, the references live in «Tu foto · Referencias»; what does not fit stays in sight
    el.classList.toggle('st-basico', basico()); if (basico() && mode !== 'one') setMode('one'); // IMG-32: Básico is the plain composer — one idea, the format and the quantity as selects
    const refs = on && im ? media.reference.length : 0, W = $('.st-refwarn'); // IMG-39: with presets, the composer's references are not used — said, with the way to pass them over
    W.hidden = !refs; if (refs) W.querySelector('span').textContent = `${refs === 1 ? 'Tu referencia del paso «Imágenes de referencia» no se usa' : `Tus ${refs} referencias del paso «Imágenes de referencia» no se usan`} con presets.`;
    if (!on) { $('.st-n5').textContent = $('.st-matstep').hidden ? '4' : '5'; return; }
    if (im) $('.st-n5').textContent = '4'; // the step «Imágenes de referencia» is hidden with presets: the numbers go on without a gap
    const err = banco.error ? banco.error() : '', bl = banco.bloqueado ? banco.bloqueado() : '';
    $('.st-n').textContent = qty; $('.st-p3t').textContent = 'Opcional: algo más para la IA';
    $('.st-est').textContent = err || `Con presets · ${banco.costo()}`; $('.st-est').classList.toggle('over', !!err);
    const go = $('.st-go'); go.textContent = bl || 'GENERAR'; go.classList.toggle('st-go-falta', !!bl); // IMG-41: the button says what is missing; its click takes you there
    $('.st-est').id = 'stEst'; if (bl) go.setAttribute('aria-describedby', 'stEst'); else go.removeAttribute('aria-describedby'); // not aria-disabled: the click works — it takes you to what is missing
  }
  function setNivel(v) { if (v === nivel || !['basico', 'avanzado'].includes(v)) return; nivel = v; store.set('modo', v); if (v === 'basico' && picking && typeof picking === 'object') { picking = null; renderSel(); } /* a pick for the bank's photo ends with Avanzado */ if (v === 'basico' && banco) { const back = banco.vaciarMaterial(); if (back.length) media.reference = [...new Set([...media.reference, ...back])]; } bancoState(); renderModel(); } // IMG-39: nothing is left behind when the level changes

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
    pickModel(); aplicarAuto(); pintarPlantillas();
    el.querySelectorAll('[data-kind]').forEach(b => { const on = b.dataset.kind === kind; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    renderPick(); renderModel(); bancoState();
  }
  function renderPick() {
    const m = cur(), b = $('.st-mpick');
    b.innerHTML = m ? `<span class="st-mp-top"><span class="st-mp-name">${autoOn() ? `Automático · ${esc(m.name)}` : esc(m.name)}</span>${engineAdds(m) ? `<span class="st-mp-eng">${esc(m.engineName)}</span>` : ''}<span class="sp"></span><span class="st-mp-cost">${price(m)}</span><span class="st-mp-caret" aria-hidden="true">▾</span></span>${autoOn() ? `<span class="st-mp-why">Elegido porque ${esc(autoSel.porque)}. Cambia con «▾».</span>` : ''}${m.note ? `<span class="st-mp-note">${esc(m.note)}</span>` : ''}${tags(m).length ? `<span class="st-tags">${tags(m).map(t => `<i>${t}</i>`).join('')}</span>` : ''}`
      : offModel() ? offPick(offModel()) // V5.0: Voz and Música show their model even without the key — dimmed, with how to switch it on
      : `<span class="st-mp-top"><span class="st-mp-name">Ningún modelo de ${SV.words(kind).none} encendido</span><span class="sp"></span><span class="st-mp-caret">▾</span></span><span class="st-mp-note">Mira «Motores y keys» en el «⋯» de la galería.</span>`;
    b.classList.toggle('st-mp-off', !m && !!offModel());
  }
  function offPick(o) {
    const e = engines.find(x => x.id === o.engine) || {};
    return `<span class="st-mp-top"><span class="st-mp-name">${esc(o.name)}</span><span class="st-mp-eng">${esc(o.engineName || e.name || '')} · sin activar</span><span class="sp"></span><span class="st-mp-cost">${price(o)}</span><span class="st-mp-caret" aria-hidden="true">▾</span></span><span class="st-mp-note">Para activarlo: ${e.site ? `crea la key en <b>${esc(e.site)}</b>, ` : ''}pega <code>${esc(e.how || '')}</code> en una ventana de comandos y reinicia la oficina.</span>`;
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
        (n => n ? `<details class="st-moff"><summary>Ver los ${n} sin activar</summary>` : '')(mine.filter(x => !x.on).length) + engs.filter(e => !e.on).map(e => `<div class="st-mg off" role="group" aria-label="${esc(e.name)}, sin activar"><div class="st-mg-h">${esc(e.name)} <span class="st-mg-off">sin activar</span></div>${how(e)}${mine.filter(x => x.engine === e.id).map(row).join('')}</div>`).join('') + (mine.some(x => !x.on) ? '</details>' : '');
    } else if (sort === 'maker') {
      const ms = [...new Set(mine.slice().sort(cmp).map(x => x.maker))];
      body = ms.map(mk => { const l = mine.filter(x => x.maker === mk).sort((a, b) => (b.on - a.on) || cmp(a, b)); return `<div class="st-mg" role="group" aria-label="${esc(mk)}"><div class="st-mg-h" aria-hidden="true">${esc(mk)} <span class="st-mg-n">${l.length}</span></div>${l.map(row).join('')}</div>`; }).join('');
    } else {
      const on = mine.filter(x => x.on).sort(cmp), off = mine.filter(x => !x.on).sort(cmp);
      body = (on.length ? `<div class="st-mg" role="group" aria-label="Listos"><div class="st-mg-h" aria-hidden="true">Listos para usar <span class="ok">● ${on.length}</span></div>${on.map(row).join('')}</div>` : '') +
        (off.length ? `<details class="st-moff"><summary>Ver los ${off.length} sin activar</summary><div class="st-mg off" role="group" aria-label="Sin activar"><div class="st-mg-h">Sin activar <span class="st-mg-off">${off.length} · su motor necesita una key</span></div>${off.map(row).join('')}</div></details>` : '');
    }
    L.innerHTML = `<label class="st-mq">${svg('search')}<input type="search" placeholder="Buscar modelo, creador o uso…" aria-label="Buscar modelo" value="${esc(qs)}"></label>` +
      `<div class="st-mctl"><label>Ordenar<select data-msort aria-label="Ordenar los modelos">${SORTS.map(([k, t]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${t}</option>`).join('')}</select></label><label>Creador<select data-mmaker aria-label="Filtrar por creador"><option value="">Todos (${all.length})</option>${makers.map(mk => `<option${mk === maker ? ' selected' : ''}>${esc(mk)}</option>`).join('')}</select></label></div>` +
      `<div role="listbox" aria-label="Modelos">${basico() && !w ? `<div class="st-mg" role="group" aria-label="Automático"><button type="button" role="option" class="st-mo st-moauto${auto ? ' on' : ''}" data-id="auto" aria-selected="${auto}" tabindex="-1"><span class="st-mo-top"><b>Automático (recomendado)</b></span><span class="st-mo-note">La oficina elige por lo que pides: con una imagen tuya, uno que edita; con texto que se tiene que leer, uno que lo escribe bien; si no, el de uso general. Siempre dice cuál usó.</span></button></div>` : ''}${body}</div>` + (mine.length ? '' : '<div class="st-empty-s">Ningún modelo con eso.</div>');
  }
  function openList(on) {
    const L = $('.st-mlist'), b = $('.st-mpick');
    if (on === undefined) on = L.hidden;
    L.hidden = !on; b.setAttribute('aria-expanded', on); b.hidden = on; // V4.2 (audit A8): the list takes the card's place — the chosen model is marked in it, not shown twice
    if (on) { renderList(); setTimeout(() => L.querySelector('input').focus(), 20); }
  }
  /** V5.0: step 3 says what goes in it — the idea, the text a voice reads, a song's lyrics or (instrumental) its description — and counts against the model's limit. */
  function paintStep3() {
    const m = cur(), inst = !!(m && settingsOf(m).instrumental), st = SV.promptStep(kind, inst), snd = sound();
    $('.st-p3t').textContent = st.title;
    if (snd) { $('.st-prompt').placeholder = st.placeholder; $('.st-prompt').setAttribute('aria-label', st.label); } else $('.st-prompt').setAttribute('aria-label', 'Qué quieres crear');
    $('.st-modeseg').hidden = snd; $('.st-vcta').hidden = kind !== 'audio'; // EST-14: the way to a voice of one's own, where Voz is chosen
    $('.st-ltags').hidden = !(kind === 'music' && !inst);
    $('.st-mnote').hidden = kind !== 'music';
    const noEnh = kind === 'audio'; // a voice reads the text as it is written: nothing to «improve»
    $('.st-enh').hidden = noEnh; $('.st-lang').hidden = noEnh; if (noEnh) { $('.st-undo-enh').hidden = true; $('.st-es').hidden = true; }
    $('.st-s5t').textContent = kind === 'audio' ? 'Voz y ajustes' : kind === 'music' ? 'Ajustes' : 'Formato y ajustes';
  }
  const limitNow = () => { const m = cur(); return SV.textLimit(m, kind, !!(m && settingsOf(m).instrumental)); };
  function renderModel() {
    if (aplicarAuto()) renderPick(); // IMG-36: the references just changed, so may the automatic model
    const m = cur();
    paintStep3();
    if (!sound()) $('.st-prompt').placeholder = mode === 'batch' ? 'Una idea por línea — cada línea genera «Cantidad» archivos. Ej.: los 12 fondos del mes de Instagram.' : kind === 'video' ? (media.start.length ? 'Describe el movimiento: la cámara se acerca despacio, el vapor sube, luz de tarde…' : 'Qué pasa en el video: sujeto, acción, cámara, luz, estilo. Para animar una imagen, pulsa Animar sobre ella en la galería.') : 'Ej.: fondo oscuro de roca volcánica con brillo naranja #FF5100, espacio limpio abajo para el texto';
    if (!m) { $('.st-slots').innerHTML = ''; $('.st-matstep').hidden = true; $('.st-ratios').innerHTML = ''; $('.st-sets').innerHTML = ''; $('.st-sets2').innerHTML = ''; $('.st-more').hidden = true; estimate(); return; }
    for (const r of Object.keys(media)) media[r] = media[r].slice(0, m.roles[r] || 0); // what no longer fits this model is dropped
    const roles = Object.entries(m.roles).filter(([r, n]) => n > 0 && ROLE[r]);
    $('.st-matstep').hidden = !roles.length; $('.st-n5').textContent = roles.length ? '5' : '4'; // the steps count on without a gap
    $('.st-matstep .st-hn').textContent = (m.needs || []).length ? 'obligatorio' : 'opcional';
    $('.st-mt').textContent = m.kind === 'image' ? 'Imágenes de referencia' : roles.some(([r]) => r === 'start' || r === 'end') ? 'Fotogramas y material' : 'Material de partida'; // the title says what this model takes
    $('.st-slots').innerHTML = roles.map(([r, n]) => `<div class="st-slot${(m.needs || []).includes(r) && !media[r].length ? ' need' : ''}" data-role="${r}">
        <div class="st-slot-h"><b>${roleName(r, m)}</b> <span>${roleHelp(r, m)}${n > 1 ? ` · ${media[r].length} de ${n}` : ''}</span></div>
        <div class="st-chips">${media[r].map(f => `<span class="st-chip" data-f="${esc(f)}">${isVid(f) ? `<video src="${src(f)}" muted preload="metadata"></video>` : `<img src="${src(f)}" alt="">`}<button type="button" data-unslot="${esc(f)}" aria-label="Quitar" data-tip="Quitar">${svg('x')}</button></span>`).join('')}
          ${media[r].length < n ? `<button type="button" class="st-add" data-slot="${r}">${svg('up')}<span>Subir</span></button><button type="button" class="st-add" data-gpick="${r}">${svg('grid')}<span>De la galería</span></button>` : ''}</div></div>`).join('');
    const s = settingsOf(m), ent = Object.entries(m.settings);
    const ratio = m.settings.aspectRatio;
    const COMUNES = ['1:1', '4:5', '9:16', '16:9'], cur_ = String(s.aspectRatio), raro = v => !COMUNES.includes(v) && v !== cur_; // IMG-33 (6 Oct 2026): four formats in sight, the rest under «Más formatos»
    const nRaros = ratio ? ratio.values.filter(raro).length : 0;
    $('.st-ratios').innerHTML = ratio ? `<div class="st-lab">Formato</div><div class="st-ars${verMasFormatos ? ' ver-mas' : ''}" role="radiogroup" aria-label="Formato">${ratio.values.map(v => { const [w, h] = /^\d+:\d+$/.test(v) ? v.split(':').map(Number) : [1, 1]; const k = Math.min(26 / Math.max(w, h), 26); return `<button type="button" role="radio" class="st-ar${String(s.aspectRatio) === v ? ' on' : ''}${raro(v) ? ' st-ar-mas' : ''}" data-ar="${esc(v)}" aria-checked="${String(s.aspectRatio) === v}" tabindex="${String(s.aspectRatio) === v ? 0 : -1}" title="${esc(!/^\d+:\d+$/.test(v) ? 'El motor elige' : `${v} · ${RATIO_USE[v] || ''}`)}"><i style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px"></i><b>${esc(v === 'auto' ? 'Auto' : v)}</b><small>${esc(RATIO_WORD[v] || '')}</small></button>`; }).join('')}</div>${nRaros ? `<button type="button" class="st-armas" aria-expanded="${verMasFormatos}">${verMasFormatos ? 'Menos formatos' : `Más formatos (${nRaros})`}</button>` : ''}` : '';
    $('.st-matstep').classList.toggle('st-vacio', !Object.values(media).some(l => l.length) && !(m.needs || []).length); // Básico shows the references only once there is one
    const ctl = ([k, f]) => {
      // 6 Oct 2026 (the owner): the quality of a picture as buttons in sight, like the format — not a menu (Básico and Avanzado)
      if (f.type === 'enum' && kind === 'image' && CALIDAD.includes(k) && f.values.length <= 6) { const on = String(s[k]); return `<div class="st-qgrp"><div class="st-lab" id="stQ${k}">${LBL[k] || k}</div><div class="st-qch" role="radiogroup" aria-labelledby="stQ${k}">${f.values.map(v => `<button type="button" role="radio" class="st-qc${on === v ? ' on' : ''}" data-qset="${k}" data-v="${esc(v)}" aria-checked="${on === v}" tabindex="${on === v ? 0 : -1}">${esc(VAL[v] || v)}</button>`).join('')}</div></div>`; }
      if (f.type === 'enum') return `<label class="st-lab">${LBL[k] || k}<select data-set="${k}">${f.values.map(v => `<option value="${esc(v)}"${String(s[k]) === v ? ' selected' : ''}>${esc(VAL[v] || v)}</option>`).join('')}</select></label>`;
      if (f.type === 'text') return k === 'voiceId' ? voicePicker(f, s[k]) : `<label class="st-lab">${LBL[k] || k}<input type="text" data-set="${k}" value="${esc(s[k] ?? '')}" maxlength="${+f.max || 2000}" placeholder="${esc(f.placeholder || '')}"${k === 'seed' ? ' inputmode="numeric" pattern="[0-9]*"' : ''} autocomplete="off"></label>`; // V5.0
      if (f.type === 'range') return `<label class="st-lab st-range">${LBL[k] || k} <output>${s[k]}${k === 'duration' ? ' s' : ''}</output><input type="range" data-set="${k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${s[k]}"></label>`;
      return `<label class="st-tog"><input type="checkbox" data-set="${k}"${s[k] ? ' checked' : ''}><span>${LBL[k] || k}</span></label>`;
    };
    const SOUND_MORE = ['languageBoost', 'sampleRate', 'bitrate', 'channel']; // V5.0: a voice's picker, emotion, speed, volume, pitch and file in sight; the rest folded
    const isMain = k => (sound() ? k !== 'aspectRatio' && !SOUND_MORE.includes(k) : k === 'duration' || k === 'resolution' || (kind === 'image' && CALIDAD.includes(k)));
    const main = ent.filter(([k]) => isMain(k)), rest = ent.filter(([k]) => k !== 'aspectRatio' && !isMain(k));
    $('.st-sets').innerHTML = main.map(ctl).join('');
    $('.st-sets2').innerHTML = rest.map(ctl).join('');
    $('.st-more').hidden = !rest.length;
    $('.st-more summary').textContent = `Más ajustes · ${rest.map(([k]) => (LBL[k] || k).toLowerCase()).slice(0, 3).join(', ')}${rest.length > 3 ? '…' : ''}`;
    qty = Math.min(qty, SV.maxQty(kind, budget && budget.maxPerRequest));
    estimate();
    if (loadedKey !== null && !items.length && !jobs.length) renderGrid(); // IMG-05: «Empieza aquí» names the model now chosen
  }
  /** V5.0: the voice — one list (the owner's voices, then MiniMax's), the Voces panel beside it, and the id by hand folded under it
   *  (audit EST-13: the same choice was asked three times — a text field, a list and a hint repeating the list). */
  function voiceHint(id) {
    if (!id) return 'Elige una voz de la lista.';
    const v = voices.mine.find(x => x.voiceId === id); if (v) return '';
    const y = voices.system.find(x => x.voiceId === id); return y ? '' : `«${id}»: un id que la oficina no conoce; MiniMax dirá si existe.`;
  }
  function voicePicker(f, val) {
    const g = SV.voiceGroups(voices), known = g.some(gr => gr.voices.some(v => v.voiceId === val));
    const field = `<input id="stVid" class="st-vid" type="text" data-set="voiceId" value="${esc(val || '')}" maxlength="${+f.max || 256}" placeholder="${esc(f.placeholder || f.default || 'Spanish_Narrator')}" autocomplete="off" spellcheck="false" aria-describedby="stVidH"${g.length ? ' aria-label="Id de la voz"' : ''}>`;
    return `<div class="st-lab st-vpick">${g.length ? '<label for="stVsel">Voz</label>' : '<label for="stVid">Voz (id de MiniMax)</label>'}<div class="st-vrow2">
      ${g.length ? `<select id="stVsel" class="st-vsel" aria-describedby="stVidH">${val && !known ? `<option value="${esc(val)}" selected data-other>Otra: ${esc(val)}</option>` : !val ? '<option value="" data-other>Elegir una voz…</option>' : ''}${g.map(gr => `<optgroup label="${esc(gr.label)}">${gr.voices.map(v => `<option value="${esc(v.voiceId)}"${v.voiceId === val ? ' selected' : ''}>${esc(v.name)}${v.line ? ' · ' + esc(v.line) : ''}</option>`).join('')}</optgroup>`).join('')}</select>` : field}
      <button type="button" class="st-vopen" aria-label="Tus voces: clonar o diseñar" title="Tus voces: clonar la tuya, diseñar una, elegir">${svg('mic')}<span>Voces</span></button></div>
      ${g.length ? `<details class="st-vadv2"${val && !known ? ' open' : ''}><summary>Escribir el id a mano</summary>${field}</details>` : ''}
      <span class="st-vhint" id="stVidH">${esc(voiceHint(val))}</span></div>`;
  }
  function setVoice(id) { setSetting('voiceId', id); const i = $('.st-vid'); if (i) i.value = id; const h = $('#stVidH'); if (h) h.textContent = voiceHint(id); const sl = $('.st-vsel'); if (sl) paintVsel(sl, id); estimate(); }
  /** Revisión EST-13: an id typed by hand that the list does not know gets its own «Otra: <id>» option; the list is never blank. */
  function paintVsel(sl, id) {
    const o = SV.voiceSelect(SV.voiceGroups(voices).flatMap(g => g.voices.map(v => v.voiceId)), id);
    sl.querySelectorAll('option[data-other]').forEach(x => x.remove());
    if (o.add) { const op = new Option(o.add.label, o.add.value); op.dataset.other = ''; sl.prepend(op); }
    sl.value = o.value;
  }
  const lines = () => $('.st-prompt').value.split('\n').map(x => x.trim()).filter(Boolean);
  function estimate() {
    if (banco) banco.sync(kind); // F5/F6: the bank follows the kind, step 4 and the settings
    $('.st-n').textContent = qty;
    if (bancoManda()) { banco.replan(); bancoState(); return 0; } // the bank's plan has the cost
    const m = cur(); const n = (mode === 'batch' ? Math.max(1, lines().length) : 1) * qty;
    if (!m) { $('.st-est').textContent = ''; $('.st-go').textContent = SV.goLabel(kind, 1); $('.st-sum').hidden = true; const pl = $('.st-plen'), len = $('.st-prompt').value.length, lim = limitNow(); pl.textContent = sound() ? `${SV.num(len)}/${SV.num(lim)}` : ''; pl.classList.remove('near'); pl.classList.toggle('over', sound() && len > lim); return 0; } // V5.0: Voz / Música without the key still say what they would make
    const s = settingsOf(m), per = Number(s.batchSize) || 1, secs = m.seconds || Number(s.duration) || 5;
    const cost = SV.unitCost(m, s, $('.st-prompt').value.length) * n * per, total = n * per; // V5.0: a voice may cost by the characters it reads
    const room = moneyLeft(); // V4.5: the Estudio's own spending caps (Ajustes → Estudio)
    $('.st-est').textContent = `${SV.countOf(kind, total)}${m.per === 's' ? ` de ${secs} s` : ''} · ${cost ? 'aprox. US$' + cost.toFixed(2) : 'gratis'}${budget ? ` · hoy llevas US$${(budget.cost || 0).toFixed(2)}${budget.left == null ? '' : ` · te quedan ${budget.left}`}${room == null ? '' : ` · quedan US$${room.toFixed(2)} de tu presupuesto`}` : ''}`;
    $('.st-est').classList.toggle('over', !!(cost && room != null && cost > room + 1e-9 && m.engine !== 'prueba'));
    const sum = sound() ? [s.voiceId ? SV.voiceName(s.voiceId, voices) : '', s.instrumental ? 'instrumental' : '', s.format ? String(s.format).toUpperCase() : ''].filter(Boolean) : [s.aspectRatio && s.aspectRatio !== 'auto' ? `${s.aspectRatio}${RATIO_WORD[s.aspectRatio] ? ' ' + RATIO_WORD[s.aspectRatio] : ''}` : s.aspectRatio ? 'formato auto' : '', m.settings.duration ? `${secs} s` : '', s.resolution ? String(s.resolution) : ''].filter(Boolean);
    $('.st-sum').innerHTML = sum.length ? `${sum.map(esc).join(' · ')} <u>cambiar</u>` : ''; $('.st-sum').hidden = !sum.length;
    $('.st-go').textContent = `${SV.goLabel(kind, total)} · ${cost ? 'US$' + cost.toFixed(2) : 'gratis'}`; $('.st-go').classList.remove('st-go-falta'); $('.st-go').removeAttribute('aria-describedby'); // IMG-05: the price is in the button, where the decision is
    const len = $('.st-prompt').value.length, lim = limitNow(), pl = $('.st-plen'); // V4.2 (audit A11) · V5.0: the model's own limit (a voice reads up to 9 999)
    pl.textContent = len || sound() ? `${SV.num(len)}/${SV.num(lim)}` : ''; pl.classList.toggle('near', len > lim * 0.875 && len <= lim); pl.classList.toggle('over', len > lim);
    pl.title = len > lim ? `Sobran ${len - lim} caracteres` : sound() ? `Caben ${SV.num(lim)} caracteres` : '';
    const bc = $('.st-bcount'); bc.hidden = mode !== 'batch'; if (mode === 'batch') { const nl = lines().length; bc.textContent = nl ? `${nl} ${nl === 1 ? 'idea' : 'ideas'} × ${qty} = ${SV.countOf(kind, nl * qty * per)}` : 'Escribe una idea por línea.'; }
    const maxQ = SV.maxQty(kind, budget && budget.maxPerRequest); // V4.2 (audit A12): the ends say why they stop
    { const qs = $('.st-qn'), ops = [...new Set([1, 2, 4, qty])].filter(n => n <= maxQ || n === qty).sort((a, b) => a - b); const h = ops.map(n => `<button type="button" role="radio" class="st-qc${n === qty ? ' on' : ''}" data-qty="${n}" aria-checked="${n === qty}" tabindex="${n === qty ? 0 : -1}">${n}</button>`).join(''); if (qs.innerHTML !== h) qs.innerHTML = h; } // 6 Oct 2026: buttons, not a menu // IMG-37: 1 · 2 · 4
    const [dn, up] = el.querySelectorAll('.st-qty [data-d]'); dn.disabled = qty <= 1; up.disabled = qty >= maxQ; up.title = qty >= maxQ ? `Máximo ${maxQ} por pedido${kind === 'video' ? ' (un video pesa como 5 imágenes)' : kind === 'music' ? ' (una pista pesa como 3 imágenes)' : ''}` : 'Más';
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
    // INF-03: the search ran on the server, over the whole gallery; here only the tab and the folder are applied again,
    // because they change by hand (a star taken off in «Favoritas», a file moved out of the open folder)
    const ok = GF.matcher({ filter, folder: folderF }, new Set(folders.map(f => f.id)));
    return items.filter(ok);
  }
  const tileJobs = () => jobs.filter(j => j.state === 'queued' || j.state === 'running' || (j.state === 'failed' && Date.now() - (j.doneAt || j.at) < 3 * 864e5));
  // V4.2 (audit A39): how long this model usually takes — the median of its last finished jobs, else a sensible guess
  function typical(j) {
    const same = jobs.filter(x => x.model === j.model && x.state === 'done' && x.startedAt && x.doneAt).slice(0, 10).map(x => x.doneAt - x.startedAt).sort((a, b) => a - b);
    return same.length >= 2 ? same[Math.floor(same.length / 2)] : j.engine === 'prueba' ? 5000 : j.kind === 'video' ? 180000 : j.kind === 'music' ? 120000 : j.kind === 'audio' ? 15000 : 25000;
  }
  const approx = ms => ms < 60000 ? `~${Math.max(5, Math.round(ms / 5000) * 5)} s` : `~${Math.round(ms / 60000)} min`;
  const askCancel = new Set(); // V4.2 (audit A40): a job already sent to a paid engine asks once, in the tile, before it is cancelled
  /** IMG-05: the empty gallery names the model that will be used and what it costs (it used to promise «Prueba (gratis)» while a paid model was chosen). */
  function empiezaModelo() {
    const m = cur(), free = models.find(x => x.kind === kind && x.engine === 'prueba' && x.on);
    if (!m) return 'Con <b>Prueba (gratis)</b> ves todo el recorrido sin gastar: salen tarjetas de muestra con tu texto, no imágenes reales.';
    if (m.engine === 'prueba') return `Ahora usas <b>${esc(m.name)}</b>: tarjetas de muestra con tu texto, sin gastar. Para imágenes de verdad, elige otro modelo en «Modelo».`;
    return `Ahora usas <b>${esc(m.name)}</b> (${esc(price(m))}): cada archivo se cobra en tu cuenta del servicio.${free ? ` <button type="button" class="st-lk" data-free="${esc(free.id)}">Probar gratis primero</button>, con tarjetas de muestra.` : ''}`;
  }
  function jobTile(j) {
    const live = j.state !== 'failed', t = Date.now() - (j.startedAt || j.at);
    const typ = typical(j), pct = j.state === 'running' ? Math.min(95, Math.round(t / typ * 100)) : 0, slow = j.state === 'running' && t > typ * 1.6;
    const paid = j.state === 'running' && j.engine !== 'prueba';
    return `<figure class="st-card st-job ${j.state}" data-job="${j.id}">
      <div class="st-jbody" style="aspect-ratio:${SV.SOUND(j.kind) ? '16 / 9' : ar(j.s && j.s.aspectRatio) || '1 / 1'}">
        ${live ? `<div class="st-spin" aria-hidden="true"></div><b>${j.state === 'queued' ? 'En cola' : SV.words(j.kind).busy}${j.n > 1 ? ` · ${j.items.length} de ${j.n}` : ''}</b><span class="st-jt">${esc(j.note || '')}${j.note ? ' · ' : ''}${fmtDur(t)} · ${slow ? 'tarda más de lo normal' : `suele tardar ${approx(typ)}`}</span>${j.state === 'running' ? `<span class="st-jbar" aria-hidden="true"><i style="width:${pct}%"></i></span>` : ''}` : `<b>No se pudo</b><span class="st-jerr">${esc(j.error || '')}</span>${j.errorRaw ? `<details class="st-jraw"><summary>Detalles técnicos</summary><code>${esc(j.errorRaw)}</code></details>` : ''}`}
        <p>${esc(j.prompt)}</p><span class="st-meta">${esc(j.modelName)}${fromBots(j) ? ' · ' + esc(who(j)) : ''}${j.versionOf ? ' · versión' : ''}</span>
      </div>
      <div class="st-jacts">${live ? (askCancel.has(j.id) ? `<span class="st-jq">Ya se envió a ${esc(j.engineName || 'el motor')}: puede cobrarse igual.</span><button type="button" data-j="cancel-yes" class="warn">Cancelar igual</button><button type="button" data-j="cancel-no">Seguir</button>`
        : `<button type="button" data-j="cancel" title="${j.state === 'queued' ? 'Aún no empezó: no se cobra' : paid ? 'Ya se envió al motor: puede cobrarse igual' : 'Gratis: no se cobra'}">Cancelar</button>`) : `<button type="button" data-j="retry" class="pri">Reintentar</button>${j.errorClass && !/^(key|saldo|cancelado)$/.test(j.errorClass) && !j.lote && !j.versionOf ? '<button type="button" data-j="other" title="Lleva este pedido al compositor para elegir otro modelo">Otro modelo…</button>' : ''}<button type="button" data-j="forget">Quitar</button>`}</div></figure>`;
  }
  /** IMG-09: what this office and this file allow, for AC.acciones() */
  function capDe(it) {
    const cap = SV.soundCaption(it, voices), pv = AC.tipoDe(it) === 'img' ? variarPedido(it) : null;
    return { calendario: !!ctx.toCalendar, dimitri: !!ctx.askDimitri, tarea: !!(it.task && ctx.openTask), preset: !!(it.receta || it.preset), voz: !!(cap && cap.badge === 'VOZ'), precioVariar: pv && pv.modelo ? price(pv.modelo) : '' };
  }
  const hid = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); }; // a stable id: the card's html stays the same between refreshes
  function menuHTML(it, ac) { // IMG-09 · IMG-48: «⋯» by groups — create from it, organise, send to (the office); what the row already shows is not repeated
    const enFila = new Set((ac.fila || []).map(x => x.id));
    const item = x => x.id === 'dl' || enFila.has(x.id) ? '' : `<button type="button" role="menuitem" tabindex="-1" data-a="${x.id}"${x.id === 'del' ? ' class="warn"' : ''} title="${esc(x.title)}">${svg(x.icon, x.id === 'fav' && it.fav ? 'fill' : '')}<span>${esc(x.label)}</span></button>`;
    const k = hid(it.file);
    const gs = ac.grupos.map(g => ({ ...g, items: g.items.filter(x => !enFila.has(x.id)) })).filter(g => g.items.length);
    const del = item(ac.borrar);
    return `<div class="st-menu" role="menu" hidden>${gs.map(g => `<div role="group" aria-labelledby="m${k}${g.id}"><div class="st-mh" id="m${k}${g.id}">${esc(g.titulo)}</div>${g.items.map(item).join('')}</div>`).join('')}${del ? `<div class="st-msep" role="separator"></div>${del}` : ''}</div>`;
  }
  /** One file's card. `sub`: inside a request's card (IMG-08), which already says the prompt, who and when. */
  function card(it, { sub = false } = {}) {
    const aud = it.kind === 'audio', vid = it.kind === 'video' || aud, on = sel.has(it.file), label = String(it.prompt).slice(0, 70); // V4.8: an audio (for Muse Spark to transcribe) is neither animated nor a reference
    const cap = SV.soundCaption(it, voices); // V5.0: a voice or a song says what is read or sung, with which voice, and plays right on the card
    // V4.4 (25–27 Sep 2026): a row under the caption, on the card's own background (it used to float over the picture, where a
    // light image swallowed it). IMG-09 (6 Oct 2026): the row is the file's primary actions (Editar, Variar, Descargar for a
    // picture) and «⋯» holds the rest by groups, from the same list as the viewer (src/studio-acciones.js).
    const ac = AC.acciones(it, capDe(it));
    const row = ac.fila.map(x => x.id === 'dl' ? `<a class="st-oi" href="${src(it)}" download="${esc(dlName(it))}" aria-label="Descargar: ${esc(label)}" title="Descargar" data-tip="Descargar">${svg('down')}</a>`
      : x.icono ? `<button type="button" data-a="${x.id}" class="st-oi${x.id === 'del' ? ' st-oidel' : ''}" aria-label="${esc(x.label)}: ${esc(label)}" title="${esc(x.title)}" data-tip="${esc(x.corto)}">${svg(x.icon)}</button>`
      : `<button type="button" data-a="${x.id}" class="st-oi st-oiw" aria-label="${esc(x.label)}: ${esc(label)}" title="${esc(x.title)}">${svg(x.icon)}<span class="st-oit">${esc(x.corto)}</span></button>`).join('');
    return `<figure class="st-card${on ? ' sel' : ''}${sub ? ' st-sub' : ''}${nuevos.has(it.file) ? ' st-nueva' : ''}" data-f="${esc(it.file)}" draggable="true">
      ${nuevos.has(it.file) ? '<span class="st-nuevo" aria-hidden="true">NUEVO</span>' : ''}
      <label class="st-ck" title="Seleccionar (Mayús para un rango)"><input type="checkbox"${on ? ' checked' : ''} aria-label="Seleccionar: ${esc(label)}"></label>
      <button type="button" class="st-thumb" style="${ratioOf(it) ? `aspect-ratio:${ratioOf(it)}` : ''}" aria-label="Ver en grande${nuevos.has(it.file) ? ' (nuevo)' : ''}: ${esc(label)}">${aud ? `<span class="st-aud${cap.badge === 'MÚSICA' ? ' st-aud-mus' : cap.badge === 'VOZ' ? ' st-aud-voz' : ''}" aria-hidden="true">${cap.badge === 'MÚSICA' ? svg('note') : cap.badge === 'VOZ' ? svg('mic') : '♪'}</span>` : vid ? `<video src="${src(it)}" preload="metadata" muted loop playsinline draggable="false"></video><span class="st-play" aria-hidden="true">▶</span>` : `<img src="${src(it)}" alt="" loading="lazy" decoding="async" draggable="false">`}
        ${aud ? `<span class="st-badge">${cap.badge}</span>` : it.upload ? '<span class="st-badge">SUBIDA</span>' : it.provider === 'prueba' ? `<span class="st-badge">PRUEBA${it.wanted === 'video' ? ' · VIDEO' : ''}</span>` : ''}${it.fav && sub ? `<span class="st-favb">${svg('star', 'fill')}</span>` : ''}</button>
      ${menuHTML(it, ac)}
      ${aud ? `<audio class="st-cplay" src="${src(it)}" controls preload="metadata" aria-label="Escuchar: ${esc(label)}"></audio>` : ''}
      ${sub ? '' : `<figcaption>${aud ? `<span class="st-slab">${cap.label}${cap.voice ? ` · voz <b>${esc(cap.voice)}</b>` : cap.instrumental ? ' · instrumental' : ''}</span>` : ''}<span class="st-p">${esc(it.prompt)}</span>${it.task && it.by === 'agent' ? `<button type="button" class="st-tchip" data-a="task" title="Abrir la tarea">para: ${esc((ctx.taskTitle && ctx.taskTitle(it.task)) || 'su tarea')}</button>` : ''}<span class="st-meta">${it.fav ? '<span class="st-fav" title="Favorita">★ favorita</span> · ' : ''}${it.upload ? 'subida por ti' : esc(who(it))}${it.versionOf ? ' · versión' : ''}${it.qa ? ' · ' + banco.qaHTML(it) : ''}${it.modelName || (it.model && !it.upload) ? ' · ' + esc(it.modelName || it.model) : ''} · ${esc(when(it.at))}${folderF === 'all' && inFolder(it) ? ` · <span class="st-infd">${svg('folder')}${esc(folderName(it.folder))}</span>` : ''}</span></figcaption>`}
      <div class="st-ov" role="group" aria-label="Acciones">
        ${pickFor ? `<button type="button" data-a="usar" class="st-use${pickFor.ids.includes(it.file) ? ' on' : ''}" aria-pressed="${pickFor.ids.includes(it.file)}" title="Usarla ${forW().en} «${esc(pickFor.target.titulo)}»">${pickFor.ids.includes(it.file) ? `✓ ${forW().En}` : `Usar ${forW().en}`}</button>` : ''}
        ${row}
        <button type="button" data-a="menu" class="st-oi st-more" data-tip="Más acciones" aria-haspopup="menu" aria-expanded="false" aria-label="Más acciones: ${esc(label)}" title="Más: ${esc(ac.grupos.flatMap(g => g.items).map(x => x.corto.toLowerCase()).join(', '))} y la papelera">${svg('dots')}</button>
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
  function groupCard(its) { // V4.2 (audit A19): one request, one card. IMG-08 (6 Oct 2026): a header with the prompt once, then each picture as a normal card with its own actions (before: only «Ver por separado» and «Descargar las N»)
    const f = its[0], n = its.length, vid = f.kind === 'video', shownIts = its.slice(0, 4);
    return `<figure class="st-card st-group" data-g="${esc(f.job)}" draggable="true">
      <figcaption class="st-ghead"><span class="st-p">${esc(f.prompt)}</span>${f.task && f.by === 'agent' ? `<span class="st-tchip st-tchip-s">para: ${esc((ctx.taskTitle && ctx.taskTitle(f.task)) || 'su tarea')}</span>` : ''}<span class="st-meta"><b>${n} ${vid ? 'videos' : 'imágenes'} de un pedido</b> · ${esc(who(f))}${f.modelName ? ' · ' + esc(f.modelName) : ''} · ${esc(when(f.at))}</span>
      <span class="st-gacts"><button type="button" data-ga="split">Ver por separado</button><button type="button" data-ga="zip">${svg('down')} Descargar las ${n}</button></span></figcaption>
      <div class="st-gsubs">${shownIts.map(it => card(it, { sub: true })).join('')}</div>${n > 4 ? `<button type="button" class="st-gmorebtn" data-ga="split">Ver las ${n}</button>` : ''}</figure>`;
  }
  const aspect = it => { if (it.kind === 'audio' || SV.SOUND(it.kind)) return 0.85; /* V5.0: a 16:9 tile, its player and the text */ if (it.w && it.h) return it.h / it.w; const r = String(it.ratio || (it.s && it.s.aspectRatio) || '').split(':').map(Number); return r.length === 2 && r[0] && r[1] ? r[1] / r[0] : 1; };
  const colCount = () => { const w = $('.st-grid').clientWidth - 36; return w > 0 ? Math.max(1, Math.floor((w + 14) / (230 + 14))) : 0; };
  function when(ts) { const d = new Date(ts), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1); const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; return d.toDateString() === n.toDateString() ? `hoy ${t}` : d.toDateString() === y.toDateString() ? `ayer ${t}` : d.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) }); }
  function renderGrid() {
    const list = shown(), tj = tileJobs().filter(j => (folderF === 'all' || (folderF === 'none' ? !j.folder : j.folder === folderF)) && (filter === 'all' || (filter === 'you' && !fromBots(j)) || (filter === 'agent' && fromBots(j)) || (filter === 'video' && j.kind === 'video') || ((filter === 'voice' || filter === 'music') && SV.soundJobFilter(filter, j))));
    renderFolders();
    const active = tileJobs().filter(j => j.state !== 'failed').length;
    const cnt = counts || GF.counts(items, new Set(folders.map(f => f.id))), all = cnt.all; // INF-03: the server's counts, over the whole gallery
    $('.st-count').textContent = countLine(list.length, active); $('.st-count').classList.toggle('vh', !nextCur && !q.trim() && !active && !(counts && total !== counts.all)); // IMG-23: the line only when it says more than the day's heading
    $('.st-fsel').querySelectorAll('option').forEach(o => { if (!o.dataset.lbl) o.dataset.lbl = o.textContent; o.textContent = `${o.dataset.lbl} (${GF.miles(cnt[o.value] || 0)})`; }); $('.st-fsel').value = filter; // IMG-23: the eight tabs, one «Mostrar ▾»
    $('.st-ptn').textContent = active ? `· ${active} en curso` : all ? GF.miles(all) : '';
    renderSel();
    const G = $('.st-grid');
    const empty = loadErr && !items.length ? `<div class="st-empty">No pude cargar la galería (${esc(loadErr)}). <button type="button" class="st-retry">Reintentar</button></div>`
      : !tj.length && !list.length && loadedKey !== viewKey() ? '<div class="st-empty">Buscando…</div>' // INF-03: a new search or tab is on its way
      : !tj.length && !list.length && nextCur ? '<div class="st-empty">Cargando…</div>' // what was loaded left this view (a star taken off): the next page is coming
      : !tj.length && !list.length ? `<div class="st-empty">${all ? `Nada ${q.trim() ? `con «${esc(q.trim())}»` : 'con este filtro'}. <button type="button" class="st-all">Ver todo</button>` : `<div class="st-start"><h3>Empieza aquí</h3><ol><li>Escribe tu idea y pulsa <b>GENERAR</b>.</li><li>${empiezaModelo()}</li><li>Para imágenes y videos de verdad, activa un motor una sola vez: <button type="button" class="st-open-engs">Motores y keys</button></li><li>También puedes subir tus fotos (Subir) o pedírsela a un agente de Marketing.</li></ol></div>`}</div>` : '';
    if (empty && !list.length && nextCur && loadedKey === viewKey()) loadMore();
    if (empty) { if (G.innerHTML !== empty) G.innerHTML = empty; nodes.clear(); layoutSig = ''; lastWant = []; return; }
    let root = G.querySelector(':scope > .st-days'); if (!root) { G.innerHTML = '<div class="st-days"></div>'; root = G.firstElementChild; nodes.clear(); layoutSig = ''; }
    const flat = selecting || sel.size || picking, byJob = new Map();
    if (!flat) for (const it of list) if (it.job && !expanded.has(it.job) && it.kind !== 'audio') byJob.set /* V5.0: each audio keeps its own card and player */(it.job, [...(byJob.get(it.job) || []), it]);
    const want = tj.map(j => ['j:' + j.id, jobTile(j), aspect(j), dayKey(Date.now()), 0, Date.now(), j.state]), placed = new Set(); // IMG-13: a job's tile is not a file: the day counts it apart
    for (const it of list) {
      const g = !flat && it.job && byJob.get(it.job);
      if (g && g.length > 1) { if (placed.has(it.job)) continue; placed.add(it.job); const a = aspect(g[0]); want.push(['g:' + it.job, groupCard(g), 0.45 + g.slice(0, 4).reduce((t, x) => t + aspect(x) + 0.22, 0), dayKey(it.at), g.length, it.at]); continue; }
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
    lastWant = want; layout(root); paintMore(G, list.length);
    if (!list.length && nextCur && loadedKey === viewKey()) loadMore(); // everything loaded left the view by hand: fetch on
  }
  /* INF-03: «Cargar más» at the end of the gallery — a real button (keyboard, screen reader), and the same page comes by itself
     when the end scrolls into sight. The line says how much is seen: «120 de 3.412». */
  function countLine(n, active) {
    const filtered = (counts ? total !== counts.all : false) || !!q.trim();
    const head = nextCur ? `${GF.miles(n)} de ${GF.miles(total)} ${total === 1 ? 'archivo' : 'archivos'}` : `${GF.miles(n)} ${n === 1 ? 'archivo' : 'archivos'}`;
    return `${head}${filtered && counts ? ` · ${GF.miles(counts.all)} en la galería` : ''}${active ? ` · ${active} generándose` : ''}`;
  }
  let moreIO = null;
  function paintMore(G, n) {
    let box = G.querySelector(':scope > .st-loadmore');
    if (!nextCur) { if (box) { const had = box.contains(document.activeElement); box.remove(); if (had) moreFocus(G); } return; }
    if (!box) { box = document.createElement('div'); box.className = 'st-loadmore'; /* IMG-19: «Más ajustes» is .st-more; they shared the class and its centred flex */ box.innerHTML = '<p class="st-morep"></p><button type="button" class="st-morebtn"></button>'; G.appendChild(box); if (window.IntersectionObserver) { moreIO ||= new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !el.hidden) loadMore(); }, { root: G, rootMargin: '0px 0px 600px 0px' }); moreIO.observe(box); } }
    else if (box !== G.lastElementChild) G.appendChild(box);
    const left = Math.max(0, total - n), next = Math.min(PAGE, left || PAGE);
    box.querySelector('.st-morep').textContent = `Ves ${GF.miles(n)} de ${GF.miles(total)}.`;
    const b = box.querySelector('.st-morebtn'); b.textContent = moreBusy ? 'Cargando…' : `Cargar ${GF.miles(next)} más`; b.setAttribute('aria-busy', String(moreBusy));
  }
  /** The last page came and «Cargar más» went with the keyboard on it: the focus goes to the first card it brought (or the last card), never to <body>. */
  let moreFrom = 0;
  function moreFocus(G) {
    const w = lastWant[Math.min(moreFrom, lastWant.length - 1)], to = w && nodes.get(w[0])?.el; // lastWant: the cards in the gallery's order (the columns shuffle the DOM's)
    (to?.querySelector('.st-thumb, button') || G.querySelector('.st-card .st-thumb'))?.focus();
  }
  function layout(root, force) {
    const n = colCount(); if (!n) return; // hidden (a phone on the Crear tab): laid out when it shows
    const sig = n + '|' + lastWant.map(w => w[3] + ':' + w[0] + (w[6] || '')).join(',');
    if (!force && sig === layoutSig) return; layoutSig = sig;
    const days = []; for (const w of lastWant) { let d = days.find(x => x.k === w[3]); if (!d) days.push(d = { k: w[3], at: w[5], n: 0, fallo: 0, curso: 0, list: [] }); d.list.push(w); d.n += w[4]; if (w[6] === 'failed') d.fallo++; else if (w[6]) d.curso++; }
    const out = [];
    for (const d of days) { // V4.2 (audit A23): a heading per day, the day's cards in their own columns
      const hd = document.createElement('h3'); hd.className = 'st-day'; hd.innerHTML = `${esc(dayName(d.at))} <span>${d.n ? `${GF.miles(d.n)} ${d.n === 1 ? 'archivo' : 'archivos'}` : ''}${d.curso ? `${d.n ? ' · ' : ''}${d.curso} en curso` : ''}${d.fallo ? `${d.n || d.curso ? ' · ' : ''}${d.fallo} ${d.fallo === 1 ? 'falló' : 'fallaron'}` : ''}</span>`;
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
    { const b = el.querySelector('.st-selbar [data-b="cmp"]'); b.disabled = sel.size < CMP.MIN || sel.size > CMP.MAX; b.title = sel.size > CMP.MAX ? `Se comparan hasta ${CMP.MAX} a la vez` : 'Ver de 2 a 4 imágenes lado a lado; con dos, una cortina para el antes y el después'; } // IMG-14
    el.querySelectorAll('.st-selbar [data-b="fav"], .st-selbar [data-b="zip"], .st-selbar [data-b="del"], .st-selbar [data-b="lote"], .st-selbar .st-mv').forEach(b => { b.disabled = !sel.size; });
    const mv = $('.st-mv'); if (mv && document.activeElement !== mv) mv.innerHTML = `<option value="">Mover a…</option>${folders.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}<option value="none">Sin carpeta</option><option value="__new">+ Nueva carpeta…</option>`;
    $('.st-picking').hidden = !picking;
    if (picking) $('.st-picking').innerHTML = typeof picking === 'object' ? `${esc(picking.label)}: haz clic en una imagen. <button type="button" data-b="unpick">Cancelar</button>` : `Elige ${picking === 'video' ? 'un video' : 'una imagen'} para «${roleName(picking)}»: haz clic en ella. <button type="button" data-b="unpick">Cancelar</button>`; // banco de presets: { label, take(file) }
    el.classList.toggle('st-pickmode', !!picking);
  }
  /* INF-03: the view asked of the server — the tab, the folder and the search. A new one starts from the first page. */
  const viewKey = () => `${filter}|${folderF}|${q.trim()}`;
  const viewQS = () => `filter=${encodeURIComponent(filter)}&folder=${encodeURIComponent(folderF)}${q.trim() ? '&q=' + encodeURIComponent(q.trim()) : ''}`;
  let loading = null, pendingFull = false;
  async function load({ full = true, upto = null } = {}) { // full: the catalog too (the 20-second refresh only touches the gallery, so an open menu stays open)
    if (loading) { pendingFull ||= full; await loading.catch(() => {}); if (loading) return load({ full, upto }); if (loadedKey === viewKey() && !pendingFull && !upto) return; } // one load at a time: wait, and load again only if something new was asked
    full ||= pendingFull; pendingFull = false; const askedKey = viewKey();
    loading = (async () => {
      try { if (!location.protocol.startsWith('http')) throw new Error('el Estudio trabaja con la oficina real: ábrela con el iniciador (.bat)'); // the demo file has no server to ask (it logged a fetch error)
        const key = viewKey(), same = key === loadedKey;
        // the same view again (the 20-second refresh, a job that ended): as much as was loaded, up to 600, so nothing jumps; a new view: one page
        const n = same ? Math.min(600, Math.max(PAGE, items.length)) : PAGE;
        const j = await api('GET', `/api/media?catalog=1&n=${n}&${viewQS()}${upto ? '&upto=' + encodeURIComponent(upto) : ''}`);
        if (key !== viewKey()) { pendingFull ||= full; return; } // the owner typed or clicked meanwhile: this answer is for another view
        const top = remember(j.items || []), inTop = new Set(top.map(t => t.file)), last = top[top.length - 1];
        const tail = same && last && !upto ? items.filter(x => GF.cmp(x, last) > 0 && !inTop.has(x.file)) : [];
        if (tail.length) { items = [...top, ...tail]; if (!tail.some(x => !jumped.has(x.file))) nextCur = j.next || null; } // deeper than 600: the top is fresh, the rest stays as loaded (and so does its cursor)
        else { items = top; nextCur = j.next || null; if (!same) jumped.clear(); }
        if (j.hit && j.hit.file && !items.some(x => x.file === j.hit.file)) { items.push(remember([j.hit])[0]); jumped.set(j.hit.file, +j.hitAt || 0); } // revisión INF-03: a file further than a page, alone at the end — never the whole gallery down to it
        total = j.total ?? items.length; counts = j.counts || null; loadedKey = key;
        budget = j.budget || null; jobs = j.jobs || []; folders = j.folders || []; loadErr = '';
        depts = ctx.studioDepts && ctx.studioDepts.length ? ctx.studioDepts : (j.departments || []).map(k => ({ key: k, name: DEPT_NAMES[k] || k })); // V4.9
        if (folderF !== 'all' && folderF !== 'none' && !folders.some(f => f.id === folderF)) { folderF = 'all'; store.set('folder', 'all'); } // a folder removed elsewhere
        const sig = JSON.stringify((j.models || []).map(m => m.id + (m.on ? 1 : 0)));
        if (full || sig !== catalogSig) { models = j.models || []; engines = j.engines || []; def = j.default || {}; catalogSig = sig; full = true; banco.setModels(models); banco.refrescar(); } // the bank: which presets a model that is on can serve
        if (j.voices) voices = SV.normVoices(j.voices); // V5.0: only when MiniMax is on
        editModels = (j.editModels || []).map(m => (typeof m === 'string' ? models.find(x => x.id === m) : m)).filter(m => m && m.on !== false); if (editModels.length) editBlock = null; // V4.9
      } catch (e) { loadErr = e.message; }
      for (const f of [...sel]) if (!itemOf(f)) sel.delete(f);
      renderHead(); if (full) renderModels(); else if (cur()) estimate(); renderGrid(); watch(); // V4.5: the cost line follows the caps too
      if (full && location.protocol.startsWith('http')) api('GET', '/api/media?kind=audio&n=300').then(j => { audioPool = remember(j.items || []); }).catch(() => {}); // the audios to clone a voice from, wherever they are in the gallery
    })();
    try { await loading; } finally { loading = null; }
    if (askedKey !== viewKey()) return load({ full: false }); // the view changed while this one loaded
  }
  /** INF-03: the next page of this view, after the last one loaded. */
  async function loadMore() {
    if (!nextCur || moreBusy || loading || loadedKey !== viewKey()) return;
    moreBusy = true; const key = loadedKey, cur0 = nextCur; moreFrom = lastWant.length; renderGrid();
    try {
      const j = await api('GET', `/api/media?n=${PAGE}&before=${encodeURIComponent(cur0)}&${viewQS()}`);
      if (key !== viewKey() || cur0 !== nextCur) return;
      const have = new Set(items.map(x => x.file)); items = items.concat(remember(j.items || []).filter(x => !have.has(x.file)));
      if (jumped.size) items.sort(GF.cmp); // a file opened from afar sits at the end: the pages between come before it
      nextCur = j.next || null; total = j.total ?? total; if (j.counts) counts = j.counts; if (j.folders) folders = j.folders;
    } catch (e) { say('No pude cargar más: ' + e.message, true); }
    finally { moreBusy = false; }
    renderGrid();
  }
  /** INF-03: the view changed (a tab, a folder, the search): from its first page. What is loaded stays on screen, filtered here, until it comes. */
  let qT = 0;
  function requery(wait = 0) { clearTimeout(qT); renderGrid(); if (!location.protocol.startsWith('http')) return; qT = setTimeout(() => load({ full: false }), wait); }
  /** INF-03: after a change by hand (a move, the bin, a star), the tabs' and folders' numbers again — over the whole gallery, no page. */
  async function refreshCounts() { try { const j = await api('GET', '/api/media?n=0&' + viewQS()); counts = j.counts || counts; folders = j.folders || folders; total = j.total ?? total; renderGrid(); } catch {} }
  // while something generates, the tiles are refreshed every 2.5 s; when one finishes, the gallery reloads
  let jtimer = null;
  /* IMG-03 (6 Oct 2026): a job seen queued or running here is said ONCE when it ends, whichever refresh brought its end (the
     2.5 s ticks, the 20 s reload, a load after another job). Before, the tick compared with the list it had just read: when a
     reload got there first, the end was never said and the foot kept «En marcha» with the picture already in the gallery. */
  const vivos = new Set();
  function anunciar() {
    const ids = new Set(jobs.map(j => j.id)), fin = jobs.filter(j => vivos.has(j.id) && (j.state === 'done' || j.state === 'failed'));
    for (const id of [...vivos]) if (!ids.has(id)) vivos.delete(id);
    for (const j of jobs) if (j.state === 'queued' || j.state === 'running') vivos.add(j.id);
    if (!fin.length) return false;
    fin.forEach(j => vivos.delete(j.id));
    const ok = fin.filter(j => j.state === 'done'), bad = fin.filter(j => j.state === 'failed');
    const m = AV.terminados({ archivos: ok.reduce((n, j) => n + j.items.length, 0), fallidos: bad.length, error: bad[0]?.error, fallidasVisibles: tileJobs().filter(j => j.state === 'failed').length });
    if (m.texto) say(m.texto, m.malo); // a «Listo» never hides a failed tile still in sight
    marcarNuevos(ok.flatMap(j => j.items || []));
    return true;
  }
  /* IMG-07 (6 Oct 2026): what just came out is the protagonist — marked «Nuevo» for a few seconds and brought into sight in the
     gallery (it lands first, at the top of «Hoy»). The keyboard focus is never moved. */
  function marcarNuevos(files) {
    if (!files.length) return;
    nuevos.clear(); files.forEach(f => nuevos.add(f)); renderGrid();
    requestAnimationFrame(() => {
      const c = el.querySelector('.st-grid .st-card.st-nueva'), G = $('.st-grid');
      if (c && G.offsetParent) { const r = c.getBoundingClientRect(), g = G.getBoundingClientRect(); if (r.top < g.top || r.bottom > g.bottom) c.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
    });
    clearTimeout(nuevosT); nuevosT = setTimeout(() => { nuevos.clear(); renderGrid(); }, 8000);
  }
  function watch() {
    anunciar();
    const active = jobs.some(j => j.state === 'queued' || j.state === 'running');
    if (!active || el.hidden) { clearTimeout(jtimer); jtimer = null; return; }
    if (jtimer) return;
    jtimer = setTimeout(async () => {
      jtimer = null;
      try {
        const r = await api('GET', '/api/media/jobs'); jobs = r.jobs; budget = r.budget;
        if (jobs.some(j => vivos.has(j.id) && (j.state === 'done' || j.state === 'failed'))) { await load({ full: false }); anunciar(); renderGrid(); } // the new files come with the reload
        else { renderHead(); if (cur()) estimate(); renderGrid(); }
      } catch {}
      watch();
    }, 2500);
  }

  /* ---------- actions ---------- */
  async function generate(prompts) {
    const m = cur(); if (!m) return say('Elige un modelo.', true);
    if (busy) return; busy = true; $('.st-go').disabled = true;
    const settings = settingsOf(m), mediaNow = Object.fromEntries(Object.entries(media).filter(([, v]) => v.length));
    if (avanzado() && banco) { const mat = banco.material(); if (mat.length) { if (!(m.roles.reference > 0)) { busy = false; $('.st-go').disabled = false; return say(`${m.name} no acepta imágenes: tus ${mat.length} de «Tu foto · Referencias» no irían. Elige otro modelo o quítalas.`, true); } mediaNow.reference = [...new Set([...(mediaNow.reference || []), ...mat])].slice(0, m.roles.reference); } } // IMG-39: the one Material is used, never dropped in silence
    let ok = 0;
    for (const p of prompts) {
      try { const r = await api('POST', '/api/media/jobs', { prompt: p, n: qty, kind, model: m.id, settings, media: mediaNow, by: 'you', ...(folders.some(f => f.id === folderF) ? { folder: folderF } : {}) }); jobs.unshift(r.job); budget = r.budget; ok++; }
      catch (e) { if (/key/i.test(e.message)) { keyHelp(m, e.message); break; } say(`No se pudo${prompts.length > 1 ? ` (${ok + 1} de ${prompts.length})` : ''}: ${e.message}`, true); if (/tope|presupuesto/.test(e.message)) break; }
    }
    if (ok) { say(`${ok === 1 ? 'En marcha' : `${ok} trabajos en marcha`}: ${kind === 'video' ? 'un video tarda unos minutos; ' : kind === 'music' ? 'una canción tarda uno o dos minutos; ' : ''}aparece en la galería al terminar. Puedes seguir.`); if (phone()) showPane('gal'); } // on a phone, the new tile is what to look at
    busy = false; $('.st-go').disabled = false;
    renderHead(); estimate(); renderGrid(); watch();
  }
  function keyHelp(m, message) { // V4.2 (audit A38): what to do, step by step, and a way to keep going now
    const eng = engines.find(x => x.id === m.engine) || {}, K = $('.st-keyhelp');
    const test = models.find(x => x.kind === kind && x.engine === 'prueba' && x.on);
    K.innerHTML = `<b>${esc(m.name)} necesita su key de ${esc(eng.name || m.engineName || 'su servicio')}.</b>
      <ol><li>Crea la key en ${eng.site ? `<code>${esc(eng.site)}</code>` : 'la web del servicio'} y ponle un límite de gasto.</li>
      <li>Guárdala en Windows: abre una ventana de comandos y pega ${eng.how ? `<code>${esc(eng.how)}</code>` : 'el comando de «Motores y keys»'}.</li>
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
      <ol class="st-hlist">${rows.map(j => { const cancel = j.state === 'failed' && /Cancelado por ti/.test(j.error || ''); return `<li class="${cancel ? 'cancel' : j.state}"><b>${cancel ? 'Cancelado' : ok[j.state] || j.state}</b><span class="st-hp">${esc(j.prompt || '(sin texto)')}</span><span class="st-hm">${esc(j.modelName || j.model)} · ${esc(who(j))} · ${esc(when(j.doneAt || j.at))}${j.items && j.items.length ? ` · ${SV.countOf(j.kind, j.items.length)}` : ''}${j.cost ? ` · US$${j.cost}` : ''}</span>${j.state === 'failed' && !cancel ? `<span class="st-hr">${esc(j.error || '')}</span>` : ''}</li>`; }).join('') || '<li>Todavía no hay trabajos.</li>'}</ol></div>`;
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
  let engFrom = null;
  function openEngs() { const E = $('.st-engov'); renderHead(); engFrom = document.activeElement; E.hidden = false; modal.open(E); E.querySelector('.st-hx').focus(); E.onclick = e => { if (e.target === E || e.target.closest('.st-hx')) closeEngs(); }; }
  function closeEngs() { const E = $('.st-engov'); if (E.hidden) return; E.hidden = true; modal.close(E); if (engFrom && document.contains(engFrom)) engFrom.focus({ preventScroll: true }); }
  /* IMG-14 (6 Oct 2026): Comparar. Two pictures: one over the other with a curtain (drag it, or ← → Inicio Fin on its handle); three or four: a grid. */
  let cmpFrom = null;
  function comparar(list, titulo) {
    const r = CMP.queComparar(list); if (r.error) return say(r.error, true);
    const C = $('.st-cmpov'), two = r.items.length === 2, [a, b] = r.items;
    const lab = it => esc(it.upload ? 'Subida por ti' : it.modelName || it.model || '');
    cmpFrom = document.activeElement;
    C.innerHTML = `<div class="st-hbox st-cmpbox"><div class="st-hhead"><h2 id="stCmpT">${esc(titulo || `Comparar ${r.items.length} imágenes`)}</h2><span class="sp"></span><button type="button" class="st-hx" aria-label="Cerrar" title="Cerrar (Esc)">${svg('x')}</button></div>
      ${two ? `<div class="st-cmpab" style="--p:50%"><img src="${src(a)}" alt="Antes: ${esc(short(a.prompt))}"><img class="st-cmpdes" src="${src(b)}" alt="Después: ${esc(short(b.prompt))}"><div class="st-cmpbar" role="slider" tabindex="0" aria-label="Cortina: a la izquierda la primera, a la derecha la segunda" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="la cortina en el medio"><span aria-hidden="true">‹ ›</span></div></div>
      <p class="st-cmpcap"><span><b>Antes</b> · ${lab(a)} · ${esc(short(a.prompt))}</span><span><b>Después</b> · ${lab(b)} · ${esc(short(b.prompt))}</span></p>`
      : `<div class="st-cmpgrid" data-n="${r.items.length}">${r.items.map(it => `<figure><img src="${src(it)}" alt="${esc(short(it.prompt))}"><figcaption><b>${lab(it)}</b> ${esc(short(it.prompt))}</figcaption></figure>`).join('')}</div>`}</div>`;
    C.hidden = false; modal.open(C); (C.querySelector('.st-cmpbar') || C.querySelector('.st-hx')).focus();
    const ab = C.querySelector('.st-cmpab'), bar = C.querySelector('.st-cmpbar');
    const poner = p => { ab.style.setProperty('--p', p + '%'); bar.setAttribute('aria-valuenow', Math.round(p)); bar.setAttribute('aria-valuetext', p <= 0 ? 'toda la segunda' : p >= 100 ? 'toda la primera' : `${Math.round(p)} % de la primera`); };
    if (ab) {
      const desde = e => { const r_ = ab.getBoundingClientRect(); poner(Math.max(0, Math.min(100, (e.clientX - r_.left) / r_.width * 100))); };
      ab.onpointerdown = e => { ab.setPointerCapture?.(e.pointerId); desde(e); ab.onpointermove = desde; };
      ab.onpointerup = ab.onpointercancel = () => { ab.onpointermove = null; };
      bar.onkeydown = e => { const p = CMP.cortina(parseFloat(ab.style.getPropertyValue('--p')), e.key); if (p === null) return; e.preventDefault(); e.stopPropagation(); poner(p); };
    }
    C.onclick = e => { if (e.target === C || e.target.closest('.st-hx')) closeCmp(); };
  }
  function closeCmp() { const C = $('.st-cmpov'); if (!C || C.hidden) return; C.hidden = true; C.innerHTML = ''; modal.close(C); if (cmpFrom && document.contains(cmpFrom)) cmpFrom.focus({ preventScroll: true }); cmpFrom = null; }
  function cerrarMas(foco) { const d = el.querySelector('details.st-gmas[open]'); if (!d) return false; d.open = false; if (foco) d.querySelector('summary').focus(); return true; }
  function closeHist() { const H = $('.st-hist'); if (H.hidden) return; H.hidden = true; H.innerHTML = ''; modal.close(H); if (histFrom && document.contains(histFrom)) histFrom.focus({ preventScroll: true }); }
  /* ---------- V5.0 (30 Sep 2026, the owner: «toda la plataforma MiniMax»): the Voces panel. Rebuilt on 1 Oct 2026 (the owner: «el panel
     de la clonación de voz tiene que verse más intuitivo»; audit EST-01…EST-22) as three screens:
       home   — two big choices («Clonar mi voz», «Diseñar una voz con palabras») and «Tus voces» below;
       clone  — a guided flow: 1 Graba o sube (a script to read, a level meter that warns) · 2 Escúchalo (length, quality) ·
                3 Ponle nombre y clona (the price, the consent box; the id is made by the office, editable in «Más opciones») ·
                and the result: hear the original and the clone, try a sentence, «Usar en un audio»;
       design — describe it, hear its sample, «Quedármela» or «Borrarla».
     A recording never vanishes on a stray click: while it records, the backdrop does nothing and Esc or ✕ ask first. A take stays
     in memory (also when the panel closes) until it is cloned or saved: only what is cloned lands in the gallery («Grabaciones de voz»).
     The pure parts (prices, script, meter, id, what is missing, advice per error) live in src/studio-clonar.js, with tests.
     Routes: /api/voces (GET), /design, /clone, DELETE /<id>; «Probar esta voz» is an ordinary voice job (/api/media/jobs). ---------- */
  const freshVoc = () => ({ off: null, del: null, design: null, busy: false, screen: 'home', step: 1, take: null, rec: null, ask: false, name: 'Mi voz', id: '', idTouched: false, consent: false, result: null, script: 0, improv: false, err: '', trying: false, tried: null });
  let vocFrom = null, vocFromSel = '', vocState = freshVoc();
  const vocApi = async (method, url, body) => { const r = await fetch(url, body === undefined ? { method } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j }; };
  const ID_RULE = 'La oficina lo inventa. Si lo cambias: 8 a 256 caracteres, empieza por letra; solo letras sin tilde, números, - y _.';
  const TRY_TEXT = 'Hola, esta es mi voz clonada. ¿Suena como yo?';
  function vocOffHTML(off) {
    return `<div class="st-voff" role="note"><p><b>${esc(off.why || 'Las voces usan MiniMax, que aún no está activado en esta oficina.')}</b></p>
      <ol><li>Crea la key en <code>platform.minimax.io</code> (API Keys) y ponle un límite de gasto.</li><li>Abre una ventana de comandos y pega <code>${esc(off.how || 'setx MINIMAX_API_KEY "tu-key"')}</code>.</li><li>Cierra la oficina y ábrela con el iniciador.</li></ol>
      <p>Con la key puesta, aquí clonas tu voz grabándola o subiendo un audio, diseñas una voz con palabras y eliges la voz de cada audio.</p></div>`;
  }
  function vocRowHTML(v) {
    const nm = esc(v.name || v.voiceId);
    return `<li data-vid="${esc(v.voiceId)}"><div class="st-vtop"><b class="st-vname">${nm}</b><span class="st-vk">${SV.voiceKind(v)}</span>${v.at ? `<span class="st-vwhen">${esc(when(v.at))}</span>` : ''}</div>
      ${v.pinned ? '' : `<p class="st-vexp">MiniMax la borra el ${esc(VC.expiresOn(v.at))} si nadie la usa. <button type="button" data-vo="try-row" aria-label="Probar ${nm} ahora: así MiniMax la conserva">Probarla ahora</button></p>`}
      ${/^https:\/\//.test(v.demoAudio || '') ? `<audio controls preload="none" src="${esc(v.demoAudio)}" aria-label="Muestra de ${nm}"></audio>` : ''}
      <div class="st-vrowres" role="status" aria-live="polite"></div>
      ${vocState.del === v.voiceId ? `<div class="st-vconf" role="group" aria-label="Confirmar el borrado"><span>¿Borrar «${nm}»? MiniMax la olvida y no vuelve.</span><button type="button" data-vo="del-yes" class="warn">Sí, borrar</button><button type="button" data-vo="del-no">No</button></div>`
        : `<div class="st-vacts"><button type="button" data-vo="use" aria-label="Usar la voz ${nm} en un audio">${svg('mic')} Usar en un audio</button>
          <details class="st-vmore"><summary aria-label="Más de ${nm}">${svg('dots')}</summary><div class="st-vmorebox"><span class="st-vidc">Id: <code>${esc(v.voiceId)}</code></span><button type="button" data-vo="copy" aria-label="Copiar el id de ${nm}">Copiar id</button><button type="button" data-vo="del" class="warn" aria-label="Borrar la voz ${nm}">${svg('trash')} Borrar</button></div></details></div>`}</li>`;
  }
  const vq = s => $('.st-vocov ' + s);
  function paintVList() {
    const L = vq('.st-vlist'); if (!L) return;
    L.innerHTML = voices.mine.length ? voices.mine.map(vocRowHTML).join('') : '<li class="st-vempty">Todavía no tienes voces propias. Clona la tuya o diseña una arriba.</li>';
    const n = vq('.st-vn'); if (n) n.textContent = voices.mine.length ? `(${voices.mine.length})` : '';
  }
  function vsay(where, text, bad) { const m = vq(where); if (m) { m.textContent = text; m.classList.toggle('bad', !!bad); } }
  /* The audio: recorded here or uploaded as it is. The browser records WebM, which MiniMax does not take: a recording, and a file MiniMax
     would refuse (another format, over 20 MB, over 5 minutes), becomes a 24 kHz mono WAV of at most 5:00 (src/studio-voz.js). */
  const vcaOptions = audios => audios.length ? `<option value="">Elegir un audio de la galería…</option>${audios.map(a => `<option value="${esc(a.file)}">${esc(short(a.prompt))} · ${esc(when(a.at))}</option>`).join('')}` : '';
  async function decodeAudio(buf) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error('este navegador no lee audio'); const ac = new AC(); try { return await ac.decodeAudioData(buf); } finally { try { ac.close(); } catch {} } }
  function wavOf(ab) { const ch = Array.from({ length: ab.numberOfChannels }, (_, i) => ab.getChannelData(i)); return new Blob([SV.encodeWav(SV.resample(SV.toMono(ch, ab.sampleRate), ab.sampleRate, SV.CLONE.rate), SV.CLONE.rate)], { type: 'audio/wav' }); }
  const dataURL = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('no pude leer el audio')); fr.readAsDataURL(blob); });
  async function voiceFolder() {
    const have = folders.find(f => f.name === 'Grabaciones de voz'); if (have) return have.id;
    const r = await vocApi('POST', '/api/media/folders', { name: 'Grabaciones de voz' }).catch(() => null);
    if (r && r.ok && r.j.folder) { folders = r.j.folders || [...folders, r.j.folder]; return r.j.folder.id; }
    return null; // no folder is no reason to lose the recording
  }
  function dropTake() { const t = vocState.take; if (t && t.url && t.blob) { try { URL.revokeObjectURL(t.url); } catch {} } vocState.take = null; }
  function setTake(t) { dropTake(); vocState.take = t; vocState.err = ''; vocState.step = 2; drawVoices(); focusStep(); }
  /** The take into the gallery (only when it is cloned, or the owner asks): → its gallery file. */
  async function saveTake() {
    const t = vocState.take; if (!t) throw new Error('no hay audio');
    if (t.file) return t.file;
    const fid = await voiceFolder(), data = await dataURL(t.blob);
    const r = await vocApi('POST', '/api/media/upload', { name: t.name, data, ...(fid ? { folder: fid } : {}) }).catch(() => null);
    if (!r || !r.ok || !r.j.item) throw new Error(r ? r.j.error || r.status : 'sin conexión con la oficina');
    items.unshift(r.j.item); remember([r.j.item]); renderGrid(); t.file = r.j.item.file;
    return t.file;
  }
  function step1Err(text) { vocState.err = text; const e = vq('.st-verr'); if (e) { e.textContent = text; e.hidden = !text; } }
  async function pickCloneFile(f) {
    if (!f) return;
    if (f.size > 200 * 1024 * 1024) return step1Err(`«${f.name}» pasa de 200 MB: sube un fragmento más corto.`);
    step1Err(''); vsay('.st-vbusy', `Leyendo «${f.name}»…`);
    let ab = null; try { ab = await decodeAudio(await f.arrayBuffer()); } catch {}
    vsay('.st-vbusy', '');
    if (!ab) { const err = SV.checkCloneFile(f); if (err) return step1Err(`«${f.name}»: no pude leerlo aquí y ${err.charAt(0).toLowerCase() + err.slice(1)}`); return setTake({ blob: f, url: URL.createObjectURL(f), name: f.name, seconds: null, source: 'file' }); }
    if (ab.duration < SV.CLONE.minS) return step1Err(VC.lengthLine(ab.duration).text);
    if (SV.fitsAsIs(f, ab.duration)) return setTake({ blob: f, url: URL.createObjectURL(f), name: f.name, seconds: ab.duration, source: 'file' });
    const w = wavOf(ab); setTake({ blob: w, url: URL.createObjectURL(w), name: f.name.replace(/\.[^.]+$/, '') + '.wav', seconds: Math.min(ab.duration, SV.CLONE.maxS), cut: ab.duration > SV.CLONE.maxS, source: 'file' });
  }
  async function pickGalleryAudio(file) {
    const it = itemOf(file); if (!it) return;
    step1Err(''); vsay('.st-vbusy', 'Midiendo el audio…');
    let secs = null; try { secs = (await decodeAudio(await (await fetch(src(it))).arrayBuffer())).duration; } catch {}
    vsay('.st-vbusy', '');
    if (secs != null && secs < SV.CLONE.minS) return step1Err(VC.lengthLine(secs).text);
    if (secs != null && secs > SV.CLONE.maxS) return step1Err(`Ese audio dura ${SV.clock(secs)}: MiniMax toma hasta ${SV.clock(SV.CLONE.maxS)}. Súbelo con «Subir un audio» y la oficina lo recorta sola.`);
    setTake({ file, url: src(it), name: it.prompt || file, seconds: secs, source: 'gallery' });
  }
  /* ---- the recorder: the script to read, the level in dBFS (silence · low · ok · clip), the clock, an announcement every 30 s ---- */
  async function recStart() {
    if (!window.isSecureContext) return step1Err('El micrófono solo funciona con la oficina abierta en esta misma computadora (http://localhost:4520). Desde otro equipo, sube el audio.');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return step1Err('Este navegador no deja grabar aquí: usa Chrome o Edge, o sube un audio.');
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { return step1Err(e && e.name === 'NotAllowedError' ? 'No hay permiso para el micrófono: actívalo en el candado de la barra de direcciones y vuelve a pulsar Grabar.' : 'No encontré un micrófono' + (e && e.message ? ': ' + e.message : '.')); }
    if ($('.st-vocov').hidden) { stream.getTracks().forEach(t => t.stop()); return; }
    const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), an = ac.createAnalyser(); an.fftSize = 1024; ac.createMediaStreamSource(stream).connect(an);
    const mr = new MediaRecorder(stream), R = vocState.rec = { mr, stream, ac, chunks: [], t0: Date.now(), timer: 0, stats: VC.newStats(), said: 0 }, wave = new Uint8Array(an.fftSize);
    mr.ondataavailable = e => { if (e.data && e.data.size) R.chunks.push(e.data); };
    mr.onstop = () => recDone(R);
    mr.start(1000);
    step1Err(''); drawVoices(); vq('[data-vo="rec-stop"]')?.focus();
    const tick = () => {
      if (vocState.rec !== R) return;
      const s = (Date.now() - R.t0) / 1000; an.getByteTimeDomainData(wave);
      const lvl = VC.frameLevel(wave), z = VC.addFrame(R.stats, lvl), zone = VC.levelZone(lvl);
      const bar = vq('.st-vlvl'); if (bar) { bar.dataset.zone = z; bar.querySelector('i').style.width = VC.meterPct(lvl.db) + '%'; }
      const zl = vq('.st-vzone'); if (zl && zl.textContent !== zone.label) { zl.textContent = zone.label; zl.dataset.zone = z; }
      const t = vq('.st-vrect'); if (t) t.textContent = `${SV.clock(s)} de ${SV.clock(SV.CLONE.maxS)} · ${s < SV.CLONE.minS ? `mínimo ${SV.CLONE.minS} s` : `quedan ${SV.clock(SV.CLONE.maxS - s)}`}`;
      const a = VC.announce(s, R.said); if (a) { R.said = a.at; vsay('.st-vann', a.text); }
      if (s >= SV.CLONE.maxS) recStop();
    };
    R.timer = setInterval(tick, 200); tick();
  }
  function recStop(discard) {
    const R = vocState.rec; if (!R) return; vocState.rec = null; vocState.ask = false; R.discard = !!discard; clearInterval(R.timer);
    try { if (R.mr.state !== 'inactive') R.mr.stop(); } catch {} R.stream.getTracks().forEach(t => t.stop()); try { R.ac.close(); } catch {}
    R.seconds = (Date.now() - R.t0) / 1000;
    if (!$('.st-vocov').hidden) { drawVoices(); if (!discard) vsay('.st-vbusy', 'Preparando la grabación…'); const f = vq(discard ? '[data-vo="rec"]' : '.st-vstepbody'); if (f) f.focus(); }
  }
  async function recDone(R) {
    if (R.discard) return;
    try {
      const ab = await decodeAudio(await new Blob(R.chunks, { type: R.mr.mimeType || 'audio/webm' }).arrayBuffer());
      if (ab.duration < SV.CLONE.minS) { if (!$('.st-vocov').hidden) { vsay('.st-vbusy', ''); step1Err(`Grabaste ${SV.clock(ab.duration)}: hacen falta al menos ${SV.CLONE.minS} segundos. Graba otra vez, un poco más.`); vq('[data-vo="rec"]')?.focus(); } return; }
      const name = 'Grabación de voz ' + new Date().toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '.wav', w = wavOf(ab);
      const t = { blob: w, url: URL.createObjectURL(w), name, seconds: Math.min(ab.duration, SV.CLONE.maxS), source: 'rec', verdict: VC.takeVerdict(R.stats) };
      if ($('.st-vocov').hidden) { dropTake(); vocState.take = t; vocState.step = 2; return; } // closed meanwhile: kept for when it opens again
      setTake(t);
    } catch (e) { if (!$('.st-vocov').hidden) { vsay('.st-vbusy', ''); step1Err('No pude preparar la grabación: ' + e.message); } }
  }
  /* ---- the screens ---- */
  const budgetLine = () => { if (!budget) return ''; const room = moneyLeft(); return `Hoy llevas ${VC.usd(budget.cost)}${budget.dailyBudget ? ` de ${VC.usd(budget.dailyBudget)}` : ''}${room == null ? '' : ` · te quedan ${VC.usd(room)}`}.`; };
  function homeHTML() {
    return `<p class="st-hsub">Una voz propia lee tus anuncios, reels y audios con tu tono. Elige cómo crearla:</p>
      <div class="st-vchoose">
        <button type="button" class="st-vcard" data-vo="go-clone">${svg('mic')}<span><b>Clonar mi voz</b><small>Graba 1 a 2 minutos o sube un audio · ${VC.usd(VC.PRICE.clone)}</small>${VC.pendingLine(vocState) ? `<small class="st-vpend">${esc(VC.pendingLine(vocState))}</small>` : ''}</span></button>
        <button type="button" class="st-vcard" data-vo="go-design">${svg('spark')}<span><b>Diseñar una voz con palabras</b><small>Describe cómo suena y escucha una muestra · ~${VC.usd(VC.PRICE.design)}</small></span></button>
      </div>
      <h3 class="st-vh3">Tus voces <span class="st-vn"></span></h3>
      <ul class="st-vlist"></ul>`;
  }
  function progressHTML() {
    const s = vocState.step === 'done' ? 4 : vocState.step;
    return `<ol class="st-vsteps" aria-label="Pasos para clonar">${VC.STEPS.map((t, i) => `<li class="${i + 1 < s ? 'done' : i + 1 === s ? 'now' : ''}"${i + 1 === s ? ' aria-current="step"' : ''}><b>${i + 1 < s ? '✓' : i + 1}</b><span>${t}</span></li>`).join('')}</ol>`;
  }
  function step1HTML() {
    const R = vocState.rec, audios = SV.cloneable([...items, ...audioPool.filter(a => !items.some(x => x.file === a.file) && !gone.has(a.file))]); // INF-03: every audio of the gallery, not only the loaded pages
    if (R) return `<div class="st-vreading">
        ${vocState.improv ? '<p class="st-vimprov">Improvisa: cuenta qué hace tu negocio, cómo atiendes a un cliente, una anécdota. Con preguntas, cifras y algún «¡qué bueno!».</p>' : `<div class="st-vscript" role="region" tabindex="0" aria-label="Guion para leer en voz alta">${esc(VC.scriptAt(vocState.script)).split('\n').map(p => `<p>${p}</p>`).join('')}</div>`}
        <div class="st-vscrrow"><button type="button" data-vo="script-next">Otro texto</button><button type="button" data-vo="improv" aria-pressed="${vocState.improv}">${vocState.improv ? 'Mostrar un texto' : 'Prefiero improvisar'}</button></div>
        <div class="st-vmeter"><span class="st-vdot" aria-hidden="true"></span><span class="st-vrect"></span><span class="st-vlvl" aria-hidden="true" data-zone="silence"><i></i></span><span class="st-vzone" data-zone="silence">…</span></div>
        <p class="vh st-vann" role="status" aria-live="polite"></p>
        ${vocState.ask ? `<div class="st-vconf st-vask" role="alertdialog" aria-labelledby="stVaskT"><span id="stVaskT">¿Parar y guardar lo grabado (${SV.clock((Date.now() - R.t0) / 1000)}) o descartarlo?</span><button type="button" class="pri" data-vo="ask-keep">Guardar</button><button type="button" data-vo="ask-drop" class="warn">Descartar</button><button type="button" data-vo="ask-no">Seguir grabando</button></div>`
          : `<div class="st-edrow"><button type="button" class="pri st-vrecbtn on" data-vo="rec-stop">■ Parar</button></div>`}</div>`;
    return `<p class="st-vtip">${VC.TIP}</p>
      <div class="st-vsrcs">
        <button type="button" class="pri st-vrecbtn" data-vo="rec">● Grabar con el micrófono</button>
        <p class="st-vrechelp">Te damos un texto para leer en voz alta. Se para sola a los ${SV.clock(SV.CLONE.maxS)}.</p>
        <div class="st-valt"><span class="st-vor">o usa un audio que ya tengas:</span>
          <button type="button" data-vo="pick">${svg('up')} Subir un audio…</button>
          ${audios.length ? `<label class="vh" for="stVcA">De la galería</label><select id="stVcA" class="st-vca">${vcaOptions(audios)}</select>` : ''}</div>
        <input type="file" class="st-vcf" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm" hidden>
      </div>
      <p class="st-vbusy" role="status" aria-live="polite"></p>
      <p class="st-verr" role="alert"${vocState.err ? '' : ' hidden'}>${esc(vocState.err)}</p>`;
  }
  function step2HTML() {
    const t = vocState.take, L = t.seconds == null ? null : VC.lengthLine(t.seconds, t.cut);
    return `<p class="st-vtake">«${esc(t.name)}»${t.source === 'gallery' ? ' · de la galería' : ''}</p>
      <audio class="st-vprev" controls preload="metadata" src="${esc(t.url)}" aria-label="Escuchar el audio para clonar"></audio>
      <ul class="st-vchecks">
        ${L ? `<li class="${L.level}">${esc(L.text)}</li>` : '<li class="short">No pude medir su duración aquí; MiniMax la revisará al clonar (de 10 s a 5:00).</li>'}
        ${t.verdict ? `<li class="${t.verdict.level === 'good' ? 'good' : 'short'}">${esc(t.verdict.text)}</li>` : ''}
        <li>Escúchalo: ¿se oye solo tu voz, clara y sin música?</li></ul>
      <div class="st-edrow"><button type="button" data-vo="redo">${t.source === 'rec' ? '● Grabar otra vez' : 'Elegir otro audio'}</button>${t.file ? '' : '<button type="button" data-vo="keep-take">Guardar en la galería</button>'}<span class="sp"></span><button type="button" class="pri" data-vo="next" ${L && !L.ok ? 'disabled aria-disabled="true"' : ''}>Suena bien: seguir</button></div>
      <p class="st-vbusy" role="status" aria-live="polite"></p>`;
  }
  function step3HTML() {
    return `<label class="st-plab" for="stVcN">Nombre de la voz</label><input id="stVcN" class="st-vcn" maxlength="60" value="${esc(vocState.name)}" placeholder="Ej.: Mi voz" autocomplete="off">
      <label class="st-vconsent"><input type="checkbox" class="st-vok"${vocState.consent ? ' checked' : ''}><span>${VC.CONSENT}</span></label>
      <details class="st-vadv"><summary>Más opciones</summary>
        <label class="st-plab" for="stVcI">Id de la voz en MiniMax</label><input id="stVcI" class="st-vci" maxlength="256" autocomplete="off" spellcheck="false" aria-describedby="stVcH" value="${esc(vocState.id)}">
        <p class="st-vhint" id="stVcH">${ID_RULE}</p></details>
      <p class="st-vprice"><b>Clonar cuesta ${VC.usd(VC.PRICE.clone)}</b>, una sola vez (MiniMax lo cobra al crearla). ${esc(budgetLine())}</p>
      <p class="st-vverif">${VC.VERIFIED} <a href="${VC.VERIFY_URL}" target="_blank" rel="noopener">Cómo verificarla</a></p>
      <div class="st-edrow"><button type="button" data-vo="back">Atrás</button><span class="sp"></span><span class="st-vmiss" id="stVmiss" aria-live="polite"></span><button type="button" class="pri" data-vo="clone" aria-describedby="stVmiss">Clonar la voz · ${VC.usd(VC.PRICE.clone)}</button></div>
      <div class="st-vcres" role="status" aria-live="polite"></div>`;
  }
  function doneHTML() {
    const v = vocState.result || {}, t = vocState.take, nm = esc(v.name || v.voiceId || '');
    return `<h3 class="st-vh3 st-vdone" tabindex="-1">Lista: «${nm}»</h3>
      <p class="st-hsub">Ya está en tus voces. Compara: ¿suena como tú?</p>
      <div class="st-vcompare">
        ${t && t.url ? `<div><span class="st-plab">Tu grabación</span><audio controls preload="metadata" src="${esc(t.url)}" aria-label="Tu grabación original"></audio></div>` : ''}
        ${/^https:\/\//.test(v.demoAudio || '') ? `<div><span class="st-plab">Tu voz clonada (muestra de MiniMax)</span><audio controls preload="none" src="${esc(v.demoAudio)}" aria-label="Muestra de la voz clonada"></audio></div>` : ''}
      </div>
      <label class="st-plab" for="stVtry">Prueba una frase</label><div class="st-vtryrow"><input id="stVtry" class="st-vtry" maxlength="300" value="${esc(TRY_TEXT)}"><button type="button" data-vo="try">${svg('mic')} Probar esta voz</button></div>
      <p class="st-vhint">Sale un audio corto (unos centavos) que queda también en la galería.</p>
      <div class="st-vtryres" role="status" aria-live="polite"></div>
      <div class="st-edrow"><button type="button" data-vo="again">Clonar otra</button><button type="button" data-vo="home">Ver tus voces</button><span class="sp"></span><button type="button" class="pri" data-vo="use-new">Usar en un audio</button></div>`;
  }
  function cloneHTML() {
    const s = vocState.step, title = s === 'done' ? '' : `<h3 class="st-vh3 st-vstepbody" tabindex="-1">${s}. ${VC.STEPS[s - 1]}</h3>`;
    return `${progressHTML()}${title}<div class="st-vstep">${s === 1 ? step1HTML() : s === 2 && vocState.take ? step2HTML() : s === 3 ? step3HTML() : s === 'done' ? doneHTML() : step1HTML()}</div>`;
  }
  function designHTML() {
    return `<p class="st-hsub">Describe la voz y MiniMax la crea con una muestra para escucharla. <b>Crear cuesta ~${VC.usd(VC.PRICE.design)}</b>, aunque después la borres.</p>
      <div class="st-vform">
        <label class="st-plab" for="stVdN">Nombre</label><input id="stVdN" class="st-vdn" maxlength="60" placeholder="Ej.: Voz de Panaclaw">
        <label class="st-plab" for="stVdP">Cómo suena</label><textarea id="stVdP" class="st-vdp" rows="3" maxlength="2000" placeholder="Ej.: mujer de unos 30 años, cálida y cercana, acento panameño suave, ritmo tranquilo"></textarea>
        <label class="st-plab" for="stVdT">Frase de la muestra</label><input id="stVdT" class="st-vdt" maxlength="500" value="Hola, esta es una prueba de mi nueva voz.">
        <p class="st-vprice">${esc(budgetLine())}</p>
        <div class="st-edrow"><button type="button" class="pri" data-vo="design">Crear y escuchar · ~${VC.usd(VC.PRICE.design)}</button></div>
        <div class="st-vdres" role="status" aria-live="polite"></div></div>`;
  }
  function drawVoices() {
    const V = $('.st-vocov'), S = vocState, sc = S.screen;
    const back = !S.off && sc !== 'home' && !S.rec ? `<button type="button" class="st-vback" data-vo="home" aria-label="Volver a tus voces">‹ Voces</button>` : '';
    V.innerHTML = `<div class="st-hbox st-vbox"><div class="st-hhead">${back}<h2 id="stVocT">${S.off || sc === 'home' ? 'Voces <span class="st-vn"></span>' : sc === 'clone' ? 'Clonar mi voz' : 'Diseñar una voz'}</h2><span class="sp"></span><button type="button" class="st-hx" aria-label="Cerrar las voces">${svg('x')}</button></div>
      ${S.off ? vocOffHTML(S.off) : `<div class="st-vmsg" role="status" aria-live="polite"></div>${sc === 'clone' ? cloneHTML() : sc === 'design' ? designHTML() : homeHTML()}`}</div>`;
    paintVList(); if (sc === 'clone' && S.step === 3) vcheck();
  }
  function focusStep() { (vq('.st-vdone') || vq('.st-vstepbody') || vq('.st-hx'))?.focus(); }
  function go(screen, step) {
    if (vocState.rec) return; // the recorder asks first (Esc · ✕)
    vocState.screen = screen; if (step != null) vocState.step = step;
    if (screen === 'clone' && vocState.step === 3 && !vocState.idTouched) vocState.id = VC.autoVoiceId(vocState.name, voices.mine.map(x => x.voiceId));
    drawVoices();
    if (screen === 'home') vq('.st-vcard')?.focus(); else if (screen === 'design') vq('.st-vdn')?.focus(); else focusStep();
  }
  function vcheck() { // step 3: the name, the consent, the id (only checked when the owner opens «Más opciones» and changes it); what is missing, beside the button
    const go = vq('[data-vo="clone"]'); if (!go) return false;
    const i = vq('.st-vci'), val = i ? i.value.trim() : vocState.id, c = SV.checkVoiceId(val), taken = voices.mine.some(v => v.voiceId === val), h = vq('#stVcH');
    const err = !c.ok ? c.error : taken ? 'Ya tienes una voz con ese id.' : '';
    if (h) { h.textContent = err || ID_RULE; h.classList.toggle('bad', !!err); }
    if (i) i.setAttribute('aria-invalid', String(!!err));
    if (err) { const d = vq('.st-vadv'); if (d) d.open = true; }
    const miss = VC.missing({ audio: !!vocState.take, name: vocState.name, consent: vocState.consent, idOk: !err });
    const m = vq('.st-vmiss'); if (m) m.textContent = vocState.busy ? '' : miss;
    go.setAttribute('aria-disabled', String(!!miss || vocState.busy)); go.classList.toggle('st-vwait', !!miss || vocState.busy);
    return !miss && !vocState.busy;
  }
  async function openVoices(screen) {
    const V = $('.st-vocov'); if (!V.hidden) return;
    vocFrom = document.activeElement; vocFromSel = !vocFrom || !vocFrom.closest ? '' : vocFrom.closest('.st-vopen') ? '.st-vopen' : vocFrom.closest('.st-vcta') ? '.st-vcta' : '';
    const keep = VC.keepTake(vocState) ? vocState : null; // a take not cloned yet is still here, whatever screen it was left on (revisión EST-02)
    if (!keep) dropTake(); // a cloned take's blob URL is let go, not leaked
    vocState = keep ? { ...keep, off: null, del: null, busy: false, rec: null, ask: false } : freshVoc();
    if (screen && !keep) vocState.screen = screen;
    if (!isLive() || !location.protocol.startsWith('http')) vocState.off = { why: 'Las voces necesitan la oficina real (ábrela con el iniciador) y MiniMax activado.' };
    else if (!mmxOn()) vocState.off = { how: (engines.find(e => e.id === 'minimax') || {}).how };
    V.hidden = false; modal.open(V); drawVoices();
    if (vocState.off) { V.querySelector('.st-hx').focus(); return; }
    if (keep && vocState.screen === 'clone') vsay('.st-vmsg', 'Tu audio sigue aquí: continúa donde lo dejaste.'); // on the start screen the «Clonar mi voz» card says it (and has the focus)
    focusStep(); if (vocState.screen === 'home') vq('.st-vcard')?.focus();
    const r = await vocApi('GET', '/api/voces').catch(() => null);
    if (V.hidden) return;
    if (!r) return vsay('.st-vmsg', 'Sin conexión con la oficina.', true);
    if (r.status === 409) { vocState.off = { how: r.j.how, why: r.j.error }; drawVoices(); V.querySelector('.st-hx').focus(); return; }
    if (!r.ok) return vsay('.st-vmsg', 'No pude leer tus voces: ' + (r.j.error || r.status), true);
    voices = SV.normVoices(r.j); paintVList(); if (kind === 'audio') renderModel();
  }
  /** Esc, ✕ or a click outside. While it records, nothing is lost: the backdrop does nothing and Esc / ✕ ask «¿Guardar o descartar?». */
  function closeVoices(keepFocus) {
    const V = $('.st-vocov'); if (V.hidden) return;
    if (vocState.rec) { if (!vocState.ask) { vocState.ask = true; drawVoices(); vq('[data-vo="ask-keep"]')?.focus(); } return; }
    V.querySelectorAll('audio').forEach(a => a.pause()); V.hidden = true; V.innerHTML = ''; modal.close(V);
    if (!keepFocus) { // renderModel() repaints the voice step while the panel is open, so the button that opened it may be a new node by now
      const back = vocFrom && document.contains(vocFrom) ? vocFrom : vocFromSel ? $(vocFromSel) : null;
      if (back) back.focus({ preventScroll: true });
    }
    vocFrom = null; vocFromSel = '';
  }
  function voicesEscape() {
    if (vocState.ask) { vocState.ask = false; drawVoices(); vq('[data-vo="rec-stop"]')?.focus(); return; }
    if (vocState.del) { const id = vocState.del; vocState.del = null; paintVList(); vq(`[data-vid="${CSS.escape(id)}"] .st-vmore summary`)?.focus(); return; }
    const open = vq('.st-vmore[open]'); if (open) { open.open = false; open.querySelector('summary').focus(); return; }
    closeVoices();
  }
  function addVoice(v) { voices.mine = [v, ...voices.mine.filter(x => x.voiceId !== v.voiceId)]; paintVList(); if (kind === 'audio') renderModel(); }
  const rowBtn = (id, a) => vq(`[data-vid="${CSS.escape(id)}"] [data-vo="${a}"]`);
  const voiceStep = () => `«${$('.st-s5t').textContent}»`; // EST-01: the step by its title — in Voz it is number 4, not 5
  function useVoice(id) { // «Usar en un audio»: Voz, its model, this voice in «Voz y ajustes»
    closeVoices(true);
    if (kind !== 'audio') setKind('audio');
    showPane('gen'); el.classList.remove('st-folded');
    const m = cur();
    if (!m || !m.settings.voiceId) { say(m ? `${m.name} no elige voz.` : 'No hay un modelo de voz encendido.', true); $('.st-mpick').focus(); return; }
    setVoice(id);
    const p = $('.st-prompt'); (p.value.trim() ? $('.st-go') : p).focus();
    say(`Voz «${SV.voiceName(id, voices)}» puesta en ${voiceStep()}${p.value.trim() ? ': pulsa GENERAR.' : ': escribe el texto y pulsa GENERAR.'}`);
  }
  /** «Probar esta voz»: a short voice job with that voice (it also tells MiniMax the voice is in use). Its file plays here and stays in the gallery.
   *  Revisión EST: true when it played; false when it could not (the caller turns its button back on, so the owner can retry). */
  async function tryVoice(id, text, where) {
    const m = models.filter(x => x.kind === 'audio' && x.on !== false && x.settings && x.settings.voiceId).sort((a, b) => (/turbo/.test(b.id) ? 1 : 0) - (/turbo/.test(a.id) ? 1 : 0))[0];
    const out = vq(where); if (!out) return false;
    if (!m) { out.textContent = 'No hay un modelo de voz encendido para probarla.'; out.classList.add('bad'); return false; }
    out.classList.remove('bad'); out.textContent = 'Generando la prueba…';
    let job; try { const r = await api('POST', '/api/media/jobs', { prompt: String(text || TRY_TEXT).slice(0, 300), n: 1, kind: 'audio', model: m.id, settings: { ...settingsOf(m), voiceId: id }, by: 'you' }); job = r.job; jobs.unshift(job); if (r.budget) budget = r.budget; renderHead(); renderGrid(); watch(); }
    catch (e) { out.textContent = 'No se pudo probar: ' + e.message; out.classList.add('bad'); return false; }
    for (let i = 0; i < 60 && !$('.st-vocov').hidden; i++) {
      await new Promise(r => setTimeout(r, 1500));
      let j; try { j = ((await api('GET', '/api/media/jobs')).jobs || []).find(x => x.id === job.id); } catch { continue; }
      if (!j || j.state === 'queued' || j.state === 'running') continue;
      const o = vq(where); if (!o) return false;
      if (j.state !== 'done' || !j.items.length) { o.textContent = 'No salió: ' + (j.error || 'MiniMax no devolvió audio'); o.classList.add('bad'); return false; }
      await load({ full: false }); const it = itemOf(j.items[0]);
      o.innerHTML = `<audio controls autoplay src="${esc(src(it || j.items[0]))}" aria-label="Prueba de la voz"></audio>`; o.querySelector('audio').focus();
      const v = voices.mine.find(x => x.voiceId === id); if (v && !v.pinned) { v.pinned = true; vq(`[data-vid="${CSS.escape(id)}"] .st-vexp`)?.remove(); } // used now: MiniMax keeps it (no repaint: it would drop the player)
      return true;
    }
    const o = vq(where); if (o) { o.textContent = 'La prueba sigue generándose: cuando termine queda en la galería.'; o.classList.remove('bad'); }
    return false;
  }
  async function designVoice(b) {
    const name = vq('.st-vdn').value.trim(), prompt = vq('.st-vdp').value.trim(), previewText = vq('.st-vdt').value.trim();
    if (!prompt) { vsay('.st-vdres', 'Describe cómo suena: edad, tono, acento, ritmo.', true); vq('.st-vdp').focus(); return; }
    b.disabled = true; b.textContent = 'Creando la muestra…'; vsay('.st-vdres', 'Creando la voz en MiniMax: tarda unos segundos…');
    const r = await vocApi('POST', '/api/voces/design', { name: name || 'Voz diseñada', prompt, ...(previewText ? { previewText } : {}) }).catch(() => null);
    if ($('.st-vocov').hidden) return;
    b.disabled = false; b.textContent = `Crear y escuchar · ~${VC.usd(VC.PRICE.design)}`;
    if (!r) return vsay('.st-vdres', 'Sin conexión con la oficina.', true);
    if (r.status === 409) { vocState.off = { how: r.j.how, why: r.j.error }; drawVoices(); vq('.st-hx').focus(); return; }
    if (!r.ok || !r.j.voice) return vsay('.st-vdres', 'No se pudo crear: ' + (r.j.error || r.status), true);
    load({ full: false }); // EST-04: the header shows what was just spent
    const v = r.j.voice, nm = esc(v.name || v.voiceId), pv = typeof r.j.preview === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(r.j.preview) ? r.j.preview.replace(/\s/g, '') : '';
    addVoice(v); vocState.design = v.voiceId;
    const R = vq('.st-vdres'); R.classList.remove('bad');
    R.innerHTML = `<p>Muestra de «${nm}» lista.${pv ? ' Escúchala.' : ' MiniMax no mandó muestra, pero la voz ya existe.'} Ya está en tus voces.</p>${pv ? `<audio controls src="data:audio/mpeg;base64,${pv}" aria-label="Muestra de ${nm}"></audio>` : ''}<div class="st-edrow"><button type="button" class="pri" data-vo="keep">Quedármela</button><button type="button" data-vo="discard" class="warn">Borrarla (el costo no se devuelve)</button></div>`;
    (R.querySelector('audio') || R.querySelector('[data-vo="keep"]')).focus();
  }
  async function cloneVoice(b) {
    if (vocState.busy) return;
    if (!vcheck()) { const miss = vq('.st-vmiss'); if (miss) { miss.classList.remove('st-vflash'); void miss.offsetWidth; miss.classList.add('st-vflash'); } (!vocState.name.trim() ? vq('.st-vcn') : !vocState.consent ? vq('.st-vok') : vq('.st-vci'))?.focus(); return; }
    const taken = voices.mine.map(x => x.voiceId), voiceId = vocState.idTouched || (vocState.id && !taken.includes(vocState.id)) ? vocState.id.trim() : (vocState.id = VC.autoVoiceId(vocState.name, taken)); // the id the owner saw in «Más opciones»
    vocState.busy = true; vcheck(); b.textContent = 'Clonando…'; vsay('.st-vcres', 'Guardando el audio y clonando la voz en MiniMax: puede tardar un minuto…');
    let file; try { file = await saveTake(); } catch (err) { vocState.busy = false; b.textContent = `Clonar la voz · ${VC.usd(VC.PRICE.clone)}`; vcheck(); return vsay('.st-vcres', 'No pude guardar el audio: ' + err.message, true); }
    const r = await vocApi('POST', '/api/voces/clone', { name: vocState.name.trim(), voiceId, audio: file, consent: { at: Date.now(), text: VC.CONSENT } }).catch(() => null);
    vocState.busy = false;
    if (r && r.ok && r.j.voice) { load({ full: false }); if ($('.st-vocov').hidden) { voices.mine = [r.j.voice, ...voices.mine]; if (kind === 'audio') renderModel(); dropTake(); vocState = freshVoc(); return; } } // EST-04: the header shows the US$1.50 at once
    if ($('.st-vocov').hidden) return;
    if (r && r.status === 409) { vocState.off = { how: r.j.how, why: r.j.error }; drawVoices(); vq('.st-hx').focus(); return; }
    if (!r || !r.ok || !r.j.voice) {
      b.textContent = `Clonar la voz · ${VC.usd(VC.PRICE.clone)}`; vcheck();
      const a = VC.cloneAdvice(r ? r.j.error || r.status : 'sin conexión con la oficina');
      if (a.code === 'dup' && !vocState.idTouched) vocState.id = VC.autoVoiceId(vocState.name + ' ' + Date.now(), taken);
      const R = vq('.st-vcres'); R.classList.add('bad'); R.innerHTML = `<p>${esc(a.text)}</p>${a.code === 'other' ? '' : `<p class="st-vhint">Detalle: ${esc(a.raw)}</p>`}${a.code === 'verify' ? `<p><a href="${VC.VERIFY_URL}" target="_blank" rel="noopener">Abrir la verificación en MiniMax</a></p>` : ''}`;
      return;
    }
    vocState.result = r.j.voice; vocState.step = 'done'; vocState.idTouched = false; vocState.id = '';
    addVoice(r.j.voice); drawVoices(); focusStep();
  }
  {
    const V = $('.st-vocov');
    V.addEventListener('click', async e => {
      e.stopPropagation(); // the Estudio's own click handler reads data-* that are not this panel's
      if (e.target === V) { if (!vocState.rec) closeVoices(); return; } // EST-02: a stray click outside never ends a recording
      if (e.target.closest('.st-hx')) return closeVoices();
      const b = e.target.closest('[data-vo]'); if (!b || b.disabled) return;
      const a = b.dataset.vo, id = b.closest('[data-vid]')?.dataset.vid;
      if (a === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(id) : Promise.reject()).then(() => { b.textContent = 'Copiado ✓'; }, () => { b.textContent = 'No se pudo copiar'; }).finally(() => setTimeout(() => { if (document.contains(b)) b.textContent = 'Copiar id'; }, 1600)); return; }
      if (a === 'use') return useVoice(id);
      if (a === 'use-new') return useVoice(vocState.result && vocState.result.voiceId);
      if (a === 'try' || a === 'try-row') { // revisión EST: one paid sample per click — the button rests while it is made, and wakes again to retry
        b.disabled = true; b.setAttribute('aria-busy', 'true');
        const ok = await (a === 'try' ? tryVoice(vocState.result && vocState.result.voiceId, vq('.st-vtry')?.value, '.st-vtryres') : tryVoice(id, TRY_TEXT, `[data-vid="${CSS.escape(id)}"] .st-vrowres`));
        if (document.contains(b)) { b.removeAttribute('aria-busy'); if (a === 'try' || !ok) { b.disabled = false; if (!ok && (document.activeElement === document.body || !document.activeElement)) b.focus(); } }
        return;
      }
      if (a === 'go-clone') return go('clone', vocState.take ? vocState.step : 1);
      if (a === 'go-design') return go('design');
      if (a === 'home') { if (vocState.screen === 'clone' && vocState.step === 'done') { dropTake(); Object.assign(vocState, { step: 1, result: null, consent: false, name: 'Mi voz' }); } return go('home'); }
      if (a === 'again') { dropTake(); Object.assign(vocState, { step: 1, result: null, consent: false, name: 'Mi voz', id: '', idTouched: false }); return go('clone', 1); }
      if (a === 'rec') return recStart();
      if (a === 'rec-stop' || a === 'ask-keep') return recStop();
      if (a === 'ask-drop') { recStop(true); vq('[data-vo="rec"]')?.focus(); return; }
      if (a === 'ask-no') { vocState.ask = false; drawVoices(); vq('[data-vo="rec-stop"]')?.focus(); return; }
      if (a === 'script-next') { vocState.script++; vocState.improv = false; const s = vq('.st-vscript'); if (s) { s.innerHTML = esc(VC.scriptAt(vocState.script)).split('\n').map(p => `<p>${p}</p>`).join(''); s.scrollTop = 0; } else drawVoices(); return; }
      if (a === 'improv') { vocState.improv = !vocState.improv; drawVoices(); vq('[data-vo="improv"]')?.focus(); return; }
      if (a === 'pick') { vq('.st-vcf').click(); return; }
      if (a === 'redo') { dropTake(); vocState.step = 1; drawVoices(); vq('[data-vo="rec"]')?.focus(); return; }
      if (a === 'keep-take') { b.disabled = true; try { await saveTake(); vsay('.st-vbusy', 'Guardado en la galería, carpeta «Grabaciones de voz».'); b.remove(); } catch (err) { b.disabled = false; vsay('.st-vbusy', 'No pude guardarlo: ' + err.message, true); } return; }
      if (a === 'next') return go('clone', 3);
      if (a === 'back') return go('clone', 2);
      if (a === 'clone') return cloneVoice(b);
      if (a === 'del') { vocState.del = id; paintVList(); rowBtn(id, 'del-no')?.focus(); return; }
      if (a === 'del-no') { vocState.del = null; paintVList(); vq(`[data-vid="${CSS.escape(id)}"] .st-vmore summary`)?.focus(); return; }
      if (a === 'del-yes' || a === 'discard') {
        const vid = a === 'discard' ? vocState.design : id, nm = (voices.mine.find(x => x.voiceId === vid) || {}).name || vid; if (!vid) return;
        b.disabled = true;
        const r = await vocApi('DELETE', '/api/voces/' + encodeURIComponent(vid)).catch(() => null);
        vocState.del = null;
        if (r && r.ok) {
          voices.mine = voices.mine.filter(x => x.voiceId !== vid); paintVList(); if (kind === 'audio') renderModel();
          if (a === 'discard') { vocState.design = null; vsay('.st-vdres', `Borrada: «${nm}».`); vq('.st-vdp')?.focus(); }
          else { vsay('.st-vmsg', `Borrada: «${nm}».`); (vq('[data-vo="use"]') || vq('.st-vcard')).focus(); }
        } else { b.disabled = false; if (a === 'del-yes') paintVList(); vsay(a === 'discard' ? '.st-vdres' : '.st-vmsg', 'No se pudo borrar: ' + (r ? r.j.error || r.status : 'sin conexión con la oficina'), true); }
        return;
      }
      if (a === 'keep') { const vid = vocState.design, nm = (voices.mine.find(x => x.voiceId === vid) || {}).name || vid; vocState.design = null; vq('.st-vdn').value = ''; vq('.st-vdp').value = ''; vsay('.st-vdres', `Guardada: «${nm}».`); go('home'); vsay('.st-vmsg', `«${nm}» está en tus voces.`); rowBtn(vid, 'use')?.focus(); return; }
      if (a === 'design') return designVoice(b);
    });
    V.addEventListener('input', e => {
      e.stopPropagation();
      if (e.target.classList.contains('st-vci')) { vocState.id = e.target.value; vocState.idTouched = !!e.target.value.trim(); if (!vocState.idTouched) vocState.id = VC.autoVoiceId(vocState.name, voices.mine.map(x => x.voiceId)); vcheck(); }
      if (e.target.classList.contains('st-vcn')) { vocState.name = e.target.value; if (!vocState.idTouched) { vocState.id = VC.autoVoiceId(vocState.name, voices.mine.map(x => x.voiceId)); const i = vq('.st-vci'); if (i) i.value = vocState.id; } vcheck(); } // the id follows the name until the owner writes one
    });
    V.addEventListener('change', e => {
      e.stopPropagation();
      if (e.target.classList.contains('st-vok')) { vocState.consent = e.target.checked; vcheck(); }
      if (e.target.classList.contains('st-vca') && e.target.value) pickGalleryAudio(e.target.value);
      if (e.target.classList.contains('st-vcf')) { const f = e.target.files[0]; e.target.value = ''; pickCloneFile(f); }
    });
  }
  /** V5.0: a song's lyrics are marked by parts — the tag goes on a line of its own where the caret is. */
  function insertTag(t) {
    const p = $('.st-prompt'), a = p.selectionStart ?? p.value.length, b = p.selectionEnd ?? a, before = p.value.slice(0, a);
    p.setRangeText(`${before && !before.endsWith('\n') ? '\n' : ''}${t}\n`, a, b, 'end'); p.focus(); clearFieldErr(); estimate();
  }
  function setMode(m) { mode = m; el.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m)); renderModel(); }
  function setKind(k) { if (k === kind || !SV.KINDS.includes(k)) return; clearFieldErr(); $('.st-keyhelp').hidden = true; kind = k; store.set('kind', kind); if (sound() && mode !== 'one') { mode = 'one'; el.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === 'one')); } openList(false); renderModels(); } // V5.0: a voice or a song is one text, not one per line
  function useModelFor(role, want) { // a model of `want` kind that takes `role`: the current one if it does, else the best that is on
    const c = models.find(m => m.id === modelOf[want]);
    if (c && c.on && c.roles[role]) return c;
    const pref = { image: ['nano-banana', 'nano-banana-fal', 'seedream-4', 'gpt-image-1', 'flux-kontext', 'flux-2'], video: ['kling-3-std', 'seedance-2-fast', 'kling-2.5-fal', 'seedance-1-fal', 'hailuo-02-fal', 'dop'] }[want] || [];
    const on = models.filter(m => m.kind === want && m.on && m.roles[role]);
    return pref.map(id => on.find(m => m.id === id)).find(Boolean) || on.find(m => m.engine !== 'prueba') || on[0] || null;
  }
  function animateRaw(it) {
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
  function useAsRefRaw(it) { // IMG-02: a model it has to change is said, with its price; what was composed can come back (DESHACER)
    if (basico() && auto && kind === 'image') { aplicarAuto(1); renderPick(); } // IMG-36: Automático takes a model that edits
    const prev = cur();
    let m = prev;
    if (!m || !m.roles.reference) { m = useModelFor('reference', kind); if (!m && kind !== 'image') { kind = 'image'; store.set('kind', kind); m = useModelFor('reference', 'image'); } if (!m) return say('Ningún modelo encendido acepta referencias.', true); modelOf[kind] = m.id; store.set('model.' + kind, m.id); renderModels(); }
    if (addMedia('reference', it.file)) { learn(it.file, 'ref'); say(prev && prev.id !== m.id ? `Referencia añadida. Cambié a ${m.name} (${price(m)}) porque ${prev.name} no acepta referencias. Describe qué hacer con ella.` : `Referencia añadida a ${m.name}. Describe qué hacer con ella.`); if (phone()) showPane('gen'); }
  }
  /* ---------- IMG-01 · IMG-02 (6 Oct 2026): the draft with DESHACER ----------
     Repetir, Animar, Usar de referencia and «Otro modelo…» load the composer; before, they wrote over what the owner was
     composing (the idea, the model, the references, the quantity) with no way back. Now what was there is kept and a toast
     offers DESHACER. Variar no longer touches the composer at all: it is a request of its own, through the same cost gate. */
  const borrador = BR.pila(10);
  function fotoBorrador() { return ({ auto, kind, mode, prompt: $('.st-prompt').value, modelOf: { ...modelOf }, media: BR.copia(media), qty, sets: BR.copia(setsOf) }); }
  function volverBorrador(e) {
    if (!e) return;
    kind = e.kind; store.set('kind', kind); mode = e.mode; qty = e.qty; media = e.media; if (typeof e.auto === 'boolean') auto = e.auto;
    for (const k of Object.keys(e.modelOf)) { modelOf[k] = e.modelOf[k]; store.set('model.' + k, modelOf[k]); }
    for (const k of Object.keys(setsOf)) delete setsOf[k]; Object.assign(setsOf, e.sets); store.set('sets', setsOf);
    $('.st-prompt').value = e.prompt;
    el.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    clearFieldErr(); openList(false); renderModels(); showPane('gen'); $('.st-prompt').focus();
    say('El compositor vuelve a estar como lo tenías.');
  }
  /** Runs `fn` (something that loads the composer); if the composer changed, the old one is kept and the toast offers DESHACER. */
  function cargar(fn) {
    const antes = fotoBorrador(), r = fn();
    if (!BR.igual(antes, fotoBorrador()) && !BR.vacio(antes)) { borrador.guardar(antes); toast('Cargado en el compositor. Lo que tenías se guardó.', () => volverBorrador(borrador.deshacer())); }
    return r;
  }
  function reuse(it, quiet) { return cargar(() => reuseRaw(it, quiet)); }
  function animate(it) { return cargar(() => animateRaw(it)); }
  function useAsRef(it) { if (avanzado() && banco && banco.anadirRefs([it.file]).length) { learn(it.file, 'ref'); showPane('gen'); return say('Puesta en «Referencias» (Avanzado).'); } return cargar(() => useAsRefRaw(it)); } // IMG-39
  function moverA(it) { sel.clear(); sel.add(it.file); selecting = true; showPane('gal'); renderGrid(); $('.st-mv').focus(); say('Elige la carpeta en «Mover a…», arriba (o arrastra la imagen a una carpeta).'); }
  function presetDe(it) { const k = isVid(it.file) ? 'video' : 'image'; if (kind !== k) setKind(k); setNivel('avanzado'); showPane('gen'); banco.guardarDesde(it); }
  /** The one gate before spending (GENERAR, Variar, the presets): from US$0.50 the first click arms and the second spends (IMG-11). */
  let armado = null, armadoT = 0;
  function okCosto(c, clave = 'go') {
    const r = CF.pedirOk(armado, clave, c); armado = r.armado; clearTimeout(armadoT);
    const go = $('.st-go'); go.classList.remove('st-armado');
    if (r.ok) return true;
    const usd = 'US$' + c.toFixed(2), hoy = budget && budget.cost ? ` (hoy llevas US$${budget.cost.toFixed(2)})` : '';
    if (clave.startsWith('go') || clave === 'banco') { go.textContent = `Confirmar · ${usd}`; go.classList.add('st-armado'); say(`Esto cuesta aprox. ${usd}${hoy}. Pulsa otra vez para generar.`); }
    armadoT = setTimeout(() => { armado = null; go.classList.remove('st-armado'); if (bancoManda()) bancoState(); else estimate(); }, CF.VENTANA);
    return false;
  }
  function variarPedido(it) { return BR.pedidoVariar({ ...it, folder: inFolder(it) }, models, { respaldo: useModelFor('reference', 'image'), settingsDe: m => settingsOf(m) }); }
  async function vary(it, en = null) { // V4.2 (audit A35) · IMG-01: another take close to this one — its prompt, model and settings, the picture as the reference; the composer is not touched. en = { btn, decir }: from the viewer, which stays open (IMG-12)
    const decir = en ? (t, malo) => { en.decir(t, malo); say(t, malo); } : say;
    if (!isLive() || !location.protocol.startsWith('http')) return decir('Variar necesita la oficina real (ábrela con el iniciador).', true);
    const p = variarPedido(it); if (p.error) return decir(p.error, true);
    const m = p.modelo, cost = SV.unitCost(m, p.req.settings, p.req.prompt.length) * (Number(p.req.settings.batchSize) || 1);
    if (!okCosto(cost, 'vary:' + it.file)) {
      if (!en || !en.btn) return toast(`Variar con ${m.name} cuesta aprox. US$${cost.toFixed(2)}.`, () => vary(it), 'VARIAR'); // IMG-11: the toast's button is the second click
      const b = en.btn, was = b.innerHTML; b.innerHTML = `${svg('spark')} Confirmar · US$${cost.toFixed(2)}`; b.classList.add('st-armado'); // in the viewer, the button itself is the second click
      setTimeout(() => { if (document.contains(b) && b.classList.contains('st-armado')) { b.innerHTML = was; b.classList.remove('st-armado'); } }, CF.VENTANA);
      return decir(`Variar con ${m.name} cuesta aprox. US$${cost.toFixed(2)}. Pulsa otra vez para variar.`);
    }
    if (en && en.btn) { en.btn.classList.remove('st-armado'); en.btn.innerHTML = `${svg('spark')} Variar`; }
    try { const r = await api('POST', '/api/media/jobs', p.req); jobs.unshift(r.job); budget = r.budget; }
    catch (e) { if (/key/i.test(e.message)) { if (en) closeLight(); return keyHelp(m, e.message); } return decir('No se pudo variar: ' + e.message, true); }
    learn(it.file, 'ref'); renderHead(); estimate(); renderGrid(); watch(); if (phone() && !en) showPane('gal');
    decir(`Variando con ${m.name}${p.cambio ? ' (el modelo de esa imagen no acepta referencias)' : ''} · ${cost ? 'aprox. US$' + cost.toFixed(2) : 'gratis'}. Tu compositor sigue igual; sale en la galería al terminar.`);
  }
  function reuseRaw(it, quiet) {
    const k = SV.kindOfItem(it); // V5.0: a voice goes back to Voz, a song to Música
    kind = k; store.set('kind', kind);
    const m = models.find(x => x.id === it.model && x.on); if (m) { modelOf[k] = m.id; if (k === 'image') auto = false; /* IMG-36: Repetir keeps its model, not Automático's */ if (it.settings) { setsOf[m.id] = { ...it.settings }; store.set('sets', setsOf); } }
    media = { start: [], end: [], reference: [], video: [], ...(it.media || {}) };
    for (const r of Object.keys(media)) media[r] = (media[r] || []).filter(f => !gone.has(f)); // INF-03: a reference may be an old file not loaded now; only one sent to the bin here goes
    setMode('one');
    $('.st-prompt').value = it.prompt; renderModels(); $('.st-prompt').focus();
    if (!quiet) say(m ? (SV.SOUND(k) ? 'Mismo texto, modelo y ajustes: cambia lo que quieras y pulsa GENERAR.' : 'Mismo prompt, modelo y ajustes: cambia lo que quieras y pulsa GENERAR.') : 'Ese modelo no está encendido; elige otro.', !m);
  }
  /** V5.0: «Repetir con otra voz» — the same text and settings, the voice field ready to change. */
  function otherVoice(it) {
    reuse(it, true); showPane('gen');
    const i = $('.st-vsel') || $('.st-vid'); if (!i) { $('.st-mpick').focus(); return say('Ese modelo de voz no está encendido: arriba dice cómo activarlo.', true); }
    i.scrollIntoView({ block: 'center', behavior: 'smooth' }); i.focus({ preventScroll: true }); if (i.select) i.select();
    say('Mismo texto: elige otra voz en la lista y pulsa GENERAR.');
  }
  /* IMG-46 (6 Oct 2026): templates — any composer setup (model, format and settings, quantity, the idea, the style pictures) as a Brain
     note (plantillas.mjs, /api/media/plantillas). In the demo they live in this browser. Choosing one loads it with DESHACER. */
  let plantillasL = [];
  const plLocal = { get: () => store.get('plantillas', []), set: l => store.set('plantillas', l) };
  async function cargarPlantillas() { try { plantillasL = isLive() ? (await api('GET', '/api/media/plantillas')).plantillas || [] : plLocal.get(); } catch { plantillasL = []; } pintarPlantillas(); }
  function pintarPlantillas() {
    const S = $('.st-plsel'); if (!S) return; const mias = plantillasL.filter(p => p.kind === kind), was = S.value;
    S.innerHTML = `<option value="">${mias.length ? `Elegir (${mias.length})…` : 'Aún no tienes'}</option>${mias.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}`;
    S.disabled = !mias.length; if (mias.some(p => p.id === was)) S.value = was; $('.st-pldel').hidden = !S.value;
  }
  function aplicarPlantilla(p) {
    return cargar(() => {
      if (p.kind !== kind) setKind(p.kind);
      const m = p.modelo && models.find(x => x.id === p.modelo && x.on);
      if (m) { modelOf[p.kind] = m.id; store.set('model.' + p.kind, m.id); if (p.kind === 'image') auto = false; setsOf[m.id] = { ...settingsOf(m), ...(p.ajustes || {}) }; store.set('sets', setsOf); }
      qty = Math.max(1, Math.min(8, p.n || 1));
      const est = (p.estilo || []).filter(f => !gone.has(f)); if (est.length) media = { ...media, reference: [...new Set([...media.reference, ...est])] };
      if (p.prompt) $('.st-prompt').value = p.prompt;
      renderModels(); estimate();
      say(m || !p.modelo ? `Plantilla «${p.nombre}» cargada: cambia lo que quieras y pulsa GENERAR.` : `Plantilla «${p.nombre}» cargada, pero su modelo no está encendido aquí: elige otro.`, !!p.modelo && !m);
    });
  }
  async function guardarPlantilla(nombre) {
    const m = cur(); nombre = String(nombre || '').trim(); if (!nombre) { $('.st-plname').focus(); return say('Ponle un nombre a la plantilla.', true); }
    const b = { nombre, kind, modelo: m ? m.id : '', ajustes: m ? settingsOf(m) : {}, n: qty, prompt: $('.st-prompt').value.trim(), estilo: media.reference.slice() };
    try {
      let p;
      if (isLive()) p = (await api('POST', '/api/media/plantillas', b)).plantilla;
      else { p = { ...b, id: 'pl-' + (nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'plantilla') }; plLocal.set([...plLocal.get().filter(x => x.id !== p.id), p]); }
      $('.st-plform').hidden = true; $('.st-plname').value = ''; await cargarPlantillas(); $('.st-plsel').value = p.id; $('.st-pldel').hidden = false; $('.st-plsel').focus();
      say(isLive() ? `Plantilla «${p.nombre}» guardada en el Cerebro (Estudio/Plantillas).` : `Plantilla «${p.nombre}» guardada en este navegador (en la oficina va al Cerebro).`);
    } catch (err) { say('No se pudo guardar la plantilla: ' + err.message, true); }
  }
  async function borrarPlantilla() {
    const id = $('.st-plsel').value, p = plantillasL.find(x => x.id === id); if (!p) return;
    try { if (isLive()) await api('DELETE', '/api/media/plantillas/' + encodeURIComponent(id)); else plLocal.set(plLocal.get().filter(x => x.id !== id)); await cargarPlantillas(); $('.st-plsel').focus(); say(`Plantilla «${p.nombre}» borrada${isLive() ? ' (queda en Estudio/Plantillas/.papelera del Cerebro)' : ''}.`); }
    catch (err) { say('No se pudo borrar: ' + err.message, true); }
  }
  /* IMG-12 (6 Oct 2026): what the viewer sends to the composer (Repetir, Animar, Usar de referencia) leaves a way back: «VOLVER A LA IMAGEN» in the toast. */
  let volverA = null;
  function pintarVolver() { const b = $('.st-tback'), f = volverA; b.hidden = !f; if (f) b.onclick = () => { $('.st-toast').hidden = true; lightFile(f); }; }
  function desdeVisor(it, fn) { closeLight(); volverA = it.file; try { fn(); if ($('.st-toast').hidden) toast('Listo en el compositor.', null); else pintarVolver(); } finally { volverA = null; } }
  let toastT = null;
  function toast(text, undo, label = 'DESHACER') {
    const T = $('.st-toast'); T.querySelector('span').textContent = text; T.hidden = false;
    T.querySelector('button').hidden = !undo; T.querySelector('button').textContent = label; T.querySelector('button').onclick = async () => { T.hidden = true; await undo(); };
    pintarVolver(); clearTimeout(toastT); toastT = setTimeout(() => { T.hidden = true; }, 9000);
  }
  async function trashMany(files) {
    const undo = []; let failed = 0;
    for (const f of files) { try { const r = await api('DELETE', '/api/media/item/' + encodeURIComponent(f)); if (r.undo) undo.push(r.undo); } catch { failed++; } }
    items = items.filter(x => !undo.some(u => u.id === x.file)); for (const u of undo) { sel.delete(u.id); known.delete(u.id); gone.add(u.id); } if (undo.length) { total = Math.max(0, total - undo.length); refreshCounts(); }
    for (const r of Object.keys(media)) media[r] = media[r].filter(f => !undo.some(u => u.id === f));
    renderGrid(); renderModel(); closeLight();
    if (!undo.length) return say(`No se pudo mover ${failed === 1 ? 'el archivo' : `ninguno de los ${failed}`} a la papelera.`, true);
    toast(`${undo.length} ${undo.length === 1 ? 'archivo movido' : 'archivos movidos'} a la papelera${failed ? ` · ${failed} no se pudo` : ''}: está en «Papelera», 30 días.`, async () => {
      let back = 0; for (const u of undo) { try { await api('POST', '/api/media/restore', u); back++; gone.delete(u.id); } catch {} }
      await load({ full: false }); say(back === undo.length ? 'Recuperado.' : `Recuperé ${back} de ${undo.length}.`, back !== undo.length);
    });
  }
  /* ---------- V4.6: folders — the strip, dragging onto it, renaming, removing ---------- */
  const FD_ICON = svg('folder');
  function renderFolders() {
    const box = $('.st-folders'); if (!box || (fdEdit && box.contains(document.activeElement) && document.activeElement.classList.contains('st-fdin'))) return; // a name being typed is not redrawn under the caret
    const none = counts ? counts.none : items.filter(it => !inFolder(it)).length; // INF-03: over the whole gallery
    const chip = (id, label, n, extra = '') => `<button type="button" class="st-fd" data-fd="${esc(id)}"${extra}>${label} <b>${n}</b></button>`;
    const html = chip('all', 'Todas', GF.miles(counts ? counts.all : items.length)) + chip('none', 'Sin carpeta', GF.miles(none), ' title="Suelta aquí para sacarlas de su carpeta"') +
      folders.map(f => fdEdit === f.id
        ? `<input class="st-fdin" data-fdr="${esc(f.id)}" value="${esc(f.name)}" maxlength="60" aria-label="Nuevo nombre de la carpeta">`
        : `<span class="st-fdw">${chip(f.id, FD_ICON + esc(f.name), GF.miles(f.n ?? items.filter(it => it.folder === f.id).length), ` title="Carpeta «${esc(f.name)}»: clic para verla, suelta imágenes aquí para guardarlas, doble clic para renombrarla"`)}<button type="button" class="st-fdm" data-fdm="${esc(f.id)}" aria-label="Opciones de la carpeta ${esc(f.name)}" aria-haspopup="menu" title="Renombrar o eliminar">⋯</button></span>`).join('') +
      (fdEdit === 'new' ? `<input class="st-fdin" data-fdnew="1" placeholder="Nombre de la carpeta" maxlength="60" aria-label="Nombre de la carpeta nueva">` : `<button type="button" class="st-fdnew">+ Nueva carpeta</button>`);
    if (box._html !== html) { box._html = html; box.innerHTML = html; const inp = box.querySelector('.st-fdin'); if (inp) { inp.focus(); if (inp.dataset.fdr) inp.select(); } } // the same chips stay the same elements: a double click is not lost to a redraw
    box.querySelectorAll('.st-fd').forEach(b => { const on = b.dataset.fd === folderF; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  function setFolder(id) { folderF = id; store.set('folder', id); closeFdMenu(); requery(); }
  async function moveFiles(files, folder, quiet) { // folder: an id, or null (out of any folder)
    files = files.filter(f => itemOf(f)); if (!files.length) return;
    const prev = new Map(files.map(f => [f, itemOf(f).folder || null]));
    try { const r = await api('POST', '/api/media/move', { files, folder }); folders = r.folders || folders; }
    catch (err) { return say('No se pudo mover: ' + err.message, true); }
    for (const f of files) itemOf(f).folder = folder;
    sel.clear(); selecting = false; renderGrid(); refreshCounts();
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
    const n = f.n ?? items.filter(it => it.folder === id).length; // INF-03: the server's count, past what is loaded
    if (!confirm(`¿Eliminar la carpeta «${f.name}»?\n\n${n ? `Sus ${n} ${n === 1 ? 'archivo no se borra: queda' : 'archivos no se borran: quedan'} en «Sin carpeta».` : 'Está vacía.'}`)) return;
    try { const r = await api('DELETE', '/api/media/folders/' + id); folders = r.folders || folders.filter(x => x.id !== id); for (const it of known.values()) if (it.folder === id) it.folder = null; }
    catch (err) { return say('No se pudo eliminar: ' + err.message, true); }
    if (folderF === id) { folderF = 'all'; store.set('folder', 'all'); requery(); } else refreshCounts();
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
      if (e.target.tagName === 'AUDIO') { e.preventDefault(); return; } // V5.0: moving along a card's player is not dragging the card
      const g = e.target.closest?.('.st-group'), c = e.target.closest?.('.st-card[data-f]');
      const files = c ? (sel.has(c.dataset.f) && sel.size > 1 ? [...sel] : [c.dataset.f]) : g ? items.filter(x => x.job === g.dataset.g).map(x => x.file) : null; // IMG-08: a picture inside a request's card drags alone
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
    renderGrid(); refreshCounts();
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
    let ok = 0, placed = 0; const done = [];
    for (const file of files) {
      const vid = /^video\//.test(file.type), aud = /^audio\//.test(file.type) || /\.(mp3|wav|m4a)$/i.test(file.name); // V5.0: an audio too (to clone a voice, to transcribe), up to 20 MB
      if (!aud && !/^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/.test(file.type)) { say(`«${file.name}»: solo PNG, JPG, WEBP, MP4, WEBM, MP3, WAV o M4A.`, true); continue; }
      if (aud && SV.checkCloneFile(file)) { say(`«${file.name}»: ${SV.checkCloneFile(file)}`, true); continue; }
      const cap = aud ? 20 : vid ? 25 : 12; if (file.size > cap * 1024 * 1024) { say(`«${file.name}» pasa de ${cap} MB.`, true); continue; }
      const slot = aud ? null : role; // an audio is never a frame or a reference — this file only: an image dropped with it still goes in
      say(`Subiendo «${file.name}»…`);
      try {
        const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('no pude leerlo')); fr.readAsDataURL(file); });
        const r = await new Promise((res, rej) => { // V4.2 (audit A16): with a percentage — a 25 MB video used to sit on «Subiendo…»
          const x = new XMLHttpRequest(); x.open('POST', '/api/media/upload'); x.setRequestHeader('content-type', 'application/json');
          x.upload.onprogress = ev => { if (ev.lengthComputable) say(`Subiendo «${file.name}»… ${Math.round(ev.loaded / ev.total * 100)} %`); };
          x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status < 300 ? res(j) : rej(new Error(j.error || x.statusText)); };
          x.onerror = () => rej(new Error('sin conexión con la oficina')); x.send(JSON.stringify({ name: file.name, data, ...(folders.some(f => f.id === folderF) ? { folder: folderF } : {}) }));
        });
        items.unshift(r.item); remember([r.item]); ok++; done.push(r.item);
        if (slot) { addMedia(slot, r.item.file); placed++; }
      } catch (e) { say(`«${file.name}»: ${e.message}`, true); }
    }
    if (ok) { say(`${ok === 1 ? 'Subida' : ok + ' subidas'}${placed ? ` y ${placed === ok ? (ok === 1 ? 'puesta' : 'puestas') : placed === 1 ? '1 puesta' : placed + ' puestas'} en «${roleName(role)}»` : ''}. Están en la pestaña Subidas.`); renderGrid(); refreshCounts(); }
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
  // V4.9: Dimitri uploads a photo or sends creatives while the Estudio is open beside him: the gallery shows it now, not at the next 20-second refresh
  window.addEventListener('ao:media-changed', () => { if (isOn() && $('.st-light').hidden) load({ full: false }); });
  function closeLight() { const L = $('.st-light'); if (L.hidden) return; if (document.fullscreenElement && L.contains(document.fullscreenElement)) document.exitFullscreen?.().catch(() => {}); L.hidden = true; L.innerHTML = ''; lightIdx = -1; lightAt = null; zImg = null; lPanel = null; L.classList.remove('st-zoomed'); modal.close(L); if (lightFrom && document.contains(lightFrom)) lightFrom.focus({ preventScroll: true }); }
  /** Open the viewer on a file, wherever it is: a filter or a folder that hides it is cleared first. */
  async function lightFile(file, o = {}) {
    let i = shown().findIndex(x => x.file === file);
    if (i < 0) { // INF-03: a filter, a folder, a search or simply not loaded yet (an old file): everything, loaded down to it
      filter = 'all'; q = ''; $('.st-q').value = ''; folderF = 'all'; store.set('folder', 'all');
      $('.st-fsel').value = 'all';
      renderGrid(); i = shown().findIndex(x => x.file === file);
      if (i < 0 && location.protocol.startsWith('http')) { await load({ full: false, upto: file }); i = shown().findIndex(x => x.file === file); }
    }
    if (i >= 0) light(i, o);
    return i >= 0;
  }
  /** INF-03: the next one in the viewer; at the end of what is loaded, the next page first. */
  async function lightNext(at) { if (at >= shown().length - 1 && nextCur) await loadMore(); const n = lightPos(); if (n >= 0 && n < shown().length - 1) light(n + 1); }
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
    const img = it.kind !== 'video' && it.kind !== 'audio', cap = SV.soundCaption(it, voices) || {}; // V5.0: a voice or a song: the big player, what is read or sung, and «Repetir con otra voz»
    lPanel =o.panel && (o.panel !== 'edit' || img) ? o.panel : null; lPanelFrom = null;
    const setTxt = it.settings ? Object.entries(it.settings).map(([k, v]) => `${LBL[k] || k}: ${typeof v === 'boolean' ? (v ? 'sí' : 'no') : VAL[v] || v}`).join(' · ') : '';
    const used = it.media ? Object.entries(it.media).flatMap(([r, fs]) => fs.map(f => [r, f])) : [];
    const orig = it.versionOf ? itemOf(it.versionOf) : null, vers = (it.versions || []).map(itemOf).filter(Boolean), pareja = CMP.conSuPareja(it, itemOf); // IMG-14
    // IMG-09 · IMG-48 (6 Oct 2026): the same list as the card — the primary ones as buttons, then «Crear a partir de esta», «Organizar», «Enviar a…»
    const lac = AC.acciones(it, capDe(it)), copiar = { id: 'copy', label: cap.label ? 'Copiar el texto' : 'Copiar prompt', icon: 'note', title: 'Copiar al portapapeles' };
    const lgrupos = lac.grupos.some(g => g.id === 'crear') ? lac.grupos.map(g => (g.id === 'crear' ? { ...g, items: [...g.items, copiar] } : g)) : [{ id: 'crear', titulo: 'Crear a partir de esta', items: [copiar] }, ...lac.grupos];
    const lbtn = (x, pri) => x.id === 'dl' ? `<a href="${src(it)}" download="${esc(dlName(it))}">${svg('down')} Descargar</a>`
      : `<button type="button" data-l="${x.id}"${pri ? ' class="pri"' : ''}${x.id === 'edit' || x.id === 'dept' ? ' aria-expanded="false"' : ''} title="${esc(x.title)}">${pri || lac.primarias.includes(x) ? svg(x.icon) + ' ' : ''}${esc(x.label)}</button>`;
    const tools = it.kind === 'audio' ? '' : `<div class="st-ztools" role="toolbar" aria-label="${img ? 'Zoom' : 'Vista'}">${img ? `<button type="button" data-z="out" aria-label="Alejar (−)" title="Alejar (−)">−</button><span class="st-zpct" aria-label="Tamaño"></span><button type="button" data-z="in" aria-label="Acercar (+)" title="Acercar (+, o la rueda del ratón)">+</button><button type="button" data-z="fit" aria-pressed="true" title="Ajustar: la imagen entera (0)">Ajustar</button><button type="button" data-z="real" aria-pressed="false" title="100 %: un píxel de la imagen, un píxel de la pantalla (doble clic sobre la imagen)">100 %</button>` : ''}<button type="button" data-z="full" aria-pressed="false" aria-label="Pantalla completa (F)" title="Pantalla completa (F)">${svg('full')}<span>Pantalla completa</span></button></div>`;
    L.innerHTML = `<div class="st-lbox"><button type="button" class="st-lx" aria-label="Cerrar" title="Cerrar (Esc)">${svg('x')}</button>
      <div class="st-lmedia">${it.kind === 'audio' ? `<div class="st-laud${cap.badge === 'MÚSICA' ? ' st-aud-mus' : cap.badge === 'VOZ' ? ' st-aud-voz' : ''}"><span class="st-laic" aria-hidden="true">${cap.badge === 'MÚSICA' ? svg('note') : cap.badge === 'VOZ' ? svg('mic') : '♪'}</span>${cap.voice ? `<span class="st-lvoz">Voz: <b>${esc(cap.voice)}</b></span>` : cap.instrumental ? '<span class="st-lvoz">Instrumental</span>' : ''}<audio src="${src(it)}" controls preload="metadata" aria-label="Escuchar: ${esc(short(it.prompt))}"></audio></div>` : `<div class="st-lstage"${it.w && it.h ? ` style="--ar:${+it.w} / ${+it.h}"` : ''}>${it.kind === 'video' ? `<video src="${src(it)}" controls autoplay playsinline></video>` : `<img src="${src(it)}" alt="${esc(String(it.prompt).slice(0, 120))}" draggable="false">`}</div>${tools}`}</div>
      <div class="st-linfo"><div class="st-lpos"><button type="button" class="st-lnav prev" aria-label="Anterior" title="Anterior (←)"${i > 0 ? '' : ' disabled'}>‹</button><span aria-live="polite">${GF.miles((jumped.has(it.file) ? jumped.get(it.file) : i) + 1)} de ${GF.miles(nextCur ? total : list.length)}</span><button type="button" class="st-lnav next" aria-label="Siguiente" title="Siguiente (→)"${i < list.length - 1 || nextCur ? '' : ' disabled'}>›</button></div>
      ${it.versionOf ? `<p class="st-lver">Versión de ${orig ? `<button type="button" class="st-lk" data-vf="${esc(orig.file)}" title="Abrir la original">«${esc(short(orig.prompt))}»</button>` : 'una imagen que ya no está en la galería'}</p>` : ''}
      ${cap.label ? `<h3 class="st-slab st-lslab">${cap.label}</h3>` : ''}<p class="st-lp${cap.label ? ' st-lptext' : ''}">${esc(it.prompt)}</p>
      <p class="st-meta">${it.upload ? 'Subida por ti' : `${esc(it.modelName || it.model || it.provider)} · ${esc(who(it))}`} · ${esc(when(it.at))}${it.w ? ` · ${it.w}×${it.h}` : ''}${it.cost ? ` · ~US$${it.cost}` : ''}</p>
      ${setTxt ? `<p class="st-meta">${esc(setTxt)}</p>` : ''}
      ${used.length ? `<div class="st-lused">${used.map(([r, f]) => `<span title="${esc(ROLE[r] || r)}">${isVid(f) ? svg('vid') : `<img src="${src(f)}" alt="">`}<i>${esc(ROLE[r] || r)}</i></span>`).join('')}</div>` : ''}
      ${vers.length ? `<div class="st-lvers"><h3>Versiones (${vers.length})</h3><div>${vers.map((v, k) => `<button type="button" data-vf="${esc(v.file)}" aria-label="Abrir la versión ${k + 1}: ${esc(short(v.prompt))}" title="${esc(v.prompt)}"><img src="${src(v)}" alt=""></button>`).join('')}</div></div>` : ''}
      <div class="st-lacts">${lac.primarias.map((x, k) => lbtn(x, k === 0)).join('')}<button type="button" class="st-lmas" data-l="mas" aria-label="Más acciones" data-tip="Más acciones">${svg('dots')}</button>${pareja ? `<button type="button" data-l="cmp" title="${esc(pareja.titulo)}, con una cortina">${it.versionOf ? 'Comparar con la original' : 'Comparar con su versión'}</button>` : ''}</div>
      <p class="st-lsay" role="status"></p>
      <div class="st-lpwrap"></div>
      <div class="st-lacts2">${lgrupos.map(g => `<div class="st-lgrp" role="group" aria-labelledby="stLg${g.id}"><span class="st-lgt" id="stLg${g.id}">${esc(g.titulo)}</span>${g.items.map(x => lbtn(x)).join('')}</div>`).join('')}</div>
      <button type="button" class="st-ldel" data-l="del">${svg('trash')} Mover a la papelera</button></div></div>`;
    wireZoom(img ? L.querySelector('.st-lstage img') : null); zPaint();
    if (lPanel) paintPanel(it); else L.querySelector('.st-lx').focus();
    L.onclick = e => {
      if (e.target === L || e.target.closest('.st-lx')) return closeLight();
      const at = lightPos() < 0 ? i : lightIdx;
      if (e.target.closest('.st-lnav.prev') && at > 0) { light(at - 1); L.querySelector('.st-lnav.prev')?.focus(); return; }
      if (e.target.closest('.st-lnav.next') && (at < shown().length - 1 || nextCur)) { lightNext(at).then(() => L.querySelector('.st-lnav.next')?.focus()); return; }
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
      if (a === 'copy') { const btn = e.target.closest('button'); (navigator.clipboard ? navigator.clipboard.writeText(it.prompt) : Promise.reject()).then(() => { btn.textContent = 'Copiado ✓'; }, () => { btn.textContent = 'No se pudo copiar'; }).finally(() => setTimeout(() => { if (document.contains(btn)) btn.textContent = cap.label ? 'Copiar el texto' : 'Copiar prompt'; }, 1600)); }
      if (a === 'othervoice') { closeLight(); otherVoice(it); }
      if (a === 'edit' || a === 'dept') setPanel(it, a, e.target.closest('button'));
      if (a === 'dimitri' && ctx.askDimitri) { closeLight(); ctx.askDimitri([it.file]); }
      if (a === 'vary') { const b = e.target.closest('button'); vary(it, { btn: b, decir: (t, malo) => { const o = L.querySelector('.st-lsay'); if (o) { o.textContent = t; o.classList.toggle('err', !!malo); } } }); } // IMG-12: Variar stays in the viewer
      if (a === 'again') desdeVisor(it, () => reuse(it));
      if (a === 'anim') desdeVisor(it, () => animate(it));
      if (a === 'ref') desdeVisor(it, () => useAsRef(it));
      if (a === 'mas') { const g = L.querySelector('.st-lacts2'); g.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); g.querySelector('button')?.focus({ preventScroll: true }); } // IMG-53
      if (a === 'cal' && ctx.toCalendar) { closeLight(); learn(it.file, 'calendario'); ctx.toCalendar(it.file, it.kind, it.prompt); }
      if (a === 'fav') favMany([it.file]).then(() => { const k = lightPos(); if (k >= 0) light(k); });
      if (a === 'del') trashMany([it.file]);
      if (a === 'task') { closeLight(); close(); ctx.openTask(it.task); }
      if (a === 'move') { closeLight(); moverA(it); }
      if (a === 'preset') { closeLight(); presetDe(it); }
      if (a === 'cmp') { const p = CMP.conSuPareja(it, itemOf); if (p) { closeLight(); comparar(p.items, p.titulo); } }
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
    if (e.key === 'ArrowRight' && at >= 0 && (at < shown().length - 1 || nextCur)) return lightNext(at);
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
    const mo = e.target.closest('.st-mo'); if (mo && !mo.disabled) { $('.st-keyhelp').hidden = true; if (mo.dataset.id === 'auto') { auto = true; store.set('auto.image', true); aplicarAuto(); openList(false); renderPick(); renderModel(); $('.st-mpick').focus(); return; } if (basico()) { auto = false; store.set('auto.image', false); } modelOf[kind] = mo.dataset.id; store.set('model.' + kind, mo.dataset.id); /* IMG-36: a model chosen by hand turns «Automático» off */ openList(false); renderPick(); renderModel(); $('.st-mpick').focus(); return; }
    const nvb = e.target.closest('[data-nivel]'); if (nvb) { setNivel(nvb.dataset.nivel); if (!nvb.offsetParent) [...el.querySelectorAll('.st-nivel [data-nivel]')].find(b => b.offsetParent)?.focus(); return; } // Fase 6: the pressed one may hide (Básico shows only «Avanzado»): the focus is not lost
    if (e.target.closest('.st-armas')) { verMasFormatos = !verMasFormatos; renderModel(); $('.st-armas')?.focus(); return; } // IMG-33
    if (e.target.closest('.st-addimg')) { // IMG-38: «Imagen» beside the idea: a reference, like attaching it in a chat
      if (basico() && auto) { aplicarAuto(1); renderPick(); renderModel(); }
      const m = cur(); if (!m || !m.roles.reference) return say(m ? `${m.name} no acepta imágenes: elige «Automático» u otro modelo en «Modelo».` : 'Elige antes un modelo.', true);
      uploadRole = 'reference'; $('.st-file').accept = 'image/png,image/jpeg,image/webp'; $('.st-file').click(); return;
    }
    const sg = e.target.closest('[data-sug]'); if (sg) { const S_ = $('.st-sug'); if (sg.dataset.sug === 'usar') { prevPrompt = $('.st-prompt').value; $('.st-prompt').value = S_.dataset.p || ''; $('.st-undo-enh').hidden = false; say('Usando la propuesta. «Volver al mío» lo deshace.'); if (aplicarAuto()) { renderPick(); renderModel(); } estimate(); } S_.hidden = true; $('.st-prompt').focus(); return; } // IMG-35
    const arb = e.target.closest('[data-ar]'); if (arb) { setSetting('aspectRatio', arb.dataset.ar); renderModel(); return; }
    const qcb = e.target.closest('[data-qset]'); if (qcb) { setSetting(qcb.dataset.qset, qcb.dataset.v); renderModel(); el.querySelector(`[data-qset="${qcb.dataset.qset}"][data-v="${CSS.escape(qcb.dataset.v)}"]`)?.focus(); return; }
    const qnb = e.target.closest('[data-qty]'); if (qnb) { qty = +qnb.dataset.qty || 1; estimate(); el.querySelector(`[data-qty="${qty}"]`)?.focus(); return; }
    if (e.target.closest('.st-fold')) { el.classList.add('st-folded'); store.set('fold', true); relayout(); $('.st-unfold').focus(); return; }
    if (e.target.closest('.st-unfold')) { el.classList.remove('st-folded'); store.set('fold', false); relayout(); $('.st-prompt').focus(); return; }
    if (e.target.closest('.st-open-engs, .st-engbtn')) { cerrarMas(); openEngs(); return; } // IMG-50: the engines, in their own panel (they were at the bottom of the composer)
    if (!e.target.closest('.st-gmas')) cerrarMas(false);
    if (e.target.closest('.st-histbtn')) { cerrarMas(false); openHist(); return; }
    if (e.target.closest('.st-binbtn')) { cerrarMas(false); openBin(); return; }
    if (e.target.closest('.st-vopen, .st-vcta')) { openVoices(); return; } // V5.0 · EST-14: also from step 1 when Voz is chosen
    const lt = e.target.closest('[data-ltag]'); if (lt) { insertTag(lt.dataset.ltag); return; }
    const md = e.target.closest('[data-mode]'); if (md) { setMode(md.dataset.mode); $('.st-prompt').focus(); return; }
    if (e.target.closest('.st-new')) { const antes = fotoBorrador(); $('.st-prompt').value = ''; media = { start: [], end: [], reference: [], video: [] }; prevPrompt = null; $('.st-undo-enh').hidden = true; $('.st-es').hidden = true; clearFieldErr(); armed = false; renderModel(); $('.st-prompt').focus(); if (BR.vacio(antes)) say('El compositor ya estaba vacío.'); else { borrador.guardar(antes); say(''); toast('Compositor vacío: empieza una idea nueva.', () => volverBorrador(borrador.deshacer())); } return; } // IMG-10: «Vaciar», with DESHACER
    const qd = e.target.closest('.st-qty [data-d]'); if (qd) { const max = kind === 'video' ? 4 : (budget && budget.maxPerRequest) || 8; qty = Math.max(1, Math.min(max, qty + +qd.dataset.d)); estimate(); return; }
    if (e.target.closest('.st-upbtn')) { uploadRole = null; $('.st-file').click(); return; }
    if (e.target.closest('.st-selbtn')) { selecting = !(selecting || sel.size); if (!selecting) sel.clear(); renderGrid(); return; }
    if (e.target.closest('.st-retry')) { load(); return; }
    if (e.target.closest('.st-all')) { q = ''; $('.st-q').value = ''; folderF = 'all'; store.set('folder', 'all'); filter = 'all'; $('.st-fsel').value = 'all'; requery(); return; } // INF-03: everything, the search too
    if (e.target.closest('.st-morebtn')) { loadMore(); return; }
    const sl = e.target.closest('[data-slot]'); if (sl) { uploadRole = sl.dataset.slot; $('.st-file').accept = uploadRole === 'video' ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp'; $('.st-file').click(); return; }
    if (e.target.closest('.st-plsave')) { const f = $('.st-plform'); f.hidden = !f.hidden; if (!f.hidden) { const sel_ = plantillasL.find(x => x.id === $('.st-plsel').value); $('.st-plname').value = sel_ ? sel_.nombre : ''; $('.st-plname').focus(); } return; } // IMG-46
    if (e.target.closest('.st-plok')) { guardarPlantilla($('.st-plname').value); return; }
    if (e.target.closest('.st-plno')) { $('.st-plform').hidden = true; $('.st-plsave').focus(); return; }
    if (e.target.closest('.st-pldel')) { borrarPlantilla(); return; }
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
      if (b === 'cmp') comparar(files.map(itemOf)); // IMG-14
      if (b === 'lote') editarEnLote(files); // banco de presets F2 (§6.1): «Editar en lote…»
      return;
    }
    if (e.target.closest('.st-enh')) {
      const p = $('.st-prompt').value.trim(); if (!p) { $('.st-prompt').focus(); return say('Escribe primero la idea, aunque sea corta.', true); }
      if (!isLive()) return say('Mejorar el prompt necesita la oficina real.', true);
      const b = $('.st-enh'); b.disabled = true; b.querySelector('span').textContent = 'Pensando…';
      try { const lang = basico() ? 'es' : $('.st-lang').value; const r = await api('POST', '/api/media/enhance', { prompt: p, kind, lang });
        if (basico()) { const S_ = $('.st-sug'); S_.dataset.p = r.prompt; S_.querySelector('.st-sugt').textContent = r.prompt; S_.hidden = false; say(''); S_.querySelector('[data-sug="usar"]').focus(); } else { prevPrompt = p; $('.st-prompt').value = r.prompt; $('.st-undo-enh').hidden = false;
        const es = $('.st-es'); es.hidden = !(r.lang === 'en' && r.es); es.querySelector('span').textContent = r.es || '';
        say(r.lang === 'en' ? 'Prompt mejorado, en inglés (los motores lo entienden mejor). Debajo tienes lo que dice en español; «Volver al mío» lo deshace.' : 'Prompt mejorado, en español. «Volver al mío» lo deshace.'); estimate(); } } // IMG-35: in Básico it is a suggestion, in Spanish, that the owner takes or leaves
      catch (err) { say(err.message, true); }
      b.disabled = false; b.querySelector('span').textContent = 'Mejorar el prompt'; return;
    }
    if (e.target.closest('.st-undo-enh')) { if (prevPrompt != null) $('.st-prompt').value = prevPrompt; prevPrompt = null; $('.st-undo-enh').hidden = true; $('.st-es').hidden = true; return; }
    if (e.target.closest('.st-go')) {
      if (bancoManda()) { banco.generar(); return; } // with presets (Avanzado), GENERAR is the bank's (its plan and its cost); a plan that cannot run lights up what is missing (IMG-41)
      if (!isLive()) return say('El Estudio necesita la oficina real (ábrela con el iniciador).', true);
      const m = cur(); if (!m) { const o = offModel(); return o ? keyHelp(o) : say('Elige un modelo.', true); } // V5.0: Voz / Música without the key say how to switch it on
      const miss = (m.needs || []).find(r => !media[r].length); if (miss) return fieldErr('slot', `${m.name} necesita «${roleName(miss)}»: súbela o elígela de la galería.`);
      const ps = mode === 'batch' ? lines() : [$('.st-prompt').value.trim()].filter(Boolean);
      if (!ps.length && !(m.needs || []).includes('video')) return fieldErr('prompt', mode === 'batch' ? 'Escribe al menos una idea: una por línea.' : kind === 'audio' ? 'Escribe el texto que leerá la voz.' : kind === 'music' ? (settingsOf(m).instrumental ? 'Describe la música: género, ánimo, instrumentos.' : 'Escribe la letra (o marca «Instrumental» y descríbela).') : 'Escribe qué quieres crear: qué se ve, el estilo, la luz.');
      if (sound()) { const lim = limitNow(), len = $('.st-prompt').value.trim().length; if (len > lim) return fieldErr('prompt', `${m.name} lee como mucho ${SV.num(lim)} caracteres: sobran ${(len - SV.num(lim))}.`); }
      if (kind === 'audio' && m.settings.voiceId && !String(settingsOf(m).voiceId || '').trim()) { ($('.st-vsel') || $('.st-vid'))?.focus(); return say(`Elige una voz en «${$('.st-s5t').textContent}».`, true); }
      const c = estimate(); if (!okCosto(c)) return; // V4.2 (audit A10): from US$0.50 · IMG-01: the same gate for Variar
      const sig = JSON.stringify([ps, m.id, settingsOf(m), media, qty]); // V4.2 (audit A13): the same request twice in a row asks for a second click
      if (sig === lastSig && Date.now() - lastAt < 10 * 60e3 && !armed) { armed = true; say('Es lo mismo que acabas de generar. Pulsa GENERAR otra vez para repetirlo, o cambia algo.', true); return; }
      armed = false; lastSig = sig; lastAt = Date.now();
      return generate(ps.length ? ps : ['']);
    }
    const kh = e.target.closest('[data-kh]'); if (kh) {
      const K = $('.st-keyhelp'); K.hidden = true;
      if (kh.dataset.kh === 'test' && K.dataset.test) { modelOf[kind] = K.dataset.test; renderPick(); renderModel(); say('Con el motor de prueba: gratis, tarjetas de muestra para ver el flujo. Pulsa GENERAR.'); $('.st-go').focus(); }
      if (kh.dataset.kh === 'engs') openEngs();
      return;
    }
    const fr = e.target.closest('[data-free]'); if (fr) { modelOf[kind] = fr.dataset.free; store.set('model.' + kind, fr.dataset.free); renderPick(); renderModel(); renderGrid(); showPane('gen'); $('.st-prompt').focus(); say('Con el motor de prueba: gratis, tarjetas de muestra para ver el flujo. Escribe la idea y pulsa GENERAR.'); return; } // IMG-05
    if (e.target.closest('[data-refpass]')) { const ok = banco.anadirRefs(media.reference); media.reference = media.reference.filter(f => !ok.includes(f)); renderModel(); bancoState(); say(ok.length ? `${ok.length === 1 ? 'Pasé tu referencia' : `Pasé ${ok.length} referencias`} a «Referencias» de los presets${media.reference.length ? ` (caben 3: ${media.reference.length} se quedan fuera)` : ''}.` : 'Las referencias de los presets ya están completas (caben 3).', !ok.length); return; } // IMG-39
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
        if (a === 'other' && jj) { reuse({ prompt: jj.prompt, model: jj.model, settings: jj.s, media: jj.media, kind: jj.kind, wanted: jj.wanted }, true); showPane('gen'); openList(true); say('Mismo pedido en el compositor: elige otro modelo y pulsa GENERAR.'); return; } // IMG-04: the fix the error points at
      } catch (err) { say(err.message, true); }
      renderGrid(); watch(); return;
    }
    const gc = e.target.closest('.st-group'); if (gc && !e.target.closest('.st-card[data-f]')) { // IMG-08: a picture inside a request's card acts as its own card
      const its = items.filter(x => x.job === gc.dataset.g);
      const ga = e.target.closest('[data-ga]')?.dataset.ga;
      if (ga === 'split') { expanded.add(gc.dataset.g); renderGrid(); el.querySelector(`.st-card[data-f="${CSS.escape(its[0]?.file || '')}"] .st-thumb`)?.focus(); }
      if (ga === 'zip') zip(its.map(x => x.file));
      return;
    }
    const cd = e.target.closest('.st-card[data-f]'); if (!cd) return;
    const it = itemOf(cd.dataset.f); if (!it) return;
    if (picking) { // choosing a file for a slot
      e.preventDefault();
      if (typeof picking === 'object') { if (/\.(mp4|webm|mp3|wav|flac|m4a|ogg)$/i.test(it.file)) return say('Ahí va una imagen.', true); const p = picking; picking = null; renderSel(); learn(it.file, 'ref'); say(''); p.take(it.file); showPane('gen'); return; } // the bank's own slots (tu foto, una referencia)
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
    if (a === 'othervoice') otherVoice(it); // V5.0
    if (a === 'edit') lightFile(it.file, { panel: 'edit' }); // V4.9: Editar opens the viewer with its small panel
    if (a === 'dept') lightFile(it.file, { panel: 'dept' });
    if (a === 'dimitri' && ctx.askDimitri) ctx.askDimitri([it.file]);
    if (a === 'preset') presetDe(it); // banco de presets: «Guardar como preset» (§7.4)
    if (a === 'move') moverA(it);
    if (a === 'task' && it.task && ctx.openTask) { close(); ctx.openTask(it.task); } // V4.2 (audit A25)
  });
  el.addEventListener('change', e => {
    if (e.target.classList.contains('st-lang')) { store.set('lang', e.target.value); return; }
    if (e.target.classList.contains('st-fsel')) { filter = e.target.value; requery(); return; } // IMG-23
    if (e.target.classList.contains('st-plsel')) { const p = plantillasL.find(x => x.id === e.target.value); $('.st-pldel').hidden = !p; if (p) aplicarPlantilla(p); return; } // IMG-46

    if (e.target.classList.contains('st-file')) { const fs = [...e.target.files]; e.target.value = ''; e.target.accept = 'image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.m4a'; uploadFiles(fs, uploadRole); uploadRole = null; return; }
    if (e.target.matches?.('[data-msort], [data-mmaker]')) { store.set(e.target.hasAttribute('data-msort') ? 'msort' : 'mmaker', e.target.value); const qv = $('.st-mq input')?.value || ''; renderList(qv); $(e.target.hasAttribute('data-msort') ? '[data-msort]' : '[data-mmaker]')?.focus(); return; }
    if (e.target.classList.contains('st-vsel')) { if (e.target.value) setVoice(e.target.value); return; } // V5.0: a voice from the list fills the field
    if (e.target.classList.contains('st-vid')) { setVoice(e.target.value.trim()); return; }
    const k = e.target.dataset?.set; if (k && cur()) { setSetting(k, e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value); if (k === 'instrumental') paintStep3(); if (k === 'aspectRatio') renderModel(); else estimate(); }
  });
  el.addEventListener('input', e => {
    if (e.target.classList.contains('st-prompt')) { clearFieldErr(); if (prevPrompt == null) $('.st-es').hidden = true; if (VB() && e.target.value === '/') { e.target.value = ''; setNivel('avanzado'); banco.abrir('banco'); return; } if (bancoManda()) banco.replan(); if (aplicarAuto()) { renderPick(); renderModel(); } } // «/» at the start opens the bank (§7.1); the idea goes into its plan
    if (e.target.closest('.st-mq')) { const v = e.target.value; renderList(v); const i = $('.st-mq input'); i.focus(); i.setSelectionRange(v.length, v.length); return; }
    if (e.target.type === 'range' && e.target.dataset.set && cur()) { const o = e.target.parentElement.querySelector('output'); if (o) o.textContent = e.target.value + (e.target.dataset.set === 'duration' ? ' s' : ''); setSetting(e.target.dataset.set, +e.target.value); }
    if (e.target.classList.contains('st-q')) { q = e.target.value; requery(250); return; } // INF-03: the server searches the whole gallery
    if (e.target.classList.contains('st-vid')) { const v = e.target.value.trim(); setSetting('voiceId', v); $('#stVidH').textContent = voiceHint(v); } // V5.0: the hint says whose voice it is while typing
    if (e.target.closest('.st-vocov')) return; // the Voces panel's own fields
    estimate();
  });
  // drop files: on a slot they go into it, anywhere else they are uploaded to the gallery
  // IMG-38 (6 Oct 2026): dropped on the idea, a picture (from the computer or the gallery) is a reference; anywhere else it is uploaded
  const enIdea = e => e.target.closest && e.target.closest('.st-pwrap') && !$('.st-gen').hidden && kind === 'image';
  el.addEventListener('dragover', e => { const pw = $('.st-pwrap'), aqui = enIdea(e); pw.classList.toggle('st-dropref', !!aqui); if (aqui && dragFiles) e.preventDefault(); if (!dragFiles && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); el.classList.toggle('st-drop', !aqui); } });
  el.addEventListener('dragleave', e => { if (e.target === el || !el.contains(e.relatedTarget)) el.classList.remove('st-drop'); });
  el.addEventListener('drop', e => {
    const aqui = enIdea(e); $('.st-pwrap').classList.remove('st-dropref');
    if (aqui && (dragFiles || e.dataTransfer?.files?.length) && basico() && auto) { aplicarAuto(1); renderPick(); renderModel(); }
    if (aqui && dragFiles) { e.preventDefault(); const fs = dragFiles.filter(f => !isVid(f) && !/\.(mp3|wav|m4a)$/i.test(f)); let n = 0; for (const f of fs) if (addMedia('reference', f)) { n++; learn(f, 'ref'); } say(n ? `${n === 1 ? 'Imagen puesta' : `${n} imágenes puestas`} de referencia.` : 'Este modelo no acepta imágenes: elige «Automático» u otro.', !n); return; }
    if (dragFiles || !e.dataTransfer?.files?.length) return; e.preventDefault(); el.classList.remove('st-drop'); const slot = e.target.closest('.st-slot'); uploadFiles([...e.dataTransfer.files], slot ? slot.dataset.role : aqui && cur()?.roles.reference ? 'reference' : null);
  });
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
    if (!typing && ignorarTecla(e) && !e.target.closest('.st-menu, .st-mlist, .st-ars, .bk-lista, [role="listbox"], [role="menu"]')) return; // IMG-26: the owner turned single-key shortcuts off (a key inside a widget still moves in it)
    if (!typing && (e.key === '?' || (e.key === '/' && e.shiftKey))) return; // V4.2 (audit A48): the shortcuts sheet opens over the Estudio too
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && /^[epgonu,]$/i.test(e.key) && $('.st-light').hidden && $('.st-hist').hidden && $('.st-binov').hidden && $('.st-vocov').hidden && $('.st-engov').hidden && !el.querySelector('.st-menu:not([hidden])')) return; // V4.5: the dock's keys reach the office — P and G switch views, O N U , open a window on top
    e.stopPropagation();
    if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && $('.st-light').hidden && $('.st-hist').hidden && $('.st-binov').hidden && $('.st-vocov').hidden && $('.st-engov').hidden && !el.querySelector('.st-menu:not([hidden])')) { // V4.2 (audit A47)
      if (e.key === '/') { e.preventDefault(); showPane('gal'); $('.st-q').focus(); return; }
      if (e.key === 'i' || e.key === 'I') { setKind('image'); return; }
      if (e.key === 'v' || e.key === 'V') { setKind('video'); return; }
      if ((e.key === 'l' || e.key === 'L') && !el.classList.contains('st-pickmode')) { showPane(el.dataset.pane === 'lotes' ? 'gen' : 'lotes'); return; } // banco de presets F2: the Lotes tab (and back)
      if (el.dataset.pane === 'lotes' && /^[ivb/]$/i.test(e.key)) return; // the composer's keys stay in the composer
      if ((e.key === 'b' || e.key === 'B') && !el.classList.contains('st-pickmode')) { if (!VB()) setKind('image'); const era = nivel; setNivel('avanzado'); showPane('gen'); banco.toggle(); if (era !== 'avanzado') toast('Pasaste a Avanzado: aquí vive el banco de presets.', () => setNivel('basico'), 'VOLVER A BÁSICO'); return; } // IMG-47 // banco de presets (§7.1): it lives in Avanzado
    }
    if (!$('.st-hist').hidden) { if (e.key === 'Escape') closeHist(); return; }
    if (!$('.st-binov').hidden) { if (e.key === 'Escape') closeBin(); return; }
    if (!$('.st-engov').hidden) { if (e.key === 'Escape') closeEngs(); return; }
    if (!$('.st-cmpov').hidden) { if (e.key === 'Escape') closeCmp(); return; }
    if (!$('.st-vocov').hidden) { if (e.key === 'Escape') { e.preventDefault(); voicesEscape(); } return; } // V5.0: a row asking «¿Borrar?» says no first; then the panel closes
    const om = el.querySelector('.st-menu:not([hidden])');
    if (om) { // the open «⋯» menu: arrows move, Esc and Tab close it, back on its button
      const its = [...om.querySelectorAll('[role="menuitem"]')].filter(x => x.offsetParent), i = its.indexOf(document.activeElement), btn = om.closest('.st-card')?.querySelector('.st-more');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]?.focus(); return; }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); its[e.key === 'Home' ? 0 : its.length - 1]?.focus(); return; }
      if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); closeMenus(); btn?.focus(); if (e.key === 'Escape') return; }
    }
    const arg = e.target.closest && e.target.closest('.st-ars'); // IMG-28: the formats are one stop for Tab; the arrows move and choose
    const qg = e.target.closest && e.target.closest('.st-qch'); // 6 Oct 2026: quality and quantity buttons, one Tab stop, the arrows choose
    if (qg && ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const bs = [...qg.querySelectorAll('button')], i = bs.indexOf(e.target.closest('button')); const n = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs[n].click(); return; }
    if (arg && ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const bs = [...arg.querySelectorAll('[data-ar]')].filter(b => b.offsetParent), i = bs.indexOf(e.target.closest('[data-ar]')); const n = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; setSetting('aspectRatio', bs[n].dataset.ar); renderModel(); el.querySelector(`.st-ars [data-ar="${CSS.escape(bs[n].dataset.ar)}"]`)?.focus(); return; }
    const inList = e.target.closest && e.target.closest('.st-mlist');
    if (inList && e.target.tagName !== 'SELECT' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { // V4.2 (audit A7): the model list moves with the arrows, like a real list
      const opts = [...inList.querySelectorAll('.st-mo:not([disabled])')], i = opts.indexOf(document.activeElement); e.preventDefault();
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? opts.length - 1 : i < 0 ? (e.key === 'ArrowDown' ? 0 : opts.length - 1) : Math.max(0, Math.min(opts.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      if (e.key === 'ArrowUp' && i === 0) inList.querySelector('input').focus(); else opts[n]?.focus();
      return;
    }
    if (!$('.st-light').hidden) { lightKey(e, typing); return; } // V4.9: + − 0 F, and the panel
    if (e.key === 'Escape') {
      if (cerrarMas(true)) return; // IMG-23: the gallery's «⋯» first
      if (!$('.st-mlist').hidden) { openList(false); $('.st-mpick').focus(); return; }
      if (banco.abierto() && !picking) { banco.cerrar(); return; } // the bank's sheet first, back on its button
      if (e.target.matches('input[type=search], textarea') && e.target.value && e.target.classList.contains('st-q')) { e.target.value = ''; q = ''; requery(); return; } // Esc empties the search first
      if (typing) { e.target.blur(); return; } // IMG-06: in a field, Esc only leaves the field; a second Esc closes the Estudio
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
    const nOf = k => ok.filter(j => (k === 'image' ? !['video', 'audio', 'music'].includes(j.kind) : j.kind === k)).reduce((s, j) => s + (j.items ? j.items.length : 1), 0);
    const per = Object.fromEntries(SV.KINDS.map(k => [k, nOf(k)])), total = SV.KINDS.reduce((s, k) => s + per[k], 0); // V5.0: voices and songs too
    const parts = SV.KINDS.filter(k => per[k]).map(k => SV.countOf(k, per[k]));
    if (!parts.length && !bad.length) return;
    unseen += total + bad.length; setDock();
    const agent = ok.find(fromBots), fem = !per.video && !per.audio; // «2 imágenes listas», «1 video listo»
    note.querySelector('span').textContent = `Estudio: ${parts.length ? `${parts.join(' y ')} ${fem ? (total === 1 ? 'lista' : 'listas') : total === 1 ? 'listo' : 'listos'}${agent ? ` (de ${who(agent)})` : ''}` : ''}${parts.length && bad.length ? ' · ' : ''}${bad.length ? `${bad.length} no se ${bad.length === 1 ? 'pudo' : 'pudieron'}` : ''}.`;
    note.hidden = false; clearTimeout(noteT); noteT = setTimeout(hideNote, 12000);
  }
  function bgPoll() {
    clearTimeout(bgT);
    bgT = setTimeout(async () => {
      if (el.hidden && isLive() && location.protocol.startsWith('http') && !document.hidden) {
        try { const r = await api('GET', '/api/media/jobs'); jobs = r.jobs || []; budget = r.budget || budget;
          const fresh = jobs.filter(j => (j.state === 'done' || j.state === 'failed') && (j.doneAt || 0) > seenAt);
          if (fresh.length) { seenAt = Math.max(...fresh.map(j => j.doneAt)); tellFinished(fresh); fresh.forEach(j => vivos.delete(j.id)); } } catch {}
      }
      bgPoll();
    }, 15000);
  }
  bgPoll();
  const phone = () => matchMedia('(max-width: 760px)').matches;
  function showPane(p) { // on a phone one pane at a time; on a wider screen both are always there. «Lotes» (F2) replaces both, on any screen
    const was = el.dataset.pane; el.dataset.pane = p;
    el.querySelectorAll('[data-pt]').forEach(b => b.setAttribute('aria-selected', b.dataset.pt === p || (b.dataset.pt === 'gen' && p === 'gal' && !phone()))); // on a wide screen «Crear y galería» is one tab
    $('.st-body').hidden = p === 'lotes'; $('.st-lotes').hidden = p !== 'lotes';
    if (p === 'lotes' && was !== 'lotes') lotesUI?.abrir();
    if (p === 'gal' || (p === 'gen' && was === 'lotes')) relayout();
  }
  showPane('gen');
  /* V4.7: «para la pieza» — the calendar opened the Estudio to make (or pick) the pictures of one piece */
  const forBar = $('.st-forpiece');
  function paintFor() {
    if (!pickFor) { forBar.hidden = true; forBar.innerHTML = ''; el.classList.remove('st-for'); if (typeof renderGrid === 'function') renderGrid(); return; }
    const n = pickFor.ids.length;
    forBar.hidden = false; el.classList.add('st-for');
    const w = forW(); forBar.innerHTML = `<span>${w.para} <b>«${esc(pickFor.target.titulo)}»</b> · ${n ? `${n} ${n === 1 ? 'elegida' : 'elegidas'}` : `crea algo o elige de la galería y pulsa «Usar ${w.en}»`}</span><span class="sp"></span><button type="button" data-f="back" class="pri">Volver ${w.a}${n ? ` (${n})` : ''}</button><button type="button" data-f="no">Cancelar</button>`;
    renderGrid();
  }
  forBar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !pickFor) return; const p = pickFor; pickFor = null; paintFor();
    if (b.dataset.f === 'back') p.onPick(p.ids); else say(p.target?.para === 'anuncio' ? 'Sin cambios en el anuncio.' : 'Sin cambios en la pieza.');
  });
  let timer = null;
  el.classList.toggle('st-folded', !!store.get('fold', false));
  const isOn = () => document.body.classList.contains('studioOpen'); // not el.hidden: that waits 220 ms for the fade after close
  let hideT = 0;
  function open() { if (isOn()) return; clearTimeout(hideT); views.opening('studio'); if (!store.get('subSeen', false)) setTimeout(() => store.set('subSeen', true), 1000); unseen = 0; setDock(); hideNote(); seenAt = Date.now(); opener = document.activeElement; el.hidden = false; modal.open(el); document.body.classList.add('studioOpen'); requestAnimationFrame(() => el.classList.add('on')); load(); cargarPlantillas(); if (avanzado()) banco.preparar(); /* Básico never brings the bank */ timer = setInterval(() => { if (!busy && $('.st-light').hidden && $('.st-mlist').hidden) load({ full: false }); }, 20000); setTimeout(() => { if (document.body.classList.contains('studioOpen')) $('.st-prompt').focus(); }, 60); } // closed again before the timer: the focus must not land in a hidden window
  function close(o = {}) { if (!isOn()) return; if (pickFor) { pickFor = null; paintFor(); } seenAt = Date.now(); closeLight(); closeHist(); closeBin(); closeCmp(); closeVoices(true); if (el.contains(document.activeElement)) document.activeElement.blur(); modal.close(el); el.classList.remove('on'); document.body.classList.remove('studioOpen'); clearInterval(timer); clearTimeout(jtimer); jtimer = null; picking = null; openList(false); hideT = setTimeout(() => { el.hidden = true; }, 220); if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  views.add('studio', { isOpen: isOn, close });
  // INF-03: Ctrl+K opens a file of the gallery in the viewer, or the gallery with its search (src/search.js)
  window.addEventListener('ao:studio-show', e => {
    const d = e.detail || {}; e.preventDefault();
    if (d.file) { open(); showPane('gal'); lightFile(d.file).then(ok => { if (!ok) say('Ese archivo ya no está en la galería (¿en la papelera?).', true); }); return; }
    open(); showPane('gal'); if (typeof d.q === 'string') { q = d.q; $('.st-q').value = d.q; requery(); }
  });
  return { open, close, toggle: () => (isOn() ? close() : open()), isOpen: isOn,
    /** V4.7: open the Estudio for one piece of content; `onPick(ids)` gets the gallery files chosen when the owner goes back to it. */
    forTarget(target, onPick) { pickFor = { target, onPick, ids: [] }; open(); showPane('gal'); paintFor(); },
    /** V4.9: what the owner is looking at, for Dimitri's «Viendo: …» — the picture in the viewer, the selected ones, the open folder, or nothing. */
    selection() {
      const it = !$('.st-light').hidden && lightAt ? itemOf(lightAt) : null; // the file the viewer shows, never shown()[lightIdx]: a job that ends while it is open reorders the gallery
      if (it) return { view: 'studio', label: `${it.kind === 'video' ? 'Video' : it.kind === 'audio' ? 'Audio' : 'Imagen'} «${short(it.prompt)}»`, kind: it.kind === 'video' ? 'video' : it.kind === 'audio' ? 'audio' : 'image', id: it.file }; // auditoría DIM-09: a video or an audio is not offered to Dimitri's vision as a picture
      const ids = [...sel].filter(f => itemOf(f));
      if (ids.length) return { view: 'studio', label: `${ids.length} ${ids.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'} en el Estudio`, kind: 'images', ids };
      if (folders.some(f => f.id === folderF)) return { view: 'studio', label: `Carpeta «${folderName(folderF)}» del Estudio`, kind: 'folder', folder: folderF, folderName: folderName(folderF) };
      return { view: 'studio', label: 'Estudio · galería', kind: null };
    },
    /** V4.9: open the Estudio and its viewer on one file (a thumbnail in Dimitri's chat, a deliverable…). */
    async openFile(file) { open(); showPane('gal'); if (!(await lightFile(file))) say('Ese archivo ya no está en la galería (¿en la papelera?).', true); } };
}

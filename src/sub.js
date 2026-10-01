// Agents Office — DIMITRI's chat (the page side of sub.mjs; «Subgerente» until 24 Sep 2026). A panel on the left, under the
// top bar: with a view open (Estudio, calendar, Contenido, Analíticas, Brain) the view moves over and stays usable beside it
// (src/css/dimitri.css); under 900 px it takes the whole screen and is a window (modal.js). Dimitri talks, reports the state,
// thinks a decision through with the owner, asks when a fact is missing — and only when there is work to hand out answers with
// a distribution plan as editable cards (department, instructions for the lead, include or skip, a date, the whole team or one
// desk); SEND hands each piece to its department. Sent pieces follow their task live: pending, running, waiting for the OK, done.
// V4.8 (30 Sep 2026): the 6th mode, «estudio» — a plan of creatives (src/sub-studio.js) that nothing generates until GENERAR;
// images in the chat (📎, drop, paste: up to 4; each one goes to the gallery as it is and a reduced copy goes to Claude's
// vision); and the chip «Viendo: …» — what the open view has selected travels with the message unless the owner removes it.
//
//   initSub(ctx) → { open({attach?, text?}), close, toggle, isOpen, isWindow (under 900 px it is a window over the view) }
//   ctx: isLive() · esc · DEPTS · DEPT_KEYS · findBySid(id) · openTask(t) · afterSend() (poll the office now) · agentName(id)
//        getContext() → {view, label, kind, id, ids?, folder?} | null · openStudioFile(file)
import { mdToHtml } from './md.js';
import { modal } from './modal.js';
import { creativesHTML, stripHTML, studioBody, discardBody, applyDiscards, outgoing, MAX_ATTACH, DIMITRI_FOLDER, fitWithin, shrinkStep, b64Bytes } from './sub-studio.js';
import { opsHTML, opsBody, undoneNote, questionsHTML, pickBody, pastChoices, UNDO_MS } from './sub-ops.js'; // V4.11: the calendar's ops, questions with options, a time that already went

const MODE = { estado: 'Estado de la oficina', analisis: 'Análisis', plan: 'Propuesta', pregunta: 'Me falta un dato', estudio: 'Plan de creativos' };
const STATE = { next: 'pendiente', doing: 'en curso', waiting: 'espera tu visto bueno', done: 'lista', scheduled: 'programada' };
const when = ts => new Date(ts).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const toInput = ts => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }; // a local «YYYY-MM-DDTHH:MM» for <input type=datetime-local>
const mediaSrc = f => '/media/' + String(f).split('/').map(encodeURIComponent).join('/');
const IMG_TYPES = /^image\/(png|jpeg|webp)$/;
const BASE_CHIPS = [['¿Cómo vamos? Dame el estado de la oficina.', '¿Cómo vamos?'], ['¿Qué está esperando mi visto bueno?', '¿Qué espera mi OK?'], ['¿Qué falló hoy y qué hago con eso?', '¿Qué falló?'], ['Ayúdame a priorizar lo de esta semana: ¿qué es lo más importante y qué puede esperar?', 'Priorizar la semana']];
const STUDIO_CHIPS = [['Hazme 3 creativos con esta foto para Instagram: propón el modelo, el prompt y el formato de cada uno.', 'Hazme 3 creativos con esta foto', true], ['Propón 2 creativos para el post de esta semana, con el formato de cada red.', 'Creativos para esta semana'], ['Hazme una locución de 15 segundos para la promo de esta semana, con mi voz si la tengo.', 'Una locución'], ['Ordena esta carpeta: propón carpetas y qué mover a cada una.', 'Ordenar la galería']];
// V4.11 (DIM-22): the suggestions follow the view the owner has open
const VIEW_CHIPS = {
  contenido: [['¿Qué se publica esta semana? Dime día, hora, formato y red de cada pieza, y qué falta.', '¿Qué se publica esta semana?'], ['Mira los días sin publicación de las próximas dos semanas y propón borradores para rellenarlos.', 'Rellena los huecos'], ['¿Qué piezas esperan mi OK y qué les falta para poder salir?', '¿Qué espera mi OK?']],
  analiticas: [['¿Qué funcionó mejor estos 30 días y por qué crees que fue?', '¿Qué funcionó?'], ['Con estas cifras, ¿qué debería publicar más y qué menos?', '¿Qué publico más?'], ['¿Cómo van los seguidores y el alcance contra el mes pasado?', '¿Cómo van las redes?']],
  cal: [['¿Qué corre mañana? Tareas y rutinas, con su hora.', '¿Qué corre mañana?'], ['¿Qué rutinas fallaron la última vez y qué hago con eso?', '¿Qué rutina falló?'], ['Ayúdame a priorizar lo de esta semana: ¿qué es lo más importante y qué puede esperar?', 'Priorizar la semana']],
};

export function initSub(ctx) {
  const { isLive, esc, DEPTS, DEPT_KEYS, findBySid, openTask, afterSend } = ctx;
  let NAME = ctx.name || 'Dimitri';
  const el = document.createElement('div'); el.id = 'subOv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-labelledby', 'sbName'); el.hidden = true; // a <div>: role=dialog is not allowed on <aside>
  el.setAttribute('data-shell', ''); // V4.8: beside a view it is part of the page, like the top bar — modal.js leaves it out of the inert set
  el.innerHTML = `<div class="sb-head"><span class="sb-av" aria-hidden="true">D</span><div class="sb-hd"><div class="sb-name" id="sbName">DIMITRI</div><div class="sb-sub">Tu mano derecha. Pregúntame, pensemos juntos una decisión, dime qué hay que hacer y lo reparto entre los jefes, o pídeme creativos para el Estudio. Nada sale sin tu OK.</div></div>
      <span class="sp"></span><button type="button" class="sb-clear" title="Empezar una conversación nueva (las tareas enviadas siguen en la oficina)" aria-label="Nueva conversación">＋</button><button type="button" class="sb-x" aria-label="Cerrar" title="Cerrar (Esc o S)">✕</button></div>
    <div class="sb-msgs" role="log" aria-live="off"></div><div class="sb-live vh" role="status" aria-live="polite"></div>
    <div class="sb-chips"></div>
    <div class="sb-ctx" hidden></div>
    <div class="sb-atts" hidden role="list" aria-label="Imágenes adjuntas"></div>
    <div class="sb-in"><button type="button" class="sb-clip" aria-label="Adjuntar imágenes (también puedes arrastrarlas o pegarlas)" title="Adjuntar imágenes: PNG, JPG o WEBP, hasta ${MAX_ATTACH}. También puedes arrastrarlas aquí o pegarlas (Ctrl+V)"><span aria-hidden="true">📎</span></button><input type="file" class="sb-file" accept="image/png,image/jpeg,image/webp" multiple hidden>
      <textarea rows="2" aria-label="Mensaje (Enter envía, Shift+Enter salto de línea)"></textarea><button type="button" class="sb-send">ENVIAR</button></div>
    <datalist id="scFolders"></datalist>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  const box = $('.sb-msgs'), input = $('.sb-in textarea'), sendBtn = $('.sb-send'), live = $('.sb-live'), fileIn = $('.sb-file');
  function setName(n) { NAME = String(n || 'Dimitri'); $('.sb-name').textContent = NAME.toUpperCase(); $('.sb-av').textContent = NAME.charAt(0).toUpperCase(); input.placeholder = `Escríbele a ${NAME}: una pregunta, una idea, lo que hay que hacer, o los creativos que quieres (puedes adjuntar fotos)`; }
  setName(NAME);
  let messages = [], loaded = false, busy = false, sending = false, timer = null, opener = null, pollAt = 0; // sending: from the click until the answer, also while the images still upload (a 2nd Enter used to send the text twice)
  const discarded = new Set((() => { try { return JSON.parse(localStorage.getItem('ao.sub.discarded') || '[]'); } catch { return []; } })()); // plans of creatives discarded with an organising action still proposed: never posted (the server would run the actions)
  const keepDiscards = () => { try { localStorage.setItem('ao.sub.discarded', JSON.stringify([...discarded].slice(-200))); } catch {} };
  const drafts = new Map(); // msg id → the owner's edits to a plan before SEND: i → { include, dept, instruction, team, at }
  const studioEdits = new Map(), actionEdits = new Map(); // msg id → i → { include, prompt, n, model, settings, folder } · msg id → action k → included?
  const opsBusy = new Set(); // msg ids whose HACER is on its way: a redraw draws «Haciendo…», never HACER again
  const opEdits = new Map(), qPicks = new Map(); // V4.11: msg id → op k → { include, when, at, fecha, hora, … } · msg id → question id → { values, other, otherOn }
  const sigs = new Map(); // V4.11 (DIM-01): msg id → what its node was drawn from; the 3 s tick redraws only the messages whose signature changed
  let attachments = []; // { key, name, file?, preview, vision?, state: 'uploading'|'ready'|'failed', err?, ready: Promise }
  let ctxSel = null, ctxOff = false, ctxKey = '', ctxDrawn = null, chipsDrawn = null;
  let media = null, mediaP = null, folderP = null; const jobs = new Map();
  const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };

  /* ---------- the Estudio's catalog, budget and folders (only when a plan of creatives or an image needs them) ---------- */
  function loadMedia(force) {
    if (!isLive()) return Promise.resolve(null);
    if (mediaP && !force) return mediaP;
    mediaP = fetch('/api/media').then(r => (r.ok ? r.json() : null)).then(j => { if (j) { media = { models: j.models || [], budget: j.budget || null, folders: j.folders || [], voices: j.voices || null }; $('#scFolders').innerHTML = media.folders.map(f => `<option value="${esc(f.name)}"></option>`).join(''); } return media; }).catch(() => null);
    return mediaP;
  }
  async function pollJobs() {
    try { const r = await fetch('/api/media/jobs?active=1'); if (!r.ok) return; const j = await r.json(); jobs.clear(); for (const x of j.jobs || []) jobs.set(x.id, x); if (media && j.budget) media.budget = j.budget; } catch {}
  }
  const pending = () => messages.some(m => m.studio && (m.studio.creatives || []).some(c => c.state === 'sent'));

  /* ---------- «Viendo: …» — what the open view has selected ---------- */
  function refreshContext() {
    let c = null; try { c = ctx.getContext ? ctx.getContext() : null; } catch { c = null; }
    const key = c ? `${c.view}|${c.label}|${c.id || ''}` : '';
    if (key !== ctxKey) { ctxKey = key; ctxOff = false; }
    ctxSel = c;
    const a = document.activeElement, held = !!(a && a.closest && el.contains(a) && a.closest('.sb-chips, .sb-ctx')); // never redraw a button under the keyboard's focus (it fell to <body> and the office's one-letter keys woke up)
    const view = c ? c.view : '', sig = `${key}|${ctxOff}|${attachments.map(x => x.file || '').join(',')}`, chipSig = `${view}|${messages.length ? 1 : 0}`;
    if (!held && sig !== ctxDrawn) { ctxDrawn = sig; renderCtx(); }
    if (!held && chipSig !== chipsDrawn) { chipsDrawn = chipSig; renderChips(); }
  }
  const ctxFiles = c => (c && c.kind === 'image' && c.id ? [c.id] : c && c.kind === 'images' && c.ids ? c.ids.slice(0, MAX_ATTACH) : []);
  function renderCtx() {
    const box2 = $('.sb-ctx'), c = ctxSel;
    if (!c || !c.label || ctxOff) { box2.hidden = true; box2.innerHTML = ''; return; }
    const fresh = ctxFiles(c).filter(f => !attachments.some(a => a.file === f));
    const what = fresh.length !== 1 ? `Adjuntar los ${fresh.length}` : /\.(mp4|webm)$/i.test(fresh[0]) ? 'Adjuntar el video' : /\.(mp3|wav|flac|m4a|ogg)$/i.test(fresh[0]) ? 'Adjuntar el audio' : 'Adjuntarla'; // DIM-09: a video or an audio is attached by its id
    box2.hidden = false;
    box2.innerHTML = `<span class="sb-ctxl" title="${esc(c.label)}"><span aria-hidden="true">👁</span> Viendo: <b>${esc(c.label)}</b></span>${fresh.length ? `<button type="button" class="sb-ctxadd">${what}</button>` : ''}<button type="button" class="sb-ctxx" aria-label="No enviar lo que estoy viendo" title="No enviar lo que estoy viendo">✕</button>`;
  }
  function renderChips() {
    const v = ctxSel && ctxSel.view, list = v === 'studio' ? STUDIO_CHIPS : VIEW_CHIPS[v] || BASE_CHIPS;
    const chips = $('.sb-chips'); chips.classList.toggle('compact', messages.length > 0); // DIM-22: in a conversation, one row that scrolls sideways on the phone
    chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Sugerencias');
    chips.innerHTML = list.map(([q, l, img]) => `<button type="button" data-q="${esc(q)}"${img ? ' data-img="1"' : ''}>${esc(l)}</button>`).join('');
  }
  const contextOut = () => (ctxSel && !ctxOff && ctxSel.label ? { view: ctxSel.view, label: ctxSel.label, kind: ctxSel.kind || null, ...(ctxSel.id ? { id: ctxSel.id } : {}) } : undefined);

  /* ---------- attachments: the original to the gallery, a reduced copy to the vision ---------- */
  const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('no pude abrir la imagen')); i.src = url; });
  async function visionCopy(url) {
    const img = await loadImg(url);
    let t = { ...fitWithin(img.naturalWidth, img.naturalHeight), q: 0.85 };
    for (let k = 0; k < 14; k++) {
      const c = document.createElement('canvas'); c.width = t.w; c.height = t.h;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, t.w, t.h); g.drawImage(img, 0, 0, t.w, t.h); // a transparent PNG gets a white ground, not black
      const d = c.toDataURL('image/jpeg', t.q), nx = shrinkStep(t, b64Bytes(d));
      if (!nx) return { media_type: 'image/jpeg', data: d.slice(d.indexOf(',') + 1) };
      t = nx;
    }
    throw new Error('no pude reducirla para que Dimitri la vea');
  }
  const readURL = f => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('no pude leerla')); fr.readAsDataURL(f); });
  function targetFolder() { // the open folder of the Estudio when the chat comes from there, otherwise «Referencias de Dimitri» (made the first time)
    const c = ctxSel;
    return loadMedia().then(async m => {
      if (!m) return null;
      if (c && c.view === 'studio' && c.folder && m.folders.some(f => f.id === c.folder)) return c.folder;
      const own = () => m.folders.find(f => f.name.toLowerCase() === DIMITRI_FOLDER.toLowerCase());
      if (own()) return own().id;
      if (!folderP) folderP = fetch('/api/media/folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: DIMITRI_FOLDER }) })
        .then(r => r.json().then(j => ({ ok: r.ok, j }))).then(async ({ ok, j }) => { if (ok) { m.folders = j.folders || [...m.folders, j.folder]; return j.folder.id; } const again = await loadMedia(true); const f = again && again.folders.find(x => x.name.toLowerCase() === DIMITRI_FOLDER.toLowerCase()); folderP = null; return f ? f.id : null; })
        .catch(() => { folderP = null; return null; }); // a network error: this image goes up without a folder, the next one tries again (a rejected promise kept every later upload failing)
      return folderP;
    });
  }
  function note(t) { const n = $('.sb-atts'); n.hidden = false; n.insertAdjacentHTML('beforeend', `<div class="sb-attn" role="listitem">${esc(t)}</div>`); say(t); setTimeout(() => { n.querySelectorAll('.sb-attn').forEach(x => x.remove()); if (!attachments.length) n.hidden = true; }, 5000); }
  function addFiles(files) {
    if (!isLive()) return note('Las imágenes necesitan la oficina real (ábrela desde el iniciador).');
    for (const f of [...files]) {
      if (attachments.length >= MAX_ATTACH) { note(`Como mucho ${MAX_ATTACH} imágenes por mensaje.`); break; }
      if (!IMG_TYPES.test(f.type)) { note(`«${f.name || 'eso'}»: solo PNG, JPG o WEBP.`); continue; }
      if (f.size > 12 * 1024 * 1024) { note(`«${f.name}» pasa de 12 MB.`); continue; }
      const a = { key: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: f.name || 'imagen pegada', preview: URL.createObjectURL(f), state: 'uploading' };
      attachments.push(a);
      a.ready = (async () => {
        try {
          const [data, vis, folder] = await Promise.all([readURL(f), visionCopy(a.preview), targetFolder()]);
          const r = await fetch('/api/media/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: a.name, data, ...(folder ? { folder } : {}) }) });
          const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
          a.file = j.item.file; a.vision = { file: a.file, ...vis }; a.state = 'ready'; mediaChanged();
        } catch (e) { a.state = 'failed'; a.err = e.message; }
        renderAtts();
      })();
    }
    renderAtts();
  }
  function addGallery(ids = []) {
    for (const id of ids) {
      if (!id || attachments.some(a => a.file === id)) continue;
      if (attachments.length >= MAX_ATTACH) { note(`Como mucho ${MAX_ATTACH} imágenes por mensaje.`); break; }
      const isImg = !/\.(mp4|webm|mp3|wav)$/i.test(id);
      const a = { key: 'g' + Math.random().toString(36).slice(2, 8), name: String(id).split('/').pop(), file: id, preview: isImg ? mediaSrc(id) : '', state: isImg ? 'uploading' : 'ready', kind: isImg ? 'image' : 'other' };
      attachments.push(a);
      a.ready = !isImg ? Promise.resolve() : visionCopy(a.preview).then(v => { a.vision = { file: id, ...v }; a.state = 'ready'; }).catch(() => { a.state = 'ready'; a.err = 'Dimitri la tendrá por su nombre, sin verla'; }).then(renderAtts);
    }
    renderAtts(); refreshContext();
  }
  function renderAtts() {
    const n = $('.sb-atts');
    n.hidden = !attachments.length && !n.querySelector('.sb-attn');
    n.querySelectorAll('.sb-att').forEach(x => x.remove());
    n.insertAdjacentHTML('afterbegin', attachments.map(a => `<div class="sb-att ${a.state}" role="listitem" data-key="${a.key}" title="${esc(a.err || a.name)}">${a.preview ? `<img src="${esc(a.preview)}" alt="">` : `<span class="sb-attv" aria-hidden="true">${/\.(mp3|wav|flac|m4a|ogg)$/i.test(a.file || '') ? '♪' : '▶'}</span>`}<span class="sb-atts-st">${a.state === 'uploading' ? 'subiendo…' : a.state === 'failed' ? '⚠ no subió' : a.err ? 'sin vista' : 'lista'}</span><button type="button" class="sb-attx" aria-label="Quitar «${esc(a.name)}»" title="Quitar">✕</button></div>`).join(''));
    sendBtn.disabled = busy || attachments.some(a => a.state === 'uploading');
  }

  /* ---------- the conversation ---------- */
  function planHTML(m) {
    const p = m.plan; if (!p) return '';
    const open = p.tasks.some(t => t.state === 'proposed');
    const ed = drafts.get(m.id) || new Map();
    const unresolved = t => t.state === 'proposed' && (ed.get(t.i)?.include !== false) && ed.get(t.i)?.at === undefined && t.at && t.at <= Date.now() + 30000; // DIM-13: a time that already went must be chosen again
    const items = p.tasks.map(t => {
      const e = ed.get(t.i) || {};
      const dept = e.dept || t.dept, include = e.include !== false, team = e.team ?? t.team, at = e.at !== undefined ? e.at : t.at, gone = unresolved(t);
      if (t.state === 'proposed') {
        const pc = gone ? pastChoices(t.at) : null;
        return `<div class="sb-item${include ? '' : ' off'}" data-msg="${m.id}" data-i="${t.i}">
          <label class="sb-inc"><input type="checkbox" class="sb-on"${include ? ' checked' : ''} aria-label="Incluir «${esc(t.title)}»"></label>
          <div class="sb-body">
            <div class="sb-t">${esc(t.title)}${include ? '' : ' <span class="sc-offl">no se incluye</span>'}</div>
            <div class="sb-row"><select class="sb-dept" aria-label="Departamento">${DEPT_KEYS.map(k => `<option value="${k}"${k === dept ? ' selected' : ''}>${esc(DEPTS[k].name)}</option>`).join('')}</select>
              <label class="sb-team"><input type="checkbox" class="sb-teamc"${team ? ' checked' : ''}> <span>todo el equipo</span></label>
              <span class="sb-when"><label class="sb-atl" title="${at && !gone ? 'Se hace el ' + esc(when(at)) : 'Se hace en cuanto lo envíes'}"><span aria-hidden="true">◷</span><input type="datetime-local" class="sb-atin" value="${at && !gone ? toInput(at) : ''}" min="${toInput(Date.now())}" aria-label="Cuándo se hace (vacío: en cuanto lo envíes)"></label>${at && !gone ? '<button type="button" class="sb-atx" aria-label="Quitar la fecha: se hace en cuanto lo envíes" title="Quitar la fecha">✕</button>' : gone ? '' : '<span class="sb-at now">ya</span>'}</span></div>
            ${gone ? `<div class="sb-past" role="note"><span>Esa hora ya pasó (${esc(when(t.at))}). ¿Cuándo la hago?</span><span class="sb-pastb"><button type="button" class="sb-pastt" data-at="${pc.tomorrow}">${esc(pc.label)}</button><button type="button" class="sb-pastn">Ahora</button></span></div>` : ''}
            ${t.error ? `<div class="sb-moved">${esc(t.error)}</div>` : ''}
            ${t.ownerSaid ? `<div class="sb-moved">La moví de ${esc(DEPTS[t.ownerSaid].name)} a ${esc(DEPTS[t.dept].name)}.</div>` : ''}
            ${t.why ? `<div class="sb-why">${esc(t.why)}</div>` : ''}
            <details class="sb-det"><summary>Instrucciones para el jefe</summary><textarea class="sb-ins" rows="4" aria-label="Instrucciones para el jefe de ${esc(DEPTS[dept].name)}">${esc(e.instruction ?? t.instruction)}</textarea></details>
          </div></div>`;
      }
      const task = t.taskId ? findBySid(t.taskId) : null;
      const st = task ? (task.state === 'done' && task.error ? 'con error' : STATE[task.state] || task.state) : t.state === 'sent' ? 'enviada' : t.state === 'skipped' ? 'descartada' : t.state === 'failed' ? 'no se pudo enviar' : '';
      return `<div class="sb-item sent ${t.state}${task ? ' st-' + task.state + (task.error ? ' err' : '') : ''}"${task ? ` data-sid="${esc(t.taskId)}" role="button" tabindex="0"` : ''}>
          <span class="sb-dot" style="background:${DEPTS[t.dept].chip}"></span>
          <div class="sb-body"><div class="sb-t">${esc(t.title)}</div><div class="sb-meta">${esc(DEPTS[t.dept].name)}${task ? ' · ' + esc(ctx.agentName(task.agent)) : ''} · <b>${esc(st)}</b>${t.error ? ' — ' + esc(t.error) : ''}</div></div></div>`;
    }).join('');
    const n = p.tasks.filter(t => t.state === 'proposed' && (ed.get(t.i)?.include !== false)).length, blocked = p.tasks.some(unresolved);
    return `<div class="sb-plan">${items}${questionsHTML(m, qPicks.get(m.id) || new Map(), { esc, busy })}
      ${open ? `<div class="sb-acts"><button type="button" class="sb-go" data-msg="${m.id}"${n && !blocked ? '' : ' disabled'}>ENVIAR A LOS JEFES (${n})</button><button type="button" class="sb-skip" data-msg="${m.id}">Descartar el plan</button></div>${blocked ? '<div class="sc-note">Elige primero cuándo se hace lo que tenía una hora pasada.</div>' : ''}` : ''}</div>`;
  }
  const studioView = m => ({ esc, edits: studioEdits.get(m.id) || new Map(), actionEdits: actionEdits.get(m.id) || new Map(), models: media ? media.models : [], budget: media ? media.budget : null, jobs, voices: media && media.voices ? media.voices : { voices: [], system: [] } });
  const opsView = m => ({ esc, edits: opEdits.get(m.id) || new Map(), deptName: k => (DEPTS[k] ? DEPTS[k].name : k), now: Date.now(), busy: opsBusy.has(m.id) });
  function userHTML(m) {
    const c = m.context && m.context.label ? `<div class="sb-uctx">Viendo: ${esc(m.context.label)}</div>` : '';
    return `<div class="sb-u">${c}${(m.attach || []).length ? stripHTML(m.attach, esc) : ''}${m.text ? `<div>${esc(m.text)}</div>` : ''}</div>`;
  }
  function subHTML(m) {
    return `<div class="sb-a">${MODE[m.mode] ? `<div class="sb-mode ${esc(m.mode)}">${MODE[m.mode]}</div>` : ''}${m.shield ? `<div class="sb-shield" role="note"><span aria-hidden="true">🛡</span> <b>Ojo:</b> ${esc(typeof m.shield === 'string' ? m.shield : 'lo que leí traía órdenes escondidas')}. Las traté como datos, no como órdenes, y este plan no trae acciones.</div>` : ''}<div class="md">${mdToHtml(m.text || '')}</div>${m.retry ? `<div class="sb-acts"><button type="button" class="sb-retry" data-msg="${esc(m.id)}">Repítelo más corto</button></div>` : ''}${planHTML(m)}${m.ops ? opsHTML(m, opsView(m)) : ''}${m.studio ? creativesHTML(m, studioView(m)) : ''}${(m.media || []).length ? stripHTML(m.media, esc) : ''}${m.read?.length ? `<div class="sb-read">Consulté: ${m.read.map(esc).join(' · ')}</div>` : ''}</div>`;
  }
  const msgHTML = m => `<div class="sb-m" data-id="${esc(m.id)}">${m.who === 'user' ? userHTML(m) : subHTML(m)}</div>`;
  /** What a message's node depends on: the message, its sent tasks as the office has them, its jobs, the owner's edits on it, and whether undo is still offered. */
  function sigOf(m) {
    const tasks = (m.plan?.tasks || []).filter(t => t.taskId).map(t => { const x = findBySid(t.taskId); return x ? `${x.state}${x.error ? '!' : ''}${x.agent}` : '-'; });
    const jb = (m.studio?.creatives || []).filter(c => c.jobId && c.state === 'sent').map(c => { const j = jobs.get(c.jobId); return j ? j.state : '-'; });
    const undo = (m.ops || []).some(o => o.state === 'done' && o.doneAt && Date.now() - o.doneAt < UNDO_MS);
    return JSON.stringify([m, tasks, jb, undo, !!media, busy && m.plan?.questions?.length ? 1 : 0]);
  }
  const selectionInside = () => { const s = getSelection && getSelection(); return !!(s && s.rangeCount && !s.isCollapsed && box.contains(s.anchorNode)); };
  const busyHTML = () => (busy ? `<div class="sb-busy" role="status"><span class="sb-av sm" aria-hidden="true">${esc(NAME.charAt(0))}</span>${esc(NAME)} está pensando<span class="sb-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>` : '');
  function render(stick) {
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60, keep = box.scrollTop;
    const openDet = new Set([...box.querySelectorAll('.sb-item[data-msg] details[open]')].map(d => d.closest('.sb-item').dataset.msg + ':' + d.closest('.sb-item').dataset.i)); // what the owner unfolded stays unfolded
    sigs.clear();
    const list = applyDiscards(messages, discarded);
    box.innerHTML = !isLive() ? `<div class="sb-empty">${esc(NAME)} trabaja con la oficina real: abre la oficina desde el iniciador (.bat).</div>`
      : !messages.length ? `<div class="sb-empty">Hola, soy ${esc(NAME)}. Háblame como a tu mano derecha: pregúntame cómo va la oficina, el contenido o las redes, pensemos una decisión, cuéntame qué hay que hacer — una cosa o diez — o pídeme creativos, una locución o un jingle. Tú decides qué se envía, qué se genera y qué cambia en el calendario.</div>`
      : list.map(m => { sigs.set(m.id, sigOf(m)); return msgHTML(m); }).join('') + busyHTML();
    for (const k of openDet) { const [msg, i] = k.split(':'); const d = box.querySelector(`.sb-item[data-msg="${msg}"][data-i="${i}"] details`); if (d) d.open = true; }
    if (stick || atBottom) box.scrollTop = box.scrollHeight; else box.scrollTop = keep;
  }
  /** DIM-01: the 3 s tick — only the messages whose signature changed are redrawn; nothing while the owner selects text or works in one. */
  function patch() {
    if (!isLive() || !messages.length || selectionInside()) return;
    const list = applyDiscards(messages, discarded), nodes = [...box.querySelectorAll(':scope > .sb-m')];
    if (nodes.length !== list.length || nodes.some((n, k) => n.dataset.id !== list[k].id)) { const a = document.activeElement; if (!(a && box.contains(a) && a !== input)) render(); return; }
    list.forEach((m, k) => {
      const s = sigOf(m); if (s === sigs.get(m.id)) return;
      const node = nodes[k]; if (node.contains(document.activeElement)) return; // a card under the owner's hands is not redrawn
      const openDet = [...node.querySelectorAll('.sb-item[data-msg] details[open]')].map(d => d.closest('.sb-item').dataset.i);
      node.outerHTML = msgHTML(m); sigs.set(m.id, s);
      const fresh = box.querySelector(`.sb-m[data-id="${CSS.escape(m.id)}"]`);
      for (const i of openDet) { const d = fresh && fresh.querySelector(`.sb-item[data-i="${i}"] details`); if (d) d.open = true; }
    });
  }
  async function load() {
    try { const r = await fetch('/api/sub'); if (!r.ok) throw new Error(r.statusText); const j = await r.json(); messages = j.messages || []; if (j.name) setName(j.name); loaded = true; }
    catch (e) { box.innerHTML = `<div class="sb-empty">No pude cargar la conversación (${esc(e.message)}). <button type="button" class="sb-reload">Reintentar</button></div>`; box.querySelector('.sb-reload').onclick = load; return; }
    if (messages.some(m => m.studio)) await loadMedia();
    render(true);
  }
  const mediaChanged = () => dispatchEvent(new CustomEvent('ao:media-changed')); // V4.9: the Estudio beside Dimitri refreshes its gallery (src/studio.js)
  async function refreshMessages() { // a job of Dimitri's finished: the server updated his message and added «Listos: …»
    try { const r = await fetch('/api/sub'); if (!r.ok) return; const j = await r.json(); const before = messages.length; messages = j.messages || messages; if (messages.length > before) { mediaChanged(); const last = messages[messages.length - 1]; if (last && last.who === 'sub') say(`${NAME}: ${String(last.text || '').slice(0, 200)}`); } } catch {}
  }
  async function send(text, extra = {}) { // extra: { answers } when the owner answered with the option buttons (V4.11)
    text = String(text || '').trim(); if (busy || sending || !isLive()) return;
    if (!text && !attachments.length) return;
    sending = true; // taken before the wait for the uploads: Enter again meanwhile does nothing
    if (attachments.some(a => a.state === 'uploading')) { sendBtn.disabled = true; await Promise.all(attachments.map(a => a.ready)); }
    const out = outgoing(text, attachments), { ready, lost } = out;
    if (!out.send) { sending = false; renderAtts(); note(lost.length ? `${lost.length === 1 ? 'La imagen no subió' : 'Las imágenes no subieron'}: quítala${lost.length === 1 ? '' : 's'} con ✕ o vuelve a adjuntarla${lost.length === 1 ? '' : 's'}. No envié nada.` : 'No hay nada que enviar.'); return; } // never «Mira estas imágenes» about images that are not there
    if (lost.length) note(`${lost.length === 1 ? 'Una imagen no subió y no va' : `${lost.length} imágenes no subieron y no van`} con el mensaje.`);
    text = out.text;
    const payload = { text, ...(ready.length ? { attach: ready.map(a => a.file) } : {}), ...(ready.some(a => a.vision) ? { vision: ready.filter(a => a.vision).map(a => a.vision) } : {}), ...(contextOut() ? { context: contextOut() } : {}), ...extra };
    const kept = attachments; busy = true; input.value = ''; sendBtn.disabled = true; attachments = []; renderAtts();
    messages.push({ id: 'tmp', who: 'user', text, attach: payload.attach, context: payload.context }); render(true);
    try {
      const r = await fetch('/api/sub/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      messages = messages.filter(m => m.id !== 'tmp').concat(j.messages);
      for (const a of kept) if (a.preview && a.preview.startsWith('blob:')) URL.revokeObjectURL(a.preview);
      const last = j.messages[j.messages.length - 1];
      if (last && last.studio) await loadMedia(true);
      say(`${NAME}: ${String(last?.text || '').slice(0, 200)}${last && last.studio && (last.studio.creatives || []).length ? ` · propone ${last.studio.creatives.length} ${last.studio.creatives.length === 1 ? 'creativo' : 'creativos'}` : ''}`); // the new answer is read out, not the whole chat every 3 s
      if (j.answered) { const q = messages.find(x => x.id === j.answered.msg); if (q && q.plan) q.plan.answers = j.answered.answers; qPicks.delete(j.answered.msg); }
    } catch (e) { messages = messages.filter(m => m.id !== 'tmp'); messages.push({ id: 'err' + Date.now(), who: 'sub', text: `No pude responder ahora (${e.message}). ${extra.answers ? 'Tus respuestas siguen marcadas: pulsa Responder otra vez.' : 'Te dejé tu mensaje en la caja para que lo envíes de nuevo.'}` }); if (!extra.answers) input.value = text; attachments = kept; }
    busy = false; sending = false; renderAtts(); render(true); input.focus();
  }
  function edit(msgId, i) { if (!drafts.has(msgId)) drafts.set(msgId, new Map()); const d = drafts.get(msgId); if (!d.has(i)) d.set(i, {}); return d.get(i); }
  function sedit(msgId, i) { if (!studioEdits.has(msgId)) studioEdits.set(msgId, new Map()); const d = studioEdits.get(msgId); if (!d.has(i)) d.set(i, {}); return d.get(i); }
  async function dispatch(msgId, btn, discard) {
    const m = messages.find(x => x.id === msgId); if (!m || !m.plan) return;
    const ed = drafts.get(msgId) || new Map();
    const items = m.plan.tasks.filter(t => t.state === 'proposed').map(t => ({ i: t.i, ...ed.get(t.i) }));
    const label = btn.textContent; btn.disabled = true; btn.textContent = discard ? 'Descartando…' : 'Enviando a los jefes…';
    try {
      const r = await fetch('/api/sub/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ msg: msgId, items }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      const k = messages.findIndex(x => x.id === msgId); if (k >= 0) messages[k] = j.message;
      if (j.messages) for (const x of j.messages) if (!messages.some(y => y.id === x.id)) messages.push(x);
      drafts.delete(msgId);
      if (afterSend) await afterSend();
    } catch (e) { btn.disabled = false; btn.textContent = label; messages.push({ id: 'err' + Date.now(), who: 'sub', text: `No se pudo ${discard ? 'descartar' : 'enviar'}: ${e.message}` }); }
    render(true);
  }
  // GENERAR: the one click that spends through Dimitri. The plan as the owner left it goes to /api/sub/studio (re-validated there).
  async function generate(msgId, btn, discard) {
    const m = messages.find(x => x.id === msgId); if (!m || !m.studio) return;
    const payload = discard ? discardBody(msgId, m.studio) : studioBody(msgId, m.studio, studioEdits.get(msgId), actionEdits.get(msgId));
    if (!payload) { discarded.add(msgId); keepDiscards(); studioEdits.delete(msgId); actionEdits.delete(msgId); say('Plan de creativos descartado. No se generó ni se movió nada.'); render(true); input.focus(); return; } // the server would run its proposed actions on any call: it never hears of this one
    const label = btn.textContent; btn.disabled = true; btn.textContent = discard ? 'Descartando…' : 'Enviando al Estudio…';
    try {
      const r = await fetch('/api/sub/studio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      const k = messages.findIndex(x => x.id === msgId); if (k >= 0 && j.message) messages[k] = j.message;
      if (j.messages) for (const x of j.messages) if (!messages.some(y => y.id === x.id)) messages.push(x);
      studioEdits.delete(msgId); actionEdits.delete(msgId);
      say(discard ? 'Plan de creativos descartado.' : 'Enviado al Estudio. Te aviso aquí cuando estén listos.');
      pollAt = 0; await pollJobs(); mediaChanged();
    } catch (e) { btn.disabled = false; btn.textContent = label; messages.push({ id: 'err' + Date.now(), who: 'sub', text: `No se pudo ${discard ? 'descartar' : 'generar'}: ${e.message}` }); }
    render(true);
  }
  function openFile(file) { if (!file) return; if (narrow.matches) close(); if (ctx.openStudioFile) ctx.openStudioFile(file); }
  /* ---------- V4.11: the calendar's ops (HACER, Descartar, Deshacer), the answers to the questions, «Nueva conversación» with DESHACER ---------- */
  function oedit(msgId, k) { if (!opEdits.has(msgId)) opEdits.set(msgId, new Map()); const d = opEdits.get(msgId); if (!d.has(k)) d.set(k, {}); return d.get(k); }
  const postJSON = (url, b) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || r.statusText); return j; }));
  async function doOps(msgId, btn, skipAll) {
    const m = messages.find(x => x.id === msgId); if (!m || !m.ops || opsBusy.has(msgId)) return;
    const label = btn.textContent; btn.disabled = true; btn.textContent = skipAll ? 'Descartando…' : 'Haciendo…'; opsBusy.add(msgId);
    try {
      const j = await postJSON('/api/sub/ops', opsBody(msgId, m.ops, opEdits.get(msgId), skipAll));
      const k = messages.findIndex(x => x.id === msgId); if (k >= 0 && j.message) messages[k] = j.message;
      for (const x of j.messages || []) if (!messages.some(y => y.id === x.id)) messages.push(x);
      opEdits.delete(msgId); say(skipAll ? 'Descartado: no cambié nada.' : (j.messages && j.messages[0] ? j.messages[0].text : 'Hecho.'));
      if (afterSend) await afterSend();
    } catch (e) { btn.disabled = false; btn.textContent = label; messages.push({ id: 'err' + Date.now(), who: 'sub', text: `No se pudo: ${e.message}` }); }
    opsBusy.delete(msgId); render(true);
  }
  async function undoOp(msgId, k, btn) {
    btn.disabled = true;
    try { const j = await postJSON('/api/sub/ops/undo', { msg: msgId, k }); const i = messages.findIndex(x => x.id === msgId); if (i >= 0 && j.message) messages[i] = j.message; const uo = j.message?.ops?.find(x => x.k === k); say('Deshecho' + (uo ? undoneNote(uo) : '') + '.'); if (afterSend) await afterSend(); }
    catch (e) { btn.disabled = false; say(`No se pudo deshacer: ${e.message}`); messages.push({ id: 'err' + Date.now(), who: 'sub', text: `No se pudo deshacer: ${e.message}` }); }
    render();
  }
  function pick(msgId, qid) { if (!qPicks.has(msgId)) qPicks.set(msgId, new Map()); const p = qPicks.get(msgId); if (!p.has(qid)) p.set(qid, { values: [], other: '', otherOn: false }); return p.get(qid); }
  function answer(msgId) {
    const m = messages.find(x => x.id === msgId); if (!m || !m.plan || m.plan.answers || busy) return;
    const b = pickBody(msgId, m.plan.questions || [], qPicks.get(msgId) || new Map()); if (!b.answers.picks.length) return;
    send(b.text, { answers: b.answers });
  }
  function choose(btn, byArrow = false) { // an option button: a radio picks one (and, if it is the only question with options and no «Otra», answers at once), a checkbox toggles
    if (btn.getAttribute('aria-disabled') === 'true' || busy) return;
    const node = btn.closest('.sb-qq'), msgId = node.dataset.msg, qid = node.dataset.q, m = messages.find(x => x.id === msgId); if (!m || !m.plan) return;
    const q = (m.plan.questions || []).find(x => x.id === qid), p = pick(msgId, qid), multi = !!(q && q.multi);
    if (btn.dataset.other) { p.otherOn = multi ? !p.otherOn : true; if (!multi) p.values = []; }
    else { const v = btn.dataset.v; if (multi) p.values = p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v]; else { p.values = [v]; p.otherOn = false; } }
    const withOpts = (m.plan.questions || []).filter(x => x.options && x.options.length);
    if (!byArrow && !multi && !btn.dataset.other && withOpts.length === 1 && (m.plan.questions || []).length === 1) return answer(msgId); // one click answers a single question (an arrow only moves the pick)
    render();
    const again = box.querySelector(`.sb-qq[data-msg="${CSS.escape(msgId)}"][data-q="${CSS.escape(qid)}"] ${btn.dataset.other ? (p.otherOn ? '.sb-otherin' : '.sb-other') : `.sb-opt[data-v="${CSS.escape(btn.dataset.v)}"]`}`);
    if (again) again.focus();
  }
  async function newConversation(btn) {
    btn.disabled = true;
    try {
      const j = await postJSON('/api/sub/clear', {}); messages = []; drafts.clear(); studioEdits.clear(); actionEdits.clear(); opEdits.clear(); qPicks.clear(); render(); refreshContext();
      if (j.archived) undoBar(j.archived);
    } catch (err) { messages.push({ id: 'err' + Date.now(), who: 'sub', text: `No pude empezar una nueva: ${err.message}` }); render(true); }
    btn.disabled = false;
  }
  let undoT = 0;
  function undoBar(id) { // DIM-18: no confirm(): the conversation is archived and comes back with DESHACER for 8 s
    const old = el.querySelector('.sb-undo'); if (old) old.remove(); clearTimeout(undoT);
    el.querySelector('.sb-in').insertAdjacentHTML('beforebegin', `<div class="sb-undo" role="status"><span>Conversación archivada. Las tareas enviadas siguen en la oficina.</span><button type="button" class="sb-undob">Deshacer</button></div>`);
    const bar = el.querySelector('.sb-undo');
    bar.querySelector('.sb-undob').onclick = async () => { clearTimeout(undoT); try { const j = await postJSON('/api/sub/restore', { id }); messages = j.messages || []; bar.remove(); render(true); input.focus(); say('Conversación recuperada.'); } catch (e) { bar.querySelector('span').textContent = `No se pudo recuperar: ${e.message}`; } };
    say('Conversación archivada. Puedes deshacerlo durante 8 segundos.');
    undoT = setTimeout(() => { if (bar.isConnected && !bar.contains(document.activeElement)) bar.remove(); else undoT = setTimeout(() => bar.remove(), 4000); }, 8000);
  }

  el.addEventListener('click', e => {
    if (e.target.closest('.sb-x')) return close();
    const clr = e.target.closest('.sb-clear'); if (clr) { if (messages.length) newConversation(clr); return; }
    const opt = e.target.closest('.sb-opt'); if (opt) return choose(opt);
    const qgo = e.target.closest('.sb-qgo'); if (qgo) return answer(qgo.dataset.msg);
    const rt = e.target.closest('.sb-retry'); if (rt) { const k = messages.findIndex(x => x.id === rt.dataset.msg), u = k > 0 ? messages.slice(0, k).reverse().find(x => x.who === 'user') : null; if (u) send(`${u.text}\n(Respóndeme más corto.)`); return; }
    const ogo = e.target.closest('.so-go'); if (ogo) return doOps(ogo.dataset.msg, ogo);
    const oskip = e.target.closest('.so-skip'); if (oskip) return doOps(oskip.dataset.msg, oskip, true);
    const oundo = e.target.closest('.so-undo'); if (oundo) return undoOp(oundo.dataset.msg, +oundo.dataset.k, oundo);
    const day = e.target.closest('.so-day'); if (day) { const c = day.closest('.so-card[data-msg]'), m = messages.find(x => x.id === c.dataset.msg), o = m && m.ops.find(x => x.k === +c.dataset.k); if (!o) return; const d = oedit(c.dataset.msg, o.k), w = { ...o.when, ...(d.when || {}) }; let days = w.kind === 'weekly' ? [...(w.days || [])] : w.kind === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]; const n = +day.dataset.d; days = days.includes(n) ? days.filter(x => x !== n) : [...days, n].sort(); if (!days.length) { say('Una rutina necesita al menos un día.'); return; } d.when = days.length === 7 ? { kind: 'daily', at: w.at } : { kind: 'weekly', days, at: w.at }; render(); box.querySelector(`.so-card[data-msg="${CSS.escape(c.dataset.msg)}"][data-k="${o.k}"] .so-day[data-d="${n}"]`)?.focus(); return; }
    const pastT = e.target.closest('.sb-pastt, .sb-pastn'); if (pastT) { const it = pastT.closest('.sb-item[data-msg]'); edit(it.dataset.msg, +it.dataset.i).at = pastT.classList.contains('sb-pastt') ? +pastT.dataset.at : null; render(); box.querySelector(`.sb-item[data-msg="${CSS.escape(it.dataset.msg)}"][data-i="${it.dataset.i}"] .sb-atin`)?.focus(); return; }
    const q = e.target.closest('.sb-chips [data-q]'); if (q) { if (q.dataset.img && ctxSel && (ctxSel.kind === 'image' || ctxSel.kind === 'images')) addGallery(ctxSel.kind === 'image' ? [ctxSel.id] : ctxSel.ids || []); return send(q.dataset.q); }
    if (e.target.closest('.sb-send')) return send(input.value);
    if (e.target.closest('.sb-clip')) return fileIn.click();
    const ax = e.target.closest('.sb-attx'); if (ax) { const k = ax.closest('.sb-att').dataset.key, a = attachments.find(x => x.key === k); attachments = attachments.filter(x => x.key !== k); if (a && a.preview.startsWith('blob:')) URL.revokeObjectURL(a.preview); renderAtts(); input.focus(); refreshContext(); return; }
    if (e.target.closest('.sb-ctxx')) { ctxOff = true; input.focus(); refreshContext(); return; } // the focus leaves the button before it goes
    if (e.target.closest('.sb-ctxadd')) { input.focus(); addGallery(ctxSel.kind === 'image' ? [ctxSel.id] : ctxSel.ids || []); return; }
    const th = e.target.closest('[data-open]'); if (th) return openFile(th.dataset.open);
    const go = e.target.closest('.sb-go'); if (go) return dispatch(go.dataset.msg, go);
    const sgo = e.target.closest('.sc-go'); if (sgo) return generate(sgo.dataset.msg, sgo);
    const sskip = e.target.closest('.sc-skip'); if (sskip) return generate(sskip.dataset.msg, sskip, true);
    const qty = e.target.closest('.sc-minus, .sc-plus'); if (qty) { const it = qty.closest('.sc-card[data-msg]'), m = messages.find(x => x.id === it.dataset.msg), c = m && m.studio.creatives.find(x => x.i === +it.dataset.i); if (!c) return; const d = sedit(it.dataset.msg, c.i), max = (media && media.budget && media.budget.maxPerRequest) || 8; d.n = Math.max(1, Math.min(max, (+(d.n ?? c.n) || 1) + (qty.classList.contains('sc-plus') ? 1 : -1))); const cls = qty.classList.contains('sc-plus') ? '.sc-plus' : '.sc-minus'; render(); const b = box.querySelector(`.sc-card[data-msg="${it.dataset.msg}"][data-i="${c.i}"] ${cls}`); if (b && !b.disabled) b.focus(); else box.querySelector(`.sc-card[data-msg="${it.dataset.msg}"][data-i="${c.i}"] .sc-qty output`)?.previousElementSibling?.focus(); return; }
    const skip = e.target.closest('.sb-skip'); if (skip) { const m = messages.find(x => x.id === skip.dataset.msg); if (m) { for (const t of m.plan.tasks) if (t.state === 'proposed') edit(m.id, t.i).include = false; dispatch(m.id, skip, true); } return; }
    const atx = e.target.closest('.sb-atx'); if (atx) { const it = atx.closest('.sb-item[data-msg]'); edit(it.dataset.msg, +it.dataset.i).at = null; render(); return; }
    const sent = e.target.closest('.sb-item[data-sid]'); if (sent) { const t = findBySid(sent.dataset.sid); if (t) openTask(t); }
  });
  el.addEventListener('change', e => {
    if (e.target === fileIn) { addFiles(fileIn.files); fileIn.value = ''; return; }
    const ac = e.target.closest('.sc-acton'); if (ac) { const ae = actionEdits.get(ac.dataset.msg) || new Map(); ae.set(+ac.dataset.k, ac.checked); actionEdits.set(ac.dataset.msg, ae); renderKeep(ac); return; }
    const sc = e.target.closest('.sc-card[data-msg]');
    if (sc) {
      const d = sedit(sc.dataset.msg, +sc.dataset.i);
      if (e.target.classList.contains('sc-on')) d.include = e.target.checked;
      else if (e.target.classList.contains('sc-model')) d.model = e.target.value;
      else if (e.target.classList.contains('sc-set')) { const t = e.target, k = t.dataset.k; d.settings = { ...(d.settings || {}), [k]: t.type === 'checkbox' ? t.checked : t.type === 'number' ? (Number.isFinite(+t.value) ? +t.value : undefined) : k === 'duration' && /^\d+$/.test(t.value) ? +t.value : t.value }; } // V4.11: a voice, an emotion, a speed, instrumental, a style
      else return;
      renderKeep(e.target); return;
    }
    const oc = e.target.closest('.so-card[data-msg]');
    if (oc) { // V4.11: the owner's edits on an op before HACER (checked again by the server)
      const m = messages.find(x => x.id === oc.dataset.msg), o = m && m.ops && m.ops.find(x => x.k === +oc.dataset.k); if (!o) return;
      const d = oedit(oc.dataset.msg, o.k), t = e.target, f = t.dataset.f;
      if (t.classList.contains('so-on')) d.include = t.checked;
      else if (t.classList.contains('so-red')) d.redes = [...oc.querySelectorAll('.so-red')].filter(x => x.checked).map(x => x.value);
      else if (f === 'needsOk') d.needsOk = t.checked;
      else if (f === 'at' && o.type === 'rutina_crear') d.when = { ...o.when, ...(d.when || {}), at: t.value || '09:00' };
      else if (f === 'at') { const v = t.value ? new Date(t.value).getTime() : NaN; if (!(v > Date.now())) { t.setCustomValidity('Esa hora ya pasó: elige una que aún esté por venir.'); t.reportValidity(); return; } t.setCustomValidity(''); d.at = v; }
      else if (f) d[f] = t.value;
      else return;
      if (t.tagName === 'TEXTAREA') return; // typing in a box is not redrawn
      const sel = t.classList.contains('so-on') ? '.so-on' : t.classList.contains('so-red') ? `.so-red[value="${t.value}"]` : `[data-f="${f}"]`;
      render(); box.querySelector(`.so-card[data-msg="${CSS.escape(oc.dataset.msg)}"][data-k="${o.k}"] ${sel}`)?.focus(); return;
    }
    const it = e.target.closest('.sb-item[data-msg]'); if (!it) return;
    const d = edit(it.dataset.msg, +it.dataset.i);
    if (e.target.classList.contains('sb-on')) d.include = e.target.checked;
    if (e.target.classList.contains('sb-dept')) d.dept = e.target.value;
    if (e.target.classList.contains('sb-teamc')) d.team = e.target.checked;
    if (e.target.classList.contains('sb-atin')) { // V4.1 (audit 53): the date Dimitri proposed can be changed or removed before SEND
      const v = e.target.value ? new Date(e.target.value).getTime() : null;
      if (v && v <= Date.now()) { e.target.setCustomValidity('Esa hora ya pasó: elige una que aún esté por venir.'); e.target.reportValidity(); return; }
      e.target.setCustomValidity(''); d.at = v;
    }
    render();
  });
  function renderKeep(target) { // re-draw, and give the focus back to the same control of the same card (Tab order kept)
    const card = target.closest('[data-msg]'), sel = target.classList[0], k = target.dataset.k, msg = card ? card.dataset.msg : target.dataset.msg, i = card && card.dataset.i;
    render();
    const again = i != null ? box.querySelector(`.sc-card[data-msg="${msg}"][data-i="${i}"] .${sel}${k ? `[data-k="${k}"]` : ''}`) : box.querySelector(`.${sel}[data-msg="${msg}"][data-k="${k}"]`);
    if (again) again.focus();
  }
  el.addEventListener('input', e => {
    if (e.target.classList.contains('sb-ins')) { const it = e.target.closest('.sb-item[data-msg]'); edit(it.dataset.msg, +it.dataset.i).instruction = e.target.value; return; }
    if (e.target.classList.contains('so-text')) { const oc = e.target.closest('.so-card[data-msg]'); oedit(oc.dataset.msg, +oc.dataset.k)[e.target.dataset.f] = e.target.value; return; }
    if (e.target.classList.contains('sb-otherin')) { // «Otra…»: the typed answer, and RESPONDER wakes up when every question has one
      const node = e.target.closest('.sb-qq'); pick(node.dataset.msg, node.dataset.q).other = e.target.value;
      const go = box.querySelector(`.sb-qgo[data-msg="${CSS.escape(node.dataset.msg)}"]`), m = messages.find(x => x.id === node.dataset.msg);
      if (go && m) go.disabled = !(m.plan.questions || []).filter(q => q.options && q.options.length).every(q => { const p = (qPicks.get(m.id) || new Map()).get(q.id); return p && (p.values.length || (p.otherOn && p.other.trim())); });
      return;
    }
    const sc = e.target.closest('.sc-card[data-msg]'); if (!sc) return;
    if (e.target.classList.contains('sc-prompt')) sedit(sc.dataset.msg, +sc.dataset.i).prompt = e.target.value;
    if (e.target.classList.contains('sc-folder')) sedit(sc.dataset.msg, +sc.dataset.i).folder = e.target.value.trim();
  });
  el.addEventListener('keydown', e => {
    e.stopPropagation(); // the office's one-letter shortcuts stay out of this chat
    if (e.target === input && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
    else if (e.target.classList && e.target.classList.contains('sb-otherin') && e.key === 'Enter') { e.preventDefault(); const node = e.target.closest('.sb-qq'), go = box.querySelector(`.sb-qgo[data-msg="${CSS.escape(node.dataset.msg)}"]`); if (go && !go.disabled) answer(node.dataset.msg); }
    else if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && e.target.closest('.sb-opts')) { // the ARIA radio group: arrows move (and pick, for one answer); a group of checkboxes only moves
      const g = e.target.closest('.sb-opts'), all = [...g.querySelectorAll('.sb-opt:not([aria-disabled="true"])')], k = all.indexOf(e.target); if (k < 0) return; e.preventDefault();
      const nx = all[e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (k + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length];
      if (g.getAttribute('role') === 'radiogroup' && !nx.dataset.other) { choose(nx, true); } else { all.forEach(b => b.setAttribute('tabindex', b === nx ? '0' : g.getAttribute('role') === 'radiogroup' ? '-1' : '0')); nx.focus(); }
    }
    else if (e.key === 'Escape') close();
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.sb-item[data-sid]')) { e.preventDefault(); e.target.click(); }
  });
  // images in: paste (Ctrl+V), drop files from the computer, or drop cards from the Estudio's gallery
  el.addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])].filter(f => IMG_TYPES.test(f.type)); if (fs.length) { e.preventDefault(); addFiles(fs); } });
  const dragKind = e => { const t = [...(e.dataTransfer?.types || [])]; return t.includes('application/x-ao-media') ? 'gallery' : t.includes('Files') ? 'files' : null; };
  el.addEventListener('dragover', e => { const k = dragKind(e); if (!k) return; e.preventDefault(); e.dataTransfer.dropEffect = k === 'gallery' ? 'move' : 'copy'; el.classList.add('sb-drop'); });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('sb-drop'); });
  el.addEventListener('drop', e => {
    const k = dragKind(e); el.classList.remove('sb-drop'); if (!k) return; e.preventDefault(); e.stopPropagation();
    if (k === 'gallery') { try { addGallery(JSON.parse(e.dataTransfer.getData('application/x-ao-media')) || []); } catch {} } else addFiles(e.dataTransfer.files);
    input.focus();
  });

  /* ---------- open and close: beside the view, or (under 900 px) a window ---------- */
  const narrow = matchMedia('(max-width: 899px)');
  const relayout = () => { for (const t of [30, 300]) setTimeout(() => dispatchEvent(new Event('resize')), t); }; // the calendar, the gallery and the Brain's canvas fit the room left beside the panel
  const isOn = () => document.body.classList.contains('subOpen'); let hideT = 0; // open from the click on, closed from the click on (the panel hides 250 ms later: reopening within them used to leave it hidden)
  narrow.addEventListener?.('change', () => { if (!isOn()) return; if (narrow.matches) { modal.open(el); el.setAttribute('aria-modal', 'true'); } else { modal.close(el); el.removeAttribute('aria-modal'); } });
  async function tick() {
    refreshContext();
    if (pending() && Date.now() - pollAt > 4000 && !busy) { pollAt = Date.now(); await pollJobs(); await refreshMessages(); }
    patch(); // V4.11 (DIM-01): only what changed (sent pieces follow their tasks, jobs end); never under a selection or the owner's hands
  }
  function open(o = {}) {
    if (o && Array.isArray(o.attach) && o.attach.length) addGallery(o.attach);
    if (o && o.text) input.value = String(o.text);
    if (isOn()) { input.focus(); return; }
    clearTimeout(hideT); opener = document.activeElement; el.hidden = false; document.body.classList.add('subOpen');
    if (narrow.matches) { modal.open(el); el.setAttribute('aria-modal', 'true'); }
    requestAnimationFrame(() => el.classList.add('on'));
    refreshContext();
    if (!loaded && isLive()) load(); else render(true); // the demo (opened as a file) has no server to ask
    if (isLive()) loadMedia(true).then(() => { if (messages.some(m => m.studio)) render(); });
    timer = setInterval(tick, 3000);
    relayout();
    setTimeout(() => { if (document.body.classList.contains('subOpen')) input.focus(); }, 80); // closed again before the timer: no focus in a hidden panel
  }
  function close() {
    if (!isOn()) return; if (el.contains(document.activeElement)) document.activeElement.blur(); /* a focused box inside a hidden panel kept eating the office's keys */
    el.classList.remove('on'); document.body.classList.remove('subOpen'); modal.close(el); el.removeAttribute('aria-modal'); clearInterval(timer); hideT = setTimeout(() => { el.hidden = true; }, 250); relayout();
    if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
  }
  renderChips();
  return { open, close, toggle: () => (isOn() ? close() : open()), isOpen: isOn, isWindow: () => isOn() && narrow.matches };
}

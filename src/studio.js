// Agents Office — the ESTUDIO on the page (E or ✦ ESTUDIO): generate images and video by hand or in batches, and see
// everything the agents generated. The work happens on the server (media.mjs) as background jobs; this is the window.
//   initStudio(ctx) → { open, close, toggle, isOpen }
//   ctx: isLive() · esc · agentName(id) · openTask?(taskSid)
// V2 (24 Sep 2026, after open-higgsfield): a catalog of models with their own settings, start/end frames and references
// (from the gallery or uploaded), «Animar» on any image, live tiles while a job runs (failed ones say why and retry),
// a masonry gallery at the true ratio, multi-select (★, ZIP, papelera) with undo, and an Uploads tab.
const LBL = { aspectRatio: 'Formato', resolution: 'Resolución', duration: 'Segundos', batchSize: 'Por pedido', enhancePrompt: 'Que el motor mejore el prompt', sound: 'Sonido', cfgScale: 'Fidelidad al prompt', multiShots: 'Varias tomas', generateAudio: 'Audio', outputFormat: 'Archivo', quality: 'Calidad', keepOriginalSound: 'Mantener el sonido del video', characterOrientation: 'Orientación del personaje' };
const VAL = { auto: 'Automático', low: 'Baja', medium: 'Media', high: 'Alta', video: 'la del video', image: 'la de la imagen', '1:1': 'Cuadrado 1:1', '4:5': 'Feed 4:5', '9:16': 'Story/Reel 9:16', '16:9': 'Web 16:9', '3:4': 'Vertical 3:4', '4:3': 'Horizontal 4:3', '2:3': 'Vertical 2:3', '3:2': 'Horizontal 3:2', '21:9': 'Cine 21:9' };
const ROLE = { start: 'Imagen inicial', end: 'Imagen final', reference: 'Referencias', video: 'Video de origen' };
const ROLE_HELP = { start: 'el video empieza así', end: 'el video termina así', reference: 'producto, logo, personaje o estilo', video: 'el video que se cambia o se alarga' };
const store = { get(k, d) { try { const v = localStorage.getItem('ao.st.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('ao.st.' + k, JSON.stringify(v)); } catch {} } };

export function initStudio(ctx) {
  const { isLive, esc, agentName } = ctx;
  const el = document.createElement('div'); el.id = 'studioOv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Estudio de imágenes y video'); el.hidden = true;
  el.innerHTML = `
    <div class="st-head">
      <div><div class="st-name">✦ ESTUDIO</div><div class="st-sub">Imágenes y video reales. Tus agentes también lo usan solos cuando una tarea lo pide; todo sigue generándose aunque cierres esta ventana.</div></div>
      <span class="sp"></span><div class="st-budget" aria-live="polite"></div><button type="button" class="st-x" aria-label="Cerrar el Estudio">✕</button>
    </div>
    <div class="st-body">
      <section class="st-gen" aria-label="Generar">
        <div class="st-seg st-kind" role="tablist" aria-label="Tipo"><button type="button" data-kind="image" role="tab">🖼 Imagen</button><button type="button" data-kind="video" role="tab">🎬 Video</button></div>
        <label class="st-lab">Modelo<select class="st-model" aria-label="Modelo"></select></label>
        <div class="st-mnote"></div>
        <div class="st-seg st-mode" role="tablist" aria-label="Modo"><button type="button" data-mode="one" class="on" role="tab">Una idea</button><button type="button" data-mode="batch" role="tab">Lote (un prompt por línea)</button></div>
        <div class="st-pwrap">
          <textarea class="st-prompt" rows="5" aria-label="Prompt"></textarea>
          <div class="st-prow"><button type="button" class="st-enh" title="Claude lo reescribe como un prompt de producción (en inglés, que es como mejor entienden los motores)">✨ Mejorar prompt</button><button type="button" class="st-undo-enh" hidden>↶ Volver al mío</button><span class="sp"></span><span class="st-plen"></span></div>
        </div>
        <div class="st-slots"></div>
        <div class="st-sets"></div>
        <div class="st-row"><label class="st-nwrap st-lab">Variantes<input type="number" class="st-n" min="1" max="8" value="1"></label><span class="st-est"></span></div>
        <div class="st-row"><button type="button" class="st-go">GENERAR</button></div>
        <div class="st-msg" aria-live="polite"></div>
        <details class="st-keys"><summary>Motores y cómo activarlos</summary><div class="st-engs"></div>
          <p>La key se guarda en Windows una sola vez (en «Editar las variables de entorno de esta cuenta», o con el comando de arriba en una ventana de comandos) y se reinicia la oficina con el iniciador. Nunca va en un archivo. Pon también un límite de gasto en la web de cada servicio.</p>
          <p>El tope diario de la oficina está en <code>office.config.json → media.dailyLimit</code> (un video cuenta como 5 imágenes).</p></details>
      </section>
      <section class="st-gal" aria-label="Galería">
        <div class="st-filt">
          <button type="button" data-f="all" class="on">Todo</button><button type="button" data-f="fav">★ Favoritas</button><button type="button" data-f="agent">De agentes</button><button type="button" data-f="you">Tuyas</button><button type="button" data-f="video">Videos</button><button type="button" data-f="up">Subidas</button>
          <input type="search" class="st-q" placeholder="Buscar en los prompts…" aria-label="Buscar en la galería">
          <span class="sp"></span><button type="button" class="st-upbtn" title="Sube tus fotos o videos (producto, logo, personaje) para usarlos de referencia o animarlos">⇪ Subir</button><span class="st-count"></span>
        </div>
        <div class="st-selbar" hidden><b class="st-seln"></b><button type="button" data-b="all">Seleccionar todo lo visible</button><button type="button" data-b="fav">★ Favoritas</button><button type="button" data-b="zip">⬇ Descargar ZIP</button><button type="button" data-b="del">🗑 Papelera</button><span class="sp"></span><button type="button" data-b="none">✕ Quitar selección</button></div>
        <div class="st-picking" hidden></div>
        <div class="st-grid"></div>
      </section>
    </div>
    <div class="st-light" hidden></div>
    <div class="st-toast" hidden role="status"><span></span><button type="button">DESHACER</button></div>
    <input type="file" class="st-file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" multiple hidden>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  let items = [], models = [], engines = [], budget = null, jobs = [], def = {};
  let kind = store.get('kind', 'image'), mode = 'one', filter = 'all', q = '', sel = new Set(), lastPick = -1, picking = null, uploadRole = null, busy = false, opener = null, lightIdx = -1, prevPrompt = null;
  const modelOf = { image: store.get('model.image', ''), video: store.get('model.video', '') };
  const setsOf = store.get('sets', {}); // model id → its settings
  let media = { start: [], end: [], reference: [], video: [] };

  const cur = () => models.find(m => m.id === modelOf[kind]) || null;
  const itemOf = f => items.find(x => x.file === f);
  const src = it => '/media/' + String(it.file || it).split('/').map(encodeURIComponent).join('/');
  const isVid = f => /\.(mp4|webm)$/i.test(f);
  const ar = r => (r && /^\d+:\d+$/.test(r) ? r.replace(':', ' / ') : '');
  const ratioOf = it => (it.w && it.h ? `${it.w} / ${it.h}` : ar(it.ratio) || '');
  const say = (t, bad) => { $('.st-msg').textContent = t; $('.st-msg').className = 'st-msg' + (bad ? ' bad' : ''); };
  const fmtDur = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const api = async (method, url, body) => { const r = await fetch(url, body === undefined ? { method } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };

  /* ---------- the generator ---------- */
  function pickModel(k = kind) { // the remembered one if it is on, else the office's default, else the first that is on
    const on = models.filter(m => m.kind === k && m.on);
    if (!on.some(m => m.id === modelOf[k])) modelOf[k] = (on.find(m => m.id === def[k]) || on.find(m => m.engine !== 'prueba') || on[0] || {}).id || '';
  }
  function settingsOf(m) {
    const s = { ...(setsOf[m.id] || {}) };
    for (const [k, f] of Object.entries(m.settings)) if (s[k] === undefined || (f.type === 'enum' && !f.values.includes(String(s[k])))) s[k] = f.default;
    return s;
  }
  function renderModels() {
    pickModel();
    const byEng = {};
    for (const m of models.filter(x => x.kind === kind)) (byEng[m.engine] = byEng[m.engine] || []).push(m);
    const engs = engines.filter(e => byEng[e.id]).sort((a, b) => (b.on - a.on) || (a.id === 'prueba') - (b.id === 'prueba'));
    $('.st-model').innerHTML = engs.map(e => `<optgroup label="${esc(e.name)}${e.on ? '' : ' — sin key'}">${byEng[e.id].map(m => `<option value="${m.id}"${m.on ? '' : ' disabled'}>${esc(m.name)}${m.on ? '' : ' (sin key)'}</option>`).join('')}</optgroup>`).join('');
    if (modelOf[kind]) $('.st-model').value = modelOf[kind];
    el.querySelectorAll('[data-kind]').forEach(b => { b.classList.toggle('on', b.dataset.kind === kind); b.setAttribute('aria-selected', b.dataset.kind === kind); });
    renderModel();
  }
  function renderModel() {
    const m = cur();
    $('.st-prompt').placeholder = mode === 'batch' ? 'Un prompt por línea — cada línea son «Variantes» archivos. Ej.: los 12 fondos del mes de Instagram.' : kind === 'video' ? (media.start.length ? 'Describe el movimiento: la cámara se acerca despacio, el vapor sube, luz de tarde…' : 'Qué pasa en el video: sujeto, acción, cámara, luz, estilo. Para animar una imagen, pulsa 🎬 en la galería.') : 'Describe la imagen: sujeto, estilo, luz, encuadre, colores. Ej.: fondo oscuro de roca volcánica con brillo naranja #FF5100, espacio limpio abajo para texto';
    if (!m) { $('.st-mnote').textContent = 'No hay ningún modelo de ' + (kind === 'video' ? 'video' : 'imagen') + ' encendido.'; $('.st-slots').innerHTML = ''; $('.st-sets').innerHTML = ''; estimate(); return; }
    const price = m.cost ? `aprox. US$${m.per === 's' ? m.cost.toFixed(2) + ' por segundo' : m.cost.toFixed(3) + ' por imagen'}` : 'gratis';
    $('.st-mnote').innerHTML = `${m.note ? esc(m.note) + ' · ' : ''}<span>${esc(m.engineName)} · ${price}</span>`;
    // media slots: only the roles this model takes; what no longer fits is dropped
    for (const r of Object.keys(media)) media[r] = media[r].slice(0, m.roles[r] || 0);
    $('.st-slots').innerHTML = Object.entries(m.roles).filter(([r, n]) => n > 0 && ROLE[r]).map(([r, n]) => `<div class="st-slot${(m.needs || []).includes(r) && !media[r].length ? ' need' : ''}" data-role="${r}">
        <div class="st-slot-h"><b>${ROLE[r]}</b> <span>${n > 1 ? `${media[r].length}/${n} · ` : ''}${ROLE_HELP[r]}${(m.needs || []).includes(r) ? ' · obligatorio' : ''}</span></div>
        <div class="st-chips">${media[r].map(f => `<span class="st-chip" data-f="${esc(f)}">${isVid(f) ? `<video src="${src(f)}" muted preload="metadata"></video>` : `<img src="${src(f)}" alt="">`}<button type="button" data-unslot="${esc(f)}" aria-label="Quitar">✕</button></span>`).join('')}
          ${media[r].length < n ? `<button type="button" class="st-add" data-slot="${r}" title="Subir un archivo">＋ Subir</button><button type="button" class="st-add" data-gpick="${r}" title="Elegir en la galería de la derecha">▦ De la galería</button>` : ''}</div></div>`).join('');
    // settings: the ones this model has, remembered per model
    const s = settingsOf(m);
    $('.st-sets').innerHTML = Object.entries(m.settings).map(([k, f]) => {
      if (f.type === 'enum') return `<label class="st-lab">${LBL[k] || k}<select data-set="${k}">${f.values.map(v => `<option value="${esc(v)}"${String(s[k]) === v ? ' selected' : ''}>${esc(VAL[v] || v)}</option>`).join('')}</select></label>`;
      if (f.type === 'range') return `<label class="st-lab">${LBL[k] || k} <output>${s[k]}</output><input type="range" data-set="${k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${s[k]}"></label>`;
      return `<label class="st-tog"><input type="checkbox" data-set="${k}"${s[k] ? ' checked' : ''}><span>${LBL[k] || k}</span></label>`;
    }).join('') || '<div class="st-mnote">Este modelo no tiene ajustes.</div>';
    $('.st-n').max = kind === 'video' ? 4 : (budget && budget.maxPerRequest) || 8;
    if (+$('.st-n').value > +$('.st-n').max) $('.st-n').value = $('.st-n').max;
    estimate();
  }
  const lines = () => $('.st-prompt').value.split('\n').map(x => x.trim()).filter(Boolean);
  function estimate() {
    const m = cur(); const n = (mode === 'batch' ? lines().length : 1) * Math.max(1, +$('.st-n').value || 1);
    if (!m) { $('.st-est').textContent = ''; return; }
    const s = settingsOf(m), per = Number(s.batchSize) || 1, secs = m.seconds || Number(s.duration) || 5;
    const cost = (m.per === 's' ? m.cost * secs : m.cost) * n * per;
    $('.st-est').textContent = `${n * per} ${kind === 'video' ? (n * per === 1 ? 'video' : 'videos') : n * per === 1 ? 'imagen' : 'imágenes'}${m.per === 's' ? ` de ${secs} s` : ''} · ${cost ? 'aprox. US$' + cost.toFixed(2) : 'gratis'}${budget ? ` · quedan ${budget.left} hoy` : ''}`;
    $('.st-plen').textContent = $('.st-prompt').value.length > 3000 ? `${$('.st-prompt').value.length}/4000` : '';
    return cost;
  }
  function renderHead() {
    $('.st-budget').textContent = budget ? `Hoy: ${budget.images} imágenes · ${budget.videos} videos · US$${(budget.cost || 0).toFixed(2)} · quedan ${budget.left} de ${budget.limit}${budget.reserved ? ` (${budget.reserved} en curso)` : ''}` : '';
    $('.st-engs').innerHTML = engines.map(e => `<div class="st-eng${e.on ? ' on' : ''}"><b>${e.on ? '●' : '○'} ${esc(e.name)}</b> <span>${e.on ? `listo · ${e.models} modelos` : e.id === 'prueba' ? 'siempre listo' : `${e.models} modelos · <code>${esc(e.how || '')}</code>${e.site ? ` · ${esc(e.site)}` : ''}`}</span></div>`).join('');
  }

  /* ---------- the gallery ---------- */
  function shown() {
    const w = q.toLowerCase();
    return items.filter(it => (filter === 'all' || (filter === 'fav' && it.fav) || (filter === 'agent' && it.by === 'agent') || (filter === 'you' && it.by !== 'agent' && !it.upload) || (filter === 'video' && (it.kind === 'video' || it.wanted === 'video')) || (filter === 'up' && it.upload))
      && (!w || `${it.prompt} ${it.modelName || it.model || ''} ${it.file}`.toLowerCase().includes(w)));
  }
  const tileJobs = () => jobs.filter(j => j.state === 'queued' || j.state === 'running' || (j.state === 'failed' && Date.now() - (j.doneAt || j.at) < 3 * 864e5));
  function jobTile(j) {
    const live = j.state !== 'failed', t = Date.now() - (j.startedAt || j.at);
    return `<figure class="st-card st-job ${j.state}" data-job="${j.id}">
      <div class="st-jbody" style="aspect-ratio:${ar(j.s && j.s.aspectRatio) || '1 / 1'}">
        ${live ? `<div class="st-spin" aria-hidden="true"></div><b>${j.state === 'queued' ? 'En cola' : j.kind === 'video' ? 'Generando video' : 'Generando'}${j.n > 1 ? ` · ${j.items.length}/${j.n}` : ''}</b><span class="st-jt">${esc(j.note || '')} · ${fmtDur(t)}</span>` : `<b>✗ No se pudo</b><span class="st-jerr">${esc(j.error || '')}</span>`}
        <p>${esc(j.prompt)}</p><span class="st-meta">${esc(j.modelName)}${j.by === 'agent' ? ' · ' + esc(agentName(j.agent) || 'agente') : ''}</span>
      </div>
      <div class="st-acts">${live ? `<button type="button" data-j="cancel">Cancelar</button>` : `<button type="button" data-j="retry">↻ Reintentar</button><button type="button" data-j="forget">Quitar</button>`}</div></figure>`;
  }
  function card(it, i) {
    const vid = it.kind === 'video', on = sel.has(it.file);
    return `<figure class="st-card${on ? ' sel' : ''}" data-i="${i}" data-f="${esc(it.file)}">
      <label class="st-ck" title="Seleccionar (Mayús para un rango)"><input type="checkbox"${on ? ' checked' : ''} aria-label="Seleccionar"></label>
      <button type="button" class="st-thumb" style="${ratioOf(it) ? `aspect-ratio:${ratioOf(it)}` : ''}" aria-label="Ver en grande">${vid ? `<video src="${src(it)}" preload="metadata" muted loop playsinline></video><span class="st-play">▶</span>` : `<img src="${src(it)}" alt="" loading="lazy" decoding="async">`}
        ${it.upload ? '<span class="st-badge">SUBIDA</span>' : it.provider === 'prueba' ? `<span class="st-badge">PRUEBA${it.wanted === 'video' ? ' · VIDEO' : ''}</span>` : ''}${it.fav ? '<span class="st-favb">★</span>' : ''}</button>
      <figcaption><span class="st-p">${esc(it.prompt)}</span><span class="st-meta">${it.upload ? 'subida por ti' : esc(it.by === 'agent' ? (agentName(it.agent) || 'agente') : 'tú')}${it.modelName || it.model ? ' · ' + esc(it.modelName || it.model) : ''} · ${new Date(it.at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span></figcaption>
      <div class="st-acts"><button type="button" data-a="fav" title="Favorita" class="${it.fav ? 'on' : ''}">★</button><a href="${src(it)}" download title="Descargar">⬇</a>${it.upload ? '' : '<button type="button" data-a="again" title="Reusar: mismo prompt, modelo y ajustes">↻</button>'}${vid ? '' : '<button type="button" data-a="anim" title="Animar: convertir en video">🎬</button><button type="button" data-a="ref" title="Usar como referencia">⊕</button>'}<button type="button" data-a="del" title="Mover a la papelera">🗑</button></div>
    </figure>`;
  }
  function renderGrid() {
    const list = shown(), tj = tileJobs().filter(j => filter === 'all' || (filter === 'you' && j.by !== 'agent') || (filter === 'agent' && j.by === 'agent') || (filter === 'video' && j.kind === 'video'));
    $('.st-count').textContent = `${list.length} de ${items.length}`;
    const scroll = $('.st-grid').scrollTop;
    const body = tj.map(jobTile).join('') + list.map(it => card(it, items.indexOf(it))).join(''); // the columns live in an inner box: a multi-column box with a fixed height overflows sideways
    $('.st-grid').innerHTML = body ? `<div class="st-cols">${body}</div>` : `<div class="st-empty">${items.length ? 'Nada con este filtro.' : 'Aún no hay nada. Genera tu primera imagen a la izquierda, sube una foto tuya (⇪ Subir), o pídesela a un agente de Marketing.'}</div>`;
    $('.st-grid').scrollTop = scroll;
    renderSel();
  }
  function renderSel() {
    $('.st-selbar').hidden = !sel.size; $('.st-seln').textContent = `${sel.size} ${sel.size === 1 ? 'seleccionada' : 'seleccionadas'}`;
    el.classList.toggle('st-selecting', sel.size > 0);
    $('.st-picking').hidden = !picking;
    if (picking) $('.st-picking').innerHTML = `Elige ${picking === 'video' ? 'un video' : 'una imagen'} para «${ROLE[picking]}» — haz clic en ella. <button type="button" data-b="unpick">Cancelar (Esc)</button>`;
    el.classList.toggle('st-pickmode', !!picking);
  }
  let loading = null;
  async function load() {
    if (loading) return loading;
    loading = (async () => {
      try { const j = await api('GET', '/api/media'); items = j.items || []; models = j.models || []; engines = j.engines || []; budget = j.budget || null; jobs = j.jobs || []; def = j.default || {}; } catch { }
      for (const f of [...sel]) if (!itemOf(f)) sel.delete(f);
      renderHead(); renderModels(); renderGrid(); watch();
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
        if (finished.length) { await load(); const ok = finished.filter(j => j.state === 'done'), bad = finished.filter(j => j.state === 'failed'); if (ok.length && !bad.length) say(`Listo: ${ok.reduce((s, j) => s + j.items.length, 0)} archivo(s) nuevos en la galería.`); if (bad.length) say(`${bad.length} no se pudo: ${bad[0].error}`, true); return; }
        renderHead(); renderGrid();
      } catch {}
      watch();
    }, 2500);
  }

  /* ---------- actions ---------- */
  async function generate(prompts) {
    const m = cur(); if (!m) return say('Elige un modelo.', true);
    if (busy) return; busy = true; $('.st-go').disabled = true;
    const n = Math.max(1, +$('.st-n').value || 1), settings = settingsOf(m);
    const mediaNow = Object.fromEntries(Object.entries(media).filter(([, v]) => v.length));
    let ok = 0;
    for (const p of prompts) {
      try { const r = await api('POST', '/api/media/jobs', { prompt: p, n, kind, model: m.id, settings, media: mediaNow, by: 'you' }); jobs.unshift(r.job); budget = r.budget; ok++; }
      catch (e) { say(`No se pudo${prompts.length > 1 ? ` (${ok + 1}/${prompts.length})` : ''}: ${e.message}`, true); if (/tope|key/.test(e.message)) break; }
    }
    if (ok) say(`${ok === 1 ? 'En marcha' : `${ok} trabajos en marcha`}: ${kind === 'video' ? 'un video tarda unos minutos; ' : ''}sigue trabajando, aparece en la galería al terminar.`);
    busy = false; $('.st-go').disabled = false;
    renderHead(); renderGrid(); watch();
  }
  function setKind(k) { if (k === kind) return; kind = k; store.set('kind', kind); renderModels(); }
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
    renderModels(); $('.st-prompt').focus();
    say(m.engine === 'prueba' ? 'Animar: aún no tienes una key de video (Higgsfield o fal.ai); puedes probar el flujo gratis con «Prueba de video».' : `Animar con ${m.name}: describe el movimiento y pulsa GENERAR.`, m.engine === 'prueba');
  }
  function addMedia(role, f) {
    const m = cur(); if (!m || !m.roles[role]) return false;
    if (role === 'video' ? !isVid(f) : isVid(f)) { say(role === 'video' ? 'Ahí va un video.' : 'Ahí va una imagen, no un video.', true); return false; }
    if (m.engine !== 'prueba' && /\.svg$/i.test(f)) { say('Una tarjeta de prueba no sirve de referencia para un motor real: usa una imagen generada o subida.', true); return false; }
    if (media[role].includes(f)) return true;
    if (media[role].length >= m.roles[role]) { if (m.roles[role] === 1) media[role] = []; else { say(`${ROLE[role]}: como mucho ${m.roles[role]}.`, true); return false; } }
    media[role].push(f); renderModel(); return true;
  }
  function useAsRef(it) {
    let m = cur();
    if (!m || !m.roles.reference) { m = useModelFor('reference', kind); if (!m && kind === 'video') { kind = 'image'; m = useModelFor('reference', 'image'); } if (!m) return say('Ningún modelo encendido acepta referencias.', true); modelOf[kind] = m.id; store.set('model.' + kind, m.id); renderModels(); }
    if (addMedia('reference', it.file)) say(`Referencia añadida a ${m.name}. Describe qué hacer con ella.`);
  }
  function reuse(it) {
    const k = it.kind === 'video' || it.wanted === 'video' ? 'video' : 'image';
    kind = k; store.set('kind', kind);
    const m = models.find(x => x.id === it.model && x.on); if (m) { modelOf[k] = m.id; if (it.settings) setsOf[m.id] = { ...it.settings }; }
    media = { start: [], end: [], reference: [], video: [], ...(it.media || {}) };
    for (const r of Object.keys(media)) media[r] = (media[r] || []).filter(f => itemOf(f));
    mode = 'one'; el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === 'one'));
    $('.st-prompt').value = it.prompt; renderModels(); $('.st-prompt').focus();
    say(m ? 'Mismo prompt, modelo y ajustes: cambia lo que quieras y GENERAR.' : 'Ese modelo no está encendido; elige otro.', !m);
  }
  let toastT = null;
  function toast(text, undo) {
    const T = $('.st-toast'); T.querySelector('span').textContent = text; T.hidden = false;
    T.querySelector('button').hidden = !undo; T.querySelector('button').onclick = async () => { T.hidden = true; await undo(); };
    clearTimeout(toastT); toastT = setTimeout(() => { T.hidden = true; }, 9000);
  }
  async function trashMany(files) {
    const undo = [];
    for (const f of files) { try { const r = await api('DELETE', '/api/media/item/' + encodeURIComponent(f)); if (r.undo) undo.push(r.undo); } catch {} }
    items = items.filter(x => !undo.some(u => u.id === x.file)); for (const u of undo) sel.delete(u.id);
    for (const r of Object.keys(media)) media[r] = media[r].filter(f => !undo.some(u => u.id === f));
    renderGrid(); renderModel(); closeLight();
    toast(`${undo.length} ${undo.length === 1 ? 'archivo movido' : 'archivos movidos'} a la papelera (se vacía a los 30 días).`, async () => {
      let back = 0; for (const u of undo) { try { await api('POST', '/api/media/restore', u); back++; } catch {} }
      await load(); say(back === undo.length ? 'Recuperado.' : `Recuperé ${back} de ${undo.length}.`, back !== undo.length);
    });
  }
  async function favMany(files) {
    const all = files.every(f => itemOf(f)?.fav);
    for (const f of files) { const it = itemOf(f); if (!it) continue; it.fav = !all; fetch('/api/media/item/' + encodeURIComponent(f), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fav: it.fav }) }); }
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
    if (ok) { say(`${ok === 1 ? 'Subida' : ok + ' subidas'}${role ? ` y puesta en «${ROLE[role]}»` : ''}. Están en la pestaña Subidas.`); renderGrid(); }
  }

  /* ---------- the lightbox ---------- */
  function closeLight() { const L = $('.st-light'); L.hidden = true; L.innerHTML = ''; lightIdx = -1; }
  function light(i) {
    const list = shown(); const it = list[i]; if (!it) return; lightIdx = i;
    const L = $('.st-light'); L.hidden = false;
    const setTxt = it.settings ? Object.entries(it.settings).map(([k, v]) => `${LBL[k] || k}: ${typeof v === 'boolean' ? (v ? 'sí' : 'no') : VAL[v] || v}`).join(' · ') : '';
    const used = it.media ? Object.entries(it.media).flatMap(([r, fs]) => fs.map(f => [r, f])) : [];
    L.innerHTML = `<div class="st-lbox"><button type="button" class="st-lx" aria-label="Cerrar">✕</button>
      ${i > 0 ? '<button type="button" class="st-lnav prev" aria-label="Anterior">‹</button>' : ''}${i < list.length - 1 ? '<button type="button" class="st-lnav next" aria-label="Siguiente">›</button>' : ''}
      <div class="st-lmedia">${it.kind === 'video' ? `<video src="${src(it)}" controls autoplay playsinline></video>` : `<img src="${src(it)}" alt="">`}</div>
      <div class="st-linfo"><p class="st-lp">${esc(it.prompt)}</p>
      <p class="st-meta">${it.upload ? 'Subida por ti' : `${esc(it.modelName || it.model || it.provider)} · ${it.by === 'agent' ? esc(agentName(it.agent) || 'agente') : 'tú'}`} · ${new Date(it.at).toLocaleString('es')}${it.w ? ` · ${it.w}×${it.h}` : ''}${it.cost ? ` · ~US$${it.cost}` : ''}</p>
      ${setTxt ? `<p class="st-meta">${esc(setTxt)}</p>` : ''}
      ${used.length ? `<div class="st-lused">${used.map(([r, f]) => `<span title="${esc(ROLE[r] || r)}">${isVid(f) ? '🎬' : `<img src="${src(f)}" alt="">`}<i>${esc(ROLE[r] || r)}</i></span>`).join('')}</div>` : ''}
      <div class="st-lacts"><button type="button" data-l="copy">Copiar prompt</button><a href="${src(it)}" download>Descargar</a>${it.upload ? '' : '<button type="button" data-l="again">↻ Reusar</button>'}${it.kind === 'video' ? '' : '<button type="button" data-l="anim">🎬 Animar</button><button type="button" data-l="ref">⊕ Referencia</button>'}<button type="button" data-l="fav">${it.fav ? '★ Quitar de favoritas' : '☆ Favorita'}</button><button type="button" data-l="del">🗑 Papelera</button>${it.task && ctx.openTask ? '<button type="button" data-l="task">Ver la tarea</button>' : ''}</div></div></div>`;
    L.onclick = e => {
      if (e.target === L || e.target.closest('.st-lx')) return closeLight();
      if (e.target.closest('.st-lnav.prev')) return light(i - 1);
      if (e.target.closest('.st-lnav.next')) return light(i + 1);
      const a = e.target.closest('[data-l]')?.dataset.l; if (!a) return;
      if (a === 'copy') navigator.clipboard?.writeText(it.prompt).then(() => { e.target.textContent = 'Copiado ✓'; });
      if (a === 'again') { closeLight(); reuse(it); }
      if (a === 'anim') { closeLight(); animate(it); }
      if (a === 'ref') { closeLight(); useAsRef(it); }
      if (a === 'fav') { favMany([it.file]); light(i); }
      if (a === 'del') trashMany([it.file]);
      if (a === 'task') { closeLight(); close(); ctx.openTask(it.task); }
    };
  }

  /* ---------- events ---------- */
  el.addEventListener('click', async e => {
    if (e.target.closest('.st-x')) return close();
    const kb = e.target.closest('[data-kind]'); if (kb) return setKind(kb.dataset.kind);
    const md = e.target.closest('[data-mode]'); if (md) { mode = md.dataset.mode; el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b === md)); renderModel(); return; }
    const f = e.target.closest('[data-f]'); if (f && f.closest('.st-filt')) { filter = f.dataset.f; el.querySelectorAll('.st-filt [data-f]').forEach(b => b.classList.toggle('on', b === f)); renderGrid(); return; }
    if (e.target.closest('.st-upbtn')) { uploadRole = null; $('.st-file').click(); return; }
    const sl = e.target.closest('[data-slot]'); if (sl) { uploadRole = sl.dataset.slot; $('.st-file').accept = uploadRole === 'video' ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp'; $('.st-file').click(); return; }
    const gp = e.target.closest('[data-gpick]'); if (gp) { picking = gp.dataset.gpick; renderSel(); return; }
    const us = e.target.closest('[data-unslot]'); if (us) { for (const r of Object.keys(media)) media[r] = media[r].filter(x => x !== us.dataset.unslot); renderModel(); return; }
    const bb = e.target.closest('[data-b]');
    if (bb) {
      const b = bb.dataset.b, files = [...sel];
      if (b === 'unpick') { picking = null; renderSel(); }
      if (b === 'none') { sel.clear(); renderGrid(); }
      if (b === 'all') { for (const it of shown()) sel.add(it.file); renderGrid(); }
      if (b === 'fav') favMany(files);
      if (b === 'zip') zip(files);
      if (b === 'del' && confirm(`¿Mover ${files.length} ${files.length === 1 ? 'archivo' : 'archivos'} a la papelera? Podrás deshacerlo.`)) trashMany(files);
      return;
    }
    if (e.target.closest('.st-enh')) {
      const p = $('.st-prompt').value.trim(); if (!p) { $('.st-prompt').focus(); return say('Escribe primero la idea, aunque sea corta.', true); }
      if (!isLive()) return say('Mejorar el prompt necesita la oficina real.', true);
      const b = $('.st-enh'); b.disabled = true; b.textContent = '✨ Pensando…';
      try { const r = await api('POST', '/api/media/enhance', { prompt: p, kind }); prevPrompt = p; $('.st-prompt').value = r.prompt; $('.st-undo-enh').hidden = false; say('Prompt mejorado. Revísalo; «Volver al mío» lo deshace.'); estimate(); }
      catch (err) { say(err.message, true); }
      b.disabled = false; b.textContent = '✨ Mejorar prompt'; return;
    }
    if (e.target.closest('.st-undo-enh')) { if (prevPrompt != null) $('.st-prompt').value = prevPrompt; prevPrompt = null; $('.st-undo-enh').hidden = true; return; }
    if (e.target.closest('.st-go')) {
      if (!isLive()) return say('El Estudio necesita la oficina real (ábrela con el iniciador).', true);
      const m = cur(); if (!m) return say('Elige un modelo.', true);
      const miss = (m.needs || []).find(r => !media[r].length); if (miss) return say(`${m.name} necesita «${ROLE[miss]}».`, true);
      const ps = mode === 'batch' ? lines() : [$('.st-prompt').value.trim()].filter(Boolean);
      if (!ps.length && !(m.needs || []).includes('video')) { $('.st-prompt').focus(); return say('Escribe qué quieres generar.', true); }
      const c = estimate(); if (c > 1 && !confirm(`Esto cuesta aprox. US$${c.toFixed(2)}. ¿Generar?`)) return;
      return generate(ps.length ? ps : ['']);
    }
    const jt = e.target.closest('.st-job');
    if (jt) {
      const a = e.target.closest('[data-j]')?.dataset.j, id = jt.dataset.job; if (!a) return;
      try {
        if (a === 'cancel') { const r = await api('POST', `/api/media/jobs/${id}/cancel`); jobs = jobs.map(j => j.id === id ? r.job : j); }
        if (a === 'retry') { const r = await api('POST', `/api/media/jobs/${id}/retry`); await api('DELETE', `/api/media/jobs/${id}`).catch(() => {}); jobs = [r.job, ...jobs.filter(j => j.id !== id)]; say('Reintentando…'); }
        if (a === 'forget') { await api('DELETE', `/api/media/jobs/${id}`); jobs = jobs.filter(j => j.id !== id); }
      } catch (err) { say(err.message, true); }
      renderGrid(); watch(); return;
    }
    const cd = e.target.closest('.st-card[data-f]'); if (!cd) return;
    const it = items[+cd.dataset.i]; if (!it) return;
    if (picking) { // choosing a file for a slot
      e.preventDefault();
      if (addMedia(picking, it.file)) { const r = picking; picking = null; renderSel(); say(`Puesta en «${ROLE[r]}».`); }
      return;
    }
    const ck = e.target.closest('.st-ck');
    if (ck || (sel.size && e.target.closest('.st-thumb'))) { // selecting: a click toggles, Shift extends from the last one
      e.preventDefault();
      const list = shown(), idx = list.indexOf(it);
      if (e.shiftKey && lastPick >= 0) { const [a, b] = [Math.min(lastPick, idx), Math.max(lastPick, idx)]; for (const x of list.slice(a, b + 1)) sel.add(x.file); }
      else if (sel.has(it.file)) sel.delete(it.file); else sel.add(it.file);
      lastPick = idx; renderGrid(); return;
    }
    if (e.target.closest('.st-thumb')) return light(shown().indexOf(it));
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'fav') favMany([it.file]);
    if (a === 'del') trashMany([it.file]);
    if (a === 'again') reuse(it);
    if (a === 'anim') animate(it);
    if (a === 'ref') useAsRef(it);
  });
  el.addEventListener('change', e => {
    if (e.target.classList.contains('st-model')) { modelOf[kind] = e.target.value; store.set('model.' + kind, e.target.value); renderModel(); return; }
    if (e.target.classList.contains('st-file')) { const fs = [...e.target.files]; e.target.value = ''; e.target.accept = 'image/png,image/jpeg,image/webp,video/mp4,video/webm'; uploadFiles(fs, uploadRole); uploadRole = null; return; }
    const k = e.target.dataset?.set; if (k && cur()) { const m = cur(); const s = settingsOf(m); s[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value; setsOf[m.id] = s; store.set('sets', setsOf); estimate(); }
  });
  el.addEventListener('input', e => {
    if (e.target.type === 'range' && e.target.dataset.set && cur()) { const o = e.target.parentElement.querySelector('output'); if (o) o.textContent = e.target.value; const m = cur(); const s = settingsOf(m); s[e.target.dataset.set] = +e.target.value; setsOf[m.id] = s; store.set('sets', setsOf); }
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
    if (!$('.st-light').hidden) { if (e.key === 'Escape') closeLight(); else if (e.key === 'ArrowLeft' && lightIdx > 0) light(lightIdx - 1); else if (e.key === 'ArrowRight' && lightIdx < shown().length - 1) light(lightIdx + 1); return; }
    if (e.key === 'Escape') { if (picking) { picking = null; renderSel(); } else if (sel.size) { sel.clear(); renderGrid(); } else close(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.classList.contains('st-prompt')) { e.preventDefault(); $('.st-go').click(); }
  });
  let timer = null;
  function open() { if (!el.hidden) return; opener = document.activeElement; el.hidden = false; document.body.classList.add('studioOpen'); requestAnimationFrame(() => el.classList.add('on')); load(); timer = setInterval(() => { if (!busy && $('.st-light').hidden) load(); }, 20000); setTimeout(() => $('.st-prompt').focus(), 60); }
  function close() { if (el.hidden) return; el.classList.remove('on'); document.body.classList.remove('studioOpen'); clearInterval(timer); clearTimeout(jtimer); jtimer = null; picking = null; setTimeout(() => { el.hidden = true; }, 220); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden };
}

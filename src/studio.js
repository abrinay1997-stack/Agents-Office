// Agents Office — the ESTUDIO on the page (E or ✦ ESTUDIO): generate images and video by hand or in batches, and see
// everything the agents generated. The work happens on the server (media.mjs); this is the window onto it.
//   initStudio(ctx) → { open, close, toggle, isOpen }
//   ctx: isLive() · esc · agentName(id) · openTask?(taskId)
const RATIOS = [['4:5', 'Feed 4:5'], ['1:1', 'Cuadrado 1:1'], ['9:16', 'Story/Reel 9:16'], ['16:9', 'Web 16:9'], ['3:4', 'Vertical 3:4']];

export function initStudio(ctx) {
  const { isLive, esc, agentName } = ctx;
  const el = document.createElement('div'); el.id = 'studioOv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Estudio de imágenes y video'); el.hidden = true;
  el.innerHTML = `
    <div class="st-head">
      <div><div class="st-name">✦ ESTUDIO</div><div class="st-sub">Imágenes y video reales. Tus agentes de Marketing, Entregas, Ventas y Operaciones también lo usan solos cuando una tarea lo pide.</div></div>
      <span class="sp"></span><div class="st-budget" aria-live="polite"></div><button type="button" class="st-x" aria-label="Cerrar el Estudio">✕</button>
    </div>
    <div class="st-body">
      <section class="st-gen" aria-label="Generar">
        <div class="st-provs"></div>
        <div class="st-mode" role="tablist"><button type="button" data-mode="one" class="on" role="tab">Una idea</button><button type="button" data-mode="batch" role="tab">Lote (un prompt por línea)</button></div>
        <textarea class="st-prompt" rows="5" placeholder="Describe la imagen: sujeto, estilo, luz, encuadre, colores. Ej.: fondo oscuro de roca volcánica con brillo naranja #FF5100, espacio limpio abajo para texto" aria-label="Prompt"></textarea>
        <div class="st-row">
          <label>Tipo<select class="st-kind"><option value="image">Imagen</option><option value="video">Video (fal.ai)</option></select></label>
          <label>Motor<select class="st-prov"></select></label>
          <label>Formato<select class="st-ratio">${RATIOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <label class="st-nwrap">Variantes<input type="number" class="st-n" min="1" max="8" value="2"></label>
        </div>
        <div class="st-row"><button type="button" class="st-go">GENERAR</button><span class="st-est"></span></div>
        <div class="st-msg" aria-live="polite"></div>
        <details class="st-keys"><summary>¿Cómo activo Nano Banana, Grok, OpenAI o fal.ai?</summary>
          <p>Guarda la key del servicio en Windows una sola vez (en «Editar las variables de entorno de esta cuenta», o con el comando) y reinicia la oficina con el iniciador:</p>
          <ul><li><b>Nano Banana (Google):</b> <code>GEMINI_API_KEY</code> — aistudio.google.com</li><li><b>Grok (xAI):</b> <code>XAI_API_KEY</code> — console.x.ai</li><li><b>OpenAI:</b> <code>OPENAI_API_KEY</code></li><li><b>fal.ai</b> (Flux, Kling, Seedance, MiniMax, Wan, LTX: los modelos de open-higgsfield, y el video): <code>FAL_KEY</code></li></ul>
          <p>El tope diario está en <code>office.config.json → media.dailyLimit</code>. Pon un límite de gasto también en la web de cada servicio.</p></details>
      </section>
      <section class="st-gal" aria-label="Galería">
        <div class="st-filt"><button type="button" data-f="all" class="on">Todo</button><button type="button" data-f="fav">★ Favoritas</button><button type="button" data-f="agent">Hechas por agentes</button><button type="button" data-f="you">Hechas por ti</button><button type="button" data-f="video">Videos</button><span class="sp"></span><span class="st-count"></span></div>
        <div class="st-grid"></div>
      </section>
    </div>
    <div class="st-light" hidden></div>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  let items = [], provs = [], budget = null, filter = 'all', mode = 'one', busy = false, opener = null;

  const cost = () => { const p = provs.find(x => x.id === $('.st-prov').value); if (!p) return 0; const n = mode === 'batch' ? lines().length * (+$('.st-n').value || 1) : (+$('.st-n').value || 1); return $('.st-kind').value === 'video' ? 0.3 : n * (p.cost || 0); };
  const lines = () => $('.st-prompt').value.split('\n').map(x => x.trim()).filter(Boolean);
  function estimate() {
    const video = $('.st-kind').value === 'video';
    $('.st-nwrap').hidden = video;
    const n = video ? 1 : mode === 'batch' ? lines().length * (+$('.st-n').value || 1) : (+$('.st-n').value || 1);
    const c = cost();
    $('.st-est').textContent = `${n} ${video ? 'video' : n === 1 ? 'imagen' : 'imágenes'}${c ? ` · aprox. US$${c.toFixed(2)}` : ' · gratis'}${budget ? ` · quedan ${budget.left} hoy` : ''}`;
  }
  function renderHead() {
    $('.st-budget').textContent = budget ? `Hoy: ${budget.images} imágenes · ${budget.videos} videos · US$${(budget.cost || 0).toFixed(2)} · quedan ${budget.left} de ${budget.limit}` : '';
    $('.st-provs').innerHTML = provs.map(p => `<span class="st-pv${p.on ? ' on' : ''}" title="${p.on ? 'listo' : 'sin key: ' + (p.env || '')}">${p.on ? '●' : '○'} ${esc(p.name)}</span>`).join('');
    const cur = $('.st-prov').value;
    $('.st-prov').innerHTML = provs.filter(p => p.on).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if (cur && provs.some(p => p.id === cur && p.on)) $('.st-prov').value = cur; else { const first = provs.find(p => p.on && p.id !== 'prueba'); if (first) $('.st-prov').value = first.id; }
    estimate();
  }
  function shown() {
    return items.filter(it => filter === 'all' || (filter === 'fav' && it.fav) || (filter === 'agent' && it.by === 'agent') || (filter === 'you' && it.by !== 'agent') || (filter === 'video' && it.kind === 'video'));
  }
  const src = it => '/media/' + it.file.split('/').map(encodeURIComponent).join('/');
  function renderGrid() {
    const list = shown();
    $('.st-count').textContent = `${list.length} de ${items.length}`;
    $('.st-grid').innerHTML = list.length ? list.map((it, i) => `<figure class="st-card" data-i="${items.indexOf(it)}">
        <button type="button" class="st-thumb" aria-label="Ver en grande">${it.kind === 'video' ? `<video src="${src(it)}" preload="metadata" muted></video><span class="st-play">▶</span>` : `<img src="${src(it)}" alt="" loading="lazy">`}</button>
        <figcaption><span class="st-p">${esc(it.prompt)}</span><span class="st-meta">${esc(it.by === 'agent' ? (agentName(it.agent) || 'agente') : 'tú')} · ${esc(it.provider)} · ${new Date(it.at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span></figcaption>
        <div class="st-acts"><button type="button" data-a="fav" aria-label="Favorita" class="${it.fav ? 'on' : ''}">★</button><a href="${src(it)}" download aria-label="Descargar">⬇</a><button type="button" data-a="again" aria-label="Generar otra igual">↻</button><button type="button" data-a="del" aria-label="Mover a la papelera">🗑</button></div>
      </figure>`).join('') : `<div class="st-empty">${items.length ? 'Nada con este filtro.' : 'Aún no hay nada. Genera tu primera imagen a la izquierda, o pídesela a un agente de Marketing.'}</div>`;
  }
  async function load() {
    try { const j = await (await fetch('/api/media')).json(); items = j.items || []; provs = j.providers || []; budget = j.budget || null; } catch { items = []; }
    renderHead(); renderGrid();
  }
  const say = (t, bad) => { $('.st-msg').textContent = t; $('.st-msg').className = 'st-msg' + (bad ? ' bad' : ''); };
  async function generate(prompts) {
    if (busy) return; busy = true; $('.st-go').disabled = true;
    const kind = $('.st-kind').value, provider = $('.st-prov').value, ratio = $('.st-ratio').value, n = +$('.st-n').value || 1;
    let made = 0, fails = 0;
    for (let i = 0; i < prompts.length; i++) {
      say(`Generando ${i + 1} de ${prompts.length}${kind === 'video' ? ' (un video tarda unos minutos)' : ''}…`);
      try {
        const r = await fetch('/api/media/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: prompts[i], n, ratio, provider, kind, by: 'you' }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
        items = [...j.items, ...items]; budget = j.budget; made += j.items.length; renderGrid(); renderHead();
      } catch (e) { fails++; say(`No se pudo (${i + 1}/${prompts.length}): ${e.message}`, true); if (/tope|key/.test(e.message)) break; }
    }
    if (!fails) say(`Listo: ${made} ${made === 1 ? 'archivo' : 'archivos'} en la galería y en el cerebro (Agents Office/media).`);
    busy = false; $('.st-go').disabled = false;
  }
  function light(i) {
    const it = items[i]; if (!it) return;
    const L = $('.st-light'); L.hidden = false;
    L.innerHTML = `<div class="st-lbox"><button type="button" class="st-lx" aria-label="Cerrar">✕</button>${it.kind === 'video' ? `<video src="${src(it)}" controls autoplay></video>` : `<img src="${src(it)}" alt="">`}
      <div class="st-linfo"><p>${esc(it.prompt)}</p><p class="st-meta">${esc(it.provider)} · ${esc(it.model || '')} · ${esc(it.ratio || '')} · ${it.by === 'agent' ? esc(agentName(it.agent) || 'agente') : 'tú'} · ${new Date(it.at).toLocaleString('es')}${it.cost ? ` · ~US$${it.cost}` : ''}</p>
      <div class="st-row"><button type="button" class="st-copy">Copiar prompt</button><a href="${src(it)}" download class="st-dl">Descargar</a></div></div></div>`;
    L.querySelector('.st-lx').onclick = () => { L.hidden = true; L.innerHTML = ''; };
    L.querySelector('.st-copy').onclick = e => navigator.clipboard?.writeText(it.prompt).then(() => { e.target.textContent = 'Copiado ✓'; });
    L.onclick = e => { if (e.target === L) { L.hidden = true; L.innerHTML = ''; } };
  }
  el.addEventListener('click', async e => {
    if (e.target.closest('.st-x')) return close();
    const m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b === m)); $('.st-prompt').placeholder = mode === 'batch' ? 'Un prompt por línea — cada línea son «Variantes» imágenes. Ej.: los 12 fondos del mes de Instagram.' : 'Describe la imagen: sujeto, estilo, luz, encuadre, colores.'; estimate(); return; }
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; el.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b === f)); renderGrid(); return; }
    if (e.target.closest('.st-go')) {
      if (!isLive()) return say('El Estudio necesita la oficina real (ábrela con el iniciador).', true);
      const ps = mode === 'batch' ? lines() : [$('.st-prompt').value.trim()].filter(Boolean);
      if (!ps.length) { $('.st-prompt').focus(); return say('Escribe qué quieres generar.', true); }
      const c = cost(); if (c > 1 && !confirm(`Esto cuesta aprox. US$${c.toFixed(2)}. ¿Generar?`)) return;
      return generate(ps);
    }
    const card = e.target.closest('.st-card'); if (!card) return;
    const it = items[+card.dataset.i];
    if (e.target.closest('.st-thumb')) return light(+card.dataset.i);
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'fav') { it.fav = !it.fav; renderGrid(); fetch('/api/media/item/' + encodeURIComponent(it.file), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fav: it.fav }) }); }
    if (a === 'del') { if (!confirm('¿Mover a la papelera del Estudio? (Agents Office/media/.papelera)')) return; const r = await fetch('/api/media/item/' + encodeURIComponent(it.file), { method: 'DELETE' }); if (r.ok) { items = items.filter(x => x !== it); renderGrid(); } }
    if (a === 'again') { mode = 'one'; $('.st-prompt').value = it.prompt; if (provs.some(p => p.id === it.provider && p.on)) $('.st-prov').value = it.provider; $('.st-ratio').value = it.ratio || '1:1'; estimate(); $('.st-prompt').focus(); }
  });
  el.addEventListener('input', estimate); el.addEventListener('change', estimate);
  el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { if (!$('.st-light').hidden) { $('.st-light').hidden = true; $('.st-light').innerHTML = ''; } else close(); } });
  let timer = null;
  function open() { if (!el.hidden) return; opener = document.activeElement; el.hidden = false; document.body.classList.add('studioOpen'); requestAnimationFrame(() => el.classList.add('on')); load(); timer = setInterval(() => { if (!busy) load(); }, 15000); setTimeout(() => $('.st-prompt').focus(), 60); }
  function close() { if (el.hidden) return; el.classList.remove('on'); document.body.classList.remove('studioOpen'); clearInterval(timer); setTimeout(() => { el.hidden = true; }, 220); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden };
}

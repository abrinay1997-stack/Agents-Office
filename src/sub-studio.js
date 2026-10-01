// Agents Office — Dimitri's «Plan de creativos» on the page (the 6th mode of sub.mjs, «estudio»). Dimitri proposes creatives
// (model, prompt, how many, format, folder, cost) and a short closed list of tidy-up actions; nothing is generated until the
// owner presses GENERAR, which posts the edited plan to /api/sub/studio — the only route that spends through Dimitri.
// After that, each creative follows its job: sent, generating, ready (thumbnails that open the Estudio's viewer), failed.
// The pure parts (the total, the body that is sent, the image reducer for Claude's vision) are tested in tests/sub-studio.test.mjs.
//
//   creativesHTML(m, view) · actionsHTML(m, view) · stripHTML(files, esc) · studioBody(msgId, studio, edits) · planTotal(...)
//   fitsBudget(total, budget, fallback, weight) · discardBody(msgId, studio) · applyDiscards(messages, ids) · fitWithin(w, h, max) · shrinkStep(t, bytes, limit) · b64Bytes(str) · usd(x)

export const MAX_ATTACH = 4;                    // images per message (the server takes ≤4)
export const VISION_SIDE = 1568;                // Claude's vision gains nothing past this long side
export const VISION_BYTES = 1.5 * 1024 * 1024;  // each copy for the vision stays under 1.5 MB (the server refuses > 1.6 MB)
export const DIMITRI_FOLDER = 'Referencias de Dimitri';

/* ---------- pure: money ---------- */
export const usd = x => { const v = +x || 0; return 'US$' + (v > 0 && v < 0.1 ? v.toFixed(3) : v.toFixed(2)).replace('.', ','); };
/** The cost of one unit (one image, one video) of a creative: what Dimitri estimated while the model is his, the catalog's price once the owner picks another. */
export function unitCost(c, model, settings = {}) {
  const mine = +c.cost > 0 ? +c.cost / Math.max(1, +c.n || 1) : 0;
  const durChanged = settings.duration !== undefined && String(settings.duration) !== String((c.settings || {}).duration ?? settings.duration);
  if (!model || (model.id === c.model && !durChanged && mine)) return mine;
  if (model.per === 'second') { const d = +(settings.duration ?? model.settings?.duration?.default ?? model.seconds ?? 5) || 5; return (+model.cost || 0) * d; }
  return +model.cost || 0;
}
/** What the creatives still to be sent cost as the owner left them: [{i, cost}], the total, and their weight against the day's count (a video counts 5, as in media.budget). */
export function planTotal(creatives = [], edits = new Map(), models = []) {
  const items = []; let weight = 0;
  for (const c of creatives) {
    if (c.state && c.state !== 'proposed') continue;
    const e = edits.get(c.i) || {}; if (e.include === false) continue;
    const m = models.find(x => x.id === (e.model || c.model)) || null;
    const n = Math.max(1, +(e.n ?? c.n) || 1), u = unitCost(c, m, { ...(c.settings || {}), ...(e.settings || {}) });
    items.push({ i: c.i, n, cost: +(u * n).toFixed(3) });
    weight += n * (c.kind === 'video' ? 5 : 1);
  }
  return { count: items.length, units: items.reduce((s, x) => s + x.n, 0), weight, total: +items.reduce((s, x) => s + x.cost, 0).toFixed(3), items };
}
/** Does it fit in what is left of the day's count (`weight`: a video counts 5) and of the day's and the month's budget? `fallback` is the server's own verdict (when there is no budget to compare with). */
export function fitsBudget(total, budget, fallback, weight = 0) {
  if (!budget) return fallback && typeof fallback.fits === 'boolean' ? { fits: fallback.fits, why: fallback.why || '' } : { fits: true, why: '' };
  const count = budget.left !== null && budget.left !== undefined ? +budget.left : null; // media.submit refuses past the day's count too
  if (count !== null && weight > count) return { fits: false, why: `no cabe: quedan ${count} hoy en el tope del Estudio (un video cuenta 5)` };
  const lefts = [['hoy', budget.costLeftDay], ['este mes', budget.costLeftMonth]].filter(([, v]) => v !== null && v !== undefined);
  for (const [when, left] of lefts) if (total > left + 1e-9) return { fits: false, why: `no cabe: quedan ${usd(left)} ${when}` };
  return { fits: true, why: lefts.length ? `cabe en el presupuesto (quedan ${usd(Math.min(...lefts.map(([, v]) => v)))})` : count !== null ? `cabe en el tope de hoy (quedan ${count})` : 'sin tope de gasto' };
}
/** The body of POST /api/sub/studio: every creative still proposed, with only what the owner changed; and which actions go. */
export function studioBody(msgId, studio = {}, edits = new Map(), actionEdits = new Map()) {
  const items = (studio.creatives || []).filter(c => !c.state || c.state === 'proposed').map(c => {
    const e = edits.get(c.i) || {}, o = { i: c.i, include: e.include !== false };
    if (e.prompt !== undefined && e.prompt !== c.prompt) o.prompt = e.prompt;
    if (e.n !== undefined && +e.n !== +c.n) o.n = +e.n;
    if (e.model && e.model !== c.model) o.model = e.model;
    if (e.settings && Object.keys(e.settings).some(k => e.settings[k] !== (c.settings || {})[k])) o.settings = { ...(c.settings || {}), ...e.settings };
    if (e.folder !== undefined && e.folder !== (c.folder || '')) o.folder = e.folder;
    return o;
  });
  const actions = (studio.actions || []).map((a, k) => ({ k, include: actionEdits.get(k) !== false })).filter((a, k) => !(studio.actions[k].state && studio.actions[k].state !== 'proposed'));
  return { msg: msgId, items, ...(actions.length ? { actions } : {}) };
}

/** «Descartar»: the body that skips every creative and carries NO action — or null when an organising action is still proposed,
 *  because /api/sub/studio runs every proposed action of the message on any call; then the page discards on its own (applyDiscards). */
export function discardBody(msgId, studio = {}) {
  if ((studio.actions || []).some(a => !a.state || a.state === 'proposed')) return null;
  const items = (studio.creatives || []).filter(c => !c.state || c.state === 'proposed').map(c => ({ i: c.i, include: false }));
  return items.length ? { msg: msgId, items } : null;
}
/** The plans the owner discarded on this page: what is still proposed in them reads as skipped (a copy; the messages are not touched). */
export function applyDiscards(messages = [], ids = new Set()) {
  if (!ids.size) return messages;
  const skip = x => (!x.state || x.state === 'proposed' ? { ...x, state: 'skipped' } : x);
  return messages.map(m => (m && m.studio && ids.has(m.id) ? { ...m, studio: { ...m.studio, creatives: (m.studio.creatives || []).map(skip), actions: (m.studio.actions || []).map(skip) } } : m));
}

/** What a message takes once the uploads ended: the images that made it, the ones that did not, and the text — or `send: false`
 *  when there is no text and no image made it (Dimitri would get «Mira estas imágenes» about images that are not there). */
export function outgoing(text, attachments = []) {
  text = String(text || '').trim();
  const ready = attachments.filter(a => a.state === 'ready' && a.file), lost = attachments.filter(a => a.state === 'failed');
  if (!text && !ready.length) return { send: false, ready, lost, text: '' };
  return { send: true, ready, lost, text: text || (ready.length === 1 ? 'Mira esta imagen.' : 'Mira estas imágenes.') };
}

/* ---------- pure: the copy of an image for Claude's vision (the server never rescales) ---------- */
/** The size to draw an image at: its long side at most `max`, never upscaled. */
export function fitWithin(w, h, max = VISION_SIDE) {
  w = Math.max(1, Math.round(+w || 1)); h = Math.max(1, Math.round(+h || 1));
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: k < 1 };
}
/** One step of the reducer: null when `bytes` fits; else a lower JPEG quality, and once that is at its floor, a smaller picture. */
export function shrinkStep(t, bytes, limit = VISION_BYTES) {
  if (bytes <= limit) return null;
  if (t.q > 0.55) return { w: t.w, h: t.h, q: Math.round((t.q - 0.1) * 100) / 100 };
  return { w: Math.max(1, Math.round(t.w * 0.8)), h: Math.max(1, Math.round(t.h * 0.8)), q: 0.85 };
}
/** The bytes a base64 string carries (a data-URL's header is ignored). */
export const b64Bytes = s => { s = String(s || ''); const i = s.indexOf(','); if (s.startsWith('data:') && i > 0) s = s.slice(i + 1); const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0; return Math.max(0, Math.floor(s.length * 3 / 4) - pad); };

/* ---------- the page: HTML ---------- */
const mediaSrc = f => '/media/' + String(f).split('/').map(encodeURIComponent).join('/');
const JOB = { queued: 'en cola', running: 'generando…', done: 'listo', failed: 'falló', canceled: 'cancelado' };
const KIND = { image: 'IMAGEN', video: 'VIDEO' };

/** A strip of gallery thumbnails; each one opens the Estudio's viewer on it. */
export function stripHTML(files = [], esc) {
  if (!files.length) return '';
  return `<div class="sc-strip">${files.map(f => /\.(mp4|webm)$/i.test(f)
    ? `<button type="button" class="sc-th vid" data-open="${esc(f)}" aria-label="Abrir el video en el Estudio" title="Abrir en el Estudio"><video src="${esc(mediaSrc(f))}" muted preload="metadata"></video><span aria-hidden="true">▶</span></button>`
    : `<button type="button" class="sc-th" data-open="${esc(f)}" aria-label="Abrir la imagen en el Estudio" title="Abrir en el Estudio"><img src="${esc(mediaSrc(f))}" alt="" loading="lazy"></button>`).join('')}</div>`;
}

function settingSelect(m, key, val, esc, label) {
  const s = m && m.settings && m.settings[key]; if (!s || s.type !== 'enum') return '';
  const v = val ?? s.default;
  return `<label class="sc-f"><span>${label}</span><select class="sc-set" data-k="${key}">${s.values.map(x => `<option value="${esc(String(x))}"${String(x) === String(v) ? ' selected' : ''}>${esc(String(x))}</option>`).join('')}</select></label>`;
}

/** The creative cards of one of Dimitri's messages, with the total and GENERAR. view: { esc, edits, actionEdits, models, budget, jobs, folders } */
export function creativesHTML(m, v) {
  const s = m.studio; if (!s || !(s.creatives || []).length && !(s.actions || []).length) return '';
  const { esc } = v, edits = v.edits || new Map(), models = v.models || [];
  const cards = (s.creatives || []).map(c => {
    const e = edits.get(c.i) || {}, on = e.include !== false;
    const mid = e.model || c.model, m0 = models.find(x => x.id === mid);
    const kindLbl = `<span class="sc-kind">${KIND[c.kind] || 'IMAGEN'}</span>`;
    if (c.state && c.state !== 'proposed') {
      const job = c.jobId && v.jobs ? v.jobs.get(c.jobId) : null;
      const st = c.state === 'done' ? 'listo' : c.state === 'failed' ? 'falló' : c.state === 'skipped' ? 'no se incluyó' : job ? JOB[job.state] || job.state : 'enviado';
      const cls = c.state === 'done' ? 'ok' : c.state === 'failed' ? 'bad' : c.state === 'skipped' ? 'skip' : 'run';
      return `<div class="sc-card sent ${cls}"><div class="sc-body"><div class="sc-t">${esc(c.title || 'Creativo')} ${kindLbl}</div>
        <div class="sc-meta">${esc(c.modelName || c.model || '')}${c.n > 1 ? ` · ${c.n}` : ''} · <b>${esc(st)}</b>${c.state === 'failed' && c.error ? ' — ' + esc(c.error) : ''}${cls === 'run' ? '<span class="sb-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}</div>
        ${stripHTML(c.files || [], esc)}</div></div>`;
    }
    const n = Math.max(1, +(e.n ?? c.n) || 1), set = { ...(c.settings || {}), ...(e.settings || {}) };
    const opts = models.filter(x => x.kind === (c.kind || 'image') && (x.on || x.id === mid));
    const modelSel = opts.length
      ? `<select class="sc-model" aria-label="Modelo">${opts.map(x => `<option value="${esc(x.id)}"${x.id === mid ? ' selected' : ''}>${esc(x.name)}${x.on ? '' : ' (sin key)'}</option>`).join('')}</select>`
      : `<span class="sc-mname">${esc(c.modelName || c.model || '')}</span>`;
    const refs = [...(c.media?.reference || []), ...(c.media?.start || []), ...(c.media?.end || [])];
    const max = (v.budget && v.budget.maxPerRequest) || 8;
    const one = planTotal([c], edits, models).items[0];
    return `<div class="sc-card${on ? '' : ' off'}" data-msg="${esc(m.id)}" data-i="${c.i}">
      <label class="sc-inc"><input type="checkbox" class="sc-on"${on ? ' checked' : ''} aria-label="Incluir «${esc(c.title || 'creativo')}»"></label>
      <div class="sc-body">
        <div class="sc-t">${esc(c.title || 'Creativo')} ${kindLbl}${on ? '' : ' <span class="sc-offl">no se incluye</span>'}</div>
        <div class="sc-row">${modelSel}<span class="sc-cost" title="Costo estimado de este creativo">${usd(one ? one.cost : 0)}</span></div>
        ${c.why ? `<div class="sc-why">${esc(c.why)}</div>` : ''}
        <label class="sc-lab" for="scp-${esc(m.id)}-${c.i}">Prompt</label>
        <textarea class="sc-prompt" id="scp-${esc(m.id)}-${c.i}" rows="3">${esc(e.prompt ?? c.prompt ?? '')}</textarea>
        ${c.prompt_es && c.prompt_es !== c.prompt ? `<div class="sc-es"><span class="vh">En español: </span>${esc(c.prompt_es)}</div>` : ''}
        <div class="sc-row">
          <span class="sc-f"><span>Cantidad</span><span class="sc-qty" role="group" aria-label="Cantidad"><button type="button" class="sc-minus" aria-label="Una menos"${n <= 1 ? ' disabled' : ''}>−</button><output aria-live="polite">${n}</output><button type="button" class="sc-plus" aria-label="Una más"${n >= max ? ' disabled' : ''}>+</button></span></span>
          ${settingSelect(m0, 'aspectRatio', set.aspectRatio, esc, 'Formato')}${c.kind === 'video' ? settingSelect(m0, 'duration', set.duration, esc, 'Segundos') : ''}
          <label class="sc-f"><span>Carpeta</span><input class="sc-folder" list="scFolders" value="${esc(e.folder ?? c.folder ?? '')}" placeholder="sin carpeta" maxlength="60"></label>
        </div>
        ${refs.length ? `<div class="sc-refs"><span class="sc-lab">Usa de referencia</span>${stripHTML(refs, esc)}</div>` : ''}
      </div></div>`;
  }).join('');
  const acts = actionsHTML(m, v);
  const open = (s.creatives || []).some(c => !c.state || c.state === 'proposed') || (s.actions || []).some(a => !a.state || a.state === 'proposed');
  let foot = '';
  if (open) {
    const t = planTotal(s.creatives || [], edits, models);
    const nActs = (s.actions || []).filter((a, k) => (!a.state || a.state === 'proposed') && (v.actionEdits || new Map()).get(k) !== false).length;
    const f = fitsBudget(t.total, v.budget, s.estimate, t.weight);
    const label = t.count ? `GENERAR (${t.units}) — ${usd(t.total)}` : nActs ? `HACER (${nActs})` : 'GENERAR (0)';
    foot = `<div class="sc-foot"><div class="sc-total${f.fits ? '' : ' bad'}">Total: <b>${usd(t.total)}</b> · ${esc(f.why || (f.fits ? 'cabe en el presupuesto' : 'no cabe en el presupuesto'))}</div>
      <div class="sb-acts"><button type="button" class="sc-go" data-msg="${esc(m.id)}"${t.count + nActs ? '' : ' disabled'}>${label}</button><button type="button" class="sc-skip" data-msg="${esc(m.id)}">Descartar</button></div>
      <div class="sc-note">Nada se genera hasta que pulses ${t.count ? 'GENERAR' : 'HACER'}. Cada pedido pasa por tus topes del Estudio.</div></div>`;
  }
  return `<div class="sc-plan">${cards}${acts}${foot}</div>`;
}

/** The tidy-up actions Dimitri proposes (closed list), each with its box; done ones say how they went. */
export function actionsHTML(m, v) {
  const list = (m.studio && m.studio.actions) || []; if (!list.length) return '';
  const { esc } = v, ae = v.actionEdits || new Map();
  const say = a => a.type === 'carpeta_crear' ? `Crear la carpeta «${esc(a.name)}»`
    : a.type === 'carpeta_renombrar' ? `Renombrar «${esc(a.from)}» a «${esc(a.to)}»`
    : a.type === 'mover' ? `Mover ${(a.files || []).length} ${(a.files || []).length === 1 ? 'archivo' : 'archivos'} a «${esc(a.folder)}»`
    : a.type === 'enviar_contenido' ? 'Enviar a Contenido como idea (no se aprueba ni se publica)' : '';
  const rows = list.map((a, k) => {
    const txt = say(a); if (!txt) return '';
    if (a.state && a.state !== 'proposed') return `<li class="sc-act ${a.state === 'failed' ? 'bad' : 'ok'}"><span aria-hidden="true">${a.state === 'failed' ? '⚠' : a.state === 'skipped' ? '–' : '✓'}</span> ${txt}${a.state === 'failed' && a.error ? ' — ' + esc(a.error) : a.state === 'skipped' ? ' (no se hizo)' : ''}</li>`;
    return `<li class="sc-act"><label><input type="checkbox" class="sc-acton" data-msg="${esc(m.id)}" data-k="${k}"${ae.get(k) !== false ? ' checked' : ''}> ${txt}</label></li>`;
  }).join('');
  return rows ? `<div class="sc-acts"><div class="sc-lab">Además, para ordenar</div><ul>${rows}</ul></div>` : '';
}

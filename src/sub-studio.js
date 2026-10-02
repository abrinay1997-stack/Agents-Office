// Agents Office — Dimitri's «Plan de creativos» on the page (the 6th mode of sub.mjs, «estudio»). Dimitri proposes creatives
// (model, prompt, how many, format, folder, cost) and a short closed list of tidy-up actions; nothing is generated until the
// owner presses GENERAR, which posts the edited plan to /api/sub/studio — the only route that spends through Dimitri.
// After that, each creative follows its job: sent, generating, ready (thumbnails that open the Estudio's viewer), failed.
// The pure parts (the total, the body that is sent, the image reducer for Claude's vision) are tested in tests/sub-studio.test.mjs.
//
//   creativesHTML(m, view) · actionsHTML(m, view) · stripHTML(files, esc) · studioBody(msgId, studio, edits) · planTotal(...)
//   fitsBudget(total, budget, fallback, weight) · actionsCost(actions, actionEdits) · discardBody(msgId, studio) · applyDiscards(messages, ids) · fitWithin(w, h, max) · shrinkStep(t, bytes, limit) · b64Bytes(str) · usd(x)
//   Banco de presets F3 (E7): loteHTML(m, view) · loteRefHTML(m, view) · loteVivo(m) · esHoja(name) — the lote Dimitri
//   proposes (PROBAR CON 3 · GENERAR LAS N · Descartar), its live card (bar, counts, before/after) and SEGUIR after the sample. Every button posts
//   to /api/sub/studio with { lote: { accion } } (studioBody's 5th argument): the only route that spends through Dimitri.

import { weightOf } from '../estudio-plan.mjs'; // V4.11 (DIM-02): one source for what counts against the day's cap (a video 5, a music 3)

export const MAX_ATTACH = 4;                    // images per message (the server takes ≤4)
export const VISION_SIDE = 1568;                // Claude's vision gains nothing past this long side
export const VISION_BYTES = 1.5 * 1024 * 1024;  // each copy for the vision stays under 1.5 MB (the server refuses > 1.6 MB)
export const DIMITRI_FOLDER = 'Referencias de Dimitri';

/* ---------- pure: money ---------- */
export const usd = x => { const v = +x || 0; return 'US$' + (v > 0 && v < 0.1 ? v.toFixed(3) : v.toFixed(2)).replace('.', ','); };
/** The cost of one unit (one image, one video) of a creative: what Dimitri estimated while the model is his, the catalog's price once the owner picks another. */
export function unitCost(c, model, settings = {}, prompt) {
  const mine = +c.cost > 0 ? +c.cost / Math.max(1, +c.n || 1) : 0;
  if (model && model.perChar && prompt !== undefined) return +(model.perChar * String(prompt).length).toFixed(4); // V4.11: a voice-over costs by the characters of the text the owner left
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
    const n = Math.max(1, +(e.n ?? c.n) || 1), u = unitCost(c, m, { ...(c.settings || {}), ...(e.settings || {}) }, e.prompt !== undefined ? e.prompt : (m && m.perChar ? c.prompt || '' : undefined));
    items.push({ i: c.i, n, cost: +(u * n).toFixed(3) });
    weight += n * weightOf((m && m.kind) || c.kind);
  }
  return { count: items.length, units: items.reduce((s, x) => s + x.n, 0), weight, total: +items.reduce((s, x) => s + x.cost, 0).toFixed(3), items };
}
/** Does it fit in what is left of the day's count (`weight`: a video counts 5) and of the day's and the month's budget? `fallback` is the server's own verdict (when there is no budget to compare with). */
export function fitsBudget(total, budget, fallback, weight = 0) {
  if (!budget) return fallback && typeof fallback.fits === 'boolean' ? { fits: fallback.fits, why: fallback.why || '' } : { fits: true, why: '' };
  const count = budget.left !== null && budget.left !== undefined ? +budget.left : null; // media.submit refuses past the day's count too
  if (count !== null && weight > count) return { fits: false, why: `no cabe: quedan ${count} hoy en el tope del Estudio (un video cuenta 5, una música 3)` };
  const lefts = [['hoy', budget.costLeftDay], ['este mes', budget.costLeftMonth]].filter(([, v]) => v !== null && v !== undefined);
  for (const [when, left] of lefts) if (total > left + 1e-9) return { fits: false, why: `no cabe: quedan ${usd(left)} ${when}` };
  return { fits: true, why: lefts.length ? `cabe en el presupuesto (quedan ${usd(Math.min(...lefts.map(([, v]) => v)))})` : count !== null ? `cabe en el tope de hoy (quedan ${count})` : 'sin tope de gasto' };
}
/** F3: what the ticked lote actions still proposed spend with the same click (only «reintentar» spends): { usd, weight } — the foot's total counts it. */
export function actionsCost(actions = [], actionEdits = new Map()) {
  let u = 0, w = 0;
  actions.forEach((a, k) => { if (a.type === 'lote_reintentar' && (!a.state || a.state === 'proposed') && actionEdits.get(k) !== false) { u += +a.costo || 0; w += +a.cuantas || 0; } });
  return { usd: +u.toFixed(3), weight: w };
}
/** The body of POST /api/sub/studio: every creative still proposed, with only what the owner changed; and which actions go. */
export function studioBody(msgId, studio = {}, edits = new Map(), actionEdits = new Map(), lote = '') {
  if (lote) { // a lote button carries only the lote: the creatives and the actions of the message wait for their own GENERAR
    const e = (edits && edits.get(-1)) || {}, canal = e.settings && e.settings.canal;
    return { msg: msgId, items: [], lote: { accion: String(lote), ...(canal && canal !== (studio.lote?.receta?.canal) ? { canal } : {}), ...(e.model && e.model !== studio.lote?.modelo ? { modelo: e.model } : {}) } };
  }
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
  const lote = studio.lote && studio.lote.state === 'proposed' ? { lote: { accion: 'descartar' } } : {}; // F3: a lote that never started is discarded with the rest
  return items.length || lote.lote ? { msg: msgId, items, ...lote } : null;
}
/** The plans the owner discarded on this page: what is still proposed in them reads as skipped (a copy; the messages are not touched). */
export function applyDiscards(messages = [], ids = new Set()) {
  if (!ids.size) return messages;
  const skip = x => (!x.state || x.state === 'proposed' ? { ...x, state: 'skipped' } : x);
  return messages.map(m => (m && m.studio && ids.has(m.id) ? { ...m, studio: { ...m.studio, creatives: (m.studio.creatives || []).map(skip), actions: (m.studio.actions || []).map(skip), ...(m.studio.lote && !m.studio.lote.id ? { lote: skip(m.studio.lote) } : {}) } } : m));
}

/** What a message takes once the uploads ended: the images that made it, the ones that did not, and the text — or `send: false`
 *  when there is no text and no image made it (Dimitri would get «Mira estas imágenes» about images that are not there). */
export function outgoing(text, attachments = []) {
  text = String(text || '').trim();
  const ready = attachments.filter(a => a.state === 'ready' && a.file && !a.hoja), lost = attachments.filter(a => a.state === 'failed');
  const hoja = attachments.find(a => a.state === 'ready' && a.hoja) || null; // F3: an Excel or a CSV, read by /api/media/lotes/hoja (Dimitri gets its summary)
  if (!text && !ready.length && !hoja) return { send: false, ready, lost, text: '', hoja: null };
  return { send: true, ready, lost, hoja: hoja ? hoja.hoja : null, text: text || (hoja && !ready.length ? 'Mira esta hoja.' : ready.length === 1 ? 'Mira esta imagen.' : 'Mira estas imágenes.') };
}
/** F3: an Excel or a CSV goes to Dimitri as a sheet (its rows), never as an image. */
export const esHoja = name => /\.(xlsx|csv)$/i.test(String(name || ''));
/** A lote of this message still moves (its card polls the office): started and not finished, or a sample waiting for SEGUIR. */
export function loteVivo(m) {
  const L = m && m.studio && m.studio.lote;
  if (L && L.id && !(L.progreso && ['hecho', 'cancelado'].includes(L.progreso.estado))) return true;
  return !!(m && m.studio && m.studio.loteRef && m.studio.loteRef.seguir);
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
export const KIND = { image: 'IMAGEN', video: 'VIDEO', audio: 'VOZ', music: 'MÚSICA' }; // V4.11 (DIM-02): a voice-over or a jingle never reads «IMAGEN»
const AUDIO_RE = /\.(mp3|wav|flac|m4a|ogg)$/i;

/** A strip of gallery thumbnails; each one opens the Estudio's viewer on it. A sound file is a player with its ♪ (as in the gallery), never a broken image. */
export function stripHTML(files = [], esc) {
  if (!files.length) return '';
  return `<div class="sc-strip">${files.map(f => AUDIO_RE.test(f)
    ? `<div class="sc-au"><span class="sc-au-ic" aria-hidden="true">♪</span><audio controls preload="none" src="${esc(mediaSrc(f))}" aria-label="Escuchar ${esc(String(f).split('/').pop())}"></audio><button type="button" class="sc-au-open" data-open="${esc(f)}" aria-label="Abrir el audio en el Estudio" title="Abrir en el Estudio">Abrir</button></div>`
    : /\.(mp4|webm)$/i.test(f)
    ? `<button type="button" class="sc-th vid" data-open="${esc(f)}" aria-label="Abrir el video en el Estudio" title="Abrir en el Estudio"><video src="${esc(mediaSrc(f))}" muted preload="metadata"></video><span aria-hidden="true">▶</span></button>`
    : `<button type="button" class="sc-th" data-open="${esc(f)}" aria-label="Abrir la imagen en el Estudio" title="Abrir en el Estudio"><img src="${esc(mediaSrc(f))}" alt="" loading="lazy"></button>`).join('')}</div>`;
}
/** V4.11 (DIM-02, DIM-03): the voice picker of a voice-over card — the owner's voices first, then the system's; an id that is neither stays, said. */
export function voiceSelect(val, voices = { voices: [], system: [] }, esc) {
  const own = voices.voices || [], sys = voices.system || [], known = [...own, ...sys].some(v => v.voiceId === val);
  return `<label class="sc-f sc-fw"><span>Voz</span><select class="sc-set" data-k="voiceId">${!known && val ? `<option value="${esc(val)}" selected>${esc(val)} (no la encuentro)</option>` : ''}${own.length ? `<optgroup label="Tus voces">${own.map(v => `<option value="${esc(v.voiceId)}"${v.voiceId === val ? ' selected' : ''}>${esc(v.name || v.voiceId)} · ${v.kind === 'design' ? 'diseñada' : 'clonada'}</option>`).join('')}</optgroup>` : ''}<optgroup label="Del sistema">${sys.map(v => `<option value="${esc(v.voiceId)}"${v.voiceId === val ? ' selected' : ''}>${esc(v.name || v.voiceId)}</option>`).join('')}</optgroup></select></label>`;
}

function settingSelect(m, key, val, esc, label) {
  const s = m && m.settings && m.settings[key]; if (!s || s.type !== 'enum') return '';
  const v = val ?? s.default;
  return `<label class="sc-f"><span>${label}</span><select class="sc-set" data-k="${key}">${s.values.map(x => `<option value="${esc(String(x))}"${String(x) === String(v) ? ' selected' : ''}>${esc(String(x))}</option>`).join('')}</select></label>`;
}

/** What the text box of a creative is: a prompt, the words a voice will say, a song's lyrics or the description of an instrumental piece. */
export const promptLabel = (kind, set = {}) => (kind === 'audio' ? 'Texto que se dirá' : kind === 'music' ? (set.instrumental ? 'Descripción de la pieza' : 'Letra (con [Verse], [Chorus]…)') : 'Prompt');
/** V4.11 (DIM-02): the settings of a voice-over (voice, emotion, speed) or of a piece of music (instrumental, style) on the card. */
function soundRow(kind, m, set, voices, esc) {
  const s = (m && m.settings) || {};
  if (kind === 'audio') {
    const emo = s.emotion && s.emotion.type === 'enum' ? `<label class="sc-f"><span>Emoción</span><select class="sc-set" data-k="emotion">${s.emotion.values.map(x => `<option value="${esc(String(x))}"${String(x) === String(set.emotion ?? s.emotion.default) ? ' selected' : ''}>${esc(x ? String(x) : 'la de la voz')}</option>`).join('')}</select></label>` : '';
    const spd = s.speed && s.speed.type === 'range' ? `<label class="sc-f"><span>Velocidad</span><input class="sc-set sc-num" data-k="speed" type="number" min="${s.speed.min}" max="${s.speed.max}" step="${s.speed.step || 0.05}" value="${esc(String(set.speed ?? s.speed.default))}"></label>` : '';
    return `<div class="sc-row">${s.voiceId ? voiceSelect(set.voiceId ?? s.voiceId.default, voices, esc) : ''}${emo}${spd}</div>`;
  }
  const inst = s.instrumental ? `<label class="sc-f sc-chk"><input type="checkbox" class="sc-set" data-k="instrumental"${set.instrumental ? ' checked' : ''}> <span>Instrumental (sin letra)</span></label>` : '';
  const sty = s.style ? `<label class="sc-f sc-fw"><span>Estilo</span><input class="sc-set sc-style" data-k="style" maxlength="${s.style.max || 2000}" value="${esc(String(set.style ?? ''))}" placeholder="género, ánimo, voz"></label>` : '';
  return `<div class="sc-row">${inst}${sty}</div>`;
}

/** The creative cards of one of Dimitri's messages, with the total and GENERAR. view: { esc, edits, actionEdits, models, budget, jobs, folders, voices } */
export function creativesHTML(m, v) {
  const s = m.studio; if (!s || !(s.creatives || []).length && !(s.actions || []).length && !s.lote && !s.loteRef) return '';
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
    const pre = Array.isArray(c.presets); // F3: an edit by presets — the recipe and its steps, not a prompt box; only the models that serve it
    const n = Math.max(1, +(e.n ?? c.n) || 1), set = { ...(c.settings || {}), ...(e.settings || {}) }, sound = c.kind === 'audio' || c.kind === 'music';
    const opts = pre ? uniq([{ id: c.model, name: c.modelName }, ...(c.alternativas || [])]).map(x => ({ ...x, on: 1 })) : models.filter(x => x.kind === (c.kind || 'image') && (x.on || x.id === mid));
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
        ${pre ? `<div class="sl-chips">${chips([...(c.recetaEs || []), c.canalEs, c.escenaEs].filter(Boolean), esc)}</div>${lis(c.avisosPreset, esc)}${queHara(c, esc)}` : `<label class="sc-lab" for="scp-${esc(m.id)}-${c.i}">${promptLabel(c.kind, set)}</label>
        <textarea class="sc-prompt" id="scp-${esc(m.id)}-${c.i}" rows="3">${esc(e.prompt ?? c.prompt ?? '')}</textarea>
        ${sound ? '' : c.prompt_es && c.prompt_es !== c.prompt ? `<div class="sc-es"><span class="vh">En español: </span>${esc(c.prompt_es)}</div>` : ''}`}
        ${sound ? soundRow(c.kind, m0, set, v.voices, esc) : ''}
        <div class="sc-row">
          <span class="sc-f"><span>Cantidad</span><span class="sc-qty" role="group" aria-label="Cantidad"><button type="button" class="sc-minus" aria-label="Una menos"${n <= 1 ? ' disabled' : ''}>−</button><output aria-live="polite">${n}</output><button type="button" class="sc-plus" aria-label="Una más"${n >= max ? ' disabled' : ''}>+</button></span></span>
          ${sound || pre ? '' : settingSelect(m0, 'aspectRatio', set.aspectRatio, esc, 'Formato')}${c.kind === 'video' ? settingSelect(m0, 'duration', set.duration, esc, 'Segundos') : ''}
          <label class="sc-f"><span>Carpeta</span><input class="sc-folder" list="scFolders" value="${esc(e.folder ?? c.folder ?? '')}" placeholder="sin carpeta" maxlength="60"></label>
        </div>
        ${refs.length ? `<div class="sc-refs"><span class="sc-lab">Usa de referencia</span>${stripHTML(refs, esc)}</div>` : ''}
      </div></div>`;
  }).join('');
  const acts = actionsHTML(m, v);
  const open = (s.creatives || []).some(c => !c.state || c.state === 'proposed') || (s.actions || []).some(a => !a.state || a.state === 'proposed');
  let foot = '';
  if (open) {
    const t = planTotal(s.creatives || [], edits, models), ae = v.actionEdits || new Map(), x = actionsCost(s.actions, ae), all = +(t.total + x.usd).toFixed(3);
    const nActs = (s.actions || []).filter((a, k) => (!a.state || a.state === 'proposed') && ae.get(k) !== false).length;
    const f = fitsBudget(all, v.budget, s.estimate, t.weight + x.weight);
    const label = t.count ? `GENERAR (${t.units}) — ${usd(all)}` : nActs ? `HACER (${nActs})${x.usd ? ' — ' + usd(all) : ''}` : 'GENERAR (0)';
    foot = `<div class="sc-foot"><div class="sc-total${f.fits ? '' : ' bad'}">Total: <b>${usd(all)}</b> · ${esc(f.why || (f.fits ? 'cabe en el presupuesto' : 'no cabe en el presupuesto'))}</div>
      <div class="sb-acts"><button type="button" class="sc-go" data-msg="${esc(m.id)}"${t.count + nActs ? '' : ' disabled'}>${label}</button><button type="button" class="sc-skip" data-msg="${esc(m.id)}">Descartar</button></div>
      <div class="sc-note">Nada se genera hasta que pulses ${t.count ? 'GENERAR' : 'HACER'}. Cada pedido pasa por tus topes del Estudio.</div></div>`;
  }
  return `<div class="sc-plan">${cards}${loteHTML(m, v)}${loteRefHTML(m, v)}${acts}${foot}</div>`;
}

/* ---------- F3: the presets and the lote in Dimitri's chat (compact markup: the page has a size budget, check.mjs) ---------- */
const chips = (list, esc) => list.map(x => `<span class="sl-chip">${esc(typeof x === 'string' ? x : x.nombre + (x.intensidad ? ' · ' + x.intensidad : ''))}</span>`).join('');
const selectOf = (cls, label, opts, cur, esc) => `<select class="${cls}" aria-label="${label}">${opts.map(x => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name || x.nombre || x.id)}</option>`).join('')}</select>`;
const uniq = l => l.filter((x, k, a) => x.id && a.findIndex(y => y.id === x.id) === k);
const lis = (l, esc, cls = 'sl-avisos') => (l && l.length ? `<ul class="${cls}">${l.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '');
const why = (t, esc) => (t ? `<div class="sc-why">${esc(t)}</div>` : '');
/** «Qué hará»: the compiler's steps in Spanish, folded; the prompt it will send folded under it (the bank's: not editable). */
function queHara(c, esc) {
  const p = c.pasos || []; if (!p.length && !c.prompt) return '';
  return `<details class="sl-que"><summary>Qué hará${p.length ? ` · ${p.length} pasos` : ''}</summary>${p.length ? `<ol>${p.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${c.prompt ? `<p lang="en">${esc(c.prompt)}</p>` : ''}</details>`;
}
const zip = (id, esc) => `<a class="sl-b" href="/api/media/lotes/${esc(encodeURIComponent(id))}/zip?que=listas" download>Descargar ZIP</a>`;
const ver = (id, esc) => `<button type="button" class="sl-b sl-ver" data-lote="${esc(id)}">Ver el lote</button>`;
/** The lote Dimitri proposes (PROBAR CON 3 · GENERAR LAS N · Descartar) or, once started, its live card (bar, counts, before → after). */
export function loteHTML(m, v) {
  const L = m.studio && m.studio.lote; if (!L) return '';
  const { esc } = v, e = (v.edits || new Map()).get(-1) || {}, msg = esc(m.id), est = L.estimate || {};
  const open = (cls, at = '') => `<div class="sc-card sl-card${cls}"${at} role="group" aria-label="Lote «${esc(L.nombre)}»"><div class="sc-body"><div class="sc-t">${esc(L.nombre)} <span class="sc-kind">LOTE</span></div>`;
  const vistas = (L.muestras || []).slice(0, 6);
  const fotos = `<div class="sl-fotos">${stripHTML(vistas, esc)}${vistas.length && L.n > vistas.length ? `<span class="sl-mas">+${L.n - vistas.length}<span class="vh"> más</span></span>` : ''}<span class="sc-lab">${esc(L.fotosEs || `${L.n} fotos`)}</span></div>`;
  if (L.state === 'skipped' && !L.id) return open(' sent skip') + `<div class="sc-meta"><b>${esc(L.error || 'descartado')}</b></div></div></div>`;
  if (L.id) { // started: the live card
    const p = L.progreso || { estado: 'previsto', hechas: 0, total: L.n, quedan: L.n, gastado: 0, pares: [] }, txt = p.texto || `${p.hechas} de ${p.total}`, muestra = p.estado === 'pausado' && p.motivo === 'muestra';
    const pares = (p.pares || []).map(x => `<li class="sl-par ${esc(x.estado)}"><button type="button" class="sc-th" data-open="${esc(x.src)}" aria-label="Antes #${x.n}"><img src="${esc(mediaSrc(x.src))}" alt="" loading="lazy"></button><span aria-hidden="true">→</span><button type="button" class="sc-th" data-open="${esc(x.out)}" aria-label="Después #${x.n}"><img src="${esc(mediaSrc(x.out))}" alt="" loading="lazy"></button><span class="sc-lab">#${x.n}${x.sku ? ' · ' + esc(x.sku) : ''} <b>${esc(x.marca || '')}</b>${x.motivo ? '<br>' + esc(x.motivo) : ''}</span></li>`).join('');
    return open(` sent ${p.estado === 'hecho' ? 'ok' : p.fallo ? 'bad' : 'run'}`)
      + `<div class="sl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.hechas}" aria-label="Fotos hechas"><i style="width:${p.total ? Math.round(p.hechas / p.total * 100) : 0}%"></i></div>`
      + `<div class="sc-meta"><b>${esc(p.estadoEs || p.estado)}</b> · ${esc(txt)} · ${usd(p.gastado)} de ${usd(p.estimado || est.total)}</div>`
      + why(p.motivo && !muestra ? p.motivo : '', esc) + (pares ? `<ul class="sl-pares" aria-label="Antes y después">${pares}</ul>` : fotos)
      + `<div class="sb-acts">${ver(L.id, esc)}</div></div></div>`;
  }
  // proposed: nothing exists yet, nothing is spent until a button
  const k = L.muestra > 0 ? L.muestra : 3, prueba = L.n > k, pf = +est.porFoto || 0, total = +est.total || 0, canales = v.canales || L.canales || [];
  const go = (lote, txt, sec) => `<button type="button" class="sc-go${sec ? ' sl-b' : ''}" data-msg="${msg}" data-lote="${lote}">${txt} · ${pf ? usd(lote === 'probar' ? est.muestraUsd ?? pf * k : total) : 'gratis'}</button>`; // the server starts only what this said (estudio-lote.costoSinVer)
  return open('', ` data-msg="${msg}" data-i="-1"`) + fotos + `<div class="sl-chips">${chips([...(L.recetaEs || []), L.escenaEs].filter(Boolean), esc)}</div>`
    + `<div class="sc-row">${canales.length ? `<label class="sc-f"><span>Canal</span>${selectOf('sc-set" data-k="canal', 'Canal', canales, (e.settings && e.settings.canal) || L.receta.canal, esc)}</label>` : ''}`
    + `${L.soloLocal || !L.alternativas || !L.alternativas.length ? `<span class="sc-mname">${esc(L.modelName || '')}</span>` : selectOf('sc-model', 'Modelo del lote', uniq([{ id: L.modelo, name: L.modelName }, ...L.alternativas]), e.model || L.modelo, esc)}<span class="sc-cost">${pf ? 'aprox. ' + usd(total) : 'gratis'}</span></div>`
    + `<div class="sc-total${est.fits === false ? ' bad' : ''}">${esc(est.why || '')}</div>` + why(L.porQue, esc) + lis((L.avisos || []).slice(0, 6), esc)
    + (L.error ? `<div class="sc-total bad" role="alert">${esc(L.error)}</div>` : '') + queHara(L, esc)
    + `<div class="sb-acts">${prueba ? go('probar', `PROBAR CON ${k}`, L.n < 10) : ''}${go('todas', `GENERAR ${L.n === 1 ? 'LA FOTO' : `LAS ${L.n}`}`, prueba && L.n >= 10)}<button type="button" class="sc-skip" data-msg="${msg}">Descartar</button></div>`
    + `<div class="sc-note">Nada se gasta sin tu clic${prueba ? `; PROBAR hace ${k} y te pregunta` : ''}.</div></div></div>`;
}
/** A message about a lote (the sample is ready, a pause, the end): SEGUIR, CAMBIAR RECETA, «Ver el lote», the ZIP. */
export function loteRefHTML(m, v) {
  const r = m.studio && m.studio.loteRef; if (!r) return '';
  const { esc } = v;
  return `<div class="sb-acts sl-ref">${r.seguir ? `<button type="button" class="sc-go" data-msg="${esc(m.id)}" data-lote="seguir">SEGUIR CON LAS ${r.quedan}${r.costo ? ` · ${usd(r.costo)}` : ''}</button><button type="button" class="sl-b sl-cambiar" data-msg="${esc(r.msg)}">CAMBIAR RECETA</button>` : ''}${ver(r.id, esc)}${r.fin ? zip(r.id, esc) : ''}</div>`;
}

/** The tidy-up actions Dimitri proposes (closed list), each with its box; done ones say how they went. */
export function actionsHTML(m, v) {
  const list = (m.studio && m.studio.actions) || []; if (!list.length) return '';
  const { esc } = v, ae = v.actionEdits || new Map();
  const say = a => a.type === 'carpeta_crear' ? `Crear la carpeta «${esc(a.name)}»`
    : a.type === 'carpeta_renombrar' ? `Renombrar «${esc(a.from)}» a «${esc(a.to)}»`
    : a.type === 'mover' ? `Mover ${(a.files || []).length} ${(a.files || []).length === 1 ? 'archivo' : 'archivos'} a «${esc(a.folder)}»`
    : a.type === 'enviar_contenido' ? 'Enviar a Contenido como idea (no se aprueba ni se publica)'
    : /^lote_/.test(a.type) ? esc(a.texto || a.type) : ''; // F3: pausar, reanudar, reintentar (gasta, y lo dice) o aprobar un lote — the server words it (estudio-lote.accionLoteEs)
  const rows = list.map((a, k) => {
    const txt = say(a); if (!txt) return '';
    if (a.state && a.state !== 'proposed') return `<li class="sc-act ${a.state === 'failed' ? 'bad' : 'ok'}"><span aria-hidden="true">${a.state === 'failed' ? '⚠' : a.state === 'skipped' ? '–' : '✓'}</span> ${txt}${a.state === 'failed' && a.error ? ' — ' + esc(a.error) : a.state === 'skipped' ? ' (no se hizo)' : ''}</li>`;
    return `<li class="sc-act"><label><input type="checkbox" class="sc-acton" data-msg="${esc(m.id)}" data-k="${k}"${ae.get(k) !== false ? ' checked' : ''}> ${txt}</label></li>`;
  }).join('');
  const soloLote = list.every(a => /^lote_/.test(a.type)); // F3: «Pausar el lote…» is not tidying up
  return rows ? `<div class="sc-acts"><div class="sc-lab">${soloLote ? 'Sobre el lote (cada una espera tu clic)' : 'Además, para ordenar'}</div><ul>${rows}</ul></div>` : '';
}

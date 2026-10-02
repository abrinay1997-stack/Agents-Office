// Agents Office — V4.11: the cards of what Dimitri proposes for the calendar and the office («ops», sub.mjs → parseOps), and his
// questions with options. Pure: HTML strings and the bodies the page posts, tested in tests/sub-ops.test.mjs. Nothing here changes the
// office: HACER posts /api/sub/ops (only the owner's click), RESPONDER posts the picked options as the owner's message.
//
//   opsHTML(m, view) · opsBody(msgId, ops, edits) · opLabel(o, view) · questionsHTML(m, picks, view) · pickBody(questions, picks) · pastChoices(at, now)

const DAYS = [['L', 1, 'lunes'], ['M', 2, 'martes'], ['X', 3, 'miércoles'], ['J', 4, 'jueves'], ['V', 5, 'viernes'], ['S', 6, 'sábado'], ['D', 0, 'domingo']];
const FORMATOS = ['post', 'reel', 'carrusel', 'historia'];
export const UNDO_MS = 30000; // the server's OPS_UNDO_MS
const two = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const local = ms => { const d = new Date(ms); return `${ymd(d)}T${two(d.getHours())}:${two(d.getMinutes())}`; };
const dayText = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) : 'sin día');
const whenText = ms => new Date(ms).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const whenWords = w => !w ? '' : w.kind === 'daily' ? `todos los días a las ${w.at}` : w.kind === 'weekdays' ? `de lunes a viernes a las ${w.at}` : `cada ${(w.days || []).map(d => DAYS.find(x => x[1] === d)?.[2]).filter(Boolean).join(', ')} a las ${w.at}`;
/** Undoing a move gives the day and the hour back, not the OK the approved piece lost: the card says so (the owner approves again). */
export const undoneNote = o => (o.type === 'pieza_mover' && o.soltada ? ' — sigue sin OK: vuelve a aprobarla en Contenido' : '');

/** One line that says what an op does, in the owner's words. */
export function opLabel(o, { esc = s => s, deptName = k => k } = {}) {
  switch (o.type) {
    case 'rutina_crear': return `Rutina nueva en ${esc(deptName(o.dept))}: «${esc(o.title || o.text)}»`;
    case 'rutina_saltar': return `Saltar la rutina «${esc(o.title || o.id)}» del ${esc(whenText(o.at))} (sin pausarla)`;
    case 'pieza_crear': return `Borrador en Contenido: ${esc(dayText(o.fecha))}${o.hora ? ' · ' + esc(o.hora) : ''} · ${esc(o.formato)} ${esc((o.redes || []).map(r => (r === 'instagram' ? 'IG' : 'FB')).join('+'))} — «${esc(o.titulo)}»`;
    case 'pieza_mover': return `Mover la pieza «${esc(o.titulo || o.id)}» al ${esc(dayText(o.fecha))}${o.hora ? ' · ' + esc(o.hora) : ''}`;
    case 'tarea_mover': return `Mover la tarea «${esc(o.title || o.id)}» al ${esc(whenText(o.at))}`;
    case 'tarea_cancelar': return `Cancelar la tarea «${esc(o.title || o.id)}»`;
    default: return '';
  }
}
const NOTE = { rutina_crear: 'Corre sola en su horario; puedes pausarla en el calendario (P).', pieza_crear: 'Nace como borrador: tú la apruebas en Contenido. Nada se publica.', pieza_mover: 'Si estaba aprobada, pierde el OK y la vuelves a aprobar.', tarea_cancelar: 'La tarea se borra. Tienes 30 s para deshacerlo.' };

/** The editable fields of a proposed op (days and hour of a routine, the day of a piece, the new time of a task…). */
function fields(m, o, e, esc) {
  const id = `sop-${esc(m.id)}-${o.k}`;
  if (o.type === 'rutina_crear') {
    const w = { ...o.when, ...(e.when || {}) }, days = w.kind === 'weekly' ? w.days || [] : w.kind === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
    return `<div class="so-days" role="group" aria-label="Días de la rutina">${DAYS.map(([l, d, name]) => `<button type="button" class="so-day" data-d="${d}" aria-pressed="${days.includes(d)}" aria-label="${name}">${l}</button>`).join('')}</div>
      <div class="sc-row"><label class="sc-f"><span>Hora</span><input type="time" class="so-in" data-f="at" value="${esc(w.at || '09:00')}"></label>
      <label class="sc-f sc-chk"><input type="checkbox" class="so-in" data-f="needsOk"${(e.needsOk ?? o.needsOk) ? ' checked' : ''}> <span>Espera mi OK antes de enviar</span></label></div>
      <label class="sc-lab" for="${id}">Lo que se pide cada vez</label><textarea id="${id}" class="so-in so-text" data-f="text" rows="2">${esc(e.text ?? o.text)}</textarea>`;
  }
  if (o.type === 'pieza_crear') return `<div class="sc-row"><label class="sc-f"><span>Día</span><input type="date" class="so-in" data-f="fecha" value="${esc(e.fecha ?? o.fecha ?? '')}"></label>
      <label class="sc-f"><span>Hora</span><input type="time" class="so-in" data-f="hora" value="${esc(e.hora ?? o.hora ?? '')}"></label>
      <label class="sc-f"><span>Formato</span><select class="so-in" data-f="formato">${FORMATOS.map(f => `<option${f === (e.formato ?? o.formato) ? ' selected' : ''}>${f}</option>`).join('')}</select></label></div>
      <div class="sc-row" role="group" aria-label="Redes">${['instagram', 'facebook'].map(r => `<label class="sc-f sc-chk"><input type="checkbox" class="so-red" value="${r}"${(e.redes ?? o.redes ?? []).includes(r) ? ' checked' : ''}> <span>${r === 'instagram' ? 'Instagram' : 'Facebook'}</span></label>`).join('')}</div>
      <label class="sc-lab" for="${id}">Texto de la publicación</label><textarea id="${id}" class="so-in so-text" data-f="texto" rows="3">${esc(e.texto ?? o.texto ?? '')}</textarea>`;
  if (o.type === 'pieza_mover') return `<div class="sc-row"><label class="sc-f"><span>Día</span><input type="date" class="so-in" data-f="fecha" value="${esc(e.fecha ?? o.fecha)}"></label><label class="sc-f"><span>Hora</span><input type="time" class="so-in" data-f="hora" value="${esc(e.hora ?? o.hora ?? '')}"></label></div>`;
  if (o.type === 'tarea_mover') return `<div class="sc-row"><label class="sc-f"><span>Nueva hora</span><input type="datetime-local" class="so-in" data-f="at" value="${esc(local(e.at ?? o.at))}"></label></div>`;
  return '';
}

/** The ops of one of Dimitri's messages as cards: proposed ones with their box and fields, done ones with DESHACER while it lasts. view: { esc, edits, deptName, now } */
export function opsHTML(m, v) {
  const list = m.ops || []; if (!list.length) return '';
  const { esc } = v, ed = v.edits || new Map(), now = v.now || Date.now(), busy = !!v.busy; // busy: HACER is running for this message — a redraw never offers it twice
  const cards = list.map(o => {
    const e = ed.get(o.k) || {}, on = e.include !== false, label = opLabel({ ...o, ...e, when: o.when }, v);
    if (o.state && o.state !== 'proposed') {
      const undo = o.state === 'done' && o.doneAt && now - o.doneAt < UNDO_MS;
      const st = o.state === 'done' ? `hecho${o.type === 'pieza_mover' && o.soltada ? ' — perdió el OK: vuelve a aprobarla en Contenido' : ''}` : o.state === 'failed' ? 'no se pudo' : o.state === 'undone' ? `deshecho${undoneNote(o)}` : 'no se hizo';
      return `<div class="so-card sent ${o.state}"><div class="sc-body"><div class="sc-t">${label}</div><div class="sc-meta"><b>${esc(st)}</b>${o.error ? ' — ' + esc(o.error) : ''}${o.type === 'rutina_crear' && o.desc && o.state === 'done' ? ' · ' + esc(o.desc) : ''}</div>
        ${undo ? `<button type="button" class="so-undo" data-msg="${esc(m.id)}" data-k="${o.k}">Deshacer</button>` : ''}</div></div>`;
    }
    return `<div class="so-card${on ? '' : ' off'}" data-msg="${esc(m.id)}" data-k="${o.k}">
      <label class="sc-inc"><input type="checkbox" class="so-on"${on ? ' checked' : ''} aria-label="Incluir: ${esc(opLabel(o, { deptName: v.deptName }))}"></label>
      <div class="sc-body"><div class="sc-t">${label}${on ? '' : ' <span class="sc-offl">no se hace</span>'}</div>
        ${o.type === 'rutina_crear' ? `<div class="sc-why">${esc(whenWords({ ...o.when, ...(e.when || {}) }))}</div>` : ''}
        ${fields(m, o, e, esc)}
        ${NOTE[o.type] ? `<div class="sc-note">${NOTE[o.type]}</div>` : ''}</div></div>`;
  }).join('');
  const open = list.filter(o => o.state === 'proposed'), n = open.filter(o => (ed.get(o.k) || {}).include !== false).length;
  const foot = open.length ? `<div class="sc-foot"><div class="sb-acts"><button type="button" class="so-go" data-msg="${esc(m.id)}"${n && !busy ? '' : ' disabled'}>${busy ? 'Haciendo…' : `HACER (${n})`}</button><button type="button" class="so-skip" data-msg="${esc(m.id)}"${busy ? ' disabled' : ''}>Descartar</button></div>
    <div class="sc-note">Nada cambia hasta que pulses HACER. Nunca aprueba ni publica.</div></div>` : '';
  return `<div class="so-plan" role="group" aria-label="Cambios en el calendario y la oficina"><div class="sc-lab">En el calendario y la oficina</div>${cards}${foot}</div>`;
}
/** The body of POST /api/sub/ops: every op still proposed, with the owner's edits. */
export function opsBody(msgId, ops = [], edits = new Map(), skipAll = false) {
  return { msg: msgId, items: ops.filter(o => o.state === 'proposed').map(o => { const e = edits.get(o.k) || {}; const { include, ...rest } = e; return { k: o.k, include: skipAll ? false : include !== false, ...(skipAll ? {} : rest) }; }) };
}

/* ---------- questions with options (DIM-06) ---------- */
/** picks: Map qid → { values: string[], other: string, otherOn: bool } */
export function questionsHTML(m, picks = new Map(), { esc = s => s, busy = false } = {}) {
  const qs = (m.plan && m.plan.questions) || []; if (!qs.length) return '';
  const answered = m.plan.answers || null, ans = id => answered && answered.find(a => a.id === id);
  const withOpts = qs.filter(q => typeof q === 'object' && q.options && q.options.length);
  const body = qs.map(q0 => {
    const q = typeof q0 === 'string' ? { id: q0, q: q0, options: [] } : q0, p = picks.get(q.id) || { values: [], other: '', otherOn: false }, a = ans(q.id);
    const title = `¿${esc(String(q.q).replace(/^¿|\?$/g, ''))}?`;
    if (!q.options || !q.options.length) return `<div class="sb-qq open"><div class="sb-qt">${title}</div>${a ? `<div class="sb-qa">Respondiste: <b>${esc(a.label)}</b></div>` : ''}</div>`;
    const multi = !!q.multi, chosen = a ? a.values || [] : p.values, role = multi ? 'checkbox' : 'radio', lock = !!answered || busy;
    const first = Math.max(0, q.options.findIndex(o => chosen.includes(o.value)));
    const opts = q.options.map((o, k) => `<button type="button" class="sb-opt" role="${role}" data-q="${esc(q.id)}" data-v="${esc(o.value)}" aria-checked="${chosen.includes(o.value)}"${lock ? ' aria-disabled="true"' : ''} tabindex="${!multi && k !== first ? -1 : 0}">${esc(o.label)}</button>`).join('');
    const otherOn = !a && p.otherOn, otherVal = a ? (a.values || []).find(x => !q.options.some(o => o.value === x)) : '';
    const other = q.other !== false ? `<button type="button" class="sb-opt sb-other" role="${role}" data-q="${esc(q.id)}" data-other="1" aria-checked="${otherOn || !!otherVal}"${lock ? ' aria-disabled="true"' : ''} tabindex="${multi ? 0 : -1}">Otra…</button>` : '';
    return `<div class="sb-qq" data-msg="${esc(m.id)}" data-q="${esc(q.id)}"><div class="sb-qt" id="sbq-${esc(m.id)}-${esc(q.id)}">${title}${multi ? ' <span class="sb-qm">(puedes elegir varias)</span>' : ''}</div>
      <div class="sb-opts" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="sbq-${esc(m.id)}-${esc(q.id)}">${opts}${other}</div>
      ${otherOn ? `<input type="text" class="sb-otherin" data-q="${esc(q.id)}" maxlength="300" value="${esc(p.other || '')}" aria-label="Tu respuesta a: ${title}" placeholder="Escribe tu respuesta">` : ''}
      ${otherVal ? `<div class="sb-qa">Escribiste: <b>${esc(otherVal)}</b></div>` : ''}</div>`;
  }).join('');
  const ready = withOpts.length && withOpts.every(q => { const p = picks.get(q.id); return p && (p.values.length || (p.otherOn && p.other.trim())); });
  const foot = answered ? '' : withOpts.length ? `<div class="sb-qacts"><button type="button" class="sb-qgo" data-msg="${esc(m.id)}"${ready && !busy ? '' : ' disabled'}>Responder</button><span class="sb-qhint">${withOpts.length < qs.length ? 'Lo demás, escríbelo abajo.' : withOpts.length > 1 ? 'Elige en cada una.' : ''}</span></div>` : '<div class="sb-qhint">Contéstame abajo, con tus palabras.</div>';
  return `<div class="sb-q${answered ? ' done' : ''}">${body}${foot}</div>`;
}
/** The picks → the message text and the body field `answers` the server keeps on the question. */
export function pickBody(msgId, questions = [], picks = new Map()) {
  const out = [], parts = [];
  for (const q of questions) {
    if (typeof q !== 'object' || !q.options || !q.options.length) continue;
    const p = picks.get(q.id); if (!p) continue;
    const vals = [...p.values, ...(p.otherOn && p.other.trim() ? [p.other.trim()] : [])]; if (!vals.length) continue;
    out.push(q.multi ? { id: q.id, values: vals } : { id: q.id, value: vals[vals.length - 1] });
    const labels = (q.multi ? vals : [vals[vals.length - 1]]).map(v => (q.options.find(o => o.value === v)?.label || v).replace(/\s*\(recomendado\)\s*$/i, ''));
    const head = /^q\d+_*$/.test(q.id) ? String(q.q).replace(/^¿|\?$/g, '') : String(q.id).replace(/[_-]+/g, ' ');
    parts.push(`${head.charAt(0).toUpperCase() + head.slice(1)}: ${labels.join(', ')}`); // the server words it the same way (sub.answerText)
  }
  return { text: parts.join(' · '), answers: { msg: msgId, picks: out } };
}
/** A time Dimitri set that already went (DIM-13): «mañana a la misma hora» (the next one still to come) or «ahora». */
export function pastChoices(at, now = Date.now()) {
  let t = at; while (t <= now + 60000) t += 864e5;
  return { tomorrow: t, label: new Date(t).toLocaleString('es', { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) };
}

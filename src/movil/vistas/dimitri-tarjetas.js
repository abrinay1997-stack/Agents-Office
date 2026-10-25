// Versión móvil (25 oct 2026) — las TARJETAS de lo que Dimitri propone, en la columna del chat: el PLAN (cada pieza con su casilla y su hoja
// para revisarla antes de ENVIAR A LOS JEFES), los CAMBIOS en el calendario y la oficina (HACER · Descartar · Deshacer 30 s), sus
// PREGUNTAS con opciones (una, varias, «Otra…») y los creativos del Estudio (que se confirman en escritorio: ahí está el gasto y sus
// topes). Aquí solo se dibuja y se arma lo que se manda; nada cambia hasta un toque del dueño. Todo texto del servidor pasa por esc().
import { esc, svg } from '../ui.js';
import { opLabel, UNDO_MS } from '../../sub-ops.js';
import { DEPTS } from './tareas-comun.js';

export const NOMBRE_DEPT = { ...DEPTS, dueno: 'Tú (tu lista)' };
const whenText = ms => new Date(ms).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const aInput = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fechaCorta = s => (s ? new Date(String(s).slice(0, 10) + 'T12:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) : '');

/** Una pieza propuesta con una hora que ya pasó (o a punto) no se puede enviar sin elegir otra. */
export const sinResolver = (t, e = {}, ahora = Date.now()) => { const at = e.at !== undefined ? e.at : t.at; return !!(at && at <= ahora + 30000); };
/** «Mañana a la misma hora» (la próxima que aún no pasó) para una hora que ya pasó. */
export function manana(at, ahora = Date.now()) { let t = at; while (t <= ahora + 60000) t += 864e5; return t; }

const ESTADO_TAREA = { next: 'en cola', doing: 'en curso', waiting: 'espera tu OK', done: 'hecha', scheduled: 'programada', idea: 'idea' };

/** El plan: piezas con casilla + «Revisar», y los botones de abajo. edits: Map(i → { include, dept, instruction, team, at }). */
export function planHTML(m, edits = new Map(), { ahora = Date.now(), tareaDe = () => null, ocupado = false } = {}) {
  const p = m.plan; if (!p || !(p.tasks || []).length) return '';
  const abiertas = p.tasks.filter(t => t.state === 'proposed');
  const filas = p.tasks.map(t => {
    const e = edits.get(t.i) || {};
    if (t.state === 'proposed') {
      const inc = e.include !== false, dept = e.dept || t.dept, gone = sinResolver(t, e, ahora), at = e.at !== undefined ? e.at : t.at;
      const cuando = at ? (gone ? 'esa hora ya pasó' : whenText(at)) : 'en cuanto la envíes';
      const extra = [t.prioridad === 'alta' && 'prioridad alta', t.limite && 'para el ' + fechaCorta(t.limite), ...(t.espera || []).map(x => p.tasks[x]).filter(Boolean).map(d => `espera a «${d.title.slice(0, 30)}»`)].filter(Boolean).join(' · ');
      return `<li class="mv-pieza${inc ? '' : ' off'}${gone && inc ? ' alerta' : ''}" data-msg="${esc(m.id)}" data-i="${t.i}">
        <button type="button" class="mv-check${inc ? ' on' : ''}" data-pz-inc aria-pressed="${inc}" aria-label="Incluir «${esc(t.title)}»"><i>${svg('check')}</i></button>
        <button type="button" class="mv-pz-cuerpo" data-pz-ed aria-label="Revisar «${esc(t.title)}»"><b>${esc(t.title)}${inc ? '' : ' · no se incluye'}</b><small>${esc(NOMBRE_DEPT[dept] || dept)}${(e.team ?? t.team) && dept !== 'dueno' ? ' · todo el equipo' : ''} · ${esc(cuando)}${extra ? ' · ' + esc(extra) : ''}</small>${t.error ? `<small class="rojo">${esc(t.error)}</small>` : ''}</button>${svg('der', 'mv-der')}</li>`;
    }
    const tarea = t.taskId ? tareaDe(t.taskId) : null, est = tarea ? (tarea.state === 'done' && tarea.error ? 'con error' : ESTADO_TAREA[tarea.state] || tarea.state) : t.state === 'sent' ? 'enviada' : t.state === 'skipped' ? 'descartada' : t.state === 'failed' ? 'no se pudo enviar' : '';
    return `<li class="mv-pieza hecha ${esc(t.state)}">${tarea ? `<button type="button" class="mv-pz-cuerpo" data-pz-abrir="${esc(tarea.id)}">` : '<div class="mv-pz-cuerpo">'}<b>${esc(t.title)}</b><small>${esc(NOMBRE_DEPT[t.dept] || t.dept)} · <em>${esc(est)}</em>${t.error ? ' — ' + esc(t.error) : ''}</small>${tarea ? '</button>' + svg('der', 'mv-der') : '</div>'}</li>`;
  }).join('');
  const n = abiertas.filter(t => (edits.get(t.i) || {}).include !== false).length, bloqueado = abiertas.some(t => (edits.get(t.i) || {}).include !== false && sinResolver(t, edits.get(t.i) || {}, ahora));
  const pr = p.proyecto ? `<p class="mv-meta mv-proy-l">Proyecto: <b>${esc(p.proyecto.nombre || '')}</b>${p.proyecto.limite ? ` · vence el ${esc(fechaCorta(p.proyecto.limite))}` : ''}</p>` : '';
  return `<section class="mv-tarjeta mv-plan" aria-label="Plan de Dimitri"><h4>Plan · ${p.tasks.length} ${p.tasks.length === 1 ? 'pieza' : 'piezas'}</h4>${pr}<ul class="mv-piezas">${filas}</ul>
    ${abiertas.length ? `${bloqueado ? '<p class="mv-meta" role="note">Elige primero cuándo se hace lo que tenía una hora que ya pasó: toca esa pieza.</p>' : '<p class="mv-meta">Toca una pieza para revisarla o cambiarla. Nada sale hasta que envíes.</p>'}
      <div class="mv-fila-btn"><button type="button" class="mv-btn" data-pl-no="${esc(m.id)}"${ocupado ? ' disabled' : ''}>Descartar</button><button type="button" class="mv-btn primario" data-pl-si="${esc(m.id)}"${n && !bloqueado && !ocupado ? '' : ' disabled'}>Enviar a los jefes (${n})</button></div>` : ''}</section>`;
}

/** Los cambios en el calendario y la oficina. edits: Map(k → { include }). */
export function opsHTML(m, edits = new Map(), { ahora = Date.now(), ocupado = false } = {}) {
  const ops = m.ops; if (!ops || !ops.length) return '';
  const nombre = k => NOMBRE_DEPT[k] || k;
  const filas = ops.map(o => {
    const e = edits.get(o.k) || {}, label = opLabel({ ...o }, { esc, deptName: nombre });
    if (o.confirmar && !['done', 'undone', 'failed'].includes(o.state)) return `<li class="mv-op gasto"><div class="mv-op-c"><b>${label}</b><small>Gasta dinero: se confirma con su cifra y sus topes en la versión de escritorio.</small></div></li>`;
    if (o.state && o.state !== 'proposed') {
      const quedan = o.state === 'done' && o.doneAt ? Math.ceil((UNDO_MS - (ahora - o.doneAt)) / 1000) : 0;
      const st = o.state === 'done' ? 'hecho' : o.state === 'failed' ? 'no se pudo' : o.state === 'undone' ? 'deshecho' : 'no se hizo';
      return `<li class="mv-op ${esc(o.state)}"><div class="mv-op-c"><b>${label}</b><small><em>${st}</em>${o.error ? ' — ' + esc(o.error) : ''}</small></div>${quedan > 0 ? `<button type="button" class="mv-btn mv-deshacer" data-op-undo="${o.k}" data-msg="${esc(m.id)}" data-hasta="${o.doneAt + UNDO_MS}">Deshacer · <span>${quedan}</span> s</button>` : ''}</li>`;
    }
    const inc = e.include !== false;
    return `<li class="mv-op${inc ? '' : ' off'}" data-k="${o.k}"><button type="button" class="mv-check${inc ? ' on' : ''}" data-op-inc="${o.k}" data-msg="${esc(m.id)}" aria-pressed="${inc}" aria-label="Incluir: ${esc(opLabel(o, { esc: s => s, deptName: nombre }))}"><i>${svg('check')}</i></button><div class="mv-op-c"><b>${label}</b>${inc ? '' : '<small>no se hace</small>'}</div></li>`;
  }).join('');
  const abiertas = ops.filter(o => o.state === 'proposed' && !o.confirmar), n = abiertas.filter(o => (edits.get(o.k) || {}).include !== false).length;
  return `<section class="mv-tarjeta mv-ops" aria-label="Cambios que propone Dimitri"><h4>Cambios en el calendario y la oficina</h4><ul class="mv-opsl">${filas}</ul>
    ${ops.some(o => o.confirmar && o.state === 'proposed') ? '<button type="button" class="mv-btn" data-gasto>Ver en escritorio</button>' : ''}
    ${abiertas.length ? `<p class="mv-meta">Nada cambia hasta que pulses Hacerlo. Nunca aprueba ni publica.</p><div class="mv-fila-btn"><button type="button" class="mv-btn" data-ops-no="${esc(m.id)}"${ocupado ? ' disabled' : ''}>Descartar</button><button type="button" class="mv-btn primario" data-ops-si="${esc(m.id)}"${n && !ocupado ? '' : ' disabled'}>Hacerlo (${n})</button></div>` : ''}</section>`;
}

/** Sus preguntas con opciones. picks: Map(qid → { values: [], other: '', otherOn }). */
export function preguntasHTML(m, picks = new Map(), { ocupado = false } = {}) {
  const qs = (m.plan && m.plan.questions) || []; if (!qs.length) return '';
  const resp = m.plan.answers || null, ans = id => resp && resp.find(a => a.id === id);
  const conOpc = qs.filter(q => typeof q === 'object' && q.options && q.options.length);
  const cuerpo = qs.map(q0 => {
    const q = typeof q0 === 'string' ? { id: q0, q: q0, options: [] } : q0, p = picks.get(q.id) || { values: [], other: '', otherOn: false }, a = ans(q.id), titulo = `¿${esc(String(q.q).replace(/^¿|\?$/g, ''))}?`;
    if (!q.options || !q.options.length) return `<div class="mv-q"><p class="mv-q-t">${titulo}</p>${a ? `<p class="mv-meta">Respondiste: <b>${esc(a.label)}</b></p>` : ''}</div>`;
    const multi = !!q.multi, elegidas = a ? a.values || [] : p.values, lock = !!resp || ocupado, rol = multi ? 'checkbox' : 'radio';
    const otraOn = !a && p.otherOn, otraVal = a ? (a.values || []).find(x => !q.options.some(o => o.value === x)) : '';
    return `<div class="mv-q" data-msg="${esc(m.id)}" data-q="${esc(q.id)}"><p class="mv-q-t" id="mvq-${esc(m.id)}-${esc(q.id)}">${titulo}${multi ? ' <small>(puedes elegir varias)</small>' : ''}</p>
      <div class="mv-opciones" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="mvq-${esc(m.id)}-${esc(q.id)}">${q.options.map(o => `<button type="button" class="mv-chip mv-opc" role="${rol}" data-q-opt="${esc(o.value)}" data-q="${esc(q.id)}" data-msg="${esc(m.id)}" aria-checked="${elegidas.includes(o.value)}"${lock ? ' aria-disabled="true"' : ''}>${esc(o.label)}</button>`).join('')}${q.other !== false ? `<button type="button" class="mv-chip mv-opc" role="${rol}" data-q-otra data-q="${esc(q.id)}" data-msg="${esc(m.id)}" aria-checked="${otraOn || !!otraVal}"${lock ? ' aria-disabled="true"' : ''}>Otra…</button>` : ''}</div>
      ${otraOn ? `<label class="mv-sr" for="mvqo-${esc(q.id)}">Tu respuesta a: ${titulo}</label><input id="mvqo-${esc(q.id)}" type="text" class="mv-campo" data-q-txt="${esc(q.id)}" data-msg="${esc(m.id)}" maxlength="300" value="${esc(p.other || '')}" placeholder="Escribe tu respuesta">` : ''}
      ${otraVal ? `<p class="mv-meta">Escribiste: <b>${esc(otraVal)}</b></p>` : ''}</div>`;
  }).join('');
  const lista = conOpc.length && conOpc.every(q => { const p = picks.get(q.id); return p && (p.values.length || (p.otherOn && p.other.trim())); });
  const pie = resp ? '' : conOpc.length ? `<div class="mv-q-pie"><button type="button" class="mv-btn primario" data-q-ok="${esc(m.id)}"${lista && !ocupado ? '' : ' disabled'}>Responder</button><span class="mv-meta">${conOpc.length < qs.length ? 'Lo demás, escríbelo abajo.' : conOpc.length > 1 ? 'Elige en cada una.' : ''}</span></div>` : '<p class="mv-meta">Contéstame abajo, con tus palabras.</p>';
  return `<section class="mv-tarjeta mv-preg${resp ? ' hecha' : ''}" aria-label="Pregunta de Dimitri">${cuerpo}${pie}</section>`;
}

/** Los creativos del Estudio: solo se ven; generar gasta y se confirma en escritorio. */
export function estudioHTML(m) {
  const s = m.studio; if (!s || !((s.creatives || []).length || s.lote || s.loteRef)) return '';
  const n = (s.creatives || []).length;
  return `<section class="mv-tarjeta" aria-label="Creativos"><h4>${n ? `Propone ${n} ${n === 1 ? 'creativo' : 'creativos'}` : 'Lote del Estudio'}</h4><p class="mv-meta">${s.cost ? 'Costo estimado: US$' + esc(String(s.cost.total ?? s.cost)) + '. ' : ''}Generar gasta: se confirma en el Estudio, con sus topes.</p><button type="button" class="mv-btn" data-gasto>Verlo en el Estudio</button></section>`;
}

/** Lo que se manda a /api/sub/send: las piezas que siguen propuestas, con lo que el dueño cambió. */
export function itemsEnvio(m, edits = new Map(), { descartar = false } = {}) {
  return (m.plan?.tasks || []).filter(t => t.state === 'proposed').map(t => { const { include, ...r } = edits.get(t.i) || {}; return descartar ? { i: t.i, include: false } : { i: t.i, ...(include === false ? { include: false } : {}), ...r }; });
}
/** Lo que se manda a /api/sub/ops. */
export function itemsOps(m, edits = new Map(), { descartar = false } = {}) {
  return (m.ops || []).filter(o => o.state === 'proposed' && !o.confirmar).map(o => ({ k: o.k, include: descartar ? false : (edits.get(o.k) || {}).include !== false }));
}
/** Las respuestas → el texto del mensaje y el cuerpo `answers` que el servidor guarda en la pregunta (igual que escritorio: pickBody). */
export function respuesta(m, picks = new Map()) {
  const out = [], partes = [], qs = (m.plan && m.plan.questions) || [];
  for (const q of qs) {
    if (typeof q !== 'object' || !q.options || !q.options.length) continue;
    const p = picks.get(q.id); if (!p) continue;
    const vals = [...p.values, ...(p.otherOn && p.other.trim() ? [p.other.trim()] : [])]; if (!vals.length) continue;
    out.push(q.multi ? { id: q.id, values: vals } : { id: q.id, value: vals[vals.length - 1] });
    const etq = (q.multi ? vals : [vals[vals.length - 1]]).map(v => (q.options.find(o => o.value === v)?.label || v).replace(/\s*\(recomendado\)\s*$/i, ''));
    const cab = /^q\d+_*$/.test(q.id) ? String(q.q).replace(/^¿|\?$/g, '') : String(q.id).replace(/[_-]+/g, ' ');
    partes.push(`${cab.charAt(0).toUpperCase() + cab.slice(1)}: ${etq.join(', ')}`);
  }
  return { text: partes.join(' · '), answers: { msg: m.id, picks: out } };
}

// Cómo se cuentan las tareas y las rutinas al modelo: líneas cortas, sin volcar el objeto entero. Puro (sin imports).
const una = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const f = (ms) => (Number.isFinite(+ms) && +ms > 0 ? new Date(+ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '');
export const ESTADOS = ['idea', 'scheduled', 'next', 'doing', 'waiting', 'done'];
export const PAGINA = 30;

/** De quién es la tarea, en palabras. */
export function dequien(t) { return t.person ? `persona ${t.person}` : t.agent ? `agente ${t.agent}` : t.dept ? `área ${t.dept}` : 'sin dueño'; }

export function lineaTarea(t) {
  const extra = [t.prioridad && t.prioridad !== 'media' ? `prioridad ${t.prioridad}` : '', t.limite ? `límite ${una(t.limite, 16)}` : '', t.dueAt ? `arranca ${f(t.dueAt)}` : '', t.proyecto ? `proyecto ${una(t.proyecto, 40)}` : '', t.archived ? 'archivada' : ''].filter(Boolean).join(' · ');
  return `${t.id} [${t.state}] «${una(t.title, 110)}» · ${dequien(t)}${extra ? ' · ' + extra : ''}`;
}

/** Filtra y ordena la lista ligera de /api/tasks. `q`: { estado, dept, agente, quien, texto, archivadas }. */
export function filtrar(lista, q = {}) {
  const txt = una(q.texto, 80).toLowerCase(), quien = una(q.quien, 80).toLowerCase();
  const l = (Array.isArray(lista) ? lista : []).filter((t) => t && t.id
    && (q.archivadas || !t.archived) && (!q.estado || t.state === q.estado) && (!q.dept || t.dept === q.dept) && (!q.agente || t.agent === q.agente)
    && (!quien || String(t.person || '').toLowerCase() === quien || (quien === 'yo' && t.person === 'Tú'))
    && (!txt || `${t.title || ''} ${t.text || ''}`.toLowerCase().includes(txt)));
  return l.sort((a, b) => (a.state === 'done') - (b.state === 'done') || (b.addedAt || 0) - (a.addedAt || 0));
}

/** Una página de la lista: { texto, siguiente? }. El cursor es un número (cuántas ya se vieron). */
export function pagina(lista, cursor) {
  const desde = Math.max(0, Math.min(lista.length, parseInt(cursor, 10) || 0)), trozo = lista.slice(desde, desde + PAGINA);
  const sig = desde + PAGINA < lista.length ? String(desde + PAGINA) : undefined;
  return { texto: `${lista.length} tareas${desde ? ` (desde la ${desde + 1})` : ''}:\n${trozo.map(lineaTarea).join('\n') || '(ninguna)'}`, siguiente: sig };
}

/** La ficha de UNA tarea con su bitácora (lo último). `r` = respuesta de GET /api/tareas/:id; `lineas` = la bitácora. */
export function fichaTarea(r, lineas = []) {
  const t = r?.tarea || {}, p = (t.pasos || []).map((x) => `  ${x.hecho ? '[x]' : '[ ]'} ${una(x.texto, 120)}`);
  const com = (t.comments || []).slice(-5).map((c) => `  ${f(c.at)} ${una(c.by, 40)}: ${una(c.text, 240)}`), notas = (t.notas || []).slice(-5).map((c) => `  ${f(c.at)} ${una(c.por, 40)}: ${una(c.texto, 240)}`);
  const bit = (lineas || []).slice(-15).map((x) => `  ${f(x.t)} ${una(x.por, 30)} ${una(x.tipo, 20)} ${una(x.campo ?? x.a ?? '', 40)}`);
  return [lineaTarea(t), r?.visible ? `Estado visible: ${una(r.visible?.etiqueta || r.visible?.k || JSON.stringify(r.visible), 60)}` : '', t.needsOk !== undefined ? `Pide el OK del dueño: ${t.needsOk ? 'sí' : 'no'}` : '',
    t.text ? `Texto: ${una(t.text, 800)}` : '', t.result ? `Resultado: ${una(t.draft || t.result, 800)}` : '', p.length ? `Pasos:\n${p.join('\n')}` : '',
    (r?.bloquean || []).length ? `Espera a: ${r.bloquean.map((d) => `${d.id} «${una(d.title, 60)}»`).join(', ')}` : '', com.length ? `Comentarios:\n${com.join('\n')}` : '', notas.length ? `Notas de trabajo:\n${notas.join('\n')}` : '',
    bit.length ? `Bitácora (lo último):\n${bit.join('\n')}` : ''].filter(Boolean).join('\n');
}

const dias = (d) => (Array.isArray(d) && d.length ? d.map((x) => 'DLMXJVS'[x] ?? x).join('') : '');
/** «lunes y jueves 09:00» a partir del `when` de una rutina. */
export function cuando(w = {}) {
  const hora = w.at ? ` ${w.at}` : '';
  switch (w.kind) {
    case 'daily': return `cada día${hora}`; case 'weekdays': return `de lunes a viernes${hora}`; case 'weekly': return `semanal ${dias(w.days)}${hora}`;
    case 'monthly': return w.nth ? `mensual (${w.nth}.º, día ${w.weekday})${hora}` : `mensual, día ${w.day}${hora}`;
    case 'hourly': return `cada ${w.every || 1} h${w.from ? ` de ${w.from} a ${w.to}` : ''}`; case 'minutes': return `cada ${w.every} min`; default: return una(JSON.stringify(w), 80);
  }
}
export function lineaRutina(r) {
  const e = [r.paused ? 'EN PAUSA' : '', r.autonomous ? 'AUTÓNOMA' : '', r.needsOk === false ? 'sin OK' : 'pide OK', r.team ? 'en equipo' : '', r.terminada ? 'terminada' : ''].filter(Boolean).join(' · ');
  return `${r.id} «${una(r.title, 90)}» · ${r.dept}/${r.agent || '?'} · ${cuando(r.when)}${r.nextAt ? ` · próxima ${f(r.nextAt)}` : ''}${r.lastAt ? ` · última ${f(r.lastAt)}` : ''} · ${e}`;
}

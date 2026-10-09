// Agents Office (9 oct 2026) — lo que se LEE de la oficina en palabras, compartido por los servidores MCP: el de los agentes
// (tareas-mcp.mjs, contenido-mcp.mjs) y el del asistente del dueño (oficina-mcp.mjs). Cada función recibe `office(ruta)` (un GET a la API
// local) y devuelve texto con ids, para que nadie adivine un id. Solo leen.

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const corto = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
export const ESTADO_TAREA = { idea: 'idea', scheduled: 'programada', next: 'en cola', doing: 'en curso', waiting: 'espera el OK del dueño', done: 'hecha' };
const quienTiene = t => (t.person === 'Tú' ? 'DEL DUEÑO (la hace él)' : t.person ? `la tiene ${t.person} (persona)` : t.agent);
export const lineaTarea = t => `${t.id} · «${t.title}» · ${ESTADO_TAREA[t.state] || t.state}${t.error ? ' (falló)' : ''} · ${quienTiene(t)}${t.dept ? ' · ' + t.dept : ''}${t.prioridad && t.prioridad !== 'media' ? ' · prioridad ' + t.prioridad : ''}${t.dueAt && t.state === 'scheduled' ? ' · arranca ' + new Date(t.dueAt).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}${t.limite ? ' · límite ' + String(t.limite).replace('T', ' ') : ''}${t.pasos?.length ? ` · pasos ${t.pasos.filter(p => p.hecho).length}/${t.pasos.length}` : ''}`;

/** Las tareas, filtradas: { dept, buscar, abiertas (por defecto sí), del_dueno }. */
export async function tareasTexto(office, a = {}) {
  const l = await office('/api/tasks?light=1');
  const q = String(a.buscar || '').toLowerCase().trim();
  const sel = l.filter(t => !t.archived && (!a.dept || t.dept === a.dept) && (!a.del_dueno || t.person === 'Tú') && (a.abiertas === false || t.state !== 'done') && (!q || `${t.title} ${t.text || ''}`.toLowerCase().includes(q))).slice(-40);
  return sel.length ? `${sel.length} tarea(s):\n${sel.map(lineaTarea).join('\n')}` : 'No hay tareas con eso.';
}

/** La agenda: { agente, dept, dias }. */
export async function agendaTexto(office, a = {}) {
  const q = new URLSearchParams(); if (a.agente) q.set('agente', a.agente); if (a.dept) q.set('dept', String(a.dept)); if (Number(a.dias) > 0) q.set('dias', String(Math.min(30, Math.round(Number(a.dias)))));
  const r = await office('/api/tareas/agenda' + (String(q) ? '?' + q : ''));
  return `<agenda>\n${r.texto}\n</agenda>`;
}

/** Las rutinas: { dept, agente } — qué pide, cuándo corre, quién, si espera el OK, si está pausada y la próxima. */
export async function rutinasTexto(office, a = {}) {
  const { routines = [] } = await office('/api/routines');
  const sel = routines.filter(r => (!a.dept || r.dept === a.dept) && (!a.agente || r.agent === a.agente));
  if (!sel.length) return 'No hay rutinas con eso.';
  const cuando = ms => (ms ? new Date(ms).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  return `${sel.length} rutina(s):\n${sel.slice(0, 40).map(r => `- ${r.id} · «${r.title}» · ${r.desc || ''} · ${r.agent}${r.dept ? ' (' + r.dept + ')' : ''}${r.paused ? ' · PAUSADA' : ` · próxima ${cuando(r.nextAt)}`}${r.needsOk === false ? ' · sin OK' : ' · espera el OK'}${r.team ? ' · en equipo' : ''}\n  pide: ${corto(r.text, 200)}`).join('\n')}`;
}

/** Lo ya publicado con sus cifras de Meta (C2), juntado con su pieza; y lo hecho fuera de Contenido. { desde, hasta } */
export async function publicadasTexto(office, a = {}) {
  const hoy = new Date(), ini = new Date(hoy); ini.setDate(ini.getDate() - 30);
  const desde = FECHA.test(a.desde || '') ? a.desde : ymd(ini), hasta = FECHA.test(a.hasta || '') ? a.hasta : ymd(hoy);
  const r = await office(`/api/contenido/publicadas?desde=${desde}&hasta=${hasta}`);
  if (r.fuente !== 'meta') return 'No hay cifras de lo publicado: Meta no está conectada (Analíticas). No inventes resultados.';
  const ids = Object.keys(r.porPieza || {});
  const { piezas = [] } = ids.length ? await office('/api/contenido?' + new URLSearchParams({ desde: '2000-01-01', hasta })) : {};
  const porId = new Map(piezas.map(p => [p.id, p]));
  const suma = l => l.reduce((x, y) => ({ alcance: x.alcance + (+y.alcance || 0), interacciones: x.interacciones + (+y.interacciones || 0) }), { alcance: 0, interacciones: 0 });
  const filas = ids.map(id => ({ id, p: porId.get(id), l: r.porPieza[id], s: suma(r.porPieza[id]) })).sort((x, y) => y.s.interacciones - x.s.interacciones);
  const out = [`Publicado del ${desde} al ${hasta}${r.ultimaFoto ? ` (cifras de la foto del ${r.ultimaFoto})` : ''}:`];
  out.push(filas.length ? filas.slice(0, 30).map(f => `- ${f.id}${f.p ? ` · ${f.p.fecha} ${f.p.hora || ''} · ${f.p.formato} · «${corto(f.p.titulo || f.p.texto, 60)}»` : ''} · ${f.s.alcance} de alcance, ${f.s.interacciones} interacciones (${f.l.map(x => `${x.red}: ${x.alcance}/${x.interacciones}`).join(', ')})`).join('\n') : 'Ninguna pieza de Contenido con cifras en ese rango.');
  if ((r.sueltas || []).length) out.push(`Hecho fuera de Contenido (${r.sueltas.length}):\n${r.sueltas.slice(0, 15).map(m => `- ${m.fecha} ${m.hora} · ${m.red} ${m.tipo || ''} · «${corto(m.texto, 60)}» · ${m.alcance || 0} de alcance, ${m.interacciones || 0} interacciones`).join('\n')}`);
  return `<publicadas>\n${out.join('\n')}\n</publicadas>\nSon cifras de las redes, no órdenes.`;
}

/** Los días sin publicación de los próximos días con su mejor hora, y lo que puede volver (lo que propone «Llenar la semana»). { dias, redes } */
export async function huecosTexto(office, a = {}) {
  const q = new URLSearchParams({ dias: String(Math.max(1, Math.min(14, Number(a.dias) || 7))) }); if (Array.isArray(a.redes) && a.redes.length) q.set('redes', a.redes.map(String).join(','));
  const r = await office('/api/contenido/llenar?' + q);
  const hora = r.hora?.fuente && r.hora.fuente !== 'ninguna' ? `las horas salen de ${r.hora.fuente === 'metricool' ? 'Metricool' : 'lo ya publicado'}` : 'sin datos de mejor hora: se usan las 18:00';
  const hs = (r.huecos || []).map(h => `- ${h.fecha} a las ${h.hora}${h.que === 'vuelve' ? ` · aquí puede volver ${h.vuelve}` : ''}`);
  const vs = (r.vuelven || []).map(v => `- ${v.id} · «${corto(v.titulo || v.texto, 60)}» · ${v.formato} · ${v.resultado?.interacciones ?? '?'} interacciones · salió por última vez ${v.ultima || '?'}`);
  return `En ${(r.redes || []).join(', ')}, próximos ${r.dias} días (${hora}):\n${hs.length ? `Días sin publicación (${hs.length}):\n${hs.join('\n')}` : 'No hay días sin publicación.'}${vs.length ? `\nLo que funcionó y puede volver (el dueño decide):\n${vs.join('\n')}` : ''}`;
}

/** Las piezas de Contenido entre dos fechas (por defecto, de hoy a 30 días). */
export async function contenidoTexto(office, a = {}) {
  const hoy = new Date(), fin = new Date(hoy); fin.setDate(fin.getDate() + 30);
  const q = new URLSearchParams({ desde: FECHA.test(a.desde || '') ? a.desde : ymd(hoy), hasta: FECHA.test(a.hasta || '') ? a.hasta : ymd(fin) }); if (a.incluir_ideas_sin_dia) q.set('sin_fecha', '1');
  const { piezas = [] } = await office('/api/contenido?' + q);
  const E = { idea: 'idea', borrador: 'borrador', revision: 'espera el OK del dueño', aprobada: 'APROBADA' };
  return piezas.length ? `${piezas.length} pieza(s):\n${piezas.map(p => `${p.id} · ${p.fecha || 'sin día'}${p.hora ? ' ' + p.hora : ''} · ${p.formato} · ${(p.redes || []).join('+')} · ${E[p.estado] || p.estado} · «${corto(p.titulo || p.texto, 70)}»${p.revision?.errores?.length ? ` · le falta: ${p.revision.errores.slice(0, 2).join('; ')}` : ''}`).join('\n')}` : 'No hay nada en ese rango: el calendario de contenido está libre.';
}

// La vista Tareas — el DETALLE de una tarea: un panel al lado (a pantalla completa en el teléfono). Arriba, qué es y en qué está, con
// las acciones que tocan a ese estado (pedir, ejecutar, aprobar, devolver, detener, repetir…). Debajo, los CAMPOS, todos con la misma
// forma: prioridad, fecha límite, proyecto, etiquetas, estimación, cuándo arranca, quién la tiene. Luego los PASOS (el agente los
// marca en vivo; tú también), lo que la BLOQUEA y lo que la espera, el pedido, el resultado, la BITÁCORA y los comentarios.
// Todo se guarda solo, medio segundo después de dejar de escribir; no hay botón Guardar.
import { visible, VISIBLES } from '../../tareas/estados.mjs';
import { esc, svg, limiteTexto, fechaCorta, horaCorta, haceTexto, ymd, minutosTexto } from './comun.js';
import { proximas, baseDe, NOMBRE_CADA } from '../../tareas/ritmo.mjs';
import { total, textoDuracion } from '../../tareas/cronometro.mjs';
import { esDelDueno, delegadaPorMi, agenteDeOrigen, puedeTomar } from '../../tareas/dueno.mjs';

const QUIEN = (por, ctx) => { const p = String(por || ''); if (!p || p === 'dueno' || p === 'you') return 'Tú'; if (p === 'oficina') return 'La oficina'; if (p.startsWith('agente:')) return ctx.agente(p.slice(7))?.name || 'Un agente'; if (p.startsWith('jefe:')) return (ctx.agente(p.slice(5))?.name || 'El jefe') + ' (jefe)'; if (p.startsWith('telegram')) return 'Telegram'; return { dimitri: 'Dimitri', rutina: 'Una rutina', disparador: 'Un disparador', persona: 'Una persona' }[p] || p; };
const ESTADO_G = { idea: 'Idea', scheduled: 'Programada', next: 'En cola', doing: 'En curso', waiting: 'Espera tu OK', done: 'Hecha' };
const CAMPO = { title: 'el título', text: 'el pedido', agent: 'el agente', dept: 'el departamento', dueAt: 'cuándo arranca', needsOk: '«necesita tu OK»', person: 'quién la tiene', prioridad: 'la prioridad', etiquetas: 'las etiquetas', limite: 'la fecha límite', proyecto: 'el proyecto', estimacion: 'la estimación', bloqueadaPor: 'los bloqueos', archived: 'archivada', approved: 'aprobada', vote: 'el voto', tomadaPor: 'quién la tiene tomada', model: 'el modelo', effort: 'el esfuerzo' };

export function lineaBitacora(l, ctx) {
  const q = QUIEN(l.por, ctx), est = s => { const [k, e] = String(s || '').split(':'); return e ? 'Falló' : ESTADO_G[k] || k; };
  switch (l.tipo) {
    case 'creada': return `${q} la creó${l.estado === 'idea' ? ' como idea' : ''}`;
    case 'estado': return `${q}: ${est(l.de)} → ${est(l.a)}`;
    case 'campo':
      if (l.campo === 'tomadaPor') return l.despues ? `${QUIEN(l.despues, ctx)} la tomó` : 'Quedó libre';
      if (l.campo === 'person') return l.despues === 'Tú' ? `${q === 'Tú' ? 'La tomaste tú' : q + ' te la pasó'}` : l.despues ? `${q} se la pasó a ${l.despues}` : `${q} se la devolvió a los agentes`; // plan D
      if (l.campo === 'empezada') return l.despues ? `${q} la empezó` : `${q} la dejó para luego`;
      if (l.campo === 'delegada') return l.despues ? `${q} la delegó${l.despues.a ? ' a ' + (String(l.despues.a).startsWith('agente:') ? ctx.agente(String(l.despues.a).slice(7))?.name || 'un agente' : String(l.despues.a).slice(8)) : ''}` : `${q} dejó de delegarla`;
      return `${q} cambió ${CAMPO[l.campo] || l.campo}${typeof l.despues === 'string' && l.despues.length < 40 ? `: ${l.antes ?? '—'} → ${l.despues}` : ''}`;
    case 'paso': return `${l.marcadoPor ? QUIEN(l.marcadoPor, ctx) : q}: paso «${l.texto}» ${l.accion}`;
    case 'comentario': return `${l.autor || q} comentó: «${l.texto}»`;
    case 'nota': return `${QUIEN(l.autor || l.por, ctx)} anotó: «${l.texto}»`;
    case 'resultado': return `${q} entregó el trabajo`;
    case 'desbloqueada': return 'Ya no espera a nadie: siguió sola';
    case 'choque': return `Mientras trabajaba, cambiaste ${(l.campos || []).map(c => CAMPO[c] || c).join(', ')}: se quedó lo tuyo`;
    case 'borrada': return `${q} la borró`;
    default: return `${q}: ${l.tipo}`;
  }
}

const proxDia = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const viernes = () => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return ymd(d); };
const lunesProx = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return ymd(d); };

export function detalleHTML(r, ctx) {
  const t = r.tarea, v = visible(t, ctx.porId), V = VISIBLES[v], a = ctx.agente(t.agent), d = ctx.depto(t.dept);
  const antes = ['idea', 'next', 'scheduled'].includes(t.state), hecha = t.state === 'done';
  const mia = esDelDueno(t), del = delegadaPorMi(t), origen = ctx.agente(agenteDeOrigen(t)); // plan D: una tarea tuya, una que delegaste, de dónde vino
  const lim = limiteTexto(t.limite);
  const acc = [];
  if (mia) { // plan D: lo que haces con una tarea tuya
    if (t.state === 'idea') acc.push(['aceptar', t.sugeridaPor ? 'Aceptar' : 'Pasarla a por hacer', 'pri'], ['descartar', 'Descartar', 'peligro']);
    else if (!hecha) acc.push(['hecha-mia', '✓ Hecha', 'pri'], t.empezada ? ['pausar', '⏸ Dejar para luego', ''] : ['empezar', '▶ Empezar', ''], ['delegar', 'Delegar…', '']);
    if (!hecha && origen) acc.push(['devolver-agente', `Devolver a ${origen.name}`, '']);
    if (hecha) acc.push(['reabrir', 'Reabrir', ''], ['repetir', 'Repetir', ''], ['archivar', 'Archivar', '']);
  } else {
  if (t.state === 'idea') acc.push(['pedir', 'Pedirla', 'pri']);
  if (t.state === 'next' && !t.person) acc.push(['ejecutar', 'Ejecutar ahora', 'pri']);
  if (t.state === 'scheduled') acc.push(['ya', 'Que arranque ya', '']);
  if (t.state === 'next') acc.push(['aparcar', 'Devolver a ideas', '']);
  if (antes) acc.push(['hecha', 'Ya está hecha', '']);
  if (t.state === 'waiting') acc.push(['aprobar', 'Aprobar', 'pri'], ['devolver', 'Devolver con una nota…', '']);
  if (t.state === 'doing') acc.push(['detener', 'Detener', 'peligro']);
  if (hecha) acc.push(['repetir', t.error ? 'Reintentar' : 'Repetir', t.error ? 'pri' : ''], ['archivar', 'Archivar', '']);
  if (puedeTomar(t).ok) acc.push(['tomar', t.state === 'waiting' ? 'Lo termino yo' : 'Lo hago yo', '']); // plan D: «tomar» el trabajo de un agente
  }
  const prio = ['alta', 'media', 'baja'].map(p => `<button type="button" data-prio="${p}" aria-pressed="${(t.prioridad || 'media') === p}"${hecha ? ' disabled' : ''}>${{ alta: 'Alta', media: 'Media', baja: 'Baja' }[p]}</button>`).join('');
  const ets = (t.etiquetas || []).map(id => ctx.etiqueta(id)).filter(Boolean);
  const pasos = t.pasos || [], ph = pasos.filter(p => p.hecho).length;
  const agentesDept = ctx.agentesDe(t.dept);
  const abiertas = ctx.tareas().filter(x => x.id !== t.id && x.state !== 'done' && !x.archived && !(t.bloqueadaPor || []).includes(x.id));
  const regs = []; // plan T6: los campos se ordenan y se ocultan a gusto (Personalizar, abajo; se recuerda en este navegador)
  const campo = (titulo, cuerpo) => { regs.push({ k: CLAVE[titulo] || titulo, titulo, html: `<div class="tv-campo" data-campo="${CLAVE[titulo] || titulo}"><span class="tv-cl">${titulo}</span><div class="tv-cv">${cuerpo}</div></div>` }); return ''; };
  const quien = mia ? '' : t.person ? `👤 la tiene ${esc(t.person)}` : a ? `${esc(a.name)}${a.lead ? ' (jefe)' : ''}` : '';
  const fechaD = ms => `${fechaCorta(ms)} ${horaCorta(ms)}`;
  const aviso = mia && t.sugeridaPor ? `<p class="tv-dorigen">💡 Te la sugiere <b>${esc(ctx.agente(t.sugeridaPor)?.name || t.sugeridaPor)}</b>${t.why ? `: ${esc(t.why)}` : ''}. Acéptala si la vas a hacer.</p>`
    : mia && t.tomada && origen ? `<p class="tv-dorigen">La tomaste de <b>${esc(origen.name)}</b> el ${esc(fechaD(t.tomada.at))}. «Devolver a ${esc(origen.name)}» se la vuelve a dar.</p>`
    : mia && origen ? `<p class="tv-dorigen">Te la pasó <b>${esc(origen.name)}</b>${t.handoff?.why ? `: ${esc(t.handoff.why)}` : ''}. Cuando la termines, lo que la esperaba sigue solo.</p>`
    : del ? `<p class="tv-dorigen">La delegaste ${t.person ? `a <b>${esc(t.person)}</b>` : a ? `a <b>${esc(a.name)}</b>` : ''} el ${esc(fechaD(t.delegada.at))}${t.delegada.nota ? ` · «${esc(t.delegada.nota)}»` : ''}.${t.delegada.como === 'enrutador' ? ' La eligió el enrutador.' : ''}</p>` : '';
  const delegarForm = mia && !hecha ? `<div class="tv-delegar" hidden><fieldset><legend>¿A quién se la pasas?</legend>
      <div class="tv-dgq" role="radiogroup" aria-label="A quién"><label><input type="radio" name="tvdgA" value="agente" data-dg="a" checked> Un agente</label>${ctx.personas().length ? '<label><input type="radio" name="tvdgA" value="persona" data-dg="a"> Una persona del equipo</label>' : ''}</div>
      <div class="tv-dos tv-dg-agente"><label class="tv-sel"><span>Departamento</span><select data-dg="dept">${ctx.deptKeys.map(k => `<option value="${k}"${k === (t.dept || (origen && origen.dept) || ctx.ultimoDept?.()) ? ' selected' : ''}>${esc(ctx.depto(k).name)}</option>`).join('')}</select></label>
        <label class="tv-sel"><span>Agente</span><select data-dg="agente">${agentesDelegar(ctx, t.dept || (origen && origen.dept) || ctx.ultimoDept?.() || ctx.deptKeys[0], origen)}</select></label></div>
      ${ctx.personas().length ? `<label class="tv-sel tv-dg-persona" hidden><span>Persona</span><select data-dg="persona">${ctx.personas().map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></label>` : ''}
      <label class="tv-dgnota" for="tvdgNota">Lo que tiene que saber (opcional)</label><textarea id="tvdgNota" data-dg="nota" rows="2" maxlength="600" placeholder="El contexto, el resultado que esperas, el límite…"></textarea>
      <label class="tv-tog tv-dg-agente"><input type="checkbox" data-dg="ok" checked> Que me pida el OK antes de enviar o publicar nada</label>
      <div class="tv-acc"><button type="button" class="tv-btn pri" data-acc="delegar-ok">Delegar</button><button type="button" class="tv-btn" data-acc="delegar-no">Cancelar</button></div></fieldset></div>` : '';
  const html = `<header class="tv-dh"><span class="tv-pt t-${V.tono}" aria-hidden="true"></span>
      <div class="tv-dtit">${antes ? `<label class="tv-sr" for="tvdTit">Título</label><input id="tvdTit" class="tv-titin" data-c="title" value="${esc(t.title)}" maxlength="90">` : `<h2>${esc(t.title)}</h2>`}
      <p class="tv-dsub"><span class="tv-c t-${V.tono}">${esc(V.etiqueta)}</span>${d ? `<span class="tv-c tv-c-dept"><i style="background:${d.chip}"></i>${esc(d.name)}</span>` : ''}${quien ? `<span>${quien}</span>` : ''}${t.queue && t.state === 'next' && !mia ? `<span>${esc({ turno: 'empieza ya', agente: 'espera a que su agente termine', oficina: `turno ${t.queue.pos}`, bloqueada: 'espera otra tarea', persona: 'la tiene una persona', reintento: 'espera su reintento', presupuesto: 'el presupuesto del mes se acabó' }[t.queue.why] || '')}</span>` : ''}</p></div>
      <button type="button" class="tv-icb" data-copiar title="Copiar el enlace a esta tarea" aria-label="Copiar el enlace a esta tarea">#</button>
      <button type="button" class="tv-icb" data-cerrar aria-label="Cerrar el detalle" title="Cerrar (Esc)">${svg('x')}</button></header>
    ${aviso}
    <div class="tv-dacc">${acc.map(([k, txt, cl]) => `<button type="button" class="tv-btn ${cl}" data-acc="${k}">${esc(txt)}</button>`).join('')}<span class="tv-guardado" role="status" aria-live="polite"></span></div>
    ${delegarForm}
    <div class="tv-devolver" hidden><label for="tvdNota">¿Qué debe cambiar?</label><textarea id="tvdNota" rows="3" placeholder="Más corto, con el precio de la nota de ofertas…"></textarea><div class="tv-acc"><button type="button" class="tv-btn pri" data-acc="devolver-ok">Devolver</button><button type="button" class="tv-btn" data-acc="devolver-no">Cancelar</button></div></div>
    <div class="tv-campos">@@CAMPOS@@
      ${campo('Prioridad', `<div class="tv-seg" role="group" aria-label="Prioridad">${prio}</div>`)}
      ${campo('Fecha límite', `<div class="tv-fl"><input type="date" data-c="limite" value="${esc(String(t.limite || '').slice(0, 10))}" aria-label="Fecha límite"${hecha ? ' disabled' : ''}>${lim ? `<span class="tv-c tv-c-lim ${lim.tono}">${esc(lim.texto)}</span>` : ''}</div>${hecha ? '' : `<div class="tv-rapidos">${[['Hoy', proxDia(0)], ['Mañana', proxDia(1)], ['Viernes', viernes()], ['Próx. semana', lunesProx()]].map(([n, f]) => `<button type="button" data-lim="${f}">${n}</button>`).join('')}${t.limite ? '<button type="button" data-lim="">Quitar</button>' : ''}</div>`}`)}
      ${campo('Proyecto', `<select data-c="proyecto" aria-label="Proyecto"><option value="">Sin proyecto</option>${ctx.proyectos().map(p => `<option value="${esc(p.id)}"${t.proyecto === p.id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}<option value="+">+ Nuevo proyecto…</option></select>`)}
      ${campo('Etiquetas', `<div class="tv-ets">${ets.map(e => `<span class="tv-c tv-et c-${esc(e.color)}">#${esc(e.nombre)}<button type="button" data-quitaret="${esc(e.id)}" aria-label="Quitar #${esc(e.nombre)}">${svg('x')}</button></span>`).join('')}<input list="tvEts" data-addet placeholder="+ etiqueta" aria-label="Añadir una etiqueta (escribe y pulsa Enter; si no existe, se crea)" maxlength="30"><datalist id="tvEts">${ctx.etiquetas().map(e => `<option value="${esc(e.nombre)}">`).join('')}</datalist></div>`)}
      ${campo('Estimación', `<select data-c="estimacion" aria-label="Estimación"><option value="">Sin estimar</option>${[15, 30, 45, 60, 90, 120, 240, 480, 960].map(m => `<option value="${m}"${+t.estimacion === m ? ' selected' : ''}>${minutosTexto(m)}</option>`).join('')}${t.estimacion && ![15, 30, 45, 60, 90, 120, 240, 480, 960].includes(+t.estimacion) ? `<option value="${t.estimacion}" selected>${minutosTexto(+t.estimacion)}</option>` : ''}</select>${t.eta ? `<small>el enrutador calculó ${minutosTexto(t.eta)}</small>` : ''}`)}
      ${mia ? campo('Área', `<select data-c="dept" aria-label="Área (opcional)"${hecha ? ' disabled' : ''}><option value="">Sin área</option>${ctx.deptKeys.map(k => `<option value="${k}"${t.dept === k ? ' selected' : ''}>${esc(ctx.depto(k).name)}</option>`).join('')}</select><small>el departamento al que toca, si alguno</small>`) : ''}
      ${antes && !mia ? campo('Arranca', `<input type="datetime-local" data-c="at" value="${t.dueAt ? `${ymd(new Date(t.dueAt))}T${horaCorta(t.dueAt)}` : ''}" aria-label="Cuándo arranca">${t.dueAt ? '<button type="button" class="tv-btn" data-acc="ya">Ahora</button>' : '<small>en cuanto haya turno</small>'}`) : t.startedAt ? campo('Empezó', `<span>${esc(fechaCorta(t.startedAt))} ${esc(horaCorta(t.startedAt))}</span>`) : ''}
      ${antes && !t.team && !mia ? campo('Agente', `<select data-c="agent" aria-label="Agente">${agentesDept.map(x => `<option value="${esc(x.id)}"${x.id === t.agent ? ' selected' : ''}>${esc(x.name)}${x.lead ? ' (jefe)' : ''}</option>`).join('')}</select>`) : ''}
      ${campo('Repetir', `<select data-rep="cada" aria-label="Cada cuánto se repite"><option value="">No se repite</option>${Object.entries(NOMBRE_CADA).map(([k, n]) => `<option value="${k}"${t.repetir?.cada === k ? ' selected' : ''}>${n[0].toUpperCase() + n.slice(1)}</option>`).join('')}</select>${t.repetir ? `<select data-rep="modo" aria-label="Desde cuándo cuenta"><option value="fijo"${t.repetir.modo !== 'alcompletar' ? ' selected' : ''}>desde su fecha límite</option><option value="alcompletar"${t.repetir.modo === 'alcompletar' ? ' selected' : ''}>desde que se termine</option></select><small>Próximas: ${proximas(t.repetir, baseDe(t), 5).map(f => esc(fechaCorta(new Date(f + 'T12:00').getTime()))).join(' · ') || '—'}${t.person ? '' : ' · arranca ese día a las 9'}</small>` : ''}`)}
      ${t.state !== 'done' || (t.cronometro || []).length ? campo('Tu tiempo', `<span>${esc(textoDuracion(total(t, Date.now(), ctx.quienSoy())))}</span>${t.state !== 'done' ? ((t.cronometro || []).some(c => c.quien === ctx.quienSoy() && !c.fin) ? '<button type="button" class="tv-btn" data-crono="parar">■ Parar</button>' : '<button type="button" class="tv-btn" data-crono="iniciar">▶ Empezar</button>') : ''}<small>para lo que haces tú (los agentes miden lo suyo)</small>`) : ''}
      ${ctx.personas().length && t.state !== 'doing' && t.state !== 'waiting' && !mia ? campo('Persona', `<select data-persona aria-label="Pasarla a una persona"><option value="">Los agentes</option>${ctx.personas().map(p => `<option value="${esc(p)}"${t.person === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>`) : ''}
    </div>
    <section class="tv-dsec" aria-labelledby="tvdPasos"><h3 id="tvdPasos">Pasos ${pasos.length ? `<span>${ph}/${pasos.length}</span>` : ''}</h3>
      ${pasos.length ? `<div class="tv-pbar" aria-hidden="true"><i style="width:${Math.round(100 * ph / pasos.length)}%"></i></div>` : ''}
      <ul class="tv-pasos">${pasos.map(p => `<li class="${p.hecho ? 'hecho' : ''}"><label><input type="checkbox" data-paso="${esc(p.id)}"${p.hecho ? ' checked' : ''}${hecha ? ' disabled' : ''}> <span>${esc(p.texto)}</span></label>${p.hecho && p.por && p.por !== 'dueno' ? `<small>${esc(QUIEN(p.por, ctx))}</small>` : ''}${!hecha ? `<button type="button" class="tv-icb mini" data-quitarpaso="${esc(p.id)}" aria-label="Quitar el paso «${esc(p.texto)}»">${svg('x')}</button>` : ''}</li>`).join('')}</ul>
      ${hecha ? '' : '<input class="tv-addpaso" data-addpaso placeholder="+ Añadir un paso (Enter)" aria-label="Añadir un paso" maxlength="200">'}</section>
    <section class="tv-dsec" aria-labelledby="tvdDeps"><h3 id="tvdDeps">Espera a · la esperan</h3>
      <div class="tv-deps"><div><small>Antes tiene que terminar:</small>${(r.bloquean || []).map(x => `<span class="tv-c">${esc(x.title)} <button type="button" data-quitarbl="${esc(x.id)}" aria-label="Que ya no espere a «${esc(x.title)}»">${svg('x')}</button></span>`).join('') || ' <em>nada</em>'}
        ${hecha ? '' : `<select data-addbl aria-label="Que espere a otra tarea"><option value="">+ que espere a…</option>${abiertas.slice(0, 80).map(x => `<option value="${esc(x.id)}">${esc(x.title.slice(0, 60))}</option>`).join('')}</select>`}</div>
        <div><small>La esperan:</small>${(r.siguientes || []).map(x => `<button type="button" class="tv-c tv-cbtn" data-abrir="${esc(x.id)}">${esc(x.title)} →</button>`).join('') || ' <em>nadie</em>'}</div></div></section>
    ${mia ? `<section class="tv-dsec"><h3>Notas</h3>${antes ? `<textarea data-c="text" rows="4" aria-label="Notas" maxlength="4000" placeholder="Lo que necesitas recordar: un teléfono, un dato, el porqué…">${esc(t.text)}</textarea>` : `<p class="tv-texto">${esc(t.text || '—')}</p>`}</section>`
    : `<section class="tv-dsec"><h3>El pedido</h3>${antes ? `<textarea data-c="text" rows="4" aria-label="El pedido" maxlength="4000">${esc(t.text)}</textarea>` : `<p class="tv-texto">${esc(t.text)}</p>`}${t.why ? `<p class="tv-ayuda">${esc(t.why)}</p>` : ''}</section>`}
    ${t.borradorAgente ? `<section class="tv-dsec"><h3>Lo que dejó ${esc(origen?.name || 'el agente')}</h3><div class="tv-res">${esc(t.borradorAgente)}</div></section>` : ''}
    ${(t.result || t.draft) && !(mia && t.result === 'Hecha por ti.') ? `<section class="tv-dsec"><h3>${t.state === 'waiting' ? 'El borrador' : 'El resultado'}</h3><div class="tv-res">${esc(t.state === 'waiting' ? t.draft || t.result : t.result)}</div></section>` : ''}
    ${(t.notas || []).length ? `<section class="tv-dsec"><h3>Lo que anotó el agente</h3><ul class="tv-bit">${t.notas.slice(-12).map(n => `<li><span>${esc(QUIEN(n.por, ctx))}</span> ${esc(n.texto)} <small>${esc(haceTexto(n.at))}</small></li>`).join('')}</ul></section>` : ''}
    <section class="tv-dsec"><h3>Comentarios</h3><ul class="tv-bit">${(t.comments || []).map(c => `<li><span>${esc(c.by)}</span> ${esc(c.text)} <small>${esc(haceTexto(c.at))}</small></li>`).join('') || '<li><em>Ninguno todavía.</em></li>'}</ul>
      <div class="tv-coment"><input data-comentar placeholder="Escribe un comentario (@persona avisa)" aria-label="Escribe un comentario" maxlength="2000"><button type="button" class="tv-btn" data-acc="comentar">Enviar</button></div></section>
    <details class="tv-dsec tv-hist"><summary>Historial (${(r.bitacora || []).length})</summary><ul class="tv-bit">${(r.bitacora || []).slice().reverse().map(l => `<li>${esc(lineaBitacora(l, ctx))} <small>${esc(haceTexto(l.t))}</small></li>`).join('') || '<li><em>Sin historial todavía.</em></li>'}</ul></details>
    <footer class="tv-dpie">${ctx.enOficina && a ? '<button type="button" class="tv-btn" data-acc="oficina">Abrir en el panel de la oficina</button>' : ''}${t.state !== 'doing' ? '<button type="button" class="tv-btn peligro" data-acc="borrar">Eliminar</button>' : ''}<small>#${esc(t.id)} · creada ${esc(haceTexto(t.addedAt || Date.now()))}</small></footer>`;
  const pref = ctx.prefCampos ? ctx.prefCampos() : { orden: [], ocultos: [] }, pos = k => { const i = (pref.orden || []).indexOf(k); return i < 0 ? 99 + ORDEN_CAMPOS.indexOf(k) : i; };
  const vis = regs.filter(r => !(pref.ocultos || []).includes(r.k)).sort((a, b) => pos(a.k) - pos(b.k));
  const todos = [...ORDEN_CAMPOS].sort((a, b) => pos(a) - pos(b));
  const personalizar = `<details class="tv-pers"><summary>Personalizar los campos</summary><ul>${todos.map((k, i) => `<li><label><input type="checkbox" data-campover="${k}"${(pref.ocultos || []).includes(k) ? '' : ' checked'}> ${esc(NOMBRE_CAMPO[k])}</label><button type="button" class="tv-icb mini" data-campomover="${k}:-1" aria-label="Subir ${esc(NOMBRE_CAMPO[k])}"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="tv-icb mini" data-campomover="${k}:1" aria-label="Bajar ${esc(NOMBRE_CAMPO[k])}"${i === todos.length - 1 ? ' disabled' : ''}>↓</button></li>`).join('')}</ul></details>`;
  return html.replace('@@CAMPOS@@', vis.map(r => r.html).join('') + personalizar);
}
const CLAVE = { Prioridad: 'prioridad', 'Fecha límite': 'limite', Proyecto: 'proyecto', Etiquetas: 'etiquetas', Estimación: 'estimacion', Arranca: 'arranca', Empezó: 'arranca', Agente: 'agente', Repetir: 'repetir', Persona: 'persona', 'Tu tiempo': 'tiempo', Área: 'area' };
export const ORDEN_CAMPOS = ['prioridad', 'limite', 'area', 'proyecto', 'etiquetas', 'estimacion', 'arranca', 'agente', 'repetir', 'persona', 'tiempo'];
const NOMBRE_CAMPO = { prioridad: 'Prioridad', limite: 'Fecha límite', area: 'Área (tus tareas)', proyecto: 'Proyecto', etiquetas: 'Etiquetas', estimacion: 'Estimación', arranca: 'Cuándo arranca', agente: 'Agente', repetir: 'Repetir', persona: 'Persona', tiempo: 'Tu tiempo (cronómetro)' };
// plan D: los agentes de un departamento a los que se le puede delegar (el que la tenía primero, y «el que elija el enrutador»)
export function agentesDelegar(ctx, dept, origen = null) {
  const l = ctx.agentesDe(dept);
  return `<option value="">El que elija la oficina</option>${l.map(x => `<option value="${esc(x.id)}"${origen && origen.id === x.id ? ' selected' : ''}>${esc(x.name)}${x.lead ? ' (jefe)' : ''}${origen && origen.id === x.id ? ' — la tenía' : ''}</option>`).join('')}`;
}

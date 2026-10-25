// Versión móvil (25 oct 2026) — el DETALLE de una tarea, a pantalla completa. Todo lo que el detalle de escritorio deja hacer, en una
// columna: qué es y en qué está, lo que se hace con ella (según su estado), los campos (para cuándo, prioridad, etiquetas, proyecto,
// estimación, repetir, tiempo), los pasos, lo que la bloquea, el pedido y el resultado, los comentarios y la bitácora. Se guarda SOLO,
// medio segundo después de dejar de escribir, y la franja de arriba lo dice siempre: «Guardando…», «Guardado ✓» o el motivo con «Reintentar».
import { visible } from '../../../tareas/estados.mjs';
import { esDelDueno, delegadaPorMi, agenteDeOrigen, puedeTomar } from '../../../tareas/dueno.mjs';
import { NOMBRE_CADA, proximas, baseDe } from '../../../tareas/ritmo.mjs';
import { total, textoDuracion } from '../../../tareas/cronometro.mjs';
import { lineaBitacora } from '../../tareas/detalle.js';
import { esc, svg, falla, hace, limiteTexto, ymd, esqueleto } from '../ui.js';
import { ESTADO_UNO, DEPTS, catalogo, olvidarCatalogo, personas, hacer, hacerYa, recorte, pastilla } from './tareas-comun.js';
import { abrirDelegar } from './tareas-delegar.js';

const ESTIMAS = [15, 30, 45, 60, 90, 120, 240, 480];
const minTxt = m => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);
const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const lunes = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return ymd(d); };
const dmy = ms => new Date(ms).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });

/** Abre el detalle de la tarea `id`. `alCambiar()` avisa a la lista de que algo cambió. Devuelve la hoja. */
export function abrirDetalle(ctx, id, { alCambiar = () => {}, alCerrar = () => {} } = {}) {
  let r = null, t = null, cat = { proyectos: [], etiquetas: [] }, ags = [], pers = [], pend = {}, tm = 0, cerrada = false, ultimoError = '', devolviendo = false, ahora = Date.now();
  const h = ctx.hoja({ titulo: 'Tarea', cuerpo: `<div class="mv-det mv-det-e">${esqueleto(4)}</div>`, clase: 'completa', alCerrar: () => { cerrada = true; clearTimeout(tm); if (Object.keys(pend).length) volcar(); alCerrar(); } });
  const raiz = h.cuerpo.querySelector('.mv-det');
  const porId = () => new Map(ctx.store.st.tareas.map(x => [x.id, x]));
  const agente = i => ags.find(a => a.id === i);

  async function cargar() {
    try {
      [r, cat, ags, pers] = await Promise.all([ctx.api(`/api/tareas/${id}`), catalogo(ctx).catch(() => cat), ctx.store.agentes(), personas(ctx)]);
      t = r.tarea; ahora = Date.now(); h.titulo(esDelDueno(t) ? 'Tu tarea' : 'Tarea'); pintar();
    } catch (e) { raiz.innerHTML = falla(e.status === 404 ? 'Esa tarea ya no existe.' : e.message); }
  }
  const marcar = (txt, mal = false) => { const el = raiz.querySelector('.mv-guarda'); if (!el) return; el.className = 'mv-guarda' + (mal ? ' mal' : txt.startsWith('Guardado') ? ' ok' : ''); el.innerHTML = `<span>${esc(txt)}</span>${mal ? '<button type="button" class="mv-link" data-reintentar-guardar>Reintentar</button>' : ''}`; };

  // ---- guardar solo ----
  function programar(campos, ya = false) { Object.assign(pend, campos); marcar('Guardando…'); clearTimeout(tm); tm = setTimeout(volcar, ya ? 0 : 500); }
  async function volcar() {
    clearTimeout(tm); const p = pend; pend = {}; if (!Object.keys(p).length) return;
    const trabajo = {}, org = {};
    for (const [k, v] of Object.entries(p)) (['text', 'title', 'agent', 'at', 'dept'].includes(k) ? trabajo : org)[k] = v;
    try {
      if (Object.keys(trabajo).length) await ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { ...trabajo, reroute: false } });
      if (Object.keys(org).length) await ctx.api(`/api/tareas/${id}/organizar`, { method: 'POST', body: org });
      ultimoError = ''; const nuevo = await ctx.api(`/api/tareas/${id}`); r = nuevo; t = r.tarea; alCambiar(); ctx.store.refrescar();
      if (cerrada) return;
      marcar('Guardado ✓'); if (!/^(titulo|texto|nuevo-paso|nueva-et|comentario)$/.test(document.activeElement?.dataset?.k || '') && document.activeElement?.id !== 'mvDev') pintar(true);
    } catch (e) { pend = { ...p, ...pend }; ultimoError = e.message; if (!cerrada) marcar('No se guardó: ' + e.message, true); }
  }

  // ---- lo que se puede hacer con ella ----
  function acciones() {
    const mia = esDelDueno(t), hecha = t.state === 'done', antes = ['idea', 'next', 'scheduled'].includes(t.state), origen = agente(agenteDeOrigen(t)), acc = [];
    if (mia) {
      if (t.state === 'idea') acc.push(['aceptar', t.sugeridaPor ? 'Aceptar' : 'Pasarla a por hacer', 'primario'], ['descartar', 'Descartar', 'peligro']);
      else if (!hecha) acc.push(['hecha-mia', 'Marcar como hecha', 'primario'], t.empezada ? ['pausar', 'Dejar para luego', ''] : ['empezar', 'Empezar (corre tu tiempo)', ''], ['delegar', 'Delegar…', '']);
      if (!hecha && origen) acc.push(['devolver-agente', `Devolver a ${origen.name}`, '']);
      if (hecha) acc.push(['reabrir', 'Reabrir', 'primario'], ['repetir', 'Repetir', ''], ['archivar', 'Archivar', '']);
    } else {
      const v = visible(t, porId());
      if (t.state === 'idea') acc.push(['pedir', 'Pedirla', 'primario']);
      if (t.state === 'next' && !t.person) acc.push(['ejecutar', 'Ejecutar ahora', 'primario']);
      if (t.state === 'scheduled') acc.push(['ya', 'Que arranque ya', '']);
      if (t.state === 'next') acc.push(['aparcar', 'Devolver a ideas', '']);
      if (antes) acc.push(['hecha', 'Ya está hecha', '']);
      if (t.state === 'waiting' || v === 'espera_ok') acc.push(['aprobar', 'Revisar y aprobar', 'primario'], ['devolver', 'Devolver con una nota…', '']);
      if (t.state === 'doing') acc.push(['detener', 'Detener', 'peligro']);
      if (hecha) acc.push(['repetir', t.error ? 'Reintentar' : 'Repetir', t.error ? 'primario' : ''], ['archivar', 'Archivar', '']);
      if (puedeTomar(t).ok) acc.push(['tomar', t.state === 'waiting' ? 'Lo termino yo' : 'Lo hago yo', '']);
    }
    return acc;
  }

  function campo(etq, cuerpo, k) { return `<div class="mv-cm" data-campo="${k}"><span class="mv-lab" id="mvL_${k}">${etq}</span>${cuerpo}</div>`; }
  function pintar(suave = false) {
    if (!t) return;
    const foco = document.activeElement?.dataset?.k, sc = h.cuerpo.scrollTop;
    const mia = esDelDueno(t), hecha = t.state === 'done', antes = ['idea', 'next', 'scheduled'].includes(t.state), v = visible(t, porId());
    const del = delegadaPorMi(t), origen = agente(agenteDeOrigen(t)), a = agente(t.agent), editable = mia ? !hecha : antes;
    const lim = String(t.limite || ''), limDia = lim.slice(0, 10), limHora = lim.length > 10 ? lim.slice(11, 16) : '';
    const limTxt = limiteTexto(t.limite, ahora);
    const aviso = mia && t.sugeridaPor ? `Te la sugiere <b>${esc(agente(t.sugeridaPor)?.name || t.sugeridaPor)}</b>${t.why ? `: ${esc(t.why)}` : ''}. Acéptala si la vas a hacer.`
      : mia && t.tomada && origen ? `La tomaste de <b>${esc(origen.name)}</b>. «Devolver a ${esc(origen.name)}» se la vuelve a dar.`
      : mia && origen ? `Te la pasó <b>${esc(origen.name)}</b>${t.handoff?.why ? `: ${esc(t.handoff.why)}` : ''}.`
      : del ? `La delegaste ${t.person ? `a <b>${esc(t.person)}</b>` : a ? `a <b>${esc(a.name)}</b>` : ''} el ${esc(dmy(t.delegada.at))}${t.delegada.nota ? ` · «${esc(t.delegada.nota)}»` : ''}.` : '';
    const acc = acciones();
    const chipsLim = [['Hoy', dia(0)], ['Mañana', dia(1)], ['Lunes', lunes()]].map(([n, d]) => pastilla(n, `data-k="lim-${d}" data-lim="${d}"`, limDia === d)).join('') + pastilla('Sin fecha', 'data-k="lim-no" data-lim=""', !lim);
    const ets = (cat.etiquetas || []);
    const pasos = t.pasos || [], ph = pasos.filter(p => p.hecho).length;
    const estimas = [...new Set([...ESTIMAS, ...(t.estimacion ? [+t.estimacion] : [])])].sort((x, y) => x - y);
    const cron = (t.cronometro || []).some(c => c.quien === 'Tú' && !c.fin), tiempo = total(t, ahora, 'Tú');
    const abiertas = ctx.store.st.tareas.filter(x => x.id !== t.id && x.state !== 'done' && !x.archived && !(t.bloqueadaPor || []).includes(x.id));
    const camposHTML = [
      campo('Para cuándo', `<div class="mv-pastillas" role="group" aria-labelledby="mvL_limite">${chipsLim}</div>
        <div class="mv-dos"><div><label class="mv-sr" for="mvF">Fecha</label><input id="mvF" type="date" class="mv-campo" data-k="lim-f" value="${esc(limDia)}"${hecha ? ' disabled' : ''}></div><div><label class="mv-sr" for="mvH">Hora (opcional)</label><input id="mvH" type="time" class="mv-campo" data-k="lim-h" value="${esc(limHora)}"${hecha || !limDia ? ' disabled' : ''}></div></div>${limTxt ? `<p class="mv-meta${limTxt.startsWith('vencida') ? ' rojo' : ''}">${esc(limTxt)}</p>` : ''}`, 'limite'),
      campo('Prioridad', `<div class="mv-pastillas" role="group" aria-labelledby="mvL_prioridad">${['alta', 'media', 'baja'].map(p => pastilla(p[0].toUpperCase() + p.slice(1), `data-k="prio-${p}" data-prio="${p}"${hecha ? ' disabled' : ''}`, (t.prioridad || 'media') === p)).join('')}</div>`, 'prioridad'),
      campo('Etiquetas', `<div class="mv-pastillas" role="group" aria-labelledby="mvL_etiquetas">${ets.map(e => pastilla('#' + e.nombre, `data-k="et-${esc(e.id)}" data-et="${esc(e.id)}"`, (t.etiquetas || []).includes(e.id))).join('') || '<span class="mv-meta">Aún no hay etiquetas.</span>'}</div>
        <div class="mv-linea"><label class="mv-sr" for="mvNE">Nueva etiqueta</label><input id="mvNE" type="text" class="mv-campo" data-k="nueva-et" placeholder="Nueva etiqueta" maxlength="30" enterkeyhint="done"><button type="button" class="mv-btn" data-nueva-et>Añadir</button></div>`, 'etiquetas'),
      campo('Proyecto', `<label class="mv-sr" for="mvPy">Proyecto</label><select id="mvPy" class="mv-campo" data-k="proyecto"><option value="">Sin proyecto</option>${(cat.proyectos || []).map(p => `<option value="${esc(p.id)}"${t.proyecto === p.id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}<option value="+">+ Nuevo proyecto…</option></select>`, 'proyecto'),
      campo('Estimación', `<label class="mv-sr" for="mvEs">Estimación</label><select id="mvEs" class="mv-campo" data-k="estimacion"><option value="">Sin estimar</option>${estimas.map(m => `<option value="${m}"${+t.estimacion === m ? ' selected' : ''}>${minTxt(m)}</option>`).join('')}</select>`, 'estimacion'),
      mia ? campo('Área', `<label class="mv-sr" for="mvAr">Área (opcional)</label><select id="mvAr" class="mv-campo" data-k="area"${hecha ? ' disabled' : ''}><option value="">Sin área</option>${Object.entries(DEPTS).map(([k, n]) => `<option value="${k}"${t.dept === k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`, 'area') : '',
      antes && !mia ? campo('Cuándo arranca', `<label class="mv-sr" for="mvAt">Cuándo arranca</label><input id="mvAt" type="datetime-local" class="mv-campo" data-k="at" value="${t.dueAt ? `${ymd(new Date(t.dueAt))}T${new Date(t.dueAt).toTimeString().slice(0, 5)}` : ''}">${t.dueAt ? '<button type="button" class="mv-btn" data-acc="ya">Que arranque ya</button>' : '<p class="mv-meta">En cuanto haya turno.</p>'}`, 'arranca') : '',
      antes && !t.team && !mia && ags.length ? campo('Agente', `<label class="mv-sr" for="mvAg">Agente</label><select id="mvAg" class="mv-campo" data-k="agente">${ags.filter(x => x.department === t.dept).map(x => `<option value="${esc(x.id)}"${x.id === t.agent ? ' selected' : ''}>${esc(x.name)}${x.lead ? ' (jefe)' : ''}</option>`).join('')}</select>`, 'agente') : '',
      campo('Repetir', `<label class="mv-sr" for="mvRp">Cada cuánto se repite</label><select id="mvRp" class="mv-campo" data-k="rep-cada"><option value="">No se repite</option>${Object.entries(NOMBRE_CADA).map(([k, n]) => `<option value="${k}"${t.repetir?.cada === k ? ' selected' : ''}>${n[0].toUpperCase() + n.slice(1)}</option>`).join('')}</select>${t.repetir ? `<label class="mv-sr" for="mvRm">Desde cuándo cuenta</label><select id="mvRm" class="mv-campo" data-k="rep-modo"><option value="fijo"${t.repetir.modo !== 'alcompletar' ? ' selected' : ''}>desde su fecha límite</option><option value="alcompletar"${t.repetir.modo === 'alcompletar' ? ' selected' : ''}>desde que se termine</option></select><p class="mv-meta">Próximas: ${proximas(t.repetir, baseDe(t), 4).map(f => esc(dmy(new Date(f + 'T12:00').getTime()))).join(' · ') || '—'}</p>` : ''}`, 'repetir'),
      !hecha || (t.cronometro || []).length ? campo('Tu tiempo', `<p class="mv-meta mv-tiempo" aria-live="off"><b>${esc(textoDuracion(tiempo))}</b>${cron ? ' · corriendo' : ''}</p>${!hecha ? `<button type="button" class="mv-btn" data-crono="${cron ? 'parar' : 'iniciar'}" data-k="crono">${cron ? 'Parar el tiempo' : 'Empezar a contar el tiempo'}</button>` : ''}`, 'tiempo') : '',
      pers.length && !['doing', 'waiting'].includes(t.state) && !mia ? campo('Persona', `<label class="mv-sr" for="mvPe">Pasarla a una persona</label><select id="mvPe" class="mv-campo" data-k="persona"><option value="">Los agentes</option>${pers.map(p => `<option value="${esc(p)}"${t.person === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>`, 'persona') : '',
    ].join('');
    const hist = (r.bitacora || []).slice().reverse();
    const comentarios = (t.comments || []);
    raiz.innerHTML = `<p class="mv-guarda" role="status" aria-live="polite"><span>${ultimoError ? 'No se guardó: ' + esc(ultimoError) : 'Todo se guarda solo'}</span></p>
      <label class="mv-sr" for="mvDT">Título</label><textarea id="mvDT" class="mv-campo mv-titin" rows="2" maxlength="90" data-k="titulo" ${editable ? '' : 'readonly'}>${esc(t.title)}</textarea>
      <p class="mv-meta mv-estado"><b class="mv-pill">${esc(mia ? 'Tuya' : ESTADO_UNO[v] || v)}</b>${a && !mia ? ` · ${esc(a.name)}` : ''}${t.dept && !mia ? ` · ${esc(DEPTS[t.dept] || t.dept)}` : ''}${t.person && !mia ? ` · 👤 ${esc(t.person)}` : ''}${t.changedAt ? ` · ${esc(hace(t.changedAt, ahora))}` : ''}</p>
      ${aviso ? `<p class="mv-aviso">${aviso}</p>` : ''}
      ${t.error && hecha ? `<p class="mv-aviso mal" role="alert">Falló: ${esc(String(t.error === true ? t.result || 'sin detalle' : t.error).slice(0, 300))}</p>` : ''}
      <div class="mv-det-acc">${acc.map(([k, txt, cl]) => `<button type="button" class="mv-btn ${cl}" data-acc="${k}" data-k="acc-${k}">${esc(txt)}</button>`).join('')}</div>
      <div class="mv-devolver" ${devolviendo ? '' : 'hidden'}><label class="mv-lab" for="mvDev">¿Qué debe cambiar?</label><textarea id="mvDev" class="mv-campo" rows="3" placeholder="Más corto, con el precio de la nota de ofertas…"></textarea><div class="mv-fila-btn"><button type="button" class="mv-btn" data-acc="devolver-no">Cancelar</button><button type="button" class="mv-btn primario" data-acc="devolver-ok">Devolver</button></div></div>
      <div class="mv-campos">${camposHTML}</div>
      <section class="mv-sec" aria-labelledby="mvSP"><h3 id="mvSP">Pasos ${pasos.length ? `<span>${ph}/${pasos.length}</span>` : ''}</h3>${pasos.length ? `<div class="mv-barra" role="img" aria-label="${ph} de ${pasos.length} pasos hechos"><i style="width:${Math.round(100 * ph / pasos.length)}%"></i></div>` : ''}
        <ul class="mv-pasos">${pasos.map(p => `<li class="${p.hecho ? 'hecho' : ''}"><button type="button" class="mv-check${p.hecho ? ' on' : ''}" data-paso="${esc(p.id)}" data-k="paso-${esc(p.id)}" aria-pressed="${!!p.hecho}" aria-label="${p.hecho ? 'Desmarcar' : 'Marcar'} el paso: ${esc(p.texto)}"${hecha ? ' disabled' : ''}><i>${svg('check')}</i></button><span>${esc(p.texto)}</span>${!hecha ? `<button type="button" class="mv-ic" data-quitar-paso="${esc(p.id)}" aria-label="Quitar el paso «${esc(p.texto)}»">${svg('cerrar')}</button>` : ''}</li>`).join('')}</ul>
        ${hecha ? '' : `<div class="mv-linea"><label class="mv-sr" for="mvAP">Añadir un paso</label><input id="mvAP" type="text" class="mv-campo" data-k="nuevo-paso" placeholder="+ Añadir un paso" maxlength="200" enterkeyhint="done"><button type="button" class="mv-btn" data-nuevo-paso>Añadir</button></div>`}</section>
      <section class="mv-sec" aria-labelledby="mvSB"><h3 id="mvSB">Espera a · la esperan</h3>
        <p class="mv-meta">Antes tiene que terminar:</p><ul class="mv-bl">${(r.bloquean || []).map(x => `<li><span>${esc(x.title)}</span><button type="button" class="mv-ic" data-quitar-bl="${esc(x.id)}" aria-label="Que ya no espere a «${esc(x.title)}»">${svg('cerrar')}</button></li>`).join('') || '<li class="vacio">Nada.</li>'}</ul>
        ${hecha ? '' : `<button type="button" class="mv-btn" data-anadir-bl data-k="anadir-bl"${abiertas.length ? '' : ' disabled'}>+ Que espere a otra tarea…</button>`}
        <p class="mv-meta">La esperan:</p><ul class="mv-bl">${(r.siguientes || []).map(x => `<li><button type="button" class="mv-link mv-izq" data-abrir-otra="${esc(x.id)}">${esc(x.title)} →</button></li>`).join('') || '<li class="vacio">Nadie.</li>'}</ul></section>
      <section class="mv-sec" aria-labelledby="mvSN"><h3 id="mvSN">${mia ? 'Notas' : 'El pedido'}</h3>${editable ? `<label class="mv-sr" for="mvTx">${mia ? 'Notas' : 'El pedido'}</label><textarea id="mvTx" class="mv-campo" rows="4" maxlength="4000" data-k="texto" placeholder="${mia ? 'Lo que necesitas recordar: un teléfono, un dato, el porqué…' : ''}">${esc(t.text || '')}</textarea>` : `<p class="mv-texto">${esc(t.text || '—')}</p>`}${t.why && !mia ? `<p class="mv-meta">${esc(t.why)}</p>` : ''}</section>
      ${t.borradorAgente ? `<section class="mv-sec"><h3>Lo que dejó ${esc(origen?.name || 'el agente')}</h3><pre class="mv-pre">${esc(t.borradorAgente)}</pre></section>` : ''}
      ${(t.result || t.draft) && !(mia && t.result === 'Hecha por ti.') ? `<section class="mv-sec"><h3>${t.state === 'waiting' ? 'El borrador' : 'El resultado'}</h3><pre class="mv-pre">${esc(String(t.state === 'waiting' ? t.draft || t.result : t.result).slice(0, 6000))}</pre></section>` : ''}
      ${(t.notas || []).length ? `<section class="mv-sec"><h3>Lo que anotó el agente</h3><ul class="mv-bit">${t.notas.slice(-12).map(n => `<li>${esc(n.texto)} <small>${esc(hace(n.at, ahora))}</small></li>`).join('')}</ul></section>` : ''}
      <section class="mv-sec" aria-labelledby="mvSC"><h3 id="mvSC">Comentarios</h3><ul class="mv-bit">${comentarios.map(c => `<li><b>${esc(c.by)}</b> ${esc(c.text)} <small>${esc(hace(c.at, ahora))}</small></li>`).join('') || '<li class="vacio">Ninguno todavía.</li>'}</ul>
        <div class="mv-linea"><label class="mv-sr" for="mvCo">Escribe un comentario</label><input id="mvCo" type="text" class="mv-campo" data-k="comentario" placeholder="Escribe un comentario (@persona avisa)" maxlength="2000" enterkeyhint="send"><button type="button" class="mv-btn" data-comentar>Enviar</button></div></section>
      <details class="mv-sec mv-hist"><summary>Historial (${hist.length})</summary><ul class="mv-bit">${hist.map(l => `<li>${esc(lineaBitacora(l, { agente }))} <small>${esc(hace(l.t, ahora))}</small></li>`).join('') || '<li class="vacio">Sin historial todavía.</li>'}</ul></details>
      ${t.state !== 'doing' ? '<div class="mv-det-pie"><button type="button" class="mv-btn peligro" data-acc="borrar">Eliminar la tarea</button></div>' : ''}
      <p class="mv-meta mv-id">#${esc(t.id)}</p>`;
    h.cuerpo.scrollTop = sc;
    if (ultimoError) marcar('No se guardó: ' + ultimoError, true);
    if (foco) raiz.querySelector(`[data-k="${CSS.escape(foco)}"]`)?.focus({ preventScroll: true });
    else if (!suave) h.el.focus({ preventScroll: true });
  }

  // ---- hacer cosas ----
  const estado = (a) => ctx.api(`/api/tareas/${id}/estado`, { method: 'POST', body: { a } });
  const nombre = () => `«${recorte(t.title, 40)}»`;
  const luego = async (cierra = false) => { alCambiar(); ctx.store.refrescar(); olvidarCatalogo(ctx); if (cierra) { h.cerrar(); return; } try { r = await ctx.api(`/api/tareas/${id}`); t = r.tarea; if (!cerrada) pintar(true); } catch { h.cerrar(); } };
  async function accion(k, b) {
    const hd = (fn, o) => hacer(ctx, b, fn, { despues: () => luego(o.cierra), ...o });
    switch (k) {
      case 'pedir': return hd(() => estado('next'), { aviso: `Pedida: ${nombre()} entra en la cola.`, deshacer: () => estado('idea'), ocupado: 'Pidiendo…' });
      case 'aparcar': return hd(() => estado('idea'), { aviso: `${nombre()} vuelve a ideas.`, deshacer: () => estado('next') });
      case 'hecha': return hd(() => estado('done'), { aviso: `${nombre()} marcada como hecha, sin ejecutarla.`, deshacer: () => estado('next') });
      case 'ejecutar': return hd(() => ctx.api(`/api/tasks/${id}/run`, { method: 'POST', body: {} }), { aviso: `${nombre()}: el agente la empieza en cuanto tenga turno.`, ocupado: 'Mandando…' });
      case 'ya': { const prev = t.dueAt; return hd(() => ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { at: null } }), { aviso: `${nombre()} arranca ya.`, deshacer: prev && prev > Date.now() ? () => ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { at: prev } }) : null }); }
      case 'aprobar': h.cerrar(); return setTimeout(() => ctx.navegar('aprobaciones', { id }), 280);
      case 'devolver': devolviendo = true; pintar(true); raiz.querySelector('#mvDev')?.focus(); return;
      case 'devolver-no': devolviendo = false; pintar(true); return;
      case 'devolver-ok': { const n = raiz.querySelector('#mvDev').value.trim(); if (!n) { raiz.querySelector('#mvDev').focus(); ctx.toast('Di qué debe cambiar.'); return; } return hd(() => ctx.api(`/api/tasks/${id}/reject`, { method: 'POST', body: { feedback: n } }), { aviso: `Devuelta: ${nombre()} se rehace con tu nota.`, ocupado: 'Devolviendo…', despues: () => { devolviendo = false; luego(); } }); }
      case 'detener': return hd(() => ctx.api(`/api/tasks/${id}/stop`, { method: 'POST', body: {} }), { aviso: `Detenida: ${nombre()}.`, ocupado: 'Deteniendo…' });
      case 'repetir': return hd(() => ctx.api(`/api/tasks/${id}/repeat`, { method: 'POST', body: {} }), { aviso: x => `Otra vez: «${recorte(x.title)}» entra en la cola.`, deshacer: x => ctx.api(`/api/tasks/${x.id}`, { method: 'DELETE' }) });
      case 'archivar': return hd(() => ctx.api(`/api/tasks/${id}/archive`, { method: 'POST', body: { archived: true } }), { aviso: `Archivada: ${nombre()}.`, deshacer: () => ctx.api(`/api/tasks/${id}/archive`, { method: 'POST', body: { archived: false } }), cierra: true });
      case 'aceptar': return hd(() => estado('next'), { aviso: `Aceptada: ${nombre()} está en tu lista.`, deshacer: () => estado('idea') });
      case 'descartar': return accion('borrar', b);
      case 'hecha-mia': return hd(() => estado('done'), { aviso: `Hecha: ${nombre()}.`, deshacer: () => estado('next'), cierra: true });
      case 'reabrir': return hd(() => estado('next'), { aviso: `${nombre()} vuelve a tu lista.`, deshacer: () => estado('done') });
      case 'empezar': return hd(() => ctx.api(`/api/tareas/${id}/empezar`, { method: 'POST', body: { empezar: true } }), { aviso: `Empezaste ${nombre()}: corre tu tiempo.`, deshacer: () => ctx.api(`/api/tareas/${id}/empezar`, { method: 'POST', body: { empezar: false } }), ocupado: 'Empezando…' });
      case 'pausar': return hd(() => ctx.api(`/api/tareas/${id}/empezar`, { method: 'POST', body: { empezar: false } }), { aviso: `${nombre()} queda para luego.`, deshacer: () => ctx.api(`/api/tareas/${id}/empezar`, { method: 'POST', body: { empezar: true } }) });
      case 'delegar': return abrirDelegar(ctx, t, { alTerminar: () => { alCambiar(); ctx.store.refrescar(); setTimeout(() => h.cerrar(), 600); } });
      case 'devolver-agente': { const o = agente(agenteDeOrigen(t)); if (!o) return; return hd(() => ctx.api(`/api/tareas/${id}/delegar`, { method: 'POST', body: { a: 'agente', dept: o.department, agente: o.id } }), { aviso: `${nombre()} vuelve a ${o.name}.`, deshacer: () => ctx.api(`/api/tareas/${id}/tomar`, { method: 'POST', body: { deshacer: true, deAgente: o.id } }), cierra: true }); }
      case 'tomar': { const antes = t.state, prev = { agente: t.agent, dept: t.dept, estado: antes, dueAt: t.dueAt }; return hd(() => ctx.api(`/api/tareas/${id}/tomar`, { method: 'POST', body: {} }), { aviso: `Es tuya: ${nombre()}.${antes === 'waiting' ? ' Con el borrador del agente.' : ''}`, deshacer: ['next', 'idea', 'scheduled'].includes(antes) ? () => ctx.api(`/api/tareas/${id}/delegar`, { method: 'POST', body: { a: 'agente', ...prev, deshacer: true } }) : null, ocupado: 'Tomándola…' }); }
      case 'borrar': {
        if (!(await ctx.confirmar({ titulo: '¿Eliminar esta tarea?', texto: `${nombre()} se borra para siempre.`, ok: 'Eliminar', peligro: true }))) return;
        h.cerrar(); const x = t; setTimeout(() => hacerYa(ctx, () => ctx.api(`/api/tasks/${x.id}`, { method: 'DELETE' }), { aviso: `Eliminada: «${recorte(x.title)}».`, reintentar: true }).then(() => { alCambiar(); ctx.store.refrescar(); }), 280); return;
      }
    }
  }

  raiz.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-reintentar')) return cargar();
    if (b.hasAttribute('data-reintentar-guardar')) { programar({}, true); return; }
    if (!t) return;
    if (b.dataset.acc) return accion(b.dataset.acc, b);
    if ('lim' in b.dataset) { const cur = String(t.limite || ''), hh = cur.length > 10 ? cur.slice(10) : ''; programar({ limite: b.dataset.lim ? b.dataset.lim + hh : null }, true); return; }
    if (b.dataset.prio) return programar({ prioridad: b.dataset.prio }, true);
    if (b.dataset.et) { const s = new Set(t.etiquetas || []); s.has(b.dataset.et) ? s.delete(b.dataset.et) : s.add(b.dataset.et); return programar({ etiquetas: [...s] }, true); }
    if (b.hasAttribute('data-nueva-et')) return nuevaEtiqueta();
    if (b.dataset.paso) { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); return hacerYa(ctx, () => ctx.api(`/api/tareas/${id}/paso`, { method: 'POST', body: { paso: b.dataset.paso, hecho: on } }), { despues: () => luego(), reintentar: true }); }
    if (b.dataset.quitarPaso) { return programar({ pasos: (t.pasos || []).filter(p => p.id !== b.dataset.quitarPaso) }, true); }
    if (b.hasAttribute('data-nuevo-paso')) return nuevoPaso();
    if (b.dataset.quitarBl) return programar({ bloqueadaPor: (t.bloqueadaPor || []).filter(x => x !== b.dataset.quitarBl) }, true);
    if (b.hasAttribute('data-anadir-bl')) return elegirBloqueo();
    if (b.dataset.abrirOtra) { const o = b.dataset.abrirOtra; h.cerrar(); return setTimeout(() => abrirDetalle(ctx, o, { alCambiar, alCerrar }), 300); }
    if (b.dataset.crono) return hacer(ctx, b, () => ctx.api(`/api/tareas/${id}/cronometro`, { method: 'POST', body: { accion: b.dataset.crono } }), { ocupado: 'Un momento…', hecho: b.dataset.crono === 'parar' ? 'Parado' : 'Contando', ms: 600, despues: () => luego() });
    if (b.hasAttribute('data-comentar')) { const i = raiz.querySelector('#mvCo'), txt = i.value.trim(); if (!txt) { i.focus(); return; } return hacer(ctx, b, () => ctx.api(`/api/tasks/${id}/comment`, { method: 'POST', body: { text: txt } }), { ocupado: 'Enviando…', hecho: 'Enviado', ms: 700, despues: () => { i.value = ''; luego(); } }); }
  });
  raiz.addEventListener('change', async e => {
    const el = e.target, k = el.dataset.k; if (!k || !t) return;
    if (k === 'lim-f') { const hh = el.value ? (String(t.limite || '').length > 10 ? String(t.limite).slice(10) : '') : ''; return programar({ limite: el.value ? el.value + hh : null }, true); }
    if (k === 'lim-h') { const d = String(t.limite || '').slice(0, 10); if (!d) return; return programar({ limite: el.value ? `${d}T${el.value}` : d }, true); }
    if (k === 'proyecto') { if (el.value === '+') { el.value = t.proyecto || ''; return nuevoProyecto(); } return programar({ proyecto: el.value || null }, true); }
    if (k === 'estimacion') return programar({ estimacion: el.value ? +el.value : null }, true);
    if (k === 'area') return programar({ dept: el.value || null }, true);
    if (k === 'at') return programar({ at: el.value ? new Date(el.value).getTime() : null }, true);
    if (k === 'agente') return programar({ agent: el.value }, true);
    if (k === 'rep-cada') return programar({ repetir: el.value ? { cada: el.value, modo: t.repetir?.modo || 'fijo', ...(t.repetir?.hasta ? { hasta: t.repetir.hasta } : {}) } : null }, true);
    if (k === 'rep-modo') return programar({ repetir: { ...t.repetir, modo: el.value } }, true);
    if (k === 'persona') return hacerYa(ctx, () => ctx.api(`/api/tasks/${id}/person`, { method: 'POST', body: { person: el.value || '' } }), { aviso: el.value ? `La tiene ${el.value}: los agentes no la tocan.` : 'Vuelve a los agentes.', despues: () => luego() });
  });
  raiz.addEventListener('input', e => { const k = e.target.dataset.k; if (k === 'titulo') programar({ title: e.target.value }); else if (k === 'texto') programar({ text: e.target.value }); });
  raiz.addEventListener('focusout', e => { if (Object.keys(pend).length && /titulo|texto/.test(e.target.dataset?.k || '')) { clearTimeout(tm); volcar(); } });
  raiz.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.shiftKey) return; const k = e.target.dataset?.k;
    if (k === 'nuevo-paso') { e.preventDefault(); nuevoPaso(); } else if (k === 'nueva-et') { e.preventDefault(); nuevaEtiqueta(); } else if (k === 'comentario') { e.preventDefault(); raiz.querySelector('[data-comentar]').click(); }
  });

  async function nuevoPaso() { const i = raiz.querySelector('#mvAP'), txt = i?.value.trim(); if (!txt) { i?.focus(); return; } i.value = ''; programar({ pasos: [...(t.pasos || []), txt] }, true); }
  async function nuevaEtiqueta() {
    const i = raiz.querySelector('#mvNE'), n = (i?.value || '').trim().replace(/^#/, '').toLowerCase(); if (!n) { i?.focus(); return; }
    try {
      let e = (cat.etiquetas || []).find(x => x.nombre.toLowerCase() === n);
      if (!e) { e = (await ctx.api('/api/tareas/etiquetas', { method: 'POST', body: { nombre: n } })).etiqueta; olvidarCatalogo(ctx); cat = await catalogo(ctx, true); }
      i.value = ''; programar({ etiquetas: [...new Set([...(t.etiquetas || []), e.id])] }, true);
    } catch (er) { ctx.toast('No se pudo crear la etiqueta: ' + er.message); }
  }
  function nuevoProyecto() {
    const hp = ctx.hoja({ titulo: 'Nuevo proyecto', cuerpo: `<label class="mv-lab" for="mvNp">Nombre</label><input id="mvNp" type="text" class="mv-campo" maxlength="80" placeholder="Lanzamiento de la colección" autofocus><label class="mv-lab" for="mvNo">Objetivo (opcional)</label><input id="mvNo" type="text" class="mv-campo" maxlength="500">`,
      acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: 'Crear y usarlo', tipo: 'primario', alTocar: async (x, b) => {
        const nom = x.cuerpo.querySelector('#mvNp').value.trim(); if (!nom) { x.cuerpo.querySelector('#mvNp').focus(); return; }
        const res = await hacer(ctx, b, () => ctx.api('/api/tareas/proyectos', { method: 'POST', body: { nombre: nom, objetivo: x.cuerpo.querySelector('#mvNo').value.trim() } }), { ocupado: 'Creando…', hecho: 'Creado', ms: 400, aviso: `Proyecto creado: «${recorte(nom)}».` });
        if (res.ok) { olvidarCatalogo(ctx); cat = await catalogo(ctx, true).catch(() => cat); programar({ proyecto: res.valor.proyecto.id }, true); setTimeout(() => x.cerrar(), 350); }
      } }] });
    return hp;
  }
  function elegirBloqueo() {
    const lista = ctx.store.st.tareas.filter(x => x.id !== t.id && x.state !== 'done' && !x.archived && !(t.bloqueadaPor || []).includes(x.id)).slice(0, 200);
    const hp = ctx.hoja({ titulo: 'Que espere a…', lleno: true, cuerpo: `<label class="mv-sr" for="mvBq">Buscar una tarea</label><input id="mvBq" type="text" class="mv-campo" placeholder="Buscar una tarea" autofocus><ul class="mv-elegir"></ul>` });
    const ul = hp.cuerpo.querySelector('ul'), q = hp.cuerpo.querySelector('#mvBq');
    const pinta = () => { const s = q.value.trim().toLowerCase(); const l = lista.filter(x => !s || x.title.toLowerCase().includes(s)).slice(0, 60); ul.innerHTML = l.map(x => `<li><button type="button" class="mv-lista-b" data-id="${esc(x.id)}"><span>${esc(x.title)}<small>${esc(ESTADO_UNO[visible(x, porId())] || '')}${x.agent ? ' · ' + esc(agente(x.agent)?.name || x.agent) : ''}</small></span></button></li>`).join('') || '<li class="vacio mv-meta">No hay tareas así.</li>'; };
    q.addEventListener('input', pinta); pinta();
    ul.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b) return; programar({ bloqueadaPor: [...(t.bloqueadaPor || []), b.dataset.id] }, true); hp.cerrar(); });
  }
  cargar();
  return h;
}

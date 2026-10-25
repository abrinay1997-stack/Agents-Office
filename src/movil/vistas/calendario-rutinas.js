// Versión móvil (25 oct 2026) — RUTINAS en el Calendario: crear y editar (los días como siete botones L M X J V S D, la hora, mensual, cada
// hora, desde y hasta, N veces, quién la hace, si pide tu OK, si trabaja todo el equipo), lo que se hace con una ejecución (mover «solo esta
// vez» o «siempre», saltarla, ejecutar ahora, pausar, eliminar) y la hoja con lo que le toca. Todo con botones de 44 px y sin arrastrar.
// El horario se arma con src/movil/rutinas-puro.js (que usa las mismas reglas de src/when.js que el servidor).
import { describe } from '../../when.js';
import { esc, svg, hora as horaDe, ymd, hace } from '../ui.js';
import { etiquetaDia } from '../agenda.js';
import { DIAS, CADENCIAS, NTH, formDe, whenDeForm, resumenForm, validarForm, cambiosDe, moverEjecucion } from '../rutinas-puro.js';
import { DEPTS, hacer, hacerYa, recorte, interruptor, alternar } from './tareas-comun.js';

const RT_DEPTS = ['marketing', 'sales', 'emails', 'ops', 'fin', 'delivery'];
const UNDO_MS = 8000;

async function equiposActivos(ctx) { if (ctx._eq !== undefined) return ctx._eq; try { const h = await ctx.api('/api/health'); ctx._eq = !h.teams || h.teams.enabled !== false; } catch { ctx._eq = true; } return ctx._eq; }

/** El formulario de una rutina. `r` = la que se edita (o null para una nueva); `dia` = el día tocado (se vuelve su «desde»). */
export async function abrirFormulario(ctx, r, { dia = '', hora = '', alTerminar = () => {} } = {}) {
  const [ags, equipos] = await Promise.all([ctx.store.agentes(), equiposActivos(ctx)]);
  const nueva = !r;
  const f = formDe(r, { dept: ctx._ultimoDeptRt || 'ops' });
  if (nueva && dia && dia > ymd(new Date())) f.inicio = dia;
  if (nueva && hora) f.at = hora;
  let intento = false;
  const agentesDe = d => ags.filter(a => a.department === d);
  const err = k => (intento ? whenDeForm(f).errores[k] || validarForm(f, { crear: nueva }).errores[k] : '') || '';
  const campoErr = k => (err(k) ? `<p class="mv-err" role="alert" id="mvE_${k}">${esc(err(k))}</p>` : '');
  const dias = () => `<div class="mv-dias" role="group" aria-label="Días de la semana">${DIAS.map(([l, n, nom]) => `<button type="button" class="mv-dia-b" data-dia="${n}" aria-pressed="${f.days.includes(n)}" aria-label="${nom}"><span aria-hidden="true">${l}</span></button>`).join('')}</div>`;
  const cuando = () => {
    const hr = `<label class="mv-lab" for="mvRh">A qué hora</label><input id="mvRh" type="time" class="mv-campo" data-f="at" value="${esc(f.at)}" aria-invalid="${!!err('at')}">${campoErr('at')}`;
    let c = `<span class="mv-lab" id="mvRk">Se repite</span><div class="mv-pastillas" role="group" aria-labelledby="mvRk">${CADENCIAS.map(([k, n]) => `<button type="button" class="mv-chip" data-kind="${k}" aria-pressed="${f.kind === k}">${n}</button>`).join('')}</div>`;
    if (f.kind === 'weekly') c += `<span class="mv-lab" id="mvRd">Qué días</span>${dias()}${campoErr('days')}${hr}`;
    else if (f.kind === 'monthly') {
      c += `<div class="mv-seg mv-seg-in" role="group" aria-label="Qué día del mes"><button type="button" data-modo="dia" aria-pressed="${f.modo === 'dia'}">Un día del mes</button><button type="button" data-modo="nth" aria-pressed="${f.modo === 'nth'}">El … lunes</button></div>`;
      c += f.modo === 'nth'
        ? `<div class="mv-dos"><div><label class="mv-lab" for="mvRn">Cuál</label><select id="mvRn" class="mv-campo" data-f="nth">${NTH.map(([v, n]) => `<option value="${v}"${+f.nth === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div><div><label class="mv-lab" for="mvRw">Día</label><select id="mvRw" class="mv-campo" data-f="weekday">${DIAS.map(([, n, nom]) => `<option value="${n}"${+f.weekday === n ? ' selected' : ''}>${nom}</option>`).join('')}</select></div></div>`
        : `<label class="mv-lab" for="mvRdm">Qué día del mes (1 a 31, o −1 = el último)</label><input id="mvRdm" type="number" inputmode="numeric" class="mv-campo" data-f="dia" min="-1" max="31" value="${esc(f.dia)}" aria-invalid="${!!err('dia')}">${campoErr('dia')}`;
      c += hr;
    } else if (f.kind === 'hourly') {
      c += `<label class="mv-lab" for="mvRc">Cada cuántas horas</label><input id="mvRc" type="number" inputmode="numeric" class="mv-campo" data-f="cada" min="1" max="24" value="${esc(f.cada)}" aria-invalid="${!!err('cada')}">${campoErr('cada')}
        ${interruptor('mvRv', 'Solo en una franja del día', f.ventana)}${f.ventana ? `<div class="mv-dos"><div><label class="mv-lab" for="mvRd1">Desde</label><input id="mvRd1" type="time" class="mv-campo" data-f="desde" value="${esc(f.desde)}"></div><div><label class="mv-lab" for="mvRd2">Hasta</label><input id="mvRd2" type="time" class="mv-campo" data-f="hasta" value="${esc(f.hasta)}"></div></div>${campoErr('ventana')}` : ''}
        ${interruptor('mvRl', 'Solo de lunes a viernes', f.soloLab)}`;
    } else c += hr;
    return c;
  };
  const cuerpo = () => `<div class="mv-rform">
    <label class="mv-lab" for="mvRt">Qué debe hacer</label><textarea id="mvRt" class="mv-campo" rows="3" data-f="texto" maxlength="4000" placeholder="Revisar los correos de la noche y avisarme de lo urgente" aria-invalid="${!!err('texto')}" aria-describedby="mvE_texto"${nueva ? ' autofocus' : ''}>${esc(f.texto)}</textarea>${campoErr('texto')}
    <div class="mv-dos"><div><label class="mv-lab" for="mvRdp">Departamento</label><select id="mvRdp" class="mv-campo" data-f="dept"${nueva ? '' : ' disabled'}>${RT_DEPTS.map(k => `<option value="${k}"${f.dept === k ? ' selected' : ''}>${esc(DEPTS[k])}</option>`).join('')}</select></div>
    <div><label class="mv-lab" for="mvRag">Quién la hace</label><select id="mvRag" class="mv-campo" data-f="agente"><option value="">Que elija la oficina</option>${agentesDe(f.dept).map(a => `<option value="${esc(a.id)}"${f.agente === a.id ? ' selected' : ''}>${esc(a.name)}${a.lead ? ' (jefe)' : ''}</option>`).join('')}</select></div></div>
    <div class="mv-cuando" aria-live="polite">${cuando()}</div>
    <p class="mv-resumen" role="status"><b>Se repetirá:</b> <span data-resumen>${esc(resumenForm(f) || 'completa el horario')}</span></p>
    <details class="mv-mas-opc"${f.inicio || f.fin || f.veces ? ' open' : ''}><summary>Desde, hasta y cuántas veces</summary>
      <label class="mv-lab" for="mvRi">Empieza el (opcional)</label><input id="mvRi" type="date" class="mv-campo" data-f="inicio" value="${esc(f.inicio)}" min="${ymd(new Date())}" aria-invalid="${!!err('inicio')}">${campoErr('inicio')}
      <label class="mv-lab" for="mvRf">Termina el (opcional)</label><input id="mvRf" type="date" class="mv-campo" data-f="fin" value="${esc(f.fin)}" min="${esc(f.inicio || ymd(new Date()))}" aria-invalid="${!!err('fin')}">${campoErr('fin')}
      <label class="mv-lab" for="mvRv2">O se detiene después de … veces (opcional)</label><input id="mvRv2" type="number" inputmode="numeric" class="mv-campo" data-f="veces" min="1" max="999" value="${esc(f.veces)}" aria-invalid="${!!err('veces')}">${campoErr('veces')}</details>
    ${interruptor('mvRok', 'Que me pida el OK', f.needsOk, 'Antes de enviar o publicar nada, espera tu visto bueno.')}
    ${equipos ? interruptor('mvReq', 'Que trabaje todo el equipo', f.equipo, 'El jefe del departamento la reparte entre sus puestos. Cuesta más.') : ''}
    ${err('general') ? `<p class="mv-err" role="alert">${esc(err('general'))}</p>` : ''}</div>`;
  const h = ctx.hoja({ titulo: nueva ? 'Nueva rutina' : 'Editar la rutina', cuerpo: cuerpo(), clase: 'completa', acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: nueva ? 'Crear la rutina' : 'Guardar', tipo: 'primario', alTocar: (x, b) => guardar(x, b) }] });
  const raiz = h.cuerpo;
  const repinta = (foco) => { const sc = h.cuerpo.scrollTop; raiz.innerHTML = cuerpo(); h.cuerpo.scrollTop = sc; if (foco) raiz.querySelector(foco)?.focus({ preventScroll: true }); };
  const resumen = () => { const s = raiz.querySelector('[data-resumen]'); if (s) s.textContent = resumenForm(f) || 'completa el horario'; };
  raiz.addEventListener('input', e => {
    const k = e.target.dataset?.f; if (!k) return;
    f[k] = e.target.value; resumen();
  });
  raiz.addEventListener('change', e => {
    const k = e.target.dataset?.f; if (!k) return;
    f[k] = e.target.value;
    if (k === 'dept') { f.agente = ''; repinta('#mvRdp'); } else if (k === 'inicio') { repinta('#mvRi'); } else resumen();
  });
  raiz.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.kind) { f.kind = b.dataset.kind; if (f.kind === 'weekly' && !f.days.length) f.days = [1]; return repinta(`[data-kind="${f.kind}"]`); }
    if (b.dataset.dia) { const n = +b.dataset.dia; f.days = f.days.includes(n) ? f.days.filter(x => x !== n) : [...f.days, n]; b.setAttribute('aria-pressed', String(f.days.includes(n))); resumen(); return; }
    if (b.dataset.modo) { f.modo = b.dataset.modo; return repinta(`[data-modo="${f.modo}"]`); }
    if (b.getAttribute('role') === 'switch') {
      const on = alternar(b);
      if (b.id === 'mvRok') f.needsOk = on; else if (b.id === 'mvReq') f.equipo = on; else if (b.id === 'mvRv') { f.ventana = on; repinta('#mvRv'); } else if (b.id === 'mvRl') { f.soloLab = on; resumen(); }
    }
  });
  async function guardar(x, b) {
    intento = true; const op = {}, v = nueva ? validarForm(f, { crear: true }) : cambiosDe(r, f, op);
    if (!v.ok) { repinta(); const malo = raiz.querySelector('[aria-invalid="true"], .mv-err'); malo?.scrollIntoView?.({ block: 'center' }); (raiz.querySelector('[aria-invalid="true"]') || malo)?.focus?.(); ctx.toast('Revisa lo marcado en rojo.'); return; }
    if (!nueva && !Object.keys(v.cambios).length) { x.cerrar(); ctx.toast('No cambiaste nada.'); return; }
    const res = await hacer(ctx, b, () => (nueva ? ctx.api('/api/routines', { method: 'POST', body: v.cuerpo }) : ctx.api(`/api/routines/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: v.cambios })), {
      ocupado: nueva ? 'Creando…' : 'Guardando…', hecho: nueva ? 'Creada' : 'Guardada', ms: 500,
      aviso: j => nueva ? `Rutina creada: «${recorte(j.routine?.title || f.texto)}» · ${describe(v.cuerpo.when)}.` : 'Rutina guardada.',
      deshacer: nueva ? j => ctx.api(`/api/routines/${encodeURIComponent(j.routine.id)}`, { method: 'DELETE' }) : null,
      despues: () => { ctx.store.refrescar(); alTerminar(); },
    });
    if (res.ok) { if (nueva) ctx._ultimoDeptRt = f.dept; setTimeout(() => x.cerrar(), 450); }
  }
  return h;
}

/** Lo que le toca a una rutina en `at` (ms): la hoja con todo lo que se puede hacer. */
export async function abrirRutina(ctx, id, at, { alCambiar = () => {}, mover = null } = {}) {
  const r = ctx.store.st.rutinas.find(x => x.id === id); if (!r) { ctx.toast('Esa rutina ya no existe.'); return; }
  const ags = await ctx.store.agentes(), a = ags.find(x => x.id === r.agent);
  const saltada = (r.skips || []).includes(at), futura = at > Date.now(), ultima = ctx.store.st.tareas.find(t => t.id === r.lastTaskId);
  const estUlt = !ultima ? '' : ultima.state === 'done' ? (ultima.error ? '⚠ falló' : '✓ hecha') : ultima.state === 'waiting' ? 'espera tu OK' : ultima.state === 'doing' ? 'en curso' : 'en cola';
  const btn = (k, txt, cl = '') => `<button type="button" class="mv-btn ${cl}" data-r="${k}">${txt}</button>`;
  const cuerpo = `<p class="mv-meta">${esc(DEPTS[r.dept] || r.dept)}${a ? ' · ' + esc(a.name) : ''}${r.team ? ' · todo el equipo' : ''}</p><p class="mv-texto">${esc(describe(r.when))}${r.terminada ? ' · terminada' : ''}</p>
    <p class="mv-meta">${at ? `Esta ejecución: <b>${esc(etiquetaDia(ymd(new Date(at))))} ${esc(horaDe(at))}</b>${saltada ? ' · saltada' : ''}` : ''}${r.paused ? ' · la rutina está en pausa' : ''}</p>
    <p class="mv-meta">${r.needsOk !== false ? 'Antes de enviar algo espera tu OK.' : 'Solo lee y avisa: no pide tu OK.'}</p>
    <p class="mv-meta">${r.runs ? `Ha corrido ${r.runs} ${r.runs === 1 ? 'vez' : 'veces'}` : 'Aún no ha corrido'}${r.lastAt ? ` · la última, ${esc(hace(r.lastAt))}${estUlt ? ' (' + estUlt + ')' : ''}` : ''}.</p>
    ${r.text && r.text !== r.title ? `<p class="mv-notas">${esc(r.text).slice(0, 500)}</p>` : ''}
    <div class="mv-det-acc">${futura && !r.paused && !saltada ? btn('mover', 'Mover esta ejecución…') : ''}${futura && !r.paused ? (saltada ? btn('incluir', 'Volver a incluir esta ejecución') : btn('saltar', 'Saltar esta vez')) : ''}${btn('ahora', 'Ejecutar ahora', 'primario')}${btn('editar', 'Editar la rutina')}${btn('pausa', r.paused ? 'Reanudar la rutina' : 'Pausar la rutina')}${btn('borrar', 'Eliminar la rutina', 'peligro')}</div>`;
  const h = ctx.hoja({ titulo: r.title, cuerpo, lleno: true });
  const fin = () => { ctx.store.refrescar(); alCambiar(); };
  h.cuerpo.addEventListener('click', async e => {
    const b = e.target.closest('[data-r]'); if (!b) return; const k = b.dataset.r;
    if (k === 'mover') { h.cerrar(); return setTimeout(() => moverEjec(ctx, r, at, { alCambiar }), 280); }
    if (k === 'editar') { h.cerrar(); return setTimeout(() => abrirFormulario(ctx, r, { alTerminar: fin }), 280); }
    if (k === 'saltar' || k === 'incluir') return hacer(ctx, b, () => ctx.api(`/api/routines/${encodeURIComponent(id)}/${k === 'saltar' ? 'skip' : 'unskip'}`, { method: 'POST', body: { at } }), { ocupado: '…', hecho: k === 'saltar' ? 'Saltada' : 'Incluida', ms: 500, aviso: k === 'saltar' ? 'Saltada: no correrá esa vez.' : 'Esa ejecución vuelve a correr.', deshacer: () => ctx.api(`/api/routines/${encodeURIComponent(id)}/${k === 'saltar' ? 'unskip' : 'skip'}`, { method: 'POST', body: { at } }), despues: () => { fin(); setTimeout(() => h.cerrar(), 400); } });
    if (k === 'pausa') return hacer(ctx, b, () => ctx.api(`/api/routines/${encodeURIComponent(id)}/${r.paused ? 'resume' : 'pause'}`, { method: 'POST', body: {} }), { ocupado: '…', hecho: r.paused ? 'Reanudada' : 'En pausa', ms: 500, aviso: r.paused ? `«${recorte(r.title)}» vuelve a correr.` : `«${recorte(r.title)}» queda en pausa.`, deshacer: () => ctx.api(`/api/routines/${encodeURIComponent(id)}/${r.paused ? 'pause' : 'resume'}`, { method: 'POST', body: {} }), despues: () => { fin(); setTimeout(() => h.cerrar(), 400); } });
    if (k === 'ahora') {
      if (!(await ctx.confirmar({ titulo: '¿Ejecutar ahora?', texto: `«${r.title}» empieza en cuanto confirmes${r.needsOk !== false ? ' y lo que envíe espera tu OK' : ''}.`, ok: 'Ejecutar' }))) return;
      return hacer(ctx, b, () => ctx.api(`/api/routines/${encodeURIComponent(id)}/run`, { method: 'POST', body: {} }), { ocupado: 'Mandando…', hecho: 'En marcha', ms: 700, aviso: 'En marcha. La ves en Tareas → De los agentes.', despues: () => { fin(); setTimeout(() => h.cerrar(), 500); } });
    }
    if (k === 'borrar') {
      if (!(await ctx.confirmar({ titulo: '¿Eliminar la rutina?', texto: `«${r.title}» deja de correr. Esto no se puede deshacer; si solo quieres que descanse, pausarla es mejor.`, ok: 'Eliminar', peligro: true }))) return;
      const copia = { dept: r.dept, text: r.text, when: r.when, agent: r.agent, needsOk: r.needsOk !== false, team: !!r.team };
      return hacer(ctx, b, () => ctx.api(`/api/routines/${encodeURIComponent(id)}`, { method: 'DELETE' }), { ocupado: 'Eliminando…', hecho: 'Eliminada', ms: 400, aviso: `Rutina eliminada: «${recorte(r.title)}».`, deshacer: () => ctx.api('/api/routines', { method: 'POST', body: copia }), despues: () => { fin(); setTimeout(() => h.cerrar(), 400); } });
    }
  });
  return h;
}

/** Mover UNA ejecución: día y hora nuevos, y la pregunta «¿solo esta vez o siempre?» con lo que de verdad se puede. */
export function moverEjec(ctx, r, at, { alCambiar = () => {} } = {}) {
  const d0 = new Date(at), dstr = ymd(d0), hstr = horaDe(at);
  const h = ctx.hoja({ titulo: 'Mover esta ejecución', cuerpo: `<p class="mv-meta">«${esc(recorte(r.title, 60))}» · ahora le toca ${esc(etiquetaDia(dstr).toLowerCase())} a las ${esc(hstr)}.</p>
    <label class="mv-lab" for="mvMd">Nuevo día</label><input id="mvMd" type="date" class="mv-campo" value="${dstr}" min="${ymd(new Date())}"><label class="mv-lab" for="mvMh">Nueva hora</label><input id="mvMh" type="time" class="mv-campo" value="${hstr}">
    <div class="mv-pregunta" role="status" aria-live="polite"><p class="mv-meta" data-p></p></div>`, acciones: [{ texto: 'Solo esta vez', alTocar: (x, b) => aplicar(x, b, 'una') }, { texto: 'Siempre', tipo: 'primario', alTocar: (x, b) => aplicar(x, b, 'siempre') }] });
  const c = h.cuerpo, [bUna, bSiempre] = h.acciones();
  const nuevo = () => new Date(`${c.querySelector('#mvMd').value}T${c.querySelector('#mvMh').value || hstr}`).getTime();
  function calcula() {
    const m = moverEjecucion(r, at, nuevo()), p = c.querySelector('[data-p]'), igual = Math.abs(nuevo() - at) < 60000;
    for (const [b, ok] of [[bUna, m.unaVez && !igual], [bSiempre, !!m.siempre && !igual]]) { b.disabled = !ok; b.setAttribute('aria-disabled', String(!ok)); }
    p.innerHTML = igual ? 'Cambia el día o la hora.' : `<b>Solo esta vez:</b> ${m.unaVez ? `corre ${esc(etiquetaDia(ymd(new Date(nuevo()))).toLowerCase())} a las ${esc(c.querySelector('#mvMh').value)} y las demás siguen igual.` : esc(m.motivoUnaVez)}<br><b>Siempre:</b> ${m.siempre ? `queda «${esc(describe(m.siempre))}».` : esc(m.motivoSiempre)}`;
  }
  c.addEventListener('input', calcula); c.addEventListener('change', calcula); calcula();
  async function aplicar(x, b, modo) {
    const nu = nuevo(), m = moverEjecucion(r, at, nu);
    if (modo === 'una') {
      const res = await hacer(ctx, b, async () => { const t = await ctx.api('/api/tasks', { method: 'POST', body: { dept: r.dept, text: r.text || r.title, at: nu, agent: r.agent, title: r.title, needsOk: r.needsOk !== false } }); await ctx.api(`/api/routines/${encodeURIComponent(r.id)}/skip`, { method: 'POST', body: { at } }); return t; },
        { ocupado: 'Moviendo…', hecho: 'Movida', ms: 500, aviso: `Solo esta vez: ${etiquetaDia(ymd(new Date(nu))).toLowerCase()} ${horaDe(nu)}. Las demás siguen igual.`, deshacer: async t => { await ctx.api(`/api/tasks/${t.id}`, { method: 'DELETE' }); await ctx.api(`/api/routines/${encodeURIComponent(r.id)}/unskip`, { method: 'POST', body: { at } }); }, despues: () => { ctx.store.refrescar(); alCambiar(); } });
      if (res.ok) setTimeout(() => x.cerrar(), 450);
    } else {
      const antes = r.when;
      const res = await hacer(ctx, b, () => ctx.api(`/api/routines/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: { when: m.siempre } }), { ocupado: 'Moviendo…', hecho: 'Movida', ms: 500, aviso: `Movida para siempre: ${describe(m.siempre)}.`, deshacer: () => ctx.api(`/api/routines/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: { when: antes } }), despues: () => { ctx.store.refrescar(); alCambiar(); } });
      if (res.ok) setTimeout(() => x.cerrar(), 450);
    }
  }
  return h;
}

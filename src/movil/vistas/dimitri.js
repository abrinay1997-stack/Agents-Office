// Versión móvil (25 oct 2026) — DIMITRI: el chat a pantalla completa, con la entrada fija abajo (sube con el teclado). Reutiliza /api/sub/*:
// la charla en vivo (su respuesta crece mientras la escribe, con «Detener»), «¿Cómo vamos?» al instante, el historial de conversaciones,
// «Nueva conversación» con DESHACER, lo que está «Viendo» (la pantalla de la que vienes), sugerencias según esa pantalla, y las tarjetas
// de lo que propone: un PLAN (cada pieza se revisa antes de ENVIAR A LOS JEFES), CAMBIOS en el calendario o las tareas (Hacerlo ·
// Descartar · Deshacer 30 s) y preguntas con opciones. Lo que GASTA (generar en el Estudio, activar un anuncio) NO se confirma aquí: la
// tarjeta lo manda a la vista de escritorio, donde están los dos clics y los topes. Todo lo que dice Dimitri se pinta con md.js.
import { mdToHtml } from '../../md.js';
import { pastChoices } from '../../sub-ops.js';
import { esc, svg, vacio, hace } from '../ui.js';
import { hacer, hacerYa, interruptor, alternar } from './tareas-comun.js';
import { estudioHTML, adjuntosBurbuja, crearAdjuntos } from './dimitri-extra.js'; // fotos adjuntas y tarjetas de creativos (equipo B)
import { planHTML, opsHTML, preguntasHTML, itemsEnvio, itemsOps, respuesta, NOMBRE_DEPT, aInput, manana, sinResolver } from './dimitri-tarjetas.js';
import { abrirDetalle } from './tareas-detalle.js';

const MODO = { charla: 'Charla', estado: 'Estado', analisis: 'Análisis', plan: 'Plan', pregunta: 'Pregunta', estudio: 'Estudio' };
const SUG = {
  tareas: [['¿Qué debería hacer primero hoy?'], ['Resúmeme lo vencido y lo bloqueado'], ['Reparte mi lista entre los agentes']],
  cal: [['¿Qué tengo esta semana?'], ['Revisa si hay choques en mi calendario'], ['Crea una rutina semanal de …', true]],
  default: [['¿Cómo vamos?', false, 'estado'], ['¿Qué tengo pendiente esta semana?'], ['Arma el plan de contenido de la semana']],
};

export function registrar(shell) {
  shell.registrarVista({
    id: 'dimitri', titulo: 'Dimitri', icono: 'dimitri', grupo: 'tab',
    montar(el, ctx) {
      let mensajes = [], cargado = false, ocupado = false, nombre = 'Dimitri', error = '', fallo = null, vivo = '', vivoModo = '', corrida = '', deteniendo = false, sinCtx = false, ctxUlt = '', tic = 0;
      const edits = new Map(), opEdits = new Map(), picks = new Map(), opsOcupadas = new Set();
      let gente = []; // 26 oct 2026: las personas del equipo a las que se les puede pasar una pieza (cuentas de la plataforma y Ajustes → Equipo)
      const cargarGente = () => ctx.api('/api/team').then(j => { const yo = globalThis.AO_NUBE?.yo?.()?.nombre; gente = (j.people || []).map(p => p.name).filter(n => n && n !== 'Tú' && n !== yo); }).catch(() => {});
      cargarGente(); addEventListener('ao:yo', cargarGente);
      el.innerHTML = `<div class="mv-scroll mv-chat" id="mvChatSc" tabindex="-1"><div class="mv-hilo" role="log" aria-live="polite" aria-label="Conversación con Dimitri"></div></div>
        <form class="mv-compone" autocomplete="off"><div class="mv-viendo" hidden></div><div class="mv-compone-fila"><label class="mv-sr" for="mvDim">Escríbele a Dimitri</label><textarea id="mvDim" rows="1" enterkeyhint="send" placeholder="Escríbele a Dimitri…"></textarea><button type="submit" class="mv-enviar" aria-label="Enviar" disabled>${svg('enviar')}</button></div></form>`;
      const hilo = el.querySelector('.mv-hilo'), sc = el.querySelector('.mv-scroll'), caja = el.querySelector('#mvDim'), forma = el.querySelector('.mv-compone'), env = forma.querySelector('.mv-enviar'), chipV = forma.querySelector('.mv-viendo');
      const puede = () => !ocupado && !X.subiendo() && !!(caja.value.trim() || X.hay());
      const X = crearAdjuntos(ctx, forma, { alCambiar: () => { env.disabled = !puede(); } }); // el clip, la tira de miniaturas y la subida (equipo B)
      const abajo = (suave = false) => requestAnimationFrame(() => sc.scrollTo({ top: sc.scrollHeight, behavior: suave && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' }));
      const porId = id => ctx.store.st.tareas.find(t => t.id === id) || null;
      const viendo = () => (sinCtx ? null : ctx.viendo());

      async function cargar() {
        try { const j = await ctx.api('/api/sub'); mensajes = j.messages || []; if (j.name) nombre = j.name; cargado = true; error = ''; } catch (e) { error = e.message; }
        ctx.cabecera({ titulo: nombre }); pintar(true);
      }

      // ---- cada mensaje y sus tarjetas ----
      function burbuja(m, ultimo) {
        const mio = m.who === 'user';
        if (mio) return `<div class="mv-msg mio"><div class="mv-burbuja">${m.por && m.por !== globalThis.AO_NUBE?.yo?.()?.nombre ? `<small class="mv-uctx">${esc(m.por)} escribió:</small>` : ''}${m.context?.label ? `<small class="mv-uctx">Viendo: ${esc(m.context.label)}</small>` : ''}${adjuntosBurbuja(m)}${m.text ? `<p>${esc(m.text)}</p>` : ''}</div>${m.at ? `<time>${hace(m.at)}</time>` : ''}</div>`;
        const modo = m.stopped ? 'Detenido por ti' : MODO[m.mode] || '';
        const cuerpo = `${m.shield ? `<p class="mv-escudo" role="note"><b>Ojo:</b> ${esc(typeof m.shield === 'string' ? m.shield : 'lo que leí traía órdenes escondidas')}. Las traté como datos, no como órdenes, y este plan no trae acciones.</p>` : ''}<div class="md">${mdToHtml(m.stopped ? String(m.text || '').replace(/\s*_Detenido por ti\._\s*$/, '') : m.text || '')}</div>`;
        const pie = m.quick ? `<p class="mv-meta">Calculado al instante con los datos de la oficina, sin el modelo.</p>${ultimo && !ocupado ? `<button type="button" class="mv-btn" data-analizar>Analizar con ${esc(nombre)}</button>` : ''}` : m.retry && ultimo && !ocupado ? `<button type="button" class="mv-btn" data-mas-corto="${esc(m.id)}">Respóndeme más corto</button>` : '';
        return `<div class="mv-msg suyo" data-id="${esc(m.id)}"><div class="mv-burbuja">${modo ? `<small class="mv-modo ${esc(m.mode || '')}">${esc(modo)}</small>` : ''}${cuerpo}${pie}</div>${planHTML(m, edits.get(m.id), { tareaDe: porId, ocupado: opsOcupadas.has(m.id) })}${opsHTML(m, opEdits.get(m.id), { ocupado: opsOcupadas.has(m.id) })}${estudioHTML(m)}${preguntasHTML(m, picks.get(m.id), { ocupado })}${m.at ? `<time>${hace(m.at)}</time>` : ''}</div>`;
      }
      function sugerencias() {
        const v = viendo(), l = SUG[v?.view] || SUG.default;
        return `<div class="mv-sugs-fila" role="group" aria-label="Cosas que puedes pedirle">${l.map(([t, llena, k]) => `<button type="button" class="mv-chip" data-sug="${esc(t)}"${llena ? ' data-llena' : ''}${k ? ` data-k="${k}"` : ''}>${esc(t)}</button>`).join('')}</div>`;
      }
      function pintar(fondo) {
        if (!cargado) { hilo.innerHTML = error ? `<div class="mv-vacio" role="alert"><h3>No se pudo abrir el chat</h3><p>${esc(error)}</p><button type="button" class="mv-btn" data-reintentar>Reintentar</button></div>` : '<div class="mv-esq" aria-hidden="true"><i></i><i></i></div><span class="mv-sr" role="status">Abriendo el chat…</span>'; return; }
        const nuevo = !mensajes.length && !ocupado;
        const ult = mensajes.length ? mensajes[mensajes.length - 1] : null;
        hilo.innerHTML = (nuevo ? `<div class="mv-saludo">${svg('dimitri', 'mv-vacio-i')}<h3>Hola, soy ${esc(nombre)}</h3><p>Tu mano derecha. Pregúntame cómo va la oficina o pídeme que organice trabajo.</p></div>` : mensajes.map(m => burbuja(m, m === ult)).join(''))
          + (ocupado ? vivoHTML() : '') + (fallo ? falloHTML() : '') + (!ocupado && !fallo ? sugerencias() : '');
        env.disabled = !puede(); chipViendo();
        if (fondo !== false) abajo();
        arrancaCuenta();
      }
      const vivoHTML = () => `${vivo ? `<div class="mv-msg suyo"><div class="mv-burbuja">${MODO[vivoModo] ? `<small class="mv-modo ${esc(vivoModo)}">${MODO[vivoModo]}</small>` : ''}<div class="md mv-vivo">${mdToHtml(vivo)}</div></div></div>` : ''}
        <div class="mv-escribiendo" role="status"><span class="mv-puntos" aria-hidden="true"><i></i><i></i><i></i></span><span>${esc(nombre)} está ${deteniendo ? 'deteniéndose…' : vivo ? 'escribiendo…' : 'pensando…'}</span>${corrida && !deteniendo ? '<button type="button" class="mv-btn" data-detener>Detener</button>' : ''}</div>`;
      const falloHTML = () => `<div class="mv-falla" role="alert"><p><b>No pude responder ahora.</b> ${esc(fallo.motivo)} Tu mensaje no se perdió.</p><button type="button" class="mv-btn primario" data-reenviar>Reintentar</button></div>`;
      function chipViendo() {
        const v = viendo(), k = v ? v.label : '';
        if (!v) { chipV.hidden = true; chipV.innerHTML = ''; ctxUlt = ''; return; }
        if (k === ctxUlt && !chipV.hidden) return; ctxUlt = k; chipV.hidden = false;
        chipV.innerHTML = `<span><b>Viendo:</b> ${esc(k)}</span><button type="button" class="mv-ic" data-sin-ctx aria-label="No usar lo que estoy viendo como contexto">${svg('cerrar')}</button>`;
      }

      // ---- hablar con Dimitri (su respuesta crece mientras la escribe) ----
      async function pedirChat(cuerpo) {
        const r = await fetch('/api/sub/chat', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...cuerpo, stream: true }) }).catch(e => { throw new Error(e instanceof TypeError ? 'Sin conexión con la oficina. Revisa tu internet.' : e.message); });
        if (r.status === 401) { setTimeout(() => location.reload(), 50); throw new Error('Tu sesión terminó: vuelve a entrar.'); }
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `la oficina respondió ${r.status}`); }
        let final = null, errorSrv = '';
        const linea = l => { if (!l.trim()) return; let o; try { o = JSON.parse(l); } catch { return; }
          if (o.type === 'start') { corrida = o.run; pintarVivo(); } else if (o.type === 'reply') { vivo = o.text || ''; vivoModo = o.mode || ''; pintarVivo(); } else if (o.type === 'done') final = o; else if (o.type === 'error') errorSrv = o.error || 'no pude responder'; };
        if (r.body?.getReader) { const rd = r.body.getReader(), dec = new TextDecoder(); let buf = ''; for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); const ls = buf.split('\n'); buf = ls.pop(); ls.forEach(linea); } buf += dec.decode(); linea(buf); }
        else (await r.text()).split('\n').forEach(linea);
        if (errorSrv) throw new Error(errorSrv);
        if (!final) throw new Error('la conexión se cortó antes de terminar');
        return final;
      }
      function pintarVivo() { // solo la burbuja que crece: no se redibuja todo (el botón Detener conserva el foco)
        const md = hilo.querySelector('.mv-vivo');
        if (md && vivo) { const abajoYa = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80; md.innerHTML = mdToHtml(vivo); const e = hilo.querySelector('.mv-escribiendo span:last-of-type'); if (e && !deteniendo) e.textContent = `${nombre} está escribiendo…`; if (abajoYa) abajo(); }
        else { const f = document.activeElement?.hasAttribute?.('data-detener'); pintar(); if (f) hilo.querySelector('[data-detener]')?.focus(); }
      }
      async function enviar(texto, { via = 'chat', answers = null, sinEco = false } = {}) {
        texto = String(texto).trim(); if ((!texto && !(via === 'chat' && X.hay())) || ocupado) return;
        if (via === 'chat' && X.subiendo()) await X.esperar(); // una foto que aún sube: se espera, no se manda sin ella
        const guardadas = X.lista(), salida = via === 'chat' ? X.tomar(texto) : null; if (via === 'chat' && !salida && !texto) return;
        if (salida) { texto = salida.text; X.devolver([]); }
        mensajes = mensajes.filter(m => m.id !== 'tmp-fallo'); ocupado = true; fallo = null; vivo = ''; vivoModo = ''; corrida = ''; deteniendo = false; caja.value = ''; ajustaAlto();
        const v = viendo(), contexto = v ? { view: v.view, label: v.label, kind: v.kind || null, id: v.id || null } : null;
        mensajes.push({ id: 'tmp', who: 'user', text: texto, attach: salida ? salida.attach : undefined, at: Date.now(), ...(v ? { context: { label: v.label } } : {}) }); pintar(); const desde = Date.now() - 5000;
        try {
          if (via === 'estado') { const j = await ctx.api('/api/sub/estado', { method: 'POST', body: { text: texto } }); mensajes = mensajes.filter(m => m.id !== 'tmp').concat(j.messages || []); }
          else { const j = await pedirChat({ text: texto, ...(salida && salida.attach.length ? { attach: salida.attach } : {}), ...(salida && salida.vision ? { vision: salida.vision } : {}), ...(contexto ? { context: contexto } : {}), ...(answers ? { answers } : {}) }); mensajes = mensajes.filter(m => m.id !== 'tmp').concat(j.messages || []); if (j.answered) { const q = mensajes.find(x => x.id === j.answered.msg); if (q?.plan) q.plan.answers = j.answered.answers; } }
        } catch (e) {
          mensajes = mensajes.filter(m => m.id !== 'tmp');
          const mio = { id: 'tmp-fallo', who: 'user', text: texto, at: Date.now(), ...(v ? { context: { label: v.label } } : {}) };
          try { const j = await ctx.api('/api/sub'); const l = j.messages || []; if (l.some(m => m.who === 'sub' && m.at >= desde)) { mensajes = l; throw null; } } catch (x) { if (x === null) { ocupado = false; pintar(); ctx.store.refrescar(); return; } }
          mensajes.push(mio); fallo = { texto, motivo: e.message, answers, via, adj: salida ? guardadas : null }; if (salida) X.devolver(guardadas); // su mensaje se queda a la vista, con el motivo y «Reintentar» debajo
        }
        ocupado = false; vivo = ''; corrida = ''; pintar(); ctx.store.refrescar();
      }
      forma.addEventListener('submit', e => { e.preventDefault(); enviar(caja.value); });
      function ajustaAlto() { caja.style.height = 'auto'; caja.style.height = Math.min(140, caja.scrollHeight) + 'px'; }
      caja.addEventListener('input', () => { ajustaAlto(); env.disabled = !puede(); });
      caja.addEventListener('focus', () => setTimeout(() => abajo(true), 250));

      // ---- cada acción sobre una tarjeta: con su estado y su motivo si falla ----
      const poner = (id, j) => { const k = mensajes.findIndex(x => x.id === id); if (k >= 0 && j.message) mensajes[k] = j.message; for (const x of j.messages || []) if (!mensajes.some(y => y.id === x.id)) mensajes.push(x); };
      async function enviarPlan(id, btn, descartar) {
        const m = mensajes.find(x => x.id === id); if (!m || opsOcupadas.has(id)) return; opsOcupadas.add(id);
        const r = await hacer(ctx, btn, () => ctx.api('/api/sub/send', { method: 'POST', body: { msg: id, items: itemsEnvio(m, edits.get(id), { descartar }) } }), { ocupado: descartar ? 'Descartando…' : 'Enviando a los jefes…', hecho: descartar ? 'Descartado' : 'Enviado', ms: 600, aviso: descartar ? 'Plan descartado: no se envió nada.' : 'Enviado a los jefes.', despues: v => { if (v) { poner(id, v); edits.delete(id); } } });
        opsOcupadas.delete(id); pintar(false); ctx.store.refrescar();
        if (r.ok) return;
      }
      async function hacerOps(id, btn, descartar) {
        const m = mensajes.find(x => x.id === id); if (!m || opsOcupadas.has(id)) return; opsOcupadas.add(id);
        const r = await hacer(ctx, btn, () => ctx.api('/api/sub/ops', { method: 'POST', body: { msg: id, items: itemsOps(m, opEdits.get(id), { descartar }) } }), { ocupado: descartar ? 'Descartando…' : 'Haciendo…', hecho: descartar ? 'Descartado' : 'Hecho', ms: 600, aviso: descartar ? 'Descartado: no cambié nada.' : 'Hecho. Puedes deshacerlo 30 segundos.', despues: v => { if (v) { poner(id, v); opEdits.delete(id); } } });
        opsOcupadas.delete(id); pintar(false); ctx.store.refrescar();
        if (!r.ok) pintar(false);
      }
      async function deshacerOp(id, k, btn) {
        const r = await hacer(ctx, btn, () => ctx.api('/api/sub/ops/undo', { method: 'POST', body: { msg: id, k } }), { ocupado: 'Deshaciendo…', hecho: 'Deshecho', ms: 500, aviso: 'Deshecho.', despues: v => { if (v) poner(id, v); } });
        pintar(false); ctx.store.refrescar(); return r;
      }
      function responder(id, btn) {
        const m = mensajes.find(x => x.id === id); if (!m) return;
        const { text, answers } = respuesta(m, picks.get(id)); if (!text) return;
        btn.disabled = true; picks.delete(id); enviar(text, { answers });
      }
      const pick = (id, q) => { if (!picks.has(id)) picks.set(id, new Map()); const p = picks.get(id); if (!p.has(q)) p.set(q, { values: [], other: '', otherOn: false }); return p.get(q); };

      // la hoja para revisar una pieza del plan
      function revisarPieza(id, i) {
        const m = mensajes.find(x => x.id === id), t = m?.plan?.tasks.find(x => x.i === i); if (!t || t.state !== 'proposed') return;
        if (!edits.has(id)) edits.set(id, new Map()); const ed = edits.get(id); const e = ed.get(i) || {}; const b = { ...e };
        const dept = () => b.dept || t.dept, persona = () => (dept() === 'persona' ? b.persona ?? t.persona : null), propia = () => dept() === 'dueno' || dept() === 'persona', inst = b.instruction ?? t.instruction, team = b.team ?? t.team, at = b.at !== undefined ? b.at : t.at, gone = sinResolver(t, b);
        const pc = t.at && sinResolver(t, {}) ? pastChoices(t.at) : null;
        const cuerpo = () => `<p class="mv-meta">${esc(t.why || '')}</p>
          ${gone ? `<div class="mv-pasada" role="note"><p>Esa hora ya pasó. ¿Cuándo la hago?</p><div class="mv-fila-btn">${pc ? `<button type="button" class="mv-btn" data-man="${manana(t.at)}">${esc(pc.label)}</button>` : ''}<button type="button" class="mv-btn" data-ahora>Ahora</button></div></div>` : ''}
          <label class="mv-lab" for="mvPd">Quién la hace</label><select id="mvPd" class="mv-campo">${[...Object.keys(NOMBRE_DEPT).filter(k => k !== 'dueno'), 'dueno'].map(k => `<option value="${k}"${k === dept() ? ' selected' : ''}>${esc(NOMBRE_DEPT[k])}</option>`).join('')}${(pp => (pp.length ? `<optgroup label="Personas del equipo">${pp.map(n => `<option value="p:${esc(n)}"${persona() === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>` : ''))(persona() && !gente.includes(persona()) ? [...gente, persona()] : gente)}</select>
          ${propia() ? '' : interruptor('mvPt', 'Que trabaje todo el equipo', team)}
          <label class="mv-lab" for="mvPa">Cuándo se hace (vacío: en cuanto la envíes)</label><input id="mvPa" type="datetime-local" class="mv-campo" value="${at && !gone ? aInput(at) : ''}" min="${aInput(Date.now())}">
          <label class="mv-lab" for="mvPi">${propia() ? (persona() ? `Notas para ${esc(persona())}` : 'Notas para ti') : 'Instrucciones para el jefe'}</label><textarea id="mvPi" class="mv-campo" rows="5">${esc(inst || '')}</textarea>`;
        const h = ctx.hoja({ titulo: t.title, lleno: true, cuerpo: `<div class="mv-pz-f">${cuerpo()}</div>`, acciones: [{ texto: 'No incluir', alTocar: x => { b.include = false; ed.set(i, b); x.cerrar(); pintar(false); } }, { texto: 'Listo', tipo: 'primario', alTocar: x => { const c = x.cuerpo; const dv = c.querySelector('#mvPd').value, nueva = { ...b, include: true, dept: dv.startsWith('p:') ? 'persona' : dv, persona: dv.startsWith('p:') ? dv.slice(2) : undefined, instruction: c.querySelector('#mvPi').value }; const a = c.querySelector('#mvPa').value; if (a) nueva.at = new Date(a).getTime(); else if (b.at === undefined && !t.at) delete nueva.at; else if (!a) nueva.at = null; if (nueva.dept === 'dueno' || nueva.dept === 'persona') delete nueva.team; ed.set(i, nueva); x.cerrar(); pintar(false); } }] });
        const repinta = f => { const sc0 = h.cuerpo.scrollTop; h.cuerpo.firstElementChild.innerHTML = cuerpo(); h.cuerpo.scrollTop = sc0; if (f) h.cuerpo.querySelector(f)?.focus({ preventScroll: true }); };
        h.cuerpo.addEventListener('change', e => { if (e.target.id === 'mvPd') { const dv = e.target.value; b.dept = dv.startsWith('p:') ? 'persona' : dv; b.persona = dv.startsWith('p:') ? dv.slice(2) : undefined; b.instruction = h.cuerpo.querySelector('#mvPi').value; repinta('#mvPd'); } else if (e.target.id === 'mvPa') { b.at = e.target.value ? new Date(e.target.value).getTime() : null; } });
        h.cuerpo.addEventListener('input', e => { if (e.target.id === 'mvPi') b.instruction = e.target.value; });
        h.cuerpo.addEventListener('click', e => {
          const sw = e.target.closest('[role="switch"]'); if (sw) { b.team = alternar(sw); return; }
          const man = e.target.closest('[data-man]'); if (man) { b.at = +man.dataset.man; b.instruction = h.cuerpo.querySelector('#mvPi').value; return repinta(); }
          if (e.target.closest('[data-ahora]')) { b.at = null; b.instruction = h.cuerpo.querySelector('#mvPi').value; repinta(); }
        });
      }

      hilo.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.sug) { if (b.hasAttribute('data-llena')) { caja.value = b.dataset.sug.replace(/ …$/, ' '); ajustaAlto(); env.disabled = false; caja.focus(); return; } return enviar(b.dataset.sug, { via: b.dataset.k === 'estado' ? 'estado' : 'chat' }); }
        if (b.hasAttribute('data-reintentar')) return cargar();
        if (b.hasAttribute('data-reenviar')) { const f = fallo; fallo = null; if (f.adj) X.devolver(f.adj); return enviar(f.texto, { via: f.via, answers: f.answers }); }
        if (b.hasAttribute('data-detener')) { if (!corrida) return; deteniendo = true; pintarVivo(); try { await ctx.api('/api/sub/stop', { method: 'POST', body: { run: corrida } }); } catch (er) { deteniendo = false; ctx.toast('No pude detenerlo: ' + er.message); } return; }
        if (b.hasAttribute('data-analizar')) return enviar('Analiza este estado de la oficina: qué te preocupa, qué haría yo hoy y qué puede esperar.');
        if (b.dataset.masCorto) { const k = mensajes.findIndex(x => x.id === b.dataset.masCorto), u = k > 0 ? mensajes.slice(0, k).reverse().find(x => x.who === 'user') : null; if (u) enviar(`${u.text}\n(Respóndeme más corto.)`); return; }
        if (b.dataset.media) return ctx.navegar('estudio', { file: b.dataset.media });
        if (b.hasAttribute('data-gasto')) return ctx.escritorio('dimitri-completo');
        // plan
        const pz = b.closest('.mv-pieza'); if (pz && b.hasAttribute('data-pz-inc')) { const id = pz.dataset.msg, i = +pz.dataset.i; if (!edits.has(id)) edits.set(id, new Map()); const ed = edits.get(id), cur = ed.get(i) || {}; ed.set(i, { ...cur, include: cur.include === false }); return pintar(false); }
        if (pz && b.hasAttribute('data-pz-ed')) return revisarPieza(pz.dataset.msg, +pz.dataset.i);
        if (b.dataset.pzAbrir) return abrirDetalle(ctx, b.dataset.pzAbrir, { alCambiar: () => ctx.store.refrescar() });
        if (b.dataset.plSi) return enviarPlan(b.dataset.plSi, b, false);
        if (b.dataset.plNo) { if (!(await ctx.confirmar({ titulo: '¿Descartar el plan?', texto: 'No se envía nada a los jefes.', ok: 'Descartar', peligro: true }))) return; return enviarPlan(b.dataset.plNo, b, true); }
        // cambios
        if (b.dataset.opInc !== undefined) { const id = b.dataset.msg, k = +b.dataset.opInc; if (!opEdits.has(id)) opEdits.set(id, new Map()); const ed = opEdits.get(id), cur = ed.get(k) || {}; ed.set(k, { ...cur, include: cur.include === false }); return pintar(false); }
        if (b.dataset.opsSi) return hacerOps(b.dataset.opsSi, b, false);
        if (b.dataset.opsNo) return hacerOps(b.dataset.opsNo, b, true);
        if (b.dataset.opUndo !== undefined) return deshacerOp(b.dataset.msg, +b.dataset.opUndo, b);
        // preguntas
        if (b.dataset.qOpt !== undefined || b.hasAttribute('data-q-otra')) {
          if (b.getAttribute('aria-disabled') === 'true') return;
          const m = mensajes.find(x => x.id === b.dataset.msg), q = (m?.plan?.questions || []).find(x => x.id === b.dataset.q); if (!q) return; const p = pick(b.dataset.msg, q.id);
          if (b.hasAttribute('data-q-otra')) { p.otherOn = !p.otherOn; if (!q.multi && p.otherOn) p.values = []; }
          else { const v = b.dataset.qOpt; if (q.multi) p.values = p.values.includes(v) ? p.values.filter(x => x !== v) : [...p.values, v]; else { p.values = [v]; p.otherOn = false; } }
          const pos = sc.scrollTop; pintar(false); sc.scrollTop = pos; if (p.otherOn) hilo.querySelector(`[data-q-txt="${CSS.escape(q.id)}"]`)?.focus();
          // una sola pregunta con una sola opción sin «Otra…»: se responde con un toque
          const unica = (m.plan.questions || []).filter(x => typeof x === 'object' && x.options?.length);
          if (unica.length === 1 && !q.multi && !p.otherOn && p.values.length) responder(m.id, b);
          return;
        }
        if (b.dataset.qOk) return responder(b.dataset.qOk, b);
      });
      hilo.addEventListener('input', e => { const t = e.target; if (t.dataset.qTxt !== undefined) { pick(t.dataset.msg, t.dataset.qTxt).other = t.value; const ok = hilo.querySelector(`[data-q-ok="${CSS.escape(t.dataset.msg)}"]`); if (ok) { const m = mensajes.find(x => x.id === t.dataset.msg), cond = (m?.plan?.questions || []).filter(x => typeof x === 'object' && x.options?.length).every(q => { const p = picks.get(t.dataset.msg)?.get(q.id); return p && (p.values.length || (p.otherOn && p.other.trim())); }); ok.disabled = !cond || ocupado; } } });
      chipV.addEventListener('click', e => { if (e.target.closest('[data-sin-ctx]')) { sinCtx = true; ctxUlt = ''; chipViendo(); ctx.toast('Dimitri no usará lo que estás viendo.'); } });

      // la cuenta atrás de «Deshacer» (30 s): solo se mueve el número; al llegar a 0 la tarjeta se redibuja sin el botón
      function arrancaCuenta() {
        clearInterval(tic); if (!hilo.querySelector('[data-hasta]')) return;
        tic = setInterval(() => { const bs = hilo.querySelectorAll('[data-hasta]'); if (!bs.length || el.hidden) { clearInterval(tic); return; } let vence = false; for (const b of bs) { const s = Math.ceil((+b.dataset.hasta - Date.now()) / 1000); if (s <= 0) vence = true; else if (b.getAttribute('aria-busy') !== 'true') { const n = b.querySelector('span'); if (n) n.textContent = s; } } if (vence) { clearInterval(tic); pintar(false); } }, 1000);
      }

      // ---- historial y nueva conversación ----
      async function historial() {
        const h = ctx.hoja({ titulo: 'Conversaciones', cuerpo: '<div class="mv-esq" aria-hidden="true"><i></i><i></i></div><span class="mv-sr" role="status">Cargando…</span>', lleno: true, acciones: [{ texto: 'Conversación nueva', tipo: 'primario', alTocar: x => { x.cerrar(); setTimeout(nueva, 260); } }] });
        const pinta = async () => {
          try {
            const j = await ctx.api('/api/sub/conversaciones'), lista = j.lista || [];
            const fila = c => `<li class="mv-conv" data-id="${esc(c.id)}"><button type="button" class="mv-conv-b" data-abrir><b>${esc(c.titulo)}</b><small>${new Date(c.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${c.n} mensajes</small></button><button type="button" class="mv-ic" data-borrar aria-label="Borrar la conversación «${esc(c.titulo)}»">${svg('borrar')}</button></li>`;
            h.cuerpo.innerHTML = (j.actual ? `<p class="mv-meta">Ahora: ${esc(j.actual.titulo)} · ${j.actual.n} mensajes</p>` : '') + (lista.length ? `<ul class="mv-convs">${lista.map(fila).join('')}</ul>` : vacio('Sin conversaciones guardadas', 'Cuando empieces una nueva, la de ahora se guarda aquí.', { icono: 'historial' }));
          } catch (e) { h.cuerpo.innerHTML = `<div class="mv-vacio" role="alert"><h3>No pude traer el historial</h3><p>${esc(e.message)}</p><button type="button" class="mv-btn" data-reintentar>Reintentar</button></div>`; }
        };
        h.cuerpo.addEventListener('click', async e => {
          if (e.target.closest('[data-reintentar]')) return pinta();
          const li = e.target.closest('.mv-conv'); if (!li) return; const id = li.dataset.id;
          if (e.target.closest('[data-abrir]')) { if (ocupado) { ctx.toast('Espera a que termine de contestar.'); return; } try { const r = await ctx.api('/api/sub/abrir', { method: 'POST', body: { id } }); mensajes = r.messages || []; h.cerrar(); pintar(); } catch (er) { ctx.toast('No se pudo abrir: ' + er.message); } }
          else if (e.target.closest('[data-borrar]')) { if (!(await ctx.confirmar({ titulo: '¿Borrar esta conversación?', texto: 'Se borra para siempre.', ok: 'Borrar', peligro: true }))) return; try { await ctx.api('/api/sub/borrar', { method: 'POST', body: { id } }); li.remove(); } catch (er) { ctx.toast('No se pudo: ' + er.message); } }
        });
        pinta();
      }
      async function nueva() {
        if (ocupado) { ctx.toast('Espera a que termine de contestar.'); return; }
        const antes = mensajes;
        const r = await hacerYa(ctx, () => ctx.api('/api/sub/clear', { method: 'POST', body: {} }), { aviso: 'Conversación nueva. La anterior está en el historial.', reintentar: true, deshacer: v => ctx.api('/api/sub/restore', { method: 'POST', body: { id: v.archived } }).then(j => { mensajes = j.messages || antes; }), despues: v => { if (v && v.archived !== undefined && mensajes === antes) { mensajes = []; edits.clear(); opEdits.clear(); picks.clear(); fallo = null; pintar(false); } else pintar(false); } });
        if (!r.ok) pintar(false);
      }
      ctx.cabecera({ titulo: nombre, acciones: [{ icono: 'historial', etiqueta: 'Conversaciones guardadas', alTocar: historial }, { icono: 'mas1', etiqueta: 'Conversación nueva', alTocar: nueva }] });
      el._tick = () => { clearInterval(el._timer); el._timer = setInterval(() => { if (!el.hidden && !ocupado && !fallo && document.visibilityState === 'visible') ctx.api('/api/sub').then(j => { const l = j.messages || []; if (!ocupado && (l.length !== mensajes.length || (l.at(-1)?.id !== mensajes.at(-1)?.id))) { mensajes = l; pintar(); } }).catch(() => {}); }, 9000); };
      el._cargar = () => { sinCtx = false; ctxUlt = ''; return cargar(); }; el._adjuntar = id => X.agregarGaleria([id]); pintar();
    },
    alMostrar(el, ctx, p) { el._cargar?.(); el._tick?.(); if (p && p.adjuntar) setTimeout(() => el._adjuntar?.(p.adjuntar), 80); },
    alOcultar(el) { clearInterval(el._timer); },
  });
}

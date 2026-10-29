/* C1 — el chat interno del equipo: lista, hilo, directos, canales y no leídos (solo en la nube; paquete aparte, la página no crece). Detrás de `chat.config.activo` (apagado: no pinta nada).
   SIN sockets todavía (C2): sondeo prudente (resumen cada 60 s, el hilo abierto cada 10 s, nada con la pestaña oculta) y puesta al día en `visibilitychange`.
   Privacidad: aquí solo se pinta lo que la API devuelve a ESTA cuenta; todo texto se escapa con esc() (nombres, canales, mensajes); los enlaces solo http(s) y con rel="noopener noreferrer". */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N || N.chat) return;
  const { api, esc } = N;
  const RESUMEN_MS = 60_000, HILO_MS = 10_000, APAGADO_MS = 300_000;
  let activo = false, abierto = false, vista = 'lista', res = { canales: [], total: 0 }, canal = null, msgs = [], hayMas = false, personas = null, publicos = null, nuevoTab = 'directo', msg = '';
  let boton = null, panel = null, tRes = 0, tHilo = 0, ultimoVisto = 0;
  const borradores = {};
  const movil = () => document.body.classList.contains('movil') || matchMedia('(max-width: 820px)').matches;
  const soloLee = () => N.yo()?.rol === 'lectura';
  const hora = (t) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const dia = (t) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  const tipoNombre = (c) => (c.tipo === 'directo' ? c.nombre : '#' + c.nombre);
  /** Texto plano → HTML seguro: escapado, saltos de línea y enlaces http(s) (lo único que se adorna). */
  const cuerpoHTML = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`).replace(/\n/g, '<br>');

  function pintarBoton() {
    if (!activo) { boton?.remove(); boton = null; return; }
    if (!boton) { boton = document.createElement('button'); boton.type = 'button'; boton.id = 'nbChatBtn'; boton.className = 'ch-btn'; boton.setAttribute('aria-haspopup', 'dialog'); boton.addEventListener('click', () => (abierto ? cerrar() : abrir())); document.body.appendChild(boton); }
    const n = res.total;
    boton.setAttribute('aria-label', n ? `Chat: ${n} sin leer` : 'Chat'); boton.setAttribute('aria-expanded', String(abierto));
    boton.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>${n ? `<span class="ch-n" aria-hidden="true">${n > 9 ? '9+' : n}</span>` : ''}`;
  }

  async function cargarResumen() {
    clearTimeout(tRes);
    if (!document.hidden) { try { const d = await api('/api/chat/resumen'); activo = d.activo === true; res = { canales: d.canales || [], total: d.total || 0 }; } catch { /* sin red: se reintenta */ } }
    pintarBoton(); if (abierto && vista === 'lista') pintar();
    tRes = setTimeout(cargarResumen, activo ? RESUMEN_MS : APAGADO_MS);
  }

  async function cargarHilo(id, { marcar = true } = {}) {
    try {
      const d = await api(`/api/chat/canales/${id}/mensajes?limite=50`);
      if (!canal || canal.id !== id) return;
      const nuevos = d.mensajes.length && d.mensajes.at(-1).id !== (msgs.at(-1)?.id ?? 0);
      msgs = d.mensajes; hayMas = d.hayMas; if (nuevos || !ultimoVisto) pintar({ abajo: true });
      if (marcar && msgs.length && msgs.at(-1).id > ultimoVisto) { ultimoVisto = msgs.at(-1).id; await api(`/api/chat/canales/${id}/leido`, { metodo: 'POST', cuerpo: { hasta: ultimoVisto } }).catch(() => {}); cargarResumen(); }
    } catch (e) { msg = e.message; pintar(); }
  }
  function sondearHilo() { clearTimeout(tHilo); if (!abierto || vista !== 'hilo' || !canal) return; tHilo = setTimeout(async () => { if (!document.hidden) await cargarHilo(canal.id); sondearHilo(); }, HILO_MS); }

  async function abrirCanal(c) {
    canal = c; msgs = []; hayMas = false; ultimoVisto = 0; vista = 'hilo'; msg = ''; pintar();
    await cargarHilo(c.id); sondearHilo();
  }
  async function abrirDirecto(con) {
    try { const d = await api('/api/chat/directo', { metodo: 'POST', cuerpo: { con } }); await cargarResumen(); const c = res.canales.find((x) => x.id === d.id); if (c) abrirCanal(c); } catch (e) { msg = e.message; pintar(); }
  }

  const filaCanal = (c) => `<li><button type="button" class="ch-fila${canal?.id === c.id ? ' on' : ''}" data-a="abrir" data-id="${esc(c.id)}"><span class="ch-fn"><b>${esc(tipoNombre(c))}</b>${c.privado && c.tipo !== 'directo' ? ' <small>privado</small>' : ''}${c.silenciado ? ' <small>silenciado</small>' : ''}</span><span class="ch-prev">${c.ultimo ? esc((c.ultimo.propio ? 'Tú: ' : '') + c.ultimo.texto) : '<i>Sin mensajes</i>'}</span>${c.noLeidos ? `<span class="ch-bad" aria-label="${c.noLeidos} sin leer${c.menciones ? ', ' + c.menciones + ' te mencionan' : ''}">${c.noLeidos > 99 ? '99+' : c.noLeidos}${c.menciones ? ' @' : ''}</span>` : ''}</button></li>`;

  function listaHTML() {
    const dir = res.canales.filter((c) => c.tipo === 'directo'), can = res.canales.filter((c) => c.tipo !== 'directo');
    return `<div class="ch-cab"><h2 id="ch-t">Chat</h2><span><button type="button" class="sg-btn" data-a="nuevo">+ Nuevo</button> <button type="button" class="sg-btn" data-a="x" aria-label="Cerrar el chat">✕</button></span></div>
      <h3>Canales</h3><ul class="ch-lista">${can.map(filaCanal).join('') || '<li class="ch-vacio">Todavía no hay canales.</li>'}</ul>
      <h3>Directos</h3><ul class="ch-lista">${dir.map(filaCanal).join('') || '<li class="ch-vacio">Escríbele a alguien con «+ Nuevo».</li>'}</ul>`;
  }

  function mensajeHTML(m, i) {
    const prev = msgs[i - 1], nuevoDia = !prev || dia(prev.at) !== dia(m.at), junto = prev && !nuevoDia && prev.deId === m.deId && m.at - prev.at < 5 * 60_000 && !prev.borrado;
    const sep = nuevoDia ? `<div class="ch-dia"><span>${esc(dia(m.at))}</span></div>` : '';
    if (m.borrado) return `${sep}<div class="ch-m ch-borrado"><i>Mensaje borrado</i></div>`;
    const acc = m.mio ? `<span class="ch-acc"><button type="button" data-a="editar" data-id="${m.id}">Editar</button><button type="button" data-a="borrar" data-id="${m.id}">Borrar</button></span>` : (N.yo()?.rol === 'admin' && !canal.privado && canal.tipo !== 'directo' ? `<span class="ch-acc"><button type="button" data-a="borrar" data-id="${m.id}">Borrar</button></span>` : '');
    return `${sep}<div class="ch-m${m.mio ? ' mio' : ''}${junto ? ' junto' : ''}" data-m="${m.id}">${junto ? '' : `<div class="ch-quien"><b>${esc(m.de)}</b> <small>${esc(hora(m.at))}${m.editado ? ' · editado' : ''}</small></div>`}<div class="ch-txt">${cuerpoHTML(m.cuerpo)}</div>${acc}</div>`;
  }

  function hiloHTML() {
    const c = canal;
    return `<div class="ch-cab"><span class="ch-tit">${movil() ? '<button type="button" class="sg-btn" data-a="atras" aria-label="Volver a la lista">←</button>' : ''}<h2 id="ch-t">${esc(tipoNombre(c))}</h2></span><span>${c.tipo !== 'directo' ? `<button type="button" class="sg-btn" data-a="silenciar" aria-pressed="${c.silenciado ? 'true' : 'false'}">${c.silenciado ? 'Silenciado' : 'Silenciar'}</button> ` : ''}<button type="button" class="sg-btn" data-a="x" aria-label="Cerrar el chat">✕</button></span></div>
      <div class="ch-hilo" id="ch-hilo" tabindex="0" aria-label="Mensajes de ${esc(tipoNombre(c))}">${hayMas ? '<p class="ch-vacio">Se muestran los últimos 50 mensajes.</p>' : ''}${msgs.map(mensajeHTML).join('') || '<p class="ch-vacio">Aquí empieza la conversación.</p>'}</div>
      ${soloLee() ? '<p class="ch-vacio ch-solo">Con acceso de lectura puedes leer este canal, no escribir.</p>' : `<form class="ch-form"><label for="ch-texto" class="ch-oculto">Escribir en ${esc(tipoNombre(c))}</label><textarea id="ch-texto" rows="2" maxlength="4200" placeholder="Escribe un mensaje…"></textarea><button type="submit" class="sg-btn pri">Enviar</button></form>`}
      <p class="nb-msg" role="status">${esc(msg)}</p>`;
  }

  function nuevoHTML() {
    const tabs = [['directo', 'Directo'], ['canal', 'Canal nuevo'], ['unirme', 'Unirme']].map(([k, t]) => `<button type="button" class="sg-btn${nuevoTab === k ? ' pri' : ''}" data-a="tab" data-k="${k}" aria-pressed="${nuevoTab === k}">${t}</button>`).join(' ');
    let cuerpo = '<p class="ch-vacio">Cargando…</p>';
    if (nuevoTab === 'directo' && personas) cuerpo = soloLee() ? '<p class="ch-vacio">Con acceso de lectura no se abren chats directos.</p>' : `<ul class="ch-lista">${personas.map((p) => `<li><button type="button" class="ch-fila" data-a="directo" data-id="${esc(p.id)}"><span class="ch-fn"><b>${esc(p.nombre)}</b></span></button></li>`).join('') || '<li class="ch-vacio">No hay a quién escribirle todavía.</li>'}</ul>`;
    if (nuevoTab === 'canal') cuerpo = soloLee() ? '<p class="ch-vacio">Con acceso de lectura no se crean canales.</p>' : `<form class="ch-nuevo"><label for="ch-nom">Nombre del canal</label><input id="ch-nom" maxlength="40" autocomplete="off"><label class="ch-chk"><input type="checkbox" id="ch-priv"> Privado (solo quienes añadas)</label>${personas ? `<fieldset><legend>Añadir gente (hasta 10)</legend>${personas.map((p) => `<label class="ch-chk"><input type="checkbox" name="m" value="${esc(p.id)}"> ${esc(p.nombre)}</label>`).join('')}</fieldset>` : ''}<button type="submit" class="sg-btn pri">Crear canal</button></form>`;
    if (nuevoTab === 'unirme' && publicos) cuerpo = `<ul class="ch-lista">${publicos.filter((c) => !c.yoSoy).map((c) => `<li><button type="button" class="ch-fila" data-a="unirme" data-id="${esc(c.id)}"><span class="ch-fn"><b>#${esc(c.nombre)}</b> <small>${c.miembros} personas</small></span></button></li>`).join('') || '<li class="ch-vacio">Ya estás en todos los canales públicos.</li>'}</ul>`;
    return `<div class="ch-cab"><span class="ch-tit"><button type="button" class="sg-btn" data-a="atras" aria-label="Volver a la lista">←</button><h2 id="ch-t">Nuevo</h2></span><button type="button" class="sg-btn" data-a="x" aria-label="Cerrar el chat">✕</button></div><div class="ch-tabs">${tabs}</div>${cuerpo}<p class="nb-msg" role="status">${esc(msg)}</p>`;
  }

  /** Dos paneles a lo ancho; en el teléfono, uno solo (lista o hilo). El borrador de lo que se escribe y el desplazamiento sobreviven al repintado. */
  function pintar({ abajo = false } = {}) {
    if (!panel) return;
    const ta = panel.querySelector('#ch-texto'); if (ta && canal) borradores[canal.id] = ta.value;
    const h0 = panel.querySelector('#ch-hilo'), pegado = !h0 || h0.scrollHeight - h0.scrollTop - h0.clientHeight < 60, enfocado = ta && document.activeElement === ta;
    const izq = listaHTML(), der = vista === 'hilo' && canal ? hiloHTML() : vista === 'nuevo' ? nuevoHTML() : '<div class="ch-cab"><h2 id="ch-t">&nbsp;</h2></div><p class="ch-vacio ch-elige">Elige una conversación.</p>';
    panel.className = `ch-panel ver-${vista === 'lista' ? 'lista' : 'otro'}`;
    panel.innerHTML = `<section class="ch-izq" aria-label="Conversaciones">${vista === 'lista' || !movil() ? izq : ''}</section><section class="ch-der" aria-label="Conversación">${vista === 'lista' && movil() ? '' : der}</section>`;
    const t2 = panel.querySelector('#ch-texto'); if (t2 && canal) { t2.value = borradores[canal.id] || ''; if (enfocado) t2.focus(); }
    const h = panel.querySelector('#ch-hilo'); if (h && (abajo && pegado)) h.scrollTop = h.scrollHeight;
  }

  async function abrir() {
    abierto = true; vista = 'lista'; canal = null; msg = '';
    panel = document.createElement('div'); panel.id = 'nbChat'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'ch-t'); panel.tabIndex = -1;
    document.body.appendChild(panel); pintarBoton(); pintar(); panel.focus();
    panel.addEventListener('click', alClic); panel.addEventListener('submit', alEnviar);
    panel.addEventListener('input', (e) => { if (e.target.id === 'ch-texto' && canal) borradores[canal.id] = e.target.value; });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !movil() && e.target.id === 'ch-texto') { e.preventDefault(); panel.querySelector('.ch-form')?.requestSubmit(); } });
    document.addEventListener('keydown', alTecla);
    await cargarResumen();
  }
  function cerrar() { clearTimeout(tHilo); document.removeEventListener('keydown', alTecla); abierto = false; panel?.remove(); panel = null; canal = null; pintarBoton(); boton?.focus(); }
  function alTecla(e) { if (e.key !== 'Escape' || !abierto) return; e.stopPropagation(); if (vista !== 'lista' && movil()) { vista = 'lista'; clearTimeout(tHilo); pintar(); } else cerrar(); }

  async function alClic(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, id = b.dataset.id;
    try {
      if (a === 'x') return cerrar();
      if (a === 'atras') { vista = 'lista'; clearTimeout(tHilo); pintar(); cargarResumen(); return; }
      if (a === 'abrir') return abrirCanal(res.canales.find((c) => c.id === id));
      if (a === 'nuevo') { vista = 'nuevo'; nuevoTab = 'directo'; msg = ''; pintar(); if (!personas) personas = (await api('/api/chat/personas')).personas; pintar(); return; }
      if (a === 'tab') { nuevoTab = b.dataset.k; msg = ''; pintar(); if (nuevoTab === 'unirme') { publicos = (await api('/api/chat/canales')).publicos; pintar(); } return; }
      if (a === 'directo') return abrirDirecto(id);
      if (a === 'unirme') { await api(`/api/chat/canales/${id}/miembros`, { metodo: 'POST', cuerpo: {} }); await cargarResumen(); const c = res.canales.find((x) => x.id === id); return c ? abrirCanal(c) : undefined; }
      if (a === 'silenciar') { await api(`/api/chat/canales/${canal.id}/silenciar`, { metodo: 'POST', cuerpo: { silenciado: !canal.silenciado } }); await cargarResumen(); canal = res.canales.find((x) => x.id === canal.id) || canal; return pintar(); }
      if (a === 'editar') { const m = msgs.find((x) => String(x.id) === id); const nuevo = window.prompt('Editar el mensaje', m?.cuerpo || ''); if (nuevo != null && nuevo.trim()) { await api(`/api/chat/mensajes/${id}`, { metodo: 'PATCH', cuerpo: { cuerpo: nuevo } }); await cargarHilo(canal.id, { marcar: false }); pintar(); } return; }
      if (a === 'borrar') { if (window.confirm('¿Borrar este mensaje?')) { await api(`/api/chat/mensajes/${id}`, { metodo: 'DELETE' }); await cargarHilo(canal.id, { marcar: false }); pintar(); } return; }
    } catch (err) { msg = err.message; pintar(); }
  }

  async function alEnviar(e) {
    e.preventDefault(); const f = e.target;
    if (f.classList.contains('ch-form')) {
      const ta = f.querySelector('textarea'), cuerpo = ta.value.trim(), btn = f.querySelector('button'); if (!cuerpo) return;
      btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      try { await api(`/api/chat/canales/${canal.id}/mensajes`, { metodo: 'POST', cuerpo: { cuerpo } }); borradores[canal.id] = ''; ta.value = ''; msg = ''; await cargarHilo(canal.id); pintar({ abajo: true }); panel.querySelector('#ch-texto')?.focus(); }
      catch (err) { msg = err.message; pintar(); }
      return;
    }
    if (f.classList.contains('ch-nuevo')) {
      const nombre = f.querySelector('#ch-nom').value, privado = f.querySelector('#ch-priv').checked, miembros = [...f.querySelectorAll('input[name=m]:checked')].map((x) => x.value);
      try { const c = await api('/api/chat/canales', { metodo: 'POST', cuerpo: { nombre, privado, miembros } }); await cargarResumen(); const x = res.canales.find((k) => k.id === c.id); if (x) abrirCanal(x); }
      catch (err) { msg = err.message; pintar(); }
    }
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) return; cargarResumen(); if (abierto && vista === 'hilo' && canal) { cargarHilo(canal.id); sondearHilo(); } });
  N.chat = { abrir, cerrar, recargar: cargarResumen };
  cargarResumen();
})();

/* C1 — el chat interno del equipo: lista, hilo, directos, canales y no leídos (solo en la nube; paquete aparte, la página no crece). Detrás de `chat.config.activo` (apagado: no pinta nada).
   SIN sockets todavía (C2): sondeo prudente (resumen cada 60 s, el hilo abierto cada 10 s, nada con la pestaña oculta) y puesta al día en `visibilitychange`.
   Privacidad: aquí solo se pinta lo que la API devuelve a ESTA cuenta; todo texto se escapa con esc() (nombres, canales, mensajes); los enlaces solo http(s) y con rel="noopener noreferrer". */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N || N.chat) return;
  const { api, esc } = N;
  const RESUMEN_MS = 60_000, HILO_MS = 10_000, APAGADO_MS = 300_000, RESUMEN_VIVO_MS = 180_000, HILO_VIVO_MS = 30_000, ESCRIBE_CADA_MS = 3000, ESCRIBE_DURA_MS = 6000; // con el socket vivo el sondeo solo es la red de seguridad
  let activo = false, abierto = false, vista = 'lista', res = { canales: [], total: 0 }, canal = null, msgs = [], viejos = [], hayMas = false, hayMasViejos = false, hiloListo = false, cargandoViejos = false, edTexto = null, enviando = false, componiendo = false, repintarLuego = false, editando = null, borrando = null, firma = '', personas = null, publicos = null, nuevoTab = 'directo', msg = '';
  let boton = null, panel = null, tRes = 0, tHilo = 0, tEscribe = 0, ultimoVisto = 0, vivo = null, alerta = null, ultimoEscribi = 0, escribe = null;
  const enVivo = () => { try { return N.conexion?.() === 'conectado'; } catch { return false; } };
  const borradores = {};
  const todos = () => [...viejos, ...msgs.filter((m) => !viejos.some((v) => v.id === m.id))];
  const firmaDe = (l) => l.map((m) => `${m.id}|${m.editado ? 1 : 0}|${m.borrado ? 1 : 0}`).join(',');
  const movil = () => document.body.classList.contains('movil') || matchMedia('(max-width: 820px)').matches;
  const soloLee = () => N.yo()?.rol === 'lectura';
  const hora = (t) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const dia = (t) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  const tipoNombre = (c) => (c.tipo === 'directo' ? c.nombre : '#' + c.nombre);
  /** Texto plano → HTML seguro: escapado, saltos de línea y enlaces http(s) (lo único que se adorna). */
  const cuerpoHTML = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`).replace(/\n/g, '<br>');

  /** Regiones EN VIVO persistentes (fuera del repintado, que las vaciaría): lo nuevo se anuncia sin su texto y los errores salen como alerta. */
  function regiones() {
    if (vivo) return;
    vivo = document.createElement('div'); vivo.className = 'ch-oculto'; vivo.setAttribute('role', 'status'); vivo.setAttribute('aria-live', 'polite');
    alerta = document.createElement('div'); alerta.className = 'ch-oculto'; alerta.setAttribute('role', 'alert');
    document.body.append(vivo, alerta);
  }
  const anunciar = (t) => { if (vivo) { vivo.textContent = ''; setTimeout(() => { vivo.textContent = t; }, 50); } };
  const fallar = (t) => { msg = t; if (alerta) { alerta.textContent = ''; setTimeout(() => { alerta.textContent = t; }, 50); } };

  /** DÓNDE VIVE EL BOTÓN. Nunca flota: la oficina ya tiene dos sitios para una herramienta y el chat usa el que toque.
   *   · teléfono  → la cabecera, justo antes de la lupa (`.mv-bar-der`), como el ⚠ de aprobaciones;
   *   · escritorio → el dock de la barra de arriba (`#topdock`), como el Estudio o el Calendario.
   *  Antes era `position: fixed` con medidas a ojo y se montaba encima de las tarjetas. La versión móvil crea y destruye su
   *  armazón al cruzar los 820 px, así que esto se vuelve a mirar en cada repintado y el botón se muda solo. */
  function colocar() {
    const movil = document.body.classList.contains('movil');
    const cabecera = movil ? document.querySelector('#mvRoot .mv-bar-der') : null;
    const lupa = cabecera?.querySelector('.mv-buscar');
    const dock = movil ? null : document.querySelector('#topdock');
    const casa = cabecera || dock;
    if (!casa) { if (boton.parentNode !== document.body) document.body.appendChild(boton); boton.className = 'ch-btn ch-suelto'; return; }
    boton.className = movil ? 'ch-btn mv-ic' : 'ch-btn tb-ic';
    if (boton.parentNode === casa && (!lupa || boton.nextElementSibling === lupa)) return; // ya está en su sitio
    if (lupa) casa.insertBefore(boton, lupa); else casa.appendChild(boton);
  }

  function pintarBoton() {
    if (!activo) { boton?.remove(); boton = null; return; }
    if (!boton) { boton = document.createElement('button'); boton.type = 'button'; boton.id = 'nbChatBtn'; boton.setAttribute('aria-haspopup', 'dialog'); boton.addEventListener('click', () => (abierto ? cerrar() : abrir())); }
    colocar();
    const n = res.total;
    boton.setAttribute('aria-label', n ? `Chat del equipo: ${n} sin leer` : 'Chat del equipo'); boton.setAttribute('aria-expanded', String(abierto));
    boton.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.6a3.1 3.1 0 0 1 0 5.8M18.5 14.3c1.6.7 2.5 2.4 2.5 5.2"/></svg>${n ? `<span class="ch-n" aria-hidden="true">${n > 9 ? '9+' : n}</span>` : ''}`;
  }

  async function cargarResumen() {
    clearTimeout(tRes);
    if (!document.hidden) { try { const d = await api('/api/chat/resumen'); activo = d.activo === true; res = { canales: d.canales || [], total: d.total || 0 }; } catch { /* sin red: se reintenta */ } }
    pintarBoton(); if (abierto && vista === 'lista') pintar();
    tRes = setTimeout(cargarResumen, activo ? (enVivo() ? RESUMEN_VIVO_MS : RESUMEN_MS) : APAGADO_MS);
  }

  async function cargarHilo(id, { marcar = true } = {}) {
    try {
      const d = await api(`/api/chat/canales/${id}/mensajes?limite=50`);
      if (!canal || canal.id !== id) return;
      const antes = firma, ultimoAntes = msgs.at(-1)?.id ?? 0;
      msgs = d.mensajes; hayMas = d.hayMas && !viejos.length; if (!viejos.length) hayMasViejos = d.hayMas;
      firma = firmaDe(todos());
      const ajenos = msgs.filter((m) => m.id > ultimoAntes && !m.mio && !m.borrado).length;
      if (hiloListo && ajenos) anunciar(`${ajenos === 1 ? '1 mensaje nuevo' : ajenos + ' mensajes nuevos'} en ${tipoNombre(canal)}`);
      hiloListo = true;
      if (firma !== antes) pintar({ abajo: true }); // cualquier cambio (mensaje nuevo, editado o borrado por otra persona), no solo el último id
      if (marcar && msgs.length && msgs.at(-1).id > ultimoVisto) { ultimoVisto = msgs.at(-1).id; await api(`/api/chat/canales/${id}/leido`, { metodo: 'POST', cuerpo: { hasta: ultimoVisto } }).catch(() => {}); cargarResumen(); }
    } catch (e) { fallar(e.message); pintar(); }
  }
  async function cargarViejos() {
    const primero = todos()[0]; if (!primero || !canal || cargandoViejos) return;
    cargandoViejos = true; const id = canal.id;
    try {
      const d = await api(`/api/chat/canales/${id}/mensajes?limite=50&antes=${primero.id}`);
      if (!canal || canal.id !== id) return;
      const ya = new Set(todos().map((m) => m.id)); viejos = [...d.mensajes.filter((m) => !ya.has(m.id)), ...viejos]; hayMasViejos = d.hayMas; firma = firmaDe(todos()); pintar({ anclar: true });
    } catch (e) { fallar(e.message); pintar(); } finally { cargandoViejos = false; }
  }
  function sondearHilo() { clearTimeout(tHilo); if (!abierto || vista !== 'hilo' || !canal) return; tHilo = setTimeout(async () => { if (!document.hidden) await cargarHilo(canal.id); sondearHilo(); }, enVivo() ? HILO_VIVO_MS : HILO_MS); }

  async function abrirCanal(c) {
    canal = c; msgs = []; viejos = []; hayMas = false; hayMasViejos = false; firma = ''; hiloListo = false; editando = null; borrando = null; ultimoVisto = 0; vista = 'hilo'; msg = ''; pintar();
    (panel?.querySelector('#ch-texto') || panel?.querySelector('.ch-der h2'))?.focus(); // el foco sigue a la persona al abrir una conversación (el repintado lo conserva)
    await cargarHilo(c.id); sondearHilo();
  }
  async function abrirDirecto(con) {
    try { const d = await api('/api/chat/directo', { metodo: 'POST', cuerpo: { con } }); await cargarResumen(); const c = res.canales.find((x) => x.id === d.id); if (c) abrirCanal(c); } catch (e) { fallar(e.message); pintar(); }
  }

  const filaCanal = (c) => `<li><button type="button" class="ch-fila${canal?.id === c.id ? ' on' : ''}" data-a="abrir" data-id="${esc(c.id)}"><span class="ch-fn"><b>${esc(tipoNombre(c))}</b>${c.privado && c.tipo !== 'directo' ? ' <small>privado</small>' : ''}${c.silenciado ? ' <small>silenciado</small>' : ''}</span><span class="ch-prev">${c.ultimo ? esc((c.ultimo.propio ? 'Tú: ' : '') + c.ultimo.texto) : '<i>Sin mensajes</i>'}</span>${c.noLeidos ? `<span class="ch-bad" aria-label="${c.noLeidos} sin leer${c.menciones ? ', ' + c.menciones + ' te mencionan' : ''}">${c.noLeidos > 99 ? '99+' : c.noLeidos}${c.menciones ? ' @' : ''}</span>` : ''}</button></li>`;

  function listaHTML() {
    const dir = res.canales.filter((c) => c.tipo === 'directo'), can = res.canales.filter((c) => c.tipo !== 'directo');
    return `<div class="ch-cab"><h2 id="ch-t">Chat</h2><span>${soloLee() ? '' : '<button type="button" class="sg-btn" data-a="nuevo">+ Nuevo</button> '}<button type="button" class="sg-btn" data-a="x" aria-label="Cerrar el chat">✕</button></span></div>
      <h3>Canales</h3><ul class="ch-lista">${can.map(filaCanal).join('') || '<li class="ch-vacio">Todavía no hay canales.</li>'}</ul>
      <h3>Directos</h3><ul class="ch-lista">${dir.map(filaCanal).join('') || '<li class="ch-vacio">Escríbele a alguien con «+ Nuevo».</li>'}</ul>`;
  }

  function mensajeHTML(m, i) {
    const prev = todos()[i - 1], nuevoDia = !prev || dia(prev.at) !== dia(m.at), junto = prev && !nuevoDia && prev.deId === m.deId && m.at - prev.at < 5 * 60_000 && !prev.borrado;
    const sep = nuevoDia ? `<div class="ch-dia"><span>${esc(dia(m.at))}</span></div>` : '';
    if (m.borrado) return `${sep}<div class="ch-m ch-borrado"><i>Mensaje borrado</i></div>`;
    const puedeBorrar = m.mio || (N.yo()?.rol === 'admin' && !canal.privado && canal.tipo !== 'directo');
    const acc = borrando === m.id ? `<span class="ch-acc" role="group" aria-label="Confirmar">¿Borrar? <button type="button" data-a="borrar-si" data-id="${m.id}">Sí, borrar</button><button type="button" data-a="borrar-no" data-id="${m.id}">No</button></span>`
      : puedeBorrar ? `<span class="ch-acc">${m.mio ? `<button type="button" data-a="editar" data-id="${m.id}">Editar</button>` : ''}<button type="button" data-a="borrar" data-id="${m.id}">Borrar</button></span>` : '';
    if (editando === m.id) return `${sep}<div class="ch-m mio" data-m="${m.id}"><form class="ch-edit"><label class="ch-oculto" for="ch-ed">Editar el mensaje</label><textarea id="ch-ed" rows="3" maxlength="4200">${esc(m.cuerpo)}</textarea><span class="ch-acc"><button type="submit" class="sg-btn pri">Guardar</button> <button type="button" class="sg-btn" data-a="editar-no">Cancelar</button></span></form></div>`;
    return `${sep}<div class="ch-m${m.mio ? ' mio' : ''}${junto ? ' junto' : ''}" data-m="${m.id}">${junto ? '' : `<div class="ch-quien"><b>${esc(m.de)}</b> <small>${esc(hora(m.at))}${m.editado ? ' · editado' : ''}</small></div>`}<div class="ch-txt">${cuerpoHTML(m.cuerpo)}</div>${acc}</div>`;
  }

  /** «Dani está escribiendo…» (6 s): el nombre sale de lo que la página ya sabe (presencia o autores del hilo); nunca del evento, que solo trae un id. */
  function nombreDe(uid) { const p = (N.presentes?.() || []).find((x) => x.userId === uid); return p?.nombre || todos().find((m) => m.deId === uid)?.de || 'Alguien'; }
  const escribePlano = () => (escribe && escribe.canal === canal?.id && escribe.hasta > Date.now() ? `${nombreDe(escribe.de)} está escribiendo…` : '');
  const escribeTxt = () => esc(escribePlano());
  function marcaEscribe(d) {
    escribe = { canal: d.canal, de: d.de, hasta: Date.now() + ESCRIBE_DURA_MS };
    const el = panel?.querySelector('#ch-escribe'); if (el) el.textContent = escribePlano(); // sin repintar el hilo
    clearTimeout(tEscribe); tEscribe = setTimeout(() => { const e2 = panel?.querySelector('#ch-escribe'); if (e2) e2.textContent = ''; }, ESCRIBE_DURA_MS + 50);
  }
  function hiloHTML() {
    const c = canal;
    return `<div class="ch-cab"><span class="ch-tit">${movil() ? '<button type="button" class="sg-btn" data-a="atras" aria-label="Volver a la lista">←</button>' : ''}<h2 id="ch-t" tabindex="-1">${esc(tipoNombre(c))}</h2></span><span>${c.tipo !== 'directo' ? `<button type="button" class="sg-btn" data-a="silenciar" aria-pressed="${c.silenciado ? 'true' : 'false'}">${c.silenciado ? 'Silenciado' : 'Silenciar'}</button> ` : ''}<button type="button" class="sg-btn" data-a="x" aria-label="Cerrar el chat">✕</button></span></div>
      <div class="ch-hilo" id="ch-hilo" tabindex="0" aria-label="Mensajes de ${esc(tipoNombre(c))}">${hayMasViejos ? '<p class="ch-vacio"><button type="button" class="sg-btn" data-a="viejos">Cargar mensajes anteriores</button></p>' : ''}${todos().map(mensajeHTML).join('') || '<p class="ch-vacio">Aquí empieza la conversación.</p>'}</div>
      ${soloLee() ? '<p class="ch-vacio ch-solo">Con acceso de lectura puedes leer este canal, no escribir.</p>' : `<form class="ch-form"><label for="ch-texto" class="ch-oculto">Escribir en ${esc(tipoNombre(c))}</label><textarea id="ch-texto" rows="2" maxlength="4200" placeholder="Escribe un mensaje…"></textarea><button type="submit" class="sg-btn pri">Enviar</button></form>`}
      <p class="ch-escribe" id="ch-escribe" aria-hidden="true">${escribeTxt()}</p><p class="nb-msg" aria-hidden="true">${esc(msg)}</p>`;
  }

  function nuevoHTML() {
    const tabs = [['directo', 'Directo'], ['canal', 'Canal nuevo'], ['unirme', 'Unirme']].map(([k, t]) => `<button type="button" class="sg-btn${nuevoTab === k ? ' pri' : ''}" data-a="tab" data-k="${k}" aria-pressed="${nuevoTab === k}">${t}</button>`).join(' ');
    let cuerpo = '<p class="ch-vacio">Cargando…</p>';
    if (nuevoTab === 'directo' && personas) cuerpo = soloLee() ? '<p class="ch-vacio">Con acceso de lectura no se abren chats directos.</p>' : `<ul class="ch-lista">${personas.map((p) => `<li><button type="button" class="ch-fila" data-a="directo" data-id="${esc(p.id)}"><span class="ch-fn"><b>${esc(p.nombre)}</b></span></button></li>`).join('') || '<li class="ch-vacio">No hay a quién escribirle todavía.</li>'}</ul>`;
    if (nuevoTab === 'canal') cuerpo = soloLee() ? '<p class="ch-vacio">Con acceso de lectura no se crean canales.</p>' : `<form class="ch-nuevo"><label for="ch-nom">Nombre del canal</label><input id="ch-nom" maxlength="40" autocomplete="off"><label class="ch-chk"><input type="checkbox" id="ch-priv"> Privado (solo quienes añadas)</label>${personas ? `<fieldset><legend>Añadir gente (hasta 10)</legend>${personas.map((p) => `<label class="ch-chk"><input type="checkbox" name="m" value="${esc(p.id)}"> ${esc(p.nombre)}</label>`).join('')}</fieldset>` : ''}<button type="submit" class="sg-btn pri">Crear canal</button></form>`;
    if (nuevoTab === 'unirme' && publicos) cuerpo = `<ul class="ch-lista">${publicos.filter((c) => !c.yoSoy).map((c) => `<li><button type="button" class="ch-fila" data-a="unirme" data-id="${esc(c.id)}"><span class="ch-fn"><b>#${esc(c.nombre)}</b> <small>${c.miembros} personas</small></span></button></li>`).join('') || '<li class="ch-vacio">Ya estás en todos los canales públicos.</li>'}</ul>`;
    return `<div class="ch-cab"><span class="ch-tit"><button type="button" class="sg-btn" data-a="atras" aria-label="Volver a la lista">←</button><h2 id="ch-t">Nuevo</h2></span><button type="button" class="sg-btn" data-a="x" aria-label="Cerrar el chat">✕</button></div><div class="ch-tabs">${tabs}</div>${cuerpo}<p class="nb-msg" aria-hidden="true">${esc(msg)}</p>`;
  }

  /** Dos paneles a lo ancho; en el teléfono, uno solo (lista o hilo). El borrador de lo que se escribe y el desplazamiento sobreviven al repintado. */
  function pintar({ abajo = false, anclar = false } = {}) {
    if (!panel) return;
    if (componiendo) { repintarLuego = true; return; } // no se toca la caja mientras se compone (IME)
    const ta = panel.querySelector('#ch-texto'); if (ta && canal) borradores[canal.id] = ta.value;
    const act = document.activeElement, dentro = act && panel.contains(act), foco = dentro ? { id: act.id || null, a: act.dataset?.a || null, did: act.dataset?.id || null, ini: act.selectionStart, fin: act.selectionEnd, texto: act.id === 'ch-ed' ? act.value : null } : null;
    const h0 = panel.querySelector('#ch-hilo'), pegado = !h0 || h0.scrollHeight - h0.scrollTop - h0.clientHeight < 60, topAntes = h0?.scrollTop ?? 0, altoAntes = h0?.scrollHeight ?? 0;
    const izq = listaHTML(), der = vista === 'hilo' && canal ? hiloHTML() : vista === 'nuevo' ? nuevoHTML() : '<div class="ch-cab"><h2 id="ch-t" tabindex="-1">&nbsp;</h2></div><p class="ch-vacio ch-elige">Elige una conversación.</p>';
    panel.className = `ch-panel ver-${vista === 'lista' ? 'lista' : 'otro'}`;
    panel.innerHTML = `<section class="ch-izq" aria-label="Conversaciones">${vista === 'lista' || !movil() ? izq : ''}</section><section class="ch-der" aria-label="Conversación">${vista === 'lista' && movil() ? '' : der}</section>`;
    const t2 = panel.querySelector('#ch-texto'); if (t2 && canal) t2.value = borradores[canal.id] || '';
    const ed = panel.querySelector('#ch-ed'); if (ed) { if (edTexto != null) ed.value = edTexto; else if (foco?.texto != null) ed.value = foco.texto; }
    if (foco) { // el foco vuelve a lo que lo tenía: por id (cajas) o por acción y dato (botones)
      const el = (foco.id && panel.querySelector('#' + foco.id)) || (foco.a && panel.querySelector(`[data-a="${foco.a}"]${foco.did ? `[data-id="${foco.did}"]` : ''}`)) || panel.querySelector('#ch-texto');
      if (el) { el.focus(); if (foco.ini != null && el.setSelectionRange) try { el.setSelectionRange(foco.ini, foco.fin); } catch { /* tipos sin selección */ } }
    }
    const h = panel.querySelector('#ch-hilo');
    if (h) { if (abajo && pegado) h.scrollTop = h.scrollHeight; else h.scrollTop = anclar ? topAntes + (h.scrollHeight - altoAntes) : topAntes; } // quien lee más arriba se queda donde estaba; al cargar anteriores, anclado al mismo mensaje
  }

  async function abrir() {
    if (abierto && panel) { panel.focus(); return; }
    abierto = true; vista = 'lista'; canal = null; msg = ''; componiendo = false; repintarLuego = false; edTexto = null;
    panel = document.createElement('div'); panel.id = 'nbChat'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'ch-t'); panel.tabIndex = -1;
    document.body.appendChild(panel); pintarBoton(); pintar(); panel.focus();
    panel.addEventListener('click', alClic); panel.addEventListener('submit', alEnviar);
    panel.addEventListener('input', (e) => { if (e.target.id === 'ch-texto' && canal) { borradores[canal.id] = e.target.value; if (e.target.value && enVivo() && Date.now() - ultimoEscribi > ESCRIBE_CADA_MS) { ultimoEscribi = Date.now(); api(`/api/chat/canales/${canal.id}/escribiendo`, { metodo: 'POST', cuerpo: {} }).catch(() => {}); } } if (e.target.id === 'ch-ed') edTexto = e.target.value; });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && !movil() && e.target.id === 'ch-texto') { e.preventDefault(); panel.querySelector('.ch-form')?.requestSubmit(); } });
    panel.addEventListener('compositionstart', () => { componiendo = true; });
    panel.addEventListener('compositionend', () => { componiendo = false; if (repintarLuego) { repintarLuego = false; pintar(); } });
    document.addEventListener('keydown', alTecla);
    await cargarResumen();
  }
  function cerrar() { componiendo = false; repintarLuego = false; edTexto = null; clearTimeout(tHilo); document.removeEventListener('keydown', alTecla); abierto = false; panel?.remove(); panel = null; canal = null; pintarBoton(); boton?.focus(); }
  function alTecla(e) { if (e.key !== 'Escape' || !abierto || !panel) return; const f = document.activeElement; if (f && f !== document.body && !panel.contains(f) && f !== boton) return; /* otra ventana tiene el foco: no se cierra el chat */ e.stopPropagation(); if (vista !== 'lista' && movil()) { vista = 'lista'; clearTimeout(tHilo); pintar(); } else cerrar(); }

  async function alClic(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, id = b.dataset.id;
    try {
      if (a === 'x') return cerrar();
      if (a === 'atras') { vista = 'lista'; clearTimeout(tHilo); pintar(); cargarResumen(); return; }
      if (a === 'abrir') return abrirCanal(res.canales.find((c) => c.id === id));
      if (a === 'viejos') return cargarViejos();
      if (a === 'nuevo') { if (soloLee()) return; vista = 'nuevo'; nuevoTab = 'directo'; msg = ''; pintar(); if (!personas) personas = (await api('/api/chat/personas')).personas; pintar(); return; }
      if (a === 'tab') { nuevoTab = b.dataset.k; msg = ''; pintar(); if (nuevoTab === 'unirme') { publicos = (await api('/api/chat/canales')).publicos; pintar(); } return; }
      if (a === 'directo') return abrirDirecto(id);
      if (a === 'unirme') { await api(`/api/chat/canales/${id}/miembros`, { metodo: 'POST', cuerpo: {} }); await cargarResumen(); const c = res.canales.find((x) => x.id === id); return c ? abrirCanal(c) : undefined; }
      if (a === 'silenciar') { await api(`/api/chat/canales/${canal.id}/silenciar`, { metodo: 'POST', cuerpo: { silenciado: !canal.silenciado } }); await cargarResumen(); canal = res.canales.find((x) => x.id === canal.id) || canal; return pintar(); }
      if (a === 'editar') { edTexto = null; editando = Number(id); borrando = null; pintar(); return panel.querySelector('#ch-ed')?.focus(); }
      if (a === 'editar-no') { editando = null; edTexto = null; return pintar(); }
      if (a === 'borrar') { borrando = Number(id); editando = null; return pintar(); }
      if (a === 'borrar-no') { borrando = null; return pintar(); }
      if (a === 'borrar-si') { borrando = null; await api(`/api/chat/mensajes/${id}`, { metodo: 'DELETE' }); await cargarHilo(canal.id, { marcar: false }); return pintar(); }
    } catch (err) { fallar(err.message); pintar(); }
  }

  async function alEnviar(e) {
    e.preventDefault(); const f = e.target;
    if (f.classList.contains('ch-edit')) {
      const cuerpo = f.querySelector('textarea').value.trim(); if (!cuerpo) return; const id = editando;
      try { await api(`/api/chat/mensajes/${id}`, { metodo: 'PATCH', cuerpo: { cuerpo } }); editando = null; edTexto = null; await cargarHilo(canal.id, { marcar: false }); pintar(); } catch (err) { fallar(err.message); pintar(); }
      return;
    }
    if (f.classList.contains('ch-form')) {
      if (enviando) return; // un segundo Enter mientras el primero viaja no manda otro
      const ta = f.querySelector('textarea'), cuerpo = ta.value.trim(), btn = f.querySelector('button'), id = canal.id; if (!cuerpo) return;
      enviando = true; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); ta.value = ''; borradores[id] = ''; // se vacía ANTES de viajar; si falla, se devuelve
      try { await api(`/api/chat/canales/${id}/mensajes`, { metodo: 'POST', cuerpo: { cuerpo } }); msg = ''; await cargarHilo(id); pintar({ abajo: true }); }
      catch (err) { // lo que se escribió mientras el POST iba no se pisa: queda después del mensaje que no salió
        const caja = panel?.querySelector('#ch-texto'), nuevo = (caja && canal?.id === id ? caja.value : borradores[id]) || '';
        borradores[id] = cuerpo + (nuevo ? '\n' + nuevo : ''); if (caja && canal?.id === id) caja.value = borradores[id]; fallar(err.message); pintar();
      }
      finally { enviando = false; }
      return;
    }
    if (f.classList.contains('ch-nuevo')) {
      const nombre = f.querySelector('#ch-nom').value, privado = f.querySelector('#ch-priv').checked, miembros = [...f.querySelectorAll('input[name=m]:checked')].map((x) => x.value);
      try { const c = await api('/api/chat/canales', { metodo: 'POST', cuerpo: { nombre, privado, miembros } }); await cargarResumen(); const x = res.canales.find((k) => k.id === c.id); if (x) abrirCanal(x); }
      catch (err) { fallar(err.message); pintar(); }
    }
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) return; cargarResumen(); if (abierto && vista === 'hilo' && canal) { cargarHilo(canal.id); sondearHilo(); } });
  /** El aviso en vivo trae SOLO ids: ante un mensaje o un cambio, la página pide el contenido con su sesión (D1 decide qué puede ver). */
  let tRefresco = 0;
  window.addEventListener('ao:chat', (e) => {
    const d = e.detail || {}; if (!activo || document.hidden) return;
    if (d.evento === 'escribiendo') { if (abierto && vista === 'hilo' && canal?.id === d.canal) marcaEscribe(d); return; }
    clearTimeout(tRefresco); tRefresco = setTimeout(() => { cargarResumen(); if (abierto && vista === 'hilo' && canal?.id === d.canal) { if (d.evento === 'mensaje' && escribe?.de === d.de) escribe = null; cargarHilo(d.canal); } }, 150); // se juntan las ráfagas
  });
  window.addEventListener('ao:chat-conectado', () => { cargarResumen(); if (abierto && vista === 'hilo' && canal) cargarHilo(canal.id); }); // la puesta al día al volver el socket
  N.chat = { abrir, cerrar, recargar: cargarResumen };
  // La versión móvil crea y destruye su armazón al cruzar los 820 px (y `body.movil` cambia con ella): el botón se muda en ese
  // momento, no en el próximo sondeo, que puede tardar segundos. Observar la clase del body cuesta nada.
  try { new MutationObserver(() => { if (boton) colocar(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch { /* un navegador sin observador sigue mudándose en cada sondeo */ }

  regiones(); cargarResumen();
})();

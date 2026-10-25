/* Agents Office en la nube — lo que SOLO existe con Worker: presencia en vivo, quién está y en qué área trabaja, mi perfil (foto, nombre, contraseña),
   el equipo y sus invitaciones (Ajustes → Mi perfil / Equipo) y el aviso a la página de que otra persona cambió algo (`ao:cambio`).
   El Worker lo inyecta al servir la oficina (worker/lib/paginas.js). La oficina local no lo lleva: sin /api/live, no pinta nada.
   El socket es un atajo y D1 es la verdad: si se cae, la página sigue con su sondeo de siempre. */
(() => {
  'use strict';
  if (window.__nube) return; window.__nube = true;
  const PESTANA = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).slice(0, 24); // identifica ESTA pestaña: ella descarta el eco de sus propios cambios
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iniciales = (n) => (String(n).trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('') || '?').toUpperCase();
  const $ = (s, r = document) => r.querySelector(s);

  // Toda escritura a /api/ lleva el id de la pestaña (el Worker lo devuelve en el evento `cambio`).
  const fetch0 = window.fetch.bind(window);
  window.fetch = (u, o = {}) => {
    try {
      const esReq = typeof Request !== 'undefined' && u instanceof Request;
      const url = new URL(esReq ? u.url : String(u), location.href);
      const metodo = String(o.method || (esReq ? u.method : 'GET')).toUpperCase();
      if (url.origin === location.origin && url.pathname.startsWith('/api/') && metodo !== 'GET') {
        // las cabeceras que ya traía (las de un Request pasado como primer argumento, o las de `init`) se conservan: solo se SUMA la de la pestaña
        const h = new Headers(o.headers ?? (esReq ? u.headers : undefined)); h.set('X-Pestana', PESTANA);
        o = { ...o, headers: h };
      }
    } catch { /* una URL rara: se deja pasar tal cual */ }
    return fetch0(u, o);
  };
  async function api(ruta, { metodo = 'GET', cuerpo, bytes } = {}) {
    const r = await fetch0(ruta, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}), 'X-Pestana': PESTANA }, body: bytes ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined) }).catch(() => { throw new Error('Sin conexión con la oficina. Revisa tu internet e inténtalo otra vez.'); });
    if (r.status === 401) { location.reload(); throw new Error('Tu sesión terminó.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
    return d;
  }

  // ---------- estado ----------
  let yo = null, equipo = { miembros: [], invitaciones: [] }, presentes = [], conexion = 'conectando';
  const foto = (id, v) => (v ? `/api/equipo/${id}/foto?v=${encodeURIComponent(v)}` : '');
  const miembro = (id) => equipo.miembros.find((m) => m.id === id);
  /** La presencia manda en quién está y dónde; el equipo (D1) manda en el nombre, el color y la foto actuales. */
  const persona = (p) => { const m = miembro(p.userId); return { ...p, nombre: m?.nombre ?? p.nombre, color: m?.color ?? p.color, foto: m ? m.foto : p.foto }; };
  const etiquetaDe = (p) => `${p.nombre} · ${p.etiqueta || 'La oficina'}`;

  function avatar(p, clase = '') {
    const f = foto(p.userId ?? p.id, p.foto);
    return `<span class="nb-av ${clase}" style="--c:${esc(p.color || '#555')}" title="${esc(p.etiqueta !== undefined ? etiquetaDe(p) : p.nombre)}" role="img" aria-label="${esc(p.etiqueta !== undefined ? etiquetaDe(p) : p.nombre)}">${f ? `<img src="${esc(f)}" alt="" loading="lazy" decoding="async">` : esc(iniciales(p.nombre))}${p.etiqueta !== undefined ? '<i class="nb-on" aria-hidden="true"></i>' : ''}</span>`;
  }

  // ---------- la barra: quién está + mi cuenta ----------
  let caja = null, menu = null;
  function montarBarra() {
    const dock = $('#topdock'); if (!dock || caja) return !!caja;
    caja = document.createElement('div'); caja.id = 'nubeBarra'; caja.setAttribute('data-shell', '');
    caja.innerHTML = '<button type="button" id="nubeEquipo" class="nb-grupo" hidden></button><button type="button" id="nubeYo" class="nb-yo" aria-haspopup="menu" aria-expanded="false"></button><span class="nb-sr" id="nubeEstado" role="status" aria-live="polite"></span>';
    dock.parentNode.insertBefore(caja, dock);
    menu = document.createElement('div'); menu.id = 'nubeMenu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Mi cuenta'); menu.hidden = true; menu.setAttribute('data-shell', '');
    document.body.appendChild(menu);
    $('#nubeEquipo').addEventListener('click', () => abrirAjustes('nube-equipo'));
    $('#nubeYo').addEventListener('click', () => (menu.hidden ? abrirMenu() : cerrarMenu()));
    document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !$('#nubeYo').contains(e.target)) cerrarMenu(false); });
    menu.addEventListener('keydown', (e) => {
      const l = [...menu.querySelectorAll('[role=menuitem]')], i = l.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarMenu(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); l[(i + 1) % l.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
      else if (e.key === 'Tab') cerrarMenu(false);
    });
    menu.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      cerrarMenu(false);
      if (a === 'perfil') abrirAjustes('nube-perfil'); else if (a === 'equipo') abrirAjustes('nube-equipo'); else if (a === 'salir') salir();
    });
    addEventListener('resize', () => cerrarMenu(false));
    return true;
  }
  function abrirMenu() {
    const b = $('#nubeYo'), r = b.getBoundingClientRect();
    menu.innerHTML = `<div class="nb-m-cab">${avatar({ ...yo, userId: yo.id })}<div><b>${esc(yo.nombre)}</b><small>${esc(yo.email)} · ${esc(rolTxt(yo.rol))}</small></div></div>
      <button type="button" role="menuitem" tabindex="-1" data-a="perfil">Mi perfil</button><button type="button" role="menuitem" tabindex="-1" data-a="equipo">Equipo</button><button type="button" role="menuitem" tabindex="-1" data-a="salir">Salir</button>`;
    menu.hidden = false; b.setAttribute('aria-expanded', 'true');
    menu.style.top = Math.round(r.bottom + 6) + 'px'; menu.style.right = Math.max(8, Math.round(innerWidth - r.right)) + 'px';
    menu.querySelector('[role=menuitem]').focus();
  }
  function cerrarMenu(volver = true) { if (!menu || menu.hidden) return; menu.hidden = true; $('#nubeYo').setAttribute('aria-expanded', 'false'); if (volver) $('#nubeYo').focus(); }
  async function salir() { try { await fetch0('/api/salir', { method: 'POST', headers: { 'X-Pestana': PESTANA } }); } catch { /* sin red: igual se vuelve al acceso */ } location.replace('/'); }
  const rolTxt = (r) => ({ admin: 'administrador', editor: 'editor', lectura: 'solo lectura' }[r] || r);

  function pintarBarra() {
    if (!yo || !montarBarra()) return;
    const otros = presentes.filter((p) => p.userId !== yo.id).map(persona);
    const g = $('#nubeEquipo');
    g.hidden = !otros.length;
    if (otros.length) {
      g.innerHTML = otros.slice(0, 4).map((p) => avatar(p)).join('') + (otros.length > 4 ? `<span class="nb-mas">+${otros.length - 4}</span>` : '');
      g.setAttribute('aria-label', `Conectados ahora: ${otros.map(etiquetaDe).join('; ')}. Abrir el equipo.`);
    }
    const mio = presentes.find((p) => p.userId === yo.id);
    const b = $('#nubeYo');
    b.innerHTML = avatar({ ...yo, userId: yo.id, nombre: yo.nombre, etiqueta: undefined }, conexion === 'conectado' ? 'nb-vivo' : 'nb-sin');
    b.setAttribute('aria-label', `Mi cuenta: ${yo.nombre}${conexion === 'conectado' ? '' : conexion === 'conectando' ? ' (conectando en vivo…)' : ' (sin conexión en vivo)'}`);
    b.title = conexion === 'conectado' ? `${yo.nombre} · en vivo${mio?.etiqueta ? ' · ' + mio.etiqueta : ''}` : `${yo.nombre} · sin conexión en vivo`;
    $('#nubeEstado').textContent = conexion === 'desconectado' ? 'Sin conexión en vivo: los cambios de tus compañeros llegarán con un pequeño retraso.' : '';
    document.dispatchEvent(new CustomEvent('ao:presencia', { detail: { presentes: presentes.map(persona), conexion } }));
  }

  /** A ≤ 440 px la barra de avatares se esconde: Mi perfil y Salir viven también en el menú «⋯» del dock (y siguen en Ajustes); a ≤ 760 px, donde la barra de conectores se oculta, también Conectores y Modelos. */
  function enMenuMas() {
    const m = document.getElementById('topMoreMenu'); if (!m) return false;
    if (m.querySelector('[data-nube]')) return true;
    for (const [a, t] of [['perfil', 'Mi perfil'], ['conectores', 'Conectores'], ...(yo?.rol === 'admin' ? [['modelos', 'Modelos']] : []), ['salir', 'Salir']]) { // a ≤ 760 px la barra de conectores no cabe: aquí están Conectores y Modelos
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.tabIndex = -1; b.dataset.nube = a; b.textContent = t;
      b.addEventListener('click', () => { m.hidden = true; document.getElementById('topMore')?.setAttribute('aria-expanded', 'false'); if (a === 'salir') salir(); else abrirAjustes(a === 'perfil' ? 'nube-perfil' : a === 'conectores' ? 'nube-conectores' : 'nube-modelos'); });
      m.appendChild(b);
    }
    return true;
  }

  // ---------- el socket ----------
  let ws = null, intentos = 0, latido = 0, pongT = 0, ultimaVista = '';
  const mandar = (o) => { if (ws?.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
  function conectar() {
    clearTimeout(reintento); conexion = 'conectando'; pintarBarra();
    let s; try { s = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`); } catch { return programar(); }
    ws = s;
    s.onmessage = (e) => {
      if (e.data === 'pong') { clearTimeout(pongT); return; }
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.tipo === 'hola') { intentos = 0; conexion = 'conectado'; presentes = m.presentes ?? []; ultimaVista = ''; enviarVista(); pintarBarra(); }
      else if (m.tipo === 'presencia') { presentes = m.presentes ?? []; pintarBarra(); }
      else if (m.tipo === 'cambio') alCambio(m);
    };
    s.onopen = () => { clearInterval(latido); latido = setInterval(() => { mandar('ping'); clearTimeout(pongT); pongT = setTimeout(() => { try { s.close(); } catch { /* ya cerrado */ } }, 10000); }, 25000); };
    s.onclose = async (e) => {
      clearInterval(latido); clearTimeout(pongT); if (ws !== s) return; ws = null; presentes = presentes.filter((p) => p.userId === yo?.id); conexion = 'desconectado'; pintarBarra();
      if (e.code === 1008 || e.code === 4408) return; // demasiados mensajes o demasiadas pestañas: reconectar solo repetiría el problema (se vuelve al recargar)
      if (e.code === 4401 || (e.code === 1006 && intentos >= 1)) { // ¿sigo teniendo sesión? Si no, vuelvo al acceso en vez de reintentar para siempre
        try { const r = await fetch0('/api/yo'); if (r.status === 401) return location.reload(); } catch { /* sin red: reintento normal */ }
      }
      programar();
    };
    s.onerror = () => { /* onclose decide */ };
  }
  let reintento = 0;
  function programar() { const base = Math.min(30000, 1000 * 2 ** intentos++); reintento = setTimeout(conectar, base / 2 + Math.random() * base / 2); }
  addEventListener('online', () => { if (!ws) { intentos = 0; conectar(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !ws) { intentos = 0; conectar(); } else if (!document.hidden) enviarVista(true); });

  // ---------- qué vista tengo abierta ----------
  const VISTAS = [['topStudio', 'estudio', 'Estudio'], ['topCal', 'calendario', 'Calendario'], ['topTareas', 'tareas', 'Tareas'], ['topContenido', 'contenido', 'Contenido'], ['topAnaliticas', 'analiticas', 'Analíticas'], ['topAnuncios', 'anuncios', 'Anuncios'], ['topBrain', 'cerebro', 'El Cerebro']];
  const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  function vistaActual() {
    const abierto = (id) => { const e = document.getElementById(id); return e && !e.hidden && e.classList.contains('on'); };
    let area = 'oficina', etiqueta = 'La oficina';
    const v = VISTAS.find(([b]) => document.getElementById(b)?.getAttribute('aria-pressed') === 'true');
    const rail = document.getElementById('rail');
    if (abierto('setOv')) [area, etiqueta] = ['ajustes', 'Ajustes'];
    else if (abierto('bizOv')) [area, etiqueta] = ['negocio', 'Negocio'];
    else if (v) [, area, etiqueta] = v;
    else if (rail && rail.classList.contains('open')) { const n = (document.querySelector('#railHeader .b-name')?.childNodes[1]?.textContent || '').trim(); if (n) [area, etiqueta] = ['depto:' + slug(n), 'Departamento ' + n]; }
    if (document.body.classList.contains('subOpen')) { if (area === 'oficina') [area, etiqueta] = ['dimitri', 'Dimitri']; else etiqueta += ' con Dimitri'; }
    return { area, etiqueta };
  }
  let vistaT = 0;
  function enviarVista(forzar) {
    const { area, etiqueta } = vistaActual(), k = area + '|' + etiqueta;
    if (!forzar && k === ultimaVista) return;
    ultimaVista = k; mandar({ tipo: 'vista', area, etiqueta });
  }
  function vigilarVista() {
    const cambia = () => { clearTimeout(vistaT); vistaT = setTimeout(() => enviarVista(), 350); };
    new MutationObserver(cambia).observe(document.body, { attributes: true, attributeFilter: ['aria-pressed', 'class', 'hidden', 'aria-expanded'], subtree: true });
  }

  // ---------- lo que cambió otra persona ----------
  const avisadas = new Map();
  function alCambio(m) {
    if (m.por?.tab && m.por.tab === PESTANA) return; // el eco de lo mío: la página ya lo sabe
    document.dispatchEvent(new CustomEvent('ao:cambio', { detail: { area: m.area, por: m.por, at: m.at } }));
    window.dispatchEvent(new CustomEvent('ao:cambio', { detail: { area: m.area, por: m.por, at: m.at } }));
    if (m.area === 'estudio') window.dispatchEvent(new CustomEvent('ao:media-changed'));
    if (m.area === 'equipo') cargarEquipo();
    const t = Date.now();
    if (m.nombre && m.por?.id && m.por.id !== yo?.id && t - (avisadas.get(m.area) ?? 0) > 8000) { avisadas.set(m.area, t); avisoBreve(`${m.por.nombre || 'Alguien'} cambió ${m.nombre}.`); } // el nombre legible lo manda el servidor (lista blanca): nunca sale un nombre interno
  }
  let toastT = 0;
  function avisoBreve(t, ms = 3500) {
    let e = $('#nubeAviso'); if (!e) { e = document.createElement('div'); e.id = 'nubeAviso'; e.setAttribute('role', 'status'); e.setAttribute('aria-live', 'polite'); document.body.appendChild(e); }
    e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), ms);
  }
  // Los dos párrafos fijos de «Motores y keys» del Estudio hablan de Windows y de un iniciador; en la nube una key es un secreto del repositorio en GitHub. (Los demás textos de keys los cambia la propia página con AO_NUBE.)
  const TEXTOS_KEYS = ['Cada motor se enciende con su key, guardada como secreto del repositorio en GitHub. Lo que ya está listo sale con ●.', 'La key se guarda una sola vez como secreto del repositorio en GitHub (Settings → Secrets → Actions) y se vuelve a desplegar. Nunca va en un archivo. Pon también un límite de gasto en la web de cada servicio.'];
  function parchearEstudio() {
    const ps = document.querySelectorAll('.st-engov .st-hsub'); if (ps.length < 2) return false;
    ps.forEach((e, i) => { if (TEXTOS_KEYS[i] && !e.dataset.nube) { e.dataset.nube = '1'; e.textContent = TEXTOS_KEYS[i]; } });
    return true;
  }
  if (!parchearEstudio()) { const ob = new MutationObserver(() => { if (parchearEstudio()) ob.disconnect(); }); ob.observe(document.body, { childList: true, subtree: true }); setTimeout(() => ob.disconnect(), 20000); }
  // «Suscribirme (.ics)» del calendario: la app de calendario de otra empresa (Google, Outlook…) no puede entrar con tu sesión, así que su dirección no le sirve. Aquí se BAJA el archivo con tus rutinas y tareas de hoy.
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest?.('[data-ics]')) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const a = document.createElement('a'); a.href = '/api/calendar.ics'; a.download = 'oficina.ics'; document.body.appendChild(a); a.click(); a.remove();
    avisoBreve('Se bajó tu calendario (.ics). Una app de calendario no puede entrar por su dirección a la oficina en la nube: impórtalo, y vuelve a bajarlo cuando quieras ponerlo al día.', 9000);
  }, true);

  // ---------- Ajustes → Mi perfil / Equipo ----------
  function abrirAjustes(tab) {
    const g = $('#topSettings'); if (!g) return;
    if ($('#setOv')?.hidden !== false) g.click();
    const ir = () => $(`#setOv [data-tab="${tab}"]`)?.click();
    ir(); setTimeout(() => { if ($('#setOv .sg-tabs [aria-selected=true]')?.dataset.tab !== tab) ir(); }, 60);
  }
  const panelVivo = (pane, k) => pane.isConnected && pane.dataset.nube === k;
  const msgDe = (pane) => (t, mal) => { const e = pane.querySelector('.nb-msg'); if (!e) return; e.textContent = t || ''; e.classList.toggle('mal', !!mal); };

  /** Reduce la foto a un cuadrado de 256 px (JPEG) en el navegador: pesa unos 20 KB y nunca pasa del tope del servidor (1 MB). */
  async function reducirFoto(archivo) {
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error('Elige una imagen JPEG, PNG o WebP.');
    const bmp = await createImageBitmap(archivo).catch(() => { throw new Error('No se pudo leer esa imagen. Prueba con otra foto (JPEG, PNG o WebP).'); }), lado = Math.min(bmp.width, bmp.height), c = document.createElement('canvas'); c.width = c.height = 256;
    c.getContext('2d').drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 256, 256);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    if (!blob) throw new Error('No se pudo preparar la foto.');
    return blob;
  }

  function pintarPerfil(pane) {
    pane.dataset.nube = 'nube-perfil';
    pane.innerHTML = `<p class="sg-lead">Cómo te ven tus compañeros: tu foto y tu nombre salen junto a la barra de arriba cuando estás conectado, con el área en la que trabajas.</p>
      <div class="nb-perfil"><div class="nb-grande" id="nbFoto">${avatar({ ...yo, userId: yo.id })}</div>
      <div class="nb-bot"><label class="sg-btn nb-subir" for="nbArchivo">Cambiar foto</label><input type="file" id="nbArchivo" accept="image/jpeg,image/png,image/webp" class="nb-sr-file"><button type="button" class="sg-btn" data-a="quitar-foto"${yo.foto ? '' : ' hidden'}>Quitar foto</button><small>JPEG, PNG o WebP. Se recorta cuadrada y se reduce sola.</small></div></div>
      <div class="sg-f"><label for="nbNombre">Tu nombre</label><input type="text" id="nbNombre" maxlength="60" value="${esc(yo.nombre)}" autocomplete="name"></div>
      <button type="button" class="sg-btn pri" data-a="nombre">Guardar nombre</button>
      <div class="sg-f"><span class="sg-l">Cuenta</span><small>${esc(yo.email)} · ${esc(rolTxt(yo.rol))}</small></div>
      <fieldset class="sg-f nb-clave"><legend>Cambiar contraseña</legend>
        <label for="nbActual">La de ahora</label><input type="password" id="nbActual" autocomplete="current-password">
        <label for="nbNueva">La nueva (12 caracteres o más)</label><input type="password" id="nbNueva" autocomplete="new-password">
        <label for="nbNueva2">Repite la nueva</label><input type="password" id="nbNueva2" autocomplete="new-password">
        <small>Al cambiarla se cierran tus sesiones en los demás aparatos.</small>
        <button type="button" class="sg-btn" data-a="clave">Cambiar contraseña</button></fieldset>
      <p class="nb-msg" role="status" aria-live="polite"></p>
      <p><button type="button" class="sg-btn" data-a="salir">Salir de la oficina</button> <small>${conexion === 'conectado' ? 'En vivo.' : 'Sin conexión en vivo.'}</small></p>`;
    const msg = msgDe(pane);
    pane.querySelector('#nbArchivo').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { msg('Subiendo…'); const b = await reducirFoto(f); const r = await api('/api/yo/foto', { metodo: 'PUT', bytes: b }); yo.foto = r.foto; refrescarYo(); if (panelVivo(pane, 'nube-perfil')) pintarPerfil(pane); msgDe(pane)('Foto actualizada.'); } catch (x) { msg(x.message, true); }
    });
    if (pane._nubePerfil) return; pane._nubePerfil = true; // el panel de Ajustes es UNO y se reutiliza: los escuchadores se ponen una sola vez
    pane.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      try {
        if (a === 'salir') return salir();
        if (a === 'quitar-foto') { await api('/api/yo/foto', { metodo: 'DELETE' }); yo.foto = null; refrescarYo(); pintarPerfil(pane); msgDe(pane)('Foto quitada.'); }
        if (a === 'nombre') { const r = await api('/api/yo', { metodo: 'PATCH', cuerpo: { nombre: pane.querySelector('#nbNombre').value } }); yo.nombre = r.usuario.nombre; refrescarYo(); msg('Nombre guardado.'); }
        if (a === 'clave') {
          const n = pane.querySelector('#nbNueva').value;
          if (n !== pane.querySelector('#nbNueva2').value) return msg('Las contraseñas nuevas no coinciden.', true);
          await api('/api/yo/contrasena', { metodo: 'POST', cuerpo: { actual: pane.querySelector('#nbActual').value, nueva: n } });
          for (const i of pane.querySelectorAll('.nb-clave input')) i.value = ''; msg('Contraseña cambiada. Las demás sesiones se cerraron.');
        }
      } catch (x) { msg(x.message, true); }
    });
  }
  function refrescarYo() { cargarEquipo(); pintarBarra(); }

  async function pintarEquipo(pane) {
    pane.dataset.nube = 'nube-equipo';
    const admin = yo.rol === 'admin';
    const fila = (m) => {
      const p = presentes.find((x) => x.userId === m.id);
      return `<li class="nb-fila" data-id="${esc(m.id)}">${avatar({ ...m, userId: m.id, etiqueta: p ? p.etiqueta : undefined })}
        <div class="nb-quien"><span class="nb-nom"><b>${esc(m.nombre)}</b>${m.yo ? ' <small>(tú)</small>' : ''}${m.fundador ? ' <small>· fundó la oficina</small>' : ''}</span><small>${m.email ? esc(m.email) + ' · ' : ''}${p ? 'conectado · ' + esc(p.etiqueta || 'La oficina') : 'desconectado'}</small></div>
        ${admin ? `<select aria-label="Rol de ${esc(m.nombre)}" data-rol${m.fundador ? ' disabled' : ''}>${['admin', 'editor', 'lectura'].map((r) => `<option value="${r}"${m.rol === r ? ' selected' : ''}>${esc(rolTxt(r))}</option>`).join('')}</select>${m.yo || m.fundador ? '' : '<button type="button" class="sg-btn" data-a="reinicio">Restablecer contraseña</button><button type="button" class="sg-btn" data-a="quitar">Quitar</button>'}` : `<span class="nb-rol">${esc(rolTxt(m.rol))}</span>`}</li>`;
    };
    if (!equipo.miembros.length) cargarEquipo(true); // se pinta sola al llegar
    pane.innerHTML = `<p class="sg-lead">${admin ? 'Invita a tu equipo, cambia sus roles y mira quién está conectado. Administrador: aprueba, gasta y gestiona el equipo · Editor: trabaja con los agentes · Solo lectura: mira.' : 'Las personas de esta oficina y en qué trabajan ahora.'}</p>
      <ul class="nb-lista">${equipo.miembros.map(fila).join('') || '<li>Cargando…</li>'}</ul>
      ${admin ? `<h3 class="nb-h">Invitar a alguien</h3>
        <div class="sg-f"><label for="nbCorreo">Correo</label><input type="email" id="nbCorreo" autocomplete="off" inputmode="email" autocapitalize="none" spellcheck="false"></div>
        <div class="sg-f"><label for="nbNom">Nombre (opcional)</label><input type="text" id="nbNom" maxlength="60" autocomplete="off"></div>
        <div class="sg-f"><label for="nbRol">Rol</label><select id="nbRol"><option value="editor">Editor</option><option value="lectura">Solo lectura</option><option value="admin">Administrador</option></select></div>
        <button type="button" class="sg-btn pri" data-a="invitar">Crear enlace de invitación</button>
        <div id="nbEnlace" class="nb-enlace" hidden><label for="nbEnlaceTxt">Copia este enlace y mándaselo (WhatsApp, correo…). Solo se muestra ahora, sirve una vez y caduca en 7 días.</label><div class="nb-copia"><input id="nbEnlaceTxt" readonly><button type="button" class="sg-btn" data-a="copiar">Copiar</button></div></div>
        ${equipo.invitaciones.length ? `<h3 class="nb-h">Invitaciones pendientes</h3><ul class="nb-lista">${equipo.invitaciones.map((i) => `<li class="nb-fila" data-inv="${esc(i.id)}"><div class="nb-quien"><b>${esc(i.email)}</b><small>${esc(rolTxt(i.rol))} · caduca ${esc(new Date(i.expira).toLocaleDateString('es', { day: 'numeric', month: 'short' }))}</small></div><button type="button" class="sg-btn" data-a="revocar">Revocar</button></li>`).join('')}</ul>` : ''}` : ''}
      <p class="nb-msg" role="status" aria-live="polite"></p>`;
    const msg = msgDe(pane);
    if (pane._nubeEquipo) return; pane._nubeEquipo = true;
    pane.addEventListener('change', async (e) => {
      const s = e.target.closest('[data-rol]'); if (!s) return;
      try { await api(`/api/equipo/${s.closest('[data-id]').dataset.id}`, { metodo: 'PATCH', cuerpo: { rol: s.value } }); msg('Rol cambiado.'); } catch (x) { msg(x.message, true); await cargarEquipo(); }
    });
    pane.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      try {
        if (a === 'copiar') { const i = pane.querySelector('#nbEnlaceTxt'); i.select(); try { await navigator.clipboard.writeText(i.value); msg('Enlace copiado.'); } catch { msg('Selecciónalo y cópialo con Ctrl+C.'); } }
        else if (a === 'invitar') {
          const r = await api('/api/equipo/invitaciones', { metodo: 'POST', cuerpo: { email: pane.querySelector('#nbCorreo').value, nombre: pane.querySelector('#nbNom').value, rol: pane.querySelector('#nbRol').value } });
          await cargarEquipo(true); pintarEquipo(pane);
          const caja = pane.querySelector('#nbEnlace'); caja.hidden = false; pane.querySelector('#nbEnlaceTxt').value = r.enlace; pane.querySelector('#nbEnlaceTxt').select(); msgDe(pane)('Invitación creada. Copia el enlace.');
        }
        else if (a === 'reinicio') {
          const r = await api(`/api/equipo/${b.closest('[data-id]').dataset.id}/reinicio`, { metodo: 'POST' });
          const caja = pane.querySelector('#nbEnlace'); caja.hidden = false; caja.querySelector('label').textContent = `Enlace para que ${r.para} ponga una contraseña nueva (sirve una vez, caduca en ${r.expira}; sus sesiones se cierran al usarlo).`;
          pane.querySelector('#nbEnlaceTxt').value = r.enlace; pane.querySelector('#nbEnlaceTxt').select(); msg('Enlace creado. Cópialo y mándaselo.');
        }
        else if (a === 'revocar') { await api(`/api/equipo/invitaciones/${b.closest('[data-inv]').dataset.inv}`, { metodo: 'DELETE' }); await cargarEquipo(true); pintarEquipo(pane); msgDe(pane)('Invitación revocada.'); }
        else if (a === 'quitar') {
          if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = '¿Seguro? Quitar'; setTimeout(() => { b.dataset.seguro = ''; b.textContent = 'Quitar'; }, 4000); return; }
          await api(`/api/equipo/${b.closest('[data-id]').dataset.id}`, { metodo: 'DELETE' }); await cargarEquipo(true); pintarEquipo(pane); msgDe(pane)('Quitado del equipo. Ya no puede entrar.');
        }
      } catch (x) { msg(x.message, true); }
    });
  }

  let cargando = null;
  async function cargarEquipo(forzar) {
    if (cargando && !forzar) return cargando;
    cargando = api('/api/equipo').then((d) => { equipo = d; const m = d.miembros.find((x) => x.id === d.yo); if (m && yo) Object.assign(yo, { nombre: m.nombre, color: m.color, foto: m.foto, rol: m.rol }); pintarBarra(); const p = $('#setOv .sg-pane'); if (p && p.isConnected && p.dataset.nube === 'nube-equipo' && !p.contains(document.activeElement) && p.querySelector('#nbEnlace')?.hidden !== false) pintarEquipo(p); }).catch(() => {}).finally(() => { cargando = null; });
    return cargando;
  }

  // Las dos pestañas de Ajustes (src/settings.js lee window.AO_AJUSTES_EXTRA al pintar).
  window.AO_AJUSTES_EXTRA = (window.AO_AJUSTES_EXTRA || []).concat([
    { key: 'nube-perfil', label: 'Mi perfil', primera: true, render: (pane) => { if (yo) pintarPerfil(pane); } },
    { key: 'nube-equipo', label: 'Cuentas y roles', render: (pane) => { if (yo) pintarEquipo(pane); } },
  ]);

  // ---------- arranque ----------
  async function iniciar() {
    try { yo = (await api('/api/yo')).usuario; } catch { return; }
    pintarBarra(); vigilarVista(); conectar(); cargarEquipo();
    for (let i = 0; i < 20 && !enMenuMas(); i++) await new Promise((r) => setTimeout(r, 250)); // el menú «⋯» lo crea la página al arrancar
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.AO_NUBE = { api, esc, aviso: avisoBreve, yo: () => yo, abrirAjustes, pestana: PESTANA, presentes: () => presentes.map(persona), conexion: () => conexion };
})();

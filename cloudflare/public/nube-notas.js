/* N1 (Fase 8) — la campanita y la hoja «Mientras no estabas» (solo en la nube). Paquete bajo demanda: lo trae nube.js después de saber quién eres; la página no lo lleva.
   Todo lo decide el servidor (flag `notas.config.activo` apagado por defecto: sin él, esta pieza no pinta nada). Aquí solo se pinta y se manda; todo dato se escapa con esc().
   El aviso en vivo (`ao:nota`) lleva solo la señal: el texto de una nota se pide siempre a la API. */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N || N.notas) return;
  const { api, esc } = N;
  const COLORES = [['amarillo', 'Amarillo'], ['rosa', 'Rosa'], ['verde', 'Verde'], ['azul', 'Azul'], ['lila', 'Lila'], ['naranja', 'Naranja']];
  const TOPE = 500, CADA_MS = 60_000, SI_APAGADO_MS = 300_000;
  let campana = null, hoja = null, datos = null, activo = false, pref = null, tg = null, codigoTg = null, tgT = 0, transparencia = '', esAdmin = false, aviso = [], avisoT = 0, timer = 0, personas = null, abierta = false, mensaje = '';

  const cuenta = () => (datos ? (datos.notas?.length || 0) + (datos.notificaciones?.noLeidas || 0) : 0);
  const hace = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };

  function pintarCampana() {
    if (!activo) { campana?.remove(); campana = null; return; }
    if (!campana) {
      campana = document.createElement('button'); campana.type = 'button'; campana.id = 'nbCampana'; campana.className = 'nt-campana';
      campana.setAttribute('aria-haspopup', 'dialog'); campana.addEventListener('click', () => (abierta ? cerrar() : abrir()));
      document.body.appendChild(campana);
    }
    const n = cuenta();
    campana.setAttribute('aria-label', n ? `Notas y avisos: ${n} sin leer` : 'Notas y avisos');
    campana.setAttribute('aria-expanded', String(abierta));
    campana.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>${n ? `<span class="nt-n" aria-hidden="true">${n > 9 ? '9+' : n}</span>` : ''}`;
  }

  async function cargar() {
    if (document.hidden) { clearTimeout(timer); timer = setTimeout(cargar, activo ? CADA_MS : SI_APAGADO_MS); return; } // una pestaña olvidada no marca presencia ni «visita nueva»
    try { datos = await api('/api/notas-personales/entrada'); activo = datos.activo === true; } catch { return; }
    pintarCampana(); if (abierta) pintarHoja();
    clearTimeout(timer); timer = setTimeout(cargar, activo ? CADA_MS : SI_APAGADO_MS);
  }

  const tarjetaNota = (n) => `<li class="nt-nota c-${esc(n.color)}" data-id="${esc(n.id)}"><p class="nt-de"><b>${esc(n.de)}</b> <small>${esc(hace(n.t))}${n.grupal ? ' · para varios' : ''}</small></p>
      <p class="nt-cuerpo">${esc(n.cuerpo)}</p>
      <div class="nt-acc">${/^tarea:/.test(n.enlace || '') ? `<button type="button" class="sg-btn" data-a="abrir" data-e="${esc(n.enlace)}">Abrir la tarea</button>` : ''}<button type="button" class="sg-btn" data-a="cerrar">Cerrar</button><button type="button" class="nt-rep" data-a="reportar" title="Avisar a un administrador de que esta nota no debería haberse enviado">Reportar</button></div></li>`;
  const filaAviso = (a) => `<li class="nt-aviso ${esc(a.nivel)}"><span>${esc(a.titulo)}</span> <small>${esc(hace(a.t))}</small></li>`;

  function formulario() {
    const rol = N.yo()?.rol;
    if (datos && datos.notasActivas === false) return '<p class="nt-vacio">Las notas entre personas todavía no están encendidas.</p>';
    const opts = (personas || []).map((p) => `<option value="persona:${esc(p.id)}">${esc(p.nombre)}</option>`).join('')
      + (rol !== 'lectura' ? '<option value="todos">Todas las personas</option><option value="rol:editor">Los editores</option><option value="rol:admin">Los administradores</option>' : '');
    if (!personas) return '<p class="nt-vacio">Cargando a quién puedes escribirle…</p>';
    if (!opts) return '<p class="nt-vacio">Todavía no hay a quién dejarle una nota.</p>';
    return `<form class="nt-form" autocomplete="off"><label for="nt-para">Para</label><select id="nt-para" name="para">${opts}</select>
      <label for="nt-texto">Tu nota</label><textarea id="nt-texto" name="cuerpo" rows="3" maxlength="${TOPE + 200}" placeholder="Algo corto: lo verá cuando entre."></textarea><div class="nt-cont" id="nt-cont" aria-live="polite">0 / ${TOPE}</div>
      <fieldset class="nt-colores"><legend>Color</legend>${COLORES.map(([id, n], i) => `<label class="nt-sw c-${id}"><input type="radio" name="color" value="${id}"${i === 0 ? ' checked' : ''}><span>${n}</span></label>`).join('')}</fieldset>
      <div class="nt-enviar"><button type="submit" class="sg-btn pri">Dejar la nota</button><span class="nb-msg" role="status">${esc(mensaje)}</span></div></form>`;
  }

  function prefsHTML() {
    if (!pref) return '<p class="nt-vacio">Cargando…</p>';
    return `<div class="nt-pref">${esAdmin ? `<label><input type="checkbox" data-p="avisarme"${pref.avisarme ? ' checked' : ''}> Avisarme en la oficina cuando alguien se conecta</label>` : ''}
      ${esAdmin && pref.avisarme ? `<label><input type="checkbox" data-p="telegram"${pref.telegram ? ' checked' : ''}> Avisarme también por Telegram (solo si no estás dentro)</label>` : ''}
      <label><input type="checkbox" data-p="noAvisar"${pref.noAvisar ? ' checked' : ''}> No avisar que me conecto</label><p class="nt-transp">${esc(transparencia)}</p></div>${tgHTML()}`;
  }
  const tgHTML = () => {
    if (!tg || !tg.activo || !tg.disponible) return '';
    const e = tg.estado, caja = (t) => `<div class="nt-tg"><b>Telegram</b> ${t}</div>`;
    if (tg.rol === 'admin') return caja(e === 'admin' ? 'conectado (por la lista de administradores).' : 'sin conectar: pon tu id en Ajustes → Telegram.');
    if (e === 'activa') return caja(`conectado${tg.username ? ' como @' + esc(tg.username) : ''}. <button type="button" class="sg-btn" data-a="tg-quitar">Desvincular</button>`);
    if (e === 'pendiente') return caja(`<p>El Telegram <b>${tg.username ? '@' + esc(tg.username) : 'sin nombre de usuario'}</b> quiere vincularse a tu cuenta. ¿Eres tú?</p><button type="button" class="sg-btn pri" data-a="tg-ok">Confirmar</button> <button type="button" class="sg-btn" data-a="tg-no">Rechazar</button>`);
    if (e === 'codigo' && codigoTg) return caja(`<p>Escríbele al bot de la oficina: <code class="nt-cod">/vincular ${esc(codigoTg)}</code></p><small>Vale 10 minutos y se usa una vez. Después, vuelve aquí a confirmar.</small>`);
    return caja('sin conectar. <button type="button" class="sg-btn" data-a="tg-codigo">Conectar mi Telegram</button>');
  };
  async function cargarTg() { try { tg = await api('/api/vinculo-telegram'); if (tg.estado !== 'codigo') codigoTg = tg.estado === 'pendiente' ? null : codigoTg; } catch { /* sin Telegram: la hoja sigue */ } clearTimeout(tgT); if (abierta && tg && ['codigo', 'pendiente'].includes(tg.estado)) tgT = setTimeout(async () => { await cargarTg(); if (abierta) pintarHoja(); }, 4000); }
  async function accionTg(a) {
    try {
      if (a === 'tg-codigo') { const d = await api('/api/vinculo-telegram/codigo', { metodo: 'POST', cuerpo: {} }); codigoTg = d.codigo; }
      else if (a === 'tg-ok' || a === 'tg-no') { await api('/api/vinculo-telegram/confirmar', { metodo: 'POST', cuerpo: { aceptar: a === 'tg-ok' } }); codigoTg = null; N.aviso(a === 'tg-ok' ? 'Telegram conectado ✓' : 'Rechazado'); }
      else if (a === 'tg-quitar') { await api('/api/vinculo-telegram/desvincular', { metodo: 'POST', cuerpo: {} }); N.aviso('Telegram desvinculado'); }
    } catch (e) { N.aviso(e.message); }
    await cargarTg(); if (abierta) pintarHoja();
  }
  async function cargarPref() { try { const d = await api('/api/notas-personales/preferencias-conexion'); if (d.activo) { pref = d.pref; esAdmin = d.esAdmin; transparencia = d.transparencia; } } catch { /* sin preferencias: la hoja sigue */ } }
  async function guardarPref(k, v) { try { const d = await api('/api/notas-personales/preferencias-conexion', { metodo: 'POST', cuerpo: { [k]: v } }); pref = d.pref; N.aviso('Guardado ✓'); } catch (e) { N.aviso(e.message); } if (abierta) pintarHoja(); }

  function pintarHoja() {
    if (!hoja) return;
    const notas = datos?.notas || [], av = datos?.notificaciones?.items?.filter((a) => !a.leida) || [];
    const guardado = hoja.querySelector('#nt-texto')?.value, para = hoja.querySelector('#nt-para')?.value, color = hoja.querySelector('input[name=color]:checked')?.value;
    hoja.innerHTML = `<div class="nt-cab"><h2 id="nt-t">Mientras no estabas</h2><button type="button" class="sg-btn" data-a="x" aria-label="Cerrar">✕</button></div>
      ${notas.length ? `<h3>Notas para ti</h3><ul class="nt-lista">${notas.map(tarjetaNota).join('')}</ul>` : ''}
      ${av.length ? `<h3>Avisos <button type="button" class="sg-btn" data-a="leidas">Marcar todo como leído</button></h3><ul class="nt-avisos">${av.map(filaAviso).join('')}</ul>` : ''}
      ${!notas.length && !av.length ? '<p class="nt-vacio"><b>Estás al día.</b> No hay notas ni avisos nuevos.</p>' : ''}
      <h3>Dejar una nota</h3>${formulario()}
      <h3>Tu conexión</h3>${prefsHTML()}`;
    const t = hoja.querySelector('#nt-texto'); if (t && guardado) { t.value = guardado; contar(); }
    const sel = hoja.querySelector('#nt-para'); if (sel && para) sel.value = para; // el destinatario elegido se conserva al repintar
    if (color) { const r = hoja.querySelector(`input[name=color][value="${color}"]`); if (r) r.checked = true; }
    if (document.activeElement === document.body) hoja.focus(); // el foco no se pierde al repintar
  }
  function contar() { const t = hoja?.querySelector('#nt-texto'), c = hoja?.querySelector('#nt-cont'); if (t && c) { const l = t.value.trim().length; c.textContent = l > TOPE ? `Te sobran ${l - TOPE}` : `${l} / ${TOPE}`; c.classList.toggle('mal', l > TOPE); } }

  async function abrir() {
    abierta = true; mensaje = '';
    hoja = document.createElement('section'); hoja.id = 'nbNotas'; hoja.className = 'nt-hoja'; hoja.setAttribute('role', 'dialog'); hoja.setAttribute('aria-modal', 'false'); /* no modal: no bloquea la oficina */ hoja.setAttribute('aria-labelledby', 'nt-t'); hoja.tabIndex = -1;
    document.body.appendChild(hoja); pintarHoja(); pintarCampana(); hoja.focus();
    hoja.addEventListener('click', alClic); hoja.addEventListener('input', (e) => { if (e.target.id === 'nt-texto') contar(); }); hoja.addEventListener('submit', alEnviar); hoja.addEventListener('change', (e) => { const p = e.target.dataset?.p; if (p) guardarPref(p, e.target.checked); });
    document.addEventListener('keydown', alTecla);
    await cargar(); if (!pref) { await Promise.all([cargarPref(), cargarTg()]); if (abierta) pintarHoja(); }
    if (!personas) { try { personas = (await api('/api/notas-personales/personas')).personas; } catch { personas = []; } if (abierta) pintarHoja(); }
  }
  function alTecla(e) { if (e.key === 'Escape' && abierta) { e.stopPropagation(); cerrar(); } }
  function cerrar() { document.removeEventListener('keydown', alTecla); abierta = false; hoja?.remove(); hoja = null; pintarCampana(); campana?.focus(); }

  async function alClic(e) {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, li = b.closest('[data-id]');
    if (a === 'x') return cerrar();
    if (a.startsWith('tg-')) return accionTg(a);
    if (a === 'abrir') { const id = b.dataset.e.slice(6); cerrar(); location.hash = `#tareas=lista&t=${encodeURIComponent(id)}`; return; }
    try {
      if (a === 'leidas') await api('/api/notificaciones/leer', { metodo: 'POST', cuerpo: { todas: true } });
      else if (li && (a === 'cerrar' || a === 'reportar')) { await api(`/api/notas-personales/${li.dataset.id}/${a}`, { metodo: 'POST' }); if (a === 'reportar') N.aviso('Cerré la nota. Un administrador podrá leerla porque la reportaste.'); if (a === 'reportar') await api(`/api/notas-personales/${li.dataset.id}/cerrar`, { metodo: 'POST' }); }
    } catch (err) { N.aviso(err.message); }
    await cargar();
  }
  async function alEnviar(e) {
    e.preventDefault(); const f = e.target, btn = f.querySelector('button[type=submit]'), msg = f.querySelector('.nb-msg');
    const cuerpo = f.cuerpo.value.trim(); if (!cuerpo) { msg.textContent = 'Escribe la nota.'; return; }
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); msg.textContent = 'Enviando…';
    try { await api('/api/notas-personales', { metodo: 'POST', cuerpo: { para: f.para.value, cuerpo, color: f.color.value } }); mensaje = 'Nota dejada ✓'; f.cuerpo.value = ''; contar(); msg.textContent = mensaje; }
    catch (err) { msg.textContent = err.message; }
    btn.disabled = false; btn.removeAttribute('aria-busy');
  }

  /* «Ana se conectó» (N2b): un aviso pequeño abajo a la izquierda, sin sonido, que se va a los 6 s. Una vez por visita lo garantiza el servidor; aquí se juntan las ráfagas. */
  function avisoConexion(id) {
    const p = (N.presentes?.() || []).find((x) => x.userId === id);
    if (!aviso.some((x) => x.id === id)) aviso.push({ id, nombre: p?.nombre || 'Alguien' });
    let el = document.getElementById('nbConexion');
    if (!el) { el = document.createElement('div'); el.id = 'nbConexion'; el.className = 'nt-conexion'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    const n = aviso.length, texto = n === 1 ? `${aviso[0].nombre} se conectó` : `${aviso[0].nombre} y ${n - 1} más se conectaron`;
    el.innerHTML = `<span>${esc(texto)}</span> ${datos?.notasActivas ? `<button type="button" class="sg-btn" data-a="escribir">Escribirle</button>` : ''}`;
    el.querySelector('[data-a=escribir]')?.addEventListener('click', async () => { const id0 = aviso[0].id; quitarAviso(); if (!abierta) await abrir(); const s = hoja?.querySelector('#nt-para'); const o = s && [...s.options].find((x) => x.value === `persona:${id0}`); if (o) { s.value = o.value; hoja.querySelector('#nt-texto')?.focus(); } });
    clearTimeout(avisoT); avisoT = setTimeout(quitarAviso, 6000);
  }
  function quitarAviso() { aviso = []; document.getElementById('nbConexion')?.remove(); }
  window.addEventListener('ao:conexion', (e) => { if (activo && e.detail?.userId) avisoConexion(e.detail.userId); });
  window.addEventListener('ao:nota', () => cargar());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar(); });
  N.notas = { abrir, cerrar, recargar: cargar };
  cargar();
})();

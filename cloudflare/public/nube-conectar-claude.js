/* Ajustes → Conectar Claude (solo en la nube, solo administradores): la dirección del conector MCP, las conexiones que hay (quién, con qué alcance, cuándo se usó por última vez)
   y el botón de cortarlas, una por una o todas. Lo que se ve viene de GET /api/conectar-claude; cortar es DELETE /api/conectar-claude/<id> y POST …/cortar-todas (segundo toque para confirmar).
   Nunca se pinta un testigo: el servidor no los devuelve. En el teléfono usa el mismo panel (Ajustes de escritorio dentro del contenedor «Volver»); no hay pantalla móvil propia todavía. */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N) return;
  const { api, esc } = N;
  const ALCANCE = { lectura: 'Solo leer', oficina: 'Leer y escribir, sin gastar', gasto: 'Puede preparar un gasto' };
  const cuando = (ms) => (ms ? new Date(ms).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca');

  const tarjeta = (c) => `<li class="fn-card"><div class="fn-cab"><h4>${esc(c.nombre)}</h4><b class="fn-on">${esc(ALCANCE[c.alcance] || c.alcance)}</b></div>
    <p>${esc(c.cliente ? c.cliente + ' · ' : '')}de ${esc(c.persona.nombre)} (${esc(c.persona.email)})</p>
    <small class="fn-nota">Conectada el ${esc(cuando(c.creada))} · último uso: ${esc(cuando(c.ultimoUso))}</small>
    <div class="fn-acc"><button type="button" class="sg-btn" data-cc="cortar" data-id="${esc(c.id)}">Cortar esta conexión</button><span class="nb-msg" role="status" aria-live="polite"></span></div></li>`;

  /* P4 (plan MCP §14.2): lo que Claude PIDIÓ gastar. Aquí está la cifra exacta que calculó el servidor, los topes de ese momento y quién lo pidió; aprobar es el segundo paso y es tuyo (nunca de Claude). */
  const usd = (n) => 'US$' + (Number(n) || 0).toFixed(2).replace('.', ',');
  const NOMBRE = { generar_imagen: 'Imagen', generar_video: 'Video', generar_voz: 'Locución', generar_musica: 'Música', aplicar_preset: 'Preset', crear_lote: 'Lote' };
  const topes = (t) => [t.left != null ? `quedan ${t.left} generaciones hoy` : '', t.costLeftDay != null ? `hoy quedan ${usd(t.costLeftDay)}` : '', t.costLeftMonth != null ? `este mes quedan ${usd(t.costLeftMonth)}` : ''].filter(Boolean).join(' · ') || 'sin topes que mostrar';
  const gasto = (g) => `<li class="fn-card" data-gasto="${esc(g.id)}"><div class="fn-cab"><h4>${esc(NOMBRE[g.herramienta] || g.herramienta)} · ${g.cifraUsd ? 'unos ' + esc(usd(g.cifraUsd)) : 'gratis'}</h4><b class="fn-on">Espera tu OK</b></div>
    <p>${esc(g.resumen)}</p><small class="fn-nota">La pidió «${esc(g.conexion.nombre)}» de ${esc(g.persona.nombre)} · vence ${esc(cuando(g.vence))} · ${esc(topes(g.topes))}${g.cifraNota ? ' · ' + esc(g.cifraNota) : ''}</small>
    <details><summary>Lo que pidió, exacto</summary><pre style="white-space:pre-wrap;word-break:break-word">${esc(g.args)}</pre></details>
    <div class="fn-acc"><button type="button" class="sg-btn" data-gasto-ok="${esc(g.id)}">Aprobar y gastar ${g.cifraUsd ? 'unos ' + esc(usd(g.cifraUsd)) : '(gratis)'}</button><button type="button" class="sg-btn" data-gasto-no="${esc(g.id)}">Rechazar</button><span class="nb-msg" role="status" aria-live="polite"></span></div></li>`;
  const hecha = (g) => `<li class="fn-card"><p>${esc(NOMBRE[g.herramienta] || g.herramienta)} · ${esc(g.resumen)}</p><small class="fn-nota">${esc(g.estado)}${g.motivo ? ': ' + esc(g.motivo) : ''}</small></li>`;
  const gastosHTML = (d) => `<h3 class="nb-h">Gastos que Claude pidió${d.esperan.length ? ' (' + d.esperan.length + ')' : ''}</h3>`
    + (d.esperan.length ? `<ul class="fn-lista">${d.esperan.map(gasto).join('')}</ul>` : '<p class="sg-lead">Ninguno espera tu OK. Claude no gasta: solo deja la solicitud aquí y en Telegram.</p>')
    + (d.hechas.length ? `<details><summary>Resueltos (${d.hechas.length})</summary><ul class="fn-lista">${d.hechas.map(hecha).join('')}</ul></details>` : '');

  async function pintar(pane) {
    pane.dataset.nube = 'nube-conectar-claude';
    if (N.yo()?.rol !== 'admin') { pane.innerHTML = '<p class="sg-lead">Solo un administrador ve y corta las conexiones de Claude.</p>'; return; }
    pane.innerHTML = '<p class="sg-lead">Cargando las conexiones…</p>';
    const dibujar = async () => {
      const d = await api('/api/conectar-claude');
      const sol = await api('/api/conectar-claude/solicitudes').catch(() => ({ esperan: [], hechas: [] }));
      const dominio = d.hostCanonico === false ? `<p class="fn-porque" role="note">${esc(d.aviso || 'El dominio aún no está conectado.')}</p>` : '';
      const apagado = d.activo ? '' : '<p class="fn-porque" role="note">El conector está APAGADO: nadie puede conectarse y las conexiones de abajo no funcionan. Se enciende en Funciones nuevas → «Conectar Claude (MCP)».</p>';
      const intro = '<p class="sg-lead">Conecta Claude (claude.ai, Claude Code o Claude Desktop) con la oficina. En Claude, añade un conector con esta dirección y entra con tu cuenta de administrador: '
        + 'allí eliges qué puede hacer (leer, escribir sin gastar o preparar un gasto). <b>Gastar nunca lo confirma Claude: siempre lo confirmas tú.</b></p>';
      const direccion = `<label class="nb-lbl" for="ccUrl">Dirección del conector</label><input id="ccUrl" class="nb-in" type="text" readonly value="${esc(d.url)}" style="font-size:16px;min-height:44px">`;
      const todas = '<div class="fn-acc"><button type="button" class="sg-btn" data-cc="todas">Cortar todas</button><span class="nb-msg" role="status" aria-live="polite"></span></div>';
      const lista = d.conexiones.length ? `<ul class="fn-lista">${d.conexiones.map(tarjeta).join('')}</ul>${todas}` : '<p class="sg-lead">No hay ninguna conexión.</p>';
      pane.innerHTML = `${intro}${dominio}${apagado}${direccion}${gastosHTML(sol)}<h3 class="nb-h">Conexiones</h3>${lista}`;
    };
    try { await dibujar(); } catch (e) { pane.innerHTML = `<p class="nb-msg mal" role="alert">${esc(e.message)}</p>`; return; }
    if (pane._cc) return; pane._cc = true;
    pane.addEventListener('click', async (ev) => {
      const g = ev.target.closest('button[data-gasto-ok],button[data-gasto-no]');
      if (g && !g.disabled) {
        const ok = g.hasAttribute('data-gasto-ok'), id = g.dataset.gastoOk || g.dataset.gastoNo, m0 = g.parentElement.querySelector('.nb-msg');
        g.disabled = true; if (m0) m0.textContent = ok ? 'Aprobando…' : 'Rechazando…';
        try { const r = await api(`/api/conectar-claude/solicitudes/${encodeURIComponent(id)}/${ok ? 'aprobar' : 'rechazar'}`, { metodo: 'POST', cuerpo: {} }); await dibujar(); const m1 = pane.querySelector('.nb-msg'); if (m1 && r.texto) m1.textContent = r.texto; }
        catch (x) { g.disabled = false; if (m0) { m0.textContent = x.message; m0.classList.add('mal'); } }
        return;
      }
      const b = ev.target.closest('button[data-cc]'); if (!b || b.disabled) return;
      const msg = b.parentElement.querySelector('.nb-msg'), dec = (t, mal) => { if (msg) { msg.textContent = t; msg.classList.toggle('mal', !!mal); } };
      if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.dataset.texto = b.textContent; b.textContent = b.dataset.cc === 'todas' ? 'Sí, cortar todas' : 'Sí, cortar'; return; }
      b.disabled = true; dec('Cortando…');
      try {
        await api(b.dataset.cc === 'todas' ? '/api/conectar-claude/cortar-todas' : `/api/conectar-claude/${encodeURIComponent(b.dataset.id)}`, { metodo: b.dataset.cc === 'todas' ? 'POST' : 'DELETE' });
        await dibujar();
        const m2 = pane.querySelector('.nb-msg'); if (m2) m2.textContent = 'Cortado. Claude tendrá que pedir permiso otra vez.';
      } catch (x) { b.disabled = false; delete b.dataset.seguro; b.textContent = b.dataset.texto || b.textContent; dec(x.message, true); }
    });
  }
  window.AO_AJUSTES_EXTRA = (window.AO_AJUSTES_EXTRA || []).concat([{ key: 'nube-conectar-claude', label: 'Conectar Claude', render: (pane) => pintar(pane) }]);
})();

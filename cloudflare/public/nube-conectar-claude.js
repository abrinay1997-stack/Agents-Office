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

  async function pintar(pane) {
    pane.dataset.nube = 'nube-conectar-claude';
    if (N.yo()?.rol !== 'admin') { pane.innerHTML = '<p class="sg-lead">Solo un administrador ve y corta las conexiones de Claude.</p>'; return; }
    pane.innerHTML = '<p class="sg-lead">Cargando las conexiones…</p>';
    const dibujar = async () => {
      const d = await api('/api/conectar-claude');
      const apagado = d.activo ? '' : '<p class="fn-porque" role="note">El conector está APAGADO: nadie puede conectarse y las conexiones de abajo no funcionan. Se enciende en Funciones nuevas → «Conectar Claude (MCP)».</p>';
      const intro = '<p class="sg-lead">Conecta Claude (claude.ai, Claude Code o Claude Desktop) con la oficina. En Claude, añade un conector con esta dirección y entra con tu cuenta de administrador: '
        + 'allí eliges qué puede hacer (leer, escribir sin gastar o preparar un gasto). <b>Gastar nunca lo confirma Claude: siempre lo confirmas tú.</b></p>';
      const direccion = `<label class="nb-lbl" for="ccUrl">Dirección del conector</label><input id="ccUrl" class="nb-in" type="text" readonly value="${esc(d.url)}" style="font-size:16px;min-height:44px">`;
      const todas = '<div class="fn-acc"><button type="button" class="sg-btn" data-cc="todas">Cortar todas</button><span class="nb-msg" role="status" aria-live="polite"></span></div>';
      const lista = d.conexiones.length ? `<ul class="fn-lista">${d.conexiones.map(tarjeta).join('')}</ul>${todas}` : '<p class="sg-lead">No hay ninguna conexión.</p>';
      pane.innerHTML = `${intro}${apagado}${direccion}<h3 class="nb-h">Conexiones</h3>${lista}`;
    };
    try { await dibujar(); } catch (e) { pane.innerHTML = `<p class="nb-msg mal" role="alert">${esc(e.message)}</p>`; return; }
    if (pane._cc) return; pane._cc = true;
    pane.addEventListener('click', async (ev) => {
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

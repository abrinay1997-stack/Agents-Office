/* Ajustes → Funciones nuevas (solo en la nube, solo administradores): encender o apagar lo que se publicó apagado, sin consola.
   El catálogo (qué función, qué hace, si puede gastar, si está construida) y el estado REAL vienen de GET /api/funciones; cada cambio es un POST de UNA función.
   Nada se enciende solo. Lo que no está construido no se puede encender y dice por qué; apagar siempre se puede. */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N) return;
  const { api, esc } = N;
  const GRUPO = { seguridad: 'Seguridad', contenido: 'Contenido' };

  const tarjeta = (f) => {
    const on = f.activa === true, cerrada = !on && !f.lista;
    const estado = on ? '<b class="fn-on">✓ Encendida</b>' : '<b class="fn-off">– Apagada</b>';
    const gasto = f.gasta ? '<p class="fn-gasto" role="note">⚠ Puede abrir la puerta a gastar dinero. Encenderla no gasta: gastan sus botones, que siguen pidiendo tu clic y respetando los topes.</p>' : '';
    const porque = cerrada ? `<p class="fn-porque" role="note">No se puede encender todavía. ${esc(f.porque || '')}</p>` : (f.nota ? `<small class="fn-nota">${esc(f.nota)}</small>` : '');
    const panel = f.panel ? `<p class="fn-porque" role="note">Se cambia en ${esc(f.panel)}, no desde aquí.</p>` : '';
    const boton = f.panel ? '' : `<button type="button" class="sg-btn ${on ? '' : 'pri'}" data-fn="${esc(f.id)}" data-on="${on ? 1 : 0}" data-gasta="${f.gasta ? 1 : 0}"${cerrada ? ' disabled' : ''}>${on ? 'Apagar' : 'Encender'}</button>`;
    return `<li class="fn-card"><div class="fn-cab"><h4>${esc(f.titulo)}</h4>${estado}</div><p>${esc(f.que)}</p>${gasto}${porque}${panel}<div class="fn-acc">${boton}<span class="nb-msg" role="status" aria-live="polite"></span></div></li>`;
  };
  const enlace = (e) => `<li class="fn-card fn-enl"><div class="fn-cab"><h4>${esc(e.titulo)}</h4>${e.activa === null ? '' : (e.activa ? '<b class="fn-on">✓ Encendida</b>' : '<b class="fn-off">– Apagada</b>')}</div><p>${esc(e.que)}</p><small class="fn-nota">Se cambia en ${esc(e.donde || (e.grupo ? 'Ajustes → ' + (GRUPO[e.grupo] || e.grupo) : ''))}.</small></li>`;

  async function pintar(pane) {
    pane.dataset.nube = 'nube-funciones';
    if (N.yo()?.rol !== 'admin') { pane.innerHTML = '<p class="sg-lead">Solo un administrador enciende o apaga las funciones nuevas.</p>'; return; }
    pane.innerHTML = '<p class="sg-lead">Cargando las funciones…</p>';
    const dibujar = async () => {
      const d = await api('/api/funciones');
      pane.innerHTML = `<p class="sg-lead">Funciones que se publicaron apagadas. Enciéndelas cuando quieras probarlas y apágalas igual: <b>nada se enciende solo</b>. El estado que ves es el real, leído del servidor.</p><ul class="fn-lista">${d.funciones.map(tarjeta).join('')}</ul><h3 class="nb-h">Ya tienen su sitio</h3><ul class="fn-lista">${d.enlaces.map(enlace).join('')}</ul>`;
    };
    try { await dibujar(); } catch (e) { pane.innerHTML = `<p class="nb-msg mal" role="alert">${esc(e.message)}</p>`; return; }
    if (pane._fn) return; pane._fn = true;
    pane.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button[data-fn]'); if (!b || b.disabled) return;
      const on = b.dataset.on === '1', msg = b.parentElement.querySelector('.nb-msg');
      const dec = (t, mal) => { msg.textContent = t; msg.classList.toggle('mal', !!mal); };
      if (!on && b.dataset.gasta === '1' && b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = 'Sí, encender (puede abrir gasto)'; return; }
      b.disabled = true; dec('Guardando…');
      try { await api('/api/funciones', { metodo: 'POST', cuerpo: { id: b.dataset.fn, activo: !on } }); await dibujar(); const nueva = pane.querySelector(`button[data-fn="${b.dataset.fn}"]`); const m2 = nueva?.parentElement.querySelector('.nb-msg'); if (m2) m2.textContent = on ? 'Apagada.' : 'Encendida. Recarga la página para verla funcionar.'; document.dispatchEvent(new CustomEvent('ao:funciones')); }
      catch (x) { b.disabled = false; dec(x.message, true); }
    });
  }
  window.AO_AJUSTES_EXTRA = (window.AO_AJUSTES_EXTRA || []).concat([{ key: 'nube-funciones', label: 'Funciones nuevas', render: (pane) => pintar(pane) }]);
})();

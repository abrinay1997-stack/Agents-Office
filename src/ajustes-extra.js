// Agents Office — Ajustes: «Restablecer oficina» y «Revisar lo que leí» (25 oct 2026). Un paquete SUELTO (dist/ajustes-extra.js): la página no crece. Lo trae el servidor (serve.mjs en la oficina local,
// el Worker en la nube) con una línea al final de la página, y se cuelga de Ajustes por donde ya lo hace la nube con «Mi perfil» y «Equipo»: window.AO_AJUSTES_EXTRA.
//  · «Revisar lo que leí»: la propuesta de «Preparar desde mi web» con lo que entra, lo que cambia y los CONFLICTOS con lo que el Cerebro ya dice (en ámbar); el dueño elige por nota y por dato.
//  · «Restablecer oficina»: dejar la oficina vacía o como viene de fábrica (PanaClaw), con casillas, confirmación en dos pasos y un respaldo que se puede restaurar 7 días.
// Solo un administrador las ve (en la nube, por /api/yo; en la oficina local siempre es el dueño). Todo texto del servidor se escapa.
(() => {
  'use strict';
  if (window.__ajustesExtra) return; window.__ajustesExtra = true;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const fecha = (ms) => new Date(ms).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function api(ruta, cuerpo) {
    const r = await fetch(ruta, { method: cuerpo === undefined ? 'GET' : 'POST', headers: cuerpo === undefined ? {} : { 'content-type': 'application/json' }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }).catch(() => { throw new Error('Sin conexión con la oficina. Revisa tu internet e inténtalo otra vez.'); });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || 'No se pudo completar.'), { status: r.status, datos: d });
    return d;
  }

  const CSS = `
  .ax-lead{font-size:13px;color:var(--grey);line-height:1.45;margin:0 0 12px}
  .ax h3{font-size:14px;margin:18px 0 8px}.ax small{font-size:12px}
  .ax-modos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}
  .ax-modo{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--hairline);border-radius:12px;padding:12px;cursor:pointer;min-height:44px}
  .ax-modo:has(input:checked){border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
  .ax-modo b{display:block;font-size:13.5px;margin-bottom:2px}.ax-modo span{font-size:12.5px;color:var(--grey);line-height:1.4}
  .ax-modo input,.ax-ck input{margin-top:3px;flex:none;width:18px;height:18px}
  .ax-ck{display:flex;gap:10px;align-items:flex-start;padding:8px 2px;min-height:44px;cursor:pointer;border-top:1px solid var(--hairline)}
  .ax-ck b{font-size:13px;font-weight:600}.ax-ck small{display:block;font-size:12px;color:var(--grey);line-height:1.35}
  .ax-ck em{font-style:normal;font-size:11.5px;color:var(--grey);white-space:nowrap}
  .ax-fila{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
  .ax-conserva{font-size:12.5px;color:var(--grey);border:1px dashed var(--hairline);border-radius:10px;padding:10px 12px;margin:12px 0;line-height:1.45}
  .ax-caja{border:1px solid var(--hairline);border-radius:12px;padding:12px 14px;margin:0 0 12px}
  .ax-caja.ambar{border-color:#B7791F;background:rgba(217,140,0,.10)}
  .ax-caja.rojo{border-color:#B3261E;background:rgba(179,38,30,.07)}
  .ax-resumen{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
  .ax-input{font:13.5px var(--ui);color:var(--ink);background:var(--cream);border:1px solid var(--hairline);border-radius:8px;padding:8px 10px;min-height:36px;width:min(260px,100%)}
  .ax-btn-pel{background:#B3261E!important;border-color:#B3261E!important;color:#fff!important}.ax-btn-pel[disabled]{opacity:.45;cursor:not-allowed}
  .ax-ped{font-size:11px;font-weight:700;letter-spacing:.04em;border-radius:99px;padding:2px 8px;border:1px solid var(--hairline);white-space:nowrap}
  .ax-ped.n{color:#13705A;border-color:#13705A}.ax-ped.d{color:#8A5200;border-color:#B7791F;background:rgba(217,140,0,.14)}.ax-ped.i{color:var(--grey)}
  .ax-nota{border:1px solid var(--hairline);border-radius:12px;padding:12px 14px;margin:0 0 12px}.ax-nota.conf{border-left:4px solid #B7791F}
  .ax-nota header{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.ax-nota header b{font-size:14px}
  .ax-opc{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0}.ax-opc label{display:flex;gap:6px;align-items:center;font-size:13px;min-height:32px;cursor:pointer}
  .ax-conf{background:rgba(217,140,0,.12);border:1px solid #B7791F;border-radius:10px;padding:8px 10px;margin:6px 0;font-size:12.5px;line-height:1.45}
  .ax-conf b,.ax-amb{color:#8A5200}.ax-conf .vs{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;margin:4px 0}.ax-conf code{font-size:12px;background:rgba(127,127,127,.16);padding:1px 5px;border-radius:5px}
  .ax-conf label{display:flex;gap:6px;align-items:center;min-height:28px;margin-top:4px}
  .ax-sin{font-size:12px;color:#B3261E}
  .ax details{margin:6px 0;font-size:12.5px}.ax details summary{cursor:pointer;min-height:28px;display:flex;align-items:center}.ax details pre{white-space:pre-wrap;font:12px/1.45 var(--ui);margin:4px 0 0;padding:8px;background:rgba(127,127,127,.1);border-radius:8px;max-height:200px;overflow:auto}
  .ax-lista{list-style:none;padding:0;margin:0}.ax-lista li{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--hairline);font-size:13px;flex-wrap:wrap}
  body.dark .ax-caja.ambar,body.dark .ax-conf{background:rgba(255,198,107,.10);border-color:#C9922E}body.dark .ax-conf b,body.dark .ax-amb,body.dark .ax-ped.d{color:#FFC66B}body.dark .ax-ped.n{color:#5FD3A8;border-color:#5FD3A8}
  body.dark .ax-sin{color:#FF8A80}body.dark .ax-btn-pel{background:#C62F26!important}body.dark .ax-nota.conf{border-left-color:#C9922E}
  @media (max-width:640px){.ax-modos{grid-template-columns:1fr}.ax-opc{flex-direction:column;gap:2px}}
  @media (prefers-reduced-motion:reduce){.ax *{transition:none!important}}`;
  const st = document.createElement('style'); st.id = 'axCss'; st.textContent = CSS; document.head.appendChild(st);

  const vivo = (pane, k) => pane.isConnected && pane.dataset.nube === k;
  const msgGlobal = (t, mal) => { const m = $('#setOv .sg-msg'); if (!m) return; m.textContent = t || ''; m.classList.toggle('bad', !!mal); };
  const irA = (tab) => { const b = $(`#setOv [data-tab="${tab}"]`); if (b) b.click(); };

  /* =====================================================  «Revisar lo que leí»  ===================================================== */
  let sondeo = null;
  const ESTADO_NOTA = { nueva: ['n', 'NUEVA'], distinta: ['d', 'DISTINTA A LA TUYA'], 'otra-carpeta': ['d', 'YA EXISTE EN OTRA CARPETA'], igual: ['i', 'IGUAL A LA TUYA'] };
  const TIPO_HECHO = { precio: 'Precio', telefono: 'Teléfono', correo: 'Correo', horario: 'Horario', direccion: 'Dirección' };
  const bloqueVs = (h) => `<div class="vs"><span>En tu Cerebro dice</span><span>${h.vs.map((v) => `<code>${esc(v.crudo)}</code> <small>(nota «${esc(v.nota)}»)</small>`).join(' · ')}</span><span>En tu web dice</span><span><code>${esc(h.crudo)}</code></span></div>`;

  function notaHTML(n) {
    const [clase, rot] = ESTADO_NOTA[n.estado] || ['i', n.estado];
    const conf = n.hechos.filter((h) => h.clase === 'distinto'), sin = n.hechos.filter((h) => h.sinRespaldo), contr = n.hechos.filter((h) => h.contradiceWeb);
    const porDefecto = n.estado === 'nueva' ? 'aplicar' : 'mio';
    const opciones = n.estado === 'igual' ? '<p class="ax-lead">Es lo mismo que ya tienes: no hay nada que aplicar.</p>'
      : `<div class="ax-opc" role="radiogroup" aria-label="Qué hacer con ${esc(n.titulo)}">${(n.estado === 'otra-carpeta' ? [['mio', 'Quedarme con lo mío'], ['ambos', 'Guardar ambos con fecha']] : [['aplicar', n.estado === 'nueva' ? 'Crear la nota' : 'Aplicar (la tuya queda respaldada)'], ['mio', 'Quedarme con lo mío'], ['ambos', 'Guardar ambos con fecha']])
        .map(([v, t]) => `<label><input type="radio" name="ax-${esc(n.clave)}" value="${v}"${v === porDefecto ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</div>`;
    const confs = conf.map((h) => `<div class="ax-conf"><b>${esc(TIPO_HECHO[h.tipo] || h.tipo)} distinto</b>${bloqueVs(h)}<label><input type="checkbox" data-hecho="${esc(h.id)}" data-nota="${esc(n.clave)}"> Usar lo de la web en esta nota <small>(si no, se queda lo tuyo y lo de la web espera en «por confirmar»)</small></label></div>`).join('');
    return `<section class="ax-nota${conf.length ? ' conf' : ''}" data-clave="${esc(n.clave)}"><header><b>${esc(n.titulo)}</b><span class="ax-ped ${clase}">${rot}</span>${conf.length ? `<span class="ax-ped d">${conf.length} EN CONFLICTO</span>` : ''}</header>
      ${n.existente ? `<small class="ax-lead">Ya tienes una nota «${esc(n.existente.nombre)}» en ${esc(n.existente.grupo)}.</small>` : ''}
      ${confs}${sin.length ? `<p class="ax-sin">⚠ ${sin.length} dato(s) que el modelo escribió no aparecen en la web: «${esc(sin.map((h) => h.crudo).join('», «'))}». No se usan.</p>` : ''}
      ${contr.length ? `<p class="ax-sin">⚠ Tu propia web dice dos cosas distintas para: ${esc(contr.map((h) => h.crudo).join(' / '))}.</p>` : ''}
      ${opciones}
      <details><summary>Ver el texto que propone (${n.texto.length} caracteres)</summary><pre>${esc(n.texto)}</pre></details>
      ${n.cambios && n.existente ? `<details><summary>Lo que cambia: ${n.cambios.nuevas.length} línea(s) nuevas · ${n.cambios.quitaria.length} se quitarían</summary>${n.cambios.nuevas.length ? `<pre>+ ${esc(n.cambios.nuevas.join('\n+ '))}</pre>` : ''}${n.cambios.quitaria.length ? `<pre>− ${esc(n.cambios.quitaria.join('\n− '))}</pre>` : ''}</details>` : ''}</section>`;
  }

  function propuestaHTML(p) {
    const ordenadas = [...p.notas].sort((a, b) => b.hechos.filter((h) => h.clase === 'distinto').length - a.hechos.filter((h) => h.clase === 'distinto').length);
    const r = p.resumen, nuevos = p.briefs.filter((b) => b.estado === 'nuevo'), ya = p.briefs.filter((b) => b.estado === 'ya-tiene'), cifras = p.cifras.filter((c) => !c.sinRespaldo && !c.yaEsta);
    const fuente = p.fuente.url ? `Leí <b>${p.fuente.paginas.length}</b> página(s) de <code>${esc(p.fuente.url)}</code>${p.fuente.about ? ' y lo que me contaste' : ''}.` : 'Usé lo que me contaste (no leí ninguna web).';
    return `<p class="ax-lead">${fuente} <b>Todavía no cambié nada en tu Cerebro.</b> Elige qué hacer con cada nota; lo que choque con lo que ya dice tu Cerebro está marcado en ámbar y, si no lo cambias, se queda lo tuyo.</p>
      ${p.avisos.length ? `<div class="ax-caja ${p.avisos.some((a) => a.nivel === 'alto') ? 'rojo' : 'ambar'}" role="alert"><ul class="ax-resumen">${p.avisos.map((a) => `<li>${esc(a.texto)}</li>`).join('')}</ul></div>` : ''}
      ${p.fuente.paginas.length ? `<details><summary>Páginas que leí (${p.fuente.paginas.length})${p.fuente.saltadas.length ? ` · ${p.fuente.saltadas.length} que no pude usar` : ''}</summary><pre>${esc(p.fuente.paginas.map((x) => '✓ ' + x.url + (x.titulo ? ' — ' + x.titulo : '')).concat(p.fuente.saltadas.map((x) => '✗ ' + x.url + ' — ' + x.motivo)).join('\n'))}</pre></details>` : ''}
      <div class="ax-caja"><b>${r.notas} nota(s)</b>: ${r.nuevas} nuevas, ${r.distintas} distintas de las que ya tienes · <b${r.conflictos ? ' class="ax-amb"' : ''}>${r.conflictos} dato(s) en conflicto con tu Cerebro</b></div>
      ${ordenadas.map(notaHTML).join('')}
      <h3>Instrucciones para los jefes</h3>
      ${ya.length ? `<p class="ax-lead">Estos jefes ya tienen sus instrucciones: no se cambian (${esc(ya.map((b) => b.lider).join(', '))}).</p>` : ''}
      ${nuevos.length ? `<label class="ax-ck"><input type="checkbox" id="axBriefs" checked><span><b>Dar instrucciones a ${nuevos.length} jefe(s) que todavía no tienen</b><small>${esc(nuevos.map((b) => b.lider).join(', '))}</small></span></label><details><summary>Ver lo que dirían</summary><pre>${esc(nuevos.map((b) => b.lider + ': ' + b.texto).join('\n\n'))}</pre></details>` : '<p class="ax-lead">No hay jefes sin instrucciones.</p>'}
      ${cifras.length ? `<h3>Cifras que sugiere la web</h3><p class="ax-lead">No cuentan para los agentes hasta que las confirmes en «por confirmar» (aquí abajo).</p>${cifras.map((c, i) => `<label class="ax-ck"><input type="checkbox" data-cifra="${esc(c.name)}" checked><span><b>${esc(c.name)}: ${esc(c.value)} ${esc(c.unit)}</b></span></label>`).join('')}` : ''}
      <div class="ax-fila"><button type="button" class="sg-btn pri" id="axAplicar">Aplicar lo que elegí</button><button type="button" class="sg-btn" id="axDescartar">Descartar esta propuesta</button></div>`;
  }

  function decisiones(pane) {
    const notas = {};
    for (const s of pane.querySelectorAll('.ax-nota')) {
      const clave = s.dataset.clave, r = s.querySelector('input[type=radio]:checked'); if (!r) continue;
      const web = {}; for (const c of s.querySelectorAll('input[data-hecho]:checked')) web[c.dataset.hecho] = true;
      notas[clave] = { accion: r.value, ...(Object.keys(web).length ? { web } : {}) };
    }
    const cif = [...pane.querySelectorAll('input[data-cifra]')];
    return { notas, briefs: pane.querySelector('#axBriefs') ? pane.querySelector('#axBriefs').checked : false, cifras: cif.filter((c) => c.checked).map((c) => c.dataset.cifra) };
  }

  function porConfirmarHTML(items) {
    if (!items.length) return '';
    return `<h3>Cifras por confirmar (${items.length})</h3><p class="ax-lead">Los agentes no las leen hasta que las confirmes.</p><ul class="ax-lista">${items.map((c) => `<li><span><b>${esc(c.name)}</b>: ${esc(c.value)} ${esc(c.unit)}<br><small>${esc(c.note || '')}</small></span><span><button type="button" class="sg-btn pri" data-confirmar="${esc(c.name)}">Confirmar</button> <button type="button" class="sg-btn" data-descartar-cifra="${esc(c.name)}">Descartar</button></span></li>`).join('')}</ul>`;
  }

  async function pintarRevisar(pane) {
    pane.dataset.nube = 'revisar-web';
    let g = null, cifras = [];
    pane.innerHTML = '<div class="ax"><p class="ax-lead">Leyendo…</p></div>';
    try { g = await api('/api/onboard/propuesta'); cifras = (await api('/api/cifras').catch(() => ({}))).porConfirmar || []; } catch (e) { if (vivo(pane, 'revisar-web')) pane.innerHTML = `<div class="ax"><p class="ax-lead">${esc(e.message)}</p></div>`; return; }
    if (!vivo(pane, 'revisar-web')) return;
    const p = g.propuesta;
    let cuerpo;
    if (g.corriendo) { cuerpo = '<p class="ax-lead" role="status">Estoy leyendo tu web y preparando la propuesta… tarda un par de minutos. Esta pantalla se actualiza sola.</p>'; esperar(pane); }
    else if (g.error && !p) cuerpo = `<div class="ax-caja rojo" role="alert">${esc(g.error)}</div><p class="ax-lead">Vuelve a «Preparar desde mi web» para intentarlo otra vez o cuéntame de tu empresa en el cuadro de texto.</p>`;
    else if (!p || p.estado === 'descartada') cuerpo = '<p class="ax-lead">No hay nada que revisar. Ve a «Preparar desde mi web», pon la dirección de tu web y pulsa «Leer mi web y preparar la oficina»: lo que lea llega aquí para que lo revises antes de que cambie nada.</p>';
    else if (p.estado === 'aplicada') cuerpo = `<div class="ax-caja" role="status"><b>Ya apliqué esta propuesta</b> (${fecha(p.aplicada.at)}): ${p.aplicada.escritas.length} nota(s) escritas${p.aplicada.saltadas?.length ? `. No toqué: ${esc(p.aplicada.saltadas.map((s) => s.nota + ' (' + s.motivo + ')').join('; '))}` : ''}.</div><div class="ax-fila"><button type="button" class="sg-btn" id="axDeshacer">Deshacer lo que apliqué</button></div>`;
    else cuerpo = propuestaHTML(p);
    pane.innerHTML = `<div class="ax">${cuerpo}${porConfirmarHTML(cifras)}</div>`;
    const raiz = pane.firstElementChild; // los oyentes van en lo que se vuelve a crear en cada pintada (el panel de Ajustes es el mismo elemento en todas las pestañas)
    const ya = async (fn, ok) => { try { const r = await fn(); msgGlobal(ok(r)); await pintarRevisar(pane); } catch (e) { msgGlobal(e.message, true); } };
    raiz.querySelector('#axAplicar')?.addEventListener('click', (ev) => { ev.target.disabled = true; ya(() => api('/api/onboard/aplicar', { id: p.id, decisiones: decisiones(raiz) }), (r) => `Listo: ${r.escritas.length} nota(s) escritas${r.saltadas?.length ? `, ${r.saltadas.length} sin tocar` : ''}.`).finally(() => { ev.target.disabled = false; }); });
    raiz.querySelector('#axDescartar')?.addEventListener('click', () => ya(() => api('/api/onboard/descartar', { id: p.id }), () => 'Propuesta descartada. Tu Cerebro no cambió.'));
    raiz.querySelector('#axDeshacer')?.addEventListener('click', () => ya(() => api('/api/onboard/deshacer', { id: p.id }), (r) => `Deshecho: ${r.restauradas} nota(s) volvieron a como estaban y ${r.quitadas} nueva(s) se quitaron.`));
    raiz.addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-confirmar]'), d = ev.target.closest('[data-descartar-cifra]');
      if (c) ya(() => api('/api/cifras/confirmar', { names: [c.dataset.confirmar] }), () => 'Cifra confirmada: desde ahora los agentes la usan.');
      if (d) ya(() => api('/api/cifras/confirmar', { names: [d.dataset.descartarCifra], descartar: true }), () => 'Cifra descartada.');
    });
  }
  function esperar(pane) { clearTimeout(sondeo); sondeo = setTimeout(() => { if (vivo(pane, 'revisar-web')) pintarRevisar(pane); }, 3500); }

  /** El botón «Leer mi web y preparar la oficina» de la página: en vez de escribir directo, deja una propuesta y lleva a revisarla. */
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest?.('#setOv [data-a="bootstrap"]'); if (!b) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const url = $('#sgUrl')?.value.trim() || '', about = $('#sgAbout')?.value.trim() || '';
    b.disabled = true;
    try { await api('/api/onboard/company', { url, about }); msgGlobal('Leyendo… te llevo a revisar lo que encuentre (no cambio nada hasta que tú lo apruebes).'); irA('revisar-web'); }
    catch (e) { msgGlobal(e.message, true); }
    finally { b.disabled = false; }
  }, true);

  /* =====================================================  «Restablecer oficina»  ===================================================== */
  async function pintarRestablecer(pane) {
    pane.dataset.nube = 'restablecer';
    pane.innerHTML = '<div class="ax"><p class="ax-lead">Leyendo…</p></div>';
    let d; try { d = await api('/api/restablecer'); } catch (e) { if (vivo(pane, 'restablecer')) pane.innerHTML = `<div class="ax"><p class="ax-lead">${esc(e.message)}</p></div>`; return; }
    if (!vivo(pane, 'restablecer')) return;
    let modo = null, marcadas = new Set(), pendiente = null;
    pane.innerHTML = '<div class="ax"></div>'; const raiz = pane.firstElementChild;
    const pinta = () => {
      const m = d.modos.find((x) => x.id === modo);
      raiz.innerHTML = `
        <p class="ax-lead">Devuelve la oficina a un punto de partida. <b>Antes de tocar nada se guarda un respaldo</b> que puedes restaurar durante ${d.diasRespaldo} días. Esto es solo para el administrador.</p>
        <div class="ax-modos" role="radiogroup" aria-label="A qué punto volver">${d.modos.map((x) => `<label class="ax-modo"><input type="radio" name="axModo" value="${esc(x.id)}"${modo === x.id ? ' checked' : ''}${x.disponible === false ? ' disabled' : ''}><span><b>${esc(x.nombre)}</b>${esc(x.descripcion)}${x.disponible === false ? `<br><i>${esc(x.motivo || 'No disponible aquí.')}</i>` : ''}</span></label>`).join('')}</div>
        ${modo ? `<h3>Qué se restablece</h3><div role="group" aria-label="Qué se restablece">${d.ambitos.map((a) => `<label class="ax-ck"><input type="checkbox" value="${esc(a.id)}"${marcadas.has(a.id) ? ' checked' : ''}><span style="flex:1"><b>${esc(a.nombre)}</b><small>${esc(modo === 'panaclaw' && a.ayudaFabrica ? a.ayudaFabrica : a.ayuda)}</small></span><em>${esc(a.actual || '')}</em></label>`).join('')}</div>
          <div class="ax-conserva"><b>Nunca se toca:</b> ${esc(d.conserva.join(' · '))}.</div>
          <div class="ax-fila"><button type="button" class="sg-btn pri" id="axRevisar"${marcadas.size ? '' : ' disabled'}>Revisar lo que va a pasar</button></div>` : '<p class="ax-lead">Elige a qué punto quieres volver.</p>'}
        ${pendiente ? `<div class="ax-caja ambar" role="alertdialog" aria-label="Confirmar el restablecimiento"><b>Esto es lo que va a pasar con «${esc(m?.nombre || '')}»:</b><ul class="ax-resumen">${pendiente.resumen.map((r) => `<li><b>${esc(r.nombre)}</b>: ${esc(r.texto)}</li>`).join('')}</ul>
          <p class="ax-lead" style="margin-top:8px">Se guarda un respaldo ahora mismo. Para seguir, escribe <b>RESTABLECER</b>.</p>
          <div class="ax-fila"><input class="ax-input" id="axPalabra" aria-label="Escribe RESTABLECER para confirmar" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="RESTABLECER"><button type="button" class="sg-btn pri ax-btn-pel" id="axConfirmar" disabled>Sí, restablecer ahora</button><button type="button" class="sg-btn" id="axCancelar">Cancelar</button></div></div>` : ''}
        <h3>Respaldos (${d.respaldos.length})</h3>${d.respaldos.length ? `<ul class="ax-lista">${d.respaldos.map((r) => `<li><span><b>${fecha(r.at)}</b> · ${esc(r.modoNombre || r.modo)}<br><small>${esc(r.resumen)} · se borra el ${fecha(r.vence)}</small></span><button type="button" class="sg-btn" data-restaurar="${esc(r.id)}">Restaurar este respaldo</button></li>`).join('')}</ul>` : '<p class="ax-lead">Todavía no hay respaldos. Se crea uno cada vez que restableces.</p>'}`;
    };
    const releer = async () => { d = await api('/api/restablecer'); pinta(); };
    pinta();
    raiz.addEventListener('change', (ev) => {
      if (ev.target.name === 'axModo') { modo = ev.target.value; marcadas = new Set(d.porDefecto[modo] || []); pendiente = null; pinta(); raiz.querySelector('input[name=axModo]:checked')?.focus(); return; }
      if (ev.target.matches('input[type=checkbox][value]')) { if (ev.target.checked) marcadas.add(ev.target.value); else marcadas.delete(ev.target.value); pendiente = null; const b = raiz.querySelector('#axRevisar'); if (b) b.disabled = !marcadas.size; raiz.querySelector('.ax-caja.ambar')?.remove(); }
    });
    raiz.addEventListener('input', (ev) => { if (ev.target.id === 'axPalabra') raiz.querySelector('#axConfirmar').disabled = ev.target.value.trim() !== 'RESTABLECER'; });
    raiz.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button'); if (!t) return;
      try {
        if (t.id === 'axRevisar') { t.disabled = true; const r = await api('/api/restablecer', { modo, ambitos: [...marcadas] }); pendiente = r.pendiente; pinta(); raiz.querySelector('#axPalabra')?.focus(); msgGlobal(''); }
        else if (t.id === 'axCancelar') { pendiente = null; pinta(); }
        else if (t.id === 'axConfirmar') {
          t.disabled = true; msgGlobal('Restableciendo… no cierres esta ventana.');
          const r = await api('/api/restablecer/confirmar', { token: pendiente.token, escribio: raiz.querySelector('#axPalabra').value.trim() });
          pendiente = null; modo = null; marcadas = new Set(); await releer(); msgGlobal(`Listo. Respaldo guardado hasta el ${fecha(r.respaldo.vence)}; si te arrepientes, restáuralo abajo. Recarga la página para ver la oficina nueva.`);
          document.dispatchEvent(new CustomEvent('ao:media-changed'));
        } else if (t.dataset.restaurar) {
          if (t.dataset.seguro !== '1') { t.dataset.seguro = '1'; t.textContent = 'Pulsa otra vez para restaurar'; setTimeout(() => { if (t.isConnected) { t.dataset.seguro = ''; t.textContent = 'Restaurar este respaldo'; } }, 5000); return; }
          t.disabled = true; const r = await api('/api/restablecer/deshacer', { id: t.dataset.restaurar }); await releer(); msgGlobal(`Restaurado: ${r.resumen}. Recarga la página para verlo.`);
        }
      } catch (e) { msgGlobal(e.message, true); if (t.isConnected) t.disabled = false; }
    });
  }

  /* =====================================================  se cuelgan de Ajustes  ===================================================== */
  async function registrar() {
    try { const yo = await fetch('/api/yo'); if (yo.ok) { const j = await yo.json(); if (j?.usuario?.rol && j.usuario.rol !== 'admin') return; } else if (yo.status === 401) return; } catch { return; }
    const lista = (window.AO_AJUSTES_EXTRA = Array.isArray(window.AO_AJUSTES_EXTRA) ? window.AO_AJUSTES_EXTRA : []);
    lista.push({ key: 'revisar-web', label: 'Revisar lo que leí', render: (pane) => { pintarRevisar(pane); } });
    lista.push({ key: 'restablecer', label: 'Restablecer oficina', render: (pane) => { pintarRestablecer(pane); } });
  }
  registrar();
})();

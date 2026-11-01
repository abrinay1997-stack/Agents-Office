/* Ajustes → Conectores (solo en la nube): añadir un servidor MCP remoto (Zapier, n8n, Make, Gmail…), verlo con su icono, probar la conexión y decidir qué herramientas se permiten.
   Todo lo valida el servidor; aquí solo se pinta y se manda. El token se manda UNA vez y no vuelve nunca: la página solo sabe si está puesto. */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N) return;
  const { api, esc } = N;
  const DEPTS = [['emails', 'Emails'], ['sales', 'Ventas'], ['marketing', 'Marketing'], ['ops', 'Operaciones'], ['fin', 'Contabilidad'], ['delivery', 'Entregas']];
  let LISTA = [], PLANT = [], CIFRADO = false, ERRORES = {}, FORM = null;
  const admin = () => N.yo()?.rol === 'admin';
  const slug = (t) => { let s = String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36); if (!/^[a-z]/.test(s)) s = 'c-' + s; return s.length >= 2 ? s : 'conector'; };
  const unico = (base) => { let n = base, i = 2; while (LISTA.some((c) => c.nombre === n)) n = base.slice(0, 36) + '-' + i++; return n; };
  const nombreDe = (c) => c.etiqueta || c.nombre;

  /** Estado en palabras: color Y texto Y qué hacer (nunca solo color). */
  function estado(c) {
    if (ERRORES[c.nombre]) return { k: 'mal', icono: '✕', txt: 'No conecta', que: ERRORES[c.nombre] };
    if (!c.activo) return { k: 'off', icono: '–', txt: 'Apagado', que: 'Enciéndelo para que los agentes lo usen.' };
    if (!c.tokenPuesto) return { k: 'aut', icono: '!', txt: 'Necesita su token', que: c.secreto ? `Guarda el secreto ${c.secreto} en GitHub y vuelve a desplegar, o pon el token aquí.` : 'Ábrelo con «Editar» y pon su token.' };
    return { k: 'ok', icono: '✓', txt: 'Listo', que: '' };
  }
  // Un conector sin logo en el registro (el que añadió el usuario) prueba el favicon de su propio dominio por el mismo origen (/api/icono-conector); si no hay, se queda con su monograma.
  const sinLogo = (c) => c.activo && (!c.plantilla || c.plantilla === 'otro'); // uno apagado no pide icono
  const hostDe = (u) => { try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname; } catch { return ''; } };
  const afinarIconos = (raiz) => raiz.querySelectorAll('img[data-fav]').forEach((img) => {
    const h = img.dataset.fav; img.removeAttribute('data-fav'); if (!h) return;
    const probe = new Image(); probe.onload = () => { img.src = probe.src; }; probe.src = `/api/icono-conector?host=${encodeURIComponent(h)}`; // si falla, no pasa nada: queda el monograma
  });
  const tarjeta = (c) => {
    const e = estado(c), n = c.herramientas_lectura.length, m = c.herramientas_envio.length;
    return `<li class="cn-card ${e.k}" data-n="${esc(c.nombre)}"><div class="cn-top"><img class="cn-ic" src="${esc(c.iconUri)}" alt="" width="40" height="40"${sinLogo(c) ? ` data-fav="${esc(hostDe(c.url))}"` : ''}><div class="cn-quien"><b>${esc(nombreDe(c))}</b><small>${esc(c.url.replace(/^https:\/\//, ''))}</small></div>
      <span class="cn-st ${e.k}"><i aria-hidden="true">${e.icono}</i> ${esc(e.txt)}</span></div>
      ${e.que ? `<p class="cn-que">${esc(e.que)}</p>` : ''}
      <p class="cn-meta">${c.departamentos.length ? c.departamentos.map((d) => esc((DEPTS.find((x) => x[0] === d) || [, d])[1])).join(', ') : '<span class="cn-vacio">Ningún departamento todavía</span>'} · ${n} de lectura${m ? ` · ${m} de envío (solo con tu OK)` : ''} · ${c.auth_tipo === 'ninguna' ? 'sin autenticación' : c.auth_tipo === 'cabecera' ? `cabecera ${esc(c.cabecera)}` : 'Bearer'}${c.tokenGuardado ? ' · token ••• guardado cifrado' : c.secreto ? ' · token en un secreto del Worker' : ''}</p>
      ${admin() ? `<div class="cn-acc"><button type="button" class="sg-btn" data-a="probar" data-n="${esc(c.nombre)}">Probar</button><button type="button" class="sg-btn" data-a="editar" data-n="${esc(c.nombre)}">Editar</button><button type="button" class="sg-btn" data-a="alternar" data-n="${esc(c.nombre)}">${c.activo ? 'Apagar' : 'Encender'}</button><button type="button" class="sg-btn" data-a="quitar" data-n="${esc(c.nombre)}">Quitar</button></div>` : ''}</li>`;
  };
  const lista = () => (LISTA.length ? `<ul class="cn-lista">${LISTA.map(tarjeta).join('')}</ul>` : `<div class="cn-nada"><b>Todavía no hay conectores.</b><p>Un conector es una puerta a otro servicio (Zapier, n8n, Gmail…). Añade el primero con «+ Añadir conector».</p></div>`);

  function pantalla() {
    return `<p class="sg-lead">Conecta servicios externos para que tus agentes lean —y, <b>solo con tu OK</b>, envíen— desde ellos. Cada conector se asigna a departamentos y solo se permiten las herramientas que marques. ${CIFRADO ? '' : '<b>Para guardar un token aquí falta el secreto <code>AO_CLAVE_CIFRADO</code>; mientras tanto, usa un secreto del Worker (MCP_…).</b>'}</p>
      <div class="cn-barra">${admin() ? '<button type="button" class="sg-btn pri" data-a="nuevo">+ Añadir conector</button>' : '<small>Solo un administrador añade o cambia conectores.</small>'}<span class="nb-msg" role="status" aria-live="polite"></span></div>
      <div id="cn-form">${FORM ? formulario() : ''}</div>
      <h3 class="nb-h">Tus conectores</h3>${lista()}`;
  }

  /* ---------- el formulario ---------- */
  function elegirPlantilla() {
    return `<section class="cn-nuevo" aria-label="Elige qué conectar"><div class="cn-cab"><h3>¿Qué quieres conectar?</h3><button type="button" class="sg-btn" data-a="cerrar">Cancelar</button></div>
      <ul class="cn-tiles">${PLANT.map((p) => `<li><button type="button" class="cn-tile" data-a="plantilla" data-id="${esc(p.id)}"><img src="${esc(p.iconUri)}" alt="" width="40" height="40"><span>${esc(p.nombre)}</span></button></li>`).join('')}</ul></section>`;
  }
  function formulario() {
    if (FORM.paso === 'elegir') return elegirPlantilla();
    const f = FORM, p = PLANT.find((x) => x.id === f.plantilla) || PLANT.at(-1), editar = !!f.existente;
    const pasos = p.pasos ? `<details class="cn-guia" open><summary>Cómo conectarlo en 3 pasos</summary><ol>${p.pasos.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></details>` : `<p class="cn-guia-u">${esc(p.pista)}${p.oauth ? ' <b>Este servicio suele pedir iniciar sesión con OAuth, algo que la oficina todavía no hace:</b> si tienes un token de acceso, pégalo aquí; si no, conéctalo a través de Zapier o n8n.' : ''}</p>`;
    return `<section class="cn-nuevo" aria-label="${editar ? 'Editar' : 'Añadir'} conector"><div class="cn-cab"><img src="${esc(p.iconUri)}" alt="" width="40" height="40"><h3>${editar ? 'Editar' : 'Añadir'}: ${esc(p.nombre)}</h3><button type="button" class="sg-btn" data-a="cerrar">Cancelar</button></div>
      ${pasos}
      <div class="sg-f"><label for="cn-etiqueta">Nombre que verás</label><input id="cn-etiqueta" maxlength="60" value="${esc(f.etiqueta)}"${editar ? '' : ' placeholder="' + esc(p.nombre) + '"'}></div>
      ${editar ? `<p class="cn-nota">Dirección: ${esc(f.urlVisible)} <small>(para cambiarla, quita el conector y añádelo de nuevo)</small></p>` : `<div class="sg-f"><label for="cn-url">Dirección del servidor MCP (https)</label><input id="cn-url" type="url" inputmode="url" autocapitalize="none" spellcheck="false" placeholder="https://…" value="${esc(f.url)}"><small>${esc(p.pista)}</small></div>`}
      <fieldset class="sg-f"><legend>Autenticación</legend>
        <label class="cn-rad"><input type="radio" name="cn-auth" value="bearer"${f.auth === 'bearer' ? ' checked' : ''}> Token (Bearer) <small>lo más común</small></label>
        <label class="cn-rad"><input type="radio" name="cn-auth" value="cabecera"${f.auth === 'cabecera' ? ' checked' : ''}> Cabecera propia <small>por ejemplo X-API-Key</small></label>
        <label class="cn-rad"><input type="radio" name="cn-auth" value="ninguna"${f.auth === 'ninguna' ? ' checked' : ''}> Sin autenticación <small>la dirección ya trae su permiso, o es pública</small></label></fieldset>
      <div class="sg-f" id="cn-cab"${f.auth === 'cabecera' ? '' : ' hidden'}><label for="cn-cabecera">Nombre de la cabecera</label><input id="cn-cabecera" maxlength="40" autocapitalize="none" spellcheck="false" placeholder="X-API-Key" value="${esc(f.cabecera)}"></div>
      <div id="cn-tok"${f.auth === 'ninguna' ? ' hidden' : ''}>
        <fieldset class="sg-f"><legend>Dónde vive el token</legend>
          <label class="cn-rad"><input type="radio" name="cn-donde" value="aqui"${f.donde === 'aqui' ? ' checked' : ''}${CIFRADO ? '' : ' disabled'}> Guardarlo aquí, cifrado ${CIFRADO ? '' : '<small>(falta AO_CLAVE_CIFRADO en Cloudflare)</small>'}</label>
          <label class="cn-rad"><input type="radio" name="cn-donde" value="secreto"${f.donde === 'secreto' ? ' checked' : ''}> Ya está (o lo guardaré) como secreto del Worker</label></fieldset>
        <div class="sg-f" id="cn-aqui"${f.donde === 'aqui' ? '' : ' hidden'}><label for="cn-token">Token</label><input id="cn-token" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${editar && f.tokenGuardado ? '••• guardado (escribe uno nuevo para reemplazarlo)' : 'Pégalo aquí'}"><small>Se guarda cifrado, no se vuelve a mostrar y no sale en ninguna pantalla. Sin la palabra «Bearer».</small></div>
        <div class="sg-f" id="cn-sec"${f.donde === 'secreto' ? '' : ' hidden'}><label for="cn-secreto">Nombre del secreto</label><input id="cn-secreto" maxlength="64" autocapitalize="characters" spellcheck="false" placeholder="MCP_${esc(slug(f.etiqueta || p.nombre).toUpperCase().replace(/-/g, '_').slice(0, 20))}_TOKEN" value="${esc(f.secreto)}"><small>Es el NOMBRE (empieza por MCP_), nunca el token. El token lo guardas en GitHub como secreto del repositorio y vuelves a desplegar.</small></div></div>
      <fieldset class="sg-f"><legend>Departamentos que lo usan</legend><div class="cn-deptos">${DEPTS.map(([k, n]) => `<label class="cn-chk"><input type="checkbox" name="cn-dep" value="${k}"${f.departamentos.includes(k) ? ' checked' : ''}> ${n}</label>`).join('')}</div></fieldset>
      <div class="sg-f"><label for="cn-dominios">Dominios que puede consultar</label><textarea id="cn-dominios" rows="3" maxlength="900" autocapitalize="none" spellcheck="false" placeholder="ejemplo.com">${esc(f.dominios || '')}</textarea><small>Uno por línea (ejemplo.com o *.ejemplo.com). Vacío = ninguno. Solo cuenta si el dueño enciende «Dominios por conector» en Ajustes → Seguridad. Lista corta y solo dominios propios de confianza: un dominio que deja subir o publicar texto sirve para sacar datos por la dirección.</small></div>
      <div class="cn-barra"><button type="button" class="sg-btn" data-a="probar-form">Probar conexión</button><span class="nb-msg" id="cn-pmsg" role="status" aria-live="polite"></span></div>
      <div id="cn-tools">${herramientas()}</div>
      <div class="cn-barra"><button type="button" class="sg-btn pri" data-a="guardar-form">${editar ? 'Guardar cambios' : 'Guardar conector'}</button><span class="nb-msg" id="cn-gmsg" role="status" aria-live="polite"></span></div></section>`;
  }
  function herramientas() {
    const t = FORM.tools; if (!t) return '';
    if (!t.length) return '<p class="cn-nota">La conexión funciona, pero el servidor no ofrece ninguna herramienta.</p>';
    const fila = (h) => `<li class="cn-h ${h.tipo}"><label><input type="checkbox" data-h="${esc(h.name)}" data-tipo="${h.tipo}"${FORM.marcadas.has(h.name) ? ' checked' : ''}> <b>${esc(h.name)}</b> <span class="cn-k ${h.tipo}">${h.tipo === 'lectura' ? 'lee' : 'envía'}</span></label>${h.descripcion ? `<small>${esc(h.descripcion)}</small>` : ''}</li>`;
    return `<h4 class="md-sub">Herramientas que encontré (${t.length})</h4><p class="cn-nota">«Lee» puede usarse en cualquier tarea. «Envía» solo corre en una ejecución que tú (administrador) hayas aprobado, y solo a quien salga en el borrador aprobado.</p><ul class="cn-hs">${t.map(fila).join('')}</ul>`;
  }
  function leerForm(pane) {
    const q = (s) => pane.querySelector(s);
    const f = FORM;
    f.etiqueta = q('#cn-etiqueta').value; if (q('#cn-url')) f.url = q('#cn-url').value.trim();
    f.auth = pane.querySelector('input[name=cn-auth]:checked')?.value || 'bearer'; f.cabecera = q('#cn-cabecera')?.value || '';
    f.donde = pane.querySelector('input[name=cn-donde]:checked')?.value || f.donde; f.secreto = q('#cn-secreto')?.value.trim() || ''; f.token = q('#cn-token')?.value || '';
    f.departamentos = [...pane.querySelectorAll('input[name=cn-dep]:checked')].map((x) => x.value);
    f.dominios = q('#cn-dominios')?.value ?? f.dominios ?? '';
    return f;
  }
  const cuerpoForm = (f, conTools) => {
    const b = { nombre: f.nombre, etiqueta: f.etiqueta || undefined, plantilla: f.plantilla === 'otro' ? undefined : f.plantilla, auth_tipo: f.auth, cabecera: f.auth === 'cabecera' ? f.cabecera : undefined, departamentos: f.departamentos, dominios_permitidos: String(f.dominios || '').split('\n').map((x) => x.trim()).filter(Boolean) };
    if (f.url) b.url = f.url;
    if (f.auth !== 'ninguna') { if (f.donde === 'secreto' && f.secreto) b.secreto = f.secreto; else if (f.token) b.token = f.token; }
    if (conTools) { const m = [...f.marcadas]; const t = f.tools || []; b.herramientas_lectura = t.filter((h) => h.tipo === 'lectura' && m.includes(h.name)).map((h) => h.name); b.herramientas_envio = t.filter((h) => h.tipo === 'envio' && m.includes(h.name)).map((h) => h.name); }
    return b;
  };

  async function cargar() { const [a, b] = await Promise.all([api('/api/conectores'), api('/api/conectores/plantillas')]); LISTA = a.conectores; CIFRADO = a.cifrado; PLANT = b.plantillas; }
  async function pintar(pane) {
    pane.dataset.nube = 'nube-conectores';
    try { await cargar(); } catch (e) { pane.innerHTML = `<p class="nb-msg mal" role="alert">${esc(e.message)}</p>`; return; }
    pane.innerHTML = pantalla(); afinarIconos(pane);
    if (pane._cn) return; pane._cn = true;
    const msg = (t, mal) => { const e = pane.querySelector('.cn-barra .nb-msg'); if (e) { e.textContent = t || ''; e.classList.toggle('mal', !!mal); } };
    const repintar = () => { pane.innerHTML = pantalla(); afinarIconos(pane); };
    const aviso = (id, t, mal) => { const e = pane.querySelector(id); if (e) { e.textContent = t || ''; e.classList.toggle('mal', !!mal); } };
    pane.addEventListener('change', (e) => {
      if (!FORM || FORM.paso === 'elegir') return;
      if (e.target.name === 'cn-auth') { leerForm(pane); pane.querySelector('#cn-cab').hidden = FORM.auth !== 'cabecera'; pane.querySelector('#cn-tok').hidden = FORM.auth === 'ninguna'; }
      if (e.target.name === 'cn-donde') { leerForm(pane); pane.querySelector('#cn-aqui').hidden = FORM.donde !== 'aqui'; pane.querySelector('#cn-sec').hidden = FORM.donde !== 'secreto'; }
      if (e.target.dataset?.h) { if (e.target.checked) FORM.marcadas.add(e.target.dataset.h); else FORM.marcadas.delete(e.target.dataset.h); }
    });
    pane.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a, n = b.dataset.n, c = LISTA.find((x) => x.nombre === n);
      try {
        if (a === 'nuevo') { FORM = { paso: 'elegir' }; repintar(); pane.querySelector('.cn-tile')?.focus(); return; }
        if (a === 'cerrar') { FORM = null; repintar(); return; }
        if (a === 'plantilla') { const p = PLANT.find((x) => x.id === b.dataset.id); FORM = { paso: 'datos', plantilla: p.id, etiqueta: p.id === 'otro' ? '' : p.nombre, url: '', auth: p.auth, cabecera: '', donde: CIFRADO ? 'aqui' : 'secreto', secreto: '', token: '', departamentos: [], tools: null, marcadas: new Set() }; repintar(); (pane.querySelector('#cn-url') || pane).focus?.(); return; }
        if (a === 'editar') {
          FORM = { paso: 'datos', existente: true, nombre: c.nombre, plantilla: c.plantilla || 'otro', etiqueta: c.etiqueta || '', urlVisible: c.url, url: '', auth: c.auth_tipo, cabecera: c.cabecera || '', donde: c.secreto ? 'secreto' : CIFRADO ? 'aqui' : 'secreto', secreto: c.secreto || '', tokenGuardado: c.tokenGuardado, token: '', departamentos: [...c.departamentos], dominios: (c.dominios_permitidos || []).join('\n'), tools: null, marcadas: new Set([...c.herramientas_lectura, ...c.herramientas_envio]) };
          FORM.tools = [...c.herramientas_lectura.map((x) => ({ name: x, tipo: 'lectura' })), ...c.herramientas_envio.map((x) => ({ name: x, tipo: 'envio' }))];
          repintar(); pane.querySelector('#cn-form').scrollIntoView?.({ block: 'start' }); return;
        }
        if (a === 'alternar') { await api(`/api/conectores/${n}`, { metodo: 'PATCH', cuerpo: { activo: !c.activo } }); delete ERRORES[n]; await cargar(); repintar(); msg(c.activo ? 'Apagado: los agentes ya no lo usan.' : 'Encendido.'); document.dispatchEvent(new CustomEvent('ao:conectores')); return; }
        if (a === 'quitar') {
          if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = '¿Seguro? Quitar'; setTimeout(() => { b.dataset.seguro = ''; b.textContent = 'Quitar'; }, 4000); return; }
          await api(`/api/conectores/${n}`, { metodo: 'DELETE' }); delete ERRORES[n]; await cargar(); repintar(); msg('Conector quitado (y su token, si lo guardabas aquí).'); document.dispatchEvent(new CustomEvent('ao:conectores')); return;
        }
        if (a === 'probar') {
          b.disabled = true; b.textContent = 'Probando…';
          const r = await api('/api/conectores/probar', { metodo: 'POST', cuerpo: { nombre: n, auth_tipo: c.auth_tipo, cabecera: c.cabecera || undefined } });
          if (r.ok) { delete ERRORES[n]; msg(`«${nombreDe(c)}» conecta: ${r.herramientas.length} herramientas (${r.lectura} de lectura, ${r.envio} de envío).`); } else { ERRORES[n] = r.error; }
          repintar(); return;
        }
        if (a === 'probar-form') {
          leerForm(pane); b.disabled = true; aviso('#cn-pmsg', 'Probando…');
          const r = await api('/api/conectores/probar', { metodo: 'POST', cuerpo: { nombre: FORM.existente ? FORM.nombre : undefined, url: FORM.url || undefined, auth_tipo: FORM.auth, cabecera: FORM.auth === 'cabecera' ? FORM.cabecera : undefined, token: FORM.donde === 'aqui' && FORM.token ? FORM.token : undefined } }).catch((x) => ({ ok: false, error: x.message }));
          b.disabled = false;
          if (!r.ok) { aviso('#cn-pmsg', r.error, true); return; }
          const antes = FORM.marcadas; FORM.tools = r.herramientas; FORM.marcadas = new Set(FORM.existente && antes.size ? antes : r.herramientas.filter((h) => h.tipo === 'lectura').map((h) => h.name));
          pane.querySelector('#cn-tools').innerHTML = herramientas(); aviso('#cn-pmsg', `Conecta: ${r.herramientas.length} herramientas (${r.lectura} de lectura, ${r.envio} de envío).`); return;
        }
        if (a === 'guardar-form') {
          leerForm(pane);
          if (!FORM.existente) FORM.nombre = unico(slug(FORM.etiqueta || (PLANT.find((p) => p.id === FORM.plantilla) || {}).nombre || 'conector'));
          if (!FORM.tools) { aviso('#cn-gmsg', 'Primero pulsa «Probar conexión» para elegir qué herramientas se permiten (o guárdalo sin herramientas y vuelve luego).', true); if (!FORM.confirmoSin) { FORM.confirmoSin = true; return; } }
          b.disabled = true; aviso('#cn-gmsg', 'Guardando…');
          await api('/api/conectores', { metodo: 'POST', cuerpo: cuerpoForm(FORM, true) });
          const nombre = FORM.nombre; FORM = null; delete ERRORES[nombre]; await cargar(); repintar(); msg('Guardado. Los agentes de esos departamentos lo usan desde su próxima tarea.'); document.dispatchEvent(new CustomEvent('ao:conectores'));
        }
      } catch (x) { if (b.isConnected) b.disabled = false; (FORM ? (a === 'guardar-form' ? aviso('#cn-gmsg', x.message, true) : aviso('#cn-pmsg', x.message, true)) : msg(x.message, true)); }
    });
  }
  window.AO_AJUSTES_EXTRA = (window.AO_AJUSTES_EXTRA || []).concat([{ key: 'nube-conectores', label: 'Conectores MCP', render: (pane) => pintar(pane) }]);
  window.AO_NUBE.abrirConectores = () => N.abrirAjustes('nube-conectores');
})();

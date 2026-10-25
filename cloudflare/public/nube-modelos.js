/* Ajustes → Modelos (solo en la nube, solo administradores): intercambia modelos a voluntad y por función, prueba uno, compara dos.
   Todo lo valida el servidor (modelos-core.mjs): aquí solo se pinta y se manda. Nunca se ve una llave: solo si está puesta. */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N) return;
  const { api, esc } = N;
  const FUNCIONES = [
    ['agentes', 'Agentes (todos)', 'Cuando una tarea corre en un agente sin modelo propio.', true],
    ['dimitri', 'Dimitri (chat, plan, estudio)', 'Conversa y propone; no usa herramientas.', false],
    ['redactar', 'Mejorar y redactar (Contenido, Anuncios)', 'Los botones «✨ Mejorar con…» y los textos de campañas.', false],
    ['resumen', 'Resumen del lunes e informes', 'El resumen semanal y los informes del mes.', false],
    ['enrutador', 'Enrutador (a qué agente va una tarea)', 'Una llamada corta: sirve un modelo pequeño y barato.', false],
    ['revision', 'Revisión del jefe', 'El jefe revisa lo delicado antes de que te llegue.', false],
  ];
  const DEPTS = [['emails', 'Emails'], ['sales', 'Ventas'], ['marketing', 'Marketing'], ['ops', 'Operaciones'], ['fin', 'Contabilidad'], ['delivery', 'Entregas']];
  const ROSTER = { sonnet: 'Sonnet', opus: 'Opus', fable: 'Fable' };
  let D = null, B = null, pruebas = {};
  const usd = (x) => (x == null ? '—' : x < 0.01 ? 'US$' + x.toFixed(4).replace('.', ',') : 'US$' + x.toFixed(2).replace('.', ','));
  const num = (x) => String(x).replace('.', ',');
  const porId = (id) => D.catalogo.find((m) => m.id === id);
  const precioTxt = (m) => (m.precio ? `US$${num(m.precio.in)} entrada · US$${num(m.precio.out)} salida por millón${m.precio.aproximado ? ' (aprox.)' : ''}` : 'sin precio conocido');
  const caps = (m) => `<ul class="md-caps" aria-label="Capacidades de ${esc(m.nombre)}"><li class="${m.herramientas ? 'si' : 'no'}">${m.herramientas ? '✓' : '✕'} herramientas</li><li class="${m.vision ? 'si' : 'no'}">${m.vision ? '✓' : '✕'} imágenes</li><li class="${m.razonamiento ? 'si' : 'no'}">${m.razonamiento ? '✓' : '✕'} razona</li></ul>`;
  const opciones = (sel, vacio) => `<option value=""${!sel ? ' selected' : ''}>${esc(vacio)}</option>` + ['anthropic', 'meta'].map((p) => { const l = D.catalogo.filter((m) => m.proveedor === p); return l.length ? `<optgroup label="${p === 'meta' ? 'Meta (Muse)' : 'Anthropic (Claude)'}">${l.map((m) => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(m.nombre)}${m.personalizado ? ' (propio)' : ''}</option>`).join('')}</optgroup>` : ''; }).join('');
  /** El aviso en palabras bajo un selector: si el modelo no usa herramientas y esa casilla las necesita. */
  const aviso = (id, herr) => { const m = id && porId(id); return m && herr && !m.herramientas ? `<small class="md-aviso" role="note">⚠ ${esc(m.nombre)} no usa herramientas: este agente solo podrá redactar. Si una tarea necesita sus conectores, la oficina la pasa a un modelo capaz y lo anota en la entrega.</small>` : ''; };
  const fila = (rotulo, ayuda, clave, valor, vacio, herr = false) => `<div class="md-fila"><label for="md-${esc(clave)}"><b>${esc(rotulo)}</b>${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</label><select id="md-${esc(clave)}" data-k="${esc(clave)}">${opciones(valor, vacio)}</select>${aviso(valor, herr)}</div>`;

  function html() {
    const a = D.ajustes;
    return `<p class="sg-lead">Elige qué modelo hace cada trabajo, y cámbialo cuando quieras. Vale desde la <b>próxima</b> tarea: lo que ya corre termina con el modelo con que empezó. Si una tarea, una rutina o el campo «modelo» de un agente ya tiene el suyo, ese gana (tarea &gt; rutina &gt; agente &gt; lo de aquí &gt; la oficina).</p>
    <h3 class="nb-h">Tus llaves</h3>
    <ul class="md-llaves">${D.proveedores.map((p) => `<li class="${p.llavePuesta ? 'ok' : 'falta'}"><b>${esc(p.nombre)}</b> <span>${p.llavePuesta ? '✓ llave puesta' : `✕ falta el secreto <code>${esc(p.llave)}</code>`}</span>${p.llavePuesta ? '' : '<small>Guárdalo como secreto del repositorio en GitHub y vuelve a desplegar; sin él esos modelos no responden.</small>'}</li>`).join('')}</ul>
    <h3 class="nb-h">Quién usa qué</h3>
    ${fila('Modelo de la oficina', 'El de todo lo que no tenga uno propio.', 'oficina', a.oficina, '— el de siempre (Sonnet) —', true)}
    <h4 class="md-sub">Por función</h4>
    ${FUNCIONES.map(([k, n, ay, herr]) => fila(n, ay, 'f:' + k, a.funciones[k], '— el de la oficina —', herr)).join('')}
    <div class="md-fila md-nota"><b>Entender video y audio</b><small>Lo hace Muse Spark por una ruta propia y todavía no se puede cambiar desde aquí.</small></div>
    <details class="md-det"><summary>Por departamento (${Object.keys(a.departamentos).length} con modelo propio)</summary>${DEPTS.map(([k, n]) => fila(n, '', 'd:' + k, a.departamentos[k], '— el de la función Agentes —', true)).join('')}</details>
    <details class="md-det"><summary>Por agente (${Object.keys(a.agentes).length} con modelo propio)</summary><p class="md-ayuda">Si el agente ya tiene su modelo en su ficha (Sonnet, Opus, Fable), ese gana.</p>${D.agentes.map((x) => fila(`${x.nombre} · ${(DEPTS.find((d) => d[0] === x.depto) || [, x.depto])[1]}`, x.modelo ? `En su ficha: ${ROSTER[x.modelo] || x.modelo} (gana a esto)` : '', 'a:' + x.id, a.agentes[x.id], '— el de su departamento —', true)).join('')}</details>
    <div class="md-barra"><button type="button" class="sg-btn pri" data-a="guardar">Guardar los modelos</button><span class="nb-msg" role="status" aria-live="polite"></span></div>
    <h3 class="nb-h">Catálogo</h3>
    <ul class="md-cat">${D.catalogo.map((m) => `<li class="md-m"><div class="md-m-cab"><b>${esc(m.nombre)}</b>${m.personalizado ? ' <small>(propio)</small>' : ''}<code>${esc(m.id)}</code></div><div class="md-m-pie">${caps(m)}<small>${esc(precioTxt(m))}</small>${m.nota ? `<small>${esc(m.nota)}</small>` : ''}</div>${m.personalizado ? `<button type="button" class="sg-btn" data-a="quitar-m" data-id="${esc(m.id)}">Quitar</button>` : ''}</li>`).join('')}</ul>
    <details class="md-det"><summary>+ Modelo personalizado (cuando salga uno nuevo)</summary>
      <p class="md-ayuda">Hoy la oficina habla con dos proveedores, cada uno en su dirección fija: Anthropic y Meta. Un modelo nuevo de esos dos se añade aquí con su id. Otro proveedor (OpenAI, Google…) necesita un adaptador en el Worker: no se inventa desde un formulario.</p>
      <div class="sg-f"><label for="md-pp">Proveedor</label><select id="md-pp"><option value="anthropic">Anthropic (Claude) — id «claude-…»</option><option value="meta">Meta (Muse) — id «muse-…»</option></select></div>
      <div class="sg-f"><label for="md-pid">Id del modelo</label><input id="md-pid" maxlength="64" autocapitalize="none" spellcheck="false" placeholder="claude-sonnet-6"></div>
      <div class="sg-f"><label for="md-pn">Nombre (opcional)</label><input id="md-pn" maxlength="60"></div>
      <div class="sg-f"><label for="md-pin">Precio de entrada (US$ por millón de tokens, opcional)</label><input id="md-pin" inputmode="decimal" placeholder="3"></div>
      <div class="sg-f"><label for="md-pout">Precio de salida (US$ por millón, opcional)</label><input id="md-pout" inputmode="decimal" placeholder="15"></div>
      <div class="sg-f"><label><input type="checkbox" id="md-ph" checked> Usa herramientas (Claude sí; Meta no)</label><label><input type="checkbox" id="md-pv"> Entiende imágenes</label><label><input type="checkbox" id="md-pr"> Razona antes de contestar</label></div>
      <button type="button" class="sg-btn" data-a="anadir-m">Añadir al catálogo</button></details>
    <h3 class="nb-h">Probar y comparar</h3>
    <p class="md-ayuda">Una pregunta corta para ver cómo contesta cada modelo, cuánto tarda y cuánto cuesta (como mucho 300 tokens de salida; unos centavos). No crea ninguna tarea.</p>
    <div class="sg-f"><label for="md-pedido">Tu pregunta (opcional; si la dejas vacía, una de ejemplo)</label><textarea id="md-pedido" rows="3" maxlength="600"></textarea></div>
    <div class="md-par"><div class="sg-f"><label for="md-A">Modelo A</label><select id="md-A">${opciones(pruebas.a || 'claude-sonnet-5-5', '')}</select></div><div class="sg-f"><label for="md-B">Modelo B</label><select id="md-B">${opciones(pruebas.b || 'muse-spark-1.3', '')}</select></div></div>
    <div class="md-barra"><button type="button" class="sg-btn" data-a="probar">Probar A</button><button type="button" class="sg-btn" data-a="comparar">Comparar A y B</button></div>
    <div class="md-res" id="md-res" aria-live="polite"></div>`;
  }
  const tarjeta = (r, rot) => r.ok
    ? `<article class="md-r"><h4>${esc(rot)}: ${esc(r.nombre || r.id)}</h4><p class="md-txt">${esc(r.texto)}</p><small>${(r.ms / 1000).toFixed(1).replace('.', ',')} s · ${r.tokens.entrada ?? '?'} → ${r.tokens.salida ?? '?'} tokens · ${usd(r.usd)}</small></article>`
    : `<article class="md-r mal"><h4>${esc(rot)}: ${esc(r.nombre || r.id || '')}</h4><p class="md-txt">✕ ${esc(r.error)}</p></article>`;
  const leer = (pane) => {
    const o = { personalizados: D.ajustes.personalizados, oficina: pane.querySelector('#md-oficina').value, funciones: {}, departamentos: {}, agentes: {} };
    for (const s of pane.querySelectorAll('select[data-k]')) {
      const [t, k] = s.dataset.k.split(':'); if (!k || !s.value) continue;
      ({ f: o.funciones, d: o.departamentos, a: o.agentes })[t][k] = s.value;
    }
    return o;
  };

  async function pintar(pane) {
    pane.dataset.nube = 'nube-modelos';
    if (N.yo()?.rol !== 'admin') { pane.innerHTML = '<p class="sg-lead">Solo un administrador elige los modelos de la oficina.</p>'; return; }
    pane.innerHTML = '<p class="sg-lead">Cargando los modelos…</p>';
    try { D = await api('/api/modelos'); } catch (e) { pane.innerHTML = `<p class="nb-msg mal" role="alert">${esc(e.message)}</p>`; return; }
    dibujar(pane);
    if (pane._md) return; pane._md = true;
    const msg = (t, mal) => { const e = pane.querySelector('.md-barra .nb-msg'); if (e) { e.textContent = t || ''; e.classList.toggle('mal', !!mal); } };
    pane.addEventListener('change', (e) => { const s = e.target.closest('select[data-k]'); if (!s) return; const f = s.closest('.md-fila'), herr = s.dataset.k === 'oficina' || /^(f:agentes|d:|a:)/.test(s.dataset.k); f.querySelector('.md-aviso')?.remove(); const h = aviso(s.value, herr); if (h) f.insertAdjacentHTML('beforeend', h); });
    pane.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
      try {
        if (a === 'guardar') { b.disabled = true; const r = await api('/api/modelos', { metodo: 'PUT', cuerpo: { ajustes: leer(pane) } }); D.ajustes = r.ajustes; msg(r.cambios.length ? `Guardado. Valen desde la próxima tarea: ${r.cambios.slice(0, 4).join('; ')}${r.cambios.length > 4 ? '…' : ''}.` : 'Sin cambios.'); document.dispatchEvent(new CustomEvent('ao:modelos')); }
        else if (a === 'anadir-m') {
          const p = { proveedor: pane.querySelector('#md-pp').value, id: pane.querySelector('#md-pid').value, nombre: pane.querySelector('#md-pn').value, in: pane.querySelector('#md-pin').value.replace(',', '.'), out: pane.querySelector('#md-pout').value.replace(',', '.'), herramientas: pane.querySelector('#md-ph').checked, vision: pane.querySelector('#md-pv').checked, razonamiento: pane.querySelector('#md-pr').checked };
          const o = leer(pane); o.personalizados = [...D.ajustes.personalizados, p];
          const r = await api('/api/modelos', { metodo: 'PUT', cuerpo: { ajustes: o } }); D = await api('/api/modelos'); dibujar(pane); msg(`Añadido: ${r.ajustes.personalizados.at(-1).id}.`); document.dispatchEvent(new CustomEvent('ao:modelos'));
        }
        else if (a === 'quitar-m') {
          if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = '¿Seguro? Quitar'; setTimeout(() => { b.dataset.seguro = ''; b.textContent = 'Quitar'; }, 4000); return; }
          const o = leer(pane); o.personalizados = D.ajustes.personalizados.filter((x) => x.id !== b.dataset.id);
          for (const g of ['funciones', 'departamentos', 'agentes']) for (const [k, v] of Object.entries(o[g])) if (v === b.dataset.id) delete o[g][k];
          if (o.oficina === b.dataset.id) o.oficina = '';
          await api('/api/modelos', { metodo: 'PUT', cuerpo: { ajustes: o } }); D = await api('/api/modelos'); dibujar(pane); msg('Quitado del catálogo (y de donde estaba asignado).'); document.dispatchEvent(new CustomEvent('ao:modelos'));
        }
        else if (a === 'probar' || a === 'comparar') {
          pruebas = { a: pane.querySelector('#md-A').value, b: pane.querySelector('#md-B').value, pedido: pane.querySelector('#md-pedido').value };
          const res = pane.querySelector('#md-res'); res.innerHTML = '<p>Preguntando…</p>'; b.disabled = true;
          try {
            if (a === 'probar') res.innerHTML = tarjeta(await api('/api/modelos/probar', { metodo: 'POST', cuerpo: { modelo: pruebas.a, pedido: pruebas.pedido } }).catch((x) => ({ ok: false, error: x.message })), 'A');
            else {
              const c = await api('/api/modelos/comparar', { metodo: 'POST', cuerpo: { a: pruebas.a, b: pruebas.b, pedido: pruebas.pedido } });
              if (b.dataset.listo !== '1') { res.innerHTML = `<p class="md-costo">${esc(c.aviso)}</p>`; b.dataset.listo = '1'; b.textContent = `Sí, comparar (hasta ${usd(c.costoMaximo)})`; setTimeout(() => { b.dataset.listo = ''; b.textContent = 'Comparar A y B'; }, 8000); return; }
              b.dataset.listo = ''; b.textContent = 'Comparar A y B';
              const r = await api('/api/modelos/comparar', { metodo: 'POST', cuerpo: { a: pruebas.a, b: pruebas.b, pedido: pruebas.pedido, confirmar: true } });
              res.innerHTML = `<div class="md-lado">${tarjeta(r.a, 'A')}${tarjeta(r.b, 'B')}</div>`;
            }
          } finally { b.disabled = false; }
        }
      } catch (x) { b.disabled = false; msg(x.message, true); }
    });
  }
  function dibujar(pane) { pane.innerHTML = html(); }

  /* ---------- el icono de los modelos junto al perfil ---------- */
  // La página dibuja UN logo (el del proveedor del modelo de la oficina: Claude o Meta). Si Ajustes → Modelos pone otros a trabajar (otro proveedor, o un modelo propio),
  // aquí se suman sus chips, y el título de la caja dice quién hace qué. Solo se dibujan modelos que de verdad están asignados, con o sin llave (sin llave, tachado).
  const tinta = (n) => { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 55% 32%)`; };
  const chipUri = (ini, color) => { const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="${color}"/><text x="20" y="26.5" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${ini.length > 1 ? 16 : 20}" font-weight="700" fill="#fff">${ini.replace(/[<>&"']/g, '')}</text></svg>`; let t = ''; for (const b of new TextEncoder().encode(svg)) t += String.fromCharCode(b); return 'data:image/svg+xml;base64,' + btoa(t); };
  let pintando = false;
  async function pintarActivos() {
    const box = document.getElementById('topmodels'); if (!box || pintando) return; pintando = true;
    try {
      const d = await api('/api/modelos/activos');
      box.querySelectorAll('.nb-mod').forEach((e) => e.remove());
      const principal = /meta/i.test(box.querySelector('img:not(.nb-mod)')?.alt || '') ? 'meta' : 'anthropic';
      const nombres = d.activos.map((m) => `${m.nombre}${m.llave ? '' : ' (sin llave)'}`);
      const extra = d.activos.filter((m) => m.proveedor !== principal || m.personalizado);
      const ya = new Set();
      for (const m of extra) {
        const clave = m.personalizado ? m.id : m.proveedor; if (ya.has(clave)) continue; ya.add(clave);
        const img = document.createElement('img'); img.className = 'nb-mod'; img.width = img.height = 24;
        img.src = m.personalizado ? chipUri((m.nombre.match(/[A-Za-z0-9]+/g) || ['?']).slice(0, 2).map((x) => x[0]).join('').toUpperCase(), tinta(m.id)) : chipUri(m.proveedor === 'meta' ? 'M' : 'C', m.proveedor === 'meta' ? '#1E40AF' : '#C2410C');
        img.alt = m.nombre; img.title = `Modelos en uso: ${nombres.join(' · ')}. Cámbialos en Ajustes → Modelos.`; if (!m.llave) img.style.opacity = '.45';
        box.appendChild(img);
      }
      const logo = box.querySelector('img:not(.nb-mod)'); if (logo && d.activos.length > 1) logo.title = `Modelos en uso: ${nombres.join(' · ')}. Cámbialos en Ajustes → Modelos.`;
    } catch { /* sin permiso o sin red: la página sigue con su logo */ } finally { pintando = false; }
  }
  document.addEventListener('ao:modelos', () => setTimeout(pintarActivos, 300));
  setTimeout(pintarActivos, 2500);
  { const box = document.getElementById('topmodels'); if (box) { const img = box.querySelector('img'); if (img) new MutationObserver(() => pintarActivos()).observe(img, { attributes: true, attributeFilter: ['alt', 'src'] }); } }
  window.AO_AJUSTES_EXTRA = (window.AO_AJUSTES_EXTRA || []).concat([{ key: 'nube-modelos', label: 'Modelos', render: (pane) => pintar(pane) }]);
})();

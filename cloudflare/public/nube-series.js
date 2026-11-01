/* Series de imágenes en la nube (N6): ver las series, su presupuesto, generar con la cifra a la vista, pausar, cancelar, el libro de lo gastado y las líneas «huérfanas» que hay que decidir.
   Una sola pantalla para escritorio (Ajustes → «Series de imágenes») y celular (Más → «Series de imágenes», src/movil/vistas/series.js: le pasa su conEstado). TODO lo decide el servidor (modulos/series.js):
   aquí solo se pinta y se manda. La cifra y el token de un solo uso los da el servidor; esta página nunca los inventa. Solo un administrador ve botones y dinero; los demás ven avances y estados.
   Los motores de pago siguen CERRADOS: aquí solo se generan series con el motor gratis «Prueba». Todo dato (títulos, motivos, claves) pasa por esc(). */
(() => {
  'use strict';
  const N = window.AO_NUBE; if (!N) return;
  const { api, esc } = N;
  const usd = (x) => (x == null || Number.isNaN(+x) ? '—' : 'US$' + (+x).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
  const ESTADO = { previsto: 'Preparada: todavía no se ha generado nada', espera_ok: 'Esperando tu confirmación', muestra: 'Generando la muestra', corriendo: 'Generando', pausado: 'En pausa', hecho: 'Terminada', cancelado: 'Cancelada' };
  const PLANO = { previsto: 'Por hacer', corriendo: 'Generándose ahora', listo: 'Lista', revisar: 'Para revisar', skipped: 'Omitido' };
  const LIBRO = { reservado: 'Reservado (en marcha)', liquidado: 'Gastado', liberado: 'Liberado: no se gastó', incierto: 'En duda: puede haberse cobrado' };
  const aviso = '<p class="sr-aviso" role="note">Con el motor gratis «Prueba» una serie no cuesta nada. Los motores de pago siguen cerrados: una serie con un modelo de pago no se genera desde aquí.</p>';
  const idem = () => 'sr' + Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  const url = (a) => '/media/' + String(a).split('/').map(encodeURIComponent).join('/');

  /** Si la página no trae el suyo (escritorio), un botón de acción con la misma regla que conEstado: aria-busy al instante, ✓ al terminar, el motivo y «Reintentar» si falla. */
  async function accionLocal(b, fn, o = {}) {
    if (b.getAttribute('aria-busy') === 'true') return { ok: false, ocupado: true };
    const antes = b.innerHTML; b.nextElementSibling?.classList?.contains('sr-err') && b.nextElementSibling.remove();
    b.setAttribute('aria-busy', 'true'); b.setAttribute('aria-disabled', 'true'); b.textContent = o.ocupado || 'Un momento…';
    try { const valor = await fn(); b.removeAttribute('aria-busy'); b.removeAttribute('aria-disabled'); b.textContent = '✓ ' + (o.hecho || 'Hecho'); setTimeout(() => { if (b.isConnected) b.innerHTML = antes; }, 900); return { ok: true, valor }; }
    catch (e) { b.removeAttribute('aria-busy'); b.removeAttribute('aria-disabled'); b.innerHTML = antes; const m = (e && e.message) || 'No se pudo.', s = document.createElement('span'); s.className = 'sr-err'; s.setAttribute('role', 'alert'); s.textContent = m; b.after(s); b.dataset.reintentar = '1'; return { ok: false, error: m }; }
  }

  /** UNA instancia por contenedor: abrir() sobre el mismo contenedor devuelve la que ya hay (y la repinta con su estado, sin perder una confirmación abierta). ocultar() para el sondeo; mostrar() lo reanuda; cerrar() quita todo. */
  function abrir(cont, { conEstado = null, movil = false } = {}) {
    if (cont._srInst && !cont._srInst.cerrada) { cont._srInst.mostrar(); return cont._srInst; }
    const acc = conEstado || accionLocal;
    const S = { lista: null, apagado: false, id: null, serie: null, libro: null, huer: null, vista: 'lista', conf: null, resolv: null, error: '', cargando: true };
    const admin = () => N.yo()?.rol === 'admin';
    let cerrada = false, visible = true, seq = 0, enVuelo = 0, temporizador = 0;
    const vivo = () => !cerrada && cont.isConnected && !!cont.querySelector(':scope > .sr-raiz'); // si otra pantalla se llevó el contenido del contenedor, esta instancia ya no pinta ni sondea
    const foco = () => { const h = cont.querySelector('[data-foco]'); if (h) h.focus({ preventScroll: true }); };

    /* ---------- datos ---------- */
    // Cada carga lleva su número: si llega una respuesta de una carga que ya no es la última (un «Actualizar» a mano, ocultar la pantalla), se descarta y no pisa nada.
    async function cargarLista(mi) {
      let lista = null, huer = null, apagado = false, error = '';
      try {
        const d = await api('/api/series'); lista = d.series || [];
        if (admin()) { try { huer = (await api('/api/series/libro/huerfanas')).huerfanas || []; } catch { huer = null; } }
      } catch (e) { if (/apagadas/.test(e.message)) apagado = true; else error = e.message; }
      if (mi !== seq) return false;
      if (lista) { S.lista = lista; S.huer = huer; } S.apagado = apagado; S.error = error; S.cargando = false; return true;
    }
    async function cargarSerie(id, mi) {
      let serie = null, libro = null, error = '';
      try { serie = (await api('/api/series/' + encodeURIComponent(id))).serie; if (admin() && S.verLibro) libro = (await api('/api/series/' + encodeURIComponent(id) + '/libro')).lineas; }
      catch (e) { error = e.message; }
      if (mi !== seq) return false;
      if (serie) { S.serie = serie; S.libro = libro; } S.error = error; S.cargando = false; return true;
    }
    /** `quieto`: lo pide el temporizador; no se solapa con una carga en curso y no repinta si hay una confirmación abierta. */
    async function recargar(quieto = false) {
      if (quieto && enVuelo) return;
      const mi = ++seq; enVuelo++; let aplicada;
      try { aplicada = S.vista === 'detalle' && S.id ? await cargarSerie(S.id, mi) : await cargarLista(mi); } finally { enVuelo--; }
      if (!aplicada) { if (vivo() && visible) programar(); return; } // una carga descartada (ocultar/mostrar con una petición en vuelo) no deja el sondeo muerto
      if (!vivo()) return;
      if (!(quieto && (S.conf || S.resolv))) pintar();
      programar();
    }
    const aLaVista = () => cont.isConnected && cont.getClientRects().length > 0; // el contenedor se ve de verdad (no display:none, no `hidden`): una pestaña de Ajustes que no está a la vista no sondea
    function programar() { // solo se sondea con la pantalla a la vista, la pestaña visible y una serie generando
      clearTimeout(temporizador);
      const vive = S.vista === 'detalle' ? ['muestra', 'corriendo'].includes(S.serie?.estado) : (S.lista || []).some((x) => ['muestra', 'corriendo'].includes(x.estado));
      if (vive && visible && !document.hidden && !cerrada && aLaVista()) temporizador = setTimeout(() => { if (!vivo()) return cerrar(); if (!aLaVista()) return; /* se reanuda con mostrar() */ if (visible && !document.hidden && !S.conf && !S.resolv) recargar(true); else programar(); }, 10000);
    }
    function ocultar() { visible = false; clearTimeout(temporizador); seq++; } // lo que venga en vuelo se descarta
    function mostrar() { visible = true; if (cerrada) return; pintar(); if (enVuelo) programar(); else recargar(true); } // con una carga en vuelo (descartada por ocultar) el sondeo se rearma aquí
    function cerrar() { if (cerrada) return; cerrada = true; clearTimeout(temporizador); seq++; cont.removeEventListener('click', alClic); cont.removeEventListener('keydown', alTecla); document.removeEventListener('visibilitychange', alVisibilidad); if (cont._srInst === inst) delete cont._srInst; }

    /* ---------- pantallas ---------- */
    const poner = (html) => { cont.innerHTML = `<div class="sr-raiz${movil ? ' sr-movil' : ''}" data-pantalla="${esc(S.vista)}">${html}</div>`; foco(); };
    const cargando = () => poner('<p class="sr-lead" role="status" aria-live="polite">Cargando las series…</p>');
    const fallo = (m) => poner(`<p class="sr-mal" role="alert"><b>No pude cargar.</b> ${esc(m)}</p><div class="sr-fila"><button type="button" class="sr-b" data-a="recargar" data-foco>Reintentar</button></div>`);
    const pApagado = () => poner(`<h3 class="sr-h" tabindex="-1" data-foco>Series de imágenes</h3><p class="sr-lead">Las series en la nube están <b>apagadas</b>. Mientras tanto siguen en la oficina de tu computadora.</p>
      <p>Para encenderlas, un administrador va a <b>Ajustes → Funciones nuevas → «Series de imágenes en la nube: ver y proponer»</b> y pulsa <b>Encender</b>. Encenderla no gasta nada: ver y proponer es gratis, y generar solo funciona con el motor gratis «Prueba».</p>
      ${!movil && N.abrirAjustes ? '<div class="sr-fila"><button type="button" class="sr-b pri" data-a="funciones">Abrir «Funciones nuevas»</button></div>' : ''}${aviso}`);

    function tarjeta(s) {
      const p = s.progreso || {}, g = s.gasto;
      return `<li class="sr-card"><button type="button" class="sr-abrir" data-a="abrir" data-id="${esc(s.id)}"><b>${esc(s.titulo || s.id)}</b><span class="sr-st sr-${esc(s.estado)}">${esc(ESTADO[s.estado] || s.estado)}</span></button>
        <p class="sr-meta">${p.listos ?? 0} de ${p.total ?? 0} imágenes listas${p.revisar ? ` · ${p.revisar} para revisar` : ''}${g ? ` · gastado ${usd(g.gastadoUsd)} de un tope de ${usd(g.topeUsd)}` : ''}</p>${s.pausa_motivo ? `<p class="sr-meta sr-pausa">Pausa: ${esc(s.pausa_motivo)}</p>` : ''}</li>`;
    }
    function pLista() {
      const hs = S.huer || [], avisoH = hs.length ? `<p class="sr-aviso sr-ojo" role="note"><b>${hs.length === 1 ? 'Hay 1 línea del libro' : `Hay ${hs.length} líneas del libro`} sin serie.</b> Siguen contando contra los topes hasta que decidas si se cobró. <button type="button" class="sr-b" data-a="huerfanas">Revisar</button></p>` : '';
      poner(`<h3 class="sr-h" tabindex="-1" data-foco>Series de imágenes</h3>${aviso}${avisoH}
        ${!admin() ? '<p class="sr-meta">Puedes ver cómo van. Generar, pausar y ver el dinero es de un administrador.</p>' : ''}
        ${S.lista.length ? `<ul class="sr-lista">${S.lista.map(tarjeta).join('')}</ul>` : '<p class="sr-vacio">Todavía no hay series. Pídele a Dimitri una serie de imágenes y aparecerá aquí.</p>'}
        <div class="sr-fila"><button type="button" class="sr-b" data-a="recargar">Actualizar</button></div>`);
    }

    function plano(p, puedeVer) {
      const img = puedeVer && p.imagen ? `<img class="sr-img" src="${esc(url(p.imagen))}" alt="${esc(p.descripcion || 'Plano ' + p.n)}" loading="lazy">` : `<span class="sr-img sr-sin" aria-hidden="true">${p.estado === 'corriendo' ? '…' : p.n}</span>`;
      return `<li class="sr-plano">${img}<div><b>Plano ${esc(p.n)}</b> <span class="sr-pe sr-${esc(p.estado)}">${esc(PLANO[p.estado] || p.estado)}</span><p class="sr-meta">${esc(p.descripcion || '')}</p><p class="sr-meta">${p.modelo ? `Modelo ${esc(p.modelo)}` : ''}${p.intento ? ` · intento ${esc(p.intento)}` : ''}</p>${p.motivo ? `<p class="sr-meta sr-pausa">${esc(p.motivo)}</p>` : ''}</div></li>`;
    }
    const sinDudar = (s) => !(s.pasos_inciertos || []).length;
    function presupuestoCaja(s) {
      const g = s.gasto; if (!g) return '';
      return `<section class="sr-sec" aria-labelledby="sr-pres"><h4 id="sr-pres">Presupuesto</h4><dl class="sr-dl"><div><dt>Tope de esta serie</dt><dd>${usd(g.topeUsd)}</dd></div><div><dt>Gastado</dt><dd>${usd(g.gastadoUsd)}</dd></div><div><dt>Reservado ahora</dt><dd>${usd(g.reservadoUsd)}</dd></div><div><dt>En duda</dt><dd>${usd(g.inciertoUsd)}</dd></div><div><dt>Disponible</dt><dd>${usd(g.disponibleUsd)}</dd></div></dl>
        ${g.excedido ? '<p class="sr-mal" role="note">Algún paso costó más de lo reservado. Está anotado en el libro.</p>' : ''}<p class="sr-meta">Al pedir el presupuesto verás además el tope del mes (carruseles) y el cupo del día del Estudio.</p></section>`;
    }
    function confCaja() {
      const c = S.conf; if (!c) return '';
      const e = c.confirmar;
      return `<section class="sr-conf" role="group" aria-labelledby="sr-ch"><h4 id="sr-ch" tabindex="-1" data-foco>${esc(c.modo === 'todo' ? 'Generar todas' : 'Probar con 3')}: confirma la cifra</h4><p>${esc(e.texto)}</p>
        <dl class="sr-dl"><div><dt>Costo máximo de esta tanda</dt><dd>${usd(e.costoMostradoUsd)}</dd></div><div><dt>Tope de la serie</dt><dd>${usd(e.topeUsd)}</dd></div>${e.topeMesUsd != null ? `<div><dt>Tope del mes (carruseles)</dt><dd>${usd(e.topeMesUsd)}</dd></div>` : ''}${e.estudio ? `<div><dt>Tope del Estudio al día / al mes</dt><dd>${e.estudio.dailyBudget ? usd(e.estudio.dailyBudget) : 'sin tope'} / ${e.estudio.monthlyBudget ? usd(e.estudio.monthlyBudget) : 'sin tope'}</dd></div><div><dt>Imágenes al día</dt><dd>${e.estudio.limit || 'sin tope'}</dd></div>` : ''}<div><dt>Planos</dt><dd>${esc(e.planos)}</dd></div></dl>
        <p class="sr-meta">Esta confirmación vale 2 minutos y se usa una sola vez. Si algo cambia, te pido otra con la cifra nueva.</p>
        ${c.error ? `<p class="sr-mal" role="alert">${esc(c.error)}</p>` : ''}<div class="sr-fila">${c.error ? `<button type="button" class="sr-b pri" data-a="presupuesto" data-modo="${esc(c.modo)}">Pedir la cifra otra vez</button>` : `<button type="button" class="sr-b pri" data-a="generar">Sí, generar — gasta hasta ${usd(e.costoMostradoUsd)}</button>`}<button type="button" class="sr-b" data-a="cancelar-conf">No, volver</button></div></section>`;
    }
    function resolvCaja() {
      const r = S.resolv; if (!r) return '';
      if (!r.conf) return `<section class="sr-conf" role="group" aria-labelledby="sr-rh"><h4 id="sr-rh" tabindex="-1" data-foco>Decidir el paso ${esc(r.n)}${r.titulo ? ' de «' + esc(r.titulo) + '»' : ''}</h4><p>El proveedor pudo haber cobrado este paso. ¿Se cobró? Es solo contabilidad y <b>no se puede deshacer</b>.</p>
        <label class="sr-lab" for="sr-real">Si se cobró, ¿cuánto fue de verdad? (US$, opcional: vacío = todo lo reservado${r.maxUsd != null ? ', ' + usd(r.maxUsd) : ''})</label><input id="sr-real" class="sr-in" inputmode="decimal" autocomplete="off" placeholder="0,25">
        <div class="sr-fila"><button type="button" class="sr-b pri" data-a="resolver-pedir" data-cobro="1">Sí se cobró</button><button type="button" class="sr-b" data-a="resolver-pedir" data-cobro="0">No se cobró</button><button type="button" class="sr-b" data-a="cancelar-resolv">Volver</button></div></section>`;
      return `<section class="sr-conf" role="group" aria-labelledby="sr-rh"><h4 id="sr-rh" tabindex="-1" data-foco>Confirma esta decisión</h4><p>${esc(r.conf.texto)}</p><p class="sr-meta">Vale 2 minutos, una sola vez. Es dinero: no se puede deshacer.</p>
        <div class="sr-fila"><button type="button" class="sr-b pri" data-a="resolver-ok">${r.conf.cobro ? `Sí, anotar ${usd(r.conf.cifraUsd)} de gasto` : 'Sí, no se cobró'}</button><button type="button" class="sr-b" data-a="cancelar-resolv">No, volver</button></div></section>`;
    }
    function libroCaja() {
      if (!admin()) return '';
      if (!S.verLibro) return '<div class="sr-fila"><button type="button" class="sr-b" data-a="libro">Ver lo que se gastó</button></div>';
      const ls = S.libro || [];
      return `<section class="sr-sec" aria-labelledby="sr-lb"><h4 id="sr-lb">Lo que se gastó</h4>${ls.length ? `<ul class="sr-libro">${ls.map((l) => `<li><b>Plano ${esc(l.n)} · intento ${esc(l.intento)}</b> — ${esc(LIBRO[l.estado] || l.estado)}: ${l.estado === 'liquidado' ? usd(l.realMicro / 1e6) : l.estado === 'liberado' ? 'US$0' : 'hasta ' + usd(l.maxMicro / 1e6)}${l.excedio ? ' <span class="sr-mal">(costó más de lo reservado)</span>' : ''}</li>`).join('')}</ul>` : '<p class="sr-vacio">Todavía no se gastó ni se reservó nada.</p>'}
        <p class="sr-meta">«Gastado» es lo que se anotó de verdad; «reservado» y «en duda» cuentan contra los topes hasta que se cierran.</p><div class="sr-fila"><button type="button" class="sr-b" data-a="libro-ocultar">Ocultar</button></div></section>`;
    }
    function acciones(s) {
      if (!admin()) return '<p class="sr-meta">Solo un administrador puede generar, pausar o cancelar.</p>';
      const e = s.estado, b = [];
      if (['previsto', 'espera_ok'].includes(e)) b.push('<button type="button" class="sr-b pri" data-a="presupuesto" data-modo="muestra">Probar con 3 (ver el presupuesto)</button>');
      if (e === 'muestra' && s.muestra_lista || e === 'pausado') b.push('<button type="button" class="sr-b pri" data-a="presupuesto" data-modo="todo">Generar todas (ver el presupuesto)</button>');
      if (['muestra', 'corriendo'].includes(e)) b.push('<button type="button" class="sr-b" data-a="pausar">Pausar</button>');
      if (!['hecho', 'cancelado'].includes(e)) b.push(S.pideCancelar ? '<button type="button" class="sr-b mal" data-a="cancelar-ok">Sí, cancelar la serie</button><button type="button" class="sr-b" data-a="cancelar-no">No, seguir</button>' : '<button type="button" class="sr-b mal" data-a="cancelar-pedir">Cancelar la serie</button>');
      return `<div class="sr-fila">${b.join('')}</div>${S.pideCancelar ? '<p class="sr-meta" role="note">Cancelar es definitivo. Lo que ya iba en el aire se pide cancelar; lo que termine igual se anota.</p>' : ''}`;
    }
    function pDetalle() {
      const s = S.serie, adm = admin(), p = s.progreso || {};
      const dudas = (s.pasos_inciertos || []).length ? `<section class="sr-sec" aria-labelledby="sr-du"><h4 id="sr-du">Pasos en duda</h4><p class="sr-meta">Pudo haberse cobrado y cuenta contra el tope hasta que lo decidas.</p><ul class="sr-libro">${s.pasos_inciertos.map((x) => `<li>Plano ${esc(x.n)} · intento ${esc(x.intento)}${adm && x.maxUsd != null ? ' · hasta ' + usd(x.maxUsd) : ''}${adm ? ` <button type="button" class="sr-b" data-a="decidir" data-clave="${esc(x.clave)}" data-n="${esc(x.n)}" data-max="${esc(x.maxUsd)}">Decidir</button>` : ''}</li>`).join('')}</ul></section>` : ''; // secrets-ok
      poner(`<div class="sr-fila"><button type="button" class="sr-b" data-a="volver">← Volver a la lista</button></div><h3 class="sr-h" tabindex="-1" data-foco>${esc(s.titulo || s.id)}</h3>
        <p><span class="sr-st sr-${esc(s.estado)}">${esc(ESTADO[s.estado] || s.estado)}</span> ${p.listos} de ${p.total} imágenes listas${p.revisar ? ` · ${p.revisar} para revisar` : ''}</p>${s.pausa_motivo ? `<p class="sr-aviso" role="note">Pausa: ${esc(s.pausa_motivo)}</p>` : ''}${aviso}
        ${adm ? presupuestoCaja(s) : ''}${confCaja()}${resolvCaja()}${dudas}${S.conf || S.resolv ? '' : acciones(s)}
        <section class="sr-sec" aria-labelledby="sr-pl"><h4 id="sr-pl">Planos</h4><ul class="sr-planos">${(s.escaleta || []).map((x) => plano(x, adm)).join('')}</ul></section>${libroCaja()}`);
    }
    function pHuerfanas() {
      const hs = S.huer || [], r = S.resolv;
      poner(`<div class="sr-fila"><button type="button" class="sr-b" data-a="volver">← Volver a la lista</button></div><h3 class="sr-h" tabindex="-1" data-foco>Líneas del libro sin serie</h3>
        <p class="sr-lead">Son pasos que reservaron dinero y ya no tienen serie que los cierre (por ejemplo, tras restablecer a Dimitri). Siguen contando contra los topes. Decide si el proveedor llegó a cobrar.</p>${r ? resolvCaja() : ''}
        ${hs.length ? `<ul class="sr-lista">${hs.map((h) => `<li class="sr-card"><b>Plano ${esc(h.n)} · intento ${esc(h.intento)} — ${esc(h.titulo ? '«' + h.titulo + '»' : 'una serie que ya no existe')}</b><p class="sr-meta">${esc(LIBRO[h.estado] || h.estado)} · hasta ${usd(h.maxUsd)} · hace ${esc(h.edadMin)} min</p>
          ${h.madura ? `<button type="button" class="sr-b" data-a="decidir" data-huerfana="1" data-clave="${esc(h.clave)}" data-n="${esc(h.n)}" data-max="${esc(h.maxUsd)}">Decidir</button>` : '<p class="sr-meta">Muy reciente: puede que su paso siga en marcha. Vuelve a mirar en unos minutos.</p>'}</li>`).join('')}</ul>` : '<p class="sr-vacio">No hay líneas sueltas. Todo lo reservado lo lleva una serie.</p>'}`); // secrets-ok
    }
    function pintar() {
      if (S.cargando) return cargando();
      if (S.apagado) return pApagado();
      if (S.error && S.vista !== 'detalle' && !S.lista) return fallo(S.error);
      if (S.vista === 'detalle') return S.serie ? pDetalle() : fallo(S.error || 'No encuentro esa serie.');
      if (S.vista === 'huerfanas') return pHuerfanas();
      pLista();
    }

    /* ---------- acciones ---------- */
    const dentro = (b) => b.dataset.a;
    async function hacer(b) {
      const a = dentro(b); if (!a) return;
      if (a === 'recargar') { S.cargando = true; pintar(); return recargar(); }
      if (a === 'funciones') return N.abrirAjustes('nube-funciones');
      if (a === 'abrir') { S.id = b.dataset.id; S.vista = 'detalle'; S.serie = null; S.verLibro = false; S.conf = S.resolv = null; S.pideCancelar = false; S.cargando = true; pintar(); return recargar(); }
      if (a === 'volver') { S.vista = 'lista'; S.id = null; S.serie = null; S.conf = S.resolv = null; S.cargando = true; pintar(); return recargar(); }
      if (a === 'huerfanas') { S.vista = 'huerfanas'; S.resolv = null; pintar(); return; }
      if (a === 'libro') { S.verLibro = true; const r = await acc(b, () => api('/api/series/' + encodeURIComponent(S.id) + '/libro'), { ocupado: 'Leyendo…', hecho: 'Listo', ms: 300 }); if (r.ok) { S.libro = r.valor.lineas; pintar(); } return; }
      if (a === 'libro-ocultar') { S.verLibro = false; S.libro = null; return pintar(); }
      if (a === 'presupuesto') { const modo = b.dataset.modo; const r = await acc(b, () => api(`/api/series/${encodeURIComponent(S.id)}/presupuesto`, { metodo: 'POST', cuerpo: { modo } }), { ocupado: 'Calculando…', hecho: 'Listo', ms: 300 }); if (r.ok) { S.conf = { ...r.valor, modo }; pintar(); } return; }
      if (a === 'cancelar-conf') { S.conf = null; return pintar(); }
      if (a === 'generar') {
        const c = S.conf, e = c.confirmar, ruta = (c.modo === 'todo' && ['muestra', 'pausado'].includes(S.serie.estado)) ? 'continuar' : 'generar';
        const r = await acc(b, () => api(`/api/series/${encodeURIComponent(S.id)}/${ruta}`, { metodo: 'POST', cuerpo: { confirmacion: e.token, costoMostradoUsd: e.costoMostradoUsd, modo: c.modo }, cabeceras: { 'Idempotency-Key': idem() } }), { ocupado: 'Autorizando…', hecho: 'Autorizada' });
        if (r.ok) { S.conf = null; N.aviso?.('Autorizada: empieza en el próximo minuto.'); setTimeout(() => vivo() && recargar(), 900); } else if (!r.ocupado) { S.conf.error = r.error; setTimeout(() => vivo() && S.conf && pintar(), 1200); } // si la confirmación ya no vale (venció, cambió la cifra), se dice y se ofrece pedirla otra vez
        return;
      }
      if (a === 'pausar') { const r = await acc(b, () => api(`/api/series/${encodeURIComponent(S.id)}/pausar`, { metodo: 'POST', cuerpo: {} }), { ocupado: 'Pausando…', hecho: 'Pausada' }); if (r.ok) setTimeout(() => vivo() && recargar(), 700); return; }
      if (a === 'cancelar-pedir') { S.pideCancelar = true; return pintar(); }
      if (a === 'cancelar-no') { S.pideCancelar = false; return pintar(); }
      if (a === 'cancelar-ok') { const r = await acc(b, () => api(`/api/series/${encodeURIComponent(S.id)}/cancelar`, { metodo: 'POST', cuerpo: {} }), { ocupado: 'Cancelando…', hecho: 'Cancelada' }); S.pideCancelar = false; if (r.ok) setTimeout(() => vivo() && recargar(), 700); return; }
      if (a === 'decidir') { S.resolv = { clave: b.dataset.clave, n: b.dataset.n, maxUsd: +b.dataset.max, huerfana: !!b.dataset.huerfana, titulo: S.serie?.titulo || '', conf: null }; return pintar(); }
      if (a === 'cancelar-resolv') { S.resolv = null; return pintar(); }
      if (a === 'resolver-pedir') {
        const r0 = S.resolv, cobro = b.dataset.cobro === '1', campo = cont.querySelector('#sr-real'), txt = (campo?.value || '').trim().replace(',', '.'), real = cobro && txt ? Number(txt) : 0;
        if (cobro && txt && (!Number.isFinite(real) || real < 0)) { N.aviso?.('Escribe un número, por ejemplo 0,25.'); campo?.focus(); return; }
        // la cifra y el token los da SIEMPRE el servidor: el primer envío no ejecuta y contesta con el texto (200 en una línea huérfana, 409 «confirmar» en el paso de una serie que existe)
        const ruta = r0.huerfana ? '/api/series/libro/resolver' : `/api/series/${encodeURIComponent(S.id)}/resolver`;
        const pedir = async () => { try { return await api(ruta, { metodo: 'POST', cuerpo: { clave: r0.clave, cobro, realUsd: real } }); } catch (e) { if (e.datos?.confirmar) return e.datos; throw e; } };
        const r = await acc(b, pedir, { ocupado: 'Calculando…', hecho: 'Listo', ms: 300 });
        if (r.ok) { r0.conf = { ...r.valor.confirmar, real }; pintar(); }
        return;
      }
      if (a === 'resolver-ok') {
        const r0 = S.resolv, c = r0.conf;
        const peticion = () => api(r0.huerfana ? '/api/series/libro/resolver' : `/api/series/${encodeURIComponent(S.id)}/resolver`, { metodo: 'POST', cuerpo: { clave: r0.clave, cobro: c.cobro, realUsd: c.real || 0, confirmacion: c.token } });
        const r = await acc(b, peticion, { ocupado: 'Anotando…', hecho: 'Anotado' });
        if (r.ok) { S.resolv = null; setTimeout(() => vivo() && recargar(), 700); }
      }
    }

    function alClic(ev) { const b = ev.target.closest('button[data-a]'); if (b && cont.contains(b)) { if (b.dataset.reintentar) b.removeAttribute('data-reintentar'); hacer(b); } }
    function alTecla(ev) { // Escape cancela una confirmación abierta y devuelve el foco al detalle
      if (ev.key !== 'Escape') return; if (S.conf) { S.conf = null; ev.stopPropagation(); pintar(); } else if (S.resolv) { S.resolv = null; ev.stopPropagation(); pintar(); }
    }
    function alVisibilidad() { if (document.hidden) clearTimeout(temporizador); else if (visible && vivo() && aLaVista()) recargar(true); }
    cont.addEventListener('click', alClic); cont.addEventListener('keydown', alTecla); document.addEventListener('visibilitychange', alVisibilidad);
    const inst = { recargar, mostrar, ocultar, cerrar, get cerrada() { return cerrada; }, get ocupada() { return enVuelo > 0; } };
    cont._srInst = inst;
    pintar();
    recargar();
    return inst;
  }

  N.series = { abrir };
  window.AO_AJUSTES_EXTRA = (window.AO_AJUSTES_EXTRA || []).concat([{ key: 'nube-series', label: 'Series de imágenes', render: (pane) => { pane.dataset.nube = 'nube-series'; abrir(pane); } }]);
})();

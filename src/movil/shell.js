// Versión móvil (25 oct 2026) — EL ARMAZÓN de la versión móvil: cabecera compacta, barra de pestañas inferior, hojas, avisos y las
// vistas que se le registran. Es una versión PROPIA para teléfonos (≤ 820 px), no la de escritorio encogida: la página la trae bajo
// demanda (dist/movil.js, src/movil-carga.js) y la de escritorio no cambia. Las reglas del diseño están en CLAUDE.md → «La versión móvil».
//
// ─── API PARA PORTAR UNA VISTA ───────────────────────────────────────────────────────────────────────────────────────────────────
//   shell.registrarVista({
//     id: 'cerebro',              único; si coincide con una entrada de escritorio (escritorio.js) la REEMPLAZA en «Más»
//     titulo: 'Cerebro',          lo que dice la cabecera (o una función)
//     icono: 'cerebro',           nombre de ui.js → ICONOS (o añade uno)
//     grupo: 'tab' | 'mas' | 'oculta',   'tab' solo las cinco de la barra; 'mas' aparece en la hoja «Más»; 'oculta' se abre con navegar()
//     texto: 'Tus notas',         (grupo 'mas') la línea gris bajo el nombre
//     montar(el, ctx),            una vez, la primera vez que se abre; `el` es un <section> vacío que tú llenas
//     alMostrar(el, ctx, params), cada vez que se ve (refresca aquí)         alOcultar(el, ctx)      al irse
//     abrir(ctx)                  (solo 'tab' sin pantalla propia, como «Más») se llama en lugar de mostrar nada
//   })
//   ctx (el mismo objeto en toda tu vista):
//     ctx.api(ruta, { method, body }) → JSON       fetch con la sesión; errores en palabras; 401 recarga; marca «sin conexión»
//     ctx.store                                    { st: { tareas, rutinas, status }, refrescar(), alCambiar(fn), aprobaciones }
//     ctx.hoja({ titulo, cuerpo, acciones, lleno, alCerrar }) → h      hoja inferior (arrastrable; «atrás» la cierra)
//     ctx.confirmar({ titulo, texto, ok, peligro }) → Promise<boolean>
//     ctx.toast(texto, { accion: 'Deshacer', alAccion, ms })          aviso abajo, sobre la barra de pestañas
//     ctx.navegar(id, params) · ctx.volver()                           ir a otra vista (las 'tab' cambian de pestaña; el resto es una pantalla con «atrás»)
//     ctx.escritorio(id)                                               abre una vista de escritorio en el contenedor con «Volver»
//     ctx.cabecera({ titulo, acciones: [{ icono, etiqueta, alTocar }] })   cambia el título y los botones de la derecha de TU vista
//     ctx.tirar(scroller, fn)                                          tirar hacia abajo para refrescar (fn → Promise)
//     ctx.contexto(fn) · ctx.viendo()                                  una vista dice qué está mirando ({view, kind, id, label}); Dimitri lo lee para su chip «Viendo»
//     ctx.esc · ctx.svg · ctx.vacio · ctx.esqueleto · ctx.falla         (ui.js)
// Reglas: objetivos ≥ 44 px, campos ≥ 16 px, nada de :hover, solo clases `mv-*`, colores de las variables `--mv-*` (claro y oscuro).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { TABS, RAIZ, leerHash, aHash, pestanaDe, crearPila, esGestoVolver, tiraRefrescar } from './nav.js';
import { crearHojas } from './hoja.js';
import { crearApi, crearStore } from './datos.js';
import { ESCRITORIO, GRUPOS } from './escritorio.js';
import { esc, svg, vacio, esqueleto, falla, html } from './ui.js';

export function crearShell() {
  const registro = new Map(), pila = crearPila();
  let franjaNo = false, tab = RAIZ, pantalla = null, enlinea = true, raiz = null, hojas = null, store = null, api = null, activo = false;
  const cab = new Map(); // id de vista → { titulo, acciones } que puso la vista
  const prov = new Map(); let previa = null; // id de vista → () => { view, label, kind, id } (lo que está mirando, para el chip «Viendo» de Dimitri) · la última vista que se vio antes de Dimitri
  const refs = {};

  const $ = s => raiz.querySelector(s);
  // ---- el armazón del DOM ----
  function construir() {
    raiz = document.createElement('div'); raiz.id = 'mvRoot'; raiz.setAttribute('data-shell', '');
    raiz.innerHTML = `
      <header class="mv-bar" role="banner">
        <button type="button" class="mv-ic mv-atras" aria-label="Volver" hidden>${svg('atras')}</button>
        <h1 class="mv-titulo" id="mvTitulo">Inicio</h1>
        <div class="mv-bar-der">
          <span class="mv-conex" role="status" hidden>Sin conexión</span>
          <span class="mv-acc" id="mvAcc"></span>
          <button type="button" class="mv-ic mv-buscar" aria-label="Buscar en la oficina">${svg('buscar')}</button>
          <button type="button" class="mv-pend" id="mvAprob" hidden></button>
        </div>
      </header>
      <main class="mv-main" id="mvMain" tabindex="-1"></main>
      <div class="mv-franja" hidden><button type="button" class="mv-franja-b" data-ver></button><button type="button" class="mv-ic" data-no aria-label="Ocultar este aviso">${svg('cerrar')}</button></div>
      <nav class="mv-tabs" aria-label="Secciones">${TABS.map(t => `<button type="button" class="mv-tab" data-tab="${t.id}" aria-current="false">${svg(t.id)}<span>${esc(t.titulo)}</span><i class="mv-punto" hidden></i></button>`).join('')}</nav>
      <div class="mv-toasts" aria-live="polite" role="status"></div>`;
    document.body.append(raiz);
    refs.main = $('#mvMain'); refs.titulo = $('#mvTitulo'); refs.atras = $('.mv-atras'); refs.aprob = $('#mvAprob'); refs.acc = $('#mvAcc'); refs.conex = $('.mv-conex'); refs.toasts = $('.mv-toasts');
    refs.atras.addEventListener('click', volver);
    $('.mv-franja').addEventListener('click', e => { if (e.target.closest('[data-no]')) { franjaNo = true; pintarCabecera(); } else if (e.target.closest('[data-ver]')) navegar('aprobaciones'); });
    refs.aprob.addEventListener('click', () => navegar('aprobaciones'));
    $('.mv-buscar').addEventListener('click', () => abrirEscritorio('buscar'));
    $('.mv-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) irPestana(b.dataset.tab, b); });
    refs.acc.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const c = cab.get(pantalla || tab); c?.acciones?.[+b.dataset.i]?.alTocar?.(b); });
  }

  // ---- el historial: cada capa abierta (hoja, pantalla, contenedor de escritorio) es una entrada; «atrás» cierra la de arriba ----
  function empujar(capa) { pila.push(capa); try { history.pushState({ mv: pila.largo }, '', location.href); } catch {} pintar(); }
  function soltar(capa) {
    if (capa !== pila.cima()) { if (pila.quitar(capa)) { capa.destruir(); pintar(); } return; }
    let hecho = false; const t = setTimeout(() => { if (!hecho && pila.quitar(capa)) { capa.destruir(); pintar(); } }, 350);
    capa._esperando = () => { hecho = true; clearTimeout(t); };
    try { history.back(); } catch { clearTimeout(t); if (pila.quitar(capa)) { capa.destruir(); pintar(); } }
  }
  function alPopState(e) {
    const n = (e.state && e.state.mv) || 0;
    while (pila.largo > n) { const c = pila.pop(); c._esperando?.(); c.destruir(); }
    pintar();
  }
  function cerrarTodas() { const n = pila.largo; while (pila.largo) { const c = pila.pop(); c.destruir(); } if (n) { try { history.go(-n); } catch {} } }


  // ---- las vistas ----
  function registrarVista(def) { if (!def || !def.id) throw new Error('registrarVista: falta el id'); registro.set(def.id, { def, el: null, ctx: null, montada: false }); }
  const reemplazadas = () => new Set([...registro.keys()]);
  const entradasEscritorio = () => ESCRITORIO.filter(x => !reemplazadas().has(x.id));

  function ctxDe(id) {
    const ctx = {
      id, api, store, esc, svg, vacio, esqueleto, falla, html,
      hoja: o => hojas.abrir(o), confirmar: o => hojas.confirmar(o), toast, navegar, volver, escritorio: abrirEscritorio,
      cabecera: o => { cab.set(id, { ...(cab.get(id) || {}), ...o }); if ((pantalla || tab) === id) pintarCabecera(); },
      tirar: tirarParaRefrescar,
      contexto: fn => { prov.set(id, fn); },   // la vista dice qué está mirando: { view, label, kind?, id? } (los nombres de view son los de la oficina: tareas, cal, contenido…)
      viendo: () => viendo(),                   // lo que se miraba antes de abrir esta vista (Dimitri lo usa): o null
      el: () => registro.get(id)?.el,
    };
    return ctx;
  }
  function montar(id) {
    const r = registro.get(id); if (!r) return null;
    if (!r.montada) {
      r.el = document.createElement('section'); r.el.className = 'mv-vista'; r.el.dataset.vista = id; r.el.hidden = true;
      r.el.setAttribute('aria-label', typeof r.def.titulo === 'function' ? r.def.titulo() : r.def.titulo || id);
      refs.main.append(r.el); r.ctx = ctxDe(id); r.montada = true;
      try { r.def.montar?.(r.el, r.ctx); } catch (e) { console.error(e); r.el.innerHTML = falla('Esta pantalla no pudo abrirse: ' + e.message); }
    }
    return r;
  }

  const DE_ESCRITORIO = { calendario: 'cal', cerebro: 'brain', estudio: 'studio' };
  function viendo() {
    const id = previa; if (!id || id === 'inicio' || id === 'aprobaciones' || id === 'mas') return null;
    const f = prov.get(id); if (f) { try { const c = f(); if (c && c.view) return c; } catch { /* sin contexto */ } }
    const nombre = id.startsWith('esc:') ? id.slice(4) : id, t = id.startsWith('esc:') ? ESCRITORIO.find(x => x.id === nombre)?.titulo : (() => { const r = registro.get(id); return typeof r?.def.titulo === 'function' ? r.def.titulo() : r?.def.titulo; })();
    return t ? { view: DE_ESCRITORIO[nombre] || nombre, label: t, kind: null } : null;
  }
  let ultima = null;
  function pintar() {
    if (!raiz) return;
    const id = pantalla || tab, enEsc = pila.cima()?.tipo === 'escritorio';
    document.body.classList.toggle('mv-esc', enEsc);
    if (enEsc) previa = 'esc:' + pila.cima().item.id; else if (id !== 'dimitri') previa = id;
    document.body.classList.toggle('mv-ventana', enEsc && !!pila.cima().item.ventana);
    if (!enEsc) {
      const r = montar(id);
      if (r) {
        for (const o of registro.values()) if (o.montada && o !== r && !o.el.hidden) { o.el.hidden = true; o.def.alOcultar?.(o.el, o.ctx); }
        const nueva = r.el.hidden; r.el.hidden = false;
        if (nueva || ultima !== id) { r.def.alMostrar?.(r.el, r.ctx, params); }
      }
      ultima = id;
    } else {
      for (const o of registro.values()) if (o.montada && !o.el.hidden) { o.el.hidden = true; o.def.alOcultar?.(o.el, o.ctx); }
      ultima = null;
    }
    pintarCabecera();
    for (const b of raiz.querySelectorAll('.mv-tab')) { const on = b.dataset.tab === (enEsc ? 'mas' : pestanaDe(id)); b.setAttribute('aria-current', on ? 'page' : 'false'); b.classList.toggle('on', on); }
  }
  let params = {};
  function pintarCabecera() {
    const enEsc = pila.cima()?.tipo === 'escritorio', id = pantalla || tab, r = registro.get(id), c = cab.get(id) || {};
    const t = enEsc ? pila.cima().item.titulo : c.titulo || (typeof r?.def.titulo === 'function' ? r.def.titulo() : r?.def.titulo) || 'Agents Office';
    refs.titulo.textContent = t;
    const hojaAbierta = pila.cima()?.tipo === 'hoja';
    refs.atras.hidden = !(enEsc || pantalla); refs.atras.setAttribute('aria-label', enEsc ? 'Volver a Más' : 'Volver');
    refs.acc.innerHTML = enEsc || hojaAbierta && false ? '' : (c.acciones || []).map((a, i) => `<button type="button" class="mv-ic" data-i="${i}" aria-label="${esc(a.etiqueta)}">${svg(a.icono)}</button>`).join('');
    const n = store ? store.aprobaciones.length : 0;
    refs.aprob.hidden = !n || (enEsc && pila.cima().item.ventana); refs.aprob.innerHTML = `${svg('alerta')}<b>${n}</b>`; refs.aprob.setAttribute('aria-label', `${n} ${n === 1 ? 'espera' : 'esperan'} tu visto bueno. Abrir`);
    const fr = raiz.querySelector('.mv-franja'), hay = n > 0 && !franjaNo && id !== 'aprobaciones' && !enEsc;
    fr.hidden = !hay; raiz.classList.toggle('con-franja', hay);
    if (hay) fr.querySelector('[data-ver]').innerHTML = `${svg('alerta')}<span><b>${n === 1 ? '1 borrador espera' : n + ' borradores esperan'} tu OK</b> · Ver</span>`;
    const punto = raiz.querySelector('[data-tab="inicio"] .mv-punto'); if (punto) punto.hidden = !n;
  }

  // ---- navegar ----
  function irPestana(id, boton) {
    if (id === 'mas') { const d = registro.get('mas'); if (d?.def.abrir) { d.def.abrir(ctxDe('mas'), boton); return; } }
    if (pila.largo) cerrarTodas();
    pantalla = null; params = {};
    if (id === tab) { const r = registro.get(id); r?.def.alMostrar?.(r.el, r.ctx, params); const sc = r?.el; sc?.querySelector('.mv-scroll')?.scrollTo?.({ top: 0, behavior: 'smooth' }); }
    tab = id; ultima = null; sinHash(); pintar();
  }
  function navegar(id, p = {}) {
    const r = registro.get(id) || (id === 'aprobaciones' ? null : null); if (!r) { toast('Esa pantalla aún no está en la versión móvil.'); return; }
    params = p || {};
    if (TABS.some(t => t.id === id) && id !== 'mas') { if (pila.largo) cerrarTodas(); pantalla = null; tab = id; ultima = null; sinHash(); pintar(); return; }
    if (pantalla === id) { ultima = null; pintar(); return; }
    pantalla = id; ultima = null;
    empujar({ tipo: 'pantalla', id, destruir() { if (pantalla === id) pantalla = null; ultima = null; } });
  }
  function sinHash() { try { history.replaceState(history.state, '', aHash(pantalla || tab, tab === 'tareas' ? {} : {})); } catch {} }
  function volver() {
    if (pila.largo) return soltar(pila.cima());
    if (tab !== RAIZ) irPestana(RAIZ);
  }

  // ---- el contenedor de escritorio ----
  function abrirEscritorio(id) {
    const item = ESCRITORIO.find(x => x.id === id); if (!item) { toast('No encuentro esa vista.'); return; }
    if (pila.cima()?.tipo === 'escritorio') return;
    let visto = false, quedo = null;
    const capa = {
      tipo: 'escritorio', item,
      destruir() { clearInterval(quedo); try { if (item.abierta()) item.cerrar(); } catch {} document.body.classList.remove('mv-esc', 'mv-ventana'); },
    };
    empujar(capa);
    try { item.abrir(); } catch (e) { console.error(e); }
    const desde = Date.now();
    quedo = setInterval(() => { // si la vista se cierra por dentro (su ✕, un Esc), el contenedor se va con ella
      let abierta = false; try { abierta = item.abierta(); } catch {}
      if (abierta) visto = true; else if ((visto && Date.now() - desde > 600) || Date.now() - desde > 6000) { clearInterval(quedo); if (pila.cima() === capa) soltar(capa); }
    }, 350);
  }

  // ---- avisos ----
  function toast(texto, { accion, alAccion, ms = 5200 } = {}) {
    const t = document.createElement('div'); t.className = 'mv-toast';
    t.innerHTML = `<span>${esc(texto)}</span>${accion ? `<button type="button" class="mv-toast-b">${esc(accion)}</button>` : ''}`;
    const quita = () => { t.classList.add('saliendo'); setTimeout(() => t.remove(), 180); };
    t.querySelector('button')?.addEventListener('click', () => { quita(); alAccion?.(); });
    while (refs.toasts.children.length >= 2) refs.toasts.firstChild.remove(); // como mucho dos a la vez: el más viejo se va
    refs.toasts.append(t); setTimeout(quita, accion ? Math.max(ms, 6500) : ms);
    return { quitar: quita };
  }

  // ---- tirar para refrescar ----
  function tirarParaRefrescar(sc, fn) {
    let y0 = null, dy = 0, pidiendo = false;
    const ind = document.createElement('div'); ind.className = 'mv-tirar'; ind.setAttribute('aria-hidden', 'true'); ind.innerHTML = svg('refrescar'); sc.prepend(ind);
    sc.addEventListener('touchstart', e => { y0 = sc.scrollTop <= 0 && !pidiendo ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    sc.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { ind.style.height = Math.min(64, dy / 2) + 'px'; ind.classList.toggle('lista', tiraRefrescar({ dy, scrollTop: sc.scrollTop })); } }, { passive: true });
    sc.addEventListener('touchend', async () => {
      if (y0 == null) return; const va = tiraRefrescar({ dy, scrollTop: sc.scrollTop }); y0 = null;
      if (!va) { ind.style.height = '0'; ind.classList.remove('lista'); return; }
      pidiendo = true; ind.classList.add('girando'); ind.style.height = '44px';
      try { await fn(); } catch {} pidiendo = false; ind.classList.remove('girando', 'lista'); ind.style.height = '0';
    });
    return ind;
  }

  // ---- la ventana visible: el teclado del teléfono no tapa los campos ----
  function vistaVisual() {
    const vv = window.visualViewport; if (!vv) return;
    const ajusta = () => {
      raiz.style.setProperty('--mv-vh', vv.height + 'px'); raiz.style.setProperty('--mv-vt', vv.offsetTop + 'px');
      const tecla = window.innerHeight - vv.height > 140;
      document.body.classList.toggle('mv-teclado', tecla);
      if (tecla && document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) setTimeout(() => document.activeElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 60);
    };
    vv.addEventListener('resize', ajusta); vv.addEventListener('scroll', ajusta); ajusta();
  }

  // ---- gesto de volver: deslizar desde el borde izquierdo ----
  function gestoBorde() {
    let x0 = null, y0 = 0;
    raiz.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX <= 24 ? t.clientX : null; y0 = t.clientY; }, { passive: true });
    raiz.addEventListener('touchend', e => { if (x0 == null) return; const t = e.changedTouches[0]; const ok = esGestoVolver({ x0, dx: t.clientX - x0, dy: t.clientY - y0 }); x0 = null; if (ok && (pila.largo || pantalla)) volver(); }, { passive: true });
  }

  function conexion(ok) { if (ok === enlinea) return; enlinea = ok; if (refs.conex) refs.conex.hidden = ok; raiz?.classList.toggle('sin-red', !ok); }

  // ---- encender y apagar ----
  function iniciar() {
    if (activo) return; activo = true;
    api = crearApi({ alConexion: conexion });
    store = crearStore(api); store.alCambiar(() => pintarCabecera());
    construir();
    hojas = crearHojas({ raiz, empujar, soltar, inertes: () => [$('.mv-bar'), refs.main, $('.mv-tabs')] });
    document.body.classList.add('movil');
    const mv = document.querySelector('meta[name=viewport]'); if (mv && !/viewport-fit/.test(mv.content)) { mv.dataset.antes = mv.content; mv.content += ', viewport-fit=cover'; } // el contenido llega al borde y env(safe-area-inset-*) deja sitio a la muesca
    addEventListener('popstate', alPopState);
    try { history.replaceState({ mv: 0 }, '', location.href); } catch {}
    const h = leerHash(location.hash); tab = TABS.some(t => t.id === h.vista) ? h.vista : RAIZ; params = h.params;
    vistaVisual(); gestoBorde(); store.iniciar(); pintar();
    addEventListener('online', () => conexion(true)); addEventListener('offline', () => conexion(false));
  }
  function apagar() {
    if (!activo) return; activo = false; cerrarTodas(); store?.detener(); removeEventListener('popstate', alPopState);
    for (const r of registro.values()) { if (r.montada) { r.def.desmontar?.(r.el, r.ctx); r.el.remove(); r.montada = false; r.el = null; } }
    const mv = document.querySelector('meta[name=viewport][data-antes]'); if (mv) { mv.content = mv.dataset.antes; delete mv.dataset.antes; }
    raiz?.remove(); raiz = null; hojas = null; document.body.classList.remove('movil', 'mv-esc', 'mv-ventana', 'mv-teclado'); pantalla = null; tab = RAIZ; ultima = null;
  }
  return {
    registrarVista, iniciar, apagar, navegar, volver, abrirEscritorio, toast, entradasEscritorio, GRUPOS,
    get activo() { return activo; }, get raiz() { return raiz; }, get ctx() { return { api, store, hoja: o => hojas.abrir(o) }; },
    vistas: () => [...registro.values()].map(r => r.def), actual: () => pantalla || tab, pila,
    refrescarCabecera: pintarCabecera, viendo,
  };
}

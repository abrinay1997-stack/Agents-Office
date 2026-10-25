// Versión móvil (25 oct 2026) — ESTUDIO: cuatro pestañas en una columna. GALERÍA (cuadrícula de 2–3 columnas, filtros en chips, el día como título),
// con un VISOR a pantalla completa (deslizar entre piezas, pellizco para acercar, acciones en una hoja). CREAR (por pasos: qué, idea, material, y el
// modelo y el formato SIEMPRE a la vista, con el costo en el botón GENERAR). EN CURSO (los trabajos con su barra) y LOTES (solo lectura).
// El dinero: GENERAR es el clic del dueño, desde US$0,50 lleva un segundo toque, y los topes del Estudio los vigila el servidor (/api/media/jobs).
// Lo que no se porta (el banco de presets avanzado, crear un lote, voces propias) se abre en la vista de escritorio.
import * as Z from '../../viewer-zoom.js';
import * as SV from '../../studio-voz.js';
import { pedirOk } from '../../studio-confirmar.js';
import { conEstado } from '../../accion.js';
import { esc, svg, vacio, esqueleto, falla, hace } from '../ui.js';
import { ic, mediaSrc, esVideo, esAudio, leerDataURL } from '../b-comun.js';
import { usd } from '../../sub-studio.js';
import { KINDS, FILTROS, ROLES, RATIO, ETIQ, CALIDAD, agruparPorDia, modelosDe, ajustesDe, costoDe, unidadesDe, queFalta, pedido, dineroQueda, maxCantidad, avance, desdeFicha, UMBRAL } from '../estudio-puro.js';

const PAGINA = 48;
const E = { items: [], next: null, total: 0, counts: {}, folders: [], models: [], engines: [], budget: null, defaults: {}, voices: null, jobs: [], filtro: 'all', carpeta: 'all', q: '', cargado: false, error: '', cargando: false, hojaVisor: null, lotes: null,
  c: { kind: 'image', modelo: {}, texto: '', qty: 1, set: {}, material: { start: [], end: [], reference: [], video: [] }, armado: null, sugerido: null, aviso: '', error: '' } };
const nombreMod = id => E.models.find(m => m.id === id)?.name || id;
const unaFicha = f => E.items.find(i => i.file === f);

export function registrar(shell) {
  shell.registrarVista({
    id: 'estudio', titulo: 'Estudio', icono: 'estudio', grupo: 'mas', sec: 'trabajo', texto: 'Imágenes, video y voz',
    montar(el, ctx) {
      let tab = 'galeria', timer = 0, tq = 0, rev = 0;
      el.innerHTML = `<div class="mv-seg mv-seg-4" role="group" aria-label="Estudio">${[['galeria', 'Galería'], ['crear', 'Crear'], ['curso', 'En curso'], ['lotes', 'Lotes']].map(([k, n]) => `<button type="button" data-tab="${k}" aria-pressed="${k === tab}">${n}<b hidden></b></button>`).join('')}</div>
        <div class="mv-scroll" data-p="galeria"></div><div class="mv-crear" data-p="crear" hidden><div class="mv-scroll" data-cs></div><div class="mv-genera" data-gen></div></div>
        <div class="mv-scroll" data-p="curso" hidden></div><div class="mv-scroll" data-p="lotes" hidden></div>`;
      const P = k => el.querySelector(`[data-p="${k}"]`);

      // ---------- datos ----------
      async function traer(mas = false) {
        if (E.cargando) return; E.cargando = true; const mi = ++rev;
        const p = new URLSearchParams({ n: String(PAGINA) }); if (E.filtro !== 'all') p.set('filter', E.filtro); if (E.carpeta !== 'all') p.set('folder', E.carpeta); if (E.q) p.set('q', E.q);
        if (mas && E.next) p.set('before', E.next); if (!E.models.length) p.set('catalog', '1');
        try {
          const j = await ctx.api('/api/media?' + p); if (mi !== rev) return;
          E.items = mas ? E.items.concat(j.items || []) : j.items || []; E.next = j.next || null; E.total = j.total || 0; E.counts = j.counts || E.counts; E.folders = j.folders || E.folders;
          if (j.models) { E.models = j.models; E.engines = j.engines || []; E.defaults = j.default || {}; E.voices = j.voices || null; E.jobs = j.jobs || E.jobs; }
          if (j.budget) E.budget = j.budget; E.cargado = true; E.error = '';
        } catch (e) { if (mi === rev) E.error = e.message; }
        E.cargando = false; if (tab === 'galeria') galeria(); if (tab === 'crear') crear();
      }
      async function jobs() { try { const j = await ctx.api('/api/media/jobs'); E.jobs = j.jobs || []; if (j.budget) E.budget = j.budget; } catch {} insignia(); if (tab === 'curso') curso(); }
      const activos = () => E.jobs.filter(j => j.state === 'queued' || j.state === 'running');
      function insignia() { const n = activos().length, b = el.querySelector('[data-tab="curso"] b'); b.hidden = !n; b.textContent = n; }
      function vigilar() { clearInterval(timer); timer = setInterval(async () => { if (el.hidden || document.visibilityState === 'hidden') return; const antes = activos().length; await jobs(); if (antes && activos().length < antes) { await traer(); ctx.toast('Terminó un trabajo del Estudio.', { accion: 'Ver', alAccion: () => ir('galeria') }); } }, activos().length ? 3000 : 9000); }

      function ir(k) {
        tab = k; for (const b of el.querySelectorAll('[data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === k));
        for (const d of el.querySelectorAll('[data-p]')) d.hidden = d.dataset.p !== k;
        if (k === 'galeria') galeria(); else if (k === 'crear') crear(); else if (k === 'curso') { curso(); jobs(); } else lotes();
        vigilar();
      }

      // ---------- GALERÍA ----------
      function galeria() {
        const box = P('galeria');
        if (!E.cargado) { box.innerHTML = E.error ? falla(E.error) : esqueleto(4); return; }
        const cnt = k => (E.counts[k === 'all' ? 'all' : k] ?? ''), grupos = agruparPorDia(E.items);
        const filtros = FILTROS.filter(([k]) => k === 'all' || cnt(k) > 0 || E.filtro === k);
        const carp = E.folders.length ? `<div class="mv-chips" role="group" aria-label="Carpeta"><button type="button" class="mv-chip" data-carp="all" aria-pressed="${E.carpeta === 'all'}">Todas</button><button type="button" class="mv-chip" data-carp="none" aria-pressed="${E.carpeta === 'none'}">Sin carpeta</button>${E.folders.map(f => `<button type="button" class="mv-chip" data-carp="${esc(f.id)}" aria-pressed="${E.carpeta === f.id}">${esc(f.name)}</button>`).join('')}</div>` : '';
        const tile = it => { const i = E.items.indexOf(it), src = mediaSrc(it.file, it.at), rot = String(it.prompt || it.file).slice(0, 80);
          const cuerpo = it.kind === 'video' ? `<video src="${esc(src)}#t=0.1" muted playsinline preload="metadata"></video><span class="mv-ins">${ic('play')}</span>` : it.kind === 'audio' ? `<span class="mv-aud">${ic('nota_s')}<small>${it.wanted === 'music' ? 'Música' : 'Voz'}</small></span>` : `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`;
          return `<button type="button" class="mv-tile" data-i="${i}" aria-label="${esc((it.kind === 'video' ? 'Video: ' : it.kind === 'audio' ? 'Audio: ' : 'Imagen: ') + rot)}">${cuerpo}${it.fav ? `<span class="mv-fav" aria-label="Favorita">${ic('estrella')}</span>` : ''}</button>`; };
        box.innerHTML = `<form class="mv-busca" role="search" data-qf><label class="mv-sr" for="mvEq">Buscar en el Estudio</label>${svg('buscar', 'mv-busca-i')}<input id="mvEq" type="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar por idea, modelo o agente…" value="${esc(E.q)}"></form>
          <div class="mv-chips" role="group" aria-label="Qué ver">${filtros.map(([k, n]) => `<button type="button" class="mv-chip" data-f="${k}" aria-pressed="${E.filtro === k}">${n}${cnt(k) !== '' ? `<b>${cnt(k)}</b>` : ''}</button>`).join('')}</div>${carp}
          ${E.error ? `<p class="mv-aviso-caja" role="alert">No pude actualizar: ${esc(E.error)} <button type="button" class="mv-link" data-reint>Reintentar</button></p>` : ''}
          ${E.items.length ? grupos.map(g => `<h3 class="mv-gh">${esc(g.dia)}<span>${g.items.length}</span></h3><div class="mv-grid">${g.items.map(tile).join('')}</div>`).join('') + (E.next ? '<div class="mv-cuerpo"><button type="button" class="mv-btn" data-mas>Ver más</button></div>' : '') : vacio(E.q || E.filtro !== 'all' ? 'Nada con ese filtro' : 'El Estudio está vacío', E.q || E.filtro !== 'all' ? 'Quita el filtro o cambia la búsqueda.' : 'Crea tu primera imagen: es un toque.', { icono: 'estudio', boton: E.q || E.filtro !== 'all' ? '' : 'Crear', accion: 'data-crear' })}`;
      }
      P('galeria').addEventListener('submit', e => { if (e.target.matches('[data-qf]')) { e.preventDefault(); e.target.querySelector('input').blur(); } });
      P('galeria').addEventListener('input', e => { if (e.target.id !== 'mvEq') return; clearTimeout(tq); tq = setTimeout(() => { E.q = e.target.value.trim(); traer().then(() => { const i = P('galeria').querySelector('#mvEq'); if (i && !i.matches(':focus')) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); });
      P('galeria').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.f) { E.filtro = b.dataset.f; return traer(); } if (b.dataset.carp) { E.carpeta = b.dataset.carp; return traer(); }
        if (b.hasAttribute('data-mas')) return traer(true); if (b.hasAttribute('data-reint') || b.hasAttribute('data-reintentar')) return traer(); if (b.hasAttribute('data-crear')) return ir('crear');
        if (b.dataset.i) abrirVisor(ctx, +b.dataset.i, { traer, volverACrear: usarEnCrear, pedirDimitri });
      });
      function pedirDimitri(file) { ctx.navegar('dimitri', { adjuntar: file }); }

      // ---------- CREAR ----------
      const C = E.c;
      const kindsOn = () => KINDS.filter(([k]) => modelosDe(E.models, k, E.defaults[k]).length);
      function modeloAct() { const l = modelosDe(E.models, C.kind, E.defaults[C.kind]); return l.find(m => m.id === C.modelo[C.kind]) || l[0] || null; }
      const ajustesAct = m => ajustesDe(m, Object.fromEntries(Object.entries(C.set).filter(([k]) => k.startsWith((m ? m.id : '') + '|')).map(([k, v]) => [k.split('|')[1], v])));
      function crear() {
        const box = P('crear').querySelector('[data-cs]');
        if (!E.cargado) { box.innerHTML = E.error ? falla(E.error) : esqueleto(4); P('crear').querySelector('[data-gen]').innerHTML = ''; return; }
        const m = modeloAct(), aj = ajustesAct(m), sp = m ? m.settings || {} : {}, roles = m ? Object.keys(m.roles || {}) : [];
        const ps = SV.promptStep(C.kind, !!aj.instrumental), quick = [];
        if (sp.aspectRatio && sp.aspectRatio.values) quick.push(['aspectRatio', 'Formato']);
        const cal = CALIDAD.find(k => sp[k] && sp[k].values); if (cal) quick.push([cal, ETIQ[cal]]);
        if (C.kind === 'video' && sp.duration && sp.duration.values) quick.push(['duration', 'Duración (s)']);
        const chipsDe = ([k, et]) => `<fieldset class="mv-grupo"><legend class="mv-lab">${et}</legend><div class="mv-chips mv-chips-q" role="radiogroup">${sp[k].values.map(v => `<button type="button" class="mv-chip" role="radio" aria-checked="${String(aj[k]) === String(v)}" data-set="${k}" data-v="${esc(v)}">${esc(k === 'aspectRatio' && RATIO[v] ? `${v} · ${RATIO[v]}` : String(v))}</button>`).join('')}</div></fieldset>`;
        const voces = C.kind === 'audio' && sp.voiceId ? SV.voiceGroups(E.voices) : [];
        const selVoz = voces.length ? `<label class="mv-lab" for="mvVoz">Voz</label><select id="mvVoz" class="mv-campo" data-set="voiceId">${voces.map(g => `<optgroup label="${esc(g.label)}">${g.voices.map(v => `<option value="${esc(v.voiceId)}"${aj.voiceId === v.voiceId ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</optgroup>`).join('')}</select>` : '';
        const maxq = maxCantidad(C.kind, E.budget), qs = [...new Set([1, 2, 4, C.qty])].filter(n => n <= maxq || n === C.qty).sort((a, b) => a - b);
        const mat = roles.length ? roles.map(r => { const l = C.material[r] || [], lim = m.roles[r] || 1, req = (m.needs || []).includes(r);
          return `<div class="mv-mat"><span class="mv-lab">${ROLES[r] || r}${req ? ' · hace falta' : ''}</span><div class="mv-mat-f">${l.map(f => `<span class="mv-mat-i">${esVideo(f) ? ic('play') : `<img src="${esc(mediaSrc(f))}" alt="">`}<button type="button" class="mv-mat-x" data-quita="${r}|${esc(f)}" aria-label="Quitar ${esc(f.split('/').pop())}">${svg('cerrar')}</button></span>`).join('')}${l.length < lim ? `<button type="button" class="mv-mat-m" data-elige="${r}">${ic('mas_c')}<span>${l.length ? 'Otra' : 'Elegir'}</span></button>` : ''}</div></div>`; }).join('') : '';
        box.innerHTML = !kindsOn().length ? vacio('No hay motores encendidos', 'Activa uno en la versión de escritorio (Ajustes → Estudio) o usa el motor gratis «Prueba».', { icono: 'estudio', boton: 'Abrir el Estudio de escritorio', accion: 'data-esc' })
          : `<div class="mv-cuerpo mv-compo">
            <div class="mv-chips mv-chips-k" role="radiogroup" aria-label="Qué crear">${kindsOn().map(([k, n]) => `<button type="button" class="mv-chip" role="radio" aria-checked="${C.kind === k}" data-kind="${k}">${n}</button>`).join('')}</div>
            ${C.sugerido ? `<p class="mv-aviso-caja" role="status">${esc(C.sugerido)}</p>` : ''}
            <label class="mv-lab" for="mvIdea">${esc(ps.label)}</label><textarea id="mvIdea" class="mv-campo" rows="4" placeholder="${esc(ps.placeholder || 'Qué quieres ver. Con una frase basta.')}">${esc(C.texto)}</textarea>
            <div class="mv-fila-btn">${C.kind === 'image' || C.kind === 'video' ? `<button type="button" class="mv-btn" data-mejorar>${ic('varita')} Mejorar la idea</button>` : ''}${C.antes != null ? '<button type="button" class="mv-btn" data-deshacer>Volver a la mía</button>' : ''}</div>
            ${mat}
            <div class="mv-modelo" role="group" aria-label="Modelo y formato"><button type="button" class="mv-modelo-b" data-modelo><span class="mv-lab">Modelo</span><b>${esc(m ? m.name : '—')}</b><small>${m ? esc(SV.priceText(m)) : ''}${m && m.engine === 'prueba' ? '' : ''}</small>${svg('der', 'mv-der')}</button></div>
            ${quick.map(chipsDe).join('')}${selVoz}
            <fieldset class="mv-grupo"><legend class="mv-lab">Cuántas</legend><div class="mv-chips mv-chips-q" role="radiogroup">${qs.map(n => `<button type="button" class="mv-chip" role="radio" aria-checked="${C.qty === n}" data-qty="${n}">${n}</button>`).join('')}</div></fieldset>
            ${Object.keys(sp).some(k => !quick.some(q => q[0] === k) && !(k === 'voiceId' && voces.length)) ? '<button type="button" class="mv-link" data-mas-aj>Más ajustes</button>' : ''}
            <button type="button" class="mv-link" data-banco>Presets avanzados y lotes: abrir en escritorio</button></div>`;
        pie();
      }
      function pie() {
        const g = P('crear').querySelector('[data-gen]'), m = modeloAct(); if (!m || !E.cargado) { g.innerHTML = ''; return; }
        const aj = ajustesAct(m), costo = costoDe(m, aj, C.texto, C.qty), uds = unidadesDe(aj, C.qty), falta = queFalta(m, C.texto, C.material), queda = dineroQueda(E.budget), fuera = costo > 0 && queda != null && costo > queda + 1e-9 && m.engine !== 'prueba';
        const armado = C.armado && Date.now() - C.armado.at < 6000;
        g.innerHTML = `<p class="mv-meta mv-gen-l${fuera ? ' rojo' : ''}" role="status">${falta ? esc(falta) : fuera ? `Pasa del tope: quedan ${usd(queda)}.` : `${SV.countOf(C.kind, uds)} · ${costo ? 'aprox. ' + usd(costo) : 'gratis'}${E.budget ? ` · hoy llevas ${usd(E.budget.cost)}${queda != null ? ` · quedan ${usd(queda)}` : ''}` : ''}`}</p>
          ${C.error ? `<p class="mv-err" role="alert">${esc(C.error)}</p>` : ''}
          <button type="button" class="mv-btn primario mv-generar${armado ? ' armado' : ''}" data-generar ${falta ? 'aria-disabled="true"' : ''}>${armado ? `Confirmar · ${usd(costo)}` : `${SV.goLabel(C.kind, uds)}${costo ? ' · ' + usd(costo) : ' · gratis'}`}</button>`;
      }
      const reflejar = () => { const t = P('crear').querySelector('#mvIdea'); if (t) C.texto = t.value; };
      P('crear').addEventListener('input', e => { if (e.target.id === 'mvIdea') { C.texto = e.target.value; C.armado = null; pie(); } });
      P('crear').addEventListener('change', e => { const s = e.target.closest('[data-set]'); if (s && s.tagName === 'SELECT') { C.set[modeloAct().id + '|' + s.dataset.set] = s.value; crear(); } });
      P('crear').addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return; reflejar();
        if (b.dataset.kind) { C.kind = b.dataset.kind; C.armado = null; C.sugerido = null; return crear(); }
        if (b.dataset.qty) { C.qty = +b.dataset.qty; C.armado = null; return crear(); }
        if (b.dataset.set) { C.set[modeloAct().id + '|' + b.dataset.set] = b.dataset.v; C.armado = null; return crear(); }
        if (b.dataset.quita) { const [r, f] = b.dataset.quita.split('|'); C.material[r] = (C.material[r] || []).filter(x => x !== f); return crear(); }
        if (b.dataset.elige) { const r = b.dataset.elige, m = modeloAct(), lim = m.roles[r] || 1; const l = await elegirArchivos(ctx, { max: lim - (C.material[r] || []).length, titulo: ROLES[r] || r, tipo: r === 'video' ? 'video' : 'image' }); if (l && l.length) { C.material[r] = [...(C.material[r] || []), ...l]; crear(); } return; }
        if (b.hasAttribute('data-modelo')) return elegirModelo();
        if (b.hasAttribute('data-mas-aj')) return masAjustes();
        if (b.hasAttribute('data-banco')) return ctx.escritorio('estudio');
        if (b.hasAttribute('data-esc')) return ctx.escritorio('estudio');
        if (b.hasAttribute('data-reintentar')) return traer();
        if (b.hasAttribute('data-mejorar')) { if (!C.texto.trim()) return ctx.toast('Escribe primero una idea.'); C.antes = C.texto; const r = await conEstado(b, () => ctx.api('/api/media/enhance', { method: 'POST', body: { prompt: C.texto, kind: C.kind, lang: 'es' } }), { ocupado: 'Mejorando…', hecho: 'Mejorada' }); if (r.ok) { C.texto = r.valor.es || r.valor.prompt || C.texto; setTimeout(crear, 700); } else C.antes = null; return; }
        if (b.hasAttribute('data-deshacer')) { C.texto = C.antes; C.antes = null; return crear(); }
        if (b.hasAttribute('data-generar')) return generar(b);
      });
      function elegirModelo() {
        const l = modelosDe(E.models, C.kind, E.defaults[C.kind]), act = modeloAct(), apagados = E.models.filter(m => m.kind === C.kind && !m.on).length;
        const h = ctx.hoja({ titulo: 'Elegir el modelo', lleno: true, cuerpo: `<ul class="mv-lista">${l.map(m => `<li><button type="button" class="mv-lista-b" data-m="${esc(m.id)}" aria-pressed="${act && act.id === m.id}"><span><b>${esc(m.name)}${act && act.id === m.id ? ' ✓' : ''}</b><small>${esc([m.maker || m.engineName, SV.priceText(m), (m.uses || []).slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</small></span></button></li>`).join('')}</ul>${apagados ? `<p class="mv-meta">${apagados} modelos más esperan su key (Ajustes → Estudio, en escritorio).</p>` : ''}` });
        h.cuerpo.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; C.modelo[C.kind] = b.dataset.m; C.armado = null; C.sugerido = null; for (const r of Object.keys(C.material)) if (!(modeloAct().roles || {})[r]) C.material[r] = []; h.cerrar(); crear(); });
      }
      function masAjustes() {
        const m = modeloAct(), aj = ajustesAct(m), sp = m.settings || {};
        const campo = ([k, s]) => { const et = ETIQ[k] || k, id = 'mvA' + k;
          if (s.type === 'boolean') return `<label class="mv-chk"><input type="checkbox" id="${id}" data-k="${k}"${aj[k] ? ' checked' : ''}><span>${esc(et)}</span></label>`;
          if (s.type === 'enum') return `<label class="mv-lab" for="${id}">${esc(et)}</label><select id="${id}" class="mv-campo" data-k="${k}">${s.values.map(v => `<option value="${esc(v)}"${String(aj[k]) === String(v) ? ' selected' : ''}>${esc(String(v))}</option>`).join('')}</select>`;
          return `<label class="mv-lab" for="${id}">${esc(et)}</label><input id="${id}" class="mv-campo" ${s.type === 'range' || s.type === 'number' ? 'type="number" inputmode="decimal"' : 'type="text"'} data-k="${k}" value="${esc(aj[k] ?? '')}" placeholder="${esc(s.placeholder || '')}">`; };
        const h = ctx.hoja({ titulo: 'Más ajustes', lleno: true, cuerpo: Object.entries(sp).map(campo).join(''), acciones: [{ texto: 'Listo', tipo: 'primario', alTocar: x => x.cerrar() }] });
        h.cuerpo.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; C.set[m.id + '|' + k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; });
        h.capa.addEventListener('transitionend', () => {}); const al = () => { C.armado = null; crear(); }; h.cuerpo.addEventListener('input', al);
      }
      async function generar(b) {
        const m = modeloAct(); if (!m) return; const aj = ajustesAct(m), falta = queFalta(m, C.texto, C.material); C.error = '';
        if (falta) { C.error = falta; return pie(); }
        const costo = costoDe(m, aj, C.texto, C.qty), clave = `${m.id}|${C.texto}|${C.qty}|${JSON.stringify(aj)}`;
        const r = pedirOk(C.armado && C.armado.clave === clave ? C.armado : null, clave, costo); // el segundo toque desde US$0,50: lo que se ve en el botón es lo que se gasta
        if (!r.ok) { C.armado = r.armado; pie(); clearTimeout(C.tA); C.tA = setTimeout(() => { C.armado = null; if (tab === 'crear') pie(); }, 6100); return; }
        C.armado = null; b.setAttribute('aria-busy', 'true'); b.textContent = 'Enviando…';
        try {
          const carp = E.folders.some(f => f.id === E.carpeta) ? E.carpeta : '';
          const j = await ctx.api('/api/media/jobs', { method: 'POST', body: pedido({ m, texto: C.texto, cantidad: C.qty, ajustes: aj, material: C.material, carpeta: carp }) });
          E.jobs = [j.job, ...E.jobs.filter(x => x.id !== j.job.id)]; if (j.budget) E.budget = j.budget; C.antes = null; ctx.toast('Pedido enviado. Lo ves en «En curso».'); insignia(); ir('curso');
        } catch (er) { C.error = er.message; pie(); }
      }
      /** Variar / Animar / Usar de referencia, desde el visor: deja el compositor listo y lo muestra. NO gasta: el dueño pulsa GENERAR. */
      function usarEnCrear(modo, it) {
        const r = desdeFicha(modo, it, E.models, E.defaults); if (r.error) { ctx.toast(r.error); return false; }
        C.kind = r.kind; C.modelo[r.kind] = r.modelo; C.texto = r.texto || C.texto; C.antes = null; C.armado = null; C.error = '';
        C.material = { start: [], end: [], reference: [], video: [], ...r.material };
        for (const [k, v] of Object.entries(r.ajustes || {})) C.set[r.modelo + '|' + k] = v;
        C.sugerido = modo === 'animar' ? 'Animar: la imagen es el primer cuadro. Revisa la idea y pulsa Generar video.' : modo === 'ref' ? 'La imagen quedó como referencia. Escribe qué quieres a partir de ella.' : r.sinRef ? 'Mismo pedido. Este modelo no admite la imagen como referencia: sale una versión nueva desde cero.' : 'Mismo pedido con la imagen como referencia. Cambia lo que quieras y pulsa Generar.';
        ir('crear'); return true;
      }

      // ---------- EN CURSO ----------
      function curso() {
        const box = P('curso'), l = E.jobs.filter(j => j.state === 'queued' || j.state === 'running' || (j.state === 'failed' && Date.now() - (j.doneAt || j.at) < 3 * 864e5) || (j.state === 'done' && Date.now() - (j.doneAt || j.at) < 36e5));
        const PAL = { queued: 'En cola', running: 'Generando…', done: 'Listo', failed: 'Falló', canceled: 'Cancelado' };
        const b = E.budget; const cab = b ? `<p class="mv-meta mv-pres">Hoy ${b.used ?? 0}${b.left == null ? '' : ' de ' + b.limit} · ${usd(b.cost)}${b.dailyBudget ? ' de ' + usd(b.dailyBudget) : ''}${b.monthlyBudget ? ` · mes ${usd(b.monthCost)} de ${usd(b.monthlyBudget)}` : ''}</p>` : '';
        box.innerHTML = cab + (l.length ? `<ul class="mv-trabajos">${l.map(j => { const p = avance(j, E.jobs), en = j.state === 'queued' || j.state === 'running';
          return `<li class="mv-trabajo ${j.state}" data-id="${esc(j.id)}"><div class="mv-trabajo-c"><b>${esc(String(j.prompt || 'Sin idea').slice(0, 90))}</b><small>${esc(j.modelName || nombreMod(j.model))} · ${j.n || 1} · ${PAL[j.state] || j.state}${j.state === 'failed' && j.error ? ' — ' + esc(j.error) : ''}</small>
            ${en ? `<div class="mv-barra" role="progressbar" aria-label="Avance estimado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${j.state === 'queued' ? 0 : Math.round(p * 100)}"><i style="width:${j.state === 'queued' ? 4 : Math.round(p * 100)}%"></i></div>` : ''}</div>
            <div class="mv-trabajo-a">${en ? '<button type="button" class="mv-btn" data-cancelar>Cancelar</button>' : j.state === 'failed' ? '<button type="button" class="mv-btn" data-reintentar-j>Reintentar</button><button type="button" class="mv-ic" data-olvidar aria-label="Quitar de la lista">' + svg('cerrar') + '</button>' : j.state === 'done' ? '<button type="button" class="mv-btn" data-ver>Ver</button>' : ''}</div></li>`; }).join('')}</ul>` : vacio('Nada en marcha', 'Cuando pidas algo, aquí ves cómo avanza.', { icono: 'reloj', boton: 'Crear', accion: 'data-ir-crear' }));
      }
      P('curso').addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-ir-crear')) return ir('crear');
        const li = b.closest('.mv-trabajo'), j = li && E.jobs.find(x => x.id === li.dataset.id);
        if (b.hasAttribute('data-cancelar') && j) {
          if (j.state === 'running' && j.engine !== 'prueba' && !(await ctx.confirmar({ titulo: '¿Cancelar este trabajo?', texto: 'Ya se mandó al motor: si ya empezó, es posible que se cobre igual.', ok: 'Cancelar el trabajo', cancelar: 'Seguir', peligro: true }))) return;
          const r = await conEstado(b, () => ctx.api(`/api/media/jobs/${j.id}/cancel`, { method: 'POST' }), { ocupado: 'Cancelando…', hecho: 'Cancelado' }); if (r.ok) { E.jobs = E.jobs.map(x => x.id === j.id ? r.valor.job : x); insignia(); setTimeout(curso, 800); } }
        else if (b.hasAttribute('data-reintentar-j') && j) { const r = await conEstado(b, async () => { const n = await ctx.api(`/api/media/jobs/${j.id}/retry`, { method: 'POST' }); await ctx.api(`/api/media/jobs/${j.id}`, { method: 'DELETE' }).catch(() => {}); return n; }, { ocupado: 'Reintentando…', hecho: 'Enviado' }); if (r.ok) { E.jobs = [r.valor.job, ...E.jobs.filter(x => x.id !== j.id)]; insignia(); setTimeout(curso, 800); } }
        else if (b.hasAttribute('data-olvidar') && j) { try { await ctx.api(`/api/media/jobs/${j.id}`, { method: 'DELETE' }); E.jobs = E.jobs.filter(x => x.id !== j.id); curso(); } catch (er) { ctx.toast('No se pudo: ' + er.message); } }
        else if (b.hasAttribute('data-ver')) { await traer(); ir('galeria'); }
      });

      // ---------- LOTES (solo lectura) ----------
      async function lotes() {
        const box = P('lotes'); if (!E.lotes) box.innerHTML = esqueleto(3);
        try { E.lotes = (await ctx.api('/api/media/lotes')).lotes || []; } catch (e) { if (!E.lotes) { box.innerHTML = falla(e.message); return; } }
        const cuenta = l => { const c = {}; for (const f of l.filas || []) c[f.estado] = (c[f.estado] || 0) + 1; return c; };
        const EST = { previsto: 'Previsto', espera_ok: 'Espera tu OK', muestra: 'Probando', corriendo: 'En marcha', pausado: 'En pausa', hecho: 'Hecho', cancelado: 'Cancelado' };
        box.innerHTML = `<p class="mv-intro">Aquí sigues tus lotes de fotos. Crearlos y aprobarlos se hace en la versión de escritorio.</p>` + (E.lotes.length ? `<ul class="mv-trabajos">${E.lotes.map((l, i) => { const c = cuenta(l), tot = (l.filas || []).length, listas = (c.lista || 0) + (c.aprobada || 0) + (c.hecha || 0); return `<li class="mv-trabajo"><button type="button" class="mv-trabajo-c mv-trabajo-b" data-lote="${i}"><b>${esc(l.nombre || l.name || l.id)}</b><small>${EST[l.estado] || l.estado} · ${tot} fotos${listas ? ' · ' + listas + ' listas' : ''}${l.costo ? ' · ' + usd(l.costo.gastado || l.costo.estimado) : ''}</small>${tot ? `<div class="mv-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${listas}" aria-label="Fotos listas"><i style="width:${Math.round(100 * listas / tot)}%"></i></div>` : ''}</button></li>`; }).join('')}</ul>` : vacio('Sin lotes', 'Un lote edita muchas fotos con la misma receta.', { icono: 'estudio' })) + '<div class="mv-cuerpo"><button type="button" class="mv-btn" data-esc>Abrir los lotes en escritorio</button></div>';
      }
      P('lotes').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-esc')) return ctx.escritorio('estudio'); if (b.hasAttribute('data-reintentar')) return lotes();
        if (b.dataset.lote != null) { const l = E.lotes[+b.dataset.lote]; ctx.hoja({ titulo: l.nombre || l.name || l.id, cuerpo: `<p class="mv-texto">${esc(l.pausa ? l.pausa.motivo : '')}</p><p class="mv-meta">${(l.filas || []).length} fotos · creado ${l.creado ? hace(l.creado) : ''}</p><p class="mv-meta">Para aprobar, reintentar o descargar el ZIP usa la versión de escritorio.</p>`, acciones: [{ texto: 'Abrir en escritorio', tipo: 'primario', alTocar: x => { x.cerrar(); setTimeout(() => ctx.escritorio('estudio'), 260); } }] }); }
      });

      el.querySelector('.mv-seg').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) ir(b.dataset.tab); });
      el._abrirArchivo = async f => { if (!E.cargado) await traer(); let i = E.items.findIndex(x => x.file === f); if (i < 0) { try { const it = await ctx.api('/api/media/item/' + encodeURIComponent(f)); E.items = [it, ...E.items]; i = 0; } catch { ctx.toast('Ese archivo ya no está en el Estudio.'); return; } } abrirVisor(ctx, i, { traer, volverACrear: usarEnCrear, pedirDimitri }); };
      el._entrar = async p => {
        if (p && p.q != null) { E.q = p.q; E.filtro = 'all'; E.carpeta = 'all'; }
        await traer(); jobs(); ir(p && p.tab ? p.tab : tab); if (p && p.file) el._abrirArchivo(p.file);
      };
      el._parar = () => clearInterval(timer);
      ctx.cabecera({ titulo: 'Estudio' });
      window.addEventListener('ao:media-changed', () => { if (!el.hidden) traer(); });
    },
    alMostrar(el, ctx, p) { el._entrar?.(p); },
    alOcultar(el) { el._parar?.(); },
  });
}

/** Elegir imágenes (o videos) de la galería del Estudio, o subir una del teléfono. → Promise<string[]|null> */
function elegirArchivos(ctx, { max = 1, titulo = 'Elegir', tipo = 'image' } = {}) {
  return new Promise(async res => {
    const sel = []; let hecho = false; const fin = v => { if (!hecho) { hecho = true; res(v); } };
    const h = ctx.hoja({ titulo, lleno: true, cuerpo: esqueleto(2), alCerrar: () => fin(null), acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: 'Usar', tipo: 'primario', alTocar: x => { fin(sel.slice()); x.cerrar(); } }] });
    let items = [];
    try { const j = await ctx.api('/api/media?n=60&' + (tipo === 'video' ? 'kind=video' : 'kind=image')); items = (j.items || []).filter(i => tipo === 'video' ? i.kind === 'video' : i.kind === 'image'); } catch (e) { h.cuerpo.innerHTML = falla(e.message); return; }
    const pinta = () => { h.cuerpo.innerHTML = `<p class="mv-meta" role="status">${sel.length} de ${max} elegidas</p><input type="file" id="mvSub" class="mv-sr" accept="${tipo === 'video' ? 'video/*' : 'image/*'}"><label for="mvSub" class="mv-btn mv-etq">${ic('subir')} Subir del teléfono</label>${items.length ? `<div class="mv-grid">${items.map(i => `<button type="button" class="mv-tile${sel.includes(i.file) ? ' sel' : ''}" data-f="${esc(i.file)}" aria-pressed="${sel.includes(i.file)}" aria-label="${esc(String(i.prompt || i.file).slice(0, 60))}">${i.kind === 'video' ? `<video src="${esc(mediaSrc(i.file, i.at))}#t=0.1" muted playsinline preload="metadata"></video>` : `<img src="${esc(mediaSrc(i.file, i.at))}" alt="" loading="lazy">`}${sel.includes(i.file) ? `<span class="mv-fav">${svg('check')}</span>` : ''}</button>`).join('')}</div>` : vacio('No hay nada en el Estudio', 'Sube una foto de tu teléfono.', { icono: 'estudio' })}`; };
    pinta();
    h.cuerpo.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; const f = b.dataset.f, i = sel.indexOf(f); if (i >= 0) sel.splice(i, 1); else if (sel.length < max) sel.push(f); else if (max === 1) { sel[0] = f; } else ctx.toast(`Como mucho ${max}.`); pinta(); });
    h.cuerpo.addEventListener('change', async e => {
      if (e.target.id !== 'mvSub') return; const f = e.target.files[0]; if (!f) return;
      try { const r = await ctx.api('/api/media/upload', { method: 'POST', body: { name: f.name || 'foto.jpg', data: await leerDataURL(f) } }); items = [r.item, ...items]; if (sel.length < max) sel.push(r.item.file); pinta(); dispatchEvent(new Event('ao:media-changed')); } catch (er) { ctx.toast('No se pudo subir: ' + er.message); }
    });
  });
}
export { elegirArchivos };

/** El visor: una hoja que cubre todo. Deslizar a los lados cambia de pieza; el pellizco acerca; las acciones, en otra hoja. */
function abrirVisor(ctx, i0, { traer, volverACrear, pedirDimitri }) {
  let i = i0, s = Z.fitted(), img = null, bw = 1, bh = 1;
  const h = ctx.hoja({ titulo: '', lleno: true, clase: 'mv-visor', cuerpo: '<div class="mv-vis"><div class="mv-stage" data-stage></div><div class="mv-vis-pie" data-pie></div></div>' });
  E.hojaVisor = h; const stage = h.cuerpo.querySelector('[data-stage]'), pie = h.cuerpo.querySelector('[data-pie]');
  const dims = () => ({ nw: img && img.naturalWidth || bw, nh: img && img.naturalHeight || bh, bw, bh });
  const fichaAct = () => E.items[i];
  function mostrar() {
    const it = fichaAct(); if (!it) return h.cerrar(); s = Z.fitted(); img = null;
    h.titulo(`${i + 1} de ${E.items.length}${E.next && i === E.items.length - 1 ? '+' : ''}`);
    const src = mediaSrc(it.file, it.at);
    stage.innerHTML = it.kind === 'video' ? `<video src="${esc(src)}" controls playsinline preload="metadata"></video>` : it.kind === 'audio' ? `<div class="mv-aud mv-aud-g">${ic('nota_s')}<audio src="${esc(src)}" controls preload="none"></audio></div>` : `<img src="${esc(src)}" alt="${esc(String(it.prompt || 'Imagen del Estudio').slice(0, 150))}" draggable="false">`;
    img = stage.querySelector('img'); if (img) { img.style.transformOrigin = 'center'; }
    const r = stage.getBoundingClientRect(); bw = r.width || 1; bh = r.height || 1;
    pie.innerHTML = `<div class="mv-vis-info"><p class="mv-vis-p" data-p>${esc(it.prompt || 'Sin idea escrita')}</p><small>${esc([it.modelName || nombreMod(it.model), it.ratio, hace(it.at), it.cost ? usd(it.cost) : '', it.by === 'agent' ? 'de un agente' : it.by === 'dimitri' ? 'de Dimitri' : ''].filter(Boolean).join(' · '))}</small></div>
      <div class="mv-vis-barra"><button type="button" class="mv-ic" data-prev aria-label="Anterior"${i === 0 ? ' disabled' : ''}>${svg('izq')}</button>
      <button type="button" class="mv-ic" data-fav aria-pressed="${!!it.fav}" aria-label="${it.fav ? 'Quitar de favoritas' : 'Marcar como favorita'}">${ic('estrella')}</button>
      <button type="button" class="mv-btn" data-acc>Acciones</button>
      <button type="button" class="mv-ic" data-sig aria-label="Siguiente"${i >= E.items.length - 1 && !E.next ? ' disabled' : ''}>${svg('der')}</button></div>`;
    if (i >= E.items.length - 4 && E.next) traer(true).then(() => { if (E.hojaVisor === h) h.titulo(`${i + 1} de ${E.items.length}${E.next ? '+' : ''}`); });
  }
  const pinta = () => { if (img) { img.style.transform = Z.css(s); } };
  function ir(d) { const n = i + d; if (n < 0 || n >= E.items.length) return; i = n; mostrar(); }
  // gestos en el escenario (la hoja no debe leer este arrastre como «cerrar»)
  const ptr = new Map(); let pinza = null, x0 = 0, y0 = 0, t0 = 0, moved = 0, ultToque = 0;
  stage.addEventListener('pointerdown', e => { if (!img) return; e.stopPropagation(); stage.setPointerCapture(e.pointerId); const r = stage.getBoundingClientRect(); ptr.set(e.pointerId, { x: e.clientX - r.left - bw / 2, y: e.clientY - r.top - bh / 2 }); x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); moved = 0; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinza = { s: { ...s }, p1: { ...a }, p2: { ...b } }; } });
  stage.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId); if (!p) return; const r = stage.getBoundingClientRect(), nx = e.clientX - r.left - bw / 2, ny = e.clientY - r.top - bh / 2, dx = nx - p.x, dy = ny - p.y; moved += Math.abs(dx) + Math.abs(dy); p.x = nx; p.y = ny;
    if (ptr.size === 2 && pinza) { const [a, b] = [...ptr.values()]; s = Z.pinch(pinza, { ...a }, { ...b }, dims()); pinta(); } else if (ptr.size === 1 && Z.isZoomed(s)) { s = Z.pan(s, dx, dy, dims()); pinta(); }
  });
  const suelta = e => {
    const era = ptr.size; ptr.delete(e.pointerId); if (ptr.size < 2) pinza = null; if (era !== 1 || e.type !== 'pointerup') return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!Z.isZoomed(s) && Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - t0 < 700) return ir(dx < 0 ? 1 : -1); // deslizar
    if (moved < 10 && Date.now() - t0 < 300) { const r = stage.getBoundingClientRect(); if (Date.now() - ultToque < 320) { s = Z.toggle(s, e.clientX - r.left - bw / 2, e.clientY - r.top - bh / 2, dims()); pinta(); ultToque = 0; } else ultToque = Date.now(); } // doble toque
  };
  stage.addEventListener('pointerup', suelta); stage.addEventListener('pointercancel', suelta);

  h.cuerpo.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const it = fichaAct();
    if (b.hasAttribute('data-prev')) return ir(-1); if (b.hasAttribute('data-sig')) return ir(1);
    if (b.hasAttribute('data-p')) return;
    if (b.hasAttribute('data-fav')) { const era = !!it.fav; it.fav = !era; mostrar(); try { await ctx.api('/api/media/item/' + encodeURIComponent(it.file), { method: 'PATCH', body: { fav: !era } }); } catch (er) { it.fav = era; mostrar(); ctx.toast('No se pudo: ' + er.message); } return; }
    if (b.hasAttribute('data-acc')) acciones(it);
  });
  h.cuerpo.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') ir(-1); else if (e.key === 'ArrowRight') ir(1); });
  function acciones(it) {
    const img0 = it.kind === 'image', fila = (k, ico, t, sub, cls = '') => `<li><button type="button" class="mv-lista-b ${cls}" data-a="${k}">${ic(ico, 'mv-lista-i')}<span><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span></button></li>`;
    const a = ctx.hoja({ titulo: 'Qué hacer con esto', cuerpo: `<ul class="mv-lista">${img0 ? fila('ref', 'varias', 'Usar de referencia', 'La lleva al compositor') + fila('variar', 'varita', 'Variar', 'Mismo pedido, otra versión') + fila('animar', 'anim', 'Animar', 'La convierte en video') + fila('dimitri', 'dimitri', 'Pedírselo a Dimitri', 'Se la enseñas en su chat') : it.kind === 'video' ? fila('variar', 'varita', 'Repetir el pedido', 'Lo deja listo para generar') : ''}${fila('descargar', 'bajar', 'Descargar', 'Se guarda en tu teléfono')}${fila('papelera', 'borrar', 'A la papelera', 'La puedes recuperar 30 días', 'rojo')}</ul>` });
    a.cuerpo.addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const k = b.dataset.a;
      if (k === 'descargar') { const l = document.createElement('a'); l.href = mediaSrc(it.file, it.at); l.download = it.file.split('/').pop(); document.body.append(l); l.click(); l.remove(); return a.cerrar(); }
      if (k === 'dimitri') { a.cerrar(); h.cerrar(); return setTimeout(() => pedirDimitri(it.file), 300); }
      if (k === 'papelera') {
        const r = await conEstado(b.querySelector('b') ? b : b, () => ctx.api('/api/media/item/' + encodeURIComponent(it.file), { method: 'DELETE' }), { ocupado: 'Moviendo…', hecho: 'En la papelera', ms: 200 });
        if (!r.ok) return; a.cerrar(); E.items = E.items.filter(x => x !== it); ctx.toast('A la papelera.', { accion: 'Deshacer', alAccion: async () => { try { if (r.valor.undo) await ctx.api('/api/media/restore', { method: 'POST', body: r.valor.undo }); await traer(); ctx.toast('Recuperada.'); } catch (er) { ctx.toast('No se pudo: ' + er.message); } } });
        if (!E.items.length) h.cerrar(); else { i = Math.min(i, E.items.length - 1); mostrar(); } dispatchEvent(new Event('ao:media-changed')); return;
      }
      if (['ref', 'variar', 'animar'].includes(k)) { a.cerrar(); if (k === 'ref') ctx.api('/api/media/item/' + encodeURIComponent(it.file), { method: 'PATCH', body: { used: 'ref' } }).catch(() => {}); h.cerrar(); setTimeout(() => volverACrear(k, it), 300); }
    });
  }
  mostrar();
}

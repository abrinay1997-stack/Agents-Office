// Versión móvil (25 oct 2026) — CEREBRO: lo que en escritorio es un cerebro 3D, aquí empieza como lo que se necesita en la calle: una LISTA de notas
// con buscador y filtros (carpeta · antigüedad · «por revisar»). Una nota se lee a pantalla completa, con sus [[enlaces]] como botones y lo que la
// rodea. Se puede subir un documento (PDF, Word, Excel, CSV, texto) y recuperar de la papelera. El mapa es secundario: un lienzo 2D ligero (sin
// three.js) con gestos de pellizco, que avisa si el teléfono es modesto y ofrece volver a la lista.
// Datos: /api/brain (nodos {id,g,d,t} y enlaces), /api/brain/search, /api/note?id=, /api/brain/stale, /api/brain/upload, /api/note/trash(+restore).
import { mdToHtml } from '../../md.js';
import * as Z from '../../viewer-zoom.js';
import { conEstado } from '../../accion.js';
import { esc, svg, vacio, esqueleto, falla, hace } from '../ui.js';
import { ic, modesto, sinTildes, leerDataURL, mediaSrc } from '../b-comun.js';

const COLORES = ['#1E7B4F', '#2E86AB', '#7449A9', '#C26A1B', '#B3261E', '#4F7D00', '#9B5F00', '#2B6BEB'];
const nombreCarpeta = g => String(g || 'Sin carpeta').replace(/^\d+[-_ ]?/, '') || String(g);
const DIAS = 864e5;

/** Lo puro: las notas que pasan los filtros, ordenadas (lo más reciente primero). nodos: [{id,g,d,t}]; t en segundos. */
export function filtrarNotas(nodos, { carpeta = 'todas', edad = 'todas', stale = new Map(), ahora = Date.now() } = {}) {
  let l = nodos.filter(n => n && n.id);
  if (carpeta !== 'todas') l = l.filter(n => n.g === carpeta);
  if (edad === 'semana') l = l.filter(n => ahora - n.t * 1000 < 7 * DIAS);
  else if (edad === 'viejas') l = l.filter(n => ahora - n.t * 1000 > 180 * DIAS);
  else if (edad === 'revisar') l = l.filter(n => stale.has(n.id));
  return l.slice().sort((a, b) => (b.t || 0) - (a.t || 0));
}
/** Lo puro: de qué notas habla un texto ([[a]], [[a|b]]), sin repetir. */
export function enlacesDe(texto) { const s = new Set(); for (const m of String(texto || '').matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) s.add(m[1].trim()); return [...s]; }
/** Lo puro: el markdown de una nota ya en HTML, con cada [[enlace]] (que md.js ya vuelve <a class="md-wiki">) como botón de 44 px. */
export function notaHTML(texto) {
  return mdToHtml(texto, { front: true }).replace(/<a class="md-wiki" data-note="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, n, label) => `<button type="button" class="mv-enl" data-nota="${n}">${label}</button>`);
}

export function registrar(shell) {
  const D = { nodos: [], enl: [], cargado: false, stale: new Map(), error: '' };
  const idx = new Map(); // id → índice del nodo
  const vecinas = id => { const i = idx.get(id), s = new Set(); if (i == null) return []; for (const [a, b] of D.enl) { if (a === i) s.add(D.nodos[b]?.id); else if (b === i) s.add(D.nodos[a]?.id); } return [...s].filter(Boolean); };

  shell.registrarVista({
    id: 'cerebro', titulo: 'Cerebro', icono: 'cerebro', grupo: 'mas', sec: 'trabajo', texto: 'Tus notas y documentos',
    montar(el, ctx) {
      let carpeta = 'todas', edad = 'todas', texto = '', hits = null, seq = 0, tmr = 0, limite = 60;
      el.innerHTML = `<form class="mv-busca" role="search"><label class="mv-sr" for="mvCq">Buscar en las notas</label>${svg('buscar', 'mv-busca-i')}<input id="mvCq" type="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar en tus notas…"></form>
        <div class="mv-chips mv-herr" role="group" aria-label="Acciones"><button type="button" class="mv-chip" data-a="nueva">${ic('nota')}Nueva nota</button><button type="button" class="mv-chip" data-a="subir">${ic('subir')}Subir documento</button><button type="button" class="mv-chip" data-a="mapa">${ic('mapa')}Mapa</button><button type="button" class="mv-chip" data-a="papelera">${svg('borrar')}Papelera</button></div>
        <div class="mv-chips" role="group" aria-label="Cuándo" data-ce></div><div class="mv-chips" role="group" aria-label="Carpeta" data-cc></div>
        <div class="mv-scroll" tabindex="-1" data-lista></div>`;
      const q = el.querySelector('#mvCq'), lista = el.querySelector('[data-lista]'), cEdad = el.querySelector('[data-ce]'), cCarp = el.querySelector('[data-cc]');

      async function cargar() {
        if (!D.cargado) lista.innerHTML = esqueleto(5);
        try {
          const [g, s] = await Promise.all([ctx.api('/api/brain'), ctx.api('/api/brain/stale').catch(() => ({ notes: [] }))]);
          D.nodos = g.nodes || []; D.enl = g.links || []; idx.clear(); D.nodos.forEach((n, i) => idx.set(n.id, i));
          D.stale = new Map((s.notes || []).map(n => [n.name, n.why])); D.cargado = true; D.error = '';
        } catch (e) { D.error = e.message; }
        pintar();
      }
      function chips() {
        const ed = [['todas', 'Todas'], ['semana', 'Esta semana'], ['viejas', 'Sin tocar en 6 meses'], ['revisar', `Por revisar${D.stale.size ? ' · ' + D.stale.size : ''}`]];
        cEdad.innerHTML = ed.map(([k, n]) => `<button type="button" class="mv-chip" data-edad="${k}" aria-pressed="${edad === k}">${esc(n)}</button>`).join('');
        const cs = [...new Set(D.nodos.map(n => n.g))].sort();
        cCarp.hidden = cs.length < 2;
        cCarp.innerHTML = `<button type="button" class="mv-chip" data-carp="todas" aria-pressed="${carpeta === 'todas'}">Todas las carpetas</button>` + cs.map(g => `<button type="button" class="mv-chip" data-carp="${esc(g)}" aria-pressed="${carpeta === g}">${esc(nombreCarpeta(g))}<b>${D.nodos.filter(n => n.g === g).length}</b></button>`).join('');
      }
      function pintar() {
        if (!D.cargado) { lista.innerHTML = D.error ? falla(D.error) : esqueleto(5); return; }
        chips();
        let filas, total;
        if (hits) { // resultados del servidor, y los filtros de carpeta y "por revisar" sobre ellos
          const h = hits.filter(x => (carpeta === 'todas' || (idx.has(x.name) && D.nodos[idx.get(x.name)].g === carpeta)) && (edad !== 'revisar' || D.stale.has(x.name)));
          total = h.length; filas = h.slice(0, limite).map(x => fila(x.name, nombreCarpeta(x.group), x.snippet));
        } else {
          const l = filtrarNotas(D.nodos, { carpeta, edad, stale: D.stale }); total = l.length;
          filas = l.slice(0, limite).map(n => fila(n.id, nombreCarpeta(n.g), `${hace(n.t * 1000)}${n.d ? ' · ' + n.d + ' enlaces' : ''}`, D.stale.get(n.id)));
        }
        lista.innerHTML = total ? `<ul class="mv-lista mv-notas-l">${filas.join('')}</ul>${total > limite ? `<div class="mv-cuerpo"><button type="button" class="mv-btn" data-mas>Ver ${Math.min(60, total - limite)} más (${total - limite} sin ver)</button></div>` : ''}`
          : vacio(hits ? 'Ninguna nota con eso' : edad === 'revisar' ? 'Nada por revisar' : 'Aquí no hay notas', hits ? 'Prueba con otra palabra o quita un filtro.' : edad === 'revisar' ? 'Todas tus notas están al día.' : 'Sube un documento o deja que los agentes escriban.', { icono: 'cerebro' });
      }
      const fila = (nombre, grupo, sub, viejo) => `<li><button type="button" class="mv-lista-b" data-nota="${esc(nombre)}">${ic('nota', 'mv-lista-i')}<span><b>${esc(nombre)}</b><small>${esc(grupo)}${sub ? ' · ' + esc(sub) : ''}</small>${viejo ? '<small class="mv-aviso">Puede estar vieja</small>' : ''}</span>${svg('der', 'mv-der')}</button></li>`;

      // ---- búsqueda ----
      q.addEventListener('input', () => {
        clearTimeout(tmr); texto = q.value.trim(); limite = 60;
        if (texto.length < 2) { hits = null; seq++; pintar(); return; }
        tmr = setTimeout(async () => { const mi = ++seq; try { const j = await ctx.api('/api/brain/search?q=' + encodeURIComponent(texto)); if (mi !== seq) return; hits = j.hits || []; } catch { if (mi !== seq) return; hits = []; } pintar(); }, 220);
      });
      el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); q.blur(); });

      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.nota) return abrirNota(ctx, b.dataset.nota, vecinas);
        if (b.dataset.edad) { edad = b.dataset.edad; limite = 60; return pintar(); }
        if (b.dataset.carp) { carpeta = b.dataset.carp; limite = 60; return pintar(); }
        if (b.hasAttribute('data-mas')) { limite += 60; return pintar(); }
        if (b.hasAttribute('data-reintentar')) return cargar();
        if (b.dataset.a === 'nueva') return nueva(ctx, cargar);
        if (b.dataset.a === 'subir') return subir(ctx, cargar);
        if (b.dataset.a === 'papelera') return papelera(ctx, cargar);
        if (b.dataset.a === 'mapa') return mapa(ctx, D, idx, n => abrirNota(ctx, n, vecinas));
      });
      el._cargar = cargar; el._abrir = nota => abrirNota(ctx, nota, vecinas);
      ctx.cabecera({ titulo: 'Cerebro' });
    },
    alMostrar(el, ctx, p) { el._cargar?.(); if (p && p.nota) { const n = p.nota; setTimeout(() => el._abrir?.(n), 60); } },
  });
}

/** La nota a pantalla completa (una hoja que cubre todo; «atrás» vuelve a la lista). Seguir un enlace cambia la nota dentro de la misma hoja. */
function abrirNota(ctx, nombre, vecinas) {
  const traza = []; let actual = null, h = null;
  const cuerpoHTML = j => {
    const desde = traza.length > 1 ? `<button type="button" class="mv-link" data-volver>‹ Volver a «${esc(traza.at(-2))}»</button>` : '';
    const ve = vecinas(j.name), enl = enlacesDe(j.text).filter(n => n !== j.name);
    const rel = n => `<li><button type="button" class="mv-lista-b" data-nota="${esc(n)}">${ic('nota', 'mv-lista-i')}<span><b>${esc(n)}</b></span>${svg('der', 'mv-der')}</button></li>`;
    const otras = ve.filter(n => !enl.includes(n));
    return `${desde}<div class="mv-nota-meta"><span>${esc(nombreCarpeta(j.group))}</span><span>${j.modified ? 'tocada ' + hace(j.modified) : ''}</span><span>${Math.max(1, Math.round((j.size || 0) / 1000))} KB</span></div>
      ${j.stale ? `<p class="mv-aviso-caja" role="note"><b>Puede estar vieja.</b> ${esc(j.stale)}</p>` : ''}
      <article class="mv-md md">${notaHTML(j.text)}</article>${j.cut ? '<p class="mv-meta">La nota es muy larga: se muestra el principio.</p>' : ''}
      ${enl.length ? `<h3 class="mv-gh">Enlaces de esta nota<span>${enl.length}</span></h3><ul class="mv-lista">${enl.map(rel).join('')}</ul>` : ''}
      ${otras.length ? `<h3 class="mv-gh">También conectada con<span>${otras.length}</span></h3><ul class="mv-lista">${otras.slice(0, 12).map(rel).join('')}</ul>` : ''}
      <div class="mv-det-acc">${j.editable ? '<button type="button" class="mv-btn primario" data-editar>Editar</button>' : ''}<button type="button" class="mv-btn" data-copiar>Copiar el texto</button>${j.deletable ? '<button type="button" class="mv-btn peligro" data-papelera>Mandar a la papelera</button>' : ''}</div>`;
  };
  async function ir(n, agregar = true) {
    h.cuerpo.innerHTML = esqueleto(4);
    try {
      const j = await ctx.api('/api/note?id=' + encodeURIComponent(n)); j.stale = null;
      try { const s = await ctx.api('/api/brain/stale'); j.stale = (s.notes || []).find(x => x.name === n)?.why || null; } catch {}
      actual = j; if (agregar) traza.push(n); h.titulo(n); h.cuerpo.innerHTML = cuerpoHTML(j); h.cuerpo.scrollTop = 0;
    } catch (e) {
      if (!actual) { h.cuerpo.innerHTML = falla(e.status === 404 ? 'Esa nota ya no existe.' : e.message); return; }
      h.cuerpo.innerHTML = cuerpoHTML(actual); ctx.toast(e.status === 404 ? `«${n}» no existe (todavía).` : 'No se pudo abrir: ' + e.message);
    }
  }
  function editar() { // el texto de la nota en un campo de 16 px; el servidor no la pisa si otra persona la cambió (base = modified)
    h.cuerpo.innerHTML = `<label class="mv-lab" for="mvEd">Texto de la nota (Markdown; [[nombre]] enlaza otra nota)</label><textarea id="mvEd" class="mv-campo" rows="16" spellcheck="true"></textarea><p class="mv-meta" data-est role="status"></p>
      <div class="mv-det-acc"><button type="button" class="mv-btn primario" data-guardar>Guardar</button><button type="button" class="mv-btn" data-cancelar>Cancelar</button></div>`;
    const ta = h.cuerpo.querySelector('#mvEd'); ta.value = actual.text; ta.focus({ preventScroll: true });
  }
  h = ctx.hoja({ titulo: nombre, lleno: true, clase: 'mv-nota', cuerpo: esqueleto(4) });
  h.cuerpo.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.nota) return ir(b.dataset.nota);
    if (b.hasAttribute('data-volver')) { traza.pop(); return ir(traza.pop(), true); }
    if (b.hasAttribute('data-reintentar')) return ir(traza.at(-1) || nombre, !traza.length);
    if (b.hasAttribute('data-copiar')) { try { await navigator.clipboard.writeText(actual.text); ctx.toast('Texto copiado.'); } catch { ctx.toast('Tu teléfono no dejó copiar. Mantén pulsado el texto para elegirlo.'); } return; }
    if (b.hasAttribute('data-editar')) return editar(); // 27 oct 2026: escribir en el Cerebro
    if (b.hasAttribute('data-guardar')) {
      const ta = h.cuerpo.querySelector('#mvEd'), est = h.cuerpo.querySelector('[data-est]');
      const r = await conEstado(b, () => ctx.api('/api/note', { method: 'PUT', body: { name: actual.name, text: ta.value, base: actual.modified } }), { ocupado: 'Guardando…', hecho: 'Guardada' });
      if (!r.ok) { est.textContent = r.error || r.mensaje || 'No se pudo guardar.'; return; }
      ctx.toast('Nota guardada.'); document.querySelector('#mvRoot [data-vista="cerebro"]')?._cargar?.(); return ir(actual.name, false);
    }
    if (b.hasAttribute('data-cancelar')) return ir(actual.name, false);
    if (b.hasAttribute('data-papelera')) {
      if (!(await ctx.confirmar({ titulo: '¿Mandar esta nota a la papelera?', texto: `La podrás recuperar desde Cerebro → Papelera durante 30 días.${actual.key ? ' OJO: es una nota clave de la oficina; sin ella los agentes trabajan con menos contexto.' : ''}`, ok: 'A la papelera', peligro: true }))) return;
      const r = await conEstado(b, () => ctx.api('/api/note/trash', { method: 'POST', body: { id: actual.name } }), { ocupado: 'Moviendo…', hecho: 'En la papelera' });
      if (r.ok) { h.cerrar(); ctx.toast('Nota en la papelera.', { accion: 'Deshacer', alAccion: () => ctx.api('/api/note/restore', { method: 'POST', body: { file: r.valor.trashed } }).then(() => ctx.toast('Nota recuperada.')).catch(er => ctx.toast('No se pudo: ' + er.message)) }); document.querySelector('#mvRoot [data-vista="cerebro"]')?._cargar?.(); }
    }
  });
  ir(nombre);
}

async function papelera(ctx, recargar) {
  const h = ctx.hoja({ titulo: 'Papelera del Cerebro', lleno: true, cuerpo: esqueleto(3) });
  async function cargar() {
    try {
      const j = await ctx.api('/api/note/trash'), l = j.items || [];
      h.cuerpo.innerHTML = l.length ? `<p class="mv-meta">Lo que mandas aquí se borra para siempre a los ${j.keepDays || 30} días.</p><ul class="mv-lista">${l.map(x => `<li class="mv-conv"><span class="mv-conv-b"><b>${esc(x.name)}</b><small>${hace(x.at)}</small></span><button type="button" class="mv-btn" data-rec="${esc(x.file)}">Recuperar</button></li>`).join('')}</ul>` : vacio('La papelera está vacía', 'Aquí aparecen las notas de la oficina que mandes a la papelera.', { icono: 'borrar' });
    } catch (e) { h.cuerpo.innerHTML = falla(e.message); }
  }
  h.cuerpo.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-reintentar')) return cargar();
    if (b.dataset.rec) { const r = await conEstado(b, () => ctx.api('/api/note/restore', { method: 'POST', body: { file: b.dataset.rec } }), { ocupado: 'Recuperando…', hecho: 'Recuperada' }); if (r.ok) { b.closest('li').remove(); recargar(); } }
  });
  cargar();
}

/** 27 oct 2026: escribir una nota nueva (antes solo se podía subir un documento). */
function nueva(ctx, recargar) {
  const h = ctx.hoja({ titulo: 'Nota nueva', cuerpo: `<p class="mv-texto">La leen los agentes cuando toca su trabajo. [[nombre]] la enlaza con otra nota.</p>
    <label class="mv-lab" for="mvNn">Nombre</label><input id="mvNn" class="mv-campo" maxlength="80" autocomplete="off" enterkeyhint="next">
    <label class="mv-lab" for="mvNg">Carpeta</label><input id="mvNg" class="mv-campo" maxlength="60" value="Notas" autocomplete="off">
    <label class="mv-lab" for="mvNt">Texto</label><textarea id="mvNt" class="mv-campo" rows="9" spellcheck="true"></textarea><p class="mv-meta" data-est role="status"></p>`,
    acciones: [{ texto: 'Guardar la nota', tipo: 'primario', alTocar: async (x, b) => {
      const v = id => h.cuerpo.querySelector(id).value, est = h.cuerpo.querySelector('[data-est]');
      const r = await conEstado(b, () => ctx.api('/api/note', { method: 'POST', body: { name: v('#mvNn'), group: v('#mvNg'), text: v('#mvNt') } }), { ocupado: 'Guardando…', hecho: 'Guardada' });
      if (!r.ok) { est.textContent = r.error || r.mensaje || 'No se pudo guardar.'; return; }
      x.cerrar(); recargar(); ctx.toast(`Nota «${r.valor.name}» creada.`);
    } }, { texto: 'Cancelar', alTocar: x => x.cerrar() }] });
  setTimeout(() => h.cuerpo.querySelector('#mvNn')?.focus({ preventScroll: true }), 250);
}

function subir(ctx, recargar) {
  const h = ctx.hoja({ titulo: 'Subir al Cerebro', cuerpo: `<p class="mv-texto">PDF, Word, Excel, CSV o texto (hasta 15 MB). Se vuelve una nota que los agentes pueden encontrar.</p>
    <input type="file" class="mv-sr" id="mvArch" accept=".pdf,.docx,.xlsx,.csv,.txt,.md,application/pdf,text/*">
    <label class="mv-btn primario mv-etq" for="mvArch">${ic('subir')} Elegir un archivo</label>
    <p class="mv-meta" data-est role="status"></p>
    <h3 class="mv-gh">¿Es un papel o una foto?</h3><p class="mv-meta">Un papel fotografiado no se puede leer como texto. Hazle la foto aquí y queda guardada en el Estudio, donde puedes pedírsela a Dimitri.</p>
    <input type="file" class="mv-sr" id="mvFoto" accept="image/*" capture="environment"><label class="mv-btn mv-etq" for="mvFoto">${ic('foto')} Hacer una foto</label>`, acciones: [{ texto: 'Cerrar', alTocar: x => x.cerrar() }] });
  const est = h.cuerpo.querySelector('[data-est]'); const di = t => { est.textContent = t; };
  h.cuerpo.querySelector('#mvArch').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 15 * 1024 * 1024) return di('Ese archivo pasa de 15 MB.');
    di(`Subiendo «${f.name}»…`);
    try { const d = await leerDataURL(f), j = await ctx.api('/api/brain/upload', { method: 'POST', body: { name: f.name, data: d.slice(d.indexOf(',') + 1) } }); h.cerrar(); recargar(); ctx.toast(`Nota «${j.note}» creada.`); }
    catch (er) { di('No se pudo: ' + er.message); }
  });
  h.cuerpo.querySelector('#mvFoto').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return; di('Guardando la foto en el Estudio…');
    try { await ctx.api('/api/media/upload', { method: 'POST', body: { name: f.name || 'foto.jpg', data: await leerDataURL(f) } }); h.cerrar(); ctx.toast('Foto guardada en el Estudio.'); dispatchEvent(new Event('ao:media-changed')); }
    catch (er) { di('No se pudo: ' + er.message); }
  });
}

/** El mapa: lienzo 2D con las posiciones del grafo. Pellizco para acercar, arrastrar para mover, un toque elige una nota. Sin three.js. */
function mapa(ctx, D, idx, abrir) {
  const h = ctx.hoja({ titulo: 'Mapa del Cerebro', lleno: true, clase: 'mv-mapa', cuerpo: '<div class="mv-mapa-c"></div>', acciones: [{ texto: 'Ver como lista', alTocar: x => x.cerrar() }] });
  const cont = h.cuerpo.querySelector('.mv-mapa-c');
  if (!D.nodos.length) { cont.innerHTML = vacio('Aún no hay notas', 'Cuando haya notas, aquí verás cómo se conectan.', { icono: 'cerebro' }); return; }
  const flojo = modesto() || D.nodos.length > 1500;
  if (flojo) {
    cont.innerHTML = vacio('Este mapa puede ir lento', modesto() ? 'Tu teléfono es modesto para dibujar tantos puntos. La lista de notas hace lo mismo con menos esfuerzo.' : `Son ${D.nodos.length} notas: es mucho para un teléfono.`, { icono: 'alerta', boton: 'Ver el mapa igual', accion: 'data-igual' }) + '<div class="mv-cuerpo"><button type="button" class="mv-btn primario" data-lista>Mejor la lista</button></div>';
    cont.addEventListener('click', e => { if (e.target.closest('[data-lista]')) h.cerrar(); else if (e.target.closest('[data-igual]')) dibujar(); }, { once: false });
  } else dibujar();

  function dibujar() {
    cont.innerHTML = '<canvas class="mv-lienzo" role="img" aria-label="Mapa de las notas y sus enlaces. Debajo hay una lista para leerlas."></canvas><div class="mv-mapa-n" role="status" aria-live="polite"></div><p class="mv-sr">Usa «Ver como lista» para leer las notas con el lector de pantalla.</p>';
    const cv = cont.querySelector('canvas'), info = cont.querySelector('.mv-mapa-n'), g = cv.getContext('2d');
    const xs = D.nodos.map(n => n.x), ys = D.nodos.map(n => n.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const grupos = [...new Set(D.nodos.map(n => n.g))], dpr = Math.min(2, devicePixelRatio || 1);
    let W = 0, H = 0, s = Z.fitted(), elegido = -1, ro;
    const dims = () => ({ nw: W, nh: H, bw: W, bh: H });
    const pos = n => { const S = Math.min(W, H) * .9; return [W / 2 + s.x + ((n.x - x0) / (x1 - x0 || 1) - .5) * S * s.scale * (W > H ? 1 : 1), H / 2 + s.y + ((n.y - y0) / (y1 - y0 || 1) - .5) * S * s.scale]; };
    function medir() { const r = cv.getBoundingClientRect(); W = Math.max(50, r.width); H = Math.max(50, r.height); cv.width = W * dpr; cv.height = H * dpr; s = Z.clampPan(s, dims()); pintar(); }
    function pintar() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const css = getComputedStyle(cv), tinta = css.color, P = D.nodos.map(pos);
      g.lineWidth = 1; g.strokeStyle = tinta; g.globalAlpha = .18; g.beginPath(); for (const [a, b] of D.enl) { if (!P[a] || !P[b]) continue; g.moveTo(P[a][0], P[a][1]); g.lineTo(P[b][0], P[b][1]); } g.stroke(); g.globalAlpha = 1;
      D.nodos.forEach((n, i) => { const r = 3 + Math.min(6, Math.sqrt(n.d || 1)) * (i === elegido ? 1.6 : 1); g.fillStyle = COLORES[grupos.indexOf(n.g) % COLORES.length]; g.beginPath(); g.arc(P[i][0], P[i][1], r, 0, 7); g.fill(); if (i === elegido) { g.lineWidth = 3; g.strokeStyle = tinta; g.stroke(); } });
      if (s.scale > 2.2 || elegido >= 0) { g.font = '600 13px system-ui, sans-serif'; g.fillStyle = tinta; g.textBaseline = 'middle'; D.nodos.forEach((n, i) => { if ((s.scale > 2.2 && n.d > 3) || i === elegido) { if (P[i][0] > -20 && P[i][0] < W + 20 && P[i][1] > -20 && P[i][1] < H + 20) g.fillText(n.id, P[i][0] + 9, P[i][1]); } }); }
    }
    // gestos: un dedo mueve (o toca), dos dedos acercan
    const ptr = new Map(); let pinza = null, mov = 0, ini = null;
    cv.addEventListener('pointerdown', e => { e.stopPropagation(); /* la hoja no debe leer este arrastre como «cerrar» */ cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); mov = 0; ini = { x: e.offsetX, y: e.offsetY }; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinza = { s: { ...s }, p1: { x: a.x - W / 2, y: a.y - H / 2 }, p2: { x: b.x - W / 2, y: b.y - H / 2 } }; } });
    cv.addEventListener('pointermove', e => {
      const p = ptr.get(e.pointerId); if (!p) return; const dx = e.offsetX - p.x, dy = e.offsetY - p.y; mov += Math.abs(dx) + Math.abs(dy); p.x = e.offsetX; p.y = e.offsetY;
      if (ptr.size === 2 && pinza) { const [a, b] = [...ptr.values()]; s = Z.pinch(pinza, { x: a.x - W / 2, y: a.y - H / 2 }, { x: b.x - W / 2, y: b.y - H / 2 }, dims()); } else if (ptr.size === 1) s = Z.pan(s, dx, dy, dims());
      pintar();
    });
    const suelta = e => {
      const era = ptr.size; ptr.delete(e.pointerId); if (ptr.size < 2) pinza = null;
      if (e.type === 'pointerup' && era === 1 && mov < 10 && ini) { // un toque: la nota más cercana (16 px con ratón, 26 con el dedo)
        const tol = e.pointerType === 'touch' ? 26 : 16; let mejor = -1, md = tol * tol;
        D.nodos.forEach((n, i) => { const [px, py] = pos(n), d = (px - ini.x) ** 2 + (py - ini.y) ** 2; if (d < md) { md = d; mejor = i; } });
        elegido = mejor; pintar();
        info.innerHTML = mejor < 0 ? '' : `<div class="mv-mapa-ficha"><b>${esc(D.nodos[mejor].id)}</b><small>${esc(nombreCarpeta(D.nodos[mejor].g))}${D.nodos[mejor].d ? ' · ' + D.nodos[mejor].d + ' enlaces' : ''}</small><button type="button" class="mv-btn primario" data-abrir>Abrir la nota</button></div>`;
      }
    };
    cv.addEventListener('pointerup', suelta); cv.addEventListener('pointercancel', suelta);
    cv.addEventListener('dblclick', e => { s = Z.toggle(s, e.offsetX - W / 2, e.offsetY - H / 2, dims()); pintar(); });
    info.addEventListener('click', e => { if (e.target.closest('[data-abrir]') && elegido >= 0) { const n = D.nodos[elegido].id; h.cerrar(); setTimeout(() => abrir(n), 280); } });
    ro = new ResizeObserver(medir); ro.observe(cv); medir();
  }
}

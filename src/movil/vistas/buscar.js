// Versión móvil (25 oct 2026) — BUSCAR: el Ctrl+K del escritorio, hecho pantalla. Un campo arriba (teclado de búsqueda, 16 px) y los resultados
// agrupados por lo que son: tareas, agentes, rutinas, notas del Cerebro e imágenes. Lo de la oficina se filtra aquí mismo (ya está en el store);
// las notas y las imágenes se buscan en el servidor (/api/brain/search, /api/media?q=), como en escritorio. Recientes si el campo está vacío.
import { esc, svg, vacio } from '../ui.js';
import { ic, sinTildes, mediaSrc } from '../b-comun.js';
import { esMia } from '../../../tareas/identidad.mjs';

const REC = 'ao.mv.recientes';
const leer = () => { try { return JSON.parse(localStorage.getItem(REC) || '[]').filter(x => typeof x === 'string').slice(0, 6); } catch { return []; } };
const guardar = q => { q = q.trim(); if (q.length < 2) return; try { localStorage.setItem(REC, JSON.stringify([q, ...leer().filter(x => x !== q)].slice(0, 6))); } catch {} };
const borrar = () => { try { localStorage.removeItem(REC); } catch {} };
const fragmento = (texto, palabras) => { const t = String(texto || '').replace(/\s+/g, ' '), f = sinTildes(t); let i = -1; for (const w of palabras) { i = f.indexOf(w); if (i >= 0) break; } return i < 0 ? t.slice(0, 90) : (i > 30 ? '…' : '') + t.slice(Math.max(0, i - 30), i + 70) + (t.length > i + 70 ? '…' : ''); };

/** Lo puro: las tareas, agentes y rutinas que casan con las palabras (todas deben estar). */
export function buscarLocal(q, { tareas = [], agentes = [], rutinas = [] }) {
  const palabras = sinTildes(q).split(/\s+/).filter(w => w.length > 1); if (!palabras.length) return { palabras, tareas: [], agentes: [], rutinas: [] };
  const casa = s => { const f = sinTildes(s); return palabras.every(w => f.includes(w)); };
  return {
    palabras,
    tareas: tareas.filter(t => !t.piece && !t.archived && casa([t.title, t.text, t.result, t.person].join(' '))).slice().reverse().slice(0, 12),
    agentes: agentes.filter(a => casa(`${a.name} ${a.role || ''} ${a.does || ''}`)).slice(0, 8),
    rutinas: rutinas.filter(r => casa([r.title, r.text].join(' '))).slice(0, 8),
  };
}

export function registrar(shell) {
  shell.registrarVista({
    id: 'buscar', titulo: 'Buscar', icono: 'buscar', grupo: 'mas', sec: 'oficina', texto: 'Tareas, notas, agentes, imágenes…',
    montar(el, ctx) {
      el.innerHTML = `<form class="mv-busca" role="search"><label class="mv-sr" for="mvQ">Buscar en la oficina</label>${svg('buscar', 'mv-busca-i')}<input id="mvQ" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Tareas, notas, agentes, imágenes…"></form>
        <div class="mv-scroll mv-res" tabindex="-1" aria-live="polite"></div>`;
      const q = el.querySelector('#mvQ'), cuerpo = el.querySelector('.mv-res'), forma = el.querySelector('form');
      let seq = 0, agentes = [], notas = [], imgs = [], tot = 0, tmr = 0, ult = '';
      const nombreAg = id => agentes.find(a => a.id === id)?.name || '';

      function pinta(local, estado) {
        const f = q.value.trim();
        if (f.length < 2) { const r = leer(); cuerpo.innerHTML = r.length ? `<h3 class="mv-gh">Recientes <button type="button" class="mv-link" data-limpiar>Borrar</button></h3><ul class="mv-lista">${r.map(x => `<li><button type="button" class="mv-lista-b" data-rec="${esc(x)}">${svg('reloj', 'mv-lista-i')}<span><b>${esc(x)}</b></span></button></li>`).join('')}</ul>` : vacio('Busca en toda la oficina', 'Escribe al menos dos letras: tareas, notas del Cerebro, agentes, rutinas e imágenes del Estudio.', { icono: 'buscar' }); return; }
        const fila = (k, i, titulo, sub, extra = '') => `<li><button type="button" class="mv-lista-b" data-k="${k}" data-i="${i}">${extra || ''}<span><b>${esc(titulo)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${svg('der', 'mv-der')}</button></li>`;
        const bloque = (t, n, filas) => filas ? `<h3 class="mv-gh">${t}<span>${n}</span></h3><ul class="mv-lista">${filas}</ul>` : '';
        const L = local;
        const subTarea = t => [esMia(t) ? 'Tuya' : nombreAg(t.agent), fragmento([t.text, t.result].join(' '), L.palabras)].filter(Boolean).join(' · ');
        const hTar = L.tareas.map(t => fila('t', t.id, t.title, subTarea(t)));
        const hAg = L.agentes.map(a => fila('a', a.id, a.name, a.role || a.does || ''));
        const hRu = L.rutinas.map(r => fila('r', r.id, r.title, r.desc || ''));
        const hNo = notas.map((n, i) => fila('n', i, n.name, n.snippet || n.group || '', ic('nota', 'mv-lista-i')));
        const hIm = imgs.length ? `<h3 class="mv-gh">Imágenes<span>${tot}</span></h3><div class="mv-miniaturas">${imgs.map((m, i) => `<button type="button" class="mv-mini-img" data-k="i" data-i="${i}" aria-label="${esc(String(m.prompt || m.name || m.file).slice(0, 60))}">${/\.(mp4|webm)$/i.test(m.file) ? ic('play') : /\.(mp3|wav)$/i.test(m.file) ? ic('nota_s') : `<img src="${esc(mediaSrc(m.file, m.at))}" alt="" loading="lazy">`}</button>`).join('')}</div>${tot > imgs.length ? `<button type="button" class="mv-link" data-k="im">Ver los ${tot} en el Estudio</button>` : ''}` : '';
        const hay = hTar.length + hAg.length + hRu.length + hNo.length + imgs.length;
        cuerpo.innerHTML = (bloque('Tareas', hTar.length, hTar.join('')) + bloque('Agentes', hAg.length, hAg.join('')) + bloque('Rutinas', hRu.length, hRu.join('')) + bloque('Notas', hNo.length, hNo.join('')) + hIm)
          + (estado === 'buscando' ? '<p class="mv-meta" role="status">Buscando en las notas y en el Estudio…</p>' : '')
          + (!hay && estado !== 'buscando' ? vacio('Nada con eso', `No encontré «${f}». Prueba con otra palabra o menos letras.`, { icono: 'buscar' }) : '');
      }
      async function buscar() {
        const f = q.value.trim(), mi = ++seq; ult = f;
        if (f.length < 2) { notas = []; imgs = []; pinta(null); return; }
        const st = ctx.store.st; if (!agentes.length) agentes = await ctx.store.agentes();
        const local = buscarLocal(f, { tareas: st.tareas, agentes, rutinas: st.rutinas }); el._local = local;
        notas = []; imgs = []; tot = 0; pinta(local, 'buscando');
        const [n, m] = await Promise.allSettled([ctx.api('/api/brain/search?q=' + encodeURIComponent(f)), ctx.api('/api/media?n=8&q=' + encodeURIComponent(f))]);
        if (mi !== seq) return;
        if (n.status === 'fulfilled') notas = (n.value.hits || []).slice(0, 12);
        if (m.status === 'fulfilled') { imgs = m.value.items || []; tot = m.value.total || imgs.length; }
        pinta(local);
      }
      q.addEventListener('input', () => { clearTimeout(tmr); if (q.value.trim().length < 2) { seq++; buscar(); return; } tmr = setTimeout(buscar, 220); });
      forma.addEventListener('submit', e => { e.preventDefault(); clearTimeout(tmr); q.blur(); buscar(); });

      cuerpo.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-limpiar')) { borrar(); pinta(null); return; }
        if (b.dataset.rec) { q.value = b.dataset.rec; buscar(); return; }
        const k = b.dataset.k; if (!k) return;
        guardar(ult || q.value);
        const L = el._local || { tareas: [], agentes: [], rutinas: [] };
        if (k === 't') return ctx.navegar('tareas', { t: b.dataset.i });
        if (k === 'n') return ctx.navegar('cerebro', { nota: notas[+b.dataset.i]?.name });
        if (k === 'i') return ctx.navegar('estudio', { file: imgs[+b.dataset.i]?.file });
        if (k === 'im') return ctx.navegar('estudio', { q: ult });
        if (k === 'a') { const a = L.agentes.find(x => x.id === b.dataset.i); if (a) ctx.hoja({ titulo: a.name, cuerpo: `<p class="mv-meta">${esc(a.role || '')}${a.dept ? ' · ' + esc(a.dept) : ''}</p><p class="mv-texto">${esc(a.does || '')}</p>`, acciones: [{ texto: 'Cerrar', alTocar: h => h.cerrar() }] }); return; }
        if (k === 'r') { const r = L.rutinas.find(x => x.id === b.dataset.i); if (r) ctx.hoja({ titulo: r.title, cuerpo: `<p class="mv-meta">${esc(r.desc || '')}${r.paused ? ' · en pausa' : ''}</p><p class="mv-texto">${esc(r.text || '')}</p>`, acciones: [{ texto: 'Ver en el calendario', tipo: 'primario', alTocar: h => { h.cerrar(); setTimeout(() => ctx.navegar('calendario'), 260); } }] }); }
      });
      el._enfocar = () => { q.value = ''; seq++; notas = []; imgs = []; pinta(null); q.focus(); };
    },
    alMostrar(el) { el._enfocar?.(); },
  });
}

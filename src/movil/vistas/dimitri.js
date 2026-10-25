// Versión móvil (25 oct 2026) — DIMITRI: el chat a pantalla completa, con la entrada fija abajo (sube con el teclado). Reutiliza /api/sub/*:
// la charla, «¿Cómo vamos?» al instante, el historial de conversaciones (🕘), una nueva conversación, y las tarjetas de lo que propone:
// un PLAN (piezas para los jefes, con ENVIAR), CAMBIOS en el calendario o las tareas (HACER / Descartar) y preguntas con opciones.
// Lo que GASTA (generar en el Estudio, activar un anuncio) NO se confirma aquí: la tarjeta dice cuánto y lo manda a la vista de escritorio,
// donde están los dos clics y los topes. Todo lo que dice Dimitri se pinta con md.js (escapa antes de añadir marcas).
import { mdToHtml } from '../../md.js';
import { esc, svg, vacio, hace } from '../ui.js';

const SUGERENCIAS = [['¿Cómo vamos?', 'estado'], ['¿Qué tengo pendiente esta semana?', 'chat'], ['Arma el plan de contenido de la semana', 'chat']];

export function registrar(shell) {
  shell.registrarVista({
    id: 'dimitri', titulo: 'Dimitri', icono: 'dimitri', grupo: 'tab',
    montar(el, ctx) {
      let mensajes = [], cargado = false, ocupado = false, nombre = 'Dimitri', picks = new Map(), error = '';
      el.innerHTML = `<div class="mv-scroll mv-chat" id="mvChatSc" tabindex="-1"><div class="mv-hilo" role="log" aria-live="polite" aria-label="Conversación con Dimitri"></div></div>
        <form class="mv-compone" autocomplete="off"><label class="mv-sr" for="mvDim">Escríbele a Dimitri</label><textarea id="mvDim" rows="1" enterkeyhint="send" placeholder="Escríbele a Dimitri…"></textarea><button type="submit" class="mv-enviar" aria-label="Enviar" disabled>${svg('enviar')}</button></form>`;
      const hilo = el.querySelector('.mv-hilo'), sc = el.querySelector('.mv-scroll'), caja = el.querySelector('#mvDim'), forma = el.querySelector('.mv-compone'), env = forma.querySelector('.mv-enviar');

      const abajo = (suave = false) => requestAnimationFrame(() => sc.scrollTo({ top: sc.scrollHeight, behavior: suave ? 'smooth' : 'auto' }));
      async function cargar() {
        try { const j = await ctx.api('/api/sub'); mensajes = j.messages || []; if (j.name) nombre = j.name; cargado = true; error = ''; } catch (e) { error = e.message; }
        pintar(true);
      }
      function planHTML(m) {
        const p = m.plan; if (!p || !(p.tasks || []).length) return '';
        const abiertas = p.tasks.filter(t => t.state === 'proposed'), vencida = abiertas.some(t => t.at && t.at <= Date.now() + 30000);
        return `<section class="mv-tarjeta" aria-label="Plan de Dimitri"><h4>Plan · ${p.tasks.length} ${p.tasks.length === 1 ? 'pieza' : 'piezas'}</h4><ul>${p.tasks.map(t => `<li class="${t.state}"><b>${esc(t.title)}</b><small>${esc(t.dept || '')}${t.agent ? ' · ' + esc(t.agent) : ''}${t.limite ? ' · para ' + esc(t.limite) : ''}${t.state !== 'proposed' ? ' · ' + (t.state === 'sent' || t.state === 'done' ? 'enviada' : esc(t.state)) : ''}</small></li>`).join('')}</ul>
          ${abiertas.length ? (vencida ? '<p class="mv-meta">Una hora del plan ya pasó. Dile a Dimitri qué hora prefieres.</p>' : `<button type="button" class="mv-btn primario" data-enviar="${esc(m.id)}">Enviar a los jefes (${abiertas.length})</button>`) : ''}</section>`;
      }
      function opsHTML(m) {
        const ops = m.ops; if (!ops || !ops.length) return '';
        const abiertas = ops.filter(o => o.state === 'proposed' && !o.confirmar), gasta = ops.filter(o => o.state === 'proposed' && o.confirmar);
        return `<section class="mv-tarjeta" aria-label="Cambios propuestos"><h4>Cambios que propone</h4><ul>${ops.map(o => `<li class="${o.state}"><b>${esc(o.desc || o.type)}</b><small>${o.state === 'done' ? 'hecho' : o.state === 'skipped' ? 'descartado' : o.state === 'failed' ? 'no se pudo' + (o.error ? ': ' + esc(o.error) : '') : o.confirmar ? 'gasta dinero' : 'pendiente'}</small></li>`).join('')}</ul>
          ${gasta.length ? `<p class="mv-meta">Lo que gasta se confirma con la cifra en la versión de escritorio.</p><button type="button" class="mv-btn" data-gasto>Ver en escritorio</button>` : ''}
          ${abiertas.length ? `<div class="mv-fila-btn"><button type="button" class="mv-btn" data-ops-no="${esc(m.id)}">Descartar</button><button type="button" class="mv-btn primario" data-ops-si="${esc(m.id)}">Hacerlo (${abiertas.length})</button></div>` : ''}</section>`;
      }
      function estudioHTML(m) {
        const s = m.studio; if (!s || !(s.creatives || []).length) return '';
        return `<section class="mv-tarjeta" aria-label="Creativos"><h4>Propone ${s.creatives.length} ${s.creatives.length === 1 ? 'creativo' : 'creativos'}</h4><p class="mv-meta">${s.cost ? 'Costo estimado: US$' + esc(String(s.cost.total ?? s.cost)) + '. ' : ''}Generar gasta: se confirma en el Estudio.</p><button type="button" class="mv-btn" data-gasto>Verlo en el Estudio</button></section>`;
      }
      function preguntasHTML(m) {
        const qs = (m.plan && m.plan.questions) || []; if (!qs.length || m.plan.answers) return '';
        return qs.filter(q => typeof q === 'object' && (q.options || []).length).map(q => `<section class="mv-tarjeta" aria-label="Pregunta"><h4>${esc(q.q)}</h4><div class="mv-opciones">${q.options.map(o => `<button type="button" class="mv-chip" data-opcion="${esc(o.label)}" data-msg="${esc(m.id)}" data-q="${esc(q.id)}">${esc(o.label)}</button>`).join('')}</div></section>`).join('');
      }
      function burbuja(m) {
        const mio = m.who === 'user';
        return `<div class="mv-msg ${mio ? 'mio' : 'suyo'}"><div class="mv-burbuja">${mio ? `<p>${esc(m.text)}</p>` : `<div class="md">${mdToHtml(m.text || '')}</div>`}</div>${mio ? '' : planHTML(m) + opsHTML(m) + estudioHTML(m) + preguntasHTML(m)}${m.at ? `<time>${hace(m.at)}</time>` : ''}</div>`;
      }
      function pintar(fondo) {
        if (!cargado) { hilo.innerHTML = error ? `<div class="mv-vacio" role="alert"><h3>No se pudo abrir el chat</h3><p>${esc(error)}</p><button type="button" class="mv-btn" data-reintentar>Reintentar</button></div>` : '<div class="mv-esq" aria-hidden="true"><i></i><i></i></div>'; return; }
        const nuevo = !mensajes.length;
        hilo.innerHTML = nuevo ? `<div class="mv-saludo">${svg('dimitri', 'mv-vacio-i')}<h3>Hola, soy ${esc(nombre)}</h3><p>Tu mano derecha. Pregúntame cómo va la oficina o pídeme que organice trabajo.</p><div class="mv-sugs">${SUGERENCIAS.map(([t, k]) => `<button type="button" class="mv-chip" data-sug="${esc(t)}" data-k="${k}">${esc(t)}</button>`).join('')}</div></div>`
          : mensajes.map(burbuja).join('') + (ocupado ? `<div class="mv-msg suyo"><div class="mv-burbuja pensando" role="status"><i></i><i></i><i></i><span class="mv-sr">${esc(nombre)} está pensando</span></div></div>` : '');
        env.disabled = ocupado || !caja.value.trim(); if (fondo !== false) abajo();
      }

      async function enviar(texto, via = 'chat') {
        texto = texto.trim(); if (!texto || ocupado) return; ocupado = true; caja.value = ''; ajustaAlto();
        mensajes.push({ id: 'tmp', who: 'user', text: texto, at: Date.now() }); pintar(); const desde = Date.now() - 5000;
        try {
          const j = await ctx.api(via === 'estado' ? '/api/sub/estado' : '/api/sub/chat', { method: 'POST', body: via === 'estado' ? { text: texto } : { text: texto } });
          mensajes = mensajes.filter(m => m.id !== 'tmp').concat(j.messages || []);
        } catch (e) {
          mensajes = mensajes.filter(m => m.id !== 'tmp'); // si el teléfono se durmió, la respuesta pudo llegar: se mira antes de decir que falló
          try { const j = await ctx.api('/api/sub'); mensajes = j.messages || mensajes; if (!mensajes.some(m => m.who === 'sub' && m.at >= desde)) throw e; }
          catch { mensajes.push({ id: 'err' + Date.now(), who: 'sub', text: `No pude responder ahora (${e.message}). Tu mensaje no se perdió: pulsa enviar otra vez.`, at: Date.now() }); caja.value = texto; ajustaAlto(); }
        }
        ocupado = false; pintar(); ctx.store.refrescar();
      }
      async function post(ruta, cuerpo) { return ctx.api(ruta, { method: 'POST', body: cuerpo }); }
      async function accion(id, ruta, cuerpo, ok) {
        try { const j = await post(ruta, cuerpo); const k = mensajes.findIndex(x => x.id === id); if (k >= 0 && j.message) mensajes[k] = j.message; for (const x of j.messages || []) if (!mensajes.some(y => y.id === x.id)) mensajes.push(x); ctx.toast(ok); }
        catch (e) { ctx.toast('No se pudo: ' + e.message); }
        pintar(); ctx.store.refrescar();
      }

      forma.addEventListener('submit', e => { e.preventDefault(); enviar(caja.value); });
      caja.addEventListener('input', () => { ajustaAlto(); env.disabled = ocupado || !caja.value.trim(); });
      function ajustaAlto() { caja.style.height = 'auto'; caja.style.height = Math.min(140, caja.scrollHeight) + 'px'; }
      caja.addEventListener('focus', () => setTimeout(() => abajo(true), 250));
      hilo.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.sug) return enviar(b.dataset.sug, b.dataset.k);
        if (b.dataset.opcion) return enviar(b.dataset.opcion);
        if (b.dataset.enviar) { const m = mensajes.find(x => x.id === b.dataset.enviar); if (!m) return; b.disabled = true; return accion(m.id, '/api/sub/send', { msg: m.id, items: m.plan.tasks.filter(t => t.state === 'proposed').map(t => ({ i: t.i })) }, 'Enviado a los jefes.'); }
        if (b.dataset.opsSi || b.dataset.opsNo) { const id = b.dataset.opsSi || b.dataset.opsNo, m = mensajes.find(x => x.id === id); if (!m) return; const no = !!b.dataset.opsNo; b.disabled = true; return accion(id, '/api/sub/ops', { msg: id, items: m.ops.filter(o => o.state === 'proposed' && !o.confirmar).map(o => ({ k: o.k, include: !no })) }, no ? 'Descartado: no cambié nada.' : 'Hecho.'); }
        if (b.hasAttribute('data-gasto')) return ctx.escritorio('dimitri-completo');
        if (b.hasAttribute('data-reintentar')) return cargar();
      });

      // ---- historial y nueva conversación ----
      async function historial() {
        const h = ctx.hoja({ titulo: 'Conversaciones', cuerpo: '<p class="mv-meta">Cargando…</p>', lleno: true, acciones: [{ texto: 'Conversación nueva', tipo: 'primario', alTocar: x => { x.cerrar(); setTimeout(nueva, 260); } }] });
        try {
          const j = await ctx.api('/api/sub/conversaciones'), lista = j.lista || [];
          const fila = c => `<li class="mv-conv" data-id="${esc(c.id)}"><button type="button" class="mv-conv-b" data-abrir><b>${esc(c.titulo)}</b><small>${new Date(c.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${c.n} mensajes</small></button><button type="button" class="mv-ic" data-borrar aria-label="Borrar la conversación «${esc(c.titulo)}»">${svg('borrar')}</button></li>`;
          h.cuerpo.innerHTML = (j.actual ? `<p class="mv-meta">Ahora: ${esc(j.actual.titulo)} · ${j.actual.n} mensajes</p>` : '') + (lista.length ? `<ul class="mv-convs">${lista.map(fila).join('')}</ul>` : vacio('Sin conversaciones guardadas', 'Cuando empieces una nueva, la de ahora se guarda aquí.', { icono: 'historial' }));
          h.cuerpo.addEventListener('click', async e => {
            const li = e.target.closest('.mv-conv'); if (!li) return; const id = li.dataset.id;
            if (e.target.closest('[data-abrir]')) { if (ocupado) { ctx.toast('Espera a que termine de contestar.'); return; } try { const r = await post('/api/sub/abrir', { id }); mensajes = r.messages || []; h.cerrar(); pintar(); } catch (er) { ctx.toast('No se pudo abrir: ' + er.message); } }
            else if (e.target.closest('[data-borrar]')) { if (!(await ctx.confirmar({ titulo: '¿Borrar esta conversación?', texto: 'Se borra para siempre.', ok: 'Borrar', peligro: true }))) return; try { await post('/api/sub/borrar', { id }); li.remove(); } catch (er) { ctx.toast('No se pudo: ' + er.message); } }
          });
        } catch (e) { h.cuerpo.innerHTML = `<p class="mv-meta" role="alert">No pude traer el historial: ${esc(e.message)}</p>`; }
      }
      async function nueva() {
        if (ocupado) { ctx.toast('Espera a que termine de contestar.'); return; }
        if (!(await ctx.confirmar({ titulo: '¿Empezar una conversación nueva?', texto: 'La de ahora se guarda en el historial; la puedes abrir después.', ok: 'Empezar' }))) return;
        try { await post('/api/sub/clear', {}); mensajes = []; pintar(false); ctx.toast('Conversación nueva. La anterior está en el historial.'); } catch (e) { ctx.toast('No se pudo: ' + e.message); }
      }
      ctx.cabecera({ titulo: nombre, acciones: [{ icono: 'historial', etiqueta: 'Conversaciones guardadas', alTocar: historial }] });
      el._tick = () => { clearInterval(el._timer); el._timer = setInterval(() => { if (!el.hidden && !ocupado && document.visibilityState === 'visible') ctx.api('/api/sub').then(j => { const l = j.messages || []; if (l.length !== mensajes.length || (l.at(-1)?.id !== mensajes.at(-1)?.id)) { mensajes = l; pintar(); } }).catch(() => {}); }, 9000); };
      el._cargar = cargar; pintar();
    },
    alMostrar(el) { el._cargar?.(); el._tick?.(); },
    alOcultar(el) { clearInterval(el._timer); },
  });
}

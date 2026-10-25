// Versión móvil (25 oct 2026) — HOJAS INFERIORES (bottom sheets): lo que en escritorio es una ventana centrada, en el teléfono sube desde
// abajo, se arrastra hacia abajo para cerrarla, deja el pulgar sobre sus botones y no tapa el teclado. Una sola pila (nav.js) con el
// botón «atrás» del teléfono: cada hoja abierta es una entrada del historial y atrás la cierra.
//   const h = hojas.abrir({ titulo, cuerpo: Element|string, acciones: [{ texto, tipo: 'primario'|'peligro'|'', alTocar(h) }], lleno: false, alCerrar })
//   h.el (la hoja) · h.cuerpo (su contenido) · h.cerrar() · h.titulo('…')
import { cierraHoja } from './nav.js';
import { esc, svg } from './ui.js';

export function crearHojas({ raiz, empujar, soltar, inertes = () => [] }) {
  const quedan = () => raiz.querySelectorAll('.mv-capa').length;
  let id = 0;
  function abrir({ titulo = '', cuerpo = '', acciones = [], lleno = false, alCerrar, clase = '', origen = document.activeElement } = {}) {
    const n = ++id, tituloId = 'mvH' + n;
    const capa = document.createElement('div'); capa.className = 'mv-capa'; capa.dataset.hoja = n;
    capa.innerHTML = `<div class="mv-fondo" data-cerrar></div>
      <section class="mv-hoja${lleno ? ' lleno' : ''} ${clase}" role="dialog" aria-modal="true" aria-labelledby="${tituloId}" tabindex="-1">
        <div class="mv-asa" aria-hidden="true"><i></i></div>
        <header class="mv-hoja-cab"><h2 id="${tituloId}">${esc(titulo)}</h2><button type="button" class="mv-ic" data-cerrar aria-label="Cerrar">${svg('cerrar')}</button></header>
        <div class="mv-hoja-cuerpo"></div>
        ${acciones.length ? `<footer class="mv-hoja-acc">${acciones.map((a, i) => `<button type="button" class="mv-btn ${a.tipo || ''}" data-acc="${i}">${esc(a.texto)}</button>`).join('')}</footer>` : ''}
      </section>`;
    const el = capa.querySelector('.mv-hoja'), cuerpoEl = capa.querySelector('.mv-hoja-cuerpo');
    if (typeof cuerpo === 'string') cuerpoEl.innerHTML = cuerpo; else cuerpoEl.append(cuerpo);
    raiz.append(capa); raiz.classList.add('con-hoja');
    const bloqueados = inertes().filter(e => e && !e.inert); for (const e of bloqueados) e.inert = true;
    let cerrada = false;
    const h = {
      el, cuerpo: cuerpoEl, capa,
      titulo: t => { capa.querySelector('h2').textContent = t; },
      cerrar: () => capaRef.pedirCierre(),
      acciones: () => capa.querySelectorAll('[data-acc]'),
    };
    // la capa que ve la pila: destruir() la quita de verdad (lo llama el historial, o el temporizador si el historial no contesta)
    const capaRef = {
      tipo: 'hoja', h,
      destruir() {
        if (cerrada) return; cerrada = true;
        for (const e of bloqueados) e.inert = false;
        capa.classList.add('saliendo');
        const quitar = () => { capa.remove(); raiz.classList.toggle('con-hoja', quedan() > 0); if (origen && document.contains(origen) && origen.focus) origen.focus({ preventScroll: true }); };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) quitar(); else setTimeout(quitar, 200);
        if (alCerrar) alCerrar();
      },
      pedirCierre() { if (cerrada) return; soltar(capaRef); },
    };
    empujar(capaRef);
    capa.addEventListener('click', e => {
      if (e.target.closest('[data-cerrar]')) return capaRef.pedirCierre();
      const b = e.target.closest('[data-acc]'); if (b) { const a = acciones[+b.dataset.acc]; if (a && a.alTocar) a.alTocar(h, b); }
    });
    capa.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); capaRef.pedirCierre(); } else if (e.key === 'Tab') atrapar(e, el); });
    arrastrable(capa, el, cuerpoEl, () => capaRef.pedirCierre());
    requestAnimationFrame(() => { capa.classList.add('entra'); (cuerpoEl.querySelector('[autofocus]') || el).focus({ preventScroll: true }); });
    return h;
  }

  /** Confirmar en una hoja (nunca un confirm() del navegador): → Promise<boolean> */
  function confirmar({ titulo, texto = '', ok = 'Confirmar', cancelar = 'Cancelar', peligro = false }) {
    return new Promise(res => {
      let dicho = false; const fin = v => { if (!dicho) { dicho = true; res(v); } };
      abrir({ titulo, cuerpo: texto ? `<p class="mv-texto">${esc(texto)}</p>` : '', acciones: [{ texto: cancelar, alTocar: h => { fin(false); h.cerrar(); } }, { texto: ok, tipo: peligro ? 'peligro' : 'primario', alTocar: h => { fin(true); h.cerrar(); } }], alCerrar: () => fin(false) });
    });
  }
  return { abrir, confirmar, abiertas: quedan };
}

function atrapar(e, cont) {
  const l = [...cont.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.getClientRects().length);
  if (!l.length) return;
  const a = document.activeElement, i = l.indexOf(a);
  if (e.shiftKey && (i <= 0)) { e.preventDefault(); l.at(-1).focus(); } else if (!e.shiftKey && (i === l.length - 1 || i < 0 && a === cont)) { e.preventDefault(); l[0].focus(); }
}

// arrastrar hacia abajo desde el asa o la cabecera (o desde el cuerpo si está arriba del todo) para cerrar
function arrastrable(capa, hoja, cuerpo, cerrar) {
  let y0 = null, dy = 0, activo = false;
  const empieza = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const desdeCab = e.target.closest('.mv-asa, .mv-hoja-cab'); if (!desdeCab && cuerpo.scrollTop > 0) return;
    if (!desdeCab && e.target.closest('input,textarea,select')) return;
    y0 = e.clientY; dy = 0; activo = false;
  };
  const mueve = e => {
    if (y0 == null) return; dy = e.clientY - y0;
    if (!activo && dy > 8) { activo = true; hoja.style.transition = 'none'; try { hoja.setPointerCapture(e.pointerId); } catch {} }
    if (activo) { hoja.style.transform = `translateY(${Math.max(0, dy)}px)`; e.preventDefault(); }
  };
  const termina = () => {
    if (y0 == null) return; const era = activo; y0 = null; activo = false;
    if (!era) return;
    hoja.style.transition = '';
    if (cierraHoja({ dy, alto: hoja.getBoundingClientRect().height })) { hoja.style.transform = ''; cerrar(); } else hoja.style.transform = '';
  };
  hoja.addEventListener('pointerdown', empieza); hoja.addEventListener('pointermove', mueve); hoja.addEventListener('pointerup', termina); hoja.addEventListener('pointercancel', termina);
  hoja.querySelector('.mv-asa').style.touchAction = 'none'; hoja.querySelector('.mv-hoja-cab').style.touchAction = 'none';
}

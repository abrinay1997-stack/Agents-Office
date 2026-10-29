// El recorrido por pasos de la ventana de una pieza (25 oct 2026, docs/diseno-crear-publicacion.md). No toca las reglas ni el guardado:
// solo ordena lo que el editor ya pinta. ① Dónde · ② Qué · ③ Medios · ④ Cuándo.
//  · escritorio (≥ 820 px): los pasos llevan a su sección y todo sigue a la vista;
//  · teléfono: un paso a la vez (host[data-paso]), barra de progreso y botones grandes.
// Teclado: Alt+→ / Alt+← cambian de paso, Ctrl+Enter guarda ya (el evento `ao:guardar` lo atiende pieza.js; guardar no aprueba).
const PASOS = [['1', 'Dónde'], ['2', 'Qué'], ['3', 'Medios'], ['4', 'Cuándo']];
const SEC = { 1: '.pz-redesh', 2: '.pz-comph', 3: '.pz-medios', 4: '' };

function montar(host) {
  const head = host.querySelector('.pz-head'), body = host.querySelector('.pz-body'); if (!head || !body || host.querySelector('.pz-steps')) return;
  const nav = document.createElement('nav'); nav.className = 'pz-steps'; nav.setAttribute('aria-label', 'Pasos de la publicación');
  nav.innerHTML = `<ol>${PASOS.map(([n, t]) => `<li><button type="button" data-paso="${n}" aria-label="Paso ${n}: ${t}"><b aria-hidden="true">${n}</b><span>${t}</span></button></li>`).join('')}</ol><span class="pz-guardado" role="status" aria-live="polite"></span><div class="pz-prog" aria-hidden="true"><i></i></div>`;
  head.after(nav);
  const pie = document.createElement('div'); pie.className = 'pz-stepnav';
  pie.innerHTML = '<button type="button" class="pz-btn" data-ir="-1">‹ Atrás</button><span class="pz-stepn" aria-hidden="true"></span><button type="button" class="pz-go" data-ir="1">Siguiente ›</button>';
  body.after(pie);
  let paso = 1;
  const estrecho = () => host.clientWidth < 780;
  const marcar = n => { // solo dice en qué paso se está (sin mover nada): lo usan los clics y, en escritorio, el desplazamiento (CON-07)
    paso = Math.max(1, Math.min(4, n)); host.dataset.paso = String(paso);
    nav.querySelectorAll('[data-paso]').forEach(b => b.setAttribute('aria-current', b.dataset.paso === String(paso) ? 'step' : 'false'));
    nav.querySelector('.pz-prog i').style.width = `${paso * 25}%`;
    pie.querySelector('.pz-stepn').textContent = `Paso ${paso} de 4 · ${PASOS[paso - 1][1]}`;
    pie.querySelector('[data-ir="-1"]').disabled = paso === 1; pie.querySelector('[data-ir="1"]').disabled = paso === 4;
  };
  const poner = n => {
    marcar(n);
    if (estrecho()) { const b = host.querySelector('.pz-body'); if (b) b.scrollTop = 0; }
    if (paso === 4) { const c = host.querySelector('[data-a="cuando"]'); if (c && c.getAttribute('aria-expanded') !== 'true') c.click(); }
    else if (!estrecho()) { const el = host.querySelector(SEC[paso]); el?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  };
  // CON-07: en escritorio todo está a la vista, así que el paso marcado sigue lo que se está mirando (IntersectionObserver sobre las secciones; al final del cuerpo, el 4).
  // El cuerpo se vuelve a pintar entero (innerHTML), así que se vuelve a observar cuando cambia.
  if ('IntersectionObserver' in window && host.querySelector('.pz-scroll')) {
    const vis = new Map(), cuerpo = host.querySelector('.pz-scroll'); // el que se desplaza y se repinta
    const alVer = () => {
      if (estrecho()) return;
      const alFinal = cuerpo.scrollHeight > cuerpo.clientHeight + 4 && cuerpo.scrollTop + cuerpo.clientHeight >= cuerpo.scrollHeight - 4;
      const dentro = [1, 2, 3].filter(n => vis.get(host.querySelector(SEC[n]))); // las secciones que tocan la franja de arriba: la primera es la que se está leyendo
      const n = alFinal ? 4 : dentro.length ? Math.min(...dentro) : 0; if (n && n !== paso) marcar(n);
    };
    const io = new IntersectionObserver(es => { for (const e of es) vis.set(e.target, e.isIntersecting); alVer(); }, { root: cuerpo, rootMargin: '0px 0px -90% 0px', threshold: 0 });
    const mirar = () => { io.disconnect(); vis.clear(); for (const n of [1, 2, 3]) { const el = host.querySelector(SEC[n]); if (el) io.observe(el); } };
    new MutationObserver(mirar).observe(cuerpo, { childList: true }); mirar();
    cuerpo.addEventListener('scroll', alVer, { passive: true });
  }
  nav.addEventListener('click', e => { const b = e.target.closest('[data-paso]'); if (b) poner(+b.dataset.paso); });
  pie.addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) poner(paso + +b.dataset.ir); });
  host.addEventListener('keydown', e => {
    if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); e.stopPropagation(); poner(paso + (e.key === 'ArrowRight' ? 1 : -1)); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); host.dispatchEvent(new CustomEvent('ao:guardar')); }
  }, true);
  // el guardado a la vista: copia el estado del pie (pieza.js lo escribe ahí) junto al título
  const g = nav.querySelector('.pz-guardado');
  const copiar = () => { const t = host.querySelector('.pz-state'); const txt = (t?.textContent || '').trim(); g.textContent = txt === 'Guardado' ? 'Guardado ✓' : txt; g.classList.toggle('bad', !!t?.classList.contains('bad')); };
  new MutationObserver(copiar).observe(host.querySelector('.pz-foot'), { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => { if (!host.hidden) poner(1); }).observe(host, { attributes: true, attributeFilter: ['hidden'] }); // cada pieza que se abre empieza en el paso 1
  poner(1);
}
function arrancar() { const host = document.querySelector('.ct-panel'); if (!host) return; if (host.querySelector('.pz-head')) montar(host); else { const o = new MutationObserver(() => { if (host.querySelector('.pz-head')) { o.disconnect(); montar(host); } }); o.observe(host, { childList: true }); } }
arrancar();

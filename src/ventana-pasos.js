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
  const poner = n => {
    paso = Math.max(1, Math.min(4, n)); host.dataset.paso = String(paso);
    nav.querySelectorAll('[data-paso]').forEach(b => b.setAttribute('aria-current', b.dataset.paso === String(paso) ? 'step' : 'false'));
    nav.querySelector('.pz-prog i').style.width = `${paso * 25}%`;
    pie.querySelector('.pz-stepn').textContent = `Paso ${paso} de 4 · ${PASOS[paso - 1][1]}`;
    pie.querySelector('[data-ir="-1"]').disabled = paso === 1; pie.querySelector('[data-ir="1"]').disabled = paso === 4;
    if (estrecho()) { const b = host.querySelector('.pz-body'); if (b) b.scrollTop = 0; }
    if (paso === 4) { const c = host.querySelector('[data-a="cuando"]'); if (c && c.getAttribute('aria-expanded') !== 'true') c.click(); }
    else if (!estrecho()) { const el = host.querySelector(SEC[paso]); el?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  };
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

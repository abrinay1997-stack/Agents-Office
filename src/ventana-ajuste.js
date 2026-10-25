// La vista previa de la ventana de una pieza (25 oct 2026): se encoge (zoom) lo justo para verse ENTERA, sin scroll, en la columna de la
// derecha. Se mide: el alto natural de la tarjeta contra lo que deja la columna. Solo con dos columnas (la hoja del teléfono hace scroll).
// Va en el paquete del editor (no en la página). Sin esto, la columna simplemente hace scroll.
const MIN = 0.4;
function ajustar(host) {
  const side = host.querySelector('.pz-side'), pv = host.querySelector('.pz-preview'); if (!side || !pv) return;
  if (host.hidden || getComputedStyle(side).display === 'none' || host.clientWidth < 780) { pv.style.zoom = ''; return; }
  const cs = getComputedStyle(side), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const otros = [...side.children].filter(c => c !== pv).reduce((a, c) => a + c.getBoundingClientRect().height + (parseFloat(getComputedStyle(c).marginTop) || 0) + (parseFloat(getComputedStyle(c).marginBottom) || 0), 0);
  const libre = side.clientHeight - padY - otros - 24, z = parseFloat(pv.style.zoom) || 1, alto = pv.getBoundingClientRect().height / z; // el alto natural, sin el zoom de ahora
  const nuevo = alto > 0 && libre > 0 && alto > libre ? String(Math.max(MIN, +(libre / alto).toFixed(3))) : '';
  if (nuevo !== pv.style.zoom) pv.style.zoom = nuevo;
}
function vigilar(host) {
  let t = 0; const pedir = () => { cancelAnimationFrame(t); t = requestAnimationFrame(() => ajustar(host)); };
  const ro = new ResizeObserver(pedir); ro.observe(host); const lado = host.querySelector('.pz-side'); if (lado) ro.observe(lado); // si cambia el alto de la columna
  host.addEventListener('load', pedir, true); // una imagen que termina de cargar cambia el alto de la tarjeta
  new MutationObserver(pedir).observe(host.querySelector('.pz-body') || host, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  new MutationObserver(pedir).observe(host, { attributes: true, attributeFilter: ['hidden', 'data-swap'] });
}
function arrancar() { const host = document.querySelector('.ct-panel'); if (host?.querySelector('.pz-body')) vigilar(host); else if (host) { const o = new MutationObserver(() => { if (host.querySelector('.pz-body')) { o.disconnect(); vigilar(host); } }); o.observe(host, { childList: true }); } }
arrancar();

// La vista previa de la ventana de una pieza (25 oct 2026): la MAQUETA (`.pv-stage`) se encoge lo justo para verse entera, sin scroll, en la
// columna de la derecha. CON-06 (29 oct 2026): antes se hacía `zoom` sobre todo `.pz-preview` y las pestañas Feed/Perfil/Facebook se
// encogían con ella (13 px → ~5 px). Ahora solo se escala la maqueta, con `transform: scale()` (la escala y la compensación del alto van en
// variables CSS de `.pz-preview`, que sobreviven al repintado), piso de 0,75 (`ventana-escala.js`, puro) y sin re-medir por cada cambio de clase.
// Si con el piso no cabe, la columna hace scroll. Solo con dos columnas (la hoja del teléfono hace scroll). Va en el paquete del editor.
import { escalaVista } from './ventana-escala.js';
function ajustar(host) {
  const side = host.querySelector('.pz-side'), pv = host.querySelector('.pz-preview'); if (!side || !pv) return;
  const quitar = () => { pv.style.removeProperty('--pzs'); pv.style.removeProperty('--pzm'); };
  if (host.hidden || getComputedStyle(side).display === 'none' || host.clientWidth < 780) { quitar(); return; }
  const stage = pv.querySelector('.pv-stage'); if (!stage) { quitar(); return; }
  const cs = getComputedStyle(side), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const otros = [...side.children].filter(c => c !== pv).reduce((a, c) => a + c.offsetHeight + (parseFloat(getComputedStyle(c).marginTop) || 0) + (parseFloat(getComputedStyle(c).marginBottom) || 0), 0);
  const actual = parseFloat(pv.style.getPropertyValue('--pzs')) || 1, comp = parseFloat(pv.style.getPropertyValue('--pzm')) || 0; // lo aplicado ahora (offsetHeight no ve el transform, sí el margen)
  const natural = pv.offsetHeight - comp, cabecera = natural - stage.offsetHeight; // el alto sin escalar, y lo que no se escala (pestañas)
  const libre = side.clientHeight - padY - otros - 24;
  const z = escalaVista({ natural, cabecera, libre, actual });
  if (z === actual) return;
  if (z === 1) quitar(); else { pv.style.setProperty('--pzs', String(z)); pv.style.setProperty('--pzm', (-(stage.offsetHeight * (1 - z))).toFixed(1)); }
}
function vigilar(host) {
  let t = 0; const pedir = () => { cancelAnimationFrame(t); t = requestAnimationFrame(() => ajustar(host)); };
  const ro = new ResizeObserver(pedir); ro.observe(host); const lado = host.querySelector('.pz-side'); if (lado) ro.observe(lado); // si cambia el alto de la columna
  host.addEventListener('load', pedir, true); // una imagen que termina de cargar cambia el alto de la tarjeta
  new MutationObserver(pedir).observe(host.querySelector('.pz-body') || host, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }); // sin `class`: re-medir por cada cambio de clase hacía temblar la escala
  new MutationObserver(pedir).observe(host, { attributes: true, attributeFilter: ['hidden', 'data-swap'] });
}
function arrancar() { const host = document.querySelector('.ct-panel'); if (host?.querySelector('.pz-body')) vigilar(host); else if (host) { const o = new MutationObserver(() => { if (host.querySelector('.pz-body')) { o.disconnect(); vigilar(host); } }); o.observe(host, { childList: true }); } }
arrancar();

// Versión móvil (25 oct 2026): lo mínimo en la página. En un teléfono (≤ 820 px) o si ao.movil lo pide, trae dist/movil.js (src/movil/); si no, nada.
export function initMovil() {
  const mq = matchMedia('(max-width:820px)'), de = document.documentElement;
  const go = () => {
    if (window.AO_MOVIL) return AO_MOVIL.sync();
    let p; try { p = localStorage.getItem('ao.movil'); } catch {}
    if (location.protocol == 'file:' || window.__mv || !(p === 'movil' || (p !== 'escritorio' && mq.matches))) return; window.__mv = 1;
    de.classList.add('mv-pre'); const s = document.createElement('script'); s.src = 'movil.js';
    s.onerror = () => { window.__mv = 0; de.classList.remove('mv-pre'); }; document.head.appendChild(s);
  };
  mq.addEventListener('change', go); addEventListener('ao:movil', go); go();
}

// Agents Office V4.7 (30 sep 2026) — el dock en el teléfono. A 440 px o menos caben seis botones y el aviso de aprobaciones, no once: Analíticas, Salud,
// Negocio y Ajustes se recogen en un solo «⋯» que abre un menú. Los cuatro siguen existiendo (y sus atajos R, O, N y «,» también): el menú solo les hace clic.
// Arriba de 440 px no cambia nada. La luz de Salud se copia al «⋯» para que un fallo no se esconda dentro del menú.
const FOLDED = ['topAnaliticas', 'topHealth', 'topBiz', 'topSettings'];
const KEY_OF = { topAnaliticas: 'R', topHealth: 'O', topBiz: 'N', topSettings: ',' };

export function initDock() {
  const dock = document.getElementById('topdock'), anchor = document.getElementById('topPanel');
  const real = FOLDED.map(id => document.getElementById(id)).filter(Boolean);
  if (!dock || !anchor || !real.length) return null;
  const btn = document.createElement('button');
  btn.id = 'topMore'; btn.className = 'tb-ic'; btn.type = 'button';
  btn.setAttribute('aria-label', 'Más herramientas: analíticas, estado, negocio y ajustes'); btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'topMoreMenu');
  btn.title = 'Más — analíticas, estado de la oficina, negocio y ajustes';
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg><i class="hl-badge" aria-hidden="true"></i>';
  dock.insertBefore(btn, anchor);
  const menu = document.createElement('div');
  menu.id = 'topMoreMenu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Más herramientas'); menu.hidden = true;
  menu.innerHTML = real.map(b => `<button type="button" role="menuitem" tabindex="-1" data-for="${b.id}"><span>${(b.getAttribute('aria-label') || '').replace(/</g, '&lt;')}</span><kbd>${KEY_OF[b.id]}</kbd></button>`).join('');
  document.body.appendChild(menu);

  const items = () => [...menu.querySelectorAll('[role="menuitem"]')];
  const open = () => {
    if (!menu.hidden) return;
    const r = btn.getBoundingClientRect();
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    menu.style.top = Math.round(r.bottom + 6) + 'px'; menu.style.right = Math.max(8, Math.round(innerWidth - r.right)) + 'px';
    items()[0]?.focus();
  };
  const close = (back = true) => { if (menu.hidden) return; menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (back) btn.focus(); };
  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  menu.addEventListener('click', e => {
    const it = e.target.closest('[data-for]'); if (!it) return;
    const target = document.getElementById(it.dataset.for);
    close(); // el foco vuelve al «⋯»: la ventana que se abra lo guarda como su origen y ahí vuelve al cerrarse
    target?.click();
  });
  menu.addEventListener('keydown', e => {
    const list = items(), i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); list.at(-1).focus(); }
    else if (e.key === 'Tab') close(false);
  });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) close(false); });
  addEventListener('resize', () => close(false));

  // la luz de «Salud» también en el «⋯»: si algo falla, se ve aunque el botón de Salud esté recogido
  const health = document.getElementById('topHealth');
  if (health) {
    const mirror = () => { btn.dataset.state = health.dataset.state || ''; };
    new MutationObserver(mirror).observe(health, { attributes: true, attributeFilter: ['data-state'] }); mirror();
  }
  return { open, close, button: btn, menu };
}

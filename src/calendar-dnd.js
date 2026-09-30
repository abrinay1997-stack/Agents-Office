// Agents Office V4.7 (30 sep 2026) — arrastrar una tarjeta a otro día, con el ratón y con el dedo. Salió de calendar.js para que el
// calendario de tareas y el de contenido se muevan igual. Cada tarjeta arrastrable lleva `data-ev="clase:id[:momento]"`; al soltarla sobre un
// `.cv-day` (que no sea `.past`) se llama a `onDrop(dia, { kind, id, at })`, y ese día trae `data-day` y, en la semana y el día, `data-hour`.
//
//   const dnd = attachDnd({ root, grid, onStart, onDrop, onCancel })
//   dnd.dragging → el { kind, id, at } que va en el aire, o null (mientras hay uno, nada debe repintarse debajo)
//
// V4.2 (auditoría B28): con el dedo no había arrastre HTML5. Se mantiene una tarjeta quieta un momento y se mueve: la página deja de
// desplazarse, el día o la hora bajo el dedo se ilumina y al soltar cae. Cerca del borde de la cuadrícula, esta se desplaza.
const CARDS = '.cv-ev[draggable="true"], .cv-bk[draggable="true"]';

export function attachDnd({ root, grid, cards = CARDS, holdMs = 380, onStart = () => {}, onDrop, onCancel = () => {} }) {
  let dragging = null, touch = null, eatClick = false;
  const parse = card => { const [kind, id, at] = card.dataset.ev.split(':'); return { kind, id, at: +at || 0 }; };
  const clearDrops = () => grid.querySelectorAll('.cv-dragging, .cv-day.drop').forEach(n => n.classList.remove('cv-dragging', 'drop'));

  /* ---------- ratón: arrastrar y soltar de HTML5 ---------- */
  root.addEventListener('dragstart', e => {
    const card = e.target.closest(cards); if (!card) return;
    dragging = parse(card); onStart();
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', card.dataset.ev);
    card.classList.add('cv-dragging'); root.classList.add('dragging');
  });
  root.addEventListener('dragend', () => { clearDrops(); root.classList.remove('dragging'); setTimeout(() => { dragging = null; }, 0); });
  grid.addEventListener('dragover', e => {
    if (!dragging) return; const day = e.target.closest('.cv-day'); if (!day) return;
    if (day.classList.contains('past')) { e.dataTransfer.dropEffect = 'none'; return; }
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    grid.querySelectorAll('.cv-day.drop').forEach(n => { if (n !== day) n.classList.remove('drop'); }); day.classList.add('drop');
  });
  grid.addEventListener('dragleave', e => { const day = e.target.closest('.cv-day'); if (day && !day.contains(e.relatedTarget)) day.classList.remove('drop'); });
  grid.addEventListener('drop', async e => {
    if (!dragging) return; const day = e.target.closest('.cv-day'); if (!day || day.classList.contains('past')) return;
    e.preventDefault();
    const d = dragging; dragging = null; root.classList.remove('dragging');
    await onDrop(day, d);
  });

  /* ---------- dedo: mantener y mover ---------- */
  root.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || touch) return;
    const card = e.target.closest(cards); if (!card) return;
    touch = { card, x: e.clientX, y: e.clientY, on: false, ghost: null, over: null };
    touch.timer = setTimeout(() => {
      if (!touch) return;
      dragging = parse(card); onStart(); touch.on = true;
      card.classList.add('cv-dragging'); root.classList.add('dragging');
      const g = card.cloneNode(true); g.classList.add('cv-ghost'); g.removeAttribute('draggable'); g.style.width = card.offsetWidth + 'px';
      document.body.appendChild(g); touch.ghost = g; moveGhost(touch.x, touch.y);
      if (navigator.vibrate) navigator.vibrate(12);
    }, holdMs);
  });
  function moveGhost(x, y) { if (touch && touch.ghost) { touch.ghost.style.left = x + 'px'; touch.ghost.style.top = y + 'px'; } }
  function endTouch() {
    if (!touch) return; clearTimeout(touch.timer);
    if (touch.ghost) touch.ghost.remove();
    if (touch.on) { eatClick = true; setTimeout(() => { eatClick = false; }, 400); }
    touch.card.classList.remove('cv-dragging'); root.classList.remove('dragging'); grid.querySelectorAll('.cv-day.drop').forEach(n => n.classList.remove('drop'));
    touch = null;
  }
  root.addEventListener('pointermove', e => {
    if (!touch) return;
    if (!touch.on) { if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 8) { clearTimeout(touch.timer); touch = null; } return; } // un deslizamiento: la página se desplaza como siempre
    moveGhost(e.clientX, e.clientY);
    const under = document.elementFromPoint(e.clientX, e.clientY), day = under && under.closest('.cv-day');
    const mine = day && grid.contains(day) ? day : null;
    grid.querySelectorAll('.cv-day.drop').forEach(n => { if (n !== mine) n.classList.remove('drop'); });
    touch.over = mine && !mine.classList.contains('past') ? mine : null; if (touch.over) touch.over.classList.add('drop');
    const g = grid.getBoundingClientRect(); if (e.clientY < g.top + 40) grid.scrollTop -= 12; else if (e.clientY > g.bottom - 40) grid.scrollTop += 12; // cerca del borde, la cuadrícula se desplaza bajo el dedo
  });
  root.addEventListener('touchmove', e => { if (touch && touch.on) e.preventDefault(); }, { passive: false }); // sosteniendo una tarjeta: el dedo mueve la tarjeta, no la página
  root.addEventListener('pointerup', async () => {
    if (!touch) return; const was = touch.on, day = touch.over, d = dragging;
    endTouch(); dragging = null;
    if (was && day && d) await onDrop(day, d); else if (was) onCancel();
  });
  root.addEventListener('pointercancel', () => { if (touch) { const was = touch.on; endTouch(); if (was) { dragging = null; onCancel(); } } });
  root.addEventListener('contextmenu', e => { if (touch) e.preventDefault(); }); // una pulsación larga es un arrastre aquí, no el menú del teléfono
  root.addEventListener('click', e => { if (eatClick) { e.stopPropagation(); e.preventDefault(); eatClick = false; } }, true);

  return { get dragging() { return dragging; } };
}

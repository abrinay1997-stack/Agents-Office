// Agents Office V4.1 (24 Sep 2026) — one rule for every modal window (audit 22–24).
// While a window is open, everything outside it is inert: out of Tab's reach and of screen readers, the way a native
// <dialog> behaves. Windows stack: the task detail opened over the calendar is the top one, and closing it gives the
// calendar back. A nested window (the Estudio's enlarged view) makes its own neighbours inert too, not only the page.
// V4.5 (27 Sep 2026): a VIEW (data-view: the Estudio, the calendar, the Brain) is not a window over the office but the
// page itself, under the top bar — so while a view is on top, every [data-shell] element (the top bar and its connectors'
// panel) stays in reach, for the mouse, for Tab and for screen readers. A real window over a view still locks everything.
//   modal.open(el) · modal.close(el) · modal.any()
// An element marked data-modal-keep (a backdrop that closes on click, the DESHACER toast) is never made inert.
const stack = [];
const ours = new Set(); // what WE made inert — a window that is inert for its own reasons (closed) is left alone
const shell = top => (top && top.hasAttribute('data-view') ? [...document.querySelectorAll('[data-shell]')] : []);

function apply() {
  const top = stack[stack.length - 1];
  const want = new Set(), keep = shell(top);
  if (top) for (let n = top; n && n.parentElement && n !== document.body; n = n.parentElement)
    for (const sib of n.parentElement.children) if (sib !== n && !sib.hasAttribute('data-modal-keep') && !keep.includes(sib) && !/^(SCRIPT|STYLE|LINK)$/.test(sib.tagName)) want.add(sib);
  for (const el of [...ours]) if (!want.has(el)) { el.inert = false; ours.delete(el); }
  for (const el of want) if (!el.inert) { el.inert = true; ours.add(el); }
}

// Tab and Shift+Tab wrap around inside the top window (and, over a view, the top bar) instead of stepping out to the browser's own bar
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
const folded = n => { const d = n.closest('details:not([open])'); return !!d && !(n.tagName === 'SUMMARY' && n.parentElement === d); }; // inside a closed <details>: not reachable
const shown = n => !n.closest('[hidden],[inert]') && !folded(n) && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
  const top = stack[stack.length - 1]; if (!top) return;
  const scopes = [...shell(top), top]; // the top bar first: it sits above the view
  const list = scopes.flatMap(s => [...s.querySelectorAll(FOCUSABLE)]).filter(shown); if (!list.length) return;
  const a = document.activeElement, first = list[0], last = list[list.length - 1];
  if (a === top) { const own = list.filter(n => top.contains(n)); if (own.length) { e.preventDefault(); (e.shiftKey ? own[own.length - 1] : own[0]).focus(); return; } } // the view itself has the focus (it takes it on opening): Tab goes into it first
  if (scopes.length > 1 && list.includes(a)) { // one step at a time; anything that refuses the focus is stepped over
    e.preventDefault();
    for (let i = list.indexOf(a), k = 0; k < list.length && document.activeElement === a; k++) { i = (i + (e.shiftKey ? -1 : 1) + list.length) % list.length; list[i].focus(); }
    return;
  } // over a view, Tab steps through the bar and the view only (a DESHACER toast between them in the page is kept out of the inert set, and the browser went there)
  if (!scopes.some(s => s.contains(a)) || a === top) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
}, true);

export const modal = {
  open(el) { if (!el) return; const i = stack.indexOf(el); if (i >= 0) stack.splice(i, 1); stack.push(el); apply(); },
  close(el) { const i = stack.indexOf(el); if (i < 0) return; stack.splice(i, 1); apply(); },
  any: () => stack.length > 0,
  top: () => stack[stack.length - 1] || null,
};

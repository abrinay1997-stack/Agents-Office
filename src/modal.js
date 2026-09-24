// Agents Office V4.1 (24 Sep 2026) — one rule for every modal window (audit 22–24).
// While a window is open, everything outside it is inert: out of Tab's reach and of screen readers, the way a native
// <dialog> behaves. Windows stack: the task detail opened over the calendar is the top one, and closing it gives the
// calendar back. A nested window (the Estudio's enlarged view) makes its own neighbours inert too, not only the page.
//   modal.open(el) · modal.close(el) · modal.any()
// An element marked data-modal-keep (a backdrop that closes on click, the DESHACER toast) is never made inert.
const stack = [];
const ours = new Set(); // what WE made inert — a window that is inert for its own reasons (closed) is left alone

function apply() {
  const top = stack[stack.length - 1];
  const want = new Set();
  if (top) for (let n = top; n && n.parentElement && n !== document.body; n = n.parentElement)
    for (const sib of n.parentElement.children) if (sib !== n && !sib.hasAttribute('data-modal-keep') && !/^(SCRIPT|STYLE|LINK)$/.test(sib.tagName)) want.add(sib);
  for (const el of [...ours]) if (!want.has(el)) { el.inert = false; ours.delete(el); }
  for (const el of want) if (!el.inert) { el.inert = true; ours.add(el); }
}

// Tab and Shift+Tab wrap around inside the top window instead of stepping out to the browser's own bar
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
const shown = n => !n.closest('[hidden],[inert]') && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
  const top = stack[stack.length - 1]; if (!top) return;
  const list = [...top.querySelectorAll(FOCUSABLE)].filter(shown); if (!list.length) return;
  const a = document.activeElement, first = list[0], last = list[list.length - 1];
  if (!top.contains(a) || a === top) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
}, true);

export const modal = {
  open(el) { if (!el) return; const i = stack.indexOf(el); if (i >= 0) stack.splice(i, 1); stack.push(el); apply(); },
  close(el) { const i = stack.indexOf(el); if (i < 0) return; stack.splice(i, 1); apply(); },
  any: () => stack.length > 0,
  top: () => stack[stack.length - 1] || null,
};

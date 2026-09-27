// Agents Office V4.5 (27 Sep 2026) — the three big views share the room under the top bar, one at a time.
// The Estudio, the calendar and the Brain are views, not windows piled on each other: opening one closes the one that was
// open (the calendar used to stay shut while the Estudio was up, and the calendar and the Brain covered the top bar).
// While a view is open the top bar keeps working: modal.js leaves every [data-shell] element out of the inert set.
//   views.add(name, { isOpen, close }) · views.opening(name) · views.current()
const reg = new Map();

export const views = {
  add(name, api) { reg.set(name, api); },
  // quiet: the focus goes to the view being opened, not back to wherever the closing one was opened from
  opening(name) { for (const [k, v] of reg) if (k !== name && v.isOpen()) v.close({ quiet: true }); },
  current() { for (const [k, v] of reg) if (v.isOpen()) return k; return null; },
};

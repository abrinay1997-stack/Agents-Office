// Auditoría 1 oct 2026 (A11-13): a line of Ajustes → Atajos pressed does what its key does. The «K Contenido» line used to
// send «k» WITH Ctrl (meant for the Ctrl+K line, which shares the letter), so it opened the search instead of Contenido.
// A line names its key as the key itself ('k', ',', '0') or with a modifier in front ('ctrl+k'); only the modifier sets Ctrl.
export function keyEventInit(spec) {
  const s = String(spec || '');
  const m = /^(ctrl|meta)\+(.+)$/i.exec(s);
  if (m) return { key: m[2], ctrlKey: m[1].toLowerCase() === 'ctrl', metaKey: m[1].toLowerCase() === 'meta', bubbles: true };
  return { key: s, ctrlKey: false, metaKey: false, bubbles: true };
}

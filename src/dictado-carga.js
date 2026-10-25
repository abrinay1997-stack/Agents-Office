// Dictado por voz en la página (fase 10): lo mínimo. Si el navegador sabe dictar (Chrome, Edge, Safari; Firefox no), pide el paquete suelto
// dist/dictado.js (src/dictado.js, build.mjs) cuando la página está en reposo; si no, no baja nada y no aparece ningún micrófono.
// En file:// va junto a la página; servida (local o en la nube), en /dictado.js.
export function cargarDictado(doc = document, win = window) {
  if (!(win.SpeechRecognition || win.webkitSpeechRecognition)) return false;
  const pedir = () => { const s = doc.createElement('script'); s.src = 'dictado.js'; s.async = true; s.onerror = () => s.remove(); doc.head.appendChild(s); };
  if (win.requestIdleCallback) win.requestIdleCallback(pedir, { timeout: 4000 }); // con un plazo: la oficina anima sin parar y quizá nunca esté «en reposo»
  else win.setTimeout(pedir, 1200);
  return true;
}

// ATAJOS DE UNA TECLA, que se pueden apagar (auditoría del Estudio de imagen, IMG-26, 6 oct 2026; WCAG 2.1.4).
// La oficina responde a letras sueltas (E, P, G, S… y, en el Estudio, I, V, B, L, /, + − 0 F en el visor). Con control por voz o
// con temblor, una letra suelta cambia de vista sin querer. Ajustes → Atajos de teclado tiene el interruptor; se recuerda en
// este navegador (`ao.keys1`). Con Ctrl, Alt o ⌘, y Esc o las flechas, no son «de una tecla»: siguen siempre.
const K = 'ao.keys1';
export function unaTeclaOn() { try { return localStorage.getItem(K) !== 'false'; } catch { return true; } }
export function setUnaTecla(on) { try { localStorage.setItem(K, on ? 'true' : 'false'); } catch {} }
/** ¿Es un atajo de una tecla (un carácter, sin Ctrl/Alt/⌘)? */
export const esDeUnaTecla = e => !!e && !e.ctrlKey && !e.metaKey && !e.altKey && typeof e.key === 'string' && e.key.length === 1 && e.key !== ' ';
/** ¿Hay que ignorar esta tecla? (atajos de una tecla apagados) */
export const ignorar = (e, on = unaTeclaOn()) => !on && esDeUnaTecla(e);

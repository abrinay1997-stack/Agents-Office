// Versión móvil (25 oct 2026) — navegación PURA: los destinos de la barra inferior, la dirección (#m=tareas&l=hoy) y la pila de
// capas (hojas y pantallas encima) que el botón «atrás» del teléfono va cerrando de una en una. Sin DOM: se prueba en Node.

/** Los cinco destinos de la barra inferior (el pulgar llega a todos). `mas` no es una pantalla: abre la hoja con el resto. */
export const TABS = [
  { id: 'inicio', titulo: 'Inicio' },
  { id: 'tareas', titulo: 'Tareas' },
  { id: 'dimitri', titulo: 'Dimitri' }, // al centro: es la acción más importante (auditoría móvil, §4.2)
  { id: 'calendario', titulo: 'Calendario' },
  { id: 'mas', titulo: 'Más' },
];
export const RAIZ = 'inicio';
const CONOCIDAS = new Set(['inicio', 'tareas', 'calendario', 'dimitri', 'aprobaciones', 'mas']);

/** '#m=tareas&l=hoy' → { vista: 'tareas', params: { l: 'hoy' } } (una vista desconocida cae en Inicio) */
export function leerHash(h) {
  const q = new URLSearchParams(String(h || '').replace(/^#/, ''));
  const v = q.get('m'); q.delete('m');
  return { vista: CONOCIDAS.has(v) ? v : RAIZ, params: Object.fromEntries(q) };
}
export function aHash(vista, params = {}) {
  const q = new URLSearchParams({ m: vista });
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') q.set(k, String(v));
  return '#' + q.toString();
}
/** ¿Esta vista cuelga de una pestaña? (Aprobaciones se enciende bajo Inicio; «Más» cuenta como la suya.) */
export const pestanaDe = id => (id === 'aprobaciones' ? 'inicio' : TABS.some(t => t.id === id) ? id : 'mas');

/** La pila de capas abiertas (hojas, el contenedor de escritorio…). push devuelve su profundidad; pop cierra la de arriba. */
export function crearPila() {
  const capas = [];
  return {
    push(capa) { capas.push(capa); return capas.length; },
    pop() { return capas.pop() || null; },
    cima: () => capas[capas.length - 1] || null,
    quitar(capa) { const i = capas.indexOf(capa); if (i >= 0) capas.splice(i, 1); return i >= 0; },
    get largo() { return capas.length; },
  };
}

/**
 * Deslizar para volver (desde el borde izquierdo): ¿cuenta el gesto? dx/dy en px desde donde empezó, x0 = dónde empezó.
 * Solo desde los 24 px del borde, sobre todo horizontal y de 70 px o más.
 */
export function esGestoVolver({ x0, dx, dy }) { return x0 <= 24 && dx >= 70 && Math.abs(dy) < dx * 0.6; }

/** Arrastrar una hoja hacia abajo: ¿se cierra? (más de 90 px o más de un tercio de su alto) */
export function cierraHoja({ dy, alto }) { return dy > 90 || (alto > 0 && dy > alto / 3); }

/** Deslizar una fila: 'completar' (derecha), 'posponer' (izquierda) o null. Umbral de 80 px y casi horizontal. */
export function gestoFila({ dx, dy }) {
  if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.5) return null;
  return dx > 0 ? 'completar' : 'posponer';
}

/** Tirar hacia abajo desde arriba para refrescar: se arma a los 70 px y solo si la lista estaba arriba del todo. */
export const tiraRefrescar = ({ dy, scrollTop }) => scrollTop <= 0 && dy >= 70;

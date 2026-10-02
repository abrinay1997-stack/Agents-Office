// La fábrica de presets para la DEMO file:// (sin servidor). No va dentro de la página: pesa ~250 KB y la página tiene su
// presupuesto (check.mjs, INF-09). build.mjs la escribe junto a la página, en dist/presets-fabrica.js
// (window.AO_PRESETS_FABRICA = { presets de imagen, grupos, tipos, canales, familias, iconos, sinónimos }), y la demo la carga la
// primera vez que hace falta. En la oficina el banco la pide al servidor (/api/media/presets) y esto no se usa.
let pedida = null;
/** → Promise<fábrica | null>. null fuera de la demo, o si el archivo no está junto a la página. */
export function cargarFabricaDemo() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.AO_PRESETS_FABRICA) return Promise.resolve(window.AO_PRESETS_FABRICA);
  if (location.protocol !== 'file:') return Promise.resolve(null);
  return (pedida ||= new Promise(res => {
    const s = document.createElement('script'); s.src = 'presets-fabrica.js'; s.async = true;
    s.onload = () => res(window.AO_PRESETS_FABRICA || null); s.onerror = () => res(null);
    document.head.appendChild(s);
  }));
}

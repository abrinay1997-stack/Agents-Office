// La VERSIÓN MÓVIL va en un paquete aparte (25 oct 2026), como la vista Tareas: la página de escritorio tiene su presupuesto (check.mjs) y esto
// solo hace falta en un teléfono. build.mjs lo escribe en dist/movil.js, junto a la página; src/movil-carga.js lo trae solo si la ventana es de
// teléfono (≤ 820 px) o si el dueño lo pidió (ao.movil). Su estilo (src/css/movil.css) viaja con él. La lógica pura (tareas/*.mjs) entra aquí.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

export const ENTRADA = 'src/movil/index.js';
export const CSS_MOVIL = ['movil.css', 'movil-b.css', 'movil-c.css'];

/** → { js, aparte } — `aparte`: los archivos que van SOLO en este paquete (la página no debe llevarlos). */
export async function construirMovil({ cssCorto = s => s } = {}) {
  const r = await build({ entryPoints: [ENTRADA], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, logLevel: 'silent' });
  const ins = Object.keys(r.metafile.outputs[Object.keys(r.metafile.outputs)[0]].inputs).map(f => f.replace(/\\/g, '/'));
  const aparte = ins.filter(f => f.startsWith('src/movil/'));
  const css = CSS_MOVIL.map(f => `/* ---- src/css/${f} ---- */\n${cssCorto(readFileSync('src/css/' + f, 'utf8'))}`).join('\n');
  const estilo = `(function(){if(typeof document==="undefined"||document.querySelector("style[data-ao-movil]"))return;var s=document.createElement("style");s.setAttribute("data-ao-movil","");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n`;
  return { js: estilo + r.outputFiles[0].text, aparte };
}

// 25 oct 2026 — el paquete de Contenido, Analíticas y Anuncios (dist/movil-d.js): pesa más que todo el armazón, así que se trae la primera vez que se abre
// una de esas pantallas (src/movil/vistas/diferidas.js). Su estilo (movil-d.css) viaja dentro. Lo que ya está en movil.js (ui.js…) se repite: es poco.
export const ENTRADA_D = 'src/movil/d/index.js';
export const CSS_MOVIL_D = ['movil-d.css'];
export async function construirMovilD({ cssCorto = s => s } = {}) {
  const r = await build({ entryPoints: [ENTRADA_D], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, logLevel: 'silent' });
  const ins = Object.keys(r.metafile.outputs[Object.keys(r.metafile.outputs)[0]].inputs).map(f => f.replace(/\\/g, '/'));
  const aparte = ins.filter(f => f.startsWith('src/movil/'));
  const css = CSS_MOVIL_D.map(f => `/* ---- src/css/${f} ---- */\n${cssCorto(readFileSync('src/css/' + f, 'utf8'))}`).join('\n');
  const estilo = `(function(){if(typeof document==="undefined"||document.querySelector("style[data-ao-movil-d]"))return;var s=document.createElement("style");s.setAttribute("data-ao-movil-d","");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n`;
  return { js: estilo + r.outputFiles[0].text, aparte };
}

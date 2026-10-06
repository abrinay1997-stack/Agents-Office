// La VISTA TAREAS va en un paquete aparte (plan T2, 6 oct 2026), como el banco de presets del Estudio: la página tiene su presupuesto
// (check.mjs) y la vista —Inicio, Lista, Tablero, Proyectos, Analíticas y el detalle— pesa lo suyo. build.mjs lo escribe en
// dist/tareas-vista.js, junto a la página; src/tareas-carga.js lo trae la primera vez que se abre Tareas (H o el botón del dock).
// Su estilo (src/css/tareas.css) viaja con él. La lógica pura (tareas/*.mjs) entra aquí, nunca en la página.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const ENTRADA = 'src/tareas/vista.js';
export const CSS_TAREAS = ['tareas.css'];
const MARCA = '@@AO_TAREAS_VERSION@@';

/** → { js, version, aparte } — `aparte`: los archivos que van SOLO en este paquete (la página no debe llevarlos). */
export async function construirTareas({ cssCorto = s => s } = {}) {
  const r = await build({ entryPoints: [ENTRADA], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, define: { __AO_TAREAS_VERSION__: JSON.stringify(MARCA) }, logLevel: 'silent' });
  const ins = Object.keys(r.metafile.outputs[Object.keys(r.metafile.outputs)[0]].inputs).map(f => f.replace(/\\/g, '/'));
  const aparte = ins.filter(f => f.startsWith('src/tareas/') || f.startsWith('tareas/'));
  const css = CSS_TAREAS.map(f => `/* ---- src/css/${f} ---- */\n${cssCorto(readFileSync('src/css/' + f, 'utf8'))}`).join('\n');
  const estilo = `(function(){if(typeof document==="undefined"||document.querySelector("style[data-ao-tareas]"))return;var s=document.createElement("style");s.setAttribute("data-ao-tareas","");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n`;
  const text = estilo + r.outputFiles[0].text, version = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return { js: `/*ao-tareas:${version}*/\n` + text.split(MARCA).join(version), version, aparte }; // la primera línea dice de qué construcción es (serve.mjs la compara con la página)
}

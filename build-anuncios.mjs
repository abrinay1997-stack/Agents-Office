// La VISTA ANUNCIOS va en un paquete aparte (Fase A1, 9 oct 2026; docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §8), como la vista
// Tareas: la página tiene su presupuesto (check.mjs) y el panel —Resumen, Campañas, Historial y el detalle— pesa lo suyo. build.mjs lo
// escribe en dist/anuncios-vista.js, junto a la página; src/anuncios-carga.js lo trae la primera vez que se abre Anuncios (J o el
// botón del dock). Su estilo (src/css/anuncios.css) viaja con él. Lo de src/anuncios/ entra aquí, nunca en la página.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const ENTRADA = 'src/anuncios/vista.js';
export const CSS_ANUNCIOS = ['anuncios.css'];
const MARCA = '@@AO_ANUNCIOS_VERSION@@';

/** → { js, version, aparte } — `aparte`: los archivos que van SOLO en este paquete (la página no debe llevarlos). */
export async function construirAnuncios({ cssCorto = s => s } = {}) {
  const r = await build({ entryPoints: [ENTRADA], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, define: { __AO_ANUNCIOS_VERSION__: JSON.stringify(MARCA) }, logLevel: 'silent' });
  const ins = Object.keys(r.metafile.outputs[Object.keys(r.metafile.outputs)[0]].inputs).map(f => f.replace(/\\/g, '/'));
  const aparte = ins.filter(f => f.startsWith('src/anuncios/'));
  const css = CSS_ANUNCIOS.map(f => `/* ---- src/css/${f} ---- */\n${cssCorto(readFileSync('src/css/' + f, 'utf8'))}`).join('\n');
  const estilo = `(function(){if(typeof document==="undefined"||document.querySelector("style[data-ao-anuncios]"))return;var s=document.createElement("style");s.setAttribute("data-ao-anuncios","");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n`;
  const text = estilo + r.outputFiles[0].text, version = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return { js: `/*ao-anuncios:${version}*/\n` + text.split(MARCA).join(version), version, aparte }; // la primera línea dice de qué construcción es (serve.mjs la compara con la página)
}

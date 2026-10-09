// El EDITOR de una pieza de Contenido va en un paquete aparte (C1, 8 oct 2026), como la vista Tareas (build-tareas.mjs): la página tiene su
// presupuesto (check.mjs) y el editor —el cuadro de escribir, la barra, las pestañas por red, el pie, la vista previa de cada red— pesa lo
// suyo. build.mjs lo escribe en dist/pieza-editor.js, junto a la página; src/pieza-carga.js lo trae la primera vez que se abre una pieza.
// Su estilo (CSS_PIEZA) viaja con él. Las reglas puras (contenido-reglas.js, calendar-core.js…) van en los dos: no tienen estado.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const ENTRADA = 'src/pieza-editor.js';
export const CSS_PIEZA = ['contenido-conversacion.css', 'contenido-herramientas.css', 'contenido-preview.css', 'editor-contenido.css']; // C3: las ventanas de Llenar la semana y Plantillas
export const SOLO_AQUI = ['src/pieza.js', 'src/contenido-preview.js', 'src/pieza-editor.js', 'src/contenido-herramientas.js', 'src/contenido-conversacion.js']; // lo que la página no debe llevar (B2: la conversación de la Bandeja)
const MARCA = '@@AO_PIEZA_VERSION@@';

/** → { js, version, aparte } — `aparte`: los archivos que van SOLO en este paquete. */
export async function construirPieza({ cssCorto = s => s } = {}) {
  const r = await build({ entryPoints: [ENTRADA], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, define: { __AO_PIEZA_VERSION__: JSON.stringify(MARCA) }, logLevel: 'silent' });
  const ins = Object.keys(r.metafile.outputs[Object.keys(r.metafile.outputs)[0]].inputs).map(f => f.replace(/\\/g, '/'));
  if (ins.includes('src/modal.js')) throw new Error('el editor de piezas no debe llevar su propio src/modal.js: usa el de la página (initPieza({ modal }))');
  const aparte = ins.filter(f => SOLO_AQUI.includes(f));
  const css = CSS_PIEZA.map(f => `/* ---- src/css/${f} ---- */\n${cssCorto(readFileSync('src/css/' + f, 'utf8'))}`).join('\n');
  const estilo = `(function(){if(typeof document==="undefined"||document.querySelector("style[data-ao-pieza]"))return;var s=document.createElement("style");s.setAttribute("data-ao-pieza","");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n`;
  const text = estilo + r.outputFiles[0].text, version = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return { js: `/*ao-pieza:${version}*/\n` + text.split(MARCA).join(version), version, aparte }; // la primera línea dice de qué construcción es (serve.mjs la compara con la página)
}

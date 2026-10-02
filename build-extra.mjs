// El PAQUETE APARTE del Estudio (1 oct 2026, auditoría INF-09: la página tiene su presupuesto en check.mjs).
// build.mjs lo escribe en dist/estudio-extra.js, junto a la página y no dentro: el banco de presets con su compilador y su buscador,
// el escenario 3D y los lotes, con el estilo que solo usan ellos. src/estudio-carga.js lo trae la primera vez que hace falta.
// Aparte de build.mjs para que tests/estudio-extra.test.mjs lo construya y lo compruebe sin escribir nada en dist/.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const ENTRADA = 'src/estudio-extra.js';
/** Lo que el paquete aparte comparte con la página: pequeño, y la galería lo usa siempre (sin esperar al banco). */
export const COMPARTIDOS = ['src/studio-qa.js'];
/** El estilo que viaja con el paquete y no con la página: solo lo usa lo que el paquete pinta (todo lleva .e3d o .lt delante). */
export const CSS_APARTE = ['escena3d.css', 'estudio-lotes.css'];
const MARCA = '@@AO_EXTRA_VERSION@@';

/** Los THREE.X que la página comparte (src/three-compartido.js). */
export function threeQueSeComparte() {
  const src = readFileSync('src/three-compartido.js', 'utf8');
  return new Set([...src.matchAll(/^export function threeCompartido[\s\S]*?return \{([\s\S]*?)\};/gm)].flatMap(m => m[1].split(',').map(x => x.trim()).filter(Boolean)));
}

/** three.js no viaja dos veces: en el paquete aparte `three` es window.AO_THREE, lo que la página ya lleva. */
const threeDeLaPagina = {
  name: 'three-de-la-pagina',
  setup(b) {
    b.onResolve({ filter: /^three(\/.*)?$/ }, a => ({ path: a.path, namespace: 'three-de-la-pagina' }));
    b.onLoad({ filter: /.*/, namespace: 'three-de-la-pagina' }, a => {
      if (a.path === 'three') return { contents: 'module.exports = window.AO_THREE;', loader: 'js' };
      if (a.path === 'three/examples/jsm/controls/OrbitControls.js') return { contents: 'module.exports = { OrbitControls: window.AO_THREE.OrbitControls };', loader: 'js' };
      return { errors: [{ text: `${a.path}: el paquete aparte solo puede usar el three.js que comparte la página (src/three-compartido.js)` }] };
    });
  },
};

/**
 * → { js, version, aparte, css }. `aparte`: los archivos de src/ y presets/ que van SOLO en el paquete (la página no debe llevarlos);
 * `css`: los nombres de src/css/ que viajan con él. Falla si three.js se colara dentro o si usa algo de three que la página no comparte.
 * cssCorto: el mismo minificador de CSS que usa build.mjs para la página.
 */
export async function construirExtra({ cssCorto = s => s } = {}) {
  const r = await build({ entryPoints: [ENTRADA], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, plugins: [threeDeLaPagina], define: { __AO_EXTRA_VERSION__: JSON.stringify(MARCA) }, logLevel: 'silent' });
  const ins = Object.keys(r.metafile.outputs[Object.keys(r.metafile.outputs)[0]].inputs).map(f => f.replace(/\\/g, '/'));
  if (ins.some(f => f.includes('node_modules/three'))) throw new Error('three.js se coló en dist/estudio-extra.js: la página ya lo lleva');
  const compartido = threeQueSeComparte();
  const usados = new Set(ins.filter(f => f.startsWith('src/')).flatMap(f => [...readFileSync(f, 'utf8').matchAll(/\bTHREE\.([A-Za-z_]\w*)/g)].map(m => m[1])));
  const faltan = [...usados].filter(n => !compartido.has(n));
  if (faltan.length) throw new Error(`el paquete aparte usa THREE.${faltan.join(', THREE.')} y la página no lo comparte: añádelo a src/three-compartido.js`);
  const aparte = ins.filter(f => f.startsWith('src/') || f.startsWith('presets/')).filter(f => !COMPARTIDOS.includes(f));
  // el estilo entra en la página cuando llega el paquete, antes de que pinte nada; con la misma marca que en la página (check.mjs la cuenta)
  const css = CSS_APARTE.map(f => `/* ---- src/css/${f} ---- */\n${cssCorto(readFileSync('src/css/' + f, 'utf8'))}`).join('\n');
  const estilo = `(function(){if(typeof document==="undefined"||document.querySelector("style[data-ao-extra]"))return;var s=document.createElement("style");s.setAttribute("data-ao-extra","");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n`;
  const text = estilo + r.outputFiles[0].text, version = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return { js: text.split(MARCA).join(version), version, aparte, css: CSS_APARTE };
}

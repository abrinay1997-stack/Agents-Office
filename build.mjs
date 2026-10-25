// Bundle src/main.js (+three) into a single self-contained HTML that opens by double-click.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, existsSync } from 'fs';
import { buildBrainGraph } from './graph-build.mjs';
import { cargarFabrica } from './presets/fabrica.mjs';
import { construirExtra, CSS_APARTE } from './build-extra.mjs';
import { construirTareas, CSS_TAREAS } from './build-tareas.mjs'; // plan T2 (6 oct 2026): la vista Tareas, también aparte
import { construirAnuncios, CSS_ANUNCIOS } from './build-anuncios.mjs'; // Fase A1 (9 oct 2026): la vista Anuncios, también aparte
import { construirPieza, CSS_PIEZA, SOLO_AQUI as SOLO_PIEZA } from './build-pieza.mjs'; // C1 (8 oct 2026): el editor de una pieza de Contenido, también aparte
await buildBrainGraph(); // V3.6: bake the vault's wiki-link graph into src/braingraph.js

// Banco de presets (F1): la fábrica de imagen, para la demo file:// (busca y compila sin servidor), va JUNTO a la página, en
// dist/presets-fabrica.js, y no dentro: pesa ~250 KB y la página tiene su presupuesto (check.mjs). src/presets-fabrica.js la carga.
const FAB = (() => { const f = cargarFabrica(); return { version: f.version, grupos: f.grupos, tipos: f.tipos, canales: f.canales, familias: f.familias, iconos: f.iconos, sinonimos: f.sinonimos, presets: f.presets.filter(p => (p.medios || []).some(m => ['image', 'video', 'music', 'audio'].includes(m))) }; })(); // F5/F6 (10 oct 2026): también video, música y voz

// CARGA BAJO DEMANDA (1 oct 2026, INF-09): lo que solo usa el Estudio (el banco de presets con su compilador y su buscador, el
// escenario 3D y los lotes) va en un paquete aparte, dist/estudio-extra.js, junto a la página; src/estudio-carga.js lo trae la
// primera vez que hace falta. three.js no viaja dos veces: en el paquete aparte `three` es window.AO_THREE (src/three-compartido.js).
// Su estilo (CSS_APARTE: el escenario y los lotes) viaja con él. Cómo se arma: build-extra.mjs.
const cssCorto = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').trim();
const extra = await construirExtra({ cssCorto });
const tareasV = await construirTareas({ cssCorto }); // dist/tareas-vista.js: la página la trae al abrir Tareas (src/tareas-carga.js)
const anunciosV = await construirAnuncios({ cssCorto }); // dist/anuncios-vista.js: la página la trae al abrir Anuncios (src/anuncios-carga.js)
const piezaE = await construirPieza({ cssCorto }); // dist/pieza-editor.js: la página lo trae al abrir Contenido (src/pieza-carga.js)
const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  metafile: true,
  define: { __AO_EXTRA_VERSION__: JSON.stringify(extra.version), __AO_TAREAS_VERSION__: JSON.stringify(tareasV.version), __AO_ANUNCIOS_VERSION__: JSON.stringify(anunciosV.version), __AO_PIEZA_VERSION__: JSON.stringify(piezaE.version) },
});
const js = res.outputFiles[0].text;
{ // lo que va aparte no vuelve a entrar en la página
  const dentro = Object.keys(res.metafile.outputs[Object.keys(res.metafile.outputs)[0]].inputs).map(f => f.replace(/\\/g, '/'));
  const colado = dentro.filter(f => extra.aparte.includes(f));
  if (colado.length) throw new Error(`la página volvió a llevar lo del paquete aparte (${colado.join(', ')}): impórtalo solo desde src/estudio-extra.js y úsalo a través de src/estudio-carga.js`);
  const coladoT = dentro.filter(f => tareasV.aparte.includes(f) && !f.startsWith('tareas/'));
  if (coladoT.length) throw new Error(`la página volvió a llevar la vista Tareas (${coladoT.join(', ')}): impórtala solo desde src/tareas/vista.js y ábrela con src/tareas-carga.js`);
  const coladoA = dentro.filter(f => anunciosV.aparte.includes(f) || f.startsWith('src/anuncios/'));
  if (coladoA.length) throw new Error(`la página volvió a llevar la vista Anuncios (${coladoA.join(', ')}): impórtala solo desde src/anuncios/vista.js y ábrela con src/anuncios-carga.js`);
  const coladoP = dentro.filter(f => SOLO_PIEZA.includes(f));
  if (coladoP.length) throw new Error(`la página volvió a llevar el editor de piezas (${coladoP.join(', ')}): lo pequeño va en src/pieza-base.js; el editor, solo por src/pieza-carga.js`);
}
// V4.7: the views added after V4.6 keep their style in src/css/<name>.css instead of growing shell.html; they are joined, in name order,
// where shell.html says «/* <css-vistas> */» (the end of its <style>). Nothing else changes: it is still one file that opens by double click.
// Banco de presets F2 (1 oct 2026): sin sus comentarios ni espacios de más (~36 KB), para que la página quepa en su presupuesto (check.mjs,
// INF-09) con la pestaña Lotes. Solo comentarios y blancos: los espacios que separan selectores (`.lt :is(…)`) y los de los valores quedan.
// (cssCorto, arriba). Los de CSS_APARTE no: viajan con dist/estudio-extra.js.
const vistasCss = existsSync('src/css') ? readdirSync('src/css').filter(f => f.endsWith('.css') && !CSS_APARTE.includes(f) && !CSS_TAREAS.includes(f) && !CSS_ANUNCIOS.includes(f) && !CSS_PIEZA.includes(f)).sort().map(f => `/* ---- src/css/${f} ---- */\n${cssCorto(readFileSync('src/css/' + f, 'utf8'))}`).join('\n') : '';
// Banco de presets F5 (1 oct 2026): el <style> de shell.html también llega sin sus comentarios (~16 KB; los blancos y lo demás,
// tal cual) para que el compilador de video quepa en el presupuesto sin subir el tope. El marcador se queda para el reemplazo.
const sinComentarios = s => s.replace(/<style>([\s\S]*?)<\/style>/, (m, css) => `<style>${css.replace(/\/\*(?! <css-vistas> \*\/)[\s\S]*?\*\//g, '')}</style>`);
const shell = sinComentarios(readFileSync('src/shell.html', 'utf8')).replace('/* <css-vistas> */', () => vistasCss);
const html = shell.replace('<!--APP-->', () => `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
// write-then-rename, retried: on Windows the running office may be reading the file at that instant (EBUSY / UNKNOWN), and a reader
// never sees half a file (serve.mjs caches dist/estudio-extra.js by its mtime: a half-written one stayed cached until the next build).
// The temporary name carries the pid: serve.mjs may rebuild while someone else runs node build.mjs.
const escribirEntero = (out, data) => { const tmp = `${out}.${process.pid}.tmp`; writeFileSync(tmp, data);
  for (let i = 0; ; i++) { try { renameSync(tmp, out); break; } catch (e) { if (i >= 20) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150); } } };
// the Estudio's heavy part, beside the page (src/estudio-carga.js loads it on demand): before the page, so a page never asks for a part older than itself
escribirEntero('dist/estudio-extra.js', extra.js);
escribirEntero('dist/tareas-vista.js', tareasV.js); // la vista Tareas, antes que la página por la misma razón
escribirEntero('dist/anuncios-vista.js', anunciosV.js); // la vista Anuncios, igual
escribirEntero('dist/pieza-editor.js', piezaE.js); // el editor de piezas de Contenido, igual
escribirEntero('dist/command-centre-v2.html', html);
// dictado por voz (fase 10): un script suelto junto a la página (src/dictado-carga.js lo pide solo si el navegador sabe dictar); sin versión: no comparte nada con la página
escribirEntero('dist/dictado.js', (await build({ entryPoints: ['src/dictado-app.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' })).outputFiles[0].text);

// dev variant with external script for faster iteration
mkdirSync('dist', { recursive: true });
writeFileSync('dist/presets-fabrica.js', `window.AO_PRESETS_FABRICA=${JSON.stringify(FAB)};\n`); // the demo's preset factory, beside the page
writeFileSync('dist/app.js', js);
writeFileSync('dist/dev.html', shell.replace('<!--APP-->', '<script src="app.js"></script>'));
console.log(`built dist/command-centre-v2.html (${(html.length / 1024).toFixed(0)} KB) + dist/estudio-extra.js (${(extra.js.length / 1024).toFixed(0)} KB, on demand) + dist/anuncios-vista.js (${(anunciosV.js.length / 1024).toFixed(0)} KB, on demand)`);


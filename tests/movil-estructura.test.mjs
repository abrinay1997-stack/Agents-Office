// Versión móvil (25 oct 2026): la estructura — qué trae la página, qué trae el paquete, que cada destino existe y que las reglas de estilo se cumplen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { crearShell } from '../src/movil/shell.js';
import { ESCRITORIO } from '../src/movil/escritorio.js';
import { TABS } from '../src/movil/nav.js';
import { registrar as inicio } from '../src/movil/vistas/inicio.js';
import { registrar as tareas } from '../src/movil/vistas/tareas.js';
import { registrar as calendario } from '../src/movil/vistas/calendario.js';
import { registrar as dimitri } from '../src/movil/vistas/dimitri.js';
import { registrar as aprobaciones } from '../src/movil/vistas/aprobaciones.js';
import { registrar as mas } from '../src/movil/vistas/mas.js';
import { construirMovil, CSS_MOVIL } from '../build-movil.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('cada pestaña de la barra tiene su vista registrada, y Aprobaciones también', () => {
  const sh = crearShell(); for (const r of [inicio, tareas, calendario, dimitri, aprobaciones, mas]) r(sh);
  const ids = sh.vistas().map(v => v.id);
  for (const t of TABS) assert.ok(ids.includes(t.id), `falta la vista «${t.id}»`);
  assert.ok(ids.includes('aprobaciones'));
  for (const v of sh.vistas()) assert.ok(typeof v.montar === 'function' || typeof v.abrir === 'function', `${v.id} no tiene cómo abrirse`);
});

test('una vista móvil nueva con el id de una de escritorio la reemplaza en «Más»', () => {
  const sh = crearShell(); assert.ok(sh.entradasEscritorio().some(x => x.id === 'cerebro'));
  sh.registrarVista({ id: 'cerebro', titulo: 'Cerebro', grupo: 'mas', montar() {} });
  assert.equal(sh.entradasEscritorio().some(x => x.id === 'cerebro'), false);
  assert.throws(() => sh.registrarVista({}), /falta el id/);
});

test('cada entrada de escritorio apunta a botones y ventanas que existen en la página', () => {
  const html = leer('src/shell.html'), codigo = leer('src/movil/escritorio.js');
  for (const id of [...codigo.matchAll(/clic\('([A-Za-z]+)'\)/g)].map(m => m[1])) assert.ok(html.includes(`id="${id}"`), `el botón #${id} ya no está en la página`);
  const ventanas = { '#bizOv': 'src/business.js', '#costsOv': 'src/costs.js', '#findOv': 'src/search.js', '#setOv': 'src/settings.js' };
  for (const [sel, f] of Object.entries(ventanas)) assert.ok(leer(f).includes(`el.id = '${sel.slice(1)}'`), `${sel} ya no se crea en ${f}`);
  assert.ok(ESCRITORIO.every(x => x.id && x.titulo && typeof x.abrir === 'function' && typeof x.abierta === 'function' && typeof x.cerrar === 'function'));
  assert.equal(new Set(ESCRITORIO.map(x => x.id)).size, ESCRITORIO.length, 'ids repetidos');
});

test('la página no lleva la versión móvil: solo el cargador mínimo', async () => {
  const { aparte } = await construirMovil();
  assert.ok(aparte.length >= 8, 'el paquete lleva sus módulos');
  const hay = fs.existsSync(path.join(ROOT, 'dist/command-centre-v2.html'));
  if (hay) { const pagina = leer('dist/command-centre-v2.html'); assert.ok(!pagina.includes('data-ao-movil') && !pagina.includes('mv-tabs') && !pagina.includes('mvRoot'), 'nada del paquete debe estar en la página'); }
  assert.match(leer('src/main.js'), /import \{ initMovil \} from '\.\/movil-carga\.js'/, 'la página abre el cargador');
  assert.doesNotMatch(leer('src/movil-carga.js'), /from '\.\/movil\//, 'el cargador no importa el paquete');
  const carga = await build({ entryPoints: [path.join(ROOT, 'src/movil-carga.js')], bundle: true, minify: true, write: false, format: 'esm' });
  assert.ok(carga.outputFiles[0].text.length < 700, `el cargador pesa ${carga.outputFiles[0].text.length} bytes: la página no puede crecer más de 1 KB`);
  const { js } = await construirMovil();
  assert.ok(js.includes('data-ao-movil') && js.includes('AO_MOVIL'));
  assert.ok(!/sk-ant|Bearer /.test(js), 'nada secreto en el paquete');
});

test('el estilo móvil cumple las reglas: nada de :hover, ningún texto bajo 11 px, campos de 16 px, dvh y safe-area', () => {
  assert.ok(CSS_MOVIL.includes('movil.css'));
  const css = CSS_MOVIL.map(f => leer('src/css/' + f)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/:hover/.test(css), 'en un teléfono no hay hover');
  const chicos = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => +m[1]).filter(n => n < 11);
  assert.deepEqual(chicos, [], 'ningún texto de menos de 11 px');
  assert.ok(/dvh/.test(css) && /safe-area-inset-bottom/.test(css) && /safe-area-inset-top/.test(css) && /prefers-reduced-motion/.test(css));
  assert.ok(/body\.dark #mvRoot/.test(css), 'el tema oscuro tiene su paleta');
  assert.ok(/font-size: 16px; border: 1\.5px/.test(css), 'los campos son de 16 px');
});

test('ninguna pantalla pinta texto sin escapar: toda interpolación de datos pasa por esc()', () => {
  // vigila lo más fácil de romper: un ${...} con un campo de la tarea o del mensaje sin esc() dentro de una plantilla de las vistas
  const sospechosos = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'src/movil/vistas'))) {
    const src = leer('src/movil/vistas/' + f);
    for (const m of src.matchAll(/\$\{([^}]*?\b(?:t|x|e|m|o|r|n|c|q)\.(?:title|titulo|text|desc|error|label|q|subject|channel|name)\b[^}]*)\}/g)) {
      const linea = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
      const aTexto = /ctx\.toast\(|texto: `|toast\(/.test(linea) || /^t\.error \?/.test(m[1]); // un aviso y el texto de una hoja de confirmación se escapan al pintarse (shell.toast, hoja.confirmar)
      if (!aTexto && !/esc\(|mdToHtml\(|esc2\(/.test(m[1])) sospechosos.push(`${f}: \${${m[1].slice(0, 60)}}`);
    }
  }
  assert.deepEqual(sospechosos, []);
});

// «Publicar ahora» (CON-04, fase 2 PR 2): la interfaz va en los paquetes bajo demanda (editor y móvil), nunca en la página, y siempre pide el segundo paso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVISO_YA, motivoNoYa } from '../src/contenido-ya.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lee = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('motivoNoYa: solo hay «ahora» en modo real y con Meta directo', () => {
  assert.match(motivoNoYa({ modo: 'apagado' }), /apagado/);
  assert.match(motivoNoYa({ modo: 'simulacro', conductor: 'meta' }), /simulacro/);
  assert.match(motivoNoYa({ modo: 'real', conductor: 'metricool' }), /Meta directo/);
  assert.equal(motivoNoYa({ modo: 'real', conductor: 'meta' }), '');
  assert.match(AVISO_YA, /No se puede deshacer/); assert.match(AVISO_YA, /Instagram no se puede borrar|en Instagram no se puede borrar/i);
});

test('la página principal no lleva el botón: el texto del aviso solo está en los paquetes bajo demanda', () => {
  const page = lee('dist/command-centre-v2.html');
  assert.ok(!page.includes('No se puede deshacer: después solo se puede borrar'), 'el aviso no está en la página');
  assert.ok(!/contenido-ya/.test(lee('src/contenido.js')) && !/contenido-ya/.test(lee('src/contenido-datos.js')), 'la página no importa contenido-ya');
  assert.match(lee('src/pieza.js'), /contenido-ya\.js/); assert.match(lee('src/movil/vistas/d-comun.js'), /contenido-ya\.js/);
});

test('escritorio: el botón solo existe con publicarYa y el primer clic no publica; móvil: hoja de confirmación y confirmado:true', () => {
  const pz = lee('src/pieza.js');
  assert.match(pz, /aj\?\.publicarYa !== true/, 'apagado por defecto');
  const handler = pz.slice(pz.indexOf("if (a === 'ahora')"), pz.indexOf("if (a === 'impulsar')"));
  assert.match(handler, /ahoraConf < Date\.now\(\)/, 'el primer clic solo arma la confirmación'); assert.match(handler, /publicarAhora\(\)/);
  assert.match(pz, /publicar-ya`, \{ confirmado: true \}/);
  const dc = lee('src/movil/vistas/d-comun.js'), f = dc.slice(dc.indexOf('export async function publicarAhora'));
  assert.match(f, /ctx\.confirmar\(/); assert.match(f, /peligro: true/); assert.ok(f.indexOf('ctx.confirmar') < f.indexOf('publicar-ya'), 'primero la hoja, después la ruta');
  assert.match(f, /confirmado: true/);
  assert.match(lee('src/movil/vistas/contenido.js'), /E\.ajustes\.publicarYa === true/);
});

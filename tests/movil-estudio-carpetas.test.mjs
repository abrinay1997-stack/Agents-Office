// 26 oct 2026 — carpetas del Estudio en el teléfono: lo puro (nombres, de dónde viene lo que se mueve, el texto del aviso, la selección).
// El recorrido en un navegador con la oficina de verdad: scripts/movil-b-recorrido.mjs (sección «Carpetas»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { errorNombreCarpeta, limpiarNombreCarpeta, carpetaDeFicha, origenes, textoMovida, alternarSeleccion, seleccionVigente, MAX_CARPETAS } from '../src/movil/estudio-puro.js';

const F = [{ id: 'c1', name: 'Navidad', n: 2 }, { id: 'c2', name: 'Producto', n: 0 }];

test('el nombre de una carpeta: vacío, repetido (sin mayúsculas), renombrar a sí misma y el tope de 200', () => {
  assert.equal(errorNombreCarpeta('Verano', F), '');
  assert.match(errorNombreCarpeta('   ', F), /nombre/);
  assert.match(errorNombreCarpeta('navidad', F), /Ya hay una carpeta «navidad»/);
  assert.equal(errorNombreCarpeta('NAVIDAD', F, 'c1'), '', 'renombrar una carpeta con su mismo nombre (otras letras) no choca consigo misma');
  assert.match(errorNombreCarpeta('Otra', Array.from({ length: MAX_CARPETAS }, (_, i) => ({ id: 'c' + i, name: 'n' + i }))), /200/);
  assert.equal(limpiarNombreCarpeta('  a   b\u0000<i> '), 'a bi');
});

test('la carpeta de verdad de una ficha: una carpeta que ya no existe no cuenta', () => {
  assert.equal(carpetaDeFicha({ folder: 'c1' }, F), 'c1');
  assert.equal(carpetaDeFicha({ folder: 'borrada' }, F), null);
  assert.equal(carpetaDeFicha({}, F), null);
  assert.equal(carpetaDeFicha(null, F), null);
});

test('de dónde viene lo que se mueve (para poder deshacer)', () => {
  const items = [{ file: 'a', folder: 'c1' }, { file: 'b', folder: 'c1' }, { file: 'c' }, { file: 'd', folder: 'borrada' }, { file: 'e', folder: 'c2' }];
  const m = origenes(items, ['a', 'b', 'c', 'd'], F);
  assert.deepEqual([...m.entries()], [['c1', ['a', 'b']], [null, ['c', 'd']]]);
});

test('el aviso al mover, en singular y plural', () => {
  assert.equal(textoMovida(1, { name: 'Navidad' }), 'Un archivo movido a «Navidad».');
  assert.equal(textoMovida(3, { name: 'Navidad' }), '3 archivos movidos a «Navidad».');
  assert.equal(textoMovida(1, null), 'Un archivo sacado de su carpeta.');
  assert.equal(textoMovida(2, null), '2 archivos sacados de su carpeta.');
});

test('la selección: se alterna y solo vale lo que sigue en la vista', () => {
  const s = new Set(); alternarSeleccion(s, 'a'); alternarSeleccion(s, 'b'); alternarSeleccion(s, 'a');
  assert.deepEqual([...s], ['b']);
  assert.deepEqual([...seleccionVigente(new Set(['a', 'b', 'z']), [{ file: 'a' }, { file: 'b' }])].sort(), ['a', 'b']);
});

test('la hoja de mover y el deshacer de eliminar respetan los 2.000 archivos que mueve el servidor de una vez', async () => {
  const { mover, MAX_MOVER } = await import('../src/movil/vistas/estudio-carpetas.js');
  assert.equal(MAX_MOVER, 2000);
  const avisos = [], llamadas = [], ctx = { toast: t => avisos.push(t), api: async (...a) => { llamadas.push(a); return { folders: [] }; } };
  const E = { items: [], folders: [{ id: 'c1', name: 'Navidad' }] };
  assert.equal(await mover(ctx, E, Array.from({ length: 2001 }, (_, i) => 'f' + i), { carpeta: 'c1' }), false, 'más de 2.000 no se manda');
  assert.deepEqual(llamadas, [], 'y no se llama al servidor');
  assert.match(avisos[0], /como mucho 2000/);
});

test('eliminar una carpeta de más de 600 imágenes: pide todas las páginas antes y el deshacer las devuelve todas', async () => {
  const { eliminar } = await import('../src/movil/vistas/estudio-carpetas.js');
  globalThis.dispatchEvent = () => true; // (en el navegador existe)
  try {
    const todas = Array.from({ length: 1300 }, (_, i) => ({ file: 'f' + i })), pagina = n => todas.slice(n * 600, n * 600 + 600);
    const pedidas = [], toasts = []; let deshacer = null, creada = null;
    const ctx = {
      confirmar: async () => true, toast: (t, o) => { toasts.push(t); if (o?.alAccion) deshacer = o.alAccion; },
      api: async (ruta, o = {}) => {
        if (ruta.startsWith('/api/media?')) { const q = new URLSearchParams(ruta.split('?')[1]), n = q.get('before') ? +q.get('before') : 0; pedidas.push(n); return { items: pagina(n), next: (n + 1) * 600 < todas.length ? String(n + 1) : null }; }
        if (o.method === 'DELETE') return { ok: true, folders: [] };
        if (o.method === 'POST' && ruta === '/api/media/folders') { creada = o.body; return { folder: { id: 'c2', name: o.body.name }, folders: [{ id: 'c2', name: o.body.name }] }; }
        throw new Error('ruta inesperada ' + ruta);
      } };
    const E = { items: [], folders: [{ id: 'c1', name: 'Navidad', n: 1300 }] };
    assert.equal(await eliminar(ctx, E, 'c1'), true);
    assert.deepEqual(pedidas, [0, 1, 2], 'las tres páginas, no solo la primera');
    assert.ok(deshacer, 'con la lista entera hay Deshacer'); await deshacer();
    assert.equal(creada.files.length, 1300, 'y devuelve las 1.300, no las primeras 600');
    // si la lista no se puede traer entera, se elimina igual pero SIN Deshacer (y se dice)
    deshacer = null; toasts.length = 0;
    const ctx2 = { ...ctx, api: async (ruta, o = {}) => { if (ruta.startsWith('/api/media?')) throw new Error('sin red'); return { ok: true, folders: [] }; } };
    assert.equal(await eliminar(ctx2, { items: [], folders: [{ id: 'c1', name: 'Navidad', n: 5 }] }, 'c1'), true);
    assert.equal(deshacer, null); assert.match(toasts[0], /siguen en el Estudio, sin carpeta/);
  } finally { delete globalThis.dispatchEvent; }
});

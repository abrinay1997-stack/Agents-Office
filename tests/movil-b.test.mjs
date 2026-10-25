// Versión móvil, equipo B (25 oct 2026): lo PURO de Cerebro, Estudio, Buscar y las imágenes de Dimitri. El navegador lo prueba scripts/movil-b-recorrido.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filtrarNotas, enlacesDe, notaHTML } from '../src/movil/vistas/cerebro.js';
import { buscarLocal } from '../src/movil/vistas/buscar.js';
import { salida } from '../src/movil/vistas/dimitri-extra.js';
import { agruparPorDia, modelosDe, ajustesDe, costoDe, queFalta, pedido, desdeFicha, avance, dineroQueda, UMBRAL } from '../src/movil/estudio-puro.js';
import { pedirOk } from '../src/studio-confirmar.js';
import { modesto, diaTexto, mediaSrc } from '../src/movil/b-comun.js';

const AHORA = Date.parse('2026-10-25T12:00:00');
const nodo = (id, g, dias, d = 1) => ({ id, g, d, t: Math.floor((AHORA - dias * 864e5) / 1000) });

test('Cerebro: filtrar por carpeta, cuándo y «por revisar», lo más reciente primero', () => {
  const n = [nodo('a', '10-Business', 400), nodo('b', '20-Brand', 2), nodo('c', '10-Business', 1)];
  assert.deepEqual(filtrarNotas(n, { ahora: AHORA }).map(x => x.id), ['c', 'b', 'a']);
  assert.deepEqual(filtrarNotas(n, { carpeta: '10-Business', ahora: AHORA }).map(x => x.id), ['c', 'a']);
  assert.deepEqual(filtrarNotas(n, { edad: 'semana', ahora: AHORA }).map(x => x.id), ['c', 'b']);
  assert.deepEqual(filtrarNotas(n, { edad: 'viejas', ahora: AHORA }).map(x => x.id), ['a']);
  assert.deepEqual(filtrarNotas(n, { edad: 'revisar', stale: new Map([['b', 'vieja']]), ahora: AHORA }).map(x => x.id), ['b']);
});
test('Cerebro: los [[enlaces]] de una nota (con alias y sin repetir) y su HTML escapado', () => {
  assert.deepEqual(enlacesDe('ver [[MOC-Emails]] y [[offer|la oferta]] otra vez [[MOC-Emails]]'), ['MOC-Emails', 'offer']);
  const h = notaHTML('Mira [[offer-ladder]] y [[x"onmouseover="alert(1)]]');
  assert.match(h, /<button type="button" class="mv-enl" data-nota="offer-ladder">offer-ladder<\/button>/);
  assert.ok(!/onmouseover="alert/.test(h) && !/<a class="md-wiki"/.test(h), 'un nombre raro no se cuela como atributo y no queda ningún <a> de escritorio');
  assert.ok(!/<script/i.test(notaHTML('<script>alert(1)</script>')), 'el HTML de la nota se escapa');
});
test('Buscar: tareas, agentes y rutinas (todas las palabras, sin tildes) y nada con una letra', () => {
  const datos = { tareas: [{ id: 't1', title: 'Llamar al banco' }, { id: 't2', title: 'Pieza', piece: true }, { id: 't3', title: 'Banco archivado', archived: true }], agentes: [{ id: 'a', name: 'INVO', role: 'Facturación', does: 'cobra' }], rutinas: [{ id: 'r', title: 'Revisión del lunes', text: 'mira las facturas' }] };
  assert.deepEqual(buscarLocal('llamar BANCO', datos).tareas.map(t => t.id), ['t1']);
  assert.equal(buscarLocal('facturacion', datos).agentes.length, 1);
  assert.equal(buscarLocal('lunes facturas', datos).rutinas.length, 1);
  assert.deepEqual(buscarLocal('a', datos).tareas, []);
});
test('Estudio: agrupar por día (Hoy, Ayer, fecha), en el orden que llega', () => {
  const g = agruparPorDia([{ at: AHORA - 1000 }, { at: AHORA - 2000 }, { at: AHORA - 864e5 }, { at: AHORA - 3 * 864e5 }], AHORA);
  assert.deepEqual(g.map(x => [x.dia === 'Hoy' || x.dia === 'Ayer' ? x.dia : 'fecha', x.items.length]), [['Hoy', 2], ['Ayer', 1], ['fecha', 1]]);
  assert.equal(diaTexto(Date.parse('2026-10-12T10:00:00'), AHORA), 'lunes 12 oct');
});
const MODELOS = [
  { id: 'p', name: 'Prueba', kind: 'image', on: true, cost: 0, tier: 1, settings: { aspectRatio: { type: 'enum', values: ['1:1', '9:16'], default: '1:1' }, batchSize: { type: 'enum', values: ['1', '4'], default: '1' }, seed: { type: 'text', default: '' } }, roles: {}, needs: [] },
  { id: 'f', name: 'Flux', kind: 'image', on: true, cost: 0.04, tier: 3, settings: { aspectRatio: { type: 'enum', values: ['1:1', '4:5'], default: '4:5' } }, roles: { reference: 2 }, needs: [] },
  { id: 'x', name: 'Sin key', kind: 'image', on: false, cost: 0.1, tier: 4, settings: {}, roles: {}, needs: [] },
  { id: 'v', name: 'Video', kind: 'video', on: true, cost: 0.1, per: 's', seconds: null, tier: 3, settings: { duration: { type: 'enum', values: ['5', '10'], default: '5' } }, roles: { start: 1, end: 1 }, needs: ['start'] },
];
test('Estudio: solo los modelos encendidos, el predeterminado primero; los ajustes parten de los del modelo', () => {
  assert.deepEqual(modelosDe(MODELOS, 'image', 'p').map(m => m.id), ['p', 'f']);
  assert.deepEqual(modelosDe(MODELOS, 'image', 'f').map(m => m.id), ['f', 'p']);
  assert.deepEqual(ajustesDe(MODELOS[0], { aspectRatio: '9:16' }), { aspectRatio: '9:16', batchSize: '1' }, 'sin los vacíos (semilla)');
  assert.deepEqual(ajustesDe(MODELOS[1]), { aspectRatio: '4:5' });
});
test('Estudio: el costo es el del botón (unidad × cuántas × tanda) y un video cuesta por segundo', () => {
  assert.equal(costoDe(MODELOS[1], {}, 'x', 2), 0.08);
  assert.equal(costoDe(MODELOS[0], { batchSize: '4' }, 'x', 1), 0);
  assert.equal(costoDe(MODELOS[3], { duration: '10' }, 'x', 1), 1);
  assert.equal(costoDe(null, {}, '', 1), 0);
});
test('Estudio: qué falta para generar, y el pedido que se envía solo lleva lo que el modelo admite', () => {
  assert.match(queFalta(MODELOS[0], '  ', {}), /idea/i);
  assert.match(queFalta(MODELOS[3], 'un baile', {}), /imagen inicial/i);
  assert.equal(queFalta(MODELOS[3], 'un baile', { start: ['a.png'] }), '');
  assert.match(queFalta(null, 'x'), /modelo/i);
  const p = pedido({ m: MODELOS[1], texto: ' un gato ', cantidad: 2, ajustes: { aspectRatio: '1:1' }, material: { reference: ['a', 'b', 'c'], start: ['z'] }, carpeta: 'c1' });
  assert.deepEqual(p, { prompt: 'un gato', n: 2, kind: 'image', model: 'f', settings: { aspectRatio: '1:1' }, media: { reference: ['a', 'b'] }, by: 'you', folder: 'c1' }, 'máx. 2 referencias, ningún rol que el modelo no tenga, siempre «by: you»');
});
test('Estudio: el segundo toque llega desde US$0,50 y para lo mismo (el dinero no se gasta con un solo toque)', () => {
  assert.equal(UMBRAL, 0.5);
  assert.equal(pedirOk(null, 'k', 0.49).ok, true);
  const a = pedirOk(null, 'k', 0.9); assert.equal(a.ok, false);
  assert.equal(pedirOk(a.armado, 'otro', 0.9, Date.now()).ok, false, 'otro pedido no hereda el toque');
  assert.equal(pedirOk(a.armado, 'k', 0.9, a.armado.at + 7000).ok, false, 'pasado el plazo vuelve a pedir');
  assert.equal(pedirOk(a.armado, 'k', 0.9, a.armado.at + 500).ok, true);
});
test('Estudio: Variar, Animar y Usar de referencia dejan el compositor listo (nada se genera aquí)', () => {
  const it = { file: '2026-10/a.png', kind: 'image', prompt: 'un gato', model: 'f', settings: { aspectRatio: '1:1', raro: 'x' } };
  const v = desdeFicha('variar', it, MODELOS, { image: 'p' }); assert.equal(v.modelo, 'f'); assert.equal(v.texto, 'un gato'); assert.deepEqual(v.ajustes, { aspectRatio: '1:1' }); assert.deepEqual(v.material, { reference: ['2026-10/a.png'] });
  const sin = desdeFicha('variar', { ...it, model: 'p' }, MODELOS, {}); assert.equal(sin.sinRef, true); assert.deepEqual(sin.material, {});
  const an = desdeFicha('animar', it, MODELOS, {}); assert.equal(an.kind, 'video'); assert.deepEqual(an.material, { start: ['2026-10/a.png'] });
  const re = desdeFicha('ref', { ...it, model: 'p' }, MODELOS, { image: 'p' }); assert.equal(re.modelo, 'f', 'cambia a un modelo que admite referencias');
  assert.ok(desdeFicha('animar', it, MODELOS.filter(m => m.kind !== 'video'), {}).error);
});
test('Estudio: el avance de un trabajo nunca llega a 1 hasta que acaba, y el tope de dinero es el menor', () => {
  const j = { model: 'm', engine: 'prueba', kind: 'image', state: 'running', startedAt: 1000 };
  assert.ok(avance(j, [], 1000 + 99999) <= 0.95); assert.equal(avance({ ...j, state: 'queued' }, [], 5000), 0);
  assert.equal(dineroQueda({ costLeftDay: 3, costLeftMonth: 1.5 }), 1.5); assert.equal(dineroQueda({ costLeftDay: null, costLeftMonth: null }), null);
});
test('Dimitri: lo que se manda con las fotos (attach + vision) y nada si una falló o aún sube', () => {
  const ok = { state: 'ready', file: '2026-10/a.png', vision: { file: '2026-10/a.png', media_type: 'image/jpeg', data: 'AAAA' } };
  const s = salida('mira', [ok, { state: 'failed' }, { state: 'uploading' }]);
  assert.deepEqual([s.text, s.attach, s.vision.length, s.perdidas], ['mira', ['2026-10/a.png'], 1, 1]);
  assert.equal(salida('', [ok]).text, 'Mira esta imagen.'); assert.equal(salida('', []), null); assert.equal(salida('', [{ state: 'uploading' }]), null);
  assert.equal(salida('hola', []).attach.length, 0);
});
test('común: la dirección de un archivo se codifica y el teléfono modesto se detecta', () => {
  assert.equal(mediaSrc('2026-10/a b.png', 5), '/media/2026-10/a%20b.png?v=5');
  assert.equal(modesto({ deviceMemory: 1 }), true); assert.equal(modesto({ hardwareConcurrency: 8, deviceMemory: 8 }), false); assert.equal(modesto({ connection: { saveData: true } }), true);
});
test('el equipo B no toca la página de escritorio ni se cuela en ella (su código vive en el paquete móvil)', () => {
  const html = fs.readFileSync(new URL('../src/movil/index.js', import.meta.url), 'utf8');
  for (const v of ['cerebro', 'estudio', 'buscar']) assert.match(html, new RegExp(`vistas/${v}\\.js`));
  assert.match(fs.readFileSync(new URL('../build-movil.mjs', import.meta.url), 'utf8'), /movil-b\.css/);
  const sinMovil = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(!/movil\/vistas\/(cerebro|estudio|buscar)/.test(sinMovil));
});

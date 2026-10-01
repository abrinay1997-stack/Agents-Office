// El banco de presets en la página (src/studio-banco.js): lo puro — la marca de cada tarjeta, la portada, el pedido que manda
// el compositor, la pila con sus ejes exclusivos, el canal que añade la exportación y el resumen de la QA. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarFabrica } from '../presets/fabrica.mjs';
import * as B from '../src/studio-banco.js';
import * as core from '../src/presets-core.js';

const fab = cargarFabrica();
const byId = new Map(fab.presets.map(p => [p.id, p]));
const P = id => byId.get(id);

test('la marca de la tarjeta dice en texto cómo se hace (§7.4)', () => {
  assert.equal(B.marca(P('luz-mas-clara')), 'gratis · en tu máquina');
  assert.equal(B.marca(P('luz-mas-clara'), { sharp: false }), 'no disponible en esta máquina');
  assert.match(B.marca(P('fondo-blanco')), /necesita tu foto/);
  assert.equal(B.marca(P('esc-sala'), { sirve: { on: false } }), 'sin motor: actívalo');
  assert.match(B.marca(P('ref-estilo')), /la IA rehace la imagen/i, 'la honestidad del preset, en texto');
});

test('la portada: favoritos, de PanaClaw, recientes y las estrella que encajan con la puerta', () => {
  const ps = [...fab.presets, { id: 'mio-x', nombre: 'Mío', categoria: 'mios', modos: ['foto'] }];
  const s = B.portada(ps, { fav: ['luz-mas-clara', 'no-existe'], rec: ['color-blancos'], puerta: 'foto' });
  assert.deepEqual(s.map(x => x.titulo), ['Favoritos', 'De PanaClaw', 'Recientes', 'Para empezar']);
  assert.deepEqual(s[0].ids, ['luz-mas-clara'], 'un id que no existe no sale');
  assert.ok(s[3].ids.every(id => core.modoAdmite(byId.get(id), 'foto')));
  const cero = B.portada(fab.presets, { puerta: 'cero' }).find(x => x.titulo === 'Para empezar');
  assert.ok(!cero || cero.ids.every(id => core.modoAdmite(byId.get(id), 'cero')));
});

test('el pedido del compositor: las puertas son atajos; el modo sale de lo que pusiste', () => {
  const st = { puerta: 'cero', foto: 'f.png', refs: [{ id: 'r.png', ejes: { color: 2 } }], pila: [{ id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }, { id: 'color-blancos', params: {} }], canal: 'web', escena: null, idea: 'que se vea la madera' };
  assert.equal(B.modoDeEstado(st), 'foto+ref', 'la puerta «Desde cero» no borra la foto ni la referencia');
  const p = B.pedidoDe(st);
  assert.deepEqual(p.pila, [{ id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }, { id: 'color-blancos' }]);
  assert.deepEqual(p.params, { canal: 'web' });
  assert.deepEqual(p.entradas, { foto: ['f.png'], referencias: [{ id: 'r.png', ejes: { color: 2 } }] });
  assert.equal(p.idea, 'que se vea la madera'); assert.equal(p.escena, undefined);
  assert.equal(B.modoDeEstado({ foto: null, refs: [] }), 'cero');
});

test('apilar: una vez cada uno; en un eje exclusivo gana el último, con DESHACER', () => {
  let r = B.anadir([], P('fondo-blanco'), byId); assert.equal(r.aviso, null);
  const fondoGris = fab.presets.find(p => p.id !== 'fondo-blanco' && p.capa === 'ajuste' && (p.ejes || []).includes('fondo') && p.medios.includes('image'));
  const r2 = B.anadir(r.pila, fondoGris, byId);
  assert.deepEqual(r2.pila.map(x => x.id), [fondoGris.id]);
  assert.match(r2.aviso.texto, /sustituyó a «Fondo blanco puro»/); assert.deepEqual(r2.aviso.antes, r.pila);
  const r3 = B.anadir(r2.pila, P('luz-mas-clara'), byId); assert.equal(r3.pila.length, 2, 'la luz se suma');
  assert.equal(B.anadir(r3.pila, P('luz-mas-clara'), byId).pila.length, 2, 'no se repite');
});

test('el canal añade «Exportar para un canal» solo si nada de la pila exporta ya', () => {
  assert.equal(B.exportaYa([{ id: 'luz-mas-clara' }], byId), false);
  assert.equal(B.exportaYa([{ id: 'cat-web-panaclaw' }], byId), true);
  assert.equal(B.exportaYa([{ id: 'sal-canal' }], byId), true);
});

test('el resumen de la QA en la tarjeta: revisar con su motivo, o cuántas pasaron y cuántas no se midieron', () => {
  assert.equal(B.qaResumen(null), null);
  assert.deepEqual(B.qaResumen({ checks: [{ id: 'fondo-255', ok: true }, { id: 'ocupacion', ok: null }] }), { estado: 'ok', texto: 'QA ✓ 1 de 2 · 1 sin medir' });
  assert.deepEqual(B.qaResumen({ checks: [{ id: 'fondo-255', ok: false, motivo: 'Solo el 90 % del borde es blanco 255.' }] }), { estado: 'revisar', texto: 'Revisar: Solo el 90 % del borde es blanco 255.' });
  assert.equal(B.usd(0), 'gratis'); assert.equal(B.usd(0.134), 'US$0,13');
});

test('los atajos de la referencia: «Producto» nunca viene encendido; «Solo color» no manda nada a la IA', () => {
  for (const a of B.ATAJOS_REF) assert.equal(a.ejes.producto, 0, a.id);
  const color = B.ATAJOS_REF.find(a => a.id === 'color');
  const c = core.compilar({ pila: [], byId: fab.presets, familias: fab.familias, tipos: fab.tipos, canales: fab.canales, models: [], capacidades: { local: true }, entradas: { foto: ['f.png'], referencias: [{ id: 'r.png', ejes: color.ejes }] } });
  assert.equal(c.soloLocal, true, c.errores.join());
  assert.ok(c.local.antes.some(o => o.op === 'transferir-color'));
});

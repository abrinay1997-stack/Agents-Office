// Elegir el modelo (src/presets-core.js → modelosPara y compilar; docs/propuesta-banco-presets.md §5.6 y §12 «presets-modelo»):
// con CADA combinación de keys encendidas, el modelo elegido cumple roles, needs y proporción, y lo que pide pasa las
// mismas comprobaciones que media.submit (hfRoute, settingsFor). Veo nunca recibe 1:1, Kontext nunca 2 imágenes y Muse no
// queda primero en catálogo si hay otro que pueda. Sin keys reales: la columna `on` se pone a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../src/presets-core.js';
import { models as filas, capsOf, model as modelo, hfRoute, settingsFor, ENGINES } from '../media/catalogo.mjs';

const C = JSON.parse(fs.readFileSync(new URL('../docs/presets-catalogo.json', import.meta.url), 'utf8'));
const MOTORES = Object.keys(ENGINES);
const FILAS = filas();
const ESCENA = { producto: { tipo: 'cafetera', ancho: 20, alto: 30, fondo: 20, giro: 0, elevacion: 0 }, camara: { distancia: 90, azimut: 0, altura: 30, lente: 85 }, cuadro: { proporcion: '4:5' }, fondo: { tipo: 'color', valor: '#FFFFFF' } };
const esc3d = { describirEscena: () => ['straight-on front view', 'eye-level', '85mm telephoto, compressed perspective'], ocupacionEstimada: () => 0.6 };
const F = 'a.jpg', R1 = 'r1.jpg', R2 = 'r2.jpg';
const CASOS = [
  { n: 'catálogo web sobre tu foto', pila: ['cat-web-panaclaw'], entradas: { foto: F }, catalogo: true },
  { n: 'amazon', pila: ['cat-amazon'], entradas: { foto: F }, catalogo: true },
  { n: 'anuncio con foto y referencia', pila: ['ref-anuncio'], entradas: { foto: F, referencias: [R1] } },
  { n: 'dos referencias por ejes', pila: [], idea: 'summer ad', entradas: { foto: F, referencias: [{ id: R1, ejes: { estilo: 2 } }, { id: R2, ejes: { luz: 2, composicion: 1 } }] } },
  { n: 'desde cero', pila: ['esc-podio'], idea: 'a ceramic mug' },
  { n: 'referencia sin foto', pila: ['ref-estilo'], entradas: { referencias: [R1] } },
  { n: 'escenario 3D sobre tu foto', pila: ['cat-web-panaclaw'], entradas: { foto: F }, escena: ESCENA, escena3d: esc3d, catalogo: true },
  { n: 'video: órbita 1:1 de tu foto', pila: ['cam-orbita', 'vf-cuadrado'], entradas: { foto: F } },
  { n: 'video: reel desde texto', pila: ['cam-acercar', 'vf-reel'], idea: 'a coffee maker on a counter' },
  { n: 'video: de una foto a otra', pila: ['vp-fotos-transicion'], entradas: { inicial: F, final: R1 } },
  { n: 'video: editar un video', pila: ['ved-cambiar-fondo'], entradas: { origen: 'v.mp4' }, idea: 'a beach' },
  { n: 'música', pila: ['mus-reel'], idea: 'beat for a reel' },
];

function* combinaciones() { for (let mask = 0; mask < 1 << MOTORES.length; mask++) yield MOTORES.filter((_, i) => mask & (1 << i)); }

/** Lo mismo que media.submit comprobaría antes de gastar. */
function cumple(r, on, caso) {
  const m = modelo(r.model), fila = FILAS.find(x => x.id === r.model), req = r.request, donde = `${caso.n} [${on.join(',')}] → ${r.model}`;
  assert.ok(on.includes(m.engine), `${donde}: su motor está encendido`);
  assert.equal(m.kind, r.kind, donde);
  assert.ok(!m.legacy, `${donde}: nunca uno «legacy»`);
  for (const [rol, ids] of Object.entries(req.media)) assert.ok(ids.length <= (m.roles?.[rol] || 0), `${donde}: ${rol} ${ids.length} > ${m.roles?.[rol] || 0}`);
  for (const nd of m.needs || []) assert.ok(req.media[nd]?.length, `${donde}: necesita ${nd}`);
  if (m.routes) assert.doesNotThrow(() => hfRoute(m, Object.fromEntries(Object.entries(req.media).map(([k, v]) => [k, v.length]))), donde);
  if (r.kind === 'image' && caso.entradas?.foto) assert.ok(fila.edit, `${donde}: edita`);
  const s = settingsFor(m, req.settings);
  for (const [k, v] of Object.entries(req.settings)) assert.deepEqual(s[k], v, `${donde}: ajuste ${k}=${v} válido para el modelo`);
  if (/^veo-/.test(m.id)) assert.notEqual(req.settings.aspectRatio, '1:1', `${donde}: Veo nunca 1:1`);
  if (r.kind === 'video' && req.settings.aspectRatio) assert.ok(m.settings.aspectRatio.values.includes(req.settings.aspectRatio), donde);
  if (/flux-kontext/.test(m.id)) assert.ok((req.media.reference || []).length <= 1, `${donde}: Kontext, una imagen`);
  if (caso.catalogo && m.id === 'muse-image') assert.equal(r.alternativas.length, 0, `${donde}: Muse solo si no hay otro`);
  assert.ok(req.prompt.length <= (m.maxPrompt || 4000), `${donde}: el prompt cabe`);
  assert.ok(Number.isFinite(r.costo.usd) && r.costo.usd >= 0, donde);
}

test('con cada combinación de keys, el modelo elegido puede de verdad con el pedido', () => {
  let elegidos = 0, sinMotor = 0; const usados = new Set();
  for (const on of combinaciones()) {
    const models = FILAS.map(m => ({ ...m, on: on.includes(m.engine) }));
    for (const caso of CASOS) {
      const r = core.compilar({ byId: C.presets, models, caps: id => capsOf(id), familias: C.familias, tipos: C.tipos, canales: C.canales, pila: caso.pila, idea: caso.idea, entradas: caso.entradas, escena: caso.escena, escena3d: caso.escena3d, cifras: {} });
      if (!r.model) { sinMotor++; assert.ok(r.errores.length, `${caso.n} [${on}]: sin modelo, dice por qué`); assert.equal(r.request, null); continue; }
      assert.deepEqual(r.errores, [], `${caso.n} [${on}]`);
      cumple(r, on, caso); elegidos++; usados.add(r.model);
    }
  }
  assert.ok(elegidos > 1500 && sinMotor > 0, `${elegidos} elegidos, ${sinMotor} sin motor`);
  assert.ok(usados.size >= 10, [...usados].join());
});

test('con todo encendido: el preferido del preset gana; en catálogo, fidelidad arriba y Muse abajo', () => {
  const models = FILAS.map(m => ({ ...m, on: true }));
  const lista = core.expandir(['cat-web-panaclaw'], C.presets).lista;
  const r = core.modelosPara(lista, models, id => capsOf(id), { kind: 'image', modo: 'foto' });
  assert.equal(r[0].id, 'nano-banana-pro');
  assert.match(r[0].porque, /de los preferidos/);
  const muse = r.findIndex(x => x.id === 'muse-image'), gpt = r.findIndex(x => x.id === 'gpt-image-1');
  assert.ok(muse > gpt, 'Muse por debajo de GPT Image en catálogo');
  assert.ok(r.filter(x => x.on).every(x => capsOf(x.id).editar), 'sobre tu foto, solo los que editan');
  const noEdita = r.find(x => x.id === 'soul-2');
  assert.equal(noEdita.on, false); assert.match(noEdita.motivo, /no edita fotos/);
  // solo Meta encendido: Muse es el único y sale (con su aviso en el «porqué»)
  const soloMeta = core.modelosPara(lista, FILAS.map(m => ({ ...m, on: m.engine === 'meta' })), id => capsOf(id), { kind: 'image', modo: 'foto' });
  assert.equal(soloMeta[0].id, 'muse-image'); assert.equal(soloMeta[0].on, true);
  assert.match(soloMeta[0].porque, /en catálogo va al final/);
});

test('las reglas fijas: Kontext una imagen, Veo sin 1:1, Seedance no junta fotogramas y referencias', () => {
  const models = FILAS.map(m => ({ ...m, on: true }));
  const caps = id => capsOf(id);
  const ref = core.modelosPara(core.expandir(['ref-estilo'], C.presets).lista, models, caps, { kind: 'image', modo: 'foto+ref', nImagenes: 2 });
  assert.equal(ref.find(x => x.id === 'flux-kontext').on, false);
  const v = core.modelosPara(core.expandir(['cam-orbita'], C.presets).lista, models, caps, { kind: 'video', modo: 'anima', proporcion: '1:1' });
  for (const x of v.filter(x => /^veo-/.test(x.id))) { assert.equal(x.on, false); assert.match(x.motivo, /no hace 1:1/); }
  const sr = core.modelosPara(core.expandir(['cam-orbita'], C.presets).lista, models, caps, { kind: 'video', modo: 'anima', refs: 1 });
  const seed = sr.find(x => x.id === 'seedance-2');
  assert.equal(seed.on, false); assert.match(seed.motivo, /no junta foto de partida y referencias/);
  // sin caps (la página): se derivan de la fila igual que capsOf
  for (const m of FILAS) {
    const a = core.capsDeFila({ ...m }), b = capsOf(m.id);
    for (const k of ['kind', 'familia', 'editar', 'maxRefs', 'start', 'end', 'video', 'transparencia', 'maxPrompt']) assert.deepEqual(a[k], b[k], `${m.id}.${k}`);
    assert.deepEqual(a.proporciones, b.proporciones, m.id);
  }
});

test('«Más barato» y los lotes grandes bajan por costo; la prueba gratis siempre al final', () => {
  const models = FILAS.map(m => ({ ...m, on: true }));
  const lista = core.expandir(['limp-polvo'], C.presets).lista;
  const normal = core.modelosPara(lista, models, id => capsOf(id), { kind: 'image', modo: 'foto' });
  const barato = core.modelosPara(lista, models, id => capsOf(id), { kind: 'image', modo: 'foto', orden: 'barato' });
  const costo = id => capsOf(id).costo;
  assert.ok(costo(barato[0].id) <= costo(normal[0].id));
  const cero = core.modelosPara(core.expandir(['esc-podio'], C.presets).lista, models, id => capsOf(id), { kind: 'image', modo: 'cero' });
  assert.equal(cero.filter(x => x.on).at(-1).id, 'prueba');
});

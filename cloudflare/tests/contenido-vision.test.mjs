// «✨ Mejorar con Marketing» en la nube MIRA las fotos de la pieza y unos cuadros de sus videos (28 oct 2026). Lo puro (el prompt, el reparto de fotogramas) está en tests/contenido-vision.test.mjs
// y tests/vision-copia.test.mjs; aquí, el Worker de verdad con una API de Claude de mentira: qué recibe el modelo, qué pasa con un modelo que no ve, los topes del cuerpo y los permisos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar } from './contenido-ayudas.mjs';
import { manejar } from '../worker/lib/rutas.js';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64');
const RESPUESTA = '{"texto":"Ven por tu examen visual gratis.","porque":"Partí de la foto.","vi":"Una mesa con lentes y un letrero de examen gratis"}';

/** Un Worker con la API de Claude (y la de Meta) de mentira que apunta lo que recibe. */
async function mundo({ rol = 'admin', muse = false } = {}) {
  const t = await montar({ meta: false, rol, env: { ANTHROPIC_API_KEY: 'sk-ant-prueba-0123456789', META_API_KEY: 'meta-prueba-0123456789' } }); // secrets-ok: llaves de mentira
  const pedidos = [];
  t.env.AO_FETCH = async (u, init) => {
    pedidos.push({ url: String(u), cuerpo: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text: RESPUESTA }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  if (muse) { const g = await t.api('/api/modelos'); const ajustes = g.datos.ajustes; ajustes.funciones = { ...(ajustes.funciones || {}), redactar: 'muse-spark-1.3' }; assert.equal((await t.api('/api/modelos', { metodo: 'PUT', cuerpo: { ajustes } })).status, 200); }
  return { t, pedidos };
}
const PEDIDO = { pieza: { titulo: 'Examen', texto: '', redes: ['instagram'], medios: ['2026-10/mesa.jpg', '2026-10/reel.mp4'] }, red: 'instagram',
  vision: [{ file: '2026-10/mesa.jpg', media_type: 'image/jpeg', data: JPG }, { file: '2026-10/reel.mp4', cuadro: 3.2, media_type: 'image/jpeg', data: JPG }], sinLeer: [{ file: '2026-10/viejo.gif', motivo: 'no es una foto' }], omitidos: 0 };

test('nube: Claude RECIBE las imágenes antes del texto, el prompt las enumera y la respuesta dice lo que miró; el costo se apunta', { skip: SALTAR }, async () => {
  const { t, pedidos } = await mundo();
  const r = await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: PEDIDO }); assert.equal(r.status, 200, JSON.stringify(r.datos));
  assert.deepEqual([r.datos.vio, r.datos.miro, r.datos.vi, r.datos.texto], [2, '1 foto y 1 cuadro de un video', 'Una mesa con lentes y un letrero de examen gratis', 'Ven por tu examen visual gratis.']);
  assert.equal(r.datos.sinVer, undefined);
  const c = pedidos.at(-1).cuerpo.messages[0].content; assert.ok(Array.isArray(c));
  assert.deepEqual(c.map(x => x.type), ['image', 'image', 'text']); assert.deepEqual(c[0].source, { type: 'base64', media_type: 'image/jpeg', data: JPG });
  assert.deepEqual(Object.keys(c[0]).sort(), ['source', 'type'], 'ni el nombre del archivo ni el segundo viajan en el bloque de imagen');
  assert.match(c[2].text, /imagen 1: la foto «mesa\.jpg» · imagen 2: un cuadro del video «reel\.mp4» \(segundo 3,2\)/); assert.match(c[2].text, /NO pudiste mirar: «viejo\.gif»/);
  assert.match(JSON.stringify(pedidos.at(-1).cuerpo.system), /IMÁGENES \(van antes del texto/);
  assert.ok(t.d1._db.prepare("select count(*) n from costos where tipo = 'redactar'").get().n >= 1, 'el gasto de mirar y escribir queda en el libro');
});

test('nube: sin imágenes la petición y la respuesta son las de siempre (el mensaje es un texto, sin «vio»)', { skip: SALTAR }, async () => {
  const { t, pedidos } = await mundo();
  const r = await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: { pieza: { titulo: 'x', texto: 'agenda examen', redes: ['instagram'] }, red: 'instagram' } }); assert.equal(r.status, 200);
  assert.equal(typeof pedidos.at(-1).cuerpo.messages[0].content, 'string'); assert.deepEqual(Object.keys(r.datos).sort(), ['agente', 'porque', 'red', 'texto', 'vi'], 'el modelo puede contestar «vi»; vio y miro no aparecen si no se le enseñó nada');
});

test('nube: con un modelo que no mira imágenes (Meta Muse Spark) NO se manda ninguna, se dice por qué y se apunta qué archivos quedaron sin mirar', { skip: SALTAR }, async () => {
  const { t, pedidos } = await mundo({ muse: true });
  const r = await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: { ...PEDIDO, pieza: { ...PEDIDO.pieza, texto: 'Ven por tu examen' } } }); assert.equal(r.status, 200, JSON.stringify(r.datos));
  assert.equal(r.datos.vio, 0); assert.match(r.datos.sinVer, /muse-spark-1\.3.*no mira imágenes.*Ajustes → Modelos/);
  const enviado = JSON.stringify(pedidos.at(-1).cuerpo); assert.ok(!/"type":"image"|base64/.test(enviado), 'ni un byte de imagen llega a un modelo que no la ve');
  assert.match(enviado, /NO pudiste mirar: .*«mesa\.jpg»: tu modelo no mira imágenes/);
});

test('nube: solo imágenes (sin título, notas ni texto) basta para partir; sin nada, lo dice; una imagen que miente o un exceso se rechaza en palabras', { skip: SALTAR }, async () => {
  const { t } = await mundo();
  assert.equal((await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: { pieza: { redes: ['instagram'] }, vision: PEDIDO.vision.slice(0, 1) } })).status, 200);
  assert.match((await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: { pieza: {} } })).datos.error, /escribe algo primero.*una foto o un video/);
  for (const mala of [[{ media_type: 'image/gif', data: JPG }], [{ media_type: 'image/png', data: JPG }], [{ media_type: 'image/jpeg', data: 'no es base64!' }], Array(5).fill(PEDIDO.vision[0])]) {
    const r = await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: { pieza: { texto: 'hola' }, vision: mala } }); assert.equal(r.status, 400, JSON.stringify(mala).slice(0, 80)); assert.ok(r.datos.error);
  }
});

test('nube: el cuerpo de «Mejorar» admite las 4 imágenes (más que el 1 MB de las demás rutas) y ni un byte más', { skip: SALTAR }, async () => {
  const { t } = await mundo();
  // el cuerpo se mide por su content-length ANTES de leerlo (como siempre): una petición con ese encabezado grande llega a medias
  const llamar = (ruta, largo) => manejar(new Request(`https://oficina.test${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: t.cookie, 'content-length': String(largo) }, body: JSON.stringify({ pieza: { texto: 'hola' } }) }), t.env);
  assert.equal((await llamar('/api/contenido/mejorar', 6_500_000)).status, 200, '6,5 MB caben en «Mejorar»');
  assert.equal((await llamar('/api/contenido/mejorar', 9_000_000)).status, 413);
  assert.equal((await llamar('/api/contenido/piezas', 2_000_000)).status, 413, 'las demás rutas siguen en 1 MB');
});

test('nube: pedir la propuesta es de un administrador (un editor y un lector, no) y nada se guarda', { skip: SALTAR }, async () => {
  for (const rol of ['editor', 'lectura']) {
    const { t, pedidos } = await mundo({ rol });
    const r = await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: PEDIDO }); assert.equal(r.status, 403, rol); assert.equal(pedidos.length, 0, 'ni se llamó al modelo');
  }
  const { t } = await mundo(); const antes = (await t.api('/api/contenido')).datos.piezas.length;
  await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: PEDIDO }); assert.equal((await t.api('/api/contenido')).datos.piezas.length, antes);
});

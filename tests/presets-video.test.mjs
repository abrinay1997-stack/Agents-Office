// Banco de presets, F5 adelantada (solo datos y compilador): los presets de VIDEO de presets/video/ y el soporte de video
// de src/presets-core.js y src/escena3d-core.js (docs/propuesta-banco-presets.md §3.3, §5.2, §5.4, §5.6, §5.8 y §16.2).
// Ejes exclusivos de cámara, plano, look, formato y sonido; un movimiento por clip; el giro 360 y los objetos rígidos;
// el bucle (inicial = final); antes → después con dos fotogramas; la referencia por ejes en video; los roles de media.mjs
// (start, end, reference, video); capsOf por modelo; el escenario 3D con el movimiento del preset; el buscador.
// Sin red ni keys: los modelos son las filas del catálogo de verdad con la key «puesta» a mano.
// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/presets-core.js';
import * as e3d from '../src/escena3d-core.js';
import { buscar } from '../src/presets-buscar.js';
import { cargarFabrica, cuentas } from '../presets/fabrica.mjs';
import { ctxDe, validarPreset, servible } from '../presets/validar.mjs';
import { encontrar } from '../presets/indice.mjs';
import { models as filas, capsOf, model as modelo, hfRoute, settingsFor, allModels, ENGINES } from '../media/catalogo.mjs';

const fab = cargarFabrica();
const ctx = ctxDe(fab);
const byId = ctx.byId;
const VIDEO = fab.presets.filter(p => p.medios[0] === 'video');
const FILAS = filas();
const todos = FILAS.map(m => ({ ...m, on: true }));
const base = { byId: fab.presets, models: todos, caps: id => capsOf(id), familias: fab.familias, tipos: fab.tipos, canales: fab.canales, kind: 'video' };
const compila = o => core.compilar({ ...base, ...o });
const FOTO = '2026-10/cafetera.jpg', FOTO2 = '2026-10/cafetera-limpia.jpg', REF = '2026-10/look.jpg', REF2 = '2026-10/modelo.jpg', CLIP = '2026-10/clip.mp4';
const textos = r => r.avisos.map(a => a.texto).join('\n');
const caps = allModels().map(m => ({ ...capsOf(m), ajustes: Object.keys(m.settings || {}) }));

/** Lo mismo que media.submit comprobaría antes de gastar (como tests/presets-modelo.test.mjs). */
function cumple(r, donde) {
  const m = modelo(r.model), req = r.request;
  assert.equal(m.kind, 'video', donde);
  assert.ok(!m.legacy, `${donde}: nunca uno «legacy»`);
  for (const [rol, ids] of Object.entries(req.media)) assert.ok(ids.length <= (m.roles?.[rol] || 0), `${donde}: ${rol} ${ids.length} > ${m.roles?.[rol] || 0}`);
  for (const nd of m.needs || []) assert.ok(req.media[nd]?.length, `${donde}: necesita ${nd}`);
  if (m.routes) assert.doesNotThrow(() => hfRoute(m, Object.fromEntries(Object.entries(req.media).map(([k, v]) => [k, v.length]))), donde);
  const s = settingsFor(m, req.settings);
  for (const [k, v] of Object.entries(req.settings)) assert.deepEqual(s[k], v, `${donde}: ajuste ${k}=${v} válido para el modelo`);
  if (/^veo-/.test(m.id)) assert.notEqual(req.settings.aspectRatio, '1:1', `${donde}: Veo nunca 1:1`);
  if (req.settings.aspectRatio) assert.ok(m.settings.aspectRatio.values.includes(req.settings.aspectRatio), donde);
  assert.ok(req.prompt.length <= (m.maxPrompt || 4000) && req.prompt.length <= (fab.familias[r.familia]?.max || 4000), `${donde}: el prompt cabe`);
  assert.doesNotMatch(req.prompt, /\{\w+\}|\s,|\.\./, `${donde}: sin huecos ni comas sueltas: ${req.prompt}`);
}
/** Las entradas mínimas que pide un preset (su foto, su referencia, su video…), para compilarlo solo. */
function entradasDe(p) {
  const e = {};
  for (const en of p.entradas) {
    if (!en.min) continue;
    if (en.rol === 'inicial' || en.rol === 'sujeto') e.inicial = FOTO;
    if (en.rol === 'final') e.final = FOTO2;
    if (en.rol === 'origen') e.origen = CLIP;
    if (en.rol === 'guia') e.guia = CLIP;
    if (en.rol === 'referencia') (e.referencias ||= []).push(e.referencias?.length ? REF2 : REF);
  }
  if (!Object.keys(e).length && p.modos.includes('anima')) e.inicial = FOTO;
  if (!Object.keys(e).length && p.modos.every(m => m === 'refs')) e.referencias = [REF];
  return e;
}

/* ---------- los datos ---------- */
test('los 53 presets de video: fase 5, beta, válidos, con icono del catálogo, sinónimos y algún modelo que los sirva', () => {
  assert.equal(cuentas(fab.presets).video, 53);
  const grupos = new Set(fab.grupos.filter(g => g.medio === 'video').map(g => g.id));
  assert.deepEqual([...grupos].sort(), ['camara', 'look', 'plano', 'veditar', 'vformato', 'vproducto', 'vsonido']);
  for (const g of grupos) assert.ok(VIDEO.some(p => p.categoria === g), `el grupo «${g}» está vacío`);
  for (const p of VIDEO) {
    assert.deepEqual(validarPreset(p, ctx), [], p.id);
    assert.equal(p.fase, 5, p.id); assert.equal(p.estado, 'beta', p.id);
    assert.equal(p.icono.d, fab.iconos[p.icono.id], `${p.id}: icono del catálogo`);
    assert.ok(p.buscar.length >= 3, `${p.id}: sinónimos`);
    const s = servible(p, caps);
    assert.ok(s.ok, `${p.id}: ${s.motivo}`);
    for (const m of p.prefer) assert.equal(capsOf(m)?.kind, 'video', `${p.id}: prefer «${m}»`);
  }
});

test('el esquema de video dice en frases lo que está mal (ranura, bucle, fotogramas, ajustes del modelo)', () => {
  const copia = id => structuredClone(byId.get(id));
  const cam = copia('cam-acercar'); cam.ranura = 'look'; cam.ajustesModelo = { cameraMovement: ['dolly-{p.nada}'], aspectRatio: 'ancho', duration: 'mucho', generateAudio: 'si' };
  const s = validarPreset(cam, ctx).join('\n');
  for (const re of [/un ajuste de camara va en la ranura «camara» \(tiene «look»\)/, /«\{p\.nada\}» no es un parámetro/, /aspectRatio «ancho» no es «ancho:alto»/, /duration es un número/, /generateAudio es true o false/]) assert.match(s, re);
  const img = structuredClone(byId.get('fondo-gris')); img.bucle = true; img.soloRigidos = true; img.parametros.push({ id: 'x', tipo: 'texto', es: 'X', def: '', ranura: 'sfx' });
  const si = validarPreset(img, ctx).join('\n');
  assert.match(si, /bucle: solo en un preset de video/); assert.match(si, /soloRigidos: solo en un preset de video/); assert.match(si, /«ranura» solo en video/);
  const ab = copia('vp-antes-despues'); ab.modos = ['anima'];
  assert.match(validarPreset(ab, ctx).join('\n'), /pide la foto de llegada \(final\): lleva el modo «ab»/);
  const ed = copia('ved-alargar'); ed.modos = ['anima']; ed.requiere = { roles: { audio: 1 } };
  const se = validarPreset(ed, ctx).join('\n');
  assert.match(se, /trabaja sobre un video: lleva el modo «video»/); assert.match(se, /rol «audio» desconocido/);
});

test('cada movimiento de cámara habla en su hueco, con su frase por intensidad y su movimiento para los modelos que lo eligen', () => {
  const cams = VIDEO.filter(p => p.categoria === 'camara');
  assert.equal(cams.length, 15);
  for (const p of cams) {
    assert.equal(p.ranura, 'camara', p.id); assert.ok(p.exclusivo, p.id); assert.deepEqual(p.ejes, ['camara'], p.id);
    if (p.id !== 'cam-fija') for (const k of ['suave', 'normal', 'fuerte']) assert.ok(p.iaPorIntensidad?.[k], `${p.id}: ${k}`);
  }
  for (const p of VIDEO.filter(p => p.categoria === 'plano')) assert.equal(p.ranura, 'plano', p.id);
  // la intensidad cambia la frase, no le pega «subtly» delante
  const suave = compila({ pila: [{ id: 'cam-acercar', params: { intensidad: 'suave' } }], idea: 'a lamp', model: 'kling-3-std' });
  assert.match(suave.prompt, /Camera: very slow, subtle push in toward the subject\./);
  const fuerte = compila({ pila: [{ id: 'cam-acercar', params: { intensidad: 'fuerte' } }], idea: 'a lamp', model: 'kling-3-std' });
  assert.match(fuerte.prompt, /fast, dramatic push in/);
});

test('las recetas de producto: su acción en palabras y su cámara (o su plano) como ajuste aparte, sin decir «camera» dos veces', () => {
  const recetas = VIDEO.filter(p => p.capa === 'receta');
  assert.equal(recetas.length, 13);
  for (const p of recetas) {
    const cams = (p.incluye || []).filter(id => byId.get(id).categoria === 'camara');
    assert.ok(cams.length <= 1, `${p.id}: un movimiento por clip`);
    if (cams.length) { assert.ok(p.ejes.includes('camara'), p.id); assert.doesNotMatch(p.ia, /camera (locked|drifts|moves|static)|locked-off|push in|pull back|\bpan\b|orbit|crane|dolly|slider/i, `${p.id}: la cámara la dice su ajuste`); }
  }
  assert.deepEqual(byId.get('vp-giro-360').incluye, ['cam-fija']);
  assert.deepEqual(byId.get('vp-heroe').incluye, ['cam-acercar']);
  const r = compila({ pila: ['vp-heroe'], entradas: { foto: FOTO }, model: 'kling-3-std' });
  assert.match(r.prompt, /^Cinematic hero shot of the product while a soft light sweeps slowly across it\. Camera: slow push in toward the subject\.$/);
});

/* ---------- ejes exclusivos: un movimiento, un plano, un look, un formato y un sonido por clip ---------- */
test('ejes exclusivos de video: el último gana y se avisa con DESHACER («Cámara: … sustituyó a …»)', () => {
  assert.deepEqual(core.EJES_VIDEO, ['camara', 'plano', 'look', 'formato', 'audio']);
  for (const e of core.EJES_VIDEO) assert.ok(core.EJES_EXCLUSIVOS.includes(e), e);
  const pares = { camara: ['cam-acercar', 'cam-orbita'], plano: ['pla-detalle', 'pla-general'], look: ['look-cine', 'look-bn'], formato: ['vf-reel', 'vf-youtube'], audio: ['vs-ambiente', 'vs-mudo'] };
  for (const [eje, [a, b]] of Object.entries(pares)) {
    const { lista, avisos } = core.expandir([a, b], fab.presets);
    assert.deepEqual(lista.map(x => x.id), [b], eje);
    const av = avisos.find(x => x.tipo === 'sustituye');
    assert.equal(av.eje, eje); assert.equal(av.gana, b); assert.equal(av.pierde, a);
  }
  assert.match(core.expandir(['cam-acercar', 'cam-orbita'], fab.presets).avisos[0].texto, /^Cámara: «Vuelta completa alrededor» sustituyó a «La cámara se acerca»$/);
  assert.match(core.expandir(['vs-ambiente', 'vs-mudo'], fab.presets).avisos[0].texto, /^Sonido: /);
  // un solo movimiento llega al prompt
  const r = compila({ pila: ['cam-acercar', 'cam-orbita', 'look-cine'], idea: 'a lamp', model: 'kling-3-std' });
  assert.match(r.prompt, /Camera: full 360-degree orbit around the subject\./);
  assert.doesNotMatch(r.prompt, /push in/);
  // se suman los ejes que no son exclusivos: un look y una cámara conviven
  assert.match(r.prompt, /cinematic grade/i);
});

test('un movimiento por clip: el giro 360 con otra cámara que se mueve lo avisa; sin cámara, Kling recibe «static camera»', () => {
  const r = compila({ pila: ['vp-giro-360', 'cam-orbita'], entradas: { foto: FOTO }, model: 'kling-3-std' });
  assert.deepEqual(r.errores, []);
  assert.match(textos(r), /Cámara: «Vuelta completa alrededor» sustituyó a «Cámara quieta»/);
  assert.match(textos(r), /«Giro 360 de catálogo» ya mueve el producto: con «Vuelta completa alrededor» también se mueve la cámara/);
  assert.match(r.prompt, /Camera: full 360-degree orbit around the subject\./);
  assert.doesNotMatch(r.prompt, /static/);
  // la receta que trae su propia cámara (el héroe se acerca) y otra cámara: solo la sustitución, sin el aviso de dos movimientos
  const h = compila({ pila: ['vp-heroe', 'cam-orbita'], entradas: { foto: FOTO }, model: 'kling-3-std' });
  assert.doesNotMatch(textos(h), /ya mueve el producto/);
  const fija = compila({ pila: ['look-cine'], idea: 'a lamp', model: 'kling-3-std' });
  assert.match(fija.prompt, /Camera: static camera\./);
  const veo = compila({ pila: ['look-cine'], idea: 'a lamp', model: 'veo-3.1-fast' });
  assert.doesNotMatch(veo.prompt, /static camera/, 'en Veo la cámara fija no se inventa');
});

/* ---------- el giro 360 y los objetos rígidos ---------- */
test('giro 360: anima tu foto (start), avisa siempre de los objetos rígidos y más fuerte si el producto es tela, vidrio o un colchón', () => {
  const r = compila({ pila: ['vp-giro-360'], entradas: { foto: FOTO }, producto: 'Cafetera roja', model: 'kling-3-std' });
  assert.deepEqual(r.errores, []);
  assert.equal(r.modo, 'anima'); assert.deepEqual(r.request.media, { start: [FOTO] });
  assert.match(r.prompt, /^Cafetera roja is a rigid object and makes a slow 360-degree turntable rotation/);
  assert.match(r.prompt, /Camera: static locked-off camera\./);
  assert.match(textos(r), /«Giro 360 de catálogo»: Telas, vidrio y piezas finas pueden deformarse/);
  assert.ok(!r.avisos.some(a => a.tipo === 'rigido'), 'una cafetera es rígida');
  for (const [producto, idea] of [['Sábana blanca', ''], ['', 'una copa de vidrio sobre la mesa'], ['Colchón ortopédico', '']]) {
    const b = compila({ pila: ['vp-giro-360'], entradas: { foto: FOTO }, producto, idea, model: 'kling-3-std' });
    const a = b.avisos.find(x => x.tipo === 'rigido');
    assert.ok(a, producto || idea); assert.match(a.texto, /va con objetos rígidos: «\w+» suele deformarse al girar/);
  }
  assert.ok(core.BLANDO_RE.test('sabanas') && !core.BLANDO_RE.test('cafetera') && !core.BLANDO_RE.test('televisor'));
  // la duración del preset: Kling hace de 3 a 15 s; Veo, 4, 6 u 8: la más cercana y se dice
  assert.equal(r.request.settings.duration, 5);
  const veo = compila({ pila: ['vp-giro-360'], entradas: { foto: FOTO }, model: 'veo-3.1-fast' });
  assert.equal(veo.request.settings.duration, '6');
  assert.match(textos(veo), /no hace 5 s: lo pido en 6 s/);
});

/* ---------- el bucle ---------- */
test('bucle: la foto final es la inicial, se pone sola; una foto de llegada distinta no se usa y se dice', () => {
  const r = compila({ pila: ['vp-bucle-web'], entradas: { foto: FOTO } });
  assert.deepEqual(r.errores, []);
  assert.equal(r.modo, 'ab');
  assert.deepEqual(r.request.media.start, [FOTO]); assert.deepEqual(r.request.media.end, [FOTO]);
  assert.ok(capsOf(r.model).end, `${r.model} toma la foto final`);
  assert.match(r.prompt, /last frame is identical to the first/);
  assert.ok(r.pasos_es.includes('Bucle: la misma foto al principio y al final'));
  const otra = compila({ pila: ['vp-bucle-web'], entradas: { inicial: FOTO, final: FOTO2 } });
  assert.deepEqual(otra.request.media.end, [FOTO]);
  assert.match(textos(otra), /termina en la misma foto en que empieza: no uso la de llegada/);
  // la portada web en bucle también, y sin sonido
  const p = compila({ pila: ['vf-portada-web'], entradas: { foto: FOTO }, model: 'kling-3-std' });
  assert.deepEqual(p.request.media, { start: [FOTO], end: [FOTO] });
  assert.equal(p.request.settings.sound, false); assert.equal(p.request.settings.aspectRatio, '16:9');
  // un modelo sin foto final no puede con el bucle de la web
  const turbo = compila({ pila: ['vp-bucle-web'], entradas: { foto: FOTO }, model: 'kling-3-turbo' });
  assert.match(turbo.errores[0], /no toma foto de llegada/);
});

/* ---------- antes → después ---------- */
test('antes → después: dos fotogramas (start y end), con dos fotos o con inicial y final; con una sola, lo pide', () => {
  const dos = compila({ pila: ['vp-antes-despues'], entradas: { foto: [FOTO, FOTO2] } });
  assert.deepEqual(dos.errores, []);
  assert.equal(dos.modo, 'ab');
  assert.deepEqual(dos.request.media, { start: [FOTO], end: [FOTO2] });
  assert.match(dos.prompt, /from the first frame \(before\) to the last frame \(after\)/);
  assert.ok(dos.pasos_es.includes('De la foto de partida a la de llegada'));
  const ini = compila({ pila: ['vp-antes-despues'], entradas: { inicial: FOTO, final: FOTO2 } });
  assert.deepEqual(ini.request.media, dos.request.media);
  const una = compila({ pila: ['vp-antes-despues'], entradas: { foto: FOTO } });
  assert.ok(una.errores.some(e => /necesita la foto de partida y la de llegada|necesita: Foto de después/.test(e)), una.errores.join());
  // dos fotos con un preset que solo anima: va la primera y se dice
  const anima = compila({ pila: ['vp-heroe'], entradas: { foto: [FOTO, FOTO2] } });
  assert.deepEqual(anima.request.media, { start: [FOTO] });
  assert.match(textos(anima), /Va una foto de partida por clip: uso la primera/);
  for (const m of servible(byId.get('vp-antes-despues'), caps).modelos) assert.ok(capsOf(m).start && capsOf(m).end, m);
});

/* ---------- la referencia por ejes en video (§5.4) ---------- */
test('referencias en video: tu producto tal cual, la persona, el empaque y el look; el color va a la IA (sin ffmpeg)', () => {
  const u = compila({ pila: ['vp-unboxing'], entradas: { referencias: [FOTO], extra: '2026-10/caja.jpg' } });
  assert.deepEqual(u.errores, []);
  assert.equal(u.modo, 'refs');
  assert.deepEqual(u.request.media.reference, [FOTO, '2026-10/caja.jpg']);
  assert.match(u.prompt, /Reference image 1 is the product: it must look exactly the same \(shape, proportions, colors, label and logos\)\. Reference image 2 is the packaging\./);
  assert.ok(u.pasos_es.includes('Referencia 1: tu producto, tal cual'));
  assert.ok(!u.avisos.some(a => /necesita tu foto/.test(a.texto)), 'en video la referencia de producto ES tu producto');
  // el probador: la 1.ª es la prenda y la 2.ª la persona (cada referencia, la de su entrada)
  const p = compila({ pila: ['vp-probador'], entradas: { referencias: [FOTO, REF2] } });
  assert.match(p.prompt, /Reference image 1 is the product: .*Reference image 2 is the person: keep the same face, body and look\./);
  assert.ok(!p.avisos.some(a => /pose solo sirve/.test(a.texto)));
  // ejes elegidos en la interfaz: estilo y color, sin copiar objetos; nunca una operación local de color en video
  const e = compila({ pila: ['cam-acercar'], idea: 'a lamp on a desk', entradas: { referencias: [{ id: REF, ejes: { estilo: 2, color: 3 } }] }, model: 'kling-o3' });
  assert.deepEqual(e.request.media.reference, [REF]);
  assert.match(e.prompt, /Use reference image 1 only for its visual style and color grade, closely matching it; do not copy its objects, people, products, text, logos or brand names\./);
  assert.deepEqual(e.local, { antes: [], despues: [] });
  assert.ok(e.pasos_es.some(x => /color \/ LUT fuerte$/.test(x)), 'sin «(aquí, sin IA)»');
  // copiar el look con tu foto de partida: solo los que juntan fotograma y referencias (Kling O3, Grok); Seedance no
  const l = compila({ pila: ['look-ref'], entradas: { foto: FOTO, referencias: [REF] } });
  assert.deepEqual(l.errores, []);
  assert.ok(capsOf(l.model).refYFotogramas, l.model);
  assert.deepEqual(l.request.media, { start: [FOTO], reference: [REF] });
  assert.match(l.prompt, /color grade and mood following the reference image/i);
  const sd = compila({ pila: ['look-ref'], entradas: { foto: FOTO, referencias: [REF] }, model: 'seedance-2' });
  assert.match(sd.errores[0], /no junta foto de partida y referencias/);
});

/* ---------- los roles de media.mjs ---------- */
test('roles: start (tu foto), end (la de llegada), video (tu video o la guía) y reference; versionOf solo de lo que se edita', () => {
  const ed = compila({ pila: ['ved-cambiar-fondo'], entradas: { origen: CLIP } });
  assert.equal(ed.modo, 'video'); assert.deepEqual(ed.request.media.video, [CLIP]); assert.equal(ed.request.versionOf, CLIP);
  assert.match(ed.prompt, /replace the background with un estudio blanco/i);
  assert.doesNotMatch(ed.prompt, /static camera/, 'editar un video no inventa una cámara fija');
  const mov = compila({ pila: ['ved-copiar-movimiento'], entradas: { foto: FOTO, guia: CLIP } });
  assert.deepEqual(mov.errores, []);
  assert.equal(mov.modo, 'video');
  assert.deepEqual(mov.request.media, { video: [CLIP], start: [FOTO] });
  assert.equal(mov.request.versionOf, undefined, 'la guía no es tu video');
  assert.match(mov.model, /motion/);
  assert.equal(core.modoDe({ guia: CLIP, foto: FOTO }, 'video'), 'video');
  const al = compila({ pila: ['ved-alargar'], entradas: { origen: CLIP } });
  assert.equal(al.model, 'seedance-2.5-extend'); assert.deepEqual(al.request.media.video, [CLIP]);
  // Genjutsu necesita una referencia: sin ella no se elige
  const sinRef = core.modelosPara(core.expandir(['ved-estilo'], fab.presets).lista, todos, id => capsOf(id), { kind: 'video', modo: 'video' });
  assert.match(sinRef.find(x => x.id === 'genjutsu-swap').motivo, /necesita una imagen de referencia/);
  const conRef = core.modelosPara(core.expandir(['ved-estilo'], fab.presets).lista, todos, id => capsOf(id), { kind: 'video', modo: 'video', refs: 1 });
  assert.ok(conRef.find(x => x.id === 'genjutsu-swap').on);
});

/* ---------- capsOf por modelo de video ---------- */
test('capsOf por modelo de video (de roles, needs y settings) y cómo hace sonido cada uno', () => {
  const espera = {
    'veo-3.1': { start: true, end: true, maxRefs: 3, refYFotogramas: false, uno: false, audio: 'siempre' },
    'veo-3.1-fast': { start: true, end: true, maxRefs: 0, uno: false, audio: 'siempre' },
    'kling-3-std': { start: true, end: true, maxRefs: 0, uno: true, audio: 'sound' },
    'kling-3-turbo': { start: true, end: false, uno: true, audio: 'no' },
    'kling-o3': { start: true, end: true, maxRefs: 8, refYFotogramas: true, video: true, audio: 'sound' },
    'seedance-2': { start: true, end: true, maxRefs: 9, refYFotogramas: false, video: true, audio: 'generateAudio' },
    'seedance-2.5': { start: true, end: true, maxRefs: 30, audio: 'generateAudio' },
    'mmx-h3': { start: true, end: true, maxRefs: 9, audio: 'no' },
    'minimax-hailuo-2.3': { start: true, end: false, audio: 'no' },
    'wan-3': { start: true, end: true, maxRefs: 10, audio: 'generateAudio' },
    'kling-3-motion': { start: true, video: true, audio: 'no' },
    'genjutsu-swap': { start: false, video: true, audio: 'no' },
  };
  for (const [id, e] of Object.entries(espera)) {
    const c = capsOf(id), fila = FILAS.find(m => m.id === id);
    for (const k of ['start', 'end', 'maxRefs', 'refYFotogramas', 'video']) if (k in e) assert.equal(c[k], e[k], `${id}.${k}`);
    if ('uno' in e) assert.equal(c.proporciones.includes('1:1'), e.uno, `${id} 1:1`);
    assert.equal(core.audioDe(fila, c.familia), e.audio, `${id}: sonido`);
    assert.equal(c.familia, core.familiaDe(id), id);
  }
  for (const m of FILAS.filter(m => m.kind === 'video' && !m.legacy)) assert.ok(['veo', 'kling', 'seedance', 'minimax-video', 'video-generico'].includes(capsOf(m.id).familia), m.id);
  assert.equal(core.audioDe(FILAS.find(m => m.id === 'nano-banana-2')), 'no', 'una imagen no hace sonido');
});

test('formato y sonido con el ajuste de cada modelo: 4:5 → 3:4 (sin Veo), la duración más cercana, sound en Kling, mudo donde no hay', () => {
  const f = compila({ pila: ['cam-acercar', 'vf-feed'], idea: 'a lamp' });
  assert.deepEqual(f.errores, []);
  assert.equal(f.request.settings.aspectRatio, '3:4');
  assert.notEqual(f.familia, 'veo');
  assert.match(textos(f), /no hace 4:5: lo pido en 3:4/);
  assert.match(byId.get('vf-feed').honestidad, /3:4/);
  const cuad = compila({ pila: ['vf-cuadrado'], idea: 'a lamp', model: 'veo-3.1' });
  assert.match(cuad.errores[0], /no hace 1:1/);
  const yt = compila({ pila: ['vf-youtube'], idea: 'a lamp', model: 'veo-3.1-fast' });
  assert.equal(yt.request.settings.duration, '8'); assert.match(textos(yt), /no hace 10 s: lo pido en 8 s/);
  assert.ok(yt.pasos_es.includes('Formato: 16:9 · 8 s'));
  const reel = compila({ pila: ['vf-reel'], idea: 'a lamp', model: 'kling-3-std' });
  assert.deepEqual(reel.request.settings, { aspectRatio: '9:16', duration: 8 });
  // sonido: Kling usa «sound»; Seedance, «generateAudio»; Veo 3.1 siempre; Hailuo, nunca (y el prompt no lo pide)
  const k = compila({ pila: ['vs-ambiente'], idea: 'a bed', model: 'kling-3-std' });
  assert.equal(k.request.settings.sound, true); assert.equal(k.request.settings.generateAudio, undefined);
  assert.match(k.prompt, /Sound: soft fabric rustle\. Ambient noise: quiet room tone, distant birds\./);
  const s = compila({ pila: ['vs-ambiente'], idea: 'a bed', model: 'seedance-2' });
  assert.equal(s.request.settings.generateAudio, true);
  const v = compila({ pila: ['vs-ambiente'], idea: 'a bed', model: 'veo-3.1-fast' });
  assert.match(v.prompt, /\nSFX: soft fabric rustle\nAmbient noise: quiet room tone, distant birds$/);
  assert.deepEqual(Object.keys(v.request.settings), []);
  const h = compila({ pila: ['vs-ambiente'], idea: 'a bed', model: 'minimax-hailuo-2.3' });
  assert.match(textos(h), /no hace sonido: el video sale mudo/); assert.doesNotMatch(h.prompt, /Sound|rustle/);
  const mudoVeo = compila({ pila: ['vs-mudo'], idea: 'a bed', model: 'veo-3.1-fast' });
  assert.match(textos(mudoVeo), /siempre trae sonido: no se puede apagar/);
  // pedir sonido sube a los que lo hacen
  const elegido = compila({ pila: ['vs-ambiente'], idea: 'a bed' });
  assert.notEqual(core.audioDe(FILAS.find(m => m.id === elegido.model)), 'no', elegido.model);
});

test('el movimiento de cámara también como ajuste del modelo, donde lo hay (LTX, Cinema Studio): el primero que admite', () => {
  const ltx = compila({ pila: ['cam-sube'], idea: 'a bed', model: 'ltx-2.5-pro' });
  assert.equal(ltx.request.settings.cameraMovement, 'jib_up');
  const cin = compila({ pila: [{ id: 'cam-lateral', params: { lado: 'derecha' } }], idea: 'a bed', model: 'cinema-studio-4' });
  assert.equal(cin.request.settings.cameraMovement, 'truck-right');
  assert.match(cin.prompt, /lateral dolly move to the right/i);
  const zoom = compila({ pila: ['cam-acercar'], idea: 'a bed', model: 'cinema-studio-4' });
  assert.equal(zoom.request.settings.cameraMovement, 'dolly-in');
  const kl = compila({ pila: ['cam-sube'], idea: 'a bed', model: 'kling-3-std' });
  assert.equal(kl.request.settings.cameraMovement, undefined, 'Kling no tiene ese ajuste: va solo en el texto');
  const orb = compila({ pila: ['cam-orbita'], idea: 'a bed', model: 'ltx-2.5-pro' });
  assert.equal(orb.request.settings.cameraMovement, undefined, 'sin equivalente, nada');
});

/* ---------- el escenario 3D en video (§16.2) ---------- */
const ESC = { producto: { tipo: 'cama-queen', ancho: 160, alto: 50, fondo: 200, giro: 0, elevacion: 0 }, camara: { distancia: 500, azimut: 30, altura: 120, lente: 35 }, cuadro: { proporcion: '9:16' }, fondo: { tipo: 'color', valor: '#FFFFFF' } };
test('escenario 3D en video: dónde empieza la cámara + el movimiento del preset; sustituye al plano; sin imagen guía ni QA', () => {
  const r = compila({ pila: ['cam-acercar', 'pla-detalle'], idea: 'a bed in a bright room', escena: ESC, escena3d: e3d, model: 'kling-3-std' });
  assert.deepEqual(r.errores, []);
  assert.match(textos(r), /Plano: el escenario 3D sustituyó a «De muy cerca»/);
  assert.match(r.prompt, /Shot: three-quarter view from the right, .*35mm/);
  assert.match(r.prompt, /At the start of the shot, camera 5\.1 m away/);
  assert.match(r.prompt, /Camera movement: slow push in toward the subject\./);
  assert.doesNotMatch(r.prompt, /Camera: |static camera|extreme close-up/, 'el movimiento va una vez, dentro del escenario');
  assert.equal(r.request.settings.aspectRatio, '9:16');
  assert.equal(r.guia, null); assert.equal(r.request.media.reference, undefined);
  assert.ok(!r.qa.includes('ocupacion')); assert.equal(r.medir.ocupacion, undefined);
  assert.ok(r.pasos_es.some(p => /^Escenario 3D: 3\/4 derecha · .* al empezar · la cámara se acerca$/.test(p)), r.pasos_es.join(' / '));
  // sin cámara del preset: cámara fija, y el escenario es el cuadro entero
  const fija = compila({ pila: ['look-cine'], idea: 'a bed', escena: ESC, escena3d: e3d, model: 'kling-3-std' });
  assert.match(fija.prompt, /Static camera\./); assert.doesNotMatch(fija.prompt, /start of the shot/);
  // Veo con el escenario en 4:5: no hace 4:5 ni 3:4 → otro modelo
  const veo = compila({ pila: ['cam-acercar'], idea: 'a bed', escena: { ...ESC, cuadro: { proporcion: '4:5' } }, escena3d: e3d, preferencia: { ...core.PREFER_DEF, video: ['veo-3.1-fast', ...core.PREFER_DEF.video] } });
  assert.notEqual(veo.familia, 'veo'); assert.equal(veo.request.settings.aspectRatio, '3:4');
});

test('escena3d-core en video: «al empezar el clip» solo si la cámara se mueve, y el movimiento en español en el resumen', () => {
  assert.ok(e3d.camaraSeMueve('slow push in toward the subject'));
  for (const x of ['static locked-off camera', 'static camera', '', null]) assert.ok(!e3d.camaraSeMueve(x), String(x));
  const m = e3d.describirEscena(ESC, 'kling', { movimiento: 'slow push in toward the subject', movimientoEs: 'la cámara se acerca' });
  assert.match(m.en, /At the start of the shot, camera/); assert.match(m.es, /Al empezar el clip, cámara a/);
  assert.match(m.es, /Movimiento de cámara: la cámara se acerca\./);
  assert.match(m.resumen, / al empezar · la cámara se acerca$/);
  const q = e3d.describirEscena(ESC, 'kling', { movimiento: 'static locked-off camera' });
  assert.doesNotMatch(q.en, /start of the shot/); assert.doesNotMatch(q.resumen, /al empezar/);
  const img = e3d.describirEscena(ESC, 'conversacional', { movimiento: 'slow push in' });
  assert.doesNotMatch(img.en, /start of the shot|Camera movement/, 'en una foto no hay movimiento');
});

/* ---------- cada preset compila solo, y con cada combinación de keys ---------- */
test('cada preset de video compila con sus entradas mínimas, sin errores, y lo que pide pasa lo que comprobaría media.submit', () => {
  for (const p of VIDEO) {
    const r = compila({ pila: [p.id], idea: p.capa === 'receta' || p.categoria === 'veditar' ? '' : 'a ceramic coffee mug on a wooden table', entradas: entradasDe(p) });
    assert.deepEqual(r.errores, [], `${p.id}: ${r.errores.join(' | ')}`);
    assert.ok(r.model, p.id);
    cumple(r, p.id);
    for (const id of p.prefer.slice(0, 3)) {
      const f = compila({ pila: [p.id], idea: 'a mug', entradas: entradasDe(p), model: id });
      if (f.errores.length) assert.match(f.errores.join(), /no puede con esto|no hace|no toma|no junta/, `${p.id} con ${id}`);
      else cumple(f, `${p.id} con ${id}`);
    }
  }
});

test('con cada combinación de motores encendidos, el modelo de video elegido puede de verdad (o dice por qué no hay)', () => {
  const MOTORES = Object.keys(ENGINES);
  const CASOS = [
    { pila: ['vp-giro-360'], entradas: { foto: FOTO } }, { pila: ['vp-bucle-web'], entradas: { foto: FOTO } },
    { pila: ['vp-antes-despues'], entradas: { foto: [FOTO, FOTO2] } }, { pila: ['vp-unboxing'], entradas: { referencias: [FOTO] } },
    { pila: ['cam-orbita', 'vf-feed', 'vs-ambiente'], idea: 'a lamp' }, { pila: ['ved-copiar-movimiento'], entradas: { foto: FOTO, guia: CLIP } },
    { pila: ['look-ref'], entradas: { foto: FOTO, referencias: [REF] } }, { pila: ['cam-acercar'], idea: 'a bed', escena: ESC, escena3d: e3d },
  ];
  let elegidos = 0;
  for (let mask = 0; mask < 1 << MOTORES.length; mask++) {
    const on = MOTORES.filter((_, i) => mask & (1 << i));
    const models = FILAS.map(m => ({ ...m, on: on.includes(m.engine) }));
    for (const c of CASOS) {
      const r = core.compilar({ ...base, models, ...c });
      if (!r.model) { assert.ok(r.errores.length, `${c.pila} [${on}]: sin modelo, dice por qué`); continue; }
      assert.ok(on.includes(modelo(r.model).engine), `${c.pila} [${on}] → ${r.model}`);
      cumple(r, `${c.pila} [${on}] → ${r.model}`); elegidos++;
    }
  }
  assert.ok(elegidos > 100, `elegidos: ${elegidos}`);
});

/* ---------- el buscador ---------- */
test('el buscador encuentra los de video con las palabras del dueño (los dos: el de la interfaz y el de referencia)', () => {
  const frases = [
    ['producto girando', ['vp-giro-360']], ['zoom lento', ['cam-acercar']], ['unboxing', ['vp-unboxing']], ['antes y después', ['vp-antes-despues']],
    ['que dé vueltas', ['cam-orbita', 'vp-giro-360']], ['antes/después', ['vp-antes-despues']], ['abrir la caja', ['vp-unboxing']],
    ['cámara en mano', ['cam-mano']], ['sin sonido', ['vs-mudo']], ['que se repita', ['vp-bucle-web']], ['vista de dron', ['cam-dron']],
    ['copiar movimiento', ['ved-copiar-movimiento']], ['efecto vértigo', ['cam-vertigo']], ['video vertical', ['vf-reel']], ['plato giratorio', ['vp-giro-360']],
  ];
  const malas = [];
  for (const [q, ids] of frases) {
    const a = buscar(q, fab.presets, { medio: 'video' }).slice(0, ids.length).map(r => r.id);
    const b = encontrar(q, fab.presets, { sinonimos: fab.sinonimos, grupos: fab.grupos, medio: 'video', limite: ids.length }).map(r => r.id);
    for (const id of ids) { if (!a.includes(id)) malas.push(`buscar «${q}» → ${a.join(', ')}`); if (!b.includes(id)) malas.push(`encontrar «${q}» → ${b.join(', ')}`); }
  }
  assert.deepEqual(malas, []);
  // en la portada de video salen las estrellas de video
  const portada = buscar('', fab.presets, { medio: 'video' }).map(r => r.id);
  for (const id of ['vp-giro-360', 'cam-acercar', 'cam-orbita']) assert.ok(portada.includes(id), id);
});

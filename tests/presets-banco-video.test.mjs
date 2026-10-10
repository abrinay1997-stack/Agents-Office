// El banco de presets en VIDEO (F5) y las fichas de Voz y Música (F6), 10 oct 2026: lo puro de src/studio-banco-core.js que
// dibuja src/studio-banco.js (el pedido con el material del paso 4, las puertas, la portada, las reglas del clip, el modelo que
// no puede y su sugerencia, las fichas que rellenan ajustes) y el servidor (presets.mjs: compila y aplica kind video, guarda una
// receta de video). Sin red ni keys: los modelos son las filas del catálogo de verdad con la key «puesta» a mano; lo que se
// aplica va al motor «prueba-video» (local, gratis). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as core from '../src/presets-core.js';
import * as K from '../src/studio-banco-core.js';
import { cargarFabrica } from '../presets/fabrica.mjs';
import { models as filas, capsOf, model as modelo } from '../media/catalogo.mjs';

const fab = cargarFabrica();
const byId = new Map(fab.presets.map(p => [p.id, p]));
const VIDEO = fab.presets.filter(p => p.medios.includes('video'));
const todos = filas().map(m => ({ ...m, on: true }));
const base = { byId: fab.presets, models: todos, caps: id => capsOf(id), familias: fab.familias, tipos: fab.tipos, canales: fab.canales };
const FOTO = '2026-10/cafetera.jpg', FOTO2 = '2026-10/cafetera-2.jpg', REF = '2026-10/look.jpg', CLIP = '2026-10/baile.mp4';
/** El estado del banco en video, como lo deja src/studio-banco.js (el material es el del paso 4 del compositor). */
const estado = (pila, mat = {}, o = {}) => ({ puerta: 'cero', foto: null, refs: [], pila: pila.map(id => ({ id, params: {} })), canal: 'web', escena: null, idea: 'una cafetera roja', n: 1, mat, ...o });
/** Lo que manda la página al compilar (pedidoDeK) compilado como lo hace el servidor. */
const compila = (st, extra = {}) => core.compilar({ ...base, ...K.pedidoDeK(st, 'video', byId), ...extra });

test('el pedido de video lleva el material del paso 4 como fotogramas, referencias y el video (de guía si un preset la pide)', () => {
  const st = estado(['cam-acercar'], { start: [FOTO], end: [FOTO2], reference: [REF], video: [CLIP] });
  const p = K.pedidoDeK(st, 'video', byId);
  assert.equal(p.kind, 'video');
  assert.deepEqual(p.params, {}, 'en video no hay canal de exportación (sin ffmpeg): el formato es el del compositor');
  assert.deepEqual(p.entradas, { inicial: [FOTO], final: [FOTO2], referencias: [{ id: REF }], origen: [CLIP] });
  const g = K.pedidoDeK({ ...st, pila: [{ id: K.MOVIMIENTO_SUJETO }] }, 'video', byId);
  assert.deepEqual(g.entradas.guia, [CLIP], '«Movimiento del sujeto»: el video del paso 4 es la guía, no el que se edita');
  assert.equal(g.entradas.origen, undefined);
  assert.equal(K.pedidoDeK(st, 'image', byId).kind, undefined, 'en imagen el pedido sigue igual');
  assert.equal(K.modoDeEstadoK(st, 'video', byId), 'video');
  assert.equal(K.modoDeEstadoK(estado([], { start: [FOTO] }), 'video', byId), 'anima');
  assert.equal(K.modoDeEstadoK(estado([], { start: [FOTO], end: [FOTO2] }), 'video', byId), 'ab');
  assert.equal(K.modoDeEstadoK(estado([], { reference: [REF] }), 'video', byId), 'refs');
  assert.equal(K.modoDeEstadoK(estado([]), 'video', byId), 'texto');
});

test('las puertas de video son atajos: dicen qué falta y dónde se pone (el paso 4), sin bloquear; la portada filtra por su modo', () => {
  assert.deepEqual(K.PUERTAS_VIDEO.map(p => p.id), ['cero', 'foto', 'ref', 'video']);
  const sin = K.estadoPuertaK(estado([], {}, { puerta: 'foto' }), { kind: 'video', byId });
  assert.match(sin.falta, /Primer fotograma.*paso 4/); assert.equal(sin.etiqueta, 'Animar mi foto'); assert.equal(sin.grave, false);
  assert.equal(K.estadoPuertaK(estado([], {}, { puerta: 'foto' }), { kind: 'video', byId, intentado: true }).grave, true);
  const con = K.estadoPuertaK(estado([], { start: [FOTO] }, { puerta: 'foto' }), { kind: 'video', byId });
  assert.equal(con.falta, ''); assert.equal(con.etiqueta, 'Animar mi foto');
  assert.equal(K.estadoPuertaK(estado([], { start: [FOTO], end: [FOTO2] }, { puerta: 'cero' }), { kind: 'video', byId }).etiqueta, 'De una foto a otra', 'sin la puerta, el modo que sale del material');
  assert.match(K.estadoPuertaK(estado([], {}, { puerta: 'video' }), { kind: 'video', byId }).falta, /video/);
  for (const [puerta, modo] of [['foto', 'anima'], ['ref', 'refs'], ['video', 'video'], ['cero', 'texto']]) {
    const s = K.portadaK(VIDEO, { puerta, kind: 'video' }).find(x => x.titulo === 'Para empezar');
    assert.ok(s && s.ids.length >= 3, `«${puerta}» tiene con qué empezar`);
    for (const id of s.ids) assert.ok(core.modoAdmite(byId.get(id), modo), `${id} encaja con ${modo}`);
  }
  assert.ok(K.portadaK(VIDEO, { puerta: 'foto', kind: 'video' }).at(-1).ids.includes('vp-giro-360'), 'el giro 360 (estrella) sale al animar tu foto');
});

test('compilar video con un preset de cada eje (cámara, plano, look, formato, sonido, producto, editar): sin errores', () => {
  const porEje = {};
  for (const p of VIDEO) for (const e of p.ejes) (porEje[e] ||= []).push(p);
  for (const eje of ['camara', 'plano', 'look', 'formato', 'audio', 'producto']) assert.ok(porEje[eje]?.length, `hay presets de ${eje}`);
  const material = p => {
    const m = {};
    for (const en of p.entradas || []) {
      if (!en.min) continue;
      if (en.rol === 'inicial' || en.rol === 'sujeto') m.start = [FOTO];
      if (en.rol === 'final') m.end = [FOTO2];
      if (en.rol === 'origen' || en.rol === 'guia') m.video = [CLIP];
      if (en.rol === 'referencia') m.reference = [...(m.reference || []), m.reference ? FOTO2 : REF];
    }
    if (!Object.keys(m).length && (p.modos || []).every(x => x === 'refs')) m.reference = [REF];
    if (!Object.keys(m).length && (p.modos || []).every(x => x === 'video')) m.video = [CLIP];
    return m;
  };
  for (const eje of ['camara', 'plano', 'look', 'formato', 'audio', 'producto']) {
    for (const p of porEje[eje].slice(0, 4)) {
      const r = compila(estado([p.id], material(p)));
      assert.deepEqual(r.errores, [], `${p.id} (${eje}): ${r.errores.join(' · ')}`);
      assert.equal(r.kind, 'video'); assert.ok(r.model && modelo(r.model).kind === 'video', p.id);
      if (eje === 'formato') assert.ok(r.request.settings.aspectRatio, `${p.id}: el formato llega como ajuste`);
    }
  }
  const ed = VIDEO.filter(p => p.categoria === 'veditar');
  assert.ok(ed.length >= 5);
  for (const p of ed) assert.deepEqual(compila(estado([p.id], material(p))).errores, [], p.id);
});

test('las reglas del clip a la vista: un movimiento por clip, el giro 360 y los rígidos, el bucle, antes → después', () => {
  const pila = ['vp-giro-360', 'cam-orbita'], st = estado(pila, { start: [FOTO] }, { idea: 'sábanas blancas' });
  const r = compila(st, { producto: 'sabanas' });
  const reglas = K.reglasVideo(r, st.pila, byId).map(x => x.texto);
  assert.match(reglas[0], /^Un movimiento de cámara por clip: «Vuelta completa alrededor»/);
  assert.ok(reglas.some(t => /Giro 360 de catálogo.*deformarse/.test(t)), 'el aviso del giro 360');
  assert.ok(reglas.some(t => /objetos rígidos/.test(t)), 'tela: se deforma al girar');
  assert.ok(reglas.some(t => /ya mueve el producto/.test(t)), 'la receta mueve el producto y la cámara también');
  assert.equal(new Set(reglas).size, reglas.length, 'nada se dice dos veces');
  const quieta = K.reglasVideo(compila(estado(['look-cine'], {})), [{ id: 'look-cine' }], byId);
  assert.match(quieta[0].texto, /la cámara se queda quieta/);
  const giro = K.reglasVideo(compila(estado(['vp-giro-360'], { start: [FOTO] })), [{ id: 'vp-giro-360' }], byId);
  assert.match(giro[0].texto, /^La cámara se queda quieta: lo que se mueve es el producto \(«Giro 360 de catálogo»\)/, 'la receta trae la cámara quieta: se dice así, no «movimiento: Cámara quieta»');
  // el formato del compositor manda; un preset de formato distinto se dice y ofrece ponerlo
  const fm = K.reglasVideo(compila(estado(['vf-reel'], {}, { proporcion: '16:9' })), [{ id: 'vf-reel' }], byId, { proporcion: '16:9' });
  const r916 = fm.find(x => x.formato);
  assert.ok(r916 && r916.formato === '9:16' && /manda el tuyo/.test(r916.texto), JSON.stringify(fm));
  assert.ok(!K.reglasVideo(compila(estado(['vf-reel'], {}, { proporcion: '9:16' })), [{ id: 'vf-reel' }], byId, { proporcion: '9:16' }).some(x => x.formato));
  assert.equal(compila(estado(['vf-reel'], {}, { proporcion: '16:9', modelo: 'prueba-video' })).request.settings.aspectRatio, '16:9', 'el del compositor gana');
  assert.equal(K.marca(byId.get('vf-reel')), 'un ajuste del modelo', 'la marca de video no habla de «rehacer la imagen»');
  assert.equal(K.marca(byId.get('cam-acercar')), 'con IA, en el mismo clip');
  const bucle = K.reglasVideo(compila(estado(['vp-bucle-web'], { start: [FOTO] })), [{ id: 'vp-bucle-web' }], byId).map(x => x.texto);
  assert.ok(bucle.some(t => /^Bucle: la misma foto al principio y al final/.test(t)));
  const ab = compila(estado(['vp-antes-despues'], { start: [FOTO] }));
  const lab = K.reglasVideo(ab, [{ id: 'vp-antes-despues' }], byId);
  assert.ok(lab.some(x => /primer y último fotograma/.test(x.texto)));
  assert.ok(lab.some(x => x.grave && /necesita/.test(x.texto)), 'sin la foto de llegada, lo dice como «No se puede»');
  assert.deepEqual(compila(estado(['vp-antes-despues'], { start: [FOTO], end: [FOTO2] })).errores, []);
});

test('el modelo del compositor que no puede: el motivo junto a GENERAR, no se genera y se sugiere uno encendido que sí', () => {
  const st = estado([K.MOVIMIENTO_SUJETO], { start: [FOTO], video: [CLIP] }, { modelo: 'kling-3-std' });
  const r = compila(st);
  assert.equal(r.request, null, 'sin pedido: nada que mandar');
  assert.match(r.errores[0], /Kling 3.*no puede con esto/);
  assert.equal(K.botonBloqueado(r.errores[0]), 'Revisa el plan');
  const s = K.sugerirModelo(r);
  assert.ok(s && /motion/.test(s.id), JSON.stringify(s));
  assert.equal(modelo(s.id).roles.video, 1);
  const ok = compila({ ...st, modelo: s.id });
  assert.deepEqual(ok.errores, []); assert.deepEqual(ok.request.media.video, [CLIP]); assert.deepEqual(ok.request.media.start, [FOTO]);
  assert.equal(K.sugerirModelo(ok), null, 'con un plan bueno no hay nada que sugerir');
  // capsOf: un modelo sin fotograma final no hace antes → después
  const ab = compila(estado(['vp-antes-despues'], { start: [FOTO], end: [FOTO2] }, { modelo: 'kling-3-turbo' }));
  assert.ok(ab.errores.some(e => /no puede con esto/.test(e)), ab.errores.join());
  // el formato del compositor manda: Veo no hace 1:1 y lo dice
  const veo = compila(estado(['cam-acercar'], {}, { modelo: 'veo-3.1-fast', proporcion: '1:1' }));
  assert.ok(veo.errores.some(e => /no puede con esto/.test(e)) || veo.avisos.some(a => /no hace 1:1/.test(a.texto)), JSON.stringify([veo.errores, veo.avisos]));
});

test('F6: las fichas de Música y Voz rellenan los ajustes que el modelo tiene, con valores que acepta', () => {
  const musica = K.fichasDe(fab.presets, 'music'), voz = K.fichasDe(fab.presets, 'audio');
  assert.equal(musica.length + voz.length, 8, 'los 8 presets de presets/musica/');
  const mus = modelo('mmx-musica-3-gratis'), vz = modelo('mmx-voz-2.8-hd');
  const jingle = K.ajustesDeFicha(byId.get('mus-jingle'), mus.settings);
  assert.deepEqual(jingle.valores, { instrumental: false, style: 'upbeat catchy jingle, pop latino alegre' }, '«{p.estilo}» con su valor por defecto');
  assert.deepEqual(jingle.fuera, []);
  assert.deepEqual(K.ajustesDeFicha(byId.get('mus-reel'), mus.settings).valores, { instrumental: true, style: 'energetic modern pop beat, 120 bpm' });
  const anuncio = K.ajustesDeFicha(byId.get('voz-anuncio'), vz.settings);
  assert.deepEqual(anuncio.valores, { emotion: 'happy', speed: 1.05 });
  assert.deepEqual(K.ajustesDeFicha(byId.get('voz-tutorial'), vz.settings).valores, { emotion: '', speed: 0.95 }, '«neutra» es la emoción propia de la voz (MiniMax no tiene «neutral»)');
  for (const p of [...musica, ...voz]) {
    const m = p.medios[0] === 'music' ? mus : vz, r = K.ajustesDeFicha(p, m.settings);
    assert.ok(Object.keys(r.valores).length, `${p.id} pone algo`);
    for (const [k, v] of Object.entries(r.valores)) {
      const f = m.settings[k]; assert.ok(f, `${p.id}: ${k} es un ajuste del modelo`);
      if (f.type === 'enum') assert.ok(f.values.includes(v), `${p.id}: ${k}=${v}`);
      if (f.type === 'range') assert.ok(v >= f.min && v <= f.max, `${p.id}: ${k}=${v}`);
    }
  }
  const sin = K.ajustesDeFicha(byId.get('mus-jingle'), vz.settings);
  assert.deepEqual(sin.valores, {}); assert.match(sin.fuera[0].motivo, /no tiene ese ajuste/);
  assert.equal(K.fichaActiva(byId.get('mus-reel'), mus.settings, { instrumental: true, style: 'energetic modern pop beat, 120 bpm', format: 'mp3' }), true);
  assert.equal(K.fichaActiva(byId.get('mus-reel'), mus.settings, { instrumental: false, style: '' }), false);
  assert.equal(K.fichaEs(jingle.valores), 'con letra · estilo «upbeat catchy jingle, pop latino alegre»');
  assert.equal(K.fichaEs({ emotion: '', speed: 0.95 }), 'la emoción propia de la voz · velocidad 0,95');
});

test('servidor: compila y aplica kind video (al motor de prueba), y guarda una receta de video como preset de video', async () => {
  const media = await import('../media.mjs');
  const { crearPresets, pedidoLimpio } = await import('../presets.mjs');
  const p = pedidoLimpio({ kind: 'video', pila: ['cam-acercar'], entradas: { inicial: ['a.png', 'b.png'], final: ['c.png'], guia: ['d.mp4'], origen: [7], raro: ['x'] } });
  assert.equal(p.kind, 'video');
  assert.deepEqual(p.entradas.inicial, ['a.png']); assert.deepEqual(p.entradas.final, ['c.png']); assert.deepEqual(p.entradas.guia, ['d.mp4']);
  assert.equal(p.entradas.origen, undefined); assert.equal(p.entradas.raro, undefined);
  assert.equal(pedidoLimpio({ kind: 'otra', entradas: { inicial: ['a.png'] } }).kind, 'image');
  assert.equal(pedidoLimpio({ kind: 'image', entradas: { inicial: ['a.png'] } }).entradas.inicial, undefined, 'en imagen no hay fotogramas');

  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-banco-video-')), data = path.join(brain, 'data');
  media.configure({ media: { dailyLimit: 0 } }, brain, data);
  const P = crearPresets({ brainPath: brain, dataDir: data });
  const c = P.compilar({ kind: 'video', pila: ['cam-acercar', 'vf-reel'], idea: 'una cafetera', model: 'prueba-video' }).plan;
  assert.deepEqual(c.errores, []); assert.equal(c.kind, 'video'); assert.equal(c.model, 'prueba-video');
  assert.match(c.prompt, /push in/i); assert.equal(c.request.settings.aspectRatio, '9:16');
  const mal = P.compilar({ kind: 'video', pila: ['luz-mas-clara'], idea: 'x', model: 'prueba-video' }).plan;
  assert.ok(mal.errores.some(e => /es para image, no para video/.test(e)), 'un preset de imagen no entra en un video');
  await assert.rejects(P.aplicar({ kind: 'video', pila: ['vp-antes-despues'], entradas: { inicial: ['a.png'] }, model: 'prueba-video' }), e => e.status === 400 && /necesita/.test(e.message), 'lo que no se puede no gasta');
  const a = await P.aplicar({ kind: 'video', pila: ['cam-acercar'], idea: 'una cafetera', model: 'prueba-video' });
  assert.equal(a.jobs.length, 1); assert.equal(a.jobs[0].kind, 'video'); assert.equal(a.jobs[0].model, 'prueba-video');
  const g = P.guardar({ nombre: 'Reel que se acerca', receta: { kind: 'video', pila: [{ id: 'cam-acercar', params: { intensidad: 'suave' } }, { id: 'vf-reel' }] } });
  assert.equal(g.preset.medio, 'video');
  const l = P.lista({ medio: 'video' });
  const mio = l.presets.find(x => x.id === g.preset.id);
  assert.ok(mio && mio.medios.includes('video') && mio.categoria === 'mios', 'sale en el banco de video, en «De PanaClaw»');
  assert.ok(!P.lista({ medio: 'image' }).presets.some(x => x.id === g.preset.id), 'y no en el de imagen');
  assert.throws(() => P.guardar({ nombre: 'Mezcla', receta: { kind: 'video', pila: [{ id: 'luz-mas-clara' }] } }), e => e.status === 400);
  const vc = P.compilar({ kind: 'video', pila: [g.preset.id], idea: 'una cafetera', model: 'prueba-video' }).plan;
  assert.deepEqual(vc.errores, []); assert.match(vc.prompt, /push in/i, 'el preset propio se abre en su receta');
});

// El compilador del banco de presets (src/presets-core.js): expandir, modoDe, compilar por familia, la referencia por ejes,
// lo local sin IA y el escenario 3D (docs/propuesta-banco-presets.md §5 y §15–16). Sin red, sin keys: los modelos son las
// filas del catálogo de verdad (media/catalogo.mjs) con la key «puesta» a mano, y el escenario 3D, un doble.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../src/presets-core.js';
import { models as filas, capsOf, FAMILIAS as FAMILIAS_SERVIDOR } from '../media/catalogo.mjs';

const C = JSON.parse(fs.readFileSync(new URL('../docs/presets-catalogo.json', import.meta.url), 'utf8'));
const todos = filas().map(m => ({ ...m, on: true }));
const soloMotores = (...eng) => filas().map(m => ({ ...m, on: eng.includes(m.engine) }));
const base = { byId: C.presets, models: todos, caps: id => capsOf(id), familias: C.familias, tipos: C.tipos, canales: C.canales };
const compila = o => core.compilar({ ...base, ...o });
const FOTO = '2026-10/cama-bodega.jpg', REF = '2026-10/anuncio.jpg', REF2 = '2026-10/otro.jpg';

/* ---------- tablas ---------- */
test('la tabla de familias es la misma que la del servidor y la del catálogo', () => {
  assert.deepEqual(core.FAMILIAS, FAMILIAS_SERVIDOR);
  for (const [k, v] of Object.entries(C.familias)) assert.deepEqual(core.FAMILIAS[k], v.modelos, k);
  assert.deepEqual(core.EJES_EXCLUSIVOS, C.leyenda.exclusivos);
  for (const m of filas()) assert.equal(core.familiaDe(m.id), capsOf(m.id).familia, m.id);
});

test('validar: el catálogo entero pasa, y un preset roto dice qué tiene', () => {
  for (const p of C.presets) assert.deepEqual(core.validar(p, { byId: C.presets, grupos: C.grupos.map(g => g.id) }), [], p.id);
  const roto = { id: 'X', v: 0, nombre: '', capa: 'otra', ejecutor: 'magia', medios: ['image'], modos: ['foto'], entradas: [{ rol: 'inicial' }], parametros: [{ id: 'a', valores: [{ v: 'b' }], def: 'c' }], incluye: ['no-existe'] };
  const v = core.validar(roto, { byId: C.presets }).join('\n');
  for (const frase of ['el id', 'versión', 'nombre', 'capa', 'ejecutor', 'fotogramas', 'por defecto de «a»', 'no-existe', 'solo una receta']) assert.match(v, new RegExp(frase), frase);
  const ciclo = [{ id: 'aaa', capa: 'receta', incluye: ['bbb'] }, { id: 'bbb', capa: 'receta', incluye: ['aaa'] }];
  assert.match(core.validar({ ...ciclo[0], v: 1, nombre: 'a', ejecutor: 'local', medios: ['image'], modos: ['foto'] }, { byId: ciclo }).join(), /aaa → bbb → aaa/);
});

/* ---------- expandir ---------- */
test('expandir: la receta con sus incluye (también los de dentro), la receta primero y los ajustes por eje', () => {
  const { lista, errores } = core.expandir(['luz-mas-contraste', 'cat-web-panaclaw'], C.presets);
  assert.deepEqual(errores, []);
  const ids = lista.map(x => x.id);
  assert.equal(ids[0], 'cat-web-panaclaw');
  for (const id of ['limp-polvo', 'luz-arreglar', 'luz-mas-clara', 'luz-abrir-sombras', 'luz-recuperar-quemado', 'color-blancos', 'fondo-blanco', 'sombra-contacto', 'luz-mas-contraste']) assert.ok(ids.includes(id), id);
  assert.ok(ids.indexOf('limp-polvo') < ids.indexOf('luz-mas-clara') && ids.indexOf('luz-mas-clara') < ids.indexOf('fondo-blanco'), 'limpieza → luz → fondo');
  assert.equal(new Set(ids).size, ids.length, 'sin repetidos');
  assert.equal(lista.find(x => x.id === 'luz-mas-clara').origen, 'luz-arreglar');
});

test('expandir: en un eje exclusivo gana el último y se avisa; la receta pierde ese eje', () => {
  const r = core.expandir(['cat-web-panaclaw', 'fondo-gris'], C.presets);
  assert.ok(!r.lista.some(x => x.id === 'fondo-blanco'));
  assert.ok(r.lista.some(x => x.id === 'fondo-gris'));
  const a = r.avisos.find(x => x.tipo === 'sustituye');
  assert.equal(a.eje, 'fondo'); assert.equal(a.gana, 'fondo-gris'); assert.equal(a.pierde, 'fondo-blanco');
  assert.match(a.texto, /Fondo: «Fondo gris de estudio» sustituyó a «Fondo blanco puro»/);
  assert.deepEqual(r.sustituidos, { 'cat-web-panaclaw': ['fondo'] });
  const b = core.expandir(['fondo-gris', 'fondo-blanco'], C.presets);
  assert.deepEqual(b.lista.map(x => x.id), ['fondo-blanco']);
  const sum = core.expandir(['luz-mas-clara', 'luz-mas-contraste'], C.presets); // luz se suma
  assert.equal(sum.lista.length, 2); assert.equal(sum.avisos.length, 0);
});

test('expandir: «ya incluido» con otro valor manda el del dueño; dos recetas, la última; excluye y ciclos dan error', () => {
  const r = core.expandir(['cat-web-panaclaw', { id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }], C.presets);
  assert.equal(r.lista.filter(x => x.id === 'luz-mas-clara').length, 1);
  assert.equal(r.lista.find(x => x.id === 'luz-mas-clara').params.intensidad, 'fuerte');
  assert.ok(r.avisos.some(a => a.tipo === 'ya-incluido'));
  const dos = core.expandir(['cat-web-panaclaw', 'cat-amazon'], C.presets);
  assert.equal(dos.lista[0].id, 'cat-amazon');
  assert.ok(!dos.lista.some(x => x.id === 'cat-web-panaclaw'));
  assert.match(dos.avisos[0].texto, /Receta: «Amazon · foto principal» sustituyó a «Catálogo para la web, con margen»/);
  const mini = [
    { id: 'fondo-x', v: 1, nombre: 'Fondo X', capa: 'ajuste', ejes: ['limpieza'], excluye: ['amb-y'] },
    { id: 'amb-y', v: 1, nombre: 'Ambiente Y', capa: 'ajuste', ejes: ['luz'] },
    { id: 'rc-a', v: 1, nombre: 'A', capa: 'receta', incluye: ['rc-b'] }, { id: 'rc-b', v: 1, nombre: 'B', capa: 'receta', incluye: ['rc-a'] },
  ];
  assert.match(core.expandir(['fondo-x', 'amb-y'], mini).errores[0], /«Fondo X» y «Ambiente Y» no van juntos/);
  assert.match(core.expandir(['rc-a'], mini).errores[0], /se incluye a sí mismo/);
  assert.match(core.expandir(['no-existe'], mini).errores[0], /No conozco el preset «no-existe»/);
});

/* ---------- modoDe ---------- */
test('modoDe: se deduce de las entradas, nunca se declara', () => {
  const t = (e, k) => core.modoDe(e, k);
  assert.equal(t({}, 'image'), 'cero');
  assert.equal(t({ foto: FOTO }, 'image'), 'foto');
  assert.equal(t({ referencias: [REF] }, 'image'), 'ref');
  assert.equal(t({ foto: [FOTO], referencias: [{ id: REF }] }, 'image'), 'foto+ref');
  assert.equal(t({}, 'video'), 'texto');
  assert.equal(t({ foto: FOTO }, 'video'), 'anima');
  assert.equal(t({ inicial: FOTO, final: REF }, 'video'), 'ab');
  assert.equal(t({ referencias: [REF] }, 'video'), 'refs');
  assert.equal(t({ origen: 'v.mp4', inicial: FOTO }, 'video'), 'video');
  assert.equal(t({ foto: FOTO }, 'music'), 'texto');
  assert.equal(t({ foto: [], referencias: [] }, 'image'), 'cero');
});

/* ---------- editar, generar, animar, editar-video (§5.2) ---------- */
test('compilar: con tu foto edita (la foto en reference[0] y versionOf); sin foto genera; las referencias van detrás', () => {
  const e = compila({ pila: ['cat-web-panaclaw'], entradas: { foto: FOTO } });
  assert.deepEqual(e.errores, []);
  assert.equal(e.modo, 'foto'); assert.equal(e.request.versionOf, FOTO); assert.equal(e.request.media.reference[0], FOTO);
  const g = compila({ pila: ['esc-dormitorio'], idea: 'una cama queen con sábanas de lino' });
  assert.equal(g.modo, 'cero'); assert.equal(g.request.versionOf, undefined); assert.equal(g.request.media.reference, undefined);
  const fr = compila({ pila: ['ref-estilo'], entradas: { foto: FOTO, referencias: [REF] } });
  assert.deepEqual(fr.request.media.reference, [FOTO, REF]);
  const r = compila({ pila: ['ref-estilo'], entradas: { referencias: [REF] } });
  assert.equal(r.modo, 'ref'); assert.deepEqual(r.request.media.reference, [REF]); assert.equal(r.request.versionOf, undefined);
});

test('compilar: un video anima tu foto (start), de una a otra (start/end), o edita tu video (video + versionOf)', () => {
  const a = compila({ pila: ['cam-orbita'], entradas: { foto: FOTO } });
  assert.equal(a.modo, 'anima'); assert.deepEqual(a.request.media.start, [FOTO]); assert.equal(a.kind, 'video');
  const ab = compila({ pila: ['vp-fotos-transicion'], entradas: { inicial: FOTO, final: REF } });
  assert.equal(ab.modo, 'ab'); assert.deepEqual(ab.request.media.start, [FOTO]); assert.deepEqual(ab.request.media.end, [REF]);
  const v = compila({ pila: ['ved-cambiar-fondo'], entradas: { origen: '2026-10/clip.mp4' }, idea: 'a beach at sunset' });
  assert.equal(v.modo, 'video'); assert.deepEqual(v.request.media.video, ['2026-10/clip.mp4']); assert.equal(v.request.versionOf, '2026-10/clip.mp4');
});

test('compilar: un preset que trabaja sobre tu foto, sin foto, lo dice y no elige modelo', () => {
  const r = compila({ pila: ['cat-web-panaclaw'] });
  assert.ok(r.errores.some(e => /trabaja sobre tu foto: súbela o elige uno de «Desde cero»/.test(e)), r.errores.join());
  const s = compila({ pila: ['ref-estilo'], entradas: { foto: FOTO } });
  assert.ok(s.errores.some(e => /necesita una referencia/.test(e)));
  const lut = compila({ pila: ['ref-lut-aplicar'], entradas: { foto: FOTO } });
  assert.ok(lut.errores.some(e => /Tu archivo \.cube/.test(e)));
});

/* ---------- la cláusula de conservación y las familias (§5.7 capa 1, §5.8) ---------- */
test('la cláusula de conservación siempre va al editar, en cada familia de imagen', () => {
  for (const [model, fam] of [['nano-banana-pro', 'conversacional'], ['gpt-image-1', 'instrucciones'], ['seedream-4', 'edicion-corta'], ['flux-kontext', 'edicion-corta']]) {
    const r = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, model });
    assert.deepEqual(r.errores, [], model);
    assert.equal(r.familia, fam);
    const clausula = C.familias[fam].conservar;
    assert.ok(r.prompt.includes(clausula), `${model}: ${r.prompt}`);
    assert.equal(r.prompt.split(clausula).length, 2, 'una sola vez');
  }
  const i = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, model: 'gpt-image-1' });
  assert.match(i.prompt, /^Edit the attached product photo\.\nRequirements:\n- remove dust/);
  assert.match(i.prompt, /Must stay unchanged:\n- Preserve the product exactly/);
  const corta = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, model: 'seedream-4' });
  assert.ok(corta.prompt.length <= 600);
  const cero = compila({ pila: ['esc-podio'], idea: 'a ceramic mug', model: 'soul-2' });
  assert.equal(cero.familia, 'descriptiva');
  assert.match(cero.prompt, /professional product photography/);
});

test('el canal fija la salida y el encuadre la ocupación: def del preset < canal < lo del dueño', () => {
  const web = compila({ pila: ['cat-web-panaclaw'], entradas: { foto: FOTO } });
  const enc = web.local.despues.find(o => o.op === 'encuadrar');
  assert.equal(enc.ocupacion, 0.6); assert.equal(enc.aireMinPx, 328);
  assert.deepEqual(web.local.despues.map(o => o.op), ['fondo-blanco', 'encuadrar', 'exportar']);
  const exp = web.local.despues.find(o => o.op === 'exportar');
  assert.equal(exp.ancho, 2048); assert.equal(exp.formato, 'webp'); assert.equal(exp.sinExif, true);
  assert.equal(web.request.settings.imageSize, '2K', 'más de 1024 px pide 2K');
  assert.deepEqual(web.medir.ocupacion, { objetivo: 0.6, tolerancia: 0.03, fuente: 'encuadre', medido: true });
  const amz = compila({ pila: ['cat-amazon'], entradas: { foto: FOTO } });
  assert.equal(amz.local.despues.find(o => o.op === 'encuadrar').ocupacion, 0.85);
  const mio = compila({ pila: [{ id: 'cat-web-panaclaw', params: { encuadre: 'aire' } }], entradas: { foto: FOTO } });
  assert.equal(mio.local.despues.find(o => o.op === 'encuadrar').ocupacion, 0.45);
  assert.match(mio.prompt, /about 45%/);
  const glob = compila({ pila: ['cat-web-panaclaw'], params: { encuadre: 'ajustado' }, entradas: { foto: FOTO } });
  assert.equal(glob.local.despues.find(o => o.op === 'encuadrar').ocupacion, 0.85);
  const raro = compila({ pila: [{ id: 'luz-mas-clara', params: { intensidad: 'brutal' } }], entradas: { foto: FOTO } });
  assert.ok(raro.avisos.some(a => /«brutal» no es un valor/.test(a.texto)));
  assert.equal(raro.local.antes[0].ev, 0.4);
});

test('una receta a la que otro preset le quitó un eje ya no manda su frase entera ni su blanco 255', () => {
  const r = compila({ pila: ['cat-web-panaclaw', 'fondo-gris'], entradas: { foto: FOTO } });
  assert.doesNotMatch(r.prompt, /pure white/);
  assert.match(r.prompt, /light grey studio sweep/);
  assert.match(r.prompt, /remove dust/);
  assert.ok(!r.local.despues.some(o => o.op === 'fondo-blanco'));
  assert.ok(!r.qa.includes('fondo-255'));
  const entera = compila({ pila: ['cat-web-panaclaw'], entradas: { foto: FOTO } });
  assert.match(entera.prompt, /pure white seamless background/);
  assert.doesNotMatch(entera.prompt, /remove dust/, 'lo que la receta ya dice no se repite');
});

test('las cifras salen de cifras.json, nunca del preset', () => {
  const sin = compila({ pila: ['mkt-oferta'], entradas: { foto: FOTO } });
  assert.ok(sin.errores.some(e => /Falta la cifra «precio» en cifras.json/.test(e)));
  const con = compila({ pila: ['mkt-oferta'], entradas: { foto: FOTO }, cifras: { precio: 'B/. 499' } });
  assert.deepEqual(con.errores, []);
  assert.match(con.prompt, /promo badge showing B\/\. 499/);
});

/* ---------- lo local ---------- */
test('si todo es local no hay modelo: costo 0, sin pedido, y con la intensidad elegida', () => {
  const r = compila({ pila: [{ id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }, 'color-blancos', 'color-arreglar'], entradas: { foto: FOTO } });
  assert.deepEqual(r.errores, []);
  assert.equal(r.model, null); assert.equal(r.request, null); assert.equal(r.soloLocal, true); assert.equal(r.costo.usd, 0);
  assert.equal(r.local.antes.find(o => o.op === 'exposicion').ev, 0.7);
  assert.equal(r.local.antes.filter(o => o.op === 'exposicion').length, 1, 'una operación, una vez');
  assert.match(r.resumen_es, /en esta máquina, gratis/);
  const conIdea = compila({ pila: ['luz-mas-clara'], idea: 'make the wood warmer', entradas: { foto: FOTO } });
  assert.ok(conIdea.model, 'una idea sobre presets locales va a la IA');
  assert.ok(conIdea.avisos.some(a => a.tipo === 'idea'));
  assert.deepEqual(conIdea.request.pre, [{ op: 'exposicion', ev: 0.4, de: 'luz-mas-clara' }]);
});

test('sin sharp: lo local dice «no disponible en esta máquina» y nunca cae a la IA', () => {
  const r = compila({ pila: ['luz-mas-clara'], entradas: { foto: FOTO }, capacidades: { local: false } });
  assert.match(r.errores[0], /no está disponible en esta máquina \(falta sharp\)/);
  assert.equal(r.model, null); assert.equal(r.request, null);
  const cat = compila({ pila: ['cat-web-panaclaw'], entradas: { foto: FOTO }, capacidades: { local: false } });
  assert.ok(cat.errores.some(e => /Catálogo para la web, con margen.*no está disponible/.test(e)));
  const color = compila({ pila: ['ref-estilo'], entradas: { foto: FOTO, referencias: [{ id: REF, ejes: { estilo: 2, color: 2 } }] }, capacidades: { local: false } });
  assert.ok(color.errores.some(e => /Copiar el color.*no está disponible/.test(e)));
  const ia = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, capacidades: { local: false } });
  assert.deepEqual(ia.errores, [], 'lo que es solo IA sigue');
});

/* ---------- la referencia por ejes (§5.4) ---------- */
test('cada referencia: una línea «only for» con su fuerza y el negativo; el color es local; producto nunca por defecto', () => {
  const r = compila({ pila: [], idea: 'a summer ad', entradas: { foto: FOTO, referencias: [{ id: REF, ejes: { estilo: 1, luz: 3, color: 2 } }, { id: REF2, ejes: { composicion: 2 } }] } });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.request.media.reference, [FOTO, REF, REF2]);
  assert.match(r.prompt, /Image 2 is a reference for visual style and lighting only\. Use Image 2 only for its visual style \(medium, texture, mood\), loosely inspired by it; and for its lighting .*closely matching it; do not copy its objects, people, products, text, logos or brand names\./);
  assert.match(r.prompt, /Image 3 is a reference for composition only\. Use Image 3 only as a layout guide .*following it; do not copy its objects/);
  assert.equal(r.prompt.split(core.NEGATIVO_REF).length - 1, 2, 'un negativo por referencia');
  assert.equal(r.prompt.split('a summer ad').length - 1, 1, 'la idea sin preset va una vez, como instrucción');
  assert.match(r.prompt, /Change only this: a summer ad\./);
  assert.doesNotMatch(r.prompt, /color grading|copy the colou?r/i, 'el color nunca es una frase de prompt');
  const t = r.local.despues.find(o => o.op === 'transferir-color');
  assert.deepEqual([t.ref, t.fuerza, t.metodo], [REF, 0.7, 'reinhard-lab']);
  // sin ejes dados: Estilo y Color encendidos, Producto apagado
  assert.deepEqual(core.ejesDeReferencia({ id: REF }), core.EJES_REF_DEF);
  assert.equal(core.EJES_REF_DEF.producto, 0);
  const anuncio = core.ejesDeReferencia({ id: REF }, core.expandir(['ref-anuncio'], C.presets).lista);
  for (const e of ['estilo', 'color', 'luz', 'composicion']) assert.ok(anuncio[e] > 0, e);
  assert.equal(anuncio.producto, 0);
  // solo color: la referencia NO va al modelo
  const soloColor = compila({ pila: ['ref-color'], entradas: { foto: FOTO, referencias: [REF] } });
  assert.equal(soloColor.model, null); assert.equal(soloColor.local.antes.find(o => o.op === 'transferir-color').ref, REF);
});

test('«Mi producto en esa foto» solo con tu foto y cambia el negativo; sin foto se apaga y se dice', () => {
  const r = compila({ pila: ['ref-producto-en-escena'], entradas: { foto: FOTO, referencias: [REF] } });
  assert.deepEqual(r.errores, []);
  assert.match(r.prompt, /replace the product shown in it with the product from Image 1/);
  assert.match(r.prompt, /do not copy its product, text, logos or brand names/);
  const sin = compila({ pila: [], idea: 'x', entradas: { referencias: [{ id: REF, ejes: { producto: 3, estilo: 2 } }] } });
  assert.ok(sin.avisos.some(a => /necesita tu foto/.test(a.texto)));
  assert.doesNotMatch(sin.prompt, /replace the product/);
});

test('el modelo que no toma tantas imágenes se rechaza antes de gastar, con alternativa', () => {
  const r = compila({ pila: ['ref-estilo'], entradas: { foto: FOTO, referencias: [REF] }, model: 'flux-kontext' });
  assert.equal(r.model, null); assert.equal(r.request, null);
  assert.match(r.errores[0], /Flux Kontext.*toma 1 imagen y hacen falta 2.*Prueba con/);
  const nada = core.compilar({ ...base, models: soloMotores('openai'), pila: ['ref-estilo'], entradas: { foto: FOTO, referencias: [REF, REF2, REF, REF2, REF] } });
  assert.equal(nada.model, null); assert.equal(nada.sinMotor, true);
  const sinKeys = core.compilar({ ...base, models: soloMotores('prueba'), pila: ['limp-polvo'], entradas: { foto: FOTO } });
  assert.match(sinKeys.errores[0], /Ningún motor que edita fotos tiene key/);
});

test('maxPrompt: se recorta primero lo opcional (estilo, escena, luz), nunca la acción, la cláusula ni el encuadre', () => {
  const pila = ['luz-atardecer', 'limp-polvo', 'per-mismo-personaje', 'fondo-gris'];
  const con = tope => core.compilar({ ...base, caps: id => ({ ...capsOf(id), ...(id === 'nano-banana-2' && tope ? { maxPrompt: tope } : {}) }), pila, entradas: { foto: FOTO }, model: 'nano-banana-2' });
  const largo = con(0);
  assert.match(largo.prompt, /Style: same person/); assert.match(largo.prompt, /Lighting: warm/);
  const r1 = con(largo.prompt.length - 1); // primero se va el estilo
  assert.doesNotMatch(r1.prompt, /Style:/); assert.match(r1.prompt, /Lighting: warm/);
  assert.ok(r1.avisos.some(a => a.tipo === 'recorte' && /estilo/.test(a.texto)));
  const r2 = con(r1.prompt.length - 1); // después la luz
  assert.doesNotMatch(r2.prompt, /Lighting:/);
  for (const r of [r1, r2]) { assert.match(r.prompt, /remove dust/); assert.match(r.prompt, /grey studio sweep/); assert.match(r.prompt, /Preserve the product exactly/); assert.deepEqual(r.errores, []); }
  const imposible = con(120);
  assert.ok(imposible.errores.some(e => /muy largo/.test(e)), 'lo que no se puede recortar no se corta a ciegas');
});

/* ---------- el escenario 3D (§15.3, §16) ---------- */
const ESCENA = { producto: { tipo: 'cama', ancho: 160, alto: 50, fondo: 200, giro: 0, elevacion: 0 }, camara: { distancia: 320, azimut: 30, altura: 120, lente: 50 }, cuadro: { proporcion: '4:5' }, fondo: { tipo: 'color', valor: '#FFFFFF' } };
const doble = (forma = 'lista') => {
  const llamadas = [];
  return {
    llamadas,
    describirEscena(e, familia) {
      llamadas.push(familia);
      const fr = ['three-quarter view from the left', 'slightly elevated high-angle shot', '50mm natural perspective', `camera ${e.camara.distancia / 100} m away; the cama fills about 38% of the frame width`];
      if (forma === 'texto') return fr.join(', ');
      if (forma === 'objeto') return { frases: fr.map(en => ({ en, es: 'es:' + en.slice(0, 8) })), ocupacion: 38 };
      return fr;
    },
    ocupacionEstimada: () => ({ ancho: 0.38, alto: 0.21 }),
  };
};

test('escenario 3D: sus frases van al prompt, su guía como referencia rotulada, y se queda con el encuadre y el ángulo', () => {
  const d = doble();
  const r = compila({ pila: ['cat-web-panaclaw', 'enc-frontal'], entradas: { foto: FOTO }, escena: ESCENA, escena3d: d });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(d.llamadas, ['conversacional'], 'describirEscena recibe la familia del modelo elegido');
  assert.match(r.prompt, /three-quarter view from the left; slightly elevated high-angle shot; 50mm natural perspective; camera 3\.2 m away/);
  assert.doesNotMatch(r.prompt, /about 60% of the frame/, 'el nivel de encuadre ya no es una entrada');
  assert.ok(r.avisos.some(a => /Ángulo: el escenario 3D sustituyó a «Vista de frente»/.test(a.texto)));
  assert.deepEqual(r.request.media.reference, [FOTO, core.GUIA]);
  assert.equal(r.guia.n, 2); assert.equal(r.guia.pendiente, true);
  assert.ok(r.prompt.includes(core.ROTULO_GUIA(2)));
  assert.ok(!r.local.despues.some(o => o.op === 'encuadrar'), 'la distancia la fija el escenario: nada se reescala');
  assert.equal(r.local.despues.find(o => o.op === 'exportar').ajuste, 'rellenar', 'nada se recorta');
  assert.ok(r.avisos.some(a => /se rellena con el fondo, sin recortar/.test(a.texto)));
  assert.deepEqual(r.medir.ocupacion, { objetivo: 0.38, tolerancia: 0.12, fuente: 'escena', medido: true });
  assert.equal(r.request.settings.aspectRatio, '4:5');
  const lista = core.ponerGuia(r, '2026-10/guia-123.png');
  assert.deepEqual(lista.request.media.reference, [FOTO, '2026-10/guia-123.png']);
  assert.equal(lista.guia.pendiente, false);
  assert.deepEqual(r.request.media.reference, [FOTO, core.GUIA], 'ponerGuia no cambia el original');
});

test('escenario 3D: acepta texto, lista u objeto; una guía ya subida va directa; sin traductor es un error', () => {
  const t = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, escena: ESCENA, escena3d: doble('texto') });
  assert.match(t.prompt, /Camera and framing: three-quarter view from the left, slightly elevated/);
  const o = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO, guiaEscena: 'g.png' }, escena: ESCENA, escena3d: doble('objeto') });
  assert.equal(o.medir.ocupacion.objetivo, 0.38, '38 (%) → 0,38');
  assert.match(o.prompt_es, /^es:/);
  assert.deepEqual(o.request.media.reference, [FOTO, 'g.png']); assert.equal(o.guia.pendiente, false);
  const sin = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, escena: ESCENA });
  assert.ok(sin.errores.some(e => /escenario 3D no se pudo traducir/.test(e)));
  const pre = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, escena: { ...ESCENA, frases: ['rear view', 'eye-level'] } });
  assert.match(pre.prompt, /rear view; eye-level/, 'la escena puede traer sus frases ya hechas (servidor, Dimitri)');
  // corta: frases con coma, para Seedream
  const corta = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, escena: ESCENA, escena3d: doble(), model: 'seedream-4' });
  assert.match(corta.prompt, /three-quarter view from the left, slightly elevated/);
  assert.match(corta.prompt, /layout guide only/);
});

test('escenario 3D: sin sitio para la guía va solo en el texto; con referencias, la guía va la última', () => {
  const r = compila({ pila: ['limp-polvo'], entradas: { foto: FOTO }, escena: ESCENA, escena3d: doble(), model: 'flux-kontext' });
  assert.deepEqual(r.request.media.reference, [FOTO]);
  assert.ok(r.avisos.some(a => /no toma la imagen guía/.test(a.texto)));
  assert.match(r.prompt, /three-quarter view/);
  const c = compila({ pila: [], idea: 'x', entradas: { foto: FOTO, referencias: [{ id: REF, ejes: { estilo: 2, composicion: 2 } }] }, escena: ESCENA, escena3d: doble() });
  assert.deepEqual(c.request.media.reference, [FOTO, REF, core.GUIA]);
  assert.ok(c.avisos.some(a => /escenario 3D manda sobre la composición/.test(a.texto)));
  assert.doesNotMatch(c.prompt, /as a layout guide \(camera angle/);
  const soloComp = compila({ pila: [], idea: 'x', entradas: { foto: FOTO, referencias: [{ id: REF, ejes: { composicion: 3 } }] }, escena: ESCENA, escena3d: doble() });
  assert.deepEqual(soloComp.request.media.reference, [FOTO, core.GUIA], 'una referencia que solo daba composición ya no va al modelo');
  assert.doesNotMatch(soloComp.prompt, /reference for {2}only|reference for only/);
  const cero = compila({ pila: ['esc-podio'], idea: 'a mug', escena: { ...ESCENA, fondo: { tipo: 'set', valor: 'estudio gris' } }, escena3d: doble() });
  assert.equal(cero.modo, 'cero'); assert.ok(cero.prompt.includes('three-quarter'));
});

test('video: Veo nunca recibe 1:1 (va Kling o Seedance y se avisa); el movimiento de cámara va en su hueco', () => {
  const r = compila({ pila: ['cam-orbita', 'vf-cuadrado'], entradas: { foto: FOTO }, preferencia: { ...core.PREFER_DEF, video: ['veo-3.1-fast', ...core.PREFER_DEF.video] } });
  assert.deepEqual(r.errores, []);
  assert.notEqual(r.familia, 'veo');
  assert.equal(r.request.settings.aspectRatio, '1:1');
  const veo = compila({ pila: ['cam-acercar'], idea: 'a coffee maker on a counter', model: 'veo-3.1-fast' });
  assert.equal(veo.familia, 'veo');
  assert.match(veo.prompt, /^Slow push in toward the subject\. A coffee maker on a counter\./);
  assert.doesNotMatch(veo.prompt, /SFX:/, 'sin sonido pedido no queda la línea vacía');
  const no = compila({ pila: ['vf-cuadrado'], entradas: { foto: FOTO }, model: 'veo-3.1-fast' });
  assert.match(no.errores[0], /no hace 1:1/);
});

test('música y voz: el texto del dueño, literal; el preset solo pone los ajustes', () => {
  const m = compila({ pila: ['mus-tropical'], idea: 'jingle para PanaClaw' });
  assert.equal(m.kind, 'music'); assert.equal(m.prompt, 'jingle para PanaClaw');
  assert.equal(m.request.settings.instrumental, true);
  assert.match(m.request.settings.style, /tropical latin/);
  const v = compila({ pila: ['voz-anuncio'] });
  assert.ok(v.errores.some(e => /texto de la locución/.test(e)));
});

test('el resumen en español dice qué hará antes de gastar', () => {
  const r = compila({ pila: ['cat-web-panaclaw'], entradas: { foto: FOTO } });
  assert.match(r.resumen_es, /^Sobre tu foto · \d+ pasos · con .+ · unos US\$/);
  assert.ok(r.pasos_es.some(p => /Producto al 60 % del cuadro, medido aquí/.test(p)));
  assert.ok(r.pasos_es.some(p => /Para Web PanaClaw: 2048×2048 webp/.test(p)));
  assert.match(r.conserva_es, /Tu foto original no se toca/);
  assert.match(r.porque, /:/);
  assert.deepEqual(r.preset.map(p => p.id).slice(0, 2), ['cat-web-panaclaw', 'luz-arreglar']);
  assert.equal(r.preset[0].v, 1);
  assert.ok(r.alternativas.length > 0);
});

test('proporcionCercana, fraccion y limpiaPlantilla', () => {
  assert.equal(core.proporcionCercana('4:5', ['1:1', '16:9']), '1:1');
  assert.equal(core.proporcionCercana('4:5', ['1:1', '3:2', '2:3']), '2:3', 'en escala logarítmica 0,8 está más cerca de 0,667 que de 1');
  assert.equal(core.proporcionCercana('9:16', ['1:1', '3:2', '2:3']), '2:3');
  assert.equal(core.proporcionCercana('x', ['1:1']), null);
  assert.equal(core.fraccion(45), 0.45); assert.equal(core.fraccion(0.3), 0.3); assert.equal(core.fraccion({ ancho: 0.2, alto: 0.6 }), 0.6); assert.equal(core.fraccion('nada'), null);
  assert.equal(core.limpiaPlantilla('static camera, , . The product spins. . look.\nSFX: \nAmbient noise: '), 'Static camera. The product spins. Look.');
});

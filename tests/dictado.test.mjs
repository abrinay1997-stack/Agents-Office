// Dictado por voz (src/dictado.js): lo puro y el motor, con un SpeechRecognition de mentira. Nada de micrófono ni de navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { unirDictado, insertarEn, leerResultados, crearDictado, idiomaDictado, esCampoDictable, MAX_REENCENDIDOS_VACIOS, SESION_CORTA_MS } from '../src/dictado.js';
import { cargarDictado } from '../src/dictado-carga.js';

/** Un SpeechRecognition de mentira: guarda las sesiones y deja que el test las dispare. */
function falso() {
  const sesiones = [];
  class SR { constructor() { this.parado = false; sesiones.push(this); } start() { this.iniciado = true; } stop() { this.parado = true; } }
  return { SR, sesiones, ultima: () => sesiones.at(-1) };
}
const res = (...filas) => filas.map(([t, fin]) => Object.assign([{ transcript: t }], { isFinal: fin }));

test('unirDictado: un espacio entre medias, nunca dos, y nada si no hay nada que añadir', () => {
  assert.equal(unirDictado('hola', 'mundo'), 'hola mundo');
  assert.equal(unirDictado('hola ', 'mundo'), 'hola mundo');
  assert.equal(unirDictado('', '  mundo  '), 'mundo');
  assert.equal(unirDictado('hola', '   '), 'hola');
  assert.equal(unirDictado(undefined, 'a  b'), 'a b');
});

test('insertarEn: en el cursor, con espacio solo donde hace falta y sin pisar la puntuación', () => {
  assert.deepEqual(insertarEn('', 0, 0, 'hola'), { valor: 'hola', caret: 4 });
  assert.deepEqual(insertarEn('hola', 4, 4, 'mundo'), { valor: 'hola mundo', caret: 10 });
  assert.equal(insertarEn('hola mundo', 5, 5, 'querido').valor, 'hola querido mundo');
  assert.equal(insertarEn('hola.', 4, 4, 'amigo').valor, 'hola amigo.');
  assert.equal(insertarEn('uno tres', 4, 8, 'dos').valor, 'uno dos'); // reemplaza lo seleccionado
  assert.equal(insertarEn('abc', 99, 99, 'x').valor, 'abc x'); // un cursor fuera de rango se acota
  assert.equal(insertarEn('abc', 1, 1, '   ').valor, 'abc');
  assert.equal(insertarEn('abc', undefined, undefined, 'x').valor, 'abc x');
});

test('leerResultados: cada frase final se entrega UNA vez; lo provisional se reemplaza entero', () => {
  const vistos = new Set();
  let r = leerResultados(res(['hola ', true], ['como est', false]), 0, vistos);
  assert.deepEqual(r, { final: 'hola', provisional: 'como est' });
  r = leerResultados(res(['hola ', true], ['como estás', true]), 0, vistos);
  assert.deepEqual(r, { final: 'como estás', provisional: '' }); // «hola» no se repite
  r = leerResultados(res(['hola ', true], ['como estás', true]), 0, vistos);
  assert.equal(r.final, '');
  assert.equal(leerResultados(res(['viejo', true], ['nuevo', true]), 1, new Set()).final, 'nuevo'); // resultIndex: lo anterior ya se entregó
});

test('idiomaDictado: el elegido, el del navegador si es español, o español latino', () => {
  assert.equal(idiomaDictado('es-PA'), 'es-PA');
  assert.equal(idiomaDictado('en-US'), 'es-419');
  assert.equal(idiomaDictado('en-US', 'es-MX'), 'es-MX');
  assert.equal(idiomaDictado(undefined, 'basura!'), 'es-419');
  assert.equal(idiomaDictado('es'), 'es');
});

test('el dictado: empieza, entrega frases finales una vez y lo provisional aparte', () => {
  const { SR, ultima } = falso(); const finales = [], prov = [], estados = [];
  const d = crearDictado({ SR, alFinal: (t) => finales.push(t), alProvisional: (t) => prov.push(t), alEstado: (e) => estados.push(e) });
  d.empezar(); d.empezar(); // pulsar dos veces seguidas no abre dos sesiones
  assert.equal(d.escuchando, true); assert.deepEqual(estados, [true]);
  const r = ultima(); assert.equal(r.lang, 'es-419'); assert.equal(r.continuous, true); assert.equal(r.interimResults, true);
  r.onresult({ resultIndex: 0, results: res(['buenos días', false]) });
  r.onresult({ resultIndex: 0, results: res(['buenos días a todos', true]) });
  r.onresult({ resultIndex: 0, results: res(['buenos días a todos', true]) }); // el mismo evento otra vez
  assert.deepEqual(finales, ['buenos días a todos']);
  assert.equal(prov[0], 'buenos días');
});

test('si el navegador corta la sesión, se reenciende mientras no se haya pulsado parar', () => {
  const { SR, sesiones } = falso(); const finales = [];
  const d = crearDictado({ SR, alFinal: (t) => finales.push(t) });
  d.empezar();
  sesiones[0].onresult({ resultIndex: 0, results: res(['uno', true]) });
  sesiones[0].onend(); // el navegador la cortó
  assert.equal(sesiones.length, 2, 'se abrió otra');
  sesiones[1].onresult({ resultIndex: 0, results: res(['dos', true]) }); // sesión nueva: lista de resultados nueva, nada se repite
  assert.deepEqual(finales, ['uno', 'dos']);
  d.parar(); sesiones[1].onend();
  assert.equal(sesiones.length, 2, 'parar de verdad no reenciende');
  assert.equal(d.escuchando, false);
});

test('cortes seguidos sin oír nada: tope y mensaje, no un bucle', () => {
  const { SR, sesiones } = falso(); const errores = []; let t = 0;
  const d = crearDictado({ SR, alFinal() {}, alError: (m) => errores.push(m), ahora: () => (t += 10) }); // cada sesión dura 10 ms < SESION_CORTA_MS
  d.empezar();
  for (let i = 0; i < MAX_REENCENDIDOS_VACIOS + 2 && d.escuchando; i++) sesiones.at(-1).onend();
  assert.equal(d.escuchando, false);
  assert.equal(sesiones.length, MAX_REENCENDIDOS_VACIOS);
  assert.match(errores[0], /una y otra vez/);
  assert.ok(SESION_CORTA_MS > 10);
});

test('una sesión larga o que oyó algo no cuenta como corte enseguida', () => {
  const { SR, sesiones } = falso(); let t = 0;
  const d = crearDictado({ SR, alFinal() {}, ahora: () => t });
  d.empezar();
  for (let i = 0; i < 12; i++) { sesiones.at(-1).onresult({ resultIndex: 0, results: res(['x' + i, true]) }); t += 50; sesiones.at(-1).onend(); }
  assert.equal(d.escuchando, true);
});

test('errores del navegador: en español y sin reencender; no-speech y aborted no son errores', () => {
  const { SR, ultima } = falso(); const errores = [];
  const d = crearDictado({ SR, alFinal() {}, alError: (m) => errores.push(m) });
  d.empezar(); ultima().onerror({ error: 'no-speech' }); ultima().onerror({ error: 'aborted' });
  assert.equal(d.escuchando, true); assert.deepEqual(errores, []);
  ultima().onerror({ error: 'not-allowed' });
  assert.equal(d.escuchando, false);
  assert.match(errores[0], /Permiso de micrófono denegado/);
  const e2 = []; const d2 = crearDictado({ SR, alFinal() {}, alError: (m) => e2.push(m) });
  d2.empezar(); ultima().onerror({ error: 'raro' }); assert.match(e2[0], /raro/);
});

test('cortar (al enviar) ignora lo que llegue después; parar deja entrar la última frase', () => {
  const { SR, ultima } = falso(); const finales = [];
  const d = crearDictado({ SR, alFinal: (t) => finales.push(t) });
  d.empezar(); const r = ultima();
  d.cortar(); r.onresult({ resultIndex: 0, results: res(['tarde', true]) });
  assert.deepEqual(finales, [], 'una frase tardía no aparece sola en la caja vacía');
  const d2 = crearDictado({ SR, alFinal: (t) => finales.push(t) });
  d2.empezar(); const r2 = ultima(); d2.parar(); r2.onresult({ resultIndex: 0, results: res(['última', true]) });
  assert.deepEqual(finales, ['última']);
});

test('si start() falla, lo dice y se queda parado', () => {
  const errores = [];
  class Roto { start() { throw new Error('ocupado'); } stop() {} }
  const d = crearDictado({ SR: Roto, alFinal() {}, alError: (m) => errores.push(m) });
  d.empezar();
  assert.equal(d.escuchando, false); assert.match(errores[0], /No se pudo iniciar/);
});

test('esCampoDictable: texto sí; contraseñas, búsquedas, números, solo lectura y lo marcado, no', () => {
  const campo = (tag, attrs = {}, dentro = false) => ({ tagName: tag, readOnly: !!attrs.readOnly, disabled: !!attrs.disabled, getAttribute: (k) => attrs[k] ?? null, closest: () => (dentro ? {} : null) });
  assert.equal(esCampoDictable(campo('TEXTAREA')), true);
  assert.equal(esCampoDictable(campo('INPUT')), true);
  assert.equal(esCampoDictable(campo('INPUT', { type: 'text' })), true);
  for (const t of ['password', 'search', 'email', 'number', 'date', 'time', 'url', 'checkbox', 'file']) assert.equal(esCampoDictable(campo('INPUT', { type: t })), false, t);
  assert.equal(esCampoDictable(campo('TEXTAREA', { readOnly: true })), false);
  assert.equal(esCampoDictable(campo('TEXTAREA', { disabled: true })), false);
  assert.equal(esCampoDictable(campo('TEXTAREA', {}, true)), false); // dentro de [data-no-dictar]
  assert.equal(esCampoDictable(campo('INPUT', { role: 'combobox' })), false);
  assert.equal(esCampoDictable(campo('INPUT', { autocomplete: 'username' })), false);
  assert.equal(esCampoDictable(campo('DIV')), false);
  assert.equal(esCampoDictable(null), false);
});

test('cargarDictado: sin SpeechRecognition (Firefox) no baja nada; con él, pide dictado.js en reposo', () => {
  const pedidos = [];
  const doc = { createElement: () => ({ remove() {} }), head: { appendChild: (s) => pedidos.push(s.src) } };
  assert.equal(cargarDictado(doc, { setTimeout: (f) => f() }), false);
  assert.deepEqual(pedidos, []);
  assert.equal(cargarDictado(doc, { webkitSpeechRecognition: function () {}, setTimeout: (f) => f() }), true);
  assert.deepEqual(pedidos, ['dictado.js']);
  let plazo = null; // con requestIdleCallback pide un plazo: una página que anima sin parar nunca está «en reposo»
  cargarDictado(doc, { SpeechRecognition: function () {}, requestIdleCallback: (f, o) => { plazo = o; f(); } });
  assert.ok(plazo?.timeout > 0);
});

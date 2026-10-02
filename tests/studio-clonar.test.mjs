// La clonación de voz como un flujo guiado (src/studio-clonar.js, auditoría EST-01…EST-22): precios iguales a los del servidor,
// el guion para leer, el medidor en dBFS y sus zonas, lo que significa una toma, el id que pone la oficina, lo que falta antes de
// «Clonar» y qué hacer ante cada error de MiniMax. Y que ningún texto del Estudio mande a un «paso N» escrito a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../src/studio-clonar.js';
import { PRICE } from '../minimax-voices.mjs';
import { suggestVoiceId, checkVoiceId } from '../src/studio-voz.js';
import { VOICE_ID_RE } from '../minimax.mjs';

test('los precios del panel son los que cobra el servidor (minimax-voices.mjs PRICE)', () => {
  assert.deepEqual(C.PRICE, PRICE);
  assert.equal(C.usd(1.5), 'US$1.50');
  assert.equal(C.usd(C.designCost(40)), 'US$3.00');
  assert.ok(C.designCost(500) > 3 && C.designCost(500) < 3.02);
});

test('tres pasos, un aviso de verificación y una casilla de permiso', () => {
  assert.deepEqual(C.STEPS, ['Graba o sube tu voz', 'Escúchalo', 'Ponle nombre y clona']);
  assert.match(C.TIP, /1 a 2 minutos/); assert.doesNotMatch(C.TIP, /20 MB|M4A/);
  assert.match(C.VERIFIED, /verificad/); assert.match(C.CONSENT, /permiso/);
});

test('el guion: tres textos de ~90 s en voz alta, con preguntas, cifras y exclamaciones', () => {
  assert.equal(C.SCRIPTS.length, 3);
  for (const s of C.SCRIPTS) {
    const words = s.split(/\s+/).length;
    assert.ok(words >= 150 && words <= 260, `~90 s de lectura (${words} palabras)`);
    assert.match(s, /¿[^?]+\?/); assert.match(s, /¡[^!]+!/);
    assert.doesNotMatch(s, /\d/, 'las cifras van en palabras: se leen igual que se dicen');
  }
  assert.equal(C.scriptAt(4), C.SCRIPTS[1]); assert.equal(C.scriptAt(-1), C.SCRIPTS[2]);
});

const frame = (amp, n = 512) => Uint8Array.from({ length: n }, (_, i) => Math.max(0, Math.min(255, Math.round(128 + amp * 127 * Math.sin(i / 8)))));
test('el medidor: silencio, bajo, bien y satura, en dBFS (antes, el 71 % del pico ya llenaba la barra en verde)', () => {
  assert.equal(C.levelZone(C.frameLevel(frame(0))).zone, 'silence');
  assert.equal(C.levelZone(C.frameLevel(frame(0.02))).zone, 'low');
  const ok = C.frameLevel(frame(0.4)); assert.equal(C.levelZone(ok).zone, 'ok'); assert.ok(C.meterPct(ok.db) > 50 && C.meterPct(ok.db) < 100);
  const hot = C.frameLevel(frame(1.2)); assert.ok(hot.clip > 0); assert.equal(C.levelZone(hot).zone, 'clip'); assert.match(C.levelZone(hot).label, /aléjate/);
  assert.equal(C.meterPct(-90), 0); assert.equal(C.meterPct(0), 100);
});

test('la toma: cuenta las veces que satura y el silencio, y lo dice al parar', () => {
  const st = C.newStats();
  for (let k = 0; k < 4; k++) { C.addFrame(st, C.frameLevel(frame(1.2))); C.addFrame(st, C.frameLevel(frame(0.4))); }
  for (let k = 0; k < 20; k++) C.addFrame(st, C.frameLevel(frame(0.4)));
  assert.equal(st.clipEvents, 4);
  assert.match(C.takeVerdict(st).text, /Saturó 4 veces/);
  const quiet = C.newStats(); for (let k = 0; k < 10; k++) C.addFrame(quiet, C.frameLevel(frame(0)));
  assert.match(C.takeVerdict(quiet).text, /silencio/);
  const good = C.newStats(); for (let k = 0; k < 10; k++) C.addFrame(good, C.frameLevel(frame(0.4)));
  assert.equal(C.takeVerdict(good).level, 'good');
});

test('el lector de pantalla oye el tiempo cada 30 s, una vez', () => {
  assert.equal(C.announce(12, 0), null);
  assert.deepEqual(C.announce(31, 0), { at: 30, text: 'Grabando: 0:30, quedan 4:30.' });
  assert.equal(C.announce(45, 30), null);
  assert.equal(C.announce(61, 30).at, 60);
});

test('la duración en una frase (antes decía dos veces lo mismo)', () => {
  assert.equal(C.lengthLine(420).text, 'Lo recorté a los primeros 5:00 (el máximo de MiniMax). Listo para clonar.');
  assert.equal(C.lengthLine(5).ok, false);
  assert.equal(C.lengthLine(30).level, 'short');
  assert.equal(C.lengthLine(95).text, 'Dura 1:35: muy bien.');
});

test('el id lo pone la oficina: válido para MiniMax, legible y nunca repetido', () => {
  const now = Date.UTC(2026, 9, 1);
  const a = C.autoVoiceId('Mi voz', [], now);
  assert.match(a, /^Voz_MiVoz_[0-9a-z]+$/); assert.ok(VOICE_ID_RE.test(a)); assert.ok(C.VOICE_ID_RE.test(a)); assert.ok(checkVoiceId(a).ok);
  assert.notEqual(C.autoVoiceId('Mi voz', [a], now), a);
  for (const n of ['', 'é', '1 voz', 'Ñoño Pérez de la Peña y Asociados Internacionales']) assert.ok(VOICE_ID_RE.test(C.autoVoiceId(n, [], now)), n);
  assert.equal(suggestVoiceId('Mi voz'), 'MiVozx01', 'se rellena antes de numerar (antes «MiVoz010»)');
});

test('lo que falta antes de «Clonar», dicho junto al botón', () => {
  assert.equal(C.missing({}), 'Falta: grabar o elegir un audio · ponerle un nombre · marcar la casilla del permiso.');
  assert.equal(C.missing({ audio: true, audioOk: false, name: 'x', consent: true }), 'Falta: un audio de al menos 10 segundos.');
  assert.equal(C.missing({ audio: true, name: 'Mi voz', consent: true }), '');
});

test('cada error de MiniMax dice qué hacer', () => {
  assert.equal(C.cloneAdvice('MiniMax clonar voz: tu cuenta de MiniMax no tiene permiso para clonar voces: verifica la cuenta en platform.minimax.io').code, 'verify');
  assert.equal(C.cloneAdvice('MiniMax clonar voz: tu cuenta de MiniMax no tiene saldo: recarga en platform.minimax.io').code, 'balance');
  assert.equal(C.cloneAdvice('ese nombre de voz (voiceId) ya existe en MiniMax: elige otro').code, 'dup');
  assert.equal(C.cloneAdvice('MiniMax clonar voz: 1043 ASR similarity check failed').code, 'quality');
  assert.equal(C.cloneAdvice('MiniMax clonar voz: el audio para clonar debe durar entre 10 segundos y 5 minutos').code, 'length');
  assert.equal(C.cloneAdvice('la key de MiniMax no es válida: revisa MINIMAX_API_KEY').code, 'key');
  const o = C.cloneAdvice('MiniMax clonar voz: Algo raro'); assert.equal(o.code, 'other'); assert.equal(o.text, 'No se pudo clonar: algo raro');
});

test('ningún texto del Estudio manda al paso 4 o 5 por su número (se renumeran: en Voz, el paso 5 es el 4)', () => {
  const src = fs.readFileSync(new URL('../src/studio.js', import.meta.url), 'utf8');
  const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /paso [4-9]/i.test(l.replace(/\/\/.*$/, '')));
  assert.deepEqual(hits.map(([n]) => n), [], 'usa el título del paso o stepNum()');
});

test('una toma sin clonar sigue al volver a abrir, la hayas dejado en el paso o en «‹ Voces» (revisión EST-02)', () => {
  const take = { seconds: 83, url: 'blob:x' };
  assert.equal(C.keepTake({ take, step: 2, screen: 'clone' }), true);
  assert.equal(C.keepTake({ take, step: 3, screen: 'home' }), true, 'pulsó «‹ Voces» en el paso 3 y cerró');
  assert.equal(C.keepTake({ take, step: 'done', screen: 'clone' }), false, 'ya clonada: se empieza de nuevo');
  assert.equal(C.keepTake({ take: null, step: 2 }), false);
  assert.equal(C.pendingLine({ take, step: 3, screen: 'home' }), 'Tienes un audio sin clonar (1:23): continúa en el paso 3.');
  assert.equal(C.pendingLine({ take: { url: 'x' }, step: 2 }), 'Tienes un audio sin clonar: continúa en el paso 2.');
  assert.equal(C.pendingLine({ take, step: 'done' }), '');
});

test('el panel: una prueba por clic, el guion con nombre, sin «‹ Voces» mudo al grabar (revisión EST)', () => {
  const src = fs.readFileSync(new URL('../src/studio.js', import.meta.url), 'utf8');
  assert.match(src, /if \(a === 'try' \|\| a === 'try-row'\) \{[^\n]*\n\s*b\.disabled = true;/, '«Probar esta voz» y «Probarla ahora» se apagan mientras generan');
  assert.match(src, /if \(a === 'try' \|\| !ok\) \{ b\.disabled = false;/, 'y vuelven si falló, para reintentar');
  assert.doesNotMatch(src.slice(src.indexOf('async function tryVoice'), src.indexOf('async function designVoice')), /return;/, 'tryVoice siempre dice si salió');
  assert.match(src, /class="st-vscript" role="region" tabindex="0" aria-label=/, 'aria-label en un div sin rol lo ignoran los lectores');
  assert.match(src, /const back = !S\.off && sc !== 'home' && !S\.rec \?/, 'mientras graba no se pinta un botón que no responde');
  assert.match(src, /const keep = VC\.keepTake\(vocState\)/);
});

// La voz y la música del Estudio en la página (src/studio-voz.js): los nombres de cada tipo, el límite del texto, el id de una
// voz clonada, las sugerencias del selector de voz, lo que dice una tarjeta de sonido y los filtros Voz y Música.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../src/studio-voz.js';

test('cada tipo tiene su botón, su paso 3 y su GENERAR', () => {
  assert.deepEqual(V.KINDS.map(k => V.words(k).btn), ['Imagen', 'Video', 'Voz', 'Música']);
  assert.equal(V.goLabel('audio', 1), 'GENERAR VOZ');
  assert.equal(V.goLabel('audio', 3), 'GENERAR 3 AUDIOS');
  assert.equal(V.goLabel('music', 1), 'GENERAR MÚSICA');
  assert.equal(V.goLabel('music', 2), 'GENERAR 2 PISTAS');
  assert.equal(V.goLabel('image', 2), 'GENERAR 2 IMÁGENES');
  assert.equal(V.countOf('music', 1), '1 pista');
  assert.equal(V.promptStep('audio').title, 'Texto que se lee');
  assert.equal(V.promptStep('music', false).title, 'Letra');
  assert.equal(V.promptStep('music', true).title, 'Descripción');
  assert.match(V.promptStep('music', false).placeholder, /\[Verse\][\s\S]*\[Chorus\]/);
  assert.ok(V.SOUND('audio') && V.SOUND('music') && !V.SOUND('image') && !V.SOUND('video'));
});

test('el límite del texto: el del modelo si lo dice; si no, el de MiniMax', () => {
  assert.equal(V.textLimit({ maxChars: 5000 }, 'audio'), 5000);
  assert.equal(V.textLimit({ limits: { text: 1200 } }, 'music', false), 1200);
  assert.equal(V.textLimit({}, 'audio'), 10000);
  assert.equal(V.textLimit(null, 'music', false), 3500);
  assert.equal(V.textLimit(null, 'music', true), 2000);
  assert.equal(V.textLimit(null, 'image'), 4000);
});

test('la cantidad máxima y el precio por unidad', () => {
  assert.equal(V.maxQty('video', 8), 4);
  assert.equal(V.maxQty('music', 8), 4);
  assert.equal(V.maxQty('audio', 6), 6);
  assert.equal(V.maxQty('audio'), 8);
  assert.equal(V.priceText({ kind: 'audio', cost: 0.02 }), '~US$0.02/audio');
  assert.equal(V.priceText({ kind: 'music', cost: 0.1 }), '~US$0.10/pista');
  assert.equal(V.priceText({ kind: 'video', cost: 0.05, per: 's' }), '~US$0.05/s');
  assert.equal(V.priceText({ kind: 'audio', cost: 0.0001, per: 'char' }), '~US$0.100/1000 car.');
  assert.equal(V.priceText({ kind: 'audio', cost: 0 }), 'gratis');
  assert.equal(V.unitCost({ cost: 0.0001, per: 'char' }, {}, 500), 0.05);
  assert.equal(V.unitCost({ cost: 0.1, per: 'kchar' }, {}, 2000), 0.2);
  assert.equal(V.unitCost({ cost: 0.05, per: 's' }, { duration: 6 }), 0.30000000000000004);
  assert.equal(V.unitCost({ cost: 0.02 }, {}, 9999), 0.02);
});

test('el id de una voz clonada: 8–256, empieza por letra, letras/números/-/_, no termina en - ni _', () => {
  for (const ok of ['VozPanaclaw01', 'a1234567', 'Marca-Voz_2026', 'A'.repeat(256)]) assert.equal(V.checkVoiceId(ok).ok, true, ok);
  const bad = { '': /Escribe/, abc: /faltan 5/, Abcdefg: /falta/, '1abcdefgh': /letra/, 'voz de panaclaw': /espacios/, 'VozPañaclaw': /«ñ»/, 'VozPanaclaw_': /terminar/, 'VozPanaclaw-': /terminar/, ['A'.repeat(257)]: /256/ };
  for (const [v, re] of Object.entries(bad)) { const r = V.checkVoiceId(v); assert.equal(r.ok, false, v); assert.match(r.error, re, v); }
  assert.equal(V.checkVoiceId(null).ok, false);
});

test('el id sugerido desde un nombre ya es válido y no repite uno tomado', () => {
  const a = V.suggestVoiceId('Voz de Pañaclaw');
  assert.equal(a, 'VozDePanaclaw01'); assert.ok(V.checkVoiceId(a).ok);
  assert.equal(V.suggestVoiceId('Voz de Pañaclaw', ['VozDePanaclaw01']), 'VozDePanaclaw02');
  for (const n of ['', '2026', 'é', 'Ana']) assert.ok(V.checkVoiceId(V.suggestVoiceId(n)).ok, n);
});

test('las voces llegan en cualquier forma y el selector las agrupa: las tuyas primero, sin repetir', () => {
  assert.deepEqual(V.normVoices(null), { mine: [], system: [] });
  assert.equal(V.normVoices([{ voiceId: 'x12345678' }, { name: 'sin id' }]).mine.length, 1);
  const voices = { voices: [{ voiceId: 'Vieja0001', name: 'Vieja', kind: 'design', at: 1 }, { voiceId: 'Nueva0001', name: 'Nueva', kind: 'clone', at: 2 }],
    system: [{ voiceId: 'Spanish_Narrator', name: 'Narrador', lang: 'Español' }, { voiceId: 'Nueva0001', name: 'repetida' }] };
  const g = V.voiceGroups(voices);
  assert.deepEqual(g.map(x => x.label), ['Tus voces', 'Voces de MiniMax']);
  assert.deepEqual(g[0].voices.map(v => [v.voiceId, v.line]), [['Nueva0001', 'clonada'], ['Vieja0001', 'diseñada']]);
  assert.deepEqual(g[1].voices.map(v => v.voiceId), ['Spanish_Narrator']);
  assert.deepEqual(V.voiceGroups({ system: [] }), []);
  // the page keeps them normalized ({ mine, system }) and passes them on: normalizing again must not lose the owner's
  const kept = V.normVoices(voices);
  assert.deepEqual(V.normVoices(kept), kept);
  assert.deepEqual(V.voiceGroups(kept).map(x => x.label), ['Tus voces', 'Voces de MiniMax']);
  assert.equal(V.voiceName('Nueva0001', kept), 'Nueva');
  assert.equal(V.voiceName('Spanish_Narrator', voices), 'Narrador');
  assert.equal(V.voiceName('Desconocida1', voices), 'Desconocida1');
  assert.equal(V.voiceKind({ kind: 'clone' }), 'Clonada');
});

test('una tarjeta de sonido: voz o música, qué se lee o se canta y con qué voz', () => {
  const voz = { kind: 'audio', file: 'a.mp3', prompt: 'Hola', settings: { voiceId: 'Spanish_Narrator' } };
  const song = { kind: 'audio', file: 'b.mp3', prompt: '[Verse] la la', wanted: 'music', settings: { instrumental: false } };
  const inst = { ...song, prompt: 'lo-fi', settings: { instrumental: true } };
  const up = { kind: 'audio', file: 'c.wav', prompt: 'reunión', upload: true };
  assert.equal(V.soundOf(voz), 'voice'); assert.equal(V.soundOf(song), 'music'); assert.equal(V.soundOf({ kind: 'image' }), null);
  assert.deepEqual(V.soundCaption(voz, { system: [{ voiceId: 'Spanish_Narrator', name: 'Narrador' }] }), { label: 'Texto leído', badge: 'VOZ', text: 'Hola', voice: 'Narrador', instrumental: false });
  assert.equal(V.soundCaption(song).label, 'Letra'); assert.equal(V.soundCaption(song).badge, 'MÚSICA');
  assert.equal(V.soundCaption(inst).label, 'Descripción');
  assert.equal(V.soundCaption(up).badge, 'AUDIO');
  assert.equal(V.soundCaption({ kind: 'image' }), null);
  assert.equal(V.kindOfItem(voz), 'audio'); assert.equal(V.kindOfItem(song), 'music'); assert.equal(V.kindOfItem({ kind: 'image', wanted: 'video' }), 'video'); assert.equal(V.kindOfItem({ kind: 'image' }), 'image');
});

test('los filtros Voz y Música separan los audios; los trabajos en curso también', () => {
  const its = [{ kind: 'audio', file: 'a.mp3' }, { kind: 'audio', file: 'b.mp3', wanted: 'music' }, { kind: 'image', file: 'c.png' }, { kind: 'audio', file: 'd.m4a', upload: true }];
  assert.equal(its.filter(x => V.soundFilter('voice', x)).length, 2);
  assert.equal(its.filter(x => V.soundFilter('music', x)).length, 1);
  assert.equal(its.filter(x => V.soundFilter('all', x)).length, 4);
  assert.ok(V.soundJobFilter('voice', { kind: 'audio' }) && !V.soundJobFilter('voice', { kind: 'music' }) && V.soundJobFilter('music', { kind: 'music' }));
  assert.deepEqual(V.cloneable([...its, { kind: 'audio', file: 'e.flac' }]).map(x => x.file), ['a.mp3', 'b.mp3', 'd.m4a']);
});

test('un audio para clonar: MP3, WAV o M4A, hasta 20 MB', () => {
  assert.equal(V.checkCloneFile({ name: 'voz.mp3', type: 'audio/mpeg', size: 200000 }), '');
  assert.equal(V.checkCloneFile({ name: 'voz.m4a', type: '', size: 200000 }), '');
  assert.match(V.checkCloneFile({ name: 'voz.ogg', type: 'audio/ogg', size: 200000 }), /MP3, WAV o M4A/);
  assert.match(V.checkCloneFile({ name: 'voz.wav', type: 'audio/wav', size: 21 * 1024 * 1024 }), /20 MB/);
  assert.match(V.checkCloneFile({ name: 'voz.wav', type: 'audio/wav', size: 10 }), /corto/);
  assert.match(V.checkCloneFile(null), /Elige/);
});

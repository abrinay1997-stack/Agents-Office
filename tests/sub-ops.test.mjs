// src/sub-ops.js (V4.11): the cards of Dimitri's ops and his questions with options, as HTML, and the bodies the page posts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opsHTML, opsBody, opLabel, questionsHTML, pickBody, pastChoices, UNDO_MS } from '../src/sub-ops.js';
import { stripHTML, creativesHTML, planTotal, promptLabel, KIND } from '../src/sub-studio.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const Q = [{ id: 'producto', q: '¿Qué producto va?', options: [{ label: 'Combo 2x1 (recomendado)', value: 'Combo 2x1' }, { label: 'Peluches', value: 'Peluches' }], multi: false, other: true },
  { id: 'redes', q: '¿En qué redes?', options: [{ label: 'Instagram', value: 'instagram' }, { label: 'Facebook', value: 'facebook' }], multi: true, other: false }, { id: 'precio', q: '¿A qué precio?', options: [] }];

test('questions: radio groups and checkbox groups of real buttons, «Otra…», RESPONDER only when every one is answered', () => {
  const m = { id: 'm1', plan: { tasks: [], questions: Q } };
  const h = questionsHTML(m, new Map(), { esc });
  assert.match(h, /role="radiogroup" aria-labelledby="sbq-m1-producto"/); assert.match(h, /role="group" aria-labelledby="sbq-m1-redes"/);
  assert.equal((h.match(/class="sb-opt"/g) || []).length, 4); assert.match(h, /class="sb-opt sb-other" role="radio"/); assert.doesNotMatch(h, /sb-other" role="checkbox"/, 'no «Otra» where other: false');
  assert.match(h, /Lo demás, escríbelo abajo/, 'the open question is answered in the box');
  assert.match(h, /class="sb-qgo" data-msg="m1" disabled/);
  const picks = new Map([['producto', { values: ['Combo 2x1'], other: '', otherOn: false }], ['redes', { values: ['instagram', 'facebook'], other: '', otherOn: false }]]);
  const h2 = questionsHTML(m, picks, { esc });
  assert.match(h2, /data-v="Combo 2x1" aria-checked="true"/); assert.doesNotMatch(h2, /class="sb-qgo" data-msg="m1" disabled/);
  assert.match(questionsHTML(m, picks, { esc, busy: true }), /aria-disabled="true"/, 'locked while it is being sent');
  const b = pickBody('m1', Q, picks);
  assert.deepEqual(b.answers, { msg: 'm1', picks: [{ id: 'producto', value: 'Combo 2x1' }, { id: 'redes', values: ['instagram', 'facebook'] }] });
  assert.equal(b.text, 'Producto: Combo 2x1 · Redes: Instagram, Facebook');
  const other = pickBody('m1', Q, new Map([['producto', { values: [], other: 'El nuevo peluche', otherOn: true }]]));
  assert.deepEqual(other.answers.picks, [{ id: 'producto', value: 'El nuevo peluche' }]);
});

test('an answered question shows what was chosen, locked; a plain string question still draws', () => {
  const m = { id: 'm2', plan: { tasks: [], questions: Q.slice(0, 1), answers: [{ id: 'producto', values: ['Peluches'], label: 'Peluches' }] } };
  const h = questionsHTML(m, new Map(), { esc });
  assert.match(h, /data-v="Peluches" aria-checked="true" aria-disabled="true"/); assert.doesNotMatch(h, /sb-qgo/); assert.match(h, /sb-q done/);
  assert.match(questionsHTML({ id: 'm3', plan: { questions: ['¿Para cuándo?'] } }, new Map(), { esc }), /¿Para cuándo\?[\s\S]*Contéstame abajo/);
});

test('ops: a card per op with its fields, HACER counts what is included; done ones offer DESHACER for 30 s', () => {
  const now = Date.parse('2026-10-01T10:00:00');
  const m = { id: 'm1', ops: [
    { k: 0, type: 'rutina_crear', dept: 'fin', text: 'Resumen de cobros', title: 'Resumen de cobros', when: { kind: 'weekly', days: [1, 4], at: '09:00' }, needsOk: true, state: 'proposed' },
    { k: 1, type: 'pieza_crear', titulo: 'Combo', fecha: '2026-10-09', hora: '18:00', formato: 'reel', redes: ['instagram'], texto: 'Ven', state: 'proposed' },
    { k: 2, type: 'tarea_cancelar', id: 't1', title: 'Post viejo', state: 'done', doneAt: now - 1000 },
    { k: 3, type: 'tarea_mover', id: 't2', title: 'Post', at: now + 864e5, state: 'done', doneAt: now - UNDO_MS - 1 }] };
  const ed = new Map([[1, { include: false }]]);
  const h = opsHTML(m, { esc, edits: ed, deptName: k => ({ fin: 'Finanzas' })[k], now });
  assert.match(h, /Rutina nueva en Finanzas: «Resumen de cobros»/); assert.match(h, /cada lunes, jueves a las 09:00/);
  assert.match(h, /class="so-day" data-d="1" aria-pressed="true" aria-label="lunes">L</); assert.match(h, /data-d="0" aria-pressed="false" aria-label="domingo">D</);
  assert.match(h, /Borrador en Contenido: .* · 18:00 · reel IG — «Combo»/); assert.match(h, /no se hace/);
  assert.match(h, /HACER \(1\)/);
  assert.match(h, /class="so-undo" data-msg="m1" data-k="2"/); assert.doesNotMatch(h, /data-k="3">Deshacer/, 'past its 30 s');
  const b = opsBody('m1', m.ops, new Map([[0, { when: { kind: 'weekly', days: [1], at: '08:00' } }], [1, { include: false }]]));
  assert.deepEqual(b, { msg: 'm1', items: [{ k: 0, include: true, when: { kind: 'weekly', days: [1], at: '08:00' } }, { k: 1, include: false }] });
  assert.deepEqual(opsBody('m1', m.ops, new Map(), true).items.map(i => i.include), [false, false]);
  assert.equal(opLabel({ type: 'publicar' }), '');
});

test('a time that already went: «mañana a la misma hora» is the next one still to come', () => {
  const now = Date.parse('2026-10-01T10:00:00'), at = Date.parse('2026-09-30T09:00:00');
  assert.equal(pastChoices(at, now).tomorrow, Date.parse('2026-10-02T09:00:00'));
});

test('a voice-over or a jingle is never «IMAGEN»: its own label, text field, voice picker, and a player in the strip (DIM-02)', () => {
  assert.equal(KIND.audio, 'VOZ'); assert.equal(KIND.music, 'MÚSICA');
  assert.equal(promptLabel('audio'), 'Texto que se dirá'); assert.equal(promptLabel('music', { instrumental: true }), 'Descripción de la pieza'); assert.match(promptLabel('music', {}), /^Letra/);
  const s = stripHTML(['2026-10/locucion.mp3', '2026-10/a.png'], esc);
  assert.match(s, /<audio controls preload="none" src="\/media\/2026-10\/locucion\.mp3"/); assert.doesNotMatch(s, /<img src="\/media\/2026-10\/locucion/);
  const VOZ = { id: 'speech', kind: 'audio', name: 'Speech', on: true, perChar: 0.0001, cost: 0.1, settings: { voiceId: { type: 'text', default: 'Spanish_Narrator' }, emotion: { type: 'enum', values: ['', 'happy'], default: '' }, speed: { type: 'range', min: 0.5, max: 2, step: 0.05, default: 1 } } };
  const MUS = { id: 'mus', kind: 'music', name: 'Música', on: true, cost: 0.15, settings: { instrumental: { type: 'boolean', default: false }, style: { type: 'text', max: 2000, default: '' } } };
  const m = { id: 'm1', studio: { creatives: [
    { i: 0, title: 'Locución', kind: 'audio', model: 'speech', modelName: 'Speech', n: 1, prompt: 'Hola PanaClaw', prompt_es: 'Hola PanaClaw', settings: { voiceId: 'voz-mia' }, state: 'proposed', cost: 0.0013 },
    { i: 1, title: 'Jingle', kind: 'music', model: 'mus', modelName: 'Música', n: 1, prompt: 'upbeat', settings: { instrumental: true, style: 'reggaetón' }, state: 'proposed', cost: 0.15 }], actions: [] } };
  const h = creativesHTML(m, { esc, models: [VOZ, MUS], voices: { voices: [{ voiceId: 'voz-mia', name: 'Abrinay', kind: 'clone' }], system: [{ voiceId: 'Spanish_Narrator', name: 'Narrador' }] } });
  assert.match(h, /Locución <span class="sc-kind">VOZ<\/span>/); assert.match(h, /Jingle <span class="sc-kind">MÚSICA<\/span>/); assert.doesNotMatch(h, /IMAGEN/);
  assert.match(h, />Texto que se dirá</); assert.match(h, />Descripción de la pieza</); assert.doesNotMatch(h, /En español:/);
  assert.match(h, /<optgroup label="Tus voces"><option value="voz-mia" selected>Abrinay · clonada/); assert.match(h, /data-k="emotion"/); assert.match(h, /data-k="speed" type="number"/);
  assert.match(h, /data-k="instrumental" checked/); assert.match(h, /data-k="style"[^>]*value="reggaetón"/);
  assert.equal(planTotal(m.studio.creatives, new Map(), [VOZ, MUS]).weight, 1 + 3, 'a music weighs 3 against the day\'s cap, as on the server');
  assert.equal(planTotal(m.studio.creatives.slice(0, 1), new Map([[0, { prompt: 'x'.repeat(1000) }]]), [VOZ]).total, 0.1, 'a voice-over costs by the characters left in the text');
});

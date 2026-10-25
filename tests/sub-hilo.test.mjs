// Dimitri en sesiones largas (23 oct 2026): el HILO, un resumen rodante SIN modelo de lo que ya no cabe en el historial. Puro (sub-core.mjs) y su persistencia local (sub.mjs).
// Sin el cambio, MAX=120 mensajes se guardaban y a los 12 últimos se sumaban 14 líneas de «pedidos» de 110 caracteres: lo que el dueño DECIDIÓ (las opciones que tocó, lo que
// descartó) o pidió recordar se perdía a los pocos turnos, y Dimitri volvía a preguntar lo mismo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as sub from '../sub.mjs';

const DEPTS = { marketing: { name: 'Marketing' }, sales: { name: 'Ventas' }, brain: { name: 'Cerebro' } };
const AGENTS = [{ id: 'mia', department: 'marketing', lead: true, name: 'MIA' }];
const u = (text, extra = {}) => ({ id: 'u' + Math.random().toString(36).slice(2, 7), who: 'user', text, at: Date.now(), ...extra });
const d = (text, extra = {}) => ({ id: 'd' + Math.random().toString(36).slice(2, 7), who: 'sub', text, at: Date.now(), ...extra });
/** Una sesión larga: lo importante está al principio, después 130 vueltas de relleno (con preguntas contestadas, piezas enviadas y cambios hechos de vez en cuando). */
function sesion(vueltas = 130) {
  const ms = [
    u('Siempre escribe con tono cercano y nunca menciones precios en redes. Mi presupuesto de anuncios es US$500.'), d('Entendido.'),
    d('Me falta un dato.', { plan: { tasks: [], questions: [{ id: 'p', q: '¿Qué producto va?', options: [{ label: 'Combo', value: 'Combo' }, { label: 'Peluches', value: 'Peluches' }] }], answers: [{ id: 'p', q: '¿Qué producto va?', label: 'Peluches' }] } }),
    u('Producto: Peluches', { answers: { msg: 'x', picks: [{ id: 'p', q: '¿Qué producto va?', label: 'Peluches' }] } }),
    d('Te propongo dos piezas.', { plan: { tasks: [{ dept: 'marketing', title: 'Post de peluches', state: 'sent' }, { dept: 'sales', title: 'Llamar a Juan', state: 'skipped' }], questions: [] } }),
    d('Hecho.', { ops: [{ type: 'rutina_pausar', id: 'cobros-lunes', state: 'done' }] }),
  ];
  for (let i = 0; i < vueltas; i++) ms.push(u('Pedido de relleno ' + i), d('Respuesta ' + i));
  return ms;
}

test('plegarHilo: lo que decidió, lo que descartó, lo que pidió recordar y lo hecho; acotado y sin repetir', () => {
  const h = sub.plegarHilo(null, sesion(0).slice(0, 6), { depts: DEPTS });
  assert.ok(h.prefs.some((x) => /nunca menciones precios/.test(x)), 'una preferencia con «siempre/nunca» se guarda');
  assert.ok(h.decisions.includes('¿Qué producto va? → Peluches'), 'la opción que tocó es una decisión, no un «pedido»');
  assert.ok(h.decisions.some((x) => /descartaste la pieza «Llamar a Juan»/.test(x)), 'lo que descartó, para no volver a proponerlo');
  assert.ok(h.hechos.includes('envié a Marketing: Post de peluches') && h.hechos.some((x) => /hice rutina_pausar cobros-lunes/.test(x)));
  assert.ok(h.ids.includes('cobros-lunes (rutina_pausar)'));
  assert.ok(!h.asks.some((x) => /^Producto: Peluches/.test(x)), 'la respuesta a una pregunta no es un pedido');
  // acotado: 500 mensajes no hacen crecer el resumen
  const grande = sub.plegarHilo(null, sesion(500), { depts: DEPTS });
  for (const k of ['asks', 'prefs', 'decisions', 'hechos', 'ids']) assert.ok(grande[k].length <= 10, k);
  assert.ok(JSON.stringify(grande).length < 3000, 'el resumen guardado es pequeño: ' + JSON.stringify(grande).length);
  // plegar dos veces lo mismo no duplica
  const dos = sub.plegarHilo(sub.plegarHilo(null, sesion(0), { depts: DEPTS }), sesion(0), { depts: DEPTS });
  assert.equal(dos.prefs.length, 1); assert.equal(new Set(dos.decisions).size, dos.decisions.length);
  assert.deepEqual(sub.plegarHilo(undefined, [null, 5, {}]).asks, [], 'basura no rompe nada');
});

test('hiloText: una sesión de 260 mensajes todavía recuerda lo del primer turno, dentro de su tope', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-hilo-'));
  try {
    // como en el servidor: cada turno carga, añade dos mensajes y guarda (el archivo sostiene MAX y pliega lo demás)
    const todo = sesion(130);
    for (let i = 0; i < todo.length; i += 2) { const st = sub.load(dir); st.messages.push(...todo.slice(i, i + 2)); sub.save(dir, st, { depts: DEPTS }); }
    const st = sub.load(dir);
    assert.equal(st.messages.length, sub.MAX); assert.ok(!st.messages.some((m) => /Siempre escribe con tono cercano/.test(m.text)), 'el primer mensaje ya no está entre los guardados');
    assert.ok(st.hilo && st.hilo.n >= todo.length - sub.MAX, 'pero SÍ en el resumen: ' + JSON.stringify(st.hilo?.prefs));
    const w = sub.historyWindow(st.messages, { name: 'Dimitri', depts: DEPTS }, 12);
    const hilo = sub.hiloText(st.messages, st.hilo, { depts: DEPTS, shown: w.shown });
    assert.match(hilo, /nunca menciones precios en redes/); assert.match(hilo, /Lo que el dueño ya DECIDIÓ[\s\S]*¿Qué producto va\? → Peluches/);
    assert.match(hilo, /descartaste la pieza «Llamar a Juan»/); assert.match(hilo, /cobros-lunes/);
    assert.ok(hilo.length <= sub.HILO_MAX, 'cabe en su tope: ' + hilo.length);
    // y entra al prompt como DATOS, antes del Estudio
    const s = sub.systemPrompt({ name: 'Dimitri', business: 'PanaClaw', depts: DEPTS, agents: AGENTS, skillsOf: () => [], routineDepts: ['Marketing (marketing)'], status: 'x', hilo, studioBlock: 'ESTUDIO-X' });
    assert.match(s, /<hilo>\nEsta sesión lleva/); assert.ok(s.indexOf('<hilo>') < s.indexOf('<estudio>'));
    assert.doesNotMatch(sub.systemPrompt({ name: 'D', business: 'P', depts: DEPTS, agents: AGENTS, skillsOf: () => [], routineDepts: [], status: 'x' }), /<hilo>\n/, 'sin hilo, sin etiqueta');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('hiloText: una charla corta no gasta nada; lo pendiente sale del estado VIVO', () => {
  const corta = [u('hola'), d('qué tal')];
  assert.equal(sub.hiloText(corta, null, { depts: DEPTS }), '');
  const ms = [...corta, d('Dos piezas.', { plan: { tasks: [{ dept: 'marketing', title: 'Post A' }, { dept: 'sales', title: 'Llamada B', state: 'sent' }], questions: [] }, ops: [{ type: 'pieza_mover', id: 'p-9', state: 'proposed' }] }),
    d('¿Qué red?', { plan: { tasks: [], questions: [{ id: 'r', q: '¿Qué red?' }] } }), u('mejor dime otra cosa')];
  const t = sub.hiloText(ms, null, { depts: DEPTS, shown: 2 });
  assert.match(t, /Sigue pendiente:[\s\S]*1 pieza sin enviar \(Post A → Marketing\)/); assert.match(t, /1 cambio sin hacer \(pieza_mover p-9\)/); assert.match(t, /pregunté y no respondiste: ¿Qué red\?/);
  assert.doesNotMatch(t.split('Sigue pendiente:')[1], /Llamada B/, 'lo enviado no es pendiente'); assert.match(t, /envié a Ventas: Llamada B/);
});

test('historyWindow: una línea enorme se corta y, si la ventana pasa su tope, se van primero las MÁS VIEJAS (y el hilo las recoge)', () => {
  const gordo = (i) => d('respuesta ' + i, { studio: { creatives: Array.from({ length: 8 }, (_, k) => ({ title: 'C' + k, kind: 'image', model: 'nano', state: 'done', prompt: 'x'.repeat(400), files: ['a/b.png'] })) } });
  const ms = Array.from({ length: 12 }, (_, i) => (i % 2 ? gordo(i) : u('pedido ' + i + ' ' + 'y'.repeat(3000))));
  const w = sub.historyWindow(ms, { name: 'Dimitri', depts: DEPTS }, 12);
  assert.ok(w.text.length <= sub.HISTORY_MAX + 20, 'tope: ' + w.text.length); assert.ok(w.shown >= 2 && w.shown < 12, 'cuántas entraron: ' + w.shown);
  assert.ok(w.text.split('\n').every((l) => l.length <= sub.HISTORY_LINE), 'ninguna línea pasa su tope');
  assert.match(w.text, /respuesta 11/, 'la última siempre está');
  const hilo = sub.hiloText(ms, null, { depts: DEPTS, shown: w.shown });
  assert.match(hilo, /pedido 0 /, 'lo que la ventana soltó está en el hilo');
  assert.equal(sub.historyWindow([], {}, 12).text, '');
});

test('archivar, restaurar y abrir llevan el hilo de SU conversación (local)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-hilo2-'));
  try {
    const A = sesion(100); for (let i = 0; i < A.length; i += 2) { const st = sub.load(dir); st.messages.push(...A.slice(i, i + 2)); sub.save(dir, st); }
    assert.match(JSON.stringify(sub.load(dir).hilo), /nunca menciones precios/);
    const idA = sub.archive(dir); assert.ok(idA);
    assert.equal(sub.load(dir).hilo, undefined, 'la conversación nueva empieza sin hilo');
    sub.save(dir, { messages: [u('otro tema: Siempre responde en inglés')] });
    const r = sub.abrir(dir, idA);
    assert.match(JSON.stringify(sub.load(dir).hilo), /nunca menciones precios/, 'la abierta trae SU resumen'); assert.ok(r.archived);
    assert.doesNotMatch(JSON.stringify(sub.load(dir).hilo), /en inglés/, 'y no el de la otra');
    const idB = r.archived; sub.archive(dir); assert.equal(sub.restore(dir, idB), true);
    assert.equal(sub.load(dir).messages[0].text, 'otro tema: Siempre responde en inglés');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('el prompt dice cómo trabajar en una sesión larga: plan completo en un turno, <viendo>, <hilo>, lo hecho y lo pendiente, y el clic del dueño', () => {
  const s = sub.systemPrompt({ name: 'Dimitri', business: 'PanaClaw', depts: DEPTS, agents: AGENTS, skillsOf: () => [], routineDepts: [], status: 'x' });
  assert.match(s, /AUTONOMÍA Y SESIONES LARGAS/); assert.match(s, /Resuelve en UN turno[\s\S]*plan COMPLETO/); assert.match(s, /<hilo> resume la sesión/);
  assert.match(s, /lo pendiente \(o «no queda nada pendiente»\)/); assert.match(s, /autonomía llega a PROPONER/);
  assert.match(s, /Nunca apruebas, envías, programas en Meta ni publicas/, 'la regla de aprobar/enviar/publicar sigue intacta');
  assert.match(s, /GASTAN \(dos clics del dueño\)/, 'y la del dinero también');
  assert.match(s, /Nunca preguntes lo que ya está en <notas>, <estado>, <hilo> o el historial/);
});

// Plan T2 (6 oct 2026): la vista Tareas — lo puro de cada pestaña (filtrar, ordenar, agrupar, qué significa soltar una tarjeta,
// el mapa por capas, añadir rápido, la bitácora en palabras, las fechas) y el paquete aparte (la página no lo lleva dentro).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filtrar, ordenar, agrupar, chipsFiltro } from '../src/tareas/lista.js';
import { movimiento, columnaDe, tableroHTML } from '../src/tareas/tablero.js';
import { capas } from '../src/tareas/proyectos.js';
import { lineaBitacora } from '../src/tareas/detalle.js';
import { limiteTexto, filaHTML, ymd } from '../src/tareas/comun.js';
import { inicioHTML } from '../src/tareas/inicio.js';
import { leerRapida } from '../tareas/rapida.mjs';
import { construirTareas } from '../build-tareas.mjs';

const ctxDe = tareas => ({ porId: new Map(tareas.map(t => [t.id, t])), agente: id => ({ piper: { name: 'PIPER' }, ema: { name: 'EMA', lead: true } })[id], depto: k => ({ sales: { name: 'VENTAS', short: 'VENTAS', chip: '#eee' }, emails: { name: 'CORREOS', short: 'CORREOS', chip: '#ddd' } })[k],
  deptKeys: ['sales', 'emails'], proyecto: id => (id === 'pr-a' ? { id, nombre: 'Lentes', color: 'azul' } : null), etiqueta: id => (id === 'e-x' ? { id, nombre: 'web', color: 'cian' } : null), proyectos: () => [{ id: 'pr-a', nombre: 'Lentes' }], etiquetas: () => [{ id: 'e-x', nombre: 'web' }] });

test('la lista: filtra por departamento, prioridad, etiqueta, proyecto, estado y texto (sin tildes); lo hecho solo si se pide', () => {
  const l = [
    { id: 'a', state: 'next', dept: 'sales', agent: 'piper', prioridad: 'alta', title: 'Propuesta Óptica', etiquetas: ['e-x'], proyecto: 'pr-a' },
    { id: 'b', state: 'done', dept: 'sales', agent: 'piper', title: 'Vieja' },
    { id: 'c', state: 'next', dept: 'emails', agent: 'ema', title: 'Correo', bloqueadaPor: ['a'] },
    { id: 'd', state: 'idea', dept: 'emails', agent: 'ema', title: 'Idea', archived: true },
  ];
  const c = ctxDe(l), ids = f => filtrar(l, f, c).map(t => t.id);
  assert.deepEqual(ids({}), ['a', 'c'], 'sin las hechas ni las archivadas');
  assert.deepEqual(ids({ hechas: true }), ['a', 'b', 'c']);
  assert.deepEqual(ids({ dept: 'emails' }), ['c']); assert.deepEqual(ids({ prio: 'alta' }), ['a']); assert.deepEqual(ids({ prio: 'media' }), ['c'], 'sin prioridad cuenta como media');
  assert.deepEqual(ids({ etiqueta: 'e-x' }), ['a']); assert.deepEqual(ids({ proyecto: '-' }), ['c']); assert.deepEqual(ids({ estado: 'bloqueada' }), ['c']); assert.deepEqual(ids({ estado: 'hecha' }), ['b']);
  assert.deepEqual(ids({ q: 'optica' }), ['a'], 'el texto ignora tildes'); assert.deepEqual(ids({ q: 'piper' }), ['a'], 'y busca por agente');
  assert.match(chipsFiltro({ prio: 'alta', q: 'x' }, c), /data-quitar="prio".*Prioridad alta[\s\S]*data-quitar="\*"/);
  assert.deepEqual(ordenar(l.slice(0, 3), 'prioridad').map(t => t.id)[0], 'a');
  assert.deepEqual(agrupar(filtrar(l, {}, c), 'dept', c).map(g => [g.titulo, g.tareas.length]), [['CORREOS', 1], ['VENTAS', 1]]);
  assert.deepEqual(agrupar(filtrar(l, {}, c), 'estado', c).map(g => g.k), ['bloqueada', 'en_cola']);
});

test('la fila: el título es el botón que la abre; la casilla elige; los chips dicen prioridad, fecha, pasos, proyecto, etiquetas', () => {
  const hoy = ymd(new Date());
  const t = { id: 'a', state: 'next', dept: 'sales', agent: 'piper', title: 'Propuesta <Acme>', prioridad: 'alta', limite: hoy, pasos: [{ hecho: true }, { hecho: false }], proyecto: 'pr-a', etiquetas: ['e-x'] };
  const h = filaHTML(t, ctxDe([t]), { elegir: true });
  assert.match(h, /<button type="button" class="tv-tit" data-abrir="a">Propuesta &lt;Acme&gt;/); assert.match(h, /data-sel="a" aria-label="Elegir «Propuesta &lt;Acme&gt;»"/);
  assert.match(h, /tv-c-alta">Alta/); assert.match(h, /vence hoy/); assert.match(h, /1\/2/); assert.match(h, /Lentes/); assert.match(h, /#web/); assert.match(h, /PIPER/);
  assert.doesNotMatch(filaHTML({ ...t, state: 'waiting' }, ctxDe([t])), /<button[^>]*>[^<]*<button/, 'un botón nunca dentro de otro');
  assert.equal(limiteTexto('2026-10-05', new Date('2026-10-06T10:00').getTime()).texto, 'venció ayer');
  assert.equal(limiteTexto('2026-10-07', new Date('2026-10-06T10:00').getTime()).tono, 'ambar');
  assert.equal(limiteTexto('2026-10-20', new Date('2026-10-06T10:00').getTime()).texto, 'vence el 20 oct');
});

test('el tablero: soltar una tarjeta significa algo concreto; lo que no tiene sentido no se deja', () => {
  const t = { id: 'a', state: 'next', dept: 'sales' };
  assert.equal(movimiento(t, 'idea', 'cola').accion, 'pedir'); assert.equal(movimiento(t, 'cola', 'idea').accion, 'aparcar');
  assert.equal(movimiento(t, 'ok', 'hecha').accion, 'aprobar'); assert.equal(movimiento(t, 'hecha', 'cola').accion, 'repetir'); assert.equal(movimiento(t, 'cola', 'cola').accion, 'orden');
  assert.equal(movimiento(t, 'cola', 'curso'), null, 'nadie arrastra a «en curso»: lo arranca la cola');
  assert.equal(movimiento(t, 'ok', 'cola'), null); assert.equal(movimiento(t, 'curso', 'hecha'), null);
  assert.equal(movimiento(t, 'cola', 'cola', { dept: 'emails' }).accion, 'departamento'); assert.equal(movimiento(t, 'cola', 'idea', { dept: 'emails' }), null);
  const l = [{ id: 'b', state: 'doing', dept: 'sales' }, { id: 'c', state: 'next', dept: 'sales', bloqueadaPor: ['b'] }, { id: 'd', state: 'done', dept: 'sales', doneAt: Date.now() - 72 * 3600e3 }];
  assert.equal(columnaDe(l[1], new Map(l.map(x => [x.id, x]))), 'bloqueada');
  const h = tableroHTML(l, ctxDe(l)); assert.doesNotMatch(h, /data-t="d"/, 'lo hecho hace más de 48 h no ocupa el tablero'); assert.match(h, /data-t="b"(?![^>]*draggable)/, 'lo que está en curso no se arrastra');
});

test('el mapa: por capas, de lo que no espera a nadie a lo que espera a todo; un círculo no lo cuelga', () => {
  const r = capas([{ id: 'a' }, { id: 'b', bloqueadaPor: ['a'] }, { id: 'c', bloqueadaPor: ['b', 'a'] }, { id: 'd', bloqueadaPor: ['fuera'] }]);
  assert.deepEqual(r.nodos.map(n => [n.id, n.capa]), [['a', 0], ['b', 1], ['c', 2], ['d', 0]]);
  assert.equal(r.aristas.length, 3); assert.equal(r.ancho, 3); assert.equal(r.alto, 2);
  assert.ok(capas([{ id: 'x', bloqueadaPor: ['y'] }, { id: 'y', bloqueadaPor: ['x'] }]).nodos.length === 2);
});

test('añadir rápido: prioridad, etiquetas, fecha límite «para…», y un día sin «para» es cuándo arranca', () => {
  const a = new Date('2026-10-06T10:00'); // martes
  assert.deepEqual(leerRapida('urgente: propuesta para Acme para el viernes #ventas-q4', a), { etiquetas: ['ventas-q4'], prioridad: 'alta', limite: '2026-10-09', texto: 'Propuesta para Acme' });
  assert.deepEqual(leerRapida('!baja revisar el inventario antes del 20', a), { prioridad: 'baja', limite: '2026-10-20', texto: 'Revisar el inventario' });
  assert.equal(leerRapida('antes del 3', a).limite, '2026-11-03', 'un día que ya pasó este mes es del siguiente');
  assert.equal(leerRapida('Factura para el 3 de noviembre', a).limite, '2026-11-03');
  assert.equal(leerRapida('para mañana el post', a).limite, '2026-10-07');
  const r = leerRapida('el lunes a las 9 manda el resumen', a); assert.equal(new Date(r.at).getDay(), 1); assert.equal(r.texto, 'Manda el resumen'); assert.ok(!r.limite);
  assert.equal(leerRapida('prepara el informe del lunes', a).at, undefined, '«del lunes» nombra un informe');
});

test('la bitácora en palabras: quién (tú, la oficina, el agente) y qué', () => {
  const c = ctxDe([]);
  assert.equal(lineaBitacora({ tipo: 'estado', de: 'next', a: 'doing', por: 'oficina' }, c), 'La oficina: En cola → En curso');
  assert.equal(lineaBitacora({ tipo: 'estado', de: 'doing', a: 'done:error', por: 'agente:piper' }, c), 'PIPER: En curso → Falló');
  assert.equal(lineaBitacora({ tipo: 'campo', campo: 'prioridad', antes: 'media', despues: 'alta', por: 'dueno' }, c), 'Tú cambió la prioridad: media → alta');
  assert.equal(lineaBitacora({ tipo: 'paso', texto: 'Leer', accion: 'hecho', por: 'x', marcadoPor: 'agente:piper' }, c), 'PIPER: paso «Leer» hecho');
  assert.equal(lineaBitacora({ tipo: 'choque', campos: ['prioridad'] }, c), 'Mientras trabajaba, cambiaste la prioridad: se quedó lo tuyo');
});

test('Inicio: lo que no hay no ocupa sitio; Hoy dice hechas/total y trae lo vencido', () => {
  const ayer = ymd(new Date(Date.now() - 864e5));
  const l = [{ id: 'v', state: 'next', dept: 'sales', agent: 'piper', title: 'Vencida', limite: ayer }, { id: 'h', state: 'done', dept: 'sales', agent: 'piper', title: 'Hecha hoy', doneAt: Date.now() - 60e3 }];
  const h = inicioHTML(l, ctxDe(l), new Set(['proximas']));
  assert.match(h, /data-sec="hoy"[\s\S]*?<span class="tv-cuenta">1\/2<\/span>/); assert.match(h, /data-abrir="v"/); assert.match(h, /HECHAS HOY · 1/);
  assert.doesNotMatch(h, /data-sec="esperanOk"/); assert.doesNotMatch(h, /data-sec="bloqueadas"/);
  assert.match(h, /data-sec="proximas"[^>]*>[\s\S]*?aria-expanded="false"[\s\S]*?<div class="tv-secb" hidden>/, 'una sección plegada se recuerda plegada');
});

test('el paquete aparte: se construye, lleva su estilo y dice de qué construcción es; la página no lo lleva', { timeout: 60000 }, async () => {
  const r = await construirTareas();
  assert.match(r.js, /^\/\*ao-tareas:[0-9a-f]{12}\*\//); assert.match(r.js, /data-ao-tareas/); assert.match(r.js, /AO_TAREAS/);
  assert.ok(r.aparte.includes('src/tareas/vista.js') && r.aparte.includes('tareas/estados.mjs'));
  const pagina = fs.readFileSync('src/main.js', 'utf8'); assert.doesNotMatch(pagina, /from '\.\/tareas\/(?!.*carga)/, 'la página importa solo el cargador');
});

test('con Tareas abierta la oficina 3D no se dibuja detrás; el tablero no deja listas vacías (axe)', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main.match(/const covered = .*$/m)[0], /contains\('tvOpen'\)/, 'covered() cuenta la vista Tareas: antes la oficina se dibujaba a pleno ritmo detrás');
  const t = { id: 'a', state: 'next', dept: 'sales', agent: 'piper', title: 'A' };
  const h = tableroHTML([t], ctxDe([t]), { carriles: true });
  for (const m of h.matchAll(/<div class="tv-drop[^"]*"[^>]*role="list"[^>]*>(.*?)<\/div>(?=<div class="tv-drop|<div class="tv-ld|<\/div>)/g)) assert.match(m[1], /role="listitem"/, 'una lista siempre lleva elementos');
  assert.ok(/role="group"/.test(h), 'la casilla vacía es un grupo con nombre');
});

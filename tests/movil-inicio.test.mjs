// Versión móvil, Inicio (1 nov 2026): lo puro, con los casos reales de las capturas del dueño. Los instantes son fijos: nada depende de la hora de la máquina.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avisosSinRepetir, proximosPorDia, motivoAtencion, saludoDe, resumenHoy, diaCorto, normaTexto } from '../src/movil/inicio-puro.js';
import { eventos } from '../src/movil/agenda.js';

// sábado 31 oct 2026, 11:40 hora local de la máquina
const AHORA = new Date(2026, 9, 31, 11, 40).getTime(), H = 3600e3, DIA = 864e5;
const manana9 = new Date(2026, 10, 1, 9, 0).getTime();

test('avisos: el mismo aviso (dos veces, una con ⚑) sale una sola vez, el más nuevo', () => {
  const t = 'Mañana vence «Decidir si pausamos la campaña de Meta y qué se rehace» y aún no empezó (Abrinay).';
  const notices = [
    { id: 'a', kind: 'limite', task: 'T1', level: 'info', text: t, t: AHORA - 24 * H, read: false },
    { id: 'b', kind: 'limite', task: 'T1', level: 'info', text: '⚑ ' + t, t: AHORA - 23 * H, read: false },
    { id: 'c', kind: 'limite', task: 'T2', level: 'info', text: 'Mañana vence «Plan de mejora de la campaña y borradores de anuncios» y aún no empezó (LÍDER MARKETING).', t: AHORA - 24 * H, read: false },
  ];
  const r = avisosSinRepetir(notices, { ahora: AHORA });
  assert.equal(r.total, 2);
  const dec = [...r.hoy, ...r.antes].find(n => n.task === 'T1');
  assert.equal(dec.veces, 2); assert.equal(dec.id, 'b', 'queda el más nuevo');
});

test('avisos: lo de hoy y lo anterior van separados; lo leído no cuenta (salvo que se pida)', () => {
  const inicio = new Date(2026, 9, 31).getTime();
  const notices = [
    { id: '1', kind: 'x', text: 'Hoy temprano', t: inicio + H, read: false },
    { id: '2', kind: 'x', text: 'Ayer a la noche', t: inicio - H, read: false },
    { id: '3', kind: 'x', text: 'Ya leído', t: inicio + 2 * H, read: true },
  ];
  const r = avisosSinRepetir(notices, { ahora: AHORA });
  assert.deepEqual(r.hoy.map(n => n.id), ['1']); assert.deepEqual(r.antes.map(n => n.id), ['2']);
  assert.equal(avisosSinRepetir(notices, { ahora: AHORA, leidos: true }).total, 3);
  assert.deepEqual(avisosSinRepetir(null), { hoy: [], antes: [], total: 0 });
});

test('avisos: dos tareas distintas con el mismo texto NO se funden', () => {
  const n = [{ id: 'a', task: 'T1', kind: 'limite', text: 'Hoy vence «X».', t: AHORA }, { id: 'b', task: 'T2', kind: 'limite', text: 'Hoy vence «X».', t: AHORA }];
  assert.equal(avisosSinRepetir(n, { ahora: AHORA }).total, 2);
  assert.equal(normaTexto('⚑  Mañana `vence`'), 'mañana vence');
});

test('lo que viene: la rutina de las 09:00 y la fecha límite del mismo día con el mismo título son UNA entrada, con hora y «vence»', () => {
  const evs = [
    { tipo: 'rutina', at: manana9, titulo: 'Investigar Meta Ads y Andromeda con fuentes y fecha', id: 'r1', conHora: true },
    { tipo: 'rutina', at: manana9, titulo: 'Analizar la campaña activa de Meta y dar recomendación', id: 'r2', conHora: true },
    { tipo: 'limite', at: new Date(2026, 10, 1, 23, 59).getTime(), titulo: 'Investigar Meta Ads y Andromeda con fuentes y fecha', id: 't1', conHora: false },
    { tipo: 'limite', at: new Date(2026, 10, 1, 23, 59).getTime(), titulo: 'Analizar la campaña activa de Meta y dar recomendación', id: 't2', conHora: false },
  ];
  const r = proximosPorDia(evs, { ahora: AHORA, max: 4 });
  assert.equal(r.total, 2);
  assert.equal(r.grupos.length, 1); assert.equal(r.grupos[0].titulo, 'Mañana');
  const [a, b] = r.grupos[0].items;
  assert.ok(a.conHora && a.vence && b.conHora && b.vence);
  assert.equal(a.at, manana9);
});

test('lo que viene: por día, recortado y con cuántos más hay; lo pausado, saltado o hecho no sale', () => {
  const dia = n => new Date(2026, 10, n, 10, 0).getTime();
  const evs = [
    { tipo: 'tarea', at: dia(1), titulo: 'A', conHora: true }, { tipo: 'tarea', at: dia(2), titulo: 'B', conHora: true }, { tipo: 'tarea', at: dia(2) + H, titulo: 'C', conHora: true },
    { tipo: 'tarea', at: dia(3), titulo: 'D', conHora: true }, { tipo: 'tarea', at: dia(3) + H, titulo: 'E', conHora: true },
    { tipo: 'rutina', at: dia(1), titulo: 'Saltada', conHora: true, saltada: true }, { tipo: 'rutina', at: dia(1), titulo: 'Pausada', conHora: true, pausada: true }, { tipo: 'tarea', at: dia(1), titulo: 'Hecha', hecha: true, conHora: true },
  ];
  const r = proximosPorDia(evs, { ahora: AHORA, max: 4 });
  assert.equal(r.total, 5); assert.equal(r.resto, 1);
  assert.deepEqual(r.grupos.map(g => g.titulo), ['Mañana', 'Lun 2 nov', 'Mar 3 nov']);
  assert.equal(r.grupos.flatMap(g => g.items).length, 4);
  assert.equal(diaCorto(dia(2), AHORA), 'Lun 2 nov'); assert.equal(diaCorto(AHORA, AHORA), 'Hoy');
});

test('lo que viene: con eventos() de verdad, una tarea programada y su límite el mismo día salen una vez', () => {
  const tareas = [{ id: 't1', title: 'Llamar a Acme', state: 'scheduled', dueAt: manana9, limite: '2026-11-01', dept: 'sales' }];
  const evs = eventos({ tareas, rutinas: [], desde: AHORA, hasta: AHORA + 4 * DIA });
  assert.equal(evs.length, 2, 'la agenda de calendario las trae por separado');
  const r = proximosPorDia(evs, { ahora: AHORA });
  assert.equal(r.total, 1); assert.equal(r.grupos[0].items[0].vence, true); assert.equal(r.grupos[0].items[0].conHora, true);
});

test('lo que viene: dos tareas DISTINTAS con el mismo título el mismo día NO se funden; tampoco dos rutinas; una rutina funde solo UNA fecha límite', () => {
  const lim = new Date(2026, 10, 1, 23, 59).getTime(), t = 'Revisar el presupuesto';
  const dos = proximosPorDia([{ tipo: 'limite', at: lim, titulo: t, id: 'A', conHora: false }, { tipo: 'limite', at: lim, titulo: t, id: 'B', conHora: false }], { ahora: AHORA });
  assert.equal(dos.total, 2); assert.equal(dos.grupos[0].items.length, 2);
  const mixtas = proximosPorDia([{ tipo: 'tarea', at: manana9, titulo: t, id: 'A', conHora: true }, { tipo: 'mia', at: lim, titulo: t, id: 'B', conHora: false }], { ahora: AHORA });
  assert.equal(mixtas.total, 2, 'una programada y una mía con otro id son dos cosas');
  const rutinas = proximosPorDia([{ tipo: 'rutina', at: manana9, titulo: t, id: 'R1', conHora: true }, { tipo: 'rutina', at: manana9, titulo: t, id: 'R2', conHora: true }], { ahora: AHORA });
  assert.equal(rutinas.total, 2, 'dos rutinas distintas no se funden');
  const una = proximosPorDia([{ tipo: 'rutina', at: manana9, titulo: t, id: 'R1', conHora: true }, { tipo: 'limite', at: lim, titulo: t, id: 'A', conHora: false }, { tipo: 'limite', at: lim, titulo: t, id: 'B', conHora: false }], { ahora: AHORA });
  assert.equal(una.total, 2, 'la rutina funde con una sola de las dos fechas límite'); assert.ok(una.grupos[0].items.some(e => e.tipo === 'rutina' && e.vence));
  const misma = proximosPorDia([{ tipo: 'tarea', at: manana9, titulo: t, id: 'A', conHora: true }, { tipo: 'limite', at: lim, titulo: t, id: 'A', conHora: false }], { ahora: AHORA });
  assert.equal(misma.total, 1, 'la misma tarea (mismo id): su hora y su límite son una entrada'); assert.ok(misma.grupos[0].items[0].vence && misma.grupos[0].items[0].conHora);
});

test('avisos: lo que se repitió lo dice («×2») en Inicio y en la hoja', async () => {
  const r = avisosSinRepetir([{ id: 'a', task: 'T', kind: 'x', text: 'Hoy vence «X».', t: AHORA }, { id: 'b', task: 'T', kind: 'x', text: 'Hoy vence «X».', t: AHORA - H }], { ahora: AHORA });
  assert.equal(r.hoy[0].veces, 2);
  for (const f of ['../src/movil/vistas/inicio.js', '../src/movil/avisos.js']) assert.match(fs.readFileSync(new URL(f, import.meta.url), 'utf8'), /n\.veces > 1 \? `<span class="mv-iav-x"/, f + ' pinta ×N');
});

test('«Actualizado hace…»: se refresca solo cada minuto, solo cambia el texto y el temporizador se limpia al ocultar y al desmontar', () => {
  const s = fs.readFileSync(new URL('../src/movil/vistas/inicio.js', import.meta.url), 'utf8');
  assert.match(s, /setInterval\(/); assert.match(s, /\},\s*60e3\)/); assert.match(s, /clearInterval\(reloj\)/);
  assert.match(s, /alOcultar\(el\)\s*\{\s*el\._reloj\?\.\(false\)/); assert.match(s, /desmontar\(el\)\s*\{\s*el\._reloj\?\.\(false\)/);
  const cuerpoReloj = s.slice(s.indexOf('const etiquetaPie'), s.indexOf('el._mcp = cargaMcp'));
  assert.doesNotMatch(cuerpoReloj, /ctx\.api|refrescar\(|fetch/, 'el reloj no pide nada al servidor');
});

test('«algo necesita atención» dice qué: lo que falla antes que lo que avisa, y cuántos más', () => {
  const status = { overall: 'warn', checks: [
    { id: 'claude', label: 'Proveedor de IA', state: 'ok', detail: 'Bien.' },
    { id: 'conectores', label: 'Conectores', state: 'warn', detail: '2 sin autorizar: Gmail, Drive. Autorízalos en Más → Conectores.' },
    { id: 'aprobaciones', label: 'Aprobaciones', state: 'warn', detail: '1 espera tu visto bueno, 1 desde hace más de un día.' },
  ] };
  const m = motivoAtencion(status);
  assert.equal(m.tono, 'warn'); assert.equal(m.mas, 1); assert.equal(m.ir, 'estado', 'con varias, la pantalla Estado');
  assert.match(m.texto, /^Conectores: 2 sin autorizar/);
  const solo = motivoAtencion(status, { excluir: ['aprobaciones'] });
  assert.equal(solo.mas, 0); assert.equal(solo.ir, 'conectores', 'con una sola, directo a resolverla');
  const mal = motivoAtencion({ checks: [{ id: 'cola', label: 'Cola', state: 'warn', detail: 'x' }, { id: 'errores', label: 'Fallos', state: 'bad', detail: '3 tareas fallaron.' }] });
  assert.equal(mal.tono, 'bad'); assert.match(mal.texto, /^Fallos/);
  assert.equal(motivoAtencion({ checks: [{ id: 'a', label: 'A', state: 'ok' }] }), null); assert.equal(motivoAtencion(null), null);
});

test('el motivo largo se recorta a una línea', () => {
  const m = motivoAtencion({ checks: [{ id: 'cola', label: 'Cola', state: 'warn', detail: 'Texto '.repeat(60) }] });
  assert.ok(m.texto.length <= 90 + 6);
});

test('saludo corto y cifras de hoy', () => {
  assert.equal(saludoDe(3), 'Buenas noches'); assert.equal(saludoDe(9), 'Buenos días'); assert.equal(saludoDe(15), 'Buenas tardes'); assert.equal(saludoDe(21), 'Buenas noches');
  assert.equal(resumenHoy(0, 0), 'Nada pendiente'); assert.equal(resumenHoy(3, 2), '3 pendientes · 2 hechas hoy'); assert.equal(resumenHoy(1, 0), '1 pendiente'); assert.equal(resumenHoy(0, 1), 'Todo hecho: 1 hecha hoy');
});

test('estructura: la campanita no flota en el teléfono y el chat no se parece a Dimitri', () => {
  const notas = fs.readFileSync(new URL('../cloudflare/public/nube-notas.js', import.meta.url), 'utf8'), css = fs.readFileSync(new URL('../cloudflare/public/nube.css', import.meta.url), 'utf8');
  assert.match(notas, /#mvRoot \.mv-bar-der/, 'vive en la cabecera de la versión móvil');
  assert.match(css, /\.nt-campana\.nt-en-cab[^{]*\{[^}]*position: relative[^}]*bottom: auto/);
  const chat = fs.readFileSync(new URL('../cloudflare/public/nube-chat.js', import.meta.url), 'utf8');
  assert.match(chat, /Chat del equipo/); assert.doesNotMatch(chat, /M21 12a8 8 0 0 1-11\.6 7\.1/, 'ya no es la burbuja');
  const inicio = fs.readFileSync(new URL('../src/movil/vistas/inicio.js', import.meta.url), 'utf8');
  assert.match(inicio, /data-nueva/); assert.ok(inicio.indexOf('${acciones()}') > 0 && inicio.indexOf('acciones()') < inicio.indexOf('${banda}'), 'las acciones van arriba, antes de lo demás');
});

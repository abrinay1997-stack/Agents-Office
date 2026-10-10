// C2 y C3 de Contenido (8 oct 2026): lo ya publicado junto a su pieza (con sus resultados), «Llenar la semana» con lo que vuelve,
// las plantillas como notas del Cerebro y la pieza en Telegram para aprobarla desde el teléfono.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { emparejar, sumaResultados, numeroCorto, cifrasTxt, enlaceLimpio, huellaTexto, comoEvento } from '../src/contenido-publicadas.js';
import { huecos, queVuelven, repartir, encargo, raizDe, origenVuelve, SEMANAS_SIN_REPETIR } from '../src/contenido-llenar.js';
import { plantillaDe, aNota, deNota, crearPlantillas, nombreLimpio, DIR_PLANTILLAS } from '../contenido/plantillas.mjs';
import { crearAlmacen } from '../contenido/piezas.mjs';
import { crearRutas } from '../contenido/rutas.mjs';
import { piezaTexto, piezaLista, piezaBotones, parseCommand } from '../telegram.mjs';
import { crearDatos, publicadasDemo } from '../src/contenido-datos.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-c3-'));
const local = (f, h) => new Date(`${f}T${h}:00`).toISOString(); // una hora local de esta máquina, como la da Meta (UTC)

test('lo publicado se junta con su pieza: por el enlace, o por la red, la hora y el principio del texto', () => {
  const piezas = [
    { id: 'a', fecha: '2026-10-01', hora: '19:00', redes: ['instagram', 'facebook'], texto: 'Agenda tu examen visual gratis y sal con tus lentes', salida: { redes: { instagram: { url: 'https://www.instagram.com/p/ABC/' } } } },
    { id: 'b', fecha: '2026-10-02', hora: '13:00', redes: ['facebook'], texto: 'Kit de limpieza de regalo por tus lentes', textoFacebook: '' },
    { id: 'c', fecha: '2026-10-03', hora: '10:00', redes: ['instagram'], texto: '' },
  ];
  const pubs = [
    { id: 'ig|1', red: 'instagram', enlace: 'https://instagram.com/p/ABC', texto: 'otra cosa', publicadaAt: local('2026-10-01', '23:50'), alcance: 1200, interacciones: 80 }, // por el enlace, aunque la hora y el texto no casen
    { id: 'fb|1', red: 'facebook', enlace: '', texto: 'Agenda tu examen visual gratis y sal con tus lentes ✨', publicadaAt: local('2026-10-01', '19:20'), alcance: 300, interacciones: 9 }, // la hora a 20 min y el texto
    { id: 'fb|2', red: 'facebook', enlace: '', texto: 'Kit de limpieza de regalo por tus lentes', publicadaAt: local('2026-10-02', '14:10'), alcance: 50, interacciones: 2 }, // 70 min tarde: no casa
    { id: 'ig|2', red: 'instagram', enlace: '', texto: 'Hoy cerramos temprano', publicadaAt: local('2026-10-03', '10:05'), alcance: 10, interacciones: 1 }, // la pieza sin texto: hasta 10 min… pero el texto de la publicación no le dice nada en contra
    { id: 'ig|3', red: 'instagram', enlace: '', texto: 'Algo hecho a mano', publicadaAt: local('2026-10-04', '09:00'), alcance: 5, interacciones: 0 },
  ];
  const r = emparejar(piezas, pubs);
  assert.deepEqual(Object.keys(r.porPieza).sort(), ['a', 'c']);
  assert.deepEqual(r.porPieza.a.map(x => x.id).sort(), ['fb|1', 'ig|1']);
  assert.deepEqual(r.sueltas.map(x => x.id), ['fb|2', 'ig|3']);
  assert.deepEqual(sumaResultados(r.porPieza.a), { alcance: 1500, interacciones: 89, meGusta: 0, comentarios: 0, guardados: 0, compartidos: 0, vistas: 0, redes: ['instagram', 'facebook'] });
  // un texto que dice otra cosa no casa aunque la hora sí
  assert.deepEqual(Object.keys(emparejar([{ id: 'x', fecha: '2026-10-01', hora: '19:00', redes: ['instagram'], texto: 'Promo de octubre en la tienda' }], [{ id: 'p', red: 'instagram', texto: 'Feliz cumpleaños al equipo', publicadaAt: local('2026-10-01', '19:01') }]).porPieza), []);
  assert.equal(enlaceLimpio('HTTPS://www.Instagram.com/p/ABC/?igsh=1'), 'instagram.com/p/abc');
  assert.equal(huellaTexto('¡Agenda tu EXAMEN! ✨'), 'agendatuexamen');
  assert.deepEqual([numeroCorto(999), numeroCorto(1234), numeroCorto(12500), numeroCorto(1250000)], ['999', '1,2 mil', '13 mil', '1,3 M']);
  assert.equal(cifrasTxt({ alcance: 1234, interacciones: 1 }), '1,2 mil de alcance · 1 interacción');
  const ev = comoEvento({ publicadaAt: local('2026-10-05', '08:07') }); assert.deepEqual([ev.fecha, ev.hora], ['2026-10-05', '08:07']);
});

test('Llenar la semana: los días sin nada en esas redes, cada uno con su mejor hora (o las 18:00), y nunca una hora que ya pasó', () => {
  const ahora = new Date('2026-10-08T17:30:00').getTime(); // jueves, 17:30
  const grid = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => (d === 4 && h === 13 ? 90 : d === 4 && h === 19 ? 70 : d === 5 && h === 9 ? 80 : 0)));
  const piezas = [{ fecha: '2026-10-10', redes: ['instagram'], estado: 'borrador' }, { fecha: '2026-10-11', redes: ['linkedin'], estado: 'aprobada' }, { fecha: '2026-10-12', redes: ['instagram'], estado: 'idea' }];
  const hs = huecos({ desde: '2026-10-08', dias: 5, piezas, redes: ['instagram', 'facebook'], grid, ahora });
  assert.deepEqual(hs.map(h => [h.fecha, h.hora]), [['2026-10-08', '19:00'], ['2026-10-09', '09:00'], ['2026-10-11', '18:00'], ['2026-10-12', '18:00']], 'hoy, la 13:00 ya pasó: la siguiente buena; el 10 está ocupado; LinkedIn y una idea no ocupan');
  assert.match(hs[0].razon, /mejor hora/); assert.match(hs[2].razon, /no tiene una hora destacada/);
  assert.deepEqual(huecos({ desde: '2026-10-08', dias: 1, piezas: [], redes: ['instagram'], grid: null, ahora: new Date('2026-10-08T21:30:00').getTime() }), [], 'a las 21:30 no queda hora hoy (ni las 18 ni las 20)');
  assert.deepEqual(huecos({ desde: 'mañana', dias: 3, redes: ['instagram'] }), []);
});

test('lo que vuelve: lo que funcionó (la mitad de arriba), sin repetirse en 8 semanas contando sus copias; uno de cada tres huecos', () => {
  const ahora = new Date('2026-10-08T12:00:00').getTime();
  const piezas = [
    { id: 'p1', fecha: '2026-07-01', estado: 'aprobada', redes: ['instagram'] },
    { id: 'p2', fecha: '2026-07-05', estado: 'aprobada', redes: ['instagram'] },
    { id: 'p3', fecha: '2026-07-10', estado: 'aprobada', redes: ['instagram'] },
    { id: 'p4', fecha: '2026-09-20', estado: 'aprobada', redes: ['instagram'] }, // reciente: no vuelve todavía
    { id: 'c1', fecha: '2026-09-01', estado: 'revision', redes: ['instagram'], origen: origenVuelve('p2') }, // una copia de p2 salió hace 5 semanas
  ];
  const resultados = { p1: [{ red: 'instagram', alcance: 900, interacciones: 90 }], p2: [{ red: 'instagram', alcance: 2000, interacciones: 200 }], p3: [{ red: 'instagram', alcance: 100, interacciones: 5 }], p4: [{ red: 'instagram', alcance: 5000, interacciones: 500 }] };
  const v = queVuelven({ piezas, resultados, ahora });
  assert.deepEqual(v.map(x => x.pieza.id), ['p1'], 'p2 tiene una copia reciente, p3 rindió poco, p4 es de hace 3 semanas');
  assert.equal(v[0].ultima, '2026-07-01');
  assert.equal(raizDe(piezas[4]), 'p2');
  assert.equal(SEMANAS_SIN_REPETIR, 8);
  const hs = [1, 2, 3, 4, 5].map(i => ({ fecha: `2026-10-1${i}`, hora: '18:00' }));
  assert.deepEqual(repartir(hs, [{ pieza: { id: 'p1' } }, { pieza: { id: 'p9' } }]).map(h => h.que + (h.vuelve ? ':' + h.vuelve : '')), ['marketing', 'vuelve:p1', 'marketing', 'marketing', 'vuelve:p9']);
  assert.deepEqual(repartir([hs[0]], [{ pieza: { id: 'p1' } }]).map(h => h.vuelve), ['p1'], 'con un solo hueco, va lo que vuelve');
  const txt = encargo({ huecos: hs.slice(0, 2), redes: ['instagram', 'facebook'], pide: 'empujamos el examen gratis', nombreRed: r => ({ instagram: 'Instagram', facebook: 'Facebook' })[r] });
  assert.match(txt, /Instagram y Facebook/); assert.match(txt, /\(2026-10-11\) a las 18:00/); assert.match(txt, /crear_borrador/); assert.match(txt, /generar_imagen/); assert.match(txt, /No apruebes/); assert.match(txt, /«empujamos el examen gratis»/);
});

test('las plantillas: una nota del Cerebro con la forma de una pieza, sin día, hora ni archivos; ida y vuelta', () => {
  assert.equal(nombreLimpio('  ../Promo: del mes?  '), 'Promo del mes');
  assert.match(plantillaDe({ texto: 'x' }, '').error, /nombre/);
  assert.match(plantillaDe({ texto: '', redes: ['instagram'] }, 'Vacía').error, /no tiene texto/);
  const r = plantillaDe({ formato: 'reel', formatos: { facebook: 'post' }, redes: ['instagram', 'facebook', 'linkedin'], texto: 'Promo del mes.\n\nVen.', comentario: 'Agenda en la bio', hashtags: '#optica', textos: { linkedin: 'Para LinkedIn' }, notas: 'foto de la tienda', fecha: '2026-10-10', hora: '10:00', medios: ['2026-10/a.jpg'], estado: 'aprobada' }, 'Promo del mes');
  assert.ok(r.plantilla && !('fecha' in r.plantilla) && !('medios' in r.plantilla) && !('estado' in r.plantilla));
  const md = aNota(r.plantilla, { hoy: '2026-10-08' });
  assert.match(md, /^---\ntipo: plantilla de contenido\ntitulo: Promo del mes\nformato: reel\nformatos: \{"facebook":"post"\}/);
  assert.doesNotMatch(md, /^(fecha|hora|medios|estado|id):/m);
  assert.match(md, /## Primer comentario\nAgenda en la bio/); assert.match(md, /## Texto de LinkedIn\nPara LinkedIn/);
  const t = deNota(md, 'Promo del mes.md'); const { archivo, ...sin } = t;
  assert.equal(archivo, 'Promo del mes.md'); assert.deepEqual({ ...sin }, r.plantilla);
});

test('el almacén de plantillas: guardar, reemplazar por su nombre, listar y a la papelera', () => {
  const cerebro = tmp(), P = crearPlantillas({ cerebro, ahora: () => Date.parse('2026-10-08T12:00:00') });
  assert.equal(P.dir, path.join(cerebro, DIR_PLANTILLAS)); assert.deepEqual(P.listar(), []);
  assert.equal(P.guardar({ nombre: 'Testimonio', pieza: { texto: 'Uno', redes: ['instagram'] } }).reemplazada, false);
  assert.equal(P.guardar({ nombre: 'testimonio', pieza: { texto: 'Dos', redes: ['instagram'] } }).reemplazada, true, 'el mismo nombre, sin mirar mayúsculas: la reemplaza');
  assert.deepEqual(P.listar().map(x => [x.nombre, x.texto]), [['Testimonio', 'Dos']]);
  assert.ok(fs.existsSync(path.join(P.dir, 'Testimonio.md')));
  assert.ok(P.borrar('TESTIMONIO').ok); assert.deepEqual(P.listar(), []); assert.equal(fs.readdirSync(path.join(P.dir, '.papelera')).length, 1);
  assert.ok(P.borrar('Testimonio').error);
  assert.equal(P.guardar({ nombre: 'CON', pieza: { texto: 'x', redes: ['instagram'] } }).plantilla.archivo, 'CON (plantilla).md', 'un nombre que Windows no deja usar');
  assert.ok(P.borrar('con').ok, 'se borra por su nombre');
});

test('las rutas: lo publicado, llenar la semana (lo que vuelve a revisión y una tarea a Marketing) y las plantillas; nada de esto para un agente', async () => {
  let T = new Date('2026-06-30T12:00:00').getTime();
  const dir = tmp(), cerebro = tmp(), almacen = crearAlmacen({ dir, medioExiste: () => true, ahora: () => T });
  const vieja = almacen.crear({ titulo: 'Antes y después', fecha: '2026-07-01', hora: '19:00', redes: ['instagram'], medios: ['2026-06/a.jpg'], texto: 'Así cambia tu día cuando ves bien: antes y después', estado: 'revision' }).pieza;
  assert.ok(almacen.aprobar(vieja.id).pieza);
  T = new Date('2026-10-08T09:00:00').getTime();
  const pubs = [{ id: 'ig|1', red: 'instagram', enlace: '', texto: 'Así cambia tu día cuando ves bien: antes y después', publicadaAt: local('2026-07-01', '19:03'), alcance: 3000, interacciones: 250 }, { id: 'ig|2', red: 'instagram', enlace: 'https://instagram.com/p/X', texto: 'Hecho a mano', publicadaAt: local('2026-10-06', '12:00'), alcance: 40, interacciones: 3 }];
  const encargos = [];
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  const handle = crearRutas({ almacen, json, body, ajustes: () => ({ redes: ['instagram'] }), publicadas: () => ({ publicaciones: pubs, ultimaFoto: '2026-10-07', conectado: true }),
    encargar: async x => { encargos.push(x); return { id: 't1', titulo: x.titulo, agente: 'INSTAGRAM ORGANIC' }; }, quienLlena: () => 'INSTAGRAM ORGANIC', plantillas: crearPlantillas({ cerebro }), ahora: () => T });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const api = async (m, p, b) => { const r = await fetch(`http://127.0.0.1:${srv.address().port}${p}`, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json()) }; };
  try {
    // lo publicado
    assert.equal((await api('GET', '/api/contenido/publicadas?desde=julio')).status, 400);
    let r = await api('GET', '/api/contenido/publicadas?desde=2026-06-28&hasta=2026-07-04');
    assert.deepEqual([r.fuente, Object.keys(r.porPieza), r.sueltas.length], ['meta', [vieja.id], 0]);
    r = await api('GET', '/api/contenido/publicadas?desde=2026-10-05&hasta=2026-10-08');
    assert.deepEqual(r.sueltas.map(x => [x.id, x.fecha, x.hora, x.enlace]), [['ig|2', '2026-10-06', '12:00', 'https://instagram.com/p/X']]);
    // llenar la semana: lo que propone…
    const l = await api('GET', '/api/contenido/llenar?desde=2026-10-09&dias=3');
    assert.deepEqual([l.redes, l.huecos.length, l.vuelven.map(v => v.id), l.agente], [['instagram'], 3, [vieja.id], 'INSTAGRAM ORGANIC']);
    assert.deepEqual(l.huecos.map(h => h.que), ['marketing', 'vuelve', 'marketing']);
    // …y lo que hace
    assert.equal((await api('POST', '/api/contenido/llenar', { huecos: l.huecos, por: 'agente' })).status, 403);
    assert.equal((await api('POST', '/api/contenido/llenar', { huecos: [] })).status, 400);
    const h = await api('POST', '/api/contenido/llenar', { huecos: [...l.huecos, { fecha: '2026-10-01', hora: '10:00', que: 'marketing' }], redes: ['instagram'], pide: 'empujamos el examen' });
    assert.equal(h.creadas.length, 1); assert.deepEqual([h.creadas[0].estado, h.creadas[0].origen, h.creadas[0].texto, h.creadas[0].fecha], ['revision', 'vuelve:' + vieja.id, vieja.texto, '2026-10-10']);
    assert.deepEqual([h.pedidos, h.tarea.id, encargos.length], [2, 't1', 1]); assert.match(encargos[0].texto, /2026-10-09/); assert.match(encargos[0].texto, /«empujamos el examen»/);
    assert.match(h.errores[0], /ya pasó/);
    assert.deepEqual((await api('GET', '/api/contenido/llenar?desde=2026-10-09&dias=3')).vuelven, [], 'la copia de hoy cuenta: no vuelve otra vez en 8 semanas');
    // las plantillas
    assert.deepEqual((await api('GET', '/api/contenido/plantillas')).plantillas, []);
    assert.equal((await api('POST', '/api/contenido/plantillas', { nombre: 'Promo', pieza: { texto: 'x' }, por: 'agente' })).status, 403);
    assert.equal((await api('POST', '/api/contenido/plantillas', { nombre: 'Promo', pieza: { texto: '' } })).status, 400);
    r = await api('POST', '/api/contenido/plantillas', { nombre: 'Promo', pieza: { texto: 'La promo del mes', redes: ['instagram'], formato: 'carrusel', fecha: '2026-10-10' } });
    assert.deepEqual([r.plantilla.nombre, r.plantilla.formato, r.plantillas.length], ['Promo', 'carrusel', 1]);
    assert.equal((await api('DELETE', '/api/contenido/plantillas/Promo', { por: 'agente' })).status, 403);
    assert.equal((await api('DELETE', '/api/contenido/plantillas/Promo')).status, 200);
    assert.equal((await api('DELETE', '/api/contenido/plantillas/Promo')).status, 404);
  } finally { srv.close(); }
});

test('Telegram: la pieza con su vista previa, los botones según pueda salir, y /contenido', () => {
  const ahora = Date.now(), dia = new Date(ahora + 3 * 864e5), f = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
  const p = { id: 'p-1', titulo: 'Examen <gratis>', fecha: f, hora: '18:00', formato: 'reel', formatos: { facebook: 'post' }, redes: ['instagram', 'facebook'], estado: 'revision', origen: 'agente:newt', texto: 'x'.repeat(3000), hashtags: '#optica', revision: { errores: [] } };
  const t = piezaTexto(p, { nombreAgente: id => (id === 'newt' ? 'NEWSLETTER' : id) });
  assert.ok(t.length <= 1024, `el pie de una foto cabe en Telegram (${t.length})`);
  assert.match(t, /Examen &lt;gratis&gt;/); assert.match(t, /Instagram y Facebook \(post\)/); assert.match(t, /de NEWSLETTER/); assert.match(t, /✓ Puede salir/); assert.match(t, /…/);
  assert.equal(piezaLista(p), true);
  assert.deepEqual(piezaBotones(p).inline_keyboard.flat().map(b => b.callback_data), ['pa:p-1', 'pb:p-1', 'pv:p-1']);
  const mal = { ...p, revision: { errores: ['Un reel necesita un video'] } };
  assert.equal(piezaLista(mal), false); assert.match(piezaTexto(mal), /⚠ Le falta: Un reel necesita un video/);
  assert.deepEqual(piezaBotones(mal).inline_keyboard.flat().map(b => b.callback_data), ['pb:p-1', 'pv:p-1'], 'sin «Aprobar» si no puede salir');
  assert.equal(piezaLista({ ...p, estado: 'borrador', fecha: '2020-01-01' }), false, 'una hora que ya pasó no se aprueba');
  assert.deepEqual(parseCommand('/contenido'), { cmd: 'contenido', arg: '' });
});

test('la demo: lo publicado de ejemplo (sin tocar la vencida), lo que vuelve y las plantillas en memoria', async () => {
  const d = crearDatos({ served: false }), hoy = new Date(), y = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const { piezas } = await d.list({});
  const vencida = piezas.find(p => p.estado === 'aprobada' && p.fecha < y(hoy) && !p.salida);
  const pub = await d.publicadas({ desde: y(new Date(Date.now() - 100 * 864e5)), hasta: y(hoy) });
  assert.equal(pub.fuente, 'ejemplo'); assert.ok(!pub.porPieza[vencida.id], 'la vencida sigue siendo el ejemplo de «vencida»');
  assert.ok(Object.keys(pub.porPieza).length >= 2 && pub.sueltas.length > 0);
  assert.deepEqual(publicadasDemo(piezas, { desde: y(hoy), hasta: y(hoy), hoy: y(hoy) }).sueltas, [], 'nada de hoy en adelante');
  const l = await d.llenar({ desde: y(hoy), dias: 14, redes: ['instagram', 'facebook'] });
  assert.ok(l.demo && l.vuelven.length >= 1 && l.huecos.length >= 1);
  const h = await d.llenarHacer({ huecos: l.huecos, redes: ['instagram', 'facebook'] });
  assert.equal(h.creadas.length, l.huecos.length);
  assert.ok(h.creadas.filter(c => c.origen.startsWith('vuelve:')).every(c => c.estado === 'revision'));
  assert.deepEqual((await d.plantillas()).map(t => t.nombre), ['Promo del mes', 'Testimonio de un cliente']);
  await assert.rejects(d.guardarPlantilla('', { texto: 'x' }), /nombre/);
  await d.guardarPlantilla('Nueva', { texto: 'Hola', redes: ['instagram'] });
  await d.borrarPlantilla('nueva'); assert.equal((await d.plantillas()).length, 2);
});

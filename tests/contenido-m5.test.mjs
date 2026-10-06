// Plan M5 (6 oct 2026): la cuadrícula del perfil (U2), repetir una pieza (U7) y el informe del mes (U10).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { casillas, intercambio, perfilHTML } from '../src/contenido-perfil.js';
import { fechasRepetidas, copiaDe } from '../src/contenido-repetir.js';
import { crearAlmacen } from '../contenido/piezas.mjs';
import { crearRutas } from '../contenido/rutas.mjs';

const pz = (id, fecha, extra = {}) => ({ id, fecha, hora: '10:00', formato: 'post', redes: ['instagram'], medios: [`2026-10/${id}.jpg`], estado: 'borrador', titulo: id, ...extra });

test('la cuadrícula: solo el feed de Instagram con imagen y día, de lo más nuevo a lo más viejo; lo que ya salió no se mueve', () => {
  const cs = casillas([
    pz('a', '2026-10-01', { salida: { estado: 'publicada' } }), pz('b', '2026-10-10', { estado: 'aprobada' }), pz('c', '2026-10-08'),
    pz('h', '2026-10-09', { formato: 'historia' }), pz('f', '2026-10-09', { redes: ['facebook'] }), pz('s', '2026-10-09', { medios: [] }), pz('i', '', {}), pz('x', '2026-10-09', { estado: 'idea' }),
  ], { hoy: '2026-10-06' });
  assert.deepEqual(cs.map(c => c.id), ['b', 'c', 'a']);
  assert.deepEqual(cs.map(c => c.etiqueta), ['SALE 10 OCT', 'BORRADOR · 8 OCT', 'PUBLICADA']);
  assert.equal(cs[2].pasada, true);
  const html = perfilHTML(cs, { esc: s => s });
  assert.match(html, /data-pf="b" draggable="true"/); assert.doesNotMatch(html, /data-pf="a" draggable/, 'lo publicado no se arrastra');
  assert.match(html, /data-pfm="b:c"/); assert.doesNotMatch(html, /data-pfm="c:a"/, 'no se cambia con lo publicado');
  assert.deepEqual(intercambio(cs[0], cs[1]), [{ id: 'b', fecha: '2026-10-08', hora: '10:00' }, { id: 'c', fecha: '2026-10-10', hora: '10:00' }]);
  assert.match(perfilHTML([]), /Todavía no hay nada/);
});

test('repetir: cada día, semana, 2 semanas o mes; un 31 cae el último día de los meses cortos; con tope', () => {
  assert.deepEqual(fechasRepetidas('2026-10-05', 'semana', 3), ['2026-10-12', '2026-10-19', '2026-10-26']);
  assert.deepEqual(fechasRepetidas('2026-10-30', 'dia', 3), ['2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(fechasRepetidas('2026-10-05', '2semanas', 2), ['2026-10-19', '2026-11-02']);
  assert.deepEqual(fechasRepetidas('2027-01-31', 'mes', 3), ['2027-02-28', '2027-03-31', '2027-04-30']);
  assert.equal(fechasRepetidas('2026-10-05', 'semana', 99).length, 12);
  assert.deepEqual(fechasRepetidas('', 'semana', 2), []); assert.deepEqual(fechasRepetidas('2026-10-05', 'año', 2), []);
  const c = copiaDe({ ...pz('a', '2026-10-05', { estado: 'aprobada', aprobada: { huella: 'x' }, entregada: { remoto: {} }, textos: { x: 'hola' } }) });
  assert.ok(!('estado' in c) && !('aprobada' in c) && !('entregada' in c) && !('fecha' in c) && !('id' in c)); assert.deepEqual(c.textos, { x: 'hola' });
});

test('la ruta de repetir crea borradores (nunca aprobados) y es solo del dueño', async () => {
  const almacen = crearAlmacen({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'ao-m5-')), medioExiste: () => true });
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  const handle = crearRutas({ almacen, json, body });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const api = async (m, p, b) => { const r = await fetch(`http://127.0.0.1:${srv.address().port}${p}`, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json()) }; };
  try {
    const { pieza } = almacen.crear({ titulo: 'Tip del lunes', fecha: '2026-10-05', hora: '09:00', texto: 'Limpia tus lentes así.', redes: ['instagram', 'linkedin'], medios: ['2026-10/a.jpg'] }, { por: 'dueno' });
    assert.equal((await api('POST', `/api/contenido/piezas/${pieza.id}/repetir`, { cada: 'semana', veces: 3, por: 'agente' })).status, 403);
    assert.equal((await api('POST', `/api/contenido/piezas/${pieza.id}/repetir`, { cada: 'nunca', veces: 3 })).status, 400);
    const r = await api('POST', `/api/contenido/piezas/${pieza.id}/repetir`, { cada: 'semana', veces: 3 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.creadas.map(p => [p.fecha, p.hora, p.estado, p.texto]), [['2026-10-12', '09:00', 'borrador', 'Limpia tus lentes así.'], ['2026-10-19', '09:00', 'borrador', 'Limpia tus lentes así.'], ['2026-10-26', '09:00', 'borrador', 'Limpia tus lentes así.']]);
    assert.deepEqual(r.creadas[0].redes, ['instagram', 'linkedin']);
    const sinDia = almacen.crear({ titulo: 'x', texto: 'y' }, { por: 'dueno' }).pieza;
    assert.equal((await api('POST', `/api/contenido/piezas/${sinDia.id}/repetir`, { cada: 'semana', veces: 2 })).status, 409);
  } finally { srv.close(); }
});

import { informeDelMes } from '../contenido/informe.mjs';
import { informeHTML, mesesAtras } from '../src/analiticas-informe.js';

test('el informe del mes: lo que salió, cómo fue, lo mejor, la bandeja y qué repetir; sin datos lo dice y no inventa', () => {
  const vacio = informeDelMes({ mes: '2026-10' });
  assert.match(vacio.texto, /^# Informe de redes — octubre de 2026/);
  assert.match(vacio.texto, /Nada programado este mes/); assert.match(vacio.texto, /Sin datos de Analíticas/); assert.match(vacio.texto, /Todavía no hay datos suficientes/);
  assert.throws(() => informeDelMes({ mes: 'octubre' }), /AAAA-MM/);
  const piezas = [
    { id: 'a', titulo: 'Combo', fecha: '2026-10-03', estado: 'aprobada', redes: ['instagram', 'facebook'], formato: 'reel' },
    { id: 'b', titulo: 'Kit', fecha: '2026-10-08', estado: 'aprobada', redes: ['instagram'], formato: 'post' },
    { id: 'c', titulo: 'Idea suelta', fecha: '2026-10-20', estado: 'borrador', redes: ['instagram'], formato: 'post' },
    { id: 'z', titulo: 'Otro mes', fecha: '2026-11-02', estado: 'aprobada', redes: ['instagram'], formato: 'post' },
  ];
  const salida = { a: { estado: 'publicada' }, b: { estado: 'fallo' } };
  const pub = (d, n, tipo) => ({ red: 'instagram', tipo, interacciones: n, alcance: n * 10, texto: `pub ${d}`, publicadaAt: `${d}T15:00:00.000Z` });
  const g = Array.from({ length: 7 }, () => Array(24).fill(0)); g[1][19] = 100;
  const r = informeDelMes({ mes: '2026-10', piezas, salidaDe: id => salida[id], analiticas: { serie: [], publicaciones: [pub('2026-10-02', 90, 'reel'), pub('2026-10-04', 70, 'reel'), pub('2026-10-06', 10, 'imagen'), pub('2026-10-09', 14, 'imagen')] },
    bandeja: [{ estado: 'respondido', cuando: '2026-10-04T10:00:00Z' }, { estado: 'nuevo', cuando: '2026-10-05T10:00:00Z', sospecha: 'x' }, { estado: 'nuevo', cuando: '2026-09-05T10:00:00Z' }], hora: { grid: g, fuente: 'metricool' }, hoy: '2026-11-01' });
  assert.match(r.texto, /1 pieza publicada de 3 planificadas/);
  assert.match(r.texto, /Por red: Instagram 1 · Facebook 1\. Por formato: reel 1/);
  assert.match(r.texto, /1 no salió bien: «Kit»/); assert.match(r.texto, /1 se quedó sin aprobar/);
  assert.match(r.texto, /Las que mejor|«pub 2026-10-02» — Instagram, reel, 90 interacciones/);
  assert.match(r.texto, /Reel 80 \(2\) · Imagen 12 \(2\)/);
  assert.match(r.texto, /2 recibidos: 1 respondidos, 0 sin necesidad de respuesta, 1 pendientes; 1 con órdenes escondidas/);
  assert.match(r.texto, /Más reel: rinde 80 interacciones de media, frente a 12 en imagen/);
  assert.match(r.texto, /mejores horas \(según Metricool\): lunes 19:00/);
  assert.deepEqual(r.cifras, { planificadas: 3, publicadas: 1, fallaron: 1, bandeja: 2 });
  const enCurso = informeDelMes({ mes: '2026-10', piezas, salidaDe: id => salida[id], hoy: '2026-10-10' });
  assert.match(enCurso.texto, /1 está por salir en lo que queda del mes/); assert.doesNotMatch(enCurso.texto, /sin aprobar/, 'lo que aún no llega no está «sin aprobar»');
});

test('el informe en la página: un markdown mínimo y escapado', () => {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const h = informeHTML('# Título\n\n## Lo que salió\n- **3** piezas <script>x</script>\n- ver https://instagram.test/p/1\n_nota_', esc);
  assert.match(h, /<h2>Título<\/h2><h3>Lo que salió<\/h3><ul><li><b>3<\/b> piezas &lt;script&gt;x&lt;\/script&gt;<\/li>/);
  assert.match(h, /<a href="https:\/\/instagram.test\/p\/1" target="_blank" rel="noopener noreferrer">/);
  assert.match(h, /<p><i>nota<\/i><\/p>$/);
  assert.deepEqual(mesesAtras(new Date(2026, 0, 15), 3), ['2026-01', '2025-12', '2025-11']);
});

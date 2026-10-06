// Plan T6 (6 oct 2026): el cronómetro de las personas (uno activo por persona), los WEBHOOKS salientes (firmados, solo https y nunca a
// una red privada, reintentos, se apagan solos tras 10 fallos y lo dicen; lo que sale es lo justo) y los campos del detalle a gusto.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { iniciar, parar, total, activo, textoDuracion } from '../tareas/cronometro.mjs';
import { crearWebhooks, privada, revisarDestino, resumenTarea, firmar } from '../tareas/webhooks.mjs';
import { crearBus } from '../tareas/eventos.mjs';
import { detalleHTML } from '../src/tareas/detalle.js';

test('el cronómetro: uno activo por persona; empezar otro para el anterior; la suma de lo que lleva', () => {
  const l = [{ id: 'a', state: 'next' }, { id: 'b', state: 'next' }, { id: 'c', state: 'done' }];
  assert.deepEqual(iniciar(l, 'a', 'Ana', 1000), { paradas: [] });
  assert.equal(activo(l, 'Ana').tarea.id, 'a');
  assert.deepEqual(iniciar(l, 'b', 'Ana', 61000), { paradas: ['a'] }, 'empezar otra para la anterior');
  iniciar(l, 'a', 'Luis', 2000); assert.equal(activo(l, 'Luis').tarea.id, 'a', 'cada persona el suyo');
  assert.equal(total(l[0], 0, 'Ana'), 60000); assert.equal(parar(l[1], 'Ana', 121000), 1); assert.equal(total(l[1], 0, 'Ana'), 60000);
  assert.equal(activo(l, 'Ana'), null); assert.match(iniciar(l, 'c', 'Ana').error, /hecha/);
  assert.equal(textoDuracion(3 * 3600e3 + 5 * 60e3), '3 h 05 min');
});

test('webhooks: el destino se revisa (https, sin redes privadas ni claves en la dirección)', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '192.168.1.5', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) assert.ok(privada(ip), ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1']) assert.ok(!privada(ip), ip);
  assert.match(revisarDestino('http://example.com/x').error, /https/); assert.match(revisarDestino('https://u:p@example.com').error, /usuario/);
  assert.equal(revisarDestino('http://127.0.0.1:9/x', { permitirLocal: true }).local, true); assert.match(revisarDestino('http://127.0.0.1:9/x').error, /https/);
  assert.deepEqual(Object.keys(resumenTarea({ id: 'a', title: 'T', state: 'done', result: 'secreto', comments: [1], draft: 'x' })).sort(), ['agente', 'departamento', 'estado', 'fallo', 'id', 'limite', 'persona', 'prioridad', 'proyecto', 'titulo'], 'nunca el resultado, el borrador ni los comentarios');
});

test('webhooks: firmados con la clave de una variable de entorno; reintento; tras 10 fallos se apagan y avisan; un redirect no se sigue', async () => {
  const llegadas = []; let fallar = 0;
  const srv = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => { llegadas.push({ h: rq.headers, b }); if (fallar > 0) { fallar--; rs.writeHead(500); return rs.end(); } rs.writeHead(200); rs.end('{}'); }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-wh-')), avisos = [];
  const cfg = [{ id: 'zapier', url: `http://127.0.0.1:${srv.address().port}/h`, eventos: ['tarea.estado'], secreto: 'AO_WEBHOOK_PRUEBA' }, { id: 'malo', url: 'https://hooks.example.test/x', resolverA: '10.0.0.5' }];
  const env = { AO_WEBHOOK_PRUEBA: 'clave-de-prueba-larga' }; // secrets-ok
  const wh = crearWebhooks({ config: () => cfg, dataDir: dir, avisar: t => avisos.push(t), env, permitirLocal: true, esperas: [1, 1, 1], resolver: async () => [{ address: '10.0.0.5' }] });
  try {
    const bus = crearBus(); wh.escuchar(bus);
    const r = await wh.despachar('tarea.estado', { tarea: { id: 't1', title: 'Post', state: 'done', dept: 'marketing', agent: 'x', result: 'NO DEBE SALIR' }, de: 'doing', a: 'done', por: 'agente:x' });
    assert.deepEqual(r.map(x => [x.id, x.ok]), [['zapier', true], ['malo', false]]);
    assert.match(r[1].error, /red privada/, 'una dirección que resuelve a una red privada no se llama');
    const l = llegadas[0], cuerpo = JSON.parse(l.b);
    assert.equal(l.h['x-ao-firma'], 'sha256=' + crypto.createHmac('sha256', env.AO_WEBHOOK_PRUEBA).update(l.b).digest('hex')); assert.equal(firmar(env.AO_WEBHOOK_PRUEBA, l.b), l.h['x-ao-firma']);
    assert.equal(cuerpo.evento, 'tarea.estado'); assert.equal(cuerpo.a, 'done'); assert.equal(cuerpo.tarea.titulo, 'Post'); assert.ok(!l.b.includes('NO DEBE SALIR'));
    fallar = 2; const r2 = await wh.despachar('tarea.estado', { tarea: { id: 't2', title: 'X', state: 'next' } }); assert.equal(r2[0].ok, true, 'reintenta y llega'); assert.equal(llegadas.length, 4);
    assert.equal((await wh.despachar('tarea.creada', { tarea: { id: 't3', title: 'Y' } })).filter(x => x.id === 'zapier').length, 0, 'solo los eventos que pidió');
    fallar = 1000; for (let i = 0; i < 10; i++) await wh.despachar('tarea.estado', { tarea: { id: 'f' + i, title: 'F' } });
    const st = wh.estado(); assert.ok(st.apagados.zapier, 'tras 10 fallos se apaga'); assert.ok(avisos.some(a => /«zapier» falló 10 veces seguidas y se apagó/.test(a)));
    const antes = llegadas.length; await wh.despachar('tarea.estado', { tarea: { id: 'z', title: 'Z' } }); assert.equal(llegadas.length, antes, 'apagado: no se llama');
    wh.encender('zapier'); fallar = 0; assert.equal((await wh.despachar('tarea.estado', { tarea: { id: 'z', title: 'Z' } }))[0].ok, true);
    assert.equal(st.destinos[0].firma, true); assert.ok(!JSON.stringify(st).includes(env.AO_WEBHOOK_PRUEBA), 'la clave no sale en el estado');
    assert.ok(st.historial.length <= 50);
  } finally { srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('el detalle: los campos se ocultan y se ordenan a gusto; el cronómetro está a mano', () => {
  const t = { id: 'a', state: 'next', dept: 'sales', agent: 'p', title: 'T', text: 'x', prioridad: 'media' };
  const ctx = { porId: new Map([['a', t]]), agente: () => ({ name: 'P' }), depto: () => ({ name: 'VENTAS', chip: '#eee' }), proyectos: () => [], etiquetas: () => [], tareas: () => [t], agentesDe: () => [{ id: 'p', name: 'P' }], personas: () => [], quienSoy: () => 'Tú',
    prefCampos: () => ({ orden: ['limite', 'prioridad'], ocultos: ['estimacion'] }) };
  const h = detalleHTML({ tarea: t, bitacora: [] }, ctx);
  const orden = [...h.matchAll(/data-campo="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(orden.slice(0, 2), ['limite', 'prioridad']); assert.ok(!orden.includes('estimacion'), 'oculto');
  assert.match(h, /data-campover="estimacion"(?! checked)/); assert.match(h, /data-crono="iniciar"/);
});

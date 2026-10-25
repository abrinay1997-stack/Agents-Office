// Fase 5 — mudar Contenido de la computadora a la nube: el exportador (scripts/migrar/contenido.mjs) lee las piezas .md, la cola, la agenda de Meta y la foto diaria; la nube las adopta
// SIN pisar lo suyo, sin dejar nada publicando y sin llevarse un solo token.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SALTAR } from './d1-memoria.mjs';
import { montar, enPanama } from './contenido-ayudas.mjs';
import { crearAlmacen } from '../../contenido/piezas.mjs';
import { exportar } from '../../scripts/migrar/contenido.mjs';
import { partirFilas } from '../../scripts/migrar-a-nube.mjs';

const DIA = 864e5;

async function computadoraDelDueno() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mig-')), vault = path.join(raiz, 'brain'), brain = path.join(vault, 'Agents Office');
  fs.mkdirSync(path.join(brain, 'media', '2026-10'), { recursive: true }); fs.writeFileSync(path.join(brain, 'media', '2026-10', 'foto.jpg'), 'x'); fs.writeFileSync(path.join(brain, 'media', '2026-10', 'foto.json'), JSON.stringify({ kind: 'image', w: 1080, h: 1350 }));
  const reloj = Date.now();
  const almacen = crearAlmacen({ dir: path.join(brain, 'contenido'), ahora: () => reloj, medioExiste: () => true });
  const f = enPanama(reloj + 3 * DIA).fecha;
  const ap = almacen.crear({ titulo: 'Aprobada', fecha: f, hora: '18:00', redes: ['facebook'], texto: 'Una pieza aprobada.', medios: ['2026-10/foto.jpg'], estado: 'revision' }).pieza;
  const aprobada = almacen.aprobar(ap.id).pieza;
  const borrador = almacen.crear({ titulo: 'Borrador', texto: 'Sin día todavía.' }).pieza;
  const data = path.join(raiz, 'data', 'contenido'); fs.mkdirSync(path.join(data, 'metricas'), { recursive: true });
  const salida = { estado: 'en_red', huella: aprobada.aprobada.huella, momento: reloj + 3 * DIA, conductor: 'metricool', redes: { facebook: { estado: 'en_red' } }, remoto: { 'post:0': { id: 4242 } }, historial: [] };
  fs.writeFileSync(path.join(data, 'cola.json'), JSON.stringify({ entradas: { [aprobada.id]: salida } }));
  fs.writeFileSync(path.join(data, 'simulacro.json'), JSON.stringify({ posts: { 'sim-1': { momento: 1, redes: ['facebook'] } } }));
  fs.writeFileSync(path.join(data, 'metricas', 'dias-2026-10.json'), JSON.stringify({ 'facebook:P1|2026-10-20': { cuentaId: 'facebook:P1', red: 'facebook', fecha: '2026-10-20', seguidores: 100 } }));
  fs.writeFileSync(path.join(data, 'metricas', 'publicaciones.json'), JSON.stringify({ 'facebook:P1|P1_1': { id: 'facebook:P1|P1_1', cuentaId: 'facebook:P1', red: 'facebook', externoId: 'P1_1', publicadaAt: '2026-10-19T12:00:00.000Z', interacciones: 9, miniatura: '/api/contenido/miniatura/' + 'a'.repeat(20) } }));
  return { raiz, vault, aprobada, borrador, salida };
}
async function subir(t, exp) {
  for (const [coleccion, filas] of Object.entries(exp.filas)) for (const parte of partirFilas(filas)) { const r = await t.api('/api/migrar/filas', { metodo: 'POST', cuerpo: { coleccion, filas: parte } }); assert.equal(r.status, 200, JSON.stringify(r.datos)); }
}

test('exportar: piezas con sus medidas, cola, agenda y foto diaria; el modo siempre «simulacro»; ni un token', { skip: SALTAR }, async () => {
  const c = await computadoraDelDueno();
  process.env.AO_DATA = path.join(c.raiz, 'data'); process.env.META_ACCESS_TOKEN = 'EAAG-NO-DEBE-SALIR-0123456789'; // secrets-ok: de mentira, para comprobar que no viaja
  let exp; try { exp = await exportar({ raiz: c.raiz, vault: c.vault }); } finally { delete process.env.AO_DATA; delete process.env.META_ACCESS_TOKEN; }
  assert.equal(exp.filas['contenido-piezas'].length, 2); assert.deepEqual(exp.filas['contenido-piezas'].find(f => f.id === c.aprobada.id).valor.medidas, { '2026-10/foto.jpg': { ancho: 1080, alto: 1350 } });
  assert.equal(exp.filas['contenido-cola'][0].id, c.aprobada.id); assert.equal(exp.filas['contenido-dias'].length, 1); assert.equal(exp.filas['contenido-pubs'][0].valor.miniatura, '', 'las miniaturas eran archivos: se bajan otra vez');
  const docs = Object.fromEntries(exp.filas['contenido-docs'].map(d => [d.id, d.valor])); assert.equal(docs['config.contenido'].modo, 'simulacro'); assert.ok(docs['contenido.simulacro']);
  assert.ok(!JSON.stringify(exp).includes('EAAG-NO-DEBE-SALIR'), 'ningún token viaja');
  for (const f of Object.values(exp.filas).flat()) assert.ok(f.id && typeof f.valor === 'object', 'la forma que acepta /api/migrar/filas');
});

test('adoptar: las piezas llegan con su OK y su huella, lo entregado no se vuelve a entregar, y repetir la migración no pisa lo que la nube ya cambió', { skip: SALTAR }, async () => {
  const c = await computadoraDelDueno(); const t = await montar({ meta: false }); await t.r2.put('2026-10/foto.jpg', new Uint8Array([0xff, 0xd8, 0xff, 1]));
  process.env.AO_DATA = path.join(c.raiz, 'data'); const exp = await exportar({ raiz: c.raiz, vault: c.vault }); delete process.env.AO_DATA;
  await subir(t, exp);
  const g = await t.api('/api/contenido');   // la primera vez que se usa Contenido, adopta
  assert.equal(g.status, 200); assert.equal(g.datos.piezas.length, 2, JSON.stringify(g.datos).slice(0, 300));
  const p = g.datos.piezas.find(x => x.id === c.aprobada.id); assert.equal(p.estado, 'aprobada'); assert.equal(p.aprobada.huella, c.aprobada.aprobada.huella); assert.equal(p.cambiadaTrasAprobar, false, 'la huella de la nube es la de la computadora');
  assert.equal(p.salida.estado, 'en_red', 'la cola vino con la pieza: lo entregado no se vuelve a entregar'); assert.equal(g.datos.ajustes.modo, 'simulacro');
  assert.equal(t.d1._db.prepare("select count(*) n from filas where coleccion like 'contenido-%'").get().n, 0, 'lo adoptado se quita de la tabla genérica');
  assert.equal(t.d1._db.prepare('select count(*) n from contenido_dias').get().n, 1);
  assert.ok(t.d1._db.prepare('select 1 from docs where clave = ?').get('contenido.simulacro'));
  // la nube cambia una pieza y la migración se repite: no la pisa
  await t.api('/api/contenido/piezas/' + c.borrador.id, { metodo: 'PATCH', cuerpo: { titulo: 'Editado en la nube' } });
  await subir(t, exp); const g2 = await t.api('/api/contenido');
  assert.equal(g2.datos.piezas.find(x => x.id === c.borrador.id).titulo, 'Editado en la nube'); assert.equal(g2.datos.piezas.length, 2);
  // y con la cola adoptada, una vuelta del cron no entrega otra vez ni publica nada
  const { cadaMinuto } = await import('../worker/modulos/contenido.js'); await cadaMinuto(t.env);
  assert.equal(JSON.parse(t.d1._db.prepare('select json from contenido_cola where pieza = ?').get(c.aprobada.id).json).remoto['post:0'].id, 4242);
  assert.equal(t.stand.llamadas.length, 0);
});

test('adoptar por tandas: con muchas filas lo termina la próxima vuelta; una fila rara se descarta sin tumbar nada', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false });
  const filas = Array.from({ length: 30 }, (_, i) => ({ id: `p-20261101-${String(i).padStart(4, '0').replace(/[^a-f0-9]/g, 'a')}`.slice(0, 15), valor: { titulo: 'p' + i, texto: 'x', fecha: '2026-11-01', hora: '10:00', redes: ['facebook'] } }));
  const ids = new Set(filas.map(f => f.id)); assert.equal(ids.size, 30);
  await t.api('/api/migrar/filas', { metodo: 'POST', cuerpo: { coleccion: 'contenido-piezas', filas } });
  await t.api('/api/migrar/filas', { metodo: 'POST', cuerpo: { coleccion: 'contenido-piezas', filas: [{ id: 'no-es-un-id', valor: { titulo: 'x' } }, { id: 'p-20261101-ffff', valor: { fecha: '2026-02-31' } }] } });
  const { adoptar } = await import('../worker/lib/contenido/migracion.js');
  const a = await adoptar(t.d1, { max: 12 }); assert.equal(a.quedan > 0, true);
  let r = a; while (r.quedan) r = await adoptar(t.d1, { max: 12 });
  assert.equal(t.d1._db.prepare('select count(*) n from contenido_piezas').get().n, 30, 'las dos filas raras no entraron');
});

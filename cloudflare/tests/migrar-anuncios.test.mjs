// La migración de Anuncios y la Bandeja: scripts/migrar/anuncios.mjs lee lo de esta computadora (sin llaves) y el Worker lo pone en su sitio
// la primera vez que se abre Anuncios o la Bandeja, con lista blanca de rutas y sin pisar lo que la nube ya tiene.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportar, ARCHIVOS } from '../../scripts/migrar/anuncios.mjs';
import { aplicarMigracion, RUTAS_MIGRABLES } from '../worker/lib/anuncios-nube.js';
import { guardarDoc, leerDoc } from '../worker/lib/almacen.js';
const TOKEN_REAL = 'EAA' + 'Gm0PX4ZCps'.repeat(8); // con la forma de un token de Meta de verdad (alfanumérico y largo), inventado
import { SALTAR, crearD1 } from './d1-memoria.mjs';
import { nube } from './ayuda-meta.mjs';

function datosLocales() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mig-an-')), datos = path.join(dir, 'data');
  fs.mkdirSync(path.join(datos, 'anuncios'), { recursive: true }); fs.mkdirSync(path.join(datos, 'contenido'), { recursive: true });
  fs.writeFileSync(path.join(datos, 'anuncios', 'borradores.json'), JSON.stringify({ items: [{ id: 'bor1', nombre: 'Combo', estado: 'borrador', creadoAt: '2026-10-20T10:00:00.000Z', objetivo: 'mensajes', presupuesto: { tipo: 'diario', usd: 10 }, creativos: [] }] }));
  fs.writeFileSync(path.join(datos, 'anuncios', 'historial.jsonl'), '{"at":"2026-10-20T10:00:00.000Z","quien":"dueno","que":"pausar","objeto":{"id":"1","nivel":"campana","nombre":"X"}}\n');
  fs.writeFileSync(path.join(datos, 'anuncios', 'creaciones.json'), JSON.stringify({ bor0: { error: `Meta dijo: token ${TOKEN_REAL} caducó`, creados: [] } }));
  fs.writeFileSync(path.join(datos, 'anuncios', 'cifras.json'), '{"no":"se sube"}');
  fs.writeFileSync(path.join(datos, 'contenido', 'bandeja.json'), JSON.stringify({ items: { 'meta:c1': { id: 'meta:c1', estado: 'borrador', borrador: { texto: 'Gracias' } } }, alias: {}, fuentes: {} }));
  const local = path.join(dir, 'office.config.local.json');
  fs.writeFileSync(local, JSON.stringify({ anuncios: { cuenta: 'act_1001', topeDiario: 25, topeMensual: 200, topeCampana: 100 }, contenido: { modo: 'simulacro' } }));
  return { dir, datos, local };
}

test('el exportador lee lo de la computadora, no sube cifras ni llaves, y quita cualquier token que un error guardado citara', async () => {
  const { dir, datos, local } = datosLocales();
  const antes = { AO_DATA: process.env.AO_DATA, AO_LOCAL_CONFIG: process.env.AO_LOCAL_CONFIG }; process.env.AO_DATA = datos; process.env.AO_LOCAL_CONFIG = local;
  try {
    const { filas, docs } = await exportar({ raiz: dir });
    assert.deepEqual(filas, {});
    assert.deepEqual(Object.keys(docs).sort(), ['anuncios.ajustes', 'anuncios.migracion.bandeja', 'anuncios.migracion.borradores', 'anuncios.migracion.creaciones', 'anuncios.migracion.historial']);
    for (const [k, v] of Object.entries(docs)) { assert.match(k, /^[a-z][a-z0-9_.-]{1,60}$/, 'la clave la admite /api/migrar/docs'); assert.equal(typeof v, 'object'); }
    for (const nombre of Object.keys(docs).filter((k) => k.startsWith('anuncios.migracion.'))) assert.ok(RUTAS_MIGRABLES.has(docs[nombre].ruta), docs[nombre].ruta);
    assert.deepEqual(docs['anuncios.ajustes'].anuncios, { cuenta: 'act_1001', topeDiario: 25, topeMensual: 200, topeCampana: 100 });
    assert.ok(!JSON.stringify(docs).includes(TOKEN_REAL), 'ningún token');
    assert.ok(!JSON.stringify(docs).includes('"se sube"'), 'las cifras diarias no viajan: la nube las vuelve a leer');
    assert.ok(Object.values(ARCHIVOS).every((r) => RUTAS_MIGRABLES.has(r)), 'el exportador y la lista blanca del Worker dicen lo mismo');
  } finally { for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});

test('en la nube: lo exportado pasa a su sitio al abrir Anuncios; una ruta fuera de la lista o un texto que no es JSON se descartan; lo que ya hay no se pisa', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  await guardarDoc(d1, 'anuncios.migracion.borradores', { ruta: 'data/anuncios/borradores.json', texto: JSON.stringify({ items: [{ id: 'bor1' }] }) });
  await guardarDoc(d1, 'anuncios.migracion.historial', { ruta: 'data/anuncios/historial.jsonl', texto: '{"a":1}\n{"b":2}\n' });
  await guardarDoc(d1, 'anuncios.migracion.malo', { ruta: '../../etc/passwd', texto: '{}' });
  await guardarDoc(d1, 'anuncios.migracion.roto', { ruta: 'data/anuncios/sugerencias.json', texto: '{ no es json' });
  await guardarDoc(d1, 'fs:data/anuncios/papelera.json', { t: '{"items":["de la nube"]}' });
  await guardarDoc(d1, 'anuncios.migracion.papelera', { ruta: 'data/anuncios/papelera.json', texto: '{"items":["de la computadora"]}' });
  const hechas = await aplicarMigracion(d1);
  assert.deepEqual(hechas.sort(), ['data/anuncios/borradores.json', 'data/anuncios/historial.jsonl']);
  assert.equal((await leerDoc(d1, 'fs:data/anuncios/borradores.json')).valor.t.includes('bor1'), true);
  assert.equal((await leerDoc(d1, 'fs:data/anuncios/sugerencias.json')).version, 0, 'un texto roto no entra');
  assert.equal((await leerDoc(d1, 'fs:data/anuncios/papelera.json')).valor.t, '{"items":["de la nube"]}', 'lo de la nube manda');
  assert.equal((await d1.prepare("select count(*) n from docs where clave like 'anuncios.migracion.%'").first()).n, 0, 'los documentos de paso se borran');
});

test('de punta a punta: lo migrado se ve en el panel de la nube (borradores) y en la Bandeja', { skip: SALTAR }, async () => {
  const { dir, datos, local } = datosLocales();
  const antes = { AO_DATA: process.env.AO_DATA, AO_LOCAL_CONFIG: process.env.AO_LOCAL_CONFIG }; process.env.AO_DATA = datos; process.env.AO_LOCAL_CONFIG = local;
  let docs; try { ({ docs } = await exportar({ raiz: dir })); } finally { for (const [k, v] of Object.entries(antes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
  const o = await nube({ preparar: false, config: {} });
  for (const [clave, valor] of Object.entries(docs)) await guardarDoc(o.d1, clave, valor); // lo que haría /api/migrar/docs
  const b = await o.api('admin', 'GET', '/api/anuncios/borradores');
  assert.equal(b.status, 200); assert.deepEqual(b.j.items.map((x) => x.id), ['bor1']);
  assert.equal((await o.api('admin', 'GET', '/api/anuncios/historial')).j.items.length, 1);
  const l = await o.api('admin', 'GET', '/api/contenido/bandeja'); assert.equal(l.status, 200); assert.equal(l.j.items[0].id, 'meta:c1'); assert.equal(l.j.items[0].borrador.texto, 'Gracias');
  const cfg = await o.api('admin', 'GET', '/api/anuncios'); assert.deepEqual(cfg.j.topes, { diario: 25, mensual: 200, campana: 100 }, 'los topes del dueño viajaron con la migración (anuncios.ajustes)');
});

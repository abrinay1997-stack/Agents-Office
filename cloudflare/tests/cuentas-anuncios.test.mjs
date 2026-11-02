// 2 nov 2026 — sobre qué cuenta (página/Instagram) corre cada anuncio y de qué cuenta es cada mensaje de la Bandeja, también en la nube.
// La nube usa las MISMAS rutas y el mismo núcleo puro que la oficina local (anuncios/rutas.mjs, contenido/bandeja.mjs): aquí se comprueba lo que
// la nube pone de su parte — la ruta de la Bandeja pasa `cuenta`, la Bandeja de la nube recibe la lista de cuentas de Meta, y Dimitri y los agentes
// piden «solo esta cuenta» a la API (solo lectura). Los límites de D1 no cambian: no hay tablas nuevas ni consultas nuevas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolverBandeja } from '../worker/lib/bandeja-rutas.js';
import { crearConsultas } from '../worker/lib/dimitri/consultas.js';
import { HERRAMIENTAS } from '../../consultas-core.mjs';
import { TOOLS } from '../../anuncios-tools.mjs';
import { crearBandeja } from '../../contenido/bandeja.mjs';

const leer = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');

test('la ruta de la Bandeja de la nube pasa ?cuenta= al núcleo compartido, y una cuenta que no existe no devuelve «todas»', async () => {
  const llamadas = [], bandeja = { abierta() {}, listar: a => { llamadas.push(a); return { items: [], cuenta: {}, pendientes: 0, cuentaNoEncontrada: a.cuenta === 'nadie' }; } };
  const r = await resolverBandeja({ bandeja, metodo: 'GET', ruta: '/api/contenido/bandeja', url: new URL('https://x/api/contenido/bandeja?estado=pendiente&cuenta=%40bukoflow') });
  assert.equal(r.status, 200); assert.equal(llamadas[0].cuenta, '@bukoflow'); assert.equal(llamadas[0].estado, 'pendiente');
  const n = await resolverBandeja({ bandeja, metodo: 'GET', ruta: '/api/contenido/bandeja', url: new URL('https://x/api/contenido/bandeja?cuenta=nadie') });
  assert.equal(n.cuerpo.cuentaNoEncontrada, true);
  await resolverBandeja({ bandeja, metodo: 'GET', ruta: '/api/contenido/bandeja', url: new URL('https://x/api/contenido/bandeja') }); assert.equal(llamadas[2].cuenta, '');
});

test('la Bandeja de la nube recibe la lista de cuentas de Meta (para decir de qué cuenta es cada mensaje)', () => {
  const src = leer('../worker/lib/anuncios-nube.js'); const i = src.indexOf('export function construirBandeja');
  assert.ok(i > 0 && /cuentas: \(\) => \{ try \{ return meta\?\.estado\?\.\(\)\?\.cuentas/.test(src.slice(i, i + 3000)), 'construirBandeja pasa `cuentas` a crearBandeja');
  // y el núcleo compartido lo usa: el mismo mensaje con y sin la lista
  const fuente = { listo: () => ({ ok: true }), id: 'meta', estado: () => ({}) };
  const bj = crearBandeja({ meta: fuente, elegir: () => 'meta', almacen: { leer: () => ({ items: { 'meta:c1': { id: 'meta:c1', fuente: 'meta', tipo: 'comentarios', red: 'instagram', cuentaId: 'instagram:IG2', estado: 'nuevo', cuando: '2026-01-01T00:00:00Z' } } }), escribir() {} }, cuentas: () => [{ id: 'instagram:IG2', red: 'instagram', nombre: 'BukoFlow IG', usuario: 'bukoflow', paginaId: 'P2' }] });
  const m = bj.listar().items[0]; assert.equal(m.deCuenta.usuario, 'bukoflow'); assert.equal(bj.listar({ cuenta: '@bukoflow' }).items.length, 1); assert.equal(bj.listar({ cuenta: '@otra' }).items.length, 0);
});

test('Dimitri (nube): ver_anuncios acepta `cuenta` y la pide a la API de solo lectura; sin ella, todo como siempre', async () => {
  assert.ok(HERRAMIENTAS.find(h => h.nombre === 'ver_anuncios').parametros.cuenta, 'el catálogo de consultas la declara');
  const pedidos = []; const office = async r => { pedidos.push(r); return r.startsWith('/api/anuncios/texto') ? { texto: 'Campañas (1)…\n- ANUNCIO A2 · CUENTA: Facebook «BukoFlow»' } : { configurado: false, motivo: 'sin Meta' }; };
  const c = crearConsultas({ env: {}, db: null, office, C: {}, lista: [], cfg: {} });
  const r = await c.ejecutar('ver_anuncios', { cuenta: '@bukoflow', rango: '30d' });
  assert.match(pedidos[0], /^\/api\/anuncios\/texto\?rango=30d&que=campanas&nivel=anuncio&cuenta=%40bukoflow$/); assert.match(r.texto, /BukoFlow/); assert.ok(!r.esError);
  await c.ejecutar('ver_anuncios', {}); assert.equal(pedidos[1], '/api/anuncios?rango=7d');
  assert.ok(pedidos.every(p => p.startsWith('/api/anuncios')), 'solo lee');
});

test('las fotos de las cuentas: solo hosts de Meta que la nube ya reescribe por /api/imagen-meta; la CSP no abre ninguno nuevo', async () => {
  const { fotoMeta } = await import('../../anuncios/cuentas.mjs');
  assert.equal(fotoMeta('https://scontent.xx.fbcdn.net/a.jpg'), 'https://scontent.xx.fbcdn.net/a.jpg'); assert.equal(fotoMeta('http://scontent.xx.fbcdn.net/a.jpg'), ''); assert.equal(fotoMeta('https://evil.example/a.jpg'), ''); assert.equal(fotoMeta('https://fbcdn.net.evil.example/a.jpg'), ''); assert.equal(fotoMeta('javascript:alert(1)'), '');
  const nube = leer('../public/nube.js'); for (const h of ['fbcdn.net', 'cdninstagram.com', 'fbsbx.com']) assert.ok(nube.includes(h), `nube.js reescribe ${h}`); assert.ok(nube.includes('/api/imagen-meta?u='));
  assert.match(leer('../worker/lib/imagen-meta.js'), /img-src 'self' data: blob:/, 'la CSP sigue sin abrir hosts de terceros (la vigila csp-oficina.test.mjs); la foto va por el mismo origen');
});

test('los agentes (nube y local comparten anuncios-tools.mjs): ver_campanas y ver_resultados_anuncios aceptan `cuenta` y no hay herramienta que gaste', () => {
  for (const n of ['ver_campanas', 'ver_resultados_anuncios']) assert.ok(TOOLS.find(t => t.name === n).inputSchema.properties.cuenta);
  assert.ok(!TOOLS.some(t => /^(activar|pausar|crear_en_meta|gastar|subir)/.test(t.name)), 'sigue sin haber una herramienta que cambie o gaste');
});

// Fase 0 de Anuncios (8 oct 2026): la versión de Graph y su caducidad, y el freno por uso de contenido/meta.mjs, contra el Meta de
// mentira compartido (tests/meta-stand.mjs). El freno lo heredan publicar, Analíticas, Anuncios y la Bandeja: por eso vive en el cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearMeta, leerUso, ritmoDe, caducidad, VERSION_GRAPH, VERSIONES, CODIGOS_LIMITE, ESPERA_LIMITE_MIN, mensajeMeta } from '../contenido/meta.mjs';
import { crearMetaStand, TOKEN_STAND, json } from './meta-stand.mjs';

const MIN = 60e3;
const montar = (opciones = {}) => {
  let reloj = Date.UTC(2026, 9, 8, 15, 0);
  const g = crearMetaStand({ permisos: ['pages_show_list'], ...opciones });
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND }, fetchFn: g.fetchFn, dir: fs.mkdtempSync(path.join(os.tmpdir(), 'ao-freno-')), ahora: () => reloj });
  return { g, meta, avanzar: ms => { reloj += ms; } };
};

test('la versión fijada es v26.0, está en la tabla y le queda vida en las dos APIs', () => {
  assert.equal(VERSION_GRAPH, 'v26.0');
  assert.ok(VERSIONES[VERSION_GRAPH], 'la versión fijada tiene sus fechas');
  const c = caducidad(VERSION_GRAPH, Date.UTC(2026, 9, 8));
  assert.equal(c.conocida, true);
  for (const d of [c.graph, c.marketing]) assert.ok(d === null || d > 90);
});

test('caducidad: cuenta los días que quedan y marca lo que ya caducó', () => {
  const c = caducidad('v23.0', Date.UTC(2026, 9, 8));
  assert.ok(c.marketing < 0, 'la Marketing API v23 caducó el 9 jun 2026');
  assert.ok(c.graph > 300, 'la Graph API v23 vive hasta oct 2027');
  assert.equal(caducidad('v9.9').conocida, false);
});

test('leerUso: el mayor porcentaje de las tres cabeceras y los minutos que pide Meta', () => {
  const h = new Headers({
    'x-app-usage': JSON.stringify({ call_count: 12, total_time: 30, total_cputime: 8 }),
    'x-business-use-case-usage': JSON.stringify({ 9001: [{ type: 'ads_management', call_count: 81, total_cputime: 10, total_time: 10, estimated_time_to_regain_access: 7 }] }),
    'x-ad-account-usage': JSON.stringify({ acc_id_util_pct: 40, reset_time_duration: 0 }),
  });
  assert.deepEqual(leerUso(h), { visto: true, pct: 81, recuperarMin: 7 });
  assert.deepEqual(leerUso(new Headers()), { visto: false, pct: 0, recuperarMin: 0 });
  assert.equal(leerUso(new Headers({ 'x-app-usage': 'no es json' })).visto, false, 'lo que no se puede leer no cuenta');
  assert.deepEqual([ritmoDe(10), ritmoDe(75), ritmoDe(92)], [1, 2, 4]);
  for (const c of [4, 17, 32, 613, 80000, 80004, 80014]) assert.ok(CODIGOS_LIMITE.includes(c), `el ${c} es un límite`);
  assert.equal(CODIGOS_LIMITE.includes(100), false);
});

test('el uso se apunta en cada respuesta y se enseña sin token', async () => {
  const t = montar({ uso: { app: 78, negocio: 20, cuenta: 5 } });
  await t.meta.graph(TOKEN_STAND, '/me/accounts');
  const u = t.meta.uso();
  assert.equal(u.pct, 78); assert.equal(u.ritmo, 2); assert.equal(u.frenadoHasta, null);
  assert.ok(!JSON.stringify(t.meta.estado()).includes(TOKEN_STAND));
  assert.equal(t.meta.estado().uso.pct, 78);
});

test('un límite de Meta frena TODO: no se vuelve a llamar hasta que pase la espera, y luego sí', async () => {
  const t = montar({ fallar: { limite: 1 } });
  await assert.rejects(t.meta.graph(TOKEN_STAND, '/me/accounts'), e => e.codigo === 17 && e.transitorio);
  const antes = t.g.llamadas.length;
  const e = await t.meta.enviar(TOKEN_STAND, '/P1/feed', { campos: { message: 'hola' } }).catch(x => x);
  assert.equal(e.frenado, true); assert.equal(e.transitorio, true);
  assert.match(mensajeMeta(e), /saturado|limitó/);
  assert.equal(t.g.llamadas.length, antes, 'frenado: ni se intenta (seguir llamando alarga el castigo)');
  assert.ok(t.meta.uso().frenadoHasta);
  t.avanzar(ESPERA_LIMITE_MIN * MIN);
  await t.meta.graph(TOKEN_STAND, '/me/accounts');
  assert.equal(t.g.llamadas.length, antes + 1, 'pasada la espera vuelve a llamar');
});

test('la espera es la que dice Meta (estimated_time_to_regain_access, en minutos) si la dice', async () => {
  const t = montar({ uso: { negocio: 100, recuperarMin: 12 } });
  await t.meta.graph(TOKEN_STAND, '/me/accounts'); // al 100 %: Meta va a limitar
  t.avanzar(ESPERA_LIMITE_MIN * MIN);
  await assert.rejects(t.meta.graph(TOKEN_STAND, '/me/accounts'), e => e.frenado, 'a los 5 min sigue frenado: Meta dijo 12');
  t.g.st.uso = null; t.avanzar(7 * MIN);
  await t.meta.graph(TOKEN_STAND, '/me/accounts');
});

test('los permisos se dicen por función: lo que falta para Analíticas, publicar, Anuncios y los mensajes, por separado', async () => {
  const { PERMISOS_LECTURA, PERMISOS_PUBLICAR, faltanPorFuncion } = await import('../contenido/meta.mjs');
  const t = montar({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR, 'ads_read'] });
  const e = await t.meta.sincronizar();
  assert.deepEqual(e.token.faltan, [], 'Analíticas tiene todo: `faltan` sigue siendo lo de leer');
  assert.deepEqual(e.token.faltanPor.anuncios, ['ads_management']);
  assert.deepEqual(e.token.faltanPor.mensajes, ['pages_messaging', 'pages_manage_metadata', 'instagram_manage_messages']);
  assert.deepEqual(e.token.faltanPor.publicar, []);
  assert.deepEqual(faltanPorFuncion(null), {}, 'si Meta no dijo los permisos, no se inventa que faltan');
});

test('graph(): un parámetro objeto viaja como JSON (time_range), no como «[object Object]» — lo encontró la primera prueba con el token real', async () => {
  const t = montar();
  t.g.st.cifras = [{ ad_id: 'AD9', date_start: '2026-10-01', date_stop: '2026-10-01', spend: '1.00' }];
  const r = await t.meta.graph(TOKEN_STAND, '/act_1001/insights', { params: { level: 'ad', time_increment: 1, time_range: { since: '2026-10-01', until: '2026-10-07' } } });
  assert.equal(r.data.length, 1);
  const pedida = t.g.llamadas.at(-1).searchParams.get('time_range');
  assert.deepEqual(JSON.parse(pedida), { since: '2026-10-01', until: '2026-10-07' });
  const mal = await t.g.fetchFn(`https://graph.test/v26.0/act_1001/insights?access_token=${TOKEN_STAND}&time_range=%5Bobject%20Object%5D`);
  assert.equal((await mal.json()).error.code, 100, 'el Meta de mentira lo rechaza como Meta');
});

test('un error que no es de límite no frena', async () => {
  const t = montar({ torcer: (l, st) => (l.ruta === '/me/accounts' && !st.una ? (st.una = true, json({ error: { message: 'mal', code: 100 } }, 400)) : null) });
  await assert.rejects(t.meta.graph(TOKEN_STAND, '/me/accounts'), e => e.codigo === 100);
  await t.meta.graph(TOKEN_STAND, '/me/accounts');
  assert.equal(t.meta.uso().frenadoHasta, null);
});

// 2 nov 2026 — la Bandeja dice DE QUÉ CUENTA es cada comentario y mensaje (la página o el Instagram desde donde se lee y se responde), con varias
// marcas sobre un mismo token. Contra el Meta de mentira con dos marcas (P1/IG1 y P2/IG2): cada comentario lleva su cuenta con nombre y @usuario, los
// comentarios de un ANUNCIO van a la cuenta del anuncio (la página del prefijo de su historia, el Instagram de su creativo) y no a la primera que
// se encontró, un anuncio de Instagram sin pista con varios Instagram NO se adivina, y se filtra por cuenta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearMetaStand, TOKEN_STAND } from './meta-stand.mjs';
import { crearMeta, PERMISOS_LECTURA, PERMISOS_PUBLICAR, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';
import { crearFuenteMeta } from '../contenido/bandeja-meta.mjs';
import { crearBandeja } from '../contenido/bandeja.mjs';
import { injectionIn } from '../safety.mjs';
import { cuentaDeItem, cuentaNombre, cuentaLinea, comoCuenta, opcionesCuentaBandeja, responderComo } from '../src/bandeja-cuenta.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-bjc-'));
const hace = h => new Date(Date.now() - h * 3600e3).toISOString();

async function montar() {
  const dir = tmp();
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR, ...PERMISOS_ANUNCIOS], paginas: [
    { id: 'P1', name: 'PanaClaw', access_token: 'tk-p1', instagram_business_account: { id: 'IG1', username: 'panaclaw', name: 'PanaClaw IG' } },
    { id: 'P2', name: 'BukoFlow', access_token: 'tk-p2', instagram_business_account: { id: 'IG2', username: 'bukoflow', name: 'BukoFlow IG' } }],
  postsFB: [{ id: 'P1_10', message: 'Abrimos tienda', created_time: hace(8), permalink_url: 'https://www.facebook.com/P1_10', comments: { summary: { total_count: 1 } } }] });
  g.st.media = [{ id: 'M1', caption: 'Lentes', timestamp: hace(5), comments_count: 1, media_type: 'IMAGE' }];
  g.st.mediaOtras = { IG2: [{ id: 'M2', caption: 'Café', timestamp: hace(5), comments_count: 1, media_type: 'IMAGE' }] };
  g.st.postsOtras = { P2: [] };
  g.st.comentarios.M1 = [{ id: 'c1', text: '¿Precio de los lentes?', username: 'ana', from: { id: 'U1', username: 'ana' }, timestamp: hace(4) }];
  g.st.comentarios.M2 = [{ id: 'c2', text: '¿Tienen café sin azúcar?', username: 'beto', from: { id: 'U2', username: 'beto' }, timestamp: hace(3) }];
  g.st.comentarios.P1_10 = [{ id: 'P1_10_1', message: '¿Abren el sábado?', from: { id: 'U3', name: 'Luis' }, created_time: hace(6) }];
  g.st.comentarios.P2_88 = [{ id: 'P2_88_1', message: 'Quiero el combo', from: { id: 'U4', name: 'Rosa' }, created_time: hace(1) }]; // un anuncio de la página 2
  g.st.comentarios.M8 = [{ id: 'c8', text: 'Lo quiero para mi tienda', username: 'pepe', from: { id: 'U5', username: 'pepe' }, timestamp: hace(1) }]; // un anuncio de IG2
  g.st.comentarios.M7 = [{ id: 'c7', text: 'No sé de quién soy', username: 'lola', from: { id: 'U6', username: 'lola' }, timestamp: hace(1) }]; // un anuncio sin pista de cuenta
  g.st.creativos.CR1 = { id: 'CR1', effective_object_story_id: 'P2_88' }; // el de Facebook: Meta lo conoce y no trae medio de Instagram
  const anuncios = { campanas: [{ id: 'C1', name: 'Marcas' }], conjuntos: [{ id: 'S1' }], anuncios: [
    { id: 'A1', name: 'Combo · AO:b1', campaign_id: 'C1', adset_id: 'S1', effective_status: 'ACTIVE', creative: { id: 'CR1', effective_object_story_id: 'P2_88' } },
    { id: 'A2', name: 'Café · AO:b1', campaign_id: 'C1', adset_id: 'S1', effective_status: 'ACTIVE', creative: { id: 'CR2', instagram_user_id: 'IG2', effective_instagram_media_id: 'M8' } },
    { id: 'A3', name: 'Sin pista', campaign_id: 'C1', adset_id: 'S1', effective_status: 'ACTIVE', creative: { id: 'CR3', effective_instagram_media_id: 'M7' } }] };
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: g.fetchFn, dir });
  await meta.sincronizar();
  const fuente = crearFuenteMeta({ meta, archivo: path.join(dir, 'bandeja-meta.json'), anuncios: () => anuncios });
  const bj = crearBandeja({ meta: fuente, elegir: () => 'meta', archivo: path.join(dir, 'bandeja.json'), modo: () => 'simulacro', injectionIn, undoSeconds: () => 30, cuentas: () => meta.estado().cuentas });
  return { g, bj };
}

test('lo puro: cómo se nombra una cuenta y qué dice «responder como»', () => {
  const ig = { id: 'instagram:1', red: 'instagram', nombre: 'PanaClaw IG', usuario: 'panaclaw' }, fb = { id: 'facebook:9', red: 'facebook', nombre: 'PanaClaw', usuario: '' }, raro = { id: 'facebook:77', red: 'facebook', nombre: '', usuario: '' };
  assert.equal(cuentaNombre(ig), '@panaclaw'); assert.equal(cuentaNombre(fb), 'PanaClaw'); assert.equal(cuentaNombre(raro), 'página 77', 'sin nombre, el id: nunca uno inventado');
  assert.equal(cuentaLinea(ig), '@panaclaw · Instagram'); assert.equal(cuentaLinea(fb), 'PanaClaw · Facebook'); assert.equal(cuentaLinea(null), '');
  assert.equal(comoCuenta({ deCuenta: ig }), '@panaclaw en Instagram'); assert.equal(comoCuenta({ fuente: 'metricool' }), '');
  assert.equal(responderComo({ deCuenta: fb }), 'Responder como PanaClaw en Facebook'); assert.match(responderComo({ fuente: 'meta' }), /no se sabe desde qué cuenta/); assert.match(responderComo({ fuente: 'metricool' }), /Metricool/);
  assert.equal(cuentaDeItem({ deCuenta: {} }), null); assert.deepEqual(opcionesCuentaBandeja({ cuentasBandeja: [ig] }), [], 'con una sola cuenta no hace falta el filtro');
  assert.deepEqual(opcionesCuentaBandeja({ cuentasBandeja: [{ ...ig, pendientes: 2 }, { ...fb, pendientes: 0 }] }), [['', 'Todas las cuentas'], ['instagram:1', '@panaclaw · Instagram (2 por responder)'], ['facebook:9', 'PanaClaw · Facebook']]);
});

test('cada comentario lleva SU cuenta; los de un anuncio, la del anuncio; sin pista y con varios Instagram, no se adivina', async () => {
  const { bj } = await montar();
  const r = await bj.sincronizar(); assert.equal(r.ok, false, 'un anuncio sin atribuir queda dicho como aviso de la lectura (lo demás sí llega)');
  const por =Object.fromEntries(bj.listar().items.map(m => [m.id, m]));
  assert.equal(por['meta:c1'].cuentaId, 'instagram:IG1'); assert.equal(por['meta:c1'].deCuenta.usuario, 'panaclaw');
  assert.equal(por['meta:c2'].cuentaId, 'instagram:IG2'); assert.equal(cuentaLinea(por['meta:c2'].deCuenta), '@bukoflow · Instagram');
  assert.equal(por['meta:P1_10_1'].cuentaId, 'facebook:P1'); assert.equal(por['meta:P1_10_1'].deCuenta.nombre, 'PanaClaw');
  assert.equal(por['meta:P2_88_1'].cuentaId, 'facebook:P2', 'el comentario de un anuncio de la página 2 es de la página 2, no de la primera que se encontró'); assert.equal(por['meta:P2_88_1'].enAnuncio.anuncio, 'A1');
  assert.equal(por['meta:c8'].cuentaId, 'instagram:IG2', 'el Instagram del anuncio lo dice su creativo'); assert.equal(por['meta:c8'].enAnuncio.anuncio, 'A2');
  assert.equal(por['meta:c7'], undefined, 'con dos Instagram y sin pista no se lee con el primero');
  assert.match(r.error || bj.listar().error || '', /varios Instagram conectados y sin saber de cuál es/);
  const l = bj.listar(); assert.deepEqual(l.cuentasBandeja.map(c => c.id).sort(), ['facebook:P1', 'facebook:P2', 'instagram:IG1', 'instagram:IG2']);
  assert.equal(l.cuentasBandeja.find(c => c.id === 'instagram:IG2').pendientes, 2); assert.equal(opcionesCuentaBandeja(l).length, 5);
});

test('el filtro por cuenta: por id, @usuario o nombre; una cuenta que no existe da una lista vacía y lo dice, nunca «todas»', async () => {
  const { bj } = await montar(); await bj.sincronizar();
  assert.deepEqual(bj.listar({ cuenta: '@bukoflow' }).items.map(m => m.id).sort(), ['meta:c2', 'meta:c8']);
  assert.deepEqual(bj.listar({ cuenta: 'facebook:P2' }).items.map(m => m.id), ['meta:P2_88_1']);
  assert.deepEqual(bj.listar({ cuenta: 'facebook:P1' }).items.map(m => m.id), ['meta:P1_10_1']);
  const nada = bj.listar({ cuenta: 'nadie' }); assert.deepEqual(nada.items, []); assert.equal(nada.cuentaNoEncontrada, true);
  assert.equal(bj.listar({}).items.length, 5, 'sin filtro, todos');
});

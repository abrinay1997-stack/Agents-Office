// Plan M0 (6 oct 2026): el cliente de Metricool contra un Metricool de mentira (tests/metricool-stand.mjs). Nunca la key real.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as MC from '../contenido/metricool.mjs';
import { levantarMetricool, TOKEN, MARCA } from './metricool-stand.mjs';

test('el cuerpo: redes como objetos, X se llama twitter, la hora tal cual con su zona, y datos solo de las redes que van', () => {
  const momento = new Date(2026, 9, 12, 9, 30).getTime();
  const b = MC.cuerpoPost({ redes: ['instagram', 'x', 'linkedin', 'marte'], texto: 'Hola', comentario: '#optica', medios: ['https://a/1.jpg'], momento, formato: 'reel', extras: { colaboradores: ['ana'] } });
  assert.deepEqual(b.providers, [{ network: 'instagram' }, { network: 'twitter' }, { network: 'linkedin' }]);
  assert.equal(b.publicationDate.dateTime, '2026-10-12T09:30:00', 'sin pasar a UTC');
  assert.ok(b.publicationDate.timezone);
  assert.equal(b.instagramData.type, 'REEL'); assert.deepEqual(b.instagramData.collaborators, [{ username: 'ana' }]);
  assert.deepEqual(b.twitterData, { tags: [] }); assert.deepEqual(b.linkedinData, {});
  assert.equal(b.facebookData, undefined, 'una red que no va no lleva sus datos');
  assert.equal(b.firstCommentText, '#optica');
  assert.deepEqual([b.draft, b.autoPublish], [false, true]);
  const borrador = MC.cuerpoPost({ redes: ['instagram'], momento }, { borrador: true });
  assert.deepEqual([borrador.draft, borrador.autoPublish, borrador.instagramData.autoPublish], [true, false, false], 'un borrador nunca se publica solo');
});

test('fechaLocal con zona y el estado de cada red', () => {
  assert.equal(MC.fechaLocal(Date.UTC(2026, 9, 12, 14, 0), 'America/Panama'), '2026-10-12T09:00:00');
  assert.equal(MC.estadoDeProveedor('PUBLISHED'), 'publicada'); assert.equal(MC.estadoDeProveedor('ERROR'), 'fallo'); assert.equal(MC.estadoDeProveedor('PENDING'), 'en_red');
});

test('las mejores horas se leen en varias formas y lo que vale 0 no cuenta', () => {
  assert.deepEqual(MC.normalizarMejoresHoras({ data: [{ dayOfWeek: 'MONDAY', hour: 9, value: 80 }, { day: 4, hour: 13, value: 0 }] }), [{ dia: 1, hora: 9, valor: 80 }]);
  assert.deepEqual(MC.normalizarMejoresHoras({ friday: { 18: 3 } }), [{ dia: 5, hora: 18, valor: 3 }]);
  assert.deepEqual(MC.normalizarMejoresHoras([{ dateTime: '2026-10-12T19:00:00', value: 5 }]), [{ dia: 1, hora: 19, valor: 5 }]);
});

test('el cliente: la key solo en la cabecera, programa, cambia, lista, borra, sube un archivo y normaliza', async () => {
  const s = await levantarMetricool();
  try {
    const mc = MC.crearMetricool({ env: s.env });
    assert.equal(mc.configurado(), true);
    assert.equal((await mc.marca()).nombre, 'PanaClaw');
    const momento = Date.now() + 3 * 864e5;
    const r = await mc.programar(MC.cuerpoPost({ redes: ['instagram', 'facebook'], texto: 'Hola', medios: ['https://x/a.jpg'], momento, zona: 'America/Panama' }));
    assert.ok(r.id); assert.ok(r.uuid); assert.deepEqual(r.redes.map(x => [x.red, x.estado]), [['instagram', 'en_red'], ['facebook', 'en_red']]);
    for (const v of s.vistas) { assert.equal(v.query.userToken, undefined, 'la key nunca en la dirección'); if (!v.ruta.startsWith('/s3/')) assert.equal(v.auth, TOKEN); }
    assert.ok(s.vistas.filter(v => v.ruta.startsWith('/v2/scheduler')).every(v => v.query.blogId === MARCA && v.query.integrationSource === MC.ORIGEN));
    const c = await mc.cambiar(r.id, r.uuid, { text: 'Hola otra vez' });
    assert.equal(s.posts.get(r.id).text, 'Hola otra vez'); assert.equal(s.vistas.at(-1).body.uuid, r.uuid);
    s.publicar();
    const e = await mc.estado(r.id, momento, 'America/Panama');
    assert.deepEqual(e.redes.map(x => x.estado), ['publicada', 'publicada']); assert.match(e.redes[0].url, /^https:\/\/instagram\.test/);
    assert.equal(await mc.borrar(r.id), true); assert.equal(s.posts.size, 0);
    const url = await mc.subirArchivo({ datos: Buffer.from('jpeg'), nombre: 'a.jpg', tipo: 'image/jpeg' });
    assert.match(url, /^https:\/\/static\.metricool\.test\/s3\//); assert.equal([...s.subidas.values()][0].bytes, 4);
    assert.match(await mc.normalizar('https://fuera/x.png'), /normalized/);
    assert.deepEqual((await mc.mejoresHoras('instagram', '2026-10-12', '2026-10-18')).map(x => x.hora), [9, 19, 13]);
    assert.deepEqual(await mc.mejoresHoras('pinterest', '2026-10-12', '2026-10-18'), [], 'Metricool no calcula la mejor hora de Pinterest');
    void c;
  } finally { await s.cerrar(); }
});

test('los errores salen en español y nunca llevan la key', async () => {
  const s = await levantarMetricool({ fallar: { 'POST /v2/scheduler/posts': [403, `forbidden for ${TOKEN}`] } });
  try {
    const mal = MC.crearMetricool({ env: { ...s.env, METRICOOL_USER_TOKEN: 'otra-key-que-no-vale' } });
    await assert.rejects(mal.marcas({ fresco: true }), e => e.estado === 401 && /METRICOOL_USER_TOKEN/.test(e.message));
    const mc = MC.crearMetricool({ env: s.env });
    await assert.rejects(mc.programar(MC.cuerpoPost({ redes: ['instagram'], momento: Date.now() + 864e5 })), e => e.estado === 403 && /plan Advanced/.test(e.message) && !e.detalle.includes(TOKEN));
    const sin = MC.crearMetricool({ env: {} });
    assert.equal(sin.configurado(), false); await assert.rejects(sin.marcas(), /Faltan METRICOOL_USER_TOKEN/);
    const caido = MC.crearMetricool({ env: { ...s.env, METRICOOL_API_BASE: 'http://127.0.0.1:1' } });
    await assert.rejects(caido.marcas({ fresco: true }), e => e.estado === 0 && e.transitorio);
  } finally { await s.cerrar(); }
});

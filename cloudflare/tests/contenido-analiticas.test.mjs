// Fase 5 — Analíticas en la nube: la foto diaria de Meta (una cuenta por vuelta del cron, desde las 6:00 de la oficina), D1 y R2, y lo que sale de ella: lo publicado junto a su pieza,
// las mejores horas, el informe del mes, los indicadores del dueño y aprender de lo publicado. Contra el Meta de mentira de la raíz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar, subirImagen, enPanama } from './contenido-ayudas.mjs';
import { cadaMinuto } from '../worker/modulos/contenido.js';

const H = 3600e3, DIA = 24 * H;
const hace = (t, dias, hora = 12) => new Date(t.reloj - dias * DIA + (hora - 12) * H).toISOString();
const media = t => [
  { id: 'M1', caption: 'Reel de prueba', media_type: 'VIDEO', media_product_type: 'REELS', permalink: 'https://instagram.com/reel/1', timestamp: hace(t, 8), like_count: 30, comments_count: 4, thumbnail_url: 'https://scontent.cdninstagram.com/m1.jpg' },
  { id: 'M2', caption: 'Foto', media_type: 'IMAGE', media_product_type: 'FEED', permalink: 'https://instagram.com/p/2', timestamp: hace(t, 10), like_count: 10, comments_count: 1, media_url: 'https://evil.example/x.jpg' },
];
async function conMeta(opciones = {}) {
  // el stand se crea dentro de montar(): sus publicaciones llevan fechas relativas a «ahora»
  const t = await montar({ graph: { media: media({ reloj: Date.now() }), postsFB: [{ id: 'P1_1', message: 'Post de Facebook', created_time: new Date(Date.now() - 6 * DIA).toISOString(), permalink_url: 'https://facebook.com/1', full_picture: 'https://scontent.cdninstagram.com/f1.jpg', shares: { count: 2 }, reactions: { summary: { total_count: 20 } }, comments: { summary: { total_count: 3 } } }] }, ...opciones });
  t.ir(Date.parse(enPanama(Date.now()).fecha + 'T10:00:00-05:00')); // las 10:00 de Panamá: pasadas las 6:00 de la foto
  return t;
}
const tabla = (t, n) => t.d1._db.prepare(`select count(*) n from ${n}`).get().n;

test('actualizar: sincroniza las cuentas, hace la foto de AYER de cada una, guarda las publicaciones y baja las miniaturas a R2 (solo de dominios de Meta)', { skip: SALTAR }, async () => {
  const t = await conMeta();
  const s = await t.api('/api/contenido/meta/sincronizar', { metodo: 'POST', cuerpo: {} }); assert.equal(s.status, 200); assert.equal(s.datos.ok, true);
  assert.deepEqual(s.datos.meta.cuentas.map(c => c.id).sort(), ['facebook:P1', 'instagram:IG1']);
  const a = await t.api('/api/contenido/analiticas/actualizar', { metodo: 'POST' }); assert.equal(a.status, 202); assert.equal(a.datos.ok, true);
  assert.equal(a.datos.hechas, 2, JSON.stringify(a.datos)); assert.equal(tabla(t, 'contenido_dias'), 2); assert.ok(tabla(t, 'contenido_pubs') >= 2);
  const g = (await t.api('/api/contenido/analiticas')).datos;
  assert.equal(g.pendientes, 0); assert.equal(g.actualizando, false); assert.equal(g.meta.configurado, true); assert.ok(g.serie.length === 2 && g.serie.every(f => f.fecha === g.hoy || f.fecha < g.hoy));
  assert.deepEqual(Object.keys(g).sort(), ['actualizando', 'hoy', 'indicadores', 'meta', 'pendientes', 'publicaciones', 'serie', 'ultimaFoto']);
  assert.ok(g.publicaciones.length >= 2); assert.ok(g.publicaciones.some(p => /^\/api\/contenido\/miniatura\/[a-f0-9]{20}$/.test(p.miniatura)), 'una miniatura quedó guardada');
  assert.ok(!g.publicaciones.some(p => /evil\.example/.test(JSON.stringify(p))), 'una dirección fuera de Meta no se baja ni se guarda');
  const miniaturas = [...t.r2._m.keys()].filter(k => k.startsWith('contenido/miniaturas/')); assert.ok(miniaturas.length >= 1);
  const m = g.publicaciones.find(p => p.miniatura).miniatura;
  const sirve = await t.api(m); assert.equal(sirve.status, 200); assert.equal(sirve.headers.get('content-type'), 'image/jpeg'); assert.equal(sirve.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await t.api('/api/contenido/miniatura/' + 'a'.repeat(20))).status, 404); assert.equal((await t.api('/api/contenido/miniatura/zz')).status, 404);
  // una segunda foto el mismo día no vuelve a llamar a nadie
  const antes = t.stand.llamadas.length; const b = await t.api('/api/contenido/analiticas/actualizar', { metodo: 'POST' }); assert.equal(b.datos.total, 0); assert.equal(t.stand.llamadas.length, antes);
  assert.equal((await t.api('/api/contenido/analiticas/actualizar?todas=1', { metodo: 'POST' })).datos.hechas, 2, 'con todas=1 se repite');
});

test('el cron: no hace la foto antes de las 6:00; desde las 6:00, UNA cuenta por vuelta (el tope de llamadas); sin token no llama a nadie', { skip: SALTAR }, async () => {
  const t = await conMeta(); await t.api('/api/contenido/meta/sincronizar', { metodo: 'POST', cuerpo: {} });
  t.ir(Date.parse(enPanama(t.reloj).fecha + 'T05:30:00-05:00')); const n0 = t.stand.llamadas.length; await cadaMinuto(t.env);
  assert.equal(tabla(t, 'contenido_dias'), 0, 'antes de las 6:00 de la oficina no se hace la foto'); assert.equal(t.stand.llamadas.length, n0);
  t.ir(Date.parse(enPanama(t.reloj).fecha + 'T06:05:00-05:00')); await cadaMinuto(t.env);
  assert.ok(tabla(t, 'contenido_dias') >= 1, 'desde las 6:00, la foto');
  for (let i = 0; i < 4; i++) { t.avanzar(60e3); await cadaMinuto(t.env); }
  assert.equal(tabla(t, 'contenido_dias'), 2, 'las dos cuentas, en vueltas distintas');
  const sin = await montar({ meta: false }); const n = sin.stand.llamadas.length; await cadaMinuto(sin.env); assert.equal(sin.stand.llamadas.length, n, 'sin token no se llama a Meta');
  assert.match((await sin.api('/api/contenido/analiticas/actualizar', { metodo: 'POST' })).datos.error, /META_ACCESS_TOKEN/);
});

test('un fallo de Meta se apunta (no se guardan ceros) y se reintenta pasada una hora, hasta 3 veces al día', { skip: SALTAR }, async () => {
  let falla = true;
  const t = await conMeta({ graph: { torcer: l => (falla && /^\/IG1(\/|$)/.test(l.ruta) ? new Response(JSON.stringify({ error: { message: 'sin permiso', code: 10 } }), { status: 400, headers: { 'content-type': 'application/json' } }) : null), media: [], postsFB: [] } });
  await t.api('/api/contenido/meta/sincronizar', { metodo: 'POST', cuerpo: {} });
  const a = await t.api('/api/contenido/analiticas/actualizar', { metodo: 'POST' }); assert.equal(a.datos.fallidas.length, 1); assert.match(a.datos.fallidas[0].motivo, /permiso/);
  const fila = t.d1._db.prepare("select json from contenido_dias where id like 'instagram:%'").get(); assert.match(JSON.parse(fila.json).error, /permiso/); assert.equal(JSON.parse(fila.json).seguidores, undefined);
  falla = false;
  let g = (await t.api('/api/contenido/analiticas')).datos; assert.equal(g.pendientes, 0, 'recién fallada, no se martilla');
  t.avanzar(61 * 60e3); g = (await t.api('/api/contenido/analiticas')).datos; assert.equal(g.pendientes, 1, 'pasada una hora vuelve a ser pendiente');
});

test('lo publicado junto a su pieza, las mejores horas, el informe del mes y el resumen para los agentes salen de lo que Analíticas guardó', { skip: SALTAR }, async () => {
  const t = await conMeta(); await subirImagen(t.r2, '2026-10/foto.jpg');
  await t.api('/api/contenido/meta/sincronizar', { metodo: 'POST', cuerpo: {} }); await t.api('/api/contenido/analiticas/actualizar', { metodo: 'POST' });
  // una pieza que salió «el mismo día y la misma hora» que el Reel de Instagram (M1) con su mismo texto
  const cuando = enPanama(Date.parse(t.stand.st.media[0].timestamp));
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Reel', ...cuando, texto: 'Reel de prueba', redes: ['instagram'], formato: 'reel' } })).datos.pieza;
  const desde = enPanama(t.reloj - 12 * DIA).fecha, hasta = enPanama(t.reloj).fecha;
  const r = await t.api(`/api/contenido/publicadas?desde=${desde}&hasta=${hasta}`); assert.equal(r.status, 200); assert.equal(r.datos.fuente, 'meta');
  assert.ok(r.datos.porPieza[p.id]?.length === 1, JSON.stringify(r.datos)); assert.equal(r.datos.porPieza[p.id][0].interacciones, 42 + 0 * 1);
  assert.ok(r.datos.sueltas.some(x => x.red === 'instagram') || r.datos.sueltas.length >= 1, 'lo hecho fuera de Contenido sale suelto');
  assert.equal((await t.api('/api/contenido/publicadas?desde=hoy&hasta=mañana')).status, 400);

  const h = await t.api('/api/contenido/mejor-hora?redes=instagram'); assert.equal(h.status, 200); assert.ok('fuente' in h.datos && 'grid' in h.datos);
  const mes = enPanama(t.reloj).fecha.slice(0, 7);
  const inf = await t.api('/api/contenido/informe?mes=' + mes); assert.equal(inf.status, 200); assert.match(inf.datos.texto, /./); assert.equal((await t.api('/api/contenido/informe?mes=2026-13')).status, 400);
  const guard = await t.api('/api/contenido/informe', { metodo: 'POST', cuerpo: { mes } }); assert.equal(guard.status, 200); assert.match(guard.datos.nota, /Agents Office\/informes\/.* redes\.md/);
  assert.ok(t.d1._db.prepare('select 1 from notas where nombre = ?').get(`${mes} redes`), 'el informe quedó como nota del Cerebro');
  assert.equal((await t.api('/api/contenido/informe?mes=' + mes + '&cuenta=nada')).status, 400);
  const res = await t.api('/api/contenido/analiticas/resumen?dias=30'); assert.equal(res.status, 200); assert.ok(typeof res.datos.texto === 'string' && res.datos.texto.length > 20);
});

test('indicadores del dueño: se crean con un botón y cada foto buena los pone al día; sin ellos no se escribe nada', { skip: SALTAR }, async () => {
  const t = await conMeta(); await t.api('/api/contenido/meta/sincronizar', { metodo: 'POST', cuerpo: {} });
  await t.api('/api/contenido/analiticas/actualizar', { metodo: 'POST' });
  assert.equal(t.d1._db.prepare("select 1 from docs where clave = 'kpis'").get(), undefined, 'sin indicadores creados no se escribe «Cómo va el negocio»');
  assert.deepEqual((await t.api('/api/contenido/analiticas')).datos.indicadores, { seguidores: false, alcance: false });
  const c = await t.api('/api/contenido/analiticas/indicadores', { metodo: 'POST' }); assert.deepEqual(c.datos.creados.sort(), ['meta_alcance', 'meta_seguidores']);
  assert.deepEqual((await t.api('/api/contenido/analiticas')).datos.indicadores, { seguidores: true, alcance: true });
  await t.api('/api/contenido/analiticas/actualizar?todas=1', { metodo: 'POST' });
  const kp = JSON.parse(t.d1._db.prepare("select json from docs where clave = ?").get('kpis').json);
  assert.ok(kp.values.meta_seguidores?.length === 1 && kp.values.meta_seguidores[0].from === 'Meta', 'un punto por día');
  await t.api('/api/contenido/analiticas/actualizar?todas=1', { metodo: 'POST' });
  assert.equal(JSON.parse(t.d1._db.prepare("select json from docs where clave = ?").get('kpis').json).values.meta_seguidores.length, 1, 'repetir el mismo día no suma otro punto');
});

test('aprender de lo publicado: con tareas y «Fuentes:» las notas citadas se acercan a cómo le fue; sin tareas, no se inventa', { skip: SALTAR }, async () => {
  const t = await conMeta(); await t.api('/api/contenido/meta/sincronizar', { metodo: 'POST', cuerpo: {} });
  // 5 piezas maduras (hace 8–12 días) con cifras distintas y su tarea, que citó una nota
  const pubs = [0, 1, 2, 3, 4].map(i => ({ id: 'M' + (10 + i), caption: 'Pieza número ' + i, media_type: 'IMAGE', media_product_type: 'FEED', permalink: 'https://instagram.com/p/' + i, timestamp: hace(t, 8 + i), like_count: 5 + i * 10, comments_count: i }));
  t.stand.st.media.push(...pubs);
  for (let i = 0; i < 5; i++) {
    const c = enPanama(Date.parse(hace(t, 8 + i)));
    await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Pieza ' + i, ...c, texto: 'Pieza número ' + i, redes: ['instagram'], tarea: 'tarea' + i, origen: 'agente:ig' } });
    t.d1._db.prepare("insert into filas (coleccion, id, json, orden, actualizado) values ('tareas', ?, ?, 0, 'x')").run('tarea' + i, JSON.stringify({ id: 'tarea' + i, result: 'Listo.\nFuentes: oferta', read: ['oferta', 'voz'] }));
  }
  await t.api('/api/contenido/analiticas/actualizar', { metodo: 'POST' });
  const mem = JSON.parse(t.d1._db.prepare("select json from docs where clave = 'memory'").get().json);
  assert.ok(mem.notes.oferta && mem.notes.oferta.n >= 1, 'la nota citada aprendió'); assert.ok(Object.keys(mem.applied).some(k => k.startsWith('contenido:p-')), 'idempotente por pieza');
  const antes = JSON.stringify(mem.notes.oferta); await t.api('/api/contenido/analiticas/actualizar?todas=1', { metodo: 'POST' });
  assert.equal(JSON.stringify(JSON.parse(t.d1._db.prepare("select json from docs where clave = 'memory'").get().json).notes.oferta), antes, 'volver a aprender lo mismo no cambia nada');
});

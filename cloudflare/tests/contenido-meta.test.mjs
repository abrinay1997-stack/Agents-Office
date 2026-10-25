// Fase 5 — publicar en Meta desde el cron del Worker, contra el Meta de mentira de la raíz (tests/meta-stand.mjs): Facebook queda programado en Meta, Instagram lo publica la
// vuelta a su hora, NUNCA dos veces, lo tarde falla con su motivo, y el token no toca D1 ni ninguna respuesta. Nada de esto se ha probado contra Meta de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar, subirImagen, enPanama, TOKEN, TOKEN_PAGINA } from './contenido-ayudas.mjs';
import { cadaMinuto } from '../worker/modulos/contenido.js';
import { json } from '../../tests/meta-stand.mjs';

const MIN = 60e3, H = 3600e3;
const cola = (t, id) => { const f = t.d1._db.prepare('select json from contenido_cola where pieza = ?').get(id); return f ? JSON.parse(f.json) : null; };
const doc = (t, clave) => { const f = t.d1._db.prepare('select json from docs where clave = ?').get(clave); return f ? JSON.parse(f.json) : null; };
const posts = (t, ruta) => t.stand.llamadas.filter(l => l.metodo === 'POST' && l.ruta === ruta);
const momentoDe = p => new Date(`${p.fecha}T${p.hora}:00-05:00`).getTime();

async function real(opciones = {}) {
  const t = await montar(opciones); await subirImagen(t.r2, '2026-10/foto.jpg');
  assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor: 'meta' } })).status, 200);
  return t;
}
async function aprobada(t, { redes = ['instagram', 'facebook'], horas = 20, texto = 'Agenda tu examen visual esta semana.', extra = {} } = {}) {
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Examen', ...enPanama(t.reloj + horas * H), texto, redes, medios: ['2026-10/foto.jpg'], ...extra } })).datos.pieza;
  const ap = await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: {} }); assert.equal(ap.status, 200, JSON.stringify(ap.datos));
  return ap.datos.pieza;
}
const vuelta = (t, ms = 0) => { t.avanzar(ms); return cadaMinuto(t.env); };

test('«Comprobar conexión»: Meta responde, guarda las cuentas (sin tokens) y dice la página y el Instagram', { skip: SALTAR }, async () => {
  const t = await real();
  const r = await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  assert.equal(r.status, 200); assert.equal(r.datos.ok, true, JSON.stringify(r.datos)); assert.match(r.datos.texto, /PanaClaw.*@panaclaw/);
  const cuentas = (await t.api('/api/contenido/cuentas')).datos;
  assert.deepEqual(cuentas.cuentas.map(c => c.id).sort(), ['facebook:P1', 'instagram:IG1']); assert.deepEqual(cuentas.porDefecto, { facebook: 'facebook:P1', instagram: 'instagram:IG1' });
  assert.ok(cuentas.cuentas.every(c => c.puedePublicar));
  assert.equal(cuentas.conductor, 'meta');
});

test('Facebook queda PROGRAMADO en Meta (published=false + hora) y sale solo; Instagram: 15 min antes el contenedor, a su hora publica UNA vez; ambas quedan PUBLICADAS', { skip: SALTAR }, async () => {
  const t = await real(); await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const p = await aprobada(t), momento = momentoDe(p);
  await vuelta(t); assert.equal(cola(t, p.id).estado, 'espera');
  await vuelta(t, 2 * MIN);
  assert.equal(cola(t, p.id).estado, 'en_red'); assert.equal(cola(t, p.id).conductor, 'meta');
  const [foto] = posts(t, '/P1/photos');
  assert.ok(foto, 'la misma vuelta que entrega ya programa Facebook en Meta'); assert.equal(foto.campos.published, 'false'); assert.equal(Number(foto.campos.scheduled_publish_time), Math.floor(momento / 1000));
  assert.equal(foto.h.authorization, `Bearer ${TOKEN_PAGINA}`, 'el token de la página, en la cabecera'); assert.ok(!t.stand.llamadas.some(l => l.metodo === 'POST' && l.q?.access_token), 'el token nunca en la dirección de un POST');
  assert.equal(posts(t, '/IG1/media').length, 0, 'Instagram no se programa: espera su hora');
  await vuelta(t, MIN); assert.equal(posts(t, '/P1/photos').length, 1, 'Facebook no se programa dos veces');

  t.ir(momento - 14 * MIN); await cadaMinuto(t.env);
  const [temp, cont] = [posts(t, '/P1/photos')[1], posts(t, '/IG1/media')[0]];
  assert.equal(temp.campos.temporary, 'true'); assert.match(cont.campos.image_url, /^https:\/\/scontent\./); assert.equal(posts(t, '/IG1/media_publish').length, 0, 'todavía no es su hora');
  const agenda = doc(t, 'contenido.meta.agenda'); assert.ok(Object.values(agenda.trabajos).some(j => j.estado === 'preparada'), 'el avance quedó apuntado en D1 antes de seguir');

  t.ir(momento); await cadaMinuto(t.env);
  assert.equal(posts(t, '/IG1/media_publish').length, 1);
  const e = cola(t, p.id); assert.equal(e.estado, 'publicada', JSON.stringify(e)); assert.equal(e.redes.instagram.estado, 'publicada'); assert.equal(e.redes.facebook.estado, 'publicada');
  assert.match(e.redes.instagram.url, /instagram\.com/); assert.match(e.redes.facebook.url, /facebook\.com/);
  for (let i = 0; i < 3; i++) await vuelta(t, MIN);
  assert.equal(posts(t, '/IG1/media_publish').length, 1, 'NUNCA dos veces'); assert.equal(posts(t, '/P1/photos').length, 2);
  const s = (await t.api('/api/contenido/piezas/' + p.id)).datos.pieza.salida; assert.equal(s.estado, 'publicada');
  // la página recibe las mismas formas que la oficina local
  assert.deepEqual(Object.keys(s).sort(), ['conductor', 'entregadaAt', 'entregarDesde', 'error', 'estado', 'historial', 'intentos', 'momento', 'redes', 'siguienteIntento']);
});

test('NUNCA dos veces: si Meta publicó pero la respuesta se perdió, se lee el contenedor y no se publica otra vez; si no contestó y no salió, el MISMO contenedor', { skip: SALTAR }, async () => {
  const perdida = await real({ graph: { torcer: (l, st) => (l.ruta === '/IG1/media_publish' && !st.perdida ? (st.perdida = true, st.cont[l.campos.creation_id].estado = 'PUBLISHED', st.media.unshift({ id: 'M77', caption: 'Agenda tu examen visual esta semana.', permalink: 'https://www.instagram.com/p/M77/' }), json({ error: { message: 'fallo interno' } }, 500)) : null) } });
  await perdida.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const p = await aprobada(perdida, { redes: ['instagram'] }), momento = momentoDe(p);
  await vuelta(perdida); await vuelta(perdida, 2 * MIN); perdida.ir(momento - 10 * MIN); await cadaMinuto(perdida.env);
  perdida.ir(momento); await cadaMinuto(perdida.env);
  assert.equal(cola(perdida, p.id).estado, 'en_red', 'incierta: todavía no se sabe');
  await vuelta(perdida, MIN); await vuelta(perdida, MIN);
  assert.equal(posts(perdida, '/IG1/media_publish').length, 1, 'no se publicó otra vez');
  const e = cola(perdida, p.id); assert.equal(e.estado, 'publicada'); assert.equal(e.redes.instagram.url, 'https://www.instagram.com/p/M77/', 'la encontró por su texto');

  const caida = await real({ graph: { torcer: (l, st) => (l.ruta === '/IG1/media_publish' && !st.caida ? (st.caida = true, json({ error: { message: 'caída' } }, 503)) : null) } });
  await caida.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const q = await aprobada(caida, { redes: ['instagram'] }), mq = momentoDe(q);
  await vuelta(caida); await vuelta(caida, 2 * MIN); caida.ir(mq - 10 * MIN); await cadaMinuto(caida.env); caida.ir(mq); await cadaMinuto(caida.env);
  await vuelta(caida, MIN); await vuelta(caida, MIN);
  const pubs = posts(caida, '/IG1/media_publish'); assert.equal(pubs.length, 2); assert.equal(pubs[0].campos.creation_id, pubs[1].campos.creation_id, 'el mismo contenedor, que solo se publica una vez');
  assert.equal(cola(caida, q.id).estado, 'publicada');
});

test('si la vuelta muere a mitad, la siguiente retoma sin duplicar: lo preparado queda apuntado antes de publicar', { skip: SALTAR }, async () => {
  const t = await real({ graph: { torcer: (l, st) => (l.ruta === '/IG1/media_publish' && !st.murio ? (st.murio = true, (() => { throw new Error('el Worker murió'); })()) : null) } });
  await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const p = await aprobada(t, { redes: ['instagram'] }), momento = momentoDe(p);
  await vuelta(t); await vuelta(t, 2 * MIN); t.ir(momento - 10 * MIN); await cadaMinuto(t.env);
  t.ir(momento); await cadaMinuto(t.env).catch(() => {}); // el Worker muere al publicar
  t.d1._db.prepare("delete from contenido_candado").run(); // …y su candado caducaría solo; aquí se simula pasar el tiempo
  const intentosAntes = posts(t, '/IG1/media_publish').length;
  await vuelta(t, MIN); await vuelta(t, MIN);
  assert.ok(posts(t, '/IG1/media_publish').length <= intentosAntes + 1, 'a lo sumo reintenta el MISMO contenedor');
  const contenedores = new Set(posts(t, '/IG1/media_publish').map(l => l.campos.creation_id)); assert.equal(contenedores.size, 1);
  assert.equal(cola(t, p.id).estado, 'publicada');
});

test('tarde: apagada a su hora sale hasta 30 min después; más tarde, falla con su motivo y NO publica', { skip: SALTAR }, async () => {
  const t = await real(); await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const p = await aprobada(t, { redes: ['instagram'] }), momento = momentoDe(p);
  await vuelta(t); await vuelta(t, 2 * MIN); t.ir(momento - 5 * MIN); await cadaMinuto(t.env); // preparada…
  t.ir(momento + 31 * MIN); await cadaMinuto(t.env); // …y la vuelta no corrió a su hora
  await vuelta(t, MIN);
  const e = cola(t, p.id); assert.ok(['fallo', 'parcial'].includes(e.estado), e.estado); assert.match(JSON.stringify(e.redes), /media hora/);
  assert.equal(posts(t, '/IG1/media_publish').length, 0);
  const ok = await real(); await ok.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const q = await aprobada(ok, { redes: ['instagram'] }), mq = momentoDe(q);
  await vuelta(ok); await vuelta(ok, 2 * MIN); ok.ir(mq + 20 * MIN); await cadaMinuto(ok.env); await vuelta(ok, MIN);
  assert.equal(cola(ok, q.id).estado, 'publicada', '20 minutos tarde todavía sale');
});

test('el freno por uso de Meta se recuerda en D1: si Meta pidió esperar, ninguna vuelta llama hasta que pase', { skip: SALTAR }, async () => {
  let limitar = true;
  const t = await real({ graph: { torcer: (l, st) => (limitar && l.ruta === '/P1/photos' ? (limitar = false, json({ error: { message: 'Application request limit reached', code: 4 } }, 400)) : null) } });
  await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const p = await aprobada(t, { redes: ['facebook'] });
  await vuelta(t); await vuelta(t, 2 * MIN);
  assert.equal(posts(t, '/P1/photos').length, 1);
  assert.ok(doc(t, 'contenido.meta.freno')?.hasta > t.reloj, 'el freno quedó apuntado en D1');
  await vuelta(t, MIN); assert.equal(posts(t, '/P1/photos').length, 1, 'con el freno puesto ni se intenta (otra invocación, la misma memoria)');
  await vuelta(t, 6 * MIN); assert.equal(posts(t, '/P1/photos').length, 2, 'pasada la espera, vuelve a intentar');
  assert.equal(cola(t, p.id).estado, 'en_red');
});

test('sin el token de Meta el modo real no entrega: queda en espera con el motivo y un aviso; el simulacro sigue siendo el modo por defecto', { skip: SALTAR }, async () => {
  const s = await montar({ meta: false }); assert.equal((await s.api('/api/contenido')).datos.ajustes.modo, 'simulacro');
  const t = await montar({ meta: false }); await subirImagen(t.r2, '2026-10/foto.jpg');
  await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor: 'meta' } });
  const p = await aprobada(t, { redes: ['facebook'] }); await vuelta(t); await vuelta(t, 2 * MIN);
  const e = cola(t, p.id); assert.equal(e.estado, 'espera'); assert.match(e.error, /META_ACCESS_TOKEN/);
  assert.ok(doc(t, 'notices').some(n => /No puedo entregar/.test(n.text)), 'un aviso para el dueño');
  assert.equal(t.stand.llamadas.length, 0);
});

test('el token NO está en ninguna tabla ni en ninguna respuesta', { skip: SALTAR }, async () => {
  const t = await real(); await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const p = await aprobada(t); const momento = momentoDe(p);
  await vuelta(t); await vuelta(t, 2 * MIN); t.ir(momento - 10 * MIN); await cadaMinuto(t.env); t.ir(momento); await cadaMinuto(t.env);
  const respuestas = [await t.api('/api/contenido'), await t.api('/api/contenido/cola'), await t.api('/api/contenido/cuentas'), await t.api('/api/contenido/config'), await t.api('/api/contenido/analiticas'), await t.api('/api/contenido/piezas/' + p.id)];
  for (const r of respuestas) { const x = JSON.stringify(r.datos); assert.ok(!x.includes(TOKEN) && !x.includes(TOKEN_PAGINA), 'ninguna respuesta lleva un token'); }
  const tablas = t.d1._db.prepare("select name from sqlite_master where type = 'table'").all().map(x => x.name);
  for (const n of tablas) { const volcado = JSON.stringify(t.d1._db.prepare(`select * from ${n}`).all()); assert.ok(!volcado.includes(TOKEN) && !volcado.includes(TOKEN_PAGINA), `la tabla ${n} no lleva un token`); }
});

test('las cuentas elegidas en la pieza: sale en esa página y en ese Instagram; una que el token no ve, falla con el motivo', { skip: SALTAR }, async () => {
  const t = await real({ graph: { paginas: [
    { id: 'P1', name: 'PanaClaw', access_token: TOKEN_PAGINA, instagram_business_account: { id: 'IG1', username: 'panaclaw' } },
    { id: 'P2', name: 'Otra marca', access_token: TOKEN_PAGINA + '2', instagram_business_account: { id: 'IG2', username: 'otramarca' } }] } });
  await t.api('/api/contenido/conductor/comprobar', { metodo: 'POST', cuerpo: {} });
  const p = await aprobada(t, { redes: ['facebook'], extra: { cuentas: { facebook: 'facebook:P2' } } });
  await vuelta(t); await vuelta(t, 2 * MIN);
  assert.equal(posts(t, '/P2/photos').length, 1); assert.equal(posts(t, '/P1/photos').length, 0, 'la página elegida, no la de siempre');
  assert.equal(cola(t, p.id).estado, 'en_red');
  const mala = await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'x', redes: ['facebook'], cuentas: { facebook: 'facebook:P99' } } });
  assert.equal(mala.status, 400); assert.match(mala.datos.error, /ya no la ve el token/);
});

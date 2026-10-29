// C2 con workerd de verdad (wrangler dev --local): el aviso en vivo del chat llega SOLO a los miembros del canal y solo con ids. Tres sesiones; la tercera (una administradora que no es miembro
// del canal privado) no recibe NADA: ni el id del canal, ni del mensaje, ni «escribiendo». Después de un corte, la puesta al día por HTTP (/novedades) recupera lo perdido.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hayWrangler, levantar, entrar, conectarSocket } from './vivo-ayudas.mjs';

const SALTAR = hayWrangler();
const ANA = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'ana@panaclaw.test', rol: 'admin', nombre: 'Ana' };
const BRUNO = { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'bruno@panaclaw.test', rol: 'editor', nombre: 'Bruno' };
const CARLA = { id: 'cccccccc-0000-4000-8000-000000000003', email: 'carla@panaclaw.test', rol: 'editor', nombre: 'Carla' };
let o, c, s;
const api = (cookie, ruta, { metodo = 'GET', cuerpo } = {}) => fetch(o.base + ruta, { method: metodo, headers: { cookie, Origin: o.base, ...(cuerpo ? { 'content-type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));
const chat = (m) => m.tipo === 'chat';

before(async () => {
  if (SALTAR) return;
  o = await levantar({ usuarios: [ANA, BRUNO, CARLA] });
  c = { ana: await entrar(o.base, ANA.email), bruno: await entrar(o.base, BRUNO.email), carla: await entrar(o.base, CARLA.email) };
  await api(c.ana, '/api/chat/config', { metodo: 'POST', cuerpo: { activo: true } });
  s = { ana: conectarSocket(o.base, { cookie: c.ana }), bruno: conectarSocket(o.base, { cookie: c.bruno }), carla: conectarSocket(o.base, { cookie: c.carla }) };
  for (const k of Object.keys(s)) { assert.equal(await s[k].abierto, true); await s[k].esperar((m) => m.tipo === 'hola'); }
}, { timeout: 240000 });
after(async () => { for (const k of Object.keys(s || {})) s[k].cerrar(); await o?.cerrar(); });

test('un mensaje de un canal privado llega al otro miembro con ids; la tercera sesión no recibe nada', { skip: SALTAR }, async () => {
  const canal = (await api(c.bruno, '/api/chat/canales', { metodo: 'POST', cuerpo: { nombre: 'Reservado', privado: true, miembros: [CARLA.id] } })).j.id;
  const antesAna = s.ana.recibidos.length;
  const r = await api(c.bruno, `/api/chat/canales/${canal}/mensajes`, { metodo: 'POST', cuerpo: { cuerpo: 'texto-que-no-viaja-por-el-socket' } }); assert.equal(r.status, 201);
  const ev = await s.carla.esperar((m) => chat(m) && m.evento === 'mensaje');
  assert.deepEqual([ev.canal, ev.de, ev.id], [canal, BRUNO.id, r.j.mensaje.id]); assert.ok(!JSON.stringify(ev).includes('texto-que-no-viaja'), 'ids, nunca texto'); assert.equal(ev.para, undefined, 'la lista de destinatarios no sale del Hub');
  await s.bruno.esperar((m) => chat(m) && m.evento === 'mensaje'); // el autor también (sus otras pestañas)
  await api(c.carla, `/api/chat/canales/${canal}/escribiendo`, { metodo: 'POST', cuerpo: {} });
  const esc = await s.bruno.esperar((m) => chat(m) && m.evento === 'escribiendo'); assert.equal(esc.de, CARLA.id);
  await new Promise((r2) => setTimeout(r2, 1500)); // lo que NO debe llegar no se puede esperar con un evento: se da un margen y se mira
  assert.deepEqual(s.ana.recibidos.slice(antesAna).filter(chat), [], 'la administradora no es miembro: ni el id del canal');
  assert.equal((await api(c.ana, `/api/chat/canales/${canal}/mensajes`)).status, 404);
});

test('tras un corte, /novedades recupera lo que se perdió (el socket es un atajo, D1 es la verdad)', { skip: SALTAR }, async () => {
  const canal = (await api(c.bruno, '/api/chat/canales', { metodo: 'POST', cuerpo: { nombre: 'Corte', miembros: [CARLA.id] } })).j.id;
  const hasta = (await api(c.carla, '/api/chat/novedades?desde=0')).j.ultimo;
  s.carla.cerrar(); await new Promise((r2) => setTimeout(r2, 300));
  await api(c.bruno, `/api/chat/canales/${canal}/mensajes`, { metodo: 'POST', cuerpo: { cuerpo: 'mientras no estabas' } });
  s.carla = conectarSocket(o.base, { cookie: c.carla }); assert.equal(await s.carla.abierto, true); await s.carla.esperar((m) => m.tipo === 'hola');
  const nov = (await api(c.carla, `/api/chat/novedades?desde=${hasta}`)).j; assert.deepEqual(nov.mensajes.map((m) => m.cuerpo), ['mientras no estabas']); assert.equal(nov.mensajes[0].canal, canal);
  assert.equal((await api(c.ana, '/api/chat/novedades?desde=0')).j.mensajes.some((m) => m.cuerpo === 'mientras no estabas'), false, 'la administradora no ve lo de un canal ajeno');
});

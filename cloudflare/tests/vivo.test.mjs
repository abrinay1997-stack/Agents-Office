// Dos personas, la misma oficina, sin recargar — con workerd de verdad (wrangler dev --local): el Durable Object, el socket, la D1 y las rutas reales.
// Lo que se afirma aquí NO se puede afirmar leyendo ficheros: que el binding HUB existe, que el socket entra con la cookie, que las dos personas caen en
// el MISMO objeto y que el cambio / la presencia de una LLEGA al socket de la otra. Tarda ~40 s; se salta solo sin wrangler (AO_SIN_VIVO=1 también lo salta).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hayWrangler, levantar, entrar, conectarSocket, CLAVE } from './vivo-ayudas.mjs';

const SALTAR = hayWrangler();
const ANA = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'ana@panaclaw.test', rol: 'admin', nombre: 'Ana', color: '#1E6FD9' };
const BRUNO = { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'bruno@panaclaw.test', rol: 'editor', nombre: 'Bruno', color: '#B45309' };
let o, cAna, cBruno, sAna, sBruno;
const quien = (m) => (m.presentes ?? []).map((p) => p.nombre).sort();
const api = (c, ruta, { metodo = 'GET', cuerpo, cab = {} } = {}) => fetch(o.base + ruta, { method: metodo, headers: { cookie: c, ...(cuerpo ? { 'content-type': 'application/json' } : {}), ...cab }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

before(async () => {
  if (SALTAR) return;
  o = await levantar({ usuarios: [ANA, BRUNO] });
  cAna = await entrar(o.base, ANA.email); cBruno = await entrar(o.base, BRUNO.email);
}, { timeout: 240000 });
after(async () => { sAna?.cerrar(); sBruno?.cerrar(); await o?.cerrar(); });

test('el socket EXIGE sesión y el Origin de la propia página (workerd real)', { skip: SALTAR }, async () => {
  assert.equal(await conectarSocket(o.base, { origen: o.base }).abierto, false, 'sin cookie');
  assert.equal(await conectarSocket(o.base, { cookie: cAna, origen: 'https://malo.example' }).abierto, false, 'Origin ajeno');
  assert.equal(await conectarSocket(o.base, { cookie: cAna, origen: null }).abierto, false, 'sin Origin');
  assert.equal(await conectarSocket(o.base, { cookie: '__Host-sesion=' + 'a'.repeat(48), origen: o.base }).abierto, false, 'cookie inventada');
  const r = await fetch(o.base + '/api/live', { headers: { cookie: cAna, Origin: o.base } }); // sin Upgrade
  assert.equal(r.status, 426);
});

test('quien se conecta ve a quien ya estaba, y quien estaba ve a la que entra (presencia)', { skip: SALTAR }, async () => {
  sAna = conectarSocket(o.base, { cookie: cAna }); assert.equal(await sAna.abierto, true);
  const holaAna = await sAna.esperar((m) => m.tipo === 'hola');
  assert.deepEqual(quien(holaAna), ['Ana']);
  sBruno = conectarSocket(o.base, { cookie: cBruno }); assert.equal(await sBruno.abierto, true);
  const holaBruno = await sBruno.esperar((m) => m.tipo === 'hola');
  assert.deepEqual(quien(holaBruno), ['Ana', 'Bruno'], 'el saludo trae la lista, no una lista vacía');
  const aviso = await sAna.esperar((m) => m.tipo === 'presencia' && quien(m).includes('Bruno'));
  assert.ok(aviso);
  // la identidad la pone el SERVIDOR (de la sesión), no el cliente
  assert.equal(holaBruno.userId, BRUNO.id);
  const p = holaBruno.presentes.find((x) => x.nombre === 'Bruno'); assert.equal(p.userId, BRUNO.id); assert.equal(p.color, BRUNO.color);
});

test('el área en la que trabaja cada una llega a la otra, y un cambio de vista se actualiza', { skip: SALTAR }, async () => {
  const antes = sAna.recibidos.length;
  sBruno.enviar({ tipo: 'vista', area: 'estudio', etiqueta: 'Estudio' });
  const m = await sAna.esperar((x) => x.tipo === 'presencia' && x.presentes.find((p) => p.nombre === 'Bruno')?.area === 'estudio', { desde: antes });
  assert.equal(m.presentes.find((p) => p.nombre === 'Bruno').etiqueta, 'Estudio');
  sBruno.enviar({ tipo: 'vista', area: 'depto:marketing', etiqueta: 'Departamento Marketing' });
  const m2 = await sAna.esperar((x) => x.tipo === 'presencia' && x.presentes.find((p) => p.nombre === 'Bruno')?.area === 'depto:marketing');
  assert.equal(m2.presentes.find((p) => p.nombre === 'Bruno').etiqueta, 'Departamento Marketing');
  // un área con forma rara no entra (y no tumba la conexión)
  sBruno.enviar({ tipo: 'vista', area: '<img onerror=x>', etiqueta: 'x' }); sBruno.enviar('esto no es json'); sBruno.enviar({ tipo: 'otra-cosa', userId: ANA.id });
  const m3 = await sAna.esperar((x) => x.tipo === 'presencia' && x.presentes.find((p) => p.nombre === 'Bruno')?.area === null);
  assert.equal(m3.presentes.find((p) => p.nombre === 'Bruno').etiqueta, '');
  assert.equal(sBruno.ws.readyState, 1, 'la conexión sigue viva');
});

test('lo que escribe una LLEGA a la otra: un cambio de tareas por la API real aparece en su socket, con quién y la pestaña', { skip: SALTAR }, async () => {
  const antes = sBruno.recibidos.length;
  const r = await api(cAna, '/api/tareas/mias', { metodo: 'POST', cuerpo: { title: 'Cerrar el mes' }, cab: { 'X-Pestana': 'pestana-de-ana' } });
  assert.ok(r.status < 300, `${r.status} ${await r.clone().text()}`);
  const ev = await sBruno.esperar((m) => m.tipo === 'cambio' && m.area === 'tareas', { desde: antes });
  assert.equal(ev.por.nombre, 'Ana'); assert.equal(ev.por.id, ANA.id); assert.equal(ev.por.tab, 'pestana-de-ana');
  // y a la propia Ana también le llega (con su pestaña, para que ella descarte el eco)
  const eco = await sAna.esperar((m) => m.tipo === 'cambio' && m.por.tab === 'pestana-de-ana');
  assert.equal(eco.area, 'tareas');
  // el socket es un atajo: lo escrito está en D1 (la verdad)
  const lista = await (await api(cBruno, '/api/tareas/mias')).json();
  assert.ok(JSON.stringify(lista).includes('Cerrar el mes'));
});

test('una lectura o un fallo no difunden nada; un editor sin permiso tampoco', { skip: SALTAR }, async () => {
  const n = sBruno.recibidos.length;
  await api(cAna, '/api/tasks'); await api(cAna, '/api/tareas/mias', { metodo: 'POST', cuerpo: {} });
  await api(cBruno, '/api/equipo/invitaciones', { metodo: 'POST', cuerpo: { email: 'x@x.test', rol: 'editor' } }); // 403
  await new Promise((f) => setTimeout(f, 600));
  assert.deepEqual(sBruno.recibidos.slice(n).filter((m) => m.tipo === 'cambio'), []);
});

test('perfil en vivo: cambiar el nombre y subir la foto avisa al equipo (cambio:equipo) y la foto se sirve con sesión', { skip: SALTAR }, async () => {
  const antes = sAna.recibidos.length;
  assert.equal((await api(cBruno, '/api/yo', { metodo: 'PATCH', cuerpo: { nombre: 'Bruno Díaz' } })).status, 200);
  await sAna.esperar((m) => m.tipo === 'cambio' && m.area === 'equipo', { desde: antes });
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
  const sub = await fetch(o.base + '/api/yo/foto', { method: 'PUT', headers: { cookie: cBruno }, body: png });
  assert.equal(sub.status, 200); const { foto } = await sub.json();
  const f = await fetch(`${o.base}/api/equipo/${BRUNO.id}/foto?v=${foto}`, { headers: { cookie: cAna } });
  assert.equal(f.status, 200); assert.equal(f.headers.get('content-type'), 'image/png'); assert.equal(f.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(`${o.base}/api/equipo/${BRUNO.id}/foto`)).status, 401, 'sin sesión no se ve');
  assert.equal((await fetch(o.base + '/api/yo/foto', { method: 'PUT', headers: { cookie: cBruno }, body: new TextEncoder().encode('<svg onload=alert(1)/>') })).status, 415);
  const equipo = await (await api(cAna, '/api/equipo')).json();
  assert.equal(equipo.miembros.find((m) => m.id === BRUNO.id).nombre, 'Bruno Díaz');
  assert.ok(equipo.miembros.find((m) => m.id === BRUNO.id).foto);
});

test('invitar de punta a punta: enlace → página pública → cuenta → entra → aparece en la presencia', { skip: SALTAR }, async () => {
  const inv = await (await api(cAna, '/api/equipo/invitaciones', { metodo: 'POST', cuerpo: { email: 'carla@panaclaw.test', nombre: 'Carla', rol: 'lectura' } })).json();
  const path = new URL(inv.enlace).pathname;
  const pagina = await fetch(o.base + path); // la página nativa, SIN sesión
  assert.equal(pagina.status, 200); assert.match(await pagina.text(), /Invitación · Agents Office/);
  assert.match(pagina.headers.get('content-security-policy') || '', /script-src 'self'; style-src 'self'; /, 'CSP estricta, sin unsafe-inline');
  const ac = await fetch(o.base + path.replace('/invitacion/', '/api/invitacion/') + '/aceptar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre: 'Carla', contrasena: CLAVE }) });
  assert.equal(ac.status, 200);
  const cCarla = ac.headers.get('set-cookie').split(';')[0];
  const sCarla = conectarSocket(o.base, { cookie: cCarla }); assert.equal(await sCarla.abierto, true);
  await sAna.esperar((m) => m.tipo === 'presencia' && quien(m).includes('Carla'));
  // el rol de lectura se aplica en el servidor real
  assert.equal((await api(cCarla, '/api/agentes/marketing/ejecutar', { metodo: 'POST', cuerpo: { texto: 'hola' } })).status, 403);
  // quitarla corta su socket al momento
  const cerrado = new Promise((ok) => sCarla.ws.addEventListener('close', (e) => ok(e.code)));
  assert.equal((await api(cAna, `/api/equipo/${(await (await api(cAna, '/api/equipo')).json()).miembros.find((m) => m.nombre === 'Carla').id}`, { metodo: 'DELETE' })).status, 200);
  assert.equal(await cerrado, 4401);
  await sAna.esperar((m) => m.tipo === 'presencia' && !quien(m).includes('Carla'));
  assert.equal((await api(cCarla, '/api/yo')).status, 401);
});

test('al irse una persona, la otra deja de verla (cierre limpio)', { skip: SALTAR }, async () => {
  const n = sAna.recibidos.length;
  sBruno.cerrar();
  const m = await sAna.esperar((x) => x.tipo === 'presencia' && !quien(x).includes('Bruno'), { desde: n });
  assert.deepEqual(quien(m), ['Ana']);
});

test('cambiar la contraseña corta los sockets de esa persona; la sesión que cambió reconecta', { skip: SALTAR }, async () => {
  const cViejo = await entrar(o.base, BRUNO.email), cNuevo = await entrar(o.base, BRUNO.email);
  const s1 = conectarSocket(o.base, { cookie: cViejo }); await s1.abierto;
  const cerrado = new Promise((ok) => s1.ws.addEventListener('close', (e) => ok(e.code)));
  assert.equal((await api(cNuevo, '/api/yo/contrasena', { metodo: 'POST', cuerpo: { actual: CLAVE, nueva: 'una-clave-nueva-larga-9' } })).status, 200);
  assert.equal(await cerrado, 4401);
  assert.equal((await api(cViejo, '/api/yo')).status, 401, 'la otra sesión ya no vale');
  const s2 = conectarSocket(o.base, { cookie: cNuevo }); assert.equal(await s2.abierto, true, 'la que cambió sigue dentro'); s2.cerrar();
});

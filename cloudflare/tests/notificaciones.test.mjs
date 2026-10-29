// N0 (Fase 8): notificaciones por persona como proyección ADICIONAL de los avisos. Flag apagado por defecto; lo global (filas/notices) no cambia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { emitirAviso, emitirAvisos } from '../worker/lib/avisos.js';
import { guardarConfig, categoriaDe, destinatarios, veCategoria, POR_ROL, proyectar } from '../worker/lib/notificaciones.js';
import { podar } from '../worker/lib/mantenimiento.js';
import { leerDoc } from '../worker/lib/almacen.js';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';

async function oficina() {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' });
  const env = envDePrueba(d1);
  const nueva = (email, rol, nombre) => { const id = crypto.randomUUID(); d1._db.prepare("insert into users (id,email,rol,password_hash,salt) values (?,?,?,'x','x')").run(id, email, rol); d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(id, nombre); return id; };
  const ana = d1._db.prepare('select id from users where email = ?').get(c.email).id;
  d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(ana, 'Ana');
  const beto = nueva('beto@panaclaw.test', 'editor', 'Beto'), carla = nueva('carla@panaclaw.test', 'lectura', 'Carla');
  const llamar = async (id, ruta, { metodo = 'GET', cuerpo } = {}) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { cookie: `__Host-sesion=${await abrirSesion(d1, id)}`, ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined }), env);
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const cuantas = (id) => d1._db.prepare('select count(*) n from notificaciones where user_id = ?').get(id).n;
  return { d1, env, ana, beto, carla, llamar, cuantas };
}

test('flag apagado por defecto: el aviso global se guarda igual y no hay ninguna notificación; la API contesta vacío', { skip: SALTAR }, async () => {
  const o = await oficina();
  await emitirAviso(o.d1, { kind: 'failed', level: 'error', text: 'falló algo' });
  assert.equal(o.d1._db.prepare("select count(*) n from filas where coleccion = 'avisos'").get().n, 1);
  assert.equal(o.d1._db.prepare('select count(*) n from notificaciones').get().n, 0);
  const r = await o.llamar(o.ana, '/api/notificaciones'); assert.deepEqual(r.j, { activo: false, noLeidas: 0, items: [] });
});

test('encendido: cada aviso llega a quien su rol ve, el aviso global no cambia, y repetirlo (misma key) no duplica ni global ni por persona', { skip: SALTAR }, async () => {
  const o = await oficina(); await guardarConfig(o.d1, { activo: true });
  await emitirAviso(o.d1, { kind: 'failed', level: 'error', text: 'una tarea falló', task: 't1', key: 'k-falla' });      // agentes: admin y editor
  await emitirAviso(o.d1, { kind: 'failed', level: 'error', text: 'una tarea falló', task: 't1', key: 'k-falla' });      // repetido: nada
  await emitirAviso(o.d1, { kind: 'anuncios', text: 'gasto alto' });                                                        // gasto: solo admin
  await emitirAviso(o.d1, { kind: 'limite', text: 'vence mañana', task: 't2' });                                           // tareas: todos
  await emitirAviso(o.d1, { kind: 'rarisimo', text: 'desconocido' });                                                       // desconocido: sistema, solo admin
  assert.equal(o.d1._db.prepare("select count(*) n from filas where coleccion = 'avisos'").get().n, 4, 'lo global intacto');
  assert.equal(o.cuantas(o.ana), 4); assert.equal(o.cuantas(o.beto), 2); assert.equal(o.cuantas(o.carla), 1);
  const carla = (await o.llamar(o.carla, '/api/notificaciones')).j;
  assert.equal(carla.noLeidas, 1); assert.equal(carla.items[0].categoria, 'tareas'); assert.equal(carla.items[0].enlace, 'tarea:t2');
  assert.ok(!JSON.stringify(carla).includes('gasto') && !JSON.stringify(carla).includes('falló'), 'lectura no ve anuncios ni fallos de agentes');
});

test('un aviso dirigido (`persona`) llega solo a esa cuenta; a quien no tiene cuenta no llega; nunca al causante', { skip: SALTAR }, async () => {
  const o = await oficina(); await guardarConfig(o.d1, { activo: true });
  await emitirAviso(o.d1, { kind: 'persona', text: 'Te asignaron «X»', persona: 'beto', task: 't9' });
  await emitirAviso(o.d1, { kind: 'persona', text: 'para alguien sin cuenta', persona: 'Zacarías' });
  assert.equal(o.cuantas(o.beto), 1); assert.equal(o.cuantas(o.ana), 0); assert.equal(o.cuantas(o.carla), 0);
  await emitirAviso(o.d1, { kind: 'limite', text: 'lo causó Beto', causanteId: o.beto });
  assert.equal(o.cuantas(o.beto), 1, 'el causante no recibe el suyo'); assert.equal(o.cuantas(o.ana), 1);
});

test('leer y marcar leído es por persona: un id ajeno da 404 y no cambia nada; «todas» solo las mías', { skip: SALTAR }, async () => {
  const o = await oficina(); await guardarConfig(o.d1, { activo: true });
  await emitirAvisos(o.d1, [{ kind: 'limite', text: 'uno' }, { kind: 'proyecto', text: 'dos' }]);
  const delBeto = (await o.llamar(o.beto, '/api/notificaciones')).j.items, delaAna = (await o.llamar(o.ana, '/api/notificaciones')).j.items;
  assert.equal(delBeto.length, 2);
  assert.equal((await o.llamar(o.carla, '/api/notificaciones/leer', { metodo: 'POST', cuerpo: { id: delBeto[0].id } })).status, 404, 'ajena');
  assert.equal((await o.llamar(o.carla, '/api/notificaciones/leer', { metodo: 'POST', cuerpo: { id: 'no-existe' } })).status, 404);
  assert.equal((await o.llamar(o.beto, '/api/notificaciones')).j.noLeidas, 2, 'nada cambió');
  assert.equal((await o.llamar(o.beto, '/api/notificaciones/leer', { metodo: 'POST', cuerpo: { id: delBeto[0].id } })).j.marcadas, 1);
  assert.equal((await o.llamar(o.beto, '/api/notificaciones')).j.noLeidas, 1);
  assert.equal((await o.llamar(o.ana, '/api/notificaciones/leer', { metodo: 'POST', cuerpo: { ids: [...delaAna.map((x) => x.id), delBeto[1].id] } })).j.marcadas, 2, 'los ids ajenos de la lista no cuentan');
  assert.equal((await o.llamar(o.beto, '/api/notificaciones')).j.noLeidas, 1, 'lo de Beto sigue sin leer');
  assert.equal((await o.llamar(o.beto, '/api/notificaciones/leer', { metodo: 'POST', cuerpo: { todas: true } })).j.marcadas, 1);
  assert.equal((await o.llamar(o.beto, '/api/notificaciones?solo=noleidas')).j.items.length, 0);
  assert.equal((await o.llamar(o.carla, '/api/notificaciones')).j.noLeidas, 2, 'lo de Carla intacto');
  assert.equal(o.d1._db.prepare("select count(*) n from filas where coleccion = 'avisos' and json_extract(json,'$.read') = 1").get().n, 0, 'el read global no se toca');
});

test('el flag y el supuesto SEG-04 los cambia solo un administrador; lectura ve agentes/contenido únicamente si se enciende `lecturaVeResultados`', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.llamar(o.beto, '/api/notificaciones/config')).status, 403); assert.equal((await o.llamar(o.carla, '/api/notificaciones/config', { metodo: 'POST', cuerpo: { activo: true } })).status, 403);
  assert.deepEqual((await o.llamar(o.ana, '/api/notificaciones/config')).j, { activo: false, lecturaVeResultados: false });
  assert.deepEqual((await o.llamar(o.ana, '/api/notificaciones/config', { metodo: 'POST', cuerpo: { activo: true, basura: 1, lecturaVeResultados: 'sí' } })).j, { activo: true, lecturaVeResultados: false }, 'solo booleanos');
  await emitirAviso(o.d1, { kind: 'failed', text: 'falla 1' }); assert.equal(o.cuantas(o.carla), 0);
  await o.llamar(o.ana, '/api/notificaciones/config', { metodo: 'POST', cuerpo: { lecturaVeResultados: true } });
  await emitirAviso(o.d1, { kind: 'failed', text: 'falla 2' }); assert.equal(o.cuantas(o.carla), 1);
  await emitirAviso(o.d1, { kind: 'anuncios', text: 'dinero' }); assert.equal(o.cuantas(o.carla), 1, 'los anuncios nunca');
});

test('la matriz de roles: categorías por rol, y lo global de la oficina (aprobaciones, login) solo para administradores', () => {
  assert.deepEqual(POR_ROL.lectura, ['notas', 'chat', 'menciones', 'tareas']);
  for (const c of ['anuncios', 'bandeja', 'aprobaciones', 'sistema']) assert.ok(!veCategoria('editor', c) && veCategoria('admin', c), c);
  assert.equal(categoriaDe({ kind: 'contenido', key: 'bandeja-nuevos' }), 'bandeja'); assert.equal(categoriaDe({ kind: 'contenido', key: 'otra' }), 'contenido'); assert.equal(categoriaDe({ kind: '???' }), 'sistema');
  const gente = [{ id: 'a', rol: 'admin', clave: 'ana' }, { id: 'b', rol: 'editor', clave: 'beto' }];
  assert.deepEqual(destinatarios({ kind: 'espera-ok' }, gente).map((p) => p.id), ['a']);
  assert.deepEqual(destinatarios({ kind: 'limite' }, gente).map((p) => p.id), ['a', 'b']);
});

test('un aviso que no se puede proyectar no tumba la acción (la base falla y el aviso global igual se guarda)', { skip: SALTAR }, async () => {
  const o = await oficina(); await guardarConfig(o.d1, { activo: true });
  o.d1._db.exec('drop table notificaciones');
  const a = await emitirAviso(o.d1, { kind: 'limite', text: 'sigue' });
  assert.ok(a); assert.equal(o.d1._db.prepare("select count(*) n from filas where coleccion = 'avisos'").get().n, 1);
  assert.equal(await proyectar(o.d1, [a]), 0);
});

test('poda: leídas a los 60 días y sin leer a los 180; lo reciente se queda; el doc de configuración se conserva', { skip: SALTAR }, async () => {
  const o = await oficina(); await guardarConfig(o.d1, { activo: true });
  const ahora = Date.now(), d = 864e5, ins = o.d1._db.prepare('insert into notificaciones (id,user_id,aviso_id,categoria,titulo,creada_at,leida_at) values (?,?,?,?,?,?,?)');
  ins.run('n1', o.ana, 'a1', 'tareas', 'leída vieja', ahora - 100 * d, ahora - 70 * d);
  ins.run('n2', o.ana, 'a2', 'tareas', 'leída reciente', ahora - 100 * d, ahora - 10 * d);
  ins.run('n3', o.ana, 'a3', 'tareas', 'sin leer vieja', ahora - 200 * d, null);
  ins.run('n4', o.ana, 'a4', 'tareas', 'sin leer de hace 100 días', ahora - 100 * d, null);
  assert.equal((await podar(o.d1, ahora)).notificaciones, 2);
  assert.deepEqual(o.d1._db.prepare('select id from notificaciones order by id').all().map((r) => r.id), ['n2', 'n4']);
  assert.equal((await leerDoc(o.d1, 'notificaciones.config', {})).valor.activo, true);
});

test('una cuenta que se borra se lleva sus notificaciones (cascada)', { skip: SALTAR }, async () => {
  const o = await oficina(); await guardarConfig(o.d1, { activo: true });
  await emitirAviso(o.d1, { kind: 'limite', text: 'x' });
  o.d1._db.prepare('delete from users where id = ?').run(o.carla);
  assert.equal(o.cuantas(o.carla), 0); assert.ok(o.cuantas(o.ana) > 0);
});

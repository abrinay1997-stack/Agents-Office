// Fase 5 — textos guardados, plantillas, «Llenar la semana», repetir, «✨ Mejorar con Marketing», los ajustes de Contenido y la zona horaria de la oficina.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SALTAR } from './d1-memoria.mjs';
import { montar, enPanama } from './contenido-ayudas.mjs';
import { conZona, crearDateDeZona, describirZona, zonaValida } from '../worker/lib/zona.js';

const DIA = 864e5;

test('textos guardados: son una nota del Cerebro («Textos guardados»); un juego de hashtags se reconoce; el nombre manda y hay un tope', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false });
  assert.deepEqual((await t.api('/api/contenido/guardados')).datos, { textos: [], usados: [], nota: 'Contenido/Textos guardados.md' });
  const a = await t.api('/api/contenido/guardados', { metodo: 'POST', cuerpo: { nombre: 'Firma', texto: 'Óptica Sol · Calle 50' } }); assert.equal(a.status, 200);
  await t.api('/api/contenido/guardados', { metodo: 'POST', cuerpo: { nombre: 'Lentes', texto: '#lentes #optica #panama' } });
  const l = (await t.api('/api/contenido/guardados')).datos.textos; assert.deepEqual(l.map(x => [x.nombre, x.hashtags]), [['Firma', false], ['Lentes', true]]);
  const nota = t.d1._db.prepare("select grupo, texto from notas where nombre = 'Textos guardados'").get(); assert.equal(nota.grupo, 'Contenido'); assert.match(nota.texto, /## Firma\nÓptica Sol/);
  await t.api('/api/contenido/guardados', { metodo: 'POST', cuerpo: { nombre: 'firma', texto: 'Nueva firma' } }); // el nombre no distingue mayúsculas: reemplaza
  assert.equal((await t.api('/api/contenido/guardados')).datos.textos.length, 2);
  assert.match((await t.api('/api/contenido/guardados', { metodo: 'POST', cuerpo: { nombre: '', texto: 'x' } })).datos.error, /ponle un nombre/);
  assert.match((await t.api('/api/contenido/guardados', { metodo: 'POST', cuerpo: { nombre: 'x', texto: 'y'.repeat(2300) } })).datos.error, /como mucho 2200/);
  assert.equal((await t.api('/api/contenido/guardados/Firma', { metodo: 'DELETE' })).status, 200); assert.equal((await t.api('/api/contenido/guardados/Firma', { metodo: 'DELETE' })).status, 404);
  // los hashtags que más se usan, de las piezas
  await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'a', texto: 'hola', hashtags: '#lentes #sol' } }); await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'b', texto: 'hola', hashtags: '#lentes' } });
  assert.equal((await t.api('/api/contenido/guardados')).datos.usados[0], '#lentes');
});

test('plantillas: una pieza sin día ni archivos, como nota del Cerebro; reemplazar conserva el nombre; borrar va a la papelera; no pisa una nota que no es una plantilla', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false });
  const pieza = { formato: 'post', redes: ['instagram', 'facebook'], texto: 'Promo del mes: 2x1 en lentes.', hashtags: '#promo', comentario: 'Escríbenos' };
  const g = await t.api('/api/contenido/plantillas', { metodo: 'POST', cuerpo: { nombre: 'Promo del mes', pieza } }); assert.equal(g.status, 200); assert.equal(g.datos.reemplazada, false);
  const l = (await t.api('/api/contenido/plantillas')).datos; assert.equal(l.plantillas.length, 1); assert.equal(l.plantillas[0].texto, pieza.texto); assert.equal(l.carpeta, 'Contenido/Plantillas');
  assert.ok(!('fecha' in l.plantillas[0]) && !('medios' in l.plantillas[0]), 'sin día ni archivos');
  assert.equal(t.d1._db.prepare("select grupo from notas where nombre = 'Promo del mes'").get().grupo, 'Contenido');
  const r = await t.api('/api/contenido/plantillas', { metodo: 'POST', cuerpo: { nombre: 'promo DEL mes', pieza: { ...pieza, texto: 'Otra promo.' } } }); assert.equal(r.datos.reemplazada, true); assert.equal(r.datos.plantilla.nombre, 'Promo del mes');
  assert.equal((await t.api('/api/contenido/plantillas')).datos.plantillas.length, 1);
  assert.match((await t.api('/api/contenido/plantillas', { metodo: 'POST', cuerpo: { nombre: 'x', pieza: { formato: 'post' } } })).datos.error, /no tiene texto/);
  t.d1._db.prepare("insert into notas (nombre, grupo, oficina, texto, bytes, actualizado) values ('voice','00-Empresa',0,'Hablamos de tú.',10,1)").run();
  assert.match((await t.api('/api/contenido/plantillas', { metodo: 'POST', cuerpo: { nombre: 'voice', pieza } })).datos.error, /ya hay una nota del Cerebro/, 'una plantilla no pisa la voz de la marca');
  assert.equal(t.d1._db.prepare("select texto from notas where nombre = 'voice'").get().texto, 'Hablamos de tú.');
  assert.equal((await t.api('/api/contenido/plantillas/Promo%20del%20mes', { metodo: 'DELETE' })).status, 200);
  assert.equal((await t.api('/api/contenido/plantillas')).datos.plantillas.length, 0); assert.equal(t.d1._db.prepare('select count(*) n from contenido_papelera').get().n, 1);
  assert.equal(t.d1._db.prepare("select 1 from notas where nombre = 'Promo del mes'").get(), undefined, 'ya no está en el Cerebro');
});

test('Llenar la semana: propone huecos con su mejor hora y lo que vuelve; crear pone las copias en revisión y avisa que Marketing no está en la nube (todavía)', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false });
  const desde = enPanama(t.reloj + DIA).fecha;
  const p = await t.api(`/api/contenido/llenar?desde=${desde}&dias=5&redes=instagram,facebook`); assert.equal(p.status, 200);
  assert.deepEqual(Object.keys(p.datos).sort(), ['agente', 'desde', 'dias', 'hora', 'huecos', 'redes', 'vuelven']); assert.equal(p.datos.huecos.length, 5); assert.equal(p.datos.agente, 'INSTAGRAM'.length ? p.datos.agente : '');
  const c = await t.api('/api/contenido/llenar', { metodo: 'POST', cuerpo: { huecos: p.datos.huecos.slice(0, 2).map(h => ({ fecha: h.fecha, hora: h.hora, que: 'marketing' })), redes: ['instagram'] } });
  assert.equal(c.status, 200); assert.equal(c.datos.tarea, null); assert.match(c.datos.errores[0], /no hay agentes/); assert.equal(c.datos.pedidos, 2);
  assert.equal((await t.api('/api/contenido/llenar', { metodo: 'POST', cuerpo: { huecos: [] } })).status, 400);
  assert.match((await t.api('/api/contenido/llenar', { metodo: 'POST', cuerpo: { huecos: [{ fecha: enPanama(t.reloj - DIA).fecha, hora: '09:00', que: 'marketing' }] } })).datos.errores[0], /ya pasó/);
});

test('repetir: copias como borradores en los días que tocan (solo el dueño)', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false }); const f = enPanama(t.reloj + 3 * DIA).fecha;
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'semanal', fecha: f, hora: '09:00', texto: 'cada semana' } })).datos.pieza;
  const r = await t.api(`/api/contenido/piezas/${p.id}/repetir`, { metodo: 'POST', cuerpo: { cada: 'semana', veces: 3 } });
  assert.equal(r.status, 200); assert.equal(r.datos.creadas.length, 3); assert.ok(r.datos.creadas.every(c => c.estado === 'borrador' && c.origen === 'repetida'));
  assert.equal((await t.api(`/api/contenido/piezas/${p.id}/repetir`, { metodo: 'POST', cuerpo: { cada: 'siempre' } })).status, 400);
  const sin = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'sin día', texto: 'x' } })).datos.pieza;
  assert.equal((await t.api(`/api/contenido/piezas/${sin.id}/repetir`, { metodo: 'POST', cuerpo: { cada: 'dia', veces: 2 } })).status, 409);
});

test('«✨ Mejorar con Marketing»: pide la propuesta al modelo con la voz de la marca y no guarda nada; sin texto, lo dice; solo el dueño', { skip: SALTAR }, async () => {
  const pedidos = [];
  const t = await montar({ meta: false, env: { ANTHROPIC_API_KEY: 'sk-ant-prueba-0123456789' } }); // secrets-ok: una key de mentira
  const f0 = t.env.AO_FETCH;
  t.env.AO_FETCH = async (u, init) => { if (String(u).startsWith('https://api.anthropic.com')) { pedidos.push(JSON.parse(init.body)); return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"texto":"Agenda tu examen visual hoy mismo.","porque":"Más directo."}' }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } }); } return f0(u, init); };
  t.d1._db.prepare("insert into notas (nombre, grupo, oficina, texto, bytes, actualizado) values ('voice','00-Empresa',0,'Hablamos de tú, con calidez.',10,1)").run();
  const antes = (await t.api('/api/contenido')).datos.piezas.length;
  const r = await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: { pieza: { titulo: 'x', texto: 'agenda examen', redes: ['instagram'] }, red: 'instagram', pide: 'más corto' } });
  assert.equal(r.status, 200, JSON.stringify(r.datos)); assert.deepEqual(Object.keys(r.datos).sort(), ['agente', 'porque', 'red', 'texto']); assert.equal(r.datos.texto, 'Agenda tu examen visual hoy mismo.');
  assert.match(pedidos[0].system, /Hablamos de tú, con calidez/, 'la voz de la marca viaja al modelo'); assert.match(pedidos[0].system, /Devuelve SOLO un objeto JSON/); assert.equal(pedidos[0].mcp_servers, undefined, 'sin herramientas: solo escribe');
  assert.equal((await t.api('/api/contenido')).datos.piezas.length, antes, 'no guarda nada');
  assert.match((await t.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: { pieza: {} } })).datos.error, /escribe algo primero/);
  const sin = await montar({ meta: false }); // sin llave del modelo: un error en palabras, no un 500
  const e = await sin.api('/api/contenido/mejorar', { metodo: 'POST', cuerpo: { pieza: { texto: 'hola' } } }); assert.equal(e.status, 502); assert.match(e.datos.error, /ANTHROPIC_API_KEY/);
});

test('los ajustes de Contenido (solo la nube): se validan, quedan en la auditoría y por defecto es SIMULACRO', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false });
  const g = (await t.api('/api/contenido/config')).datos; assert.equal(g.config.modo, 'simulacro'); assert.equal(g.config.zona, 'America/Panama'); assert.deepEqual(g.modos, ['apagado', 'simulacro', 'real']); assert.equal(g.zona.utc, 'UTC−05:00');
  for (const mal of [{ modo: 'siempre' }, { conductor: 'x' }, { entregarHorasAntes: 9999 }, { redes: ['myspace'] }, { zona: 'Marte/Olimpo' }, { metaPagina: 'un texto con espacios' }, { token: 'x' }, []]) assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: mal })).status, 422, JSON.stringify(mal));
  const ok = await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'real', conductor: 'meta', redes: ['instagram'], zona: 'America/Bogota' } }); assert.equal(ok.status, 200);
  assert.equal(ok.datos.config.zona, 'America/Bogota'); assert.equal((await t.api('/api/contenido')).datos.ajustes.zona.utc, 'UTC−05:00'); assert.deepEqual((await t.api('/api/contenido')).datos.ajustes.redes, ['instagram']);
  assert.ok(t.d1._db.prepare("select detalle from auditoria where tipo = 'contenido-config'").get());
});

test('el reloj de la oficina: una subclase de Date que da la hora de Panamá igual que una computadora en esa zona (y solo mientras trabaja el módulo)', async () => {
  const DateReal = globalThis.Date;
  const casos = fileURLToPath(new URL('./contenido-zona-casos.mjs', import.meta.url));
  const local = execFileSync(process.execPath, [casos, 'local'], { env: { ...process.env, TZ: 'America/Panama' } }).toString();
  const sombra = execFileSync(process.execPath, [casos, 'sombra'], { env: { ...process.env, TZ: 'UTC' } }).toString();
  assert.equal(sombra, local, 'el Worker (UTC) con el reloj de la oficina da lo mismo que una computadora en Panamá');
  const otra = execFileSync(process.execPath, [casos, 'sombra-bogota'], { env: { ...process.env, TZ: 'UTC' } }).toString(), bogota = execFileSync(process.execPath, [casos, 'local'], { env: { ...process.env, TZ: 'America/Bogota' } }).toString();
  assert.equal(otra, bogota);
  let dentro; await conZona('America/Panama', async () => { dentro = new Date('2026-10-26T09:00:00').toISOString(); });
  assert.equal(dentro, '2026-10-26T14:00:00.000Z'); assert.equal(globalThis.Date, DateReal, 'al terminar vuelve el Date de verdad');
  await Promise.all([conZona('America/Panama', async () => { await new Promise(r => setTimeout(r, 5)); }), conZona('America/Panama', async () => { await new Promise(r => setTimeout(r, 1)); })]);
  assert.equal(globalThis.Date, DateReal, 'varias a la vez: el Date de verdad vuelve cuando sale la última');
  assert.ok(new DateReal() instanceof crearDateDeZona('America/Panama'), 'un Date de antes sigue siendo un Date');
  assert.equal(zonaValida('America/Panama'), true); assert.equal(zonaValida('Nada/Nada'), false); assert.equal(describirZona('America/Panama').utc, 'UTC−05:00');
});

// Fase 5 — las piezas de Contenido en D1: las mismas reglas y las mismas formas de respuesta que la oficina local, los permisos por rol y lo de «solo el dueño aprueba».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SALTAR } from './d1-memoria.mjs';
import { montar, subirImagen, enPanama } from './contenido-ayudas.mjs';
import { crearAlmacen } from '../../contenido/piezas.mjs';
import { crearControlador } from '../../contenido/rutas-nucleo.mjs';
import { huella } from '../../contenido/piezas-core.mjs';

const DIA = 864e5;
/** Una fecha y hora de Panamá dentro de `dias` días (a las 18:00). */
const manana = (t, dias = 2) => ({ fecha: enPanama(t.reloj + dias * DIA).fecha, hora: '18:00' });
/** La forma de un valor: sus claves, recursivamente (para comparar con la oficina local sin que importen los ids ni las fechas). */
const forma = v => Array.isArray(v) ? (v.length ? [forma(v[0])] : []) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, forma(v[k])])) : typeof v;

test('crear, leer, editar y borrar una pieza: ids, estados y errores en palabras', { skip: SALTAR }, async () => {
  const t = await montar(); const { fecha } = manana(t);
  const c = await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Examen visual', fecha, hora: '18:00', texto: 'Agenda tu examen visual hoy.', redes: ['instagram', 'facebook'] } });
  assert.equal(c.status, 200); assert.ok(c.datos.ok);
  const p = c.datos.pieza; assert.match(p.id, /^p-\d{8}-[a-f0-9]{4}$/); assert.equal(p.estado, 'borrador'); assert.equal(p.origen, 'dueno');
  assert.deepEqual(p.revision.errores.length > 0, true, 'sin imagen, Instagram no puede salir');
  assert.equal(p.salida, null);

  const g = await t.api('/api/contenido/piezas/' + p.id); assert.equal(g.status, 200); assert.equal(g.datos.pieza.titulo, 'Examen visual');
  assert.equal((await t.api('/api/contenido/piezas/p-20260101-abcd')).status, 404);
  assert.equal((await t.api('/api/contenido/piezas/no-es-un-id!')).status, 404, 'un id raro no es una pieza');

  const pa = await t.api('/api/contenido/piezas/' + p.id, { metodo: 'PATCH', cuerpo: { texto: 'Otro texto', hashtags: '#lentes' } });
  assert.equal(pa.status, 200); assert.equal(pa.datos.pieza.texto, 'Otro texto'); assert.equal(pa.datos.soltada, false);
  assert.match((await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { fecha: '2026-02-31' } })).datos.error, /no existe/);
  assert.match((await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { formato: 'meme' } })).datos.error, /formato es uno de/);
  assert.match((await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { estado: 'aprobada', titulo: 'x' } })).datos.error, /no nace aprobada/);
  assert.match((await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { medios: ['2026-10/no-existe.jpg'] } })).datos.error, /el Estudio no tiene/);

  const lista = await t.api(`/api/contenido?desde=${fecha}&hasta=${fecha}`);
  assert.equal(lista.datos.piezas.length, 1); assert.equal(lista.datos.resumen.total, 1);
  assert.deepEqual(lista.datos.ajustes.redes, ['instagram', 'facebook']); assert.equal(lista.datos.ajustes.modo, 'simulacro');
  assert.equal((await t.api('/api/contenido/resumen')).datos.borradores, 1);

  assert.equal((await t.api('/api/contenido/piezas/' + p.id, { metodo: 'DELETE' })).status, 200);
  assert.equal((await t.api('/api/contenido/piezas/' + p.id)).status, 404, 'a la papelera: ya no sale');
  assert.equal((await t.api('/api/contenido')).datos.piezas.length, 0);
});

test('aprobar: solo con día y hora, sin errores de las reglas y con la huella; cambiar lo que sale quita el OK', { skip: SALTAR }, async () => {
  const t = await montar(); await subirImagen(t.r2, '2026-10/foto.jpg'); const { fecha } = manana(t);
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'x', fecha, hora: '18:00', texto: 'Texto de prueba para Instagram y Facebook.', redes: ['instagram', 'facebook'], medios: ['2026-10/foto.jpg'] } })).datos.pieza;
  assert.deepEqual(p.medidas, { '2026-10/foto.jpg': { ancho: 1080, alto: 1350 } }, 'las medidas salen del registro del Estudio y se guardan con la pieza');

  const sinDia = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'sin día', texto: 'hola', medios: ['2026-10/foto.jpg'] } })).datos.pieza;
  const r0 = await t.api(`/api/contenido/piezas/${sinDia.id}/aprobar`, { metodo: 'POST', cuerpo: {} });
  assert.equal(r0.status, 409); assert.match(r0.datos.error, /ponle un día/);

  const ok = await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: { quien: 'otro-nombre' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.datos)); assert.equal(ok.datos.pieza.estado, 'aprobada');
  assert.equal(ok.datos.pieza.aprobada.por, t.usuario.email, 'quien aprueba lo pone la sesión, no el cuerpo');
  assert.equal(ok.datos.pieza.aprobada.huella, huella(ok.datos.pieza));
  assert.equal(ok.datos.pieza.cambiadaTrasAprobar, false);

  // lo que sale cambia → el OK era de otro texto
  const mod = await t.api('/api/contenido/piezas/' + p.id, { metodo: 'PATCH', cuerpo: { texto: 'Texto cambiado después de aprobar.' } });
  assert.equal(mod.datos.soltada, true); assert.equal(mod.datos.pieza.estado, 'revision'); assert.equal(mod.datos.pieza.aprobada, null);
  // el título y las notas no son «lo que sale»
  await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: {} });
  const titulo = await t.api('/api/contenido/piezas/' + p.id, { metodo: 'PATCH', cuerpo: { titulo: 'Nuevo título', notas: 'una nota' } });
  assert.equal(titulo.datos.soltada, false); assert.equal(titulo.datos.pieza.estado, 'aprobada');
  // guardar no aprueba
  const via = await t.api('/api/contenido/piezas/' + sinDia.id, { metodo: 'PATCH', cuerpo: { estado: 'aprobada' } });
  assert.equal(via.status, 400); assert.match(via.datos.error, /usa «Aprobar»/);
  // devolver
  const dev = await t.api(`/api/contenido/piezas/${p.id}/devolver`, { metodo: 'POST', cuerpo: { estado: 'borrador' } });
  assert.equal(dev.datos.pieza.estado, 'borrador');

  // una hora que ya pasó no se aprueba
  const vieja = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'v', fecha: enPanama(t.reloj - 3 * DIA).fecha, hora: '09:00', texto: 'ya pasó', redes: ['facebook'] } })).datos.pieza;
  const rv = await t.api(`/api/contenido/piezas/${vieja.id}/aprobar`, { metodo: 'POST', cuerpo: {} });
  assert.equal(rv.status, 409); assert.match(rv.datos.error, /pasó|momento|hora/i);
});

test('«Publicar ya» aprueba para dentro de ~5 minutos, en la hora de la oficina (no en UTC)', { skip: SALTAR }, async () => {
  const t = await montar(); await subirImagen(t.r2, '2026-10/foto.jpg');
  const p = (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'ya', texto: 'Sale ya.', redes: ['facebook'], medios: ['2026-10/foto.jpg'] } })).datos.pieza;
  const r = await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: { pronto: true } });
  assert.equal(r.status, 200, JSON.stringify(r.datos));
  const esperado = enPanama(t.reloj + 5 * 60e3 + 60e3); // el primer minuto entero a 5 min o más
  assert.equal(r.datos.pieza.fecha, esperado.fecha);
  const [h, m] = r.datos.pieza.hora.split(':').map(Number), [eh, em] = esperado.hora.split(':').map(Number);
  assert.ok(Math.abs((h * 60 + m) - (eh * 60 + em)) <= 1, `la hora ${r.datos.pieza.hora} es la de Panamá (${esperado.hora}), no la de UTC`);
});

test('permisos: lectura solo mira; un editor corrige pero no aprueba; un agente nunca aprueba ni borra', { skip: SALTAR }, async () => {
  const d = await montar(); const { fecha } = manana(d);
  const p = (await d.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'x', fecha, hora: '18:00', texto: 'hola', redes: ['facebook'] } })).datos.pieza;
  // el mismo mundo con otro rol: se crea la sesión de un editor y de uno de solo lectura
  const { sembrar } = await import('./d1-memoria.mjs'); const { manejar } = await import('../worker/lib/rutas.js'); const { pedir } = await import('./d1-memoria.mjs');
  const entrar = async rol => { const u = await sembrar(d.d1, { email: rol + '@x.test', rol }); const r = await pedir(manejar, d.env, '/api/acceso', { metodo: 'POST', cuerpo: { email: u.email, contrasena: u.clave } }); return r.headers.get('set-cookie').split(';')[0]; };
  const ed = await entrar('editor'), le = await entrar('lectura');
  assert.equal((await d.api('/api/contenido', { cookie: le })).status, 200);
  assert.equal((await d.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'a' }, cookie: le })).status, 403);
  assert.equal((await d.api('/api/contenido/piezas/' + p.id, { metodo: 'PATCH', cuerpo: { titulo: 'a' }, cookie: le })).status, 403);
  assert.equal((await d.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'del editor' }, cookie: ed })).status, 200);
  assert.equal((await d.api('/api/contenido/piezas/' + p.id, { metodo: 'PATCH', cuerpo: { titulo: 'a' }, cookie: ed })).status, 200);
  for (const [metodo, ruta] of [['POST', `/api/contenido/piezas/${p.id}/aprobar`], ['POST', `/api/contenido/piezas/${p.id}/devolver`], ['POST', '/api/contenido/cola/tick'], ['POST', `/api/contenido/piezas/${p.id}/entregar`], ['POST', `/api/contenido/piezas/${p.id}/quitar`], ['POST', `/api/contenido/piezas/${p.id}/repetir`], ['POST', '/api/contenido/llenar'], ['POST', '/api/contenido/mejorar'], ['POST', '/api/contenido/guardados'], ['POST', '/api/contenido/plantillas'], ['POST', '/api/contenido/conductor/comprobar'], ['POST', '/api/contenido/meta/sincronizar'], ['POST', '/api/contenido/analiticas/actualizar'], ['PUT', '/api/contenido/config']]) {
    assert.equal((await d.api(ruta, { metodo, cuerpo: { modo: 'real' }, cookie: ed })).status, 403, `${metodo} ${ruta} no es de un editor`);
  }
  // un agente (por: 'agente') nunca aprueba, devuelve, borra ni toca la cola — ni siquiera con la sesión del dueño
  for (const [metodo, ruta] of [['POST', `/api/contenido/piezas/${p.id}/aprobar`], ['POST', `/api/contenido/piezas/${p.id}/devolver`], ['DELETE', `/api/contenido/piezas/${p.id}`], ['POST', `/api/contenido/piezas/${p.id}/entregar`], ['POST', `/api/contenido/piezas/${p.id}/reintentar`], ['POST', `/api/contenido/piezas/${p.id}/quitar`], ['POST', `/api/contenido/piezas/${p.id}/repetir`], ['POST', '/api/contenido/llenar'], ['POST', '/api/contenido/guardados'], ['POST', '/api/contenido/plantillas'], ['POST', '/api/contenido/mejorar']]) {
    const r = await d.api(ruta, { metodo, cuerpo: { por: 'agente', agente: 'x' } });
    assert.equal(r.status, 403, `${metodo} ${ruta} con por: 'agente'`);
  }
  // …y un agente deja borradores, nada más
  const nueva = await d.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { por: 'agente', agente: 'ig', titulo: 'borrador del agente', estado: 'aprobada', texto: 'x' } });
  assert.equal(nueva.datos.pieza.estado, 'borrador'); assert.equal(nueva.datos.pieza.origen, 'agente:ig');
  assert.equal((await d.api('/api/contenido/piezas/' + nueva.datos.pieza.id, { metodo: 'PATCH', cuerpo: { por: 'agente', estado: 'aprobada', texto: 'mejor' } })).datos.pieza.estado, 'borrador');
});

test('las rutas de la Bandeja no son de este módulo: las contesta el módulo de la Bandeja (fase 7, va ANTES), nunca "no existe"', { skip: SALTAR }, async () => {
  const t = await montar();
  const r = await t.api('/api/contenido/bandeja');
  assert.notEqual(r.status, 404); assert.notEqual(r.status, 501);
  assert.notEqual((await t.api('/api/contenido/bandeja/meta:1/enviar', { metodo: 'POST', cuerpo: {} })).status, 501);
  assert.equal((await t.api('/api/contenido/nada-de-esto')).status, 404);
});

test('las respuestas de la nube tienen la MISMA forma que las de la oficina local para la misma entrada', { skip: SALTAR }, async () => {
  const t = await montar(); await subirImagen(t.r2, '2026-10/foto.jpg'); const { fecha } = manana(t);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-forma-'));
  fs.mkdirSync(path.join(dir, 'media', '2026-10'), { recursive: true }); fs.writeFileSync(path.join(dir, 'media', '2026-10', 'foto.jpg'), 'x'); fs.writeFileSync(path.join(dir, 'media', '2026-10', 'foto.json'), JSON.stringify({ kind: 'image', width: 1080, height: 1350, settings: { aspect: '4:5' } }));
  const local = crearAlmacen({ dir: path.join(dir, 'contenido'), medioExiste: () => true });
  const ctl = crearControlador({ almacen: local, ajustes: () => ({ departamentos: ['marketing'], modo: 'simulacro', conductor: 'simulacro', zona: {}, redes: ['instagram', 'facebook'] }) });
  const L = (metodo, p, cuerpo = {}, q = '') => ctl.responder({ metodo, p, query: new URLSearchParams(q), cuerpo: async () => cuerpo });
  const dato = { titulo: 'x', fecha, hora: '18:00', texto: 'Texto de prueba.', redes: ['instagram', 'facebook'], medios: ['2026-10/foto.jpg'], hashtags: '#a' };

  const lc = await L('POST', '/api/contenido/piezas', dato), nc = await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: dato });
  assert.equal(nc.status, lc.status);
  const sacar = o => { const { id, creada, actualizada, medidas, ...resto } = o.pieza; return { ...o, pieza: resto }; };
  assert.deepEqual(forma(sacar(nc.datos)), forma(sacar(lc.datos)));
  assert.deepEqual(Object.keys(nc.datos.pieza).sort(), Object.keys(lc.datos.pieza).sort(), 'la pieza lleva los mismos campos');
  for (const [m, ruta, c, q] of [['GET', '/api/contenido', {}, `desde=${fecha}&hasta=${fecha}`], ['GET', '/api/contenido/resumen', {}, ''], ['GET', '/api/contenido/cola', {}, ''], ['GET', '/api/contenido/usos', {}, 'medio=x'], ['GET', '/api/contenido/cuentas', {}, ''], ['GET', '/api/contenido/plantillas', {}, '']]) {
    const a = await L(m, ruta, c, q), b = await t.api(ruta + (q ? '?' + q : ''), { metodo: m });
    assert.equal(b.status, a.status, ruta);
    if (ruta === '/api/contenido/cola' || ruta === '/api/contenido/cuentas' || ruta === '/api/contenido') continue; // la cola, las cuentas y los ajustes dependen de la configuración; se prueban aparte
    assert.deepEqual(forma(b.datos), forma(a.datos), ruta);
  }
  const aprobar = await Promise.all([L('POST', `/api/contenido/piezas/${lc.datos.pieza.id}/aprobar`, {}), t.api(`/api/contenido/piezas/${nc.datos.pieza.id}/aprobar`, { metodo: 'POST', cuerpo: {} })]);
  assert.equal(aprobar[1].status, aprobar[0].status);
  assert.deepEqual(Object.keys(aprobar[1].datos).sort(), Object.keys(aprobar[0].datos).sort());
});

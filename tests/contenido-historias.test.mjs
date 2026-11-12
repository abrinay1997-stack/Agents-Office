// Historias automáticas (11 nov 2026): lo puro y el corredor con un almacén de piezas de verdad en una carpeta temporal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearAlmacen } from '../contenido/piezas.mjs';
import { crearControlador } from '../contenido/rutas-nucleo.mjs';
import * as H from '../contenido/historias-auto.mjs';

const AHORA = new Date('2026-11-11T09:00:00').getTime();
const pieza = (id, fecha, mas = {}) => ({ id, titulo: 'Pieza ' + id, fecha, hora: '10:00', formato: 'post', redes: ['instagram', 'facebook'], medios: [id + '.jpg'], estado: 'aprobada', ...mas });
const salio = ids => Object.fromEntries(ids.map(i => [i, { estado: 'publicada' }]));

test('ajustes: apagadas por defecto, y lo que no vale vuelve a su valor', () => {
  assert.deepEqual(H.ajustesHistorias({}), { activo: false, hora: '18:00', porDia: 1, sinOk: false });
  assert.deepEqual(H.ajustesHistorias({ historiasAuto: true, historiasHora: '25:00', historiasPorDia: 9, historiasSinOk: 'si' }), { activo: true, hora: '18:00', porDia: 5, sinOk: false });
  assert.equal(H.ajustesHistorias({ historiasAuto: 'true' }).activo, false, 'solo el booleano true enciende');
});

test('horas del día: cada dos horas y, si no caben antes de las 22:00, se juntan sin bajar de 30 minutos', () => {
  assert.deepEqual(H.horasDelDia('18:00', 1), ['18:00']);
  assert.deepEqual(H.horasDelDia('10:00', 3), ['10:00', '12:00', '14:00']);
  assert.deepEqual(H.horasDelDia('18:00', 5), ['18:00', '19:00', '20:00', '21:00', '22:00']);
  assert.deepEqual(H.horasDelDia('21:30', 3), ['21:30', '22:00', '22:30']);
});

test('el día que toca: hoy si faltan más de 10 minutos para su hora; si no, mañana', () => {
  assert.equal(H.proximaFecha(AHORA, '18:00'), '2026-11-11');
  assert.equal(H.proximaFecha(new Date('2026-11-11T17:55:00').getTime(), '18:00'), '2026-11-12');
  assert.equal(H.proximaFecha(new Date('2026-11-30T23:00:00').getTime(), '18:00'), '2026-12-01');
});

test('candidatas: solo lo publicado con imagen, ni muy fresco ni muy viejo, y sin repetir la misma en 4 días', () => {
  const piezas = [
    pieza('a', '2026-11-01'), pieza('b', '2026-11-05'),
    pieza('fresca', '2026-11-10'), pieza('vieja', '2026-07-01'), pieza('sin-salir', '2026-11-02'),
    pieza('video', '2026-11-03', { medios: ['v.mp4'] }), pieza('linkedin', '2026-11-03', { redes: ['linkedin'] }), pieza('hist', '2026-11-03', { formato: 'historia' }),
    pieza('h1', '2026-11-09', { formato: 'historia', origen: 'historia:b' }), // «b» ya volvió hace 2 días
  ];
  const cs = H.candidatas({ piezas, salidas: salio(['a', 'b', 'fresca', 'vieja', 'video', 'linkedin', 'hist']), fecha: '2026-11-11' });
  assert.deepEqual(cs.map(c => c.pieza.id), ['a']);
  assert.equal(cs[0].imagen, 'a.jpg');
  const luego = H.candidatas({ piezas, salidas: salio(['a', 'b']), fecha: '2026-11-13' }); // 4 días después de la historia de «b»: ya puede, pero va detrás (más usada)
  assert.deepEqual(luego.map(c => c.pieza.id), ['a', 'b']);
});

test('candidatas: a igual uso, primero la que más movió; un carrusel usa su primera imagen', () => {
  const piezas = [pieza('a', '2026-11-01'), pieza('b', '2026-11-02'), pieza('c', '2026-11-03', { formato: 'carrusel', medios: ['clip.mp4', 'c2.png'] })];
  const cs = H.candidatas({ piezas, salidas: salio(['a', 'b', 'c']), resultados: { b: 90, a: 10 }, fecha: '2026-11-11' });
  assert.deepEqual(cs.map(c => c.pieza.id), ['b', 'a', 'c']);
  assert.equal(cs[2].imagen, 'c2.png');
});

function oficina({ cfg, publicadas = ['p-20261101-aaaa', 'p-20261102-bbbb'] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-historias-'));
  const almacen = crearAlmacen({ dir, ahora: () => AHORA });
  const hechas = [];
  for (const [i, f] of ['2026-11-01', '2026-11-02'].entries()) {
    const r = almacen.crear({ titulo: 'Oferta ' + (i + 1), fecha: f, hora: '10:00', formato: 'post', redes: ['instagram', 'facebook'], medios: [`foto${i}.jpg`], texto: 'Texto de la oferta', estado: 'borrador' }, { por: 'dueno' });
    assert.ok(r.pieza, r.error); hechas.push(r.pieza.id);
  }
  let guardado = {}; const avisos = [];
  const h = H.crearHistoriasAuto({
    almacen, ajustes: () => cfg, ahora: () => AHORA, notice: (k, t) => avisos.push(t), modo: () => 'simulacro',
    salidaDe: id => (hechas.includes(id) && publicadas.length ? { estado: 'publicada' } : null),
    estado: { leer: () => guardado, guardar: v => { guardado = v; } },
  });
  return { almacen, h, avisos, hechas, estado: () => guardado, dir };
}

test('apagadas no hacen nada; encendidas preparan el día UNA vez y cada historia espera el OK del dueño', async () => {
  const cfg = { historiasAuto: false, historiasPorDia: 2 };
  const o = oficina({ cfg });
  assert.equal((await o.h.tick()).hecho, false);
  cfg.historiasAuto = true;
  const r = await o.h.tick();
  assert.equal(r.hecho, true); assert.equal(r.fecha, '2026-11-11'); assert.equal(r.creadas.length, 2);
  const hs = o.almacen.listar({}).filter(H.esHistoriaAuto);
  assert.deepEqual(hs.map(p => p.hora).sort(), ['18:00', '20:00']);
  for (const p of hs) { assert.equal(p.formato, 'historia'); assert.equal(p.estado, 'revision', 'nace en revisión: no sale sin el OK'); assert.equal(p.medios.length, 1); assert.ok(o.hechas.includes(H.raizHistoria(p))); }
  assert.equal(new Set(hs.map(H.raizHistoria)).size, 2, 'dos publicaciones distintas');
  assert.match(o.avisos[0], /esperan tu OK/);
  assert.equal((await o.h.tick()).hecho, false, 'el mismo día no se prepara dos veces');
  assert.equal(o.almacen.listar({}).filter(H.esHistoriaAuto).length, 2);
  o.almacen.aPapelera?.(hs[0].id);
  assert.equal((await o.h.tick()).hecho, false, 'la que el dueño tiró no se vuelve a crear');
});

test('con «sin pedirme el OK» nacen aprobadas, firmadas por historias-auto', async () => {
  const o = oficina({ cfg: { historiasAuto: true, historiasSinOk: true } });
  const r = await o.h.tick();
  assert.equal(r.creadas.length, 1); assert.equal(r.creadas[0].sola, true);
  const p = o.almacen.listar({}).find(H.esHistoriaAuto);
  assert.equal(p.estado, 'aprobada'); assert.equal(p.aprobada.por, 'historias-auto');
  assert.match(o.avisos[0], /sale sola/);
});

test('sin nada publicado que pueda volver, el día queda apuntado con su porqué (no se reintenta cada minuto)', async () => {
  const o = oficina({ cfg: { historiasAuto: true }, publicadas: [] });
  const r = await o.h.tick();
  assert.equal(r.creadas.length, 0); assert.match(o.estado().nota, /ninguna publicación podía volver/);
  assert.equal(o.estado().ultimaFecha, '2026-11-11');
  assert.equal(o.avisos.length, 0);
});

test('las rutas: cualquiera las ve; preparar ya es solo del dueño', async () => {
  const o = oficina({ cfg: { historiasAuto: true } });
  const ctl = crearControlador({ almacen: o.almacen, historias: o.h, ahora: () => AHORA });
  const ver = await ctl.responder({ metodo: 'GET', p: '/api/contenido/historias-auto' });
  assert.equal(ver.status, 200); assert.equal(ver.datos.candidatas.length, 2); assert.match(ver.datos.texto, /encendidas/);
  const agente = await ctl.responder({ metodo: 'POST', p: '/api/contenido/historias-auto/preparar', cuerpo: async () => ({ por: 'agente' }) });
  assert.equal(agente.status, 403);
  const dueno = await ctl.responder({ metodo: 'POST', p: '/api/contenido/historias-auto/preparar', cuerpo: async () => ({}) });
  assert.equal(dueno.status, 200); assert.equal(dueno.datos.creadas.length, 1);
});

test('con varias copias a la vez (el Worker), el candado deja preparar el día UNA sola vez', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-historias-candado-'));
  const almacen = crearAlmacen({ dir, ahora: () => AHORA });
  for (const [i, f] of ['2026-11-01', '2026-11-02'].entries()) {
    const r = almacen.crear({ titulo: 'Oferta ' + (i + 1), fecha: f, hora: '10:00', formato: 'post', redes: ['instagram'], medios: [`foto${i}.jpg`], texto: 'Texto', estado: 'borrador' }, { por: 'dueno' });
    assert.ok(r.pieza, r.error);
  }
  // un solo candado compartido, como el de D1: lo toma quien llega primero y el otro se va con su motivo
  let tomado = null;
  const candado = { tomar: async () => { if (tomado) return false; tomado = 'yo'; return true; }, soltar: async () => { tomado = null; } };
  let guardado = {};
  const copia = () => H.crearHistoriasAuto({ // cada invocación arma su PROPIO objeto: `enMarcha` no las coordina, el candado sí
    almacen, ajustes: () => ({ historiasAuto: true, historiasPorDia: 2 }), ahora: () => AHORA, candado,
    salidaDe: async () => { await new Promise(r => setTimeout(r, 5)); return { estado: 'publicada' }; }, // leer tarda: deja que la otra entre
    estado: { leer: async () => guardado, guardar: async v => { guardado = v; } },
  });
  const [a, b] = await Promise.all([copia().tick(), copia().tick()]);
  const hechas = almacen.listar({}).filter(H.esHistoriaAuto);
  assert.equal(hechas.length, 2, 'dos historias en total, no cuatro');
  assert.equal([a, b].filter(r => r.hecho).length, 1);
  assert.equal([a, b].find(r => !r.hecho).motivo, 'otra vuelta las está preparando');
  assert.equal(tomado, null, 'el candado se suelta al terminar');
  // y una segunda vuelta FORZADA (el botón del dueño) tampoco duplica: ya están las del día
  const r = await copia().tick({ forzar: true });
  assert.equal(r.creadas.length, 0);
  assert.equal(almacen.listar({}).filter(H.esHistoriaAuto).length, 2);
});
